import {
  checkRemoteNewsHealth,
  formatRemoteNewsHealthSummary,
  RemoteNewsHealthNotReadyError,
  resolveRemoteNewsHealthCommandInput,
} from "./remote-health";

const main = async () => {
  const result = await checkRemoteNewsHealth({
    ...resolveRemoteNewsHealthCommandInput({
      argv: process.argv.slice(2),
      env: process.env,
    }),
  });

  console.log(formatRemoteNewsHealthSummary(result));
  console.log(JSON.stringify(result.body, null, 2));
};

main().catch((error: unknown) => {
  if (error instanceof RemoteNewsHealthNotReadyError) {
    console.error(error.message);
    console.log(formatRemoteNewsHealthSummary(error.result));
    console.log(JSON.stringify(error.result.body, null, 2));
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
