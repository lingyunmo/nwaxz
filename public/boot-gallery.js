// Independent of the large game bundle: the reel starts while it downloads.
export function parsePlaylist(value) {
  if (!Array.isArray(value?.items)) return [];
  return value.items.slice(0,16).filter(item => item &&
    ["image","video"].includes(item.type) && typeof item.src === "string" &&
    /^\/assets\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|mp4)$/.test(item.src) &&
    (item.type === "video" ? item.src.endsWith(".mp4") : !item.src.endsWith(".mp4"))
  ).map(item => ({ ...item, title:String(item.title ?? "奶蛙爱洗澡").slice(0,32),
    seconds:Math.min(item.type === "video" ? 30 : 20, Math.max(4,Number(item.seconds) || 8)) }));
}

export function startBootGallery(stage) {
  const gallery = stage.querySelector(".boot-gallery");
  if (!gallery || !stage.isConnected) return () => {};
  const query = selector => stage.querySelector(selector), pauseButton = query("#boot-pause");
  const abort = new AbortController(), failed = new Set();
  try { stage.dataset.reducedMotion=String(JSON.parse(localStorage.getItem("nwaxz-settings") ?? "null")?.reducedMotion === true); } catch { /* Use OS preference when settings are unavailable. */ }
  let items = [{type:"image",src:"/assets/scenes/bath-cover-v2.webp",title:"泡泡浴场",seconds:8}];
  let index=0, timer=0, watchdog=0, disposed=false, busy=false, manualPause=false;
  let remaining=8000, started=0, video, pending, cancelLoad;
  const paused = () => manualPause || document.hidden;
  function stopTimer() {
    if (timer) { clearTimeout(timer); timer=0; remaining=Math.max(0,remaining-(performance.now()-started)); }
  }
  function sync() {
    stopTimer(); stage.dataset.paused=String(paused());
    pauseButton?.setAttribute("aria-pressed",String(manualPause));
    pauseButton?.setAttribute("aria-label",manualPause ? "继续轮播" : "暂停轮播");
    if (pauseButton) pauseButton.textContent=manualPause ? "▶" : "Ⅱ";
    if (disposed) return;
    if (paused()) { video?.pause(); clearTimeout(watchdog); return; }
    if (video) void video.play().catch(() => void advance(1));
    started=performance.now();
    timer=window.setTimeout(() => { timer=0; void advance(1); },remaining);
  }
  function removeMedia(element) {
    if (element instanceof HTMLVideoElement) { element.pause(); element.removeAttribute("src"); element.load(); }
    element?.remove();
  }
  function load(item) {
    return new Promise(resolve => {
      const element=item.type === "video" ? document.createElement("video") : new Image();
      pending=element;
      let settled=false;
      const finish=ok => {
        if (settled) return;
        settled=true; clearTimeout(timeout); cancelLoad=undefined;
        element.onload=element.onerror=null;
        if (element instanceof HTMLVideoElement) element.onplaying=null;
        if (!ok) removeMedia(element);
        resolve(ok ? element : undefined);
      };
      const timeout=window.setTimeout(() => finish(false),6000);
      cancelLoad=() => finish(false);
      element.className="boot-frame"; element.setAttribute("aria-hidden","true");
      element.onerror=() => finish(false);
      if (element instanceof HTMLVideoElement) {
        element.muted=true; element.defaultMuted=true; element.playsInline=true;
        element.preload="metadata"; element.src=item.src;
        // Keep the painting visible until the video can actually play.
        gallery.append(element);
        element.onplaying=() => finish(true);
        void element.play().catch(() => finish(false));
      } else {
        element.alt=""; element.fetchPriority="low";
        element.onload=() => void element.decode().then(() => finish(true),() => finish(false));
        element.src=item.src;
      }
    });
  }
  async function advance(direction) {
    if (disposed || busy) return;
    busy=true; stopTimer(); clearTimeout(watchdog);
    const oldVideo=video; video=undefined; oldVideo?.pause();
    let displayed=false;
    for (let offset=1;offset<=items.length;offset++) {
      const next=(index+direction*offset+items.length*2)%items.length;
      if (failed.has(next)) continue;
      const frame=await load(items[next]);
      if (disposed) { removeMedia(frame); break; }
      pending=undefined;
      if (!frame) { failed.add(next); continue; }
      const old=[...gallery.children];
      frame.classList.add("is-current"); gallery.append(frame);
      for (const element of old) {
        if (element === frame) continue;
        element.classList.remove("is-current");
        window.setTimeout(() => removeMedia(element),900);
      }
      index=next; remaining=items[index].seconds*1000;
      if (frame instanceof HTMLVideoElement) {
        video=frame;
        frame.onended=frame.onerror=() => void advance(1);
        frame.onwaiting=frame.onstalled=() => {
          if (!paused()) { clearTimeout(watchdog); watchdog=window.setTimeout(() => void advance(1),6000); }
        };
        frame.onplaying=() => clearTimeout(watchdog);
      }
      query("#boot-scene").textContent=items[index].title;
      query("#boot-slide").textContent=`${String(index+1).padStart(2,"0")} / ${String(items.length).padStart(2,"0")}`;
      displayed=true; break;
    }
    busy=false;
    if (disposed) return;
    if (!displayed) { video=oldVideo; remaining=8000; }
    sync();
  }
  const events={signal:abort.signal};
  query("#boot-next")?.addEventListener("click",() => void advance(1),events);
  query("#boot-prev")?.addEventListener("click",() => void advance(-1),events);
  pauseButton?.addEventListener("click",() => { manualPause=!manualPause; sync(); },events);
  document.addEventListener("visibilitychange",sync,events);
  function dispose() {
    if (disposed) return;
    disposed=true; stopTimer(); clearTimeout(watchdog); cancelLoad?.();
    abort.abort(); observer.disconnect(); removeMedia(pending);
    for (const frame of [...gallery.children]) if (frame instanceof HTMLVideoElement) removeMedia(frame);
  }
  const observer=new MutationObserver(() => { if (!stage.isConnected) dispose(); });
  observer.observe(stage.parentNode,{childList:true});
  observer.observe(document.querySelector("#app") ?? document.body,{childList:true});
  sync();
  void fetch("/assets/loading/playlist.json",{signal:abort.signal}).then(response => {
    if (!response.ok) throw new Error("playlist");
    return response.json();
  }).then(value => {
    const parsed=parsePlaylist(value);
    if (disposed || !parsed.length) return;
    items=parsed; index=Math.max(0,items.findIndex(item => item.src === gallery.querySelector("img")?.getAttribute("src")));
    query("#boot-slide").textContent=`01 / ${String(items.length).padStart(2,"0")}`;
    remaining=items[index].seconds*1000; sync();
  }).catch(() => {});
  return dispose;
}

if (typeof document !== "undefined") {
  const stage=document.querySelector(".boot-stage");
  if (stage) startBootGallery(stage);
}
