import { z } from "zod/v4";

import type { ManualNewsInput } from "./types";

const ycAiCompaniesPageUrl =
  "https://www.ycombinator.com/companies?industry=Artificial%20Intelligence";
const ycAlgoliaLaunchDateIndex = "YCCompany_By_Launch_Date_production";
const defaultYcAiCompaniesLimit = 25;
const maxYcAiCompaniesLimit = 100;

const ycAiCompanyAttributes = [
  "name",
  "slug",
  "website",
  "all_locations",
  "long_description",
  "one_liner",
  "team_size",
  "launched_at",
  "tags",
  "batch",
  "industries",
  "objectID",
] as const;

const ycAiTagFacetFilters = [
  [
    "tags:Artificial Intelligence",
    "tags:AI",
    "tags:Machine Learning",
    "tags:Generative AI",
  ],
] as const;

const YcAlgoliaOptsSchema = z
  .object({
    app: z.string().min(1),
    key: z.string().min(1),
  })
  .passthrough();

const YcCompanyHitSchema = z
  .object({
    all_locations: z.string().nullable().optional(),
    batch: z.string().nullable().optional(),
    industries: z.array(z.string()).optional().default([]),
    launched_at: z.number().int().positive(),
    long_description: z.string().nullable().optional(),
    name: z.string().min(1),
    objectID: z.string().min(1),
    one_liner: z.string().nullable().optional(),
    slug: z.string().min(1),
    tags: z.array(z.string()).optional().default([]),
    team_size: z.number().int().nonnegative().nullable().optional(),
    website: z.string().nullable().optional(),
  })
  .passthrough();

const YcCompanySearchResponseSchema = z
  .object({
    hits: z.array(YcCompanyHitSchema),
  })
  .passthrough();

export interface YcAlgoliaConfig {
  apiKey: string;
  appId: string;
}

export interface YcAiCompaniesSearchRequest {
  body: {
    attributesToRetrieve: string[];
    facetFilters: string[][];
    hitsPerPage: number;
    query: string;
  };
  headers: Record<string, string>;
  url: string;
}

export interface YcAiCompany {
  batch: string;
  description: string;
  id: string;
  industries: string[];
  launchedAt: Date;
  location: string | null;
  name: string;
  oneLiner: string;
  profileUrl: string;
  slug: string;
  tags: string[];
  teamSize: number | null;
  websiteUrl: string | null;
}

export type YcAiFetchText = (url: string) => Promise<string>;
export type YcAiPostJson = (
  request: YcAiCompaniesSearchRequest,
) => Promise<unknown>;

const clampYcLimit = (limit: number) =>
  Math.min(Math.max(Math.trunc(limit), 1), maxYcAiCompaniesLimit);

const trimOrNull = (value: string | null | undefined) => {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const parseWebsiteUrl = (value: string | null | undefined) => {
  const trimmed = trimOrNull(value);

  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isNonBlankString = (value: string | undefined): value is string =>
  Boolean(value?.trim());

const stripTrailingPeriod = (value: string) => value.replace(/\.+$/, "");

export const parseYcAlgoliaConfigFromHtml = (html: string): YcAlgoliaConfig => {
  const match = /window\.AlgoliaOpts\s*=\s*(\{[^;\n]+})/.exec(html);

  if (!match?.[1]) {
    throw new Error("YC Algolia config not found");
  }

  const payload: unknown = JSON.parse(match[1]);
  const parsed = YcAlgoliaOptsSchema.parse(payload);

  return {
    apiKey: parsed.key,
    appId: parsed.app,
  };
};

export const buildYcAiCompaniesSearchRequest = ({
  config,
  limit = defaultYcAiCompaniesLimit,
}: {
  config: YcAlgoliaConfig;
  limit?: number;
}): YcAiCompaniesSearchRequest => ({
  body: {
    attributesToRetrieve: [...ycAiCompanyAttributes],
    facetFilters: ycAiTagFacetFilters.map((filters) => [...filters]),
    hitsPerPage: clampYcLimit(limit),
    query: "",
  },
  headers: {
    "content-type": "application/json",
    "x-algolia-api-key": config.apiKey,
    "x-algolia-application-id": config.appId,
  },
  url: `https://${config.appId}-dsn.algolia.net/1/indexes/${ycAlgoliaLaunchDateIndex}/query`,
});

export const parseYcAiCompanies = (payload: unknown): YcAiCompany[] => {
  const parsed = YcCompanySearchResponseSchema.parse(payload);

  return parsed.hits.map((hit) => {
    const oneLiner = trimOrNull(hit.one_liner) ?? "AI startup";
    const description = trimOrNull(hit.long_description) ?? oneLiner;
    const batch = trimOrNull(hit.batch) ?? "YC";
    const slug = hit.slug.trim();

    return {
      batch,
      description,
      id: hit.objectID,
      industries: hit.industries,
      launchedAt: new Date(hit.launched_at * 1000),
      location: trimOrNull(hit.all_locations),
      name: hit.name.trim(),
      oneLiner,
      profileUrl: `https://www.ycombinator.com/companies/${slug}`,
      slug,
      tags: hit.tags,
      teamSize: hit.team_size ?? null,
      websiteUrl: parseWebsiteUrl(hit.website),
    };
  });
};

const defaultFetchText: YcAiFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "the-new-agent-times-ingestion",
    },
  });

  if (!response.ok) {
    throw new Error(`YC companies page request failed: ${response.status}`);
  }

  return response.text();
};

const defaultPostJson: YcAiPostJson = async (request) => {
  const response = await fetch(request.url, {
    body: JSON.stringify(request.body),
    headers: request.headers,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`YC Algolia search failed: ${response.status}`);
  }

  return response.json();
};

export const fetchYcAiCompanies = async ({
  fetchText = defaultFetchText,
  limit,
  postJson = defaultPostJson,
}: {
  fetchText?: YcAiFetchText;
  limit?: number;
  postJson?: YcAiPostJson;
} = {}) => {
  const config = parseYcAlgoliaConfigFromHtml(
    await fetchText(ycAiCompaniesPageUrl),
  );
  const request = buildYcAiCompaniesSearchRequest({ config, limit });

  return parseYcAiCompanies(await postJson(request));
};

const buildYcAiCompanyBodyText = (company: YcAiCompany) =>
  [
    `YC company: ${company.name}`,
    `Batch: ${company.batch}`,
    `One-liner: ${company.oneLiner}`,
    `Description: ${company.description}`,
    company.location ? `Location: ${company.location}` : "",
    company.teamSize !== null ? `Team size: ${company.teamSize}` : "",
    company.tags.length > 0 ? `Tags: ${company.tags.join(", ")}` : "",
    company.industries.length > 0
      ? `Industries: ${company.industries.join(", ")}`
      : "",
    company.websiteUrl ? `Website: ${company.websiteUrl}` : "",
    `YC profile: ${company.profileUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

export const toYcAiManualNewsInput = ({
  company,
  sourceId,
  sourceSlug,
}: {
  company: YcAiCompany;
  sourceId: string;
  sourceSlug: string;
}): ManualNewsInput => ({
  bodyText: buildYcAiCompanyBodyText(company),
  entities: ["YC", "Y Combinator"],
  publishedAt: company.launchedAt,
  sourceId,
  sourceSlug,
  summary: `${company.name} is a ${company.batch} YC AI company: ${stripTrailingPeriod(
    company.oneLiner,
  )}.`,
  tags: [
    "yc",
    "yc_company",
    "ai_startup",
    ...company.tags.map(normalizeTag),
    ...company.industries.map(normalizeTag),
    normalizeTag(company.batch),
  ].filter(isNonBlankString),
  title: `${company.name} launched from YC as an AI company`,
  url: company.profileUrl,
});
