import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireServiceDb, type SpendTransaction } from "@/db";
import { getWorkspaceEntitlements } from "@/server/commercial/plans";
import { dataDeletionJobs, workspaceProfiles } from "@/db/schema";

export function lockWorkspaceLifecycle(db: SpendTransaction, workspaceId: string) {
  return db.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-lifecycle:${workspaceId}`}))`);
}

/** Serializes provider jobs with termination; no job may outlive credential revocation. */
export function withActiveWorkspaceJob<T>(workspaceId: string, work: () => Promise<T>) {
  return requireServiceDb().transaction(async db=>{
    const lock=await db.execute<{acquired:boolean}>(sql`select pg_try_advisory_xact_lock(hashtext(${`spend-lifecycle:${workspaceId}`})) as acquired`);
    if(!lock.rows[0]?.acquired)throw new Error("WORKSPACE_JOB_ALREADY_RUNNING");
    const [workspace]=await db.select({status:workspaceProfiles.commercialStatus}).from(workspaceProfiles).where(eq(workspaceProfiles.id,workspaceId));
    const [deletion]=await db.select({id:dataDeletionJobs.id}).from(dataDeletionJobs).where(and(eq(dataDeletionJobs.workspaceId,workspaceId),inArray(dataDeletionJobs.status,["scheduled","export_window","purging","failed","completed"])));
    if(!workspace||!["private","active","trialing","past_due"].includes(workspace.status)||deletion)throw new Error("WORKSPACE_PROCESSING_DISABLED");
    if(workspace.status==="past_due"&&(await getWorkspaceEntitlements(workspaceId,db)).code==="inactive")throw new Error("WORKSPACE_PROCESSING_DISABLED");
    return work();
  });
}
