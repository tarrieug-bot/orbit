"use client";

/* Page interne : textes de démonstration volontairement en dur (non exposée aux clients). */
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Eye, FileText, Heart, MessageCircle, Plus, Search, Share2, Sparkles, TrendingUp, Users } from "lucide-react";
import {
  Avatar,
  AvatarGroup,
  Badge,
  BrandHero,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  ChartCard,
  ChartTooltipContent,
  DataTable,
  DateRangePicker,
  Delta,
  EmptyState,
  Heatmap,
  Input,
  Kbd,
  KpiTile,
  Modal,
  NetworkIcon,
  NetworkIconStack,
  PostCard,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  SkeletonKpi,
  StatusBadge,
  Tabs,
  ThemeToggle,
  Toast,
  ToastProvider,
  Toggle,
  Tooltip as UiTooltip,
  TrendChart,
  axisProps,
  barProps,
  chartColor,
  chartMargin,
  cursorBar,
  gridProps,
  useToast,
  xAxisProps,
  type DataTableColumn,
} from "@/components/ui";
import { OrbitLogo } from "@/components/shell/orbit-logo";
import type { Network } from "@/lib/db/types";
import { CHART_VARS, NETWORK_SERIES_VARS, SEQ_VARS, chartPalette } from "@/styles/tokens";

const NETS: Network[] = ["ig", "fb", "tt", "li", "yt"];
const series = (n: number, base: number, amp: number, seed: number) =>
  Array.from({ length: n }, (_, i) => Math.round(base + amp * Math.sin(i / 3 + seed) + amp * 0.6 * Math.sin(i / 1.3 + seed * 2) + i * (amp / 20)));
const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 14 + i));
  return d.toISOString().slice(0, 10);
});
const igReach = series(30, 2400, 700, 1);
const fbReach = series(30, 1500, 400, 2);
const trendData = days.map((key, i) => ({ key, ig: igReach[i], fb: fbReach[i] }));
const heat = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (h < 6 ? 0.05 : Math.max(0, Math.sin(((h - 6) / 18) * Math.PI) * (0.6 + 0.4 * Math.cos(d)) + (h === 19 ? 0.3 : 0) + (d >= 5 ? 0.1 : 0)))));
heat[2][3] = null as unknown as number;
const formats = [
  { f: "Reel", v: 7.4 },
  { f: "Carrousel", v: 5.9 },
  { f: "Image", v: 4.1 },
  { f: "Vidéo", v: 3.2 },
];

interface Row {
  id: string;
  name: string;
  network: Network;
  avatar: string;
  followers: number;
  reach: number;
  er: number;
}
const rows: Row[] = [
  { id: "1", name: "@cafelumiere.mq", network: "ig", avatar: "/demo/avatars/cafe-lumiere.svg", followers: 8927, reach: 65800, er: 6.6 },
  { id: "2", name: "Café Lumière", network: "fb", avatar: "/demo/avatars/cafe-lumiere.svg", followers: 12854, reach: 49800, er: 4.0 },
  { id: "3", name: "@ateliermangrove", network: "ig", avatar: "/demo/avatars/atelier-mangrove.svg", followers: 16876, reach: 116400, er: 6.6 },
  { id: "4", name: "@fitnesscaraibes", network: "ig", avatar: "/demo/avatars/fitness-caraibes.svg", followers: 24432, reach: 190200, er: 7.1 },
];
const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10 first:border-t-0">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ color, label, sub }: { color: string; label: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="h-12 rounded-control ring-1 ring-black/5 ring-inset" style={{ background: color }} />
      <div className="mt-1.5 truncate text-xs font-medium text-ink">{label}</div>
      {sub && <div className="truncate font-mono text-[10.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <Button variant="secondary" onClick={() => toast({ title: "Rapport généré", description: "Le PDF de novembre est prêt.", status: "success" })}>
      Déclencher un toast
    </Button>
  );
}

export function Showcase({ theme }: { theme: "light" | "dark" }) {
  const [tab, setTab] = useState("analytics");
  const [gran, setGran] = useState("day");
  const [on, setOn] = useState(true);
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [preset, setPreset] = useState("30d");
  const [range, setRange] = useState({ from: "2026-10-14", to: "2026-11-12" });

  const columns: DataTableColumn<Row>[] = [
    {
      key: "name",
      header: "Compte",
      cell: (r) => (
        <span className="flex items-center gap-3">
          <Avatar src={r.avatar} name={r.name} size="sm" network={r.network} />
          <span className="font-medium">{r.name}</span>
        </span>
      ),
      sortValue: (r) => r.name,
    },
    { key: "followers", header: "Abonnés", align: "right", cell: (r) => fmt(r.followers), sortValue: (r) => r.followers },
    { key: "reach", header: "Portée", align: "right", cell: (r) => fmt(r.reach), sortValue: (r) => r.reach, hideBelow: "sm" },
    { key: "er", header: "Engagement", align: "right", cell: (r) => `${r.er.toLocaleString("fr-FR")} %`, sortValue: (r) => r.er },
  ];

  return (
    <ToastProvider closeLabel="Fermer">
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <div className="flex items-center gap-4">
            <OrbitLogo size={36} />
            <div className="h-8 w-px bg-line" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink">Design system</h1>
              <p className="text-sm text-ink-2">Thème {theme === "light" ? "clair" : "sombre"}</p>
            </div>
          </div>
          {theme === "light" && <ThemeToggle labels={{ light: "Clair", dark: "Sombre", system: "Système" }} />}
        </header>

        <Section title="Couleurs" description="Neutres chauds, accent Orbit, statuts (toujours avec icône + texte), couleurs officielles des réseaux.">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-9">
            {["canvas", "surface", "surface-2", "surface-3", "line", "line-strong", "ink-3", "ink-2", "ink"].map((c) => (
              <Swatch key={c} color={`var(--color-${c})`} label={c} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-10">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((c) => (
              <Swatch key={c} color={`var(--color-orbit-${c})`} label={`orbit-${c}`} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["positive", "Succès"],
              ["warning", "Alerte"],
              ["negative", "Critique"],
              ["info", "Info"],
            ].map(([c, l]) => (
              <div key={c} className="flex items-center gap-3 rounded-control p-3" style={{ background: `var(--color-${c}-soft)` }}>
                <span className="h-6 w-6 rounded-full" style={{ background: `var(--color-${c})` }} />
                <span className="text-sm font-medium" style={{ color: `var(--color-${c})` }}>
                  {l}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="h-12 rounded-control bg-facebook" />
            <div className="h-12 rounded-control bg-instagram-gradient" />
            <div className="h-12 rounded-control bg-[#000] shadow-[inset_3px_0_0_#25F4EE,inset_-3px_0_0_#FE2C55]" />
            <div className="h-12 rounded-control bg-linkedin" />
            <div className="h-12 rounded-control bg-youtube" />
          </div>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">Palette des graphiques (validée daltonisme, ordre fixe)</h3>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {CHART_VARS.map((c, i) => (
              <Swatch key={c} color={c} label={`série ${i + 1}`} sub={chartPalette[theme][i]} />
            ))}
          </div>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">Échelle séquentielle (heatmaps)</h3>
          <div className="flex gap-1">
            {SEQ_VARS.map((c) => (
              <div key={c} className="h-8 flex-1 rounded-[6px]" style={{ background: c }} />
            ))}
          </div>
        </Section>

        <Section title="Typographie" description="Inter, chiffres tabulaires pour les données.">
          <div className="space-y-3">
            <p className="text-display font-semibold text-ink">Statistiques de vos marques</p>
            <p className="text-2xl font-semibold tracking-tight text-ink">Titre de section — 24</p>
            <p className="text-[15px] font-semibold text-ink">Titre de carte — 15</p>
            <p className="text-sm text-ink-2">Texte courant secondaire — 14. La portée correspond au nombre de comptes uniques touchés.</p>
            <p className="tabular text-3xl font-semibold tracking-tight text-ink">1 234 567 · 89,4 % · +12,3 k</p>
          </div>
        </Section>

        <Section title="NetworkIcon" description="Logos officiels (react-icons) : glyphe en couleur, pastille ronde, tuile carrée, monochrome.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["brand", "badge", "tile", "mono"] as const).map((variant) => (
              <Card key={variant} className="flex items-center gap-4 p-4">
                <code className="w-14 text-xs text-ink-3">{variant}</code>
                {NETS.map((n) => (
                  <NetworkIcon key={n} network={n} variant={variant} size={variant === "brand" || variant === "mono" ? 22 : 30} />
                ))}
              </Card>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            {[14, 18, 24, 32, 44].map((s) => (
              <NetworkIcon key={s} network="ig" variant="tile" size={s} />
            ))}
            <NetworkIconStack networks={["ig", "fb"]} size={22} />
            <NetworkIcon network="tt" variant="tile" size={30} muted />
          </div>
        </Section>

        <Section title="Avatar" description="Photo de profil, repli initiales sur couleur de marque, anneau Instagram / Facebook, pastille réseau, tailles xs → 2xl.">
          <div className="flex flex-wrap items-end gap-5">
            {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((s) => (
              <Avatar key={s} src="/demo/avatars/cafe-lumiere.svg" name="Café Lumière" size={s} network="ig" ring />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <Avatar src="/demo/avatars/atelier-mangrove.svg" name="Atelier Mangrove" size="lg" network="fb" ring="facebook" />
            <Avatar name="Fitness Caraïbes" color="#0F766E" size="lg" network="ig" />
            <Avatar name="Rhum Clément" color="#B45309" size="lg" shape="rounded" />
            <Avatar src="https://invalid.example/expire.jpg" name="Lien expiré" color="#7C3AED" size="lg" ring="brand" />
            <AvatarGroup max={3} size="md">
              <Avatar src="/demo/avatars/cafe-lumiere.svg" name="A" size="md" />
              <Avatar src="/demo/avatars/atelier-mangrove.svg" name="B" size="md" />
              <Avatar src="/demo/avatars/fitness-caraibes.svg" name="C" size="md" />
              <Avatar name="Dora" size="md" />
              <Avatar name="Eve" size="md" />
            </AvatarGroup>
          </div>
        </Section>

        <Section title="BrandHero" description="Bandeau de tête d'une marque ; fond dérivé de la couleur de la marque.">
          <div className="space-y-5">
            <BrandHero
              name="Café Lumière"
              avatarUrl="/demo/avatars/cafe-lumiere.svg"
              color="#2A78D6"
              sector="Restauration"
              eyebrow="Analytics · 30 derniers jours"
              accounts={[
                { id: "1", network: "ig", handle: "@cafelumiere.mq", avatarUrl: "/demo/avatars/cafe-lumiere.svg", followers: "8,9 k", followersLabel: "abonnés", href: "https://instagram.com" },
                { id: "2", network: "fb", handle: "Café Lumière", avatarUrl: "/demo/avatars/cafe-lumiere.svg", followers: "12,9 k", followersLabel: "abonnés", status: "expiring", statusLabel: "jeton à renouveler" },
              ]}
              stats={[
                { label: "Abonnés", value: "21 781", delta: <Delta trend="up" label="+4,8 %" /> },
                { label: "Portée", value: "115,6 k", delta: <Delta trend="up" label="+3,4 %" /> },
                { label: "Engagement", value: "5,44 %", delta: <Delta trend="down" label="−0,2 pt" /> },
              ]}
              actions={
                <>
                  <Button variant="secondary" size="sm" icon={<Download size={14} />}>
                    Exporter
                  </Button>
                  <Button variant="primary" size="sm" icon={<FileText size={14} />}>
                    Rapport
                  </Button>
                </>
              }
            >
              <Tabs
                items={[
                  { value: "analytics", label: "Analytics" },
                  { value: "posts", label: "Publications", count: 88 },
                  { value: "audience", label: "Audience" },
                ]}
                value={tab}
                onValueChange={setTab}
                className="border-b-0"
              />
            </BrandHero>
            <BrandHero name="Atelier Mangrove" avatarUrl="/demo/avatars/atelier-mangrove.svg" color="#C2410C" sector="Mode & artisanat" size="md" accounts={[{ id: "3", network: "ig", handle: "@ateliermangrove", avatarUrl: "/demo/avatars/atelier-mangrove.svg", followers: "16,9 k", followersLabel: "abonnés" }]} />
          </div>
        </Section>

        <Section title="KpiTile">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile emphasis label="Abonnés" icon={<Users />} value="21 781" delta={{ trend: "up", label: "+989", caption: "sur la période" }} sparkline={igReach} help="Abonnés en fin de période" />
            <KpiTile label="Portée" icon={<Eye />} value="115,6 k" delta={{ trend: "up", label: "+3,4 %", caption: "vs 111,8 k" }} sparkline={fbReach} sparklineColor="var(--color-chart-1)" />
            <KpiTile label="Taux d'engagement" icon={<TrendingUp />} value="5,44 %" delta={{ trend: "down", label: "−0,20 pt", caption: "vs 5,64 %" }} sub="interactions ÷ portée" />
            <KpiTile label="Clics vers le site" value="—" unavailable note="Indisponible pour ce compte" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SkeletonKpi />
            <KpiTile label="Chargement" value="" loading />
          </div>
        </Section>

        <Section title="Boutons, badges, contrôles">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Plus size={16} />}>
              Nouvelle campagne
            </Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="outline">Contour</Button>
            <Button variant="subtle">Discret</Button>
            <Button variant="ghost">Fantôme</Button>
            <Button variant="danger">Supprimer</Button>
            <Button variant="primary" loading>
              Envoi…
            </Button>
            <Button variant="facebook" size="lg">
              Continuer avec Facebook
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge>Neutre</Badge>
            <Badge tone="brand" dot>
              Campagne
            </Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="outline">Contour</Badge>
            <StatusBadge status="success">Synchronisé</StatusBadge>
            <StatusBadge status="warning">Jeton expire dans 5 j</StatusBadge>
            <StatusBadge status="critical">Erreur de synchro</StatusBadge>
            <Delta trend="up" label="+12,3 %" caption="vs 8,1 k" />
            <Delta trend="down" label="−4,0 %" />
            <Delta trend="up" label="+38" higherIsBetter={false} caption="désabonnements" />
            <Delta trend="flat" label="0,0 %" variant="text" />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Callout status="warning" title="Le jeton Facebook de Café Lumière expire dans 5 jours" action={<Button size="sm">Renouveler</Button>}>
              Reconnectez la Page pour éviter une interruption des statistiques.
            </Callout>
            <Callout status="success" title="Synchronisation terminée">
              6 comptes mis à jour il y a 3 min.
            </Callout>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Input icon={<Search />} placeholder="Rechercher une publication" trailing={<Kbd>⌘K</Kbd>} wrapperClassName="w-72" />
            <Select defaultValue="reach" wrapperClassName="w-48">
              <option value="reach">Trier par portée</option>
              <option value="er">Trier par engagement</option>
            </Select>
            <DateRangePicker
              presets={[
                { value: "7d", label: "7 derniers jours" },
                { value: "30d", label: "30 derniers jours" },
                { value: "month", label: "Ce mois-ci" },
                { value: "camp", label: "Semaine du chocolat", group: "Campagnes", color: "#7C3AED" },
              ]}
              value={preset}
              range={range}
              label={preset === "custom" ? "Dates personnalisées" : preset === "7d" ? "7 derniers jours" : preset === "month" ? "Ce mois-ci" : preset === "camp" ? "Semaine du chocolat" : "30 derniers jours"}
              detail="14 oct. – 12 nov."
              onPresetChange={setPreset}
              onRangeChange={(r) => {
                setRange(r);
                setPreset("custom");
              }}
              labels={{ custom: "Dates personnalisées", from: "Du", to: "au", apply: "Appliquer" }}
              align="start"
            />
            <Toggle checked={on} onCheckedChange={setOn} label="Comparer" framed size="sm" />
            <Toggle checked={!on} onCheckedChange={(v) => setOn(!v)} label="Rapport mensuel" description="Envoyé le 1er du mois" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            <Tabs
              items={[
                { value: "analytics", label: "Analytics" },
                { value: "posts", label: "Publications", count: 88 },
                { value: "audience", label: "Audience" },
                { value: "off", label: "Campagnes", disabled: true },
              ]}
              value={tab}
              onValueChange={setTab}
            />
            <Segmented
              items={[
                { value: "day", label: "Jour" },
                { value: "week", label: "Semaine" },
                { value: "month", label: "Mois" },
              ]}
              value={gran}
              onValueChange={setGran}
            />
            <Tabs
              variant="pill"
              items={NETS.slice(0, 2).map((n) => ({ value: n, label: n === "ig" ? "Instagram" : "Facebook", icon: <NetworkIcon network={n} size={14} /> }))}
              value="ig"
            />
            <UiTooltip content="Taux d'engagement = interactions ÷ portée">
              <Button variant="ghost" size="sm">
                Survolez-moi
              </Button>
            </UiTooltip>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => setModal(true)}>Ouvrir la modale</Button>
            <Button onClick={() => setSheet(true)}>Ouvrir le panneau</Button>
            <ToastDemo />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Toast title="Export prêt" description="publications-cafe-lumiere.csv" status="success" onClose={() => undefined} closeLabel="Fermer" />
            <Toast title="Échec de la synchronisation" description="Instagram a renvoyé une erreur temporaire." status="critical" />
          </div>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="Générer un rapport"
            description="Mois de novembre 2026, Instagram + Facebook."
            closeLabel="Fermer"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModal(false)}>
                  Annuler
                </Button>
                <Button variant="primary" onClick={() => setModal(false)}>
                  Générer
                </Button>
              </>
            }
          >
            <p className="text-sm text-ink-2">Le rapport inclura les KPI, les meilleures publications et des recommandations automatiques.</p>
          </Modal>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Détail de la publication" closeLabel="Fermer">
            <PostCard network="ig" format="reel" formatLabel="Reel" dateLabel="12 nov. · 18:30" thumbnailUrl="/demo/posts/cafe-lumiere-1.svg" caption="Nouveau chocolat chaud ☕️ au cacao de Martinique." metrics={[{ label: "Portée", value: "4,2 k" }, { label: "Interact.", value: "312" }, { label: "Partages", value: "28" }]} />
          </Sheet>
        </Section>

        <Section title="PostCard">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <PostCard
                key={i}
                rank={i}
                network={i % 2 ? "ig" : "fb"}
                format={(["reel", "carousel", "image", "video"] as const)[i - 1]}
                formatLabel={["Reel", "Carrousel", "Image", "Vidéo"][i - 1]}
                dateLabel={`${10 - i} nov. · 18:30`}
                thumbnailUrl={`/demo/posts/${["cafe-lumiere", "atelier-mangrove", "fitness-caraibes", "cafe-lumiere"][i - 1]}-${i}.svg`}
                caption="Nouveau chocolat chaud au cacao de Martinique, à découvrir dès aujourd'hui ☕️ #cafelumiere"
                highlight={{ label: "Engagement", value: `${(9.1 - i).toLocaleString("fr-FR")} %` }}
                href="https://instagram.com"
                openLabel="Ouvrir la publication"
                metrics={[
                  { label: "Portée", value: fmt(5200 - i * 700), icon: <Eye size={10} /> },
                  { label: "J'aime", value: fmt(320 - i * 40), icon: <Heart size={10} /> },
                  { label: "Comm.", value: String(24 - i * 3), icon: <MessageCircle size={10} /> },
                  { label: "Partages", value: String(18 - i * 2), icon: <Share2 size={10} /> },
                ]}
                badge={i === 1 ? <Badge tone="brand" dot>Semaine du chocolat</Badge> : undefined}
              />
            ))}
          </div>
          <div className="mt-4 max-w-xl">
            <PostCard layout="horizontal" network="fb" format="link" formatLabel="Lien" dateLabel="2 nov." caption="Réservez votre table pour le brunch du dimanche !" account={{ name: "Café Lumière", avatarUrl: "/demo/avatars/cafe-lumiere.svg", handle: "Café Lumière" }} metrics={[{ label: "Portée", value: "1,8 k" }, { label: "Clics", value: "96" }, { label: "Interact.", value: "141" }]} />
          </div>
        </Section>

        <Section title="Graphiques" description="Thème Recharts partagé : axes discrets, grille horizontale, infobulle soignée, légende HTML, couleurs par variable CSS.">
          <div className="grid gap-5 lg:grid-cols-5">
            <ChartCard
              className="lg:col-span-3"
              title="Portée par réseau"
              description="par jour"
              value="115,6 k"
              delta={<Delta trend="up" label="+3,4 %" caption="vs période précédente" />}
              action={
                <Segmented
                  items={[
                    { value: "day", label: "Jour" },
                    { value: "week", label: "Semaine" },
                  ]}
                  value={gran}
                  onValueChange={setGran}
                />
              }
              footnote="Source : API Meta (Graph v25). Portée = comptes uniques touchés."
            >
              <TrendChart
                data={trendData}
                series={[
                  { key: "ig", label: "Instagram", color: NETWORK_SERIES_VARS.ig },
                  { key: "fb", label: "Facebook", color: NETWORK_SERIES_VARS.fb },
                ]}
                stacked
                totalLabel="Total"
                height={220}
              />
            </ChartCard>
            <ChartCard className="lg:col-span-2" title="Engagement par format" description="taux moyen" height={250}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 250 }}>
                <BarChart data={formats} margin={chartMargin}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="f" {...xAxisProps} />
                  <YAxis {...axisProps} width={36} tickFormatter={(v: number) => `${v} %`} />
                  <Tooltip cursor={cursorBar} content={(p) => <ChartTooltipContent active={p.active} payload={p.payload} label={p.label} valueFormatter={(v) => `${v.toLocaleString("fr-FR")} %`} nameFormatter={() => "Engagement"} />} />
                  <Bar dataKey="v" fill={chartColor(6)} {...barProps} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard className="lg:col-span-2" title="Abonnés" description="courbe + période précédente" height={200}>
              <TrendChart
                type="line"
                data={days.map((key, i) => ({ key, cur: 21000 + i * 26 + (i % 5) * 4, prev: 20400 + i * 20 }))}
                series={[
                  { key: "cur", label: "Période", color: chartColor(0) },
                  { key: "prev", label: "Période précédente", color: "var(--color-ink-3)", dashed: true },
                ]}
                yDomain="auto"
                height={170}
              />
            </ChartCard>
            <ChartCard className="lg:col-span-3" title="Meilleurs créneaux" description="abonnés en ligne, moyenne par heure" icon={<Sparkles />} height={230}>
              <Heatmap data={heat} rowLabels={["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]} valueFormatter={(v) => `${Math.round(v * 100)} %`} describe={(r, c, v) => `${r} ${c} : ${v} des abonnés en ligne`} legend={{ low: "Moins", high: "Plus" }} />
            </ChartCard>
            <ChartCard className="lg:col-span-5" title="Chargement" loading height={120} />
            <ChartCard className="lg:col-span-5" title="Sans données" empty={{ title: "Aucune donnée sur la période", description: "Essayez une période plus longue." }} />
          </div>
        </Section>

        <Section title="DataTable">
          <Card className="overflow-hidden">
            <CardHeader title="Comptes" description="Cliquez sur un en-tête pour trier." />
            <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} defaultSort={{ key: "reach", direction: "desc" }} caption="Comptes" />
          </Card>
        </Section>

        <Section title="Cartes, états vides, squelettes">
          <div className="grid gap-4 md:grid-cols-3">
            {(["default", "raised", "outline", "inset", "accent"] as const).map((v) => (
              <Card key={v} variant={v} interactive>
                <CardHeader title={`Card · ${v}`} description="Description courte" icon={<FileText />} />
                <CardContent className="text-sm text-ink-2">Contenu de la carte.</CardContent>
              </Card>
            ))}
            <Card className="p-5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-24 w-full" rounded="card" />
              <div className="mt-3 flex items-center gap-2">
                <Skeleton className="h-8 w-8" rounded="full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            </Card>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(
              [
                ["chart", "Aucune statistique", "Les données apparaîtront après la première synchronisation."],
                ["posts", "Aucune publication", "Aucune publication sur la période sélectionnée."],
                ["accounts", "Aucun compte connecté", "Connectez une Page Facebook et son compte Instagram."],
                ["reports", "Aucun rapport", "Générez votre premier rapport mensuel."],
                ["search", "Aucun résultat", "Essayez un autre mot-clé."],
                ["lock", "Accès restreint", "Cette rubrique n'est pas partagée avec vous."],
                ["audience", "Audience indisponible", "Instagram exige au moins 100 abonnés."],
                ["campaigns", "Aucune campagne", "Créez une campagne pour suivre ses résultats."],
                ["error", "Erreur de chargement", "Réessayez dans un instant."],
              ] as const
            ).map(([k, t, d]) => (
              <EmptyState key={k} illustration={k} title={t} description={d} action={k === "accounts" ? <Button variant="facebook">Continuer avec Facebook</Button> : undefined} />
            ))}
          </div>
        </Section>
      </div>
    </ToastProvider>
  );
}
