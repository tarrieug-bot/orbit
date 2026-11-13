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
3. Permissions utilisées : `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management`.
4. En mode développement, seuls les administrateurs, développeurs et testeurs de l'application peuvent se connecter : aucune validation Meta n'est nécessaire pour l'essai.
5. Renseigner l'App ID dans `ORBIT_CONFIG` (dans `index.html`) ou dans l'écran d'accueil d'Orbit.

## La suite : la version complète

Voir [docs/SPEC.md](docs/SPEC.md). Architecture cible : Next.js + TypeScript, Supabase (PostgreSQL), collecte planifiée, rapports PDF/PPTX côté serveur, hébergement Vercel + Supabase.
