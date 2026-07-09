import { getNewsOpenSearchDescription } from "../_components/news-search-discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(getNewsOpenSearchDescription({}), {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
    },
  });
}
