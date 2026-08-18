import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { cancelWorkspaceInvitationAction, inviteWorkspaceMemberAction, updateWorkspaceMemberAction } from "@/server/actions/members";
import { requireWorkspaceContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { getWorkspaceEntitlements } from "@/server/commercial/plans";
import { listOrganizationIdentityState } from "@/server/auth/organization-service";

export default async function MembersPage({ params }: PageProps<"/[locale]/settings/members">) {
  const { locale } = await params;
  const [context, t] = await Promise.all([requireWorkspaceContext(locale), getTranslations("Members")]);
  const [{ members, invitations }, entitlements] = await Promise.all([
    listOrganizationIdentityState(context.organizationId),
    withAuthorizedWorkspace(context.workspaceId, (db) => getWorkspaceEntitlements(context.workspaceId, db)),
  ]);
  const canInvite = entitlements.features.collaboration && members.length + invitations.length < entitlements.memberLimit;
  return <><PageHeader title={t("title")} subtitle={t("subtitle")}/>{canInvite ? <form action={inviteWorkspaceMemberAction} className="form-card"><input type="hidden" name="locale" value={locale}/><label className="field"><span>{t("email")}</span><input name="email" type="email" required/></label><label className="field"><span>{t("role")}</span><select name="role"><option value="member">{t("memberRole")}</option><option value="admin">{t("adminRole")}</option></select></label><button className="button button-primary" type="submit">{t("invite")}</button></form> : <p className="hint">{t("quota", { count: entitlements.memberLimit })}</p>}<section className="panel"><div className="panel-head"><h2>{t("members")}</h2></div><div className="panel-body">{members.map((member)=><div className="list-row" key={member.id}><div><strong>{member.name}</strong><small>{member.email}</small></div>{context.role.split(",").includes("owner")&&member.userId!==context.userId&&!member.role.split(",").includes("owner")?<form action={updateWorkspaceMemberAction} className="topbar-actions"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="memberId" value={member.id}/><select name="decision" defaultValue={member.role.split(",")[0]}><option value="member">{t("memberRole")}</option><option value="admin">{t("adminRole")}</option><option value="remove">{t("remove")}</option></select><button className="button button-small" type="submit">{t("apply")}</button></form>:<span className="status-badge">{member.role}</span>}</div>)}</div></section>{invitations.length ? <section className="panel" style={{marginTop:16}}><div className="panel-head"><h2>{t("pending")}</h2></div><div className="panel-body">{invitations.map((invitation)=><div className="list-row" key={invitation.id}><div><strong>{invitation.email}</strong><small>{invitation.role} · {t("expires", { date: invitation.expiresAt.toLocaleDateString(locale) })}</small></div><form action={cancelWorkspaceInvitationAction}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="invitationId" value={invitation.id}/><button className="button button-small" type="submit">{t("cancel")}</button></form></div>)}</div></section> : null}</>;
}
