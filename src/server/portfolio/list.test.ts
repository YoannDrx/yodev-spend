import { describe, expect, it } from "vitest";
import { portfolioList } from "./list";

describe("portfolio filters", () => {
  const rows = [{name: "Équipe", status: "active", client: "Studio"}, {name: "Old",status: "archived"}];
  it("matches accents and client names and excludes archives by default", () => {
    expect(portfolioList(rows,{q:"equipe"}).count).toBe(1);
    expect(portfolioList(rows,{q:"studio"}).count).toBe(1);
    expect(portfolioList(rows,{}).count).toBe(1);
    expect(portfolioList(rows,{status:"archived"}).rows[0].name).toBe("Old");
  });
  it("clamps invalid and excessive page numbers without hiding results", () => {
    expect(portfolioList(rows,{page:"Infinity"}).page).toBe(1);
    expect(portfolioList(rows,{page:"999"}).rows).toHaveLength(1);
    expect(portfolioList(rows,{q:"missing"}).pageCount).toBe(1);
  });
});
