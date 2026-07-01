interface AuthSocialProviderOptions {
  productionUrl: string;
  discordClientId: string | undefined;
  discordClientSecret: string | undefined;
}

export function createAuthSocialProviders({
  productionUrl,
  discordClientId,
  discordClientSecret,
}: AuthSocialProviderOptions) {
  if (!discordClientId || !discordClientSecret) {
    return undefined;
  }

  return {
    discord: {
      clientId: discordClientId,
      clientSecret: discordClientSecret,
      redirectURI: `${productionUrl}/api/auth/callback/discord`,
    },
  };
}
