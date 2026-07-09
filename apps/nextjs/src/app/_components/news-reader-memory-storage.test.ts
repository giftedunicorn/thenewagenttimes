import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredNewsReaderMemoryItems,
  newsGuardrailStorageKey,
  newsHistoryStorageKey,
  newsHomeExposureStorageKey,
  newsPositiveFeedbackStorageKey,
  newsReaderMemoryChangeEventName,
  newsSavedStorageKey,
  newsSearchStorageKey,
  readStoredNewsPositiveFeedbackItems,
  readStoredNewsReaderMemoryItems,
  readStoredNewsSearchMemoryItems,
  recordStoredNewsSearchMemoryItem,
  subscribeToNewsReaderMemoryStorage,
  writeStoredNewsPositiveFeedbackItems,
  writeStoredNewsReaderMemoryItems,
  writeStoredNewsSearchMemoryItems,
} from "./news-reader-memory-storage";

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

const createStorageEvent = (key: string) => {
  const event = new Event("storage") as StorageEvent;

  Object.defineProperty(event, "key", {
    value: key,
  });

  return event;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("news reader memory storage", () => {
  it("uses the same local storage keys as the reader-facing surfaces", () => {
    expect(newsSavedStorageKey).toBe("new-ai-times-saved");
    expect(newsHistoryStorageKey).toBe("new-ai-times-history");
    expect(newsHomeExposureStorageKey).toBe("new-ai-times-home-exposures");
    expect(newsPositiveFeedbackStorageKey).toBe(
      "new-ai-times-positive-feedback",
    );
    expect(newsSearchStorageKey).toBe("new-ai-times-searches");
  });

  it("reads and writes normalized reader memory items", () => {
    const windowStub = createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsReaderMemoryItems(newsSavedStorageKey, [
      {
        canonicalUrl: "https://example.com/agent",
        category: "agent_product",
        entities: ["OpenAI"],
        id: "saved-agent",
        originalUrl: "https://source.example/agent",
        savedAt: "2026-07-06T08:35:00.000Z",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        tags: ["agents"],
        title: "Agent story",
      },
    ]);

    expect(readStoredNewsReaderMemoryItems(newsSavedStorageKey)).toEqual([
      {
        canonicalUrl: "https://example.com/agent",
        category: "agent_product",
        entities: ["OpenAI"],
        id: "saved-agent",
        originalUrl: "https://source.example/agent",
        savedAt: "2026-07-06T08:35:00.000Z",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        tags: ["agents"],
        title: "Agent story",
      },
    ]);

    windowStub.localStorage.setItem(newsHistoryStorageKey, "{bad json");

    expect(readStoredNewsReaderMemoryItems(newsHistoryStorageKey)).toEqual([]);
  });

  it("expires stale Less guardrails without expiring durable saved memory", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    const oldSavedItem = {
      canonicalUrl: "https://example.com/old-saved",
      category: "agent_product",
      entities: ["OpenAI"],
      id: "old-saved-agent",
      originalUrl: "https://source.example/old-saved",
      savedAt: "2026-05-01T08:35:00.000Z",
      sourceName: "Agent Desk",
      sourceSlug: "agent-desk",
      tags: ["agents"],
      title: "Old saved story",
    };

    writeStoredNewsReaderMemoryItems(newsSavedStorageKey, [oldSavedItem]);
    writeStoredNewsReaderMemoryItems(newsGuardrailStorageKey, [
      {
        canonicalUrl: "https://example.com/fresh-less",
        category: "model_release",
        entities: ["OpenAI"],
        hiddenAt: "2026-07-01T08:35:00.000Z",
        id: "fresh-less-model",
        originalUrl: "https://source.example/fresh-less",
        sourceName: "Model Desk",
        sourceSlug: "model-desk",
        tags: ["models"],
        title: "Fresh Less story",
      },
      {
        canonicalUrl: "https://example.com/stale-less",
        category: "funding",
        entities: ["Startup"],
        hiddenAt: "2026-05-01T08:35:00.000Z",
        id: "stale-less-funding",
        originalUrl: "https://source.example/stale-less",
        sourceName: "Funding Desk",
        sourceSlug: "funding-desk",
        tags: ["funding"],
        title: "Stale Less story",
      },
    ]);

    expect(readStoredNewsReaderMemoryItems(newsSavedStorageKey)).toEqual([
      oldSavedItem,
    ]);
    expect(readStoredNewsReaderMemoryItems(newsGuardrailStorageKey)).toEqual([
      {
        canonicalUrl: "https://example.com/fresh-less",
        category: "model_release",
        entities: ["OpenAI"],
        hiddenAt: "2026-07-01T08:35:00.000Z",
        id: "fresh-less-model",
        originalUrl: "https://source.example/fresh-less",
        sourceName: "Model Desk",
        sourceSlug: "model-desk",
        tags: ["models"],
        title: "Fresh Less story",
      },
    ]);
  });

  it("expires stale home exposures without treating article history as volatile", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    const freshExposure = {
      canonicalUrl: "https://example.com/fresh-exposure",
      category: "agent_product",
      entities: ["OpenAI"],
      id: "fresh-home-exposure",
      originalUrl: "https://source.example/fresh-exposure",
      sourceName: "Agent Desk",
      sourceSlug: "agent-desk",
      tags: ["agents"],
      title: "Fresh exposed story",
      viewedAt: "2026-07-06T08:35:00.000Z",
    };
    const oldHistory = {
      canonicalUrl: "https://example.com/old-history",
      category: "model_release",
      entities: ["Frontier Model"],
      id: "old-read-history",
      originalUrl: "https://source.example/old-history",
      sourceName: "Model Desk",
      sourceSlug: "model-desk",
      tags: ["model"],
      title: "Old read story",
      viewedAt: "2026-05-01T08:35:00.000Z",
    };

    writeStoredNewsReaderMemoryItems(newsHomeExposureStorageKey, [
      freshExposure,
      {
        ...freshExposure,
        id: "stale-home-exposure",
        viewedAt: "2026-05-01T08:35:00.000Z",
      },
    ]);
    writeStoredNewsReaderMemoryItems(newsHistoryStorageKey, [oldHistory]);

    expect(readStoredNewsReaderMemoryItems(newsHomeExposureStorageKey)).toEqual(
      [freshExposure],
    );
    expect(readStoredNewsReaderMemoryItems(newsHistoryStorageKey)).toEqual([
      oldHistory,
    ]);
  });

  it("drops future-dated volatile memory before it can steer local recommendations", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    const currentGuardrail = {
      canonicalUrl: "https://example.com/current-less",
      category: "agent_product",
      entities: ["OpenAI"],
      hiddenAt: "2026-07-06T08:35:00.000Z",
      id: "current-less-agent",
      originalUrl: "https://source.example/current-less",
      sourceName: "Agent Desk",
      sourceSlug: "agent-desk",
      tags: ["agents"],
      title: "Current Less story",
    };
    const currentExposure = {
      canonicalUrl: "https://example.com/current-exposure",
      category: "model_release",
      entities: ["Frontier Model"],
      id: "current-home-exposure",
      originalUrl: "https://source.example/current-exposure",
      sourceName: "Model Desk",
      sourceSlug: "model-desk",
      tags: ["model"],
      title: "Current exposed story",
      viewedAt: "2026-07-06T08:35:00.000Z",
    };

    writeStoredNewsReaderMemoryItems(newsGuardrailStorageKey, [
      currentGuardrail,
      {
        ...currentGuardrail,
        hiddenAt: "2026-08-01T08:35:00.000Z",
        id: "future-less-agent",
      },
    ]);
    writeStoredNewsReaderMemoryItems(newsHomeExposureStorageKey, [
      currentExposure,
      {
        ...currentExposure,
        id: "future-home-exposure",
        viewedAt: "2026-08-01T08:35:00.000Z",
      },
    ]);
    writeStoredNewsSearchMemoryItems([
      {
        query: "current browser agents",
        resultCount: 4,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
      {
        query: "future model pricing",
        resultCount: 3,
        searchedAt: "2026-08-01T08:35:00.000Z",
      },
    ]);

    expect(readStoredNewsReaderMemoryItems(newsGuardrailStorageKey)).toEqual([
      currentGuardrail,
    ]);
    expect(readStoredNewsReaderMemoryItems(newsHomeExposureStorageKey)).toEqual(
      [currentExposure],
    );
    expect(readStoredNewsSearchMemoryItems()).toEqual([
      {
        query: "current browser agents",
        resultCount: 4,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
    ]);
  });

  it("reads and writes positive feedback memory items", () => {
    createWindowStub();

    writeStoredNewsPositiveFeedbackItems([
      {
        action: "share",
        canonicalUrl: "https://example.com/model",
        category: "model_release",
        entities: ["Frontier Model"],
        id: "shared-model",
        occurredAt: "2026-07-06T09:00:00.000Z",
        originalUrl: "https://source.example/model",
        sourceName: "Model Desk",
        sourceSlug: "model-desk",
        tags: ["model"],
        title: "Model story",
      },
    ]);

    expect(readStoredNewsPositiveFeedbackItems()).toEqual([
      {
        action: "share",
        canonicalUrl: "https://example.com/model",
        category: "model_release",
        entities: ["Frontier Model"],
        id: "shared-model",
        occurredAt: "2026-07-06T09:00:00.000Z",
        originalUrl: "https://source.example/model",
        sourceName: "Model Desk",
        sourceSlug: "model-desk",
        tags: ["model"],
        title: "Model story",
      },
    ]);
  });

  it("records normalized search memory with newest queries first", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsSearchMemoryItems([
      {
        query: " browser agents ",
        resultCount: 3,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
      {
        query: "",
        resultCount: 1,
        searchedAt: "2026-07-06T08:40:00.000Z",
      },
    ]);
    recordStoredNewsSearchMemoryItem({
      query: "Browser Agents",
      resultCount: 5,
      searchedAt: "2026-07-06T09:00:00.000Z",
    });
    recordStoredNewsSearchMemoryItem({
      query: "model release",
      resultCount: 2,
      searchedAt: "2026-07-06T08:50:00.000Z",
    });

    expect(readStoredNewsSearchMemoryItems()).toEqual([
      {
        query: "Browser Agents",
        resultCount: 5,
        searchedAt: "2026-07-06T09:00:00.000Z",
      },
      {
        query: "model release",
        resultCount: 2,
        searchedAt: "2026-07-06T08:50:00.000Z",
      },
    ]);
  });

  it("deduplicates search memory across hyphenated and underscored query variants", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsSearchMemoryItems([
      {
        query: "agent-product",
        resultCount: 3,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
      {
        query: "agent_product",
        resultCount: 4,
        searchedAt: "2026-07-06T08:45:00.000Z",
      },
    ]);
    recordStoredNewsSearchMemoryItem({
      query: "Agent Product",
      resultCount: 5,
      searchedAt: "2026-07-06T09:00:00.000Z",
    });

    expect(readStoredNewsSearchMemoryItems()).toEqual([
      {
        query: "Agent Product",
        resultCount: 5,
        searchedAt: "2026-07-06T09:00:00.000Z",
      },
    ]);
  });

  it("drops stale search memory before it can steer recommendations", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsSearchMemoryItems([
      {
        query: "fresh browser agents",
        resultCount: 4,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
      {
        query: "stale model pricing",
        resultCount: 3,
        searchedAt: "2026-06-01T08:35:00.000Z",
      },
    ]);
    recordStoredNewsSearchMemoryItem({
      query: "old funding",
      resultCount: 2,
      searchedAt: "2026-05-01T08:35:00.000Z",
    });

    expect(readStoredNewsSearchMemoryItems()).toEqual([
      {
        query: "fresh browser agents",
        resultCount: 4,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
    ]);
  });

  it("caps stored search memory queries before they can steer recommendations", () => {
    createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));

    writeStoredNewsSearchMemoryItems([
      {
        query: `  browser\nagents\t${"model ".repeat(40)}pricing  `,
        resultCount: 4,
        searchedAt: "2026-07-06T08:35:00.000Z",
      },
    ]);

    const [storedItem] = readStoredNewsSearchMemoryItems();

    expect(storedItem?.query).toContain("browser agents");
    expect(storedItem?.query).not.toContain("\n");
    expect(storedItem?.query).not.toContain("\t");
    expect(storedItem?.query).not.toContain("  ");
    expect(storedItem?.query.length).toBeLessThanOrEqual(120);
  });

  it("notifies current-tab and cross-tab subscribers when reader memory changes", () => {
    const windowStub = createWindowStub();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));
    const events: string[] = [];
    const eventNames: string[] = [];

    window.addEventListener(newsReaderMemoryChangeEventName, () => {
      eventNames.push("memory");
    });

    const unsubscribe = subscribeToNewsReaderMemoryStorage(() => {
      events.push("change");
    });

    writeStoredNewsReaderMemoryItems(newsSavedStorageKey, [
      {
        canonicalUrl: "https://example.com/agent",
        category: "agent_product",
        entities: ["OpenAI"],
        id: "saved-agent",
        originalUrl: "https://source.example/agent",
        savedAt: "2026-07-06T08:35:00.000Z",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        tags: ["agents"],
        title: "Agent story",
      },
    ]);
    writeStoredNewsPositiveFeedbackItems([
      {
        action: "click_source",
        canonicalUrl: "https://example.com/source",
        category: "agent_product",
        entities: ["OpenAI"],
        id: "source-agent",
        occurredAt: "2026-07-06T08:40:00.000Z",
        originalUrl: "https://source.example/source",
        sourceName: "Agent Desk",
        sourceSlug: "agent-desk",
        tags: ["agents"],
        title: "Source story",
      },
    ]);
    clearStoredNewsReaderMemoryItems(newsSavedStorageKey);
    writeStoredNewsReaderMemoryItems(newsHomeExposureStorageKey, []);
    recordStoredNewsSearchMemoryItem({
      query: "browser agents",
      resultCount: 2,
      searchedAt: "2026-07-06T09:00:00.000Z",
    });
    window.dispatchEvent(createStorageEvent(newsHistoryStorageKey));
    window.dispatchEvent(createStorageEvent("another-key"));

    expect(events).toEqual([
      "change",
      "change",
      "change",
      "change",
      "change",
      "change",
    ]);
    expect(eventNames).toEqual([
      "memory",
      "memory",
      "memory",
      "memory",
      "memory",
    ]);

    unsubscribe();
    writeStoredNewsReaderMemoryItems(newsSavedStorageKey, []);

    expect(events).toHaveLength(6);

    windowStub.localStorage.clear();
  });

  it("keeps home, article, and reader center surfaces on shared memory storage", async () => {
    const [homeSource, articleSource, readerSource] = await Promise.all([
      readFile(new URL("./news-home.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../news/_components/news-article.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("./news-reader-center.tsx", import.meta.url), "utf8"),
    ]);

    expect(homeSource).toContain("./news-reader-memory-storage");
    expect(articleSource).toContain(
      "../../_components/news-reader-memory-storage",
    );
    expect(readerSource).toContain("./news-reader-memory-storage");
    expect(readerSource).toContain("readStoredNewsSearchMemoryItems");
  });
});
