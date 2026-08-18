"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alerts } from "@/db/schema";
import { recordAuditEvent } from "@/server/audit";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export async function reviewAlertAction(formData: FormData) {
  const input = z.object({ locale: z.enum(["fr", "en"]), alertId: z.uuid(), decision: z.enum(["resolve", "dismiss"]) }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  const now = new Date();
  await withAuthorizedWorkspace(context.workspaceId, async (db) => {
    const [alert] = await db.update(alerts).set(input.decision === "resolve"
      ? { status: "resolved", resolvedAt: now, dismissedAt: null, updatedAt: now }
      : { status: "dismissed", dismissedAt: now, resolvedAt: null, updatedAt: now })
      .where(and(eq(alerts.id, input.alertId), eq(alerts.workspaceId, context.workspaceId), eq(alerts.status, "open")))
      .returning({ id: alerts.id });
    if (!alert) throw new Error("Alert not found or already closed.");
    await recordAuditEvent({ workspaceId: context.workspaceId, actorType: "user", actorUserId: context.userId, action: `alert.${input.decision}`, targetType: "alert", targetId: alert.id }, db);
  });
  revalidatePath(`/${input.locale}/dashboard`);
}
