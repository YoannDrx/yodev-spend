import { AlertTriangle, Check, CircleDashed, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, label }: { status: "active" | "confirmed" | "candidate" | "stale" | "removed" | "ignored" | "critical" | "archived"; label?: string }) {
  const icons = { active: Check, confirmed: Check, candidate: CircleDashed, stale: AlertTriangle, removed: X, ignored: X, critical: AlertTriangle, archived: X };
  const Icon = icons[status];
  return <span className={cn("status-badge", `status-${status}`)}><Icon size={12} />{label ?? status}</span>;
}
