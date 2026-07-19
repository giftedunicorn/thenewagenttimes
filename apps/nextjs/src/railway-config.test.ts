import { access, readdir, readFile } from "node:fs/promises";
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
    cronSchedule?: string;
    preDeployCommand?: string[];
    restartPolicyMaxRetries?: number;
    restartPolicyType?: string;
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
      "pnpm run db:predeploy",
    ],
    [
      "Next.js app",
      "apps/nextjs/railway.json",
      "pnpm run deploy:nextjs",
      "pnpm run db:predeploy",
    ],
  ])(
    "%s directly configures the web service",
    async (_, configPath, buildCommand, preDeployCommand) => {
      const config = await readJson<RailwayConfig>(configPath);

      expect(config.build?.buildCommand).toBe(buildCommand);
      expect(config.deploy).toMatchObject({
        preDeployCommand: [preDeployCommand],
        restartPolicyMaxRetries: 10,
        restartPolicyType: "ON_FAILURE",
        startCommand: "pnpm run start:nextjs",
      });
    },
  );

  test("background worker has direct build/start commands and always restarts", async () => {
    const config = await readJson<RailwayConfig>(
      "packages/background-worker/railway.json",
    );

    expect(config.build?.buildCommand).toBe(
      "pnpm --filter @acme/background-worker... build",
    );
    expect(config.deploy).toMatchObject({
      drainingSeconds: 600,
      restartPolicyType: "ALWAYS",
      startCommand: "pnpm --filter @acme/background-worker start",
    });
    expect(config.deploy?.preDeployCommand).toBeUndefined();
  });

  test("cron runs as an HTTP-only scheduler configured by cron.json", async () => {
    const config = await readJson<RailwayConfig>("packages/cron/railway.json");

    expect(config.build?.buildCommand).toBe("pnpm --filter @acme/cron build");
    expect(config.deploy).toMatchObject({
      restartPolicyType: "ALWAYS",
      startCommand: "pnpm --filter @acme/cron start",
    });
    expect(config.deploy?.cronSchedule).toBeUndefined();
    expect(config.deploy?.preDeployCommand).toBeUndefined();
  });

  test.each([
    "apps/tanstack-start/railway.json",
    "packages/api/railway.json",
    "packages/db/railway.json",
  ])("removes misleading Next.js fallback config %s", async (configPath) => {
    await expect(access(path.join(repoRoot, configPath))).rejects.toThrow();
  });

  test("Railway schema sync safely backfills news clusters before Drizzle push", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const dbPackage = await readJson<PackageManifest>(
      "packages/db/package.json",
    );
    const deployScript = await readFile(
      path.join(repoRoot, "packages/db/scripts/prepare-deploy-schema.mjs"),
      "utf8",
    );

    expect(rootPackage.scripts?.["db:predeploy"]).toBe(
      "pnpm -F @acme/db predeploy",
    );
    expect(dbPackage.scripts?.predeploy).toBe(
      "pnpm with-env node scripts/prepare-deploy-schema.mjs && pnpm push",
    );
    expect(deployScript).toContain("ADD COLUMN IF NOT EXISTS cluster_key");
    expect(deployScript).toContain("dedupe_key");
    expect(deployScript).toContain("canonical_url");
    expect(deployScript).toContain("ALTER COLUMN cluster_key SET NOT NULL");
    expect(deployScript).toContain("news_item_cluster_key_idx");
  });

  test("workspace scripts expose direct web commands without role dispatch", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const nextPackage = await readJson<PackageManifest>(
      "apps/nextjs/package.json",
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
    expect(rootPackage.scripts).not.toHaveProperty("build:railway");
    expect(rootPackage.scripts).not.toHaveProperty("predeploy:railway");
    expect(rootPackage.scripts).not.toHaveProperty("start:railway");

    expect(nextPackage.scripts?.["deploy:nextjs"]).toBe(
      "pnpm --dir ../.. run deploy:nextjs",
    );
    expect(nextPackage.scripts?.["start:nextjs"]).toBe(
      "pnpm --dir ../.. run start:nextjs",
    );
  });

  test("standalone start has a static asset sync step", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const nextConfig = await readFile(
      path.join(repoRoot, "apps/nextjs/next.config.js"),
      "utf8",
    );

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
    expect(nextConfig).toContain("outputFileTracingRoot: repoRoot");
    expect(nextConfig).toContain("turbopack: { root: repoRoot }");
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

  test("Next.js app shell ships The New AI Times install branding instead of T3 assets", async () => {
    const publicAssets = await readdir(
      path.join(repoRoot, "apps/nextjs/public"),
    );
    const manifest = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/manifest.ts"),
      "utf8",
    );
    const appIcon = await readFile(
      path.join(repoRoot, "apps/nextjs/src/app/icon.svg"),
      "utf8",
    );
    const nextFavicon = await readFile(
      path.join(repoRoot, "apps/nextjs/public/favicon.ico"),
    );
    const fallbackFavicon = await readFile(
      path.join(repoRoot, "apps/tanstack-start/public/favicon.ico"),
    );

    expect(publicAssets).not.toContain("t3-icon.svg");
    expect(nextFavicon.equals(fallbackFavicon)).toBe(false);
    expect(manifest).toContain('name: "The New AI Times"');
    expect(manifest).toContain('short_name: "AI Times"');
    expect(manifest).toContain('start_url: "/"');
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('src: "/icon.svg"');
    expect(appIcon).toContain("<title>The New AI Times</title>");
    expect(appIcon).not.toContain("T3");
  });

  test("Next.js auth production URL fallback uses The New AI Times domain", async () => {
    const authServer = await readFile(
      path.join(repoRoot, "apps/nextjs/src/auth/server.ts"),
      "utf8",
    );

    expect(authServer).toContain("thenewaitimes.com");
    expect(authServer).not.toContain("turbo.t3.gg");
  });

  test("Next.js auth URLs use Railway public domains outside Vercel", async () => {
    const authServer = await readFile(
      path.join(repoRoot, "apps/nextjs/src/auth/server.ts"),
      "utf8",
    );

    expect(authServer).toContain("env.RAILWAY_PUBLIC_DOMAIN");
    expect(authServer).toContain("const deploymentDomain");
    expect(authServer).toContain(
      "const railwayBaseUrl = toHttpsUrl(env.RAILWAY_PUBLIC_DOMAIN);",
    );
    expect(authServer).toContain(
      ': (railwayBaseUrl ?? "http://localhost:3000")',
    );
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

  test("Expo shell renders mobile category channels that drive personalized feed input", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("mobileCategoryChannels");
    expect(expoHomeRoute).toContain("activeCategory");
    expect(expoHomeRoute).toContain("category: activeCategory ?? undefined");
    expect(expoHomeRoute).toContain("setActiveCategory(channel.category)");
    expect(expoHomeRoute).toContain("ScrollView");
    expect(expoHomeRoute).toContain("Models");
    expect(expoHomeRoute).toContain("Agents");
    expect(expoHomeRoute).toContain("Funding");
    expect(expoHomeRoute).toContain("Research");
  });

  test("Expo shell sends mobile search intent into the personalized feed input", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("TextInput");
    expect(expoHomeRoute).toContain("searchDraft");
    expect(expoHomeRoute).toContain("searchQuery");
    expect(expoHomeRoute).toContain("q: searchQuery || undefined");
    expect(expoHomeRoute).toContain("setSearchQuery(searchDraft.trim())");
    expect(expoHomeRoute).toContain('returnKeyType="search"');
    expect(expoHomeRoute).toContain("Search AI news");
    expect(expoHomeRoute).toContain("Clear");
  });

  test("Expo shell records mobile search memory for future For You sessions", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain(
      "trpc.news.recordSearchMemory.mutationOptions",
    );
    expect(expoHomeRoute).toContain("recordSearchMemory");
    expect(expoHomeRoute).toContain("recordedSearchMemoryQueries");
    expect(expoHomeRoute).toContain("query: trimmedSearchQuery");
    expect(expoHomeRoute).toContain("resultCount: newsQuery.data?.length ?? 0");
  });

  test("Expo shell renders mobile reader memory from recommendation signals", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("trpc.news.profile.queryOptions");
    expect(expoHomeRoute).toContain("trpc.news.saved.queryOptions");
    expect(expoHomeRoute).toContain("profileQuery.data?.audit.summary");
    expect(expoHomeRoute).toContain(
      "profileQuery.data?.audit.trainedSignalCount",
    );
    expect(expoHomeRoute).toContain("savedQuery.data?.length");
    expect(expoHomeRoute).toContain("Reader Memory");
    expect(expoHomeRoute).toContain("trpc.news.profile.queryFilter()");
    expect(expoHomeRoute).toContain("trpc.news.saved.queryFilter()");
  });

  test("Expo shell renders saved stories as a mobile reading queue", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("SavedStoriesShelf");
    expect(expoHomeRoute).toContain("savedQuery.data?.slice(0, 3)");
    expect(expoHomeRoute).toContain("Saved Stories");
    expect(expoHomeRoute).toContain("savedItem.sourceName");
    expect(expoHomeRoute).toContain('pathname: "/news/[id]"');
  });

  test("Expo shell removes saved stories from the mobile reading queue", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("trpc.news.removeSaved.mutationOptions");
    expect(expoHomeRoute).toContain("removeSavedStory");
    expect(expoHomeRoute).toContain("onRemove(savedItem)");
    expect(expoHomeRoute).toContain("Remove");
    expect(expoHomeRoute).toContain("newsItemId: savedItem.id");
    expect(expoHomeRoute).toContain("trpc.news.forYou.queryFilter()");
    expect(expoHomeRoute).toContain("trpc.news.profile.queryFilter()");
    expect(expoHomeRoute).toContain("trpc.news.saved.queryFilter()");
  });

  test("Expo shell records mobile home exposures for recommendation fatigue", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("recordedExposureIds");
    expect(expoHomeRoute).toContain("onViewableItemsChanged");
    expect(expoHomeRoute).toContain("viewabilityConfig");
    expect(expoHomeRoute).toContain('action: "view"');
    expect(expoHomeRoute).toContain("exposure: true");
    expect(expoHomeRoute).toContain("exposureSlot: viewableItem.index");
    expect(expoHomeRoute).toContain('surface: "mobile_home"');
  });

  test("Expo shell records mobile share feedback from home feed actions", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain('onFeedback(item, "share", rankSlot)');
    expect(expoHomeRoute).toContain("Share");
    expect(expoHomeRoute).toContain('surface: "mobile_home"');
  });

  test("Expo shell trains source preference from mobile home source clicks", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("getExpoNewsArticleSourceUrl(item)");
    expect(expoHomeRoute).toContain("const sourceUrl =");
    expect(expoHomeRoute).toContain(
      'onFeedback(item, "click_source", rankSlot)',
    );
    expect(expoHomeRoute).toContain('surface: "mobile_home"');
    expect(expoHomeRoute).toContain("Linking.openURL(sourceUrl)");
  });

  test("Expo shell explains why stories appear in the mobile recommendation feed", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("item.recommendation.badges.slice(0, 3)");
    expect(expoHomeRoute).toContain("item.recommendation.summary");
    expect(expoHomeRoute).toContain("Why this");
    expect(expoHomeRoute).toContain("recommendationBadges.map");
    expect(expoHomeRoute).toContain("recommendationSummary");
  });

  test("Expo shell loads more mobile recommendations without repeating seen stories", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("loadedStories");
    expect(expoHomeRoute).toContain("loadMoreStories");
    expect(expoHomeRoute).toContain("queryClient.fetchQuery");
    expect(expoHomeRoute).toContain("excludeNewsItemIds: stories.map");
    expect(expoHomeRoute).toContain("setLoadedStories");
    expect(expoHomeRoute).toContain("hasMoreStories");
    expect(expoHomeRoute).toContain("onEndReached={loadMoreStories}");
    expect(expoHomeRoute).toContain("ListFooterComponent");
  });

  test("Expo shell lets mobile readers review and restore Less feedback guardrails", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("type GuardrailNewsItem =");
    expect(expoHomeRoute).toContain("GuardrailStoriesShelf");
    expect(expoHomeRoute).toContain("trpc.news.guardrails.queryOptions");
    expect(expoHomeRoute).toContain("trpc.news.restoreGuardrail");
    expect(expoHomeRoute).toContain("Hidden Stories");
    expect(expoHomeRoute).toContain("Restore");
    expect(expoHomeRoute).toContain("onRestore");
    expect(expoHomeRoute).toContain("queryClient.invalidateQueries");
    expect(expoHomeRoute).toContain("trpc.news.guardrails.queryFilter()");
  });

  test("Expo shell renders mobile reading history as a continue-reading shelf", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("type HistoryNewsItem =");
    expect(expoHomeRoute).toContain("HistoryStoriesShelf");
    expect(expoHomeRoute).toContain("trpc.news.history.queryOptions");
    expect(expoHomeRoute).toContain("historyQuery.data?.slice(0, 3)");
    expect(expoHomeRoute).toContain("Recently Read");
    expect(expoHomeRoute).toContain("historyItem.viewedAt");
  });

  test("Expo shell lets mobile readers follow the active topic channel", async () => {
    const expoHomeRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/index.tsx"),
      "utf8",
    );

    expect(expoHomeRoute).toContain("followActiveCategory");
    expect(expoHomeRoute).toContain("trpc.news.updateProfile.mutationOptions");
    expect(expoHomeRoute).toContain("profileQuery.data?.preferredCategories");
    expect(expoHomeRoute).toContain("preferredCategories");
    expect(expoHomeRoute).toContain("activeCategory");
    expect(expoHomeRoute).toContain("Follow topic");
    expect(expoHomeRoute).toContain("Following topic");
    expect(expoHomeRoute).toContain("trpc.news.forYou.queryFilter()");
    expect(expoHomeRoute).toContain("trpc.news.profile.queryFilter()");
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

  test("Expo article route records deep reads after mobile scroll depth", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("recordedDeepReadIdsRef");
    expect(expoArticleRoute).toContain("recordDeepRead");
    expect(expoArticleRoute).toContain("onScroll={recordDeepRead}");
    expect(expoArticleRoute).toContain("scrollEventThrottle={250}");
    expect(expoArticleRoute).toContain("contentSize.height <= 0");
    expect(expoArticleRoute).toContain("readPercent < 0.8");
    expect(expoArticleRoute).toContain('readMilestone: "deep_read"');
    expect(expoArticleRoute).toContain('surface: "article"');
  });

  test("Expo article route records article feedback actions", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("recordArticleFeedback");
    expect(expoArticleRoute).toContain('recordArticleFeedback("save")');
    expect(expoArticleRoute).toContain('recordArticleFeedback("share")');
    expect(expoArticleRoute).toContain('recordArticleFeedback("hide")');
    expect(expoArticleRoute).toContain('surface: "article_feedback"');
    expect(expoArticleRoute).toContain("Share.share");
    expect(expoArticleRoute).toContain("Save");
    expect(expoArticleRoute).toContain("Share");
    expect(expoArticleRoute).toContain("Less");
  });

  test("Expo article route refreshes recommendation memory after feedback", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("useQueryClient");
    expect(expoArticleRoute).toContain("const queryClient = useQueryClient();");
    expect(expoArticleRoute).toContain("trpc.news.forYou.queryFilter()");
    expect(expoArticleRoute).toContain("trpc.news.profile.queryFilter()");
    expect(expoArticleRoute).toContain("trpc.news.saved.queryFilter()");
    expect(expoArticleRoute).toContain("trpc.news.history.queryFilter()");
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

  test("Expo article route lets mobile readers follow the article source", async () => {
    const expoArticleRoute = await readFile(
      path.join(repoRoot, "apps/expo/src/app/news/[id].tsx"),
      "utf8",
    );

    expect(expoArticleRoute).toContain("followArticleSource");
    expect(expoArticleRoute).toContain("trpc.news.profile.queryOptions");
    expect(expoArticleRoute).toContain(
      "trpc.news.updateProfile.mutationOptions",
    );
    expect(expoArticleRoute).toContain("profileQuery.data?.preferredSources");
    expect(expoArticleRoute).toContain("article.source.slug");
    expect(expoArticleRoute).toContain("preferredSources");
    expect(expoArticleRoute).toContain("Follow Source");
    expect(expoArticleRoute).toContain("Following Source");
    expect(expoArticleRoute).toContain("trpc.news.forYou.queryFilter()");
    expect(expoArticleRoute).toContain("trpc.news.profile.queryFilter()");
  });

  test("Next.js threads render coverage verification status", async () => {
    const threadsPage = await readFile(
      path.join(
        repoRoot,
        "apps/nextjs/src/app/_components/news-threads-page.tsx",
      ),
      "utf8",
    );

    expect(threadsPage).toContain("thread.verificationLabel");
    expect(threadsPage).toContain("thread.verificationSummary");
  });
});
