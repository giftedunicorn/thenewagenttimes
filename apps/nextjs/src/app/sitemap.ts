import type { MetadataRoute } from "next";

import { getNewsSitemapEntries } from "./_components/news-sitemap";
import { getNewsHomeData } from "./_data/news";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getNewsHomeData();

  return getNewsSitemapEntries({
    items: data.items,
  });
}
