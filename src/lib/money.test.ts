import { describe, expect, it } from "vitest";
import { currencyFractionDigits, formatMinorUnits, parseMoneyInput } from "./money";

describe("exact currency display", () => {
  it("accepts decimal entry with French or English punctuation without float arithmetic", () => {
    expect(parseMoneyInput("19,99","EUR")).toBe(1999n);
    expect(parseMoneyInput("19.99","EUR")).toBe(1999n);
    expect(parseMoneyInput("100","JPY")).toBe(100n);
    expect(parseMoneyInput("1.234","KWD")).toBe(1234n);
    expect(()=>parseMoneyInput("1.001","EUR")).toThrow("PRECISION");
    expect(()=>parseMoneyInput("1,234.50","USD")).toThrow("INVALID");
  });
  it("respects zero, two and three decimal currencies", () => {
    expect(formatMinorUnits(123n, "JPY", "en")).toBe("JP¥123");
    expect(formatMinorUnits(123n, "EUR", "en")).toBe("€1.23");
    expect(formatMinorUnits(1234n, "KWD", "en")).toContain("1.234");
    expect(currencyFractionDigits("TND")).toBe(3);
    expect(currencyFractionDigits("KRW")).toBe(0);
  });
  it("preserves cents beyond the JavaScript safe integer range", () => {
    expect(formatMinorUnits(900719925474099399n, "EUR", "en")).toBe("€9,007,199,254,740,993.99");
  });
  it("preserves negative credits smaller than one currency unit", () => {
    expect(formatMinorUnits(-1n, "EUR", "en")).toBe("-€0.01");
    expect(formatMinorUnits(-123n, "EUR", "en")).toBe("-€1.23");
  });
  it("rejects already imprecise numeric inputs", () => {
    expect(() => formatMinorUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
