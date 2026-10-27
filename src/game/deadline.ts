export const CAPTURE_MS = 1800;
/** Advance only with active (unpaused, visible) game time. */
export class BathDeadline {
  phase: "running" | "catching" | "caught" | "safe" = "running";
  elapsedMs = 0;
  captureMs = 0;
  readonly limitMs: number;
  constructor(limitMs: number) { if(!Number.isFinite(limitMs)||limitMs<=0)throw new Error("限时关卡时长无效"); this.limitMs=limitMs; }
  get remainingMs() { return Math.max(0,this.limitMs-this.elapsedMs); }
  get captureProgress() { return Math.min(1,this.captureMs/CAPTURE_MS); }
  advance(ms: number) {
    if(!Number.isFinite(ms)||ms<0)return;
    if(this.phase==="running") {this.elapsedMs=Math.min(this.limitMs,this.elapsedMs+ms);if(this.remainingMs===0)this.phase="catching";}
    else if(this.phase==="catching"){this.captureMs=Math.min(CAPTURE_MS,this.captureMs+ms);if(this.captureMs===CAPTURE_MS)this.phase="caught";}
  }
  finish() { if(this.phase==="running")this.phase="safe"; }
}
