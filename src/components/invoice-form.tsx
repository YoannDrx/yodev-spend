import { FileCheck2 } from "lucide-react";
import { createManualInvoiceAction } from "@/server/actions/invoices";

export function InvoiceForm({ locale, accounts, labels }: {
  locale: string;
  accounts: Array<{ id: string; name: string }>;
  labels: Record<"newInvoice" | "account" | "invoiceNumber" | "issuedAt" | "periodStart" | "periodEnd" | "amountMinor" | "currency" | "reconcileInvoice", string>;
}) {
  if (accounts.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return <details className="panel" style={{ marginBottom: 16 }}>
    <summary className="panel-head"><h2><FileCheck2 size={13} />{labels.newInvoice}</h2></summary>
    <form action={createManualInvoiceAction} className="form-card" style={{ border: 0, margin: 0 }}>
      <input type="hidden" name="locale" value={locale} />
      <div className="field"><label htmlFor="invoice-account">{labels.account}</label><select id="invoice-account" name="billingAccountId">{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
      <div className="field"><label htmlFor="invoice-number">{labels.invoiceNumber}</label><input id="invoice-number" name="invoiceNumber" required /></div>
      <div className="field"><label htmlFor="invoice-issued">{labels.issuedAt}</label><input id="invoice-issued" name="issuedAt" type="date" defaultValue={today} required /></div>
      <div className="field"><label htmlFor="invoice-start">{labels.periodStart}</label><input id="invoice-start" name="periodStart" type="date" defaultValue={today} required /></div>
      <div className="field"><label htmlFor="invoice-end">{labels.periodEnd}</label><input id="invoice-end" name="periodEnd" type="date" defaultValue={today} required /></div>
      <div className="field"><label htmlFor="invoice-total">{labels.amountMinor}</label><input id="invoice-total" name="totalMinor" type="number" required /></div>
      <div className="field"><label htmlFor="invoice-currency">{labels.currency}</label><input id="invoice-currency" name="currency" defaultValue="EUR" minLength={3} maxLength={3} required /></div>
      <button className="button button-primary" type="submit">{labels.reconcileInvoice}</button>
    </form>
  </details>;
}
