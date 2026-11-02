import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTwitch, type TwitchChatEvent, type TwitchConfig, type TwitchSocket, type TwitchStatus } from '../src/server/twitch.js';
import { Room } from '../src/server/room.js';
import { verifyReplay } from '../src/server/replay.js';

const config: TwitchConfig = { clientId: 'client', clientSecret: 'fixture-client-secret', redirectUri: 'http://localhost:3000/auth/twitch/callback' };
const tokens = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, scope: ['user:read:chat'] };
const identity = { client_id: 'client', user_id: '100', login: 'broadcaster', scopes: ['user:read:chat'], expires_in: 3600 };
const json = (body: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const subscription = (session = 'session-1', id = `sub-${session}`) => ({ id, type: 'channel.chat.message', version: '1', status: 'enabled', condition: { broadcaster_user_id: '100', user_id: '100' }, transport: { method: 'websocket', session_id: session } });
const envelope = <T>(type: string, payload: T, id = `frame-${type}`) => ({ metadata: { message_id: id, message_type: type, message_timestamp: new Date().toISOString(), subscription_type: 'channel.chat.message', subscription_version: '1' }, payload });
const welcome = (session = 'session-1') => envelope('session_welcome', { session: { id: session, status: 'connected', keepalive_timeout_seconds: 10, reconnect_url: null } });
const notification = (eventId = 'event-1', messageId = 'chat-1', session = 'session-1') => envelope('notification', { subscription: subscription(session), event: { broadcaster_user_id: '100', chatter_user_id: '100', chatter_user_name: 'Broadcaster', message_id: messageId, message: { text: '!patch gravity left' } } }, eventId);

class FixtureSocket implements TwitchSocket {
  messages: ((text: string) => void)[] = [];
  closes: (() => void)[] = [];
  errors: (() => void)[] = [];
  closed = false;
  terminated = false;
  constructor(readonly url: string) {}
  onMessage(callback: (text: string) => void) { this.messages.push(callback); }
  onClose(callback: () => void) { this.closes.push(callback); }
  onError(callback: () => void) { this.errors.push(callback); }
  close() { this.closed = true; this.closes.forEach(callback => callback()); }
  terminate() { this.terminated = true; this.close(); }
  emit(value: unknown) { this.messages.forEach(callback => callback(typeof value === 'string' ? value : JSON.stringify(value))); }
  error() { this.errors.forEach(callback => callback()); }
}
type Reply = Response | (() => Promise<Response>);
const cleanups: (() => void)[] = [];
function fixture(onChat?: (event: TwitchChatEvent) => void) {
  const sockets: FixtureSocket[] = [];
  const events: TwitchChatEvent[] = [];
  const statuses: TwitchStatus[] = [];
  const gaps: string[] = [];
  const replies = { token: [] as Reply[], validate: [] as Reply[], subscriptions: [] as Reply[] };
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    const route = url.endsWith('/token') ? 'token' : url.endsWith('/validate') ? 'validate' : 'subscriptions';
    const next = replies[route].shift();
    if (next) return typeof next === 'function' ? next() : next;
    if (route === 'token') return json(tokens);
    if (route === 'validate') return json(identity);
    const body = JSON.parse(String(init?.body)) as { transport: { session_id: string } };
    return json({ data: [subscription(body.transport.session_id)] }, 202);
  };
  const client = createTwitch(config, { onChat: event => { events.push(event); onChat?.(event); }, onStatus: status => statuses.push(status), onGap: reason => gaps.push(reason) }, {
    fetch: fetcher, websocket: url => { const socket = new FixtureSocket(url); sockets.push(socket); return socket; }, random: () => 0,
  });
  cleanups.push(() => client.disconnect());
  async function connect() { await client.exchangeCode('fixture-code'); sockets[0].emit(welcome()); await flush(); }
  return { client, sockets, events, statuses, gaps, replies, requests, connect };
}
async function flush() { await vi.advanceTimersByTimeAsync(0); }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T06:00:00Z')); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); });

describe('Twitch adapter — provider fixtures, not live Twitch evidence', () => {
  it('is disabled without configuration and does not publish during construction', () => {
    const onStatus = vi.fn();
    const client = createTwitch(undefined, { onChat: vi.fn(), onGap: vi.fn(), onStatus });
    expect(client.status()).toEqual({ state: 'disabled', received: 0 });
    expect(onStatus).not.toHaveBeenCalled();
    expect(() => client.authorizationUrl('x'.repeat(32))).toThrow('not_configured');
  });

  it('uses code OAuth, one read-only scope, strict state and a safe registered callback', () => {
    const { client } = fixture();
    const url = new URL(client.authorizationUrl('a'.repeat(32)));
    expect(url.origin).toBe('https://id.twitch.tv');
    expect(url.searchParams.get('scope')).toBe('user:read:chat');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.search).not.toContain(config.clientSecret);
    expect(() => client.authorizationUrl('short')).toThrow('invalid_oauth_state');
    const unsafe = createTwitch({ ...config, redirectUri: 'http://remote.example/callback' }, { onChat: vi.fn(), onGap: vi.fn(), onStatus: vi.fn() });
    expect(() => unsafe.authorizationUrl('x'.repeat(32))).toThrow('invalid_redirect_uri');
  });

  it('validates identity and creates same-account subscription before reporting ready', async () => {
    const f = fixture();
    await f.client.exchangeCode('fixture-code');
    expect(f.client.status().state).toBe('connecting');
    expect(f.sockets[0].url).toBe('wss://eventsub.wss.twitch.tv/ws');
    f.sockets[0].emit(welcome()); await flush();
    expect(f.client.status()).toMatchObject({ state: 'ready', channel: 'broadcaster' });
    const request = f.requests.find(row => row.url.includes('helix'));
    expect(JSON.parse(String(request?.init?.body))).toEqual({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: '100', user_id: '100' }, transport: { method: 'websocket', session_id: 'session-1' } });
    expect(JSON.stringify(f.statuses)).not.toMatch(/fixture-access|fixture-refresh|fixture-client-secret|fixture-code/);
  });

  it.each([
    { ...identity, client_id: 'attacker' },
    { ...identity, scopes: [] },
    { ...identity, user_id: null },
    { ...identity, expires_in: 0 },
  ])('rejects a token with invalid identity/scopes/expiry', async badIdentity => {
    const f = fixture(); f.replies.validate.push(json(badIdentity));
    await expect(f.client.exchangeCode('fixture-code')).rejects.toThrow('token_identity_invalid');
    expect(f.sockets).toHaveLength(0);
    expect(f.client.status().state).toBe('error');
  });

  it('accepts own-channel chat and independently deduplicates envelope and chat IDs', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].emit(notification());
    f.sockets[0].emit(notification('event-1', 'chat-2'));
    f.sockets[0].emit(notification('event-2', 'chat-1'));
    await flush();
    expect(f.events).toEqual([{ source: 'twitch', eventId: 'event-1', messageId: 'chat-1', userId: '100', displayName: 'Broadcaster', text: '!patch gravity left', receivedAt: Date.now(), sentAt: Date.now() }]);
    expect(f.client.status().received).toBe(1);
  });

  it('preserves provider send time separately from arrival for round-window validation', async () => {
    const f = fixture(); await f.connect();
    const delayed = notification(); delayed.metadata.message_timestamp = new Date(Date.now() - 25_000).toISOString();
    f.sockets[0].emit(delayed); await flush();
    expect(f.events[0].sentAt).toBe(Date.now() - 25_000);
    expect(f.events[0].receivedAt).toBe(Date.now());
  });

  it('carries opaque provider IDs through the real room rejection, ballot, merge and replay boundaries', async () => {
    const room = new Room({ origin: 'twitch', now: () => Date.now(), solverNow: () => 0 });
    cleanups.push(() => room.close());
    const outcomes: string[] = [];
    const f = fixture(event => outcomes.push(room.ingest({ origin: 'twitch', actorId: 'same-account', eventId: event.eventId, messageId: event.messageId, text: event.text, receivedAt: event.receivedAt, sentAt: event.sentAt }).code));
    await f.connect(); room.act({ type: 'startRound' });
    const send = async (index: number, text: string) => {
      const message = notification(`opaque/notification+${index}=${'x'.repeat(180)}`, `opaque/chat+${index}=${'y'.repeat(140)}`);
      message.payload.event.message.text = text;
      f.sockets[0].emit(message); await flush();
      return message;
    };
    await send(1, '!patch gravity down');
    expect(outcomes).toEqual(['NO_ESCAPE']);
    expect(room.snapshot().game.rules.gravity).toBe('off');
    await vi.advanceTimersByTimeAsync(2200);
    await send(2, '!patch walls A closed');
    expect(outcomes.at(-1)).toBe('PROPOSAL_ACCEPTED');
    expect(room.snapshot().candidates).toMatchObject([{ id: 1, label: 'Close wall group A' }]);
    room.act({ type: 'closeWindow' }); await vi.advanceTimersByTimeAsync(2200);
    const vote = await send(3, '!vote 1');
    expect(outcomes.at(-1)).toBe('VOTE_ACCEPTED');
    f.sockets[0].emit(vote); await flush();
    expect(room.snapshot().candidates[0].votes).toBe(1);
    expect(outcomes).toHaveLength(3);
    room.act({ type: 'closeWindow' });
    expect(room.snapshot().receipt).toMatchObject({ origin: 'twitch', pathLength: 24, patch: { kind: 'walls', group: 'A', closed: true } });
    expect(room.snapshot().game.rules.walls.A).toBe(true);
    room.act({ type: 'reveal' });
    expect(() => verifyReplay(room.exportReplay())).not.toThrow();
  });

  it('rejects malformed, oversized, wrong-channel, wrong-subscription and stale frames', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].emit('not json'); f.sockets[0].emit(' '.repeat(70_000));
    f.sockets[0].emit({ metadata: {} });
    const wrongChannel = notification('bad-channel'); wrongChannel.payload.event.broadcaster_user_id = '200';
    f.sockets[0].emit(wrongChannel);
    const wrongUser = notification('bad-reader'); wrongUser.payload.subscription.condition.user_id = '200'; f.sockets[0].emit(wrongUser);
    const wrongSubscription = notification('bad-sub'); wrongSubscription.payload.subscription.id = 'forged'; f.sockets[0].emit(wrongSubscription);
    const wrongSession = notification('bad-session'); wrongSession.payload.subscription.transport.session_id = 'unrelated'; f.sockets[0].emit(wrongSession);
    const stale = notification('stale'); stale.metadata.message_timestamp = '2000-01-01T00:00:00Z'; f.sockets[0].emit(stale);
    const future = notification('future'); future.metadata.message_timestamp = new Date(Date.now() + 120_000).toISOString(); f.sockets[0].emit(future);
    await flush(); expect(f.events).toHaveLength(0); expect(f.client.status().state).toBe('ready');
  });

  it('refreshes once after 401 and validates the replacement before retrying subscription', async () => {
    const f = fixture();
    f.replies.subscriptions.push(json({ message: 'invalid token' }, 401));
    f.replies.token.push(json(tokens), json({ ...tokens, access_token: 'fixture-replacement', refresh_token: 'fixture-next-refresh' }));
    await f.connect();
    expect(f.client.status().state).toBe('ready');
    const tokenRequests = f.requests.filter(row => row.url.endsWith('/token'));
    expect(tokenRequests).toHaveLength(2);
    expect(String(tokenRequests[1].init?.body)).toContain('grant_type=refresh_token');
    expect(f.requests.filter(row => row.url.endsWith('/validate'))).toHaveLength(2);
    const subs = f.requests.filter(row => row.url.includes('helix'));
    expect(subs).toHaveLength(2);
    expect(new Headers(subs[1].init?.headers).get('authorization')).toBe('Bearer fixture-replacement');
  });

  it('fails closed if refresh changes the user identity', async () => {
    const f = fixture();
    f.replies.subscriptions.push(json({}, 401));
    f.replies.validate.push(json(identity), json({ ...identity, user_id: '999' }));
    await f.connect();
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'token_identity_invalid' });
    expect(f.sockets[0].terminated).toBe(true);
  });

  it('does not loop on rejected refresh or persist provider error bodies', async () => {
    const f = fixture();
    f.replies.subscriptions.push(json({}, 401));
    f.replies.token.push(json(tokens), json({ message: 'SECRET-BODY' }, 400));
    await f.connect();
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'authorization_required' });
    expect(f.requests.filter(row => row.url.endsWith('/token'))).toHaveLength(2);
    expect(JSON.stringify(f.statuses)).not.toContain('SECRET-BODY');
  });

  it('retries a transient 429 once with a bounded delay', async () => {
    const f = fixture();
    f.replies.subscriptions.push(json({}, 429, { 'retry-after': '1' }));
    await f.client.exchangeCode('fixture-code'); f.sockets[0].emit(welcome()); await flush();
    expect(f.client.status().state).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.client.status().state).toBe('ready');
    expect(f.requests.filter(row => row.url.includes('helix'))).toHaveLength(2);
  });

  it('does not violate a provider backoff that exceeds the welcome budget', async () => {
    const f = fixture(); f.replies.subscriptions.push(json({}, 429, { 'retry-after': '30' }));
    await f.client.exchangeCode('fixture-code'); f.sockets[0].emit(welcome()); await flush();
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'rate_limited' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.requests.filter(row => row.url.includes('helix'))).toHaveLength(1);
  });

  it('stops after the second server error', async () => {
    const f = fixture(); f.replies.subscriptions.push(json({}, 503), json({}, 503));
    await f.client.exchangeCode('fixture-code'); f.sockets[0].emit(welcome()); await flush();
    await vi.advanceTimersByTimeAsync(200);
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'subscription_failed' });
    expect(f.requests.filter(row => row.url.includes('helix'))).toHaveLength(2);
  });

  it('times out unresponsive HTTP without exposing upstream failures', async () => {
    const f = fixture(); f.replies.token.push(() => new Promise<Response>(() => undefined));
    const result = f.client.exchangeCode('fixture-code').catch(error => error as Error);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toMatchObject({ message: 'request_timeout' });
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'request_timeout' });
    expect(f.sockets).toHaveLength(0);
  });

  it('requested migration retains old socket until welcome, keeps subscriptions and deduplicates overlap', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].emit(notification()); await flush();
    const url = 'wss://eventsub.wss.twitch.tv/ws?reconnect=opaque';
    f.sockets[0].emit(envelope('session_reconnect', { session: { id: 'session-1', status: 'reconnecting', reconnect_url: url } })); await flush();
    expect(f.sockets[0].closed).toBe(false); expect(f.sockets[1].url).toBe(url);
    f.sockets[1].emit(welcome('session-2')); await flush();
    expect(f.sockets[0].closed).toBe(true); expect(f.gaps).toHaveLength(0);
    expect(f.requests.filter(row => row.url.includes('helix'))).toHaveLength(1);
    const overlap = notification(); overlap.payload.subscription.transport.session_id = 'session-2';
    f.sockets[1].emit(overlap);
    const fresh = notification('event-new', 'chat-new'); fresh.payload.subscription.transport.session_id = 'session-2';
    f.sockets[1].emit(fresh); await flush();
    expect(f.events).toHaveLength(2); expect(f.client.status().state).toBe('ready');
    f.sockets[0].emit(notification('retired', 'retired')); await flush(); expect(f.events).toHaveLength(2);
  });

  it.each(['wss://attacker.example/ws', 'ws://eventsub.wss.twitch.tv/ws', 'wss://eventsub.wss.twitch.tv.attacker.example/ws', 'wss://name:password@eventsub.wss.twitch.tv/ws', 'wss://eventsub.wss.twitch.tv:444/ws'])('rejects unsafe reconnect URL %s', async url => {
    const f = fixture(); await f.connect();
    f.sockets[0].emit(envelope('session_reconnect', { session: { id: 'session-1', status: 'reconnecting', reconnect_url: url } })); await flush();
    expect(f.sockets).toHaveLength(1); expect(f.client.status()).toMatchObject({ state: 'error', reason: 'invalid_reconnect_url' });
  });

  it('unexpected loss reports a gap, reconnects and resubscribes', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].close(); await flush();
    expect(f.gaps).toEqual(['connection_lost']);
    await vi.advanceTimersByTimeAsync(500);
    f.sockets[1].emit(welcome('session-2')); await flush();
    expect(f.requests.filter(row => row.url.includes('helix'))).toHaveLength(2);
    expect(f.client.status().state).toBe('ready');
  });

  it('keepalives reset the watchdog, silence marks a gap', async () => {
    const f = fixture(); await f.connect();
    await vi.advanceTimersByTimeAsync(9000);
    f.sockets[0].emit(envelope('session_keepalive', {})); await flush();
    await vi.advanceTimersByTimeAsync(9000); expect(f.gaps).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000); expect(f.gaps).toContain('keepalive_timeout');
  });

  it('stops retries after bounded fresh-connection failures', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].error(); await flush();
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(Math.min(500 * 2 ** i, 15_000));
      f.sockets.at(-1)?.error(); await flush();
    }
    expect(f.sockets).toHaveLength(7);
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'reconnect_exhausted' });
    await vi.advanceTimersByTimeAsync(60_000); expect(f.sockets).toHaveLength(7);
  });

  it('revocation cancels the connection and future retries', async () => {
    const f = fixture(); await f.connect();
    f.sockets[0].emit(envelope('revocation', { subscription: { ...subscription(), status: 'authorization_revoked' } })); await flush();
    expect(f.client.status()).toMatchObject({ state: 'error', reason: 'authorization_revoked' });
    await vi.advanceTimersByTimeAsync(60_000); expect(f.sockets).toHaveLength(1);
  });

  it('disconnect cancels pending HTTP and prevents late token response from opening sockets', async () => {
    const f = fixture();
    let resolve: (response: Response) => void = () => undefined;
    f.replies.token.push(() => new Promise<Response>(done => { resolve = done; }));
    const result = f.client.exchangeCode('fixture-code').catch(error => error as Error);
    f.client.disconnect(); resolve(json(tokens)); await flush();
    expect(await result).toMatchObject({ message: 'cancelled' });
    expect(f.sockets).toHaveLength(0); expect(f.client.status().state).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(60_000); expect(f.sockets).toHaveLength(0);
  });

  it('a failing host gap observer cannot prevent terminal transport cleanup', async () => {
    const sockets: FixtureSocket[] = [];
    const client = createTwitch(config, { onChat: vi.fn(), onStatus: vi.fn(), onGap: () => { throw new Error('disk unavailable'); } }, {
      fetch: async input => String(input).endsWith('/token') ? json(tokens) : String(input).endsWith('/validate') ? json(identity) : json({ data: [subscription()] }, 202),
      websocket: url => { const socket = new FixtureSocket(url); sockets.push(socket); return socket; },
    });
    cleanups.push(() => client.disconnect());
    await client.exchangeCode('fixture-code'); sockets[0].emit(welcome()); await flush();
    sockets[0].emit(envelope('revocation', { subscription: { ...subscription(), status: 'authorization_revoked' } })); await flush();
    expect(client.status()).toMatchObject({ state: 'error', reason: 'authorization_revoked' });
    expect(sockets[0].terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000); expect(sockets).toHaveLength(1);
  });

  it('disconnect cancels scheduled reconnect and ignores late provider frames', async () => {
    const f = fixture(); await f.connect(); f.sockets[0].close(); f.client.disconnect();
    await vi.advanceTimersByTimeAsync(60_000); f.sockets[0].emit(notification()); await flush();
    expect(f.sockets).toHaveLength(1); expect(f.events).toHaveLength(0); expect(f.client.status().state).toBe('disconnected');
  });

  it('validates hourly and refreshes a revoked/expired token once', async () => {
    const f = fixture(); await f.connect();
    f.replies.validate.push(json({}, 401), json(identity));
    // Keep the fixture transport alive while advancing one hour.
    for (let elapsed = 0; elapsed < 3_600_000; elapsed += 9000) {
      f.sockets.at(-1)?.emit(envelope('session_keepalive', {}, `keepalive-${elapsed}`));
      await vi.advanceTimersByTimeAsync(9000);
    }
    expect(f.requests.filter(row => row.url.endsWith('/validate'))).toHaveLength(3);
    expect(f.requests.filter(row => row.url.endsWith('/token'))).toHaveLength(2);
    expect(f.client.status().state).toBe('ready');
  });
});
