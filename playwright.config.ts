import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dataDir=process.env.PLAYWRIGHT_DATA_DIR??mkdtempSync(join(tmpdir(),'world-patch-browser-'));
const port=Number(process.env.PLAYWRIGHT_PORT??3107);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PLAYWRIGHT_PORT must be an unprivileged TCP port.');
const baseURL=`http://localhost:${port}`;
export default defineConfig({
  testDir:'tests/browser',fullyParallel:false,workers:1,timeout:45000,
  expect:{timeout:10000},
  reporter:[['list'],['json',{outputFile:process.env.PLAYWRIGHT_REPORT_PATH??'evidence/browser-tests.json'}]],
  use:{baseURL,browserName:'chromium',channel:'chromium',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'off'},
  webServer:{command:'node dist/server/index.js',url:`${baseURL}/api/health`,reuseExistingServer:false,timeout:30000,env:{HOST_SECRET:'browser-test-secret-not-for-deployment-1234',PUBLIC_ORIGIN:baseURL,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dataDir,TWITCH_CLIENT_ID:'',TWITCH_CLIENT_SECRET:''}},
});
