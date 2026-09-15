import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { requireWorkspaceContext } from "@/server/auth/context";
import { assertWorkspaceRole } from "@/server/auth/authorization";
import { cancelDeletionAction, requestDeletionAction } from "@/server/actions/privacy";
import { getPrivacySummary } from "@/server/privacy/deletion";

export default async function PrivacySettings({params}:PageProps<"/[locale]/settings/privacy">) {
  const {locale}=await params;
  const context=await requireWorkspaceContext(locale,true);assertWorkspaceRole(context.role,["owner"]);
  const [t,{job,name}]=await Promise.all([getTranslations("PrivacySettings"),getPrivacySummary(context.workspaceId)]);
  const exportExpired=job&&job.status!=="cancelled"&&job.exportAvailableUntil<=new Date();
  const pending=job&&!["cancelled","completed"].includes(job.status);
  return <><PageHeader title={t("title")} subtitle={t("subtitle")}/>
    <section className="panel"><div className="panel-head"><h2>{t("export")}</h2></div><div className="panel-body"><p>{t("exportHelp")}</p>{exportExpired?<p>{t("exportExpired")}</p>:<a className="button" href="/api/workspace/export" download>{t("download")}</a>}</div></section>
    <section className="panel" style={{marginTop:24}}><div className="panel-head"><h2>{t("deletion")}</h2></div><div className="panel-body"><p>{t("policy")}</p><p>{t("billingHelp")} <Link href="/settings/billing">{t("billing")}</Link></p>
      {pending?<><p role="status">{t("scheduled",{date:job.purgeScheduledAt.toLocaleDateString(locale)})}</p><p>{t("reconnect")}</p>{job.status==="failed"?<p role="alert">{t("failed")}</p>:null}{job.purgeScheduledAt>new Date()?<ActionForm action={cancelDeletionAction}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="jobId" value={job.id}/><button className="button" type="submit">{t("cancel")}</button></ActionForm>:<p>{t("processing")}</p>}</>:<details><summary className="button">{t("request")}</summary><ActionForm action={requestDeletionAction} className="form-card"><input type="hidden" name="locale" value={locale}/><p>{t("confirmHelp",{name})}</p><label className="field"><span>{t("confirmation")}</span><input name="confirmation" required autoComplete="off"/></label><button className="button" type="submit">{t("confirm")}</button></ActionForm></details>}
    </div></section></>;
}
