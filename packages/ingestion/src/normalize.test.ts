import { describe, expect, it } from "vitest";

import { CreateNewsItemSchema } from "@acme/db/schema";

import {
  buildDedupeKey,
  canonicalizeUrl,
  extractEntities,
  inferNewsCategory,
  normalizeFeedItem,
  normalizeManualItem,
} from "./normalize";

const sourceId = "6f1f9d8c-2b2b-4f28-b89a-0a3c4f5781a0";

describe("canonicalizeUrl", () => {
  it("removes tracking parameters and hash fragments", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/news?utm_source=rss&utm_campaign=test&id=123#top",
      ),
    ).toBe("https://example.com/news?id=123");
  });
});

describe("buildDedupeKey", () => {
  it("is stable across tracking parameter changes", () => {
    const first = buildDedupeKey({
      sourceId,
      title: "OpenAI releases a new agent model",
      canonicalUrl: "https://example.com/openai?utm_source=rss",
    });
    const second = buildDedupeKey({
      sourceId,
      title: "OpenAI releases a new agent model",
      canonicalUrl: "https://example.com/openai?utm_medium=email",
    });

    expect(first).toBe(second);
  });
});

describe("inferNewsCategory", () => {
  it.each([
    ["Acme raises $20M seed funding for AI agents", "funding"],
    ["New AI workflow agent launches on Product Hunt", "product_hunt"],
    ["OpenAI releases a new model API", "model_release"],
    ["A browser automation agent handles workflows", "agent_product"],
    ["Google announces Gemini agent updates", "big_tech"],
    ["xAI and Elon Musk launch Grok agent tools", "musk_ai"],
    ["YC backs a new AI agent startup", "yc_ai"],
    ["New arXiv paper benchmarks AI agents", "research"],
    ["A new protocol creates a concept for agent memory", "new_concept"],
  ])("classifies %s as %s", (text, expectedCategory) => {
    expect(inferNewsCategory({ text })).toBe(expectedCategory);
  });

  it.each([
    [
      "The White House issues AI safety policy guidance for frontier models",
      "policy",
    ],
    [
      "Researchers disclose an AI agent prompt injection vulnerability",
      "security",
    ],
    [
      "Open source AI model weights ship under an Apache license on GitHub",
      "open_source",
    ],
    [
      "A new market map tracks AI infrastructure startups and GPU clouds",
      "market_map",
    ],
    ["A contrarian hot take argues AI agents are overhyped", "hot_take"],
  ])("classifies channel-specific AI coverage %s as %s", (text, expected) => {
    expect(inferNewsCategory({ text })).toBe(expected);
  });

  it("uses source context when feed titles do not carry explicit category words", () => {
    expect(
      inferNewsCategory({
        sourceSlug: "arxiv-ai-ml",
        text: "A new transformer architecture for temporal reasoning",
      }),
    ).toBe("research");
    expect(
      inferNewsCategory({
        sourceSlug: "github-trending-ai",
        text: "Repository releases local model weights for developers",
      }),
    ).toBe("open_source");
  });

  it("does not classify ordinary success language as startup funding", () => {
    expect(
      inferNewsCategory({
        text: "America's scientific success depends on university leadership.",
      }),
    ).toBe("other");
  });

  it("does not classify benchmark rounds as startup funding", () => {
    expect(
      inferNewsCategory({
        text: "A new benchmark round evaluates reasoning agents and model reliability.",
      }),
    ).toBe("research");
  });

  it("does not classify ordinary big-tech product news as AI news", () => {
    expect(
      inferNewsCategory({
        text: "Google launches a new Pixel phone camera update.",
      }),
    ).toBe("other");
    expect(
      inferNewsCategory({
        text: "Microsoft refreshes Windows desktop wallpapers.",
      }),
    ).toBe("other");
  });
});

describe("extractEntities", () => {
  it("extracts known AI companies and people", () => {
    expect(
      extractEntities("OpenAI and Anthropic react to Elon Musk and xAI news"),
    ).toEqual(["OpenAI", "Anthropic", "Elon Musk", "xAI"]);
  });

  it("does not match entity names inside unrelated words", () => {
    expect(
      extractEntities(
        "A cardiometabolic benchmark studies policy and technology adoption.",
      ),
    ).toEqual([]);
  });

  it("extracts common AI product, lab, and infrastructure entities", () => {
    expect(
      extractEntities(
        "Claude, Gemini, Mistral, Perplexity, SpaceX, and Cloudflare shape the AI week.",
      ),
    ).toEqual([
      "SpaceX",
      "Cloudflare",
      "Claude",
      "Gemini",
      "Mistral",
      "Perplexity",
    ]);
  });

  it("extracts AI coding and application-layer entities", () => {
    expect(
      extractEntities(
        "Cursor, Windsurf, Devin, Cognition, GitHub Copilot, Vercel, Cohere, and ElevenLabs lead the agent tooling cycle.",
      ),
    ).toEqual([
      "Cohere",
      "Cursor",
      "Windsurf",
      "Devin",
      "Cognition",
      "GitHub Copilot",
      "Vercel",
      "ElevenLabs",
    ]);
  });
});

describe("normalizeFeedItem", () => {
  it("creates a valid DB news item payload", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "openai-news",
      item: {
        title: "OpenAI releases a new agent model",
        url: "https://example.com/openai-agent?utm_source=rss",
        summary: "OpenAI shipped a new model for agentic workflows.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(CreateNewsItemSchema.safeParse(result).success).toBe(true);
    expect(result.category).toBe("model_release");
    expect(result.canonicalUrl).toBe("https://example.com/openai-agent");
  });

  it("decodes HTML entities from feed text before storage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "openai-news",
      item: {
        title: "OpenAI &amp; Anthropic release an agent model",
        url: "https://example.com/openai-anthropic-agent",
        summary:
          "<p>OpenAI &amp; Anthropic&#39;s agents&nbsp;launch with new workflow tools.</p>",
        bodyText:
          "<p>Benchmarks show &quot;agentic&quot; model behavior &amp; safer handoffs.</p>",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.title).toBe("OpenAI & Anthropic release an agent model");
    expect(result.summary).toBe(
      "OpenAI & Anthropic's agents launch with new workflow tools.",
    );
    expect(result.bodyText).toBe(
      'Benchmarks show "agentic" model behavior & safer handoffs.',
    );
  });

  it("keeps arXiv research tags and entities clean from substring matches", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "arxiv-ai-ml",
      item: {
        title:
          "Accelerometry-Derived Digital Biomarkers for Cardiometabolic Risk",
        url: "https://arxiv.org/abs/2606.31500",
        summary:
          "A population-representative tabular benchmark with uncertainty quantification.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("research");
    expect(result.tags).toEqual(["research"]);
    expect(result.entities).toEqual([]);
  });

  it("keeps ordinary big-tech product feed items outside AI categories", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "techcrunch-ai",
      item: {
        title: "Google launches a new Pixel phone camera update",
        url: "https://example.com/google-pixel-camera",
        summary: "The phone update improves weekend sports photography.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("other");
    expect(result.tags).toEqual(["other"]);
  });

  it("uses feed category metadata as recommendation context", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "the-verge-ai",
      item: {
        title: "Researchers publish a new browser agent finding",
        url: "https://example.com/browser-agent-finding",
        summary: "The report explains a mitigation path for product teams.",
        categories: ["Artificial Intelligence", "Security", "Prompt Injection"],
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("security");
    expect(result.tags).toEqual(
      expect.arrayContaining(["security", "prompt_injection"]),
    );
  });

  it("extracts fine-grained recommendation tags from security and market-map coverage", () => {
    const securityResult = normalizeFeedItem({
      sourceId,
      sourceSlug: "security-ai",
      item: {
        title: "AI agent prompt injection vulnerability disclosed",
        url: "https://example.com/prompt-injection",
        summary:
          "Researchers red team a browser agent exploit and publish mitigations.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });
    const marketMapResult = normalizeFeedItem({
      sourceId,
      sourceSlug: "market-map-ai",
      item: {
        title: "AI infrastructure market map tracks GPU cloud startups",
        url: "https://example.com/gpu-cloud-map",
        summary:
          "The landscape compares inference platforms, GPU clouds, and developer tooling.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(securityResult.tags).toEqual(
      expect.arrayContaining([
        "security",
        "agent",
        "prompt_injection",
        "red_team",
      ]),
    );
    expect(marketMapResult.tags).toEqual(
      expect.arrayContaining(["market_map", "gpu_cloud", "infrastructure"]),
    );
  });

  it("extracts coding-agent recommendation angles from developer tool coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "developer-tools-ai",
      item: {
        title: "Cursor and GitHub Copilot ship autonomous coding agent updates",
        url: "https://example.com/coding-agent-update",
        summary:
          "Devin and Cognition push developer tools toward agentic code review and repo automation.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("agent_product");
    expect(result.tags).toEqual(
      expect.arrayContaining(["agent", "coding_agent", "developer_tool"]),
    );
  });

  it("extracts model evaluation, tool-use, and local-inference angles", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "hugging-face-blog",
      item: {
        title: "Open source model weights improve local inference and tool use",
        url: "https://example.com/local-tool-use-model",
        summary:
          "Benchmarks evaluate compact LLMs for function calling, tool use, and on-device deployment.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("open_source");
    expect(result.tags).toEqual(
      expect.arrayContaining(["model", "local_inference", "tool_use", "evals"]),
    );
  });

  it("extracts funding round recommendation angles from AI startup coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "techcrunch-ai",
      item: {
        title: "AI agent startup raises $40M seed funding",
        url: "https://example.com/ai-agent-seed-round",
        summary:
          "The company is building workflow automation agents and reached a new valuation.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("funding");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "funding",
        "funding_round",
        "seed_round",
        "valuation",
      ]),
    );
  });

  it("extracts series-stage recommendation angles from AI startup funding", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "venturebeat-ai",
      item: {
        title: "AI infrastructure startup raises Series A funding",
        url: "https://example.com/ai-infra-series-a",
        summary:
          "The company builds inference automation for enterprise agents.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("funding");
    expect(result.tags).toEqual(
      expect.arrayContaining(["funding_round", "series_a_round"]),
    );
  });

  it("extracts policy recommendation angles from AI regulation coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "policy-ai",
      item: {
        title: "White House AI executive order follows EU AI Act debate",
        url: "https://example.com/ai-policy-angles",
        summary:
          "Lawmakers weigh export controls and copyright rules for frontier models.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("policy");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "policy",
        "ai_act",
        "executive_order",
        "export_controls",
        "copyright",
      ]),
    );
  });

  it("extracts security recommendation angles from AI safety coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "security-ai",
      item: {
        title: "Researchers disclose an AI agent jailbreak exploit",
        url: "https://example.com/ai-agent-security",
        summary:
          "The vulnerability uses prompt injection against tool-using agents after red team review.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("security");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "security",
        "prompt_injection",
        "red_team",
        "jailbreak",
        "vulnerability",
        "exploit",
      ]),
    );
  });

  it("extracts open-source recommendation angles from model release coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "github-trending-ai",
      item: {
        title: "Open source AI model weights ship under an Apache license",
        url: "https://example.com/open-weights-repo",
        summary:
          "The GitHub repository includes inference examples for local LLM deployment.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("open_source");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "open_source",
        "model",
        "open_weights",
        "apache_license",
        "github_repo",
        "local_inference",
      ]),
    );
  });

  it("extracts model-release recommendation angles from launch coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "openai-news",
      item: {
        title: "OpenAI releases a reasoning model API with multimodal pricing",
        url: "https://example.com/reasoning-model-api",
        summary:
          "The launch includes new vision, audio, and token price changes for developers.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("model_release");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "model",
        "reasoning",
        "api_release",
        "multimodal",
        "pricing",
      ]),
    );
  });

  it("extracts agent-product recommendation angles from workflow coverage", () => {
    const result = normalizeFeedItem({
      sourceId,
      sourceSlug: "agent-product-ai",
      item: {
        title:
          "Enterprise browser agent ships workflow automation and computer use",
        url: "https://example.com/enterprise-browser-agent",
        summary:
          "The product handles back-office workflows for teams through agentic browser actions.",
        publishedAt: new Date("2026-06-27T08:00:00.000Z"),
      },
    });

    expect(result.category).toBe("agent_product");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "agent",
        "browser_agent",
        "workflow_automation",
        "enterprise_agent",
        "computer_use",
      ]),
    );
  });
});

describe("normalizeManualItem", () => {
  it("supports manual Product Hunt and YC discoveries", () => {
    const result = normalizeManualItem({
      sourceId,
      sourceSlug: "product-hunt-ai",
      title: "Product Hunt launch for a YC AI agent",
      url: "https://example.com/product",
      summary: "A YC company launches an AI workflow agent.",
      publishedAt: new Date("2026-06-27T08:00:00.000Z"),
    });

    expect(result.category).toBe("product_hunt");
    expect(result.tags).toEqual(expect.arrayContaining(["product_hunt", "yc"]));
  });
});
