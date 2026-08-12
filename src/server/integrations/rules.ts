export function shouldMarkStale({ lifecycleStatus, consecutiveAbsences, firstAbsentAt, now, complete }: { lifecycleStatus: string; consecutiveAbsences: number; firstAbsentAt: Date | null; now: Date; complete: boolean }) {
  if (!complete || !["active", "candidate"].includes(lifecycleStatus) || consecutiveAbsences < 3 || !firstAbsentAt) return false;
  return now.getTime() - firstAbsentAt.getTime() >= 14 * 24 * 60 * 60 * 1000;
}

export function isPossibleMigration({ oldCategory, newCategory, oldStaleAt, newActiveAt }: { oldCategory: string; newCategory: string; oldStaleAt: Date; newActiveAt: Date }) {
  return oldCategory === newCategory && Math.abs(oldStaleAt.getTime() - newActiveAt.getTime()) <= 30 * 24 * 60 * 60 * 1000;
}
