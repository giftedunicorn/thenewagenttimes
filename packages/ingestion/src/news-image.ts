import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type NewsHostResolver = (hostname: string) => Promise<readonly string[]>;

export interface ResolvedPublicNewsUrl {
  addresses: { address: string; family: 4 | 6 }[];
  url: URL;
}

const defaultNewsHostResolver: NewsHostResolver = async (hostname) =>
  (
    await lookup(hostname, {
      all: true,
      verbatim: true,
    })
  ).map((address) => address.address);

const decodeHtmlAttribute = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replace(/&#([0-9]+);?/g, (match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const isPublicIpv4Address = (address: string) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first = 0, second = 0, third = 0] = octets;

  if (first === 0 || first === 10 || first === 127 || first >= 224)
    return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 0 && third === 0) return false;
  if (first === 192 && second === 0 && third === 2) return false;
  if (first === 192 && second === 168) return false;
  if (first === 198 && (second === 18 || second === 19)) return false;
  if (first === 198 && second === 51 && third === 100) return false;
  if (first === 203 && second === 0 && third === 113) return false;

  return true;
};

const parseIpv6Address = (address: string) => {
  let normalized = address.toLowerCase().split("%")[0] ?? "";

  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4Address = normalized.slice(lastColon + 1);
    if (isIP(ipv4Address) !== 4) return null;

    const octets = ipv4Address.split(".").map(Number);
    const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
    const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
    normalized = `${normalized.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const left = (halves[0] ?? "").split(":").filter(Boolean);
  const right = (halves[1] ?? "").split(":").filter(Boolean);
  const missingCount = halves.length === 2 ? 8 - left.length - right.length : 0;
  const hextets = [
    ...left,
    ...Array.from({ length: missingCount }, () => "0"),
    ...right,
  ];

  if (
    missingCount < 0 ||
    hextets.length !== 8 ||
    hextets.some((hextet) => !/^[0-9a-f]{1,4}$/.test(hextet))
  ) {
    return null;
  }

  return hextets.reduce(
    (result, hextet) =>
      (result << 16n) | BigInt(Number.parseInt(hextet, 16)),
    0n,
  );
};

const isIpv6Prefix = (address: bigint, prefix: string, prefixLength: number) => {
  const prefixAddress = parseIpv6Address(prefix);
  if (prefixAddress === null) return false;

  const shift = BigInt(128 - prefixLength);
  return address >> shift === prefixAddress >> shift;
};

const specialPurposeIpv6Prefixes = [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const;

const isPublicIpv6Address = (address: string) => {
  const parsedAddress = parseIpv6Address(address);
  if (parsedAddress === null || !isIpv6Prefix(parsedAddress, "2000::", 3)) {
    return false;
  }

  return !specialPurposeIpv6Prefixes.some(([prefix, prefixLength]) =>
    isIpv6Prefix(parsedAddress, prefix, prefixLength),
  );
};

const isPublicIpAddress = (address: string) => {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4Address(address);
  if (version === 6) return isPublicIpv6Address(address);
  return false;
};

const localHostnamePattern = /(?:^|\.)(?:home|internal|lan|local|localhost)$/i;

const getAddressHostname = (hostname: string) =>
  hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

const getHttpUrl = (value: string, baseUrl?: string) => {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      localHostnamePattern.test(url.hostname)
    ) {
      return null;
    }

    const addressHostname = getAddressHostname(url.hostname);
    const ipVersion = isIP(addressHostname);
    if (ipVersion > 0 && !isPublicIpAddress(addressHostname)) return null;

    return url;
  } catch {
    return null;
  }
};

export const resolvePublicNewsUrl = async (
  value: string,
  resolveHost: NewsHostResolver = defaultNewsHostResolver,
): Promise<ResolvedPublicNewsUrl | null> => {
  const url = getHttpUrl(value);
  if (!url) return null;
  const addressHostname = getAddressHostname(url.hostname);
  const literalFamily = isIP(addressHostname);

  if (literalFamily === 4 || literalFamily === 6) {
    return {
      addresses: [
        {
          address: addressHostname,
          family: literalFamily,
        },
      ],
      url,
    };
  }

  const addresses = await resolveHost(addressHostname);
  if (
    addresses.length === 0 ||
    !addresses.every((address) => isPublicIpAddress(address))
  ) {
    return null;
  }

  return {
    addresses: addresses.flatMap((address) => {
      const family = isIP(address);
      return family === 4 || family === 6 ? [{ address, family }] : [];
    }),
    url,
  };
};

export const isPublicNewsPageUrl = async (
  value: string,
  resolveHost: NewsHostResolver = defaultNewsHostResolver,
) => Boolean(await resolvePublicNewsUrl(value, resolveHost));

const parseHtmlAttributes = (tag: string) => {
  const attributes = new Map<string, string>();
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) {
      attributes.set(name, decodeHtmlAttribute(value.trim()));
    }
  }

  return attributes;
};

const newsImageMetadataKeys = [
  "og:image:secure_url",
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
] as const;

const ephemeralImageQueryKeys = new Set([
  "key-pair-id",
  "policy",
  "signature",
  "x-amz-credential",
  "x-amz-signature",
  "x-goog-credential",
  "x-goog-signature",
]);

const hasEphemeralImageSignature = (url: URL) => {
  const keys = new Set(
    [...url.searchParams.keys()].map((key) => key.toLowerCase()),
  );

  if ([...keys].some((key) => ephemeralImageQueryKeys.has(key.toLowerCase()))) {
    return true;
  }

  const hasAzureSignature =
    keys.has("sig") && (keys.has("se") || keys.has("sp") || keys.has("sv"));
  const hasGenericExpiringToken =
    (keys.has("token") || keys.has("access_token")) &&
    (keys.has("exp") || keys.has("expires") || keys.has("expiry"));

  return hasAzureSignature || hasGenericExpiringToken;
};

export const extractNewsImageUrl = ({
  html,
  pageUrl,
}: {
  html: string;
  pageUrl: string;
}) => {
  const metadata = new Map<string, string[]>();

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseHtmlAttributes(match[0]);
    const key = (
      attributes.get("property") ?? attributes.get("name")
    )?.toLowerCase();
    const content = attributes.get("content");

    if (key && content) {
      metadata.set(key, [...(metadata.get(key) ?? []), content]);
    }
  }

  for (const key of newsImageMetadataKeys) {
    const values = metadata.get(key) ?? [];

    for (const value of values) {
      const imageUrl = getHttpUrl(value, pageUrl);
      if (imageUrl && !hasEphemeralImageSignature(imageUrl)) {
        return imageUrl.toString();
      }
    }
  }

  return null;
};
