import { Archive } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { archiveClient } from "@/server/actions/portfolio";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getClientDetail } from "@/server/dashboard/queries";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; clientId: string }>;
}) {
  const { locale, clientId } = await params;
  const context = await requireWorkspaceContext(locale);
  const [t, data] = await Promise.all([
    getTranslations("Clients"),
    getClientDetail(context.workspaceId, clientId),
  ]);
  if (!data) notFound();

  const action = data.client.status !== "archived" ? (
    <form action={archiveClient}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="clientId" value={clientId} />
      <button className="button" type="submit"><Archive size={13} />{t("archive")}</button>
    </form>
  ) : <StatusBadge status="archived" />;

  return (
    <>
      <PageHeader title={data.client.name} subtitle={data.client.description ?? t("subtitle")} action={action} />
      <section className="panel">
        <div className="panel-head"><h2>{t("projects")}</h2></div>
        <div className="panel-body">
          {data.projects.map((project) => (
            <div className="list-row" key={project.id}>
              <div>
                <Link href={`/projects/${project.id}`}><strong>{project.name}</strong></Link>
                <small>{project.repositories} repositories · {project.services} services</small>
              </div>
              <StatusBadge status={project.status === "archived" ? "archived" : "active"} />
            </div>
          ))}
          {!data.projects.length ? <div className="empty">{t("emptyProjects")}</div> : null}
        </div>
      </section>
    </>
  );
}
