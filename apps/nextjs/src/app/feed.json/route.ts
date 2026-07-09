import { getNewsJsonFeed } from "../_components/news-feed";
import { getNewsHomeData } from "../_data/news";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getNewsHomeData();

  return Response.json(
    getNewsJsonFeed({
      items: data.items,
    }),
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
        "Content-Type": "application/feed+json; charset=utf-8",
      },
    },
  );
}
