import { expect, type WebSocketRoute } from '@playwright/test';
import { test } from './fixtures.js';

test('mobile shows a local room outage and recovers committed state after socket reconnect',async({page,hostCookies})=>{
  const origin=`http://localhost:${process.env.PLAYWRIGHT_PORT??3107}`;
  await page.context().addCookies(hostCookies);
  const act=(data:unknown)=>page.request.post('/api/action',{headers:{origin},data});
  expect((await act({type:'newSession',origin:'simulation',chamberId:'vector-foundry'})).ok()).toBe(true);
  let current:WebSocketRoute|undefined;let connections=0;
  await page.routeWebSocket('**/ws',socket=>{current=socket;connections++;socket.connectToServer();});
  await page.setViewportSize({width:390,height:844});await page.goto('/play');
  await expect(page.locator('.server-status')).toContainText('Room connected');
  await expect(page.getByRole('button',{name:'Move right'})).toBeEnabled();
  if(!current)throw Error('Browser socket was not established.');
  current.close({code:1012,reason:'Local connectivity regression'});
  await expect(page.locator('.server-status')).toBeVisible();
  await expect(page.locator('.server-status')).toContainText('Room reconnecting');
  await expect(page.getByRole('button',{name:'Move right'})).toBeDisabled();
  expect((await act({type:'move',direction:'right'})).ok()).toBe(true);
  await expect.poll(()=>connections).toBeGreaterThan(1);
  await expect(page.locator('.server-status')).toContainText('Room connected');
  await expect(page.locator('#board-description')).toContainText('Player at column 2, row 1');
  await expect(page.getByRole('button',{name:'Move right'})).toBeEnabled();
});
