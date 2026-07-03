import * as SecureStore from "expo-secure-store";

const newsVisitorKey = "new-ai-times-visitor-key";

const createNewsVisitorKey = () =>
  `expo-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export const readOrCreateNewsVisitorKey = async () => {
  const stored = await SecureStore.getItemAsync(newsVisitorKey);
  if (stored) return stored;

  const next = createNewsVisitorKey();
  await SecureStore.setItemAsync(newsVisitorKey, next);
  return next;
};

export const getExpoNewsArticleSourceUrl = (article: {
  canonicalUrl?: string | null;
  originalUrl?: string | null;
}) => {
  const canonicalUrl = article.canonicalUrl?.trim();

  if (canonicalUrl) return canonicalUrl;

  const originalUrl = article.originalUrl?.trim();

  if (originalUrl) return originalUrl;

  return null;
};
