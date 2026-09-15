import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requireServiceDb } from "@/db";
import * as s from "@/db/schema";
import { exportWorkspace } from "@/server/exports/workspace";
import { withWorkspaceMutation } from "@/server/auth/workspace-transaction";
import { withActiveWorkspaceJob } from "@/server/operations/workspace-lock";
import { cancelWorkspaceDeletion, purgeWorkspaceJob, requestWorkspaceDeletion } from "./deletion";
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
const now=new Date();
const later=new Date(now.getTime()+31*86400000);
const db=requireServiceDb;
async function fixture() {
  const id=randomUUID(),userId=randomUUID(),organizationId=randomUUID();
  await db().insert(s.authUsers).values({id:userId,name:"Privacy test",email:`${userId}@example.invalid`,emailVerified:true});
  await db().insert(s.authOrganizations).values({id:organizationId,name:"Privacy",slug:id});
  await db().insert(s.authMembers).values({id:randomUUID(),userId,organizationId,role:"owner"});
  await db().insert(s.workspaceProfiles).values({id,organizationId,name:"Privacy",slug:id,commercialStatus:"private"});
  const [provider]=await db().select().from(s.providers).where(eq(s.providers.slug,"vercel"));
  const [connection]=await db().insert(s.providerConnections).values({workspaceId:id,providerId:provider.id,name:"Test",authType:"access_token",status:"active",credentialCiphertext:"fixture",credentialIv:"fixture",credentialTag:"fixture",capabilities:{accounts:true,resources:true,subscriptions:false,plans:false,usage:false,accruedCosts:false,invoices:false}}).returning();
  const [client]=await db().insert(s.clients).values({workspaceId:id,name:"Private client",slug:randomUUID()}).returning();
  const [project]=await db().insert(s.projects).values({workspaceId:id,clientId:client.id,name:"Private project",slug:randomUUID()}).returning();
  const [account]=await db().insert(s.billingAccounts).values({workspaceId:id,providerId:provider.id,connectionId:connection.id,clientId:client.id,ownerType:"client",name:"Private account"}).returning();
  await db().insert(s.costEntries).values({workspaceId:id,billingAccountId:account.id,projectId:project.id,amountMinor:100n,currency:"EUR",kind:"manual",periodStart:now,periodEnd:later});
  return {workspaceId:id,userId,organizationId,role:"owner",connection};
}
suite("tenant erasure lifecycle in PostgreSQL",()=>{
  it("rejects a forged owner, wrong confirmation and an active paid subscription",async()=>{
    const c=await fixture();
    await expect(requestWorkspaceDeletion({...c,userId:"seed-owner"},"Privacy",now)).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(requestWorkspaceDeletion(c,"wrong",now)).rejects.toThrow("CONFIRMATION_MISMATCH");
    const [plan]=await db().select().from(s.commercialPlans).limit(1);
    await db().insert(s.workspaceSubscriptions).values({workspaceId:c.workspaceId,commercialPlanId:plan.id,stripeCustomerId:`cus_${randomUUID()}`,stripeSubscriptionId:`sub_${randomUUID()}`,stripePriceId:"price_fixture",status:"active",billingInterval:"month"});
    await expect(requestWorkspaceDeletion(c,"Privacy",now)).rejects.toThrow("END_SUBSCRIPTION_BEFORE_DELETION");
  });
  it("revokes immediately, remains exportable, blocks writes/jobs and cancels without restoring secrets",async()=>{
    const c=await fixture();
    const job=await requestWorkspaceDeletion(c,"Privacy",now);
    expect((await requestWorkspaceDeletion(c,"Privacy",now)).id).toBe(job.id);
    const [connection]=await db().select().from(s.providerConnections).where(eq(s.providerConnections.id,c.connection.id));
    expect(connection.credentialCiphertext).toBeNull();expect(connection.status).toBe("archived");
    expect(JSON.parse(await exportWorkspace(c)).clients).toHaveLength(1);
    await expect(withWorkspaceMutation(c.workspaceId,async()=>true)).rejects.toThrow("WORKSPACE_READ_ONLY");
    await expect(withActiveWorkspaceJob(c.workspaceId,async()=>true)).rejects.toThrow("WORKSPACE_PROCESSING_DISABLED");
    expect(await purgeWorkspaceJob(job.id,now)).toBe(false);
    await cancelWorkspaceDeletion(c,job.id,now);
    expect(await withWorkspaceMutation(c.workspaceId,async()=>true)).toBe(true);
    expect((await db().select().from(s.providerConnections).where(eq(s.providerConnections.id,c.connection.id)))[0].credentialCiphertext).toBeNull();
  });
  it("purges only the requested tenant and leaves a minimal receipt, idempotently",async()=>{
    const c=await fixture(),other=await fixture();
    const job=await requestWorkspaceDeletion(c,"Privacy",now);
    expect(await purgeWorkspaceJob(job.id,later)).toBe(true);
    expect(await purgeWorkspaceJob(job.id,later)).toBe(true);
    for(const table of [s.clients,s.projects,s.billingAccounts,s.costEntries,s.providerConnections])expect(await db().select().from(table).where(eq(table.workspaceId,c.workspaceId))).toHaveLength(0);
    expect(await db().select().from(s.clients).where(eq(s.clients.workspaceId,other.workspaceId))).toHaveLength(1);
    expect(await db().select().from(s.authMembers).where(eq(s.authMembers.organizationId,c.organizationId))).toHaveLength(0);
    const audits=await db().select().from(s.auditEvents).where(eq(s.auditEvents.workspaceId,c.workspaceId));
    expect(audits).toHaveLength(1);expect(audits[0].action).toBe("privacy.business_data_purged");
    expect((await db().select().from(s.dataDeletionJobs).where(eq(s.dataDeletionJobs.id,job.id)))[0].status).toBe("completed");
  });
  it("closes exports at the deadline even when the purge worker has not run",async()=>{
    const c=await fixture();
    const old=new Date(now.getTime()-31*86400000);
    const job=await requestWorkspaceDeletion(c,"Privacy",old);
    await expect(exportWorkspace(c)).rejects.toThrow("EXPORT_WINDOW_EXPIRED");
    await expect(cancelWorkspaceDeletion(c,job.id,now)).rejects.toThrow("DELETION_CANNOT_BE_CANCELLED");
  });
});
