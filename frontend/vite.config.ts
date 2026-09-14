import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  optimizeDeps: {
    // MapLibre decodes vector tiles in a Web Worker, and the dep optimizer
    // rewrites that worker entry to a file it never emits
    // (.vite/deps/maplibre-gl-worker.mjs). Tiles are then fetched but never
    // decoded: the map reports no error, never finishes loading, and renders
    // black. Excluding it leaves the package's own worker resolution intact.
    exclude: ["maplibre-gl"],
  },
  server: {
    // Allows importing from ../shared — the repo's cross-domain contracts
    // (see architecture.md §22) — since it lives outside frontend/'s own root.
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
