import {
  getNewsDirectoryPageData,
  getNewsDirectoryPageMetadata,
  NewsDirectoryPage,
} from "../_components/news-directory-page";
import { getNewsHomeData } from "../_data/news";

export const dynamic = "force-dynamic";
export const metadata = getNewsDirectoryPageMetadata({ kind: "source" });

export default async function NewsSourcesPage() {
  const data = await getNewsHomeData();
  const directory = getNewsDirectoryPageData({
    deskStatus: data.deskStatus,
    items: data.items,
    kind: "source",
    status: data.status,
  });

  return <NewsDirectoryPage directory={directory} />;
}
