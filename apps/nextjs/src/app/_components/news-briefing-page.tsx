import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@acme/ui/button";
import { dedupeNewsItems, rankNewsForReader } from "@acme/validators";

import type { NewsHomeItem, NewsHomeStatus } from "./news-home-model";
import { NewsBriefingReaderLens } from "./news-briefing-reader-lens";
import { NewsEditionStoryActions } from "./news-edition-story-actions";
import {
  createDefaultNewsPreferenceProfile,
  formatNewsEditionDate,
  formatNewsTime,
  getNewsBriefingPack,
  getNewsEditionBriefing,
  getNewsFrontPageLayout,
  getNewsTopicHref,
} from "./news-home-model";

const newsBriefingSiteName = "The New AI Times";

const newsBriefingCategoryLabels: Record<string, string> = {
  agent_product: "Agents",
  big_tech: "Big Tech",
  funding: "Funding",
  hot_take: "Hot Takes",
  market_map: "Market Maps",
  model_release: "Models",
  musk_ai: "Musk AI",
  new_concept: "New Concepts",
  open_source: "Open Source",
  other: "Other",
  policy: "Policy",
  product_hunt: "Product Hunt",
  research: "Research",
  security: "Security",
  yc_ai: "YC AI",
};

const formatNewsBriefingCategory = (category: string) =>
  newsBriefingCategoryLabels[category] ?? category;

const getNewsBriefingStatusLabel = (status: NewsHomeStatus) =>
  status === "ready"
    ? "Live edition"
    : status === "empty"
      ? "Preview edition"
      : "Fallback edition";

export const getNewsBriefingPageMetadata = (): Metadata => ({
  alternates: {
    canonical: "/briefing",
  },
  description:
    "A ranked daily AI briefing from The New AI Times, packaged from story heat, source coverage, and reader-ready briefing slots.",
  openGraph: {
    description:
      "A ranked daily AI briefing from The New AI Times, packaged from story heat, source coverage, and reader-ready briefing slots.",
    siteName: newsBriefingSiteName,
    title: "Today's AI Briefing | The New AI Times",
    type: "website",
    url: "/briefing",
  },
  title: "Today's AI Briefing | The New AI Times",
  twitter: {
    card: "summary_large_image",
    description:
      "A ranked daily AI briefing from The New AI Times, packaged from story heat, source coverage, and reader-ready briefing slots.",
    title: "Today's AI Briefing | The New AI Times",
  },
});

export function NewsBriefingPage({
  generatedAt,
  items,
  status,
}: {
  generatedAt: string;
  items: NewsHomeItem[];
  status: NewsHomeStatus;
}) {
  const rankedItems = rankNewsForReader(
    dedupeNewsItems(items),
    createDefaultNewsPreferenceProfile(),
  );
  const editionBriefing = getNewsEditionBriefing({
    entityLimit: 4,
    formatCategory: formatNewsBriefingCategory,
    items: rankedItems,
    topicLimit: 4,
  });
  const briefingPack = getNewsBriefingPack({
    formatCategory: formatNewsBriefingCategory,
    items: rankedItems,
  });
  const frontPageLayout = getNewsFrontPageLayout({
    formatCategory: formatNewsBriefingCategory,
    items: rankedItems,
  });
  const leadItem = rankedItems[0] ?? null;
  const isPreview = status !== "ready";
  const rankedItemsById = new Map(rankedItems.map((item) => [item.id, item]));

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-end">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs tracking-[0.18em] uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] uppercase">
              Daily briefing
            </p>
            <h1 className="mt-2 text-4xl leading-none font-black tracking-normal sm:text-6xl">
              Today&apos;s AI Briefing
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              {editionBriefing.summary}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild className="rounded-none">
                <Link href="/">Open full front page</Link>
              </Button>
              <Button asChild className="rounded-none" variant="outline">
                <Link href="/reader">Tune For You</Link>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-3 border border-[#161616]/35 text-center dark:border-[#f4f1ea]/35">
            {editionBriefing.metrics.map((metric) => (
              <div
                className="border-r border-[#161616]/20 p-3 last:border-r-0 dark:border-[#f4f1ea]/15"
                key={metric.label}
              >
                <dt className="font-mono text-[10px] tracking-[0.12em] uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-2xl font-black">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <NewsBriefingReaderLens
        generatedAt={generatedAt}
        items={items}
        status={status}
      />

      <section className="container grid gap-6 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.55fr)]">
        <article className="grid gap-4 border-b border-[#161616]/25 pb-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(240px,0.45fr)] dark:border-[#f4f1ea]/20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs tracking-[0.18em] uppercase">
                Lead briefing
              </span>
              <span className="border border-[#161616]/35 px-2 py-1 text-xs font-semibold dark:border-[#f4f1ea]/35">
                {getNewsBriefingStatusLabel(status)}
              </span>
              <span className="border border-[#161616]/35 px-2 py-1 text-xs font-semibold dark:border-[#f4f1ea]/35">
                {formatNewsEditionDate(generatedAt)}
              </span>
            </div>
            <h2 className="mt-3 text-3xl leading-tight font-black sm:text-5xl">
              {leadItem ? (
                <Link className="hover:underline" href={`/news/${leadItem.id}`}>
                  {editionBriefing.headline}
                </Link>
              ) : (
                editionBriefing.headline
              )}
            </h2>
            {leadItem ? (
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#4a4a4a] dark:text-[#c8c4ba]">
                {leadItem.summary}
              </p>
            ) : null}
            {leadItem ? (
              <p className="mt-4 font-mono text-xs text-[#5b5750] dark:text-[#bbb4aa]">
                {leadItem.sourceName} / {formatNewsTime(leadItem.publishedAt)} /{" "}
                {formatNewsBriefingCategory(leadItem.category)}
              </p>
            ) : null}
            {leadItem ? (
              <NewsEditionStoryActions
                isPreview={isPreview}
                item={leadItem}
                rankSlot={1}
              />
            ) : null}
          </div>
          <Link
            aria-label={leadItem?.title ?? "The New AI Times briefing"}
            className="min-h-64 border border-[#161616]/25 bg-[#ded8ca] bg-cover bg-center dark:border-[#f4f1ea]/20 dark:bg-[#242424]"
            href={leadItem ? `/news/${leadItem.id}` : "/"}
            style={
              leadItem?.imageUrl
                ? { backgroundImage: `url(${leadItem.imageUrl})` }
                : undefined
            }
          />
        </article>

        <aside className="grid content-start gap-5">
          <section className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Top Topics</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {editionBriefing.topics.length > 0 ? (
                editionBriefing.topics.map((topic) => (
                  <Link
                    className="border border-[#161616]/25 px-2 py-1 hover:underline dark:border-[#f4f1ea]/20"
                    href={getNewsTopicHref(topic.category)}
                    key={topic.category}
                  >
                    {topic.label} / {topic.storyCount}
                  </Link>
                ))
              ) : (
                <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                  Waiting for topic clusters
                </span>
              )}
            </div>
          </section>
          <section className="border-t border-[#161616]/25 pt-4 dark:border-[#f4f1ea]/20">
            <h2 className="text-xl font-black">Entity Watch</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {editionBriefing.entities.length > 0 ? (
                editionBriefing.entities.map((entity) => (
                  <Link
                    className="border border-[#161616]/25 px-2 py-1 hover:underline dark:border-[#f4f1ea]/20"
                    href={`/entities/${encodeURIComponent(entity.entity)}`}
                    key={entity.entity}
                  >
                    {entity.entity} / {entity.storyCount}
                  </Link>
                ))
              ) : (
                <span className="text-[#5b5750] dark:text-[#bbb4aa]">
                  Waiting for entity signals
                </span>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="container grid gap-6 pb-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Briefing Pack</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {briefingPack.summary}
              </p>
            </div>
            <span className="shrink-0 border border-[#161616]/35 px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]/35">
              {briefingPack.label}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {briefingPack.slots.length > 0 ? (
              briefingPack.slots.map((slot, index) => {
                const slotItem = rankedItemsById.get(slot.id);

                return (
                  <article
                    className="grid gap-2 border-t border-[#161616]/25 pt-3 text-sm dark:border-[#f4f1ea]/20"
                    key={slot.id}
                  >
                    <Link
                      className="grid gap-2 hover:text-[#8a241c] dark:hover:text-[#ff8b7e]"
                      href={`/news/${slot.id}`}
                    >
                      <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                        {slot.label} / {slot.scoreLabel}
                      </span>
                      <span className="leading-5 font-black">{slot.title}</span>
                      <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {slot.sourceName} / {slot.categoryLabel}
                      </span>
                      <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                        {slot.reason}
                      </span>
                    </Link>
                    {slotItem ? (
                      <NewsEditionStoryActions
                        isPreview={isPreview}
                        item={slotItem}
                        rankSlot={index + 1}
                      />
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                Briefing slots will appear after stories are ranked.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">A1 Desk</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                {frontPageLayout.summary}
              </p>
            </div>
            <span className="shrink-0 border border-[#161616]/35 px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]/35">
              {frontPageLayout.label}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {frontPageLayout.sections.length > 0 ? (
              frontPageLayout.sections.map((section) => (
                <Link
                  className="grid gap-2 border-t border-[#161616]/25 pt-3 text-sm hover:text-[#8a241c] dark:border-[#f4f1ea]/20 dark:hover:text-[#ff8b7e]"
                  href={`/news/${section.id}`}
                  key={`${section.label}-${section.id}`}
                >
                  <span className="font-mono text-xs text-[#8a241c] dark:text-[#ff8b7e]">
                    {section.label} / {section.treatment}
                  </span>
                  <span className="leading-5 font-black">{section.title}</span>
                  <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {section.sourceName} / {section.categoryLabel} /{" "}
                    {section.scoreLabel}
                  </span>
                  <span className="text-xs leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                    {section.reason}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                A1 layout will appear after ranked stories are available.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
