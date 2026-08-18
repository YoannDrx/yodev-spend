import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { openCommercialPortalAction } from "@/server/actions/commercial";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getWorkspaceCommercialSubscription } from "@/server/commercial/stripe";

export default async function WorkspaceBillingPage({ params }: PageProps<"/[locale]/settings/billing">) {
  const { locale } = await params;
  const [context, t] = await Promise.all([requireWorkspaceContext(locale), getTranslations("WorkspaceBilling")]);
  const commercial = await getWorkspaceCommercialSubscription(context.workspaceId);
  return <><PageHeader title={t("title")} subtitle={t("subtitle")}/><section className="panel"><div className="panel-body">
    {commercial ? <div className="list-row"><div><strong>{commercial.plan.code === "solo" ? "Solo" : "Studio"}</strong><small>{commercial.subscription.billingInterval === "month" ? t("monthly") : t("annual")} · {t(commercial.subscription.status)}</small></div><form action={openCommercialPortalAction}><input type="hidden" name="locale" value={locale}/><button className="button button-primary" type="submit">{t("manage")}</button></form></div> : <p className="hint">{t("privateWorkspace")}</p>}
  </div></section></>;
}
