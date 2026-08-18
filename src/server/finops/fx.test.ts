import { describe, expect, it } from "vitest";
import { convertMinorWithRate, findRateAtOrBefore, type AuditedFxRate } from "./fx";

const rate = (date: string, value: bigint): AuditedFxRate => ({ baseCurrency: "EUR", quoteCurrency: "USD", rateScaled: value, rateScale: 8, rateAt: new Date(date), source: "ecb", sourceUrl: "https://www.ecb.europa.eu/" });

describe("audited FX conversion", () => {
  it("converts source minor units without floating-point arithmetic", () => {
    expect(convertMinorWithRate(1_381n, "USD", "EUR", rate("2026-08-01", 114_850_000n))).toBe(1_202n);
    expect(convertMinorWithRate(-1_381n, "USD", "EUR", rate("2026-08-01", 114_850_000n))).toBe(-1_202n);
  });

  it("uses the latest earlier business-day rate", () => {
    const rates = [rate("2026-08-14", 115_000_000n), rate("2026-08-17", 116_000_000n)];
    expect(findRateAtOrBefore(rates, "USD", "EUR", new Date("2026-08-16"))?.rateAt.toISOString().slice(0, 10)).toBe("2026-08-14");
  });
});
