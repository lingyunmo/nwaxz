import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.mjs";
test("release readiness, UTF-8, asset caching, and private-file isolation", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nwaxz-test-"));
  fs.mkdirSync(path.join(directory, "assets"));
  fs.writeFileSync(
    path.join(directory, "index.html"),
    '<!doctype html><meta charset="UTF-8"><title>奶娃爱洗澡</title>',
  );
  fs.writeFileSync(
    path.join(directory, "assets", "app-1234abcd.js"),
    'console.log("ready")',
  );
  fs.mkdirSync(path.join(directory, "assets", "character"));
  fs.writeFileSync(path.join(directory, "assets", "character", "atlas.json"), "{}");
  fs.writeFileSync(path.join(directory, ".env"), "private-value");
  const server = createApp({
    distDir: directory,
    revision: "test-revision",
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    fs.rmSync(directory, { recursive: true });
  });
  const request = (url) =>
    fetch(`http://127.0.0.1:${server.address().port}${url}`);
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal((await health.json()).revision, "test-revision");
  const page = await request("/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /奶娃爱洗澡/);
  assert.match(page.headers.get("content-type"), /charset=utf-8/i);
  assert.equal(page.headers.get("cache-control"), "no-cache");
  assert.match(
    (await request("/assets/app-1234abcd.js")).headers.get("cache-control"),
    /immutable/,
  );
  assert.equal(
    (await request("/assets/character/atlas.json")).headers.get("cache-control"),
    "no-cache",
  );
  assert.equal((await request("/.env")).status, 404);
  assert.equal((await request("/api/unknown")).status, 404);
  fs.unlinkSync(path.join(directory, "index.html"));
  assert.equal((await request("/api/health")).status, 503);
});
