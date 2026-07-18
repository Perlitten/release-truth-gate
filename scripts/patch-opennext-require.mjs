import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const handlerPath = path.resolve(
  process.cwd(),
  ".open-next/server-functions/default/handler.mjs",
);
const marker = "release-truth-opennext-require-shim";
const source = await readFile(handlerPath, "utf8");

if (!source.includes(marker)) {
  const banner = [
    'import process from "node:process";',
    `/* ${marker} */`,
    "const require = (specifier) => {",
    '  const normalized = specifier.startsWith("node:")',
    "    ? specifier",
    '    : `node:${specifier}`;',
    "  return process.getBuiltinModule(normalized);",
    "};",
    "",
  ].join("\n");

  await writeFile(handlerPath, `${banner}${source}`, "utf8");
}
