import { createHash } from "node:crypto";

import type { EmbeddingProvider, PendingEmbeddingNewsItem } from "./types";

const maxEmbeddingBodyCharacters = 12_000;

const truncateEmbeddingBodyText = (bodyText: string) => {
  if (bodyText.length <= maxEmbeddingBodyCharacters) return bodyText;

  return `${bodyText.slice(0, maxEmbeddingBodyCharacters)}\n[truncated]`;
};

export const buildEmbeddingInput = (item: PendingEmbeddingNewsItem): string => {
  const lines = [
    `Title: ${item.title}`,
    `Summary: ${item.summary}`,
    `Category: ${item.category}`,
    `Tags: ${item.tags.join(", ")}`,
    `Entities: ${item.entities.join(", ")}`,
  ];

  if (item.bodyText) {
    lines.push(`Body: ${truncateEmbeddingBodyText(item.bodyText)}`);
  }

  return lines.join("\n");
};

export const hashEmbeddingInput = (input: string): string =>
  `sha256:${createHash("sha256").update(input).digest("hex")}`;

export const createFakeEmbeddingProvider = (options: {
  dimension: number;
}): EmbeddingProvider => ({
  embed() {
    return Promise.resolve({
      provider: "fake",
      model: "fake-embedding",
      dimension: options.dimension,
      embedding: Array.from({ length: options.dimension }, (_, index) =>
        Number(((index + 3) / 100).toFixed(2)),
      ),
    });
  },
});

export const createOpenAIEmbeddingProvider = (options: {
  apiKey: string;
  model: string;
  endpoint?: string;
}): EmbeddingProvider => {
  if (!options.apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    async embed(input) {
      const response = await fetch(
        options.endpoint ?? "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            input,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenAI embeddings request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: { embedding?: number[] }[];
      };
      const embedding = payload.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error("OpenAI embeddings response did not include a vector");
      }

      return {
        provider: "openai",
        model: options.model,
        dimension: embedding.length,
        embedding,
      };
    },
  };
};
