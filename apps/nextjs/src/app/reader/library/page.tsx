import type { Metadata } from "next";

import { NewsReaderLibrary } from "../../_components/news-reader-library";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Review saved stories, read history, Less feedback, and searches stored locally by The New AI Times.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Reader Library | The New AI Times",
};

export default async function NewsReaderLibraryPage() {
  const data = await getNewsHomeData();

  return <NewsReaderLibrary items={data.items} status={data.status} />;
}
