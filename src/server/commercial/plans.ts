import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { commercialPlans, workspaceProfiles, workspaceSubscriptions, type CommercialPlanFeatures } from "@/db/schema";
import type { SpendExecutor } from "@/db";
import { commercialPlanCatalog } from "./catalog";
import { subscriptionGrantsPaidEntitlements } from "./entitlement-rules";

export { commercialPlanCatalog } from "./catalog";

export type CommercialPlanCode = "solo" | "studio";

export type CommercialEntitlements = {
  code: CommercialPlanCode | "private" | "inactive";
  version: number;
  memberLimit: number;
  projectLimit: number;
  connectionLimit: number;
  historyMonths: number;
  features: CommercialPlanFeatures;
};

const privateEntitlements: CommercialEntitlements = {
  code: "private",
  version: 1,
  memberLimit: 10,
  projectLimit: 100,
  connectionLimit: 50,
  historyMonths: 120,
  features: { clientAllocations: true, collaboration: true, csvExports: true, pdfReports: true },
};

const inactiveEntitlements: CommercialEntitlements = {
  code: "inactive",
  version: 0,
  memberLimit: 0,
  projectLimit: 0,
  connectionLimit: 0,
  historyMonths: 0,
  features: { clientAllocations: false, collaboration: false, csvExports: false, pdfReports: false },
};

export async function bootstrapCommercialPlans(db: SpendExecutor) {
  for (const plan of commercialPlanCatalog) {
    await db.insert(commercialPlans).values(plan).onConflictDoUpdate({
      target: [commercialPlans.code, commercialPlans.version],
      set: {
        currency: plan.currency,
        monthlyPriceMinor: plan.monthlyPriceMinor,
        annualPriceMinor: plan.annualPriceMinor,
        memberLimit: plan.memberLimit,
        projectLimit: plan.projectLimit,
        connectionLimit: plan.connectionLimit,
        historyMonths: plan.historyMonths,
        features: plan.features,
        active: true,
        updatedAt: new Date(),
      },
    });
  }
}

export async function getActiveCommercialPlan(code: CommercialPlanCode, db: SpendExecutor) {
  const [plan] = await db.select().from(commercialPlans).where(and(eq(commercialPlans.code, code), eq(commercialPlans.active, true)))
    .orderBy(desc(commercialPlans.version)).limit(1);
  if (!plan) throw new Error(`Commercial plan ${code} is not configured.`);
  return plan;
}

export async function getWorkspaceEntitlements(workspaceId: string, db: SpendExecutor): Promise<CommercialEntitlements> {
  const [workspace] = await db.select({ commercialStatus: workspaceProfiles.commercialStatus }).from(workspaceProfiles)
    .where(eq(workspaceProfiles.id, workspaceId)).limit(1);
  if (!workspace) return inactiveEntitlements;
  if (workspace.commercialStatus === "private") return privateEntitlements;

  const now = new Date();
  const [subscription] = await db.select({
    plan: commercialPlans,
    status: workspaceSubscriptions.status,
    paymentGraceEndsAt: workspaceSubscriptions.paymentGraceEndsAt,
  }).from(workspaceSubscriptions)
    .innerJoin(commercialPlans, eq(commercialPlans.id, workspaceSubscriptions.commercialPlanId))
    .where(and(
      eq(workspaceSubscriptions.workspaceId, workspaceId),
      eq(commercialPlans.active, true),
    ))
    .orderBy(desc(workspaceSubscriptions.updatedAt)).limit(1);

  if (!subscription || !subscriptionGrantsPaidEntitlements(subscription.status, subscription.paymentGraceEndsAt, now)) return inactiveEntitlements;
  return {
    code: subscription.plan.code,
    version: subscription.plan.version,
    memberLimit: subscription.plan.memberLimit,
    projectLimit: subscription.plan.projectLimit,
    connectionLimit: subscription.plan.connectionLimit,
    historyMonths: subscription.plan.historyMonths,
    features: subscription.plan.features,
  };
}
