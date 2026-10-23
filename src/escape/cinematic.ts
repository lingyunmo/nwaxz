import "./cinematic.css";

export const openingClip = "/assets/video/escape-opening-v1.mp4";
export const caughtClips = [1, 2, 3].map(n => `/assets/video/escape-caught-${n}-v1.mp4`);
export const randomCaughtClip = () => caughtClips[Math.floor(Math.random() * caughtClips.length)];

/** Full-file requests warm the range-aware runtime cache without delaying the menu. */
export function warmCinematics(signal: AbortSignal) {
  if (!navigator.onLine || !navigator.serviceWorker?.controller) return;
  void (async () => {
    for (const path of [openingClip, ...caughtClips]) {
      if (signal.aborted || !navigator.onLine) return;
      try { const response = await fetch(path, { signal }); if (!response.ok) return; await response.arrayBuffer(); } catch { return; /* Stop prefetching when the network disappears. */ }
    }
  })();
}

export class CinematicPlayer {
  readonly done: Promise<void>;
  private finish!: () => void;
  private controller = new AbortController();
  private element: HTMLDivElement;
  private video: HTMLVideoElement;
  private closed = false;
  private timeout = 0;
  constructor(root: HTMLElement, path: string, sound: boolean) {
    this.done = new Promise(resolve => { this.finish = resolve; });
    this.element = document.createElement("div");
    this.element.className = "escape-cinematic";
    this.element.setAttribute("role", "dialog"); this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", path === openingClip ? "开场影片" : "被抓影片");
    this.element.innerHTML = `<video playsinline webkit-playsinline preload="auto" aria-label="过场动画"></video><p class="cinematic-status" role="status">载入中…</p><div class="cinematic-controls"><button id="cinematic-play">播放</button><button id="cinematic-sound"></button><button id="cinematic-skip">跳过</button></div>`;
    this.video = this.element.querySelector("video")!;
    this.video.muted = !sound; this.video.src = path;
    const signal = this.controller.signal, play = this.button("cinematic-play"), mute = this.button("cinematic-sound");
    const status = this.element.querySelector<HTMLElement>(".cinematic-status")!;
    const sync = () => { play.textContent = this.video.paused ? "播放" : "暂停"; mute.textContent = this.video.muted ? "开启声音" : "静音"; mute.setAttribute("aria-pressed", String(!this.video.muted)); };
    const attempt = () => { if (document.hidden || this.closed) return; void this.video.play().catch(() => { if (!this.closed) { status.textContent = "点击播放"; sync(); } }); };
    play.onclick = () => this.video.paused ? attempt() : this.video.pause();
    mute.onclick = () => { this.video.muted = !this.video.muted; sync(); if (this.video.paused) attempt(); };
    this.button("cinematic-skip").onclick = () => this.close();
    this.video.addEventListener("ended", () => this.close(), { signal });
    this.video.addEventListener("error", () => this.close(), { signal });
    this.video.addEventListener("playing", () => { clearTimeout(this.timeout); status.textContent = ""; sync(); }, { signal });
    this.video.addEventListener("pause", sync, { signal });
    this.video.addEventListener("waiting", () => { status.textContent = "载入中…"; this.armTimeout(); }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.video.pause(); }, { signal });
    window.addEventListener("blur", () => this.video.pause(), { signal });
    document.addEventListener("keydown", e => {
      e.stopImmediatePropagation();
      if (e.key === "Escape" || e.key === " ") { e.preventDefault(); play.click(); }
      if (e.key === "Tab") {
        e.preventDefault(); const buttons = [...this.element.querySelectorAll("button")], at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
    }, { capture: true, signal });
    root.append(this.element); sync(); play.focus({ preventScroll: true }); this.armTimeout(); attempt();
  }
  private button(id: string) { return this.element.querySelector<HTMLButtonElement>(`#${id}`)!; }
  private armTimeout() { clearTimeout(this.timeout); this.timeout = window.setTimeout(() => { if (!document.hidden && this.video.readyState < 3) this.close(); }, 15000); }
  close() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.timeout); this.controller.abort(); this.video.pause();
    this.video.removeAttribute("src"); this.video.load(); this.element.remove(); this.finish();
  }
}
