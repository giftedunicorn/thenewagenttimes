import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface NewsAgentDiscoveryModule {
  getNewsLlmsText: (input: { baseUrl?: string }) => string;
}

const loadNewsAgentDiscovery = async () => {
  const discoveryModule = (await import("./news-agent-discovery").catch(
    () => null,
  )) as NewsAgentDiscoveryModule | null;

  expect(discoveryModule).toMatchObject({
    getNewsLlmsText: expect.any(Function) as unknown,
  });

  return discoveryModule;
};

describe("getNewsLlmsText", () => {
  it("builds an llms.txt index for AI agents and search tools", async () => {
    const discoveryModule = await loadNewsAgentDiscovery();
    const llmsText = discoveryModule?.getNewsLlmsText({
      baseUrl: "https://thenewaitimes.test",
    });

    expect(llmsText).toContain("# The New AI Times");
    expect(llmsText).toContain(
      "> Public AI news, editorial briefings, search, and machine-readable feeds.",
    );
    expect(llmsText).toContain(
      "- [Front Page](https://thenewaitimes.test/): Personalized AI news edition with For You ranking.",
    );
    expect(llmsText).toContain(
      "- [Search](https://thenewaitimes.test/search): Search AI stories, sources, entities, and tags.",
    );
    expect(llmsText).toContain(
      "- [Coverage Threads](https://thenewaitimes.test/threads): Follow clustered AI stories across sources and verification state.",
    );
    expect(llmsText).toContain(
      "- [Entities](https://thenewaitimes.test/entities): Browse people, companies, models, and products covered in AI news.",
    );
    expect(llmsText).not.toContain("Reader Personalization");
    expect(llmsText).not.toContain("https://thenewaitimes.test/reader");
    expect(llmsText).toContain(
      "- [JSON Feed](https://thenewaitimes.test/feed.json): Machine-readable feed for modern news readers.",
    );
    expect(llmsText).toContain(
      "- [OpenSearch](https://thenewaitimes.test/opensearch.xml): Browser and agent search discovery document.",
    );
  });

  it("normalizes configured base URLs to the site origin", async () => {
    const discoveryModule = await loadNewsAgentDiscovery();
    const llmsText = discoveryModule?.getNewsLlmsText({
      baseUrl: "https://thenewaitimes.test/path?ref=agent",
    });

    expect(llmsText).toContain("https://thenewaitimes.test/search");
    expect(llmsText).not.toContain("/path?ref=agent");
  });

  it("wires the llms.txt route to the discovery helper", async () => {
    const routeSource = await readFile(
      new URL("../llms.txt/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("getNewsLlmsText({");
    expect(routeSource).toContain("text/plain; charset=utf-8");
  });
});
