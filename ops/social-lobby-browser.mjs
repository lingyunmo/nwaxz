import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {attachCoopSockets} from '../server/coop-socket.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const app=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}),server=app.listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));const closeSockets=attachCoopSockets(server,app.locals.coop),base=`http://127.0.0.1:${server.address().port}`;
await fs.mkdir('.local/social-lobby-qa',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking']});
const errors=[],contexts=[];
async function player(name){const ctx=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(ctx);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#extreme').click();await page.waitForFunction(()=>/UID \d{9}/.test(document.querySelector('.lv-user')?.textContent??''));await page.locator('.lv-user').click();await page.locator('#lv-name').fill(name);await page.locator('[data-action="rename"]').click();await page.waitForFunction(name=>document.querySelector('.lv-user')?.textContent.includes(name),name);const uid=await page.evaluate(()=>JSON.parse(localStorage.getItem('nwaxz-social-identity-v1')).uid);return{page,uid};}
async function screen(p,name){await p.locator(`.lv-rail [data-screen="${name}"]`).click();await p.locator(`[data-lobby-screen="${name}"]`).waitFor();}
async function join(p,code,password){await screen(p,'servers');await p.locator('#lv-code').fill(code);await p.locator('[data-action="join-code"]').click();await p.locator('form.lv-modal [name="password"]').fill(password);await p.locator('form.lv-modal button[type="submit"]').click();}
try{
 const a=await player('雨夜'),b=await player('浴场'),c=await player('巡夜');
 await screen(a.page,'home');await a.page.screenshot({path:'.local/social-lobby-qa/home-desktop.png'});
 assert.ok(await a.page.locator('.lv-home-art').evaluate(e=>getComputedStyle(e).backgroundImage.includes('escape-survivors-0')));
 await screen(a.page,'friends');await a.page.locator('#lv-add-uid').fill(b.uid);await a.page.locator('[data-action="add-friend"]').click();await a.page.locator('.lv-message').filter({hasText:'申请已发送'}).waitFor();
 await screen(b.page,'friends');await b.page.locator(`[data-action="accept-friend"][data-uid="${a.uid}"]`).click();await b.page.locator(`[data-action="remove-friend"][data-uid="${a.uid}"]`).waitFor();
 await a.page.reload();await a.page.locator('#extreme').click();await a.page.waitForFunction(uid=>document.querySelector('.lv-user')?.textContent.includes(uid),a.uid);await screen(a.page,'friends');await a.page.locator(`[data-action="remove-friend"][data-uid="${b.uid}"]`).waitFor();
 await screen(a.page,'servers');await a.page.waitForFunction(()=>document.querySelector('.lv-status')?.textContent.includes('/8'));assert.ok(await a.page.locator('.lv-status').innerText().then(t=>/\d+\s*ms/.test(t)),'measured server RTT');
 await a.page.locator('[data-open-create]').click();const form=a.page.locator('form.lv-modal');assert.equal(await form.locator('[name="password"]').isVisible(),false);await form.locator('[name="name"]').fill('深夜小队');await form.locator('[name="visibility"]').selectOption('private');await form.locator('[name="password"]').fill('night-water');await form.locator('button[type="submit"]').click();await a.page.locator('.lv-room-banner').waitFor();
 const code=(await a.page.locator('.lv-room-banner').innerText()).match(/[A-Z0-9]{6}/)[0];
 await screen(c.page,'servers');await c.page.locator('.lv-room-list article').filter({hasText:code}).waitFor();assert.ok((await c.page.locator('.lv-room-list').innerText()).includes('密码房'));
 await join(c.page,code,'wrong');await c.page.locator('.lv-message').filter({hasText:'密码错误'}).waitFor();assert.equal(await c.page.locator('.lv-roster').count(),0);
 await screen(a.page,'friends');await a.page.locator(`[data-action="invite"][data-uid="${b.uid}"]`).click();await a.page.locator('.lv-message').filter({hasText:'邀请已发送'}).waitFor();
 await screen(b.page,'friends');await b.page.locator(`[data-action="accept-invite"][data-code="${code}"]`).click();await b.page.locator('.lv-roster').waitFor();
 await join(c.page,code,'night-water');await c.page.locator('.lv-roster').waitFor();await screen(a.page,'room');await a.page.waitForFunction(()=>document.querySelectorAll('.lv-slot.occupied').length===3);assert.equal(await a.page.locator('.lv-body').count(),3);
 assert.ok(await a.page.locator('.lv-slot.occupied').evaluateAll(slots=>slots.every(s=>{const card=s.getBoundingClientRect(),body=s.querySelector('.lv-body').getBoundingClientRect();return body.top>=card.top&&body.bottom<=card.bottom;})),'full body frames must not clip heads or feet');
 await a.page.screenshot({path:'.local/social-lobby-qa/squad-desktop.png'});
 await c.page.setViewportSize({width:390,height:844});await c.page.screenshot({path:'.local/social-lobby-qa/squad-phone.png'});assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await c.page.locator('[data-action="start"]').count(),0);
 for(const {page}of[c,b,a]){await page.locator('[data-action="leave"]').click();await page.waitForFunction(()=>!document.querySelector('.lv-roster'));}
 assert.equal(app.locals.coop.rooms.size,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({guestIdentityReload:true,friendsRequestAcceptPersist:true,passwordRejection:true,passwordJoin:true,friendInviteBypass:true,threeFullBodySquad:true,serverCapacity:8,realLatency:true,ownRoomsCleaned:true,errors}));
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();closeSockets();app.locals.coop.close();app.locals.social.close();await new Promise(r=>server.close(r));}
