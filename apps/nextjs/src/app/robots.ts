import type { MetadataRoute } from "next";

import { getNewsRobotsPolicy } from "./_components/news-sitemap";

export default function robots(): MetadataRoute.Robots {
  return getNewsRobotsPolicy();
}
