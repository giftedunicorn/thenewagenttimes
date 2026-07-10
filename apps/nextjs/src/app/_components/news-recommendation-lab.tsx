"use client";

import Link from "next/link";

import { Button } from "@acme/ui/button";

import type { NewsReaderCenterData } from "./news-reader-center";

export function NewsRecommendationLabView({
  center,
}: {
  center: NewsReaderCenterData;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <Link
              className="font-mono text-xs uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <h1 className="mt-4 text-4xl leading-none font-black sm:text-6xl">
              Recommendation Lab
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              Inspect the ranking inputs and reader signals shaping the current
              edition.
            </p>
          </div>
          <Button asChild className="rounded-none" variant="outline">
            <Link href="/reader">Open Reader Center</Link>
          </Button>
        </div>
      </header>

      <div className="container grid gap-8 py-6 lg:grid-cols-2">
        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Ranking Inputs</h2>
          <div className="mt-4 grid gap-3">
            {center.rankingInputs.map((input) => (
              <article
                className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                key={input.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{input.label}</h3>
                  <span className="font-mono text-xs whitespace-nowrap">
                    {input.statusLabel} / {input.weightLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {input.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Training Signals</h2>
          <div className="mt-4 grid gap-3">
            {center.trainingSignals.length > 0 ? (
              center.trainingSignals.map((signal) => (
                <article
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={`${signal.label}-${signal.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{signal.label}</h3>
                    <span className="font-mono text-xs whitespace-nowrap">
                      {signal.tone} / {signal.weightLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {signal.detail}
                  </p>
                </article>
              ))
            ) : (
              <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                Reader actions will appear here after the first search, read,
                save, share, or Less signal.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Profile Impact</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {center.profileImpact.summary}
          </p>
          <div className="mt-4 grid gap-3">
            {center.profileImpact.stories.length > 0 ? (
              center.profileImpact.stories.map((story) => (
                <article
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={story.href}
                >
                  <Link
                    className="font-semibold hover:underline"
                    href={story.href}
                  >
                    {story.title}
                  </Link>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {story.sourceName} / {story.reason}
                  </p>
                </article>
              ))
            ) : (
              <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                Add reader signals to compare them with the current edition.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Recommendation Audit</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {center.recommendationAudit.summary}
          </p>
          <div className="mt-4 grid gap-3">
            {center.recommendationAudit.stories.length > 0 ? (
              center.recommendationAudit.stories.map((story) => (
                <article
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={story.href}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      className="font-semibold hover:underline"
                      href={story.href}
                    >
                      {story.title}
                    </Link>
                    <span className="font-mono text-xs whitespace-nowrap">
                      {story.signalCountLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {story.sourceName} / {story.summary}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {story.signals.map((signal) => (
                      <div
                        className="border-t border-[#161616]/15 pt-2 text-sm dark:border-[#f4f1ea]/10"
                        key={`${story.href}-${signal.label}`}
                      >
                        <span className="font-semibold">{signal.label}</span>
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {signal.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                No current stories are available for audit.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 lg:col-span-2 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Recent Signals</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {center.recentSignals.length > 0 ? (
              center.recentSignals.map((signal) => (
                <article
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={`${signal.label}-${signal.href}`}
                >
                  <span className="font-mono text-xs">{signal.label}</span>
                  <Link
                    className="mt-1 block font-semibold hover:underline"
                    href={signal.href}
                  >
                    {signal.title}
                  </Link>
                  <p className="mt-1 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                    {signal.sourceName}
                  </p>
                </article>
              ))
            ) : (
              <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                Recent reader signals will appear after the first interaction.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
