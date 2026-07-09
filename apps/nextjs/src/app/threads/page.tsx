import type { Metadata } from "next";

import { NewsCoverageThreadsPage } from "../_components/news-threads-page";
import { getNewsHomeData } from "../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Browse clustered AI coverage threads ranked with local reader profile signals.",
  title: "Coverage Threads | The New AI Times",
};

export default async function NewsThreadsPage() {
  const data = await getNewsHomeData();

  return <NewsCoverageThreadsPage items={data.items} status={data.status} />;
}
