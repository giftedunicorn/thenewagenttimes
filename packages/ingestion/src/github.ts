import { z } from "zod/v4";

import type { ManualNewsInput } from "./types";

const githubTrendingAiTopic = "artificial-intelligence";
const githubTrendingLookbackDays = 14;
const githubTrendingMinimumStars = 25;
const defaultGitHubTrendingLimit = 25;
const maxGitHubTrendingLimit = 100;
const dayMs = 24 * 60 * 60 * 1000;

const GitHubSearchRepositorySchema = z
  .object({
    description: z.string().nullable().optional(),
    forks_count: z.number().int().nonnegative(),
    full_name: z.string().min(1),
    html_url: z.string().url(),
    language: z.string().nullable().optional(),
    open_issues_count: z.number().int().nonnegative().optional(),
    pushed_at: z.string().datetime(),
    stargazers_count: z.number().int().nonnegative(),
    topics: z.array(z.string()).optional().default([]),
  })
  .passthrough();

const GitHubSearchResponseSchema = z
  .object({
    items: z.array(GitHubSearchRepositorySchema),
  })
  .passthrough();

export interface GitHubTrendingAiRepository {
  description: string | null;
  forks: number;
  fullName: string;
  language: string | null;
  openIssues: number;
  pushedAt: string;
  stars: number;
  topics: string[];
  url: string;
}

export type GitHubTrendingAiFetchJson = (url: string) => Promise<unknown>;

const clampGitHubLimit = (limit: number) =>
  Math.min(Math.max(Math.trunc(limit), 1), maxGitHubTrendingLimit);

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export const buildGitHubTrendingAiSearchUrl = ({
  limit = defaultGitHubTrendingLimit,
  now = new Date(),
}: {
  limit?: number;
  now?: Date;
} = {}) => {
  const pushedSince = formatDate(
    new Date(now.getTime() - githubTrendingLookbackDays * dayMs),
  );
  const query = `topic:${githubTrendingAiTopic} pushed:>=${pushedSince} stars:>=${githubTrendingMinimumStars}`;

  return `https://api.github.com/search/repositories?q=${encodeURIComponent(
    query,
  )}&sort=stars&order=desc&per_page=${clampGitHubLimit(limit)}`;
};

export const parseGitHubTrendingAiRepositories = (
  payload: unknown,
): GitHubTrendingAiRepository[] => {
  const parsed = GitHubSearchResponseSchema.parse(payload);

  return parsed.items.map((repository) => ({
    description: repository.description ?? null,
    forks: repository.forks_count,
    fullName: repository.full_name,
    language: repository.language ?? null,
    openIssues: repository.open_issues_count ?? 0,
    pushedAt: repository.pushed_at,
    stars: repository.stargazers_count,
    topics: repository.topics,
    url: repository.html_url,
  }));
};

const defaultFetchJson: GitHubTrendingAiFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "the-new-agent-times-ingestion",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub repository search failed: ${response.status}`);
  }

  return response.json();
};

export const fetchGitHubTrendingAiRepositories = async ({
  fetchJson = defaultFetchJson,
  limit,
  now,
}: {
  fetchJson?: GitHubTrendingAiFetchJson;
  limit?: number;
  now?: Date;
} = {}) =>
  parseGitHubTrendingAiRepositories(
    await fetchJson(buildGitHubTrendingAiSearchUrl({ limit, now })),
  );

const numberFormatter = new Intl.NumberFormat("en-US");

const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isNonBlankString = (value: string | undefined): value is string =>
  Boolean(value?.trim());

const buildGitHubRepositoryBodyText = (
  repository: GitHubTrendingAiRepository,
) =>
  [
    `Repository: ${repository.fullName}`,
    repository.description ? `Description: ${repository.description}` : "",
    repository.language ? `Language: ${repository.language}` : "",
    `Stars: ${numberFormatter.format(repository.stars)}`,
    `Forks: ${numberFormatter.format(repository.forks)}`,
    `Open issues: ${numberFormatter.format(repository.openIssues)}`,
    repository.topics.length > 0
      ? `Topics: ${repository.topics.join(", ")}`
      : "",
    `Last pushed: ${repository.pushedAt}`,
  ]
    .filter(Boolean)
    .join("\n");

export const toGitHubTrendingAiManualNewsInput = ({
  repository,
  sourceId,
  sourceSlug,
}: {
  repository: GitHubTrendingAiRepository;
  sourceId: string;
  sourceSlug: string;
}): ManualNewsInput => {
  const trimmedDescription = repository.description?.trim();
  const description =
    trimmedDescription && trimmedDescription.length > 0
      ? trimmedDescription
      : "No repository description provided.";
  const publishedAt = new Date(repository.pushedAt);

  if (!Number.isFinite(publishedAt.getTime())) {
    throw new Error(
      `Invalid GitHub pushed_at timestamp: ${repository.pushedAt}`,
    );
  }

  return {
    bodyText: buildGitHubRepositoryBodyText(repository),
    publishedAt,
    sourceId,
    sourceSlug,
    summary: `${repository.fullName} is a GitHub AI repository with ${numberFormatter.format(
      repository.stars,
    )} stars. ${description}`,
    tags: [
      "github_repo",
      "open_source",
      repository.language ? normalizeTag(repository.language) : undefined,
      ...repository.topics.map(normalizeTag),
    ].filter(isNonBlankString),
    title: `${repository.fullName} is trending in AI open source`,
    url: repository.url,
  };
};
