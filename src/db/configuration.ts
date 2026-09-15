export function validateRuntimeDatabaseConfiguration(input: {
  NODE_ENV?: string;
  DATABASE_APP_URL?: string;
  DATABASE_SERVICE_URL?: string;
}) {
  if (input.NODE_ENV !== "production") return;
  const expected = [["DATABASE_APP_URL", "spend_app"], ["DATABASE_SERVICE_URL", "spend_service"]] as const;
  const urls = expected.map(([key, role]) => {
    const value = input[key];
    if (!value) throw new Error(`${key} is required in production.`);
    let url: URL;
    try { url = new URL(value); } catch { throw new Error(`${key} must be a valid PostgreSQL URL.`); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.username) !== role) throw new Error(`${key} must authenticate as ${role}.`);
    return url;
  });
  // Neon pooled and direct hostnames may differ; the database name must agree.
  if (urls[0].pathname !== urls[1].pathname) throw new Error("Runtime roles must target the same database.");
}
