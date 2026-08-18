import "server-only";

import { auditEvents } from "@/db/schema";
import type { SpendExecutor } from "@/db";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

function sanitizeAuditMetadata(metadata: AuditMetadata = {}) {
  return Object.fromEntries(Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .slice(0, 30)
    .map(([key, value]) => [key.slice(0, 80), typeof value === "string" ? value.slice(0, 300) : value])) as Record<string, string | number | boolean | null>;
}

export async function recordAuditEvent(input: {
  workspaceId: string;
  actorType: "user" | "system" | "support";
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: AuditMetadata;
}, db?: Pick<SpendExecutor, "insert">) {
  const write = async (executor: Pick<SpendExecutor, "insert">) => executor.insert(auditEvents).values({
    workspaceId: input.workspaceId,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    action: input.action.slice(0, 120),
    targetType: input.targetType?.slice(0, 80),
    targetId: input.targetId?.slice(0, 180),
    metadata: sanitizeAuditMetadata(input.metadata),
  });
  if (db) return write(db);
  return withAuthorizedWorkspace(input.workspaceId, write);
}
