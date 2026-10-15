import "./style.css";
import { version } from "../package.json";
import { registerSW } from "virtual:pwa-register";
import { levels } from "./game/levels";
import { BathGame, type RunResult } from "./game/renderer";
import { artworkPaths, loadArtwork, type Artwork } from "./artwork";
import { AudioManager } from "./audio";
import { loadSettings, saveSettings, type Settings } from "./settings";
import {
  emptyProgress,
  loadProgress,
  mergeProgress,
  parseProgress,
  saveProgress,
  starCount,
  scoreRun,
  formatTime,
  type Progress,
} from "./progress";

const app = document.querySelector<HTMLDivElement>("#app")!;
let progress: Progress = emptyProgress(),
  settings = loadSettings(),
  art: Artwork;
let game: BathGame | undefined,
  selected = 0,
  chapter = 1,
  screen: "loading" | "home" | "levels" | "play" = "loading";
let offlineReady = false,
  updateAvailable = false,
  toastTimer = 0;
const audio = new AudioManager(settings);
const chapterCount = Math.max(...levels.map(level => level.chapter ?? 1));
const chapterNames: { [chapter: number]: string } = { 1: "等水的奶蛙", 2: "风和水的小机关", 3: "清水的守护者", 4: "暖暖水工坊" };
const channel =
  typeof BroadcastChannel === "undefined"
    ? undefined
    : new BroadcastChannel("nwaxz-progress");
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  app.querySelector<T>(selector)!;
const icons = {
  back: '<path d="m15 5-7 7 7 7"/>',
  settings:
    '<path d="m10 3-.6 2.2-2.1 1.2-2.2-.5-2 3.4 1.6 1.7v2.4L3.1 15l2 3.4 2.2-.5 2.1 1.2L10 21h4l.6-2.2 2.1-1.2 2.2.5 2-3.4-1.6-1.7v-2.4l1.6-1.7-2-3.4-2.2.5-2.1-1.2L14 3Z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  restart: '<path d="M4 9a8 8 0 1 1 1 9M4 3v6h6"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  drop: '<path d="M12 2S4 10 4 15a8 8 0 0 0 16 0c0-5-8-13-8-13Z"/>',
};
const icon = (name: keyof typeof icons) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const buttonIcon = (name: keyof typeof icons, label: string, id: string) =>
  `<button class="icon-button" id="${id}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
const stars = (count: number) =>
  `<span class="stars" aria-label="${count} / 3 泡泡币">${[0, 1, 2].map((i) => `<span class="${i < count ? "earned" : ""}">${icon("star")}</span>`).join("")}</span>`;
const totalCoins = () =>
  levels.reduce(
    (sum, level) => sum + starCount(progress.levels[level.id]?.collected ?? 0),
    0,
  );
const unlocked = (index: number) =>
  index === 0 || Boolean(progress.levels[levels[index - 1].id]?.completed);
const scoreText = (value: number) => value.toLocaleString("zh-CN");
function chrome(content: string) {
  app.innerHTML = `${content}<dialog id="dialog" aria-labelledby="dialog-title"></dialog><div id="toast" class="toast" role="status" aria-live="polite" hidden></div>`;
}
function toast(message: string) {
  const dialog = app.querySelector<HTMLDialogElement>("dialog[open]");
  let element =
    dialog?.querySelector<HTMLElement>(".modal-feedback") ??
    app.querySelector<HTMLElement>("#toast");
  if (dialog && !dialog.querySelector(".modal-feedback")) {
    element = document.createElement("p");
    element.className = "modal-feedback";
    element.setAttribute("role", "status");
    dialog.append(element);
  }
  if (!element) return;
  clearTimeout(toastTimer);
  element.textContent = message;
  element.hidden = false;
  toastTimer = window.setTimeout(() => {
    element.hidden = true;
  }, 4000);
}
function leaveGame() {
  game?.destroy();
  game = undefined;
  audio.setPlaying(false);
  if (document.fullscreenElement === document.documentElement)
    void document.exitFullscreen().catch(() => {});
}
function renderHome() {
  leaveGame();
  screen = "home";
  chrome(
    `<main class="menu-stage home-screen screen-enter" aria-label="游戏主界面"><img class="cover-art" src="/assets/scenes/bath-cover-v2.webp" alt="奶蛙站在冒泡泡的浴缸旁"/><h1 class="game-logo"><span>奶蛙</span><span>爱洗澡</span></h1><div class="home-top">${buttonIcon("settings", "设置", "settings")}</div><div class="home-actions"><button id="normal" class="game-button gold">普通模式 ${icon("play")}</button><button id="continue" class="game-button glass">继续洗澡</button></div><div class="home-status"><span>${totalCoins()} / ${levels.length * 3} 泡泡币</span><button id="update" ${updateAvailable ? "" : "hidden"}>有新版本 ${icon("restart")}</button></div></main>`,
  );
  $("#normal").onclick = () => {
    audio.unlock();
    audio.effect("tap");
    renderLevels();
  };
  $("#continue").onclick = () => {
    const first = levels.findIndex(
      (level, i) => unlocked(i) && !progress.levels[level.id]?.completed,
    );
    enterLevel(first < 0 ? selected : first);
  };
  $("#settings").onclick = () => openSettings();
  $("#update").onclick = applyUpdate;
}
function renderLevels() {
  leaveGame();
  screen = "levels";
  chrome(
    `<main class="menu-stage chapter-screen screen-enter" aria-label="普通模式选关"><img class="cover-art chapter-art" src="/assets/scenes/bath-cover-v2.webp" alt=""/><header class="menu-header">${buttonIcon("back", "返回主界面", "home")}<h1>普通模式</h1><span class="coin-badge">${icon("star")}${totalCoins()} / ${levels.length * 3}</span></header><div class="chapter-heading"><div class="chapter-pager"><button id="previous-chapter" aria-label="上一章" ${chapter === 1 ? "disabled" : ""}>‹</button><span>第${["", "一", "二", "三", "四"][chapter] ?? chapter}章</span><button id="next-chapter" aria-label="下一章" ${chapter === chapterCount ? "disabled" : ""}>›</button></div><h2>${chapterNames[chapter] ?? "新的水路"}</h2></div><nav class="level-map" aria-label="选择关卡">${levels
      .map((level, index) => {
        if ((level.chapter ?? 1) !== chapter) return "";
        const record = progress.levels[level.id],
          locked = !unlocked(index);
        const score =
          record?.bestScore !== undefined
            ? `最高分 <b>${scoreText(record.bestScore)}</b>${record.bestTimeMs !== undefined ? `<small>最快 ${formatTime(record.bestTimeMs)}</small>` : ""}`
            : record?.completed
              ? "已通关 · 再玩一次记录分数"
              : "还没洗上澡";
        return `<button class="level-stop ${locked ? "locked" : record?.completed ? "completed" : ""}" data-level="${index}" ${locked ? "disabled" : ""} aria-label="第${index + 1}关 ${level.title}${locked ? "，尚未解锁" : ""}"><span class="level-number">${locked ? icon("lock") : String(index + 1).padStart(2, "0")}</span><span class="level-info"><strong>${level.title}</strong>${stars(starCount(record?.collected ?? 0))}<span class="level-score">${locked ? "上一关通关后解锁" : score}</span></span>${locked ? "" : `<span class="level-go">${icon("play")}</span>`}</button>`;
      })
      .join(
        "",
      )}</nav><button id="settings" class="chapter-settings icon-button" aria-label="设置">${icon("settings")}</button></main>`,
  );
  $("#home").onclick = renderHome;
  $("#settings").onclick = () => openSettings();
  $("#previous-chapter").onclick = () => { chapter = Math.max(1, chapter - 1); renderLevels(); };
  $("#next-chapter").onclick = () => { chapter = Math.min(chapterCount, chapter + 1); renderLevels(); };
  for (const element of app.querySelectorAll<HTMLButtonElement>("[data-level]"))
    element.onclick = () => enterLevel(Number(element.dataset.level));
}
function enterLevel(index: number) {
  if (!unlocked(index)) return;
  audio.unlock();
  audio.effect("tap");
  if (!document.fullscreenElement && document.documentElement.requestFullscreen)
    void document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .catch(() => {});
  game?.destroy();
  selected = index;
  chapter = levels[index].chapter ?? 1;
  screen = "play";
  const level = levels[index];
  const devices = [
    ...(level.fans ?? []).map((fan, i) => ({ point: fan.position, kind: "fan", index: i, label: "风扇" })),
    ...(level.valves ?? []).map((valve, i) => ({ point: valve.position, kind: "valve", index: i, label: valve.kind === "sewage" ? "污水阀" : "清水阀" })),
    ...(level.sponges ?? []).map((sponge, i) => ({ point: sponge.position, kind: "sponge", index: i, label: level.sponges!.length > 1 ? `${i + 1}号海绵` : "海绵" })),
  ];
  chrome(
    `<main class="play-screen screen-enter" aria-label="游戏关卡"><div class="game-stage"><canvas id="game" tabindex="0" aria-label="挖土引水游戏。划动手指或按住鼠标挖土；方向键移动，空格挖土，Shift加方向键连续挖土；F切换风扇，V切换清水阀，B切换污水阀，E挤出海绵的水。"></canvas><div class="play-hud"><div class="hud-buttons">${buttonIcon("pause", "暂停游戏", "pause")}${buttonIcon("restart", "重新开始", "restart")}</div><div class="water-badge">${icon("drop")}<progress id="water-meter" max="100" value="0" aria-label="浴缸水量"></progress><span id="water-count">0 / 100</span></div><div id="hud-coins" class="hud-coins" aria-label="已收集0枚泡泡币">${stars(0)}</div></div>${devices.map(device => `<button class="device-control" data-device="${device.kind}-${device.index}" aria-label="${device.label}" aria-pressed="false"></button>`).join("")}<div id="result" class="result-layer" hidden></div><div id="gesture-hint" class="gesture-hint" ${progress.levels[level.id]?.completed ? "hidden" : ""}>${level.hint}</div></div></main>`,
  );
  $(".play-screen").classList.toggle("workshop", level.scene === "workshop");
  for (const device of devices) {
    const control = $(`[data-device="${device.kind}-${device.index}"]`);
    control.style.left = `${device.point.x / 480 * 100}%`;
    control.style.top = `${device.point.y / 800 * 100}%`;
  }
  let lastCoins = 0,
    lastWater = -1,
    hintCleared = false,
    deviceState = "";
  game = new BathGame(
    $<HTMLCanvasElement>("#game"),
    levels[index],
    {
      progress(water, mask) {
        if (lastWater !== water) {
          $("#water-count").textContent = `${Math.min(100, water)} / 100`;
          $<HTMLProgressElement>("#water-meter").value = Math.min(100, water);
          lastWater = water;
        }
        if (lastCoins !== mask) {
          $("#hud-coins").innerHTML = stars(starCount(mask));
          $("#hud-coins").setAttribute(
            "aria-label",
            `已收集${starCount(mask)}枚泡泡币`,
          );
          audio.effect("coin");
          lastCoins = mask;
        }
      },
      complete: finishLevel,
      failed: finishFailed,
      devices(interacted = false) {
        if (!game || !devices.length) return;
        if (interacted) $("#gesture-hint").hidden = true;
        const state = JSON.stringify([game.world.fanOn, game.world.valveOn, game.world.valveRemaining.map(n => n === 0), game.world.spongeContents.map(particles => particles.length > 0), game.won, game.lost]);
        if (state === deviceState) return;
        deviceState = state;
        for (const device of devices) {
          const control = $<HTMLButtonElement>(`[data-device="${device.kind}-${device.index}"]`);
          const on = device.kind === "fan" ? game.world.fanOn[device.index] : device.kind === "valve" ? game.world.valveOn[device.index] : game.world.spongeContents[device.index].length > 0;
          const empty = device.kind === "valve" && game.world.valveRemaining[device.index] === 0;
          if (device.kind === "sponge") control.removeAttribute("aria-pressed");
          else control.setAttribute("aria-pressed", String(on));
          control.setAttribute("aria-label", device.kind === "sponge" ? on ? `挤出${device.label}里的水` : `${device.label}正在等待吸水` : empty ? `${device.label}水量已用完` : `${on ? "关闭" : "开启"}${device.label}`);
          control.disabled = empty || (device.kind === "sponge" && !on) || game.won || game.lost;
        }
      },
      tap() {
        audio.effect("tap");
      },
      dig() {
        audio.effect("dig");
        if (!hintCleared && !devices.length) {
          $("#gesture-hint").hidden = true;
          hintCleared = true;
        }
      },
    },
    { art, reducedMotion: settings.reducedMotion, quality: settings.quality },
  );
  $("#pause").onclick = openPause;
  $("#restart").onclick = openRestart;
  for (const device of devices)
    $(`[data-device="${device.kind}-${device.index}"]`).onclick = () => {
      game?.activateDevice(device.point);
      $("#gesture-hint").hidden = true;
      $("#game").focus({ preventScroll: true });
    };
  audio.setPlaying(true);
  $("#game").focus({ preventScroll: true });
}
async function persist(value: Progress) {
  try {
    progress = await saveProgress(value);
    channel?.postMessage("changed");
    return true;
  } catch {
    toast("存档未能写入，请到设置里导出备份。");
    return false;
  }
}
function finishLevel(result: RunResult) {
  audio.setPlaying(false);
  audio.effect("win");
  const score = scoreRun(result.collected, result.elapsedMs),
    previous = progress.levels[levels[selected].id]?.bestScore;
  const incoming = emptyProgress();
  incoming.levels[levels[selected].id] = {
    completed: true,
    collected: result.collected,
    bestScore: score,
    bestTimeMs: result.elapsedMs,
  };
  progress = mergeProgress(progress, incoming);
  void persist(progress);
  $<HTMLButtonElement>("#pause").disabled = true;
  $<HTMLButtonElement>("#restart").disabled = true;
  $("#gesture-hint").hidden = true;
  const showCelebration = () => {
    $("#result").hidden = false;
    $("#result").classList.add("celebration-layer");
    $("#result").innerHTML = `<section class="celebration-card" aria-label="奶蛙通关庆祝"><h1>洗澡成功！</h1>${stars(starCount(result.collected))}<p>奶蛙开心得捧腹大笑</p><button id="show-score" class="game-button gold">查看成绩 ${icon("play")}</button></section>`;
    $("#show-score").onclick = showScore;
    $("#show-score").focus({ preventScroll: true });
  };
  const showScore = () => {
    $("#result").classList.remove("celebration-layer");
    $("#result").innerHTML =
      `<section class="result-card" aria-label="通关结算"><span class="result-kicker">奶蛙洗上澡啦！</span><h1>洗澡成功</h1>${stars(starCount(result.collected))}<div class="score-value">${scoreText(score)}<small>分</small></div><span class="score-record">${previous === undefined || score > previous ? "新纪录！" : `最高分 ${scoreText(previous)}`}</span><div class="result-stats"><span>通关用时<strong>${formatTime(result.elapsedMs)}</strong></span><span>泡泡币<strong>${starCount(result.collected)} / 3</strong></span></div><p class="score-breakdown">接水 1000 + 泡泡币 ${starCount(result.collected) * 500} + 时间奖励 ${score - 1000 - starCount(result.collected) * 500}</p><button id="next" class="game-button gold">${selected < levels.length - 1 ? (levels[selected + 1].chapter ?? 1) !== chapter ? "进入下一章" : "下一关" : "普通模式完成 · 回到选关"} ${icon("play")}</button><div class="result-secondary"><button id="replay">${icon("restart")}再玩一次</button><button id="level-menu">返回选关</button></div></section>`;
    $("#next").onclick = () =>
      selected < levels.length - 1 ? enterLevel(selected + 1) : renderLevels();
    $("#replay").onclick = () => enterLevel(selected);
    $("#level-menu").onclick = renderLevels;
    const watchAgain = document.createElement("button");
    watchAgain.textContent = "再看庆祝";
    watchAgain.onclick = showCelebration;
    $(".result-secondary").append(watchAgain);
    $("#next").focus({ preventScroll: true });
  };
  showCelebration();
}
function finishFailed() {
  audio.setPlaying(false);
  audio.effect("tap");
  $("#gesture-hint").hidden = true;
  $("#result").hidden = false;
  const tip = levels[selected].plants?.length ? "先让水草吸收完紫水，等它枯萎后，再打开清水阀门。" : "保留污水池下方的泥土，再给清水挖一条路吧。";
  $("#result").innerHTML = `<section class="result-card failure-card" aria-label="本次挑战失败"><span class="result-kicker">清水被污染了</span><h1>水变脏啦！</h1><p class="dialog-copy">污水流进浴缸，奶蛙还不能洗澡。${tip}</p><button id="retry" class="game-button gold">再试一次 ${icon("restart")}</button><button id="failed-menu" class="game-button cream">返回选关</button></section>`;
  $("#retry").onclick = () => enterLevel(selected);
  $("#failed-menu").onclick = renderLevels;
}
function showDialog(content: string, onClose: () => void = () => {}) {
  const previous = $<HTMLDialogElement>("#dialog");
  previous.onclose = null;
  previous.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "dialog";
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.innerHTML = `${content}<input id="import-file" type="file" accept="application/json,.json" hidden/>`;
  dialog.querySelector<HTMLInputElement>("#import-file")!.onchange = importSave;
  app.append(dialog);
  dialog.onclose = onClose;
  dialog.showModal();
  return dialog;
}
const dialogTop = (title: string) =>
  `<div class="dialog-top"><h2 id="dialog-title">${title}</h2>${buttonIcon("close", "关闭", "dialog-close")}</div>`;
function openPause() {
  if (!game || game.won || game.lost || $<HTMLDialogElement>("#dialog").open) return;
  game.paused = true;
  audio.setPlaying(false);
  const dialog = showDialog(
    `${dialogTop("休息一下")}<div class="pause-mascot"><img src="/assets/character/wait.webp" alt="奶蛙正在等你"/></div><button id="resume" class="game-button gold">继续洗澡 ${icon("play")}</button><button id="pause-settings" class="game-button cream">设置 ${icon("settings")}</button><div class="dialog-links"><button id="pause-restart">重新开始</button><button id="quit">退出选关</button></div>`,
    () => {
      if (game && !game.won && screen === "play") {
        game.paused = false;
        audio.setPlaying(true);
        $("#game").focus({ preventScroll: true });
      }
    },
  );
  $("#dialog-close").onclick = () => dialog.close();
  $("#resume").onclick = () => dialog.close();
  $("#pause-settings").onclick = () => {
    dialog.onclose = null;
    dialog.close();
    openSettings(true);
  };
  $("#pause-restart").onclick = () => {
    dialog.onclose = null;
    dialog.close();
    enterLevel(selected);
  };
  $("#quit").onclick = () => {
    dialog.onclose = null;
    dialog.close();
    renderLevels();
  };
}
function openRestart() {
  if (!game || $<HTMLDialogElement>("#dialog").open) return;
  game.paused = true;
  audio.setPlaying(false);
  const dialog = showDialog(
    `${dialogTop("重新接一缸水？")}<p class="dialog-copy">这一局会重新开始，已经保存的成绩会保留。</p><button id="confirm-restart" class="game-button gold">重新开始 ${icon("restart")}</button><button id="cancel-restart" class="game-button cream">继续这一局</button>`,
    () => {
      if (game && !game.won) {
        game.paused = false;
        audio.setPlaying(true);
      }
    },
  );
  $("#dialog-close").onclick = () => dialog.close();
  $("#cancel-restart").onclick = () => dialog.close();
  $("#confirm-restart").onclick = () => {
    dialog.onclose = null;
    dialog.close();
    enterLevel(selected);
  };
}
function openSettings(fromPause = false) {
  audio.unlock();
  const toggles: { key: keyof Settings; title: string; description: string }[] =
    [
      { key: "music", title: "背景音乐", description: "轻轻松松接一缸水" },
      {
        key: "sound",
        title: "游戏音效",
        description: "挖土、泡泡币和通关提示",
      },
      {
        key: "vibration",
        title: "触感反馈",
        description: "支持的设备上轻轻震一下",
      },
      {
        key: "reducedMotion",
        title: "简化动作",
        description: "减少跳动和姿态切换",
      },
    ];
  const dialog = showDialog(
    `${dialogTop("设置")}<div class="settings-options">${toggles.map(({ key, title, description }) => `<label class="setting-row"><span>${title}<small>${description}</small></span><input type="checkbox" role="switch" data-setting="${key}" ${settings[key] ? "checked" : ""}/><span class="switch-knob" aria-hidden="true"></span></label>`).join("")}<label class="setting-row"><span>画质<small>平衡模式适合大多数手机</small></span><select id="quality" aria-label="画质"><option value="balanced" ${settings.quality === "balanced" ? "selected" : ""}>平衡</option><option value="high" ${settings.quality === "high" ? "selected" : ""}>高清</option></select></label></div><div class="save-settings"><h3>我的存档</h3><span>${levels.filter((l) => progress.levels[l.id]?.completed).length} / ${levels.length} 关 · ${totalCoins()} 枚泡泡币</span><div><button id="export">导出存档</button><button id="import">导入存档</button></div><small>保存在这台设备，换设备可导入备份。</small></div><div class="settings-bottom"><span>${offlineReady ? "已准备好离线游玩" : navigator.onLine ? "游戏正在缓存" : "离线游玩"} · v${version}</span>${updateAvailable ? '<button id="settings-update">更新游戏</button>' : ""}<button id="help">怎么玩</button></div>`,
    () => {
      audio.stopPreview();
      if (fromPause) openPause();
      else if (screen === "levels") renderLevels();
      else renderHome();
    },
  );
  $("#dialog-close").onclick = () => dialog.close();
  const previews = document.createElement("div");
  previews.className = "audio-preview";
  previews.innerHTML = '<button id="preview-music">试听音乐</button><button id="preview-sound">试听音效</button><p id="audio-feedback" role="status" aria-live="polite">开启音乐后，关卡内会播放背景音乐。</p>';
  $(".settings-options").after(previews);
  const previewAudio = async (kind: "music" | "sound") => {
    const ready = await audio.preview(kind);
    if (!dialog.open) return;
    $("#audio-feedback").textContent = ready
      ? kind === "music" ? "正在试听音乐（4 秒）" : "提示音已播放；若仍无声，请检查设备音量和标签页静音。"
      : "声音未能开启，请再次点击试听。";
  };
  $("#preview-music").onclick = () => { void previewAudio("music"); };
  $("#preview-sound").onclick = () => { void previewAudio("sound"); };
  for (const input of app.querySelectorAll<HTMLInputElement>("[data-setting]"))
    input.onchange = () => {
      settings = { ...settings, [input.dataset.setting!]: input.checked };
      applySettings();
      audio.unlock();
      if (input.dataset.setting === "music") {
        if (input.checked) void previewAudio("music");
        else audio.stopPreview();
      }
      audio.effect("tap");
    };
  $<HTMLSelectElement>("#quality").onchange = () => {
    settings = {
      ...settings,
      quality: $<HTMLSelectElement>("#quality").value as Settings["quality"],
    };
    applySettings();
  };
  $("#export").onclick = exportSave;
  $("#import").onclick = () => $("#import-file").click();
  $("#help").onclick = () => {
    audio.stopPreview();
    dialog.onclose = null;
    dialog.close();
    openHelp(fromPause);
  };
  const update = app.querySelector<HTMLButtonElement>("#settings-update");
  if (update) update.onclick = applyUpdate;
}
function applySettings() {
  audio.setSettings(settings);
  game?.setPreferences(settings);
  document.documentElement.classList.toggle(
    "reduced-motion",
    settings.reducedMotion,
  );
  try {
    saveSettings(settings);
  } catch {
    toast("设置暂时无法保存。");
  }
}
function openHelp(fromPause = false) {
  const dialog = showDialog(
    `${dialogTop("接一缸水")}<ol class="how-to"><li>按住鼠标或划动手指，挖开泥土。</li><li>把清水引进右下方的管道，接够 100 滴水。</li><li>顺路收集 3 枚泡泡币，用时越短得分越高。</li><li>石板挖不动，要绕个弯。</li><li>轻点风扇可以推水；喷水阀可开关，水量有限。</li><li>紫色污水会污染清水，流进浴缸就要重试。</li><li>水草挡水，吸收紫水后会枯萎；海绵吸水，轻点可以挤水。</li></ol><p class="keyboard-help">键盘：方向键移动，空格挖土，Shift + 方向键连续挖土，F 切换风扇，V 切换清水阀，B 切换污水阀，E 挤水，Esc 暂停。</p><button id="help-ok" class="game-button gold">我知道啦</button>`,
    () => openSettings(fromPause),
  );
  $("#dialog-close").onclick = () => dialog.close();
  $("#help-ok").onclick = () => dialog.close();
}
function exportSave() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "nwaxz-save.json";
  link.hidden = true;
  const dialog = $<HTMLDialogElement>("#dialog");
  (dialog.open ? dialog : app).append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("存档备份已准备好。");
}
async function importSave(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 16384) throw new Error("too large");
    progress = mergeProgress(
      progress,
      parseProgress(JSON.parse(await file.text())),
    );
    if (await persist(progress)) toast("存档已合并，成绩会保留较好的记录。");
  } catch {
    toast("存档格式不正确，现有进度仍保留。");
  } finally {
    input.value = "";
  }
}
channel?.addEventListener("message", () => {
  void loadProgress()
    .then((value) => {
      progress = mergeProgress(progress, value);
      if (screen === "levels") renderLevels();
    })
    .catch(() => {});
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    screen === "play" &&
    !$<HTMLDialogElement>("#dialog").open
  ) {
    event.preventDefault();
    openPause();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "play") openPause();
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && screen === "play") openPause();
});
window.addEventListener("pagehide", () => audio.suspend());
window.addEventListener("pageshow", () => audio.resume());
const updateSW = registerSW({
  onOfflineReady() {
    offlineReady = true;
  },
  onNeedRefresh() {
    updateAvailable = true;
    const update = app.querySelector<HTMLButtonElement>("#update");
    if (update) update.hidden = false;
  },
});
if ("serviceWorker" in navigator && "caches" in window) {
  void navigator.serviceWorker.ready
    .then(async () => {
      const resources = [
        "/index.html",
        ...Object.values(artworkPaths),
      ];
      offlineReady = (
        await Promise.all(
          resources.map((url) => caches.match(url, { ignoreSearch: true })),
        )
      ).every(Boolean);
    })
    .catch(() => {});
}
function applyUpdate() {
  if (game && !game.won) {
    toast("请先结束这一局，再更新游戏。");
    return;
  }
  void updateSW(true);
}
async function boot() {
  try {
    const artwork = loadArtwork((done, total) => {
      const meter = app.querySelector<HTMLProgressElement>("#boot-progress");
      if (meter) meter.value = (done / total) * 90;
    });
    let saveReadFailed = false;
    const saved = loadProgress().catch(() => {
      saveReadFailed = true;
      return emptyProgress();
    });
    [art, progress] = await Promise.all([artwork, saved]);
    applySettings();
    renderHome();
    if (saveReadFailed) toast("暂时无法读取本机存档，现有数据仍保留。");
  } catch {
    const loading = app.querySelector<HTMLElement>(".boot-loading");
    if (loading) {
      loading.innerHTML =
        '<p>洗澡用品还没准备好，请检查网络再试。</p><button id="retry-load">重新加载</button>';
      $("#retry-load").onclick = () => location.reload();
    }
  }
}
void boot();
