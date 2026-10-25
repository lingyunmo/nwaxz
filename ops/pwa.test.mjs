import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

test("built preload covers revisioned game resources, including all whole videos", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../dist/preload-manifest.json", import.meta.url), "utf8"));
  const worker = fs.readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
  assert.ok(!worker.includes("self.__WB_MANIFEST"), "manifest must be injected");
  assert.ok(worker.includes("PREPARE_GAME"));
  assert.equal(new Set(manifest.map(entry => entry.url)).size, manifest.length);
  for (const entry of manifest) {
    const content = fs.readFileSync(new URL(`../dist/${entry.url}`, import.meta.url));
    assert.equal(entry.bytes, content.length, `${entry.url} progress size`);
    assert.equal(entry.integrity, `sha256-${createHash("sha256").update(content).digest("base64")}`);
    assert.ok(worker.includes(`"bytes":${entry.bytes}`), "runtime byte counts must survive manifest injection");
    if (entry.revision) assert.equal(entry.revision, createHash("md5").update(content).digest("hex"));
    assert.ok(worker.includes(entry.url), `${entry.url} must be in the worker`);
  }
  const videos = manifest.filter(entry => entry.url.endsWith(".mp4"));
  assert.deepEqual(videos.map(entry => entry.url).sort(), [
    "assets/video/escape-caught-1-v1.mp4",
    "assets/video/escape-caught-2-v1.mp4",
    "assets/video/escape-caught-3-v1.mp4",
    "assets/video/escape-opening-2-v1.mp4",
    "assets/video/escape-opening-v1.mp4",
  ]);
  assert.ok(videos.every(entry => entry.revision && entry.bytes > 2000000));
  assert.ok(manifest.every(entry => entry.url !== "preload-manifest.json"));
  for (const url of [
    "index.html",
    "icon.svg",
    "boot.css",
    "assets/character/milk-frog-atlas.webp",
    "assets/character/milk-frog-extra-v2.webp",
    "assets/character/wait.webp",
    "assets/scenes/bath-cover-v2.webp",
    "assets/scenes/haunted-cover-v1.webp",
    "assets/scenes/bath-stage-v2.webp",
    "assets/scenes/workshop-stage-v1.webp",
    "assets/props/bath-props-v1.webp",
    "assets/props/garden-props-v1.webp",
    "assets/props/bathtub-v1.webp",
    "assets/audio/bubble-day-soft-v1.mp3",
    "assets/audio/ios-session-v1.mp3",
    "assets/audio/sewer-escape-v1.mp3",
    "assets/scenes/escape-cover-v1.webp",
    "assets/scenes/escape-materials-v1.webp",
    "assets/models/escape-props-v1.glb",
    "assets/character/haunted-frog-actions-v2.webp",
    "assets/character/haunted-frog-directions-idle-v1.webp",
    "assets/character/haunted-frog-directions-walk-v1.webp",
    "assets/ui/escape-map-atlas-v1.webp",
    "assets/props/escape-props-v1.webp",
    "assets/props/escape-details-v1.webp",
    "assets/audio/haunted-bath-v1.mp3",
    "assets/audio/haunted-laugh-v1.mp3",
    "assets/scenes/haunted-bath-v1.webp",
    "assets/scenes/haunted-corridor-v1.webp",
    "assets/scenes/haunted-machine-v1.webp",
    "assets/scenes/haunted-laundry-v1.webp",
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
