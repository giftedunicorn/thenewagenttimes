import { env } from "~/env";
import { NewsHome } from "./_components/news-home";
import { getNewsHomeData } from "./_data/news";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getNewsHomeData();

  return (
    <NewsHome
      authConfigured={Boolean(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim())}
      generatedAt={new Date().toISOString()}
      deskStatus={data.deskStatus}
      initialItems={data.items}
      refreshConfigured={Boolean(env.NEWS_REFRESH_SECRET?.trim())}
      status={data.status}
    />
  );
}
