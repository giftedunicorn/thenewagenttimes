import type { RankedNewsItem } from "@acme/validators";

import type { NewsHomeItem } from "./news-home-model";

export type NewsPublicFrontPageItem = RankedNewsItem<NewsHomeItem>;

export interface NewsPublicFrontPage {
  editorPicks: NewsPublicFrontPageItem[];
  latest: NewsPublicFrontPageItem[];
  lead: NewsPublicFrontPageItem | null;
  mostRead: NewsPublicFrontPageItem[];
  stream: NewsPublicFrontPageItem[];
}

interface NewsPublicFrontPageOptions {
  editorPickLimit?: number;
  latestLimit?: number;
  mostReadLimit?: number;
}

const byPublishedAt = (
  left: NewsPublicFrontPageItem,
  right: NewsPublicFrontPageItem,
) => right.publishedAt.localeCompare(left.publishedAt);

const takeUnseen = (
  items: readonly NewsPublicFrontPageItem[],
  seenIds: Set<string>,
  limit: number,
) => {
  const selected: NewsPublicFrontPageItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) continue;

    selected.push(item);
    seenIds.add(item.id);
    if (selected.length === limit) break;
  }

  return selected;
};

export const selectNewsPublicFrontPage = (
  items: readonly NewsPublicFrontPageItem[],
  options: NewsPublicFrontPageOptions = {},
): NewsPublicFrontPage => {
  const latestLimit = options.latestLimit ?? 5;
  const mostReadLimit = options.mostReadLimit ?? 5;
  const editorPickLimit = options.editorPickLimit ?? 4;
  const lead = items[0] ?? null;
  const seenIds = new Set(lead ? [lead.id] : []);
  const chronologicalItems = [...items].sort(byPublishedAt);
  const latest = takeUnseen(chronologicalItems, seenIds, latestLimit);
  const mostRead = takeUnseen(
    [...items].sort(
      (left, right) =>
        right.trendScore - left.trendScore ||
        right.personalizedScore - left.personalizedScore ||
        byPublishedAt(left, right),
    ),
    seenIds,
    mostReadLimit,
  );

  const editorCandidates = [...items].sort(
    (left, right) =>
      right.sourceScore - left.sourceScore ||
      right.trendScore - left.trendScore ||
      byPublishedAt(left, right),
  );
  const editorPicks: NewsPublicFrontPageItem[] = [];
  const selectedCategories = new Set<string>();
  const selectedSources = new Set<string>();

  for (const item of editorCandidates) {
    if (seenIds.has(item.id)) continue;
    if (
      editorPicks.length > 0 &&
      (selectedCategories.has(item.category) ||
        selectedSources.has(item.sourceSlug))
    ) {
      continue;
    }

    editorPicks.push(item);
    seenIds.add(item.id);
    selectedCategories.add(item.category);
    selectedSources.add(item.sourceSlug);
    if (editorPicks.length === editorPickLimit) break;
  }

  if (editorPicks.length < editorPickLimit) {
    editorPicks.push(
      ...takeUnseen(
        editorCandidates,
        seenIds,
        editorPickLimit - editorPicks.length,
      ),
    );
  }

  return {
    editorPicks,
    latest,
    lead,
    mostRead,
    stream: chronologicalItems.filter((item) => !seenIds.has(item.id)),
  };
};
