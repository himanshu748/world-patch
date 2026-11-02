import { readFileSync, statSync } from 'node:fs';
import { verifyReplay } from '../src/server/replay.js';
import type { ReplayExport } from '../src/shared/protocol.js';
const path=process.argv[2];
if(!path){console.error('Usage: npm run replay -- path/to/world-patch-replay.json');process.exitCode=1;}
else {
  try{
    if(statSync(path).size>64*1024*1024)throw new Error('Replay file exceeds 64 MiB.');
    const input:unknown=JSON.parse(readFileSync(path,'utf8'));
    const result=verifyReplay(input as ReplayExport);
    console.log(JSON.stringify({...result,note:'Game state and each escape witness recomputed with the recorded engine. Hashes are not administrator-proof signatures.'},null,2));
  }catch(error){console.error(error instanceof Error?error.message:'Replay verification failed.');process.exitCode=1;}
}
