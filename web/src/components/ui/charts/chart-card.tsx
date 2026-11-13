import { cn } from "@/lib/utils";
import { Card, CardHeader } from "../card";
import { EmptyState } from "../empty-state";
import { Skeleton } from "../skeleton";
import { ChartLegend, type ChartLegendItem } from "./chart-legend";

export interface ChartCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** à droite du titre (Segmented, bouton d'export…) */
  action?: React.ReactNode;
  /** grande valeur de synthèse sous le titre (ex. « 48,2 k ») */
  value?: React.ReactNode;
  /** variation à côté de la valeur (<Delta/>) */
  delta?: React.ReactNode;
  legend?: ChartLegendItem[];
  /** hauteur de la zone graphique (px) */
  height?: number;
  loading?: boolean;
  /** pas de données : affiche un état vide à la place du graphique */
  empty?: { title: string; description?: string } | null;
  /** note de bas de carte (source, définition) */
  footnote?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Carte de graphique : en-tête, valeur, légende, zone graphique, note. */
export function ChartCard({ title, description, action, value, delta, legend, height = 260, loading, empty, footnote, icon, className, children }: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title={title} description={description} action={action} icon={icon}>
        {(value || delta) && (
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            {value && <span className="tabular text-2xl font-semibold tracking-[-0.02em] text-ink">{value}</span>}
            {delta}
          </div>
        )}
      </CardHeader>
      {legend && legend.length > 1 && <ChartLegend items={legend} className="px-5 pb-2" />}
      <div className="min-w-0 flex-1 px-3 pb-4">
        {loading ? (
          <div style={{ height }} className="px-2">
            <Skeleton className="h-full w-full" rounded="card" />
          </div>
        ) : empty ? (
          <EmptyState compact illustration="chart" title={empty.title} description={empty.description} />
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
      {footnote && <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-ink-3">{footnote}</div>}
    </Card>
  );
}
