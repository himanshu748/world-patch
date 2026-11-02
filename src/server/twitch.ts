import WebSocket from 'ws';
import { z } from 'zod';
import { MAX_PROVIDER_ID_LENGTH } from '../shared/protocol.js';

export interface TwitchConfig { clientId: string; clientSecret: string; redirectUri: string }
export interface TwitchStatus {
  state: 'disabled' | 'disconnected' | 'authorizing' | 'connecting' | 'ready' | 'reconnecting' | 'error';
  channel?: string;
  reason?: string;
  lastEventAt?: number;
  received: number;
}
export interface TwitchChatEvent {
  source: 'twitch'; eventId: string; messageId: string; userId: string;
  displayName: string; text: string; receivedAt: number; sentAt: number;
}
export interface TwitchCallbacks {
  onChat(event: TwitchChatEvent): void;
  onStatus(status: TwitchStatus): void;
  onGap(reason: string): void;
}
/** Deliberately small adapter boundary: fixtures can drive real provider-shaped frames. */
export interface TwitchSocket {
  onMessage(callback: (text: string) => void): void;
  onClose(callback: () => void): void;
  onError(callback: () => void): void;
  close(): void;
  terminate(): void;
}
export interface TwitchDependencies {
  fetch?: typeof fetch;
  websocket?: (url: string) => TwitchSocket;
  now?: () => number;
  random?: () => number;
}

const AUTH = 'https://id.twitch.tv/oauth2/authorize';
const TOKEN = 'https://id.twitch.tv/oauth2/token';
const VALIDATE = 'https://id.twitch.tv/oauth2/validate';
const SUBSCRIPTIONS = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const SOCKET = 'wss://eventsub.wss.twitch.tv/ws';
const SCOPE = 'user:read:chat';
const MAX_FRAME = 65_536;
const MAX_RECONNECTS = 6;
const HOUR = 3_600_000;
const ID = z.string().min(1).max(MAX_PROVIDER_ID_LENGTH);
const tokenSchema = z.object({
  access_token: z.string().min(1).max(4096), refresh_token: z.string().min(1).max(4096),
  expires_in: z.number().int().positive(), scope: z.array(z.string()).max(64),
});
const identitySchema = z.object({
  client_id: ID, user_id: z.string().regex(/^\d{1,30}$/), login: z.string().min(1).max(64),
  scopes: z.array(z.string()).max(64), expires_in: z.number().int().nonnegative(),
});
const envelopeSchema = z.object({
  metadata: z.object({
    message_id: ID, message_type: z.enum(['session_welcome', 'session_keepalive', 'notification', 'session_reconnect', 'revocation']),
    message_timestamp: z.string().min(1).max(64), subscription_type: z.string().optional(), subscription_version: z.string().optional(),
  }), payload: z.unknown(),
});
const welcomeSchema = z.object({ session: z.object({
  id: ID, status: z.literal('connected'), keepalive_timeout_seconds: z.number().int().min(10).max(600),
}) });
const subscriptionSchema = z.object({
  id: ID, type: z.literal('channel.chat.message'), version: z.literal('1'), status: z.string(),
  condition: z.object({ broadcaster_user_id: ID, user_id: ID }),
  transport: z.object({ method: z.literal('websocket'), session_id: ID }),
});
const notificationSchema = z.object({
  subscription: subscriptionSchema,
  event: z.object({
    broadcaster_user_id: ID, chatter_user_id: z.string().regex(/^\d{1,30}$/),
    chatter_user_name: z.string().min(1).max(64), message_id: ID,
    message: z.object({ text: z.string().max(500) }),
  }),
});
const reconnectSchema = z.object({ session: z.object({
  id: ID, status: z.literal('reconnecting'), reconnect_url: z.string().max(4096),
}) });

class TwitchError extends Error {
  constructor(readonly safeReason: string) { super(safeReason); }
}
type Tokens = z.infer<typeof tokenSchema>;
type Identity = z.infer<typeof identitySchema>;
type Timer = ReturnType<typeof setTimeout>;
interface SocketContext {
  socket: TwitchSocket; retired: boolean; id?: string; welcome: boolean;
  keepalive: number; watchdog?: Timer; parent?: SocketContext;
}

function nativeSocket(url: string): TwitchSocket {
  const ws = new WebSocket(url, { maxPayload: MAX_FRAME, perMessageDeflate: false, handshakeTimeout: 5000, followRedirects: false });
  return {
    onMessage(callback) { ws.on('message', (raw, binary) => { if (!binary) callback(raw.toString()); }); },
    onClose(callback) { ws.on('close', callback); },
    onError(callback) { ws.on('error', callback); },
    close() { ws.close(); },
    terminate() { ws.terminate(); },
  };
}

/** No tokens or raw provider errors leave this closure. OAuth state binding belongs to the HTTP host. */
export function createTwitch(config: TwitchConfig | undefined, callbacks: TwitchCallbacks, deps: TwitchDependencies = {}) {
  const http = deps.fetch ?? globalThis.fetch;
  const socketFactory = deps.websocket ?? nativeSocket;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  let current: TwitchStatus = { state: config ? 'disconnected' : 'disabled', received: 0 };
  let generation = 0;
  let lifetime = new AbortController();
  let stopped = true;
  let tokens: Tokens | undefined;
  let identity: Identity | undefined;
  let active: SocketContext | undefined;
  let migrating: SocketContext | undefined;
  let subscriptionId: string | undefined;
  let acceptedSessionIds = new Set<string>();
  let reconnects = 0;
  let reconnectTimer: Timer | undefined;
  let refreshing: Promise<void> | undefined;
  const timers = new Set<Timer>();
  const contexts = new Set<SocketContext>();
  const seen = new Map<string, number>();

  function status(): TwitchStatus { return { ...current }; }
  function publish(patch: Partial<TwitchStatus>) {
    current = { ...current, ...patch };
    // Presentation/persistence observers cannot interrupt transport cleanup.
    try { callbacks.onStatus(status()); } catch { /* The host owns observer diagnostics. */ }
  }
  function notifyGap(reason: string) {
    try { callbacks.onGap(reason); } catch { /* The host must latch failed cancellation before throwing. */ }
  }
  function later(callback: () => void, delay: number): Timer {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timer.unref?.();
    timers.add(timer);
    return timer;
  }
  function clear(timer: Timer | undefined) { if (timer) { clearTimeout(timer); timers.delete(timer); } }
  function retire(context: SocketContext, graceful = false) {
    context.retired = true;
    clear(context.watchdog);
    contexts.delete(context);
    if (graceful) context.socket.close(); else context.socket.terminate();
  }
  function clearResources() {
    generation += 1;
    stopped = true;
    lifetime.abort();
    lifetime = new AbortController();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const context of [...contexts]) retire(context);
    active = undefined; migrating = undefined; reconnectTimer = undefined;
    tokens = undefined; identity = undefined; refreshing = undefined;
    subscriptionId = undefined; acceptedSessionIds.clear(); seen.clear(); reconnects = 0;
  }
  function fail(reason: string) {
    if (stopped) return;
    clearResources();
    notifyGap(reason);
    publish({ state: 'error', reason, channel: undefined });
  }
  function ensure(epoch: number) {
    if (stopped || epoch !== generation || lifetime.signal.aborted) throw new TwitchError('cancelled');
  }
  function pause(ms: number, epoch: number): Promise<void> {
    const signal = lifetime.signal;
    return new Promise((resolve, reject) => {
      const abort = () => { clear(timer); reject(new TwitchError('cancelled')); };
      const timer = later(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted || epoch !== generation) abort();
    });
  }
  async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) throw new TwitchError('request_timeout');
    let abort: () => void = () => undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new TwitchError('request_timeout'));
      signal.addEventListener('abort', abort, { once: true });
    });
    try { return await Promise.race([promise, cancellation]); }
    finally { signal.removeEventListener('abort', abort); }
  }
  async function readJson(response: Response): Promise<unknown> {
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > MAX_FRAME) { await reader.cancel(); throw new TwitchError('invalid_provider_response'); }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch (error) {
      if (error instanceof TwitchError) throw error;
      throw new TwitchError('invalid_provider_response');
    } finally { reader.releaseLock(); }
  }
  async function request(url: string, init: RequestInit, epoch: number): Promise<{ status: number; body: unknown }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      ensure(epoch);
      const timeout = new AbortController();
      const timer = later(() => timeout.abort(), 5000);
      const signal = AbortSignal.any([lifetime.signal, timeout.signal]);
      let response: Response;
      let body: unknown;
      try {
        const result = await abortable((async () => {
          const resultResponse = await http(url, { ...init, redirect: 'error', signal });
          const resultBody = await readJson(resultResponse);
          return { response: resultResponse, body: resultBody };
        })(), signal);
        response = result.response; body = result.body;
      } catch (error) {
        ensure(epoch);
        if (error instanceof TwitchError) throw error;
        throw new TwitchError('network_unavailable');
      } finally { clear(timer); }
      ensure(epoch);
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const retry = Number(response.headers.get('retry-after'));
        // A long provider backoff cannot fit the welcome deadline; fail instead of retrying early.
        if (response.status === 429 && Number.isFinite(retry) && retry > 1) throw new TwitchError('rate_limited');
        const delay = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 200 + Math.floor(random() * 200);
        await pause(delay, epoch);
        continue;
      }
      return { status: response.status, body };
    }
    throw new TwitchError('provider_unavailable');
  }
  function form(values: Record<string, string>): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() };
  }
  function requireConfig(): TwitchConfig {
    if (!config?.clientId || !config.clientSecret || !config.redirectUri) throw new TwitchError('not_configured');
    return config;
  }
  async function validateToken(access: string, epoch: number): Promise<{ status: number; identity?: Identity }> {
    const result = await request(VALIDATE, { headers: { Authorization: `OAuth ${access}` } }, epoch);
    if (result.status !== 200) return { status: result.status };
    const parsed = identitySchema.safeParse(result.body);
    if (!parsed.success || parsed.data.client_id !== config?.clientId || !parsed.data.scopes.includes(SCOPE) || parsed.data.expires_in <= 0) {
      throw new TwitchError('token_identity_invalid');
    }
    return { status: result.status, identity: parsed.data };
  }
  async function refresh(epoch: number): Promise<void> {
    if (refreshing) return refreshing;
    const previousIdentity = identity;
    const previousTokens = tokens;
    const cfg = requireConfig();
    const task = (async () => {
      if (!previousTokens || !previousIdentity) throw new TwitchError('authorization_required');
      const result = await request(TOKEN, form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: previousTokens.refresh_token }), epoch);
      const parsed = tokenSchema.safeParse(result.body);
      if (result.status !== 200 || !parsed.success || !parsed.data.scope.includes(SCOPE)) throw new TwitchError('authorization_required');
      const validated = await validateToken(parsed.data.access_token, epoch);
      if (!validated.identity || validated.identity.user_id !== previousIdentity.user_id) throw new TwitchError('token_identity_invalid');
      ensure(epoch);
      tokens = parsed.data; identity = validated.identity;
    })();
    refreshing = task;
    try { await task; } finally { if (refreshing === task) refreshing = undefined; }
  }
  async function authorizedRequest(url: string, init: RequestInit, epoch: number) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!tokens) throw new TwitchError('authorization_required');
      const result = await request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${tokens.access_token}`, 'Client-Id': requireConfig().clientId } }, epoch);
      if (result.status !== 401 || attempt === 1) return result;
      await refresh(epoch);
    }
    throw new TwitchError('authorization_required');
  }
  function scheduleValidation(epoch: number) {
    later(() => {
      void (async () => {
        ensure(epoch);
        if (!tokens) throw new TwitchError('authorization_required');
        const result = await validateToken(tokens.access_token, epoch);
        if (result.status === 401) await refresh(epoch);
        else if (!result.identity || result.identity.user_id !== identity?.user_id) throw new TwitchError('authorization_required');
        ensure(epoch); scheduleValidation(epoch);
      })().catch(error => { if (epoch === generation && !stopped) fail(error instanceof TwitchError ? error.safeReason : 'provider_unavailable'); });
    }, HOUR);
  }
  function resetWatchdog(context: SocketContext, epoch: number) {
    clear(context.watchdog);
    context.watchdog = later(() => connectionLost(context, epoch, 'keepalive_timeout'), context.keepalive + 1000);
  }
  function connectionLost(context: SocketContext, epoch: number, reason: string) {
    if (context.retired || epoch !== generation || stopped) return;
    for (const other of [...contexts]) retire(other);
    active = undefined; migrating = undefined; subscriptionId = undefined; acceptedSessionIds.clear();
    notifyGap(reason);
    publish({ state: 'reconnecting', reason });
    if (reconnectTimer) return;
    if (reconnects >= MAX_RECONNECTS) { fail('reconnect_exhausted'); return; }
    const delay = Math.min(500 * 2 ** reconnects, 15_000) + Math.floor(random() * 250);
    reconnects += 1;
    reconnectTimer = later(() => {
      reconnectTimer = undefined;
      if (!stopped && generation === epoch) openSocket(SOCKET, epoch);
    }, delay);
  }
  function validSubscription(subscription: z.infer<typeof subscriptionSchema>) {
    return subscription.id === subscriptionId
      && subscription.condition.broadcaster_user_id === identity?.user_id
      && subscription.condition.user_id === identity?.user_id
      && acceptedSessionIds.has(subscription.transport.session_id);
  }
  function duplicate(eventId: string, chatId: string) {
    const cutoff = now() - 600_000;
    for (const [key, at] of seen) { if (at < cutoff) seen.delete(key); else break; }
    const eventKey = `event:${eventId}`; const chatKey = `chat:${chatId}`;
    if (seen.has(eventKey) || seen.has(chatKey)) return true;
    seen.set(eventKey, now()); seen.set(chatKey, now());
    while (seen.size > 4096) { const oldest = seen.keys().next().value; if (oldest === undefined) break; seen.delete(oldest); }
    return false;
  }
  function reconnectUrl(raw: string): boolean {
    try {
      const url = new URL(raw);
      return url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && (!url.port || url.port === '443') && !url.username && !url.password && !url.hash;
    } catch { return false; }
  }
  async function onMessage(context: SocketContext, text: string, epoch: number) {
    if (context.retired || stopped || epoch !== generation || Buffer.byteLength(text) > MAX_FRAME) return;
    let decoded: unknown;
    try { decoded = JSON.parse(text) as unknown; } catch { return; }
    const parsed = envelopeSchema.safeParse(decoded);
    if (!parsed.success) return;
    const { metadata, payload } = parsed.data;
    const timestamp = Date.parse(metadata.message_timestamp);
    if (!Number.isFinite(timestamp) || timestamp < now() - 600_000 || timestamp > now() + 60_000) return;
    if (metadata.message_type === 'session_welcome') {
      const welcome = welcomeSchema.safeParse(payload);
      if (!welcome.success || context.welcome) return;
      context.welcome = true; context.id = welcome.data.session.id; context.keepalive = welcome.data.session.keepalive_timeout_seconds * 1000;
      resetWatchdog(context, epoch);
      if (context.parent) {
        if (!subscriptionId || context.parent.retired || active !== context.parent) { connectionLost(context, epoch, 'migration_failed'); return; }
        const oldId = context.parent.id;
        acceptedSessionIds = new Set([context.id, ...(oldId ? [oldId] : [])]);
        retire(context.parent, true); active = context; migrating = undefined; reconnects = 0;
        publish({ state: 'ready', reason: undefined });
        return;
      }
      if (!identity) throw new TwitchError('authorization_required');
      acceptedSessionIds = new Set([context.id]);
      const subscribed = await authorizedRequest(SUBSCRIPTIONS, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: identity.user_id, user_id: identity.user_id },
          transport: { method: 'websocket', session_id: context.id },
        }),
      }, epoch);
      if (context.retired) return;
      const response = z.object({ data: z.array(subscriptionSchema).min(1).max(1) }).safeParse(subscribed.body);
      if (subscribed.status !== 202 || !response.success) throw new TwitchError('subscription_failed');
      const subscription = response.data.data[0];
      if (subscription.status !== 'enabled' || subscription.condition.broadcaster_user_id !== identity.user_id || subscription.condition.user_id !== identity.user_id || subscription.transport.session_id !== context.id) throw new TwitchError('subscription_failed');
      subscriptionId = subscription.id; reconnects = 0;
      publish({ state: 'ready', reason: undefined, channel: identity.login });
      return;
    }
    if (!context.welcome) return;
    if (metadata.message_type === 'session_keepalive') { resetWatchdog(context, epoch); return; }
    if (metadata.message_type === 'notification') {
      if (metadata.subscription_type !== 'channel.chat.message' || metadata.subscription_version !== '1') return;
      const notification = notificationSchema.safeParse(payload);
      if (!notification.success || notification.data.subscription.status !== 'enabled' || !validSubscription(notification.data.subscription)) return;
      const event = notification.data.event;
      if (event.broadcaster_user_id !== identity?.user_id || context !== active) return;
      resetWatchdog(context, epoch);
      if (duplicate(metadata.message_id, event.message_id)) return;
      const receivedAt = now();
      callbacks.onChat({ source: 'twitch', eventId: metadata.message_id, messageId: event.message_id, userId: event.chatter_user_id, displayName: event.chatter_user_name, text: event.message.text, receivedAt, sentAt: timestamp });
      publish({ lastEventAt: receivedAt, received: current.received + 1 });
      return;
    }
    if (metadata.message_type === 'session_reconnect') {
      const reconnect = reconnectSchema.safeParse(payload);
      if (!reconnect.success || reconnect.data.session.id !== context.id || context !== active || migrating) return;
      if (!reconnectUrl(reconnect.data.session.reconnect_url)) { fail('invalid_reconnect_url'); return; }
      publish({ state: 'reconnecting', reason: 'migration' });
      openSocket(reconnect.data.session.reconnect_url, epoch, context);
      return;
    }
    if (metadata.message_type === 'revocation') {
      const revocation = z.object({ subscription: subscriptionSchema }).safeParse(payload);
      if (revocation.success && validSubscription(revocation.data.subscription)) fail('authorization_revoked');
    }
  }
  function openSocket(url: string, epoch: number, parent?: SocketContext) {
    if (stopped || epoch !== generation) return;
    let socket: TwitchSocket;
    try { socket = socketFactory(url); }
    catch { fail('connection_failed'); return; }
    const context: SocketContext = { socket, parent, retired: false, welcome: false, keepalive: 10_000 };
    contexts.add(context);
    if (parent) migrating = context; else active = context;
    context.watchdog = later(() => connectionLost(context, epoch, 'welcome_timeout'), 10_000);
    socket.onMessage(text => {
      void onMessage(context, text, epoch).catch(error => {
        if (!context.retired && epoch === generation && !stopped) fail(error instanceof TwitchError ? error.safeReason : 'event_processing_failed');
      });
    });
    socket.onClose(() => connectionLost(context, epoch, 'connection_lost'));
    socket.onError(() => connectionLost(context, epoch, 'connection_lost'));
  }

  function authorizationUrl(state: string): string {
    const cfg = requireConfig();
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(state)) throw new TwitchError('invalid_oauth_state');
    const redirect = new URL(cfg.redirectUri);
    if (redirect.username || redirect.password || redirect.hash || !(redirect.protocol === 'https:' || (redirect.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname)))) throw new TwitchError('invalid_redirect_uri');
    const url = new URL(AUTH);
    url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: 'code', scope: SCOPE, state }).toString();
    return url.toString();
  }
  async function exchangeCode(code: string): Promise<void> {
    const cfg = requireConfig();
    if (!code || code.length > 4096) throw new TwitchError('invalid_authorization_code');
    if (!stopped) notifyGap('reauthorizing');
    clearResources(); stopped = false;
    const epoch = generation;
    publish({ state: 'authorizing', reason: undefined, channel: undefined, received: 0, lastEventAt: undefined });
    try {
      const result = await request(TOKEN, form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: 'authorization_code', redirect_uri: cfg.redirectUri }), epoch);
      const parsed = tokenSchema.safeParse(result.body);
      if (result.status !== 200 || !parsed.success || !parsed.data.scope.includes(SCOPE)) throw new TwitchError('authorization_failed');
      const validated = await validateToken(parsed.data.access_token, epoch);
      if (!validated.identity) throw new TwitchError('authorization_failed');
      ensure(epoch); tokens = parsed.data; identity = validated.identity;
      publish({ state: 'connecting', channel: identity.login });
      openSocket(SOCKET, epoch); scheduleValidation(epoch);
    } catch (error) {
      if (epoch !== generation || stopped) throw new TwitchError('cancelled');
      const safeReason = error instanceof TwitchError ? error.safeReason : 'authorization_failed';
      fail(safeReason); throw new TwitchError(safeReason);
    }
  }
  function disconnect() {
    if (!stopped) notifyGap('disconnected');
    clearResources();
    publish({ state: config ? 'disconnected' : 'disabled', channel: undefined, reason: undefined });
  }
  return { authorizationUrl, exchangeCode, disconnect, status };
}
