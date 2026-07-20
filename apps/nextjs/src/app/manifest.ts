import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f7f5ef",
    categories: ["news", "productivity", "business"],
    description:
      "A personalized AI news front page for agents, frontier models, funding, research, launches, and market shifts.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    id: "/",
    lang: "en",
    name: "The New AI Times",
    scope: "/",
    short_name: "AI Times",
    start_url: "/",
    theme_color: "#161616",
  };
}
