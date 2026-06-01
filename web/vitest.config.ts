import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside an RSC bundle; stub it so server modules
      // (which carry the guard) remain unit-testable.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      // Mirror the tsconfig "@/*" path alias for tests.
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
