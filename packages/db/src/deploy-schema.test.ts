import { describe, expect, it } from "vitest";

const loadDeploySchemaScript = async () =>
  (await import(
    new URL("../scripts/prepare-deploy-schema.mjs", import.meta.url).href
  )) as {
    getClusterKeyBackfillExpression: (columns: ReadonlySet<string>) => string;
    getDeploymentDatabaseUrl: (env: { POSTGRES_URL?: string }) => string;
  };

describe("deploy schema helpers", () => {
  it("uses the non-pooling Railway Postgres port for schema changes", async () => {
    const { getDeploymentDatabaseUrl } = await loadDeploySchemaScript();

    expect(
      getDeploymentDatabaseUrl({
        POSTGRES_URL: "postgresql://user:pass@host.railway.internal:6543/db",
      }),
    ).toBe("postgresql://user:pass@host.railway.internal:5432/db");
  });

  it("requires a deployment database URL", async () => {
    const { getDeploymentDatabaseUrl } = await loadDeploySchemaScript();

    expect(() => getDeploymentDatabaseUrl({})).toThrow("Missing POSTGRES_URL");
  });

  it("backfills cluster keys from dedupe key, normalized canonical URL, then id", async () => {
    const { getClusterKeyBackfillExpression } = await loadDeploySchemaScript();

    const expression = getClusterKeyBackfillExpression(
      new Set(["canonical_url", "dedupe_key", "id"]),
    );

    expect(expression).toContain("dedupe_key");
    expect(expression).toContain("canonical_url");
    expect(expression).toContain("'^[a-z][a-z0-9+.-]*://'");
    expect(expression).toContain("^www\\.");
    expect(expression).toContain('"id"::text');
    expect(expression.indexOf("dedupe_key")).toBeLessThan(
      expression.indexOf("canonical_url"),
    );
    expect(expression.indexOf("canonical_url")).toBeLessThan(
      expression.indexOf('"id"::text'),
    );
  });

  it("falls back to item ids when legacy URL columns are unavailable", async () => {
    const { getClusterKeyBackfillExpression } = await loadDeploySchemaScript();

    expect(getClusterKeyBackfillExpression(new Set(["id"]))).toBe(
      'left(coalesce("id"::text), 320)',
    );
  });
});
