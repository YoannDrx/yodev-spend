import "dotenv/config";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireServiceDb } from "../src/db";
import { betaInvitations } from "../src/db/schema";
import { hashBetaInvitationToken } from "../src/server/commercial/beta-invitation-security";

const inputSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  planCode: z.enum(["solo", "studio"]),
  validDays: z.coerce.number().int().min(1).max(90),
  appUrl: z.url(),
});

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const input = inputSchema.parse({
    email: argument("email"),
    planCode: argument("plan") ?? "solo",
    validDays: argument("valid-days") ?? "7",
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1_000);
  const db = requireServiceDb();

  await db.transaction(async (tx) => {
    await tx.update(betaInvitations).set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    }).where(eq(betaInvitations.email, input.email));
    await tx.insert(betaInvitations).values({
      email: input.email,
      planCode: input.planCode,
      tokenHash: hashBetaInvitationToken(token),
      expiresAt,
    });
  });

  const url = new URL(`/fr/start/${token}`, input.appUrl).toString();
  process.stdout.write(`${url}\n`);
}

main().then(() => process.exit(0)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Beta invitation creation failed"}\n`);
  process.exit(1);
});
