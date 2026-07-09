import {
  getNewsBriefingPageMetadata,
  NewsBriefingPage,
} from "../_components/news-briefing-page";
import { getNewsHomeData } from "../_data/news";

export const dynamic = "force-dynamic";
export const metadata = getNewsBriefingPageMetadata();

export default async function NewsBriefingRoutePage() {
  const data = await getNewsHomeData();

  return (
    <NewsBriefingPage
      generatedAt={new Date().toISOString()}
      items={data.items}
      status={data.status}
    />
  );
}
