import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("Updating the WASM model");

const sourceDirectory = join(
  __dirname,
  "..",
  "lib"
);

const outputDirectory = join(__dirname, "../package/src");

const wasmFile = readFileSync(join(sourceDirectory, "pv_downsampler.wasm"));
const strBase64 = Buffer.from(wasmFile).toString("base64");
const jsSourceFileOutput = `export const WASM_BASE64 = '${strBase64}';\n`;

writeFileSync(
  join(outputDirectory, "downsampler_b64.ts"),
  jsSourceFileOutput
);

console.log("... Done!");
