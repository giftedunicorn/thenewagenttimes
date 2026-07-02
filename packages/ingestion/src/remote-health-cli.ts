import { checkRemoteNewsHealth } from "./remote-health";

const main = async () => {
  const healthUrl =
    process.argv[2] ??
    process.env.NEWS_HEALTH_URL ??
    process.env.NEWS_REFRESH_URL;
  const result = await checkRemoteNewsHealth({
    healthUrl,
    railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
  });

  console.log(
    `Remote news health: status=${result.status} ready=${String(result.ready)} nextStep=${result.nextStep ?? "unknown"}`,
  );
  console.log(JSON.stringify(result.body, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
