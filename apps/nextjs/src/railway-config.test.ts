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
  test("workspace contains only active web applications", async () => {
    const appDirectories = await readdir(path.join(repoRoot, "apps"));

    expect(appDirectories.sort()).toEqual(["admin", "nextjs"]);
  });

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

  test.each(["packages/api/railway.json", "packages/db/railway.json"])(
    "removes misleading Next.js fallback config %s",
    async (configPath) => {
      await expect(access(path.join(repoRoot, configPath))).rejects.toThrow();
    },
  );

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

    expect(rootPackage.scripts?.build).toBe("turbo run build");
    expect(rootPackage.scripts?.["deploy:nextjs"]).toBe(
      "pnpm run build:nextjs",
    );
    expect(rootPackage.scripts?.["start:nextjs"]).toBe(
      "HOSTNAME=0.0.0.0 pnpm exec dotenv -e .env -- node apps/nextjs/.next/standalone/apps/nextjs/server.js",
    );
    expect(rootPackage.scripts).not.toHaveProperty("build:railway");
    expect(rootPackage.scripts).not.toHaveProperty("predeploy:railway");
    expect(rootPackage.scripts).not.toHaveProperty("start:railway");
    expect(rootPackage.scripts).not.toHaveProperty("android");
    expect(rootPackage.scripts).not.toHaveProperty("ios");

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

    expect(publicAssets).not.toContain("t3-icon.svg");
    expect(manifest).toContain('name: "The New AI Times"');
    expect(manifest).toContain('short_name: "AI Times"');
    expect(manifest).toContain('start_url: "/"');
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('src: "/icon.svg"');
    expect(appIcon).toContain("<title>The New AI Times</title>");
    expect(appIcon).not.toContain("T3");
  });

  test("Next.js auth verifies Firebase sessions with the configured project", async () => {
    const authServer = await readFile(
      path.join(repoRoot, "apps/nextjs/src/auth/server.ts"),
      "utf8",
    );

    expect(authServer).toContain("createFirebaseAdminSessionReader");
    expect(authServer).toContain("env.NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(authServer).not.toContain("initAuth");
  });

  test("Next.js proxies same-origin Firebase redirect handlers", async () => {
    const nextConfig = await readFile(
      path.join(repoRoot, "apps/nextjs/next.config.js"),
      "utf8",
    );

    expect(nextConfig).toContain("firebaseAuthDomain");
    expect(nextConfig).toContain('source: "/__/auth/:path*"');
    expect(nextConfig).toContain(
      "destination: `https://${firebaseAuthDomain}/__/auth/:path*`",
    );
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
