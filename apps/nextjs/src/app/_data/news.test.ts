import { describe, expect, it } from "vitest";

import {
  buildRelatedNewsCondition,
  shouldReadNewsArticleFromDatabase,
} from "./news";

interface SqlDebugChunk {
  name?: unknown;
  queryChunks?: unknown;
  value?: unknown;
}

const isSqlDebugChunk = (value: unknown): value is SqlDebugChunk =>
  typeof value === "object" && value !== null;

const collectSqlDebugText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!isSqlDebugChunk(value)) return "";

  const stringValues = Array.isArray(value.value)
    ? value.value
        .filter((entry): entry is string => typeof entry === "string")
        .join(" ")
    : "";
  const name = typeof value.name === "string" ? value.name : "";
  const chunks = Array.isArray(value.queryChunks)
    ? value.queryChunks.map(collectSqlDebugText).join(" ")
    : "";

  return [name, stringValues, chunks].filter(Boolean).join(" ");
};

describe("buildRelatedNewsCondition", () => {
  it("recalls related article candidates that share fine-grained tags", () => {
    const condition = buildRelatedNewsCondition({
      article: {
        category: "agent_product",
        entities: ["OpenAI"],
        tags: ["agents"],
      },
      articleId: "current-article",
    });

    const sqlText = collectSqlDebugText(condition);

    expect(sqlText).toContain("tags");
    expect(sqlText).toContain("&&");
  });
});

describe("shouldReadNewsArticleFromDatabase", () => {
  it("skips database article lookup for preview ids", () => {
    expect(shouldReadNewsArticleFromDatabase("preview-desk")).toBe(false);
    expect(
      shouldReadNewsArticleFromDatabase("7c8c33ef-4f20-4f78-93ea-9400c4023902"),
    ).toBe(true);
  });
});
