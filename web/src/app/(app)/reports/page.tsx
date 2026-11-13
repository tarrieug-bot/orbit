import { getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { UnderConstruction } from "@/components/views/under-construction";
import { Badge, Card, CardHeader } from "@/components/ui";
import { requireUser, resolveBrandParam } from "@/lib/auth/guards";
import { getReportSchedules, type PageSearchParams } from "@/lib/db";

/** Rapports. Emplacement — propriété : front (UI) + back (rendu PDF/PPTX) + design (gabarits). */
export default async function ReportsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requireUser();
  const brand = await resolveBrandParam((await searchParams).brand, "reports");
  const t = await getTranslations();
  const schedules = user.isAgency ? await getReportSchedules(brand?.id) : [];
  return (
    <div className="space-y-6">
      <UnderConstruction />
      {schedules.length > 0 && (
        <Card>
          <CardHeader title={t("reports.schedules")} />
          <ul className="divide-y divide-line border-t border-line">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <CalendarClock size={16} className="text-ink-3" />
                <span className="font-medium">{s.name}</span>
                <Badge tone="brand">{s.locale.toUpperCase()}</Badge>
                <span className="ml-auto text-ink-2">{s.recipients.join(", ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
