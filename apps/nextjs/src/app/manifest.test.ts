import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  it("defines a root-scoped English install experience with an accurate icon purpose", () => {
    expect(manifest()).toMatchObject({
      icons: [
        {
          purpose: "any",
          sizes: "any",
          src: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      id: "/",
      lang: "en",
      scope: "/",
    });
  });
});
