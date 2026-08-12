import type { EvidenceType } from "../types";

export type ProviderFingerprint = { providerSlug: string; packages?: string[]; envVariables?: string[]; importPatterns?: string[]; configFiles?: string[]; domains?: string[]; workflowPatterns?: string[]; iacPatterns?: string[] };
export type FingerprintField = Exclude<keyof ProviderFingerprint, "providerSlug">;

export const FINGERPRINT_VERSION = "1";

export const fingerprints: ProviderFingerprint[] = [
  { providerSlug:"vercel", packages:["@vercel/analytics","@vercel/functions","@vercel/blob","@vercel/kv"], envVariables:["VERCEL","VERCEL_URL","VERCEL_PROJECT_ID"], configFiles:["vercel.json"], domains:["vercel.com"] },
  { providerSlug:"aws", packages:["aws-sdk","@aws-sdk/client-s3","@aws-sdk/client-sesv2","@aws-sdk/client-lambda"], envVariables:["AWS_REGION","AWS_ACCESS_KEY_ID"], importPatterns:["@aws-sdk/"], iacPatterns:["provider \"aws\"","AWS::"] },
  { providerSlug:"cloudflare", packages:["wrangler","@cloudflare/workers-types"], envVariables:["CLOUDFLARE_API_TOKEN"], configFiles:["wrangler.toml","wrangler.jsonc"], domains:["api.cloudflare.com"] },
  { providerSlug:"github", packages:["octokit","@octokit/rest"], envVariables:["GITHUB_TOKEN","GITHUB_APP_ID"], workflowPatterns:["actions/checkout@","github.event"] },
  { providerSlug:"resend", packages:["resend"], envVariables:["RESEND_API_KEY"], importPatterns:["resend"], domains:["api.resend.com"] },
  { providerSlug:"sendgrid", packages:["@sendgrid/mail","sendgrid"], envVariables:["SENDGRID_API_KEY"], importPatterns:["@sendgrid/"], domains:["api.sendgrid.com"] },
  { providerSlug:"mailgun", packages:["mailgun.js","mailgun-js"], envVariables:["MAILGUN_API_KEY"], importPatterns:["mailgun"], domains:["api.mailgun.net"] },
  { providerSlug:"postmark", packages:["postmark"], envVariables:["POSTMARK_SERVER_TOKEN"], importPatterns:["postmark"], domains:["api.postmarkapp.com"] },
  { providerSlug:"supabase", packages:["@supabase/supabase-js","@supabase/ssr"], envVariables:["SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL"], importPatterns:["@supabase/"], domains:["supabase.co"] },
  { providerSlug:"firebase", packages:["firebase","firebase-admin"], envVariables:["FIREBASE_PROJECT_ID"], configFiles:["firebase.json",".firebaserc"], importPatterns:["firebase/"] },
  { providerSlug:"neon", packages:["@neondatabase/serverless"], envVariables:["NEON_DATABASE_URL"], importPatterns:["@neondatabase/"], domains:["neon.tech"] },
  { providerSlug:"mongodb-atlas", packages:["mongodb","mongoose"], envVariables:["MONGODB_URI"], domains:["mongodb.net"] },
  { providerSlug:"upstash", packages:["@upstash/redis","@upstash/qstash"], envVariables:["UPSTASH_REDIS_REST_URL"], importPatterns:["@upstash/"] },
  { providerSlug:"railway", envVariables:["RAILWAY_ENVIRONMENT"], configFiles:["railway.json","railway.toml"], domains:["railway.app"] },
  { providerSlug:"render", envVariables:["RENDER_SERVICE_ID"], configFiles:["render.yaml"], domains:["onrender.com"] },
  { providerSlug:"netlify", packages:["@netlify/functions"], envVariables:["NETLIFY"], configFiles:["netlify.toml"], importPatterns:["@netlify/"] },
  { providerSlug:"fly-io", envVariables:["FLY_APP_NAME"], configFiles:["fly.toml"], domains:["fly.dev"] },
  { providerSlug:"openai", packages:["openai"], envVariables:["OPENAI_API_KEY"], importPatterns:["openai"], domains:["api.openai.com"] },
  { providerSlug:"anthropic", packages:["@anthropic-ai/sdk"], envVariables:["ANTHROPIC_API_KEY"], importPatterns:["@anthropic-ai/"], domains:["api.anthropic.com"] },
  { providerSlug:"sentry", packages:["@sentry/nextjs","@sentry/node","@sentry/react"], envVariables:["SENTRY_DSN","NEXT_PUBLIC_SENTRY_DSN"], importPatterns:["@sentry/"], domains:["sentry.io"] },
  { providerSlug:"posthog", packages:["posthog-js","posthog-node"], envVariables:["POSTHOG_KEY","NEXT_PUBLIC_POSTHOG_KEY"], importPatterns:["posthog"], domains:["posthog.com"] },
  { providerSlug:"stripe", packages:["stripe","@stripe/stripe-js","@stripe/react-stripe-js"], envVariables:["STRIPE_SECRET_KEY","NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"], importPatterns:["stripe"], domains:["api.stripe.com"] },
  { providerSlug:"twilio", packages:["twilio"], envVariables:["TWILIO_ACCOUNT_SID"], importPatterns:["twilio"], domains:["api.twilio.com"] },
  { providerSlug:"mapbox", packages:["mapbox-gl","@mapbox/mapbox-gl-geocoder"], envVariables:["MAPBOX_ACCESS_TOKEN","NEXT_PUBLIC_MAPBOX_TOKEN"], importPatterns:["mapbox"], domains:["api.mapbox.com"] },
  { providerSlug:"clerk", packages:["@clerk/nextjs"], envVariables:["CLERK_SECRET_KEY","NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"], importPatterns:["@clerk/"] },
  { providerSlug:"auth0", packages:["@auth0/nextjs-auth0","auth0"], envVariables:["AUTH0_SECRET","AUTH0_DOMAIN"], importPatterns:["@auth0/"] },
  { providerSlug:"algolia", packages:["algoliasearch"], envVariables:["ALGOLIA_ADMIN_API_KEY","NEXT_PUBLIC_ALGOLIA_APP_ID"], importPatterns:["algoliasearch"], domains:["algolia.net"] },
  { providerSlug:"sanity", packages:["@sanity/client","next-sanity","sanity"], envVariables:["SANITY_PROJECT_ID","NEXT_PUBLIC_SANITY_PROJECT_ID"], importPatterns:["sanity"] },
  { providerSlug:"contentful", packages:["contentful","contentful-management"], envVariables:["CONTENTFUL_SPACE_ID"], importPatterns:["contentful"], domains:["contentful.com"] }
];

export const evidenceTypeForField: Record<FingerprintField, EvidenceType> = { packages:"package", envVariables:"env_variable", importPatterns:"import", configFiles:"config_file", domains:"domain", workflowPatterns:"workflow", iacPatterns:"iac" };
