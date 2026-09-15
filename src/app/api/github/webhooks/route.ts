import { verify } from "@octokit/webhooks-methods";
import { env } from "@/lib/env";
import { reconcileGitHubWebhook } from "@/server/github/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) return new Response("Webhook not configured",{status:503});
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) return new Response("Invalid signature",{status:401});
  if (Number(request.headers.get("content-length")) > 2_000_000) return new Response("Payload too large",{status:413});
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 2_000_000) return new Response("Payload too large",{status:413});
  try {
    if (!await verify(env.GITHUB_APP_WEBHOOK_SECRET,raw,signature)) return new Response("Invalid signature",{status:401});
  } catch { return new Response("Invalid signature",{status:401}); }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new Response("Invalid payload",{status:400}); }
  try {
    await reconcileGitHubWebhook(request.headers.get("x-github-event"),payload);
    return Response.json({accepted:true});
  } catch {
    return new Response("Webhook processing failed",{status:503});
  }
}
