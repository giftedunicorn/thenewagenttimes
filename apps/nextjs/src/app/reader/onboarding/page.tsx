import type { Metadata } from "next";

import { NewsReaderOnboarding } from "../../_components/news-reader-onboarding";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Choose the first local For You signals for The New AI Times reader profile.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Set Up For You | The New AI Times",
};

export default async function NewsReaderOnboardingPage() {
  const data = await getNewsHomeData();

  return <NewsReaderOnboarding items={data.items} status={data.status} />;
}
