import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'nwaxz-update-qa-'));
for(const version of ['a','b']) {
  const target=path.join(output,version); await fs.cp('dist',target,{recursive:true});
  const html=(await fs.readFile(path.join(target,'index.html'),'utf8')).replace('<body>',`<body data-test-release="${version}">`);
  await fs.writeFile(path.join(target,'index.html'),html);
  const workerPath=path.join(target,'sw.js');
  const worker=await fs.readFile(workerPath,'utf8');
  const manifest=JSON.parse(await fs.readFile(path.join(target,'preload-manifest.json'),'utf8'));
  const indexEntry=manifest.find(entry=>entry.url==='index.html');
  assert.ok(indexEntry?.revision,'preload audit manifest must include index.html revision');
  const revision=createHash('md5').update(html).digest('hex');
  assert.equal(worker.split(indexEntry.revision).length-1,1,'worker must contain exactly one old index revision');
  const integrity=`sha256-${createHash('sha256').update(html).digest('base64')}`;
  const changed=worker.replace(indexEntry.revision,revision).replace(indexEntry.integrity,integrity);
  assert.notEqual(worker,changed);await fs.writeFile(workerPath,changed);
}
const apps=Object.fromEntries(['a','b'].map(v=>[v,createApp({distDir:path.join(output,v),revision:v})]));
let release='a', rejectWorker=0;
const server=http.createServer((req,res)=>{
  if(req.url==='/game-worker' && rejectWorker>0){rejectWorker--;res.writeHead(503);res.end();return;}
  apps[release](req,res);
}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`, errors=[];
let browser, debugPage;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:900,height:650},serviceWorkers:'allow'}),page=await context.newPage();
  debugPage=page;
  page.on('console',m=>{if(m.type()==='error')console.error('Browser:',m.text());});
  page.on('pageerror',e=>errors.push(e.message));
  let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  await page.goto(base);await page.locator('#normal').waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await page.locator('body').getAttribute('data-test-release'),'a');
  const fixture={version:1,levels:{'first-drop':{completed:true,collected:3,bestScore:3474,bestTimeMs:2662}}};
  // Save through the real v1 import path; use a level ID from the shipped fixture.
  const {levels}=await import('../src/game/levels.ts');
  fixture.levels={[levels[0].id]:{completed:true,collected:7,bestScore:3474,bestTimeMs:2662}};
  await page.locator('#settings').click();
  await page.locator('#import-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.getByText('存档已导入。',{exact:true}).waitFor();
  await page.locator('#dialog-close').click();
  const session=new EscapeWorld().snapshot();
  await page.evaluate(s=>localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s)),session);
  const before=await page.evaluate(async()=>{
    const req=indexedDB.open('nwaxz',1),db=await new Promise(r=>req.onsuccess=()=>r(req.result));
    const get=db.transaction('state').objectStore('state').get('progress'),progress=await new Promise(r=>get.onsuccess=()=>r(get.result));db.close();
    return{progress,settings:localStorage.getItem('nwaxz-settings'),session:localStorage.getItem('nwaxz-escape-session-v1')};
  });
  await page.locator('#normal').click(); await page.locator('[data-level="0"]').click();
  await page.locator('#pause').click();
  const beforeNavigation=navigations;
  release='b';
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.waiting,{},{timeout:60000});
  await page.waitForTimeout(200);
  assert.equal(navigations,beforeNavigation,'must not reload a paused/in-progress game');
  assert.equal(await page.locator('body').getAttribute('data-test-release'),'a');
  await page.screenshot({path:path.join(output,'update-deferred.png')});
  await page.locator('#quit').click();
  await page.waitForFunction(()=>document.body.dataset.testRelease==='b',{},{timeout:30000});
  await page.locator('#normal').waitFor();
  assert.equal(navigations,beforeNavigation+1,'safe menu applies update exactly once');
  const after=await page.evaluate(async()=>{
    const req=indexedDB.open('nwaxz',1),db=await new Promise(r=>req.onsuccess=()=>r(req.result));
    const get=db.transaction('state').objectStore('state').get('progress'),progress=await new Promise(r=>get.onsuccess=()=>r(get.result));db.close();
    return{progress,settings:localStorage.getItem('nwaxz-settings'),session:localStorage.getItem('nwaxz-escape-session-v1')};
  });
  assert.deepEqual(after,before);
  await page.screenshot({path:path.join(output,'updated.png')});
  await context.setOffline(true);await page.reload();await page.locator('#normal').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-test-release'),'b');
  await page.waitForTimeout(250);assert.equal(navigations,beforeNavigation+2,'offline reload must not loop');
  rejectWorker=1;
  const retryContext=await browser.newContext(),retry=await retryContext.newPage();
  retry.on('pageerror',e=>errors.push(e.message));
  await retry.goto(base);await retry.locator('#normal').waitFor();
  await retry.waitForTimeout(200);assert.equal(rejectWorker,0,'exercise initial worker failure');
  await retry.evaluate(()=>window.dispatchEvent(new Event('online')));
  await retry.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await retry.locator('body').getAttribute('data-test-release'),'b');
  await retryContext.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({worker:'/game-worker',safeDeferredUpdate:true,oneReload:true,saveAndSettingsPreserved:true,offline:true,initialRegistrationRetry:true,errors,output}));
  await context.close();
} catch(error) {
  console.error(await debugPage?.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return {controller:navigator.serviceWorker.controller?.scriptURL,active:r?.active?.state,waiting:r?.waiting?.state,installing:r?.installing?.state,online:navigator.onLine};}));
  throw error;
} finally {await browser?.close();await new Promise(r=>server.close(r));}
