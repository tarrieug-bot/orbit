import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui";

/** Emplacement d'une vue à construire par l'agent front. */
export async function UnderConstruction({ children }: { children?: React.ReactNode }) {
  const t = await getTranslations("empty");
  return <EmptyState icon={<Construction size={22} />} title={t("underConstruction")} description={t("underConstructionHelp")} action={children} />;
}
