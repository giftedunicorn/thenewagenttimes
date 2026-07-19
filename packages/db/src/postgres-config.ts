import type { PoolConfig } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 30_000;

export const getPostgresConnectionConfig = (
  connectionString: string,
): PoolConfig => ({
  connectionString,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  query_timeout: QUERY_TIMEOUT_MS,
  statement_timeout: QUERY_TIMEOUT_MS,
});
