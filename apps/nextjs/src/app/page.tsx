import { NewsHome } from "./_components/news-home";
import { getNewsHomeData } from "./_data/news";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getNewsHomeData();

  return (
    <NewsHome
      generatedAt={new Date().toISOString()}
      initialItems={data.items}
      status={data.status}
    />
  );
}
