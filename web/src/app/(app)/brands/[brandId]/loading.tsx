import { PageSkeleton } from "@/components/views/page-skeleton";

export default function Loading() {
  return <PageSkeleton hero kpis={10} charts={4} />;
}
