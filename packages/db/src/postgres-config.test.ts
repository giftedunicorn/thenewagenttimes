import { describe, expect, it } from "vitest";

import { getPostgresConnectionConfig } from "./postgres-config";

describe("getPostgresConnectionConfig", () => {
  it("bounds connection and query waits", () => {
    expect(getPostgresConnectionConfig("postgres://example")).toEqual({
      connectionString: "postgres://example",
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
      statement_timeout: 30_000,
    });
  });
});
