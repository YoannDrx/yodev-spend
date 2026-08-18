import { processStripeWebhook, StripeWebhookSignatureError } from "@/server/commercial/stripe-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });
  try {
    await processStripeWebhook(await request.text(), signature);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof StripeWebhookSignatureError) return new Response("Invalid Stripe signature", { status: 400 });
    return new Response("Stripe event processing failed", { status: 500 });
  }
}
