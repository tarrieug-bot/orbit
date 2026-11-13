import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { Avatar, Card, CardContent, CardHeader, EmptyState } from "@/components/ui";
import { resolveBrandParam } from "@/lib/auth/guards";
import { getAudience, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatPercent, INTL_LOCALE } from "@/lib/metrics";

/** Audience (démographie Instagram). Point de départ — propriété : front. */
export default async function AudiencePage({ searchParams }: { searchParams: PageSearchParams }) {
  const brand = await resolveBrandParam((await searchParams).brand, "audience");
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const data = brand ? await getAudience(brand.id) : null;
  if (!brand || !data) return <EmptyState icon={<Users size={22} />} title={t("audience.title")} description={t("audience.noData")} />;

  let regions: Intl.DisplayNames | null = null;
  try {
    regions = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "region" });
  } catch {}
  const max = Math.max(...data.ageGender.map((r) => r.female + r.male), 0.0001);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title={t("audience.ageGender")} action={<Avatar src={data.account.avatarUrl} name={data.account.handle ?? ""} color={brand.color} size="sm" network="ig" />} />
        <CardContent className="space-y-2.5">
          {data.ageGender.map((r) => (
            <div key={r.age} className="grid grid-cols-[56px_1fr] items-center gap-3 text-xs">
              <span className="tabular font-medium text-ink-2">{r.age}</span>
              <div className="flex h-5 overflow-hidden rounded-full bg-surface-2">
                <div className="bg-[#EC4899]" style={{ width: `${(r.female / max) * 100}%` }} title={`${t("audience.women")} ${formatPercent(r.female, locale)}`} />
                <div className="bg-orbit-500" style={{ width: `${(r.male / max) * 100}%` }} title={`${t("audience.men")} ${formatPercent(r.male, locale)}`} />
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-ink-2">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#EC4899]" /> {t("audience.women")} {formatPercent(data.genderShares.female, locale)}
            <span className="mr-1 ml-4 inline-block h-2 w-2 rounded-full bg-orbit-500" /> {t("audience.men")} {formatPercent(data.genderShares.male, locale)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t("audience.cities")} />
        <CardContent>
          <ShareList items={data.cities.map((c) => ({ label: c.key.split(",")[0], share: c.share }))} locale={locale} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t("audience.countries")} />
        <CardContent>
          <ShareList items={data.countries.map((c) => ({ label: regions?.of(c.key) ?? c.key, share: c.share }))} locale={locale} />
        </CardContent>
      </Card>
      {data.onlineHeatmap && (
        <Card className="lg:col-span-2">
          <CardHeader title={t("audience.online")} />
          <CardContent>
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
              {data.onlineHeatmap.flatMap((row, d) =>
                row.map((v, h) => <div key={`${d}-${h}`} className="aspect-square rounded-[3px]" style={{ background: `rgba(99,102,241,${0.06 + v * 0.94})` }} title={`${h} h`} />),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ShareList({ items, locale }: { items: { label: string; share: number }[]; locale: AppLocale }) {
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="text-[13px]">
          <div className="flex justify-between">
            <span className="text-ink">{i.label}</span>
            <span className="tabular text-ink-2">{formatPercent(i.share, locale)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-orbit-gradient" style={{ width: `${(i.share / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
