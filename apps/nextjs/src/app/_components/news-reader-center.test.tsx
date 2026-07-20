import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  NewsPreferenceProfile,
  NewsRecommendationRotationObjective,
} from "@acme/validators";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

import type {
  NewsHomeItem,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import type {
  NewsReaderCenterData,
  NewsReaderCenterMemorySnapshot,
} from "./news-reader-center";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import * as newsReaderCenterModule from "./news-reader-center";
import {
  applyNewsReaderCenterMemoryTrainingSuggestion,
  applyNewsReaderCenterQuickStart,
  applyNewsReaderCenterSearchIntentPromotion,
  getNewsReaderCenterData,
  getNewsReaderCenterExportHref,
  getNewsReaderCenterQuickStarts,
  NewsReaderCenterView,
  parseNewsReaderCenterImportProfile,
  parseNewsReaderCenterImportSnapshot,
  removeNewsReaderCenterSearchMemoryItem,
  saveNewsReaderCenterProfileDraft,
} from "./news-reader-center";
import {
  newsHomeExposureStorageKey,
  newsSavedStorageKey,
  newsSearchStorageKey,
  readStoredNewsReaderMemoryItems,
  readStoredNewsSearchMemoryItems,
  writeStoredNewsReaderMemoryItems,
  writeStoredNewsSearchMemoryItems,
} from "./news-reader-memory-storage";
import {
  readStoredNewsForYouObjective,
  readStoredNewsPreferenceProfile,
  writeStoredNewsForYouObjective,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

type ReaderCenterImportWriter = (snapshot: {
  forYouObjective: NewsRecommendationRotationObjective | null;
  memory: NewsReaderCenterMemorySnapshot | null;
  profile: NewsPreferenceProfile;
}) => void;

const createWindowStub = () => {
  const target = new EventTarget();
  const storedValues = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return storedValues.size;
    },
    clear: () => {
      storedValues.clear();
    },
    getItem: (key) => storedValues.get(key) ?? null,
    key: (index) => Array.from(storedValues.keys())[index] ?? null,
    removeItem: (key) => {
      storedValues.delete(key);
    },
    setItem: (key, value) => {
      storedValues.set(key, value);
    },
  };
  const windowStub: Pick<
    Window,
    | "addEventListener"
    | "dispatchEvent"
    | "localStorage"
    | "removeEventListener"
  > = {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ) => {
      target.addEventListener(type, listener, options);
    },
    dispatchEvent: (event) => target.dispatchEvent(event),
    localStorage,
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: EventListenerOptions | boolean,
    ) => {
      target.removeEventListener(type, listener, options);
    },
  };

  vi.stubGlobal("window", windowStub);

  return windowStub;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const profile: NewsPreferenceProfile = {
  noveltyBias: 1.4,
  preferredCategories: ["agent_product"],
  preferredEntities: ["OpenAI", "Agents"],
  preferredSources: ["agent-desk"],
  recencyBias: 1.2,
};

const savedItem: NewsReaderMemoryItem = {
  canonicalUrl: "https://example.com/agent",
  category: "agent_product",
  entities: ["OpenAI"],
  id: "saved-agent",
  originalUrl: "https://source.example/agent",
  savedAt: "2026-07-06T08:35:00.000Z",
  sourceName: "Agent Desk",
  sourceSlug: "agent-desk",
  tags: ["agents"],
  title: "Saved agent story",
};

const historyItem: NewsReaderMemoryItem = {
  canonicalUrl: "https://example.com/model",
  category: "model_release",
  entities: ["Frontier Model"],
  id: "read-model",
  originalUrl: "https://source.example/model",
  sourceName: "Model Desk",
  sourceSlug: "model-desk",
  title: "Read model story",
  viewedAt: "2026-07-06T09:00:00.000Z",
};

const homeExposureItem: NewsReaderMemoryItem = {
  canonicalUrl: "https://example.com/exposed-agent",
  category: "agent_product",
  entities: ["OpenAI"],
  id: "home-exposed-agent",
  originalUrl: "https://source.example/exposed-agent",
  sourceName: "Agent Desk",
  sourceSlug: "agent-desk",
  title: "Home exposed agent story",
  viewedAt: "2026-07-06T10:00:00.000Z",
};

const guardrailItem: NewsReaderMemoryItem = {
  canonicalUrl: "https://example.com/noise",
  category: "hot_take",
  entities: ["Noise"],
  hiddenAt: "2026-07-06T09:15:00.000Z",
  id: "hidden-noise",
  originalUrl: "https://source.example/noise",
  sourceName: "Noise Desk",
  sourceSlug: "noise-desk",
  title: "Hidden noise story",
};

const positiveItem: NewsPositiveFeedbackMemoryItem = {
  action: "share",
  canonicalUrl: "https://example.com/shared",
  category: "research",
  entities: ["Research"],
  id: "shared-research",
  occurredAt: "2026-07-06T09:30:00.000Z",
  originalUrl: "https://source.example/shared",
  sourceName: "Research Desk",
  sourceSlug: "research-desk",
  tags: ["research"],
  title: "Shared research story",
};

const readPositiveItem: NewsPositiveFeedbackMemoryItem = {
  canonicalUrl: "https://example.com/deep-read",
  category: "model_release",
  entities: ["OpenAI"],
  id: "deep-read-model",
  occurredAt: "2026-07-06T09:35:00.000Z",
  originalUrl: "https://source.example/deep-read",
  sourceName: "Model Desk",
  sourceSlug: "model-desk",
  tags: ["models"],
  title: "Deep read model story",
};

const searchItem: NewsSearchMemoryItem = {
  query: "browser agents",
  resultCount: 2,
  searchedAt: "2026-07-06T09:45:00.000Z",
};

const createReaderCenterStory = (
  overrides: Partial<NewsHomeItem> & Pick<NewsHomeItem, "id" | "title">,
): NewsHomeItem => {
  const { id, title, ...itemOverrides } = overrides;

  return {
    canonicalUrl: null,
    category: "agent_product",
    entities: ["OpenAI"],
    id,
    imageUrl: null,
    publishedAt: "2026-07-06T10:00:00.000Z",
    sourceName: "Agent Desk",
    sourceScore: 88,
    sourceSlug: "agent-desk",
    sourceType: "manual",
    summary: "Reader center story",
    tags: ["browser agents"],
    title,
    trendScore: 82,
    ...itemOverrides,
  };
};

describe("getNewsReaderCenterData", () => {
  it("summarizes preference, search, saved, history, and feedback signals", () => {
    expect(
      getNewsReaderCenterData({
        guardrailItems: [guardrailItem],
        historyItems: [historyItem],
        positiveFeedbackItems: [positiveItem],
        profile,
        savedItems: [savedItem],
        searchItems: [searchItem],
      }),
    ).toMatchObject({
      forYouObjective: {
        label: "Reader match",
        objective: "reader_match",
        summary:
          "Reader profile and local behavior move first in the recommendation rotation.",
      },
      metrics: [
        { label: "Topics", value: "1" },
        { label: "Sources", value: "1" },
        { label: "Entities", value: "2" },
        { label: "Angles", value: "0" },
        { label: "Searches", value: "1" },
        { label: "Home exposures", value: "0" },
        { label: "Saved", value: "1" },
        { label: "Read", value: "1" },
        { label: "Hidden", value: "1" },
      ],
      memory: {
        guardrailItems: [guardrailItem],
        historyItems: [historyItem],
        homeExposureItems: [],
        positiveFeedbackItems: [positiveItem],
        restoredGuardrailItems: [],
        savedItems: [savedItem],
        searchItems: [searchItem],
      },
      profile: normalizeNewsPreferenceProfile(profile),
      readiness: {
        activeInputCount: 5,
        gapCount: 1,
        gaps: [
          {
            label: "Home exposure cooldown",
            summary:
              "Recently seen home cards are dampened for fresher angles.",
          },
        ],
        label: "Learning",
        score: 83,
        summary:
          "For You has 5 of 6 local ranking inputs active. Add home exposure cooldown to finish tuning.",
      },
      nextActions: [
        {
          href: "/",
          label: "Generate home exposure",
          summary:
            "Open the front page so recently seen stories can cool down and make room for fresher angles.",
        },
      ],
      recentSignals: [
        {
          href: "/search?q=browser%20agents",
          label: "Searched",
          sourceName: "2 results",
          title: "Search: browser agents",
        },
        {
          href: "/news/shared-research",
          label: "Shared",
          sourceName: "Research Desk",
          title: "Shared research story",
        },
        {
          href: "/news/hidden-noise",
          label: "Hidden",
          sourceName: "Noise Desk",
          title: "Hidden noise story",
        },
        {
          href: "/news/read-model",
          label: "Read",
          sourceName: "Model Desk",
          title: "Read model story",
        },
        {
          href: "/news/saved-agent",
          label: "Saved",
          sourceName: "Agent Desk",
          title: "Saved agent story",
        },
      ],
      trainingSignals: [
        {
          detail: "browser agents is steering short-term recommendations.",
          label: "Search intent",
          tone: "intent",
          weightLabel: "1 search",
        },
        {
          detail: "Profile and local actions are raising this topic.",
          label: "Boost Agents",
          tone: "boost",
          weightLabel: "2 signals",
        },
        {
          detail: "Less feedback is lowering similar stories from this topic.",
          label: "Dampen Hot Takes",
          tone: "dampen",
          weightLabel: "1 hidden",
        },
      ],
      signalGroups: [
        {
          label: "Preferred topics",
          values: [{ href: "/topics/agent-product", label: "Agents" }],
        },
        {
          label: "Preferred sources",
          values: [{ href: "/sources/agent-desk", label: "agent-desk" }],
        },
        {
          label: "Preferred entities",
          values: [
            { href: "/entities/OpenAI", label: "OpenAI" },
            { href: "/entities/Agents", label: "Agents" },
          ],
        },
        {
          label: "Preferred angles",
          values: [],
        },
        {
          label: "Recent searches",
          values: [
            { href: "/search?q=browser%20agents", label: "browser agents" },
          ],
        },
      ],
      rankingInputs: [
        {
          detail:
            "Profile topics, sources, and entities boost matching stories.",
          label: "Profile interests",
          signalCount: 4,
          statusLabel: "Active",
          weightLabel: "4 signals",
        },
        {
          detail:
            "Recent searches lift matching stories for the current session.",
          label: "Search intent",
          signalCount: 1,
          statusLabel: "Active",
          weightLabel: "1 search",
        },
        {
          detail: "Saves, shares, and source clicks lift similar stories.",
          label: "Positive actions",
          signalCount: 2,
          statusLabel: "Active",
          weightLabel: "2 actions",
        },
        {
          detail: "Read stories lift continuations while cooling down repeats.",
          label: "Read history",
          signalCount: 1,
          statusLabel: "Active",
          weightLabel: "1 read",
        },
        {
          detail: "Recently seen home cards are dampened for fresher angles.",
          label: "Home exposure cooldown",
          signalCount: 0,
          statusLabel: "Waiting",
          weightLabel: "0 exposures",
        },
        {
          detail:
            "Less feedback dampens similar topics, sources, and entities.",
          label: "Less feedback guardrail",
          signalCount: 1,
          statusLabel: "Active",
          weightLabel: "1 hidden",
        },
      ],
      memoryTrainingSuggestions: [
        {
          actionLabel: "Follow topic",
          kind: "category",
          label: "Models",
          signal: "model_release",
          summary:
            "Promote Models from 1 read story so For You can keep ranking similar coverage.",
          supportLabel: "1 read",
        },
        {
          actionLabel: "Follow topic",
          kind: "category",
          label: "Research",
          signal: "research",
          summary:
            "Promote Research from 1 positive action so For You can keep ranking similar coverage.",
          supportLabel: "1 positive action",
        },
        {
          actionLabel: "Follow source",
          kind: "source",
          label: "Model Desk",
          signal: "model-desk",
          summary:
            "Promote Model Desk from 1 read story so For You can keep ranking similar coverage.",
          supportLabel: "1 read",
        },
        {
          actionLabel: "Follow entity",
          kind: "entity",
          label: "Frontier Model",
          signal: "Frontier Model",
          summary:
            "Promote Frontier Model from 1 read story so For You can keep ranking similar coverage.",
          supportLabel: "1 read",
        },
      ],
    });
  });

  it("splits named entities from durable angle preferences", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      positiveFeedbackItems: [],
      profile: {
        ...profile,
        preferredEntities: ["OpenAI", "browser agents"],
      },
      savedItems: [],
      searchItems: [],
    });

    expect(center.metrics).toEqual(
      expect.arrayContaining([
        { label: "Entities", value: "1" },
        { label: "Angles", value: "1" },
      ]),
    );
    expect(center.signalGroups).toEqual(
      expect.arrayContaining([
        {
          label: "Preferred entities",
          values: [{ href: "/entities/OpenAI", label: "OpenAI" }],
        },
        {
          label: "Preferred angles",
          values: [
            {
              href: "/search?q=browser%20agents",
              label: "browser agents",
            },
          ],
        },
      ]),
    );
  });

  it("suggests durable angle follows from reader memory tags", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [
        {
          ...historyItem,
          category: "agent_product",
          entities: ["OpenAI"],
          id: "read-browser-agent-angle",
          sourceName: "Agent Desk",
          sourceSlug: "agent-desk",
          tags: ["browser-agents"],
          title: "Read browser agent angle",
        },
      ],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [],
    });

    expect(center.memoryTrainingSuggestions).toContainEqual({
      actionLabel: "Follow angle",
      kind: "angle",
      label: "browser agents",
      signal: "browser agents",
      summary:
        "Promote browser agents from 1 read story so For You can keep ranking similar coverage.",
      supportLabel: "1 read",
    });
  });

  it("labels actionless positive feedback as a read signal", () => {
    expect(
      getNewsReaderCenterData({
        guardrailItems: [],
        historyItems: [],
        positiveFeedbackItems: [readPositiveItem],
        profile,
        savedItems: [],
        searchItems: [],
      }).recentSignals,
    ).toContainEqual({
      href: "/news/deep-read-model",
      label: "Read",
      occurredAt: "2026-07-06T09:35:00.000Z",
      sourceName: "Model Desk",
      title: "Deep read model story",
    });
  });

  it("summarizes the selected For You rotation objective", () => {
    const request = {
      forYouObjective: "source_trust",
      guardrailItems: [],
      historyItems: [],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [],
    } satisfies Parameters<typeof getNewsReaderCenterData>[0] & {
      forYouObjective: NewsRecommendationRotationObjective;
    };

    expect(getNewsReaderCenterData(request)).toMatchObject({
      forYouObjective: {
        label: "Source trust",
        objective: "source_trust",
        summary:
          "High-trust sources move first in the recommendation rotation.",
      },
    });
  });

  it("surfaces home exposure memory so recommendation cooldowns are auditable", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      homeExposureItems: [homeExposureItem],
      positiveFeedbackItems: [positiveItem],
      profile,
      savedItems: [savedItem],
      searchItems: [searchItem],
    });

    expect(center.memory).toMatchObject({
      homeExposureItems: [homeExposureItem],
    });
    expect(center.metrics).toEqual(
      expect.arrayContaining([{ label: "Home exposures", value: "1" }]),
    );
    expect(center.recentSignals[0]).toMatchObject({
      href: "/news/home-exposed-agent",
      label: "Home exposure",
      sourceName: "Agent Desk",
      title: "Home exposed agent story",
    });
    expect(center.trainingSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Exposure cooldown",
          tone: "intent",
          weightLabel: "1 exposure",
        }),
      ]),
    );
    expect(center.rankingInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: "Recently seen home cards are dampened for fresher angles.",
          label: "Home exposure cooldown",
          signalCount: 1,
          statusLabel: "Active",
          weightLabel: "1 exposure",
        }),
      ]),
    );
  });

  it("uses API exposure occurredAt timestamps in reader memory audit ordering", () => {
    const apiExposureItem: NewsReaderMemoryItem = {
      ...homeExposureItem,
      id: "api-home-exposed-agent",
      title: "API exposed agent story",
      viewedAt: undefined,
      occurredAt: "2026-07-06T10:30:00.000Z",
    };
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      homeExposureItems: [homeExposureItem, apiExposureItem],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [],
    });

    expect(center.recentSignals[0]).toEqual({
      href: "/news/api-home-exposed-agent",
      label: "Home exposure",
      occurredAt: "2026-07-06T10:30:00.000Z",
      sourceName: "Agent Desk",
      title: "API exposed agent story",
    });
  });

  it("uses the latest timestamp field when reader memory has mixed timestamps", () => {
    const mixedTimestampItem: NewsReaderMemoryItem = {
      ...savedItem,
      id: "mixed-api-exposure",
      occurredAt: "2026-07-06T11:30:00.000Z",
      savedAt: "2026-07-06T08:35:00.000Z",
      title: "Mixed timestamp exposure story",
    };
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      homeExposureItems: [],
      positiveFeedbackItems: [],
      profile,
      savedItems: [mixedTimestampItem],
      searchItems: [],
    });

    expect(center.recentSignals[0]).toEqual({
      href: "/news/mixed-api-exposure",
      label: "Saved",
      occurredAt: "2026-07-06T11:30:00.000Z",
      sourceName: "Agent Desk",
      title: "Mixed timestamp exposure story",
    });
  });

  it("ignores invalid reader memory timestamps when ordering recent signals", () => {
    const invalidTimestampItem: NewsReaderMemoryItem = {
      ...savedItem,
      id: "invalid-saved-valid-occurred",
      occurredAt: "2026-07-06T11:45:00.000Z",
      savedAt: "not-a-date",
      title: "Recovered valid timestamp story",
    };
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      homeExposureItems: [],
      positiveFeedbackItems: [],
      profile,
      savedItems: [invalidTimestampItem],
      searchItems: [],
    });

    expect(center.recentSignals[0]).toEqual({
      href: "/news/invalid-saved-valid-occurred",
      label: "Saved",
      occurredAt: "2026-07-06T11:45:00.000Z",
      sourceName: "Agent Desk",
      title: "Recovered valid timestamp story",
    });
  });

  it("deduplicates saved recent signals when saved memory and positive save memory overlap", () => {
    const positiveSavedItem: NewsPositiveFeedbackMemoryItem = {
      ...savedItem,
      action: "save",
      occurredAt: "2026-07-06T08:40:00.000Z",
    };
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      homeExposureItems: [],
      positiveFeedbackItems: [positiveSavedItem],
      profile,
      savedItems: [savedItem],
      searchItems: [],
    });
    const recentSignalKeys = center.recentSignals.map(
      (signal) => `${signal.label}-${signal.href}`,
    );

    expect(recentSignalKeys).toEqual(["Saved-/news/saved-agent"]);
  });

  it("previews current stories ranked by profile and local memory impact", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      items: [
        createReaderCenterStory({
          category: "funding",
          entities: ["GPU Cloud"],
          id: "unrelated-market-story",
          sourceName: "Capital Desk",
          sourceSlug: "capital-desk",
          tags: ["infrastructure"],
          title: "GPU cloud financing keeps moving",
          trendScore: 96,
        }),
        createReaderCenterStory({
          category: "policy",
          entities: ["Regulators"],
          id: "search-match-story",
          sourceName: "Policy Desk",
          sourceSlug: "policy-desk",
          tags: ["audits"],
          title: "Deployment evidence for browser agents expands",
          trendScore: 80,
        }),
        createReaderCenterStory({
          id: "profile-match-story",
          title: "Agent browser systems ship controls",
        }),
      ],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [searchItem],
    });

    expect(center.profileImpact).toMatchObject({
      summary: "2 current stories match your profile or recent memory.",
      stories: [
        {
          href: "/news/profile-match-story",
          matchLabel: "4 signals",
          reason: "Matches profile interests and recent search intent.",
          sourceName: "Agent Desk",
          title: "Agent browser systems ship controls",
        },
        {
          href: "/news/search-match-story",
          matchLabel: "1 signal",
          reason: "Matches recent search intent.",
          sourceName: "Policy Desk",
          title: "Deployment evidence for browser agents expands",
        },
      ],
    });
  });

  it("audits why current stories are boosted or dampened by recommendation signals", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      homeExposureItems: [homeExposureItem],
      items: [
        createReaderCenterStory({
          id: "profile-search-audit-story",
          title: "Agent browser systems ship controls",
        }),
        createReaderCenterStory({
          category: "hot_take",
          entities: ["Noise"],
          id: "guardrail-audit-story",
          sourceName: "Noise Desk",
          sourceSlug: "noise-desk",
          tags: ["noise"],
          title: "Noisy hot take keeps spreading",
          trendScore: 94,
        }),
        createReaderCenterStory({
          id: "home-exposed-agent",
          title: "Home exposed agent story",
          trendScore: 82,
        }),
      ],
      positiveFeedbackItems: [positiveItem],
      profile,
      savedItems: [savedItem],
      searchItems: [searchItem],
    });

    expect(center.recommendationAudit).toMatchObject({
      label: "Recommendation Audit",
      summary: "3 current stories have auditable recommendation signals.",
      stories: [
        {
          href: "/news/profile-search-audit-story",
          signalCountLabel: "3 signals",
          sourceName: "Agent Desk",
          summary:
            "Profile interests, search intent, and local behavior are lifting this story.",
          title: "Agent browser systems ship controls",
        },
        {
          href: "/news/guardrail-audit-story",
          signalCountLabel: "1 signal",
          sourceName: "Noise Desk",
          summary: "Less feedback is dampening this story.",
          title: "Noisy hot take keeps spreading",
        },
        {
          href: "/news/home-exposed-agent",
          signalCountLabel: "4 signals",
          sourceName: "Agent Desk",
          summary:
            "Profile interests, search intent, local behavior, and exposure cooldown are shaping this story.",
          title: "Home exposed agent story",
        },
      ],
    });
    expect(center.recommendationAudit.stories[0]?.signals).toEqual([
      {
        detail: "Category, source, or entity preferences match this story.",
        label: "Profile interests",
        tone: "boost",
        weightLabel: "3 matches",
      },
      {
        detail: "Recent search memory matches this story.",
        label: "Search intent",
        tone: "intent",
        weightLabel: "1 search",
      },
      {
        detail: "Saved, read, shared, or source-clicked stories overlap.",
        label: "Local behavior",
        tone: "boost",
        weightLabel: "1 memory",
      },
    ]);
    expect(center.recommendationAudit.stories[1]?.signals).toEqual([
      {
        detail: "Less feedback overlaps by topic, source, or entity.",
        label: "Less feedback guardrail",
        tone: "dampen",
        weightLabel: "1 guardrail",
      },
    ]);
    expect(center.recommendationAudit.stories[2]?.signals).toEqual(
      expect.arrayContaining([
        {
          detail: "Recently exposed on the home page.",
          label: "Exposure cooldown",
          tone: "dampen",
          weightLabel: "1 exposure",
        },
      ]),
    );
  });

  it("offers recent searches as durable profile promotion candidates", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      positiveFeedbackItems: [],
      profile: {
        ...profile,
        preferredEntities: ["OpenAI"],
      },
      savedItems: [],
      searchItems: [
        searchItem,
        {
          query: "OpenAI",
          resultCount: 1,
          searchedAt: "2026-07-06T09:40:00.000Z",
        },
      ],
    });

    expect(center.searchIntentPromotions).toEqual([
      {
        actionLabel: "Add to profile",
        active: false,
        query: "browser agents",
        resultCountLabel: "2 results",
        searchedAt: "2026-07-06T09:45:00.000Z",
        summary:
          'Add "browser agents" as a durable entity or angle so it can shape For You beyond this session.',
      },
      {
        actionLabel: "In profile",
        active: true,
        query: "OpenAI",
        resultCountLabel: "1 result",
        searchedAt: "2026-07-06T09:40:00.000Z",
        summary:
          '"OpenAI" is already a durable entity or angle in your profile.',
      },
    ]);
  });

  it("uses readable plural labels for inactive ranking inputs", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [],
    });

    expect(center.rankingInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Search intent",
          statusLabel: "Waiting",
          weightLabel: "0 searches",
        }),
      ]),
    );
    expect(center.readiness).toMatchObject({
      activeInputCount: 1,
      gapCount: 5,
      label: "Cold Start",
      score: 17,
      summary:
        "For You needs more local reader signals before recommendations can move beyond defaults.",
    });
    expect(center.nextActions).toEqual([
      {
        href: "/search",
        label: "Search an AI angle",
        summary:
          "Run a search so For You can lift matching stories during this session.",
      },
      {
        href: "/",
        label: "Save or share a story",
        summary:
          "Use Save, Share, or Source on a story to create durable positive feedback.",
      },
      {
        href: "/",
        label: "Read a story",
        summary:
          "Open a story and read meaningfully so continuations can rank higher.",
      },
      {
        href: "/",
        label: "Hide a noisy story",
        summary:
          "Press Less on weak matches so similar topics, sources, and entities are dampened.",
      },
      {
        href: "/",
        label: "Generate home exposure",
        summary:
          "Open the front page so recently seen stories can cool down and make room for fresher angles.",
      },
    ]);
  });
});

describe("getNewsReaderCenterQuickStarts", () => {
  it("offers readable one-click profile presets with active and new signals", () => {
    const quickStarts = getNewsReaderCenterQuickStarts(profile);
    const agentPreset = quickStarts.find(
      (quickStart) => quickStart.label === "Agent Builder",
    );

    expect(quickStarts.map((quickStart) => quickStart.label)).toContain(
      "Model Watch",
    );
    if (!agentPreset) {
      throw new Error("Expected Agent Builder quick start.");
    }
    expect(agentPreset).toMatchObject({
      actionLabel: "Apply quick start",
      label: "Agent Builder",
      summary:
        "Prioritize agent products, tool-use workflows, and the labs shipping agentic interfaces.",
    });
    expect(agentPreset.newSignalCount).toBeGreaterThan(0);
    expect(agentPreset.signals).toEqual(
      expect.arrayContaining([
        {
          active: true,
          kind: "category",
          label: "Agents",
          signal: "agent_product",
        },
        {
          active: false,
          kind: "entity",
          label: "Browser agents",
          signal: "browser agents",
        },
      ]),
    );
  });

  it("treats legacy raw angle preferences as active readable quick-start signals", () => {
    const quickStarts = getNewsReaderCenterQuickStarts({
      ...profile,
      preferredEntities: ["OpenAI", "Agents", "browser-agents"],
    });
    const agentPreset = quickStarts.find(
      (quickStart) => quickStart.label === "Agent Builder",
    );

    if (!agentPreset) {
      throw new Error("Expected Agent Builder quick start.");
    }

    expect(agentPreset.signals).toContainEqual({
      active: true,
      kind: "entity",
      label: "Browser agents",
      signal: "browser agents",
    });
  });

  it("applies a quick start without dropping existing reader preferences", () => {
    const agentPreset = getNewsReaderCenterQuickStarts(profile).find(
      (quickStart) => quickStart.label === "Agent Builder",
    );

    if (!agentPreset) {
      throw new Error("Expected Agent Builder quick start.");
    }

    const nextProfile = applyNewsReaderCenterQuickStart({
      currentProfile: profile,
      quickStart: agentPreset,
    });

    expect(nextProfile.preferredCategories).toEqual(
      expect.arrayContaining(["agent_product"]),
    );
    expect(nextProfile.preferredSources).toEqual(
      expect.arrayContaining(["agent-desk", "openai-news", "anthropic"]),
    );
    expect(nextProfile.preferredEntities).toEqual(
      expect.arrayContaining(["OpenAI", "Agents", "browser agents"]),
    );
  });
});

describe("applyNewsReaderCenterSearchIntentPromotion", () => {
  it("turns a recent search query into a durable entity preference", () => {
    const nextProfile = applyNewsReaderCenterSearchIntentPromotion({
      currentProfile: profile,
      promotion: {
        actionLabel: "Add to profile",
        active: false,
        query: "browser agents",
        resultCountLabel: "2 results",
        searchedAt: "2026-07-06T09:45:00.000Z",
        summary:
          'Add "browser agents" as a durable entity or angle so it can shape For You beyond this session.',
      },
    });

    expect(nextProfile.preferredEntities).toEqual([
      "OpenAI",
      "Agents",
      "browser agents",
    ]);
  });
});

describe("removeNewsReaderCenterSearchMemoryItem", () => {
  it("removes one search query without dropping other search memory", () => {
    const otherSearchItem: NewsSearchMemoryItem = {
      query: "model routing",
      resultCount: 1,
      searchedAt: "2026-07-06T09:40:00.000Z",
    };

    expect(
      removeNewsReaderCenterSearchMemoryItem({
        query: " Browser Agents ",
        searchItems: [searchItem, otherSearchItem],
      }),
    ).toEqual([otherSearchItem]);
  });
});

describe("applyNewsReaderCenterMemoryTrainingSuggestion", () => {
  it("turns a local reader-memory suggestion into a durable profile signal", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [],
      historyItems: [historyItem],
      positiveFeedbackItems: [],
      profile,
      savedItems: [],
      searchItems: [],
    });
    const suggestion = center.memoryTrainingSuggestions.find(
      (candidate) => candidate.signal === "model_release",
    );

    if (!suggestion) {
      throw new Error("Expected a memory training suggestion.");
    }

    expect(
      applyNewsReaderCenterMemoryTrainingSuggestion({
        currentProfile: profile,
        suggestion,
      }),
    ).toEqual({
      noveltyBias: 1.4,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: ["OpenAI", "Agents"],
      preferredSources: ["agent-desk"],
      recencyBias: 1.2,
    });

    expect(
      applyNewsReaderCenterMemoryTrainingSuggestion({
        currentProfile: profile,
        suggestion: {
          actionLabel: "Follow angle",
          kind: "angle",
          label: "browser agents",
          signal: "browser agents",
          summary:
            "Promote browser agents from 1 read story so For You can keep ranking similar coverage.",
          supportLabel: "1 read",
        },
      }),
    ).toEqual({
      noveltyBias: 1.4,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI", "Agents", "browser agents"],
      preferredSources: ["agent-desk"],
      recencyBias: 1.2,
    });
  });
});

describe("getNewsReaderCenterExportHref", () => {
  it("serializes an importable reader profile snapshot as downloadable JSON", () => {
    const request = {
      forYouObjective: "market_heat",
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      positiveFeedbackItems: [positiveItem],
      profile,
      savedItems: [savedItem],
      searchItems: [searchItem],
    } satisfies Parameters<typeof getNewsReaderCenterData>[0] & {
      forYouObjective: NewsRecommendationRotationObjective;
    };
    const center = getNewsReaderCenterData(request);
    const href = getNewsReaderCenterExportHref(center);
    const encodedPayload = href.split(",", 2)[1] ?? "";
    const payload = JSON.parse(decodeURIComponent(encodedPayload)) as
      | (NewsReaderCenterData & { forYouObjective?: unknown })
      | null;

    expect(href).toMatch(/^data:application\/json;charset=utf-8,/);
    expect(payload?.metrics).toEqual(
      expect.arrayContaining([
        { label: "Topics", value: "1" },
        { label: "Sources", value: "1" },
      ]),
    );
    expect(payload?.profile).toEqual(normalizeNewsPreferenceProfile(profile));
    expect(payload?.forYouObjective).toEqual({
      label: "Market heat",
      objective: "market_heat",
      summary:
        "Trending and high-velocity stories move first in the recommendation rotation.",
    });
    expect(payload?.memory).toMatchObject({
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      positiveFeedbackItems: [positiveItem],
      restoredGuardrailItems: [],
      savedItems: [savedItem],
      searchItems: [searchItem],
    });
    expect(payload?.recentSignals[0]).toMatchObject({
      href: "/search?q=browser%20agents",
      label: "Searched",
      title: "Search: browser agents",
    });
  });
});

describe("parseNewsReaderCenterImportProfile", () => {
  it("restores the normalized profile from an exported reader center snapshot", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      positiveFeedbackItems: [positiveItem],
      profile,
      savedItems: [savedItem],
      searchItems: [searchItem],
    });

    expect(
      parseNewsReaderCenterImportProfile({
        defaultProfile: {
          noveltyBias: 1,
          preferredCategories: [],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
        snapshot: JSON.stringify(center),
      }),
    ).toEqual(normalizeNewsPreferenceProfile(profile));
  });

  it("rejects invalid reader center import payloads instead of overwriting preferences", () => {
    expect(
      parseNewsReaderCenterImportProfile({
        defaultProfile: profile,
        snapshot: JSON.stringify({ metrics: [] }),
      }),
    ).toBeNull();
    expect(
      parseNewsReaderCenterImportProfile({
        defaultProfile: profile,
        snapshot: "{bad json",
      }),
    ).toBeNull();
  });
});

describe("parseNewsReaderCenterImportSnapshot", () => {
  it("restores legacy profile-only imports without replacing local recommendation memory", () => {
    expect(
      parseNewsReaderCenterImportSnapshot({
        defaultProfile: {
          noveltyBias: 1,
          preferredCategories: [],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
        snapshot: JSON.stringify(profile),
      }),
    ).toEqual({
      forYouObjective: null,
      memory: null,
      profile: normalizeNewsPreferenceProfile(profile),
    });
  });

  it("restores a full recommendation-memory snapshot from an exported reader center", () => {
    const center = getNewsReaderCenterData({
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      positiveFeedbackItems: [positiveItem],
      profile,
      restoredGuardrailItems: [guardrailItem],
      savedItems: [savedItem],
      searchItems: [searchItem],
    });

    expect(
      parseNewsReaderCenterImportSnapshot({
        defaultProfile: {
          noveltyBias: 1,
          preferredCategories: [],
          preferredEntities: [],
          preferredSources: [],
          recencyBias: 1,
        },
        snapshot: JSON.stringify({
          ...center,
          forYouObjective: {
            objective: "source_trust",
          },
          memory: {
            ...center.memory,
            homeExposureItems: [
              homeExposureItem,
              {
                canonicalUrl: "https://example.com/broken-exposure",
                category: "agent_product",
                entities: [],
                id: "",
                sourceName: "Missing id",
                title: "Broken exposure",
                viewedAt: "2026-07-06T10:05:00.000Z",
              },
            ],
            savedItems: [
              ...center.memory.savedItems,
              {
                category: "broken",
                entities: [],
                sourceName: "Missing id",
              },
            ],
            searchItems: [
              {
                query: " browser agents ",
                resultCount: 2.4,
                searchedAt: "2026-07-06T09:45:00.000Z",
              },
              {
                query: "",
                resultCount: 2,
                searchedAt: "2026-07-06T09:45:00.000Z",
              },
            ],
          },
        }),
      }),
    ).toEqual({
      forYouObjective: "source_trust",
      memory: {
        guardrailItems: [guardrailItem],
        historyItems: [historyItem],
        homeExposureItems: [homeExposureItem],
        positiveFeedbackItems: [positiveItem],
        restoredGuardrailItems: [guardrailItem],
        savedItems: [savedItem],
        searchItems: [
          {
            query: "browser agents",
            resultCount: 2,
            searchedAt: "2026-07-06T09:45:00.000Z",
          },
        ],
      },
      profile: normalizeNewsPreferenceProfile(profile),
    });
  });
});

describe("writeNewsReaderCenterImportSnapshot", () => {
  it("preserves local recommendation memory when the imported file only contains a profile", () => {
    const maybeWriteImportSnapshot = (
      newsReaderCenterModule as Record<string, unknown>
    ).writeNewsReaderCenterImportSnapshot;
    const defaultProfile: NewsPreferenceProfile = {
      noveltyBias: 1,
      preferredCategories: [],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    };

    expect(maybeWriteImportSnapshot).toBeTypeOf("function");
    if (typeof maybeWriteImportSnapshot !== "function") {
      throw new Error("Reader Center import writer is not exported.");
    }
    const writeImportSnapshot =
      maybeWriteImportSnapshot as ReaderCenterImportWriter;

    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsPreferenceProfile(defaultProfile);
    writeStoredNewsForYouObjective("market_heat");
    writeStoredNewsReaderMemoryItems(newsSavedStorageKey, [savedItem]);
    writeStoredNewsSearchMemoryItems([searchItem]);

    writeImportSnapshot({
      forYouObjective: null,
      memory: null,
      profile: normalizeNewsPreferenceProfile(profile),
    });

    expect(
      readStoredNewsPreferenceProfile({
        defaultProfile,
      }),
    ).toEqual(normalizeNewsPreferenceProfile(profile));
    expect(readStoredNewsReaderMemoryItems(newsSavedStorageKey)).toEqual([
      savedItem,
    ]);
    expect(readStoredNewsSearchMemoryItems()).toEqual([searchItem]);
    expect(readStoredNewsForYouObjective()).toBe("market_heat");
    expect(window.localStorage.getItem(newsSearchStorageKey)).not.toBe("[]");
  });

  it("imports full recommendation memory into each local store", () => {
    const maybeWriteImportSnapshot = (
      newsReaderCenterModule as Record<string, unknown>
    ).writeNewsReaderCenterImportSnapshot;

    expect(maybeWriteImportSnapshot).toBeTypeOf("function");
    if (typeof maybeWriteImportSnapshot !== "function") {
      throw new Error("Reader Center import writer is not exported.");
    }
    const writeImportSnapshot =
      maybeWriteImportSnapshot as ReaderCenterImportWriter;

    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeImportSnapshot({
      forYouObjective: "source_trust",
      memory: {
        guardrailItems: [guardrailItem],
        historyItems: [historyItem],
        homeExposureItems: [homeExposureItem],
        positiveFeedbackItems: [positiveItem],
        restoredGuardrailItems: [guardrailItem],
        savedItems: [savedItem],
        searchItems: [searchItem],
      },
      profile: normalizeNewsPreferenceProfile(profile),
    });

    expect(readStoredNewsReaderMemoryItems(newsHomeExposureStorageKey)).toEqual(
      [homeExposureItem],
    );
    expect(readStoredNewsReaderMemoryItems(newsSavedStorageKey)).toEqual([
      savedItem,
    ]);
    expect(readStoredNewsSearchMemoryItems()).toEqual([searchItem]);
    expect(readStoredNewsForYouObjective()).toBe("source_trust");
  });

  it("clears home exposure memory and resets the For You objective when local reader signals reset", () => {
    const maybeResetLocalSignals = (
      newsReaderCenterModule as Record<string, unknown>
    ).resetNewsReaderCenterLocalSignals;

    expect(maybeResetLocalSignals).toBeTypeOf("function");
    if (typeof maybeResetLocalSignals !== "function") {
      throw new Error("Reader Center reset is not exported.");
    }
    const resetLocalSignals = maybeResetLocalSignals as () => void;

    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsReaderMemoryItems(newsHomeExposureStorageKey, [
      homeExposureItem,
    ]);
    writeStoredNewsForYouObjective("source_trust");

    resetLocalSignals();

    expect(readStoredNewsReaderMemoryItems(newsHomeExposureStorageKey)).toEqual(
      [],
    );
    expect(readStoredNewsForYouObjective()).toBe("reader_match");
    expect(window.localStorage.getItem(newsHomeExposureStorageKey)).toBeNull();
  });
});

describe("saveNewsReaderCenterProfileDraft", () => {
  it("normalizes manual preference edits into local profile storage", () => {
    const defaultProfile: NewsPreferenceProfile = {
      noveltyBias: 1,
      preferredCategories: [],
      preferredEntities: [],
      preferredSources: [],
      recencyBias: 1,
    };

    createWindowStub();

    saveNewsReaderCenterProfileDraft({
      currentProfile: defaultProfile,
      draft: {
        noveltyBias: "9",
        preferredCategoriesText: " agent_product, funding, agent_product ",
        preferredEntitiesText: "OpenAI\nbrowser agents\nOpenAI",
        preferredSourcesText: "agent-desk, model-desk",
        recencyBias: "0.4",
      },
    });

    expect(
      readStoredNewsPreferenceProfile({
        defaultProfile,
      }),
    ).toEqual({
      noveltyBias: 2,
      preferredCategories: ["agent_product", "funding"],
      preferredEntities: ["OpenAI", "browser agents"],
      preferredSources: ["agent-desk", "model-desk"],
      recencyBias: 0.4,
    });
  });
});

describe("NewsReaderCenterView", () => {
  it("renders the reader center as a dense profile surface", () => {
    const request = {
      forYouObjective: "source_trust",
      guardrailItems: [guardrailItem],
      historyItems: [historyItem],
      items: [
        createReaderCenterStory({
          id: "profile-match-story",
          title: "Agent browser systems ship controls",
        }),
        createReaderCenterStory({
          category: "policy",
          entities: ["Regulators"],
          id: "search-match-story",
          sourceName: "Policy Desk",
          sourceSlug: "policy-desk",
          tags: ["audits"],
          title: "Deployment evidence for browser agents expands",
          trendScore: 80,
        }),
      ],
      positiveFeedbackItems: [positiveItem],
      profile,
      savedItems: [savedItem],
      searchItems: [searchItem],
    } satisfies Parameters<typeof getNewsReaderCenterData>[0] & {
      forYouObjective: NewsRecommendationRotationObjective;
    };
    const center = getNewsReaderCenterData(request);
    const markup = renderToStaticMarkup(
      React.createElement(NewsReaderCenterView, {
        center,
        exportHref: getNewsReaderCenterExportHref(center),
        onImportProfile: () => undefined,
        onProfileDraftSave: () => undefined,
        onReset: () => undefined,
        onMemoryTrainingSuggestionApply: () => undefined,
        onSearchMemoryRemove: () => undefined,
        onSearchIntentPromotionApply: () => undefined,
      }),
    );

    expect(markup).toContain("Reader Center");
    expect(markup).toContain("Quick starts");
    expect(markup).toContain("Agent Builder");
    expect(markup).toContain("Model Watch");
    expect(markup).toContain("Apply quick start");
    expect(markup).toContain("Promote search intent");
    expect(markup).toContain('id="promote-search-intent"');
    expect(markup).toMatch(
      /id="promote-search-intent"><div class="flex items-start justify-between gap-3"><div><h2 class="text-xl font-black">Promote search intent<\/h2>/,
    );
    expect(markup).toContain("Train from memory");
    expect(markup).toContain("Promote Models from 1 read story");
    expect(markup).toContain("Follow topic");
    expect(markup).toContain("browser agents");
    expect(markup).toContain("Add to profile");
    expect(markup).toContain("Remove search");
    expect(markup).toContain("Tune For You profile");
    expect(markup).toContain('aria-label="Preferred topic IDs"');
    expect(markup).toContain(">agent_product<");
    expect(markup).toContain('aria-label="Preferred source slugs"');
    expect(markup).toContain(">agent-desk<");
    expect(markup).toContain('aria-label="Preferred entities and angles"');
    expect(markup).toContain(`>OpenAI
Agents<`);
    expect(markup).toContain('aria-label="Freshness bias"');
    expect(markup).toContain('value="1.2"');
    expect(markup).toContain('aria-label="Novelty bias"');
    expect(markup).toContain('value="1.4"');
    expect(markup).toContain("Save preferences");
    expect(markup).toContain("Saved agent story");
    expect(markup).toContain('href="/news/saved-agent"');
    expect(markup).toContain("Preferred topics");
    expect(markup).toContain("Preferred angles");
    expect(markup).toContain('href="/topics/agent-product"');
    expect(markup).toContain('href="/sources/agent-desk"');
    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain('href="/entities/Agents"');
    expect(markup).toContain("Recent searches");
    expect(markup).toContain("For You readiness");
    expect(markup).toContain("For You objective");
    expect(markup).toContain('aria-label="Set For You objective: Explore"');
    expect(markup).toContain(
      'aria-label="Set For You objective: Source trust"',
    );
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Source trust");
    expect(markup).toContain(
      "High-trust sources move first in the recommendation rotation.",
    );
    expect(markup).toContain("Learning");
    expect(markup).toContain("83%");
    expect(markup).toContain("1 gap");
    expect(markup).toContain("For You has 5 of 6 local ranking inputs active.");
    expect(markup).toContain("Recommendation training");
    expect(markup).toContain("Next training steps");
    expect(markup).toContain("Generate home exposure");
    expect(markup).toContain("Open the front page so recently seen stories");
    expect(markup).toContain("Ranking inputs");
    expect(markup).not.toContain("Recommendation Audit");
    expect(markup).toContain("Profile interests");
    expect(markup).toContain("Profile Impact");
    expect(markup).toContain("2 current stories match your profile");
    expect(markup).toContain("Agent browser systems ship controls");
    expect(markup).toContain("Profile interests");
    expect(markup).toContain("Home exposure cooldown");
    expect(markup).toContain(
      "Recently seen home cards are dampened for fresher angles.",
    );
    expect(markup).toContain("Search intent");
    expect(markup).toContain("Boost Agents");
    expect(markup).toContain("Dampen Hot Takes");
    expect(markup).toContain('href="/search?q=browser%20agents"');
    expect(markup).toContain("Tune For You");
    expect(markup).toContain("Import profile");
    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="application/json"');
    expect(markup).toContain("Export profile");
    expect(markup).toContain("Reset local signals");
    expect(markup).toContain('download="the-new-ai-times-reader-profile.json"');
  });

  it("wires the reader route and homepage navigation to the reader center", async () => {
    const [routeSource, homeSource, readerSource, searchSource] =
      await Promise.all([
        readFile(new URL("../reader/page.tsx", import.meta.url), "utf8"),
        readFile(
          new URL("./news-public-front-page.tsx", import.meta.url),
          "utf8",
        ),
        readFile(new URL("./news-reader-center.tsx", import.meta.url), "utf8"),
        readFile(new URL("../search/page.tsx", import.meta.url), "utf8"),
      ]);

    expect(routeSource).toContain("<NewsReaderCenter");
    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("items={data.items}");
    expect(routeSource).toContain("status={data.status}");
    expect(routeSource).toContain('dynamic = "force-dynamic"');
    expect(routeSource).toContain("robots");
    expect(homeSource).toContain('href="/reader"');
    expect(readerSource).toContain("subscribeToNewsReaderMemoryStorage");
    expect(readerSource).toContain("newsHomeExposureStorageKey");
    expect(readerSource).toContain("readStoredNewsSearchMemoryItems");
    expect(readerSource).toContain("parseNewsReaderCenterImportProfile");
    expect(readerSource).toContain("parseNewsReaderCenterImportSnapshot");
    expect(readerSource).toContain("onImportProfile");
    expect(readerSource).toContain("resetNewsReaderCenterLocalSignals");
    expect(readerSource).toContain("readStoredNewsForYouObjective");
    expect(readerSource).toContain("subscribeToNewsForYouObjectiveStorage");
    expect(readerSource).toContain("writeStoredNewsForYouObjective");
    expect(readerSource).toContain("onForYouObjectiveSelect");
    expect(readerSource).toMatch(
      /onForYouObjectiveSelect=\{\(objective\) => \{[\s\S]*?writeStoredNewsForYouObjective\(objective\);[\s\S]*?setCenter\(readCurrentCenter\(\)\);[\s\S]*?}\}/,
    );
    expect(readerSource).toContain("clearStoredNewsReaderMemoryItems");
    expect(readerSource).toContain("writeStoredNewsPreferenceProfile");
    expect(readerSource).toContain("writeStoredNewsReaderMemoryItems");
    expect(readerSource).toContain("writeStoredNewsPositiveFeedbackItems");
    expect(readerSource).toContain("writeStoredNewsSearchMemoryItems");
    expect(readerSource).toContain("removeNewsReaderCenterSearchMemoryItem");
    expect(readerSource).toContain("onSearchMemoryRemove");
    expect(readerSource).toContain(
      "applyNewsReaderCenterSearchIntentPromotion",
    );
    expect(readerSource).toContain("onSearchIntentPromotionApply");
    const promotionApplyStart = readerSource.indexOf(
      "const applySearchIntentPromotion = (",
    );
    const promotionApplyEnd = readerSource.indexOf(
      "  const resetReaderCenter = () => {",
      promotionApplyStart,
    );
    const promotionApplyBlock = readerSource.slice(
      promotionApplyStart,
      promotionApplyEnd,
    );

    expect(promotionApplyStart).toBeGreaterThanOrEqual(0);
    expect(promotionApplyEnd).toBeGreaterThan(promotionApplyStart);
    expect(promotionApplyBlock).toContain(
      "applyNewsReaderCenterSearchIntentPromotion",
    );
    expect(promotionApplyBlock).toContain(
      "writeStoredNewsPreferenceProfile(nextProfile)",
    );
    expect(promotionApplyBlock).toContain("writeStoredNewsSearchMemoryItems(");
    expect(promotionApplyBlock).toContain(
      "removeNewsReaderCenterSearchMemoryItem({",
    );
    expect(promotionApplyBlock).toContain("query: promotion.query");
    expect(promotionApplyBlock).toContain(
      "searchItems: readStoredNewsSearchMemoryItems()",
    );
    expect(searchSource).toContain("<NewsSearchMemoryRecorder");
  });

  it("persists Reader Center profile changes to the server reader profile", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(readerSource).toContain("useTRPC");
    expect(readerSource).toContain("trpc.news.updateProfile");
    expect(readerSource).toContain("trpc.news.resetProfile");
    expect(readerSource).toContain("readOrCreateNewsVisitorKey");
    expect(readerSource).toContain("toNewsServerPreferenceProfileInput");
    expect(readerSource).toContain("queryClient.invalidateQueries");
    expect(readerSource).toContain("trpc.news.forYou.pathFilter()");
    expect(readerSource).toContain("trpc.news.profile.pathFilter()");
    expect(readerSource).toContain("trpc.news.saved.pathFilter()");
    expect(readerSource).toContain("trpc.news.history.pathFilter()");
    expect(readerSource).toContain("trpc.news.guardrails.pathFilter()");
  });

  it("keeps Reader Center server memory disabled when the news data is not ready", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(readerSource).toContain("NewsHomeStatus");
    expect(readerSource).toContain('status = "ready"');
    expect(readerSource).toContain("canUseServerReaderMemory");
    expect(readerSource).not.toContain("{ enabled: Boolean(visitorKey) }");
    expect(readerSource).toContain("{ enabled: canUseServerReaderMemory }");
    expect(readerSource).toMatch(
      /const persistServerProfile = \(profile: NewsPreferenceProfile\) => \{[\s\S]*?if \(!canUseServerReaderMemory\) return;[\s\S]*?if \(!visitorKey\) return;[\s\S]*?updateProfile\.mutate\(/,
    );
    expect(readerSource).toMatch(
      /const resetReaderCenter = \(\) => \{[\s\S]*?resetNewsReaderCenterLocalSignals\(\);[\s\S]*?if \(canUseServerReaderMemory && visitorKey\) \{[\s\S]*?resetProfile\.mutate\(\{ visitorKey \}\);[\s\S]*?}/,
    );
  });

  it("hydrates Reader Center preferences from the persisted server profile", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(readerSource).toContain("useQuery");
    expect(readerSource).toContain("trpc.news.profile.queryOptions");
    expect(readerSource).toContain("selectHydratedNewsPreferenceProfile");
    expect(readerSource).toContain("areNewsPreferenceProfilesEqual");
    expect(readerSource).toMatch(
      /if \(!profileQuery\.data\?\.persisted\) return;[\s\S]*?const currentProfile = readCurrentCenter\(\)\.profile;[\s\S]*?const nextProfile = selectHydratedNewsPreferenceProfile\({[\s\S]*?localProfile: currentProfile,[\s\S]*?serverProfile: profileQuery\.data,[\s\S]*?}\);[\s\S]*?if \(areNewsPreferenceProfilesEqual\(currentProfile, nextProfile\)\) return;[\s\S]*?writeStoredNewsPreferenceProfile\(nextProfile\);/,
    );
  });

  it("keeps Reader Center profile edits from overwriting a pending server profile", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(readerSource).toMatch(
      /const canEditReaderCenterProfile =\s*!\(\s*updateProfile\.isPending \|\|[\s\S]*?resetProfile\.isPending \|\|[\s\S]*?\(canUseServerReaderMemory && profileQuery\.isPending\)[\s\S]*?\);/,
    );
    expect(readerSource).toContain(
      "onImportProfile={canEditReaderCenterProfile ? importProfile : undefined}",
    );
    expect(readerSource).toMatch(
      /onProfileDraftSave=\{[\s\S]*?canEditReaderCenterProfile \? saveProfileDraft : undefined[\s\S]*?\}/,
    );
    expect(readerSource).toMatch(
      /onQuickStartApply=\{[\s\S]*?canEditReaderCenterProfile \? applyQuickStart : undefined[\s\S]*?\}/,
    );
    expect(readerSource).toMatch(
      /onMemoryTrainingSuggestionApply=\{[\s\S]*?canEditReaderCenterProfile \? applyMemoryTrainingSuggestion : undefined[\s\S]*?\}/,
    );
    expect(readerSource).toMatch(
      /onSearchIntentPromotionApply=\{[\s\S]*?canEditReaderCenterProfile \? applySearchIntentPromotion : undefined[\s\S]*?\}/,
    );
    expect(readerSource).toContain(
      "onReset={canEditReaderCenterProfile ? resetReaderCenter : undefined}",
    );
  });

  it("removes persisted Reader Center search memory when search intent is removed or promoted", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );
    const promotionApplyStart = readerSource.indexOf(
      "const applySearchIntentPromotion = (",
    );
    const promotionApplyEnd = readerSource.indexOf(
      "  const removeSearchMemoryItem = (",
      promotionApplyStart,
    );
    const promotionApplyBlock = readerSource.slice(
      promotionApplyStart,
      promotionApplyEnd,
    );
    const removeSearchStart = readerSource.indexOf(
      "const removeSearchMemoryItem = (",
    );
    const removeSearchEnd = readerSource.indexOf(
      "  const resetReaderCenter = () => {",
      removeSearchStart,
    );
    const removeSearchBlock = readerSource.slice(
      removeSearchStart,
      removeSearchEnd,
    );
    const removeSearchMutationStart = readerSource.indexOf(
      "const removeSearchMemory = useMutation(",
    );
    const removeSearchMutationEnd = readerSource.indexOf(
      "  const persistServerProfile = (profile: NewsPreferenceProfile) => {",
      removeSearchMutationStart,
    );
    const removeSearchMutationBlock = readerSource.slice(
      removeSearchMutationStart,
      removeSearchMutationEnd,
    );

    expect(readerSource).toContain(
      "trpc.news.removeSearchMemory.mutationOptions",
    );
    expect(removeSearchMutationStart).toBeGreaterThanOrEqual(0);
    expect(removeSearchMutationEnd).toBeGreaterThan(removeSearchMutationStart);
    expect(removeSearchMutationBlock).toContain(
      "queryClient.invalidateQueries(trpc.news.forYou.pathFilter())",
    );
    expect(removeSearchMutationBlock).toContain(
      "queryClient.invalidateQueries(trpc.news.searchMemory.pathFilter())",
    );
    expect(readerSource).toContain(
      "const removeServerSearchMemory = (query: string) => {",
    );
    expect(readerSource).toContain("removeSearchMemory.mutate({");
    expect(promotionApplyStart).toBeGreaterThanOrEqual(0);
    expect(promotionApplyEnd).toBeGreaterThan(promotionApplyStart);
    expect(promotionApplyBlock).toContain(
      "removeServerSearchMemory(promotion.query)",
    );
    expect(removeSearchStart).toBeGreaterThanOrEqual(0);
    expect(removeSearchEnd).toBeGreaterThan(removeSearchStart);
    expect(removeSearchBlock).toContain("writeStoredNewsSearchMemoryItems(");
    expect(removeSearchBlock).toContain(
      "removeServerSearchMemory(promotion.query)",
    );
    expect(readerSource).toContain(
      "onSearchMemoryRemove={removeSearchMemoryItem}",
    );
  });

  it("hydrates Reader Center behavior memory from persisted server reader memory", async () => {
    const readerSource = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(readerSource).toContain("mergeNewsReaderMemoryItems");
    expect(readerSource).toContain("mergeNewsHomePositiveFeedbackItems");
    expect(readerSource).toContain("trpc.news.saved.queryOptions");
    expect(readerSource).toContain("trpc.news.history.queryOptions");
    expect(readerSource).toContain("trpc.news.guardrails.queryOptions");
    expect(readerSource).toContain("trpc.news.positiveFeedback.queryOptions");
    expect(readerSource).toContain("trpc.news.searchMemory.queryOptions");
    expect(readerSource).toContain("trpc.news.positiveFeedback.pathFilter()");
    expect(readerSource).toContain("trpc.news.searchMemory.pathFilter()");
    expect(readerSource).toMatch(
      /const savedQuery = useQuery\([\s\S]*?trpc\.news\.saved\.queryOptions\([\s\S]*?\{ limit: 30, visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canUseServerReaderMemory \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(readerSource).toMatch(
      /if \(!savedQuery\.data \|\| savedQuery\.data\.length === 0\) return;[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsSavedStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsSavedStorageKey\),[\s\S]*?serverItems: savedQuery\.data,[\s\S]*?}\),[\s\S]*?\);/,
    );
    expect(readerSource).toMatch(
      /if \(!historyQuery\.data \|\| historyQuery\.data\.length === 0\) return;[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsHistoryStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsHistoryStorageKey\),[\s\S]*?serverItems: historyQuery\.data,[\s\S]*?}\),[\s\S]*?\);/,
    );
    expect(readerSource).toMatch(
      /if \(!guardrailsQuery\.data \|\| guardrailsQuery\.data\.length === 0\) return;[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsGuardrailStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsGuardrailStorageKey\),[\s\S]*?serverItems: guardrailsQuery\.data,[\s\S]*?}\),[\s\S]*?\);/,
    );
    expect(readerSource).toMatch(
      /if \(!positiveFeedbackQuery\.data \|\| positiveFeedbackQuery\.data\.length === 0\)[\s\S]*?return;[\s\S]*?writeStoredNewsPositiveFeedbackItems\([\s\S]*?positiveFeedbackQuery\.data\.reduce<NewsPositiveFeedbackMemoryItem\[]>\([\s\S]*?mergeNewsHomePositiveFeedbackItems\({[\s\S]*?currentItems,[\s\S]*?nextItem,[\s\S]*?}\),[\s\S]*?readStoredNewsPositiveFeedbackItems\(\),[\s\S]*?\)[\s\S]*?\);/,
    );
    expect(readerSource).toMatch(
      /if \(!searchMemoryQuery\.data \|\| searchMemoryQuery\.data\.length === 0\) return;[\s\S]*?writeStoredNewsSearchMemoryItems\([\s\S]*?selectStoredNewsSearchMemoryItems\(\[[\s\S]*?\.\.\.searchMemoryQuery\.data,[\s\S]*?\.\.\.readStoredNewsSearchMemoryItems\(\),[\s\S]*?\]\)[\s\S]*?\);/,
    );
  });
});

describe("NewsReaderCenter lab surface", () => {
  it("selects the recommendation lab without duplicating hydration", async () => {
    const source = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('surface = "center"');
    expect(source).toContain('surface === "lab"');
    expect(source).toContain("<NewsRecommendationLabView center={center} />");
    expect(source).toContain('href="/reader/lab"');
  });

  it("serves the lab from a noindex reader route", async () => {
    const routeSource = await readFile(
      new URL("../reader/lab/page.tsx", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain('surface="lab"');
    expect(routeSource).toContain("index: false");
  });
});
