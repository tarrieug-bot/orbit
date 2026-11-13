# Orbit V1 — conventions de l'équipe

Plateforme SaaS de **statistiques** Facebook + Instagram pour une agence (Martinique). Pas de planification de publications.
Spécification : `docs/SPEC.md`. Référence UX / calculs / API Meta : `index.html` (version d'essai, **ne pas modifier ni supprimer** — servie par GitHub Pages).

Branche de travail : **`v1`**. Ne jamais toucher `main`, ne jamais pousser (`git push`) sans demande explicite.

## Démarrage rapide

```bash
cd web
npm install
npm run dev:demo        # mode démo : aucune base, données fictives, choix du profil sur /login
# ou, avec Supabase local (Docker) : npx supabase start && npx supabase db reset ; puis .env.local et npm run dev
```

Avant de rendre la main, **obligatoire** :

```bash
cd web && npm run build && npm run lint      # 0 erreur
supabase/tests/run.sh                        # si vous touchez au SQL (base jetable + tests RLS)
```

## Arborescence et propriété

| Chemin | Propriétaire | Contenu |
|---|---|---|
| `web/src/lib/db/**` | **lead** | types des tables, sources de données (Supabase / démo), requêtes typées (`queries.ts`) |
| `web/src/lib/metrics/**` | **lead** | KPI, périodes, regroupements, comparaisons, alertes, formats |
| `web/src/lib/auth/**`, `web/src/lib/supabase/**`, `web/src/lib/security/**`, `web/src/lib/env*.ts`, `web/src/proxy.ts`, `web/src/i18n/**` | **lead** | auth, sessions, gardes, chiffrement des jetons, config |
| `web/src/app/layout.tsx`, `web/src/app/(app)/layout.tsx`, `web/src/app/login/**`, `web/src/app/auth/**`, `web/src/components/shell/**` | **lead** | layout racine, shell (barre latérale / supérieure), connexion |
| `web/src/app/(app)/**` (pages), `web/src/components/views/**`, `web/messages/**` | **front** | vues ; les pages actuelles sont des points de départ |
| `web/src/lib/meta/**`, `web/src/app/api/**`, `web/src/lib/sync/**`, `web/src/lib/reports/render/**`, `supabase/migrations/` (**nouvelles** migrations seulement) | **back/data** | collecte Meta, cron, rendu PDF/PPTX, e-mails |
| `web/src/components/ui/**`, `web/src/styles/**` (tokens Tailwind v4 : pas de `tailwind.config`), `web/src/lib/reports/templates/**` | **design** | design system, gabarits de rapports |
| `CLAUDE.md`, `README.md`, `docs/**`, `supabase/seed.sql` (généré), `supabase/tests/**`, `web/scripts/**` | **lead** | |

Besoin de modifier un dossier qui n'est pas le vôtre ? Demandez au lead (ou faites un commit minimal et signalez-le dans votre rapport). Les interfaces publiques de `lib/db` et `lib/metrics` sont **stables** : ajout possible, rupture interdite sans accord du lead.

## Règles

1. **TypeScript strict**, pas de `any` (utiliser `unknown` + zod si besoin). Next.js 16 : `params` / `searchParams` sont des `Promise`, le middleware s'appelle `src/proxy.ts`. Lire `web/node_modules/next/dist/docs/` en cas de doute (voir `web/AGENTS.md`).
2. **Aucun secret** dans le dépôt. Variables listées dans `web/.env.example`. Les secrets se lisent via `serverEnv("…")` (`lib/env.server.ts`, serveur uniquement).
3. **Données uniquement via `@/lib/db`** (`getOverview`, `getBrandMetrics`, `getPosts`…). Jamais de `supabase.from()` dans une page ou un composant. Le client service role (`lib/supabase/admin.ts`) est réservé au cron / aux tâches sans utilisateur.
4. **Contrôle d'accès = RLS Postgres** (voir `supabase/migrations/*_rls.sql`). Les gardes `requireAgency()`, `requireBrand(id, section)` (`lib/auth/guards.ts`) ne servent qu'à l'expérience utilisateur. Toute nouvelle table : RLS activée + policies + tests dans `supabase/tests/rls_test.sql`.
5. **Jetons Meta** : jamais côté client, jamais en clair en base (`encryptToken` / `decryptToken`, AES-256-GCM), table `social_account_tokens` lisible par le seul service role. Ne jamais journaliser un jeton.
6. **Textes via next-intl** : aucune chaîne d'interface en dur. Clés dans `web/messages/fr.json` **et** `en.json` (mêmes clés). Côté serveur `getTranslations()`, côté client `useTranslations()`. Rapports : `getTranslations({ locale, namespace })`. Les légendes de publications restent dans leur langue.
7. **Nombres, % et dates** : `formatNumber`, `formatCompact`, `formatPercent`, `formatPoints`, `formatRange`… de `@/lib/metrics` (locale `fr`/`en`).
8. **Calculs de KPI** : uniquement `@/lib/metrics` (taux d'engagement = interactions ÷ portée ; évolution abonnés = fin − veille du début ; comparaison = période précédente de même durée). Ne pas recalculer à la main dans une vue.
9. **UI « sexy » et cohérente** : composants de `@/components/ui` (Card, KpiTile, Avatar, NetworkIcon, Badge, Button, Select, Tabs, EmptyState, Skeleton, Sparkline, TrendChart). **Partout où un compte ou une marque apparaît : photo de profil (`<Avatar src={avatarUrl} … network=…>`) et vrai logo du réseau (`<NetworkIcon>`)**. Icônes d'interface : `lucide-react` ; logos réseaux : uniquement via `NetworkIcon` (react-icons). Graphiques : Recharts.
10. **Filtres globaux dans l'URL** : `?period=30d&nets=ig,fb&compare=0|yoy&from=&to=&campaign=` — lire avec `getPageFilters(searchParams, brandId)`.
11. **Base de données** : migrations au format Supabase CLI `supabase/migrations/YYYYMMDDHHMMSS_nom.sql`, jamais modifier une migration déjà commitée ; mettre à jour `web/src/lib/db/types.ts` dans le même commit. Données de démo : modifier `web/scripts/generate-demo-data.mjs` puis `npm run demo:generate` (régénère `supabase/seed.sql` et la fixture du mode démo).
12. **Commits** petits, fréquents, **messages en français**, sur `v1`, terminés par les lignes d'attribution demandées par la session. `npm run build && npm run lint` doivent passer avant chaque remise.

## Interfaces clés

```ts
// @/lib/db (serveur uniquement)
getSessionUser(): Promise<SessionUser | null>
listBrands(): Promise<BrandSummary[]>                      // marques visibles + comptes (avatarUrl, network…) + sections
getBrand(brandId): Promise<BrandSummary | null>
getPageFilters(searchParams, brandId?): Promise<Filters>   // période, comparaison, réseaux, campagne
getOverview(filters): Promise<OverviewData>                // KPI agrégés, lignes marques × comptes, tendances, alertes
getBrandMetrics(brandId, filters): Promise<BrandMetricsData | null>  // totaux, précédent, séries jour, par réseau
getPosts(brandId, { range, networks?, formats?, campaignId?, sort?, direction?, limit? }): Promise<PostItem[]>
getAudience(brandId): Promise<AudienceData | null>         // démographie IG, villes, pays, heatmap en ligne
getCampaigns(brandId?): Promise<CampaignItem[]>
getConnectedAccounts(): Promise<ConnectedAccountItem[]>    // agence
getClientAccess(): Promise<ClientAccessItem[]>             // agence
getSyncRuns({ accountIds?, limit? }), getReportSchedules(brandId?), getAccessLogs(limit?)

// @/lib/metrics (serveur + client, pur)
resolvePeriod, previousRange, parseFilters, serializeFilters, computeTotals, buildDailySeries,
makeBuckets, autoGranularity, toChartData, computeDelta, computeRateDelta, detectAlerts,
KPI_DEFINITIONS, formatNumber/Compact/Percent/Points/Range/Date

// @/lib/auth/guards
requireUser(), requireAgency(), requireAdmin(), requireBrand(brandId, section?), resolveBrandParam(param, section), homePathFor(user)

// @/lib/meta — à implémenter (back/data) : fetchPageDaily, fetchIgDaily, fetchPosts, fetchAudience,
// fetchProfile, exchangeToken, discoverAccounts ; table META_METRIC_MAP (versionnée, v25)
```

## Rôles

- `admin` / `manager` : équipe agence, toutes les marques de l'organisation (admin : gestion des rôles).
- `client` : lecture seule, uniquement les marques de `brand_access`, rubriques `visible_sections` ; peut changer période / réseaux, générer et exporter ses rapports ; pas de vue d'ensemble, pas de réglages.

Profils de démo (mode démo et `seed.sql`) : `admin@orbit.test`, `manager@orbit.test`, `client@cafe-lumiere.test` (Café Lumière, FR), `client@atelier-mangrove.test` (Atelier Mangrove, EN, sans rubrique Audience).
