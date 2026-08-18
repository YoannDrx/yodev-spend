"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/server/audit";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { assertWorkspaceCanCreate } from "@/server/commercial/quotas";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { manageOrganizationMember } from "@/server/auth/organization-service";

const localeSchema = z.enum(["fr", "en"]);

export async function inviteWorkspaceMemberAction(formData: FormData) {
  const input = z.object({
    locale: localeSchema,
    email: z.email().max(320),
    role: z.enum(["admin", "member"]),
  }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (!context.role.split(",").some((role) => role === "owner" || role === "admin")) throw new Error("Only owners and admins can invite members.");
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error("Invitation email delivery is not configured.");
  await assertWorkspaceCanCreate(context.workspaceId, "member");
  const invitation = await getAuth().api.createInvitation({
    headers: await headers(),
    body: { email: input.email.toLowerCase(), role: input.role, organizationId: context.organizationId },
  });
  await recordAuditEvent({
    workspaceId: context.workspaceId,
    actorType: "user",
    actorUserId: context.userId,
    action: "member.invited",
    targetType: "organization_invitation",
    targetId: invitation.id,
    metadata: { role: input.role },
  });
  revalidatePath(`/${input.locale}/settings/members`);
}

export async function updateWorkspaceMemberAction(formData: FormData) {
  const input=z.object({locale:localeSchema,memberId:z.string().min(1).max(200),decision:z.enum(["admin","member","remove"])}).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceMutationContext(input.locale);if(!context.role.split(",").includes("owner"))throw new Error("Only the owner can manage existing members.");
  await manageOrganizationMember({workspaceId:context.workspaceId,organizationId:context.organizationId,actorUserId:context.userId,memberId:input.memberId,decision:input.decision});
  revalidatePath(`/${input.locale}/settings/members`);
}

export async function cancelWorkspaceInvitationAction(formData: FormData) {
  const input = z.object({ locale: localeSchema, invitationId: z.string().min(1).max(200) }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (!context.role.split(",").some((role) => role === "owner" || role === "admin")) throw new Error("Only owners and admins can cancel invitations.");
  await getAuth().api.cancelInvitation({ headers: await headers(), body: { invitationId: input.invitationId } });
  await recordAuditEvent({ workspaceId: context.workspaceId, actorType: "user", actorUserId: context.userId, action: "member.invitation_cancelled", targetType: "organization_invitation", targetId: input.invitationId });
  revalidatePath(`/${input.locale}/settings/members`);
}
