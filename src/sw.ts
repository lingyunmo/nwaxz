/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import type { WorkboxPlugin } from "workbox-core/types.js";
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from "workbox-precaching";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { version } from "../package.json";

declare const self: ServiceWorkerGlobalScope;
type Entry = { url: string; revision?: string | null; bytes: number };
const manifest = self.__WB_MANIFEST as Entry[];
const receiving = new Map<string, number>();
let failure = "";
let preparing: Promise<void> | undefined;
const progress: WorkboxPlugin = {
  fetchDidSucceed: async ({ request, response, event }) => {
    if (response.ok && response.body) {
      // Observe a clone, preserving headers and the original response for media.
      const reader = response.clone().body!.getReader();
      receiving.set(request.url, 0);
      const observe = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            receiving.set(request.url, (receiving.get(request.url) ?? 0) + value.byteLength);
          }
        } catch { receiving.delete(request.url); }
      };
      event.waitUntil(observe());
    }
    return response;
  },
};
const precache = new PrecacheController({ plugins: [new RangeRequestsPlugin(), progress] });
precache.addToCacheList(manifest);
registerRoute(new PrecacheRoute(precache));
registerRoute(new NavigationRoute(precache.createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//, /^\/game-worker/] }));
cleanupOutdatedCaches();
clientsClaim();

function prepare(event: ExtendableEvent) {
  if (!preparing) {
    failure = "";
    preparing = (async () => {
      const entries = [...precache.getURLsToCacheKeys()];
      let next = 0;
      // Bound concurrency: avoid a round trip per shader, without flooding phones.
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (next < entries.length) {
          const [url, cacheKey] = entries[next++];
          await Promise.all(precache.strategy.handleAll({
            event, params: { cacheKey, integrity: precache.getIntegrityForCacheKey(cacheKey) },
            request: new Request(url, { credentials: "same-origin", cache: cacheKey === url ? "default" : "reload" }),
          }));
        }
      }));
    })().catch(error => { failure = "资源未能保存，请检查网络和设备存储空间。"; throw error; }).finally(() => { preparing = undefined; });
  }
  return preparing;
}
self.addEventListener("install", event => { event.waitUntil(prepare(event)); });
self.addEventListener("activate", event => { void precache.activate(event); });
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") { void self.skipWaiting(); return; }
  if (event.data?.type !== "PREPARE_GAME") return;
  if (event.data.repair) event.waitUntil(prepare(event).catch(() => {}));
  event.waitUntil((async () => {
    const cache = await caches.open(precache.strategy.cacheName);
    const present = new Set((await cache.keys()).map(request => request.url));
    let done = 0, loadedBytes = 0, totalBytes = 0;
    for (const entry of manifest) {
      const url = new URL(entry.url, self.location.href).href;
      const ready = present.has(precache.getCacheKeyForURL(url)!);
      totalBytes += entry.bytes;
      if (ready) { done++; loadedBytes += entry.bytes; }
      else loadedBytes += Math.min(entry.bytes, receiving.get(url) ?? 0);
    }
    event.ports[0]?.postMessage({ version, done, total: manifest.length, loadedBytes, totalBytes, error: failure });
  })());
});
