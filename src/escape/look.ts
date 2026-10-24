export type MouseLookMode = "click" | "locked" | "free";
type LookHooks = { active: () => boolean; rotate: (x: number, y: number) => void; unlocked: () => void; mode: (mode: MouseLookMode) => void };

/** Mouse lock uses relative motion; touch remains a separate captured gesture. */
export class EscapeLook {
  private controller = new AbortController();
  private disposed = false;
  private pending = false;
  private locked = false;
  private fallback = false;
  private touch?: { id: number; x: number; y: number };
  private hover?: { x: number; y: number };
  constructor(private canvas: HTMLCanvasElement, private hooks: LookHooks, owner: AbortSignal) {
    const options = { signal: this.controller.signal };
    owner.addEventListener("abort", () => this.dispose(), { once: true, ...options });
    canvas.addEventListener("pointerdown", e => {
      if (!hooks.active()) return;
      e.preventDefault(); canvas.focus({ preventScroll: true });
      if (e.pointerType === "mouse") { this.hover = { x: e.clientX, y: e.clientY }; this.capture(true); return; }
      canvas.setPointerCapture(e.pointerId); this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }, options);
    canvas.addEventListener("pointermove", e => {
      if (!hooks.active()) return;
      if (e.pointerType === "mouse") {
        if (!this.fallback || document.pointerLockElement === canvas) return;
        if (this.hover) hooks.rotate(e.clientX - this.hover.x, e.clientY - this.hover.y);
        this.hover = { x: e.clientX, y: e.clientY }; return;
      }
      if (!this.touch || this.touch.id !== e.pointerId) return;
      hooks.rotate(e.clientX - this.touch.x, e.clientY - this.touch.y);
      this.touch.x = e.clientX; this.touch.y = e.clientY;
    }, options);
    canvas.addEventListener("pointerleave", () => { this.hover = undefined; }, options);
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, () => { this.touch = undefined; }, options);
    document.addEventListener("mousemove", e => {
      if (document.pointerLockElement === canvas && hooks.active()) hooks.rotate(e.movementX, e.movementY);
    }, options);
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        this.pending = false;
        if (!hooks.active()) { this.suspend(); return; }
        this.locked = true; this.fallback = false; this.hover = undefined; this.publish();
      } else if (this.locked) {
        this.locked = false; this.fallback = false; this.publish(); hooks.unlocked();
      }
    }, options);
    document.addEventListener("pointerlockerror", () => { if (this.pending) this.denied(); }, options);
    this.publish();
  }
  capture(mouseGesture = false) {
    if (this.disposed || !this.hooks.active() || this.pending || document.pointerLockElement === this.canvas) return;
    if (!mouseGesture && (!matchMedia("(pointer:fine)").matches || navigator.userActivation?.isActive === false)) { this.publish(); return; }
    if (typeof this.canvas.requestPointerLock !== "function") { this.denied(); return; }
    this.pending = true;
    try {
      const task = this.canvas.requestPointerLock();
      if (task && typeof task.then === "function") void task.then(() => {
        if (this.disposed || !this.hooks.active()) this.suspend();
      }).catch(() => this.denied());
    } catch { this.denied(); }
  }
  clear() { this.touch = undefined; this.hover = undefined; }
  suspend() {
    this.locked = false; this.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.publish();
  }
  private denied() {
    this.pending = false;
    if (this.disposed) return;
    this.fallback = true; this.clear(); this.publish();
  }
  private publish() { if (!this.disposed) this.hooks.mode(this.locked ? "locked" : this.fallback ? "free" : "click"); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.suspend(); this.controller.abort();
    if (this.pending) {
      // Older implementations return void: guard a grant arriving after exit.
      const guard = () => { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); cleanup(); };
      const cleanup = () => { clearTimeout(timer); document.removeEventListener("pointerlockchange", guard); document.removeEventListener("pointerlockerror", cleanup); };
      const timer = setTimeout(cleanup, 5000);
      document.addEventListener("pointerlockchange", guard);
      document.addEventListener("pointerlockerror", cleanup);
    }
  }
}
