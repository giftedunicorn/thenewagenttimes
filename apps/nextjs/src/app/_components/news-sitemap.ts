import type { MetadataRoute } from "next";

import type { NewsHomeItem } from "./news-home-model";
import { getNewsTopicHref } from "./news-home-model";
import { getNewsStructuredDataUrl } from "./news-structured-data";

const sitemapChangeFrequency = "hourly" as const;

const getValidPublishedAt = (publishedAt: string) => {
  const date = new Date(publishedAt);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getLatestPublishedAt = (
  items: readonly Pick<NewsHomeItem, "publishedAt">[],
) => {
  const latestTime = items.reduce<number | null>((latest, item) => {
    const publishedAt = getValidPublishedAt(item.publishedAt);

    if (!publishedAt) return latest;

    const time = new Date(publishedAt).getTime();

    return latest === null ? time : Math.max(latest, time);
  }, null);

  return latestTime === null
    ? new Date(0).toISOString()
    : new Date(latestTime).toISOString();
};

const getGroupedLatestPublishedAt = <Key extends string>({
  getKey,
  items,
}: {
  getKey: (item: NewsHomeItem) => Key;
  items: readonly NewsHomeItem[];
}) => {
  const latestByKey = new Map<Key, string>();

  for (const item of items) {
    const key = getKey(item);
    const publishedAt = getValidPublishedAt(item.publishedAt);

    if (!publishedAt) continue;

    const existingPublishedAt = latestByKey.get(key);

    if (
      !existingPublishedAt ||
      new Date(publishedAt).getTime() > new Date(existingPublishedAt).getTime()
    ) {
      latestByKey.set(key, publishedAt);
    }
  }

  return latestByKey;
};

const getEntityLatestPublishedAt = (items: readonly NewsHomeItem[]) => {
  const latestByEntity = new Map<string, string>();
  const entityLabelsByKey = new Map<string, string>();

  for (const item of items) {
    const publishedAt = getValidPublishedAt(item.publishedAt);

    if (!publishedAt) continue;

    for (const entity of item.entities) {
      const value = entity.trim();
      const key = value.toLowerCase();

      if (!value || !key) continue;

      const existingPublishedAt = latestByEntity.get(key);

      if (
        !existingPublishedAt ||
        new Date(publishedAt).getTime() >
          new Date(existingPublishedAt).getTime()
      ) {
        latestByEntity.set(key, publishedAt);
        entityLabelsByKey.set(key, value);
      }
    }
  }

  return Array.from(latestByEntity, ([key, lastModified]) => ({
    entity: entityLabelsByKey.get(key) ?? key,
    lastModified,
  }));
};

const getThreadRouteKey = (
  item: Pick<NewsHomeItem, "category" | "clusterKey">,
) => {
  const clusterKey = item.clusterKey?.trim();

  if (clusterKey) return encodeURIComponent(clusterKey);

  return `topic-${encodeURIComponent(item.category)}`;
};

const getSitemapEntry = ({
  baseUrl,
  lastModified,
  path,
  priority,
}: {
  baseUrl?: string;
  lastModified: string;
  path: string;
  priority: number;
}) => ({
  changeFrequency: sitemapChangeFrequency,
  lastModified,
  priority,
  url: getNewsStructuredDataUrl({ baseUrl, path }),
});

export const getNewsSitemapEntries = ({
  baseUrl,
  items,
}: {
  baseUrl?: string;
  items: readonly NewsHomeItem[];
}): MetadataRoute.Sitemap => {
  const latestPublishedAt = getLatestPublishedAt(items);
  const latestByCategory = getGroupedLatestPublishedAt({
    getKey: (item) => item.category,
    items,
  });
  const latestBySource = getGroupedLatestPublishedAt({
    getKey: (item) => item.sourceSlug,
    items,
  });
  const latestByEntity = getEntityLatestPublishedAt(items);
  const latestByThreadRouteKey = getGroupedLatestPublishedAt({
    getKey: getThreadRouteKey,
    items,
  });

  return [
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/",
      priority: 1,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/briefing",
      priority: 0.9,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/threads",
      priority: 0.85,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/search",
      priority: 0.7,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/reader",
      priority: 0.65,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/reader/following",
      priority: 0.55,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/reader/library",
      priority: 0.55,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/reader/onboarding",
      priority: 0.45,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/rss.xml",
      priority: 0.6,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/feed.json",
      priority: 0.6,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/llms.txt",
      priority: 0.5,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/opensearch.xml",
      priority: 0.5,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/topics",
      priority: 0.8,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/sources",
      priority: 0.8,
    }),
    getSitemapEntry({
      baseUrl,
      lastModified: latestPublishedAt,
      path: "/entities",
      priority: 0.78,
    }),
    ...Array.from(latestByCategory, ([category, lastModified]) =>
      getSitemapEntry({
        baseUrl,
        lastModified,
        path: getNewsTopicHref(category),
        priority: 0.75,
      }),
    ),
    ...Array.from(latestBySource, ([sourceSlug, lastModified]) =>
      getSitemapEntry({
        baseUrl,
        lastModified,
        path: `/sources/${sourceSlug}`,
        priority: 0.7,
      }),
    ),
    ...latestByEntity.map(({ entity, lastModified }) =>
      getSitemapEntry({
        baseUrl,
        lastModified,
        path: `/entities/${encodeURIComponent(entity)}`,
        priority: 0.7,
      }),
    ),
    ...Array.from(latestByThreadRouteKey, ([threadRouteKey, lastModified]) =>
      getSitemapEntry({
        baseUrl,
        lastModified,
        path: `/threads/${threadRouteKey}`,
        priority: 0.72,
      }),
    ),
    ...items.map((item) =>
      getSitemapEntry({
        baseUrl,
        lastModified:
          getValidPublishedAt(item.publishedAt) ?? latestPublishedAt,
        path: `/news/${item.id}`,
        priority: 0.85,
      }),
    ),
  ];
};

export const getNewsRobotsPolicy = ({
  baseUrl,
}: {
  baseUrl?: string;
} = {}): MetadataRoute.Robots => ({
  rules: {
    allow: "/",
    disallow: "/api/",
    userAgent: "*",
  },
  sitemap: getNewsStructuredDataUrl({ baseUrl, path: "/sitemap.xml" }),
});
