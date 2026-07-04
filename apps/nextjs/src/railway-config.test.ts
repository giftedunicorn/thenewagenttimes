import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface RailwayConfig {
  build?: {
    buildCommand?: string;
  };
  deploy?: {
    startCommand?: string;
  };
}

const repoRoot = path.resolve(process.cwd(), "../..");

const readJson = async <T>(relativePath: string): Promise<T> => {
  const file = await readFile(path.join(repoRoot, relativePath), "utf8");
  return JSON.parse(file) as T;
};

describe("Railway Next.js deployment config", () => {
  test.each([
    [
      "repo root",
      "railway.json",
      "pnpm run deploy:nextjs",
      "pnpm run start:nextjs",
    ],
    [
      "Next.js app",
      "apps/nextjs/railway.json",
      "pnpm run deploy:nextjs",
      "pnpm run start:nextjs",
    ],
    [
      "TanStack app fallback",
      "apps/tanstack-start/railway.json",
      "pnpm run deploy:nextjs",
      "pnpm run start:nextjs",
    ],
    [
      "API package fallback",
      "packages/api/railway.json",
      "pnpm --dir ../.. run deploy:nextjs",
      "pnpm --dir ../.. run start:nextjs",
    ],
    [
      "database package fallback",
      "packages/db/railway.json",
      "pnpm --dir ../.. run deploy:nextjs",
      "pnpm --dir ../.. run start:nextjs",
    ],
  ])(
    "%s uses the Next.js build and start commands",
    async (_, configPath, buildCommand, startCommand) => {
      const config = await readJson<RailwayConfig>(configPath);

      expect(config.build?.buildCommand).toBe(buildCommand);
      expect(config.deploy?.startCommand).toBe(startCommand);
    },
  );

  test("shared package Railway fallbacks do not advertise standalone app builds", async () => {
    const apiPackage = await readJson<PackageManifest>(
      "packages/api/package.json",
    );
    const dbPackage = await readJson<PackageManifest>(
      "packages/db/package.json",
    );

    expect(apiPackage.scripts?.build).toBe("tsc");
    expect(dbPackage.scripts?.build).toBe("tsc");
  });

  test("shared package Railway fallbacks expose a start script for Railpack detection", async () => {
    const apiPackage = await readJson<PackageManifest>(
      "packages/api/package.json",
    );
    const dbPackage = await readJson<PackageManifest>(
      "packages/db/package.json",
    );

    expect(apiPackage.scripts?.start).toBe("pnpm --dir ../.. run start:nextjs");
    expect(dbPackage.scripts?.start).toBe("pnpm --dir ../.. run start:nextjs");
  });

  test("workspace scripts keep every Railway root pointed at Next.js", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const nextPackage = await readJson<PackageManifest>(
      "apps/nextjs/package.json",
    );
    const tanstackPackage = await readJson<PackageManifest>(
      "apps/tanstack-start/package.json",
    );

    expect(rootPackage.scripts?.build).toBe(
      "turbo run build --filter=!@acme/tanstack-start",
    );
    expect(rootPackage.scripts?.["deploy:nextjs"]).toBe(
      "pnpm run build:nextjs",
    );
    expect(rootPackage.scripts?.["start:nextjs"]).toBe(
      "HOSTNAME=0.0.0.0 pnpm exec dotenv -e .env -- node apps/nextjs/.next/standalone/apps/nextjs/server.js",
    );

    expect(nextPackage.scripts?.["deploy:nextjs"]).toBe(
      "pnpm --dir ../.. run deploy:nextjs",
    );
    expect(nextPackage.scripts?.["start:nextjs"]).toBe(
      "pnpm --dir ../.. run start:nextjs",
    );

    expect(tanstackPackage.scripts?.["deploy:nextjs"]).toBe(
      "pnpm --dir ../.. run deploy:nextjs",
    );
    expect(tanstackPackage.scripts?.build).toBe(
      "pnpm --dir ../.. run deploy:nextjs",
    );
    expect(tanstackPackage.scripts?.["build:tanstack"]).toBe(
      "pnpm --dir ../.. run deploy:nextjs",
    );
    expect(tanstackPackage.scripts?.["start:nextjs"]).toBe(
      "pnpm --dir ../.. run start:nextjs",
    );
    expect(tanstackPackage.scripts?.start).toBe(
      "pnpm --dir ../.. run start:nextjs",
    );
    expect(tanstackPackage.scripts?.["start:tanstack"]).toBe(
      "pnpm --dir ../.. run start:nextjs",
    );
  });

  test("standalone start has a static asset sync step", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");

    expect(rootPackage.scripts?.["build:nextjs"]).toBe(
      "turbo run build -F @acme/nextjs... && pnpm run sync:nextjs-standalone",
    );
    expect(rootPackage.scripts?.["sync:nextjs-standalone"]).toBe(
      "node apps/nextjs/scripts/sync-standalone-assets.mjs",
    );

    const syncScript = await readFile(
      path.join(repoRoot, "apps/nextjs/scripts/sync-standalone-assets.mjs"),
      "utf8",
    );

    expect(syncScript).toContain("apps/nextjs");
    expect(syncScript).toContain(".next/static");
    expect(syncScript).toContain(".next/standalone/apps/nextjs");
    expect(syncScript).toContain("public");
    expect(syncScript).toContain("await cp(copyJob.from, copyJob.to");
  });

  test("standalone runtime declares direct Postgres driver dependencies", async () => {
    const nextPackage = await readJson<PackageManifest>(
      "apps/nextjs/package.json",
    );

    expect(nextPackage.dependencies?.pg).toBe("^8.22.0");
  });

  test("Next.js build uses local fonts instead of remote Google font fetches", async () => {
    const layout = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/layout.tsx"),
      "utf8",
    );
    const styles = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/styles.css"),
      "utf8",
    );
    const nextPackage = await readJson<PackageManifest>(
      "apps/nextjs/package.json",
    );

    expect(layout).not.toContain("next/font/google");
    expect(styles).toContain('@import "@fontsource-variable/geist";');
    expect(styles).toContain('@import "@fontsource-variable/geist-mono";');
    expect(nextPackage.dependencies?.["@fontsource-variable/geist"]).toBe(
      "^5.2.8",
    );
    expect(nextPackage.dependencies?.["@fontsource-variable/geist-mono"]).toBe(
      "^5.2.7",
    );
  });

  test("Next.js layout does not float template chrome over the news edition", async () => {
    const layout = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/layout.tsx"),
      "utf8",
    );

    expect(layout).toContain("<ThemeProvider>");
    expect(layout).not.toContain("<ThemeToggle />");
    expect(layout).not.toContain("fixed right-4 bottom-4");
  });

  test("TanStack fallback route does not expose the starter scaffold", async () => {
    const tanstackHomeRoute = await readFile(
      path.join(repoRoot, "apps/tanstack-start/src/routes/index.tsx"),
      "utf8",
    );

    expect(tanstackHomeRoute).toContain("The New AI Times");
    expect(tanstackHomeRoute).not.toContain("Create");
    expect(tanstackHomeRoute).not.toContain("T3");
    expect(tanstackHomeRoute).not.toContain("Turbo");
    expect(tanstackHomeRoute).not.toContain("CreatePostForm");
    expect(tanstackHomeRoute).not.toContain("tracking-[");
    expect(tanstackHomeRoute).toContain('rel="nofollow noopener noreferrer"');
  });

  test("Expo shell does not expose the starter post scaffold", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("The New AI Times");
    expect(expoHomeRoute).not.toContain("Create T3");
    expect(expoHomeRoute).not.toContain("trpc.post");
    expect(expoHomeRoute).not.toContain("/post/[id]");
  });

  test("Expo shell uses the personalized news recommendation loop", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("readOrCreateNewsVisitorKey");
    expect(expoHomeRoute).toContain("trpc.news.forYou.queryOptions");
    expect(expoHomeRoute).toContain("visitorKey");
    expect(expoHomeRoute).toContain("trpc.news.recordInteraction");
    expect(expoHomeRoute).not.toContain("trpc.news.feed.queryOptions");
  });

  test("Expo shell sends reader local hour for daypart recommendations", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("readerLocalHour");
    expect(expoHomeRoute).toContain("new Date().getHours()");
  });

  test("Expo article route records meaningful reads for recommendations", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("readOrCreateNewsVisitorKey");
    expect(expoArticleRoute).toContain("trpc.news.recordInteraction");
    expect(expoArticleRoute).toContain('surface: "article"');
    expect(expoArticleRoute).toContain('readMilestone: "meaningful_read"');
    expect(expoArticleRoute).toContain("readPercent: 0.42");
  });

  test("Expo article route trains source preference from source clicks", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("recordSourceClick");
    expect(expoArticleRoute).toContain("getExpoNewsArticleSourceUrl");
    expect(expoArticleRoute).toContain("const sourceUrl =");
    expect(expoArticleRoute).toContain('action: "click_source"');
    expect(expoArticleRoute).toContain('surface: "article_source"');
    expect(expoArticleRoute).toContain("Linking.openURL(sourceUrl)");
  });

  test("Next.js home renders coverage-thread verification status", async () => {
    const newsHome = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/_components/news-home.tsx"),
      "utf8",
    );

    expect(newsHome).toContain("thread.verificationLabel");
    expect(newsHome).toContain("thread.verificationSummary");
  });
});
