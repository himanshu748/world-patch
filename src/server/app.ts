import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { WebSocket } from 'ws';
import { Room, RoomError } from './room.js';
import { SQLiteStore } from './storage.js';
import { createTwitch, type TwitchConfig } from './twitch.js';
import { ENGINE_VERSION } from '../shared/engine.js';

export interface AppConfig {
  hostSecret: string;
  publicOrigin: string;
  dataDir: string;
  twitch?: TwitchConfig;
  serveStatic?: boolean;
  databasePath?: string;
  now?: () => number;
}

const ActionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('move'),direction:z.enum(['up','right','down','left'])}).strict(),
  ...(['startRound','closeWindow','pause','resume','cancel','reset','reveal'] as const).map(type=>z.object({type:z.literal(type)}).strict()),
  z.object({type:z.literal('removeCandidate'),candidateId:z.number().int().positive()}).strict(),
  z.object({type:z.literal('blockActor'),actorId:z.string().min(1).max(128)}).strict(),
  z.object({type:z.literal('selectChamber'),chamberId:z.string().min(1).max(80)}).strict(),
  z.object({type:z.literal('newSession'),origin:z.enum(['simulation','twitch']),chamberId:z.string().max(80).optional()}).strict(),
]);
const LoginSchema=z.object({secret:z.string().min(1).max(256)}).strict();
const SimSchema=z.object({actor:z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/),text:z.string().min(1).max(200)}).strict();
const CallbackSchema=z.object({code:z.string().min(1).max(2048).optional(),state:z.string().min(32).max(128),error:z.string().max(100).optional()});
const AUTH_TTL=12*60*60*1000;

export async function buildServer(config:AppConfig) {
  if(config.hostSecret.length<24 || config.hostSecret.includes('replace-with')) throw new Error('Set HOST_SECRET to at least 24 random characters.');
  const publicUrl=new URL(config.publicOrigin);
  if(publicUrl.origin!==config.publicOrigin || publicUrl.username || publicUrl.password) throw new Error('PUBLIC_ORIGIN must be an exact origin without path or credentials.');
  if(publicUrl.protocol!=='https:' && !(publicUrl.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(publicUrl.hostname))) throw new Error('Remote PUBLIC_ORIGIN requires HTTPS.');
  const now=config.now??Date.now;
  mkdirSync(config.dataDir,{recursive:true,mode:0o700});
  const app=Fastify({logger:false,bodyLimit:16384,requestTimeout:10000,connectionTimeout:10000,trustProxy:false});
  await app.register(cookie);
  await app.register(rateLimit,{max:600,timeWindow:'1 minute'});
  await app.register(websocket,{options:{maxPayload:1024}});
  const room=new Room({store:new SQLiteStore(config.databasePath??resolve(config.dataDir,'world-patch.sqlite')),origin:'simulation',now});
  const clients=new Set<WebSocket>();
  const sessions=new Map<string,number>();
  const oauthStates=new Map<string,{session:string;expires:number}>();
  const hostDigest=createHash('sha256').update(config.hostSecret).digest();
  const pseudonym=(source:string,id:string)=>createHmac('sha256',config.hostSecret).update(`${source}:${id}`).digest('hex').slice(0,24);
  const sessionFor=(cookies:Record<string,string|undefined>)=>{
    const id=cookies.wp_host;
    if(!id)return null;
    const expires=sessions.get(id);
    if(!expires || expires<=now()){sessions.delete(id);return null;}
    return id;
  };
  const publicSnapshot=()=>({...room.snapshot(),twitch:twitch.status(),serverTime:now()});
  const broadcast=()=>{
    const body=JSON.stringify(publicSnapshot());
    for(const peer of clients){if(peer.readyState===1 && peer.bufferedAmount<1024*1024)peer.send(body);else if(peer.bufferedAmount>=1024*1024)peer.close(1013,'Slow consumer');}
  };
  const storageUnavailable=()=>{for(const peer of clients)peer.close(1011,'Persistence unavailable');};
  const cancelForGap=(reason:string)=>{try{room.sourceUnavailable(reason);}catch{storageUnavailable();}};
  const twitch=createTwitch(config.twitch,{
    onChat(event){
      try { room.ingest({origin:'twitch',actorId:pseudonym('twitch',event.userId),eventId:event.eventId,messageId:event.messageId,text:event.text,receivedAt:event.receivedAt,sentAt:event.sentAt}); }
      catch { cancelForGap('Chat ingestion failed; open a new round after recovery.'); storageUnavailable(); }
      broadcast();
    },
    onStatus(){broadcast();},
    onGap(reason){cancelForGap(reason);broadcast();},
  });
  const unsubscribe=room.subscribe(broadcast);
  const tick=setInterval(()=>{try{room.tick(now());}catch{for(const peer of clients)peer.close(1011,'Persistence unavailable');}},200);
  tick.unref();
  const sweep=setInterval(()=>{for(const [key,expiry]of sessions)if(expiry<=now())sessions.delete(key);for(const[key,value]of oauthStates)if(value.expires<=now())oauthStates.delete(key);},60000);
  sweep.unref();

  app.addHook('onRequest',async(request,reply)=>{
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Referrer-Policy','no-referrer');
    reply.header('X-Frame-Options','SAMEORIGIN');
    reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    if(publicUrl.protocol==='https:')reply.header('Strict-Transport-Security','max-age=31536000');
    if(request.url.startsWith('/api')||request.url.startsWith('/auth'))reply.header('Cache-Control','no-store');
    if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&request.headers.origin!==config.publicOrigin){return reply.code(403).send({error:'origin_rejected',message:'Use the configured WORLD//PATCH origin.'});}
    if(request.url.startsWith('/api/') && request.method==='POST' && request.url!=='/api/login' && !sessionFor(request.cookies)){return reply.code(401).send({error:'host_required',message:'Sign in with the host secret to control the room.'});}
  });
  app.setErrorHandler((error,request,reply)=>{
    if(error instanceof RoomError)return reply.code(error.statusCode).send({error:error.code,message:error.message});
    const err=error as Error & {statusCode?:number};
    if(err.statusCode && err.statusCode<500)return reply.code(err.statusCode).send({error:'invalid_request',message:err.statusCode===429?'Too many requests. Wait before retrying.':'Request rejected.'});
    return reply.code(503).send({error:'service_unavailable',message:'The operation could not be saved. Retry after checking the server.'});
  });
  app.get('/api/health',async()=>({ok:true,engineVersion:ENGINE_VERSION}));
  app.get('/api/state',async()=>publicSnapshot());
  app.get('/api/config',async request=>({authenticated:!!sessionFor(request.cookies),twitchConfigured:!!config.twitch,missingTwitchVariables:config.twitch?[]:['TWITCH_CLIENT_ID','TWITCH_CLIENT_SECRET'],origin:config.publicOrigin}));
  app.post('/api/login',{config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(request,reply)=>{
    const parsed=LoginSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid_request',message:'Enter a host secret.'});
    const digest=createHash('sha256').update(parsed.data.secret).digest();
    if(!timingSafeEqual(digest,hostDigest))return reply.code(401).send({error:'invalid_secret',message:'Host secret did not match.'});
    if(sessions.size>=8)sessions.delete(sessions.keys().next().value!);
    const session=randomBytes(32).toString('hex');sessions.set(session,now()+AUTH_TTL);
    return reply.setCookie('wp_host',session,{httpOnly:true,sameSite:'lax',secure:publicUrl.protocol==='https:',path:'/',maxAge:AUTH_TTL/1000}).send({ok:true});
  });
  app.post('/api/logout',async(request,reply)=>{const session=sessionFor(request.cookies);if(session)sessions.delete(session);return reply.clearCookie('wp_host',{path:'/'}).send({ok:true});});
  app.post('/api/action',{config:{rateLimit:{max:240,timeWindow:'1 minute'}}},async(request,reply)=>{
    const parsed=ActionSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid_action',message:'Unknown or malformed host action.'});
    const action=parsed.data;
    if(((action.type==='newSession'&&action.origin==='twitch') || (action.type==='startRound'&&room.snapshot().origin==='twitch')) && twitch.status().state!=='ready')return reply.code(409).send({error:'twitch_not_ready',message:'Connect Twitch before opening a live round.'});
    const result=room.act(action);return {...result,state:publicSnapshot()};
  });
  app.post('/api/simulate',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(request,reply)=>{
    const parsed=SimSchema.safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'invalid_command',message:'Use an actor name and a command of at most 200 characters.'});
    const id=randomUUID();
    const result=room.ingest({origin:'simulation',actorId:`sim:${parsed.data.actor}`,eventId:`sim:${id}`,messageId:`sim:${id}`,text:parsed.data.text,receivedAt:now()});
    return {...result,state:publicSnapshot()};
  });
  app.get('/api/host',async(request,reply)=>{if(!sessionFor(request.cookies))return reply.code(401).send({error:'host_required'});return room.moderationState();});
  app.get('/api/replay',async(request,reply)=>{
    if(!sessionFor(request.cookies))return reply.code(401).send({error:'host_required'});
    const query=z.object({sessionId:z.string().uuid().optional()}).strict().safeParse(request.query);
    if(!query.success)return reply.code(400).send({error:'invalid_session',message:'Use a valid saved session ID.'});
    reply.header('Content-Disposition','attachment; filename="world-patch-replay.json"');
    return room.exportReplay(query.data.sessionId);
  });
  app.post('/api/twitch/connect',async(request,reply)=>{
    if(!config.twitch)return reply.code(409).send({error:'twitch_not_configured',message:'Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET, then restart.'});
    const state=randomBytes(32).toString('hex');
    const session=sessionFor(request.cookies)!;
    for(const[key,value]of oauthStates)if(value.session===session)oauthStates.delete(key);
    oauthStates.set(state,{session,expires:now()+600000});
    return reply.setCookie('wp_oauth',state,{httpOnly:true,sameSite:'lax',secure:publicUrl.protocol==='https:',path:'/auth/twitch',maxAge:600}).send({url:twitch.authorizationUrl(state)});
  });
  app.get('/auth/twitch/callback',async(request,reply)=>{
    const parsed=CallbackSchema.safeParse(request.query);
    const state=parsed.success?parsed.data.state:'';
    const pending=oauthStates.get(state);
    // Consume a matching state once, including failed provider responses.
    if(state)oauthStates.delete(state);
    reply.clearCookie('wp_oauth',{path:'/auth/twitch'});
    if(!parsed.success || !pending || pending.expires<=now() || request.cookies.wp_oauth!==state || sessionFor(request.cookies)!==pending.session)return reply.code(400).send({error:'oauth_state_rejected',message:'Sign in again from the controller; this callback is expired or invalid.'});
    if(parsed.data.error||!parsed.data.code)return reply.redirect('/?oauth=denied');
    try{await twitch.exchangeCode(parsed.data.code);return reply.redirect('/?oauth=connected');}catch{return reply.redirect('/?oauth=failed');}
  });
  app.post('/api/twitch/disconnect',async()=>{twitch.disconnect();room.sourceUnavailable('Twitch disconnected by host.');return {ok:true,state:publicSnapshot()};});
  app.get('/ws',{websocket:true,preValidation:async(request,reply)=>{
    if(request.headers.origin!==config.publicOrigin)return reply.code(403).send({error:'origin_rejected'});
    if(clients.size>=32)return reply.code(503).send({error:'connection_limit'});
  }},socket=>{
    clients.add(socket);socket.send(JSON.stringify(publicSnapshot()));
    socket.on('message',()=>socket.close(1008,'Read-only stream'));
    socket.on('error',()=>clients.delete(socket));socket.on('close',()=>clients.delete(socket));
  });
  if(config.serveStatic!==false){
    const root=resolve('dist/public');
    if(existsSync(resolve(root,'index.html'))){
      await app.register(staticFiles,{root,index:false});
      app.get('/',async(_request,reply)=>reply.header('Cache-Control','no-cache').sendFile('index.html'));
      app.get('/play',async(_request,reply)=>reply.header('Cache-Control','no-cache').sendFile('index.html'));
      app.get('/overlay',async(_request,reply)=>reply.header('Cache-Control','no-cache').sendFile('index.html'));
    }
  }
  app.addHook('onClose',async()=>{clearInterval(tick);clearInterval(sweep);unsubscribe();twitch.disconnect();for(const client of clients)client.close(1001,'Server stopping');room.close();sessions.clear();oauthStates.clear();});
  return {app,room,twitch};
}
