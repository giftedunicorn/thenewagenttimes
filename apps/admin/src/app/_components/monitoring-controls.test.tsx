import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RefreshButton } from "./refresh-button";

const dashboardPage = (...segments: string[]) =>
  path.join(process.cwd(), "src/app/(dashboard)", ...segments, "page.tsx");

describe("monitoring controls", () => {
  it("renders an explicit refresh state", () => {
    expect(
      renderToStaticMarkup(
        <RefreshButton isRefreshing onRefresh={() => undefined} />,
      ),
    ).toContain("Refreshing");
  });

  it("auto-refreshes all monitoring queries", async () => {
    const sources = await Promise.all(
      [
        dashboardPage(),
        dashboardPage("ingestion"),
        dashboardPage("jobs"),
        dashboardPage("content"),
        dashboardPage("sources"),
        dashboardPage("users"),
      ].map((file) => readFile(file, "utf8")),
    );

    for (const source of sources) {
      expect(source).toContain("refetchInterval: AUTO_REFRESH_INTERVAL_MS");
    }
  });

  it("debounces database-backed searches", async () => {
    const [contentSource, usersSource] = await Promise.all([
      readFile(dashboardPage("content"), "utf8"),
      readFile(dashboardPage("users"), "utf8"),
    ]);

    expect(contentSource).toContain("useDebouncedValue");
    expect(usersSource).toContain("useDebouncedValue");
  });
});
