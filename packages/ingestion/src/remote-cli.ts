import {
  formatRemoteNewsRefreshSummary,
  refreshRemoteNewsEdition,
  resolveRemoteNewsRefreshCommandInput,
} from "./remote-refresh";

const main = async () => {
  const result = await refreshRemoteNewsEdition({
    ...resolveRemoteNewsRefreshCommandInput({
      argv: process.argv.slice(2),
      env: process.env,
    }),
  });

  console.log(formatRemoteNewsRefreshSummary(result));
  console.log(JSON.stringify(result.body, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
