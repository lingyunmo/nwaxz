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
        description: "划开泥土，让奶蛙洗个快乐澡。",
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
        globPatterns: ["**/*.{js,css,html,svg,png,webp,json,woff2}"],
        // Keep editable masters published; gameplay loads their smaller WebPs.
        globIgnores: [
          "assets/character/milk-frog-atlas.png",
          "assets/props/bath-props-v1.png",
          "assets/props/garden-props-v1.png",
        ],
        // Only Vite's content-hashed bundles can omit a cache revision.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
