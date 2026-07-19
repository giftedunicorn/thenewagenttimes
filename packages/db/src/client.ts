import { drizzle } from "drizzle-orm/node-postgres";

import { getPostgresConnectionConfig } from "./postgres-config";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing POSTGRES_URL");
}

export const db = drizzle({
  connection: getPostgresConnectionConfig(connectionString),
  schema,
  casing: "snake_case",
});
