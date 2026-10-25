import type {EscapeWorld,EscapeInput,Vec} from './world.ts';
type Step={end:number;dt:number;input:EscapeInput;angle:number};
/** Render-rate prediction with bounded replay and a decaying visual correction. */
export class CoopMovement {
 private point?:Vec;private error={x:0,z:0};private steps:Step[]=[];private identity='';private hidden?:string;
 reset(){this.point=undefined;this.error={x:0,z:0};this.steps=[];this.identity='';this.hidden=undefined;}
 accept(world:EscapeWorld,now:number,latency:number,identity:string){
  const auth=world.data.player;
  if(!this.point||identity!==this.identity||this.hidden!==world.data.hidden||Math.hypot(this.point.x-auth.x,this.point.z-auth.z)>2){this.point={x:auth.x,z:auth.z};this.error={x:0,z:0};this.steps=[];this.identity=identity;this.hidden=world.data.hidden;return;}
  const previous={x:this.point.x+this.error.x,z:this.point.z+this.error.z};
  let target:Vec={x:auth.x,z:auth.z};
  const since=now-Math.min(300,Math.max(0,latency)/2+25);
  for(const step of this.steps){const seconds=Math.min(step.dt,Math.max(0,(step.end-since)/1000));if(seconds>0)target=world.predictMovement(target,seconds,step.input,step.angle);}
  this.point=target;this.error={x:previous.x-target.x,z:previous.z-target.z};
 }
 advance(world:EscapeWorld,dt:number,input:EscapeInput,now:number,identity:string){
  if(!this.point||identity!==this.identity)this.accept(world,now,0,identity);
  this.point=world.predictMovement(this.point!,dt,input);
  this.steps.push({end:now,dt,input:{...input},angle:world.data.player.angle});this.steps=this.steps.filter(step=>step.end>now-500);
  const decay=Math.exp(-dt*14);this.error.x*=decay;this.error.z*=decay;
  return{x:this.point.x+this.error.x,z:this.point.z+this.error.z};
 }
}
