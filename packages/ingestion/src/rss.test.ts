import { describe, expect, it } from "vitest";

import { parseFeedXml } from "./rss";

const rssFixture = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>AI Feed</title>
    <item>
      <title>OpenAI releases a new agent model</title>
      <link>https://example.com/openai-agent-model?utm_source=rss</link>
      <guid>agent-model-guid</guid>
      <description><![CDATA[A short summary about the model.]]></description>
      <pubDate>Sat, 27 Jun 2026 08:00:00 GMT</pubDate>
      <author>news@example.com (AI Reporter)</author>
      <enclosure url="https://example.com/image.jpg" type="image/jpeg" />
    </item>
  </channel>
</rss>`;

const atomFixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AI Atom Feed</title>
  <entry>
    <title>YC backs a new AI agent startup</title>
    <id>tag:example.com,2026:yc-agent</id>
    <link href="https://example.com/yc-agent" />
    <summary>YC funds a new workflow agent company.</summary>
    <updated>2026-06-27T09:00:00.000Z</updated>
    <author><name>YC Reporter</name></author>
  </entry>
</feed>`;

const rssMediaFixture = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>AI Media Feed</title>
    <item>
      <title>AI agent launch includes a media preview</title>
      <link>https://example.com/agent-media</link>
      <description>A launch story ships with a rich media image.</description>
      <pubDate>Sat, 27 Jun 2026 10:00:00 GMT</pubDate>
      <media:content url="https://example.com/agent-media.jpg" medium="image" />
    </item>
  </channel>
</rss>`;

const atomMediaFixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AI Atom Media Feed</title>
  <entry>
    <title>Frontier model story includes an enclosure image</title>
    <id>tag:example.com,2026:model-image</id>
    <link rel="alternate" href="https://example.com/model-image" />
    <link rel="enclosure" type="image/jpeg" href="https://example.com/model-image.jpg" />
    <summary>A model launch story includes an Atom enclosure image.</summary>
    <updated>2026-06-27T11:00:00.000Z</updated>
  </entry>
</feed>`;

const rssInlineImageFixture = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>AI Inline Image Feed</title>
    <item>
      <title>Agent workflow story embeds its lead image</title>
      <link>https://example.com/agent-inline-image</link>
      <description><![CDATA[
        <p>A launch story includes an image inside the summary.</p>
        <img alt="Agent dashboard" src="https://example.com/agent-inline.jpg?width=1200&amp;height=700" />
      ]]></description>
      <pubDate>Sat, 27 Jun 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("parseFeedXml", () => {
  it("parses common RSS item fields", () => {
    const [item] = parseFeedXml(rssFixture);

    expect(item).toEqual({
      title: "OpenAI releases a new agent model",
      url: "https://example.com/openai-agent-model?utm_source=rss",
      id: "agent-model-guid",
      summary: "A short summary about the model.",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      authorName: "AI Reporter",
      imageUrl: "https://example.com/image.jpg",
    });
  });

  it("parses common Atom entry fields", () => {
    const [item] = parseFeedXml(atomFixture);

    expect(item).toMatchObject({
      title: "YC backs a new AI agent startup",
      url: "https://example.com/yc-agent",
      id: "tag:example.com,2026:yc-agent",
      summary: "YC funds a new workflow agent company.",
      publishedAt: new Date("2026-06-27T09:00:00.000Z"),
      authorName: "YC Reporter",
    });
  });

  it("uses RSS media image fields when feeds omit image enclosures", () => {
    const [item] = parseFeedXml(rssMediaFixture);

    expect(item?.imageUrl).toBe("https://example.com/agent-media.jpg");
  });

  it("uses Atom image enclosures for article visuals", () => {
    const [item] = parseFeedXml(atomMediaFixture);

    expect(item).toMatchObject({
      title: "Frontier model story includes an enclosure image",
      url: "https://example.com/model-image",
      imageUrl: "https://example.com/model-image.jpg",
    });
  });

  it("uses the first inline HTML image when feeds omit media fields", () => {
    const [item] = parseFeedXml(rssInlineImageFixture);

    expect(item?.imageUrl).toBe(
      "https://example.com/agent-inline.jpg?width=1200&height=700",
    );
  });
});
