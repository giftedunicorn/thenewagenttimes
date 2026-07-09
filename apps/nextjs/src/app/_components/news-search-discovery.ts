import {
  getNewsStructuredDataUrl,
  newsStructuredDataDefaultBaseUrl,
  newsStructuredDataSiteName,
} from "./news-structured-data";

const newsOpenSearchDescription =
  "Search The New AI Times for AI agents, models, funding, research, and sources.";

const xmlEntities: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&apos;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeXml = (value: string) =>
  value.replace(/["&'<>]/g, (character) => xmlEntities[character] ?? character);

const getOpenSearchBaseUrl = (baseUrl?: string) => {
  const trimmedBaseUrl = baseUrl?.trim();

  if (!trimmedBaseUrl) return newsStructuredDataDefaultBaseUrl;

  try {
    return new URL(trimmedBaseUrl).origin;
  } catch {
    return newsStructuredDataDefaultBaseUrl;
  }
};

export const getNewsOpenSearchDescription = ({
  baseUrl,
}: {
  baseUrl?: string;
}) => {
  const normalizedBaseUrl = getOpenSearchBaseUrl(baseUrl);
  const searchUrl = getNewsStructuredDataUrl({
    baseUrl: normalizedBaseUrl,
    path: "/search?q={searchTerms}",
  });
  const rssUrl = getNewsStructuredDataUrl({
    baseUrl: normalizedBaseUrl,
    path: "/rss.xml",
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">',
    `  <ShortName>${escapeXml(newsStructuredDataSiteName)}</ShortName>`,
    `  <Description>${escapeXml(newsOpenSearchDescription)}</Description>`,
    `  <Url type="text/html" method="get" template="${escapeXml(searchUrl)}" />`,
    `  <Url type="application/rss+xml" method="get" template="${escapeXml(rssUrl)}" />`,
    "  <InputEncoding>UTF-8</InputEncoding>",
    "  <OutputEncoding>UTF-8</OutputEncoding>",
    "</OpenSearchDescription>",
  ].join("\n");
};
