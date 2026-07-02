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
  status: number;
}

export interface RefreshRemoteNewsEditionInput {
  fetchRefresh?: RemoteRefreshFetch;
  railwayPublicDomain?: string | null;
  refreshSecret: string | null | undefined;
  refreshUrl: string | null | undefined;
}

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
    throw new Error("NEWS_REFRESH_URL or RAILWAY_PUBLIC_DOMAIN is required");
  }

  const url = new URL(trimmedUrl);

  if (!url.pathname.endsWith("/api/news/refresh")) {
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

const defaultFetchRefresh: RemoteRefreshFetch = (url, init) => fetch(url, init);

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

  if (!response.ok) {
    throw new Error(
      `Remote news refresh failed: status=${response.status} body=${responseText}`,
    );
  }

  return {
    body: parseRemoteNewsRefreshBody(responseText),
    status: response.status,
  };
};
