import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy API calls to the FastAPI backend so the SPA and API share an origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8321", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8321", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    // Keep chunks reasonable for the Pi's modest CPU.
    chunkSizeWarningLimit: 1200,
    // Stable (un-hashed) output names so the prebuilt dist committed to the repo
    // doesn't churn on every rebuild — only content changes show up in git.
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
