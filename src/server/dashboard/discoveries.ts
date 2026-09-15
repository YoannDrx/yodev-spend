import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";
import { detectionEvidence, projectIntegrations, projects, providers, repositories } from "@/db/schema";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export async function getDiscoveryInbox(workspaceId: string, requestedPage = 1, status: "pending" | "confirmed" | "ignored" = "pending") {
  return withAuthorizedWorkspace(workspaceId, async db => {
    const condition = and(eq(projectIntegrations.workspaceId,workspaceId),eq(projectIntegrations.reviewStatus,status));
    const [total] = await db.select({value: count()}).from(projectIntegrations).where(condition);
    const pageCount = Math.max(1,Math.ceil(total.value / 25));
    const page = Math.min(pageCount,Math.max(1,Number.isSafeInteger(requestedPage) ? requestedPage : 1));
    const rows = await db.select({id:projectIntegrations.id,provider:providers.name,project:projects.name,confidence:projectIntegrations.confidence}).from(projectIntegrations).innerJoin(providers,eq(providers.id,projectIntegrations.providerId)).innerJoin(projects,and(eq(projects.id,projectIntegrations.projectId),eq(projects.workspaceId,workspaceId))).where(condition).orderBy(desc(projectIntegrations.firstDetectedAt),projectIntegrations.id).limit(25).offset((page-1)*25);
    const evidence = rows.length ? await db.select({integrationId:projectIntegrations.id,key:detectionEvidence.key,filePath:detectionEvidence.filePath}).from(projectIntegrations).innerJoin(repositories,and(eq(repositories.projectId,projectIntegrations.projectId),eq(repositories.workspaceId,workspaceId))).innerJoin(detectionEvidence,and(eq(detectionEvidence.repositoryId,repositories.id),eq(detectionEvidence.providerId,projectIntegrations.providerId),eq(detectionEvidence.workspaceId,workspaceId))).where(and(eq(projectIntegrations.workspaceId,workspaceId),inArray(projectIntegrations.id,rows.map(row=>row.id)))).orderBy(desc(detectionEvidence.createdAt)).limit(500) : [];
    return {page,pageCount,total:total.value,status,discoveries:rows.map(row=>({...row,evidence:[...new Set(evidence.filter(item=>item.integrationId===row.id).map(item=>`${item.filePath ?? "manual"} → ${item.key}`))].slice(0,8)}))};
  });
}
