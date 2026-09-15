-- Ordinary audit history remains append-only. Only the trusted service role
-- executing an explicitly scheduled erasure may remove a tenant's audit PII.
CREATE POLICY "audit_events_service_erasure" ON "audit_events" FOR DELETE
USING (
  spend_is_service()
  AND EXISTS (
    SELECT 1 FROM workspace_profiles w
    JOIN data_deletion_jobs j ON j.workspace_id = w.id
    WHERE w.id = audit_events.workspace_id
      AND w.commercial_status = 'deletion_scheduled'
      AND j.status = 'purging'
  )
);
