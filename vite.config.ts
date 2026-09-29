import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Next Up — Your game library",
        short_name: "Next Up",
        description: "Organize your games. Find something that fits right now.",
        theme_color: "#141618",
        background_color: "#141618",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,jpg}"],
        globIgnores: ["concepts/**"],
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/(images\.igdb\.com|shared\.fastly\.steamstatic\.com)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "game-art",
              expiration: { maxEntries: 120, maxAgeSeconds: 2592000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: {
      "/.well-known": { target: "http://127.0.0.1:8787" },
      "/api": { target: "http://127.0.0.1:8787" },
    },
  },
});
