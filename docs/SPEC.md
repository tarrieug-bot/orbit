# Orbit — Spécification technique

## 1. Objectif
Plateforme type Iconosquare pour une agence : accès en 1 clic aux statistiques de chaque marque gérée, vue d'ensemble multi-marques, rapports mensuels / campagne / annuels / dates libres. V1 : Facebook + Instagram. V2 : TikTok, LinkedIn, YouTube regroupés sous la même marque.

**Hors périmètre** : pas de planification ni de publication de contenus. Orbit reste un outil de statistiques et de reporting.

## 2. Périmètre fonctionnel V1
| Module | Contenu |
|---|---|
| Vue d'ensemble | KPI agrégés toutes marques, tableau marques × comptes triable, tendances, points d'attention automatiques (perte d'abonnés, baisse d'engagement, pic de portée, inactivité > 7 j) |
| Analytics marque | Abonnés (évolution, gagnés/perdus), portée, vues, visites profil, clics, interactions par type, taux d'engagement, performance par format, top publications, meilleurs créneaux |
| Publications | Liste filtrable (format, réseau) et triable + export CSV |
| Audience | Âge/genre, villes, pays, abonnés en ligne par heure |
| Campagnes | Création (nom, dates, hashtags), résultats vs période précédente, rapport en 1 clic |
| Rapports | Mois / campagne / année / dates, choix des réseaux et sections, comparaison, recommandations auto, langue FR ou EN, export PDF/PPTX, envois programmés par e-mail (avec langue) |
| Espace client | Accès en lecture seule pour les clients de l'agence (§2.1) |
| Comptes | Marques = groupe de comptes multi-réseaux ; connexion OAuth ; statut des jetons ; gestion des accès clients |
| Filtres globaux | Réseaux, période (presets + personnalisé + campagnes), comparaison période précédente |

### 2.1 Espace client (lecture seule)
- Un ou plusieurs utilisateurs clients par marque, invités par e-mail (lien magique).
- Le client ne voit que sa marque : pas de vue d'ensemble multi-marques, pas de page « Comptes connectés ».
- Rubriques visibles configurables par marque : Analytics, Publications, Audience, Campagnes, Rapports.
- Interdit au client : connecter/déconnecter un compte, créer/modifier une campagne, programmer un envoi, voir d'autres marques.
- Autorisé : changer de période et de réseau, générer et exporter ses rapports.
- Langue préférée (FR/EN) par utilisateur client.
- Contrôle d'accès côté serveur (row-level security Postgres) — jamais seulement dans l'interface.
- Journal des connexions clients visible par l'agence.

### 2.2 Rapports bilingues FR / EN
- Choix de la langue à la génération, à l'export et à la programmation d'un envoi.
- Tout le contenu généré est traduit ; nombres, pourcentages et dates localisés.
- Les légendes des publications restent dans leur langue d'origine.
- next-intl, clés partagées entre l'interface et le moteur de rapports ; analyses écrites par gabarits dans chaque langue.

### 2.3 Logo de l'agence — plus tard
Champ `organization.logo` et emplacement prévus en couverture et pied de page des rapports.

## 3. Architecture cible
- **Front + API** : Next.js (App Router) + TypeScript, Tailwind, Recharts ou ECharts, next-intl — hébergé sur **Vercel**.
- **Base + auth** : **Supabase** (PostgreSQL, Auth avec liens magiques, row-level security, stockage des exports).
- **Collecte** : tâches planifiées (Vercel Cron ou Supabase Edge Functions + pg_cron) — synchro quotidienne des métriques jour par jour + synchro des nouvelles publications ; reprise sur erreur, respect des quotas Meta.
- **Rapports** : rendu HTML → PDF et PPTX (pptxgenjs) côté serveur, dans la langue choisie ; envoi par e-mail (Resend).
- **Secrets** : App Secret Meta et jetons longue durée uniquement côté serveur, chiffrés en base.

### Modèle de données (simplifié)
- `organization` (nom, logo — plus tard) → `brand` → `social_account` (réseau, id externe, handle, token chiffré, expiration)
- `user` (e-mail, nom, langue, rôle) + `brand_access` (user_id, brand_id, rubriques visibles)
- `account_daily_metrics` (account_id, date, followers, followers_gained, followers_lost, reach, views, profile_visits, link_clicks, likes, comments, shares, saves…)
- `post` + `post_metrics` (snapshots J+1, J+7, J+28)
- `audience_snapshot` (account_id, date, démographie JSON, online_followers JSON)
- `campaign`, `report_template`, `report_schedule` (fréquence, destinataires, langue), `report_export`

**Stocker l'historique dès la connexion** : les API ne renvoient qu'un historique limité et Meta supprime régulièrement des métriques.

## 4. Intégrations réseaux
### Meta (V1)
- Facebook Login for Business → Pages et comptes Instagram professionnels liés.
- Permissions (App Review + vérification d'entreprise pour la mise en production) : `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management`.
- **Métriques 2026** : Graph API v25 remplace la portée et les impressions Facebook par `page_total_media_view_unique` / `page_media_view` et `post_total_media_view_unique` / `post_media_view` ; côté Instagram, `impressions` est remplacé par `views`. Couche de correspondance obligatoire entre nos métriques et celles de chaque API, versionnée par réseau.
- Démographie des Pages Facebook indisponible via l'API : démographie Instagram uniquement.
- La version d'essai (`index.html`, page Diagnostic API) sert à vérifier la disponibilité réelle de chaque métrique sur nos comptes.

### V2
TikTok, LinkedIn (Community Management API), YouTube (Data + Analytics API). Même modèle `social_account`.

## 5. Définitions des KPI
- Taux d'engagement = interactions ÷ portée (spectateurs uniques). Variante : ÷ abonnés.
- Interactions = j'aime/réactions + commentaires + partages + enregistrements.
- Évolution abonnés = abonnés fin de période − abonnés veille du début.
- Comparaison = période de même durée immédiatement précédente (option : même période N-1).

## 6. Décisions
| Question | Décision |
|---|---|
| Logo agence sur les rapports | Plus tard (emplacement prévu) |
| Accès client en lecture seule | Oui — V1 |
| Langue des rapports | FR ou EN à chaque export / envoi |
| Planification de publications | Non |
| Hébergement | Vercel + Supabase |
| Équipe | 4 agents : lead/architecte, front-end, back-end/data, designer — coordonnés par Claude |
