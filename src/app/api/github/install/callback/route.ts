import { NextResponse } from "next/server";
import { githubInstallations } from "@/db/schema";
import { requireDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { ensureWorkspaceForUser } from "@/server/auth/context";

export const runtime="nodejs";

export async function GET(request:Request){const url=new URL(request.url);const installationId=Number(url.searchParams.get("installation_id"));if(!Number.isSafeInteger(installationId))return new Response("Invalid installation",{status:400});const session=await getAuth().api.getSession({headers:request.headers});if(!session?.user)return NextResponse.redirect(new URL("/fr/sign-in",url));const workspace=await ensureWorkspaceForUser(session.user.id);await requireDb().insert(githubInstallations).values({workspaceId:workspace.workspaceId,installationId,accountLogin:"pending-sync",accountType:"unknown",status:"active",lastSyncedAt:new Date()}).onConflictDoUpdate({target:[githubInstallations.workspaceId,githubInstallations.installationId],set:{status:"active",lastSyncedAt:new Date(),updatedAt:new Date()}});return NextResponse.redirect(new URL("/fr/settings/github?installed=1",url));}
