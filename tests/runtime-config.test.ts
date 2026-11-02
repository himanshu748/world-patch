import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const entry=fileURLToPath(new URL('../src/server/index.ts',import.meta.url));
const loader=import.meta.resolve('tsx');
const secret='runtime-fixture-host-secret-not-for-deployment';
const active:{child:ChildProcess;directory:string}[]=[];

async function start(overrides:Record<string,string>={}){
  const directory=mkdtempSync(join(tmpdir(),'world-patch-runtime-'));
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const address=reservation.address();if(!address||typeof address==='string')throw new Error('No test listener port.');
  const port=address.port;await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  // A fresh working directory contains no .env. Inherit no credentials or
  // provider configuration while exercising the actual process entry point.
  const child=spawn(process.execPath,['--import',loader,entry],{cwd:directory,env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:String(port),HOST_SECRET:secret,DATA_DIR:directory,TWITCH_CLIENT_ID:'runtime-fixture-client',TWITCH_CLIENT_SECRET:'runtime-fixture-secret-not-real',...overrides},stdio:['ignore','pipe','pipe']});
  active.push({child,directory});
  let output='';child.stdout?.on('data',data=>{output+=String(data);});child.stderr?.on('data',data=>{output+=String(data);});
  const base=`http://127.0.0.1:${port}`;
  return {child,base,output:()=>output,ready:async()=>{
    for(let i=0;i<100;i++){
      if(child.exitCode!==null)throw new Error(`Runtime exited before health check: ${output}`);
      try{if((await fetch(`${base}/api/health`)).ok)return;}catch{ /* Listener is still starting. */ }
      await delay(50);
    }
    throw new Error('Runtime did not become healthy.');
  }};
}

afterEach(async()=>{
  for(const {child,directory} of active.splice(0)){
    if(child.exitCode===null&&child.signalCode===null){
      const exited=once(child,'exit');child.kill('SIGTERM');
      const force=setTimeout(()=>child.kill('SIGKILL'),2000);
      try{await exited;}finally{clearTimeout(force);}
    }
    rmSync(directory,{recursive:true,force:true});
  }
});

async function loginAndRedirect(base:string,origin:string){
  const login=await fetch(`${base}/api/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({secret})});
  expect(login.status).toBe(200);
  const cookie=login.headers.get('set-cookie');expect(cookie).toContain('HttpOnly');
  const connect=await fetch(`${base}/api/twitch/connect`,{method:'POST',headers:{Origin:origin,Cookie:cookie!.split(';')[0]!,'Content-Type':'application/json'},body:'{}'});
  expect(connect.status).toBe(200);
  const result=await connect.json() as {url:string};
  return {cookie,redirect:new URL(result.url).searchParams.get('redirect_uri')};
}

describe('actual runtime origin configuration',()=>{
  const cases:{name:string;env:Record<string,string>;origin:string}[]=[
    {name:'Render external URL when PUBLIC_ORIGIN is absent',env:{RENDER_EXTERNAL_URL:'https://world-patch-runtime-fixture.onrender.com'},origin:'https://world-patch-runtime-fixture.onrender.com'},
    {name:'explicit PUBLIC_ORIGIN ahead of the Render URL',env:{PUBLIC_ORIGIN:'https://world-patch-runtime-fixture.example',RENDER_EXTERNAL_URL:'https://other-runtime-fixture.onrender.com'},origin:'https://world-patch-runtime-fixture.example'},
    {name:'existing localhost default outside Render',env:{},origin:'http://localhost:3000'},
  ];
  it.each(cases)('uses $name for CSRF, cookies and the default Twitch callback',async({env,origin})=>{
    const server=await start(env);await server.ready();
    const config=await (await fetch(`${server.base}/api/config`)).json() as {origin:string;twitchConfigured:boolean};
    expect(config.origin).toBe(origin);expect(config.twitchConfigured).toBe(true);
    expect((await fetch(`${server.base}/api/login`,{method:'POST',headers:{Origin:'https://wrong-runtime-fixture.example','Content-Type':'application/json'},body:JSON.stringify({secret})})).status).toBe(403);
    const result=await loginAndRedirect(server.base,origin);
    expect(result.redirect).toBe(`${origin}/auth/twitch/callback`);
    if(origin.startsWith('https:'))expect(result.cookie).toContain('Secure');else expect(result.cookie).not.toContain('Secure');
  });

  it('preserves an explicit Twitch redirect URI when deriving the Render origin',async()=>{
    const origin='https://world-patch-runtime-fixture.onrender.com',redirect='https://callback-runtime-fixture.example/twitch';
    const server=await start({RENDER_EXTERNAL_URL:origin,TWITCH_REDIRECT_URI:redirect});await server.ready();
    expect((await loginAndRedirect(server.base,origin)).redirect).toBe(redirect);
  });

  it('fails closed when the Render fallback contains a path instead of an exact origin',async()=>{
    const server=await start({RENDER_EXTERNAL_URL:'https://world-patch-runtime-fixture.onrender.com/wrong'});
    const [code]=await once(server.child,'exit');
    expect(code).not.toBe(0);expect(server.output()).toContain('PUBLIC_ORIGIN must be an exact origin without path or credentials.');
  });
});
