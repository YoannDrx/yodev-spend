import { requireWorkspaceContext } from "@/server/auth/context";
import { exportWorkspace } from "@/server/exports/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireWorkspaceContext("fr",true);
  if (!context.role.split(",").includes("owner")) return Response.json({error: "FORBIDDEN"}, {status: 403});
  try {
    return new Response(await exportWorkspace(context), {headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="spend-workspace-${new Date().toISOString().slice(0,10)}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    }});
  } catch (error) {
    if (error instanceof Error && error.message === "EXPORT_WINDOW_EXPIRED") return Response.json({error:"EXPORT_WINDOW_EXPIRED"},{status:410,headers:{"Cache-Control":"no-store"}});
    return Response.json({error: error instanceof Error && error.message === "EXPORT_TOO_LARGE" ? "EXPORT_TOO_LARGE" : "EXPORT_FAILED"}, {status: error instanceof Error && error.message === "EXPORT_TOO_LARGE" ? 413 : 500, headers: {"Cache-Control": "no-store"}});
  }
}
