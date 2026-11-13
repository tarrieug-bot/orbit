import { Skeleton } from "@/components/ui";

/** Squelettes de chargement des pages (affichés par les loading.tsx). */
export function PageSkeleton({ hero = false, kpis = 8, charts = 2, grid = false }: { hero?: boolean; kpis?: number; charts?: number; grid?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true">
      {hero && <Skeleton className="h-40 rounded-hero" />}
      <Skeleton className="h-4 w-72" />
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-card" />
          ))}
        </div>
      )}
      {grid ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/6] rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: charts }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-card" />
          ))}
        </div>
      )}
    </div>
  );
}
