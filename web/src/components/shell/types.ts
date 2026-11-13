import type { AppRole, BrandSection, ISODate, Network } from "@/lib/db/types";

/** Données sérialisables passées du layout serveur aux composants client du shell. */
export interface ShellBrand {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  networks: Network[];
  sections: BrandSection[];
  accounts: { id: string; network: Network; handle: string | null; avatarUrl: string | null }[];
}

export interface ShellCampaign {
  id: string;
  brandId: string;
  name: string;
  from: ISODate;
  to: ISODate;
}

export interface ShellUser {
  fullName: string | null;
  email: string;
  role: AppRole;
  isAgency: boolean;
}
