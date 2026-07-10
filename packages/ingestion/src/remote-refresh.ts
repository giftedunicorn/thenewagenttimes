import type { RemoteNewsOperatorNextStep } from "./remote-operator-next-step";
import { getFirstNonBlankValue } from "./remote-config";
import { getRemoteNewsOperatorNextStep } from "./remote-operator-next-step";

interface RemoteRefreshHttpInit {
  headers: Record<string, string>;
  method: "POST";
}

interface RemoteRefreshHttpResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type RemoteRefreshFetch = (
  url: string,
  init: RemoteRefreshHttpInit,
) => Promise<RemoteRefreshHttpResponse>;

export interface RemoteNewsRefreshResult {
  body: unknown;
  operatorNextStep?: RemoteNewsOperatorNextStep;
  status: number;
}

export const formatRemoteNewsRefreshSummary = ({
  operatorNextStep,
  status,
}: RemoteNewsRefreshResult) =>
  `Remote news refresh complete: status=${status}${
    operatorNextStep
      ? ` operatorNextStep="${operatorNextStep.label}" operatorCommand=${operatorNextStep.command ?? "none"} operatorDetail="${operatorNextStep.detail}"`
      : ""
  }`;

export interface RefreshRemoteNewsEditionInput {
  fetchRefresh?: RemoteRefreshFetch;
  railwayPublicDomain?: string | null;
  refreshSecret: string | null | undefined;
  refreshUrl: string | null | undefined;
}

export interface ResolveRemoteNewsRefreshCommandInput {
  argv: readonly string[];
  env: Record<string, string | undefined>;
}

export const resolveRemoteNewsRefreshCommandInput = ({
  argv,
  env,
}: ResolveRemoteNewsRefreshCommandInput): Omit<
  RefreshRemoteNewsEditionInput,
  "fetchRefresh"
> => ({
  railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN,
  refreshSecret: env.NEWS_REFRESH_SECRET,
  refreshUrl: getFirstNonBlankValue(
    argv[0],
    env.NEWS_REFRESH_URL,
    env.NEWS_HEALTH_URL,
    env.NEWS_EMBED_URL,
  ),
});

export const resolveRemoteNewsRefreshUrl = (
  refreshUrl: string | null | undefined,
  railwayPublicDomain?: string | null,
) => {
  const trimmedRefreshUrl = refreshUrl?.trim() ?? "";
  const trimmedUrl =
    trimmedRefreshUrl.length > 0
      ? trimmedRefreshUrl
      : resolveRailwayPublicUrl(railwayPublicDomain);

  if (!trimmedUrl) {
    throw new Error(
      "NEWS_REFRESH_URL, NEWS_HEALTH_URL, NEWS_EMBED_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  }

  const url = new URL(trimmedUrl);

  if (url.pathname.endsWith("/api/news/health")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/health$/,
      "/api/news/refresh",
    );
  } else if (url.pathname.endsWith("/api/news/embed")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/embed$/,
      "/api/news/refresh",
    );
  } else if (!url.pathname.endsWith("/api/news/refresh")) {
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/api/news/refresh`;
  }

  url.hash = "";

  return url.toString();
};

const resolveRailwayPublicUrl = (
  railwayPublicDomain: string | null | undefined,
) => {
  const trimmedDomain = railwayPublicDomain?.trim();

  if (!trimmedDomain) return "";
  if (/^https?:\/\//i.test(trimmedDomain)) return trimmedDomain;

  return `https://${trimmedDomain}`;
};

const parseRemoteNewsRefreshBody = (text: string): unknown => {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const isRemoteNewsRefreshSuccess = (body: unknown) =>
  typeof body === "object" && body !== null && "ok" in body && body.ok === true;

const defaultFetchRefresh: RemoteRefreshFetch = (url, init) => fetch(url, init);

const getRemoteRefreshFailureHint = (status: number) =>
  status === 404
    ? ". Verify the Railway service is deploying this repo root, branch, and Next.js start command."
    : "";

export const refreshRemoteNewsEdition = async ({
  fetchRefresh = defaultFetchRefresh,
  railwayPublicDomain,
  refreshSecret,
  refreshUrl,
}: RefreshRemoteNewsEditionInput): Promise<RemoteNewsRefreshResult> => {
  const trimmedSecret = refreshSecret?.trim();

  if (!trimmedSecret) throw new Error("NEWS_REFRESH_SECRET is required");

  const endpoint = resolveRemoteNewsRefreshUrl(refreshUrl, railwayPublicDomain);
  const response = await fetchRefresh(endpoint, {
    headers: { authorization: `Bearer ${trimmedSecret}` },
    method: "POST",
  });
  const responseText = await response.text();
  const body = parseRemoteNewsRefreshBody(responseText);

  if (!response.ok || !isRemoteNewsRefreshSuccess(body)) {
    throw new Error(
      `Remote news refresh failed: status=${response.status} body=${responseText}${getRemoteRefreshFailureHint(response.status)}`,
    );
  }

  return {
    body,
    operatorNextStep: getRemoteNewsOperatorNextStep(body),
    status: response.status,
  };
};
