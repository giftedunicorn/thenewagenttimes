import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "apps/admin");
const standaloneAppRoot = path.join(appRoot, ".next/standalone/apps/admin");

/** @type {{ from: string; label: string; optional?: boolean; to: string }[]} */
const copies = [
  {
    from: path.join(appRoot, ".next/static"),
    label: "Next static assets",
    to: path.join(standaloneAppRoot, ".next/static"),
  },
  {
    from: path.join(appRoot, "public"),
    label: "public assets",
    optional: true,
    to: path.join(standaloneAppRoot, "public"),
  },
];

/**
 * @param {string} directory
 * @param {string} label
 */
const assertDirectory = async (directory, label) => {
  const stats = await stat(directory).catch(() => null);

  if (!stats?.isDirectory()) {
    throw new Error(`${label} directory does not exist: ${directory}`);
  }
};

await assertDirectory(standaloneAppRoot, "Standalone app");

for (const copyJob of copies) {
  const source = await stat(copyJob.from).catch(() => null);
  if (!source?.isDirectory() && copyJob.optional) continue;

  await assertDirectory(copyJob.from, copyJob.label);
  await rm(copyJob.to, { force: true, recursive: true });
  await mkdir(path.dirname(copyJob.to), { recursive: true });
  await cp(copyJob.from, copyJob.to, { recursive: true });
  console.log(`Synced ${copyJob.label} to ${copyJob.to}`);
}
