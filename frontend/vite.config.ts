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
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
