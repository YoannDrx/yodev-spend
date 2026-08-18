import "server-only";

import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { alerts, billingAccountProjects, billingAccounts, clients, costEntries, detectionEvidence, externalResourceProjects, fxRates, projectIntegrations, projects, providerConnections, providers, repositories, subscriptions } from "@/db/schema";
import { env } from "@/lib/env";
import { sumMonthlyCommitments } from "@/server/billing/money";
import { allocateLedgerCosts, allocationTotals } from "@/server/finops/ledger-allocation";
import { convertCostsForReporting } from "@/server/finops/reporting";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { demoData } from "./demo";

export async function getDashboardData(workspaceId: string) {
  if (env.AUTH_TEST_MODE === "true" || !process.env.DATABASE_URL) return { ...demoData, excludedCurrencies: [] as Array<{ currency: string; amountMinor: bigint }>, unallocated: [] as Array<{ currency: string; amountMinor: bigint }>, allocationCoverageBps: 10_000, latestSuccessfulSyncAt: null as string | null, fxConversions: [] as Array<{ from: string; to: string; rateScaled: bigint; rateScale: number; rateAt: string; source: string; sourceUrl: string }> };
  return withAuthorizedWorkspace(workspaceId, async (db) => {
  const now = new Date(); const monthStart = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)); const monthEnd = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
  const subscriptionRows=await db.select().from(subscriptions).where(and(eq(subscriptions.workspaceId, workspaceId),eq(subscriptions.status,"active")));
  const costRows=await db.select().from(costEntries).where(and(eq(costEntries.workspaceId,workspaceId),gte(costEntries.periodEnd,monthStart),lt(costEntries.periodStart,monthEnd),isNull(costEntries.supersededAt)));
  const openAlerts=await db.select({ id:alerts.id,title:alerts.title,description:alerts.description,billingAccountId:alerts.billingAccountId }).from(alerts).where(and(eq(alerts.workspaceId,workspaceId),eq(alerts.status,"open"))).orderBy(desc(alerts.createdAt)).limit(6);
  const recentIntegrations=await db.select({ id:projectIntegrations.id,provider:providers.name,project:projects.name,confidence:projectIntegrations.confidence }).from(projectIntegrations).innerJoin(providers,eq(providers.id,projectIntegrations.providerId)).innerJoin(projects,eq(projects.id,projectIntegrations.projectId)).where(and(eq(projectIntegrations.workspaceId,workspaceId),eq(projectIntegrations.reviewStatus,"pending"))).orderBy(desc(projectIntegrations.firstDetectedAt)).limit(6);
  const projectRows=await db.select({ id:projects.id,name:projects.name,client:clients.name,repositories:sql<number>`count(distinct ${repositories.id})::int`,services:sql<number>`count(distinct ${projectIntegrations.id})::int` }).from(projects).innerJoin(clients,eq(clients.id,projects.clientId)).leftJoin(repositories,eq(repositories.projectId,projects.id)).leftJoin(projectIntegrations,eq(projectIntegrations.projectId,projects.id)).where(and(eq(projects.workspaceId,workspaceId),eq(projects.status,"active"))).groupBy(projects.id,clients.name).limit(8);
  const accountCategories=await db.select({billingAccountId:billingAccounts.id,category:providers.category}).from(billingAccounts).innerJoin(providers,eq(providers.id,billingAccounts.providerId)).where(eq(billingAccounts.workspaceId,workspaceId));
  const rateRows=await db.select().from(fxRates).where(lte(fxRates.rateAt,monthEnd));
  const syncRows=await db.select({lastSuccessfulSyncAt:providerConnections.lastSuccessfulSyncAt}).from(providerConnections).where(and(eq(providerConnections.workspaceId,workspaceId),isNull(providerConnections.archivedAt)));
  const resourceMappings=await db.select({externalResourceId:externalResourceProjects.externalResourceId,projectId:externalResourceProjects.projectId,allocationBps:externalResourceProjects.allocationBps,allocationMethod:externalResourceProjects.allocationMethod,effectiveFrom:externalResourceProjects.effectiveFrom,effectiveTo:externalResourceProjects.effectiveTo}).from(externalResourceProjects).where(eq(externalResourceProjects.workspaceId,workspaceId));
  const billingMappings=await db.select({billingAccountId:billingAccountProjects.billingAccountId,projectId:billingAccountProjects.projectId,allocationBps:billingAccountProjects.allocationBps,allocationMethod:billingAccountProjects.allocationMethod,effectiveFrom:billingAccountProjects.effectiveFrom,effectiveTo:billingAccountProjects.effectiveTo}).from(billingAccountProjects).where(eq(billingAccountProjects.workspaceId,workspaceId));
  const commitmentRows=[...new Set(subscriptionRows.map((subscription)=>subscription.currency))].map((currency)=>({id:`commitment:${currency}`,amountMinor:sumMonthlyCommitments(subscriptionRows,currency).amountMinor,currency,periodStart:now}));const commitmentReporting=convertCostsForReporting(commitmentRows,rateRows,"EUR");const monthlyCommitment=commitmentReporting.converted.reduce((sum,row)=>sum+row.amountMinor,0n);
  const reporting=convertCostsForReporting(costRows,rateRows,"EUR");
  const monthToDate = reporting.converted.reduce((sum,row)=>sum+row.amountMinor,0n);
  const variableKnown = reporting.converted.filter((row)=>row.kind!=="subscription"&&row.amountBasis!=="invoice").reduce((sum,row)=>sum+row.amountMinor,0n);
  const excludedCurrencies = [...[...reporting.missing,...commitmentReporting.missing].reduce((totals,row)=>totals.set(row.currency,(totals.get(row.currency)??0n)+row.amountMinor),new Map<string,bigint>())].map(([currency,amountMinor])=>({currency,amountMinor}));
  const wasteAccounts = new Set(openAlerts.filter((item)=>item.billingAccountId).map((item)=>item.billingAccountId));
  const potentialWaste = sumMonthlyCommitments(subscriptionRows.filter((row)=>wasteAccounts.has(row.billingAccountId)),"EUR").amountMinor;
  const evidenceRows=recentIntegrations.length?await db.select({integrationId:projectIntegrations.id,key:detectionEvidence.key,filePath:detectionEvidence.filePath}).from(projectIntegrations).innerJoin(projects,eq(projects.id,projectIntegrations.projectId)).innerJoin(repositories,eq(repositories.projectId,projects.id)).innerJoin(detectionEvidence,and(eq(detectionEvidence.repositoryId,repositories.id),eq(detectionEvidence.providerId,projectIntegrations.providerId))).where(inArray(projectIntegrations.id,recentIntegrations.map((item)=>item.id))).limit(40):[];
  const forecastCandidate=monthlyCommitment+variableKnown;
  const categoryByAccount=new Map(accountCategories.map((row)=>[row.billingAccountId,row.category]));const categoryTotals=new Map<string,bigint>();for(const cost of reporting.converted){const category=categoryByAccount.get(cost.billingAccountId)??"other";categoryTotals.set(category,(categoryTotals.get(category)??0n)+cost.amountMinor);}const categoryRows=[...categoryTotals].map(([name,amount])=>({name,amount})).sort((left,right)=>left.amount===right.amount?0:left.amount>right.amount?-1:1);
  const positiveCategoryTotal=categoryRows.reduce((sum,row)=>sum+(row.amount>0n?row.amount:0n),0n);
  const ledgerAllocations=allocateLedgerCosts(reporting.converted,resourceMappings,billingMappings);const allocationSummary=allocationTotals(ledgerAllocations);const absoluteTotal=reporting.converted.reduce((sum,cost)=>sum+(cost.amountMinor<0n?-cost.amountMinor:cost.amountMinor),0n);const absoluteUnallocated=ledgerAllocations.filter((allocation)=>allocation.projectId===null).reduce((sum,allocation)=>sum+(allocation.amountMinor<0n?-allocation.amountMinor:allocation.amountMinor),0n);const allocationCoverageBps=absoluteTotal===0n?10_000:Number((absoluteTotal-absoluteUnallocated)*10_000n/absoluteTotal);const latestSuccessfulSyncAt=syncRows.map((row)=>row.lastSuccessfulSyncAt).filter((date):date is Date=>Boolean(date)).sort((left,right)=>right.getTime()-left.getTime())[0]?.toISOString()??null;const allAppliedRates=new Map([...reporting.appliedRates,...commitmentReporting.appliedRates].map((rate)=>[`${rate.quoteCurrency}:${rate.rateAt.toISOString()}:${rate.source}`,rate]));
  return { ...demoData, metrics:{ monthToDate,monthlyCommitment,forecast:monthToDate>forecastCandidate?monthToDate:forecastCandidate,potentialWaste,annualized:monthlyCommitment*12n }, categories:categoryRows.map((row)=>({name:row.name,amount:row.amount,share:positiveCategoryTotal>0n?Number(row.amount*100n/positiveCategoryTotal):0})), excludedCurrencies, allocationCoverageBps,latestSuccessfulSyncAt,fxConversions:[...allAppliedRates.values()].map((rate)=>({from:rate.quoteCurrency,to:rate.baseCurrency,rateScaled:rate.rateScaled,rateScale:rate.rateScale,rateAt:rate.rateAt.toISOString(),source:rate.source,sourceUrl:rate.sourceUrl})), unallocated:[...allocationSummary.unallocated].map(([currency,amountMinor])=>({currency,amountMinor})), discoveries:recentIntegrations.map((item)=>({...item,age:"recent",evidence:evidenceRows.filter((row)=>row.integrationId===item.id).map((row)=>`${row.filePath??"manual"} → ${row.key}`)})), alerts:openAlerts.map((item)=>({id:item.id,title:item.title,detail:item.description,amount:0n})), projects:projectRows.map((item)=>({...item,monthly:allocationSummary.projects.get(item.id)?.get("EUR")??0n,scan:"—"})) };
  });
}

export async function getPortfolioData(workspaceId: string) {
  if (env.AUTH_TEST_MODE === "true" || !process.env.DATABASE_URL) return { ...demoData, unallocated: [] as Array<{ currency: string; amountMinor: bigint }>, billing: demoData.billing.map((account) => ({ ...account, allocations: [] as Array<{ projectId: string; allocationBps: number }> })) };
  return withAuthorizedWorkspace(workspaceId, async (db) => {
  const now=new Date();const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));const monthEnd=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
  const clientRows=await db.select({id:clients.id,name:clients.name,description:clients.description,projects:sql<number>`count(${projects.id})::int`}).from(clients).leftJoin(projects,eq(projects.clientId,clients.id)).where(eq(clients.workspaceId,workspaceId)).groupBy(clients.id).orderBy(clients.name);
  const projectRows=await db.select({id:projects.id,name:projects.name,client:clients.name,repositories:sql<number>`count(distinct ${repositories.id})::int`,services:sql<number>`count(distinct ${projectIntegrations.id})::int`}).from(projects).innerJoin(clients,eq(clients.id,projects.clientId)).leftJoin(repositories,eq(repositories.projectId,projects.id)).leftJoin(projectIntegrations,eq(projectIntegrations.projectId,projects.id)).where(eq(projects.workspaceId,workspaceId)).groupBy(projects.id,clients.name).orderBy(projects.name);
  const serviceRows=await db.select({id:providers.id,slug:providers.slug,name:providers.name,category:providers.category,projects:sql<number>`count(distinct ${projectIntegrations.projectId})::int`,status:sql<string>`min(${projectIntegrations.lifecycleStatus})`}).from(projectIntegrations).innerJoin(providers,eq(providers.id,projectIntegrations.providerId)).where(eq(projectIntegrations.workspaceId,workspaceId)).groupBy(providers.id).orderBy(providers.name);
  const accountRows=await db.select({id:billingAccounts.id,name:billingAccounts.name,provider:providers.name,providerId:providers.id,owner:billingAccounts.ownerType}).from(billingAccounts).innerJoin(providers,eq(providers.id,billingAccounts.providerId)).where(eq(billingAccounts.workspaceId,workspaceId)).orderBy(billingAccounts.name);
  const subscriptionRows=await db.select().from(subscriptions).where(and(eq(subscriptions.workspaceId,workspaceId),eq(subscriptions.status,"active")));
  const currentCosts=await db.select({id:costEntries.id,amountMinor:costEntries.amountMinor,currency:costEntries.currency,projectId:costEntries.projectId,externalResourceId:costEntries.externalResourceId,billingAccountId:costEntries.billingAccountId,periodStart:costEntries.periodStart,periodEnd:costEntries.periodEnd}).from(costEntries).where(and(eq(costEntries.workspaceId,workspaceId),gte(costEntries.periodEnd,monthStart),lt(costEntries.periodStart,monthEnd),isNull(costEntries.supersededAt)));
  const resourceMappings=await db.select({externalResourceId:externalResourceProjects.externalResourceId,projectId:externalResourceProjects.projectId,allocationBps:externalResourceProjects.allocationBps,allocationMethod:externalResourceProjects.allocationMethod,effectiveFrom:externalResourceProjects.effectiveFrom,effectiveTo:externalResourceProjects.effectiveTo}).from(externalResourceProjects).where(eq(externalResourceProjects.workspaceId,workspaceId));
  const billingMappings=await db.select({billingAccountId:billingAccountProjects.billingAccountId,projectId:billingAccountProjects.projectId,allocationBps:billingAccountProjects.allocationBps,allocationMethod:billingAccountProjects.allocationMethod,effectiveFrom:billingAccountProjects.effectiveFrom,effectiveTo:billingAccountProjects.effectiveTo}).from(billingAccountProjects).where(eq(billingAccountProjects.workspaceId,workspaceId));
  const rateRows=await db.select().from(fxRates).where(lte(fxRates.rateAt,monthEnd));const reporting=convertCostsForReporting(currentCosts,rateRows,"EUR");const allocationSummary=allocationTotals(allocateLedgerCosts(reporting.converted,resourceMappings,billingMappings));
  const providerByAccount=new Map(accountRows.map((account)=>[account.id,account.providerId]));const providerCosts=new Map<string,bigint>();for(const cost of reporting.converted){const providerId=providerByAccount.get(cost.billingAccountId);if(providerId)providerCosts.set(providerId,(providerCosts.get(providerId)??0n)+cost.amountMinor);}
  return { ...demoData, clients:clientRows,projects:projectRows.map((row)=>({...row,monthly:allocationSummary.projects.get(row.id)?.get("EUR")??0n,scan:"—"})),services:serviceRows.map((row)=>({...row,monthly:providerCosts.get(row.id)??0n,last:"—"})),unallocated:[...allocationSummary.unallocated].map(([currency,amountMinor])=>({currency,amountMinor})),billing:accountRows.map((row)=>{const accountSubscriptions=subscriptionRows.filter((item)=>item.billingAccountId===row.id);return {...row,allocations:billingMappings.filter((mapping)=>mapping.billingAccountId===row.id&&mapping.effectiveTo===null).map(({projectId,allocationBps})=>({projectId,allocationBps})),recurring:sumMonthlyCommitments(accountSubscriptions,"EUR").amountMinor,renewal:accountSubscriptions.map((item)=>item.renewalDate).filter((date):date is Date=>Boolean(date)).sort((a,b)=>a.getTime()-b.getTime())[0]?.toISOString().slice(0,10)??"—"};}) };
  });
}

export async function getProjectDetail(workspaceId: string, projectId: string) {
  if (env.AUTH_TEST_MODE === "true" || !process.env.DATABASE_URL) {
    const project = demoData.projects.find((item) => item.id === projectId) ?? demoData.projects[0];
    return { project: { ...project, description: null, status: "active" as const }, repositories: [{ id: "demo-repository", fullName: `yodev/${project.id}`, defaultBranch: "main", lastScan: project.scan, scanEnabled: true }], services: demoData.services.slice(0, project.services), costBreakdown: [] as Array<{ provider: string; amountMinor: bigint; currency: string; allocationMethod: string; amountBasis: string; amountStatus: string; source: string; freshness: string }> };
  }
  return withAuthorizedWorkspace(workspaceId, async (db) => {
    const [project] = await db.select({ id: projects.id, name: projects.name, description: projects.description, client: clients.name, status: projects.status, repositories: sql<number>`count(distinct ${repositories.id})::int`, services: sql<number>`count(distinct ${projectIntegrations.id})::int` }).from(projects).innerJoin(clients, eq(clients.id, projects.clientId)).leftJoin(repositories, eq(repositories.projectId, projects.id)).leftJoin(projectIntegrations, eq(projectIntegrations.projectId, projects.id)).where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId))).groupBy(projects.id, clients.name).limit(1);
    if (!project) return null;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const repositoryRows=await db.select({ id: repositories.id, fullName: repositories.fullName, defaultBranch: repositories.defaultBranch, lastScan: repositories.lastSuccessfulScanAt, scanEnabled: repositories.scanEnabled }).from(repositories).where(and(eq(repositories.workspaceId, workspaceId), eq(repositories.projectId, projectId)));
    const serviceRows=await db.select({ providerId: providers.id, slug: providers.slug, name: providers.name, category: providers.category, status: projectIntegrations.lifecycleStatus, last: projectIntegrations.lastDetectedAt, projects: sql<number>`1` }).from(projectIntegrations).innerJoin(providers, eq(providers.id, projectIntegrations.providerId)).where(and(eq(projectIntegrations.workspaceId, workspaceId), eq(projectIntegrations.projectId, projectId)));
    const currentCosts=await db.select({id:costEntries.id,billingAccountId:costEntries.billingAccountId,externalResourceId:costEntries.externalResourceId,projectId:costEntries.projectId,amountMinor:costEntries.amountMinor,currency:costEntries.currency,periodStart:costEntries.periodStart,periodEnd:costEntries.periodEnd,amountBasis:costEntries.amountBasis,amountStatus:costEntries.amountStatus,source:costEntries.source,updatedAt:costEntries.updatedAt,provider:providers.name}).from(costEntries).innerJoin(billingAccounts,and(eq(billingAccounts.id,costEntries.billingAccountId),eq(billingAccounts.workspaceId,workspaceId))).innerJoin(providers,eq(providers.id,billingAccounts.providerId)).where(and(eq(costEntries.workspaceId,workspaceId),gte(costEntries.periodEnd,monthStart),lt(costEntries.periodStart,monthEnd),isNull(costEntries.supersededAt)));
    const resourceMappings=await db.select({externalResourceId:externalResourceProjects.externalResourceId,projectId:externalResourceProjects.projectId,allocationBps:externalResourceProjects.allocationBps,allocationMethod:externalResourceProjects.allocationMethod,effectiveFrom:externalResourceProjects.effectiveFrom,effectiveTo:externalResourceProjects.effectiveTo}).from(externalResourceProjects).where(eq(externalResourceProjects.workspaceId,workspaceId));
    const billingMappings=await db.select({billingAccountId:billingAccountProjects.billingAccountId,projectId:billingAccountProjects.projectId,allocationBps:billingAccountProjects.allocationBps,allocationMethod:billingAccountProjects.allocationMethod,effectiveFrom:billingAccountProjects.effectiveFrom,effectiveTo:billingAccountProjects.effectiveTo}).from(billingAccountProjects).where(eq(billingAccountProjects.workspaceId,workspaceId));
    const rateRows=await db.select().from(fxRates).where(lte(fxRates.rateAt,monthEnd));const reporting=convertCostsForReporting(currentCosts,rateRows,"EUR");const allocations=allocateLedgerCosts(reporting.converted,resourceMappings,billingMappings).filter((allocation)=>allocation.projectId===projectId);const monthly=allocations.reduce((sum,allocation)=>sum+allocation.amountMinor,0n);const costById=new Map(reporting.converted.map((cost)=>[cost.id,cost]));const breakdown=new Map<string,{provider:string;amountMinor:bigint;currency:string;allocationMethod:string;amountBasis:string;amountStatus:string;source:string;freshness:string}>();for(const allocation of allocations){const cost=costById.get(allocation.costId);if(!cost)continue;const key=[cost.provider,allocation.allocationMethod,cost.amountBasis,cost.amountStatus,cost.source].join("\u001f");const current=breakdown.get(key);breakdown.set(key,{provider:cost.provider,amountMinor:(current?.amountMinor??0n)+allocation.amountMinor,currency:"EUR",allocationMethod:allocation.allocationMethod,amountBasis:cost.amountBasis,amountStatus:cost.amountStatus,source:cost.source,freshness:(current?.freshness??cost.updatedAt.toISOString())>cost.updatedAt.toISOString()?(current?.freshness??cost.updatedAt.toISOString()):cost.updatedAt.toISOString()});}
    const latestScan = repositoryRows.map((row) => row.lastScan).filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      project: { ...project, monthly, scan: latestScan?.toISOString() ?? null },
      repositories: repositoryRows.map((item) => ({ ...item, lastScan: item.lastScan?.toISOString() ?? null })),
      services: serviceRows.map((service) => ({ ...service, monthly: 0n })),
      costBreakdown: [...breakdown.values()].sort((left,right)=>left.provider.localeCompare(right.provider)),
    };
  });
}

export async function getClientDetail(workspaceId: string, clientId: string) {
  if (env.AUTH_TEST_MODE === "true" || !process.env.DATABASE_URL) {
    const client = demoData.clients.find((item) => item.id === clientId) ?? demoData.clients[0];
    return { client: { ...client, status: "active" as const }, projects: demoData.projects.filter((item) => item.client === client.name).map((item) => ({ ...item, status: "active" as const })) };
  }
  return withAuthorizedWorkspace(workspaceId, async (db) => {
    const [client] = await db.select().from(clients).where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, clientId))).limit(1);
    if (!client) return null;
    const projectRows = await db.select({ id: projects.id, name: projects.name, client: clients.name, repositories: sql<number>`count(distinct ${repositories.id})::int`, services: sql<number>`count(distinct ${projectIntegrations.id})::int`, status: projects.status, lastScan: sql<Date | null>`max(${repositories.lastSuccessfulScanAt})` }).from(projects).innerJoin(clients, eq(clients.id, projects.clientId)).leftJoin(repositories, eq(repositories.projectId, projects.id)).leftJoin(projectIntegrations, eq(projectIntegrations.projectId, projects.id)).where(and(eq(projects.workspaceId, workspaceId), eq(projects.clientId, clientId))).groupBy(projects.id, clients.name).orderBy(projects.name);
    return { client, projects: projectRows.map((row) => ({ ...row, monthly: 0n, scan: row.lastScan?.toISOString() ?? null })) };
  });
}

export async function getServiceDetail(workspaceId: string, providerSlug: string) {
  if (env.AUTH_TEST_MODE === "true" || !process.env.DATABASE_URL) {
    const service = demoData.services.find((item) => item.slug === providerSlug);
    return service ? { service, integrations: [], evidence: [], recurring: [] } : null;
  }

  return withAuthorizedWorkspace(workspaceId, async (db) => {
    const [provider] = await db.select({
      id: providers.id,
      slug: providers.slug,
      name: providers.name,
      category: providers.category,
    }).from(providers).where(eq(providers.slug, providerSlug)).limit(1);
    if (!provider) return null;

    const integrationRows = await db.select({
        id: projectIntegrations.id,
        projectId: projects.id,
        projectName: projects.name,
        lifecycleStatus: projectIntegrations.lifecycleStatus,
        reviewStatus: projectIntegrations.reviewStatus,
        confidence: projectIntegrations.confidence,
        firstDetectedAt: projectIntegrations.firstDetectedAt,
        lastDetectedAt: projectIntegrations.lastDetectedAt,
      }).from(projectIntegrations)
        .innerJoin(projects, and(eq(projects.id, projectIntegrations.projectId), eq(projects.workspaceId, workspaceId)))
        .where(and(eq(projectIntegrations.workspaceId, workspaceId), eq(projectIntegrations.providerId, provider.id)))
        .orderBy(desc(projectIntegrations.lastDetectedAt));
    const evidenceRows = await db.selectDistinct({
        id: detectionEvidence.id,
        projectId: projects.id,
        projectName: projects.name,
        repositoryName: repositories.fullName,
        type: detectionEvidence.type,
        key: detectionEvidence.key,
        filePath: detectionEvidence.filePath,
        createdAt: detectionEvidence.createdAt,
      }).from(detectionEvidence)
        .innerJoin(repositories, and(eq(repositories.id, detectionEvidence.repositoryId), eq(repositories.workspaceId, workspaceId)))
        .innerJoin(projects, and(eq(projects.id, repositories.projectId), eq(projects.workspaceId, workspaceId)))
        .where(and(eq(detectionEvidence.workspaceId, workspaceId), eq(detectionEvidence.providerId, provider.id)))
        .orderBy(desc(detectionEvidence.createdAt))
        .limit(100);
    const subscriptionRows = await db.select({
        accountId: billingAccounts.id,
        accountName: billingAccounts.name,
        source: billingAccounts.source,
        amountMinor: subscriptions.amountMinor,
        currency: subscriptions.currency,
        billingModel: subscriptions.billingModel,
        billingInterval: subscriptions.billingInterval,
        status: subscriptions.status,
      }).from(subscriptions)
        .innerJoin(billingAccounts, and(eq(billingAccounts.id, subscriptions.billingAccountId), eq(billingAccounts.workspaceId, workspaceId)))
        .where(and(
          eq(subscriptions.workspaceId, workspaceId),
          eq(subscriptions.status, "active"),
          eq(billingAccounts.providerId, provider.id),
        ));

    const recurringByCurrency = new Map<string, bigint>();
    for (const currency of new Set(subscriptionRows.map((subscription) => subscription.currency))) {
      recurringByCurrency.set(currency, sumMonthlyCommitments(subscriptionRows, currency).amountMinor);
    }

    return {
      service: {
        ...provider,
        projects: integrationRows.length,
      },
      integrations: integrationRows,
      evidence: evidenceRows,
      recurring: [...recurringByCurrency].map(([currency, amountMinor]) => ({ currency, amountMinor })),
    };
  });
}
