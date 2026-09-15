import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requireServiceDb } from "@/db";
import { billingAccounts, costEntries, invoices, providers } from "@/db/schema";
import { withWorkspaceMutation } from "@/server/auth/workspace-transaction";
import { correctManualEntry } from "./corrections";
import { recordManualInvoice } from "./reconciliation";
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
const workspaceId="00000000-0000-4000-8000-000000000001";
const period={periodStart:new Date("2026-06-01Z"),periodEnd:new Date("2026-07-01Z")};
suite("immutable financial corrections",()=>{
  async function fixture(source="manual") {
    const db=requireServiceDb();
    const [provider]=await db.select().from(providers).where(eq(providers.slug,"vercel"));
    const [account]=await db.insert(billingAccounts).values({workspaceId,providerId:provider.id,name:`Correction ${randomUUID()}`}).returning();
    const [entry]=await db.insert(costEntries).values({workspaceId,billingAccountId:account.id,...period,currency:"EUR",amountMinor:1200n,kind:"usage",amountStatus:"final",amountBasis:"manual",source}).returning();
    return {account,entry};
  }
  const input=(entryId:string,amountMinor:bigint|null)=>({workspaceId,userId:"seed-owner",entryId,amountMinor,reason:"Correction documentée"});
  it("keeps the original amount and permits only one concurrent replacement",async()=>{
    const {entry}=await fixture();
    const outcomes=await Promise.allSettled([1,2].map(()=>withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,input(entry.id,900n)))));
    expect(outcomes.filter(row=>row.status==="fulfilled")).toHaveLength(1);
    const rows=await requireServiceDb().select().from(costEntries).where(eq(costEntries.billingAccountId,entry.billingAccountId));
    expect(rows).toHaveLength(2);expect(rows.find(row=>row.id===entry.id)?.amountMinor).toBe(1200n);
    expect(rows.filter(row=>!row.supersededAt).map(row=>row.amountMinor)).toEqual([900n]);
  });
  it("voids a manual entry without deleting history and rejects provider entries",async()=>{
    const {entry}=await fixture();
    await withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,input(entry.id,null)));
    const [old]=await requireServiceDb().select().from(costEntries).where(eq(costEntries.id,entry.id));
    expect(old.supersededAt).not.toBeNull();expect(old.amountMinor).toBe(1200n);
    const provider=await fixture("vercel");
    await expect(withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,input(provider.entry.id,100n)))).rejects.toThrow("PROVIDER_ENTRY_NOT_EDITABLE");
  });
  it("rejects cross-workspace IDs and missing reasons",async()=>{
    const {entry}=await fixture();
    await expect(withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,{...input(entry.id,10n),workspaceId:randomUUID()}))).rejects.toThrow("ENTRY_NOT_FOUND");
    await expect(withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,{...input(entry.id,10n),reason:""}))).rejects.toThrow("CORRECTION_REASON_REQUIRED");
  });
  it("replaces a manual invoice while keeping covered accruals superseded",async()=>{
    const {account,entry:accrual}=await fixture();
    await requireServiceDb().update(costEntries).set({amountStatus:"accrued",amountBasis:"provider_charge"}).where(eq(costEntries.id,accrual.id));
    const invoiceId=await withWorkspaceMutation(workspaceId,tx=>recordManualInvoice(tx,workspaceId,{...period,billingAccountId:account.id,invoiceNumber:"CORRECT",issuedAt:period.periodEnd,totalMinor:1500n,currency:"EUR"}));
    const [entry]=await requireServiceDb().select().from(costEntries).where(eq(costEntries.invoiceId,invoiceId));
    await withWorkspaceMutation(workspaceId,tx=>correctManualEntry(tx,input(entry.id,1800n)));
    const rows=await requireServiceDb().select().from(invoices).where(eq(invoices.billingAccountId,account.id));
    expect(rows.find(row=>row.id===invoiceId)?.status).toBe("void");
    const active=rows.find(row=>row.status==="issued")!;expect(active.totalMinor).toBe(1800n);
    const entries=await requireServiceDb().select().from(costEntries).where(eq(costEntries.billingAccountId,account.id));
    expect(entries.filter(row=>!row.supersededAt).reduce((sum,row)=>sum+row.amountMinor,0n)).toBe(1800n);
    expect(entries.filter(row=>row.supersededAt).every(row=>row.supersededByInvoiceId===active.id)).toBe(true);
  });
});
