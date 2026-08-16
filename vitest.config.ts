import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Integration tests spawn real filesystem work in temp dirs.
    testTimeout: 15_000,
  },
});
