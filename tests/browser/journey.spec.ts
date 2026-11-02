import { expect, type Page } from '@playwright/test';
import { test, type HostCookies } from './fixtures.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyReplay } from '../../src/server/replay.js';
import type { ReplayExport } from '../../src/shared/protocol.js';
import { solve, type Patch } from '../../src/shared/engine.js';
import { patchKey, patchLabel } from '../../src/shared/commands.js';

const origin=`http://localhost:${process.env.PLAYWRIGHT_PORT??3107}`;
const artifacts=resolve('evidence/screenshots');mkdirSync(artifacts,{recursive:true});
const secret='browser-test-secret-not-for-deployment-1234';
async function paintedBoard(page:Page){
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async()=>page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>{
    const context=canvas.getContext('2d');if(!context)return 0;
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let colored=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!>180&&pixels[i+1]!>110&&pixels[i+2]!<170&&pixels[i+3]!>150)colored++;
    return colored;
  }),{message:'Phaser must draw the amber player/key; a visible blank canvas is not a game.'}).toBeGreaterThan(50);
}
async function state(page:Page){return (await page.request.get('/api/state')).json();}
async function action(page:Page,body:unknown){const r=await page.request.post('/api/action',{headers:{origin},data:body});expect(r.ok(),await r.text()).toBe(true);return r.json();}
async function enter(page:Page,hostCookies:HostCookies,chamberId='vector-foundry'){
  await page.context().addCookies(hostCookies);
  await page.goto('/play');await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'Lock controls'})).toBeVisible();
  await action(page,{type:'newSession',origin:'simulation',chamberId});
  await expect.poll(async()=> (await state(page)).chamber.id).toBe(chamberId);
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeVisible();
  await paintedBoard(page);
  await page.evaluate(()=>window.scrollTo(0,0));
}
async function command(page:Page,actor:string,text:string){
  await page.getByLabel('Simulated viewer',{exact:true}).fill(actor);
  await page.getByLabel('Chat command',{exact:true}).fill(text);
  await page.getByRole('button',{name:'Send test command'}).click();
}
async function mergeThroughServer(page:Page,text:string){
  await action(page,{type:'startRound'});
  const proposal=await page.request.post('/api/simulate',{headers:{origin},data:{actor:'motion-proposer',text}});expect(proposal.ok()).toBe(true);expect((await proposal.json()).ok).toBe(true);
  await action(page,{type:'closeWindow'});
  const vote=await page.request.post('/api/simulate',{headers:{origin},data:{actor:'motion-voter',text:'!vote 1'}});expect(vote.ok()).toBe(true);expect((await vote.json()).ok).toBe(true);
  return (await action(page,{type:'closeWindow'})).state;
}

test('real browser: rejected lockout, proposal, ballot, merge and replay remain correct during updates',async({page,hostCookies})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page,hostCookies);
  // A session change during feedback used to cancel its cleanup and leave the class stuck.
  const firstMerge=await mergeThroughServer(page,'!patch ice on');
  await expect(page.locator('.world-panel')).toHaveAttribute('data-merge-receipt',firstMerge.receipt.id);
  await expect(page.locator('.law-change')).toHaveAttribute('data-law','ice');
  await action(page,{type:'selectChamber',chamberId:'crosswire'});
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  await expect(page.locator('.world-panel')).not.toHaveClass(/merge-flash/);
  await action(page,{type:'selectChamber',chamberId:'vector-foundry'});
  await expect(page.getByRole('heading',{name:'Vector Foundry',exact:true})).toBeVisible();
  await page.screenshot({path:resolve(artifacts,'desktop-controller.png'),fullPage:true});
  await page.getByRole('button',{name:'Open patch round'}).click();
  await expect(page.getByRole('button',{name:'Move right'})).toBeDisabled();
  await command(page,'lockout','!patch gravity down');
  await expect(page.getByText('No escape under these rules. Patch rejected.',{exact:true}).first()).toBeVisible();
  expect((await state(page)).game.rules.gravity).toBe('off');
  await command(page,'architect','!patch walls A closed');
  await expect(page.locator('.candidate')).toHaveCount(1);
  await page.getByRole('button',{name:'Close proposals → vote'}).click();
  await command(page,'voter','!vote 1');
  await expect(page.locator('.candidate-bottom')).toContainText('1 vote');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'desktop-vote.png'),fullPage:true});
  await page.getByRole('button',{name:'Close vote & merge'}).click();
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeVisible();
  const merged=await state(page);expect(merged.game.rules.walls.A).toBe(true);expect(merged.receipt.witness).toBeUndefined();
  expect(merged.receipt.pathLength).toBe(24);
  await expect(page.locator('.world-panel')).toHaveAttribute('data-merge-receipt',merged.receipt.id);
  await expect(page.locator('.law-change')).toHaveCount(1);
  await expect(page.locator('.law-change')).toHaveAttribute('data-law','walls');
  await expect(page.locator('.merge-confirmation')).toContainText('Close wall group A');
  await action(page,{type:'blockActor',actorId:'motion-unrelated-update'});
  await expect(page.locator('.world-panel')).toHaveAttribute('data-merge-receipt',merged.receipt.id);
  await page.screenshot({path:resolve(artifacts,'motion-merge.png')});
  await expect(page.locator('.world-panel')).not.toHaveClass(/merge-flash/);
  for(let i=0;i<3;i++){
    await action(page,{type:'blockActor',actorId:`settled-feedback-${i}`});
    await expect(page.locator('.world-panel')).not.toHaveClass(/merge-flash/);
    await expect(page.locator('.law-change')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'End attempt & reveal'}).click();
  await expect(page.getByRole('button',{name:'Play witness'})).toBeVisible();
  const before=await state(page);
  // Real server snapshots during replay reproduce busy-chat timing without claiming real Twitch.
  let flood=true;let serial=0;
  const updates=(async()=>{while(flood){await action(page,{type:'blockActor',actorId:`regression-${serial++}`});await new Promise(r=>setTimeout(r,180));}})();
  try{
    await page.getByRole('button',{name:'Play witness'}).click();
    await expect(page.locator('.replay-counter')).toContainText('EXIT REACHED',{timeout:21000});
  }finally{flood=false;await updates;}
  expect((await state(page)).game).toEqual(before.game);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'witness-replay.png'),fullPage:true});
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export replay evidence'}).click();
  const download=await downloadEvent;const path=resolve('evidence/sample-simulation-replay.json');await download.saveAs(path);
  const replay=JSON.parse(readFileSync(path,'utf8')) as ReplayExport;
  const verified=verifyReplay(replay);expect(verified.ok).toBe(true);expect(verified.mergeCount).toBe(1);
  writeFileSync(resolve('evidence/sample-replay-verification.json'),JSON.stringify(verified,null,2)+'\n');
  expect(errors).toEqual([]);
});

test('keyboard is scoped to board, mobile fits, and reduced motion uses manual witness steps',async({page,hostCookies})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await enter(page,hostCookies,'thin-ice');
  await mergeThroughServer(page,'!patch ice on');
  await expect(page.locator('.law-change')).toHaveAttribute('data-law','ice');
  await expect(page.locator('.law-change')).toHaveCSS('animation-name','none');
  await expect(page.locator('.law-change')).toHaveCSS('transform','none');
  await expect(page.locator('[data-law="portals"]')).toContainText('0↔1 / 2↔3');
  const before=await state(page);
  await page.getByLabel('Chat command',{exact:true}).focus();await page.keyboard.press('ArrowRight');
  expect((await state(page)).game).toEqual(before.game);
  const board=page.getByRole('region',{name:'Puzzle play area'});
  // A named section maps to region; fallback locator is the same semantic play target.
  await board.focus();await page.keyboard.press('ArrowRight');
  await expect.poll(async()=> (await state(page)).game.x).toBe(before.game.x+1);
  await page.getByRole('button',{name:'Reset checkpoint'}).click();
  await expect.poll(async()=> (await state(page)).game.x).toBe(before.game.x);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
  await expect(page.getByRole('button',{name:'Move up'})).toHaveCSS('min-height',/44px|46px|48px/);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'mobile-controller.png'),fullPage:true});
  await page.getByRole('button',{name:'End attempt & reveal'}).click();
  await expect(page.getByRole('button',{name:'Play witness'})).toBeDisabled();
  const length=(await state(page)).receipt.witness.length;
  for(let i=0;i<length;i++)await page.getByRole('button',{name:'Step →',exact:true}).click();
  await expect(page.locator('.replay-counter')).toContainText('EXIT REACHED');
  await page.getByRole('button',{name:'Reset replay'}).click();
  await expect(page.locator('.replay-counter')).toContainText(`0 / ${length}`);
  await expect(page.locator('.world-panel')).toHaveCSS('animation-name','none');
});

test('overlay stays read-only, follows chamber changes and recovers latest snapshot after reload',async({page,context,hostCookies})=>{
  await enter(page,hostCookies);
  const overlay=await context.newPage();await overlay.setViewportSize({width:1920,height:1080});
  await overlay.goto('/overlay');await paintedBoard(overlay);
  await expect(overlay.getByRole('button',{name:'Open patch round'})).toHaveCount(0);
  await expect(overlay.getByLabel('Host secret')).toHaveCount(0);
  await expect(overlay.getByRole('button',{name:'Lock controls'})).toHaveCount(0);
  expect(await overlay.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const initial=(await state(page)).game;
  await overlay.locator('#play-region').focus();await overlay.keyboard.press('ArrowRight');expect((await state(page)).game).toEqual(initial);
  await page.getByRole('combobox',{name:'Start a new chamber',exact:true}).selectOption('crosswire');
  await expect(overlay.getByRole('heading',{name:'Vector Foundry',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(overlay.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  await overlay.reload();await expect(overlay.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open patch round'}).click();
  await command(page,'portal-maker','!patch portals crossed');
  await page.getByRole('button',{name:'Close proposals → vote'}).click();await command(page,'portal-voter','!vote 1');
  await overlay.screenshot({path:resolve(artifacts,'obs-overlay-1080p.png')});
  await page.getByRole('button',{name:'Close vote & merge'}).click();
  const challenge=await state(page);const solution=solve(challenge.chamber,challenge.game,{maxMs:1000});expect(solution.status).toBe('solved');
  let revision=challenge.gameRevision;
  for(const direction of solution.witness){
    await page.getByRole('button',{name:`Move ${direction}`,exact:true}).click();
    await expect.poll(async()=> (await state(page)).gameRevision).toBe(++revision);
  }
  expect((await state(page)).game.escaped).toBe(true);
  await page.getByRole('button',{name:'Reveal escape witness'}).click();await overlay.bringToFront();
  await expect(overlay.locator('.board-topline')).toContainText('KEY REQUIRED');
  await expect(overlay.locator('.chamber-coordinate')).toContainText('WITNESS REPLAY');
  await expect(overlay.locator('[data-law="portals"]')).toContainText('0↔3 / 1↔2');
  await expect(overlay.locator('.replay-counter')).toContainText('EXIT REACHED',{timeout:16000});
  await overlay.screenshot({path:resolve(artifacts,'obs-witness-1080p.png')});
  await overlay.setViewportSize({width:1280,height:720});
  expect(await overlay.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await overlay.screenshot({path:resolve(artifacts,'obs-overlay-720p.png')});
});

test('empty audiences, pause, cancel, login errors and keyboard focus expose usable states',async({page})=>{
  await page.goto('/play');await page.getByLabel('Host secret',{exact:true}).fill('wrong-secret');await page.getByRole('button',{name:'Unlock controls'}).click();
  await expect(page.getByRole('alert')).toContainText('Host secret did not match');
  await page.getByLabel('Host secret',{exact:true}).fill(secret);await page.getByRole('button',{name:'Unlock controls'}).click();
  await action(page,{type:'newSession',origin:'simulation',chamberId:'vector-foundry'});
  await page.getByRole('button',{name:'Open patch round'}).click();await page.getByRole('button',{name:'Pause round'}).click();
  await expect(page.getByRole('button',{name:'Resume round'})).toBeVisible();await expect(page.getByRole('button',{name:'Move right'})).toBeDisabled();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(artifacts,'paused-round.png'),fullPage:true});
  await page.getByRole('button',{name:'Resume round'}).click();await page.getByRole('button',{name:'Close proposals → vote'}).click();
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeVisible();expect((await state(page)).game.rules.walls.A).toBe(false);
  await page.getByRole('button',{name:'Open patch round'}).click();await page.getByRole('button',{name:'Cancel round'}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeVisible();
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to the chamber'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Puzzle play area'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Move up',exact:true})).toBeFocused();
  await page.reload();await expect(page.getByRole('button',{name:'Open patch round'})).toBeVisible();
  for(let i=0;i<12 && !await page.getByRole('button',{name:'Open patch round'}).evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeFocused();
  const outline=await page.getByRole('button',{name:'Open patch round'}).evaluate(el=>getComputedStyle(el).outlineStyle);expect(outline).not.toBe('none');
  const holdNextAction = async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/action', async route => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({response});
    }, {times:1});
    return release;
  };
  // Let the real WebSocket phase update arrive while HTTP is still pending.
  const releaseFirst = await holdNextAction();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Close proposals → vote'})).toBeDisabled();
  releaseFirst();
  await expect(page.getByRole('button',{name:'Close proposals → vote'})).toBeFocused();
  await page.getByRole('button',{name:'Cancel round'}).click();
  const releaseSecond = await holdNextAction();
  await page.getByRole('button',{name:'Open patch round'}).click();
  await expect(page.getByRole('button',{name:'Close proposals → vote'})).toBeDisabled();
  await page.getByLabel('Chat command',{exact:true}).fill('!patch walls A closed');
  releaseSecond();
  await expect(page.getByRole('button',{name:'Close proposals → vote'})).toBeEnabled();
  await expect(page.getByLabel('Chat command',{exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Cancel round'}).click();
  await page.getByText('Accessible text map',{exact:true}).click();await expect(page.locator('.text-map')).toContainText('@');
});

test('presentation fixture: all eight ballot choices fit OBS at 1080p and 720p',async({page})=>{
  const fixture=await state(page);
  fixture.origin='simulation';fixture.phase='voting';fixture.deadline=Date.now()+20000;fixture.serverTime=Date.now();fixture.receipt.witness=undefined;fixture.receipt.start=undefined;
  fixture.chamber.name='LAYOUT FIXTURE · Vector Foundry';
  // Real bounded labels include the longest portal law. These are presentation
  // fixtures, not a claim that all eight laws solve this checkpoint.
  const patches:Patch[]=[{kind:'gravity',value:'up'},{kind:'gravity',value:'right'},{kind:'gravity',value:'down'},{kind:'gravity',value:'left'},{kind:'ice',value:true},{kind:'portals',value:'normal'},{kind:'walls',group:'A',closed:true},{kind:'walls',group:'B',closed:true}];
  fixture.candidates=patches.map((patch,i)=>({id:i+1,key:patchKey(patch),patch,label:patchLabel(patch),votes:i}));
  fixture.history=[{at:Date.now(),kind:'layout-fixture',message:'LAYOUT FIXTURE: eight ballot slots; not real solver acceptance or Twitch evidence.'}];
  await page.route('**/api/state',route=>route.fulfill({json:fixture}));
  await page.routeWebSocket('**/ws',ws=>ws.send(JSON.stringify(fixture)));
  for(const viewport of [{width:1920,height:1080},{width:1280,height:720}]){
    await page.setViewportSize(viewport);await page.goto('/overlay');await paintedBoard(page);
    await expect(page.locator('.candidate')).toHaveCount(8);
    for(const candidate of await page.locator('.candidate').all()){
      const box=await candidate.boundingBox();expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
      const label=await candidate.locator('h3').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
      expect(label.scrollWidth,'Every law must be readable without ellipsis').toBeLessThanOrEqual(label.width+1);
      expect(label.scrollHeight).toBeLessThanOrEqual(label.height+1);
    }
    const world=await page.locator('.world-panel').boundingBox();expect(world!.y+world!.height).toBeLessThanOrEqual(viewport.height);
    const canvas=await page.locator('canvas').boundingBox();const mount=await page.locator('.phaser-mount').boundingBox();
    expect(canvas!.height,'The displayed chamber must remain large enough to read').toBeGreaterThanOrEqual(viewport.height===720?320:430);
    expect(canvas!.x).toBeGreaterThanOrEqual(mount!.x-1);expect(canvas!.y).toBeGreaterThanOrEqual(mount!.y-1);
    expect(canvas!.x+canvas!.width).toBeLessThanOrEqual(mount!.x+mount!.width+1);expect(canvas!.y+canvas!.height).toBeLessThanOrEqual(mount!.y+mount!.height+1);
    const receipt=await page.locator('.fairness-receipt').boundingBox();expect(receipt!.y+receipt!.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator('.receipt-stats')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:resolve(artifacts,`fixture-eight-ballot-${viewport.height}p.png`)});
  }
});
