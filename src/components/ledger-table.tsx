import { ActionForm } from "@/components/action-form";
import { correctEntryAction } from "@/server/actions/corrections";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/utils";
import { getRecentLedgerEntries } from "@/server/billing/ledger";

export async function LedgerTable({workspaceId,locale}:{workspaceId:string;locale:string}) {
  const [t,rows]=await Promise.all([getTranslations("Ledger"),getRecentLedgerEntries(workspaceId)]);
  const context=await requireWorkspaceContext(locale);
  const canCorrect=context.role.split(",").some(role=>["owner","admin"].includes(role));
  return <section className="ledger-section"><div className="page-header"><div><h2>{t("title")}</h2><p>{t("help")}</p></div></div>
    {rows.length ? <table className="data-table"><thead><tr><th>{t("account")}</th><th>{t("period")}</th><th>{t("amount")}</th><th>{t("status")}</th><th>{t("source")}</th><th>{t("correction")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={row.supersededAt?"ledger-superseded":undefined}>
      <td data-label={t("account")}>{row.account}</td><td data-label={t("period")}>{row.periodStart.toLocaleDateString(locale)} → {row.periodEnd.toLocaleDateString(locale)}</td><td data-label={t("amount")}><strong>{formatMoney(row.amountMinor,row.currency,locale)}</strong></td><td data-label={t("status")}><span className="status-badge">{row.supersededAt?t("reconciled"):t(row.status)}</span></td><td data-label={t("source")}>{["manual","manual-correction","manual-invoice"].includes(row.source) ? (locale === "fr" ? "Saisie manuelle" : "Manual entry") : row.source.split(":")[0]}</td><td data-label={t("correction")}>{canCorrect&&!row.supersededAt&&["manual","manual-correction","manual-invoice"].includes(row.source)?<details><summary className="button button-small">{t("correct")}</summary><ActionForm action={correctEntryAction} className="form-card"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="entryId" value={row.id}/><p>{t("correctionHelp")}</p><label className="field"><span>{t("decision")}</span><select name="decision"><option value="replace">{t("replace")}</option>{!row.invoiceId?<option value="void">{t("void")}</option>:null}</select></label><label className="field"><span>{t("newAmount",{currency:row.currency})}</span><input name="amount" inputMode="decimal"/></label><label className="field"><span>{t("reason")}</span><input name="reason" required minLength={5} maxLength={300}/></label><button className="button button-primary" type="submit">{t("saveCorrection")}</button></ActionForm></details>:"—"}</td>
    </tr>)}</tbody></table>:<p className="empty">{t("empty")}</p>}
  </section>;
}
