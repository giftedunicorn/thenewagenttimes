import { z } from "zod/v4";

import type { ManualNewsInput } from "./types";

const defaultHackerNewsAiQueries = [
  "ai",
  "llm",
  "openai",
  "anthropic",
  "agent",
] as const;
const hackerNewsLookbackDays = 7;
const defaultHackerNewsLimitPerQuery = 10;
const maxHackerNewsLimitPerQuery = 50;
const dayMs = 24 * 60 * 60 * 1000;

const HackerNewsStorySchema = z
  .object({
    author: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    num_comments: z.number().int().nonnegative().nullable().optional(),
    objectID: z.string().min(1),
    points: z.number().int().nonnegative().nullable().optional(),
    title: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

const HackerNewsSearchResponseSchema = z
  .object({
    hits: z.array(HackerNewsStorySchema),
  })
  .passthrough();

export interface HackerNewsAiStory {
  author: string | null;
  comments: number;
  discussionUrl: string;
  id: string;
  points: number;
  publishedAt: string;
  title: string;
  url: string;
}

export type HackerNewsAiFetchJson = (url: string) => Promise<unknown>;

const clampHackerNewsLimit = (limit: number) =>
  Math.min(Math.max(Math.trunc(limit), 1), maxHackerNewsLimitPerQuery);

const isSafeHackerNewsLinkedUrl = (value: string) => {
  if (!URL.canParse(value)) return false;

  const protocol = new URL(value).protocol;

  return protocol === "http:" || protocol === "https:";
};

const getLookbackTimestampSeconds = (now: Date) =>
  Math.floor((now.getTime() - hackerNewsLookbackDays * dayMs) / 1000);

export const buildHackerNewsAiSearchUrls = ({
  limitPerQuery = defaultHackerNewsLimitPerQuery,
  now = new Date(),
  queries = defaultHackerNewsAiQueries,
}: {
  limitPerQuery?: number;
  now?: Date;
  queries?: readonly string[];
} = {}) =>
  queries.map((query) => {
    const url = new URL("https://hn.algolia.com/api/v1/search_by_date");

    url.searchParams.set("query", query);
    url.searchParams.set("tags", "story");
    url.searchParams.set(
      "numericFilters",
      `created_at_i>=${getLookbackTimestampSeconds(now)}`,
    );
    url.searchParams.set(
      "hitsPerPage",
      String(clampHackerNewsLimit(limitPerQuery)),
    );

    return url.toString();
  });

export const parseHackerNewsAiStories = (
  payload: unknown,
): HackerNewsAiStory[] => {
  const parsed = HackerNewsSearchResponseSchema.parse(payload);

  return parsed.hits
    .map((hit) => {
      const title = hit.title?.trim();
      const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const linkedUrl = hit.url?.trim();
      const url = linkedUrl
        ? isSafeHackerNewsLinkedUrl(linkedUrl)
          ? linkedUrl
          : discussionUrl
        : discussionUrl;

      if (!title) return null;

      return {
        author: hit.author ?? null,
        comments: hit.num_comments ?? 0,
        discussionUrl,
        id: hit.objectID,
        points: hit.points ?? 0,
        publishedAt: hit.created_at,
        title,
        url,
      };
    })
    .filter((story): story is HackerNewsAiStory => story !== null);
};

const defaultFetchJson: HackerNewsAiFetchJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Hacker News search failed: ${response.status}`);
  }

  return response.json();
};

export const fetchHackerNewsAiStories = async ({
  fetchJson = defaultFetchJson,
  limitPerQuery,
  now,
  queries,
}: {
  fetchJson?: HackerNewsAiFetchJson;
  limitPerQuery?: number;
  now?: Date;
  queries?: readonly string[];
} = {}) => {
  const storiesById = new Map<string, HackerNewsAiStory>();

  for (const url of buildHackerNewsAiSearchUrls({
    limitPerQuery,
    now,
    queries,
  })) {
    for (const story of parseHackerNewsAiStories(await fetchJson(url))) {
      storiesById.set(story.id, story);
    }
  }

  return [...storiesById.values()];
};

const numberFormatter = new Intl.NumberFormat("en-US");

const buildHackerNewsBodyText = (story: HackerNewsAiStory) =>
  [
    `HN story: ${story.title}`,
    `Points: ${numberFormatter.format(story.points)}`,
    `Comments: ${numberFormatter.format(story.comments)}`,
    story.author ? `Author: ${story.author}` : "",
    `Discussion: ${story.discussionUrl}`,
    `Linked URL: ${story.url}`,
  ]
    .filter(Boolean)
    .join("\n");

const getHackerNewsSignalTags = (story: HackerNewsAiStory) => {
  const tags = new Set(["hacker_news", "community_signal"]);
  const title = story.title.toLowerCase();

  if (/\bagents?\b/.test(title)) tags.add("agent");
  if (/\bworkflows?\b/.test(title)) tags.add("workflow_automation");
  if (/\bllms?\b/.test(title)) tags.add("model");
  if (/\bopenai\b/.test(title)) tags.add("openai");
  if (/\banthropic\b/.test(title)) tags.add("anthropic");

  return [...tags];
};

export const toHackerNewsAiManualNewsInput = ({
  sourceId,
  sourceSlug,
  story,
}: {
  sourceId: string;
  sourceSlug: string;
  story: HackerNewsAiStory;
}): ManualNewsInput => {
  const publishedAt = new Date(story.publishedAt);

  if (!Number.isFinite(publishedAt.getTime())) {
    throw new Error(
      `Invalid Hacker News created_at timestamp: ${story.publishedAt}`,
    );
  }

  return {
    authorName: story.author ?? undefined,
    bodyText: buildHackerNewsBodyText(story),
    publishedAt,
    sourceId,
    sourceSlug,
    summary: `Hacker News readers are discussing "${story.title}" with ${numberFormatter.format(
      story.points,
    )} points and ${numberFormatter.format(story.comments)} comments.`,
    tags: getHackerNewsSignalTags(story),
    title: `Hacker News discussion: ${story.title}`,
    url: story.url,
  };
};
