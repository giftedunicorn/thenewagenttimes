import { createOpenAIEmbeddingProvider } from "./embedding";
import {
  embedPendingNewsItems,
  ingestRssSource,
  seedSources,
} from "./pipeline";
import { createDbNewsRepository } from "./repository";

const command = process.argv[2];
const repository = createDbNewsRepository();

const main = async () => {
  if (command === "seed:sources") {
    const result = await seedSources({ repository });
    console.log(`Seeded ${result.created} sources`);
    return;
  }

  if (command === "ingest:rss") {
    const sourceSlug = process.argv[3];
    if (!sourceSlug) {
      throw new Error("Usage: pnpm -F @acme/ingestion ingest:rss <sourceSlug>");
    }
    const result = await ingestRssSource({ repository, sourceSlug });
    console.log(
      `RSS ingestion complete: seen=${result.itemsSeen} created=${result.itemsCreated} updated=${result.itemsUpdated}`,
    );
    return;
  }

  if (command === "embed:pending") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    const provider = createOpenAIEmbeddingProvider({
      apiKey,
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    });
    const limit = Number(process.argv[3] ?? "25");
    const result = await embedPendingNewsItems({ repository, provider, limit });
    console.log(
      `Embedding complete: embedded=${result.embedded} failed=${result.failed}`,
    );
    return;
  }

  throw new Error(
    "Usage: cli.ts <seed:sources | ingest:rss <sourceSlug> | embed:pending [limit]>",
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
