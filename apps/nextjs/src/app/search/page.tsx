import {
  getNewsEditionPageMetadata,
  NewsEditionPage,
} from "../_components/news-edition-page";
import { NewsSearchMemoryRecorder } from "../_components/news-search-memory-recorder";
import { getNewsEditionPageData } from "../_data/news";

export const dynamic = "force-dynamic";

type NewsSearchParams = Record<string, string | string[] | undefined>;

const getSearchQuery = (searchParams: NewsSearchParams) => {
  const query = searchParams.q;
  const value = Array.isArray(query) ? query[0] : query;

  return typeof value === "string" ? value.trim() : "";
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  const query = getSearchQuery(await searchParams);
  const edition = await getNewsEditionPageData({
    kind: "search",
    value: query,
  });

  return getNewsEditionPageMetadata({
    edition,
  });
}

export default async function NewsSearchEditionPage({
  searchParams,
}: {
  searchParams: Promise<NewsSearchParams>;
}) {
  const query = getSearchQuery(await searchParams);
  const edition = await getNewsEditionPageData({
    kind: "search",
    value: query,
  });

  return (
    <>
      <NewsSearchMemoryRecorder
        canPersistServerMemory={edition.status === "ready"}
        query={edition.filter.value}
        resultCount={edition.items.length}
      />
      <NewsEditionPage edition={edition} />
    </>
  );
}
