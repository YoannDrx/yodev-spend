import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import {
  completeGitHubInstallation,
  GitHubInstallFlowError,
  prepareGitHubInstallationAuthorization,
} from "@/server/github/install-flow";

export const runtime="nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  if (!state) return new Response("Invalid GitHub installation state", { status: 400 });
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.redirect(new URL("/fr/sign-in", url));
  try {
    const code = url.searchParams.get("code");
    if (code) {
      const result = await completeGitHubInstallation({ state, code, userId: session.user.id });
      return NextResponse.redirect(new URL(`/${result.locale}/settings/github?installed=1`, url));
    }
    const installationId = Number(url.searchParams.get("installation_id"));
    const authorizationUrl = await prepareGitHubInstallationAuthorization({
      state,
      userId: session.user.id,
      installationId,
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const code = error instanceof GitHubInstallFlowError ? error.code : "installation_failed";
    return NextResponse.redirect(new URL(`/fr/settings/github?error=${encodeURIComponent(code)}`, url));
  }
}
