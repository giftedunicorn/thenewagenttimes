import type { FormEvent, ReactNode, RefObject } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import type { NewsFeedMode } from "./news-home-model";
import type {
  NewsPublicFrontPage,
  NewsPublicFrontPageItem,
} from "./news-public-front-page-model";
import { AuthMenu } from "./auth-menu";
import {
  formatNewsEditionDate,
  formatNewsTime,
  getNewsTopicHref,
} from "./news-home-model";

const channels = [
  ["Latest", null],
  ["Models", "model_release"],
  ["Agents", "agent_product"],
  ["Startups", "yc_ai"],
  ["Research", "research"],
  ["Funding", "funding"],
  ["Security", "security"],
] as const;

const feedModes = [
  ["Latest", "latest"],
  ["For You", "for_you"],
  ["Trending", "trending"],
] as const satisfies readonly [string, NewsFeedMode][];

const passThroughNewsImageLoader = ({ src }: { src: string }) => src;

interface NewsPublicFrontPageProps {
  feedMode: NewsFeedMode;
  feedEndRef: RefObject<HTMLDivElement | null>;
  frontPage: NewsPublicFrontPage;
  generatedAt: string;
  hasExploreFilters: boolean;
  hasMoreItems: boolean;
  isLoadingMore: boolean;
  isPreview: boolean;
  lessCount: number;
  loadMoreDisabled: boolean;
  readerSummary: string;
  savedCount: number;
  searchDraft: string;
  formatCategory: (category: string) => string;
  onClearSearch: () => void;
  onFeedModeChange: (mode: NewsFeedMode) => void;
  onLoadMore: () => void;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  renderStoryActions: (
    item: NewsPublicFrontPageItem,
    rankSlot: number,
  ) => ReactNode;
}

const StoryImage = ({
  aspect = "wide",
  formatCategory,
  item,
  priority = false,
}: {
  aspect?: "square" | "wide";
  formatCategory: (category: string) => string;
  item: NewsPublicFrontPageItem;
  priority?: boolean;
}) => (
  <div
    className={`${aspect === "wide" ? "aspect-video" : "aspect-[4/3]"} relative flex w-full items-end overflow-hidden border border-[#171717]/20 bg-[#e9e4da] p-4 dark:border-white/20 dark:bg-[#23211e]`}
  >
    {item.imageUrl ? (
      <Image
        alt={`Visual for ${item.title}`}
        className="object-cover"
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        fill
        loader={passThroughNewsImageLoader}
        loading={priority ? "eager" : "lazy"}
        sizes={
          aspect === "wide"
            ? "(min-width: 1024px) 50vw, 100vw"
            : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        }
        src={item.imageUrl}
        unoptimized
      />
    ) : (
      <div className="flex w-full items-end justify-between gap-4">
        <span className="max-w-[70%] font-serif text-xl leading-tight font-bold sm:text-2xl">
          {formatCategory(item.category)}
        </span>
        <span className="font-mono text-sm font-bold text-[#8b1e18] dark:text-[#ff8378]">
          {item.sourceName}
        </span>
      </div>
    )}
  </div>
);

const StoryMeta = ({
  formatCategory,
  item,
}: {
  formatCategory: (category: string) => string;
  item: NewsPublicFrontPageItem;
}) => (
  <p className="text-xs leading-5 text-[#625f59] dark:text-[#b9b5ad]">
    <span className="font-semibold text-[#8b1e18] uppercase dark:text-[#ff8378]">
      {formatCategory(item.category)}
    </span>{" "}
    <span aria-hidden="true">/</span> {item.sourceName}{" "}
    <span aria-hidden="true">/</span> {formatNewsTime(item.publishedAt)}
  </p>
);

export function NewsPublicFrontPageView({
  feedMode,
  feedEndRef,
  formatCategory,
  frontPage,
  generatedAt,
  hasExploreFilters,
  hasMoreItems,
  isLoadingMore,
  isPreview,
  lessCount,
  loadMoreDisabled,
  onClearSearch,
  onFeedModeChange,
  onLoadMore,
  onSearchDraftChange,
  onSearchSubmit,
  readerSummary,
  renderStoryActions,
  savedCount,
  searchDraft,
}: NewsPublicFrontPageProps) {
  const { editorPicks, latest, lead, mostRead, stream } = frontPage;

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#faf9f6] text-[#171717] transition-colors dark:bg-[#0d0d0d] dark:text-[#f5f3ed]">
      <header className="border-b-2 border-[#171717] dark:border-[#f5f3ed]">
        <div className="container grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase">
              Independent AI intelligence
            </p>
            <h1 className="mt-1 font-serif text-4xl leading-none font-black sm:text-6xl lg:text-7xl">
              The New AI Times
            </h1>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{formatNewsEditionDate(generatedAt)}</span>
              <div className="flex items-center gap-3">
                <span className="hidden font-mono font-semibold uppercase sm:inline">
                  {isPreview ? "Preview edition" : "Live edition"}
                </span>
                <AuthMenu />
              </div>
            </div>
            <form
              action="/search"
              className="grid grid-cols-[minmax(0,1fr)_auto]"
              method="get"
              onSubmit={onSearchSubmit}
            >
              <Input
                aria-label="Search AI news"
                className="h-9 rounded-none border-[#171717]/50 bg-transparent dark:border-white/40"
                name="q"
                placeholder="Search models, agents, funding"
                value={searchDraft}
                onChange={(event) => onSearchDraftChange(event.target.value)}
              />
              <Button
                className="h-9 rounded-none bg-[#8b1e18] text-white hover:bg-[#6f1712] dark:bg-[#9f2a22] dark:hover:bg-[#b3342a]"
                type="submit"
              >
                Search
              </Button>
            </form>
          </div>
        </div>

        <nav
          aria-label="News channels"
          className="border-t border-[#171717]/25 dark:border-white/20"
        >
          <div className="container flex items-center gap-5 overflow-x-auto py-2.5 text-sm font-bold whitespace-nowrap">
            {channels.map(([label, category]) => (
              <Link
                key={label}
                className="shrink-0 hover:text-[#8b1e18] dark:hover:text-[#ff8378]"
                href={category ? getNewsTopicHref(category) : "/"}
              >
                {label}
              </Link>
            ))}
            <span className="h-4 w-px shrink-0 bg-[#171717]/25 dark:bg-white/25" />
            <Link href="/threads">Threads</Link>
            <Link href="/briefing">Briefing</Link>
            <Link href="/topics">Topics</Link>
            <Link href="/entities">Entities</Link>
            <Link href="/sources">Sources</Link>
            <Link href="/reader">Reader Center</Link>
            <Link href="/reader/following">Following</Link>
            <Link href="/reader/library">Library</Link>
            <Link href="/reader/onboarding">Set up</Link>
            <a href="/rss.xml">RSS</a>
          </div>
        </nav>

        <div className="container flex flex-wrap items-center justify-between gap-3 border-t border-[#171717]/25 py-3 dark:border-white/20">
          <div
            aria-label="Feed mode"
            className="flex border border-[#171717] dark:border-[#f5f3ed]"
          >
            {feedModes.map(([label, mode]) => (
              <Button
                key={mode}
                aria-pressed={feedMode === mode}
                className={`${feedMode === mode ? "bg-[#8b1e18] text-white hover:bg-[#6f1712] dark:bg-[#9f2a22] dark:hover:bg-[#b3342a]" : ""} rounded-none border-0 border-r border-[#171717] last:border-r-0 dark:border-[#f5f3ed]`}
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => onFeedModeChange(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
          {hasExploreFilters || searchDraft.trim() ? (
            <Button
              className="rounded-none"
              size="sm"
              type="button"
              variant="outline"
              onClick={onClearSearch}
            >
              Clear search
            </Button>
          ) : null}
        </div>
      </header>

      {lead ? (
        <section
          aria-label="Top stories"
          className="container grid border-b-2 border-[#171717] py-6 lg:grid-cols-[minmax(210px,0.62fr)_minmax(0,1.5fr)_minmax(230px,0.7fr)] dark:border-[#f5f3ed]"
        >
          <section className="order-2 border-t border-[#171717]/30 pt-5 lg:order-1 lg:border-t-0 lg:border-r lg:pt-0 lg:pr-5 dark:border-white/20">
            <h2 className="border-b border-[#171717] pb-2 font-serif text-2xl font-black dark:border-[#f5f3ed]">
              Latest
            </h2>
            <div className="divide-y divide-[#171717]/20 dark:divide-white/15">
              {latest.map((item) => (
                <article className="py-3" key={item.id}>
                  <p className="font-mono text-[11px] text-[#625f59] dark:text-[#b9b5ad]">
                    {formatNewsTime(item.publishedAt)} /{" "}
                    {formatCategory(item.category)}
                  </p>
                  <h3 className="mt-1 font-serif text-base leading-snug font-bold">
                    <Link className="hover:underline" href={`/news/${item.id}`}>
                      {item.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>

          <article className="order-1 pb-6 lg:order-2 lg:px-6 lg:pb-0">
            <StoryImage formatCategory={formatCategory} item={lead} priority />
            <StoryMeta formatCategory={formatCategory} item={lead} />
            <h2 className="mt-2 font-serif text-3xl leading-[1.05] font-black sm:text-4xl lg:text-5xl">
              <Link
                className="hover:text-[#8b1e18] dark:hover:text-[#ff8378]"
                href={`/news/${lead.id}`}
              >
                {lead.title}
              </Link>
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#4f4c47] dark:text-[#c6c2ba]">
              {lead.summary}
            </p>
            <div className="mt-4">{renderStoryActions(lead, 1)}</div>
          </article>

          <aside className="order-3 border-t border-[#171717]/30 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5 dark:border-white/20">
            <h2 className="border-b border-[#171717] pb-2 font-serif text-2xl font-black dark:border-[#f5f3ed]">
              Most Read
            </h2>
            <ol className="divide-y divide-[#171717]/20 dark:divide-white/15">
              {mostRead.map((item, index) => (
                <li
                  className="grid grid-cols-[2rem_1fr] gap-2 py-3"
                  key={item.id}
                >
                  <span className="font-serif text-2xl font-black text-[#8b1e18] dark:text-[#ff8378]">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-serif text-base leading-snug font-bold">
                      <Link
                        className="hover:underline"
                        href={`/news/${item.id}`}
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-[11px] text-[#625f59] dark:text-[#b9b5ad]">
                      {item.sourceName} / {formatNewsTime(item.publishedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t-2 border-[#8b1e18] pt-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-xl font-black">For You</h3>
                <span className="font-mono text-xs">
                  {savedCount} saved / {lessCount} less
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
                {readerSummary}
              </p>
              <Button
                asChild
                className="mt-3 w-full rounded-none"
                variant="outline"
              >
                <Link href="/reader">Open Reader Center</Link>
              </Button>
            </div>
          </aside>
        </section>
      ) : (
        <section className="container border-b-2 border-[#171717] py-16 text-center dark:border-[#f5f3ed]">
          <h2 className="font-serif text-3xl font-black">
            No stories in this edition
          </h2>
          <p className="mt-3 text-[#625f59] dark:text-[#b9b5ad]">
            Clear the current search or check back after the next refresh.
          </p>
        </section>
      )}

      {editorPicks.length > 0 ? (
        <section className="container border-b-2 border-[#171717] py-7 dark:border-[#f5f3ed]">
          <div className="flex items-end justify-between gap-4 border-b border-[#171717] pb-2 dark:border-[#f5f3ed]">
            <h2 className="font-serif text-3xl font-black">Editor's Picks</h2>
            <Link
              className="text-sm font-bold hover:underline"
              href="/briefing"
            >
              Full briefing
            </Link>
          </div>
          <div className="grid gap-x-5 gap-y-7 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {editorPicks.map((item, index) => (
              <article key={item.id}>
                <StoryImage
                  aspect="square"
                  formatCategory={formatCategory}
                  item={item}
                />
                <StoryMeta formatCategory={formatCategory} item={item} />
                <h3 className="mt-2 font-serif text-xl leading-tight font-black">
                  <Link className="hover:underline" href={`/news/${item.id}`}>
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
                  {item.summary}
                </p>
                <div className="mt-3">
                  {renderStoryActions(item, index + 12)}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container py-8">
        <div className="border-b-2 border-[#171717] pb-2 dark:border-[#f5f3ed]">
          <h2 className="font-serif text-3xl font-black">Latest News</h2>
        </div>
        <div className="divide-y divide-[#171717]/25 dark:divide-white/20">
          {stream.map((item, index) => (
            <article
              className="grid gap-4 py-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] lg:items-start"
              key={item.id}
            >
              <StoryImage
                aspect="square"
                formatCategory={formatCategory}
                item={item}
              />
              <div className="min-w-0">
                <StoryMeta formatCategory={formatCategory} item={item} />
                <h3 className="mt-2 font-serif text-2xl leading-tight font-black sm:text-3xl">
                  <Link
                    className="hover:text-[#8b1e18] dark:hover:text-[#ff8378]"
                    href={`/news/${item.id}`}
                  >
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[#625f59] dark:text-[#b9b5ad]">
                  {item.summary}
                </p>
              </div>
              <div className="sm:col-start-2 lg:col-start-3">
                {renderStoryActions(item, index + 20)}
              </div>
            </article>
          ))}
          {stream.length === 0 && lead ? (
            <p className="py-10 text-sm text-[#625f59] dark:text-[#b9b5ad]">
              More stories will appear after the next edition refresh.
            </p>
          ) : null}
        </div>

        {!isPreview ? (
          <div>
            <div ref={feedEndRef} aria-hidden="true" className="h-px w-full" />
            <div className="flex justify-center border-t border-[#171717]/25 pt-6 dark:border-white/20">
              <Button
                className="min-w-40 rounded-none"
                disabled={loadMoreDisabled}
                type="button"
                variant="outline"
                onClick={onLoadMore}
              >
                {isLoadingMore
                  ? "Loading"
                  : hasMoreItems
                    ? "Load more"
                    : "End of edition"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
