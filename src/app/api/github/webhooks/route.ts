import { eq } from "drizzle-orm";
import { verify } from "@octokit/webhooks-methods";
import { githubInstallations } from "@/db/schema";
import { requireDb } from "@/db";
import { env } from "@/lib/env";

export const runtime="nodejs";

export async function POST(request:Request){if(!env.GITHUB_APP_WEBHOOK_SECRET)return new Response("Webhook not configured",{status:503});const signature=request.headers.get("x-hub-signature-256");const event=request.headers.get("x-github-event");const raw=await request.text();if(!signature||!(await verify(env.GITHUB_APP_WEBHOOK_SECRET,raw,signature)))return new Response("Invalid signature",{status:401});const payload=JSON.parse(raw) as {action?:string;installation?:{id:number;account:{login:string;type?:string}}};if(!payload.installation)return Response.json({accepted:true});const status=payload.action==="deleted"?"deleted":payload.action==="suspend"?"suspended":"active";await requireDb().update(githubInstallations).set({accountLogin:payload.installation.account.login,accountType:payload.installation.account.type??"unknown",status,lastSyncedAt:new Date(),updatedAt:new Date()}).where(eq(githubInstallations.installationId,payload.installation.id));return Response.json({accepted:true,event});}
