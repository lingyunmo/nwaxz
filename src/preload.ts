import { version } from "../package.json";

export type PreloadStatus = { version: string; done: number; total: number; loadedBytes: number; totalBytes: number; error: string };
function status(worker: ServiceWorker, repair = false): Promise<PreloadStatus | undefined> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (value?: PreloadStatus) => { clearTimeout(timer); channel.port1.close(); resolve(value); };
    const timer = window.setTimeout(() => finish(), 1000);
    channel.port1.onmessage = event => finish(event.data as PreloadStatus);
    try { worker.postMessage({ type: "PREPARE_GAME", repair }, [channel.port2]); }
    catch { finish(); }
  });
}

/** Wait for the current revision, including whole videos, to be saved on device. */
export async function preloadGame(onProgress: (value: PreloadStatus) => void, retry: () => void = () => {}) {
  if (!("serviceWorker" in navigator) || !("caches" in window)) throw new Error("此浏览器无法预存完整游戏，可重试或直接进入。");
  let lastChange = performance.now(), lastBytes = -1, lastDone = -1;
  let repairRequested: ServiceWorker | undefined, lastRetry = 0;
  for (;;) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const workers = [registration?.installing, registration?.waiting, registration?.active].filter((worker): worker is ServiceWorker => !!worker);
    if (!workers.length && navigator.onLine && performance.now() - lastRetry > 2000) { lastRetry = performance.now(); retry(); }
    for (const worker of workers) {
      const value = await status(worker);
      if (!value || value.version !== version) continue;
      if (value.error) throw new Error(value.error);
      onProgress(value);
      if (value.loadedBytes !== lastBytes || value.done !== lastDone) { lastChange = performance.now(); lastBytes = value.loadedBytes; lastDone = value.done; }
      if (worker.state === "activated") {
        if (value.done === value.total && value.total > 0) return;
        if (repairRequested !== worker) { repairRequested = worker; void status(worker, true); }
      }
      // A new page may be waiting for its worker to replace the older controller.
      if (worker.state === "installed") worker.postMessage({ type: "SKIP_WAITING" });
      break;
    }
    if (performance.now() - lastChange > 30000 && !document.hidden) throw new Error(navigator.onLine ? "下载暂时停住了，请重试。已经保存的资源会继续保留。" : "网络已断开，游戏尚未准备完整。联网后可以继续。");
    if (document.hidden) lastChange = performance.now();
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
