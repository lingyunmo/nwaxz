import type { CoopCreateRequest, CoopInput, CoopJoinRequest, CoopSessionResponse, CoopSnapshot } from "./coop-protocol.ts";

export type CoopConnectionState = "connecting" | "connected" | "reconnecting" | "offline" | "closed";
type Listener = (snapshot: CoopSnapshot) => void;
type StateListener = (state: CoopConnectionState, message: string, latency?: number) => void;

/** Authenticated co-op transport. The SSE stream is fetched directly because EventSource cannot set Authorization. */
export class CoopClient {
  private controller?: AbortController;
  private inputTimer = 0;
  private pingTimer = 0;
  private latestInput?: Omit<CoopInput, "seq" | "action" | "targetId">;
  private actions: Array<Pick<CoopInput, "action" | "targetId">> = [];
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private seq = 0;
  private alive = false;
  private lastSnapshot?: CoopSnapshot;
  private streamConnected = false;
  constructor(readonly session: CoopSessionResponse, private base = "/api/coop") {}

  static async create(request: CoopCreateRequest, base?: string) { return this.sessionRequest("/rooms", request, base); }
  static async join(request: CoopJoinRequest, base?: string) { const { code, ...payload } = request; return this.sessionRequest(`/${encodeURIComponent(code)}/join`, payload, base); }
  private static async sessionRequest(path: string, body: unknown, base = "/api/coop") {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "暂时无法进入房间");
    return new CoopClient(payload as CoopSessionResponse, base);
  }
  onSnapshot(fn: Listener) { this.listeners.add(fn); if (this.lastSnapshot) fn(this.lastSnapshot); return () => this.listeners.delete(fn); }
  onState(fn: StateListener) { this.stateListeners.add(fn); return () => this.stateListeners.delete(fn); }
  get snapshot() { return this.lastSnapshot; }
  private state(state: CoopConnectionState, message: string, latency?: number) { for (const fn of this.stateListeners) fn(state, message, latency); }
  private headers() { return { authorization: `Bearer ${this.session.token}`, "content-type": "application/json" }; }
  private async request(path: string, body?: unknown, method = "POST") {
    const response = await fetch(`${this.base}/${encodeURIComponent(this.session.code)}${path}`, {
      method, headers: this.headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "房间请求失败");
    return data;
  }
  start() { if (this.alive) return; this.alive = true; void this.streamLoop(); }
  sendInput(input: Omit<CoopInput, "seq">) {
    const { action, targetId, ...motion } = input;
    this.latestInput = motion;
    if (action) { if (this.actions.length >= 8) this.actions.shift(); this.actions.push({ action, ...(targetId ? { targetId } : {}) }); }
  }
  clearActions() { this.actions = []; }
  private async streamLoop() {
    let retry = 500;
    while (this.alive) {
      this.controller = new AbortController();
      try {
        this.state(this.lastSnapshot ? "reconnecting" : "connecting", this.lastSnapshot ? "正在重新连接" : "正在连接房间");
        const response = await fetch(`${this.base}/${encodeURIComponent(this.session.code)}/events`, { headers: { authorization: `Bearer ${this.session.token}`, accept: "text/event-stream" }, signal: this.controller.signal, cache: "no-store" });
        if ([401, 404, 409].includes(response.status)) { this.stop(); this.state("closed", "房间已关闭"); break; }
        if (!response.ok || !response.body) throw new Error("房间连接中断");
        this.streamConnected = true;
        this.state("connected", "已连接"); retry = 500;
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
        while (this.alive) {
          const { value, done } = await reader.read(); if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const eventName = chunk.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
            if (eventName && eventName !== "snapshot") continue;
            const raw = chunk.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
            if (!raw) continue;
            let snapshot: CoopSnapshot;
            try { snapshot = JSON.parse(raw) as CoopSnapshot; }
            catch { continue; }
            if (!snapshot || snapshot.protocol !== 1 || !snapshot.world || !snapshot.room?.players || typeof snapshot.viewPlayerId !== "string") continue;
            this.lastSnapshot = snapshot;
            for (const fn of [...this.listeners]) {
              try { fn(snapshot); }
              catch (error) {
                console.error("Co-op snapshot listener failed", error);
                this.state("reconnecting", "房间状态无法同步");
                this.controller?.abort();
                break;
              }
            }
          }
        }
      } catch (error) {
        if (!this.alive) break;
        this.streamConnected = false;
        this.state("reconnecting", error instanceof Error ? "连接中断，正在重连" : "正在重连");
      }
      this.streamConnected = false;
      if (this.alive) await new Promise(resolve => setTimeout(resolve, retry));
      retry = Math.min(5000, retry * 1.6);
    }
  }
  startInputs() {
    if (this.inputTimer) return;
    this.inputTimer = window.setInterval(() => {
      if (!this.alive || (!this.latestInput && !this.actions.length)) return;
      const self = this.lastSnapshot?.room.players.find(player => player.id === this.session.playerId);
      if (this.lastSnapshot?.room.phase !== "playing" || self?.status !== "connected") {
        this.latestInput = undefined;
        this.actions = [];
        return;
      }
      const input: CoopInput = { ...(this.latestInput ?? { move: { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false } }), seq: ++this.seq, ...(this.actions.shift() ?? {}) };
      void this.request("/input", input).catch(() => this.state("reconnecting", "输入未送达，正在重连"));
    }, 100);
    if (!this.pingTimer) this.pingTimer = window.setInterval(() => { void this.ping().then(latency => this.state(this.streamConnected ? "connected" : "reconnecting", this.streamConnected ? "已连接" : "连接中断，正在重连", latency)).catch(() => this.state("reconnecting", "网络不稳定")); }, 2500);
  }
  async ready(ready: boolean) { return this.request("/ready", { ready }); }
  async startRoom() { return this.request("/start", {}); }
  async respawn() { return this.request("/respawn", {}); }
  async leave() { try { await this.request("/leave", {}); } finally { this.stop(); } }
  async ping() { const at = performance.now(); const response = await fetch(`${this.base}/ping`, { cache: "no-store" }); if (!response.ok) throw new Error("ping failed"); return Math.round(performance.now() - at); }
  reconnect() { this.stop(); this.start(); this.startInputs(); }
  stop() { this.alive = false; this.streamConnected = false; this.controller?.abort(); this.controller = undefined; if (this.inputTimer) clearInterval(this.inputTimer); if (this.pingTimer) clearInterval(this.pingTimer); this.inputTimer = this.pingTimer = 0; this.latestInput = undefined; this.actions = []; }
}
