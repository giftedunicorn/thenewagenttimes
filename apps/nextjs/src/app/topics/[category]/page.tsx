import { notFound, redirect } from "next/navigation";

import {
  getNewsEditionPageMetadata,
  NewsEditionPage,
} from "../../_components/news-edition-page";
import { getNewsTopicHref } from "../../_components/news-home-model";
import {
  getNewsEditionPageData,
  parseNewsEditionTopicCategory,
} from "../../_data/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const parsedCategory = parseNewsEditionTopicCategory(category);

  if (!parsedCategory.success) {
    notFound();
  }

  const canonicalHref = getNewsTopicHref(parsedCategory.data);

  if (`/topics/${category}` !== canonicalHref) {
    redirect(canonicalHref);
  }

  const edition = await getNewsEditionPageData({
    kind: "topic",
    value: parsedCategory.data,
  });

  return getNewsEditionPageMetadata({
    edition,
  });
}

export default async function NewsTopicEditionPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const parsedCategory = parseNewsEditionTopicCategory(category);

  if (!parsedCategory.success) {
    notFound();
  }

  const edition = await getNewsEditionPageData({
    kind: "topic",
    value: parsedCategory.data,
  });

  return <NewsEditionPage edition={edition} />;
}
