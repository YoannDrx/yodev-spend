"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceContext } from "@/server/auth/context";
import { cancelWorkspaceDeletion, requestWorkspaceDeletion } from "@/server/privacy/deletion";

export async function requestDeletionAction(data: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),confirmation:z.string().min(1).max(140)}).parse(Object.fromEntries(data));
  const context=await requireWorkspaceContext(input.locale);
  try {await requestWorkspaceDeletion(context,input.confirmation);}catch(error){
    if(error instanceof Error&&error.message==="END_SUBSCRIPTION_BEFORE_DELETION")return {error:"endSubscriptionFirst"};
    throw error;
  }
  revalidatePath(`/${input.locale}`,"layout");
}

export async function cancelDeletionAction(data: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),jobId:z.uuid()}).parse(Object.fromEntries(data));
  await cancelWorkspaceDeletion(await requireWorkspaceContext(input.locale),input.jobId);
  revalidatePath(`/${input.locale}`,"layout");
}
