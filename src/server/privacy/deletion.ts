import "server-only";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { requireServiceDb, type SpendTransaction } from "@/db";
import * as s from "@/db/schema";
import type { WorkspaceContext } from "@/server/auth/context";
import { logEvent } from "@/server/logging";
import { assertWorkspaceRole } from "@/server/auth/authorization";
import { recordAuditEvent } from "@/server/audit";
import { lockWorkspaceLifecycle } from "@/server/operations/workspace-lock";

export const openStatuses = ["scheduled","export_window","purging","failed"] as const;
export const DELETION_GRACE_DAYS = 30;

async function assertOwner(db: SpendTransaction, context: WorkspaceContext) {
  assertWorkspaceRole(context.role,["owner"]);
  const [member]=await db.select({role:s.authMembers.role}).from(s.authMembers).innerJoin(s.workspaceProfiles,eq(s.workspaceProfiles.organizationId,s.authMembers.organizationId)).where(and(eq(s.authMembers.userId,context.userId),eq(s.workspaceProfiles.id,context.workspaceId)));
  if(!member)throw new Error("WORKSPACE_ACCESS_DENIED");
  assertWorkspaceRole(member.role,["owner"]);
}

export async function revokeWorkspaceConnections(db: SpendTransaction, workspaceId: string, now = new Date()) {
  await db.update(s.providerConnections).set({status:"archived",archivedAt:now,credentialCiphertext:null,credentialIv:null,credentialTag:null,credentialExpiresAt:null,updatedAt:now}).where(eq(s.providerConnections.workspaceId,workspaceId));
  await db.update(s.repositories).set({scanEnabled:false,archivedAt:now,updatedAt:now}).where(eq(s.repositories.workspaceId,workspaceId));
  await db.update(s.githubInstallations).set({status:"suspended",updatedAt:now}).where(eq(s.githubInstallations.workspaceId,workspaceId));
  await db.delete(s.githubInstallStates).where(eq(s.githubInstallStates.workspaceId,workspaceId));
}

export async function requestWorkspaceDeletion(context: WorkspaceContext, confirmation: string, now = new Date()) {
  return requireServiceDb().transaction(async db=>{
    await lockWorkspaceLifecycle(db,context.workspaceId);
    await assertOwner(db,context);
    const [workspace]=await db.select().from(s.workspaceProfiles).where(eq(s.workspaceProfiles.id,context.workspaceId)).for("update");
    if(confirmation!==workspace.name)throw new Error("WORKSPACE_CONFIRMATION_MISMATCH");
    const [existing]=await db.select().from(s.dataDeletionJobs).where(and(eq(s.dataDeletionJobs.workspaceId,context.workspaceId),inArray(s.dataDeletionJobs.status,[...openStatuses,"completed"])));
    if(existing)return existing;
    const [active]=await db.select({id:s.workspaceSubscriptions.id}).from(s.workspaceSubscriptions).where(and(eq(s.workspaceSubscriptions.workspaceId,context.workspaceId),inArray(s.workspaceSubscriptions.status,["trialing","active","past_due","unpaid","incomplete"])));
    if(active)throw new Error("END_SUBSCRIPTION_BEFORE_DELETION");
    const deadline=new Date(now.getTime()+DELETION_GRACE_DAYS*86400000);
    await revokeWorkspaceConnections(db,context.workspaceId,now);
    await db.update(s.workspaceProfiles).set({commercialStatus:"deletion_scheduled",updatedAt:now}).where(eq(s.workspaceProfiles.id,context.workspaceId));
    const [job]=await db.insert(s.dataDeletionJobs).values({workspaceId:context.workspaceId,requestedByUserId:context.userId,status:"export_window",credentialsRevokedAt:now,exportAvailableUntil:deadline,purgeScheduledAt:deadline}).returning();
    await recordAuditEvent({...context,actorType:"user",actorUserId:context.userId,action:"privacy.deletion_requested",targetType:"deletion_job",targetId:job.id,metadata:{previousStatus:workspace.commercialStatus,graceDays:DELETION_GRACE_DAYS}},db);
    return job;
  });
}

export async function cancelWorkspaceDeletion(context: WorkspaceContext, jobId: string, now = new Date()) {
  return requireServiceDb().transaction(async db=>{
    await lockWorkspaceLifecycle(db,context.workspaceId); await assertOwner(db,context);
    const [job]=await db.select().from(s.dataDeletionJobs).where(and(eq(s.dataDeletionJobs.workspaceId,context.workspaceId),eq(s.dataDeletionJobs.id,jobId))).for("update");
    if(!job||!["scheduled","export_window","failed"].includes(job.status)||job.purgeScheduledAt<=now)throw new Error("DELETION_CANNOT_BE_CANCELLED");
    const [request]=await db.select({metadata:s.auditEvents.metadata}).from(s.auditEvents).where(and(eq(s.auditEvents.workspaceId,context.workspaceId),eq(s.auditEvents.targetId,job.id),eq(s.auditEvents.action,"privacy.deletion_requested"))).limit(1);
    await db.update(s.dataDeletionJobs).set({status:"cancelled",updatedAt:now}).where(eq(s.dataDeletionJobs.id,job.id));
    await db.update(s.workspaceProfiles).set({commercialStatus:request?.metadata.previousStatus==="private"?"private":"cancelled",updatedAt:now}).where(eq(s.workspaceProfiles.id,context.workspaceId));
    await recordAuditEvent({workspaceId:context.workspaceId,actorType:"user",actorUserId:context.userId,action:"privacy.deletion_cancelled",targetId:job.id},db);
  });
}

export async function getDeletionStatus(workspaceId: string) {
  const [job]=await requireServiceDb().select().from(s.dataDeletionJobs).where(eq(s.dataDeletionJobs.workspaceId,workspaceId)).orderBy(desc(s.dataDeletionJobs.createdAt)).limit(1);
  return job??null;
}

/** Explicit erasure request is the sole exception to ordinary archive-only business operations. */
export async function purgeWorkspaceJob(jobId: string, now = new Date()) {
  const db=requireServiceDb();
  const [candidate]=await db.select().from(s.dataDeletionJobs).where(eq(s.dataDeletionJobs.id,jobId));
  if(!candidate)return false;
  try {
    return await db.transaction(async tx=>{
      const id=candidate.workspaceId;
      await lockWorkspaceLifecycle(tx,id);
      const [job]=await tx.select().from(s.dataDeletionJobs).where(and(eq(s.dataDeletionJobs.workspaceId,id),eq(s.dataDeletionJobs.id,jobId))).for("update");
      if(job.status==="completed")return true;
      if(!openStatuses.includes(job.status as typeof openStatuses[number])||job.purgeScheduledAt>now)return false;
      const [workspace]=await tx.select().from(s.workspaceProfiles).where(eq(s.workspaceProfiles.id,id)).for("update");
      if(workspace.commercialStatus!=="deletion_scheduled")throw new Error("DELETION_STATE_MISMATCH");
      await tx.update(s.dataDeletionJobs).set({status:"purging",updatedAt:now}).where(eq(s.dataDeletionJobs.id,job.id));
      await revokeWorkspaceConnections(tx,id,now);
      // All tenant business data is in PostgreSQL. Commercial seller records are separate.
      const tables=[s.alerts,s.optimizationFindings,s.usageSamples,s.costEntries,s.invoiceLines,s.invoices,s.subscriptions,
        s.billingAccountProjects,s.externalResourceProjects,s.billingAccounts,s.externalResources,s.providerPlanVersions,
        s.connectorSyncRuns,s.providerConnections,s.integrationEvents,s.projectIntegrations,s.detectionEvidence,
        s.repositoryProviderObservations,s.scanRuns,s.repositories,s.githubInstallStates,s.githubInstallations,s.projects,s.clients,s.workspaceQuotaStates];
      for(const table of tables)await tx.delete(table).where(eq(table.workspaceId,id));
      await tx.delete(s.authInvitations).where(eq(s.authInvitations.organizationId,workspace.organizationId));
      await tx.delete(s.authMembers).where(eq(s.authMembers.organizationId,workspace.organizationId));
      await tx.update(s.authSessions).set({activeOrganizationId:null,updatedAt:now}).where(eq(s.authSessions.activeOrganizationId,workspace.organizationId));
      await tx.delete(s.betaInvitations).where(eq(s.betaInvitations.workspaceId,id));
      await tx.update(s.authOrganizations).set({slug:`deleted-${id}`,name:"Deleted workspace",logo:null,metadata:null,updatedAt:now}).where(eq(s.authOrganizations.id,workspace.organizationId));
      await tx.delete(s.auditEvents).where(eq(s.auditEvents.workspaceId,id));
      const [remainingAudit]=await tx.select({id:s.auditEvents.id}).from(s.auditEvents).where(eq(s.auditEvents.workspaceId,id)).limit(1);
      if(remainingAudit)throw new Error("AUDIT_ERASURE_POLICY_REQUIRED");
      await tx.update(s.workspaceProfiles).set({slug:`deleted-${id}`,name:"Deleted workspace",commercialStatus:"cancelled",updatedAt:now}).where(eq(s.workspaceProfiles.id,id));
      await recordAuditEvent({workspaceId:id,actorType:"system",action:"privacy.business_data_purged",targetId:job.id,metadata:{version:1,stores:"postgresql",retained:"seller_billing_and_terms",backupPolicy:"operator_verification_required"}},tx);
      await tx.update(s.dataDeletionJobs).set({status:"completed",completedAt:now,errorCode:null,updatedAt:now}).where(eq(s.dataDeletionJobs.id,job.id));
      return true;
    });
  }catch{
    logEvent("privacy_purge_failed",{workspaceId:candidate.workspaceId,errorCode:"PURGE_REQUIRES_RETRY"});
    await db.update(s.dataDeletionJobs).set({status:"failed",errorCode:"PURGE_REQUIRES_RETRY",updatedAt:now}).where(and(eq(s.dataDeletionJobs.id,jobId),inArray(s.dataDeletionJobs.status,[...openStatuses])));
    return false;
  }
}

export async function processDueDeletions(now = new Date()) {
  const due=await requireServiceDb().select({id:s.dataDeletionJobs.id}).from(s.dataDeletionJobs).where(and(inArray(s.dataDeletionJobs.status,[...openStatuses]),lte(s.dataDeletionJobs.purgeScheduledAt,now))).orderBy(s.dataDeletionJobs.purgeScheduledAt).limit(10);
  let completed=0;for(const job of due)if(await purgeWorkspaceJob(job.id,now))completed++;
  return {attempted:due.length,completed,failed:due.length-completed};
}

export async function getPrivacySummary(workspaceId: string) {
  const [workspace]=await requireServiceDb().select({name:s.workspaceProfiles.name}).from(s.workspaceProfiles).where(eq(s.workspaceProfiles.id,workspaceId));
  return {name:workspace?.name??"",job:await getDeletionStatus(workspaceId)};
}
