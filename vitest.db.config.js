import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["db/**/*.integration.test.mjs"],
    fileParallelism: false,
  },
});

