import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("news interaction transport removal", () => {
  it("does not expose the recordInteraction procedure or its input schema", async () => {
    const source = await readFile(
      new URL("./news.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("recordInteraction: publicProcedure");
    expect(source).not.toContain("NewsRecordInteractionInputSchema");
  });
});
