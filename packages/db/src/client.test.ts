import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("database client", () => {
  it("uses a direct Postgres connection for Railway runtime URLs", async () => {
    const source = await readFile(new URL("./client.ts", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain('"drizzle-orm/node-postgres"');
    expect(source).toContain(
      "connection: getPostgresConnectionConfig(connectionString)",
    );
    expect(source).toContain('from "./postgres-config"');
    expect(source).toContain("process.env.POSTGRES_URL");
    expect(source).not.toContain("@vercel/postgres");
    expect(source).not.toContain("drizzle-orm/vercel-postgres");
  });
});
