import { describe, expect, it } from "vitest";

import {
  buildGitHubTrendingAiSearchUrl,
  parseGitHubTrendingAiRepositories,
  toGitHubTrendingAiManualNewsInput,
} from "./github";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("buildGitHubTrendingAiSearchUrl", () => {
  it("queries recently updated AI repositories with a bounded page size", () => {
    expect(
      buildGitHubTrendingAiSearchUrl({
        limit: 12,
        now: new Date("2026-07-04T12:00:00.000Z"),
      }),
    ).toBe(
      "https://api.github.com/search/repositories?q=topic%3Aartificial-intelligence%20pushed%3A%3E%3D2026-06-20%20stars%3A%3E%3D25&sort=stars&order=desc&per_page=12",
    );
  });
});

describe("parseGitHubTrendingAiRepositories", () => {
  it("keeps the repository fields needed for news ingestion", () => {
    expect(
      parseGitHubTrendingAiRepositories({
        items: [
          {
            description: "A framework for production AI agents.",
            forks_count: 456,
            full_name: "acme/agent-runtime",
            html_url: "https://github.com/acme/agent-runtime",
            language: "TypeScript",
            open_issues_count: 12,
            pushed_at: "2026-07-01T08:00:00Z",
            stargazers_count: 12_345,
            topics: ["ai-agents", "llm"],
          },
        ],
      }),
    ).toEqual([
      {
        description: "A framework for production AI agents.",
        forks: 456,
        fullName: "acme/agent-runtime",
        language: "TypeScript",
        openIssues: 12,
        pushedAt: "2026-07-01T08:00:00Z",
        stars: 12_345,
        topics: ["ai-agents", "llm"],
        url: "https://github.com/acme/agent-runtime",
      },
    ]);
  });
});

describe("toGitHubTrendingAiManualNewsInput", () => {
  it("turns a trending repository into an open-source news candidate", () => {
    const newsInput = toGitHubTrendingAiManualNewsInput({
      repository: {
        description: "A framework for production AI agents.",
        forks: 456,
        fullName: "acme/agent-runtime",
        language: "TypeScript",
        openIssues: 12,
        pushedAt: "2026-07-01T08:00:00Z",
        stars: 12_345,
        topics: ["ai-agents", "llm"],
        url: "https://github.com/acme/agent-runtime",
      },
      sourceId,
      sourceSlug: "github-trending-ai",
    });

    expect(newsInput).toMatchObject({
      publishedAt: new Date("2026-07-01T08:00:00.000Z"),
      sourceId,
      summary:
        "acme/agent-runtime is a GitHub AI repository with 12,345 stars. A framework for production AI agents.",
      title: "acme/agent-runtime is trending in AI open source",
      url: "https://github.com/acme/agent-runtime",
    });
    expect(newsInput.tags).toEqual(
      expect.arrayContaining([
        "github_repo",
        "open_source",
        "typescript",
        "ai_agents",
        "llm",
      ]),
    );
  });
});
