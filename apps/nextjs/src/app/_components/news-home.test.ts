import { describe, expect, it } from "vitest";

import { formatNewsEditionDate, formatNewsTime } from "./news-home-model";

describe("formatNewsEditionDate", () => {
  it("uses a stable UTC edition date across server and browser time zones", () => {
    expect(formatNewsEditionDate("2026-07-04T18:06:42.000Z")).toBe(
      "Saturday, July 4, 2026",
    );
  });
});

describe("formatNewsTime", () => {
  it("uses a stable UTC story time across server and browser time zones", () => {
    expect(formatNewsTime("2026-07-04T17:13:00.000Z")).toBe("5:13 PM");
  });
});
