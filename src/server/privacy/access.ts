import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import type { SpendExecutor } from "@/db";
import { dataDeletionJobs } from "@/db/schema";

export async function isExportWindowExpired(db: SpendExecutor, workspaceId: string, now = new Date()) {
  const [job] = await db.select({id:dataDeletionJobs.id}).from(dataDeletionJobs).where(and(
    eq(dataDeletionJobs.workspaceId,workspaceId),
    inArray(dataDeletionJobs.status,["scheduled","export_window","purging","failed","completed"]),
    lte(dataDeletionJobs.exportAvailableUntil,now),
  )).limit(1);
  return Boolean(job);
}
