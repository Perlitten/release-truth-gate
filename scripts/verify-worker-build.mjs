import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const workerPath = path.resolve(process.cwd(), ".open-next/worker.js");
const handlerPath = path.resolve(
  process.cwd(),
  ".open-next/server-functions/default/handler.mjs",
);
const marker = "release-truth-opennext-require-shim";

const [workerStats, handler] = await Promise.all([
  stat(workerPath),
  readFile(handlerPath, "utf8"),
]);

if (workerStats.size < 2_000) {
  throw new Error("The OpenNext worker artifact is unexpectedly small.");
}

const worker = await readFile(workerPath, "utf8");
if (!worker.includes("./middleware/handler.mjs")) {
  throw new Error("The OpenNext worker is missing the CSP middleware bundle.");
}

if (!handler.includes(marker)) {
  throw new Error("The required OpenNext runtime shim is missing.");
}

if (!handler.includes("process.getBuiltinModule")) {
  throw new Error("The OpenNext runtime shim no longer matches its invariant.");
}

process.stdout.write(
  `Verified OpenNext worker (${workerStats.size} bytes) and runtime shim.\n`,
);
