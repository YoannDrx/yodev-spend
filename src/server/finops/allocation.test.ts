import { describe, expect, it } from "vitest";
import { allocateDatedCost, type AllocationRule } from "./allocation";

const august = new Date("2026-08-01T00:00:00.000Z");
const september = new Date("2026-09-01T00:00:00.000Z");

function rule(projectId: string, allocationBps: number, effectiveFrom = august, effectiveTo: Date | null = null): AllocationRule {
  return { projectId, allocationBps, allocationMethod: "manual", effectiveFrom, effectiveTo };
}

describe("allocateDatedCost", () => {
  it("preserves every cent using stable largest remainders", () => {
    const result = allocateDatedCost(2_000n, august, september, [rule("a", 3_334), rule("b", 3_333), rule("c", 3_333)]);
    expect(result).toEqual([
      { projectId: "a", amountMinor: 667n, allocationMethod: "manual" },
      { projectId: "b", amountMinor: 667n, allocationMethod: "manual" },
      { projectId: "c", amountMinor: 666n, allocationMethod: "manual" },
    ]);
    expect(result.reduce((sum, share) => sum + share.amountMinor, 0n)).toBe(2_000n);
  });

  it("keeps uncovered amounts explicitly unallocated", () => {
    const result = allocateDatedCost(1_381n, august, september, [rule("project", 4_000)]);
    expect(result).toEqual([
      { projectId: "project", amountMinor: 552n, allocationMethod: "manual" },
      { projectId: null, amountMinor: 829n, allocationMethod: "unallocated" },
    ]);
  });

  it("applies old and new rules to their effective periods", () => {
    const middle = new Date("2026-08-16T12:00:00.000Z");
    const result = allocateDatedCost(3_100n, august, september, [
      rule("old", 10_000, august, middle),
      rule("new", 10_000, middle),
    ]);
    expect(result).toEqual([
      { projectId: "old", amountMinor: 1_550n, allocationMethod: "manual" },
      { projectId: "new", amountMinor: 1_550n, allocationMethod: "manual" },
    ]);
  });

  it("preserves negative credits", () => {
    const result = allocateDatedCost(-101n, august, september, [rule("a", 5_000), rule("b", 5_000)]);
    expect(result.reduce((sum, share) => sum + share.amountMinor, 0n)).toBe(-101n);
    expect(result).toEqual([
      { projectId: "a", amountMinor: -51n, allocationMethod: "manual" },
      { projectId: "b", amountMinor: -50n, allocationMethod: "manual" },
    ]);
  });

  it("rejects overlapping rules above 100 percent", () => {
    expect(() => allocateDatedCost(100n, august, september, [rule("a", 6_000), rule("b", 5_000)])).toThrow(/exceed/);
  });
});
