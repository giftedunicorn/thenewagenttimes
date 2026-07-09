import type { Metadata } from "next";

import { NewsReaderCenter } from "../_components/news-reader-center";
import { getNewsHomeData } from "../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Inspect the local reader signals shaping The New AI Times For You ranking on this device.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Reader Center | The New AI Times",
};

export default async function NewsReaderCenterPage() {
  const data = await getNewsHomeData();

  return <NewsReaderCenter items={data.items} status={data.status} />;
}
