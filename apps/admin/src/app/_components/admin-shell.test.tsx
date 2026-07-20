import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ADMIN_NAVIGATION } from "./navigation";
import { PageState } from "./page-state";
import { StatusBadge } from "./status-badge";

describe("admin navigation", () => {
  it("reuses the product identity for browser metadata", async () => {
    const icon = await readFile(
      path.join(process.cwd(), "src/app/icon.svg"),
      "utf8",
    );

    expect(icon).toContain("<title>The New AI Times</title>");
  });

  it("contains only the six approved operational surfaces", () => {
    expect(
      ADMIN_NAVIGATION.map(({ href, label }) => ({ href, label })),
    ).toEqual([
      { href: "/", label: "Overview" },
      { href: "/ingestion", label: "Ingestion" },
      { href: "/jobs", label: "Jobs" },
      { href: "/content", label: "Content" },
      { href: "/sources", label: "Sources" },
      { href: "/users", label: "Users" },
    ]);
  });

  it("uses shared Sheet navigation on mobile without Lingui", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/_components/mobile-navigation.tsx"),
      "utf8",
    );

    expect(source).toContain('from "@acme/ui/sheet"');
    expect(source).toContain("md:hidden");
    expect(source).not.toContain("@lingui");
  });

  it("uses VibeCom-style icon navigation with a collapsible desktop rail", async () => {
    const [navigationSource, sidebarSource] = await Promise.all([
      readFile(
        path.join(process.cwd(), "src/app/_components/navigation.ts"),
        "utf8",
      ),
      readFile(
        path.join(process.cwd(), "src/app/_components/sidebar.tsx"),
        "utf8",
      ),
    ]);

    expect(navigationSource).toContain('from "lucide-react"');
    expect(sidebarSource).toContain("PanelLeftClose");
    expect(sidebarSource).toContain("PanelLeftOpen");
    expect(navigationSource).not.toContain("shortLabel");
  });
});

describe("PageState", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToStaticMarkup(<PageState state="loading" />)).toContain(
      "Loading",
    );
    expect(
      renderToStaticMarkup(
        <PageState
          description="No production records exist yet."
          state="empty"
          title="No data"
        />,
      ),
    ).toContain("No production records exist yet.");
    expect(
      renderToStaticMarkup(
        <PageState onRetry={() => undefined} state="error" />,
      ),
    ).toContain("Try again");
  });
});

describe("StatusBadge", () => {
  it("renders semantic status text instead of color alone", () => {
    expect(
      renderToStaticMarkup(
        <StatusBadge status="critical">Critical</StatusBadge>,
      ),
    ).toContain("Critical");
    expect(
      renderToStaticMarkup(<StatusBadge status="healthy">Healthy</StatusBadge>),
    ).toContain("Healthy");
  });
});
