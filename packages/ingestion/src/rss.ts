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

export const parseFeedXml = (xml: string): RawFeedItem[] => {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };

  const rssItems = asArray(parsed.rss?.channel?.item).map((item) => {
    const record = item as Record<string, unknown>;
    return {
      title: textValue(record.title) ?? "",
      url: textValue(record.link) ?? "",
      id: textValue(record.guid),
      summary: textValue(record.description),
      bodyText: textValue(record["content:encoded"]),
      publishedAt: parseDate(record.pubDate),
      authorName: authorName(record.author),
      imageUrl: imageFromEnclosure(record.enclosure),
    };
  });

  const atomItems = asArray(parsed.feed?.entry).map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      title: textValue(record.title) ?? "",
      url: atomLink(record.link) ?? "",
      id: textValue(record.id),
      summary: textValue(record.summary) ?? textValue(record.content),
      bodyText: textValue(record.content),
      publishedAt: parseDate(record.published) ?? parseDate(record.updated),
      authorName: authorName(record.author),
      imageUrl: undefined,
    };
  });

  return [...rssItems, ...atomItems].filter(
    (item) => item.title.length > 0 && item.url.length > 0,
  );
};
