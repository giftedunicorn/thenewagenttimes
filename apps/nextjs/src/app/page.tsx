import { NewsHome } from "./_components/news-home";
import { getNewsHomeFeedData } from "./_data/news";

export const revalidate = 60;

export default async function HomePage() {
  const data = await getNewsHomeFeedData();

  return (
    <NewsHome
      generatedAt={new Date().toISOString()}
      initialItems={data.items}
      status={data.status}
    />
  );
}
