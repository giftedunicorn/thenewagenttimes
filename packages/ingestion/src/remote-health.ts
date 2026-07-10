import type { RemoteNewsOperatorNextStep } from "./remote-operator-next-step";
import { getFirstNonBlankValue } from "./remote-config";
import { getRemoteNewsOperatorNextStep } from "./remote-operator-next-step";

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

export interface RemoteNewsHomepageHealth {
  liveStories?: number;
  mode?: string;
  path?: string;
  previewStories?: number;
  servingNewsExperience?: boolean;
  title?: string;
}

export interface RemoteNewsHealthResult {
  actionRequired: string[];
  body: unknown;
  commands: Record<string, string | null>;
  homepage: RemoteNewsHomepageHealth | null;
  liveReady: boolean | null;
  nextCommand: string | null;
  nextStep: string | null;
  operatorNextStep?: RemoteNewsOperatorNextStep;
  ready: boolean | null;
  semanticReady: boolean | null;
  status: number;
}

export class RemoteNewsHealthNotReadyError extends Error {
  constructor(readonly result: RemoteNewsHealthResult) {
    super(
      `Remote news health is not ready: nextStep=${result.nextStep ?? "unknown"}`,
    );
    this.name = "RemoteNewsHealthNotReadyError";
  }
}

export const formatRemoteNewsHealthSummary = ({
  liveReady,
  nextCommand,
  nextStep,
  operatorNextStep,
  ready,
  semanticReady,
  status,
}: RemoteNewsHealthResult) =>
  `Remote news health: status=${status} ready=${String(ready)} liveReady=${String(liveReady)} semanticReady=${String(semanticReady)} nextStep=${nextStep ?? "unknown"} nextCommand=${nextCommand ?? "none"}${
    operatorNextStep
      ? ` operatorNextStep="${operatorNextStep.label}" operatorDetail="${operatorNextStep.detail}"`
      : ""
  }`;

export interface CheckRemoteNewsHealthInput {
  fetchHealth?: RemoteHealthFetch;
  healthUrl: string | null | undefined;
  railwayPublicDomain?: string | null;
}

export interface ResolveRemoteNewsHealthCommandInput {
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

export const resolveRemoteNewsHealthCommandInput = ({
  argv,
  env,
}: ResolveRemoteNewsHealthCommandInput): Omit<
  CheckRemoteNewsHealthInput,
  "fetchHealth"
> => ({
  healthUrl: getFirstNonBlankValue(
    argv[0],
    env.NEWS_HEALTH_URL,
    env.NEWS_REFRESH_URL,
    env.NEWS_EMBED_URL,
    env.NEWS_BOOTSTRAP_URL,
  ),
  railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN,
});

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
      "NEWS_HEALTH_URL, NEWS_REFRESH_URL, NEWS_EMBED_URL, NEWS_BOOTSTRAP_URL, or RAILWAY_PUBLIC_DOMAIN is required",
    );
  }

  const url = new URL(trimmedUrl);

  if (url.pathname.endsWith("/api/news/refresh")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/refresh$/,
      "/api/news/health",
    );
  } else if (url.pathname.endsWith("/api/news/embed")) {
    url.pathname = url.pathname.replace(
      /\/api\/news\/embed$/,
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

const getRemoteNewsHealthNewsReadiness = (
  body: unknown,
  field: "liveReady" | "semanticReady",
) => {
  if (!isRecord(body) || !isRecord(body.news)) return null;

  return typeof body.news[field] === "boolean" ? body.news[field] : null;
};

const getRemoteNewsHomepageHealth = (
  body: unknown,
): RemoteNewsHomepageHealth | null => {
  if (!isRecord(body) || !isRecord(body.homepage)) return null;

  const homepage: RemoteNewsHomepageHealth = {};

  if (typeof body.homepage.liveStories === "number") {
    homepage.liveStories = body.homepage.liveStories;
  }

  if (typeof body.homepage.mode === "string") {
    homepage.mode = body.homepage.mode;
  }

  if (typeof body.homepage.path === "string") {
    homepage.path = body.homepage.path;
  }

  if (typeof body.homepage.previewStories === "number") {
    homepage.previewStories = body.homepage.previewStories;
  }

  if (typeof body.homepage.servingNewsExperience === "boolean") {
    homepage.servingNewsExperience = body.homepage.servingNewsExperience;
  }

  if (typeof body.homepage.title === "string") {
    homepage.title = body.homepage.title;
  }

  return homepage;
};

const isRemoteNewsHomepageReady = (
  homepage: RemoteNewsHomepageHealth | null,
) => {
  const liveStories = homepage?.liveStories ?? 0;
  const previewStories = homepage?.previewStories ?? 0;

  return (
    homepage?.path === "/" &&
    homepage.servingNewsExperience === true &&
    homepage.title === "The New AI Times" &&
    liveStories + previewStories > 0
  );
};

const getRemoteNewsHealthNextStep = (body: unknown) =>
  isRecord(body) && typeof body.nextStep === "string" ? body.nextStep : null;

const getRemoteNewsHealthActions = (body: unknown) =>
  isRecord(body) && Array.isArray(body.actionRequired)
    ? body.actionRequired.filter(
        (action): action is string => typeof action === "string",
      )
    : [];

const getRemoteNewsHealthCommands = (body: unknown) => {
  if (!isRecord(body) || !isRecord(body.commands)) return {};

  return Object.fromEntries(
    Object.entries(body.commands).filter(
      (entry): entry is [string, string | null] =>
        typeof entry[1] === "string" || entry[1] === null,
    ),
  );
};

const assertRemoteNewsHealthReady = (result: RemoteNewsHealthResult) => {
  if (result.ready === true && isRemoteNewsHomepageReady(result.homepage)) {
    return;
  }

  if (result.ready === true) {
    throw new RemoteNewsHealthNotReadyError({
      ...result,
      nextStep: "homepage-mismatch",
    });
  }

  throw new RemoteNewsHealthNotReadyError(result);
};

const defaultFetchHealth: RemoteHealthFetch = (url, init) => fetch(url, init);

export const checkRemoteNewsHealth = async ({
  fetchHealth = defaultFetchHealth,
  healthUrl,
  railwayPublicDomain,
}: CheckRemoteNewsHealthInput): Promise<RemoteNewsHealthResult> => {
  const endpoint = resolveRemoteNewsHealthUrl(healthUrl, railwayPublicDomain);
  const response = await fetchHealth(endpoint, { method: "GET" });
  const responseText = await response.text();
  const body = parseRemoteNewsHealthBody(responseText);

  if (!response.ok) {
    throw new RemoteNewsHealthNotReadyError({
      actionRequired: [
        `Remote health endpoint returned ${response.status}. Verify the Railway service is deploying this repo root, branch, and Next.js start command.`,
      ],
      body,
      commands: {},
      homepage: null,
      liveReady: null,
      nextCommand: null,
      nextStep: "health-endpoint-unavailable",
      operatorNextStep: {
        command: null,
        detail:
          "Verify the Railway service is deploying this repo root, branch, and Next.js start command.",
        label: "Check Railway service routing",
        step: "health-endpoint-unavailable",
      },
      ready: null,
      semanticReady: null,
      status: response.status,
    });
  }

  const commands = getRemoteNewsHealthCommands(body);
  const homepage = getRemoteNewsHomepageHealth(body);
  const result: RemoteNewsHealthResult = {
    actionRequired: getRemoteNewsHealthActions(body),
    body,
    commands,
    homepage,
    liveReady: getRemoteNewsHealthNewsReadiness(body, "liveReady"),
    nextCommand:
      typeof commands.next === "string" || commands.next === null
        ? commands.next
        : null,
    nextStep: getRemoteNewsHealthNextStep(body),
    operatorNextStep: getRemoteNewsOperatorNextStep(body),
    ready: getRemoteNewsHealthReady(body),
    semanticReady: getRemoteNewsHealthNewsReadiness(body, "semanticReady"),
    status: response.status,
  };

  assertRemoteNewsHealthReady(result);

  return result;
};
