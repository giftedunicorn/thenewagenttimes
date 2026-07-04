import {
  embedRemoteNewsItems,
  resolveRemoteNewsEmbedCommandInput,
} from "./remote-embed";

const main = async () => {
  const result = await embedRemoteNewsItems({
    ...resolveRemoteNewsEmbedCommandInput({
      argv: process.argv.slice(2),
      env: process.env,
    }),
  });

  console.log(`Remote news embedding complete: status=${result.status}`);
  console.log(JSON.stringify(result.body, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
