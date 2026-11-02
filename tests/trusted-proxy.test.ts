import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer } from '../src/server/app.js';

const hostSecret='trusted-proxy-fixture-host-secret-not-real';
const origin='https://trusted-proxy-fixture.example';
const active:Awaited<ReturnType<typeof buildServer>>[]=[];
const directories:string[]=[];

async function setup(trustedProxyIp?:string){
  const dataDir=mkdtempSync(join(tmpdir(),'world-patch-proxy-'));directories.push(dataDir);
  const server=await buildServer({hostSecret,publicOrigin:origin,dataDir,serveStatic:false,trustedProxyIp});
  active.push(server);return server;
}

afterEach(async()=>{
  for(const server of active.splice(0))await server.app.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});

async function failedLogin(server:Awaited<ReturnType<typeof buildServer>>,remoteAddress:string,forwardedFor:string){
  return server.app.inject({method:'POST',url:'/api/login',remoteAddress,headers:{origin,'x-forwarded-for':forwardedFor},payload:{secret:'incorrect-fixture-password'}});
}

describe('exact trusted proxy and login rate limits',()=>{
  it.each(['10.40.0.2','2001:db8::2'])('separates client buckets only through the exact trusted peer %s',async(proxy)=>{
    const server=await setup(proxy);
    for(let attempt=0;attempt<6;attempt++)expect((await failedLogin(server,proxy,'198.51.100.10')).statusCode).toBe(401);
    expect((await failedLogin(server,proxy,'198.51.100.10')).statusCode).toBe(429);
    expect((await failedLogin(server,proxy,'198.51.100.11')).statusCode).toBe(401);
  });

  it('keeps an untrusted peer in one bucket despite changing forwarding headers',async()=>{
    const server=await setup('10.40.0.2');
    for(let attempt=0;attempt<6;attempt++)expect((await failedLogin(server,'10.40.0.3',`198.51.100.${attempt+10}`)).statusCode).toBe(401);
    expect((await failedLogin(server,'10.40.0.3','198.51.100.99')).statusCode).toBe(429);
  });

  it('ignores forwarding headers when no trusted proxy is configured',async()=>{
    const server=await setup();
    for(let attempt=0;attempt<6;attempt++)expect((await failedLogin(server,'10.40.0.2',`198.51.100.${attempt+10}`)).statusCode).toBe(401);
    expect((await failedLogin(server,'10.40.0.2','198.51.100.99')).statusCode).toBe(429);
  });

  it('does not trust a forged earlier hop beyond the first untrusted forwarded address',async()=>{
    const server=await setup('10.40.0.2');
    for(let attempt=0;attempt<6;attempt++)expect((await failedLogin(server,'10.40.0.2',`203.0.113.${attempt+10}, 198.51.100.10`)).statusCode).toBe(401);
    expect((await failedLogin(server,'10.40.0.2','203.0.113.99, 198.51.100.10')).statusCode).toBe(429);
    expect((await failedLogin(server,'10.40.0.2','198.51.100.11')).statusCode).toBe(401);
  });

  it('rejects empty, wildcard, CIDR, list and hostname settings before creating storage',async()=>{
    const directory=mkdtempSync(join(tmpdir(),'world-patch-invalid-proxy-'));directories.push(directory);
    for(const trustedProxyIp of ['','true','*','0.0.0.0/0','10.40.0.2/32','10.40.0.2,10.40.0.3','proxy.internal',' 10.40.0.2']){
      const dataDir=join(directory,'must-not-be-created');
      await expect(buildServer({hostSecret,publicOrigin:origin,dataDir,serveStatic:false,trustedProxyIp})).rejects.toThrow('TRUSTED_PROXY_IP must be one exact IP address.');
      expect(existsSync(dataDir)).toBe(false);
    }
  });
});
