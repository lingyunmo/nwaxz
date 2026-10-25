import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const viteBin = resolve(root, "node_modules/vite/bin/vite.js");
const edge = process.env.CHROMIUM_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const fixtureUrl = "/ops/coop-peers-fixture.html";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitFor(url, child, label) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`${label} exited early with ${child.exitCode}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(500) }); if (response.ok) return response; } catch { /* retry while the local process starts */ }
    await delay(100);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}
async function cdpConnect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let seq = 0;
  const pending = new Map();
  const logs = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      const severity = message.params?.type ?? message.params?.entry?.level;
      if (message.method === "Runtime.exceptionThrown" || message.method === "Log.entryAdded" || message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(severity)) logs.push(message);
      return;
    }
    if (!message.id) return;
    const request = pending.get(message.id); if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send, logs };
}

const vitePort = await freePort();
const debugPort = await freePort();
const profile = await mkdtemp(join(tmpdir(), "nwaxz-peer-browser-"));
const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], { cwd: root, stdio: "ignore", windowsHide: true });
let browser;
let connection;
try {
  const base = `http://127.0.0.1:${vitePort}`;
  await waitFor(`${base}${fixtureUrl}`, vite, "Vite fixture");
  browser = spawn(edge, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking",
    "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  const version = await (await waitFor(`http://127.0.0.1:${debugPort}/json/version`, browser, "headless browser")).json();
  const pageResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${base}${fixtureUrl}`)}`, { method: "PUT" });
  assert.ok(pageResponse.ok, `CDP could not open the fixture: ${pageResponse.status}`);
  const page = await pageResponse.json();
  connection = await cdpConnect(page.webSocketDebuggerUrl);
  await connection.send("Runtime.enable");
  await connection.send("Page.enable");
  await connection.send("Page.navigate", { url: `${base}${fixtureUrl}` });
  let result;
  for (let i = 0; i < 200; i++) {
    const evaluated = await connection.send("Runtime.evaluate", {
      expression: "(async () => { if (!window.__coopPeerReport) return null; return await window.__coopPeerReport; })()",
      awaitPromise: true, returnByValue: true,
    });
    result = evaluated.result?.value;
    if (result && typeof result === "object") break;
    await delay(100);
  }
  assert.ok(result, "fixture did not publish a report");
  if (result.error) {
    throw new Error(`${result.error}\nconsole: ${JSON.stringify(connection.logs)}`);
  }
  assert.equal(result.meshesBeforeClear, 6);
  assert.equal(result.meshesAfterClear, 0);
  const frame=await connection.send('Runtime.evaluate',{expression:'window.__coopPeerFrame',returnByValue:true});
  if(typeof frame.result?.value==='string'){await mkdir(resolve(root,'.local'),{recursive:true});await writeFile(resolve(root,'.local/coop-peer-dark.png'),Buffer.from(frame.result.value.split(',')[1],'base64'));}
  console.log("co-op peer headless render passed:");
  console.log(JSON.stringify({ edge: version.Browser, ...result }, null, 2));
} finally {
  if (connection) {
    try { await connection.send("Browser.close"); } catch { /* browser may already be stopping */ }
    connection.socket.close();
  }
  if (browser && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once("exit", resolve));
    await Promise.race([exited, delay(3000)]);
    if (browser.exitCode === null) browser.kill();
  }
  if (vite.exitCode === null) vite.kill();
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.startsWith(resolve(tmpdir()) + "\\")) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try { await rm(resolvedProfile, { recursive: true, force: true }); break; }
      catch { await delay(150); }
    }
  }
}
