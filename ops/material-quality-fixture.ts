import { EscapeRenderer } from "../src/escape/renderer.ts";
import { surfacePaths, type SurfaceImages } from "../src/escape/material-assets.ts";
import { EscapeWorld } from "../src/escape/world.ts";
import { loadImage } from "../src/loading.ts";
import type { Scene } from "@babylonjs/core/scene.js";
import type { Engine } from "@babylonjs/core/Engines/engine.js";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
const images=Object.fromEntries(await Promise.all(Object.entries(surfacePaths).map(async([kind,url])=>[kind,await loadImage(url)]))) as SurfaceImages;
const art={surfaces:images,map:await loadImage('/assets/ui/escape-map-atlas-v1.webp'),basement:await loadImage('/assets/scenes/escape-basement-atlas-v1.webp')};
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,renderer=new EscapeRenderer(canvas,art,false);
await renderer.load();
const internals=renderer as unknown as {engine:Engine;view:{scene:Scene};surfaceTextures:Record<string,Texture>};
function draw(x=3.5,z=5.5,angle=-Math.PI/2,pitch=0,light=true){const w=new EscapeWorld(42);Object.assign(w.data.player,{x,z,angle,pitch,light});Object.assign(w.data.hunter,{x:23.5,z:48.5,state:'patrol'});renderer.resize(false);renderer.draw(w);}
draw();
const api={
  draw,
  resize(high=false){renderer.resize(high);},
  inspect(){const materials=[...new Set(internals.view.scene.meshes.flatMap(mesh=>mesh.material?[mesh.material]:[]))];return{webgl:internals.engine.webGLVersion,dpr:devicePixelRatio,css:[canvas.clientWidth,canvas.clientHeight],render:[internals.engine.getRenderWidth(),internals.engine.getRenderHeight()],textures:Object.fromEntries(Object.entries(internals.surfaceTextures).map(([kind,t])=>[kind,{base:t.getBaseSize(),gpu:t.getSize(),url:t.url}])),materials:materials.filter(m=>m.getActiveTextures().some(t=>t.name.startsWith('original-surface:'))).map(m=>({name:m.name,textures:m.getActiveTextures().filter(t=>t.name.startsWith('original-surface:')).map(t=>t.name)}))};},
  async originalTexels(){const results:Record<string,unknown>={};for(const[kind,texture]of Object.entries(internals.surfaceTextures)){const image=images[kind as keyof SurfaceImages],c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const expected=ctx.getImageData(0,0,c.width,c.height).data,read=await texture.readPixels(),actual=new Uint8Array(read!.buffer,read!.byteOffset,read!.byteLength);let direct=0,flipped=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width*4;x++){direct+=Number(actual[y*c.width*4+x]!==expected[y*c.width*4+x]);flipped+=Number(actual[y*c.width*4+x]!==expected[(c.height-1-y)*c.width*4+x]);}results[kind]={width:c.width,height:c.height,mismatchedChannels:Math.min(direct,flipped)};}return results;},
  dispose(){renderer.dispose();},
};
(window as unknown as {materialQA:typeof api}).materialQA=api;
