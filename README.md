# Orbit

Statistiques Facebook et Instagram de toutes les marques gérées par l'agence, en un clic : vue d'ensemble multi-marques, analytics par marque, publications, audience, campagnes, rapports (mois, campagne, année, dates libres) en français ou en anglais, espace client en lecture seule.

## Ce dépôt aujourd'hui : la version d'essai

`index.html` est une application autonome (aucun serveur) publiée sur GitHub Pages :

- **Mode démo** : 5 marques fictives, 2 ans de données simulées.
- **Mode réel** : connexion Facebook (SDK JavaScript Meta), lecture des statistiques des Pages et comptes Instagram professionnels via l'API Graph (v25). Lecture seule, aucun jeton conservé après fermeture de l'onglet.
- **Diagnostic API** : journal de chaque appel à Meta, pour voir quelles métriques sont disponibles pour chaque compte.

Limites de la version d'essai : pas de base de données (l'historique dépend de ce que Meta renvoie, environ 2 ans au maximum), pas de collecte automatique, pas d'export PDF, invitations clients et envois programmés simulés.

### Configurer l'application Meta (mode développement)

1. Créer une application sur [developers.facebook.com](https://developers.facebook.com/apps) (type Business).
2. Ajouter le produit **Facebook Login for Business** (ou Facebook Login) et déclarer le domaine `tarrieug-bot.github.io` dans les domaines autorisés du SDK JavaScript et les URI de redirection OAuth valides.
3. Permissions utilisées : `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management`.
4. En mode développement, seuls les administrateurs, développeurs et testeurs de l'application peuvent se connecter : aucune validation Meta n'est nécessaire pour l'essai.
5. Renseigner l'App ID dans `ORBIT_CONFIG` (dans `index.html`) ou dans l'écran d'accueil d'Orbit.

## Version complète (`web/`, branche `v1`)

Architecture : **Next.js 16** (App Router, TypeScript strict, Tailwind CSS v4, next-intl, Recharts) dans `web/`, **Supabase** (PostgreSQL + Auth par lien magique + row-level security + Storage) dans `supabase/`, hébergement **Vercel**. Spécification : [docs/SPEC.md](docs/SPEC.md). Conventions d'équipe : [CLAUDE.md](CLAUDE.md).

```
web/                      application Next.js (racine du projet Vercel)
  src/app/                pages ((app)/… = espace connecté), login, auth, api/cron
  src/components/         ui/ (design system), shell/ (barres), views/ (vues)
  src/lib/db/             accès aux données (Supabase avec RLS, ou mode démo)
  src/lib/metrics/        calculs des KPI, périodes, comparaisons
  src/lib/meta/           API Graph Meta (correspondance des métriques v25)
  messages/fr.json, en.json
  vercel.json             tâches planifiées (Vercel Cron)
supabase/
  migrations/             schéma, RLS, fonctions
  seed.sql                données de démonstration (générées)
  tests/run.sh            tests RLS sur une base jetable
```

### 1. Essai local sans base (mode démo)

Prérequis : Node.js ≥ 20.9.

```bash
cd web
npm install
npm run dev:demo
```

Ouvrir http://localhost:3000 : la page de connexion propose des profils fictifs (admin, manager, deux clients). 3 marques, 6 comptes, 6 mois de métriques. Le mode démo s'active aussi automatiquement si Supabase n'est pas configuré.

### 2. Développement avec Supabase local

Prérequis : Docker.

```bash
npx supabase start            # à la racine du dépôt ; affiche l'URL et les clés locales
npx supabase db reset         # applique migrations + seed.sql
cp web/.env.example web/.env.local   # renseigner NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY locales
cd web && npm run dev
```

Connexion : saisir `admin@orbit.test` (ou un autre profil du seed) sur /login, puis ouvrir le lien reçu dans Mailpit (http://127.0.0.1:54324).

Tests de sécurité (base PostgreSQL 16 jetable, Docker ou binaires locaux) : `supabase/tests/run.sh` — prouve qu'un client ne lit jamais une autre marque.

### 3. Variables d'environnement

Toutes documentées dans [`web/.env.example`](web/.env.example) :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projet Supabase (publiques) |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur uniquement (cron, invitations, jetons) |
| `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `META_API_VERSION` | application Meta (Facebook Login for Business), `v25.0` |
| `TOKEN_ENCRYPTION_KEY` | clé AES-256-GCM des jetons (`openssl rand -base64 32`) |
| `CRON_SECRET` | protège `/api/cron/*` (`openssl rand -hex 32`) |
| `RESEND_API_KEY` | envoi des rapports par e-mail |
| `APP_URL` | URL publique (liens magiques) |
| `ORBIT_DATA_SOURCE` | `demo` pour forcer le mode démo |

### 4. Déploiement Supabase (production)

1. Créer un projet sur [supabase.com](https://supabase.com) (région la plus proche : `us-east-1`).
2. Lier et pousser le schéma depuis la racine du dépôt :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>
   npx supabase db push          # applique supabase/migrations (ne PAS pousser seed.sql en production)
   ```
3. **Authentication › Sign In / Providers** : e-mail activé, **inscriptions désactivées** (« Allow new users to sign up » = off) — les utilisateurs sont invités par l'agence.
4. **Authentication › URL Configuration** : Site URL = `https://<domaine-vercel>` ; Redirect URLs = `https://<domaine-vercel>/auth/callback`.
5. **Authentication › Email Templates** : recopier `supabase/templates/magic_link.html` (Magic Link) et `invite.html` (Invite user). Configurer un SMTP (ex. Resend) dans **Project Settings › Auth › SMTP**.
6. Premier administrateur : **Authentication › Users › Invite user**, puis dans le SQL Editor :
   ```sql
   insert into public.organizations (name, slug) values ('Mon agence', 'mon-agence') returning id;
   update public.profiles set role = 'admin', organization_id = '<id ci-dessus>' where email = 'moi@agence.fr';
   ```
7. Récupérer l'URL, la clé `anon` et la clé `service_role` (**Project Settings › API**).

### 5. Déploiement Vercel

1. **Add New › Project**, importer le dépôt GitHub, **Root Directory = `web`**, framework Next.js (détecté), branche de production au choix (`v1` pendant la recette).
2. Renseigner toutes les variables de la section 3 (Production et Preview), avec `APP_URL=https://<domaine-vercel>`.
3. Déployer. Les tâches planifiées de `web/vercel.json` sont créées automatiquement : collecte quotidienne à **10:00 UTC (06:00 Martinique)**, envois de rapports à 10:30 UTC. Vercel les appelle avec `Authorization: Bearer $CRON_SECRET`.
4. Application Meta : ajouter le domaine Vercel aux domaines de l'app et `https://<domaine-vercel>/api/meta/callback` aux URI de redirection OAuth valides (route implémentée par l'agent back/data).
5. Vérifier `https://<domaine-vercel>/api/health` → `{"ok":true,"dataSource":"supabase"}`.
