import { XMLParser } from "fast-xml-parser";

import type { ManualNewsInput } from "./types";

const defaultArxivAiCategories = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "stat.ML",
] as const;
const defaultArxivAiLimit = 25;
const maxArxivAiLimit = 100;

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export interface ArxivAiPaper {
  abstractUrl: string;
  authors: readonly string[];
  categories: readonly string[];
  comment: string | null;
  id: string;
  pdfUrl: string;
  primaryCategory: string;
  publishedAt: string;
  summary: string;
  title: string;
  updatedAt: string;
}

export type ArxivAiFetchText = (url: string) => Promise<string>;

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const textValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (isRecord(value) && "#text" in value) {
    return textValue(value["#text"]);
  }

  return undefined;
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const clampLimit = (limit: number) =>
  Math.min(Math.max(Math.trunc(limit), 1), maxArxivAiLimit);

const normalizeStart = (start: number) => Math.max(Math.trunc(start), 0);

const normalizeArxivUrl = (url: string) =>
  url.replace(/^http:\/\/arxiv\.org\//, "https://arxiv.org/");

const getArxivPaperId = (abstractUrl: string) => {
  try {
    const url = new URL(abstractUrl);
    const match = /^\/abs\/(.+)$/.exec(url.pathname);

    return match?.[1] ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return abstractUrl.split("/").filter(Boolean).at(-1) ?? abstractUrl;
  }
};

const arxivCategoryTerm = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim();
  if (isRecord(value)) return textValue(value.term);

  return undefined;
};

const arxivCategories = (value: unknown): string[] =>
  Array.from(
    new Set(
      asArray(value)
        .map(arxivCategoryTerm)
        .filter((category): category is string => Boolean(category)),
    ),
  );

const authorName = (value: unknown): string | undefined => {
  if (isRecord(value)) return textValue(value.name);

  return textValue(value);
};

const authorNames = (value: unknown): string[] =>
  asArray(value)
    .map(authorName)
    .filter((author): author is string => Boolean(author));

const arxivPdfLink = (value: unknown): string | undefined => {
  const links = asArray(value);
  const pdfLink = links.find(
    (link) =>
      isRecord(link) &&
      (textValue(link.title)?.toLowerCase() === "pdf" ||
        textValue(link.type) === "application/pdf"),
  );

  return isRecord(pdfLink) ? textValue(pdfLink.href) : undefined;
};

export const buildArxivAiSearchUrl = ({
  categories = defaultArxivAiCategories,
  limit = defaultArxivAiLimit,
  start = 0,
}: {
  categories?: readonly string[];
  limit?: number;
  start?: number;
} = {}) => {
  const url = new URL("https://export.arxiv.org/api/query");
  const query = `(${categories.map((category) => `cat:${category}`).join(" OR ")})`;

  url.searchParams.set("search_query", query);
  url.searchParams.set("start", String(normalizeStart(start)));
  url.searchParams.set("max_results", String(clampLimit(limit)));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  return url.toString();
};

export const parseArxivAiPapers = (xml: string): ArxivAiPaper[] => {
  const parsed = parser.parse(xml) as { feed?: { entry?: unknown } };

  return asArray(parsed.feed?.entry)
    .map((entry): ArxivAiPaper | null => {
      if (!isRecord(entry)) return null;

      const abstractUrl = textValue(entry.id);
      const title = textValue(entry.title);
      const summary = textValue(entry.summary);
      const publishedAt = textValue(entry.published);
      const updatedAt = textValue(entry.updated) ?? publishedAt;

      if (!abstractUrl || !title || !summary || !publishedAt || !updatedAt) {
        return null;
      }

      const normalizedAbstractUrl = normalizeArxivUrl(abstractUrl);
      const id = getArxivPaperId(normalizedAbstractUrl);
      const categories = arxivCategories(entry.category);
      const primaryCategory =
        arxivCategoryTerm(entry["arxiv:primary_category"]) ??
        categories[0] ??
        "cs.AI";
      const pdfUrl = arxivPdfLink(entry.link) ?? `https://arxiv.org/pdf/${id}`;

      return {
        abstractUrl: normalizedAbstractUrl,
        authors: authorNames(entry.author),
        categories,
        comment: textValue(entry["arxiv:comment"]) ?? null,
        id,
        pdfUrl: normalizeArxivUrl(pdfUrl),
        primaryCategory,
        publishedAt,
        summary: normalizeWhitespace(summary),
        title: normalizeWhitespace(title),
        updatedAt,
      };
    })
    .filter((paper): paper is ArxivAiPaper => paper !== null);
};

const defaultFetchText: ArxivAiFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "the-new-agent-times-ingestion",
    },
  });

  if (!response.ok) {
    throw new Error(`arXiv API request failed: ${response.status}`);
  }

  return response.text();
};

export const fetchArxivAiPapers = async ({
  fetchText = defaultFetchText,
  limit,
  start,
}: {
  fetchText?: ArxivAiFetchText;
  limit?: number;
  start?: number;
} = {}) =>
  parseArxivAiPapers(await fetchText(buildArxivAiSearchUrl({ limit, start })));

const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const formatAuthorName = (authors: readonly string[]) => {
  const leadingAuthors = authors.slice(0, 3).join(", ");
  const remainingCount = Math.max(authors.length - 3, 0);
  const suffix = remainingCount > 0 ? `, and ${remainingCount} more` : "";

  return `${leadingAuthors}${suffix}`.slice(0, 160);
};

const formatAuthorSentence = (authors: readonly string[]) => {
  if (authors.length === 0) return "researchers";
  if (authors.length === 1) return authors[0] ?? "researchers";
  if (authors.length === 2) {
    return `${authors[0]} and ${authors[1]}`;
  }

  const leadingAuthors = authors.slice(0, 3);
  const suffix = authors.length > 3 ? `, and ${authors.length - 3} more` : "";

  return `${leadingAuthors.slice(0, -1).join(", ")}, and ${
    leadingAuthors.at(-1) ?? "researchers"
  }${suffix}`;
};

const buildArxivPaperBodyText = (paper: ArxivAiPaper) =>
  [
    `arXiv ID: ${paper.id}`,
    `Title: ${paper.title}`,
    paper.authors.length > 0 ? `Authors: ${paper.authors.join(", ")}` : "",
    `Primary category: ${paper.primaryCategory}`,
    paper.categories.length > 0
      ? `Categories: ${paper.categories.join(", ")}`
      : "",
    paper.comment ? `Comment: ${paper.comment}` : "",
    `Published: ${paper.publishedAt}`,
    `Updated: ${paper.updatedAt}`,
    `Abstract: ${paper.summary}`,
    `PDF: ${paper.pdfUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

export const toArxivAiManualNewsInput = ({
  paper,
  sourceId,
  sourceSlug,
}: {
  paper: ArxivAiPaper;
  sourceId: string;
  sourceSlug: string;
}): ManualNewsInput => {
  const publishedAt = new Date(paper.publishedAt);

  if (!Number.isFinite(publishedAt.getTime())) {
    throw new Error(`Invalid arXiv published timestamp: ${paper.publishedAt}`);
  }

  return {
    authorName:
      paper.authors.length > 0 ? formatAuthorName(paper.authors) : undefined,
    bodyText: buildArxivPaperBodyText(paper),
    entities: ["arXiv"],
    publishedAt,
    sourceId,
    sourceSlug,
    summary: `A new arXiv AI paper by ${formatAuthorSentence(
      paper.authors,
    )} studies ${paper.title}.`,
    tags: ["arxiv", "research_paper", ...paper.categories.map(normalizeTag)],
    title: `arXiv paper: ${paper.title}`,
    url: paper.abstractUrl,
  };
};
