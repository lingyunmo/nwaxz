type UpdateOptions = { canReload: () => boolean; onReady: () => void };

/** A root-scoped, extensionless endpoint avoids static .js proxy cache rules. */
export function createGameUpdater({ canReload, onReady }: UpdateOptions) {
  let registration: ServiceWorkerRegistration | undefined;
  let pendingReload = false, reloading = false, checking = false, connecting = false;
  let connect = () => {};
  const watched = new WeakSet<ServiceWorkerRegistration>();
  let controlled = !!navigator.serviceWorker?.controller;
  const apply = () => {
    if (reloading || !canReload()) return;
    if (pendingReload) { reloading = true; location.reload(); }
    else registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };
  const ready = () => { onReady(); apply(); };
  const check = async () => {
    if (checking || document.hidden || !navigator.onLine) return;
    if (!registration) { connect(); return; }
    checking = true;
    try { await registration.update(); if (registration.waiting) ready(); else apply(); }
    catch { /* Offline or unavailable server: retain the installed game. */ }
    finally { checking = false; }
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Initial offline setup does not require reloading a fresh client.
      const replacing = controlled; controlled = true;
      if (replacing) { pendingReload = true; ready(); }
    });
    connect = () => {
      if (connecting) return;
      connecting = true;
      const task = navigator.onLine ? navigator.serviceWorker.register("/game-worker", { scope: "/", updateViaCache: "none" }) : navigator.serviceWorker.getRegistration("/");
      void task.then(reg => {
        if (!reg) return;
        registration = reg;
        const watch = () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) ready();
          });
        };
        if (!watched.has(reg)) { reg.addEventListener("updatefound", watch); watched.add(reg); }
        watch();
        if (reg.waiting) ready();
        void check();
      }).catch(() => { /* Development without a worker, or offline first visit. */ }).finally(() => { connecting = false; });
    };
    connect();
    window.addEventListener("online", connect);
    for (const event of ["pageshow", "focus"]) window.addEventListener(event, () => void check());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void check(); });
    window.setInterval(() => void check(), 60000);
  }
  return { check, apply };
}
