import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashBetaInvitationToken } from "./beta-invitation-security";
import { expireAbandonedCommercialOnboarding, reserveBetaInvitation } from "./onboarding";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("commercial beta invitation reservation", () => {
  const client = new Client({ connectionString: databaseUrl });
  const invitedUserId = `beta-user-${randomUUID()}`;
  const otherUserId = `beta-other-${randomUUID()}`;
  const invitedEmail = `beta-${randomUUID()}@example.invalid`;
  const otherEmail = `other-${randomUUID()}@example.invalid`;
  const token = randomBytes(32).toString("base64url");
  const invitationId = randomUUID();

  beforeAll(async () => {
    await client.connect();
    await client.query("insert into auth_users (id,name,email,email_verified) values ($1,'Beta User',$2,true),($3,'Other User',$4,true)", [invitedUserId, invitedEmail, otherUserId, otherEmail]);
    await client.query("insert into beta_invitations (id,email,plan_code,token_hash,status,expires_at) values ($1,$2,'studio',$3,'pending',now()+interval '2 days')", [invitationId, invitedEmail, hashBetaInvitationToken(token)]);
  });

  afterAll(async () => {
    await client.query("delete from beta_invitations where id=$1", [invitationId]);
    await client.query("delete from auth_users where id in ($1,$2)", [invitedUserId, otherUserId]);
    await client.end();
  });

  it("reserves the token for its verified-email user without consuming it", async () => {
    const reserved = await reserveBetaInvitation({ token, userId: invitedUserId });
    expect(reserved).toMatchObject({ id: invitationId, planCode: "studio" });
    const result = await client.query<{status:string;reserved_by_user_id:string;consumed_at:Date|null;reservation_expires_at:Date}>("select status,reserved_by_user_id,consumed_at,reservation_expires_at from beta_invitations where id=$1", [invitationId]);
    expect(result.rows[0].status).toBe("reserved");
    expect(result.rows[0].reserved_by_user_id).toBe(invitedUserId);
    expect(result.rows[0].consumed_at).toBeNull();
    expect(result.rows[0].reservation_expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("is idempotent for the same user and rejects a different verified email", async () => {
    const first = await reserveBetaInvitation({ token, userId: invitedUserId });
    const second = await reserveBetaInvitation({ token, userId: invitedUserId });
    expect(second.reservationExpiresAt.toISOString()).toBe(first.reservationExpiresAt.toISOString());
    await expect(reserveBetaInvitation({ token, userId: otherUserId })).rejects.toThrow("BETA_INVITATION_INVALID");
  });

  it("releases an expired reservation that has not created a workspace", async () => {
    await client.query("update beta_invitations set reservation_expires_at=now()-interval '1 minute' where id=$1", [invitationId]);
    const result = await expireAbandonedCommercialOnboarding(new Date());
    expect(result.released).toBeGreaterThanOrEqual(1);
    const stored = await client.query<{status:string;reserved_by_user_id:string|null;reservation_expires_at:Date|null}>(
      "select status,reserved_by_user_id,reservation_expires_at from beta_invitations where id=$1",
      [invitationId],
    );
    expect(stored.rows[0]).toMatchObject({ status: "pending", reserved_by_user_id: null, reservation_expires_at: null });
  });
});
