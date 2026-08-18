"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession, requireWorkspaceContext } from "@/server/auth/context";
import { provisionPendingCommercialWorkspace } from "@/server/commercial/onboarding";
import { createCommercialCheckout, createCommercialPortal } from "@/server/commercial/stripe";

const localeSchema = z.enum(["fr", "en"]);

const onboardingSchema = z.object({
  locale: localeSchema,
  workspaceName: z.string().trim().min(2).max(140),
  legalName: z.string().trim().min(2).max(240),
  billingEmail: z.email().max(320),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/),
  addressLine1: z.string().trim().min(3).max(240),
  addressLine2: z.string().trim().max(240).optional(),
  postalCode: z.string().trim().min(2).max(32),
  city: z.string().trim().min(2).max(120),
  vatId: z.string().trim().max(40).optional(),
  baseCurrency: z.string().trim().regex(/^[A-Z]{3}$/).default("EUR"),
  planCode: z.enum(["solo", "studio"]),
  billingInterval: z.enum(["month", "year"]),
  businessConfirmed: z.literal("on"),
  termsAccepted: z.literal("on"),
  privacyAccepted: z.literal("on"),
  dpaAccepted: z.literal("on"),
  betaInvitationId: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
});

export async function startCommercialCheckoutAction(formData: FormData) {
  const input = onboardingSchema.parse(Object.fromEntries(formData));
  const session = await requireSession(input.locale);
  if (!session.user.emailVerified) throw new Error("A verified email is required for commercial onboarding.");
  const provisioned = await provisionPendingCommercialWorkspace({
    userId: session.user.id,
    verifiedEmail: session.user.email,
    workspaceName: input.workspaceName,
    legalName: input.legalName,
    billingEmail: input.billingEmail,
    countryCode: input.countryCode,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || undefined,
    postalCode: input.postalCode,
    city: input.city,
    vatId: input.vatId || undefined,
    baseCurrency: input.baseCurrency,
    locale: input.locale,
    requestedPlanCode: input.planCode,
    betaInvitationId: input.betaInvitationId,
  });
  const checkout = await createCommercialCheckout({
    workspaceId: provisioned.workspaceId,
    planCode: provisioned.planCode,
    billingInterval: input.billingInterval,
    locale: input.locale,
    betaInvitationId: provisioned.betaInvitationId,
  });
  redirect(checkout.url);
}

export async function openCommercialPortalAction(formData: FormData) {
  const input = z.object({ locale: localeSchema }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can manage billing.");
  redirect(await createCommercialPortal({ workspaceId: context.workspaceId, locale: input.locale }));
}
