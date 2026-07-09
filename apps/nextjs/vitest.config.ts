import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(dirname, "src"),
    },
  },
  test: {
    env: {
      NODE_ENV: "development",
      POSTGRES_URL: "postgres://test:test@localhost:5432/test",
    },
  },
});
