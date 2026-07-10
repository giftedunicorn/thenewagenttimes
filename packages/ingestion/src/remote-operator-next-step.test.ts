import { describe, expect, it } from "vitest";

import { getRemoteNewsOperatorNextStep } from "./index";

describe("getRemoteNewsOperatorNextStep", () => {
  it("is available from the ingestion package entrypoint", () => {
    expect(
      getRemoteNewsOperatorNextStep({
        operatorNextStep: {
          command: "pnpm run news:health:remote",
          detail: "Run the remote health check after embeddings finish.",
          label: "Check news health",
          step: "check-news-health",
        },
      }),
    ).toEqual({
      command: "pnpm run news:health:remote",
      detail: "Run the remote health check after embeddings finish.",
      label: "Check news health",
      step: "check-news-health",
    });
  });
});
