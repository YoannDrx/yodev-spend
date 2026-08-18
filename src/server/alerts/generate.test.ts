import { describe, expect, it } from "vitest";
import { isRenewalSoon } from "./rules";

describe("lifecycle alert scheduling", () => {
  const now = new Date("2026-08-16T00:00:00.000Z");
  it("includes only future renewals inside the configured window", () => {
    expect(isRenewalSoon(new Date("2026-08-17T00:00:00.000Z"), now)).toBe(true);
    expect(isRenewalSoon(new Date("2026-09-15T00:00:00.000Z"), now)).toBe(true);
    expect(isRenewalSoon(new Date("2026-09-16T00:00:01.000Z"), now)).toBe(false);
    expect(isRenewalSoon(now, now)).toBe(false);
    expect(isRenewalSoon(null, now)).toBe(false);
  });
});
