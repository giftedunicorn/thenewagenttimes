import {
  bootstrapRemoteNewsEdition,
  formatRemoteNewsBootstrapSummary,
  RemoteNewsBootstrapNotReadyError,
  resolveRemoteNewsBootstrapCommandInput,
} from "./remote-bootstrap";

const printBootstrapResult = (
  result: Awaited<ReturnType<typeof bootstrapRemoteNewsEdition>>,
) => {
  console.log(formatRemoteNewsBootstrapSummary(result));
  console.log(JSON.stringify(result, null, 2));
};

const main = async () => {
  const result = await bootstrapRemoteNewsEdition({
    ...resolveRemoteNewsBootstrapCommandInput({
      argv: process.argv.slice(2),
      env: process.env,
    }),
  });

  printBootstrapResult(result);
};

main().catch((error: unknown) => {
  if (error instanceof RemoteNewsBootstrapNotReadyError) {
    console.error(error.message);
    printBootstrapResult(error.result);
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
