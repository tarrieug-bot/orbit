import type { PostQuery, PostSortKey } from "@/lib/db";
import { NETWORKS, type Network, type PostFormat } from "@/lib/db/types";
import type { Filters } from "@/lib/metrics";

const FORMATS: PostFormat[] = ["image", "carousel", "reel", "video", "story", "link", "status"];
const SORTS: PostSortKey[] = ["date", "reach", "views", "interactions", "engagementRate"];

type SP = Record<string, string | string[] | undefined> | URLSearchParams;
const read = (sp: SP, k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] as string | undefined));

/** Requête de la grille des publications : filtres globaux + ?fmt=&net=&sort= */
export function postQueryFrom(sp: SP, filters: Filters): PostQuery & { format: PostFormat | null; network: Network | null } {
  const fmt = read(sp, "fmt");
  const net = read(sp, "net");
  const sort = read(sp, "sort");
  const format = FORMATS.includes(fmt as PostFormat) ? (fmt as PostFormat) : null;
  const network = (NETWORKS as readonly string[]).includes(net ?? "") && filters.networks.includes(net as Network) ? (net as Network) : null;
  return {
    range: filters.range,
    networks: network ? [network] : filters.networks,
    formats: format ? [format] : undefined,
    sort: SORTS.includes(sort as PostSortKey) ? (sort as PostSortKey) : "date",
    direction: "desc",
    limit: 1000,
    format,
    network,
  };
}
