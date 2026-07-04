import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, "utf8")) as T;

describe("news ingestion package scripts", () => {
  it("exposes arXiv AI ingestion through package and root commands", async () => {
    const packageRoot = path.resolve(process.cwd(), "../..");
    const ingestionPackage = await readJson<PackageManifest>(
      path.join(process.cwd(), "package.json"),
    );
    const rootPackage = await readJson<PackageManifest>(
      path.join(packageRoot, "package.json"),
    );

    expect(ingestionPackage.scripts?.["ingest:arxiv-ai"]).toBe(
      "tsx src/cli.ts ingest:arxiv-ai",
    );
    expect(rootPackage.scripts?.["news:ingest:arxiv-ai"]).toBe(
      "pnpm -F @acme/ingestion ingest:arxiv-ai",
    );
  });
});
