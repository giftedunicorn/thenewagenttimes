import { describe, expect, it } from "vitest";

import {
  extractNewsImageUrl,
  isPublicNewsPageUrl,
  resolvePublicNewsUrl,
} from "./news-image";

describe("extractNewsImageUrl", () => {
  it("extracts an Open Graph image regardless of meta attribute order", () => {
    const html = `
      <meta content="/images/story.jpg?width=1200&amp;height=630" property="og:image">
    `;

    expect(
      extractNewsImageUrl({
        html,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBe("https://publisher.example/images/story.jpg?width=1200&height=630");
  });

  it("uses Twitter metadata when Open Graph metadata is absent", () => {
    const html = `
      <meta name="twitter:image" content="https://cdn.example.com/story.webp">
    `;

    expect(
      extractNewsImageUrl({
        html,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBe("https://cdn.example.com/story.webp");
  });

  it("tries later Open Graph candidates when the first is temporary", () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/temporary.jpg?token=abc&amp;expires=123">
      <meta property="og:image" content="https://cdn.example.com/stable.jpg">
    `;

    expect(
      extractNewsImageUrl({
        html,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBe("https://cdn.example.com/stable.jpg");
  });

  it("decodes numeric HTML entities in image URLs", () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/story.jpg?quality=90&#038;crop=1">
    `;

    expect(
      extractNewsImageUrl({
        html,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBe("https://cdn.example.com/story.jpg?quality=90&crop=1");
  });

  it("returns null for pages without usable public image metadata", () => {
    expect(
      extractNewsImageUrl({
        html: '<meta property="og:image" content="http://127.0.0.1/private">',
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBeNull();
    expect(
      extractNewsImageUrl({
        html: '<meta property="og:image" content="http://[::1]/private">',
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBeNull();

    expect(
      extractNewsImageUrl({
        html: `
          <meta property="og:image" content="https://cdn.example.com/story.jpg?X-Amz-Expires=3600&amp;X-Amz-Signature=temporary">
        `,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBeNull();
    expect(
      extractNewsImageUrl({
        html: `
          <meta property="og:image" content="https://cdn.example.com/story.jpg?sv=2025-01-05&amp;se=2026-07-20&amp;sig=temporary">
        `,
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBeNull();

    expect(
      extractNewsImageUrl({
        html: "<title>No image</title>",
        pageUrl: "https://publisher.example/news/story",
      }),
    ).toBeNull();
  });
});

describe("isPublicNewsPageUrl", () => {
  it("accepts an HTTP page whose hostname resolves only to public addresses", async () => {
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(true);
  });

  it("rejects unsupported protocols and local hostnames", async () => {
    await expect(
      isPublicNewsPageUrl("file:///etc/passwd", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://localhost:3000/private", () =>
        Promise.resolve(["127.0.0.1"]),
      ),
    ).resolves.toBe(false);
  });

  it("rejects private IP literals and hostnames resolving to private addresses", async () => {
    await expect(
      isPublicNewsPageUrl("http://10.0.0.2/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://198.18.3.37/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://[::ffff:127.0.0.1]/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://[fec0::1]/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://[2002:0a00:1::]/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("http://[2001::1]/private", () =>
        Promise.resolve(["93.184.216.34"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.resolve(["fec0::1"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.resolve(["2001:2::1"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.resolve(["3fff::1"]),
      ),
    ).resolves.toBe(false);
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.resolve(["93.184.216.34", "192.168.1.20"]),
      ),
    ).resolves.toBe(false);
  });

  it("surfaces DNS resolution failures instead of classifying them as unsafe", async () => {
    await expect(
      isPublicNewsPageUrl("https://publisher.example/news/story", () =>
        Promise.reject(new Error("DNS unavailable")),
      ),
    ).rejects.toThrow("DNS unavailable");
  });
});

describe("resolvePublicNewsUrl", () => {
  it("returns the validated addresses used to pin the later request", async () => {
    await expect(
      resolvePublicNewsUrl("https://publisher.example/news/story", () =>
        Promise.resolve([
          "93.184.216.34",
          "2606:2800:220:1:248:1893:25c8:1946",
        ]),
      ),
    ).resolves.toMatchObject({
      addresses: [
        { address: "93.184.216.34", family: 4 },
        {
          address: "2606:2800:220:1:248:1893:25c8:1946",
          family: 6,
        },
      ],
      url: new URL("https://publisher.example/news/story"),
    });
  });
});
