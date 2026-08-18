import { and, desc, eq, inArray } from "drizzle-orm";
import { BadgeCheck, Clock3, Lightbulb, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { externalResources, optimizationFindings, providers } from "@/db/schema";
import { formatMoney } from "@/lib/utils";
import { reviewOptimizationFindingAction } from "@/server/actions/optimizations";
import { requireWorkspaceContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export default async function OptimizationsPage({ params }: PageProps<"/[locale]/spend/optimizations">) {
  const { locale } = await params;
  const [context, t] = await Promise.all([requireWorkspaceContext(locale), getTranslations("Optimizations")]);
  const findings = await withAuthorizedWorkspace(context.workspaceId, (db) => db.select({ finding: optimizationFindings, provider: providers.name, resource: externalResources.name })
    .from(optimizationFindings)
    .innerJoin(providers, eq(providers.id, optimizationFindings.providerId))
    .leftJoin(externalResources, eq(externalResources.id, optimizationFindings.externalResourceId))
    .where(and(eq(optimizationFindings.workspaceId, context.workspaceId), inArray(optimizationFindings.status, ["open", "accepted", "snoozed"])))
    .orderBy(desc(optimizationFindings.confidence), desc(optimizationFindings.lastValidatedAt)));

  return <>
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <section className="panel">
      <div className="panel-body">
        {findings.length === 0 ? <p className="hint">{t("empty")}</p> : findings.map(({ finding, provider, resource }) => <article className="list-row" key={finding.id}>
          <div className="row-main"><span className="provider-dot"><Lightbulb size={14} /></span><div><strong>{finding.title}</strong><small>{provider}{resource ? ` · ${resource}` : ""} · {t(finding.confidence)}</small><p>{finding.description}</p><small>{finding.evidence.map((evidence) => `${evidence.label}: ${evidence.value}`).join(" · ")}</small></div></div>
          <div className="row-value">
            {finding.currency && finding.savingsMaxMinor !== null ? <strong>{t("upTo")} {formatMoney(finding.savingsMaxMinor, finding.currency, locale)}</strong> : <span>—</span>}
            <small>{finding.status}</small>
            <div className="topbar-actions">
              <form action={reviewOptimizationFindingAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="findingId" value={finding.id} /><input type="hidden" name="decision" value="accept" /><button className="button button-small" type="submit" title={t("accept")}><BadgeCheck size={13} /></button></form>
              <form action={reviewOptimizationFindingAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="findingId" value={finding.id} /><input type="hidden" name="decision" value="snooze" /><button className="button button-small" type="submit" title={t("snooze")}><Clock3 size={13} /></button></form>
              <form action={reviewOptimizationFindingAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="findingId" value={finding.id} /><input type="hidden" name="decision" value="ignore" /><button className="button button-small" type="submit" title={t("ignore")}><X size={13} /></button></form>
            </div>
          </div>
        </article>)}
      </div>
    </section>
    <p className="hint" style={{ marginTop: 12 }}>{t("advisory")}</p>
  </>;
}
