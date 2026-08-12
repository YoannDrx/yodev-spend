"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceContext } from "@/server/auth/context";
import { runRepositoryScan } from "@/server/scanner/run";

export async function scanRepositoryAction(formData:FormData){const input=z.object({locale:z.enum(["fr","en"]),repositoryId:z.uuid(),mode:z.enum(["quick","deep"]).default("quick"),force:z.enum(["true","false"]).default("false")}).parse(Object.fromEntries(formData));const context=await requireWorkspaceContext(input.locale);await runRepositoryScan({workspaceId:context.workspaceId,repositoryId:input.repositoryId,mode:input.mode,force:input.force==="true",trigger:"manual",idempotencyKey:`manual:${input.repositoryId}:${Date.now()}`});revalidatePath(`/${input.locale}/projects`);revalidatePath(`/${input.locale}/dashboard`);}
