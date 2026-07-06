import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;

export const getDeploymentDatabaseUrl = (env) => {
  const connectionString = env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("Missing POSTGRES_URL");
  }

  return connectionString.replace(":6543", ":5432");
};

const hasColumn = (columns, columnName) => columns.has(columnName);

export const getClusterKeyBackfillExpression = (columns) => {
  const fallbacks = [];

  if (hasColumn(columns, "dedupe_key")) {
    fallbacks.push("nullif(btrim(\"dedupe_key\"), '')");
  }

  if (hasColumn(columns, "canonical_url")) {
    fallbacks.push(
      "nullif(regexp_replace(regexp_replace(regexp_replace(split_part(split_part(lower(\"canonical_url\"), '#', 1), '?', 1), '/$', ''), '^[a-z][a-z0-9+.-]*://', '', 'i'), '^www\\.', '', 'i'), '')",
    );
  }

  fallbacks.push('"id"::text');

  return `left(coalesce(${fallbacks.join(", ")}), 320)`;
};

export const run = async () => {
  const client = new Client({
    connectionString: getDeploymentDatabaseUrl(process.env),
  });

  await client.connect();

  try {
    const tableResult = await client.query(
      "select to_regclass('public.news_item') as table_name",
    );
    const newsItemTableExists = Boolean(tableResult.rows[0]?.table_name);

    if (!newsItemTableExists) {
      console.log(
        "news_item table does not exist yet; drizzle push will create it.",
      );
      return;
    }

    const columnResult = await client.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'news_item'",
    );
    const columns = new Set(
      columnResult.rows
        .map((row) => row.column_name)
        .filter((columnName) => typeof columnName === "string"),
    );

    await client.query(
      "ALTER TABLE news_item ADD COLUMN IF NOT EXISTS cluster_key varchar(320)",
    );
    columns.add("cluster_key");

    await client.query(
      `update "news_item" set "cluster_key" = ${getClusterKeyBackfillExpression(
        columns,
      )} where "cluster_key" is null or btrim("cluster_key") = ''`,
    );
    await client.query(
      "ALTER TABLE news_item ALTER COLUMN cluster_key SET NOT NULL",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS news_item_cluster_key_idx ON news_item (cluster_key)",
    );

    console.log("Prepared news_item.cluster_key for deploy schema sync.");
  } finally {
    await client.end();
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  run().catch((error) => {
    console.error("Failed to prepare deploy schema.");
    console.error(error);
    process.exit(1);
  });
}
