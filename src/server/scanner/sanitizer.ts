const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const FORBIDDEN_METADATA_KEYS = /value|secret|token|password|authorization|content/i;

export function extractEnvironmentVariableNames(content: string) {
  const names = new Set<string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equals = withoutExport.indexOf("=");
    if (equals < 1) continue;
    const name = withoutExport.slice(0, equals).trim();
    if (ENV_NAME.test(name)) names.add(name);
  }
  return [...names];
}

export function sanitizeMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.test(key)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) clean[key] = value as string | number | boolean | null;
  }
  return clean;
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(/(bearer|token|key|secret|password)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]").slice(0, 500);
}
