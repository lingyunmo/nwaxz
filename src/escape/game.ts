import "./style.css";
import "./hud.css";
import { icon } from "./icons.ts";
import { SaveWriteError, writeSaveBatch } from "./save.ts";
import { AudioManager } from "../audio.ts";
import type { Settings } from "../settings.ts";
import { EscapeWorld, ITEM_NAMES, type EscapeSnapshot } from "./world.ts";
import { EscapeRenderer, type EscapeArt } from "./renderer.ts";

const SESSION = "nwaxz-escape-session-v1", RECORD = "nwaxz-escape-record-v1", SOUND = "nwaxz-escape-sound-v1";
type Best = { version: 1; escapes: number; bestTimeMs: number; fewestCaptures: number; mostNotes: number };
const time = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const safe = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function readBest(raw: unknown): Best | undefined {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Best;
  if (r.version !== 1 || !Number.isInteger(r.escapes) || r.escapes < 1 || r.escapes > 1e9 || !Number.isInteger(r.bestTimeMs) || r.bestTimeMs < 0 || r.bestTimeMs > 86400_000 || !Number.isInteger(r.fewestCaptures) || r.fewestCaptures < 0 || r.fewestCaptures > 2 || !Number.isInteger(r.mostNotes) || r.mostNotes < 0 || r.mostNotes > 3) return;
  return { version: 1, escapes: r.escapes, bestTimeMs: r.bestTimeMs, fewestCaptures: r.fewestCaptures, mostNotes: r.mostNotes };
}
export class EscapeGame {
  world = new EscapeWorld();
  private renderer?: EscapeRenderer;
  private art?: EscapeArt;
  private controller = new AbortController();
  private raf = 0;
  private lastFrame = 0;
  private paused = true;
  private started = false;
  private disposed = false;
  private saved?: EscapeSnapshot;
  private record?: Best;
  private storageWarning = "";
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private sprinting = false;
  private look?: { id: number; x: number; y: number };
  private saveAt = 0;
  private hudAt = 0;
  private heartbeatAt = 0;
  private lastNotice = "";
  private noticeUntil = 0;
  private inventoryKey = "";
  private phase = "playing";
  private music = true;
  private sound = true;
  private readonly signal = this.controller.signal;
  constructor(private root: HTMLElement, private audio: AudioManager, private settings: Settings, private exit: () => void) {
    try {
      const session = localStorage.getItem(SESSION);
      if (session) this.saved = EscapeWorld.restore(JSON.parse(session)).snapshot();
      const record = localStorage.getItem(RECORD); if (record) this.record = readBest(JSON.parse(record));
      const sound = JSON.parse(localStorage.getItem(SOUND) ?? "null");
      if (sound && typeof sound.music === "boolean" && typeof sound.sound === "boolean") { this.music = sound.music; this.sound = sound.sound; }
      else this.sound = settings.sound;
    } catch { this.storageWarning = "存档读取失败，可从备份恢复。"; }
    this.root.innerHTML = `<main class="escape-shell" aria-label="极限恐怖逃生"><canvas id="escape-view" tabindex="0" aria-label="3D第一人称逃生。WASD移动，拖动上下左右转头，方向键转身，PageUp和PageDown抬头低头，Shift奔跑，C蹲行，F手电，E交互，Q丢石子，Esc暂停。"></canvas>
      <header class="escape-hud"><button id="escape-pause" class="escape-round" aria-label="暂停逃生">${icon("pause")}</button><div class="escape-location"><span id="escape-room">地下浴场</span><span id="escape-night">第1夜 · 00:00</span><div id="escape-lives" aria-label="剩余机会"></div></div></header>
      <button id="escape-map" class="escape-map-button" aria-label="查看地图"><canvas id="escape-minimap" width="208" height="208" aria-hidden="true"></canvas><span>浴场地图 <kbd>M</kbd></span></button>
      <div class="escape-crosshair" aria-hidden="true"></div><div class="escape-danger" id="escape-danger" role="status"></div><div class="escape-notice" id="escape-notice" role="status" aria-live="polite" hidden></div>
      <div class="escape-search" id="escape-search" hidden><span>搜索中</span><progress max="1.15" value="0" aria-label="搜索进度"></progress></div>
      <div class="escape-bottom"><div class="escape-meters"><label title="体力">${icon("run")}<meter id="escape-stamina" aria-label="体力" min="0" max="100" value="100"></meter></label><label title="手电电量">${icon("light")}<meter id="escape-battery" aria-label="手电电量" min="0" max="100" value="100"></meter></label></div>
      <div class="escape-inventory" id="escape-inventory" aria-label="随身物品"></div>
      <div class="escape-controls"><div class="escape-stick" id="escape-stick" aria-label="移动摇杆"><span></span></div><div class="escape-actions"><button id="escape-light" aria-label="开关手电" title="手电 F">${icon("light")}<kbd>F</kbd></button><button id="escape-crouch" aria-label="切换蹲行" title="蹲行 C">${icon("crouch")}<kbd>C</kbd></button><button id="escape-stone" aria-label="丢石子" title="石子 Q">${icon("stone")}<b id="escape-stones">2</b><kbd>Q</kbd></button><button id="escape-sprint" aria-label="按住奔跑" title="奔跑 Shift">${icon("run")}<kbd>⇧</kbd></button></div></div>
      <button class="escape-interact" id="escape-interact" hidden>${icon("hand")}<span></span><kbd>E</kbd></button></div>
      <div id="escape-panel" class="escape-panel" role="dialog" aria-modal="true" aria-label="逃生菜单"></div><input id="escape-import" type="file" accept=".json,application/json" hidden></main>`;
    this.bind(); this.intro();
    this.raf = requestAnimationFrame(this.frame);
  }
  private $<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private button(id: string, fn: () => void) { this.$(`#${id}`).addEventListener("click", fn, { signal: this.signal }); }
  private panel(html: string) {
    this.$(".escape-shell").classList.remove("intro-active");
    this.$(".escape-shell").classList.remove("capture-active");
    this.$("#escape-panel").classList.remove("escape-intro", "escape-pause-panel");
    this.$(".escape-shell").classList.add("menu-active");
    this.$("#escape-panel").hidden = false;
    this.$("#escape-panel").innerHTML = `<section class="escape-card">${html}</section>`;
    this.$("#escape-panel").querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }
  private intro() {
    this.paused = true; this.audio.setPlaying(false);
    const canResume = this.saved && ["playing", "caught"].includes(this.saved.phase);
    this.panel(`<p class="escape-eyebrow">极限恐怖</p><h1>奶蛙<br><em>下水道逃生</em></h1><p>找到出口。躲开奶蛙。</p><p class="escape-story">找齐钥匙和工具，逃进下水道。</p>
      <div class="escape-intro-controls"><span>WASD 移动 · 拖动上下左右转头</span><span>E 交互 · Shift 奔跑 · C 蹲行</span><span>手机：左摇杆移动，右侧滑动看四周</span></div>
      <label class="escape-check"><input id="escape-intro-music" type="checkbox" ${this.music ? "checked" : ""}>音乐</label>
      ${canResume ? '<button id="escape-continue" class="escape-primary">继续逃生</button>' : ""}<button id="escape-new" class="${canResume ? "escape-secondary" : "escape-primary"}">${canResume ? "重新开始" : "进入浴场"}</button>
      <div class="escape-links"><button id="escape-intro-help">操作</button><button id="escape-intro-saves">存档</button><button id="escape-intro-exit">返回首页</button></div>
      ${this.record ? `<p class="escape-record">逃出 ${this.record.escapes} 次 · 最佳 ${time(this.record.bestTimeMs / 1000)}</p>` : ""}<p class="escape-storage">${safe(this.storageWarning)}</p>`);
    this.$(".escape-shell").classList.add("intro-active"); this.$("#escape-panel").classList.add("escape-intro");
    const music = () => { this.music = this.$<HTMLInputElement>("#escape-intro-music").checked; this.saveSound(); };
    if (canResume) this.button("escape-continue", () => { music(); void this.start(true); });
    this.button("escape-new", () => { music(); if (canResume) this.confirmRestart(); else void this.start(false); });
    this.button("escape-intro-exit", this.exit);
    this.button("escape-intro-help", () => this.help(false));
    this.button("escape-intro-saves", () => this.saveMenu());
  }
  private saveMenu() {
    this.panel(`<p class="escape-eyebrow">下水道逃生</p><h2>存档管理</h2><p>${this.saved ? "已有逃生进度" : "暂无逃生进度"}</p><button id="escape-save-export" class="escape-primary" ${!this.saved ? "disabled" : ""}>备份存档</button><button id="escape-intro-import" class="escape-secondary">恢复存档</button><button id="escape-saves-back" class="escape-secondary">返回</button>`);
    this.button("escape-save-export", () => this.exportSave());
    this.button("escape-intro-import", () => this.$<HTMLInputElement>("#escape-import").click());
    this.button("escape-saves-back", () => this.intro());
  }
  private async loadArt() {
    const paths = { materials: "/assets/scenes/escape-materials-v1.webp", map: "/assets/ui/escape-map-atlas-v1.webp" };
    return Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => { const img = new Image(); img.src = path; await img.decode(); return [key, img]; }))) as EscapeArt;
  }
  private async start(resume: boolean) {
    this.save(); this.started = false; this.paused = true;
    this.renderer?.dispose(); this.renderer = undefined;
    this.audio.setMode("escape"); this.applySound(); void this.audio.unlock();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    this.panel('<p class="escape-eyebrow">下水道逃生</p><h2>正在载入…</h2>');
    try {
      this.art ??= await this.loadArt();
      if (this.disposed) return;
      this.world = resume && this.saved ? EscapeWorld.restore(this.saved) : new EscapeWorld();
      this.renderer = new EscapeRenderer(this.$("#escape-view"), this.art, this.settings.reducedMotion);
      await this.renderer.load();
      if (this.disposed) return;
      this.renderer.resize(this.settings.quality === "high"); this.started = true; this.phase = this.world.data.phase;
      this.saveAt = this.world.data.elapsed; this.save();
      if (this.world.data.phase === "caught") this.result(); else this.resume();
    } catch {
      this.renderer?.dispose(); this.renderer = undefined;
      this.panel('<h2>场景载入失败</h2><p>请检查网络，或换用支持 WebGL 的浏览器。进度已保留。</p><button id="escape-load-back" class="escape-primary">返回菜单</button>');
      this.button("escape-load-back", () => this.intro());
    }
  }
  private applySound() { this.audio.setSettings({ ...this.settings, music: this.music, sound: this.sound }); }
  private saveSound() { try { localStorage.setItem(SOUND, JSON.stringify({ music: this.music, sound: this.sound })); } catch { /* Audio still works without storage. */ } this.applySound(); }
  private resume() {
    this.$(".escape-shell").classList.remove("capture-active");
    this.$("#escape-view").setAttribute("aria-label", "3D第一人称逃生。WASD移动，拖动画面上下左右转头，E交互，PageUp和PageDown抬头低头，Esc暂停。");
    this.$("#escape-panel").hidden = true; this.$(".escape-shell").classList.remove("menu-active"); this.updateHud(); this.paused = false; this.lastFrame = 0; this.clearInput();
    this.$("#escape-view").focus({ preventScroll: true }); this.audio.setPlaying(true); void this.audio.unlock();
  }
  private clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.look = undefined; this.sprinting = false; this.$("#escape-stick span").style.transform = "translate(0,0)"; }
  private pause(map = false) {
    if (!this.started || this.world.data.phase !== "playing") return;
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    this.panel(`<div class="escape-pause-layout"><div class="escape-map-page"><p class="escape-eyebrow">地下浴场</p><h2>浴场地图</h2><canvas id="escape-floorplan" width="500" height="500" aria-label="浴场地图，箭头是你，暗处尚未探索"></canvas><p class="escape-map-legend"><i class="map-you"></i>你 <i class="map-door"></i>门 <i class="map-hide"></i>衣柜 <i class="map-fog"></i>未探索</p></div>
      <div class="escape-pause-menu"><p class="escape-eyebrow">已暂停</p><h2>暂停</h2><div class="escape-journal"><small>线索</small><p id="escape-goal">${safe(this.world.objective)}</p></div><button id="escape-resume" class="escape-primary">继续逃生</button>
      <div class="escape-setting-row"><label><input id="escape-music" type="checkbox" ${this.music ? "checked" : ""}>音乐</label><label><input id="escape-sound" type="checkbox" ${this.sound ? "checked" : ""}>音效</label><button id="escape-audio-recover">恢复声音</button></div>
      <div class="escape-links"><button id="escape-backup">备份存档</button><button id="escape-help">操作说明</button><button id="escape-restart">重新开始</button><button id="escape-exit">保存并退出</button></div><p class="escape-storage" id="escape-save-status">${this.storageWarning || "进度已保存"}</p></div></div>`);
    this.$("#escape-panel").classList.add("escape-pause-panel");
    this.renderer?.drawMap(this.$("#escape-floorplan"), this.world);
    if (map) this.$("#escape-resume").focus();
    this.button("escape-resume", () => this.resume()); this.button("escape-help", () => this.help(true)); this.button("escape-restart", () => this.confirmRestart());
    this.button("escape-exit", () => { this.save(); this.exit(); }); this.button("escape-backup", () => this.exportSave());
    this.$<HTMLInputElement>("#escape-music").onchange = e => { this.music = (e.target as HTMLInputElement).checked; this.saveSound(); if (this.music) void this.audio.preview("music"); };
    this.$<HTMLInputElement>("#escape-sound").onchange = e => { this.sound = (e.target as HTMLInputElement).checked; this.saveSound(); };
    this.button("escape-audio-recover", () => { void this.audio.recover().then(ok => { const el = this.root.querySelector("#escape-save-status"); if (el) el.textContent = ok ? "音效试听中" : "声音未开启，请重试。"; }); });
  }
  private help(fromPause: boolean) {
    const touch = matchMedia("(pointer:coarse)").matches;
    const controls = touch ? [["移动", "左侧摇杆"], ["观察", "滑动右侧画面"], ["互动", "靠近目标后点击手掌"], ["奔跑", "按住奔跑按钮"]] : [["移动", "WASD / 方向键"], ["观察", "拖动画面 / PageUp、PageDown"], ["互动", "E / 空格"], ["奔跑", "Shift"], ["蹲行 / 手电", "C / F"], ["石子 / 地图", "Q / M"]];
    this.panel(`<h2>操作</h2><dl class="escape-bindings">${controls.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl><ul class="escape-help"><li>找齐钥匙和工具，打开下水道铁网。</li><li>奔跑会发出声音，石子可以引开奶蛙。</li><li>先甩掉它的视线，再躲进衣柜。</li><li>被抓后进入下一夜，物品保留。第三次被抓则失败。</li></ul><button id="escape-help-close" class="escape-primary">返回</button>`);
    this.button("escape-help-close", () => fromPause ? this.pause() : this.intro());
  }
  private confirmRestart() {
    this.paused = true; this.audio.setPlaying(false);
    this.panel('<h2>重新进入浴场？</h2><p>重置当前逃生进度，保留最佳纪录。</p><button id="escape-confirm-restart" class="escape-primary">重新开始</button><button id="escape-cancel-restart" class="escape-secondary">继续游戏</button>');
    this.button("escape-confirm-restart", () => void this.start(false)); this.button("escape-cancel-restart", () => this.started ? this.pause() : this.intro());
  }
  private result() {
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    const d = this.world.data;
    if (d.phase === "won") {
      this.panel(`<p class="escape-eyebrow">下水道逃生</p><h1>逃生成功</h1><div class="escape-result-stats"><span>用时<strong>${time(d.elapsed)}</strong></span><span>被抓<strong>${d.captures} / 3</strong></span><span>纸条<strong>${d.notes.length} / 3</strong></span></div><p class="escape-record">最佳 ${time((this.record?.bestTimeMs ?? d.elapsed * 1000) / 1000)}</p><button id="escape-again" class="escape-primary">再玩一次</button><button id="escape-result-exit" class="escape-secondary">返回首页</button>`);
      this.button("escape-again", () => void this.start(false)); this.button("escape-result-exit", this.exit);
    } else {
      this.panel(`<p class="escape-eyebrow">${d.phase === "lost" ? "第三次被抓住" : `第 ${d.captures} 次被抓住`}</p><h2>${d.phase === "lost" ? "逃生失败" : "被抓住了"}</h2><p>${d.phase === "lost" ? `坚持了 ${time(d.elapsed)}` : "物品和已打开的锁会保留。"}</p><button id="escape-next" class="escape-primary">${d.phase === "lost" ? "重新开始" : `醒来 · 第 ${d.captures + 1} 夜`}</button><div class="escape-links"><button id="escape-replay-laugh">再听笑声</button><button id="escape-result-exit">保存并退出</button></div>`);
      this.$(".escape-shell").classList.add("capture-active");
      this.$("#escape-view").setAttribute("aria-label", "原画奶蛙正张嘴、双手捧腹大笑；游戏进度已暂停");
      this.button("escape-next", () => { if (d.phase === "lost") void this.start(false); else { this.world.nextNight(); this.phase = "playing"; this.save(); this.resume(); } });
      this.button("escape-result-exit", this.exit);
      this.audio.haunt();
      // One deliberate click can replay the recognisable laugh, without changing settings.
      this.button("escape-replay-laugh", () => void this.audio.preview("sound"));
    }
  }
  private save() {
    if (!this.started) return;
    try { this.saved = this.world.snapshot(); localStorage.setItem(SESSION, JSON.stringify(this.saved)); this.storageWarning = ""; }
    catch { this.storageWarning = "本机无法自动保存，请先备份存档。"; }
  }
  private recordWin() {
    const d = this.world.data, ms = Math.round(d.elapsed * 1000), previous = this.record;
    this.record = { version: 1, escapes: Math.min(1e9, (previous?.escapes ?? 0) + 1), bestTimeMs: Math.min(previous?.bestTimeMs ?? ms, ms), fewestCaptures: Math.min(previous?.fewestCaptures ?? d.captures, d.captures), mostNotes: Math.max(previous?.mostNotes ?? 0, d.notes.length) };
    try { localStorage.setItem(RECORD, JSON.stringify(this.record)); } catch { this.storageWarning = "纪录未能写入，请备份存档。"; }
  }
  private exportSave() {
    const data = this.started ? this.world.snapshot() : this.saved;
    const blob = new Blob([JSON.stringify({ format: "nwaxz-escape", version: 1, session: data, record: this.record }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "nwaxz-escape-save.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private bind() {
    this.button("escape-pause", () => this.pause()); this.button("escape-map", () => this.pause(true));
    this.button("escape-interact", () => { if (!this.paused) this.world.interact(); });
    this.button("escape-light", () => { if (!this.paused) this.world.toggleLight(); });
    this.button("escape-crouch", () => { if (!this.paused) this.world.data.player.crouched = !this.world.data.player.crouched; });
    this.button("escape-stone", () => { if (!this.paused) this.world.throwStone(); });
    const stick = this.$("#escape-stick");
    const moveStick = (e: PointerEvent) => { const r = stick.getBoundingClientRect(), dx = (e.clientX - r.x - r.width / 2) / 42, dy = (e.clientY - r.y - r.height / 2) / 42, norm = Math.max(1, Math.hypot(dx, dy)); this.stick = { x: dx / norm, y: dy / norm }; stick.querySelector<HTMLElement>("span")!.style.transform = `translate(${this.stick.x * 38}px,${this.stick.y * 38}px)`; };
    let stickId: number | undefined;
    stick.addEventListener("pointerdown", e => { if (this.paused) return; e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); }, { signal: this.signal });
    stick.addEventListener("pointermove", e => { if (stickId === e.pointerId) moveStick(e); }, { signal: this.signal });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) stick.addEventListener(event, () => { stickId = undefined; this.stick = { x: 0, y: 0 }; stick.querySelector<HTMLElement>("span")!.style.transform = "translate(0,0)"; }, { signal: this.signal });
    const view = this.$("#escape-view");
    view.addEventListener("pointerdown", e => { if (this.paused) return; e.preventDefault(); view.setPointerCapture(e.pointerId); this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; view.focus({ preventScroll: true }); }, { signal: this.signal });
    view.addEventListener("pointermove", e => { if (!this.look || this.look.id !== e.pointerId || this.paused || this.world.data.hidden) return; this.world.data.player.angle = Math.atan2(Math.sin(this.world.data.player.angle + (e.clientX - this.look.x) * .005), Math.cos(this.world.data.player.angle + (e.clientX - this.look.x) * .005)); this.world.data.player.pitch = Math.max(-1.3, Math.min(1.3, (this.world.data.player.pitch ?? 0) - (e.clientY - this.look.y) * .004)); this.look.x = e.clientX; this.look.y = e.clientY; }, { signal: this.signal });
    view.addEventListener("webglcontextlost", e => { e.preventDefault(); if (this.started && !this.paused) this.pause(); }, { signal: this.signal });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) view.addEventListener(event, () => { this.look = undefined; }, { signal: this.signal });
    const sprint = this.$("#escape-sprint");
    sprint.addEventListener("pointerdown", e => { if (this.paused) return; e.preventDefault(); sprint.setPointerCapture(e.pointerId); this.sprinting = true; }, { signal: this.signal });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) sprint.addEventListener(event, () => { this.sprinting = false; }, { signal: this.signal });
    document.addEventListener("keydown", e => {
      if (this.$("#escape-panel").hidden === false) {
        if (e.key === "Escape" && this.started && this.world.data.phase === "playing") { e.preventDefault(); this.resume(); }
        if (e.key === "Tab") {
          const buttons = [...this.$("#escape-panel").querySelectorAll<HTMLElement>("button,input")], at = buttons.indexOf(document.activeElement as HTMLElement), next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
          e.preventDefault(); buttons[next]?.focus();
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown", "shift", "e", "q", "c", "f", "m", "escape", "tab", " "].includes(key)) e.preventDefault(); else return;
      this.keys.add(key);
      if (e.repeat) return;
      if (["escape", "m", "tab"].includes(key)) this.pause(key !== "escape");
      if (key === "e" || key === " ") this.world.interact();
      if (key === "q") this.world.throwStone();
      if (key === "f") this.world.toggleLight();
      if (key === "c") this.world.data.player.crouched = !this.world.data.player.crouched;
    }, { signal: this.signal });
    document.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()), { signal: this.signal });
    window.addEventListener("blur", () => { this.clearInput(); if (this.started && !this.paused) this.pause(); }, { signal: this.signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden && !this.paused) this.pause(); }, { signal: this.signal });
    document.addEventListener("fullscreenchange", () => { this.renderer?.resize(this.settings.quality === "high"); if (!document.fullscreenElement && !this.paused) this.pause(); }, { signal: this.signal });
    window.addEventListener("resize", () => { this.renderer?.resize(this.settings.quality === "high"); if (this.renderer && this.paused) this.renderer.draw(this.world); }, { signal: this.signal });
    window.addEventListener("pagehide", () => this.save(), { signal: this.signal });
    this.$<HTMLInputElement>("#escape-import").onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      let validated = false;
      try {
        if (file.size > 64000) throw new Error("too large");
        const raw = JSON.parse(await file.text()); if (raw.format !== "nwaxz-escape" || raw.version !== 1) throw new Error("bad format");
        const saved = EscapeWorld.restore(raw.session).snapshot(), record = readBest(raw.record);
        const best: Best | undefined = record ? this.record ? { version: 1, escapes: Math.max(record.escapes, this.record.escapes), bestTimeMs: Math.min(record.bestTimeMs, this.record.bestTimeMs), fewestCaptures: Math.min(record.fewestCaptures, this.record.fewestCaptures), mostNotes: Math.max(record.mostNotes, this.record.mostNotes) } : record : this.record;
        validated = true;
        const entries: [string, string][] = best ? [[RECORD, JSON.stringify(best)], [SESSION, JSON.stringify(saved)]] : [[SESSION, JSON.stringify(saved)]];
        writeSaveBatch(localStorage, entries);
        this.saved = saved; this.record = best;
        this.storageWarning = "存档已导入。"; this.intro();
      } catch (error) {
        this.storageWarning = !validated ? "存档无效，原进度已保留。" : error instanceof SaveWriteError && error.restored ? "写入失败，原存档已保留。请检查存储空间。" : "存档写入失败，请重试或从备份恢复。";
        this.intro();
      }
      finally { (e.target as HTMLInputElement).value = ""; }
    };
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    if (this.started && !this.paused && !document.hidden) {
      const down = (key: string) => this.keys.has(key) ? 1 : 0;
      this.world.advance(dt, { forward: down("w") + down("arrowup") - down("s") - down("arrowdown") - this.stick.y, strafe: down("d") - down("a") + this.stick.x, turn: down("arrowright") - down("arrowleft"), look: down("pageup") - down("pagedown"), sprint: this.keys.has("shift") || this.sprinting });
      this.renderer?.draw(this.world, dt);
      const d = this.world.data;
      for (const event of this.world.drainEvents()) {
        if (event.type === "laugh") this.audio.haunt();
        if (["step", "door", "noise"].includes(event.type)) this.audio.effect(event.type as "step" | "door" | "noise");
        if (event.type === "item") this.audio.effect("coin");
        if (["item", "door", "message"].includes(event.type)) this.save();
      }
      if (d.hunter.state === "chase" && d.elapsed - this.heartbeatAt > .72) { this.heartbeatAt = d.elapsed; this.audio.effect("heartbeat"); }
      if (d.elapsed - this.saveAt > 4) { this.saveAt = d.elapsed; this.save(); }
      if (d.phase !== this.phase) { this.phase = d.phase; if (d.phase === "won") this.recordWin(); this.result(); }
      if (now - this.hudAt > 100) { this.hudAt = now; this.updateHud(); }
    }
    // Capture is a cosmetic animation only. Simulation, battery and saves do
    // not advance while its clearly visible original-art belly laugh loops.
    if (this.started && this.paused && ["caught", "lost"].includes(this.world.data.phase) && !document.hidden && this.$(".escape-shell").classList.contains("capture-active")) this.renderer?.draw(this.world, dt);
    this.raf = requestAnimationFrame(this.frame);
  };
  private updateHud() {
    const d = this.world.data;
    this.$("#escape-room").textContent = this.world.room;
    const items = ["brass", "cellar", "fuse", "cutters"] as const;
    const inventoryKey = d.inventory.join(",") + ":" + d.captures;
    if (inventoryKey !== this.inventoryKey) {
      this.inventoryKey = inventoryKey;
      this.$("#escape-inventory").innerHTML = items.map((item, i) => {
        const owned = d.inventory.includes(item), glyph = item === "cutters" ? "cutters" : item === "fuse" ? "fuse" : "key";
        return `<span class="escape-slot ${owned ? "owned" : ""}" title="${owned ? ITEM_NAMES[item] : "未找到物品"}" aria-label="${owned ? ITEM_NAMES[item] : "空物品栏"}"><small>${i+1}</small>${owned ? icon(glyph) : ""}</span>`;
      }).join("");
      this.$("#escape-lives").innerHTML = [0,1,2].map(i => `<span class="${i < d.captures ? "lost" : ""}">${icon("heart")}</span>`).join("");
      this.$("#escape-lives").setAttribute("aria-label", `剩余${3-d.captures}次机会`);
    }
    if (this.world.message !== this.lastNotice) { this.lastNotice = this.world.message; this.noticeUntil = performance.now() + 5000; this.$("#escape-notice").textContent = this.world.message; }
    this.$("#escape-notice").hidden = performance.now() > this.noticeUntil;
    const danger = d.hidden ? "已藏匿" : d.hunter.state === "chase" ? "被发现了" : Math.hypot(d.hunter.x - d.player.x, d.hunter.z - d.player.z) < 4 ? "脚步正在靠近" : "";
    this.$("#escape-danger").textContent = danger;
    this.$("#escape-danger").hidden = !danger;
    this.$(".escape-shell").classList.toggle("being-chased", d.hunter.state === "chase");
    this.$(".escape-shell").classList.toggle("in-cabinet", !!d.hidden);
    const target = this.world.nearest(), interact = this.$<HTMLButtonElement>("#escape-interact");
    interact.hidden = !target || !!this.world.pending;
    interact.disabled = !target || !!this.world.pending;
    interact.querySelector("span")!.textContent = target?.label ?? "";
    this.$<HTMLMeterElement>("#escape-stamina").value = d.player.stamina;
    this.$<HTMLMeterElement>("#escape-battery").value = d.player.battery;
    this.$("#escape-night").textContent = `第${Math.min(3, d.captures + 1)}夜 · ${time(d.elapsed)}`;
    this.$("#escape-crouch").setAttribute("aria-pressed", String(d.player.crouched));
    this.$("#escape-light").setAttribute("aria-pressed", String(d.player.light));
    this.$("#escape-stones").textContent = String(d.stones);
    this.$("#escape-stone").setAttribute("aria-label", `丢石子，剩余${d.stones}颗`);
    this.$("#escape-search").hidden = !this.world.pending;
    this.$<HTMLProgressElement>("#escape-search progress").value = this.world.pending ? 1.15 - this.world.pending.remaining : 0;
    this.renderer?.drawMap(this.$("#escape-minimap"), this.world, true);
  }
  destroy() {
    if (this.disposed) return; this.save(); this.disposed = true; this.controller.abort(); cancelAnimationFrame(this.raf); this.audio.setPlaying(false); this.audio.stopPreview(); this.renderer?.dispose();
  }
}
