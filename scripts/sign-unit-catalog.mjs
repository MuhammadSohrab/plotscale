import { createPrivateKey, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  throw new Error("Usage: npm run catalog:sign -- input.json signed-output.json");
}
const privateKeyBase64 = process.env.PLOTSCALE_UNIT_PACK_PRIVATE_KEY;
if (!privateKeyBase64) {
  throw new Error("PLOTSCALE_UNIT_PACK_PRIVATE_KEY must contain a base64 PKCS#8 Ed25519 private key.");
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const payload = JSON.parse(await readFile(inputPath, "utf8"));
const privateKey = createPrivateKey({
  key: Buffer.from(privateKeyBase64, "base64"),
  format: "der",
  type: "pkcs8",
});
const signature = sign(
  null,
  Buffer.from(canonicalJson(payload), "utf8"),
  privateKey,
).toString("base64");
await writeFile(
  outputPath,
  `${JSON.stringify({ payload, signature }, null, 2)}\n`,
  "utf8",
);
console.log(`Signed catalog written to ${outputPath}`);
