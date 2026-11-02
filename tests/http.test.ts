import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { buildServer } from '../src/server/app.js';

const secret='world-patch-test-host-secret-32-chars';
const origin='http://localhost:3000';
const active:Awaited<ReturnType<typeof buildServer>>[]=[];
const dirs:string[]=[];
async function setup(twitch=false,now?:()=>number){
  const dir=mkdtempSync(join(tmpdir(),'world-patch-http-'));dirs.push(dir);
  const server=await buildServer({hostSecret:secret,publicOrigin:origin,dataDir:dir,serveStatic:false,now,twitch:twitch?{clientId:'fixture-client',clientSecret:'fixture-secret-not-real',redirectUri:origin+'/auth/twitch/callback'}:undefined});
  active.push(server);return server;
}
async function login(server:Awaited<ReturnType<typeof setup>>){
  const result=await server.app.inject({method:'POST',url:'/api/login',headers:{origin},payload:{secret}});
  expect(result.statusCode).toBe(200);
  return result.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
}
afterEach(async()=>{for(const s of active.splice(0))await s.app.close();for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});

describe('HTTP control plane and source separation',()=>{
  it('returns public state with no witness or credentials and protects every mutation',async()=>{
    const s=await setup();
    const publicResult=await s.app.inject('/api/state');
    expect(publicResult.statusCode).toBe(200);
    const state=publicResult.json();expect(state.origin).toBe('simulation');expect(state.receipt.witness).toBeUndefined();
    expect(publicResult.body).not.toContain(secret);
    for(const url of ['/api/action','/api/simulate','/api/twitch/connect','/api/twitch/disconnect','/api/logout']){
      const r=await s.app.inject({method:'POST',url,headers:{origin},payload:{}});expect(r.statusCode).toBe(401);
    }
    expect((await s.app.inject('/api/host')).statusCode).toBe(401);
    expect((await s.app.inject('/api/replay')).statusCode).toBe(401);
  });
  it('requires origin and sets HttpOnly cookie; sign-out removes control authority',async()=>{
    const s=await setup();
    expect((await s.app.inject({method:'POST',url:'/api/login',payload:{secret}})).statusCode).toBe(403);
    const r=await s.app.inject({method:'POST',url:'/api/login',headers:{origin},payload:{secret}});
    expect(r.headers['set-cookie']).toContain('HttpOnly');expect(r.headers['set-cookie']).toContain('SameSite=Lax');
    const cookie=r.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
    expect((await s.app.inject({method:'POST',url:'/api/action',headers:{origin:'https://attacker.example',cookie},payload:{type:'startRound'}})).statusCode).toBe(403);
    await s.app.inject({method:'POST',url:'/api/logout',headers:{origin,cookie}});
    expect((await s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:{type:'startRound'}})).statusCode).toBe(401);
  });
  it('validates actions and refuses live mode without an enabled subscription',async()=>{
    const s=await setup();const cookie=await login(s);
    const post=(payload:unknown)=>s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:JSON.stringify(payload)});
    const malformed=await s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:{type:'move',direction:'up',admin:true}});expect(malformed.statusCode).toBe(400);
    const live=await s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:{type:'newSession',origin:'twitch'}});expect(live.statusCode).toBe(409);
    expect((await s.app.inject({method:'POST',url:'/api/twitch/connect',headers:{origin,cookie},payload:{}})).statusCode).toBe(409);
    expect((await post({type:'unknown'})).statusCode).toBeGreaterThanOrEqual(400);
  });
  it('executes a simulated election, guards frozen movement and exports only after reveal',async()=>{
    const s=await setup();const cookie=await login(s);
    const action=(payload:unknown)=>s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie,'content-type':'application/json'},payload:JSON.stringify(payload)});
    expect((await action({type:'startRound'})).statusCode).toBe(200);
    expect((await action({type:'move',direction:'right'})).statusCode).toBe(409);
    const propose=await s.app.inject({method:'POST',url:'/api/simulate',headers:{origin,cookie},payload:{actor:'alice',text:'!patch walls A closed'}});
    expect(propose.json().ok).toBe(true);
    await action({type:'closeWindow'});
    const vote=await s.app.inject({method:'POST',url:'/api/simulate',headers:{origin,cookie},payload:{actor:'bob',text:'!vote 1'}});expect(vote.json().ok).toBe(true);
    const merged=await action({type:'closeWindow'});expect(merged.json().state.game.rules.walls.A).toBe(true);
    expect(merged.json().state.receipt.witness).toBeUndefined();
    expect((await s.app.inject({url:'/api/replay',headers:{cookie}})).statusCode).toBe(409);
    await action({type:'reveal'});
    const replay=await s.app.inject({url:'/api/replay',headers:{cookie}});expect(replay.statusCode).toBe(200);expect(replay.json().origin).toBe('simulation');
  });
  it('binds OAuth state to browser and consumes denied or invalid callbacks once',async()=>{
    const s=await setup(true);const cookie=await login(s);
    const start=await s.app.inject({method:'POST',url:'/api/twitch/connect',headers:{origin,cookie},payload:{}});expect(start.statusCode).toBe(200);
    const url=new URL(start.json().url);expect(url.searchParams.get('scope')).toBe('user:read:chat');
    expect(start.body).not.toContain('fixture-secret-not-real');
    const state=url.searchParams.get('state')!;
    const oauthCookie=start.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
    const denied=await s.app.inject({url:`/auth/twitch/callback?state=${state}&error=access_denied`,headers:{cookie:`${cookie}; ${oauthCookie}`}});
    expect(denied.statusCode).toBe(302);expect(denied.headers.location).toBe('/?oauth=denied');
    expect((await s.app.inject({url:`/auth/twitch/callback?state=${state}&code=fake`,headers:{cookie:`${cookie}; ${oauthCookie}`}})).statusCode).toBe(400);
    expect((await s.app.inject('/auth/twitch/callback?code=fake')).statusCode).toBe(400);
  });
  it('exports a revealed archived chamber through the authenticated HTTP API',async()=>{
    const s=await setup();const cookie=await login(s);const sessionId=s.room.snapshot().sessionId;
    await s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:{type:'reveal'}});
    await s.app.inject({method:'POST',url:'/api/action',headers:{origin,cookie},payload:{type:'selectChamber',chamberId:'crosswire'}});
    expect((await s.app.inject({url:'/api/replay',headers:{cookie}})).statusCode).toBe(409);
    const prior=await s.app.inject({url:`/api/replay?sessionId=${sessionId}`,headers:{cookie}});
    expect(prior.statusCode).toBe(200);expect(prior.json().sessionId).toBe(sessionId);
    expect((await s.app.inject({url:'/api/replay?sessionId=not-valid',headers:{cookie}})).statusCode).toBe(400);
  });
  it('rejects OAuth state without the matching browser cookie',async()=>{
    const s=await setup(true);const cookie=await login(s);
    const start=await s.app.inject({method:'POST',url:'/api/twitch/connect',headers:{origin,cookie},payload:{}});
    const state=new URL(start.json().url).searchParams.get('state');
    expect((await s.app.inject({url:`/auth/twitch/callback?state=${state}&code=fake`,headers:{cookie}})).statusCode).toBe(400);
  });
  it('expires OAuth state and host authority using the server clock',async()=>{
    let at=100000;const s=await setup(true,()=>at);const cookie=await login(s);
    const start=await s.app.inject({method:'POST',url:'/api/twitch/connect',headers:{origin,cookie},payload:{}});
    const state=new URL(start.json().url).searchParams.get('state');const oauthCookie=start.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
    at+=600001;
    expect((await s.app.inject({url:`/auth/twitch/callback?state=${state}&code=fake`,headers:{cookie:`${cookie}; ${oauthCookie}`}})).statusCode).toBe(400);
    at+=12*60*60*1000;
    expect((await s.app.inject({url:'/api/host',headers:{cookie}})).statusCode).toBe(401);
  });
  it('websocket rejects foreign origins and closes attempted commands',async()=>{
    const s=await setup();await s.app.listen({host:'127.0.0.1',port:0});
    const address=s.app.server.address();if(!address||typeof address==='string')throw Error('No address');
    const target=`ws://127.0.0.1:${address.port}/ws`;
    const rejected=await new Promise<number>(resolve=>{const ws=new WebSocket(target,{origin:'https://attacker.example'});ws.on('unexpected-response',(_req,res)=>{resolve(res.statusCode!);ws.terminate();});ws.on('error',()=>{});});expect(rejected).toBe(403);
    const closed=await new Promise<number>((resolve,reject)=>{const ws=new WebSocket(target,{origin});ws.once('message',data=>{expect(JSON.parse(data.toString()).origin).toBe('simulation');ws.send(JSON.stringify({type:'move',direction:'right'}));});ws.on('close',code=>resolve(code));ws.on('error',reject);});expect(closed).toBe(1008);
  });
  it('bounds simultaneous public sockets without affecting current clients',async()=>{
    const s=await setup();await s.app.listen({host:'127.0.0.1',port:0});
    const address=s.app.server.address();if(!address||typeof address==='string')throw Error('No address');
    const target=`ws://127.0.0.1:${address.port}/ws`;const peers:WebSocket[]=[];
    try{
      await Promise.all(Array.from({length:32},()=>new Promise<void>((resolve,reject)=>{
        const ws=new WebSocket(target,{origin});peers.push(ws);ws.once('message',()=>resolve());ws.once('error',reject);
      })));
      const status=await new Promise<number>(resolve=>{const ws=new WebSocket(target,{origin});ws.on('unexpected-response',(_req,res)=>{resolve(res.statusCode!);ws.terminate();});ws.on('error',()=>{});});
      expect(status).toBe(503);expect(peers.every(ws=>ws.readyState===WebSocket.OPEN)).toBe(true);
    }finally{for(const ws of peers)ws.terminate();}
  });
});
