// Reference player uses only movement/look, crouching, rest, interactions and collected crystals.
// Enemy state is the public chase signal; no AI suppression, inventory injection or teleporting.
import {EscapeWorld,PROPS,DOORS,CRYSTALS} from '../src/escape/world.ts';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const face=(w,p)=>{w.data.player.angle=Math.atan2(p.z-w.data.player.z,p.x-w.data.player.x);};
export function playEscapeRoute(w,expanded=true,trace=false){
 const seed=w.data.hunt.rng;
 w.toggleLight();w.data.player.crouched=true;
 const step=1/30,log=[];
 const advance=(input={})=>{w.advance(step,input);};
 const defend=()=>{
  const risk=w.perception.total,distance=w.hearing.distance;
  if((w.data.hunter.state==='chase'||risk>=70||distance<2)&&w.data.hunt.freeze<=0&&w.crystalCharges('freeze')>0)w.useCrystal('freeze');
 };
 const pickup=()=>{
  for(const crystal of CRYSTALS)if(!w.data.hunt.collected.includes(crystal.id)&&distance(w.data.player,crystal)<1.65){
   face(w,crystal);if(w.nearest()?.id===crystal.id)w.interact();
  }
 };
 const rest=()=>{
  if(w.data.hunt.effort<65||w.data.hunter.state==='chase'||w.data.hunt.freeze>0||w.data.hunt.alert>0)return;
  for(let n=0;n<150&&w.data.hunt.effort>20&&w.data.phase==='playing';n++){
   advance();defend();if(w.data.hunter.state==='chase')break;
  }
 };
 function travel(target){
  for(let n=0;n<18000&&distance(w.data.player,target)>.09;n++){
   if(w.data.phase!=='playing')return false;
   defend();pickup();rest();
   const path=w.route(w.data.player,target);
   const next=path.find(p=>distance(w.data.player,p)>.09)??target;
   face(w,next);
   const sprint=(w.data.hunter.state==='chase'||w.data.hunt.freeze>0)&&w.data.player.stamina>5;
   w.data.player.crouched=!sprint;
   const speed=sprint?3:.95;
   advance({forward:Math.min(1,distance(w.data.player,next)/speed/step),sprint});
  }
  return distance(w.data.player,target)<=.1;
 }
 const approach=point=>{
  const options=[[0,1],[0,-1],[1,0],[-1,0]].map(([x,z])=>({x:point.x+x,z:point.z+z})).filter(p=>!w.wall(p.x,p.z));
  const paths=options.map(target=>({target,path:w.route(w.data.player,target)})).filter(r=>r.path.length||distance(w.data.player,r.target)<1).sort((a,b)=>a.path.length-b.path.length);
  if(!paths.length)throw Error('no path '+JSON.stringify(point));
  const ok=travel(paths[0].target);face(w,point);return ok;
 };
 const hide=()=>{
  if(w.data.hunter.state==='chase'&&w.seesPlayer())return;
  const choices=PROPS.filter(p=>p.kind==='wardrobe').flatMap(p=>[[-.9,.8],[.9,.8],[0,1]].map(([dx,dz])=>({p,target:{x:p.x+dx,z:p.z+dz}})))
   .map(o=>({...o,path:w.route(w.data.player,o.target)})).filter(o=>o.path.length&&o.path.length<5).sort((a,b)=>a.path.length-b.path.length);
  for(const o of choices.slice(0,1))if(travel(o.target)){
   face(w,o.p);if(w.nearest()?.id===o.p.id&&!w.seesPlayer())w.interact();
   if(w.data.hidden){
    for(let n=0;n<600&&w.data.phase==='playing';n++){advance();if(n>240&&w.data.hunter.state==='patrol'&&w.data.hunt.effort<20)break;}
    if(w.data.phase==='playing')w.interact();
   }
  }
 };
 const order=['bed-drawer','study','study-drawer','laundry-drawer','power','cellar','cellar-drawer',...(expanded?['changing','changing-drawer','boiler','boiler-note','valve-cold','valve-return','valve-vent']:[]),'drain','exit'];
 for(const id of order){
  let done=false;
  for(let tries=0;tries<3&&!done;tries++){
   if(w.data.phase==='caught')w.nextNight();if(w.data.phase!=='playing')break;
   const object=PROPS.find(p=>p.id===id),door=DOORS.find(p=>p.id===id),point=object??{x:door.x+.5,z:door.z+.5};
   if(!approach(point))continue;
   if(w.nearest()?.id!==id){pickup();face(w,point);}
   if(w.nearest()?.id!==id)throw Error('bad target '+id+' '+w.nearest()?.id);
   w.interact();
   for(let n=0;n<40&&w.pending&&w.data.phase==='playing';n++){defend();advance();}
   done=w.data.phase==='playing'||w.data.phase==='won';
  }
  EscapeWorld.restore(w.snapshot());
  const entry={id,t:+w.data.elapsed.toFixed(1),phase:w.data.phase,captures:w.data.captures,effort:+w.data.hunt.effort.toFixed(0),crystal:w.crystalCharges('freeze')};log.push(entry);if(trace)console.log(entry);
  if(!done)break;
  if(w.data.phase==='playing'&&['bed-drawer','study-drawer','power','changing-drawer'].includes(id))hide();
 }
 return {seed,expanded,phase:w.data.phase,time:w.data.elapsed,captures:w.data.captures,log,world:w};
}
