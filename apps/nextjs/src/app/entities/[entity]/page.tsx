import {
  getNewsEditionPageMetadata,
  NewsEditionPage,
} from "../../_components/news-edition-page";
import { getNewsEditionPageData } from "../../_data/news";

export const dynamic = "force-dynamic";

const parseEntityParam = (entity: string) => {
  try {
    return decodeURIComponent(entity);
  } catch {
    return entity;
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const edition = await getNewsEditionPageData({
    kind: "entity",
    value: parseEntityParam(entity),
  });

  return getNewsEditionPageMetadata({
    edition,
  });
}

export default async function NewsEntityEditionPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const edition = await getNewsEditionPageData({
    kind: "entity",
    value: parseEntityParam(entity),
  });

  return <NewsEditionPage edition={edition} />;
}
