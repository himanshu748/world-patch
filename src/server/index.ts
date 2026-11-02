import { loadEnvFile } from 'node:process';
import { buildServer } from './app.js';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const env=process.env;
const publicOrigin=env.PUBLIC_ORIGIN??env.RENDER_EXTERNAL_URL??'http://localhost:3000';
const clientId=env.TWITCH_CLIENT_ID;
const clientSecret=env.TWITCH_CLIENT_SECRET;
const {app}=await buildServer({hostSecret:env.HOST_SECRET??'',publicOrigin,dataDir:env.DATA_DIR??'./data',trustedProxyIp:env.TRUSTED_PROXY_IP,twitch:clientId&&clientSecret?{clientId,clientSecret,redirectUri:env.TWITCH_REDIRECT_URI??`${publicOrigin}/auth/twitch/callback`}:undefined});
try{
  await app.listen({port:Number(env.PORT??3000),host:env.HOST??'127.0.0.1'});
  console.log(`WORLD//PATCH listening at ${publicOrigin}. Simulation is available; live Twitch requires authorization.`);
}catch{console.error('WORLD//PATCH could not start. Check port, configuration and data directory.');await app.close();process.exitCode=1;}
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void app.close();});
