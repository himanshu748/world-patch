import { expect, type Page } from '@playwright/test';
import { test } from './fixtures.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAMBERS } from '../../src/shared/chambers.js';
import { applyPatch, initialState, solve, transitionDetailed, type Chamber, type Direction, type Patch } from '../../src/shared/engine.js';

const screenshots=resolve('evidence/screenshots');mkdirSync(screenshots,{recursive:true});
async function expectRenderedPlayer(page:Page,chamber:Chamber,position=chamber.exit){
  // Check actual canvas pixels at an authoritative engine position.
  await expect.poll(()=>page.locator('.lp-sandbox canvas').evaluate((canvas:HTMLCanvasElement,map)=>{
    const context=canvas.getContext('2d');if(!context)return 0;
    const sx=canvas.width/(map.width*66+80),sy=canvas.height/(map.height*66+80);
    const x=(40+map.exit.x*66+33-18)*sx,y=(40+map.exit.y*66+33-18)*sy;
    const pixels=context.getImageData(x,y,36*sx,36*sy).data;let amber=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!>180&&pixels[i+1]!>110&&pixels[i+2]!<170&&pixels[i+3]!>150)amber++;
    return amber;
  },{width:chamber.width,height:chamber.height,exit:position})).toBeGreaterThan(50);
}

test('landing: actual local law verification, rejection, witness steps, reset and controller entry',async({page})=>{
  const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
  const roomBefore=await (await page.request.get('/api/state')).json();
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('Chat changes');
  await expect(page.getByText('LOCAL SANDBOX',{exact:true})).toBeVisible();
  await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
  for(const viewport of [{width:1440,height:900},{width:1280,height:720}]){
    await page.setViewportSize(viewport);
    await expect(page.locator('.lp-hero-actions .lp-button')).toBeInViewport({ratio:1});
    await expect(page.getByRole('button',{name:'Close wall A'})).toBeInViewport({ratio:1});
    await expect(page.getByRole('button',{name:'Pull gravity down'})).toBeInViewport({ratio:1});
  }
  await page.setViewportSize({width:1440,height:900});
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 18 moves');
  const position=await page.locator('.lp-sandbox-position').innerText();
  await page.getByRole('button',{name:'Close wall A'}).click();
  await expect(page.getByRole('status')).toContainText('Wall A closed. Escape survives.');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 24 moves');
  await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
  await page.screenshot({path:resolve(screenshots,'marketing-landing-accepted.png')});
  await page.getByRole('button',{name:'Pull gravity down'}).click();
  await expect(page.getByRole('status')).toContainText('Lockout rejected.');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('GRAVITY Off');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 24 moves');
  for(let step=0;step<24;step++)await page.getByRole('button',{name:'Step through escape'}).click();
  await expect(page.locator('.lp-window-status')).toContainText('EXIT REACHED');
  await expect(page.getByRole('button',{name:'Step through escape'})).toBeDisabled();
  await page.getByRole('button',{name:'Reset sandbox',exact:true}).click();
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Open');
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 18 moves');
  await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
  const roomAfter=await (await page.request.get('/api/state')).json();
  expect(roomAfter.game).toEqual(roomBefore.game);expect(roomAfter.revision).toBe(roomBefore.revision);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(screenshots,'marketing-landing-hero.png')});
  await page.screenshot({path:resolve(screenshots,'marketing-landing-desktop.png'),fullPage:true});
  await page.getByRole('link',{name:'Enter the chamber',exact:true}).first().click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('heading',{name:roomBefore.chamber.name,exact:true})).toBeVisible();
  expect(failures).toEqual([]);
});

test('landing: keyboard path, mobile fit, law disclosure and reduced-motion sandbox',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to the interactive sandbox'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region',{name:'Try to break the world.'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Close wall A'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Wall A closed. Escape survives.');
  await expect(page.locator('.lp-verdict-icon')).toHaveCSS('animation-name','none');
  await expect(page.locator('.lp-verdict-icon')).toHaveCSS('transform','none');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Pull gravity down'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Lockout rejected.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  for(const button of await page.locator('.lp-law-choices button,.lp-witness-actions button').all()){
    const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.lp-law-details summary').filter({hasText:'Portals'}).click();
  await expect(page.getByText('Rewire four endpoints.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:resolve(screenshots,'marketing-landing-mobile.png'),fullPage:true});
  await page.getByRole('link',{name:'Open the read-only broadcast view'}).click();
  await expect(page).toHaveURL(/\/overlay$/);
  await expect(page.locator('.app-shell.overlay')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Take the controls.'})).toHaveCount(0);
  await expect(page.getByRole('group',{name:'Movement controls'})).toHaveCount(0);
});

test('landing: OAuth result URLs retain controller entry and clear the result query',async({page})=>{
  // Exercise local result routing only; this is not a provider authorization test.
  for(const result of ['connected','denied','failed']){
    await page.goto(`/?oauth=${result}`);
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.landing-page')).toHaveCount(0);
    await expect(page.locator('.world-panel canvas')).toBeVisible();
    if(result==='connected'){
      await expect(page.locator('.notice')).toContainText('Twitch authorization received. Waiting for the chat subscription.');
    }else{
      await expect(page.getByRole('alert')).toContainText('Twitch authorization did not complete. Use Connect Twitch to try again.');
    }
  }
});

test('landing: visitors can play the checked escape without changing the room or mixing witness state',async({page})=>{
  const roomBefore=await (await page.request.get('/api/state')).json();
  await page.goto('/');
  await page.getByRole('button',{name:'Close wall A'}).click();
  await page.getByRole('button',{name:'Try the escape'}).click();
  const board=page.getByRole('region',{name:'Playable sandbox board'});
  await expect(board).toBeFocused();
  await board.press('ArrowUp');
  await expect(page.getByRole('status',{name:'Escape attempt'})).toContainText('Wall ahead');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await board.press('ArrowRight');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
  const position=await page.locator('.lp-sandbox-position').innerText();
  await page.getByRole('button',{name:'Pull gravity down'}).click();
  await expect(page.locator('.lp-sandbox-verdict')).toContainText('Lockout rejected.');
  await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
  await page.getByRole('button',{name:'Restart attempt'}).click();
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  const chamber=CHAMBERS[0]!;
  const proof=solve(chamber,applyPatch(chamber,initialState(chamber),{kind:'walls',group:'A',closed:true}));
  expect(proof.status).toBe('solved');
  const keys:Record<Direction,string>={up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
  for(const direction of proof.witness)await board.press(keys[direction]);
  await expect(page.locator('.lp-window-meta')).toContainText('KEY ACQUIRED');
  await expect(page.locator('.lp-window-status')).toContainText('EXIT REACHED');
  await expect(page.getByRole('status',{name:'Escape attempt'})).toContainText('You found the exit.');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText(`${proof.witness.length} moves`);
  for(const button of await page.getByRole('group',{name:'Sandbox movement'}).getByRole('button').all())await expect(button).toBeDisabled();
  await page.getByText('Text map & legend',{exact:true}).click();
  await expect(page.getByLabel('Sandbox text map')).not.toContainText('K');
  await page.locator('.lp-sandbox').screenshot({path:resolve(screenshots,'marketing-landing-played.png')});
  await page.getByRole('button',{name:'See checked route'}).click();
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 24 moves');
  await expect(page.locator('.lp-sandbox-position')).toHaveText('POS 01.01');
  await page.getByRole('button',{name:'Step through escape'}).click();
  await expect(page.locator('.lp-sandbox-counter')).toContainText('1 / 24 moves');
  await page.getByRole('button',{name:'Try the escape'}).click();
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await expect(page.locator('.lp-sandbox-position')).toHaveText('POS 01.01');
  const roomAfter=await (await page.request.get('/api/state')).json();
  expect(roomAfter.game).toEqual(roomBefore.game);expect(roomAfter.revision).toBe(roomBefore.revision);
});

test('landing: touch play, scoped keys, restart and text map work with reduced motion on narrow screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Try the escape'}).click();
  const board=page.getByRole('region',{name:'Playable sandbox board'});
  await page.getByRole('button',{name:'See checked route'}).press('ArrowRight');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await board.press('Control+ArrowRight');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await page.getByRole('button',{name:'Sandbox move right',exact:true}).click();
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
  await expect(page.locator('.lp-sandbox-position')).toHaveText('POS 02.01');
  await page.getByRole('button',{name:'Close wall A'}).click();
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  await expect(page.locator('.lp-sandbox-position')).toHaveText('POS 01.01');
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await expect(page.getByRole('button',{name:'Try the escape'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Sandbox move right',exact:true}).click();
  await page.getByRole('button',{name:'Restart attempt'}).click();
  await expect(page.locator('.lp-sandbox-position')).toHaveText('POS 01.01');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('WALL A Closed');
  await page.getByText('Text map & legend',{exact:true}).click();
  await expect(page.getByLabel('Sandbox text map')).toContainText('@');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    for(const button of await page.locator('.lp-play-modes button,.lp-play-dpad button,.lp-witness-actions button').all()){
      const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.lp-sandbox').screenshot({path:resolve(screenshots,'marketing-landing-play-mobile.png')});
  await page.getByRole('button',{name:'Reset sandbox',exact:true}).click();
  await expect(page.getByRole('button',{name:'See checked route'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('group',{name:'Sandbox movement'})).toHaveCount(0);
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 18 moves');
});

test('landing: primary demo entry works without login and returning from the final CTA preserves an attempt',async({page})=>{
  const mutations:string[]=[];const failures:string[]=[];
  page.on('request',request=>{if(request.method()==='POST')mutations.push(request.url());});
  page.on('pageerror',error=>failures.push(error.message));
  const roomBefore=await (await page.request.get('/api/state')).json();
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.goto('/');
    await expect(page.locator('.lp-sandbox canvas')).toBeVisible();
    const start=page.locator('.lp-hero-actions').getByRole('button',{name:'Play the demo',exact:true});
    await expect(start).toBeInViewport({ratio:1});
    await expect(page.locator('.lp-availability')).toContainText('No sign-in for the demo.');
    await page.screenshot({path:resolve(screenshots,viewport.width===1440?'visitor-landing-desktop.png':'visitor-landing-mobile.png')});
    if(viewport.width===1440)await start.press('Enter');else await start.click();
    const board=page.getByRole('region',{name:'Playable sandbox board'});
    await expect(board).toBeFocused();await expect(board).toBeInViewport({ratio:1});
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button',{name:'Try the escape',exact:true})).toHaveAttribute('aria-pressed','true');
    await board.press('ArrowRight');
    await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
    const position=await page.locator('.lp-sandbox-position').innerText();
    await page.locator('.lp-final-cta').getByRole('button',{name:'Play the demo',exact:true}).click();
    await expect(board).toBeFocused();await expect(board).toBeInViewport({ratio:1});
    await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
    await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
    await expect(page.locator('.lp-sandbox-board')).toHaveCSS('animation-name','none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.locator('.lp-hero-actions').getByRole('link',{name:'Host a chamber',exact:true}).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole('heading',{name:'Take the controls.',exact:true})).toBeVisible();
    await expect(page.getByLabel('Host secret',{exact:true})).toBeVisible();
  }
  const roomAfter=await (await page.request.get('/api/state')).json();
  expect(roomAfter.game).toEqual(roomBefore.game);expect(roomAfter.revision).toBe(roomBefore.revision);
  expect(mutations).toEqual([]);expect(failures).toEqual([]);
});

test('landing: all chamber cards launch real laws and completed escapes lead to the next chamber',async({page})=>{
  const roomBefore=await (await page.request.get('/api/state')).json();
  await page.goto('/');
  const examples:{label:string;patch:Patch;law:string}[]=[
    {label:'Close wall A',patch:{kind:'walls',group:'A',closed:true},law:'WALL A Closed'},
    {label:'Cross portal pairs',patch:{kind:'portals',value:'crossed'},law:'PORTALS Crossed'},
    {label:'Make ice slippery',patch:{kind:'ice',value:true},law:'FLOOR Slippery'},
  ];
  const keys:Record<Direction,string>={up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
  const board=page.getByRole('region',{name:'Playable sandbox board'});
  for(const [index,chamber] of CHAMBERS.entries()){
    const card=page.getByRole('button',{name:`Play ${chamber.name}`,exact:true});
    await card.click();await expect(board).toBeFocused();
    await expect(card).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.lp-window-meta')).toContainText(chamber.name.toUpperCase());
    await expect(page.locator('.lp-sandbox canvas')).toHaveCount(1);
    if(index===1){
      await board.press('ArrowRight');const position=await page.locator('.lp-sandbox-position').innerText();
      await card.click();await expect(page.locator('.lp-sandbox-position')).toHaveText(position);
      await expect(page.locator('.lp-sandbox-counter')).toHaveText('1 move');
      await page.getByRole('button',{name:'Restart attempt'}).click();
    }
    const example=examples[index]!;await page.getByRole('button',{name:example.label,exact:false}).click();
    await expect(board).toBeFocused();
    await expect(page.locator('.lp-sandbox-verdict')).toContainText('Escape survives.');
    await expect(page.locator('.lp-sandbox-laws')).toContainText(example.law);
    const proof=solve(chamber,applyPatch(chamber,initialState(chamber),example.patch));expect(proof.status).toBe('solved');
    for(const direction of proof.witness)await board.press(keys[direction]);
    await expect(page.locator('.lp-window-status')).toContainText('EXIT REACHED');
    await expect(page.getByRole('heading',{name:'You found a way through.'})).toBeVisible();
    await expect(page.locator('.lp-completion')).toContainText(`${chamber.name}, escaped in ${proof.witness.length} moves.`);
    await expectRenderedPlayer(page,chamber);
    await page.locator('.lp-sandbox').screenshot({path:resolve(screenshots,`completed-${chamber.id}.png`)});
    const next=CHAMBERS[(index+1)%CHAMBERS.length]!;
    await page.getByRole('button',{name:`Next: ${next.name}`,exact:false}).click();
    await expect(board).toBeFocused();await expect(page.locator('.lp-window-meta')).toContainText(next.name.toUpperCase());
    await expect(page.locator('.lp-completion')).toHaveCount(0);await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  }
  await page.locator('.lp-chambers').screenshot({path:resolve(screenshots,'playable-chamber-selection.png')});
  const roomAfter=await (await page.request.get('/api/state')).json();expect(roomAfter.game).toEqual(roomBefore.game);expect(roomAfter.revision).toBe(roomBefore.revision);
});

test('landing: chamber selection, completion and current-chamber reset work on mobile with reduced motion',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByRole('button',{name:'Play Crosswire',exact:true}).press('Enter');
  await expect(page.getByRole('region',{name:'Playable sandbox board'})).toBeFocused();
  await page.getByRole('button',{name:'Cross portal pairs',exact:false}).click();
  await page.getByRole('button',{name:'Pull gravity down',exact:false}).click();
  await expect(page.locator('.lp-sandbox-verdict')).toContainText('Lockout rejected.');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('PORTALS Crossed');
  const chamber=CHAMBERS[1]!;const proof=solve(chamber,applyPatch(chamber,initialState(chamber),{kind:'portals',value:'crossed'}));expect(proof.status).toBe('solved');
  for(const direction of proof.witness)await page.getByRole('button',{name:`Sandbox move ${direction}`,exact:true}).click();
  await expectRenderedPlayer(page,chamber);
  await expect(page.locator('.lp-completion')).toHaveCSS('animation-name','none');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    for(const control of await page.locator('.lp-chamber-play,.lp-completion button,.lp-completion a').all()){
      const box=await control.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.lp-sandbox').screenshot({path:resolve(screenshots,'completed-crosswire-mobile.png')});
  await page.getByRole('button',{name:'Next: Thin Ice',exact:false}).click();
  await page.getByRole('button',{name:'Make ice slippery',exact:false}).click();
  await expect(page.locator('.lp-sandbox-laws')).toContainText('FLOOR Slippery');
  await page.getByRole('button',{name:'Reset sandbox',exact:true}).click();
  await expect(page.locator('.lp-window-meta')).toContainText('THIN ICE');
  await expect(page.locator('.lp-sandbox-laws')).toContainText('FLOOR Stable');
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 12 moves');
});

test('landing: interrupted movement cannot resurrect a prior chamber or attempt',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');
  const board=page.getByRole('region',{name:'Playable sandbox board'});
  const keys:Record<Direction,string>={up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
  const reachFrame=async(chamber:Chamber,patch:Patch,kind:'portal'|'slide')=>{
    let state=applyPatch(chamber,initialState(chamber),patch);
    const proof=solve(chamber,state);expect(proof.status).toBe('solved');
    for(const direction of proof.witness){
      const result=transitionDetailed(chamber,state,direction);state=result.state;
      await board.press(keys[direction]);
      if(result.frames.some(frame=>frame.kind===kind))return;
    }
    throw new Error(`The authored route must exercise ${kind} movement.`);
  };
  await page.getByRole('button',{name:'Play Crosswire',exact:true}).click();
  await page.getByRole('button',{name:'Cross portal pairs',exact:false}).click();
  await reachFrame(CHAMBERS[1]!,{kind:'portals',value:'crossed'},'portal');
  await page.getByRole('button',{name:'Play Thin Ice',exact:true}).click();
  const ice=CHAMBERS[2]!;
  await expect(page.locator('.lp-sandbox canvas')).toHaveCount(1);
  await expectRenderedPlayer(page,ice,ice.start);
  // Allow superseded portal/slide tweens to finish; they must not move a new pawn.
  await page.waitForTimeout(750);
  await expectRenderedPlayer(page,ice,ice.start);
  await page.getByRole('button',{name:'Make ice slippery',exact:false}).click();
  await reachFrame(ice,{kind:'ice',value:true},'slide');
  await page.getByRole('button',{name:'Restart attempt'}).click();
  await expect(page.locator('.lp-sandbox-counter')).toHaveText('0 moves');
  await page.waitForTimeout(750);await expectRenderedPlayer(page,ice,ice.start);
  await board.press('ArrowUp');
  await page.getByRole('button',{name:'See checked route',exact:true}).click();
  await page.waitForTimeout(750);await expectRenderedPlayer(page,ice,ice.start);
  await page.getByRole('button',{name:'Step through escape'}).click();
  await page.getByRole('button',{name:'Reset sandbox',exact:true}).click();
  await page.waitForTimeout(750);await expectRenderedPlayer(page,ice,ice.start);
  await expect(page.locator('.lp-window-meta')).toContainText('THIN ICE');
  await expect(page.locator('.lp-sandbox-counter')).toContainText('0 / 12 moves');
  await expect(page.locator('.lp-sandbox canvas')).toHaveCount(1);
});
