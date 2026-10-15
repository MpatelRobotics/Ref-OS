import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const pdf = new URL("../public/manuals/override-2.1.pdf", import.meta.url);
const output = new URL("../src/manualSearchIndex.json", import.meta.url);
const pages = [];

for (let page = 1; page <= 148; page += 1) {
  const text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-layout", fileURLToPath(pdf), "-"], { encoding: "utf8" })
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  pages.push({ page, text });
}

writeFileSync(output, `${JSON.stringify(pages)}\n`);
