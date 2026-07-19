import { describe, expect, it } from "vitest";

import { formatError } from "./errors";

describe("formatError", () => {
  it("formats a normal error as a single concise line", () => {
    expect(formatError(new Error("run failed\nwhile claiming"))).toBe(
      "run failed while claiming",
    );
  });

  it("includes AggregateError constituent messages in order", () => {
    const error = new AggregateError(
      [new Error("run failed"), new Error("close failed")],
      "worker shutdown failed",
    );

    expect(formatError(error)).toBe(
      "worker shutdown failed: [run failed; close failed]",
    );
  });

  it("recursively formats nested AggregateError constituents", () => {
    const error = new AggregateError(
      [
        new Error("run failed"),
        new AggregateError(
          [new Error("close failed"), new Error("cleanup failed")],
          "shutdown failed",
        ),
      ],
      "worker failed",
    );

    expect(formatError(error)).toBe(
      "worker failed: [run failed; shutdown failed: [close failed; cleanup failed]]",
    );
  });

  it("does not serialize non-error payloads", () => {
    expect(formatError({ apiKey: "must-not-be-logged" })).toBe("Unknown error");
  });

  it("bounds long error output", () => {
    const formatted = formatError(new Error("x".repeat(2_000)));

    expect(formatted).toHaveLength(1_000);
    expect(formatted.endsWith("...")).toBe(true);
  });
});
