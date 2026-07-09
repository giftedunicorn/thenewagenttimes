import { notFound } from "next/navigation";

import { NewsArticle } from "../_components/news-article";
import {
  getNewsArticleMetadata,
  getNewsArticleStructuredData,
} from "../_components/news-article-model";
import { stringifyNewsStructuredData } from "../../_components/news-structured-data";
import { getNewsArticleData } from "../../_data/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getNewsArticleData(id);

  return getNewsArticleMetadata({
    article: data.article,
  });
}

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

  const structuredData = getNewsArticleStructuredData({
    article: data.article,
  });

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: stringifyNewsStructuredData(structuredData),
        }}
        type="application/ld+json"
      />
      <NewsArticle article={data.article} related={data.related} />
    </>
  );
}
