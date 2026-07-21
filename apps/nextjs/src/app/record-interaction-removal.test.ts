import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const clientSources = [
  "./_components/news-edition-story-actions.tsx",
  "./_components/news-home.tsx",
  "./_components/news-threads-page.tsx",
  "./news/_components/news-article.tsx",
] as const;

describe("reader interaction transport removal", () => {
  it("does not send per-item reader interactions from the web app", async () => {
    const sources = await Promise.all(
      clientSources.map((path) =>
        readFile(new URL(path, import.meta.url), "utf8"),
      ),
    );

    for (const source of sources) {
      expect(source).not.toContain("recordInteraction");
      expect(source).not.toContain("trpc.news.recordInteraction");
    }
  });

  it("does not feed automatic home exposure state back into the current feed", async () => {
    const source = await readFile(
      new URL("./_components/news-home.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("recordHomeExposure");
    expect(source).not.toContain("localHomeExposureItems");
    expect(source).not.toContain("recordedHomeExposureItemsRef");
    expect(source).not.toContain("homeExposureStorageKey");
    expect(source).not.toContain("applyForYouApiExposureMemory");
  });
});
