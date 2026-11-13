import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import type { ShellBrand, ShellCampaign } from "@/components/shell/types";
import { requireUser } from "@/lib/auth/guards";
import { getCampaigns, listBrands, todayISO } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

/** Shell de l'application (propriété : lead) : barre latérale + barre supérieure. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [brands, campaigns] = await Promise.all([listBrands(), getCampaigns()]);

  const shellBrands: ShellBrand[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    avatarUrl: b.avatarUrl,
    networks: b.networks,
    sections: b.sections,
    accounts: b.accounts.map((a) => ({ id: a.id, network: a.network, handle: a.handle, avatarUrl: a.avatarUrl })),
  }));
  const shellCampaigns: ShellCampaign[] = campaigns.map((c) => ({ id: c.id, brandId: c.brandId, name: c.name, from: c.range.from, to: c.range.to }));

  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <Sidebar user={{ fullName: user.fullName, email: user.email, role: user.role, isAgency: user.isAgency }} brands={shellBrands} demo={isDemoMode()} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <Topbar brands={shellBrands} campaigns={shellCampaigns} today={todayISO()} />
        </Suspense>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
