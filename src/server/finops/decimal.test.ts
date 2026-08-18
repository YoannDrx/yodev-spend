import { describe, expect, it } from "vitest";
import { decimalToMinorUnits, formatScaledDecimal, parseScaledDecimal, rescaleDecimal } from "./decimal";

describe("provider decimal precision", () => {
  it("preserves the exact provider value before converting to minor units", () => {
    expect(decimalToMinorUnits("12.345678", "EUR")).toEqual({
      amountMinor: 1235n,
      exactAmountScaled: 12345678n,
      exactAmountScale: 6,
    });
  });

  it("rounds halves away from zero deterministically", () => {
    expect(rescaleDecimal(parseScaledDecimal("1.005"), 2)).toEqual({ value: 101n, scale: 2 });
    expect(rescaleDecimal(parseScaledDecimal("-1.005"), 2)).toEqual({ value: -101n, scale: 2 });
  });

  it("supports currencies without two fraction digits", () => {
    expect(decimalToMinorUnits("125.6", "JPY").amountMinor).toBe(126n);
    expect(decimalToMinorUnits("1.2345", "KWD").amountMinor).toBe(1235n);
  });

  it("preserves scientific notation without floating point", () => {
    expect(parseScaledDecimal("1e-7")).toEqual({ value: 1n, scale: 7 });
    expect(parseScaledDecimal("1.25e3")).toEqual({ value: 1250n, scale: 0 });
    expect(() => parseScaledDecimal("0.1234567890123456789")).toThrow("between 0 and 18");
  });

  it("formats a scaled integer without floating point", () => {
    expect(formatScaledDecimal({ value: -123n, scale: 2 })).toBe("-1.23");
  });
});
