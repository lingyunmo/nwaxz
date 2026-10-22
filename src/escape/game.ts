import "./style.css";
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
    } catch { this.storageWarning = "逃生存档暂时无法读取；原洗澡存档仍保留。可先导出逃生备份。"; }
    this.root.innerHTML = `<main class="escape-shell" aria-label="极限恐怖逃生"><canvas id="escape-view" tabindex="0" aria-label="第一人称逃生场景。WASD移动，左右方向键转身，Shift奔跑，C蹲行，F手电，E交互，Q丢石子，Esc暂停。"></canvas>
      <header class="escape-hud"><button id="escape-pause" aria-label="暂停逃生">Ⅱ</button><div><span id="escape-room">地下浴场</span><strong id="escape-goal">寻找下水道出口</strong></div><button id="escape-map" aria-label="查看地图">地图</button></header>
      <div class="escape-inventory" id="escape-inventory" aria-label="随身物品"></div><div class="escape-crosshair" aria-hidden="true">＋</div>
      <div class="escape-danger" id="escape-danger" role="status"></div><div class="escape-notice" id="escape-notice" role="status" aria-live="polite"></div>
      <div class="escape-search" id="escape-search" hidden><span>搜索中 · 保持靠近</span><progress max="1.15" value="0" aria-label="搜索进度"></progress></div>
      <div class="escape-bottom"><div class="escape-meters"><label>体力 <meter id="escape-stamina" min="0" max="100" value="100"></meter></label><label>手电 <meter id="escape-battery" min="0" max="100" value="100"></meter></label><span id="escape-night">第1夜 · 00:00</span></div>
      <div class="escape-controls"><div class="escape-stick" id="escape-stick" aria-label="移动摇杆"><span></span></div><div class="escape-actions"><button id="escape-light" aria-label="开关手电">手电 F</button><button id="escape-crouch" aria-label="切换蹲行">蹲行 C</button><button id="escape-stone">石子 Q · 2</button><button id="escape-sprint" aria-label="按住奔跑">奔跑 ⇧</button></div></div><button class="escape-interact" id="escape-interact">靠近并看向可互动物品 · E</button></div>
      <div id="escape-panel" class="escape-panel" role="dialog" aria-modal="true" aria-label="逃生菜单"></div><input id="escape-import" type="file" accept=".json,application/json" hidden></main>`;
    this.bind(); this.intro();
    this.raf = requestAnimationFrame(this.frame);
  }
  private $<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private button(id: string, fn: () => void) { this.$(`#${id}`).addEventListener("click", fn, { signal: this.signal }); }
  private panel(html: string) {
    this.$(".escape-shell").classList.remove("intro-active");
    this.$("#escape-panel").classList.remove("escape-intro");
    this.$("#escape-panel").hidden = false;
    this.$("#escape-panel").innerHTML = `<section class="escape-card">${html}</section>`;
    this.$("#escape-panel").querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }
  private intro() {
    this.paused = true; this.audio.setPlaying(false);
    const canResume = this.saved && ["playing", "caught"].includes(this.saved.phase);
    this.panel(`<p class="escape-eyebrow">极限恐怖 · 完整逃生篇</p><h1>奶蛙<br><em>下水道逃生</em></h1><p>浴场锁门了。走廊深处，它还在笑。</p><p class="escape-story">搜索钥匙，恢复电源，剪开铁网。你只有三次机会。躲进柜子前，先确保它没有看见你。</p>
      <div class="escape-intro-controls"><span>WASD 移动 · 拖动视角</span><span>E 交互 · Shift 奔跑 · C 蹲行</span><span>手机：左摇杆移动，右侧滑动转身</span></div>
      <label class="escape-check"><input id="escape-intro-music" type="checkbox" ${this.music ? "checked" : ""}>启用本模式恐怖配乐（可随时关闭）</label>
      ${canResume ? '<button id="escape-continue" class="escape-primary">继续逃生</button>' : ""}<button id="escape-new" class="${canResume ? "escape-secondary" : "escape-primary"}">${canResume ? "重新开始" : "进入浴场"}</button>
      <div class="escape-links"><button id="escape-intro-help">逃生须知</button><button id="escape-intro-import">导入逃生存档</button><button id="escape-intro-exit">返回主界面</button></div>
      ${this.record ? `<p class="escape-record">逃出 ${this.record.escapes} 次 · 最快 ${time(this.record.bestTimeMs / 1000)} · 最少被抓 ${this.record.fewestCaptures} 次</p>` : ""}<p class="escape-storage">独立本地自动存档 · 原18关纪录保留${this.storageWarning ? `<br>${safe(this.storageWarning)}` : ""}</p>`);
    this.$(".escape-shell").classList.add("intro-active"); this.$("#escape-panel").classList.add("escape-intro");
    const music = () => { this.music = this.$<HTMLInputElement>("#escape-intro-music").checked; this.saveSound(); };
    if (canResume) this.button("escape-continue", () => { music(); void this.start(true); });
    this.button("escape-new", () => { music(); if (canResume) this.confirmRestart(); else void this.start(false); });
    this.button("escape-intro-exit", this.exit);
    this.button("escape-intro-help", () => this.help(false));
    this.button("escape-intro-import", () => this.$<HTMLInputElement>("#escape-import").click());
  }
  private async loadArt() {
    const paths = { materials: "/assets/scenes/escape-materials-v1.webp", props: "/assets/props/escape-props-v1.webp", frog: "/assets/character/haunted-frog-v1.webp", details: "/assets/props/escape-details-v1.webp" };
    return Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => { const img = new Image(); img.src = path; await img.decode(); return [key, img]; }))) as EscapeArt;
  }
  private async start(resume: boolean) {
    this.audio.setMode("escape"); this.applySound(); void this.audio.unlock();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    this.panel('<p class="escape-eyebrow">下水道逃生</p><h2>有人在走廊里……</h2><p>正在准备浴场与声音</p>');
    try {
      this.art ??= await this.loadArt();
      if (this.disposed) return;
      this.world = resume && this.saved ? EscapeWorld.restore(this.saved) : new EscapeWorld();
      this.renderer = new EscapeRenderer(this.$("#escape-view"), this.art, this.settings.reducedMotion);
      this.renderer.resize(this.settings.quality === "high"); this.started = true; this.phase = this.world.data.phase;
      this.saveAt = this.world.data.elapsed; this.save();
      if (this.world.data.phase === "caught") this.result(); else this.resume();
    } catch {
      this.panel('<h2>场景还未准备好</h2><p>检查网络后重试；已有存档仍保留。</p><button id="escape-load-back" class="escape-primary">回到逃生菜单</button>');
      this.button("escape-load-back", () => this.intro());
    }
  }
  private applySound() { this.audio.setSettings({ ...this.settings, music: this.music, sound: this.sound }); }
  private saveSound() { try { localStorage.setItem(SOUND, JSON.stringify({ music: this.music, sound: this.sound })); } catch { /* Audio still works without storage. */ } this.applySound(); }
  private resume() {
    this.$("#escape-panel").hidden = true; this.paused = false; this.lastFrame = 0; this.clearInput();
    this.$("#escape-view").focus({ preventScroll: true }); this.audio.setPlaying(true); void this.audio.unlock();
  }
  private clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.look = undefined; this.sprinting = false; this.$("#escape-stick span").style.transform = "translate(0,0)"; }
  private pause(map = false) {
    if (!this.started || this.world.data.phase !== "playing") return;
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    this.panel(`<p class="escape-eyebrow">时间和奶蛙都已暂停</p><h2>${map ? "浴场平面图" : "屏住呼吸"}</h2><p>${safe(this.world.objective)}</p><canvas id="escape-floorplan" aria-label="浴场地图，黄色圆点是你"></canvas>
      <p class="escape-map-legend">黄色：你 · 棕色：门 · 绿色：已打开<br>北侧寝室／档案室／值班室，南侧洗衣间／配电室／检修室</p>
      <button id="escape-resume" class="escape-primary">继续逃生</button><div class="escape-setting-row"><label><input id="escape-music" type="checkbox" ${this.music ? "checked" : ""}>恐怖配乐</label><label><input id="escape-sound" type="checkbox" ${this.sound ? "checked" : ""}>笑声与音效</label><button id="escape-audio-recover">恢复声音</button></div>
      <div class="escape-links"><button id="escape-backup">备份逃生存档</button><button id="escape-help">操作说明</button><button id="escape-restart">重新逃生</button><button id="escape-exit">保存并退出</button></div><p class="escape-storage" id="escape-save-status">${this.storageWarning || "已自动保存至这台设备"}</p>`);
    this.renderer?.drawMap(this.$("#escape-floorplan"), this.world);
    this.button("escape-resume", () => this.resume()); this.button("escape-help", () => this.help(true)); this.button("escape-restart", () => this.confirmRestart());
    this.button("escape-exit", () => { this.save(); this.exit(); }); this.button("escape-backup", () => this.exportSave());
    this.$<HTMLInputElement>("#escape-music").onchange = e => { this.music = (e.target as HTMLInputElement).checked; this.saveSound(); if (this.music) void this.audio.preview("music"); };
    this.$<HTMLInputElement>("#escape-sound").onchange = e => { this.sound = (e.target as HTMLInputElement).checked; this.saveSound(); };
    this.button("escape-audio-recover", () => { void this.audio.recover().then(ok => { const el = this.root.querySelector("#escape-save-status"); if (el) el.textContent = ok ? "正在试听声音；音乐和音效开关保持原样。" : "声音尚未开启，请再次点击。"; }); });
  }
  private help(fromPause: boolean) {
    this.panel(`<p class="escape-eyebrow">逃生须知</p><h2>别让笑声靠近</h2><ol class="escape-help"><li>搜索寝室床头抽屉，拿黄铜钥匙；开走廊北侧档案室，找到检修门钥匙。</li><li>去西南洗衣间找保险丝，装入南侧正中的配电箱。</li><li>东南检修门需要钥匙和电；进去找断线钳，转排水阀，剪开最南侧铁网。</li><li>奶蛙会巡逻，奔跑会被听见。先绕墙切断视线，再躲进衣柜；当着它的面躲藏会被找到。</li><li>石子 Q 可引走还没看见你的奶蛙；蹲行 C 更安静，手电 F 更容易暴露位置。</li><li>被抓后有三次机会；前两次会在寝室醒来，物品与已完成目标保留，第三次结束。</li><li>手机左侧摇杆移动、右侧滑动看方向，按住奔跑。桌面 WASD / 上下键移动、左右键转身，拖动画面看方向，E 交互，M 地图，Esc 暂停。</li></ol><button id="escape-help-close" class="escape-primary">记住了</button>`);
    this.button("escape-help-close", () => fromPause ? this.pause() : this.intro());
  }
  private confirmRestart() {
    this.paused = true; this.audio.setPlaying(false);
    this.panel('<h2>重新进入浴场？</h2><p>当前逃生会话会重新开始。逃生最佳纪录和原洗澡关卡不受影响。</p><button id="escape-confirm-restart" class="escape-primary">确认重新开始</button><button id="escape-cancel-restart" class="escape-secondary">保留当前进度</button>');
    this.button("escape-confirm-restart", () => void this.start(false)); this.button("escape-cancel-restart", () => this.started ? this.pause() : this.intro());
  }
  private result() {
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    const d = this.world.data;
    if (d.phase === "won") {
      this.panel(`<p class="escape-eyebrow">你逃进了下水道</p><h1>别回头</h1><p>铁网断开的那一刻，冷风终于吹到了脸上。奶蛙的笑声，被你留在了上面。</p><div class="escape-result-stats"><span>逃生用时<strong>${time(d.elapsed)}</strong></span><span>被抓次数<strong>${d.captures} / 3</strong></span><span>找到纸条<strong>${d.notes.length} / 3</strong></span></div><p class="escape-record">本机最快 ${time((this.record?.bestTimeMs ?? d.elapsed * 1000) / 1000)}</p><button id="escape-again" class="escape-primary">再逃一次</button><button id="escape-result-exit" class="escape-secondary">返回主界面</button>`);
      this.button("escape-again", () => void this.start(false)); this.button("escape-result-exit", this.exit);
    } else {
      this.panel(`<div class="escape-capture-frog" aria-label="奶蛙正在捧腹大笑"></div><p class="escape-eyebrow">${d.phase === "lost" ? "第三次被抓住" : `第 ${d.captures} 次被抓住`}</p><h2>${d.phase === "lost" ? "笑声留住了你" : "它找到你了"}</h2><p>${d.phase === "lost" ? "三次机会已经用完。记住路线，下次别在它眼前躲藏。" : "你还会在寝室醒来。已找到的物品和开过的锁会保留。"}</p><button id="escape-next" class="escape-primary">${d.phase === "lost" ? "重新逃生" : `醒来 · 第 ${d.captures + 1} 夜`}</button><button id="escape-result-exit" class="escape-secondary">保存并退出</button>`);
      this.button("escape-next", () => { if (d.phase === "lost") void this.start(false); else { this.world.nextNight(); this.phase = "playing"; this.save(); this.resume(); } });
      this.button("escape-result-exit", this.exit);
      this.audio.haunt();
      // One deliberate click can replay the recognisable laugh, without changing settings.
      this.$(".escape-capture-frog").addEventListener("click", () => void this.audio.preview("sound"), { signal: this.signal });
    }
  }
  private save() {
    if (!this.started) return;
    try { this.saved = this.world.snapshot(); localStorage.setItem(SESSION, JSON.stringify(this.saved)); this.storageWarning = ""; }
    catch { this.storageWarning = "本机无法自动保存，请先备份逃生存档。"; }
  }
  private recordWin() {
    const d = this.world.data, ms = Math.round(d.elapsed * 1000), previous = this.record;
    this.record = { version: 1, escapes: Math.min(1e9, (previous?.escapes ?? 0) + 1), bestTimeMs: Math.min(previous?.bestTimeMs ?? ms, ms), fewestCaptures: Math.min(previous?.fewestCaptures ?? d.captures, d.captures), mostNotes: Math.max(previous?.mostNotes ?? 0, d.notes.length) };
    try { localStorage.setItem(RECORD, JSON.stringify(this.record)); } catch { this.storageWarning = "纪录未能写入，请备份逃生存档。"; }
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
    view.addEventListener("pointermove", e => { if (!this.look || this.look.id !== e.pointerId || this.paused || this.world.data.hidden) return; this.world.data.player.angle = Math.atan2(Math.sin(this.world.data.player.angle + (e.clientX - this.look.x) * .005), Math.cos(this.world.data.player.angle + (e.clientX - this.look.x) * .005)); this.look.x = e.clientX; this.look.y = e.clientY; }, { signal: this.signal });
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
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "e", "q", "c", "f", "m", "escape", "tab", " "].includes(key)) e.preventDefault(); else return;
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
      try {
        if (file.size > 64000) throw new Error("too large");
        const raw = JSON.parse(await file.text()); if (raw.format !== "nwaxz-escape" || raw.version !== 1) throw new Error("bad format");
        const world = EscapeWorld.restore(raw.session); this.saved = world.snapshot();
        const record = readBest(raw.record); if (record) this.record = this.record ? { version: 1, escapes: Math.max(record.escapes, this.record.escapes), bestTimeMs: Math.min(record.bestTimeMs, this.record.bestTimeMs), fewestCaptures: Math.min(record.fewestCaptures, this.record.fewestCaptures), mostNotes: Math.max(record.mostNotes, this.record.mostNotes) } : record;
        localStorage.setItem(SESSION, JSON.stringify(this.saved)); if (this.record) localStorage.setItem(RECORD, JSON.stringify(this.record));
        this.storageWarning = "逃生存档已导入；原洗澡存档未变。"; this.intro();
      } catch { this.storageWarning = "逃生存档格式不正确，已有进度仍保留。"; this.intro(); }
      finally { (e.target as HTMLInputElement).value = ""; }
    };
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    if (this.started && !this.paused && !document.hidden) {
      const down = (key: string) => this.keys.has(key) ? 1 : 0;
      this.world.advance(dt, { forward: down("w") + down("arrowup") - down("s") - down("arrowdown") - this.stick.y, strafe: down("d") - down("a") + this.stick.x, turn: down("arrowright") - down("arrowleft"), sprint: this.keys.has("shift") || this.sprinting });
      this.renderer?.draw(this.world);
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
    this.raf = requestAnimationFrame(this.frame);
  };
  private updateHud() {
    const d = this.world.data;
    this.$("#escape-room").textContent = `${this.world.room} · ${d.hidden ? "柜内" : d.player.crouched ? "蹲行" : "站立"}`;
    this.$("#escape-goal").textContent = this.world.objective;
    this.$("#escape-inventory").innerHTML = d.inventory.map(item => `<span>${ITEM_NAMES[item]}</span>`).join("") || '<span class="empty">背包里空空的</span>';
    this.$("#escape-notice").textContent = this.world.message;
    const danger = d.hidden ? "柜子里很暗。听清脚步再出去。" : d.hunter.state === "chase" ? "奶蛙正在追你 · 转弯切断视线！" : Math.hypot(d.hunter.x - d.player.x, d.hunter.z - d.player.z) < 4 ? "附近有脚步声……" : "";
    this.$("#escape-danger").textContent = danger;
    this.$(".escape-shell").classList.toggle("being-chased", d.hunter.state === "chase");
    const target = this.world.nearest(); this.$<HTMLButtonElement>("#escape-interact").disabled = !target || !!this.world.pending; this.$("#escape-interact").textContent = target ? `${target.label} · E` : "靠近并看向可互动物品 · E";
    this.$<HTMLMeterElement>("#escape-stamina").value = d.player.stamina; this.$<HTMLMeterElement>("#escape-battery").value = d.player.battery;
    this.$("#escape-night").textContent = `第${Math.min(3, d.captures + 1)}夜 · ${time(d.elapsed)}`;
    this.$("#escape-crouch").setAttribute("aria-pressed", String(d.player.crouched)); this.$("#escape-light").setAttribute("aria-pressed", String(d.player.light)); this.$("#escape-stone").textContent = `石子 Q · ${d.stones}`;
    this.$("#escape-search").hidden = !this.world.pending;
    this.$<HTMLProgressElement>("#escape-search progress").value = this.world.pending ? 1.15 - this.world.pending.remaining : 0;
  }
  destroy() {
    if (this.disposed) return; this.save(); this.disposed = true; this.controller.abort(); cancelAnimationFrame(this.raf); this.audio.setPlaying(false); this.audio.stopPreview();
  }
}
