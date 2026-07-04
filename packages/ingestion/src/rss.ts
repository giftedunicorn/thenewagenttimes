import { XMLParser } from "fast-xml-parser";

import type { RawFeedItem } from "./types";

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const textValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    const nested = (value as { "#text"?: unknown })["#text"];
    return textValue(nested);
  }
  return undefined;
};

const parseDate = (value: unknown): Date | undefined => {
  const text = textValue(value);
  if (!text) return undefined;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const atomLink = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const links = value as unknown[];
    const alternate =
      links.find(
        (link) =>
          link &&
          typeof link === "object" &&
          (!("rel" in link) || (link as { rel?: unknown }).rel === "alternate"),
      ) ?? links[0];
    return atomLink(alternate);
  }
  if (value && typeof value === "object" && "href" in value) {
    return textValue((value as { href?: unknown }).href);
  }
  return undefined;
};

const imageFromEnclosure = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value.map(imageFromEnclosure).find(Boolean);
  }
  if (value && typeof value === "object") {
    const enclosure = value as { type?: unknown; url?: unknown };
    const type = textValue(enclosure.type);
    if (!type?.startsWith("image/")) return undefined;
    return textValue(enclosure.url);
  }
  return undefined;
};

const imageUrlExtensionPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;

type UntypedMediaMode = "any" | "image-url";

const acceptsUntypedMediaUrl = (url: string, mode: UntypedMediaMode) =>
  mode === "any" || imageUrlExtensionPattern.test(url);

const imageFromMediaValue = (
  value: unknown,
  untypedMediaMode: UntypedMediaMode,
): string | undefined => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => imageFromMediaValue(entry, untypedMediaMode))
      .find(Boolean);
  }
  if (value && typeof value === "object") {
    const media = value as { medium?: unknown; type?: unknown; url?: unknown };
    const medium = textValue(media.medium);
    const type = textValue(media.type);
    const url = textValue(media.url);

    if (
      url &&
      (medium === "image" ||
        type?.startsWith("image/") ||
        (!medium && !type && acceptsUntypedMediaUrl(url, untypedMediaMode)))
    ) {
      return url;
    }
  }
  return undefined;
};

const imageFromMediaFields = (record: Record<string, unknown>) =>
  imageFromMediaValue(record["media:thumbnail"], "any") ??
  imageFromMediaValue(record["media:content"], "image-url");

const imageFromAtomLinks = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value.map(imageFromAtomLinks).find(Boolean);
  }
  if (value && typeof value === "object") {
    const link = value as { href?: unknown; rel?: unknown; type?: unknown };
    const rel = textValue(link.rel);
    const type = textValue(link.type);

    if (rel === "enclosure" && type?.startsWith("image/")) {
      return textValue(link.href);
    }
  }
  return undefined;
};

const decodeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const imageFromHtml = (html: string | undefined): string | undefined => {
  if (!html) return undefined;

  const imageMatch = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i.exec(html);
  const imageUrl = imageMatch?.[2]?.trim();

  return imageUrl ? decodeHtmlAttribute(imageUrl) : undefined;
};

const authorName = (value: unknown): string | undefined => {
  const raw = textValue(value);
  if (raw?.includes("(") && raw.includes(")")) {
    return raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")")).trim();
  }
  if (raw) return raw;
  if (value && typeof value === "object" && "name" in value) {
    return textValue((value as { name?: unknown }).name);
  }
  return undefined;
};

const uniqueTexts = (values: readonly (string | undefined)[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

const rssCategories = (value: unknown): string[] =>
  uniqueTexts(asArray(value).map(textValue));

const atomCategory = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const category = value as { label?: unknown; term?: unknown };

    return textValue(category.label) ?? textValue(category.term);
  }
  return undefined;
};

const atomCategories = (value: unknown): string[] =>
  uniqueTexts(asArray(value).map(atomCategory));

export const parseFeedXml = (xml: string): RawFeedItem[] => {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };

  const rssItems = asArray(parsed.rss?.channel?.item).map((item) => {
    const record = item as Record<string, unknown>;
    const summary = textValue(record.description);
    const bodyText = textValue(record["content:encoded"]);

    return {
      title: textValue(record.title) ?? "",
      url: textValue(record.link) ?? "",
      id: textValue(record.guid),
      summary,
      bodyText,
      categories: rssCategories(record.category),
      publishedAt: parseDate(record.pubDate),
      authorName: authorName(record.author) ?? authorName(record["dc:creator"]),
      imageUrl:
        imageFromEnclosure(record.enclosure) ??
        imageFromMediaFields(record) ??
        imageFromHtml(summary) ??
        imageFromHtml(bodyText),
    };
  });

  const atomItems = asArray(parsed.feed?.entry).map((entry) => {
    const record = entry as Record<string, unknown>;
    const summary = textValue(record.summary) ?? textValue(record.content);
    const bodyText = textValue(record.content);

    return {
      title: textValue(record.title) ?? "",
      url: atomLink(record.link) ?? "",
      id: textValue(record.id),
      summary,
      bodyText,
      categories: atomCategories(record.category),
      publishedAt: parseDate(record.published) ?? parseDate(record.updated),
      authorName: authorName(record.author),
      imageUrl:
        imageFromAtomLinks(record.link) ??
        imageFromMediaFields(record) ??
        imageFromHtml(summary) ??
        imageFromHtml(bodyText),
    };
  });

  return [...rssItems, ...atomItems].filter(
    (item) => item.title.length > 0 && item.url.length > 0,
  );
};
