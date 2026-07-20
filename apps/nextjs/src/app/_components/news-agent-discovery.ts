import {
  getNewsStructuredDataUrl,
  newsStructuredDataDefaultBaseUrl,
  newsStructuredDataSiteName,
} from "./news-structured-data";

const getNewsAgentDiscoveryBaseUrl = (baseUrl?: string) => {
  const trimmedBaseUrl = baseUrl?.trim();

  if (!trimmedBaseUrl) return newsStructuredDataDefaultBaseUrl;

  try {
    return new URL(trimmedBaseUrl).origin;
  } catch {
    return newsStructuredDataDefaultBaseUrl;
  }
};

const getNewsAgentDiscoveryUrl = ({
  baseUrl,
  path,
}: {
  baseUrl: string;
  path: string;
}) => getNewsStructuredDataUrl({ baseUrl, path });

export const getNewsLlmsText = ({ baseUrl }: { baseUrl?: string }) => {
  const normalizedBaseUrl = getNewsAgentDiscoveryBaseUrl(baseUrl);
  const url = (path: string) =>
    getNewsAgentDiscoveryUrl({ baseUrl: normalizedBaseUrl, path });

  return [
    `# ${newsStructuredDataSiteName}`,
    "",
    "> Public AI news, editorial briefings, search, and machine-readable feeds.",
    "",
    "## Core Surfaces",
    `- [Front Page](${url("/")}): Personalized AI news edition with For You ranking.`,
    `- [Daily Briefing](${url("/briefing")}): Ranked AI briefing with topics, entities, and lead stories.`,
    `- [Search](${url("/search")}): Search AI stories, sources, entities, and tags.`,
    `- [Coverage Threads](${url("/threads")}): Follow clustered AI stories across sources and verification state.`,
    `- [Topics](${url("/topics")}): Browse AI news by topic section.`,
    `- [Sources](${url("/sources")}): Browse AI news by source feed.`,
    `- [Entities](${url("/entities")}): Browse people, companies, models, and products covered in AI news.`,
    "",
    "## Machine Feeds",
    `- [RSS](${url("/rss.xml")}): XML feed for news readers.`,
    `- [JSON Feed](${url("/feed.json")}): Machine-readable feed for modern news readers.`,
    `- [OpenSearch](${url("/opensearch.xml")}): Browser and agent search discovery document.`,
    `- [Sitemap](${url("/sitemap.xml")}): Crawlable index of public news surfaces.`,
  ].join("\n");
};
