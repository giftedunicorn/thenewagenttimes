import {
  getNewsEditionPageMetadata,
  NewsEditionPage,
} from "../../_components/news-edition-page";
import { getNewsEditionPageData } from "../../_data/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const edition = await getNewsEditionPageData({
    kind: "source",
    value: slug,
  });

  return getNewsEditionPageMetadata({
    edition,
  });
}

export default async function NewsSourceEditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const edition = await getNewsEditionPageData({
    kind: "source",
    value: slug,
  });

  return <NewsEditionPage edition={edition} />;
}
