import { AppShell } from "@/components/app-shell";
import { requireWorkspaceContext } from "@/server/auth/context";
import { workspaceProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const context = await requireWorkspaceContext(locale);
  const workspace = await withAuthorizedWorkspace(context.workspaceId, async (db) => {
    const [row] = await db.select({ name: workspaceProfiles.name }).from(workspaceProfiles).where(eq(workspaceProfiles.id, context.workspaceId)).limit(1);
    return row;
  });
  return <AppShell workspaceName={workspace?.name ?? "Spend"} role={context.role}>{children}</AppShell>;
}
