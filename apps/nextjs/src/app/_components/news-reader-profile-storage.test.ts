import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsPreferenceProfile } from "@acme/validators";
import { normalizeNewsPreferenceProfile } from "@acme/validators";

import {
  areNewsPreferenceProfilesEqual,
  newsForYouObjectiveChangeEventName,
  newsForYouObjectiveStorageKey,
  newsPreferenceProfileChangeEventName,
  newsPreferenceProfileStorageKey,
  newsVisitorStorageKey,
  parseStoredNewsForYouObjective,
  parseStoredNewsPreferenceProfile,
  readNewsPreferenceProfileSnapshot,
  readOrCreateNewsVisitorKey,
  readStoredNewsForYouObjective,
  subscribeToNewsForYouObjectiveStorage,
  subscribeToNewsPreferenceProfileStorage,
  toNewsServerPreferenceProfileInput,
  writeStoredNewsForYouObjective,
  writeStoredNewsPreferenceProfile,
} from "./news-reader-profile-storage";

const defaultProfile: NewsPreferenceProfile = {
  noveltyBias: 1,
  preferredCategories: [],
  preferredEntities: [],
  preferredSources: [],
  recencyBias: 1,
};

const nextProfile: NewsPreferenceProfile = {
  noveltyBias: 1.4,
  preferredCategories: ["agent_product"],
  preferredEntities: ["OpenAI", "Agents"],
  preferredSources: ["openai-news"],
  recencyBias: 1.2,
};

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
    | "crypto"
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
    crypto: {
      randomUUID: () => "visitor-generated-123",
    } as Crypto,
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
  vi.unstubAllGlobals();
});

describe("news reader profile storage", () => {
  it("compares profiles by their normalized storage shape", () => {
    expect(
      areNewsPreferenceProfilesEqual(
        {
          ...nextProfile,
          preferredCategories: ["agent_product", "agent_product"],
        },
        nextProfile,
      ),
    ).toBe(true);
    expect(
      areNewsPreferenceProfilesEqual(nextProfile, {
        ...nextProfile,
        preferredSources: ["another-source"],
      }),
    ).toBe(false);
  });

  it("parses stored profiles through the same normalizer as recommendation ranking", () => {
    expect(
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored: JSON.stringify({
          noveltyBias: nextProfile.noveltyBias,
          preferredCategories: [...nextProfile.preferredCategories, 7],
          preferredEntities: nextProfile.preferredEntities,
          preferredSources: nextProfile.preferredSources,
          recencyBias: nextProfile.recencyBias,
        }),
      }),
    ).toEqual(normalizeNewsPreferenceProfile(nextProfile));
  });

  it("falls back to default bias values when stored profile bias is non-finite", () => {
    expect(
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored:
          '{"noveltyBias":1e999,"preferredCategories":["agent_product"],"preferredEntities":["OpenAI"],"preferredSources":["openai-news"],"recencyBias":-1e999}',
      }),
    ).toEqual({
      noveltyBias: defaultProfile.noveltyBias,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["openai-news"],
      recencyBias: defaultProfile.recencyBias,
    });
  });

  it("falls back to the default profile when local storage contains invalid JSON", () => {
    expect(
      parseStoredNewsPreferenceProfile({
        defaultProfile,
        stored: "{bad json",
      }),
    ).toEqual(defaultProfile);
  });

  it("writes the normalized profile and notifies same-tab subscribers", () => {
    const windowStub = createWindowStub();
    const events: string[] = [];

    window.addEventListener(newsPreferenceProfileChangeEventName, () => {
      events.push("profile");
    });

    writeStoredNewsPreferenceProfile(nextProfile);

    expect(window.localStorage.getItem(newsPreferenceProfileStorageKey)).toBe(
      JSON.stringify(normalizeNewsPreferenceProfile(nextProfile)),
    );
    expect(readNewsPreferenceProfileSnapshot()).toBe(
      JSON.stringify(normalizeNewsPreferenceProfile(nextProfile)),
    );
    expect(events).toEqual(["profile"]);

    windowStub.localStorage.clear();
  });

  it("subscribes to profile writes in the current tab and storage events from other tabs", () => {
    const windowStub = createWindowStub();
    const snapshots: string[] = [];
    const unsubscribe = subscribeToNewsPreferenceProfileStorage(() => {
      snapshots.push(readNewsPreferenceProfileSnapshot());
    });

    writeStoredNewsPreferenceProfile(nextProfile);
    window.dispatchEvent(createStorageEvent("another-key"));
    window.dispatchEvent(createStorageEvent(newsPreferenceProfileStorageKey));

    expect(snapshots).toEqual([
      JSON.stringify(normalizeNewsPreferenceProfile(nextProfile)),
      JSON.stringify(normalizeNewsPreferenceProfile(nextProfile)),
    ]);

    unsubscribe();
    writeStoredNewsPreferenceProfile(defaultProfile);

    expect(snapshots).toHaveLength(2);

    windowStub.localStorage.clear();
  });

  it("persists the selected For You objective as a reader preference control", () => {
    const windowStub = createWindowStub();
    const events: string[] = [];

    window.addEventListener(newsForYouObjectiveChangeEventName, () => {
      events.push("objective");
    });

    expect(readStoredNewsForYouObjective()).toBe("reader_match");
    expect(parseStoredNewsForYouObjective("market_heat")).toBe("market_heat");
    expect(parseStoredNewsForYouObjective("unknown")).toBe("reader_match");

    writeStoredNewsForYouObjective("source_trust");

    expect(window.localStorage.getItem(newsForYouObjectiveStorageKey)).toBe(
      "source_trust",
    );
    expect(readStoredNewsForYouObjective()).toBe("source_trust");
    expect(events).toEqual(["objective"]);

    windowStub.localStorage.clear();
  });

  it("replaces blank stored visitor keys before personalization uses them", () => {
    const windowStub = createWindowStub();

    window.localStorage.setItem(newsVisitorStorageKey, "   ");

    expect(readOrCreateNewsVisitorKey()).toBe("visitor-generated-123");
    expect(window.localStorage.getItem(newsVisitorStorageKey)).toBe(
      "visitor-generated-123",
    );

    windowStub.localStorage.clear();
  });

  it("replaces invalid stored visitor keys before server profile calls use them", () => {
    const windowStub = createWindowStub();

    window.localStorage.setItem(newsVisitorStorageKey, "short");

    expect(readOrCreateNewsVisitorKey()).toBe("visitor-generated-123");
    expect(window.localStorage.getItem(newsVisitorStorageKey)).toBe(
      "visitor-generated-123",
    );

    windowStub.localStorage.setItem(
      newsVisitorStorageKey,
      ` ${"valid-visitor-key".repeat(11)} `,
    );

    expect(readOrCreateNewsVisitorKey()).toBe("visitor-generated-123");
    expect(window.localStorage.getItem(newsVisitorStorageKey)).toBe(
      "visitor-generated-123",
    );

    windowStub.localStorage.clear();
  });

  it("serializes local profiles into the server updateProfile input shape", () => {
    expect(
      toNewsServerPreferenceProfileInput({
        noveltyBias: 1.7,
        preferredCategories: [
          "agent_product",
          "not-a-server-category",
          "model_release",
        ],
        preferredEntities: Array.from(
          { length: 26 },
          (_, index) => `Entity ${index}`,
        ),
        preferredSources: Array.from(
          { length: 14 },
          (_, index) => `source-${index}`,
        ),
        recencyBias: 1.6,
      }),
    ).toEqual({
      noveltyBias: 1.7,
      preferredCategories: ["agent_product", "model_release"],
      preferredEntities: Array.from(
        { length: 24 },
        (_, index) => `Entity ${index + 2}`,
      ),
      preferredSources: Array.from(
        { length: 12 },
        (_, index) => `source-${index + 2}`,
      ),
      recencyBias: 1.6,
    });
  });

  it("canonicalizes local topic variants before sending server updateProfile input", () => {
    expect(
      toNewsServerPreferenceProfileInput({
        noveltyBias: 1,
        preferredCategories: [
          "agent-product",
          "model release",
          "open-source",
          "not-a-server-category",
        ],
        preferredEntities: [],
        preferredSources: [],
        recencyBias: 1,
      }).preferredCategories,
    ).toEqual(["agent_product", "model_release", "open_source"]);
  });

  it("subscribes to For You objective writes in the current tab and storage events from other tabs", () => {
    const windowStub = createWindowStub();
    const objectives: string[] = [];
    const unsubscribe = subscribeToNewsForYouObjectiveStorage(() => {
      objectives.push(readStoredNewsForYouObjective());
    });

    writeStoredNewsForYouObjective("exploration");
    window.dispatchEvent(createStorageEvent("another-key"));
    window.localStorage.setItem(newsForYouObjectiveStorageKey, "source_trust");
    window.dispatchEvent(createStorageEvent(newsForYouObjectiveStorageKey));

    expect(objectives).toEqual(["exploration", "source_trust"]);

    unsubscribe();
    writeStoredNewsForYouObjective("market_heat");

    expect(objectives).toHaveLength(2);

    windowStub.localStorage.clear();
  });

  it("keeps homepage, article, and edition surfaces on the shared profile storage path", async () => {
    const [homeSource, articleSource, editionSource] = await Promise.all([
      readFile(new URL("./news-home.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../news/_components/news-article.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./news-edition-reader-lens.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    expect(homeSource).toContain("./news-reader-profile-storage");
    expect(homeSource).toContain("areNewsPreferenceProfilesEqual");
    expect(homeSource).toContain("subscribeToNewsPreferenceProfileStorage");
    expect(homeSource).toContain("readStoredNewsForYouObjective");
    expect(homeSource).toContain("writeStoredNewsPreferenceProfile(");
    expect(articleSource).toContain(
      "../../_components/news-reader-profile-storage",
    );
    expect(articleSource).toContain("areNewsPreferenceProfilesEqual");
    expect(articleSource).toContain("subscribeToNewsPreferenceProfileStorage");
    expect(articleSource).toContain("writeStoredNewsPreferenceProfile(");
    expect(editionSource).toContain("./news-reader-profile-storage");
    expect(editionSource).toContain("subscribeToNewsPreferenceProfileStorage");
    expect(editionSource).toContain("writeStoredNewsPreferenceProfile(");
  });
});
