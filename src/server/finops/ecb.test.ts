import { describe, expect, it } from "vitest";
import { parseEcbReferenceRates } from "./ecb";

describe("ECB rate parsing", () => {
  it("normalizes quoted EUR rates to scaled integers", () => {
    const rates = parseEcbReferenceRates("<Cube><Cube time='2026-08-14'><Cube currency='USD' rate='1.1485'/><Cube currency='JPY' rate='184.03'/></Cube></Cube>");
    expect(rates).toEqual([
      { baseCurrency: "EUR", quoteCurrency: "USD", rateScaled: 114_850_000n, rateScale: 8, rateAt: new Date("2026-08-14T00:00:00.000Z") },
      { baseCurrency: "EUR", quoteCurrency: "JPY", rateScaled: 18_403_000_000n, rateScale: 8, rateAt: new Date("2026-08-14T00:00:00.000Z") },
    ]);
  });
});
