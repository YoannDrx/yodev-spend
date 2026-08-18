import { describe, expect, it } from "vitest";
import { commercialPlanCatalog } from "./catalog";

describe("commercial plan catalog", () => {
  it("uses exact approved prices and annual discounts", () => {
    const solo = commercialPlanCatalog.find((plan) => plan.code === "solo")!;
    const studio = commercialPlanCatalog.find((plan) => plan.code === "studio")!;
    expect(solo.monthlyPriceMinor).toBe(1_900n);
    expect(solo.annualPriceMinor).toBe(18_240n);
    expect(studio.monthlyPriceMinor).toBe(4_900n);
    expect(studio.annualPriceMinor).toBe(47_040n);
    expect(solo.annualPriceMinor * 100n).toBe(solo.monthlyPriceMinor * 12n * 80n);
    expect(studio.annualPriceMinor * 100n).toBe(studio.monthlyPriceMinor * 12n * 80n);
  });

  it("keeps the core recommendation engine available on both plans", () => {
    expect(commercialPlanCatalog.every((plan) => plan.historyMonths >= 12)).toBe(true);
    expect(commercialPlanCatalog.find((plan) => plan.code === "studio")?.features.collaboration).toBe(true);
    expect(commercialPlanCatalog.find((plan) => plan.code === "solo")?.features.collaboration).toBe(false);
  });
});
