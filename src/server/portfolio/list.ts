type SearchParams = Record<string, string | string[] | undefined>;

export function portfolioList<T extends {name: string; status: string; client?: string; description?: string | null}>(rows: T[], params: SearchParams) {
  const query = typeof params.q === "string" ? params.q.trim().slice(0,140) : "";
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const filtered = rows.filter(row => (status === "all" || (status === "archived" ? row.status === "archived" : row.status !== "archived")) && normalize([row.name, row.client, row.description].join(" ")).includes(normalize(query)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const requested = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return {query, status, count: filtered.length, page, pageCount, rows: filtered.slice((page - 1) * 20, page * 20)};
}
