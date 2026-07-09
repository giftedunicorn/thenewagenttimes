import type { NewsHomeItem } from "./news-home-model";
import {
  getNewsStructuredDataUrl,
  newsStructuredDataSiteName,
} from "./news-structured-data";

const newsRssDescription =
  "A personalized front page for AI agents, frontier models, funding, research, launches, and market shifts.";
const newsRssItemLimit = 30;
const newsJsonFeedVersion = "https://jsonfeed.org/version/1.1";

export interface NewsJsonFeedAuthor {
  name: string;
}

export interface NewsJsonFeedItem {
  authors: NewsJsonFeedAuthor[];
  content_text: string;
  date_published: string;
  external_url?: string;
  id: string;
  image?: string;
  tags: string[];
  title: string;
  url: string;
}

export interface NewsJsonFeed {
  description: string;
  feed_url: string;
  home_page_url: string;
  items: NewsJsonFeedItem[];
  title: string;
  version: typeof newsJsonFeedVersion;
}

const xmlEntities: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&apos;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeXml = (value: string) =>
  value.replace(/["&'<>]/g, (character) => xmlEntities[character] ?? character);

const getRssDate = (date: string) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(0).toUTCString();
  }

  return parsedDate.toUTCString();
};

const getJsonFeedDate = (date: string) => {
  const parsedDate = new Date(date);

  return Number.isNaN(parsedDate.getTime())
    ? new Date(0).toISOString()
    : parsedDate.toISOString();
};

const getUniqueJsonFeedTags = (item: NewsHomeItem) => {
  const seenTags = new Set<string>();
  const tags: string[] = [];

  for (const tag of [item.category, ...item.tags, ...item.entities]) {
    const trimmedTag = tag.trim();
    const normalizedTag = trimmedTag.toLowerCase();

    if (!trimmedTag || seenTags.has(normalizedTag)) continue;

    tags.push(trimmedTag);
    seenTags.add(normalizedTag);
  }

  return tags;
};

const getNewsFeedExternalUrl = (item: NewsHomeItem) => {
  const sourceUrl = item.canonicalUrl ?? item.originalUrl ?? null;
  const trimmedUrl = sourceUrl?.trim();

  return trimmedUrl && /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : undefined;
};

const getNewsFeedImageUrl = ({
  baseUrl,
  imageUrl,
}: {
  baseUrl?: string;
  imageUrl: string | null;
}) => {
  const trimmedUrl = imageUrl?.trim();

  if (!trimmedUrl) return undefined;
  if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;

  return trimmedUrl.startsWith("/")
    ? getNewsStructuredDataUrl({ baseUrl, path: trimmedUrl })
    : undefined;
};

export const getNewsJsonFeed = ({
  baseUrl,
  items,
}: {
  baseUrl?: string;
  items: readonly NewsHomeItem[];
}): NewsJsonFeed => {
  const feedItems = items.slice(0, newsRssItemLimit);

  return {
    description: newsRssDescription,
    feed_url: getNewsStructuredDataUrl({ baseUrl, path: "/feed.json" }),
    home_page_url: getNewsStructuredDataUrl({ baseUrl, path: "/" }),
    items: feedItems.map((item) => {
      const itemUrl = getNewsStructuredDataUrl({
        baseUrl,
        path: `/news/${item.id}`,
      });
      const externalUrl = getNewsFeedExternalUrl(item);
      const imageUrl = getNewsFeedImageUrl({
        baseUrl,
        imageUrl: item.imageUrl,
      });

      return {
        authors: [{ name: item.sourceName }],
        content_text: item.summary,
        date_published: getJsonFeedDate(item.publishedAt),
        ...(externalUrl ? { external_url: externalUrl } : {}),
        id: itemUrl,
        ...(imageUrl ? { image: imageUrl } : {}),
        tags: getUniqueJsonFeedTags(item),
        title: item.title,
        url: itemUrl,
      };
    }),
    title: newsStructuredDataSiteName,
    version: newsJsonFeedVersion,
  };
};

export const getNewsRssFeed = ({
  baseUrl,
  items,
}: {
  baseUrl?: string;
  items: readonly NewsHomeItem[];
}) => {
  const feedItems = items.slice(0, newsRssItemLimit);
  const siteUrl = getNewsStructuredDataUrl({ baseUrl, path: "/" });
  const feedUrl = getNewsStructuredDataUrl({ baseUrl, path: "/rss.xml" });
  const lastBuildDate = getRssDate(
    feedItems[0]?.publishedAt ?? new Date(0).toISOString(),
  );

  const itemXml = feedItems
    .map((item) => {
      const itemUrl = getNewsStructuredDataUrl({
        baseUrl,
        path: `/news/${item.id}`,
      });
      const sourceUrl = getNewsStructuredDataUrl({
        baseUrl,
        path: `/sources/${item.sourceSlug}`,
      });
      const imageUrl = getNewsFeedImageUrl({
        baseUrl,
        imageUrl: item.imageUrl,
      });

      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(itemUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>`,
        `      <description>${escapeXml(item.summary)}</description>`,
        `      <pubDate>${getRssDate(item.publishedAt)}</pubDate>`,
        `      <source url="${escapeXml(sourceUrl)}">${escapeXml(item.sourceName)}</source>`,
        `      <category>${escapeXml(item.category)}</category>`,
        imageUrl
          ? `      <media:content url="${escapeXml(imageUrl)}" medium="image" />`
          : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    `    <title>${escapeXml(newsStructuredDataSiteName)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(newsRssDescription)}</description>`,
    "    <language>en</language>",
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    "    <ttl>5</ttl>",
    itemXml,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
};
