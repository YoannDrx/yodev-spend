import { readFile } from "node:fs/promises";

const catalogs = Object.fromEntries(await Promise.all(["fr", "en"].map(async (locale) => [locale, JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))])));
function keys(value, prefix = "", result = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") keys(child, path, result);
    else result.push(path);
  }
  return result;
}
const fr = keys(catalogs.fr);
const en = keys(catalogs.en);
const missingFromEnglish = fr.filter((key) => !en.includes(key));
const missingFromFrench = en.filter((key) => !fr.includes(key));
if (missingFromEnglish.length || missingFromFrench.length) {
  console.error("Translation catalogs are not structurally equivalent.", { missingFromEnglish, missingFromFrench });
  process.exitCode = 1;
} else {
  console.log(`Translation parity verified (${fr.length} keys per locale).`);
}
