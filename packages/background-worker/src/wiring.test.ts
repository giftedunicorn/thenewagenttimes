import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (url: URL) =>
  JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;

describe("worker deployment wiring", () => {
  it("installs its source runtime as a production dependency", async () => {
    const packageJson = await readJson(
      new URL("../package.json", import.meta.url),
    );

    expect(packageJson.dependencies).toMatchObject({
      "@acme/db": "workspace:*",
      "@acme/ingestion": "workspace:*",
      tsx: "^4.21.0",
    });
    expect(packageJson.scripts).toMatchObject({
      dev: "node --env-file-if-exists=../../.env --import tsx --watch src/index.ts",
      start: "node --import tsx src/index.ts",
    });
  });

  it("defines direct Railpack worker commands and focused watches", async () => {
    const railway = await readJson(new URL("../railway.json", import.meta.url));

    expect(railway).toMatchObject({
      build: {
        builder: "RAILPACK",
        buildCommand: "pnpm --filter @acme/background-worker... build",
        watchPatterns: [
          "packages/background-worker/**",
          "packages/db/**",
          "packages/ingestion/**",
          "tooling/**",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
        ],
      },
      deploy: {
        drainingSeconds: 600,
        restartPolicyType: "ALWAYS",
        startCommand: "pnpm --filter @acme/background-worker start",
      },
    });
  });

  it("allows all worker configuration through Turbo", async () => {
    const turbo = await readJson(
      new URL("../../../turbo.json", import.meta.url),
    );
    const globalEnv = turbo.globalEnv;

    expect(globalEnv).toEqual(
      expect.arrayContaining([
        "BACKGROUND_WORKER_ID",
        "BACKGROUND_WORKER_IDLE_MS",
        "BACKGROUND_WORKER_ERROR_MS",
        "BACKGROUND_WORKER_LEASE_MS",
        "BACKGROUND_WORKER_HEARTBEAT_MS",
      ]),
    );
    expect(globalEnv).not.toContain("BACKGROUND_WORKER_CONCURRENCY");
  });
});
