import { reactStartCookies } from "better-auth/react-start";

import type { SessionReader } from "@acme/auth";
import { initAuth } from "@acme/auth";

import { env } from "~/env";
import { getBaseUrl } from "~/lib/url";

export const auth = initAuth({
  baseUrl: getBaseUrl(),
  productionUrl: `https://${env.VERCEL_PROJECT_PRODUCTION_URL ?? "turbo.t3.gg"}`,
  secret: env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID,
  discordClientSecret: env.AUTH_DISCORD_SECRET,

  extraPlugins: [reactStartCookies()],
});

export const getAppSession: SessionReader = async (headers) => {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;

  return {
    expiresAt: result.session.expiresAt,
    user: {
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      id: result.user.id,
      image: result.user.image ?? null,
      name: result.user.name,
    },
  };
};
