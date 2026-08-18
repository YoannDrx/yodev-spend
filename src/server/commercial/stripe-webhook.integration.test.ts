import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const webhookSecret = "whsec_spend_integration_test";

process.env.STRIPE_BILLING_ENABLED = "true";
process.env.STRIPE_RESTRICTED_KEY = "sk_test_spend_integration";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
process.env.STRIPE_SOLO_MONTHLY_PRICE_ID = "price_spend_solo_monthly_test";
process.env.STRIPE_SOLO_ANNUAL_PRICE_ID = "price_spend_solo_annual_test";
process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID = "price_spend_studio_monthly_test";
process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID = "price_spend_studio_annual_test";

suite("signed Stripe commercial webhook lifecycle", () => {
  const client = new Client({ connectionString: databaseUrl });
  const userId = `stripe-user-${randomUUID()}`;
  const organizationId = randomUUID();
  const memberId = randomUUID();
  const workspaceId = randomUUID();
  const invitationId = randomUUID();
  const subscriptionId = `sub_${randomUUID().replaceAll("-", "")}`;
  const customerId = `cus_${randomUUID().replaceAll("-", "")}`;
  let processStripeWebhook: typeof import("./stripe-webhook").processStripeWebhook;

  beforeAll(async () => {
    await client.connect();
    await client.query("insert into auth_users (id,name,email,email_verified) values ($1,'Stripe User',$2,true)", [userId, `${userId}@example.invalid`]);
    await client.query("insert into auth_organizations (id,name,slug) values ($1,'Stripe Workspace',$2)", [organizationId, `stripe-${workspaceId}`]);
    await client.query("insert into auth_members (id,organization_id,user_id,role) values ($1,$2,$3,'owner')", [memberId, organizationId, userId]);
    await client.query("insert into workspace_profiles (id,organization_id,name,slug,commercial_status) values ($1,$2,'Stripe Workspace',$3,'pending_checkout')", [workspaceId, organizationId, `stripe-${workspaceId}`]);
    await client.query("insert into beta_invitations (id,email,plan_code,token_hash,status,reserved_by_user_id,workspace_id,expires_at,reserved_at,reservation_expires_at) values ($1,$2,'solo',$3,'reserved',$4,$5,now()+interval '2 days',now(),now()+interval '1 day')", [invitationId, `${userId}@example.invalid`, randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64), userId, workspaceId]);
    ({ processStripeWebhook } = await import("./stripe-webhook"));
  });

  afterAll(async () => {
    await client.query("delete from workspace_quota_states where workspace_id=$1", [workspaceId]);
    await client.query("delete from audit_events where workspace_id=$1", [workspaceId]);
    await client.query("delete from commercial_webhook_events where workspace_id=$1 or stripe_event_id like $2", [workspaceId, `evt_${workspaceId}%`]);
    await client.query("delete from workspace_subscriptions where workspace_id=$1", [workspaceId]);
    await client.query("delete from beta_invitations where id=$1", [invitationId]);
    await client.query("delete from workspace_profiles where id=$1", [workspaceId]);
    await client.query("delete from auth_members where id=$1", [memberId]);
    await client.query("delete from auth_organizations where id=$1", [organizationId]);
    await client.query("delete from auth_users where id=$1", [userId]);
    await client.end();
  });

  function event(eventId: string, created: number, status: "trialing" | "active") {
    return JSON.stringify({
      id: eventId,
      object: "event",
      api_version: "2026-07-29.dahlia",
      created,
      data: { object: {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status,
        metadata: { workspaceId, planCode: "solo", billingInterval: "month", betaInvitationId: invitationId },
        items: { data: [{ price: { id: process.env.STRIPE_SOLO_MONTHLY_PRICE_ID }, current_period_start: created, current_period_end: created + 2_592_000 }] },
        trial_end: status === "trialing" ? created + 1_209_600 : null,
        cancel_at_period_end: false,
        canceled_at: null,
        ended_at: null,
      } },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: status === "trialing" ? "customer.subscription.created" : "customer.subscription.updated",
    });
  }

  async function deliver(payload: string) {
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return processStripeWebhook(payload, signature);
  }

  it("activates only from a signed event, consumes once, and ignores duplicate delivery", async () => {
    const eventId = `evt_${workspaceId}_created`;
    const payload = event(eventId, 1_787_000_000, "trialing");
    expect(await deliver(payload)).toMatchObject({ duplicate: false, eventId });
    expect(await deliver(payload)).toMatchObject({ duplicate: true, eventId });
    const state = await client.query<{commercial_status:string;invitation_status:string;attempts:number}>(
      "select w.commercial_status,i.status invitation_status,e.attempts from workspace_profiles w join beta_invitations i on i.workspace_id=w.id join commercial_webhook_events e on e.workspace_id=w.id where w.id=$1 and e.stripe_event_id=$2",
      [workspaceId, eventId],
    );
    expect(state.rows[0]).toMatchObject({ commercial_status: "trialing", invitation_status: "consumed", attempts: 1 });
  });

  it("accepts later updates with a consumed invitation and cannot regress on an older event", async () => {
    const newerId = `evt_${workspaceId}_active`;
    await deliver(event(newerId, 1_787_100_000, "active"));
    const olderId = `evt_${workspaceId}_older`;
    await deliver(event(olderId, 1_787_050_000, "trialing"));
    const subscription = await client.query<{status:string;last_stripe_event_created_at:number}>(
      "select status,last_stripe_event_created_at from workspace_subscriptions where workspace_id=$1",
      [workspaceId],
    );
    expect(subscription.rows[0]).toMatchObject({ status: "active", last_stripe_event_created_at: 1_787_100_000 });
  });
});
