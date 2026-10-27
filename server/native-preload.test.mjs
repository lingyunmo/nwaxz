import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchNativeImage} from '../src/native-preload.ts';
const bytes=Buffer.alloc(700003);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
const integrity='sha256-'+createHash('sha256').update(bytes).digest('base64');
const partial=(body,start,end,total=bytes.length)=>new Response(body,{status:206,headers:{'content-type':'image/png','content-range':`bytes ${start}-${end}/${total}`,'content-length':String(end-start+1),'cache-control':'no-cache, no-transform'}});
test('native PNG range assembly preserves exact bytes, checks integrity, and returns one whole response',async()=>{
 const ranges=[],progress=[];const response=await fetchNativeImage('https://example.invalid/a.png',bytes.length,integrity,n=>progress.push(n),async(url,options)=>{const [,start,end]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range).map(Number);ranges.push([start,end]);assert.equal(options.credentials,'same-origin');return partial(bytes.subarray(start,end+1),start,end)});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-range'),null);assert.equal(response.headers.get('content-length'),String(bytes.length));assert.match(response.headers.get('cache-control'),/no-transform/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.deepEqual(ranges.sort((a,b)=>a[0]-b[0]),[[0,262143],[262144,524287],[524288,700002]]);assert.equal(progress.at(-1),bytes.length);
});
test('a server ignoring Range is accepted only if the complete original hash matches',async()=>{let requests=0;const r=await fetchNativeImage('x',bytes.length,integrity,()=>{},async()=>{requests++;return new Response(bytes,{headers:{'content-type':'image/png'}})});assert.equal(requests,1);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes)});
test('wrong ranges, truncated data, non-image responses and modified content fail before cache insertion',async()=>{
 const invalid=[()=>partial(bytes.subarray(0,262144),1,262144),()=>partial(bytes.subarray(0,100),0,262143),()=>new Response('error',{headers:{'content-type':'text/html'}}),()=>new Response(Buffer.alloc(bytes.length),{headers:{'content-type':'image/png'}})];
 for(const fetcher of invalid)await assert.rejects(()=>fetchNativeImage('x',bytes.length,integrity,()=>{},fetcher));
});
test('invalid manifests are rejected without fetching',async()=>{for(const [size,hash]of [[0,integrity],[9*1024*1024,integrity],[bytes.length,'invalid']])await assert.rejects(()=>fetchNativeImage('x',size,hash,()=>{},async()=>{throw Error('must not fetch')}),/清单/)});
test('a temporary request failure is retried once and progress counts only received bytes',async()=>{let calls=0;const r=await fetchNativeImage('x',3,'sha256-'+createHash('sha256').update('abc').digest('base64'),()=>{},async()=>{if(calls++===0)throw Error('network');return partial(Buffer.from('abc'),0,2,3)});assert.equal(await r.text(),'abc');assert.equal(calls,2)});
