import { describe, expect, it } from "vitest";

import { appRouter } from "./root";

describe("appRouter", () => {
  it("exposes only product routers, not the starter post scaffold", () => {
    const procedureNames = Object.keys(appRouter._def.procedures).sort();

    [
      "auth.getSecretMessage",
      "post.all",
      "post.byId",
      "post.create",
      "post.delete",
    ].forEach((procedureName) => {
      expect(procedureNames).not.toContain(procedureName);
    });
    expect(new Set(procedureNames.map((name) => name.split(".")[0]))).toEqual(
      new Set(["auth", "news"]),
    );
  });
});
