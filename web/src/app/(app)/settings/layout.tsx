import { SettingsTabs } from "@/components/views/settings-tabs";
import { requireAgency } from "@/lib/auth/guards";

/** Réglages : réservés à l'équipe de l'agence (les clients sont renvoyés vers leur marque). */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAgency();
  return (
    <div className="space-y-6">
      <SettingsTabs />
      {children}
    </div>
  );
}
