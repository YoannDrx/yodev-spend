import { describe, expect, it } from "vitest";
import { allocateLedgerCosts, allocationTotals } from "./ledger-allocation";

const start = new Date("2026-08-01T00:00:00.000Z");
const end = new Date("2026-09-01T00:00:00.000Z");

describe("allocateLedgerCosts", () => {
  it("keeps provider totals equal to project plus unallocated totals", () => {
    const costs = [
      { id: "direct", billingAccountId: "account", externalResourceId: null, projectId: "a", amountMinor: 1_381n, currency: "EUR", periodStart: start, periodEnd: end },
      { id: "shared", billingAccountId: "account", externalResourceId: null, projectId: null, amountMinor: 2_000n, currency: "EUR", periodStart: start, periodEnd: end },
      { id: "unmapped", billingAccountId: "other", externalResourceId: null, projectId: null, amountMinor: 500n, currency: "EUR", periodStart: start, periodEnd: end },
    ];
    const rules = ["a", "b", "c"].map((projectId, index) => ({
      billingAccountId: "account",
      projectId,
      allocationBps: [3_334, 3_333, 3_333][index],
      allocationMethod: "equal" as const,
      effectiveFrom: start,
      effectiveTo: null,
    }));
    const allocations = allocateLedgerCosts(costs, [], rules);
    const totals = allocationTotals(allocations);
    const projectTotal = [...totals.projects.values()].flatMap((currencies) => [...currencies.values()]).reduce((sum, amount) => sum + amount, 0n);
    const unallocatedTotal = [...totals.unallocated.values()].reduce((sum, amount) => sum + amount, 0n);
    expect(projectTotal + unallocatedTotal).toBe(3_881n);
    expect(totals.unallocated.get("EUR")).toBe(500n);
  });

  it("does not fall back to an account rule for an unmapped provider resource", () => {
    const allocations = allocateLedgerCosts([
      { id: "resource", billingAccountId: "account", externalResourceId: "resource", projectId: null, amountMinor: 100n, currency: "USD", periodStart: start, periodEnd: end },
    ], [], [{ billingAccountId: "account", projectId: "a", allocationBps: 10_000, allocationMethod: "equal", effectiveFrom: start, effectiveTo: null }]);
    expect(allocations).toEqual([{ costId: "resource", projectId: null, amountMinor: 100n, currency: "USD", allocationMethod: "unallocated" }]);
  });
});
