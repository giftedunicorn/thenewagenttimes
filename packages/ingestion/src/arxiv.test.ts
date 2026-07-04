import { describe, expect, it } from "vitest";

import {
  buildArxivAiSearchUrl,
  parseArxivAiPapers,
  toArxivAiManualNewsInput,
} from "./arxiv";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

const arxivAtomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2607.01234v1</id>
    <updated>2026-07-02T17:03:10Z</updated>
    <published>2026-07-02T17:03:10Z</published>
    <title>
      Agentic Memory for Long-Horizon AI Systems
    </title>
    <summary>
      We introduce a memory architecture for long-horizon AI agents that
      improves tool-use reliability across multi-step tasks.
    </summary>
    <author><name>Alice Chen</name></author>
    <author><name>Bob Lee</name></author>
    <author><name>Maya Patel</name></author>
    <arxiv:comment>24 pages, 7 figures</arxiv:comment>
    <link title="pdf" href="http://arxiv.org/pdf/2607.01234v1"
          rel="related" type="application/pdf"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:primary_category term="cs.AI"
          scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

describe("buildArxivAiSearchUrl", () => {
  it("queries recent AI research categories through the official Atom API", () => {
    const url = new URL(
      buildArxivAiSearchUrl({
        limit: 12,
        start: 5,
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://export.arxiv.org/api/query",
    );
    expect(url.searchParams.get("search_query")).toBe(
      "(cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:stat.ML)",
    );
    expect(url.searchParams.get("start")).toBe("5");
    expect(url.searchParams.get("max_results")).toBe("12");
    expect(url.searchParams.get("sortBy")).toBe("submittedDate");
    expect(url.searchParams.get("sortOrder")).toBe("descending");
  });
});

describe("parseArxivAiPapers", () => {
  it("keeps structured paper metadata from arXiv Atom entries", () => {
    expect(parseArxivAiPapers(arxivAtomXml)).toEqual([
      {
        abstractUrl: "https://arxiv.org/abs/2607.01234v1",
        authors: ["Alice Chen", "Bob Lee", "Maya Patel"],
        categories: ["cs.AI", "cs.LG"],
        comment: "24 pages, 7 figures",
        id: "2607.01234v1",
        pdfUrl: "https://arxiv.org/pdf/2607.01234v1",
        primaryCategory: "cs.AI",
        publishedAt: "2026-07-02T17:03:10Z",
        summary:
          "We introduce a memory architecture for long-horizon AI agents that improves tool-use reliability across multi-step tasks.",
        title: "Agentic Memory for Long-Horizon AI Systems",
        updatedAt: "2026-07-02T17:03:10Z",
      },
    ]);
  });
});

describe("toArxivAiManualNewsInput", () => {
  it("turns an arXiv paper into a research news candidate", () => {
    const [paper] = parseArxivAiPapers(arxivAtomXml);

    if (!paper) throw new Error("Expected arXiv paper fixture");

    const newsInput = toArxivAiManualNewsInput({
      paper,
      sourceId,
      sourceSlug: "arxiv-ai-ml",
    });

    expect(newsInput).toMatchObject({
      authorName: "Alice Chen, Bob Lee, Maya Patel",
      entities: ["arXiv"],
      publishedAt: new Date("2026-07-02T17:03:10.000Z"),
      sourceId,
      summary:
        "A new arXiv AI paper by Alice Chen, Bob Lee, and Maya Patel studies Agentic Memory for Long-Horizon AI Systems.",
      title: "arXiv paper: Agentic Memory for Long-Horizon AI Systems",
      url: "https://arxiv.org/abs/2607.01234v1",
    });
    expect(newsInput.bodyText).toContain(
      "PDF: https://arxiv.org/pdf/2607.01234v1",
    );
    expect(newsInput.tags).toEqual(
      expect.arrayContaining(["arxiv", "research_paper", "cs_ai", "cs_lg"]),
    );
  });
});
