import { describe, expect, it } from "vitest";
import { buildReportModel, ReportError, resolveReportPeriod } from "./build";
import { testLoader } from "./__fixtures__/loader";

const today = "2026-11-13";
const now = new Date("2026-11-13T12:00:00Z");

describe("périodes de rapport", () => {
  it("mois, année, campagne, dates libres", () => {
    expect(resolveReportPeriod({ type: "month", value: "2026-10" }, { today }).range).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveReportPeriod({ type: "month" }, { today }).range).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveReportPeriod({ type: "month", value: "2026-11" }, { today }).range).toEqual({ from: "2026-11-01", to: "2026-11-12" });
    expect(resolveReportPeriod({ type: "year" }, { today }).range).toEqual({ from: "2026-01-01", to: "2026-11-12" });
    expect(resolveReportPeriod({ type: "custom", from: "2026-10-20", to: "2026-10-05" }, { today }).range).toEqual({ from: "2026-10-05", to: "2026-10-20" });
    expect(() => resolveReportPeriod({ type: "custom", from: "x" }, { today })).toThrow(ReportError);
  });
});

describe("ReportModel", () => {
  it("FR : KPI, comparaison, séries, formats, top, analyses", async () => {
    const m = await buildReportModel(
      { brandId: "b1", period: { type: "month", value: "2026-10" }, compare: true, sections: [], lang: "fr" },
      { loader: testLoader(), today, now },
    );
    expect(m.brand).toMatchObject({ name: "Café Lumière", initials: "CL" });
    expect(m.agency.name).toBe("Agence Test");
    expect(m.period).toMatchObject({ type: "month", label: "octobre 2026", title: "Rapport mensuel", days: 31 });
    expect(m.comparison?.range).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(m.sections).toEqual(["summary", "audience", "reach", "engagement", "formats", "top", "insights"]);
    const followers = m.kpis.find((k) => k.key === "followers")!;
    expect(followers.label).toBe("Abonnés");
    expect(followers.value).toBe(4000 + 122 * 6 + 1300 + 122 * 2);
    expect(followers.delta?.positive).toBe(true);
    expect(m.kpis.find((k) => k.key === "engagementRate")!.display).toMatch(/%$/);
    expect(m.series.granularity).toBe("day");
    expect(m.series.points).toHaveLength(31);
    expect(m.formats.length).toBeGreaterThan(2);
    expect(m.formats[0].bar).toBe(1);
    expect(m.topPosts.length).toBeLessThanOrEqual(6);
    expect(m.topPosts.find((p) => p.id === "p3")?.caption ?? "(publication sans texte)").toBe("(publication sans texte)");
    expect(m.insights[0].text).toMatch(/^La communauté atteint \d/);
    expect(m.insights[0].segments.some((s) => s.bold)).toBe(true);
    expect(m.insights.some((i) => i.text.startsWith("La portée"))).toBe(true);
    expect(m.insights.some((i) => i.text.startsWith("Format le plus engageant"))).toBe(true);
    expect(m.insights.some((i) => i.text.startsWith("Rythme de publication"))).toBe(true);
    expect(m.audience?.countries[0].label).toBe("Martinique");
    expect(m.csv[0].slice(0, 4)).toEqual(["Date", "Réseau", "Compte", "Abonnés"]);
    expect(m.csv).toHaveLength(1 + 31 * 2);
  });

  it("EN : traductions, campagne, sans comparaison, client sans rubrique Audience", async () => {
    const m = await buildReportModel(
      { brandId: "b1", period: { type: "campaign", value: "c1" }, compare: false, sections: ["summary", "audience", "insights", "bogus"], lang: "en" },
      { loader: testLoader({ sections: ["analytics", "reports"] }), today, now },
    );
    expect(m.sections).toEqual(["summary", "insights"]);
    expect(m.period).toMatchObject({ title: "Campaign report", campaignName: "Rentrée gourmande" });
    expect(m.comparison).toBeNull();
    expect(m.kpis[0].label).toBe("Followers");
    expect(m.kpis[0].delta).toBeNull();
    expect(m.insights[0].text).toMatch(/^The community reaches/);
    expect(m.labels.sections.insights).toBe("Insights and recommendations");
  });

  it("refuse une marque sans rubrique Rapports", async () => {
    await expect(
      buildReportModel({ brandId: "b1", period: { type: "month" }, compare: true, sections: [], lang: "fr" }, { loader: testLoader({ sections: ["analytics"] }), today, now }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      buildReportModel({ brandId: "zz", period: { type: "month" }, compare: true, sections: [], lang: "fr" }, { loader: testLoader(), today, now }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
