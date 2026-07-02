import { refreshRemoteNewsEdition } from "./remote-refresh";

const main = async () => {
  const refreshUrl = process.argv[2] ?? process.env.NEWS_REFRESH_URL;
  const result = await refreshRemoteNewsEdition({
    railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
    refreshSecret: process.env.NEWS_REFRESH_SECRET,
    refreshUrl,
  });

  console.log(`Remote news refresh complete: status=${result.status}`);
  console.log(JSON.stringify(result.body, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
