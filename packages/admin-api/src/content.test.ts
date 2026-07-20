import { describe, expect, it } from "vitest";

import { contentListInput } from "./content";

describe("contentListInput", () => {
  it("accepts only existing bounded filters", () => {
    expect(
      contentListInput.parse({
        category: "research",
        embeddingStatus: "embedded",
        page: 0,
        pageSize: 50,
        search: "  agents  ",
        sourceId: "11111111-1111-4111-8111-111111111111",
        status: "published",
      }),
    ).toMatchObject({ search: "agents" });

    expect(() =>
      contentListInput.parse({
        page: 0,
        pageSize: 20,
        status: "not-real",
      }),
    ).toThrow();
    expect(() =>
      contentListInput.parse({
        page: 0,
        pageSize: 20,
        search: "x".repeat(161),
      }),
    ).toThrow();
  });
});
