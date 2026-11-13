#!/usr/bin/env node
/**
 * Génère les données de démonstration d'Orbit, de façon déterministe :
 *   - supabase/seed.sql                      (Supabase local : `supabase db reset`)
 *   - web/src/lib/db/demo/fixture.json       (mode démo sans Supabase, ORBIT_DATA_SOURCE=demo)
 *
 * Les dates sont RELATIVES au jour courant (décalages en jours, -1 = hier), pour que
 * les périodes « 7 / 30 / 90 jours » aient toujours des données.
 *
 * Usage : cd web && npm run demo:generate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const DAYS = 180; // ~6 mois : permet la comparaison sur 90 jours

// ---------------------------------------------------------------------------
// PRNG déterministe
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261113);
const between = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const noise = () => 0.75 + rand() * 0.5;
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------
const ORG = { id: uuid("00000000", 1), name: "Agence Orbit (démo)", slug: "orbit-demo" };

const USERS = [
  { id: uuid("10000000", 1), email: "admin@orbit.test", full_name: "Alice Admin", role: "admin", locale: "fr" },
  { id: uuid("10000000", 2), email: "manager@orbit.test", full_name: "Marc Manager", role: "manager", locale: "fr" },
  { id: uuid("10000000", 3), email: "client@cafe-lumiere.test", full_name: "Direction Café Lumière", role: "client", locale: "fr" },
  { id: uuid("10000000", 4), email: "client@atelier-mangrove.test", full_name: "Atelier Mangrove", role: "client", locale: "en" },
];

const BRANDS = [
  {
    id: uuid("20000000", 1), name: "Café Lumière", slug: "cafe-lumiere", sector: "Restauration", color: "#2A78D6",
    avatar_url: "/demo/avatars/cafe-lumiere.svg",
    captions: [
      "Nouveau brunch du dimanche ☀️ Réservez votre table à Fort-de-France !",
      "Le chocolat chaud martiniquais revisité par notre chef 🍫",
      "Coulisses : la torréfaction de nos grains, chaque matin.",
      "Happy hour sur la terrasse dès 17 h 🌴",
      "Merci pour vos 500 avis ⭐ !",
      "Recette : notre fameux flan coco, étape par étape.",
      "Concert acoustique vendredi soir, entrée libre 🎶",
      "Nos pâtisseries du jour sont arrivées 🥐",
    ],
    accounts: [
      { id: uuid("30000000", 1), network: "ig", external_id: "17841400000000001", handle: "@cafelumiere.mq", name: "Café Lumière", followers: 8400, growth: 0.0021, reachRate: 0.16 },
      { id: uuid("30000000", 2), network: "fb", external_id: "100000000000001", handle: "Café Lumière", name: "Café Lumière", followers: 12600, growth: 0.0007, reachRate: 0.09 },
    ],
  },
  {
    id: uuid("20000000", 2), name: "Atelier Mangrove", slug: "atelier-mangrove", sector: "Mode & artisanat", color: "#C2410C",
    avatar_url: "/demo/avatars/atelier-mangrove.svg",
    captions: [
      "Collection Carnaval : les madras sont arrivés 🎭",
      "Fait main en Martinique, pièce par pièce.",
      "Rencontre avec nos couturières du Lamentin.",
      "Nouveaux bijoux en graines locales ✨",
      "Le look du week-end : lin et wax.",
      "Atelier ouvert samedi : venez créer votre sac !",
      "Dernières pièces de la collection été, -20 %.",
      "Making-of du shooting à l'Anse Noire 📸",
    ],
    accounts: [
      { id: uuid("30000000", 3), network: "ig", external_id: "17841400000000002", handle: "@ateliermangrove", name: "Atelier Mangrove", followers: 15200, growth: 0.0034, reachRate: 0.19 },
      { id: uuid("30000000", 4), network: "fb", external_id: "100000000000002", handle: "Atelier Mangrove", name: "Atelier Mangrove", followers: 6100, growth: -0.0004, reachRate: 0.06 },
    ],
  },
  {
    id: uuid("20000000", 3), name: "Fitness Caraïbes", slug: "fitness-caraibes", sector: "Sport & bien-être", color: "#0F766E",
    avatar_url: "/demo/avatars/fitness-caraibes.svg",
    captions: [
      "Défi 30 jours : jour 1, on y va ! 💪",
      "Cours de cross-training sur la plage du Diamant au lever du soleil.",
      "Témoignage : -12 kg en 6 mois avec Sandra.",
      "Nouveau planning des cours collectifs.",
      "Smoothie récup' : banane, maracuja, avoine.",
      "Portes ouvertes ce samedi, séance d'essai offerte.",
      "Les 5 erreurs à éviter au squat.",
      "Bienvenue à nos nouveaux coachs !",
    ],
    accounts: [
      { id: uuid("30000000", 5), network: "ig", external_id: "17841400000000003", handle: "@fitnesscaraibes", name: "Fitness Caraïbes", followers: 22800, growth: 0.0026, reachRate: 0.14 },
      { id: uuid("30000000", 6), network: "fb", external_id: "100000000000003", handle: "Fitness Caraïbes", name: "Fitness Caraïbes", followers: 9800, growth: 0.0011, reachRate: 0.07 },
    ],
  },
];

const CAMPAIGNS = [
  { id: uuid("40000000", 1), brand_id: BRANDS[0].id, name: "Semaine du chocolat", description: "Mise en avant du chocolat chaud martiniquais.", start: -42, end: -32, hashtags: ["#semaineduchocolat", "#cafelumiere"], color: "#7C3AED" },
  { id: uuid("40000000", 2), brand_id: BRANDS[1].id, name: "Collection Carnaval", description: "Lancement de la collection madras.", start: -64, end: -45, hashtags: ["#carnaval", "#madras"], color: "#DB2777" },
  { id: uuid("40000000", 3), brand_id: BRANDS[2].id, name: "Défi 30 jours", description: "Programme d'entraînement communautaire.", start: -30, end: -1, hashtags: ["#defi30jours", "#fitnesscaraibes"], color: "#16A34A" },
];

const FORMATS = { ig: ["image", "carousel", "reel", "reel", "carousel"], fb: ["image", "video", "link", "status", "image"] };

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------
const daily = [];
const posts = [];
const postMetrics = [];
let postSeq = 0;

for (const brand of BRANDS) {
  const brandCampaigns = CAMPAIGNS.filter((c) => c.brand_id === brand.id);
  for (const acc of brand.accounts) {
    // abonnés au début de l'historique : on remonte depuis la valeur actuelle
    let f = acc.followers / Math.pow(1 + acc.growth, DAYS);
    const postProb = acc.network === "ig" ? 0.42 : 0.3;
    for (let offset = -DAYS; offset <= -1; offset++) {
      const weekday = ((offset % 7) + 7) % 7; // pseudo jour de semaine
      const weekendBoost = weekday === 5 || weekday === 6 ? 1.18 : 1;
      const inCampaign = brandCampaigns.some((c) => offset >= c.start && offset <= c.end);
      const boost = (inCampaign ? 1.45 : 1) * weekendBoost * (rand() < 0.03 ? 2.4 : 1);
      const nPosts = rand() < postProb * (inCampaign ? 1.6 : 1) ? (rand() < 0.15 ? 2 : 1) : 0;

      const reach = Math.round(f * acc.reachRate * noise() * boost * (1 + nPosts * 0.55));
      const views = Math.round(reach * between(1.35, 1.8));
      const likes = Math.round(reach * between(0.03, 0.055) * (acc.network === "ig" ? 1.2 : 0.8));
      const comments = Math.round(likes * between(0.04, 0.09));
      const shares = Math.round(likes * between(0.05, 0.12));
      const saves = acc.network === "ig" ? Math.round(likes * between(0.08, 0.16)) : null;
      const interactions = likes + comments + shares + (saves ?? 0);
      const gained = Math.max(0, Math.round(f * Math.abs(acc.growth) * noise() * boost * 1.4 + rand() * 2));
      const lost = acc.growth < 0 ? Math.round(gained + f * Math.abs(acc.growth) * 1.5 * noise()) : Math.round(gained * between(0.2, 0.42));
      f += gained - lost;
      const profileVisits = Math.round(reach * between(0.02, 0.04));
      const linkClicks = acc.network === "ig" ? Math.round(profileVisits * between(0.06, 0.13)) : null;
      const videoViews = acc.network === "ig" ? Math.round(views * between(0.25, 0.45)) : Math.round(views * between(0.1, 0.2));

      daily.push({
        account_id: acc.id, offset,
        followers: Math.round(f), followers_gained: gained, followers_lost: lost,
        reach, views, interactions, likes, comments, shares, saves,
        profile_visits: profileVisits, link_clicks: linkClicks, posts_count: nPosts, video_views: videoViews,
      });

      for (let k = 0; k < nPosts; k++) {
        postSeq++;
        const id = uuid("50000000", postSeq);
        const format = pick(FORMATS[acc.network]);
        const hour = pick([7, 8, 11, 12, 12, 17, 18, 18, 19, 20]);
        const minute = pick([0, 15, 30, 45]);
        const pReach = Math.round(reach * between(0.35, 0.8) * (format === "reel" ? 1.6 : format === "carousel" ? 1.2 : 1));
        const pViews = Math.round(pReach * between(1.2, 1.7));
        const pLikes = Math.round(pReach * between(0.035, 0.09));
        const pComments = Math.round(pLikes * between(0.03, 0.1));
        const pShares = Math.round(pLikes * between(0.03, 0.15));
        const pSaves = acc.network === "ig" ? Math.round(pLikes * between(0.05, 0.2)) : 0;
        const campaign = brandCampaigns.find((c) => offset >= c.start && offset <= c.end);
        const thumbIndex = 1 + (postSeq % 4);
        posts.push({
          id, account_id: acc.id, network: acc.network, external_id: `${acc.external_id}_${postSeq}`,
          offset, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
          format, caption: pick(brand.captions),
          permalink: acc.network === "ig" ? `https://www.instagram.com/p/DEMO${postSeq}/` : `https://www.facebook.com/${acc.external_id}/posts/${postSeq}`,
          thumbnail_url: format === "status" ? null : `/demo/posts/${brand.slug}-${thumbIndex}.svg`,
          campaign_id: campaign ? campaign.id : null,
        });
        const age = -offset;
        for (const [day, ratio] of [[1, 0.62], [7, 0.93], [28, 1]]) {
          if (age < day) continue;
          const r = (x) => Math.round(x * ratio);
          postMetrics.push({
            post_id: id, snapshot_day: day,
            reach: r(pReach), views: r(pViews),
            interactions: r(pLikes) + r(pComments) + r(pShares) + r(pSaves),
            likes: r(pLikes), comments: r(pComments), shares: r(pShares), saves: acc.network === "ig" ? r(pSaves) : null,
            video_views: format === "reel" || format === "video" ? r(pViews * 0.8) : null,
          });
        }
      }
    }
    acc.followersNow = Math.round(f);
  }
}

// Audience (Instagram uniquement)
const AGES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const AGE_W = [0.02, 0.17, 0.33, 0.24, 0.13, 0.07, 0.04];
const CITIES = ["Fort-de-France, Martinique", "Le Lamentin, Martinique", "Schœlcher, Martinique", "Le Robert, Martinique", "Ducos, Martinique", "Sainte-Marie, Martinique", "Le François, Martinique", "Paris, France"];
const COUNTRIES = ["MQ", "FR", "GP", "GF", "CA", "US"];
const audience = [];
for (const brand of BRANDS) {
  for (const acc of brand.accounts.filter((a) => a.network === "ig")) {
    const fShare = between(0.48, 0.66);
    const ageGender = [];
    AGES.forEach((age, i) => {
      const tot = acc.followersNow * AGE_W[i] * noise();
      ageGender.push({ age, gender: "F", value: Math.round(tot * fShare) });
      ageGender.push({ age, gender: "M", value: Math.round(tot * (1 - fShare) * 0.96) });
      ageGender.push({ age, gender: "U", value: Math.round(tot * 0.02) });
    });
    let rest = acc.followersNow * 0.86;
    const cities = CITIES.map((key, i) => { const v = Math.round(rest * (i === 0 ? 0.34 : between(0.08, 0.16))); rest -= v; return { key, value: v }; });
    const countries = [0.81, 0.11, 0.035, 0.02, 0.012, 0.008].map((w, i) => ({ key: COUNTRIES[i], value: Math.round(acc.followersNow * w * noise()) }));
    const online = {};
    for (let d = -7; d <= -1; d++) {
      const hours = {};
      for (let h = 0; h < 24; h++) {
        const curve = Math.exp(-Math.pow(h - 12.5, 2) / 18) * 0.6 + Math.exp(-Math.pow(h - 19.5, 2) / 6) + 0.05;
        hours[String(h)] = Math.round(acc.followersNow * 0.08 * curve * noise());
      }
      online[String(d)] = hours;
    }
    audience.push({ account_id: acc.id, offset: -1, demographics: { age_gender: ageGender, cities, countries }, online_followers: online });
  }
}

const accounts = BRANDS.flatMap((b) => b.accounts.map((a) => ({
  id: a.id, brand_id: b.id, network: a.network, external_id: a.external_id,
  parent_page_id: a.network === "ig" ? b.accounts.find((x) => x.network === "fb")?.external_id ?? null : null,
  handle: a.handle, name: a.name, avatar_url: b.avatar_url, followers_count: a.followersNow,
  status: "active", token_expires_in_days: 52,
})));

const brandAccess = [
  { user_id: USERS[2].id, brand_id: BRANDS[0].id, visible_sections: ["analytics", "posts", "audience", "campaigns", "reports"] },
  { user_id: USERS[3].id, brand_id: BRANDS[1].id, visible_sections: ["analytics", "posts", "reports"] },
];

const syncRuns = accounts.flatMap((a, i) => [2, 1].map((ago) => ({
  account_id: a.id, kind: "daily", trigger: "cron", offset: -ago + 1, status: i === 3 && ago === 1 ? "partial" : "success",
  details: a.network === "fb"
    ? { calls: ["page_follows", "page_daily_follows_unique", "page_daily_unfollows_unique", "page_total_media_view_unique", "page_media_view", "page_post_engagements", "page_views_total"].map((m) => ({ metric: m, ok: !(i === 3 && ago === 1 && m === "page_views_total"), values: 1 })) }
    : { calls: ["reach", "views", "total_interactions", "likes", "comments", "shares", "saves", "profile_views", "profile_links_taps", "follows_and_unfollows"].map((m) => ({ metric: m, ok: true, values: 1 })) },
})));

const reportSchedules = [
  { id: uuid("60000000", 1), brand_id: BRANDS[0].id, name: "Rapport mensuel Café Lumière", kind: "month", frequency: "monthly", recipients: ["direction@cafelumiere.test"], locale: "fr", format: "pdf" },
  { id: uuid("60000000", 2), brand_id: BRANDS[1].id, name: "Monthly report Atelier Mangrove", kind: "month", frequency: "monthly", recipients: ["owner@atelier-mangrove.test"], locale: "en", format: "pdf" },
];

// ---------------------------------------------------------------------------
// Sortie JSON (mode démo)
// ---------------------------------------------------------------------------
const fixture = {
  $comment: "Généré par web/scripts/generate-demo-data.mjs — ne pas modifier à la main. Dates = décalages en jours par rapport à aujourd'hui (fuseau America/Martinique).",
  organization: ORG,
  users: USERS.map((u) => ({ ...u, organization_id: ORG.id })),
  brands: BRANDS.map(({ captions: _c, accounts: _a, ...b }) => ({ ...b, organization_id: ORG.id })),
  accounts,
  campaigns: CAMPAIGNS,
  daily,
  posts,
  postMetrics,
  audience,
  brandAccess,
  syncRuns,
  reportSchedules,
};
const fixturePath = resolve(ROOT, "web/src/lib/db/demo/fixture.json");
mkdirSync(dirname(fixturePath), { recursive: true });
writeFileSync(fixturePath, JSON.stringify(fixture));

// ---------------------------------------------------------------------------
// Sortie SQL (Supabase)
// ---------------------------------------------------------------------------
const q = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const arr = (xs, type = "text") => `array[${xs.map(q).join(",")}]::${type}[]`;
const day = (offset) => `(current_date + (${offset}))`;
const ts = (offset, time) => `((current_date + (${offset})) + time '${time}') at time zone 'America/Martinique'`;
const jsonb = (o) => `${q(JSON.stringify(o))}::jsonb`;
const chunks = (rows, n) => { const out = []; for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n)); return out; };

const sql = [];
sql.push(`-- =============================================================================
-- Orbit — données de démonstration (GÉNÉRÉ par web/scripts/generate-demo-data.mjs)
-- ${DAYS} jours de métriques jusqu'à hier, dates relatives à current_date.
-- Utilisateurs (connexion par lien magique, e-mails visibles dans Mailpit en local) :
${USERS.map((u) => `--   ${u.email.padEnd(32)} ${u.role}`).join("\n")}
-- =============================================================================
begin;
`);
sql.push(`insert into public.organizations (id, name, slug) values (${q(ORG.id)}, ${q(ORG.name)}, ${q(ORG.slug)});\n`);

sql.push(`-- Utilisateurs : organisation et rôle passés en raw_app_meta_data (trigger handle_new_user)`);
for (const u of USERS) {
  sql.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', ${q(u.id)}, 'authenticated', 'authenticated', ${q(u.email)}, '', now(), ${jsonb({ provider: "email", providers: ["email"], organization_id: ORG.id, role: u.role })}, ${jsonb({ full_name: u.full_name, locale: u.locale })}, now(), now(), '', '', '', '');`);
}
sql.push("");

sql.push(`insert into public.brands (id, organization_id, name, slug, sector, color, avatar_url) values`);
sql.push(BRANDS.map((b) => `  (${[b.id, ORG.id, b.name, b.slug, b.sector, b.color, b.avatar_url].map(q).join(", ")})`).join(",\n") + ";\n");

sql.push(`insert into public.social_accounts (id, brand_id, network, external_id, parent_page_id, handle, name, avatar_url, followers_count, token_expires_at, status, last_synced_at, history_from, connected_by) values`);
sql.push(accounts.map((a) => `  (${[a.id, a.brand_id].map(q).join(", ")}, ${q(a.network)}, ${[a.external_id, a.parent_page_id, a.handle, a.name, a.avatar_url, a.followers_count].map(q).join(", ")}, now() + interval '${a.token_expires_in_days} days', 'active', ${ts(0, "06:00")}, ${day(-DAYS)}, ${q(USERS[0].id)})`).join(",\n") + ";\n");

sql.push(`insert into public.campaigns (id, brand_id, name, description, starts_on, ends_on, hashtags, color, created_by) values`);
sql.push(CAMPAIGNS.map((c) => `  (${[c.id, c.brand_id, c.name, c.description].map(q).join(", ")}, ${day(c.start)}, ${day(c.end)}, ${arr(c.hashtags)}, ${q(c.color)}, ${q(USERS[1].id)})`).join(",\n") + ";\n");

const DM_COLS = ["followers", "followers_gained", "followers_lost", "reach", "views", "interactions", "likes", "comments", "shares", "saves", "profile_visits", "link_clicks", "posts_count", "video_views"];
for (const part of chunks(daily, 400)) {
  sql.push(`insert into public.account_daily_metrics (account_id, date, ${DM_COLS.join(", ")}) values`);
  sql.push(part.map((d) => `  (${q(d.account_id)}, ${day(d.offset)}, ${DM_COLS.map((c) => q(d[c])).join(", ")})`).join(",\n") + ";\n");
}

for (const part of chunks(posts, 300)) {
  sql.push(`insert into public.posts (id, account_id, network, external_id, published_at, format, caption, permalink, thumbnail_url, campaign_id) values`);
  sql.push(part.map((p) => `  (${[p.id, p.account_id, p.network, p.external_id].map(q).join(", ")}, ${ts(p.offset, p.time)}, ${[p.format, p.caption, p.permalink, p.thumbnail_url, p.campaign_id].map(q).join(", ")})`).join(",\n") + ";\n");
}

const PM_COLS = ["reach", "views", "interactions", "likes", "comments", "shares", "saves", "video_views"];
const postOffset = new Map(posts.map((p) => [p.id, p.offset]));
for (const part of chunks(postMetrics, 400)) {
  sql.push(`insert into public.post_metrics (post_id, snapshot_day, captured_at, ${PM_COLS.join(", ")}) values`);
  sql.push(part.map((m) => `  (${q(m.post_id)}, ${m.snapshot_day}, ${ts(postOffset.get(m.post_id) + m.snapshot_day, "06:00")}, ${PM_COLS.map((c) => q(m[c])).join(", ")})`).join(",\n") + ";\n");
}

for (const a of audience) {
  // les clés de online_followers (décalages) deviennent des dates ISO
  const online = Object.entries(a.online_followers).map(([off, hours]) => `${q(String(off))}, ${jsonb(hours)}`);
  sql.push(`insert into public.audience_snapshots (account_id, date, demographics, online_followers) values (${q(a.account_id)}, ${day(a.offset)}, ${jsonb(a.demographics)},
  (select jsonb_object_agg(to_char(current_date + k::int, 'YYYY-MM-DD'), v) from (values ${online.map((o) => `(${o})`).join(", ")}) as t(k, v)));`);
}
sql.push("");

sql.push(`insert into public.brand_access (user_id, brand_id, visible_sections, invited_by) values`);
sql.push(brandAccess.map((b) => `  (${q(b.user_id)}, ${q(b.brand_id)}, ${arr(b.visible_sections, "public.brand_section")}, ${q(USERS[0].id)})`).join(",\n") + ";\n");

sql.push(`insert into public.report_schedules (id, brand_id, name, kind, frequency, recipients, locale, format, next_run_at, created_by) values`);
sql.push(reportSchedules.map((r) => `  (${[r.id, r.brand_id, r.name, r.kind, r.frequency].map(q).join(", ")}, ${arr(r.recipients)}, ${q(r.locale)}, ${q(r.format)}, date_trunc('month', now()) + interval '1 month 10 hours', ${q(USERS[0].id)})`).join(",\n") + ";\n");

sql.push(`insert into public.sync_runs (account_id, kind, trigger, started_at, finished_at, status, range_from, range_to, details) values`);
sql.push(syncRuns.map((s) => `  (${q(s.account_id)}, ${q(s.kind)}, ${q(s.trigger)}, ${ts(s.offset, "06:00")}, ${ts(s.offset, "06:02")}, ${q(s.status)}, ${day(s.offset - 1)}, ${day(s.offset - 1)}, ${jsonb(s.details)})`).join(",\n") + ";\n");

sql.push(`insert into public.access_logs (user_id, brand_id, event, path, created_at) values
  (${q(USERS[2].id)}, ${q(BRANDS[0].id)}, 'login', '/brands/${BRANDS[0].id}', now() - interval '2 days'),
  (${q(USERS[3].id)}, ${q(BRANDS[1].id)}, 'login', '/brands/${BRANDS[1].id}', now() - interval '5 days');
`);
sql.push("commit;\n");

writeFileSync(resolve(ROOT, "supabase/seed.sql"), sql.join("\n"));
console.log(`OK — ${daily.length} lignes de métriques, ${posts.length} publications, ${postMetrics.length} snapshots, ${audience.length} audiences.`);
