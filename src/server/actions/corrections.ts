"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { costEntries } from "@/db/schema";
import { parseMoneyInput } from "@/lib/money";
import { requireWorkspaceMutationContext, requireWorkspaceRole } from "@/server/auth/context";
import { withWorkspaceMutation } from "@/server/auth/workspace-transaction";
import { correctManualEntry } from "@/server/billing/corrections";

export async function correctEntryAction(data: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),entryId:z.uuid(),decision:z.enum(["replace","void"]),amount:z.string().max(40),reason:z.string().trim().min(5).max(300)}).parse(Object.fromEntries(data));
  const context=await requireWorkspaceMutationContext(input.locale);
  await requireWorkspaceRole(context.workspaceId,["owner","admin"],input.locale);
  await withWorkspaceMutation(context.workspaceId,async db=>{
    const [entry]=await db.select({currency:costEntries.currency}).from(costEntries).where(and(eq(costEntries.workspaceId,context.workspaceId),eq(costEntries.id,input.entryId)));
    if(!entry)throw new Error("ENTRY_NOT_FOUND");
    await correctManualEntry(db,{...context,entryId:input.entryId,amountMinor:input.decision==="void"?null:parseMoneyInput(input.amount,entry.currency),reason:input.reason});
  });
  revalidatePath(`/${input.locale}`,"layout");
}
