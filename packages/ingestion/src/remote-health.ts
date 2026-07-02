interface RemoteHealthHttpInit {
  method: "GET";
}

interface RemoteHealthHttpResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type RemoteHealthFetch = (
  url: string,
  init: RemoteHealthHttpInit,
) => Promise<RemoteHealthHttpResponse>;

export interface RemoteNewsHealthResult {
  body: unknown;
  nextStep: string | null;
  ready: boolean | null;
  status: number;
}

export interface CheckRemoteNewsHealthInput {
  fetchHealth?: RemoteHealthFetch;
  healthUrl: string | null | undefined;
  railwayPublicDomain?: string | null;
}

const resolveRailwayPublicUrl = (
  railwayPublicDomain: string | null | undefined,
) => {
  const trimmedDomain = railwayPublicDomain?.trim();

  if (!trimmedDomain) return "";
  if (/^https?:\/\//i.test(trimmedDomain)) return trimmedDomain;

  return `https://${trimmedDomain}`;
};

export const resolveRemoteNewsHealthUrl = (
  healthUrl: string | null | undefined,
  railwayPublicDomain?: string | null,
) => {
  const trimmedHealthUrl = healthUrl?.trim() ?? "";
  const trimmedUrl =
    trimmedHealthUrl.length > 0
      ? trimmedHealthUrl
      : resolveRailwayPublicUrl(railwayPublicDomain);

  if (!trimmedUrl) {
    throw new Error(
      "NEWS_HEALTH_URL, NEWS_REFRESH_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  }

  const url = new URL(trimmedUrl);

  if (url.pathname.endsWith("/api/news/refresh")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/refresh$/,
      "/api/news/health",
    );
  } else if (!url.pathname.endsWith("/api/news/health")) {
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/api/news/health`;
  }

  url.hash = "";

  return url.toString();
};

const parseRemoteNewsHealthBody = (text: string): unknown => {
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getRemoteNewsHealthReady = (body: unknown) =>
  isRecord(body) && typeof body.ready === "boolean" ? body.ready : null;

const getRemoteNewsHealthNextStep = (body: unknown) =>
  isRecord(body) && typeof body.nextStep === "string" ? body.nextStep : null;

const defaultFetchHealth: RemoteHealthFetch = (url, init) => fetch(url, init);

export const checkRemoteNewsHealth = async ({
  fetchHealth = defaultFetchHealth,
  healthUrl,
  railwayPublicDomain,
}: CheckRemoteNewsHealthInput): Promise<RemoteNewsHealthResult> => {
  const endpoint = resolveRemoteNewsHealthUrl(healthUrl, railwayPublicDomain);
  const response = await fetchHealth(endpoint, { method: "GET" });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Remote news health check failed: status=${response.status} body=${responseText}`,
    );
  }

  const body = parseRemoteNewsHealthBody(responseText);

  return {
    body,
    nextStep: getRemoteNewsHealthNextStep(body),
    ready: getRemoteNewsHealthReady(body),
    status: response.status,
  };
};
