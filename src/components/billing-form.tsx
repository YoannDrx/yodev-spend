import { Plus, ReceiptText } from "lucide-react";
import { createBillingAccount, createCostEntry } from "@/server/actions/billing";

const providerOptions = [
  "vercel", "aws", "cloudflare", "github", "resend", "sendgrid", "mailgun", "postmark",
  "supabase", "firebase", "neon", "mongodb-atlas", "upstash", "railway", "render",
  "netlify", "fly-io", "openai", "anthropic", "sentry", "posthog", "stripe", "twilio",
  "mapbox", "clerk", "auth0", "algolia", "sanity", "contentful",
];

type Labels = {
  newAccount: string;
  newCost: string;
  name: string;
  provider: string;
  owner: string;
  workspace: string;
  client: string;
  shared: string;
  amountMinor: string;
  interval: string;
  month: string;
  year: string;
  account: string;
  costType: string;
  subscription: string;
  usage: string;
  credit: string;
  tax: string;
  manual: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  description: string;
};

export function BillingForms({
  locale,
  accounts,
  labels,
}: {
  locale: string;
  accounts: Array<{ id: string; name: string }>;
  labels: Labels;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="billing-forms">
      <details className="panel">
        <summary className="panel-head"><h2><Plus size={13} />{labels.newAccount}</h2></summary>
        <form action={createBillingAccount} className="form-card" style={{ border: 0, margin: 0 }}>
          <input type="hidden" name="locale" value={locale} />
          <div className="field"><label htmlFor="billing-name">{labels.name}</label><input id="billing-name" name="name" required /></div>
          <div className="field"><label htmlFor="billing-provider">{labels.provider}</label><select id="billing-provider" name="providerSlug">{providerOptions.map((slug) => <option value={slug} key={slug}>{slug}</option>)}</select></div>
          <div className="field"><label htmlFor="billing-owner">{labels.owner}</label><select id="billing-owner" name="ownerType"><option value="workspace">{labels.workspace}</option><option value="client">{labels.client}</option><option value="shared">{labels.shared}</option></select></div>
          <div className="field"><label htmlFor="billing-amount">{labels.amountMinor}</label><input id="billing-amount" name="amountMinor" type="number" min="0" required /></div>
          <div className="field"><label htmlFor="billing-interval">{labels.interval}</label><select id="billing-interval" name="billingInterval"><option value="month">{labels.month}</option><option value="year">{labels.year}</option></select></div>
          <button className="button button-primary" type="submit">{labels.newAccount}</button>
        </form>
      </details>

      {accounts.length > 0 ? (
        <details className="panel">
          <summary className="panel-head"><h2><ReceiptText size={13} />{labels.newCost}</h2></summary>
          <form action={createCostEntry} className="form-card" style={{ border: 0, margin: 0 }}>
            <input type="hidden" name="locale" value={locale} />
            <div className="field"><label htmlFor="cost-account">{labels.account}</label><select id="cost-account" name="billingAccountId">{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
            <div className="field"><label htmlFor="cost-type">{labels.costType}</label><select id="cost-type" name="type"><option value="usage">{labels.usage}</option><option value="subscription">{labels.subscription}</option><option value="credit">{labels.credit}</option><option value="tax">{labels.tax}</option><option value="manual">{labels.manual}</option></select></div>
            <div className="field"><label htmlFor="cost-amount">{labels.amountMinor}</label><input id="cost-amount" name="amountMinor" type="number" min="0" required /></div>
            <div className="field"><label htmlFor="cost-currency">{labels.currency}</label><input id="cost-currency" name="currency" defaultValue="EUR" minLength={3} maxLength={3} required /></div>
            <div className="field"><label htmlFor="cost-start">{labels.periodStart}</label><input id="cost-start" name="periodStart" type="date" defaultValue={today} required /></div>
            <div className="field"><label htmlFor="cost-end">{labels.periodEnd}</label><input id="cost-end" name="periodEnd" type="date" defaultValue={today} required /></div>
            <div className="field"><label htmlFor="cost-description">{labels.description}</label><input id="cost-description" name="description" maxLength={240} /></div>
            <button className="button button-primary" type="submit">{labels.newCost}</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
