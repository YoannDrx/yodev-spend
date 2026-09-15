import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

if (process.env.CI && !process.env.TEST_DATABASE_URL) throw new Error("CI requires TEST_DATABASE_URL; database tests must not be skipped.");

export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
  } },
  test: { maxWorkers: 2, hookTimeout: 60_000, testTimeout: 30_000, include: ["src/**/*.test.ts", "src/**/*.test.tsx"], environment: "node", coverage: { provider: "v8", reporter: ["text", "html"] } },
});
