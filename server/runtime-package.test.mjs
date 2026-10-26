import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('the final Docker stage packages a complete importable server dependency graph',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),local=path.resolve(root,'.local');
 await fs.mkdir(local,{recursive:true});const directory=await fs.mkdtemp(path.join(local,'runtime-package-'));
 try{
  const dockerfile=await fs.readFile(path.join(root,'Dockerfile'),'utf8'),stage=dockerfile.slice(dockerfile.lastIndexOf('FROM '));
  for(const line of stage.split('\n').filter(l=>/^COPY (?!-)/.test(l))){
   const parts=line.trim().split(/\s+/).slice(1),destination=parts.pop();
   for(const source of parts){
    const target=path.resolve(directory,destination,path.basename(source));assert.ok(target.startsWith(directory+path.sep));
    await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(root,source),target);
   }
  }
  const module=await import(pathToFileURL(path.join(directory,'server/app.mjs')).href);
  assert.equal(typeof module.createApp,'function','packaged server imports without missing relative modules');
 }finally{
  const resolved=path.resolve(directory);assert.ok(resolved.startsWith(local+path.sep)&&path.basename(resolved).startsWith('runtime-package-'));
  await fs.rm(resolved,{recursive:true,force:true});
 }
});
