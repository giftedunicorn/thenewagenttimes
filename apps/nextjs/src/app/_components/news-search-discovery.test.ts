import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { getNewsOpenSearchDescription } from "./news-search-discovery";

describe("getNewsOpenSearchDescription", () => {
  it("builds an OpenSearch description for browser news search discovery", () => {
    const description = getNewsOpenSearchDescription({
      baseUrl: "https://thenewaitimes.test",
    });

    expect(description).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(description).toContain(
      '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">',
    );
    expect(description).toContain("<ShortName>The New AI Times</ShortName>");
    expect(description).toContain(
      "<Description>Search The New AI Times for AI agents, models, funding, research, and sources.</Description>",
    );
    expect(description).toContain(
      '<Url type="text/html" method="get" template="https://thenewaitimes.test/search?q={searchTerms}" />',
    );
    expect(description).toContain(
      '<Url type="application/rss+xml" method="get" template="https://thenewaitimes.test/rss.xml" />',
    );
    expect(description).toContain("<InputEncoding>UTF-8</InputEncoding>");
    expect(description).toContain("<OutputEncoding>UTF-8</OutputEncoding>");
  });

  it("escapes OpenSearch XML values from configured base URLs", () => {
    const description = getNewsOpenSearchDescription({
      baseUrl: "https://thenewaitimes.test/?ref=agents&mode=<search>",
    });

    expect(description).toContain(
      "https://thenewaitimes.test/search?q={searchTerms}",
    );
    expect(description).not.toContain("mode=<search>");
  });

  it("wires the opensearch route to the discovery helper", async () => {
    const routeSource = await readFile(
      new URL("../opensearch.xml/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("getNewsOpenSearchDescription({");
    expect(routeSource).toContain(
      "application/opensearchdescription+xml; charset=utf-8",
    );
  });

  it("advertises OpenSearch from root layout", async () => {
    const layoutSource = await readFile(
      new URL("../layout.tsx", import.meta.url),
      "utf8",
    );

    expect(layoutSource).toContain('rel="search"');
    expect(layoutSource).toContain(
      'type="application/opensearchdescription+xml"',
    );
    expect(layoutSource).toContain('href="/opensearch.xml"');
  });
});
