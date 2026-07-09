import type { Metadata } from "next";

import { NewsReaderFollowing } from "../../_components/news-reader-following";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Manage the followed topics, sources, entities, and angles shaping The New AI Times For You ranking.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Following | The New AI Times",
};

export default async function NewsReaderFollowingPage() {
  const data = await getNewsHomeData();

  return <NewsReaderFollowing items={data.items} status={data.status} />;
}
