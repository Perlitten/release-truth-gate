import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.{js,mjs}",
      "api/**/*.test.mjs",
      "app/**/*.test.js",
    ],
  },
});
