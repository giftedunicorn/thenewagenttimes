import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (url: URL) =>
  JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;

describe("cron package wiring", () => {
  it("uses the compiled package contract with only the database runtime dependency", async () => {
    const packageJson = await readJson(
      new URL("../package.json", import.meta.url),
    );

    expect(packageJson).toMatchObject({
      dependencies: {
        "@acme/db": "workspace:*",
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
      "@acme/db": "workspace:*",
      tsx: "^4.21.0",
    });
  });

  it("keeps a hard process deadline around enqueue and database close", async () => {
    const entrypoint = await readFile(
      new URL("./index.ts", import.meta.url),
      "utf8",
    );

    expect(entrypoint).toContain("startCronExecutionWatchdog");
    expect(entrypoint).toContain("process.exit(1)");
  });

  it("defines a direct one-shot UTC Railway cron deployment", async () => {
    const railway = await readJson(new URL("../railway.json", import.meta.url));

    expect(railway).toEqual({
      $schema: "https://railway.com/railway.schema.json",
      build: {
        builder: "RAILPACK",
        buildCommand: "pnpm --filter @acme/cron... build",
        watchPatterns: [
          "packages/cron/**",
          "packages/db/**",
          "tooling/**",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
        ],
      },
      deploy: {
        cronSchedule: "0 */2 * * *",
        restartPolicyType: "NEVER",
        startCommand: "pnpm --filter @acme/cron start",
      },
    });
  });
});
