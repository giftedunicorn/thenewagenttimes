import { notFound } from "next/navigation";

import { NewsArticle } from "../_components/news-article";
import { getNewsArticleData } from "../../_data/news";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getNewsArticleData(id);

  if (!data.article) {
    notFound();
  }

  return <NewsArticle article={data.article} related={data.related} />;
}
