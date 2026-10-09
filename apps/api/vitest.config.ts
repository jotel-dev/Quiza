import { defineConfig } from "vitest/config";

export default defineConfig({
  css: {
    postcss: false,
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
