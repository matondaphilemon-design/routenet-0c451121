import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      // Never activate the SW in dev or in the Lovable preview iframe.
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.png", "placeholder.svg", "pwa-192.png", "pwa-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigationPreload: true,
        // Bypass service worker for audio/range requests — fixes PWA playback
        navigateFallback: null,
        runtimeCaching: [
          // Audio streams from Piped — network only, never cache (range requests break otherwise)
          {
            urlPattern: /^https:\/\/pipedapi\./,
            handler: "NetworkOnly",
          },
          // Any request with Range header — network only
          {
            urlPattern: ({ request }) => request.headers.has("range"),
            handler: "NetworkOnly",
          },
          // Deezer API — stale-while-revalidate for speed + freshness
          {
            urlPattern: /^https:\/\/api\.deezer\.com/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "deezer-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 600 },
            },
          },
          // Deezer artwork images — cache first, long TTL
          {
            urlPattern: /^https:\/\/e-cdns-images\.dzcdn\.net/,
            handler: "CacheFirst",
            options: {
              cacheName: "deezer-images",
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // YouTube thumbnails
          {
            urlPattern: /^https:\/\/i\.ytimg\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "youtube-thumbnails",
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Any other artwork/images
          {
            urlPattern: /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "artwork-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts — cache forever
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase edge functions — network first with fast timeout
          {
            urlPattern: /\/functions\/v1\/(youtube|deezer|firecrawl-youtube|coverart|lastfm|theaudiodb)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-functions",
              expiration: { maxEntries: 200, maxAgeSeconds: 600 },
              networkTimeoutSeconds: 8,
            },
          },
          // YouTube iframe API script — cache for fast player init
          {
            urlPattern: /^https:\/\/www\.youtube\.com\/iframe_api/,
            handler: "CacheFirst",
            options: {
              cacheName: "youtube-api",
              expiration: { maxEntries: 5, maxAgeSeconds: 86400 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Routenet",
        short_name: "Routenet",
        description: "Routenet — your sound, your vibe.",
        theme_color: "#0f1012",
        background_color: "#0f1012",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["music", "entertainment"],
        icons: [
          { src: "/favicon.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
}));
