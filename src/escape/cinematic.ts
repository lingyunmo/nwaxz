import "./cinematic.css";

export const openingClips = ["/assets/video/escape-opening-v1.mp4", "/assets/video/escape-opening-2-v1.mp4"];
export const randomOpeningClip = () => openingClips[Math.floor(Math.random() * openingClips.length)];
export const caughtClips = [1, 2, 3].map(n => `/assets/video/escape-caught-${n}-v1.mp4`);
export const randomCaughtClip = () => caughtClips[Math.floor(Math.random() * caughtClips.length)];

/** Wall-clock playback position when a browser suspends media in a hidden tab. */
export function cinematicTimeAt(startTime: number, startedAt: number, now: number, rate = 1) {
  return startTime + Math.max(0, now - startedAt) / 1000 * rate;
}

export class CinematicPlayer {
  readonly done: Promise<void>;
  private finish!: () => void;
  private controller = new AbortController();
  private element: HTMLDivElement;
  private video: HTMLVideoElement;
  private closed = false;
  private timeout = 0;
  private userPaused = false;
  private timelineStartAt = 0;
  private timelineStartTime = 0;
  private timelineRunning = false;
  constructor(root: HTMLElement, path: string, sound: boolean) {
    this.done = new Promise(resolve => { this.finish = resolve; });
    this.element = document.createElement("div");
    this.element.className = "escape-cinematic";
    this.element.setAttribute("role", "dialog"); this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", openingClips.includes(path) ? "开场影片" : "被抓影片");
    this.element.innerHTML = `<video playsinline webkit-playsinline preload="auto" aria-label="过场动画"></video><p class="cinematic-status" role="status">载入中…</p><div class="cinematic-controls"><button id="cinematic-play">播放</button><button id="cinematic-sound"></button><button id="cinematic-skip">跳过</button></div>`;
    this.video = this.element.querySelector("video")!;
    this.video.muted = !sound; this.video.src = path;
    const signal = this.controller.signal, play = this.button("cinematic-play"), mute = this.button("cinematic-sound");
    const status = this.element.querySelector<HTMLElement>(".cinematic-status")!;
    const sync = () => { play.textContent = this.video.paused ? "播放" : "暂停"; mute.textContent = this.video.muted ? "开启声音" : "静音"; mute.setAttribute("aria-pressed", String(!this.video.muted)); };
    const resetTimeline = () => {
      this.timelineStartAt = Date.now(); this.timelineStartTime = this.video.currentTime; this.timelineRunning = true;
    };
    const catchUpTimeline = () => {
      if (!this.timelineRunning || this.userPaused || this.closed) return;
      const expected = cinematicTimeAt(this.timelineStartTime, this.timelineStartAt, Date.now(), this.video.playbackRate);
      const duration = this.video.duration;
      if (Number.isFinite(duration) && duration > 0 && expected >= duration) { this.close(); return; }
      if (Number.isFinite(expected) && this.video.currentTime < expected) {
        try { this.video.currentTime = expected; } catch { /* Metadata may not permit seeking yet. */ }
      }
    };
    const attempt = () => {
      if (document.hidden || this.closed || this.userPaused) return;
      void this.video.play().catch(() => { if (!this.closed) { status.textContent = "点击播放"; sync(); } });
    };
    play.onclick = () => {
      if (this.video.paused) { this.userPaused = false; this.timelineRunning = false; attempt(); }
      else { catchUpTimeline(); if (this.closed) return; this.userPaused = true; this.timelineRunning = false; this.video.pause(); }
    };
    mute.onclick = () => { this.video.muted = !this.video.muted; sync(); if (this.video.paused) attempt(); };
    this.button("cinematic-skip").onclick = () => this.close();
    this.video.addEventListener("ended", () => this.close(), { signal });
    this.video.addEventListener("error", () => this.close(), { signal });
    this.video.addEventListener("playing", () => { if (!this.timelineRunning) resetTimeline(); clearTimeout(this.timeout); status.textContent = ""; sync(); }, { signal });
    this.video.addEventListener("pause", sync, { signal });
    this.video.addEventListener("waiting", () => { status.textContent = "载入中…"; this.armTimeout(); }, { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || this.userPaused || this.closed) return;
      catchUpTimeline();
      if (!this.closed) attempt();
    }, { signal });
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
