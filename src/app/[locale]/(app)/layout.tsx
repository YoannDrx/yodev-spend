import { AppShell } from "@/components/app-shell";
import { requireWorkspaceContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  await requireWorkspaceContext(locale);
  return <AppShell>{children}</AppShell>;
}
