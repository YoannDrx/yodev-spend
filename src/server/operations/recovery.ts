import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { requireServiceDb } from "@/db";
import { connectorSyncRuns, scanRuns } from "@/db/schema";
import { recordAuditEvent } from "@/server/audit";

export async function recoverAbandonedRuns(now = new Date()) {
  const db=requireServiceDb();
  const cutoff=new Date(now.getTime()-30*60*1000);
  const scans=await db.select({workspaceId:scanRuns.workspaceId}).from(scanRuns).where(and(inArray(scanRuns.status,["pending","running"]),lt(scanRuns.updatedAt,cutoff))).limit(50);
  const syncs=await db.select({workspaceId:connectorSyncRuns.workspaceId}).from(connectorSyncRuns).where(and(inArray(connectorSyncRuns.status,["pending","running"]),lt(connectorSyncRuns.updatedAt,cutoff))).limit(50);
  let recovered=0;
  for(const workspaceId of new Set([...scans,...syncs].map(row=>row.workspaceId))) {
    recovered+=await db.transaction(async tx=>{
      // An active worker owns this lock. Never abandon a worker still using its connection.
      const result=await tx.execute<{acquired:boolean}>(sql`select pg_try_advisory_xact_lock(hashtext(${`spend-lifecycle:${workspaceId}`})) as acquired`);
      if(!result.rows[0]?.acquired)return 0;
      const staleScans=await tx.update(scanRuns).set({status:"failed",errorCode:"WORKER_INTERRUPTED",errorMessage:"The worker ended before completion; retry is available.",completedAt:now,updatedAt:now}).where(and(eq(scanRuns.workspaceId,workspaceId),inArray(scanRuns.status,["pending","running"]),lt(scanRuns.updatedAt,cutoff))).returning({id:scanRuns.id});
      const staleSyncs=await tx.update(connectorSyncRuns).set({status:"failed",errorCode:"WORKER_INTERRUPTED",errorMessage:"The worker ended before completion; retry is available.",nextRetryAt:now,completedAt:now,updatedAt:now}).where(and(eq(connectorSyncRuns.workspaceId,workspaceId),inArray(connectorSyncRuns.status,["pending","running"]),lt(connectorSyncRuns.updatedAt,cutoff))).returning({id:connectorSyncRuns.id});
      const count=staleScans.length+staleSyncs.length;
      if(count)await recordAuditEvent({workspaceId,actorType:"system",action:"operations.abandoned_runs_recovered",metadata:{scans:staleScans.length,syncs:staleSyncs.length}},tx);
      return count;
    });
  }
  return recovered;
}
