import assert from'node:assert/strict';
import fs from'node:fs/promises';
import {createServer}from'vite';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const vite=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:0},logLevel:'error'});await vite.listen();
const base=`http://127.0.0.1:${vite.httpServer.address().port}`,output='.local/material-v025-qa';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking']});
const errors=[];try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ops/material-quality-fixture.html');await page.waitForFunction(()=>window.materialQA,undefined,{timeout:60000});
 const original=await page.evaluate(()=>window.materialQA.originalTexels());for(const[k,r]of Object.entries(original)){assert.deepEqual([r.width,r.height],[1254,1254],k);assert.equal(r.mismatchedChannels,0,k+' GPU base pixels differ from original decoded PNG');}
 const inspect=await page.evaluate(()=>window.materialQA.inspect());await fs.writeFile(`${output}/inspect.json`,JSON.stringify(inspect,null,2));assert.equal(inspect.webgl,2);for(const[k,t]of Object.entries(inspect.textures)){assert.equal(t.gpu.width,1254,k);assert.equal(t.gpu.height,1254,k);}
 for(const name of ['painted-tile','painted-floor','painted-ceiling','basement-tile','basement-floor','basement-ceiling','wood_dark_old','iron_rust','pipe_ceramic_old'])assert.ok(inspect.materials.some(m=>m.name===name),name+' must use the original material');
 assert.ok(inspect.materials.some(m=>m.name.startsWith('painted-equipment:')),'equipment casing uses painted metal');
 const views=[];const cdp=await context.newCDPSession(page);
 for(const[width,height,dpr]of[[1920,1080,1],[1280,720,2],[390,844,3],[3840,2160,1]]){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});for(const high of[false,true]){await page.evaluate(high=>window.materialQA.resize(high),high);const r=await page.evaluate(()=>window.materialQA.inspect());assert.deepEqual(r.render,[width*dpr,height*dpr]);views.push({width,height,dpr,high,render:r.render});}}
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 for(const[name,x,z,angle,pitch]of[['bedroom',3.5,5.5,-Math.PI/2,0],['corridor',12.5,9.5,0,-.3],['basement',4.5,32.5,0,-.12],['pump',20.5,31.5,-Math.PI/2,0]]){await page.evaluate(({x,z,angle,pitch})=>window.materialQA.draw(x,z,angle,pitch),{x,z,angle,pitch});await page.screenshot({path:`${output}/${name}.png`});}
 assert.deepEqual(errors,[]);await fs.writeFile(`${output}/report.json`,JSON.stringify({original,inspect,views,errors},null,2));console.log(JSON.stringify({originalImages:9,gpuOriginalTexelsExact:true,nativeResolutionCases:views.length,equipment:true,errors}));await context.close();
}finally{await browser.close();await vite.close();}
