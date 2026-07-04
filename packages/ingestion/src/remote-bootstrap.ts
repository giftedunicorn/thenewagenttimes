import type { RemoteEmbedFetch, RemoteNewsEmbedResult } from "./remote-embed";
import type {
  RemoteHealthFetch,
  RemoteNewsHealthResult,
} from "./remote-health";
import type {
  RemoteNewsRefreshResult,
  RemoteRefreshFetch,
} from "./remote-refresh";
import { getFirstNonBlankValue } from "./remote-config";
import {
  embedRemoteNewsItems,
  resolveRemoteNewsEmbedCommandInput,
} from "./remote-embed";
import {
  checkRemoteNewsHealth,
  RemoteNewsHealthNotReadyError,
} from "./remote-health";
import { refreshRemoteNewsEdition } from "./remote-refresh";

export interface RemoteNewsBootstrapResult {
  embed: RemoteNewsEmbedResult | null;
  embedBatches: RemoteNewsEmbedResult[];
  health: RemoteNewsHealthResult;
  refresh: RemoteNewsRefreshResult | null;
}

const getRemoteNewsBootstrapNotReadyMessage = (
  result: RemoteNewsBootstrapResult,
) => {
  const statusMessage = result.refresh
    ? `Remote news bootstrap finished but health is not ready: nextStep=${result.health.nextStep ?? "unknown"}`
    : `Remote news bootstrap blocked before refresh: nextStep=${result.health.nextStep ?? "unknown"}`;
  const [firstAction] = result.health.actionRequired;

  return firstAction
    ? `${statusMessage} actionRequired=${firstAction}`
    : statusMessage;
};

export class RemoteNewsBootstrapNotReadyError extends Error {
  constructor(readonly result: RemoteNewsBootstrapResult) {
    super(getRemoteNewsBootstrapNotReadyMessage(result));
    this.name = "RemoteNewsBootstrapNotReadyError";
  }
}

export interface BootstrapRemoteNewsEditionInput {
  bootstrapSecret: string | null | undefined;
  bootstrapUrl: string | null | undefined;
  embedLimit?: number;
  embedMaxBatches?: number;
  fetchEmbed?: RemoteEmbedFetch;
  fetchHealth?: RemoteHealthFetch;
  fetchRefresh?: RemoteRefreshFetch;
  railwayPublicDomain?: string | null;
}

export interface ResolveRemoteNewsBootstrapCommandInput {
  argv: readonly string[];
  env: Record<string, string | undefined>;
}

const isNumericCliArgument = (value: string | undefined) => {
  if (!value?.trim()) return false;

  return /^\d+$/.test(value.trim());
};

const parsePositiveInteger = (value: string | undefined) => {
  if (!isNumericCliArgument(value)) return undefined;

  const parsed = Number(value);

  return parsed > 0 ? parsed : undefined;
};

const bootstrapPrerequisiteNextSteps = new Set([
  "apply-database-schema",
  "configure-auth-secret",
  "configure-refresh-secret",
]);

const bootstrapRecoverableNextSteps = new Set([
  "configure-embedding-provider",
  "embed-news-stories",
  "inspect-ingestion-run",
  "run-news-refresh",
  "seed-news-sources",
]);

export const resolveRemoteNewsBootstrapCommandInput = ({
  argv,
  env,
}: ResolveRemoteNewsBootstrapCommandInput): Omit<
  BootstrapRemoteNewsEditionInput,
  "fetchEmbed" | "fetchHealth" | "fetchRefresh"
> => {
  const firstArg = argv[0]?.trim();
  const secondArg = argv[1]?.trim();
  const thirdArg = argv[2]?.trim();
  const firstArgIsLimit = isNumericCliArgument(firstArg);
  const embedLimit = firstArgIsLimit
    ? firstArg
    : (secondArg ?? env.NEWS_EMBED_LIMIT);
  const embedMaxBatches = firstArgIsLimit
    ? (secondArg ?? env.NEWS_BOOTSTRAP_EMBED_BATCHES)
    : (thirdArg ?? env.NEWS_BOOTSTRAP_EMBED_BATCHES);
  const resolvedEmbedInput = resolveRemoteNewsEmbedCommandInput({ argv, env });

  return {
    bootstrapSecret: env.NEWS_REFRESH_SECRET,
    bootstrapUrl: firstArgIsLimit
      ? getFirstNonBlankValue(
          env.NEWS_BOOTSTRAP_URL,
          env.NEWS_HEALTH_URL,
          env.NEWS_REFRESH_URL,
          env.NEWS_EMBED_URL,
        )
      : getFirstNonBlankValue(
          firstArg,
          env.NEWS_BOOTSTRAP_URL,
          env.NEWS_HEALTH_URL,
          env.NEWS_REFRESH_URL,
          env.NEWS_EMBED_URL,
        ),
    embedLimit: parsePositiveInteger(embedLimit),
    embedMaxBatches: parsePositiveInteger(embedMaxBatches),
    railwayPublicDomain: resolvedEmbedInput.railwayPublicDomain,
  };
};

export const bootstrapRemoteNewsEdition = async ({
  bootstrapSecret,
  bootstrapUrl,
  embedLimit,
  embedMaxBatches,
  fetchEmbed,
  fetchHealth,
  fetchRefresh,
  railwayPublicDomain,
}: BootstrapRemoteNewsEditionInput): Promise<RemoteNewsBootstrapResult> => {
  let initialNextStep: string | null = null;

  try {
    await checkRemoteNewsHealth({
      fetchHealth,
      healthUrl: bootstrapUrl,
      railwayPublicDomain,
    });
  } catch (error) {
    if (
      error instanceof RemoteNewsHealthNotReadyError &&
      (!error.result.nextStep ||
        bootstrapPrerequisiteNextSteps.has(error.result.nextStep) ||
        !bootstrapRecoverableNextSteps.has(error.result.nextStep))
    ) {
      throw new RemoteNewsBootstrapNotReadyError({
        embed: null,
        embedBatches: [],
        health: error.result,
        refresh: null,
      });
    }

    if (!(error instanceof RemoteNewsHealthNotReadyError)) {
      throw error;
    }

    initialNextStep = error.result.nextStep;
  }

  const refresh = await refreshRemoteNewsEdition({
    fetchRefresh,
    railwayPublicDomain,
    refreshSecret: bootstrapSecret,
    refreshUrl: bootstrapUrl,
  });
  const embedBatches: RemoteNewsEmbedResult[] = [];

  const runEmbedBatch = async () => {
    const embed = await embedRemoteNewsItems({
      embedSecret: bootstrapSecret,
      embedUrl: bootstrapUrl,
      fetchEmbed,
      limit: embedLimit,
      railwayPublicDomain,
    });

    embedBatches.push(embed);

    return embed;
  };

  const maxEmbedBatches = Math.max(1, Math.floor(embedMaxBatches ?? 1));

  if (initialNextStep === "configure-embedding-provider") {
    try {
      const health = await checkRemoteNewsHealth({
        fetchHealth,
        healthUrl: bootstrapUrl,
        railwayPublicDomain,
      });

      return { embed: null, embedBatches, health, refresh };
    } catch (error) {
      if (!(error instanceof RemoteNewsHealthNotReadyError)) {
        throw error;
      }

      throw new RemoteNewsBootstrapNotReadyError({
        embed: null,
        embedBatches,
        health: error.result,
        refresh,
      });
    }
  }

  let embed = await runEmbedBatch();

  try {
    const health = await checkRemoteNewsHealth({
      fetchHealth,
      healthUrl: bootstrapUrl,
      railwayPublicDomain,
    });

    return { embed, embedBatches, health, refresh };
  } catch (error) {
    if (!(error instanceof RemoteNewsHealthNotReadyError)) {
      throw error;
    }

    let health = error.result;

    while (
      health.nextStep === "embed-news-stories" &&
      embedBatches.length < maxEmbedBatches
    ) {
      embed = await runEmbedBatch();

      try {
        health = await checkRemoteNewsHealth({
          fetchHealth,
          healthUrl: bootstrapUrl,
          railwayPublicDomain,
        });

        return { embed, embedBatches, health, refresh };
      } catch (nextError) {
        if (!(nextError instanceof RemoteNewsHealthNotReadyError)) {
          throw nextError;
        }

        health = nextError.result;
      }
    }

    throw new RemoteNewsBootstrapNotReadyError({
      embed,
      embedBatches,
      health,
      refresh,
    });
  }
};
