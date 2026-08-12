import type { InferInsertModel } from "drizzle-orm";
import type { providers } from "@/db/schema";

type ProviderSeed = Pick<InferInsertModel<typeof providers>, "slug"|"name"|"category"|"websiteUrl">;

export const providerCatalog: ProviderSeed[] = [
  ["vercel","Vercel","hosting","https://vercel.com"],["aws","AWS","cloud","https://aws.amazon.com"],["cloudflare","Cloudflare","cloud","https://cloudflare.com"],["github","GitHub","developer_tool","https://github.com"],
  ["resend","Resend","email","https://resend.com"],["sendgrid","SendGrid","email","https://sendgrid.com"],["mailgun","Mailgun","email","https://mailgun.com"],["postmark","Postmark","email","https://postmarkapp.com"],
  ["supabase","Supabase","database","https://supabase.com"],["firebase","Firebase","database","https://firebase.google.com"],["neon","Neon","database","https://neon.tech"],["mongodb-atlas","MongoDB Atlas","database","https://mongodb.com/atlas"],["upstash","Upstash","database","https://upstash.com"],
  ["railway","Railway","hosting","https://railway.com"],["render","Render","hosting","https://render.com"],["netlify","Netlify","hosting","https://netlify.com"],["fly-io","Fly.io","hosting","https://fly.io"],
  ["openai","OpenAI","ai","https://openai.com"],["anthropic","Anthropic","ai","https://anthropic.com"],["sentry","Sentry","observability","https://sentry.io"],["posthog","PostHog","analytics","https://posthog.com"],
  ["stripe","Stripe","payments","https://stripe.com"],["twilio","Twilio","messaging","https://twilio.com"],["mapbox","Mapbox","maps","https://mapbox.com"],["clerk","Clerk","authentication","https://clerk.com"],["auth0","Auth0","authentication","https://auth0.com"],["algolia","Algolia","developer_tool","https://algolia.com"],["sanity","Sanity","cms","https://sanity.io"],["contentful","Contentful","cms","https://contentful.com"]]
  .map(([slug,name,category,websiteUrl])=>({slug,name,category:category as ProviderSeed["category"],websiteUrl}));
