import "./style.css";
import "./hud.css";
import { icon } from "./icons.ts";
import { SaveWriteError, writeSaveBatch } from "./save.ts";
import { CinematicPlayer, randomOpeningClip, randomCaughtClip } from "./cinematic.ts";
import { AudioManager } from "../audio.ts";
import type { Settings } from "../settings.ts";
import { EscapeWorld, ITEM_NAMES, PROPS, type EscapeSnapshot } from "./world.ts";
import { EscapeRenderer, type EscapeArt } from "./renderer.ts";
import { prepareEscape, returnPreparedEscape, takePreparedEscape } from "./preparation.ts";
import { EscapeLook, type MouseLookMode } from "./look.ts";
export { prepareEscape } from "./preparation.ts";

const SESSION = "nwaxz-escape-session-v1", RECORD = "nwaxz-escape-record-v1", SOUND = "nwaxz-escape-sound-v1";
const HUD = "nwaxz-escape-hud-v1";
type Best = { version: 1; escapes: number; bestTimeMs: number; fewestCaptures: number; mostNotes: number };
const time = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const safe = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function readBest(raw: unknown): Best | undefined {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Best;
  if (r.version !== 1 || !Number.isInteger(r.escapes) || r.escapes < 1 || r.escapes > 1e9 || !Number.isInteger(r.bestTimeMs) || r.bestTimeMs < 0 || r.bestTimeMs > 86400_000 || !Number.isInteger(r.fewestCaptures) || r.fewestCaptures < 0 || r.fewestCaptures > 2 || !Number.isInteger(r.mostNotes) || r.mostNotes < 0 || r.mostNotes > 4) return;
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
  private cinematic?: CinematicPlayer;
  private saved?: EscapeSnapshot;
  private record?: Best;
  private storageWarning = "";
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private look?: EscapeLook;
  private mouseMode: MouseLookMode = "click";
  private mouseHintUntil = 0;
  private unlockAt = -1000;
  private saveAt = 0;
  private hudAt = 0;
  private heartbeatAt = 0;
  private lastNotice = "";
  private noticeUntil = 0;
  private inventoryKey = "";
  private lastRoom = "";
  private roomCueUntil = -1;
  private phase = "playing";
  private music = true;
  private sound = true;
  private hudDetails = false;
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
    this.root.innerHTML = `<main class="escape-shell" aria-label="极限恐怖逃生"><canvas id="escape-view" tabindex="0" aria-label="3D第一人称逃生。WASD移动，Shift切换奔跑，C切换蹲行；点击画面后移动鼠标转头，手机滑动转头。E交互，Esc暂停并释放鼠标。"></canvas>
      <header class="escape-hud"><button id="escape-pause" class="escape-round" aria-label="暂停逃生">${icon("pause")}</button><div class="escape-location"><span id="escape-room">${safe(this.world.room)}</span><span id="escape-night">第1夜 · 00:00</span><div id="escape-lives" aria-label="剩余机会"></div></div></header>
      <button id="escape-map" class="escape-map-button" aria-label="查看地图，当前位置：${safe(this.world.room)}"><canvas id="escape-minimap" width="208" height="208" aria-hidden="true"></canvas><span>浴场地图 <kbd>M</kbd></span><small id="escape-map-room">${safe(this.world.room)}</small></button>
      <div class="escape-inventory" id="escape-inventory" aria-label="随身物品"></div>
      <section class="escape-hunt" aria-label="奶蛙追击状态"><div class="escape-exposure"><div class="escape-exposure-heading"><strong>暴露值</strong><b id="escape-exposure-value">0</b><span>/100</span><strong id="escape-hunt-state">平静</strong><button id="escape-hud-toggle" aria-expanded="false" aria-controls="escape-source-details"><span>详情</span><kbd>Tab</kbd></button><button id="escape-hud-help" aria-label="暴露规则说明" title="暴露规则说明">?</button></div><meter id="escape-exposure" aria-label="暴露值" min="0" max="100" value="0"></meter><p id="escape-exposure-hint">保持安静，留意周围。</p></div><div class="escape-secondary-meters" id="escape-source-details"><div class="escape-source"><div><strong>声音</strong><b id="escape-noise-value">0</b></div><meter id="escape-noise" aria-label="声音暴露" min="0" max="100" value="0"></meter><small id="escape-noise-info">静止</small><em id="escape-noise-contribution">+0分 · 0%</em></div><div class="escape-source"><div><strong>灯光</strong><b id="escape-glare-value">0</b></div><meter id="escape-glare" aria-label="灯光暴露" min="0" max="100" value="0"></meter><small id="escape-glare-info">未照中</small><em id="escape-glare-contribution">+0分 · 0%</em></div><div class="escape-source"><div><strong>视觉</strong><b id="escape-sight-value">0</b></div><meter id="escape-sight" aria-label="视觉暴露" min="0" max="100" value="0"></meter><small id="escape-sight-info">未被看到</small><em id="escape-sight-contribution">+0分 · 0%</em></div></div></section>
      <div class="escape-hunter-bearing" id="escape-hunter-bearing" aria-label="奶蛙方向" hidden>‹ 奶蛙</div>
      <div class="escape-room-toast" id="escape-room-toast" aria-live="polite" hidden></div>
      <div class="escape-mouse-hint" id="escape-mouse-hint" hidden>点击画面，移动鼠标转头</div>
      <div class="escape-crosshair" aria-hidden="true"></div><div class="escape-danger" id="escape-danger" role="status"></div><div class="escape-notice" id="escape-notice" role="status" aria-live="polite" hidden></div>
      <div class="escape-search" id="escape-search" hidden><span>搜索中</span><progress max="1.15" value="0" aria-label="搜索进度"></progress></div>
      <div class="escape-bottom"><div id="escape-movement" class="escape-movement">步行 · Shift 切换奔跑 · C 蹲行</div><div class="escape-meters"><label title="体力"><span>体力</span>${icon("run")}<meter id="escape-stamina" aria-label="体力" min="0" max="100" value="100"></meter><b id="escape-stamina-value">100</b></label><label title="疲劳"><span id="escape-effort-label">疲劳</span>${icon("run")}<meter id="escape-effort" aria-label="行走疲劳" min="0" max="100" value="0"></meter><b id="escape-effort-value">0</b></label><label title="手电电量"><span>电量</span>${icon("light")}<meter id="escape-battery" aria-label="手电电量" min="0" max="100" value="100"></meter><b id="escape-battery-value">100</b></label></div>
      <div class="escape-controls"><div class="escape-stick" id="escape-stick" aria-label="移动摇杆"><span></span></div><div class="escape-actions"><button id="escape-light" aria-label="开关手电" title="手电 F">${icon("light")}<span>手电</span><kbd>F</kbd></button><button id="escape-crouch" aria-label="切换蹲行，按 C 切换" title="蹲行 C：切换">${icon("crouch")}<span>蹲行</span><kbd>C</kbd></button><button id="escape-stone" aria-label="丢石子" title="石子 Q">${icon("stone")}<span>石子</span><b id="escape-stones">2</b><kbd>Q</kbd></button><button id="escape-sprint" aria-label="切换奔跑" title="奔跑 Shift：切换">${icon("run")}<span>奔跑</span><kbd>Shift</kbd></button><div class="escape-crystals"><button id="escape-freeze" aria-label="使用冻结晶，快捷键1"><i class="crystal-icon freeze">❄</i><span>冻结</span><b id="escape-freeze-count">0</b><small id="escape-freeze-time">余 0s</small><kbd>1</kbd></button><button id="escape-reveal" aria-label="使用显形晶，快捷键2"><i class="crystal-icon reveal">◇</i><span>显形</span><b id="escape-reveal-count">0</b><small id="escape-reveal-time">余 0s</small><kbd>2</kbd></button></div></div></div>
      <button class="escape-interact" id="escape-interact" hidden>${icon("hand")}<span></span><kbd>E</kbd></button></div>
      <div id="escape-panel" class="escape-panel" role="dialog" aria-modal="true" aria-label="逃生菜单"></div><input id="escape-import" type="file" accept=".json,application/json" hidden></main>`;
    try { this.hudDetails = localStorage.getItem(HUD) === "expanded"; } catch { /* Keep compact without storage. */ }
    this.applyHudDetails();
    this.adoptPrepared();
    this.bind(); this.intro();
    this.raf = requestAnimationFrame(this.frame);
  }
  private $<T extends HTMLElement = HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)!; }
  private applyHudDetails() {
    this.$(".escape-hunt").classList.toggle("details-open", this.hudDetails);
    const button = this.$("#escape-hud-toggle");
    button.setAttribute("aria-expanded", String(this.hudDetails));
    button.setAttribute("aria-label", `${this.hudDetails ? "收起" : "展开"}警戒详情，Tab切换`);
    button.querySelector("span")!.textContent = this.hudDetails ? "收起" : "详情";
  }
  private toggleHudDetails() {
    this.hudDetails = !this.hudDetails; this.applyHudDetails();
    try { localStorage.setItem(HUD, this.hudDetails ? "expanded" : "compact"); } catch { /* The toggle still works. */ }
  }
  private button(id: string, fn: () => void) { this.$(`#${id}`).addEventListener("click", fn, { signal: this.signal }); }
  private panel(html: string) {
    this.look?.suspend();
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
      <div class="escape-intro-controls"><span>WASD 移动 · 点击画面后移动鼠标转头</span><span>E 交互 · Shift 切换奔跑 · C 切换蹲行</span><span>手机：左摇杆移动，右侧滑动看四周，点击按钮切换奔跑/蹲行</span></div>
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
  private adoptPrepared() {
    const bundle = takePreparedEscape();
    if (!bundle) return;
    const placeholder = this.$<HTMLCanvasElement>("#escape-view");
    for (const attribute of placeholder.attributes) bundle.canvas.setAttribute(attribute.name, attribute.value);
    bundle.canvas.removeAttribute("style");
    placeholder.replaceWith(bundle.canvas);
    this.renderer = bundle.renderer; this.art = bundle.art;
    this.renderer.setReducedMotion(this.settings.reducedMotion);
  }
  private async start(resume: boolean) {
    this.save(); this.started = false; this.paused = true;
    this.audio.setMode("escape"); this.applySound(); void this.audio.unlock();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    this.panel('<p class="escape-eyebrow">下水道逃生</p><h2>正在进入浴场…</h2><p id="escape-preparing" role="status"></p>');
    const opening = resume ? undefined : this.playCinematic(randomOpeningClip());
    try {
      if (!this.renderer?.usable) {
        this.renderer?.dispose(); this.renderer = undefined;
        await prepareEscape(this.settings, stage => { const label = this.root.querySelector("#escape-preparing"); if (label) label.textContent = stage; });
        if (this.disposed) return;
        // Only the canvas changes here; global game listeners remain bound once.
        const bundle = takePreparedEscape();
        if (!bundle) throw new Error("场景尚未准备完成");
        const previous = this.$<HTMLCanvasElement>("#escape-view");
        for (const attribute of previous.attributes) bundle.canvas.setAttribute(attribute.name, attribute.value);
        bundle.canvas.removeAttribute("style");
        previous.replaceWith(bundle.canvas);
        this.renderer = bundle.renderer; this.art = bundle.art;
        this.bindView(bundle.canvas);
      }
      if (this.disposed) return;
      this.world = resume && this.saved ? EscapeWorld.restore(this.saved) : new EscapeWorld();
      this.beginRoomCue();
      this.renderer.setReducedMotion(this.settings.reducedMotion);
      if (this.disposed) return;
      this.renderer.resize(this.settings.quality === "high"); this.started = true; this.phase = this.world.data.phase;
      this.saveAt = this.world.data.elapsed; this.save();
      await opening;
      if (this.disposed) return;
      if (this.world.data.phase === "caught") this.result(); else this.resume();
    } catch {
      this.cinematic?.close();
      this.renderer?.dispose(); this.renderer = undefined;
      this.panel('<h2>场景载入失败</h2><p>请检查网络，或换用支持 WebGL 的浏览器。进度已保留。</p><button id="escape-load-back" class="escape-primary">返回菜单</button>');
      this.button("escape-load-back", () => this.intro());
    }
  }
  private async playCinematic(path: string) {
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.audio.stopPreview();
    this.look?.suspend();
    this.$("#escape-room-toast").hidden = true;
    const shell = this.$(".escape-shell"); shell.inert = true;
    const player = new CinematicPlayer(this.root, path, this.sound); this.cinematic = player;
    await player.done;
    if (this.cinematic === player) this.cinematic = undefined;
    shell.inert = false;
    if (!this.disposed) this.$("#escape-panel").querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }
  private applySound() { this.audio.setSettings({ ...this.settings, music: this.music, sound: this.sound }); }
  private saveSound() { try { localStorage.setItem(SOUND, JSON.stringify({ music: this.music, sound: this.sound })); } catch { /* Audio still works without storage. */ } this.applySound(); }
  private resume() {
    this.$(".escape-shell").classList.remove("capture-active");
    this.$("#escape-view").setAttribute("aria-label", "3D第一人称逃生。WASD移动，Shift切换奔跑，C切换蹲行；点击画面后移动鼠标转头，手机滑动转头。E交互，Esc暂停并释放鼠标。");
    this.$("#escape-panel").hidden = true; this.$(".escape-shell").classList.remove("menu-active"); this.updateHud(); this.paused = false; this.lastFrame = 0; this.clearInput();
    this.$("#escape-view").focus({ preventScroll: true }); this.audio.setPlaying(true); void this.audio.unlock();
    this.look?.capture();
  }
  private clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.look?.clear(); this.$("#escape-stick span").style.transform = "translate(0,0)"; }
  private pause(map = false) {
    if (!this.started || this.world.data.phase !== "playing") return;
    if (document.pointerLockElement === this.root.querySelector("#escape-view")) this.unlockAt = performance.now();
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    this.panel(`<div class="escape-pause-layout"><div class="escape-map-page"><p class="escape-eyebrow">地下浴场</p><h2>浴场地图</h2><canvas id="escape-floorplan" width="500" height="500" aria-label="浴场地图，箭头是你，暗处尚未探索"></canvas><p class="escape-map-legend"><i class="map-you"></i>你 <i class="map-door"></i>门 <i class="map-hide"></i>衣柜 <i class="map-fog"></i>未探索</p><p class="escape-map-current" id="escape-map-current">当前位置：${safe(this.world.room)}</p></div>
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
    const expanded = !!this.world.data.expansion?.enabled;
    const controls = touch ? [["移动", "左侧摇杆"], ["观察", "滑动右侧画面"], ["互动", "靠近目标后点击手掌"], ["奔跑", "点击切换奔跑"], ["蹲行", "点击切换蹲行"], ["冻结 / 显形", "屏幕晶体按钮"]] : [["移动", "WASD / 方向键"], ["观察", "点击画面后移动鼠标"], ["抬头 / 低头", "PageUp / PageDown"], ["互动", "E / 空格"], ["奔跑", "Shift 切换"], ["蹲行", "C 切换"], ["手电", "F"], ["石子 / 地图", "Q / M"], ["警戒详情", "Tab 展开 / 收起"], ["冻结 / 显形", "1 / 2"], ["暂停 / 释放鼠标", "Esc"]];
    const tips = ["找齐钥匙和工具，打开下水道铁网。", ...(expanded ? ["旧更衣室里有缺失的手轮；锅炉房维修纸条记着泄压顺序。", "走廊碎玻璃可以绕开或蹲行通过。"] : []), "连续移动会积累疲劳，到100会喘息引来奶蛙；停下休息可恢复。", "持续照中奶蛙会增加警觉，达到100会引来调查；移开光束后下降。", "冻结晶和显形晶各持续10秒；按1/2使用，激活时不会重复消耗。", "被抓后进入下一夜，物品保留。第三次被抓则失败。"];
    this.panel(`<h2>操作</h2><dl class="escape-bindings">${controls.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl><ul class="escape-help">${tips.map(tip => `<li>${tip}</li>`).join("")}</ul><details class="escape-perception-help"><summary>暴露值与追击规则</summary><p>声音、灯光、视觉分别累积 0–100。总分由三路共同计算：</p><p class="escape-formula">100 × [1 − (1 − 声音/100)(1 − 灯光/100)(1 − 视觉/100)]</p><p>例：声音50、灯光50为75；三路各50为87.5；声音和灯光各99会封顶100；任一路100也为100。原始分达到99.5即封顶并进入追击。</p><p>总分达到45会警觉，感知速度变为×1.5。蹲行、步行、跑步的基础听距为3、7.5、15米，喘息18米；墙门缩短听距，离得越近涨分越快。贡献按线索重叠程度公平分摊，相加等于总分；显示值四舍五入。追击时总分锁定100，贡献按比例显示，甩开视线和声光线索后转为搜查。</p></details><button id="escape-help-close" class="escape-primary">返回</button>`);
    this.button("escape-help-close", () => fromPause ? this.pause() : this.intro());
  }
  private confirmRestart() {
    this.paused = true; this.audio.setPlaying(false);
    this.panel('<h2>重新进入浴场？</h2><p>重置当前逃生进度，保留最佳纪录。</p><button id="escape-confirm-restart" class="escape-primary">重新开始</button><button id="escape-cancel-restart" class="escape-secondary">继续游戏</button>');
    this.button("escape-confirm-restart", () => void this.start(false)); this.button("escape-cancel-restart", () => this.started ? this.pause() : this.intro());
  }
  private result(playCapture = false) {
    this.paused = true; this.clearInput(); this.audio.setPlaying(false); this.save();
    this.$(".escape-shell").classList.remove("freeze-active");
    if (playCapture) {
      void this.playCinematic(randomCaughtClip()).then(() => { if (!this.disposed) this.result(); });
      return;
    }
    const d = this.world.data;
    if (d.phase === "won") {
      const noteTotal = d.expansion?.enabled ? PROPS.filter(prop => prop.kind === "note").length : 3;
      this.panel(`<p class="escape-eyebrow">下水道逃生</p><h1>逃生成功</h1><div class="escape-result-stats"><span>用时<strong>${time(d.elapsed)}</strong></span><span>被抓<strong>${d.captures} / 3</strong></span><span>纸条<strong>${d.notes.length} / ${noteTotal}</strong></span></div><p class="escape-record">最佳 ${time((this.record?.bestTimeMs ?? d.elapsed * 1000) / 1000)}</p><button id="escape-again" class="escape-primary">再玩一次</button><button id="escape-result-exit" class="escape-secondary">返回首页</button>`);
      this.button("escape-again", () => void this.start(false)); this.button("escape-result-exit", this.exit);
    } else {
      this.panel(`<p class="escape-eyebrow">${d.phase === "lost" ? "第三次被抓住" : `第 ${d.captures} 次被抓住`}</p><h2>${d.phase === "lost" ? "逃生失败" : "被抓住了"}</h2><p>${d.phase === "lost" ? `坚持了 ${time(d.elapsed)}` : "物品和已打开的锁会保留。"}</p><button id="escape-next" class="escape-primary">${d.phase === "lost" ? "重新开始" : `醒来 · 第 ${d.captures + 1} 夜`}</button><div class="escape-links"><button id="escape-replay-laugh">再听笑声</button><button id="escape-result-exit">保存并退出</button></div>`);
      this.$(".escape-shell").classList.add("capture-active");
      this.$("#escape-view").setAttribute("aria-label", "原画奶蛙正张嘴、双手捧腹大笑；游戏进度已暂停");
      this.button("escape-next", () => { if (d.phase === "lost") void this.start(false); else { this.world.nextNight(); this.phase = "playing"; this.beginRoomCue(); this.save(); this.resume(); } });
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
    this.button("escape-hud-toggle", () => { if (!this.paused) this.toggleHudDetails(); });
    this.button("escape-hud-help", () => { if (!this.paused) this.pause(); this.help(true); });
    this.button("escape-interact", () => { if (!this.paused) this.world.interact(); });
    this.button("escape-light", () => { if (!this.paused) this.world.toggleLight(); });
    this.button("escape-crouch", () => { if (!this.paused) this.world.toggleCrouch(); });
    this.button("escape-stone", () => { if (!this.paused) this.world.throwStone(); });
    this.button("escape-freeze", () => { if (!this.paused) this.world.useCrystal("freeze"); });
    this.button("escape-reveal", () => { if (!this.paused) this.world.useCrystal("reveal"); });
    const stick = this.$("#escape-stick");
    const moveStick = (e: PointerEvent) => { const r = stick.getBoundingClientRect(), dx = (e.clientX - r.x - r.width / 2) / 42, dy = (e.clientY - r.y - r.height / 2) / 42, norm = Math.max(1, Math.hypot(dx, dy)); this.stick = { x: dx / norm, y: dy / norm }; stick.querySelector<HTMLElement>("span")!.style.transform = `translate(${this.stick.x * 38}px,${this.stick.y * 38}px)`; };
    let stickId: number | undefined;
    stick.addEventListener("pointerdown", e => { if (this.paused) return; e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); }, { signal: this.signal });
    stick.addEventListener("pointermove", e => { if (stickId === e.pointerId) moveStick(e); }, { signal: this.signal });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) stick.addEventListener(event, () => { stickId = undefined; this.stick = { x: 0, y: 0 }; stick.querySelector<HTMLElement>("span")!.style.transform = "translate(0,0)"; }, { signal: this.signal });
    this.bindView(this.$("#escape-view"));
    this.button("escape-sprint", () => { if (!this.paused) this.world.toggleSprint(); });
    document.addEventListener("keydown", e => {
      if (this.cinematic) return;
      if (this.$("#escape-panel").hidden === false) {
        if (e.key === "Escape" && this.started && this.world.data.phase === "playing") { e.preventDefault(); if (!e.repeat && performance.now() - this.unlockAt > 250) this.resume(); }
        if (e.key === "Tab") {
          const buttons = [...this.$("#escape-panel").querySelectorAll<HTMLElement>("button,input")], at = buttons.indexOf(document.activeElement as HTMLElement), next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
          e.preventDefault(); buttons[next]?.focus();
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown", "shift", "e", "q", "c", "f", "m", "escape", "tab", " ", "1", "2"].includes(key)) e.preventDefault(); else return;
      this.keys.add(key);
      if (e.repeat) return;
      if (key === "tab") { this.toggleHudDetails(); return; }
      if (["escape", "m"].includes(key)) this.pause(key !== "escape");
      if (key === "e" || key === " ") this.world.interact();
      if (key === "q") this.world.throwStone();
      if (key === "f") this.world.toggleLight();
      if (key === "c") this.world.toggleCrouch();
      if (key === "shift") this.world.toggleSprint();
      if (key === "1") this.world.useCrystal("freeze");
      if (key === "2") this.world.useCrystal("reveal");
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
  private bindView(view: HTMLCanvasElement) {
    this.look?.dispose();
    this.look = new EscapeLook(view, {
      active: () => !this.disposed && this.started && !this.paused && !this.cinematic && this.world.data.phase === "playing",
      rotate: (x, y) => {
        if (this.world.data.hidden) return;
        const p = this.world.data.player;
        p.angle = Math.atan2(Math.sin(p.angle + x * .005), Math.cos(p.angle + x * .005));
        p.pitch = Math.max(-1.3, Math.min(1.3, (p.pitch ?? 0) - y * .004));
      },
      unlocked: () => { this.unlockAt = performance.now(); if (!this.paused) this.pause(); },
      mode: mode => { this.mouseMode = mode; if (mode === "free") this.mouseHintUntil = performance.now() + 2500; this.updateMouseHint(); },
    }, this.signal);
    view.addEventListener("webglcontextlost", e => { e.preventDefault(); if (this.started && !this.paused) this.pause(); }, { signal: this.signal });
  }
  private updateMouseHint() {
    this.$(".escape-shell").classList.toggle("mouse-locked", this.mouseMode === "locked");
    const hint = this.$("#escape-mouse-hint");
    hint.textContent = this.mouseMode === "free" ? "移动鼠标转头 · Esc 暂停" : "点击画面，移动鼠标转头";
    hint.hidden = this.paused || !!this.cinematic || !matchMedia("(pointer:fine)").matches || this.mouseMode === "locked" || this.mouseMode === "free" && performance.now() > this.mouseHintUntil;
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    if (this.started && !this.paused && !document.hidden) {
      const down = (key: string) => this.keys.has(key) ? 1 : 0;
      this.world.advance(dt, { forward: down("w") + down("arrowup") - down("s") - down("arrowdown") - this.stick.y, strafe: down("d") - down("a") + this.stick.x, turn: down("arrowright") - down("arrowleft"), look: down("pageup") - down("pagedown"), sprint: this.world.data.player.sprinting ?? false });
      this.renderer?.draw(this.world, dt);
      const d = this.world.data;
      for (const event of this.world.drainEvents()) {
        if (event.type === "laugh" && d.phase === "playing") this.audio.haunt();
        if (["step", "door", "noise"].includes(event.type)) this.audio.effect(event.type as "step" | "door" | "noise");
        if (event.type === "item") this.audio.effect("coin");
        if (event.type === "breath") this.audio.effect("breath");
        if (["item", "door", "message"].includes(event.type)) this.save();
      }
      if (d.hunter.state === "chase" && d.elapsed - this.heartbeatAt > .72) { this.heartbeatAt = d.elapsed; this.audio.effect("heartbeat"); }
      if (d.elapsed - this.saveAt > 4) { this.saveAt = d.elapsed; this.save(); }
      if (d.phase !== this.phase) { this.phase = d.phase; if (d.phase === "won") this.recordWin(); this.result(d.phase === "caught" || d.phase === "lost"); }
      if (now - this.hudAt > 100) { this.hudAt = now; this.updateHud(); }
    }
    // Capture is a cosmetic animation only. Simulation, battery and saves do
    // not advance while its clearly visible original-art belly laugh loops.
    if (this.started && this.paused && !this.cinematic && ["caught", "lost"].includes(this.world.data.phase) && !document.hidden && this.$(".escape-shell").classList.contains("capture-active")) this.renderer?.draw(this.world, dt);
    this.raf = requestAnimationFrame(this.frame);
  };
  private updateHud() {
    this.updateMouseHint();
    const d = this.world.data;
    const room = this.world.room;
    if (room !== this.lastRoom) { this.lastRoom = room; this.roomCueUntil = d.elapsed + 1.6; }
    this.$("#escape-room").textContent = room;
    const mapButton = this.$("#escape-map");
    mapButton.setAttribute("aria-label", `查看地图，当前位置：${room}`);
    this.$("#escape-map-room").textContent = room;
    const roomCue = this.$("#escape-room-toast");
    if (roomCue.textContent !== room) roomCue.textContent = room;
    roomCue.classList.toggle("reduced-motion", this.settings.reducedMotion);
    roomCue.hidden = !this.started || this.paused || !!this.cinematic || d.phase !== "playing" || d.elapsed >= this.roomCueUntil;
    const pauseRoom = this.root.querySelector<HTMLElement>("#escape-map-current");
    if (pauseRoom) pauseRoom.textContent = `当前位置：${room}`;
    const items = d.expansion?.enabled ? ["brass", "cellar", "fuse", "cutters", "handwheel"] as const : ["brass", "cellar", "fuse", "cutters"] as const;
    const inventoryKey = d.inventory.join(",") + ":" + d.captures + ":" + !!d.expansion?.enabled;
    if (inventoryKey !== this.inventoryKey) {
      this.inventoryKey = inventoryKey;
      this.$("#escape-inventory").classList.toggle("expansion-inventory", !!d.expansion?.enabled);
      this.$("#escape-inventory").innerHTML = items.map((item, i) => {
        const owned = d.inventory.includes(item), glyph = item === "cutters" ? "cutters" : item === "fuse" ? "fuse" : item === "handwheel" ? "handwheel" : "key";
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
    this.$(".escape-shell").classList.toggle("freeze-active", (d.hunt?.freeze ?? 0) > 0 && d.phase === "playing");
    const target = this.world.nearest(), interact = this.$<HTMLButtonElement>("#escape-interact");
    interact.hidden = !target || !!this.world.pending;
    interact.disabled = !target || !!this.world.pending;
    interact.querySelector("span")!.textContent = target?.label ?? "";
    this.$<HTMLMeterElement>("#escape-stamina").value = d.player.stamina;
    this.$<HTMLMeterElement>("#escape-battery").value = d.player.battery;
    this.$("#escape-stamina-value").textContent = String(Math.round(d.player.stamina));
    this.$("#escape-battery-value").textContent = String(Math.round(d.player.battery));
    const hunt = d.hunt;
    const effort = hunt?.effort ?? 0;
    const perception = this.world.perception;
    const exposure = perception.total;
    this.$<HTMLMeterElement>("#escape-exposure").value = exposure;
    this.$("#escape-exposure-value").textContent = Number(exposure.toFixed(1)).toString();
    this.$("#escape-exposure-hint").textContent = `${this.world.hunterDecision} · ${this.world.exposureHint}`;
    const huntState = d.hidden ? "藏匿" : hunt?.freeze ? "冻结" : d.hunter.state === "chase" ? "追击" : hunt?.alert && hunt.alert > 0 ? `警觉 · 感知×${this.world.perceptionMultiplier}` : d.hunter.state !== "patrol" ? this.world.hunterDecision : "平静";
    this.$("#escape-hunt-state").textContent = huntState;
    this.$<HTMLMeterElement>("#escape-effort").value = effort; this.$("#escape-effort-value").textContent = String(Math.round(effort));
    for (const [id, source] of [["noise", perception.contributions.noise], ["glare", perception.contributions.glare], ["sight", perception.contributions.sight]] as const) {
      this.$<HTMLMeterElement>(`#escape-${id}`).value = source.score;
      this.$(`#escape-${id}-value`).textContent = String(Math.round(source.score));
      this.$(`#escape-${id}-contribution`).textContent = `≈${Number(source.points.toFixed(1))}分 · ${Math.round(source.share)}%`;
    }
    const hearing = this.world.hearing;
    const actionNames = { walk: "步行", crouch: "蹲行", sprint: "跑步", still: "静止" } as const;
    const hearingDetail = `${actionNames[hearing.action]} · 距${hearing.distance.toFixed(1)}米\n${hunt?.freeze ? "感知暂停" : hearing.audible ? `可闻 +${hearing.rate.toFixed(1)}/秒` : "未听见"}${hearing.breathing ? " · 喘息" : ""}`;
    this.$("#escape-noise-info").textContent = hearingDetail;
    const vision = this.world.vision;
    this.$("#escape-sight-info").textContent = `${vision.visible ? `被看到 · ${vision.distance.toFixed(1)}米` : "未被看到"}${vision.rate > 0 ? `\n+${vision.rate.toFixed(1)}/秒` : ""}`;
    const light = this.world.lightPerception;
    this.$("#escape-glare-info").textContent = `${light.illuminated ? "正照中奶蛙" : "未照中奶蛙"}${light.rate > 0 ? ` · +${light.rate.toFixed(1)}/秒` : ""}`;
    const modeNames = { walk: "步行", crouch: "蹲行", sprint: "奔跑", recover: "步行恢复体力", hidden: "藏匿中" };
    this.$("#escape-movement").textContent = `${modeNames[this.world.movementMode]}${matchMedia("(pointer:fine)").matches ? " · Shift 切换奔跑 · C 蹲行" : " · 点按切换姿态"}`;
    this.$("#escape-stick").dataset.mode = modeNames[this.world.movementMode];
    this.$("#escape-effort-label").textContent = hunt?.panting ? "喘息" : "疲劳";
    this.$(".escape-hunt").classList.toggle("critical", d.hunter.state === "chase" || exposure === 100);
    this.$(".escape-meters").classList.toggle("panting", !!hunt?.panting);
    this.$(".escape-hunt").classList.toggle("alert", (hunt?.alert ?? 0) > 0);
    const freeze = hunt?.freeze ?? 0, reveal = hunt?.reveal ?? 0;
    const dx = d.hunter.x - d.player.x, dz = d.hunter.z - d.player.z;
    const bearing = Math.atan2(dz, dx) - d.player.angle;
    const wrappedBearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    const direction = this.$<HTMLElement>("#escape-hunter-bearing");
    direction.hidden = reveal <= 0 || Math.abs(wrappedBearing) < 1.35;
    direction.classList.toggle("left", wrappedBearing < 0);
    direction.textContent = wrappedBearing < 0 ? "‹ 奶蛙" : "奶蛙 ›";
    direction.setAttribute("aria-label", wrappedBearing < 0 ? "奶蛙在左侧" : "奶蛙在右侧");
    const freezeButton = this.$<HTMLButtonElement>("#escape-freeze"), revealButton = this.$<HTMLButtonElement>("#escape-reveal");
    freezeButton.disabled = this.world.crystalCharges("freeze") <= 0 || freeze > 0;
    revealButton.disabled = this.world.crystalCharges("reveal") <= 0 || reveal > 0;
    this.$("#escape-freeze-count").textContent = String(this.world.crystalCharges("freeze")); this.$("#escape-reveal-count").textContent = String(this.world.crystalCharges("reveal"));
    this.$("#escape-freeze-time").textContent = freeze > 0 ? `剩 ${freeze.toFixed(1)}s` : "持续10秒";
    this.$("#escape-reveal-time").textContent = reveal > 0 ? `剩 ${reveal.toFixed(1)}s` : "持续10秒";
    freezeButton.classList.toggle("active", freeze > 0); revealButton.classList.toggle("active", reveal > 0);
    this.$("#escape-night").textContent = `第${Math.min(3, d.captures + 1)}夜 · ${time(d.elapsed)}`;
    this.$("#escape-crouch").setAttribute("aria-pressed", String(d.player.crouched));
    this.$("#escape-sprint").setAttribute("aria-pressed", String(d.player.sprinting ?? false));
    this.$("#escape-crouch").setAttribute("aria-label", d.player.crouched ? "切换站立，按 C 切换" : "切换蹲行，按 C 切换");
    this.$("#escape-light").setAttribute("aria-pressed", String(d.player.light));
    this.$("#escape-stones").textContent = String(d.stones);
    this.$("#escape-stone").setAttribute("aria-label", `丢石子，剩余${d.stones}颗`);
    this.$("#escape-search").hidden = !this.world.pending;
    this.$<HTMLProgressElement>("#escape-search progress").value = this.world.pending ? 1.15 - this.world.pending.remaining : 0;
    for (const meter of this.root.querySelectorAll<HTMLMeterElement>("meter")) meter.style.setProperty("--fill", `${meter.value}%`);
    this.renderer?.drawMap(this.$("#escape-minimap"), this.world, true);
  }
  private beginRoomCue() {
    this.lastRoom = this.world.room;
    this.roomCueUntil = this.world.data.elapsed + 1.6;
  }
  destroy() {
    if (this.disposed) return; this.save(); this.disposed = true; this.cinematic?.close(); this.controller.abort(); cancelAnimationFrame(this.raf); this.audio.setPlaying(false); this.audio.stopPreview();
    if (this.renderer && this.art) returnPreparedEscape({ renderer: this.renderer, art: this.art, canvas: this.$("#escape-view") });
    this.renderer = undefined;
  }
}
