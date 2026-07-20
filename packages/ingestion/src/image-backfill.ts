import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";

import {
  extractNewsImageUrl,
  isPublicNewsPageUrl,
  resolvePublicNewsUrl,
} from "./news-image";

export interface NewsImageBackfillCursor {
  id: string;
  publishedAt: Date;
}

export interface NewsImageBackfillTarget extends NewsImageBackfillCursor {
  pageUrl: string;
}

export interface NewsImageBackfillRepository {
  findMissingNewsImages(input: {
    cursor?: NewsImageBackfillCursor;
    limit: number;
  }): Promise<NewsImageBackfillTarget[]>;
  updateMissingNewsImage(input: {
    id: string;
    imageUrl: string;
  }): Promise<boolean>;
}

export interface FetchedNewsPage {
  html: string;
  pageUrl: string;
}

const defaultBackfillLimit = 100;
const maxBackfillLimit = 500;
const maxNewsPageBytes = 2 * 1024 * 1024;
const maxNewsPageRedirects = 3;

const getBackfillLimit = (batchSize: number) => {
  if (!Number.isFinite(batchSize)) return defaultBackfillLimit;
  return Math.min(Math.max(Math.trunc(batchSize), 1), maxBackfillLimit);
};

const readBoundedResponseText = async (response: IncomingMessage) => {
  const declaredLength = Number(response.headers["content-length"] ?? "0");
  if (declaredLength > maxNewsPageBytes) {
    response.destroy();
    throw new Error("News page exceeds the backfill size limit");
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const value of response as AsyncIterable<Uint8Array>) {
    totalBytes += value.length;
    if (totalBytes > maxNewsPageBytes) {
      response.destroy();
      throw new Error("News page exceeds the backfill size limit");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

const requestPinnedNewsPageAddress = (
  resolvedUrl: URL,
  selectedAddress: { address: string; family: 4 | 6 },
) => {
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    if (_options.all) {
      callback(null, [selectedAddress]);
      return;
    }
    callback(null, selectedAddress.address, selectedAddress.family);
  };
  const request =
    resolvedUrl.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<IncomingMessage>((resolve, reject) => {
    const clientRequest = request(
      resolvedUrl,
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "TheNewAITimes image backfill",
        },
        lookup: pinnedLookup,
        signal: AbortSignal.timeout(10_000),
      },
      resolve,
    );

    clientRequest.once("error", reject);
    clientRequest.end();
  });
};

const requestPinnedNewsPage = async (
  pageUrl: string,
): Promise<IncomingMessage> => {
  const resolved = await resolvePublicNewsUrl(pageUrl);
  if (!resolved) throw new Error("News page URL is not public");

  let lastError: unknown;

  for (const address of resolved.addresses) {
    try {
      return await requestPinnedNewsPageAddress(resolved.url, address);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("News page request could not connect");
};

export const fetchPublicNewsPage = async (
  initialPageUrl: string,
): Promise<FetchedNewsPage> => {
  let pageUrl = initialPageUrl;

  for (
    let redirectCount = 0;
    redirectCount <= maxNewsPageRedirects;
    redirectCount += 1
  ) {
    const response = await requestPinnedNewsPage(pageUrl);
    const status = response.statusCode ?? 0;

    if (redirectStatuses.has(status)) {
      const location = response.headers.location;
      response.resume();
      if (!location || redirectCount === maxNewsPageRedirects) {
        throw new Error("News page redirect limit exceeded");
      }

      pageUrl = new URL(location, pageUrl).toString();
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      throw new Error(`News page request failed: ${status}`);
    }

    const contentType = response.headers["content-type"]?.toLowerCase();
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      response.resume();
      throw new Error(`Unsupported news page content type: ${contentType}`);
    }

    return {
      html: await readBoundedResponseText(response),
      pageUrl,
    };
  }

  throw new Error("News page redirect limit exceeded");
};

export const backfillMissingNewsImages = async ({
  batchSize = defaultBackfillLimit,
  fetchPage = fetchPublicNewsPage,
  isSafeImageUrl = isPublicNewsPageUrl,
  isSafePageUrl = isPublicNewsPageUrl,
  repository,
}: {
  batchSize?: number;
  fetchPage?: (pageUrl: string) => Promise<FetchedNewsPage>;
  isSafeImageUrl?: (imageUrl: string) => Promise<boolean>;
  isSafePageUrl?: (pageUrl: string) => Promise<boolean>;
  repository: NewsImageBackfillRepository;
}) => {
  const limit = getBackfillLimit(batchSize);
  const failures: { id: string; message: string; pageUrl: string }[] = [];
  let cursor: NewsImageBackfillCursor | undefined;
  let seen = 0;
  let skipped = 0;
  let updated = 0;

  while (true) {
    const targets = await repository.findMissingNewsImages({
      cursor,
      limit,
    });
    if (targets.length === 0) break;

    for (const target of targets) {
      seen += 1;

      try {
        if (!(await isSafePageUrl(target.pageUrl))) {
          skipped += 1;
          continue;
        }

        const page = await fetchPage(target.pageUrl);
        const imageUrl = extractNewsImageUrl(page);

        if (!imageUrl || !(await isSafeImageUrl(imageUrl))) {
          skipped += 1;
          continue;
        }

        if (
          await repository.updateMissingNewsImage({
            id: target.id,
            imageUrl,
          })
        ) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failures.push({
          id: target.id,
          message: error instanceof Error ? error.message : String(error),
          pageUrl: target.pageUrl,
        });
      }
    }

    const lastTarget = targets.at(-1);
    if (!lastTarget || targets.length < limit) break;
    cursor = {
      id: lastTarget.id,
      publishedAt: lastTarget.publishedAt,
    };
  }

  return {
    failed: failures.length,
    failures,
    seen,
    skipped,
    updated,
  };
};
