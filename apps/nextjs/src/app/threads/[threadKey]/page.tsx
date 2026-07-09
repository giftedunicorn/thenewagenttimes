import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { NewsHomeItem } from "../../_components/news-home-model";
import { NewsCoverageThreadDetailPage } from "../../_components/news-threads-page";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Read a clustered AI coverage thread with source timeline and reader feedback controls.",
  title: "Coverage Thread | The New AI Times",
};

const normalizeThreadRouteKey = (threadKey: string) => {
  try {
    return decodeURIComponent(threadKey.trim());
  } catch {
    return threadKey.trim();
  }
};

const getThreadRouteKeyForItem = (item: NewsHomeItem) => {
  const clusterKey = item.clusterKey?.trim();

  return clusterKey
    ? encodeURIComponent(clusterKey)
    : `topic-${encodeURIComponent(item.category)}`;
};

const hasThreadRouteKeyMatch = ({
  items,
  threadKey,
}: {
  items: readonly NewsHomeItem[];
  threadKey: string;
}) => {
  const normalizedThreadKey = normalizeThreadRouteKey(threadKey);

  return items.some((item) => {
    const routeKey = getThreadRouteKeyForItem(item);

    return (
      routeKey === threadKey ||
      normalizeThreadRouteKey(routeKey) === normalizedThreadKey
    );
  });
};

export default async function NewsThreadDetailRoutePage({
  params,
}: {
  params: Promise<{ threadKey: string }>;
}) {
  const { threadKey } = await params;
  const data = await getNewsHomeData();

  if (!hasThreadRouteKeyMatch({ items: data.items, threadKey })) {
    notFound();
  }

  return (
    <NewsCoverageThreadDetailPage
      items={data.items}
      status={data.status}
      threadKey={threadKey}
    />
  );
}
