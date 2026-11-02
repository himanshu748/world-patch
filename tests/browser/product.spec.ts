import { expect, type Page } from '@playwright/test';
import { test, type HostCookies } from './fixtures.js';
import { resolve } from 'node:path';

const origin=`http://localhost:${process.env.PLAYWRIGHT_PORT??3107}`;
const secret='browser-test-secret-not-for-deployment-1234';
async function snapshot(page:Page){return (await page.request.get('/api/state')).json();}
async function action(page:Page,body:unknown){
  const response=await page.request.post('/api/action',{headers:{origin},data:body});
  expect(response.ok(),await response.text()).toBe(true);return response.json();
}
async function unlock(page:Page,hostCookies:HostCookies){
  await page.context().addCookies(hostCookies);
  await page.goto('/play');
  await expect(page.getByRole('button',{name:'Lock controls'})).toBeVisible();
  await action(page,{type:'newSession',origin:'simulation',chamberId:'vector-foundry'});
}
async function send(page:Page,actor:string,command?:string){
  await page.getByLabel('Simulated viewer',{exact:true}).fill(actor);
  if(command!==undefined)await page.getByLabel('Chat command',{exact:true}).fill(command);
  await page.getByRole('button',{name:'Send test command'}).click();
}

test('host: access is visible first, chamber selection is deliberate and voting follows actual candidates',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/play');
  await expect(page.getByLabel('Host secret',{exact:true})).toBeInViewport({ratio:1});
  await expect(page.getByRole('button',{name:'Unlock controls'})).toBeInViewport({ratio:1});
  await page.screenshot({path:resolve('evidence/screenshots/product-host-access.png')});
  await page.getByLabel('Host secret',{exact:true}).fill(secret);
  await page.getByRole('button',{name:'Unlock controls'}).click();
  const picker=page.getByRole('combobox',{name:'Start a new chamber',exact:true});
  await expect(picker).toBeFocused();
  await expect(page.locator('.notice')).toHaveCount(0);
  const before=await snapshot(page);
  await picker.selectOption('crosswire');
  expect((await snapshot(page)).sessionId).toBe(before.sessionId);
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open patch round'}).click();
  await expect(page.getByLabel('Chat command',{exact:true})).toHaveValue('!patch portals crossed');
  await send(page,'guided-portal');await expect(page.locator('.candidate')).toHaveCount(1);
  await expect(page.locator('.simulation-feedback')).toBeVisible();
  await expect(page.locator('.simulation-feedback')).toHaveCSS('position','static');
  await send(page,'guided-gate','!patch walls A closed');await expect(page.locator('.candidate')).toHaveCount(2);
  await page.getByRole('button',{name:'Remove candidate 1',exact:true}).click();
  await page.getByRole('button',{name:'Close proposals → vote'}).click();
  await expect(page.getByLabel('Chat command',{exact:true})).toHaveValue('!vote 2');
  await expect(page.getByRole('button',{name:'Vote 1',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Vote 2',exact:true}).click();
  await page.getByLabel('Chat command',{exact:true}).fill('!vote 2 ');
  await action(page,{type:'blockActor',actorId:'unrelated-snapshot'});
  await expect(page.getByLabel('Chat command',{exact:true})).toHaveValue('!vote 2 ');
  await page.getByRole('button',{name:'Vote 2',exact:true}).click();
  await send(page,'guided-ballot');
  await expect(page.locator('.candidate-bottom')).toContainText('1 vote');
  await page.getByRole('button',{name:'Close vote & merge'}).click();
  expect((await snapshot(page)).game.rules.walls.A).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve('evidence/screenshots/product-host-round.png'),fullPage:true});
});

test('replay: reveal focuses inspection, timeline and speed never mutate the saved attempt',async({page,hostCookies})=>{
  await page.setViewportSize({width:1440,height:1000});await unlock(page,hostCookies);
  await page.getByRole('button',{name:'Move right',exact:true}).click();
  const attempted=(await snapshot(page)).game;
  await expect(page.getByRole('button',{name:'End attempt & reveal'})).toBeEnabled();
  await page.getByRole('button',{name:'End attempt & reveal'}).press('Enter');
  await expect(page.getByRole('button',{name:'Play witness',exact:true})).toBeFocused();
  await expect(page.locator('.chamber-coordinate')).toContainText('WITNESS REPLAY');
  const slider=page.getByRole('slider',{name:'Witness step',exact:true});
  await slider.press('End');
  await expect(page.locator('.replay-counter')).toContainText('EXIT REACHED');
  await expect(page.locator('.board-topline')).toContainText('KEY ACQUIRED');
  expect((await snapshot(page)).game).toEqual(attempted);
  await slider.press('Home');
  await expect(page.locator('.replay-counter')).toContainText('0 /');
  await expect(page.locator('.board-topline')).toContainText('KEY REQUIRED');
  await page.getByRole('combobox',{name:'Replay speed',exact:true}).selectOption('2');
  await page.getByRole('button',{name:'Play witness',exact:true}).click();
  await expect(page.locator('.replay-counter')).toContainText('EXIT REACHED',{timeout:20000});
  expect((await snapshot(page)).game).toEqual(attempted);
  await page.getByText('Accessible text map',{exact:true}).click();
  await expect(page.locator('.text-map')).not.toContainText('K');
  await slider.press('Home');
  await expect(page.locator('.text-map')).toContainText('K');
  await expect(page.getByRole('button',{name:'Play witness',exact:true})).toBeVisible();
  await page.screenshot({path:resolve('evidence/screenshots/product-replay-controls.png'),fullPage:true});
});

test('mobile and broadcast: manual replay stays accessible and spectator controls remain local',async({page,context})=>{
  await page.setViewportSize({width:320,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/play');await expect(page.getByLabel('Host secret',{exact:true})).toBeInViewport({ratio:1});
  await page.getByLabel('Host secret',{exact:true}).fill(secret);await page.getByRole('button',{name:'Unlock controls'}).click();
  await action(page,{type:'newSession',origin:'simulation',chamberId:'thin-ice'});
  await expect(page.getByRole('button',{name:'End attempt & reveal'})).toBeEnabled();
  await page.getByRole('button',{name:'End attempt & reveal'}).press('Enter');
  await expect(page.getByRole('button',{name:'Step →',exact:true})).toBeFocused();
  await expect(page.getByRole('button',{name:'Play witness',exact:true})).toBeDisabled();
  await expect(page.getByRole('combobox',{name:'Replay speed',exact:true})).toBeDisabled();
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    for(const control of await page.locator('.host-actions button,.replay-transport button,.replay-transport select,.replay-transport input').all()){
      const box=await control.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({path:resolve('evidence/screenshots/product-mobile-replay.png'),fullPage:true});
  const spectator=await context.newPage();await spectator.setViewportSize({width:1280,height:720});await spectator.emulateMedia({reducedMotion:'reduce'});await spectator.goto('/overlay');
  await expect(spectator.getByRole('button',{name:'Open patch round'})).toHaveCount(0);
  await expect(spectator.getByLabel('Host secret',{exact:true})).toHaveCount(0);
  await expect(spectator.getByRole('combobox',{name:'Start a new chamber',exact:true})).toHaveCount(0);
  const before=await snapshot(page);
  await spectator.getByRole('slider',{name:'Witness step',exact:true}).press('End');
  await expect(spectator.locator('.replay-counter')).toContainText('EXIT REACHED');
  const after=await snapshot(page);expect(after.game).toEqual(before.game);expect(after.revision).toBe(before.revision);
  expect(await spectator.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const receipt=await spectator.locator('.fairness-receipt').boundingBox();expect(receipt!.y+receipt!.height).toBeLessThanOrEqual(720);
  await spectator.screenshot({path:resolve('evidence/screenshots/product-broadcast-replay-720p.png')});
});

test('capacity feedback: failed ordinary action leaves Reveal available',async({page,hostCookies})=>{
  await unlock(page,hostCookies);
  const before=await snapshot(page);
  // HTTP presentation fixture; the real 20k-event boundary is covered in storage.test.ts.
  await page.route('**/api/action',route=>route.fulfill({status:409,json:{code:'CAPACITY',message:'Session action capacity reached. Cancel any open election, Reveal and export this attempt, then start a new session.'}}),{times:1});
  await page.getByRole('button',{name:'Open patch round'}).click();
  await expect(page.getByRole('alert')).toContainText('Reveal and export');
  expect((await snapshot(page)).game).toEqual(before.game);
  await page.getByRole('button',{name:'End attempt & reveal'}).click();
  await expect(page.getByRole('button',{name:'Export replay evidence',exact:true})).toBeVisible();
});

test('startup: delayed bootstrap never replaces a newer streamed chamber',async({page,hostCookies})=>{
  await unlock(page,hostCookies);
  let release!:()=>void;let captured!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const intercepted=new Promise<void>(resolve=>{captured=resolve;});
  await page.route('**/api/state',async route=>{
    const response=await route.fetch();captured();await held;await route.fulfill({response});
  },{times:1});
  await page.reload();await intercepted;
  await action(page,{type:'newSession',origin:'simulation',chamberId:'crosswire'});
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  release();
  // Host config arrives through the same bootstrap completion, after the old state.
  await expect(page.getByRole('button',{name:'Lock controls'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  expect((await snapshot(page)).chamber.id).toBe('crosswire');
});

// Exercise HTTP ordering through the real login entry point, without replacing auth responses.
test('startup: a delayed anonymous config cannot undo a newer host login',async({page})=>{
  let release!:()=>void;let captured!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const intercepted=new Promise<void>(resolve=>{captured=resolve;});
  await page.route('**/api/state',async route=>{
    const response=await route.fetch();
    captured();await held;await route.fulfill({response});
  },{times:1});
  await page.goto('/play');await intercepted;
  await page.getByLabel('Host secret',{exact:true}).fill(secret);
  await page.getByRole('button',{name:'Unlock controls'}).click();
  await expect(page.getByRole('button',{name:'Lock controls'})).toBeVisible();
  const staleResponse=page.waitForResponse(response=>response.url().endsWith('/api/state'));
  release();await (await staleResponse).finished();
  // Let the fulfilled bootstrap settle; an early assertion could miss its late overwrite.
  await page.waitForTimeout(300);
  await expect(page.getByRole('button',{name:'Lock controls'})).toBeVisible();
  await expect(page.getByLabel('Host secret',{exact:true})).toHaveCount(0);
});

test('host views: an old action response cannot replace a newer streamed session',async({page,hostCookies})=>{
  await unlock(page,hostCookies);
  let release!:()=>void;let captured!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const intercepted=new Promise<void>(resolve=>{captured=resolve;});
  await page.route('**/api/action',async route=>{
    const response=await route.fetch();captured();await held;await route.fulfill({response});
  },{times:1});
  await page.getByRole('button',{name:'Move right',exact:true}).click();await intercepted;
  await expect(page.locator('#board-description')).toContainText('Player at column 2, row 1');
  // Another authenticated controller changes the room while this response is held.
  await action(page,{type:'newSession',origin:'simulation',chamberId:'crosswire'});
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  const current=await snapshot(page);release();
  await expect(page.getByRole('button',{name:'Open patch round'})).toBeEnabled();
  await expect(page.getByRole('heading',{name:'Crosswire',exact:true})).toBeVisible();
  expect((await snapshot(page)).sessionId).toBe(current.sessionId);
});
