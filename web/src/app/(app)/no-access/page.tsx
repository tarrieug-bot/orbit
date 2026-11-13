import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default async function NoAccessPage() {
  const t = await getTranslations("empty");
  return <EmptyState icon={<Lock size={22} />} title="Orbit" description={t("noAccess")} />;
}
