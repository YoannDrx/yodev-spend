import { Plus, ReceiptText } from "lucide-react";
import { createBillingAccount, createCostEntry, updateBillingAccountAllocation } from "@/server/actions/billing";

const providerOptions = [
  "vercel", "aws", "cloudflare", "github", "resend", "sendgrid", "mailgun", "postmark",
  "supabase", "firebase", "neon", "mongodb-atlas", "upstash", "railway", "render",
  "netlify", "fly-io", "openai", "anthropic", "sentry", "posthog", "stripe", "twilio",
  "mapbox", "clerk", "auth0", "algolia", "sanity", "contentful",
  "apple-developer", "ovhcloud", "google-cloud", "digitalocean", "figma", "jetbrains",
  "adobe", "notion", "linear",
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
  clientOwner: string;
  sharedProjects: string;
  sharedProjectsHelp: string;
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
  allocationMethod: string;
  equal: string;
  manualAllocation: string;
  allocationBps: string;
  updateAllocation: string;
};

export function BillingForms({
  locale,
  accounts,
  clients,
  projects,
  labels,
}: {
  locale: string;
  accounts: Array<{ id: string; name: string; allocations?: Array<{ projectId: string; allocationBps: number }> }>;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
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
          <div className="field"><label htmlFor="billing-client">{labels.clientOwner}</label><select id="billing-client" name="clientId"><option value="">—</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></div>
          <div className="field"><label htmlFor="billing-projects">{labels.sharedProjects}</label><select id="billing-projects" name="projectIds" multiple size={Math.min(Math.max(projects.length, 2), 6)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><small>{labels.sharedProjectsHelp}</small></div>
          <div className="field"><label htmlFor="billing-allocation-method">{labels.allocationMethod}</label><select id="billing-allocation-method" name="allocationMethod"><option value="equal">{labels.equal}</option><option value="manual">{labels.manualAllocation}</option></select></div>
          {projects.map((project) => <div className="field" key={project.id}><label htmlFor={`billing-allocation-${project.id}`}>{project.name} · {labels.allocationBps}</label><input id={`billing-allocation-${project.id}`} name={`allocationBps:${project.id}`} type="number" min="0" max="10000" defaultValue="0" /></div>)}
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
      {accounts.length > 0 ? <details className="panel">
        <summary className="panel-head"><h2>{labels.updateAllocation}</h2></summary>
        <div className="panel-body">{accounts.map((account) => <form action={updateBillingAccountAllocation} className="form-card" key={account.id}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="billingAccountId" value={account.id} />
          <strong>{account.name}</strong>
          <div className="field"><label htmlFor={`allocation-method-${account.id}`}>{labels.allocationMethod}</label><select id={`allocation-method-${account.id}`} name="allocationMethod"><option value="equal">{labels.equal}</option><option value="manual">{labels.manualAllocation}</option></select></div>
          {projects.map((project) => {
            const allocation = account.allocations?.find((item) => item.projectId === project.id);
            return <div className="field" key={project.id}><label><span><input name="projectIds" type="checkbox" value={project.id} defaultChecked={Boolean(allocation)} /> {project.name}</span></label><input aria-label={`${project.name} ${labels.allocationBps}`} name={`allocationBps:${project.id}`} type="number" min="0" max="10000" defaultValue={allocation?.allocationBps ?? 0} /></div>;
          })}
          <button className="button button-primary" type="submit">{labels.updateAllocation}</button>
        </form>)}</div>
      </details> : null}
    </div>
  );
}
