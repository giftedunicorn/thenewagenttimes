import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@acme/auth";

import { env } from "~/env";

const toHttpsUrl = (domain: string | undefined) => {
  const trimmedDomain = domain?.trim();

  if (!trimmedDomain) return undefined;

  return /^https?:\/\//i.test(trimmedDomain)
    ? trimmedDomain
    : `https://${trimmedDomain}`;
};

const deploymentDomain =
  env.RAILWAY_PUBLIC_DOMAIN ??
  env.VERCEL_PROJECT_PRODUCTION_URL ??
  "thenewaitimes.com";
const productionUrl =
  toHttpsUrl(deploymentDomain) ?? "https://thenewaitimes.com";
const railwayBaseUrl = toHttpsUrl(env.RAILWAY_PUBLIC_DOMAIN);
const vercelPreviewUrl = toHttpsUrl(env.VERCEL_URL);
const vercelProductionUrl = toHttpsUrl(env.VERCEL_PROJECT_PRODUCTION_URL);
const baseUrl =
  env.VERCEL_ENV === "production"
    ? (vercelProductionUrl ?? productionUrl)
    : env.VERCEL_ENV === "preview"
      ? (vercelPreviewUrl ?? productionUrl)
      : (railwayBaseUrl ?? "http://localhost:3000");

export const auth = initAuth({
  baseUrl,
  productionUrl,
  secret: env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID,
  discordClientSecret: env.AUTH_DISCORD_SECRET,
  extraPlugins: [nextCookies()],
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
