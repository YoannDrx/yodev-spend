import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requireServiceDb } from "@/db";
import { authOrganizations, workspaceProfiles, connectorSyncRuns, providerConnections, providers } from "@/db/schema";
import { withActiveWorkspaceJob } from "./workspace-lock";
import { recoverAbandonedRuns } from "./recovery";
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite("interrupted worker recovery",()=>{
  it("leaves a live locked worker alone, then recovers only abandoned runs",async()=>{
    const db=requireServiceDb();
    const workspaceId=randomUUID(),organizationId=randomUUID();
    await db.insert(authOrganizations).values({id:organizationId,name:"Recovery",slug:organizationId});
    await db.insert(workspaceProfiles).values({id:workspaceId,organizationId,name:"Recovery",slug:workspaceId,commercialStatus:"private"});
    const [provider]=await db.select().from(providers).where(eq(providers.slug,"vercel"));
    const [connection]=await db.insert(providerConnections).values({workspaceId,providerId:provider.id,name:`Recovery ${randomUUID()}`,authType:"manual",status:"active",capabilities:{accounts:false,resources:true,subscriptions:false,plans:false,usage:false,accruedCosts:false,invoices:false}}).returning();
    const old=new Date(Date.now()-60*60*1000);
    const [stale]=await db.insert(connectorSyncRuns).values({workspaceId,connectionId:connection.id,capability:"resources",status:"running",idempotencyKey:randomUUID(),updatedAt:old}).returning();
    const [fresh]=await db.insert(connectorSyncRuns).values({workspaceId,connectionId:connection.id,capability:"subscriptions",status:"running",idempotencyKey:randomUUID()}).returning();
    await withActiveWorkspaceJob(workspaceId,async()=>{
      await recoverAbandonedRuns();
      expect((await db.select().from(connectorSyncRuns).where(eq(connectorSyncRuns.id,stale.id)))[0].status).toBe("running");
      await expect(withActiveWorkspaceJob(workspaceId,async()=>true)).rejects.toThrow("WORKSPACE_JOB_ALREADY_RUNNING");
    });
    await recoverAbandonedRuns();
    const [result]=await db.select().from(connectorSyncRuns).where(eq(connectorSyncRuns.id,stale.id));
    expect(result.status).toBe("failed");expect(result.errorCode).toBe("WORKER_INTERRUPTED");expect(result.nextRetryAt).not.toBeNull();
    expect((await db.select().from(connectorSyncRuns).where(eq(connectorSyncRuns.id,fresh.id)))[0].status).toBe("running");
    await db.update(connectorSyncRuns).set({status:"failed"}).where(eq(connectorSyncRuns.id,fresh.id));
  });
  it("denies new provider work when payment no longer grants access",async()=>{
    const db=requireServiceDb(),workspaceId=randomUUID(),organizationId=randomUUID();
    await db.insert(authOrganizations).values({id:organizationId,name:"Expired",slug:organizationId});
    await db.insert(workspaceProfiles).values({id:workspaceId,organizationId,name:"Expired",slug:workspaceId,commercialStatus:"past_due"});
    await expect(withActiveWorkspaceJob(workspaceId,async()=>true)).rejects.toThrow("WORKSPACE_PROCESSING_DISABLED");
  });

});
