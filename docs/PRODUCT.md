# Product contract

Spend is YoDev's developer FinOps hub. It answers which external services are used, who pays, what plan is active, how much has actually been spent, which usage produced the cost, and which changes could reduce spend without removing a required capability.

Repository discovery remains an explainable input, not a billing source. Detecting Vercel in code does not prove which Vercel account pays, which project owns a shared team fee, or what the current invoice contains. Provider connections, invoices and explicit resource-to-project associations remain authoritative for financial attribution.

## Financial truth

Every amount is qualified as one of:

- `commitment`: contractual recurring amount used for forward-looking commitment;
- `accrued`: provider-reported cost accumulated in an open billing period;
- `estimated`: a Spend calculation from measured usage and a versioned price model;
- `final`: an issued invoice or provider charge considered closed.

Final invoices reconcile overlapping accrued or estimated costs; they never add a second copy of the same expense. Original currency and exact provider precision are retained. EUR reporting conversions are derived views with a dated, named exchange-rate source.

## Product boundaries

Spend compares cost, usage, plan entitlements and project/client attribution. It does not become an application monitoring product, ingest runtime logs, inspect AI prompts, read customer email content, change plans, cancel services, or mutate external infrastructure.

The hosted production remains private YoDev software while the commercial implementation is feature-gated and validated. Public signup and billing must stay disabled until the Stripe, tenancy, legal and connector release gates in the runbook are satisfied. Read-only cost/usage connectors, invoice ingestion, currency conversion with auditable rates, and manual bank-file reconciliation remain roadmap items until each is actually reconciled and published.

## Success signals

The primary signals are:

- percentage of paid spend identified;
- percentage attributed to a workspace, client or project;
- percentage backed by final or provider-reported data;
- number and value of reviewed optimization findings;
- reconciliation difference between Spend and provider invoices.
