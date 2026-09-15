import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requireServiceDb } from "@/db";
import { billingAccounts, costEntries, providers } from "@/db/schema";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { assertManualCostPeriodOpen, matchingInvoice, recordManualInvoice } from "./reconciliation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const period = { periodStart: new Date("2026-06-01T00:00:00Z"), periodEnd: new Date("2026-07-01T00:00:00Z") };
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("invoice reconciliation under real tenant permissions", () => {
  async function account() {
    const [provider] = await requireServiceDb().select().from(providers).where(eq(providers.slug, "vercel"));
    const [row] = await requireServiceDb().insert(billingAccounts).values({workspaceId, providerId: provider.id, name: `Invoice test ${randomUUID()}`}).returning();
    return row;
  }
  it("is idempotent under concurrent submissions and rejects changed totals", async () => {
    const row = await account();
    const input = {...period, billingAccountId: row.id, invoiceNumber: "INV-001", issuedAt: period.periodEnd, totalMinor: 1200n, currency: "EUR"};
    const ids = await Promise.all([1, 2].map(() => withAuthorizedWorkspace(workspaceId, db => recordManualInvoice(db, workspaceId, input))));
    expect(ids[0]).toBe(ids[1]);
    await expect(withAuthorizedWorkspace(workspaceId, db => recordManualInvoice(db, workspaceId, {...input, totalMinor: 1300n}))).rejects.toThrow("INVOICE_CONFLICT");
    const entries = await requireServiceDb().select().from(costEntries).where(eq(costEntries.billingAccountId, row.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].amountMinor).toBe(1200n);
  });
  it("preserves and supersedes covered accruals, including future sync matching", async () => {
    const row = await account();
    await requireServiceDb().insert(costEntries).values({workspaceId, billingAccountId: row.id, ...period, currency: "EUR", amountMinor: 1100n, kind: "usage", amountStatus: "accrued", amountBasis: "provider_charge"});
    const id = await withAuthorizedWorkspace(workspaceId, db => recordManualInvoice(db, workspaceId, {...period, billingAccountId: row.id, invoiceNumber: "INV-002", issuedAt: period.periodEnd, totalMinor: 1200n, currency: "EUR"}));
    const entries = await requireServiceDb().select().from(costEntries).where(and(eq(costEntries.workspaceId, workspaceId), eq(costEntries.billingAccountId, row.id)));
    expect(entries).toHaveLength(2);
    expect(entries.find(entry => entry.amountStatus === "accrued")?.supersededByInvoiceId).toBe(id);
    expect(entries.filter(entry => !entry.supersededAt).reduce((sum,entry) => sum + entry.amountMinor,0n)).toBe(1200n);
    expect(matchingInvoice([{id, ...period, currency: "EUR"}], {...period, currency: "EUR"})?.id).toBe(id);
  });
  it("refuses to erase the uncovered part of a longer accrual", async () => {
    const row = await account();
    await requireServiceDb().insert(costEntries).values({workspaceId, billingAccountId: row.id, ...period, currency: "EUR", amountMinor: 1100n, kind: "usage", amountStatus: "accrued", amountBasis: "provider_charge"});
    await expect(withAuthorizedWorkspace(workspaceId, db => recordManualInvoice(db, workspaceId, {...period, periodEnd: new Date("2026-06-15T00:00:00Z"), billingAccountId: row.id, invoiceNumber: "INV-003", issuedAt: period.periodEnd, totalMinor: 500n, currency: "EUR"}))).rejects.toThrow("PARTIAL_COVERAGE");
    const entries = await requireServiceDb().select().from(costEntries).where(eq(costEntries.billingAccountId, row.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].supersededAt).toBeNull();
  });
  it("rejects an account owned by another workspace", async () => {
    const row = await account();
    const other = "00000000-0000-4000-8000-000000000099";
    await expect(withAuthorizedWorkspace(other, db => recordManualInvoice(db, other, {...period, billingAccountId: row.id, invoiceNumber: "INV-004", issuedAt: period.periodEnd, totalMinor: 500n, currency: "EUR"}))).rejects.toThrow("ACCOUNT_UNAVAILABLE");
  });
  it("rejects manual additions to a closed invoice period but allows the next period", async () => {
    const row = await account();
    await withAuthorizedWorkspace(workspaceId, db => recordManualInvoice(db, workspaceId, {...period, billingAccountId: row.id, invoiceNumber: "INV-CLOSED", issuedAt: period.periodEnd, totalMinor: 500n, currency: "EUR"}));
    await expect(withAuthorizedWorkspace(workspaceId, db => assertManualCostPeriodOpen(db, workspaceId, {...period, billingAccountId: row.id, currency: "EUR"}))).rejects.toThrow("CLOSED_PERIOD");
    await expect(withAuthorizedWorkspace(workspaceId, db => assertManualCostPeriodOpen(db, workspaceId, {periodStart: period.periodEnd, periodEnd: new Date("2026-08-01T00:00:00Z"), billingAccountId: row.id, currency: "EUR"}))).resolves.toBeUndefined();
  });
});
