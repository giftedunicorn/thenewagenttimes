import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  getNewsSearchMemoryRecordInput,
  shouldPersistNewsSearchMemoryToServer,
} from "./news-search-memory-recorder";

describe("news search memory recorder", () => {
  it("does not record blank searches", () => {
    expect(
      getNewsSearchMemoryRecordInput({
        query: "   ",
        resultCount: 7,
      }),
    ).toBeNull();
  });

  it("records explicit searches with trimmed query text", () => {
    expect(
      getNewsSearchMemoryRecordInput({
        query: "  browser agents  ",
        resultCount: 4,
      }),
    ).toEqual({
      query: "browser agents",
      resultCount: 4,
    });
  });

  it("normalizes whitespace and caps long queries before recording", () => {
    const recordInput = getNewsSearchMemoryRecordInput({
      query: `  browser\nagents\t${"model ".repeat(40)}pricing  `,
      resultCount: 4,
    });

    expect(recordInput?.query).toContain("browser agents");
    expect(recordInput?.query).not.toContain("\n");
    expect(recordInput?.query).not.toContain("\t");
    expect(recordInput?.query).not.toContain("  ");
    expect(recordInput?.query.length).toBeLessThanOrEqual(120);
  });

  it("keeps zero-result searches as explicit user intent", () => {
    expect(
      getNewsSearchMemoryRecordInput({
        query: "frontier model pricing",
        resultCount: 0,
      }),
    ).toEqual({
      query: "frontier model pricing",
      resultCount: 0,
    });
  });

  it("normalizes invalid result counts before recording", () => {
    expect(
      getNewsSearchMemoryRecordInput({
        query: "agent benchmarks",
        resultCount: Number.NaN,
      }),
    ).toEqual({
      query: "agent benchmarks",
      resultCount: 0,
    });
    expect(
      getNewsSearchMemoryRecordInput({
        query: "agent benchmarks",
        resultCount: -3,
      }),
    ).toEqual({
      query: "agent benchmarks",
      resultCount: 0,
    });
  });

  it("keeps preview search memory local-only when server persistence is disabled", () => {
    expect(
      shouldPersistNewsSearchMemoryToServer({
        canPersistServerMemory: false,
        visitorKey: "visitor-test-123",
      }),
    ).toBe(false);
    expect(
      shouldPersistNewsSearchMemoryToServer({
        canPersistServerMemory: true,
        visitorKey: null,
      }),
    ).toBe(false);
    expect(
      shouldPersistNewsSearchMemoryToServer({
        canPersistServerMemory: true,
        visitorKey: "visitor-test-123",
      }),
    ).toBe(true);
  });

  it("only enables server search memory from live search editions", async () => {
    const source = await readFile(
      new URL("../search/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      'canPersistServerMemory={edition.status === "ready"}',
    );
  });

  it("records explicit search intent locally and on the server", async () => {
    const source = await readFile(
      new URL("./news-search-memory-recorder.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useMutation");
    expect(source).toContain("useQueryClient");
    expect(source).toContain("useTRPC");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain("trpc.news.recordSearchMemory.mutationOptions");
    expect(source).toContain(
      "queryClient.invalidateQueries(trpc.news.forYou.pathFilter())",
    );
    expect(source).toContain(
      "queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter())",
    );
    expect(source).toContain("recordStoredNewsSearchMemoryItem(recordInput)");
    expect(source).toContain("{ mutate: recordSearchMemory }");
    expect(source).toContain("shouldPersistNewsSearchMemoryToServer({");
    expect(source).toContain("canPersistServerMemory");
    expect(source).toContain("recordSearchMemory({");
    expect(source).toContain("query: recordInput.query");
    expect(source).toContain("resultCount: recordInput.resultCount");
    expect(source).toContain("visitorKey");
  });

  it("keeps one search render from recording the same memory twice", async () => {
    const source = await readFile(
      new URL("./news-search-memory-recorder.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useRef");
    expect(source).toContain("recordedSearchMemoryKeyRef");
    expect(source).toContain(
      "if (recordedSearchMemoryKeyRef.current === recordKey) return;",
    );
    expect(source).toContain("recordedSearchMemoryKeyRef.current = recordKey");
  });
});
