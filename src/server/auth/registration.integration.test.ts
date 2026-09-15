import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requireServiceDb } from "@/db";
import { authInvitations } from "@/db/schema";
import { hasRegistrationInvitation } from "./registration";

const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite("invited collaborator identity admission",()=>{
  it("admits a pending team invite without requiring a beta invitation, but rejects expired/revoked invites",async()=>{
    const email=`collaborator-${randomUUID()}@example.invalid`;
    const id=randomUUID();
    const db=requireServiceDb();
    await db.insert(authInvitations).values({id,email,organizationId:"seed-yodev",inviterId:"seed-owner",role:"member",status:"pending",expiresAt:new Date(Date.now()+3600000)});
    expect(await hasRegistrationInvitation(email.toUpperCase())).toBe(true);
    expect(await hasRegistrationInvitation(`other-${email}`)).toBe(false);
    await db.update(authInvitations).set({status:"canceled"}).where(eq(authInvitations.id,id));
    expect(await hasRegistrationInvitation(email)).toBe(false);
    await db.update(authInvitations).set({status:"pending",expiresAt:new Date(Date.now()-1000)}).where(eq(authInvitations.id,id));
    expect(await hasRegistrationInvitation(email)).toBe(false);
  });
});
