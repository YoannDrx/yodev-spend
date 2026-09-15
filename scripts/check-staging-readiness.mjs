import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';

// Read-only: output names/statuses, never configuration values or provider responses.
const configuration = process.argv[2] ? parse(readFileSync(process.argv[2])) : process.env;
const groups = {
  database: ['DATABASE_APP_URL','DATABASE_SERVICE_URL'],
  githubOAuth: ['BETTER_AUTH_SECRET','GITHUB_OAUTH_CLIENT_ID','GITHUB_OAUTH_CLIENT_SECRET'],
  githubApp: ['GITHUB_APP_ID','GITHUB_APP_SLUG','GITHUB_APP_CLIENT_ID','GITHUB_APP_CLIENT_SECRET','GITHUB_APP_PRIVATE_KEY','GITHUB_APP_WEBHOOK_SECRET','CONNECTOR_ENCRYPTION_KEY'],
  googleOAuth: ['GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'],
  invitations: ['RESEND_API_KEY','RESEND_FROM_EMAIL'],
  stripeSandbox: ['STRIPE_RESTRICTED_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_SOLO_MONTHLY_PRICE_ID','STRIPE_SOLO_ANNUAL_PRICE_ID','STRIPE_STUDIO_MONTHLY_PRICE_ID','STRIPE_STUDIO_ANNUAL_PRICE_ID'],
};
const report = { checkedAt: new Date().toISOString(), checks: {} };
for (const [name,keys] of Object.entries(groups)) report.checks[name] = { configured: keys.every(key=>Boolean(configuration[key])), missing: keys.filter(key=>!configuration[key]) };
report.checks.stripeSandbox.testMode = /^(?:sk|rk)_test_/.test(configuration.STRIPE_RESTRICTED_KEY??'');
report.redactedKeys=Object.keys(configuration).filter(key=>/^(?:\[?(?:redacted|sensitive)\]?)$/i.test(configuration[key]??""));
const appURL=configuration.DATABASE_APP_URL, serviceURL=configuration.DATABASE_SERVICE_URL;
report.checks.database.distinctRoles=false;
try {report.checks.database.distinctRoles=Boolean(appURL&&serviceURL&&new URL(appURL).username!==new URL(serviceURL).username);} catch {report.checks.database.validUrls=false;}
if (report.redactedKeys.includes("GITHUB_APP_PRIVATE_KEY")) {report.checks.githubApp.authentication="unverifiable_redacted_value";}
else if (configuration.GITHUB_APP_ID&&configuration.GITHUB_APP_PRIVATE_KEY) {
  try {
    const octokit=new Octokit({authStrategy:createAppAuth,auth:{appId:configuration.GITHUB_APP_ID,privateKey:configuration.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g,'\n')},log:{debug(){},info(){},warn(){},error(){}},request:{timeout:15000}});
    const app=await octokit.request('GET /app');
    report.checks.githubApp.authenticated=app.status===200;
    report.checks.githubApp.slugMatches=app.data.slug===configuration.GITHUB_APP_SLUG;
    report.checks.githubApp.permissions={contents:app.data.permissions.contents??'none',metadata:app.data.permissions.metadata??'none'};
    const installs=await octokit.request('GET /app/installations',{per_page:100});
    report.checks.githubApp.installationCount=installs.data.length;
  } catch(error) {report.checks.githubApp.authenticated=false;report.checks.githubApp.errorType=error?.name??"unknown";report.checks.githubApp.httpStatus=typeof error?.status==='number'?error.status:null;}
}
console.log(JSON.stringify(report,null,2));
if(!report.checks.database.configured||!report.checks.database.distinctRoles||!report.checks.stripeSandbox.testMode||!report.checks.invitations.configured)process.exitCode=1;
