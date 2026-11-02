import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const dataDir=mkdtempSync(join(tmpdir(),'world-patch-production-'));
const port=3193, origin=`http://localhost:${port}`, base=`http://127.0.0.1:${port}`;
const secret=randomBytes(32).toString('hex');
const checks=[];
let child;
async function start(){
  child=spawn(process.execPath,['dist/server/index.js'],{cwd:process.cwd(),env:{...process.env,HOST_SECRET:secret,PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dataDir,TWITCH_CLIENT_ID:'',TWITCH_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
  child.stdout.resume();child.stderr.resume();
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('Production process exited before becoming healthy.');
    try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{ /* Listener is starting. */ }
    await delay(100);
  }
  throw Error('Production server did not become healthy.');
}
async function stop(){
  if(!child||child.exitCode!==null)return;
  const exited=once(child,'exit');child.kill('SIGTERM');
  const fallback=setTimeout(()=>child?.kill('SIGKILL'),5000);
  await exited;clearTimeout(fallback);child=undefined;
}
async function get(path){const r=await fetch(base+path);if(!r.ok)throw Error(`GET ${path} failed.`);return r.json();}
function check(ok,name){if(!ok)throw Error(name);checks.push({name,status:'PASS'});}
try{
  await start();
  const page=await fetch(base+'/');check(page.ok&&(await page.text()).includes('WORLD//PATCH'),'Built frontend served by production entry point');
  const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({secret})});
  check(login.ok,'Production host login');const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('No host session cookie.');
  async function act(action){const r=await fetch(base+'/api/action',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(action)});if(!r.ok)throw Error('Production action failed.');return r.json();}
  await act({type:'move',direction:'right'});const moved=await get('/api/state');check(moved.game.x===2,'Real HTTP action persists player movement');
  await act({type:'startRound'});check((await get('/api/state')).phase==='proposing','Election begins before process restart');
  await stop();await start();
  const restored=await get('/api/state');
  check(JSON.stringify(restored.game)===JSON.stringify(moved.game),'Production restart preserves committed game');
  check(restored.phase==='play','Production restart cancels interrupted election');
  const unauthorized=await fetch(base+'/api/action',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{"type":"reset"}'});
  check(unauthorized.status===401,'Restart invalidates old host authority');
  const report={ok:true,at:new Date().toISOString(),node:process.version,platform:process.platform,engineVersion:restored.engineVersion,scope:'Local production Node process and persistent SQLite directory; no external deployment or Twitch',checks};
  mkdirSync(resolve('evidence'),{recursive:true});writeFileSync(resolve('evidence/production-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await stop();rmSync(dataDir,{recursive:true,force:true});}
