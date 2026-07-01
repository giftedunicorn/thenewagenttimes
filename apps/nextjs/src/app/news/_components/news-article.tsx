"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";

import type {
  NewsPreferenceProfile,
  ReaderInteractionAction,
} from "@acme/validators";
import { Button } from "@acme/ui/button";
import {
  rankNewsForReader,
  updateReaderProfileWithInteraction,
} from "@acme/validators";

import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";
import { useTRPC } from "~/trpc/react";

interface NewsArticleProps {
  article: NewsArticleItem;
  related: NewsHomeItem[];
}

const defaultProfile: NewsPreferenceProfile = {
  preferredCategories: [],
  preferredSources: [],
  preferredEntities: [],
  noveltyBias: 1,
  recencyBias: 1,
};

const profileStorageKey = "new-ai-times-profile";
const visitorStorageKey = "new-ai-times-visitor-key";

const categoryLabels: Record<string, string> = {
  funding: "Funding",
  product_hunt: "Product Hunt",
  model_release: "Models",
  new_concept: "New Concepts",
  hot_take: "Hot Takes",
  agent_product: "Agents",
  big_tech: "Big Tech",
  musk_ai: "Musk AI",
  yc_ai: "YC AI",
  research: "Research",
  policy: "Policy",
  security: "Security",
  open_source: "Open Source",
  market_map: "Market Maps",
  other: "Other",
};

const readStoredProfile = (): NewsPreferenceProfile => {
  if (typeof window === "undefined") return defaultProfile;
  const stored = window.localStorage.getItem(profileStorageKey);
  if (!stored) return defaultProfile;

  try {
    const parsed = JSON.parse(stored) as Partial<NewsPreferenceProfile>;
    return {
      preferredCategories: Array.isArray(parsed.preferredCategories)
        ? parsed.preferredCategories.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      preferredSources: Array.isArray(parsed.preferredSources)
        ? parsed.preferredSources.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      preferredEntities: Array.isArray(parsed.preferredEntities)
        ? parsed.preferredEntities.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      noveltyBias:
        typeof parsed.noveltyBias === "number" ? parsed.noveltyBias : 1,
      recencyBias:
        typeof parsed.recencyBias === "number" ? parsed.recencyBias : 1,
    };
  } catch {
    return defaultProfile;
  }
};

const writeStoredProfile = (profile: NewsPreferenceProfile) => {
  window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
};

const readOrCreateVisitorKey = () => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(visitorStorageKey);
  if (stored) return stored;

  const next =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(visitorStorageKey, next);
  return next;
};

const stripPersistedFlag = (
  profile: NewsPreferenceProfile & { persisted: boolean },
): NewsPreferenceProfile => ({
  preferredCategories: profile.preferredCategories,
  preferredSources: profile.preferredSources,
  preferredEntities: profile.preferredEntities,
  noveltyBias: profile.noveltyBias,
  recencyBias: profile.recencyBias,
});

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const paragraphsFromArticle = (article: NewsArticleItem) => {
  const text = article.bodyText?.trim() ?? article.summary;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [article.summary];
};

export function NewsArticle({ article, related }: NewsArticleProps) {
  const trpc = useTRPC();
  const [profile, setProfile] =
    useState<NewsPreferenceProfile>(readStoredProfile);
  const [visitorKey] = useState<string | null>(readOrCreateVisitorKey);
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      onSuccess: (serverProfile) => {
        const nextProfile = stripPersistedFlag(serverProfile);
        setProfile(nextProfile);
        writeStoredProfile(nextProfile);
      },
    }),
  );

  useEffect(() => {
    if (!visitorKey) return;

    setProfile((current) => {
      const nextProfile = updateReaderProfileWithInteraction(current, article, {
        action: "view",
      });
      writeStoredProfile(nextProfile);
      return nextProfile;
    });

    recordInteraction.mutate({
      visitorKey,
      newsItemId: article.id,
      action: "view",
      metadata: { surface: "article" },
    });
    // This should run once per article open after the reader key is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, visitorKey]);

  const rankedRelated = useMemo(
    () => rankNewsForReader(related, profile),
    [profile, related],
  );
  const paragraphs = paragraphsFromArticle(article);

  const recordAction = (action: ReaderInteractionAction) => {
    setProfile((current) => {
      const nextProfile = updateReaderProfileWithInteraction(current, article, {
        action,
      });
      writeStoredProfile(nextProfile);
      return nextProfile;
    });

    if (visitorKey) {
      recordInteraction.mutate({
        visitorKey,
        newsItemId: article.id,
        action,
        metadata: { surface: "article" },
      });
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <Link
            className="text-3xl leading-none font-black tracking-normal sm:text-5xl"
            href="/"
          >
            The New AI Times
          </Link>
          <p className="max-w-xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
            Reading signals from this article are folded back into your front
            page ranking on this device.
          </p>
        </div>
      </header>

      <article className="container grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-normal text-[#8a241c] uppercase dark:text-[#ff8b7e]">
            <span>{categoryLabels[article.category] ?? article.category}</span>
            <span>/</span>
            <span>{article.sourceName}</span>
            <span>/</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>

          <h1 className="max-w-5xl text-4xl leading-[1.04] font-black tracking-normal sm:text-6xl lg:text-7xl">
            {article.title}
          </h1>
          <p className="mt-6 max-w-3xl border-l-4 border-[#8a241c] pl-5 text-xl leading-8 text-[#4a4a4a] dark:border-[#ff8b7e] dark:text-[#c8c4ba]">
            {article.summary}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="rounded-none"
              type="button"
              onClick={() => recordAction("save")}
            >
              Save signal
            </Button>
            <Button
              className="rounded-none"
              type="button"
              variant="outline"
              onClick={() => recordAction("share")}
            >
              Share signal
            </Button>
            <Button
              className="rounded-none"
              type="button"
              variant="outline"
              onClick={() => recordAction("hide")}
            >
              Less like this
            </Button>
            <Button asChild className="rounded-none" variant="outline">
              <a
                href={article.canonicalUrl ?? article.originalUrl}
                onClick={() => recordAction("click_source")}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                Source
              </a>
            </Button>
          </div>

          <div className="mt-10 max-w-3xl space-y-7 text-lg leading-8 text-[#2d2d2d] dark:text-[#ddd8ce]">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-6">
          <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
            <h2 className="text-xl font-black">Your Signal</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <SignalLine label="Category" value={article.category} />
              <SignalLine label="Source" value={article.sourceSlug} />
              <SignalLine
                label="Entities"
                value={article.entities.slice(0, 3).join(", ") || "None"}
              />
              <SignalLine
                label="Bias"
                value={`F${profile.recencyBias.toFixed(1)} / N${profile.noveltyBias.toFixed(1)}`}
              />
            </dl>
          </section>

          <section className="border border-[#161616] p-5 dark:border-[#f4f1ea]">
            <h2 className="text-xl font-black">Related Queue</h2>
            <div className="mt-4 grid gap-4">
              {rankedRelated.length > 0 ? (
                rankedRelated.slice(0, 5).map((item) => (
                  <Link
                    className="border-t border-[#161616]/20 pt-4 text-sm leading-5 hover:text-[#8a241c] dark:border-[#f4f1ea]/15 dark:hover:text-[#ff8b7e]"
                    href={`/news/${item.id}`}
                    key={item.id}
                  >
                    <span className="block font-mono text-xs">
                      {item.personalizedScore}
                    </span>
                    <span className="font-bold">{item.title}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  Related stories will appear once the ingestion run has more
                  published items.
                </p>
              )}
            </div>
          </section>
        </aside>
      </article>
    </main>
  );
}

function SignalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-current/20 pt-2">
      <dt>{label}</dt>
      <dd className="max-w-40 text-right font-mono">{value}</dd>
    </div>
  );
}
