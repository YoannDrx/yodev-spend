import "server-only";

import { fxRates } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { parseScaledDecimal, rescaleDecimal } from "./decimal";

export const ECB_90_DAY_XML_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const RATE_SCALE = 8;

export function parseEcbReferenceRates(xml: string) {
  const rates: Array<{ baseCurrency: string; quoteCurrency: string; value: bigint; scale: number; rateAt: Date }> = [];
  const dayPattern = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g;
  for (const day of xml.matchAll(dayPattern)) {
    const rateAt = new Date(`${day[1]}T00:00:00.000Z`);
    const ratePattern = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9]+(?:\.[0-9]+)?)['"]\s*\/?\s*>/g;
    for (const item of day[2].matchAll(ratePattern)) {
      rates.push({
        baseCurrency: "EUR",
        quoteCurrency: item[1],
        ...rescaleDecimal(parseScaledDecimal(item[2]), RATE_SCALE),
        rateAt,
      });
    }
  }
  return rates.map(({ value, scale, ...rate }) => ({ ...rate, rateScaled: value, rateScale: scale }));
}

export async function syncEcbReferenceRates(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(ECB_90_DAY_XML_URL, { headers: { accept: "application/xml" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`ECB reference-rate request failed with status ${response.status}.`);
  const xml = await response.text();
  if (xml.length > 5_000_000) throw new Error("ECB reference-rate response exceeded the size limit.");
  const rates = parseEcbReferenceRates(xml);
  if (rates.length === 0) throw new Error("ECB reference-rate response contained no rates.");
  const retrievedAt = new Date();
  const db = requireServiceDb();
  for (const rate of rates) {
    await db.insert(fxRates).values({ ...rate, source: "ecb", sourceUrl: ECB_90_DAY_XML_URL, retrievedAt }).onConflictDoUpdate({
      target: [fxRates.baseCurrency, fxRates.quoteCurrency, fxRates.rateAt, fxRates.source],
      set: { rateScaled: rate.rateScaled, rateScale: rate.rateScale, sourceUrl: ECB_90_DAY_XML_URL, retrievedAt },
    });
  }
  return rates.length;
}
