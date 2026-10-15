import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

test("built offline worker has one revision per URL and a cached navigation fallback", () => {
  let manifest,
    fallback,
    claims = false;
  const workbox = {
    precacheAndRoute(entries) {
      manifest = entries;
    },
    cleanupOutdatedCaches() {},
    clientsClaim() {
      claims = true;
    },
    createHandlerBoundToURL(url) {
      fallback = url;
      return () => {};
    },
    NavigationRoute: class {},
    registerRoute() {},
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8"),
    {
      self: { define: true, addEventListener() {} },
      define(_dependencies, factory) {
        factory(workbox);
      },
    },
  );
  assert.ok(Array.isArray(manifest));
  assert.equal(
    new Set(manifest.map((entry) => entry.url)).size,
    manifest.length,
    "duplicate URLs can abort Workbox initialization before installation",
  );
  assert.equal(fallback, "index.html");
  assert.ok(claims);
  for (const url of [
    "index.html",
    "icon.svg",
    "boot.css",
    "assets/character/milk-frog-atlas.webp",
    "assets/character/milk-frog-extra-v2.webp",
    "assets/character/wait.webp",
    "assets/scenes/bath-cover-v2.webp",
    "assets/scenes/bath-stage-v2.webp",
    "assets/scenes/workshop-stage-v1.webp",
    "assets/props/bath-props-v1.webp",
    "assets/props/garden-props-v1.webp",
    "assets/props/bathtub-v1.webp",
    "assets/audio/bubble-day-soft-v1.mp3",
    "assets/audio/ios-session-v1.mp3",
    "assets/audio/haunted-bath-v1.mp3",
    "assets/audio/haunted-laugh-v1.mp3",
    "assets/scenes/haunted-bath-v1.webp",
    "assets/scenes/haunted-corridor-v1.webp",
    "assets/scenes/haunted-machine-v1.webp",
    "assets/character/haunted-frog-v1.webp",
    "assets/props/pumpkin-v1.webp",
  ]) {
    const entry = manifest.find((entry) => entry.url === url);
    assert.ok(
      entry?.revision,
      `${url} needs a revision to update between releases`,
    );
  }
  assert.ok(manifest.some((entry) => /\.js$/.test(entry.url)));
  assert.ok(manifest.some((entry) => /\.css$/.test(entry.url)));
});
