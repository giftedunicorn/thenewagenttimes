import { getNewsLlmsText } from "../_components/news-agent-discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(getNewsLlmsText({}), {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
