import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

const repoRoot = path.resolve(process.cwd(), "../..");

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8")) as T;

describe("background job package wiring", () => {
  it("does not expose the obsolete HTTP bootstrap or Railway role multiplexer", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const ingestionPackage = await readJson<PackageManifest>(
      "packages/ingestion/package.json",
    );

    expect(rootPackage.scripts).not.toHaveProperty("build:railway");
    expect(rootPackage.scripts).not.toHaveProperty("predeploy:railway");
    expect(rootPackage.scripts).not.toHaveProperty("start:railway");
    expect(rootPackage.scripts).not.toHaveProperty("news:bootstrap:remote");
    expect(rootPackage.scripts).not.toHaveProperty("news:refresh:remote");
    expect(rootPackage.scripts).not.toHaveProperty("news:embed:remote");
    expect(ingestionPackage.scripts).not.toHaveProperty("bootstrap:remote");
    expect(ingestionPackage.scripts).not.toHaveProperty("refresh:remote");
    expect(ingestionPackage.scripts).not.toHaveProperty("embed:remote");
  });

  it.each([
    "packages/ingestion/src/remote-bootstrap-cli.ts",
    "packages/ingestion/src/remote-bootstrap.ts",
    "packages/ingestion/src/remote-refresh.ts",
    "packages/ingestion/src/remote-embed-cli.ts",
    "packages/ingestion/src/remote-embed.ts",
    "packages/ingestion/src/remote-cli.ts",
  ])("removes obsolete producer path %s", async (relativePath) => {
    await expect(access(path.join(repoRoot, relativePath))).rejects.toThrow();
  });
});
