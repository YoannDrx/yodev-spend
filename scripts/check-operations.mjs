import 'dotenv/config';
import { Client } from 'pg';
const connectionString=process.env.DATABASE_SERVICE_URL;
if(!connectionString)throw new Error('DATABASE_SERVICE_URL is required.');
let client;
try {
  const url=new URL(connectionString);if(url.searchParams.get('sslmode')==='require')url.searchParams.set('sslmode','verify-full');
  client=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000});
  await client.connect();await client.query('begin read only');await client.query("set local statement_timeout='30s'");
  const checks={
    abandonedScans:"select count(*)::int as count from scan_runs where status in ('pending','running') and updated_at<now()-interval '30 minutes'",
    abandonedSyncs:"select count(*)::int as count from connector_sync_runs where status in ('pending','running') and updated_at<now()-interval '30 minutes'",
    overdueDeletions:"select count(*)::int as count from data_deletion_jobs where status in ('scheduled','export_window','purging','failed') and purge_scheduled_at<now()-interval '1 day'",
    failedDeletions:"select count(*)::int as count from data_deletion_jobs where status='failed'",
    connectionsWithoutRecentSuccess:"select count(*)::int as count from provider_connections c join workspace_profiles w on w.id=c.workspace_id where c.archived_at is null and c.status in ('active','error','rate_limited') and w.commercial_status in ('private','active','trialing','past_due') and c.created_at<now()-interval '2 days' and (c.last_successful_sync_at is null or c.last_successful_sync_at<now()-interval '2 days')",
  };
  const report={checkedAt:new Date().toISOString(),signals:{}};
  for(const [name,query] of Object.entries(checks))report.signals[name]=(await client.query(query)).rows[0].count;
  await client.query('commit');console.log(JSON.stringify(report,null,2));
  if(Object.values(report.signals).some(count=>count>0))process.exitCode=1;
} catch {console.error('Operations check failed; database details suppressed.');process.exitCode=2;}
finally {await client?.end();}
