import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  catalogs: [
    {
      include: ["src"],
      path: "<rootDir>/src/locales/{locale}/messages",
    },
  ],
  fallbackLocales: {
    default: "en",
  },
  locales: ["en"],
  sourceLocale: "en",
};

export default config;
