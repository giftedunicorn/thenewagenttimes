import type { Metadata } from "next";

import { NewsReaderCenter } from "../../_components/news-reader-center";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Inspect the recommendation inputs shaping The New AI Times on this device.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Recommendation Lab | The New AI Times",
};

export default async function NewsRecommendationLabPage() {
  const data = await getNewsHomeData();

  return (
    <NewsReaderCenter items={data.items} status={data.status} surface="lab" />
  );
}
