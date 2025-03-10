import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/sgr-sidm-viz/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        HR: resolve(__dirname, "high-res-still/index.html"),
        LR: resolve(__dirname, "low-res-animated/index.html"),
      },
    },
    target: "esnext",
  },
});
