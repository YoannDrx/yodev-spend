"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optimizationFindings } from "@/db/schema";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export async function reviewOptimizationFindingAction(formData: FormData) {
  const input = z.object({
    locale: z.enum(["fr", "en"]),
    findingId: z.uuid(),
    decision: z.enum(["accept", "ignore", "snooze", "reopen"]),
  }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  const now = new Date();
  const snoozedUntil = input.decision === "snooze" ? new Date(now.getTime() + 30 * 86_400_000) : null;
  const status = input.decision === "accept" ? "accepted" as const
    : input.decision === "ignore" ? "ignored" as const
      : input.decision === "snooze" ? "snoozed" as const
        : "open" as const;
  const [finding] = await withAuthorizedWorkspace(context.workspaceId, (db) => db.update(optimizationFindings).set({ status, snoozedUntil, updatedAt: now }).where(and(
    eq(optimizationFindings.id, input.findingId),
    eq(optimizationFindings.workspaceId, context.workspaceId),
  )).returning({ id: optimizationFindings.id }));
  if (!finding) throw new Error("Optimization finding not found.");
  revalidatePath(`/${input.locale}/spend/optimizations`);
  revalidatePath(`/${input.locale}/dashboard`);
}
