import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const image=process.env.WORLD_PATCH_IMAGE??process.argv[2];
if(!image||!/^world-patch:[a-f0-9]{40}$/.test(image))throw new Error('Set WORLD_PATCH_IMAGE to world-patch:<40-character source commit>.');
const run=randomUUID().replaceAll('-','').slice(0,16);
const container=`world-patch-smoke-${run}`,volume=`world-patch-smoke-${run}`;
const origin='https://world-patch-container-fixture.invalid';
const secret=randomBytes(32).toString('hex');
const reportPath=resolve(process.env.WORLD_PATCH_SMOKE_REPORT??'work/container-host-smoke.json');
const checks=[];
let ownContainer=false,ownVolume=false,base='',cookie='';

function docker(args,input){return execFileSync('docker',args,{encoding:'utf8',env:{...process.env,HOST_SECRET:secret},stdio:['pipe','pipe','pipe'],maxBuffer:2*1024*1024,input}).trim();}
function check(ok,name){if(!ok)throw new Error(name);checks.push({name,status:'PASS'});}
async function get(path){const response=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(3000)});check(response.ok,`GET ${path}`);return response.json();}
async function ready(){
  for(let i=0;i<120;i++){
    try{const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1500)});if(response.ok)return;}catch{ /* Container is starting. */ }
    if(docker(['inspect','--format','{{.State.Running}}',container])!=='true')throw new Error('Owned smoke container exited before becoming healthy.');
    await delay(250);
  }
  throw new Error('Owned smoke container did not become healthy.');
}
async function login(){
  const response=await fetch(`${base}/api/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({secret})});
  check(response.ok,'Host login succeeds with synthetic secret');
  const value=response.headers.get('set-cookie');
  check(value?.includes('HttpOnly')&&value.includes('Secure')&&value.includes('SameSite=Lax'),'HTTPS configuration sets Secure HttpOnly SameSite cookie');
  cookie=value.split(';')[0];
}
async function act(payload,expected=200,session=cookie){
  const response=await fetch(`${base}/api/action`,{method:'POST',headers:{Origin:origin,Cookie:session,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  check(response.status===expected,`Host action ${payload.type} returns ${expected}`);
  return response.json();
}
function websocketCheck(rejectOrigin=false){
  const program=`import WebSocket from 'ws';
const socket=new WebSocket('ws://127.0.0.1:3000/ws',{origin:${JSON.stringify(rejectOrigin?'https://wrong-container-fixture.invalid':origin)}});
const timer=setTimeout(()=>process.exit(1),5000);
socket.on('error',()=>{});
socket.on('unexpected-response',(_request,response)=>{clearTimeout(timer);response.resume();process.exit(${rejectOrigin?'response.statusCode===403?0:1':'1'});});
socket.on('message',raw=>{clearTimeout(timer);try{const state=JSON.parse(raw.toString());socket.close();process.exit(${rejectOrigin?'1':'state.game&&state.sessionId?0:1'});}catch{process.exit(1);}});`;
  docker(['exec',container,'node','--input-type=module','-e',program]);
  check(true,rejectOrigin?'WebSocket upgrade rejects wrong Origin':'WebSocket upgrade sends actual room snapshot for configured Origin');
}

let status='FAIL',failure;
try{
  const target=JSON.parse(docker(['image','inspect',image]))[0];
  check(target.Os==='linux'&&target.Architecture==='amd64','Image is native Linux amd64');
  docker(['volume','create','--label',`worldpatch.smoke-run=${run}`,volume]);ownVolume=true;
  docker(['run','--detach','--name',container,'--label',`worldpatch.smoke-run=${run}`,'--memory','512m','--memory-swap','512m','--cpus','0.5','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--publish','127.0.0.1::3000','--mount',`type=volume,source=${volume},target=/data`,'--env','HOST_SECRET','--env',`PUBLIC_ORIGIN=${origin}`,image]);ownContainer=true;
  const resources=docker(['inspect','--format','{{.HostConfig.Memory}}:{{.HostConfig.NanoCpus}}',container]);
  check(resources==='536870912:500000000','Container is capped at 512 MiB and 0.5 CPU');
  check(docker(['inspect','--format','{{.HostConfig.ReadonlyRootfs}}',container])==='true','Container root filesystem is read-only with a separate writable data volume');
  base=`http://${docker(['port',container,'3000/tcp'])}`;
  await ready();
  const health=await get('/api/health');check(health.ok===true,'Actual container health is ready');
  check(docker(['exec',container,'node','--version'])==='v26.13.0','Container runs pinned Node 26.13.0');
  docker(['exec',container,'node','--input-type=module','-e',"import Database from 'better-sqlite3';const db=new Database(':memory:');if(db.prepare('SELECT 1 AS value').get().value!==1)process.exit(1);db.close();"]);
  check(true,'Native better-sqlite3 loads and executes SQL in the production image');
  for(const path of ['/','/play','/overlay']){
    const response=await fetch(`${base}${path}`);const html=await response.text();
    check(response.ok&&html.includes('WORLD//PATCH')&&html.includes('id="root"'),`Built frontend ${path} is served`);
    if(path==='/'){
      const asset=html.match(/<script[^>]+src="([^"]+)"/);check(asset&&asset[1].startsWith('/assets/'),'Normal build uses root asset paths');
      check((await fetch(`${base}${asset[1]}`)).ok,'Actual built JavaScript asset is served');
    }
  }
  const unauthorized=await fetch(`${base}/api/action`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"type":"reset"}'});
  check(unauthorized.status===401,'Anonymous host mutation is rejected');
  const wrongOrigin=await fetch(`${base}/api/login`,{method:'POST',headers:{Origin:'https://wrong-container-fixture.invalid','Content-Type':'application/json'},body:JSON.stringify({secret})});
  check(wrongOrigin.status===403,'Wrong-origin login is rejected');
  websocketCheck();websocketCheck(true);
  await login();
  const before=await get('/api/state');await act({type:'move',direction:'right'});const moved=await get('/api/state');
  check(moved.game.x===before.game.x+1,'Actual HTTP movement updates the game');
  await act({type:'startRound'});check((await get('/api/state')).phase==='proposing','Election is active before controlled restart');
  const oldCookie=cookie;
  docker(['restart','--timeout','20',container]);await ready();
  const restored=await get('/api/state');
  check(JSON.stringify(restored.game)===JSON.stringify(moved.game),'Persistent volume restores committed game across container restart');
  check(restored.phase==='play','Restart cancels the interrupted election');
  await act({type:'reset'},401,oldCookie);
  await login();await act({type:'reveal'});
  const replayResponse=await fetch(`${base}/api/replay`,{headers:{Cookie:cookie}});check(replayResponse.ok,'Revealed replay can be fetched after reauthentication');
  const replay=await replayResponse.json();
  check(replay.origin==='simulation'&&replay.sessionId===restored.sessionId&&replay.events.some(event=>event.kind==='move')&&replay.events.some(event=>event.kind==='recovered'),'Replay retains simulation provenance and persisted movement/recovery');
  const verification=JSON.parse(docker(['exec','-i',container,'node','--input-type=module','-e',`import {verifyReplay} from './dist/server/replay.js';let text='';for await(const chunk of process.stdin)text+=chunk;const result=verifyReplay(JSON.parse(text));if(!result.ok)process.exit(1);console.log(JSON.stringify({ok:result.ok,eventCount:result.eventCount,mergeCount:result.mergeCount}));`],JSON.stringify(replay)));
  check(verification.ok&&verification.eventCount===replay.events.length,'Independent verifier reconstructs the fetched persisted replay');
  check(docker(['inspect','--format','{{.State.OOMKilled}}',container])==='false','Completed container is not marked OOM killed');
  status='PASS';
}catch(error){failure=error instanceof Error?error.message.replaceAll(secret,'[SYNTHETIC_SECRET]').slice(0,4000):'Container smoke failed.';process.exitCode=1;}
finally{
  if(ownContainer)try{docker(['rm','--force',container]);}catch{status='FAIL';failure='Could not remove the owned smoke container.';process.exitCode=1;}
  if(ownVolume)try{docker(['volume','rm',volume]);}catch{status='FAIL';failure='Could not remove the owned smoke volume.';process.exitCode=1;}
  const report={status,at:new Date().toISOString(),image,sourceSha:image.slice('world-patch:'.length),scope:'Actual Linux Docker image and synthetic isolated container; no Caddy TLS, remote Lightsail access or Twitch provider connection',limits:{memoryBytes:536870912,cpu:0.5},checks,...(failure?{failure}:{})};
  mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status,checks:checks.length,report:reportPath,...(failure?{failure}:{})},null,2));
}
