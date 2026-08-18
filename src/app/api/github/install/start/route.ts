import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { ensureWorkspaceForUser, findWorkspaceMembership } from "@/server/auth/context";
import { createGitHubInstallAttempt } from "@/server/github/install-flow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const input = z.object({ locale: z.enum(["fr", "en"]) }).parse(Object.fromEntries(formData));
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.redirect(new URL(`/${input.locale}/sign-in`, request.url), 303);
  const workspace = await findWorkspaceMembership(session.user.id, session.session.activeOrganizationId)
    ?? await ensureWorkspaceForUser(session.user.id);
  if (!workspace.role.split(",").some((role) => role === "owner" || role === "admin")) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = await createGitHubInstallAttempt({
    workspaceId: workspace.workspaceId,
    userId: session.user.id,
    locale: input.locale,
  });
  return NextResponse.redirect(url, 303);
}
