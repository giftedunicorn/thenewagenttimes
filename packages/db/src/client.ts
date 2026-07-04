import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing POSTGRES_URL");
}

export const db = drizzle({
  connection: connectionString,
  schema,
  casing: "snake_case",
});
