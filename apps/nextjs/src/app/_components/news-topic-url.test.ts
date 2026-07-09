import { describe, expect, it } from "vitest";

import { getCanonicalNewsTopicPathname } from "./news-topic-url";

describe("getCanonicalNewsTopicPathname", () => {
  it("canonicalizes underscore topic paths to hyphenated public paths", () => {
    expect(getCanonicalNewsTopicPathname("/topics/agent_product")).toBe(
      "/topics/agent-product",
    );
    expect(getCanonicalNewsTopicPathname("/topics/Model_Release")).toBe(
      "/topics/model-release",
    );
  });

  it("leaves canonical topic paths and non-topic paths alone", () => {
    expect(getCanonicalNewsTopicPathname("/topics/agent-product")).toBeNull();
    expect(getCanonicalNewsTopicPathname("/sources/agent_product")).toBeNull();
  });
});
