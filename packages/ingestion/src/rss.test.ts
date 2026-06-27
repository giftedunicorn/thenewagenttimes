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
});
