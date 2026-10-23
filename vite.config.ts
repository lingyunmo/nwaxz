import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // The glob below already includes the icon and character files.
      includeManifestIcons: false,
      manifest: {
        name: "奶蛙爱洗澡",
        short_name: "nwaxz",
        lang: "zh-CN",
        description: "泡泡浴场、午夜浴场、下水道逃生。选择你的冒险。",
        theme_color: "#286f70",
        background_color: "#286f70",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,webp,json,woff2,mp3,glb}"],
        // Keep editable masters published; gameplay loads their smaller WebPs.
        globIgnores: [
          "assets/character/milk-frog-atlas.png",
          "assets/models/extreme-milk-frog-v1.glb",
          "assets/props/bath-props-v1.png",
          "assets/props/garden-props-v1.png",
        ],
        // Only Vite's content-hashed bundles can omit a cache revision.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: /\/assets\/video\/escape-(?:opening|caught-[123])-v1\.mp4$/,
          handler: "CacheFirst",
          options: {
            cacheName: "nwaxz-cinematics-v1",
            rangeRequests: true,
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
          },
        }],
      },
    }),
  ],
});
