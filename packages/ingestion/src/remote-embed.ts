import type { RemoteNewsOperatorNextStep } from "./remote-operator-next-step";
import { getFirstNonBlankValue } from "./remote-config";
import { getRemoteNewsOperatorNextStep } from "./remote-operator-next-step";

interface RemoteEmbedHttpInit {
  headers: Record<string, string>;
  method: "POST";
}

interface RemoteEmbedHttpResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type RemoteEmbedFetch = (
  url: string,
  init: RemoteEmbedHttpInit,
) => Promise<RemoteEmbedHttpResponse>;

export interface RemoteNewsEmbedResult {
  body: unknown;
  operatorNextStep?: RemoteNewsOperatorNextStep;
  status: number;
}

export const formatRemoteNewsEmbedSummary = ({
  operatorNextStep,
  status,
}: RemoteNewsEmbedResult) =>
  `Remote news embedding complete: status=${status}${
    operatorNextStep
      ? ` operatorNextStep="${operatorNextStep.label}" operatorCommand=${operatorNextStep.command ?? "none"} operatorDetail="${operatorNextStep.detail}"`
      : ""
  }`;

export interface EmbedRemoteNewsItemsInput {
  embedSecret: string | null | undefined;
  embedUrl: string | null | undefined;
  fetchEmbed?: RemoteEmbedFetch;
  limit?: number;
  railwayPublicDomain?: string | null;
}

export interface ResolveRemoteNewsEmbedCommandInput {
  argv: readonly string[];
  env: Record<string, string | undefined>;
}

const resolveRailwayPublicUrl = (
  railwayPublicDomain: string | null | undefined,
) => {
  const trimmedDomain = railwayPublicDomain?.trim();

  if (!trimmedDomain) return "";
  if (/^https?:\/\//i.test(trimmedDomain)) return trimmedDomain;

  return `https://${trimmedDomain}`;
};

const isNumericCliArgument = (value: string | undefined) => {
  if (!value?.trim()) return false;

  return /^\d+$/.test(value.trim());
};

const parsePositiveInteger = (value: string | undefined) => {
  if (!isNumericCliArgument(value)) return undefined;

  const parsed = Number(value);

  return parsed > 0 ? parsed : undefined;
};

export const resolveRemoteNewsEmbedCommandInput = ({
  argv,
  env,
}: ResolveRemoteNewsEmbedCommandInput): Omit<
  EmbedRemoteNewsItemsInput,
  "fetchEmbed"
> => {
  const firstArg = argv[0]?.trim();
  const secondArg = argv[1]?.trim();
  const firstArgIsLimit = isNumericCliArgument(firstArg);
  const limit = firstArgIsLimit
    ? firstArg
    : (secondArg ?? env.NEWS_EMBED_LIMIT);

  return {
    embedSecret: env.NEWS_REFRESH_SECRET,
    embedUrl: firstArgIsLimit
      ? getFirstNonBlankValue(
          env.NEWS_EMBED_URL,
          env.NEWS_REFRESH_URL,
          env.NEWS_HEALTH_URL,
        )
      : getFirstNonBlankValue(
          firstArg,
          env.NEWS_EMBED_URL,
          env.NEWS_REFRESH_URL,
          env.NEWS_HEALTH_URL,
        ),
    limit: parsePositiveInteger(limit),
    railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN,
  };
};

export const resolveRemoteNewsEmbedUrl = (
  embedUrl: string | null | undefined,
  railwayPublicDomain?: string | null,
) => {
  const trimmedEmbedUrl = embedUrl?.trim() ?? "";
  const trimmedUrl =
    trimmedEmbedUrl.length > 0
      ? trimmedEmbedUrl
      : resolveRailwayPublicUrl(railwayPublicDomain);

  if (!trimmedUrl) {
    throw new Error(
      "NEWS_EMBED_URL, NEWS_REFRESH_URL, NEWS_HEALTH_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  }

  const url = new URL(trimmedUrl);

  if (url.pathname.endsWith("/api/news/refresh")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/refresh$/,
      "/api/news/embed",
    );
  } else if (url.pathname.endsWith("/api/news/health")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/health$/,
      "/api/news/embed",
    );
  } else if (!url.pathname.endsWith("/api/news/embed")) {
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/api/news/embed`;
  }

  url.hash = "";

  return url.toString();
};

const parseRemoteNewsEmbedBody = (text: string): unknown => {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const isRemoteNewsEmbedSuccess = (body: unknown) =>
  typeof body === "object" && body !== null && "ok" in body && body.ok === true;

const defaultFetchEmbed: RemoteEmbedFetch = (url, init) => fetch(url, init);

const getRemoteEmbedFailureHint = (status: number) =>
  status === 404
    ? ". Verify the Railway service is deploying this repo root, branch, and Next.js start command."
    : "";

const addEmbedLimit = (endpoint: string, limit: number | undefined) => {
  if (limit === undefined) return endpoint;

  const url = new URL(endpoint);
  url.searchParams.set("limit", String(limit));

  return url.toString();
};

export const embedRemoteNewsItems = async ({
  embedSecret,
  embedUrl,
  fetchEmbed = defaultFetchEmbed,
  limit,
  railwayPublicDomain,
}: EmbedRemoteNewsItemsInput): Promise<RemoteNewsEmbedResult> => {
  const trimmedSecret = embedSecret?.trim();

  if (!trimmedSecret) throw new Error("NEWS_REFRESH_SECRET is required");

  const endpoint = addEmbedLimit(
    resolveRemoteNewsEmbedUrl(embedUrl, railwayPublicDomain),
    limit,
  );
  const response = await fetchEmbed(endpoint, {
    headers: { authorization: `Bearer ${trimmedSecret}` },
    method: "POST",
  });
  const responseText = await response.text();
  const body = parseRemoteNewsEmbedBody(responseText);

  if (!response.ok || !isRemoteNewsEmbedSuccess(body)) {
    throw new Error(
      `Remote news embedding failed: status=${response.status} body=${responseText}${getRemoteEmbedFailureHint(response.status)}`,
    );
  }

  return {
    body,
    operatorNextStep: getRemoteNewsOperatorNextStep(body),
    status: response.status,
  };
};
