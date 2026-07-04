import { describe, expect, it } from "vitest";

import {
  buildYcAiCompaniesSearchRequest,
  parseYcAiCompanies,
  parseYcAlgoliaConfigFromHtml,
  toYcAiManualNewsInput,
} from "./yc";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("parseYcAlgoliaConfigFromHtml", () => {
  it("extracts the public Algolia app and search key from the YC companies page", () => {
    expect(
      parseYcAlgoliaConfigFromHtml(`
        <script>
          window.AlgoliaOpts = {"app":"45BWZJ1SGC","key":"public-search-key"};
        </script>
      `),
    ).toEqual({
      apiKey: "public-search-key",
      appId: "45BWZJ1SGC",
    });
  });
});

describe("buildYcAiCompaniesSearchRequest", () => {
  it("queries the launch-date index for AI-tagged YC companies", () => {
    expect(
      buildYcAiCompaniesSearchRequest({
        config: {
          apiKey: "public-search-key",
          appId: "45BWZJ1SGC",
        },
        limit: 12,
      }),
    ).toEqual({
      body: {
        attributesToRetrieve: [
          "name",
          "slug",
          "website",
          "all_locations",
          "long_description",
          "one_liner",
          "team_size",
          "launched_at",
          "tags",
          "batch",
          "industries",
          "objectID",
        ],
        facetFilters: [
          [
            "tags:Artificial Intelligence",
            "tags:AI",
            "tags:Machine Learning",
            "tags:Generative AI",
          ],
        ],
        hitsPerPage: 12,
        query: "",
      },
      headers: {
        "content-type": "application/json",
        "x-algolia-api-key": "public-search-key",
        "x-algolia-application-id": "45BWZJ1SGC",
      },
      url: "https://45BWZJ1SGC-dsn.algolia.net/1/indexes/YCCompany_By_Launch_Date_production/query",
    });
  });
});

describe("parseYcAiCompanies", () => {
  it("keeps the launch and company fields needed for news ingestion", () => {
    expect(
      parseYcAiCompanies({
        hits: [
          {
            all_locations: "Boston, MA, USA",
            batch: "Summer 2026",
            industries: ["B2B", "Infrastructure"],
            launched_at: 1_782_881_612,
            long_description:
              "We are building the communication layer for AI agents.",
            name: "Inkbox",
            objectID: "33014",
            one_liner:
              "Give your AI agents email, phone, iMessage and an internet address",
            slug: "inkbox",
            tags: ["Developer Tools", "Infrastructure", "AI"],
            team_size: 3,
            website: "https://inkbox.ai",
          },
        ],
      }),
    ).toEqual([
      {
        batch: "Summer 2026",
        description: "We are building the communication layer for AI agents.",
        id: "33014",
        industries: ["B2B", "Infrastructure"],
        launchedAt: new Date("2026-07-01T04:53:32.000Z"),
        location: "Boston, MA, USA",
        name: "Inkbox",
        oneLiner:
          "Give your AI agents email, phone, iMessage and an internet address",
        profileUrl: "https://www.ycombinator.com/companies/inkbox",
        slug: "inkbox",
        tags: ["Developer Tools", "Infrastructure", "AI"],
        teamSize: 3,
        websiteUrl: "https://inkbox.ai",
      },
    ]);
  });
});

describe("toYcAiManualNewsInput", () => {
  it("turns a YC AI company launch into a startup news candidate", () => {
    const newsInput = toYcAiManualNewsInput({
      company: {
        batch: "Summer 2026",
        description: "We are building the communication layer for AI agents.",
        id: "33014",
        industries: ["B2B", "Infrastructure"],
        launchedAt: new Date("2026-07-01T04:53:32.000Z"),
        location: "Boston, MA, USA",
        name: "Inkbox",
        oneLiner:
          "Give your AI agents email, phone, iMessage and an internet address",
        profileUrl: "https://www.ycombinator.com/companies/inkbox",
        slug: "inkbox",
        tags: ["Developer Tools", "Infrastructure", "AI"],
        teamSize: 3,
        websiteUrl: "https://inkbox.ai",
      },
      sourceId,
      sourceSlug: "yc-ai",
    });

    expect(newsInput).toMatchObject({
      publishedAt: new Date("2026-07-01T04:53:32.000Z"),
      sourceId,
      summary:
        "Inkbox is a Summer 2026 YC AI company: Give your AI agents email, phone, iMessage and an internet address.",
      title: "Inkbox launched from YC as an AI company",
      url: "https://www.ycombinator.com/companies/inkbox",
    });
    expect(newsInput.tags).toEqual(
      expect.arrayContaining([
        "yc",
        "yc_company",
        "ai_startup",
        "developer_tools",
        "infrastructure",
      ]),
    );
  });
});
