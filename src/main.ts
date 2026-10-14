import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { levels } from "./game/levels";
import { BathGame } from "./game/renderer";
import {
  emptyProgress,
  loadProgress,
  mergeProgress,
  parseProgress,
  saveProgress,
  starCount,
  type Progress,
} from "./progress";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="header"><a class="brand" href="/"><img src="/icon.svg" alt=""/><span>奶娃爱洗澡<small>NWAXZ</small></span></a><span class="version">第一章 · 等水的奶蛙</span></header>
  <main class="layout">
    <aside class="sidebar"><span class="eyebrow">一缸清水，一点小聪明。</span><h1>奶蛙在等你<br/>接一缸水。</h1><p class="intro">划开泥土，让水沿着你挖出的路流进浴缸。顺路收集三枚泡泡币，给奶蛙洗个痛快澡。</p>
      <nav id="levels" aria-label="选择关卡"></nav>
      <section class="save-panel"><div class="save-heading"><h2>我的进度</h2><span id="save-count">0 / 3 关</span></div><p id="save-status" role="status" aria-live="polite">正在读取本机进度…</p><div class="save-actions"><button id="export">导出存档</button><button id="import">导入存档</button></div><input id="import-file" type="file" accept="application/json,.json" hidden/></section>
      <div class="instructions"><p>手指划动 / 按住鼠标：挖土</p><p>方向键：移动光标 · 空格：挖土</p><p>按住 Shift + 方向键：连续挖土</p></div>
    </aside>
    <section class="game-panel" aria-label="奶娃爱洗澡游戏"><div class="toolbar"><div><span class="eyebrow" id="level-number">关卡 01</span><h2 id="level-title">第一缸水</h2></div><div class="tools"><button id="pause" aria-pressed="false">暂停</button><button id="restart">重来 ↻</button></div></div>
      <div class="game-shell"><canvas id="game" tabindex="0" aria-label="挖土引水游戏。按住鼠标或划动手指挖土。也可用方向键移动光标，空格挖土，Shift加方向键连续挖土。"></canvas>
        <div id="result" class="result" hidden><span class="result-icon">✓</span><h2>奶蛙洗上澡了！</h2><p id="result-detail"></p><div class="result-actions"><button id="replay">再试一次</button><button id="next" class="primary">下一关 →</button></div></div>
      </div>
      <div class="game-footer"><p id="hint"></p><div class="meter"><span id="water-count">0 / 100</span><progress id="water-meter" max="100" value="0" aria-label="浴缸水量"></progress><span id="coins" aria-label="泡泡币">○ ○ ○</span></div></div>
    </section>
  </main>
  <footer class="page-footer"><span id="offline-status">进度保存在本机 · 已缓存内容可离线游玩</span><button id="update" hidden>新版本可用，点击更新</button></footer>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let progress: Progress = emptyProgress(),
  selected = 0,
  game: BathGame | undefined;
const channel =
  typeof BroadcastChannel === "undefined"
    ? undefined
    : new BroadcastChannel("nwaxz-progress");
const status = (message: string) => {
  $("#save-status").textContent = message;
};

function renderProgress() {
  $("#save-count").textContent =
    `${levels.filter((level) => progress.levels[level.id]?.completed).length} / 3 关`;
  $("#levels").replaceChildren(
    ...levels.map((level, index) => {
      const button = document.createElement("button"),
        record = progress.levels[level.id];
      button.className = `level-card${selected === index ? " selected" : ""}`;
      button.disabled =
        index > 0 && !progress.levels[levels[index - 1].id]?.completed;
      button.setAttribute(
        "aria-current",
        selected === index ? "step" : "false",
      );
      const number = document.createElement("span");
      number.className = "level-index";
      number.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.textContent = level.title;
      const detail = document.createElement("small");
      detail.textContent = button.disabled
        ? "上一关通关后解锁"
        : record?.completed
          ? `${starCount(record.collected)} / 3 泡泡币 · 已通关`
          : "等你来接水";
      name.append(detail);
      button.append(number, name);
      button.onclick = () => start(index);
      return button;
    }),
  );
}
function start(index: number) {
  if (index > 0 && !progress.levels[levels[index - 1].id]?.completed) return;
  selected = index;
  game?.destroy();
  $("#result").hidden = true;
  $("#pause").textContent = "暂停";
  $("#pause").setAttribute("aria-pressed", "false");
  $("#level-number").textContent = `关卡 ${String(index + 1).padStart(2, "0")}`;
  $("#level-title").textContent = levels[index].title;
  $("#hint").textContent = levels[index].hint;
  renderProgress();
  let lastWater = -1,
    lastCoins = -1;
  game = new BathGame($<HTMLCanvasElement>("#game"), levels[index], {
    progress(water, mask) {
      if (lastWater !== water) {
        $("#water-count").textContent = `${Math.min(100, water)} / 100`;
        $<HTMLProgressElement>("#water-meter").value = Math.min(100, water);
        lastWater = water;
      }
      if (lastCoins !== mask) {
        $("#coins").textContent = [0, 1, 2]
          .map((i) => (mask & (1 << i) ? "●" : "○"))
          .join(" ");
        $("#coins").setAttribute(
          "aria-label",
          `已收集 ${starCount(mask)} 枚泡泡币`,
        );
        lastCoins = mask;
      }
    },
    complete(mask) {
      const incoming = emptyProgress();
      incoming.levels[levels[index].id] = { completed: true, collected: mask };
      progress = mergeProgress(progress, incoming);
      renderProgress();
      void persist(progress);
      $("#result").hidden = false;
      $("#result-detail").textContent =
        `这次收集了 ${starCount(mask)} / 3 枚泡泡币。`;
      $("#next").textContent =
        index === levels.length - 1 ? "三关完成，再洗一次" : "下一关 →";
    },
    tap() {
      $("#hint").textContent = game?.won
        ? "洗澡水来了，奶蛙开心得合不拢嘴。"
        : "奶蛙敲了敲水龙头：水呢？水呢？";
    },
  });
}
async function persist(value: Progress) {
  try {
    progress = await saveProgress(value);
    renderProgress();
    status("已保存到这台设备");
    channel?.postMessage("changed");
  } catch {
    status("本机存档写入失败，请先导出当前进度。");
  }
}
$("#restart").onclick = () => start(selected);
$("#replay").onclick = () => start(selected);
$("#next").onclick = () =>
  start(selected === levels.length - 1 ? 0 : selected + 1);
$("#pause").onclick = () => {
  if (!game) return;
  game.paused = !game.paused;
  $("#pause").textContent = game.paused ? "继续" : "暂停";
  $("#pause").setAttribute("aria-pressed", String(game.paused));
};
$("#export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "nwaxz-save.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#import").onclick = () => $<HTMLInputElement>("#import-file").click();
$<HTMLInputElement>("#import-file").onchange = async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 16384) throw new Error("存档过大");
    await persist(
      mergeProgress(progress, parseProgress(JSON.parse(await file.text()))),
    );
  } catch {
    status("导入失败：存档格式不正确，现有进度仍保留。");
  } finally {
    input.value = "";
  }
};
channel?.addEventListener("message", () => {
  void loadProgress()
    .then((value) => {
      progress = mergeProgress(progress, value);
      renderProgress();
    })
    .catch(() => {});
});
window.addEventListener("offline", () => {
  $("#offline-status").textContent = "离线游玩 · 进度保存在本机";
});
window.addEventListener("online", () => {
  $("#offline-status").textContent = "网络已连接 · 进度保存在本机";
});
const updateSW = registerSW({
  onOfflineReady() {
    $("#offline-status").textContent = "游戏与奶蛙已缓存，可以离线游玩";
  },
  onNeedRefresh() {
    $("#update").hidden = false;
  },
});
$("#update").onclick = () => {
  void updateSW(true);
};
try {
  progress = await loadProgress();
  status("进度保存在这台设备");
} catch {
  status("无法读取本机进度。可先游玩，再导出备份。");
}
start(0);
