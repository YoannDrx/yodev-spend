import { describe, expect, it } from "vitest";
import { convertCostsForReporting } from "./reporting";

describe("reporting conversion", () => {
  it("derives reporting amounts while preserving input ledger rows", () => {
    const source = [{ id: "usd", amountMinor: 1_381n, currency: "USD", periodStart: new Date("2026-08-16") }];
    const result = convertCostsForReporting(source, [{ baseCurrency: "EUR", quoteCurrency: "USD", rateScaled: 114_850_000n, rateScale: 8, rateAt: new Date("2026-08-14"), source: "ecb", sourceUrl: "https://www.ecb.europa.eu/" }], "EUR");
    expect(result.converted[0]).toMatchObject({ amountMinor: 1_202n, currency: "EUR" });
    expect(source[0]).toMatchObject({ amountMinor: 1_381n, currency: "USD" });
    expect(result.appliedRates).toHaveLength(1);
  });
});
