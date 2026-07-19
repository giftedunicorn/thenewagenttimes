import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (url: URL) =>
  JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;

describe("cron package wiring", () => {
  it("uses an HTTP-only runtime without a database dependency", async () => {
    const packageJson = await readJson(
      new URL("../package.json", import.meta.url),
    );

    expect(packageJson).toMatchObject({
      dependencies: {
        croner: "^9.0.0",
        tsx: "^4.21.0",
      },
      name: "@acme/cron",
      scripts: {
        build: "tsc",
        clean: "git clean -xdf .cache .turbo dist node_modules",
        dev: "node --env-file-if-exists=../../.env --import tsx --watch src/index.ts",
        format: "prettier --check . --ignore-path ../../.gitignore",
        lint: "eslint --flag unstable_native_nodejs_ts_config",
        start: "node --env-file-if-exists=../../.env --import tsx src/index.ts",
        test: "vitest run",
        typecheck: "tsc --noEmit --emitDeclarationOnly false",
      },
      type: "module",
    });
    expect(packageJson.dependencies).toEqual({
      croner: "^9.0.0",
      tsx: "^4.21.0",
    });
  });

  it("declares the news refresh schedule and Next.js API path in cron.json", async () => {
    const config = await readJson(new URL("../cron.json", import.meta.url));

    expect(config).toEqual({
      baseUrl: "http://thenewaitimes.railway.internal:8080",
      jobs: [
        {
          name: "news-refresh",
          path: "/api/cron/news-refresh",
          schedule: "0 */2 * * *",
        },
      ],
    });
  });

  it("defines a long-running Railway scheduler deployment", async () => {
    const railway = await readJson(new URL("../railway.json", import.meta.url));

    expect(railway).toEqual({
      $schema: "https://railway.com/railway.schema.json",
      build: {
        builder: "RAILPACK",
        buildCommand: "pnpm --filter @acme/cron... build",
        watchPatterns: [
          "packages/cron/**",
          "tooling/**",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
        ],
      },
      deploy: {
        restartPolicyType: "ALWAYS",
        startCommand: "pnpm --filter @acme/cron start",
      },
    });
  });
});
