import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface RailwayConfig {
  build: {
    buildCommand: string;
    watchPatterns: string[];
  };
  deploy: {
    preDeployCommand?: string[];
    restartPolicyType: string;
    startCommand: string;
  };
}

interface TurboConfig {
  globalEnv?: string[];
}

const repoRoot = path.resolve(process.cwd(), "../..");

const readJson = async <T>(relativePath: string): Promise<T> => {
  const source = await readFile(path.join(repoRoot, relativePath), "utf8");
  return JSON.parse(source) as T;
};

describe("Railway admin service", () => {
  it("uses direct build/start commands without a predeploy migration", async () => {
    const railway = await readJson<RailwayConfig>("apps/admin/railway.json");

    expect(railway.build.buildCommand).toBe("pnpm run deploy:admin");
    expect(railway.deploy.startCommand).toBe("pnpm run start:admin");
    expect(railway.deploy).not.toHaveProperty("preDeployCommand");
    expect(railway.deploy.restartPolicyType).toBe("ON_FAILURE");
  });

  it("watches the admin dependency graph and workspace manifests", async () => {
    const railway = await readJson<RailwayConfig>("apps/admin/railway.json");

    expect(railway.build.watchPatterns).toEqual(
      expect.arrayContaining([
        "apps/admin/**",
        "packages/admin-api/**",
        "packages/auth/**",
        "packages/db/**",
        "packages/ui/**",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "turbo.json",
      ]),
    );
  });

  it("exposes direct root scripts and the complete environment contract", async () => {
    const rootPackage = await readJson<PackageManifest>("package.json");
    const turbo = await readJson<TurboConfig>("turbo.json");
    const envExample = await readFile(
      path.join(repoRoot, ".env.example"),
      "utf8",
    );

    expect(rootPackage.scripts?.["build:admin"]).toBe(
      "turbo run build -F @acme/admin... && pnpm run sync:admin-standalone",
    );
    expect(rootPackage.scripts?.["deploy:admin"]).toBe("pnpm run build:admin");
    expect(rootPackage.scripts?.["start:admin"]).toBe(
      "HOSTNAME=0.0.0.0 pnpm exec dotenv -e .env -- node apps/admin/.next/standalone/apps/admin/server.js",
    );
    expect(rootPackage.scripts?.["start:admin"]).not.toContain(
      "RAILWAY_SERVICE_NAME",
    );

    const requiredVariables = [
      "ADMIN_EMAILS",
      "FIREBASE_SERVICE_ACCOUNT_JSON",
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "POSTGRES_URL",
    ];

    expect(turbo.globalEnv).toEqual(expect.arrayContaining(requiredVariables));
    for (const variable of requiredVariables) {
      expect(envExample).toContain(`${variable}=`);
    }
  });

  it("keeps the standalone Postgres driver resolvable and checks build types", async () => {
    const adminPackage = await readJson<PackageManifest>(
      "apps/admin/package.json",
    );
    const nextConfig = await readFile(
      path.join(repoRoot, "apps/admin/next.config.js"),
      "utf8",
    );

    expect(adminPackage.dependencies?.pg).toBe("^8.22.0");
    expect(nextConfig).not.toContain("ignoreBuildErrors");
  });
});
