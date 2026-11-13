import "server-only";
import {
  Defs,
  Document,
  Font,
  G,
  Image,
  Line,
  LinearGradient,
  Link,
  Page,
  Path,
  Rect,
  renderToBuffer,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Network } from "@/lib/db/types";
import type { ReportKpi, ReportModel, ReportSectionKey, ReportSeriesPoint } from "../model";
import { INTER_400, INTER_600, INTER_800 } from "./fonts";
import { loadReportImages, type ImageMap } from "./images";
import { footerText, networkColor, niceMax, pdfSafe, shade, THEME } from "./theme";

/**
 * Rendu PDF (A4 paysage) d'un ReportModel avec @react-pdf/renderer :
 * couverture (photo de la marque, emplacement du logo agence), KPI en tuiles,
 * graphiques SVG, top publications avec miniatures, analyses, pied de page numéroté.
 */

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: INTER_400, fontWeight: 400 },
      { src: INTER_600, fontWeight: 600 },
      { src: INTER_800, fontWeight: 800 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const W = 842;
const H = 595;
const PAD = 36;
const CW = W - PAD * 2;

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, color: THEME.ink, backgroundColor: THEME.canvas, paddingTop: PAD, paddingHorizontal: PAD, paddingBottom: 54 },
  h1: { fontSize: 22, fontWeight: 800, color: THEME.ink },
  intro: { fontSize: 10, color: THEME.ink2, marginTop: 3 },
  card: { backgroundColor: THEME.surface, borderRadius: 10, borderWidth: 1, borderColor: THEME.line, padding: 14 },
  cardTitle: { fontSize: 11, fontWeight: 600, color: THEME.ink, marginBottom: 8 },
  muted: { color: THEME.ink3 },
  footer: { position: "absolute", left: PAD, right: PAD, bottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", fontSize: 8, color: THEME.ink3, borderTopWidth: 1, borderTopColor: THEME.line, paddingTop: 8 },
});

const txt = (v: string | null | undefined) => pdfSafe(v ?? "");

function Avatar({ src, name, color, size, images, network }: { src: string | null; name: string; color: string; size: number; images: ImageMap; network?: Network }) {
  const img = src ? images.get(src) : undefined;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      {img ? (
        <Image src={img.dataUri} style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover" }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#FFFFFF", fontWeight: 800, fontSize: size * 0.36 }}>{txt(initials)}</Text>
        </View>
      )}
      {network && (
        <View style={{ position: "absolute", right: -2, bottom: -2, width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.5, borderColor: "#FFFFFF", backgroundColor: networkColor(network) }} />
      )}
    </View>
  );
}

function NetworkDot({ network, size = 8 }: { network: Network; size?: number }) {
  if (network === "ig") {
    return (
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Defs>
          <LinearGradient id="igdot" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={THEME.igGradient[0]} />
            <Stop offset="0.5" stopColor={THEME.igGradient[1]} />
            <Stop offset="1" stopColor={THEME.igGradient[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="10" height="10" rx="3" fill="url(#igdot)" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Rect x="0" y="0" width="10" height="10" rx="5" fill={networkColor(network)} />
    </Svg>
  );
}

function Footer({ model }: { model: ReportModel }) {
  return (
    <View style={s.footer} fixed>
      <Text>{txt(footerText(model))}</Text>
      <Text>{txt(model.agency.name ?? model.labels.confidential)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionPage({ model, section, images, children }: { model: ReportModel; section: ReportSectionKey; images: ImageMap; children: ReactNode }) {
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <View style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: model.brand.color, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>{txt(model.labels.sections[section])}</Text>
          <Text style={s.intro}>{txt(model.labels.sectionIntros[section])}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ marginRight: 8, alignItems: "flex-end" }}>
            <Text style={{ fontWeight: 600, fontSize: 10 }}>{txt(model.brand.name)}</Text>
            <Text style={{ fontSize: 8, color: THEME.ink3 }}>{txt(model.period.label)}</Text>
          </View>
          <Avatar src={model.brand.avatarUrl} name={model.brand.name} color={model.brand.color} size={30} images={images} />
        </View>
      </View>
      {children}
      <Footer model={model} />
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Couverture
// -----------------------------------------------------------------------------
function Cover({ model, images }: { model: ReportModel; images: ImageMap }) {
  const c1 = shade(model.brand.color, -0.35);
  const c2 = model.brand.color;
  const logo = model.agency.logoUrl ? images.get(model.agency.logoUrl) : undefined;
  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: "Inter", color: "#FFFFFF", backgroundColor: THEME.orbitDark }}>
      <Svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={THEME.orbitDark} />
            <Stop offset="0.55" stopColor={c1} />
            <Stop offset="1" stopColor={c2} />
          </LinearGradient>
          <LinearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={THEME.igGradient[0]} />
            <Stop offset="0.5" stopColor={THEME.igGradient[1]} />
            <Stop offset="1" stopColor={THEME.igGradient[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#cover)" />
        <Path d={`M ${W * 0.55} ${H} C ${W * 0.7} ${H * 0.55}, ${W * 0.85} ${H * 0.75}, ${W} ${H * 0.35} L ${W} ${H} Z`} fill="#FFFFFF" fillOpacity={0.06} />
        <Path d={`M ${W * 0.7} ${H} C ${W * 0.8} ${H * 0.7}, ${W * 0.9} ${H * 0.9}, ${W} ${H * 0.6} L ${W} ${H} Z`} fill="#FFFFFF" fillOpacity={0.07} />
        <Rect x={PAD} y={H - 10} width={120} height={4} rx={2} fill={THEME.facebook} />
        <Rect x={PAD + 126} y={H - 10} width={120} height={4} rx={2} fill="url(#ig)" />
      </Svg>

      <View style={{ position: "absolute", top: PAD, right: PAD, width: 150, height: 54, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#FFFFFF", opacity: logo ? 1 : 0.55, alignItems: "center", justifyContent: "center" }}>
        {logo ? <Image src={logo.dataUri} style={{ maxWidth: 130, maxHeight: 40, objectFit: "contain" }} /> : <Text style={{ fontSize: 8, letterSpacing: 1 }}>{txt(model.labels.agencyLogo.toUpperCase())}</Text>}
      </View>

      <View style={{ position: "absolute", top: 150, left: PAD + 10, right: PAD, flexDirection: "row", alignItems: "center" }}>
        <View style={{ padding: 4, borderRadius: 70, backgroundColor: "#FFFFFF" }}>
          <Avatar src={model.brand.avatarUrl} name={model.brand.name} color={model.brand.color} size={120} images={images} />
        </View>
        <View style={{ marginLeft: 28, flex: 1 }}>
          <Text style={{ fontSize: 11, letterSpacing: 2, opacity: 0.8 }}>{txt(model.labels.title.toUpperCase())}</Text>
          <Text style={{ fontSize: 38, fontWeight: 800, marginTop: 6 }}>{txt(model.brand.name)}</Text>
          <Text style={{ fontSize: 18, fontWeight: 600, marginTop: 6, opacity: 0.95 }}>{txt(model.period.label)}</Text>
          <Text style={{ fontSize: 10, marginTop: 10, opacity: 0.8 }}>{txt(model.labels.subtitle)}</Text>
          <Text style={{ fontSize: 9, marginTop: 3, opacity: 0.7 }}>
            {txt([model.labels.periodLine, model.labels.comparisonLine].filter(Boolean).join("  ·  "))}
          </Text>
        </View>
      </View>

      <View style={{ position: "absolute", left: PAD + 10, bottom: 60, flexDirection: "row", flexWrap: "wrap" }}>
        {model.accounts.map((a) => (
          <View key={a.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 5, paddingLeft: 5, paddingRight: 12, marginRight: 10, marginBottom: 6 }}>
            <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? "?"} color={networkColor(a.network)} size={22} images={images} network={a.network} />
            <View style={{ marginLeft: 7 }}>
              <Text style={{ fontSize: 9, fontWeight: 600, color: THEME.ink }}>{txt(a.handle ?? a.name)}</Text>
              <Text style={{ fontSize: 7, color: THEME.ink2 }}>{txt(`${a.networkLabel} · ${a.followersDisplay}`)}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ position: "absolute", right: PAD, bottom: 30, fontSize: 8, opacity: 0.75 }}>{txt(model.labels.generatedOn)}</Text>
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Briques
// -----------------------------------------------------------------------------
function DeltaPill({ k }: { k: ReportKpi }) {
  if (!k.delta) return null;
  const bg = k.delta.positive === true ? THEME.positiveSoft : k.delta.positive === false ? THEME.negativeSoft : THEME.neutralSoft;
  const fg = k.delta.positive === true ? THEME.positive : k.delta.positive === false ? THEME.negative : THEME.ink2;
  const arrow = k.delta.trend === "up" ? "↑ " : k.delta.trend === "down" ? "↓ " : "";
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6 }}>
      <Text style={{ color: fg, fontSize: 8, fontWeight: 600 }}>{txt(arrow + k.delta.display)}</Text>
    </View>
  );
}

function KpiTile({ k, width, accent, last }: { k: ReportKpi; width: number; accent: string; last?: boolean }) {
  return (
    <View style={[s.card, { width, marginRight: last ? 0 : 10, marginBottom: 10, padding: 12, borderTopWidth: 3, borderTopColor: accent }]}>
      <Text style={{ fontSize: 8, color: THEME.ink2, textTransform: "uppercase", letterSpacing: 0.5 }}>{txt(k.label)}</Text>
      <Text style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: k.available ? THEME.ink : THEME.ink3 }}>{txt(k.display)}</Text>
      <DeltaPill k={k} />
    </View>
  );
}

type SeriesKey = Exclude<keyof ReportSeriesPoint, "key" | "label">;

function LineChart({ points, series, width, height }: { points: ReportSeriesPoint[]; series: { key: SeriesKey; color: string; label: string }[]; width: number; height: number }) {
  const left = 40;
  const bottom = 18;
  const top = 18;
  const iw = width - left - 6;
  const ih = height - bottom - top;
  const vals = series.flatMap((sr) => points.map((p) => p[sr.key] ?? 0));
  const minRaw = Math.min(...vals, 0);
  const max = niceMax(Math.max(...vals, 1));
  const min = series.some((sr) => sr.key === "followers") ? Math.max(0, Math.floor(Math.min(...vals) * 0.98)) : Math.min(0, minRaw);
  const x = (i: number) => left + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => top + ih - ((v - min) / (max - min || 1)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
  const step = Math.max(1, Math.ceil(points.length / 8));
  return (
    <Svg width={width} height={height}>
      {ticks.map((tv, i) => (
        <G key={i}>
          <Line x1={left} x2={width - 6} y1={y(tv)} y2={y(tv)} stroke={THEME.line} strokeWidth={0.7} />
          <Text x={left - 4} y={y(tv) + 3} style={{ fontSize: 6.5, fill: THEME.ink3 }} textAnchor="end">
            {compactAxis(tv)}
          </Text>
        </G>
      ))}
      {points.map((p, i) =>
        i % step === 0 ? (
          <Text key={p.key} x={x(i)} y={height - 4} style={{ fontSize: 6.5, fill: THEME.ink3 }} textAnchor="middle">
            {txt(p.label)}
          </Text>
        ) : null,
      )}
      {series.map((sr) => {
        const pts = points.map((p, i) => [x(i), y(p[sr.key] ?? 0)] as const);
        const d = pts.map(([px, py], i) => `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
        const area = `${d} L ${pts[pts.length - 1]?.[0].toFixed(1)} ${y(min).toFixed(1)} L ${pts[0]?.[0].toFixed(1)} ${y(min).toFixed(1)} Z`;
        return (
          <G key={sr.key}>
            {series.length === 1 && <Path d={area} fill={sr.color} fillOpacity={0.1} />}
            <Path d={d} stroke={sr.color} strokeWidth={1.8} fill="none" />
          </G>
        );
      })}
      {series.map((sr, i) => (
        <G key={`lg-${sr.key}`}>
          <Rect x={left + i * 110} y={2} width={10} height={4} rx={2} fill={sr.color} />
          <Text x={left + 14 + i * 110} y={7} style={{ fontSize: 7.5, fill: THEME.ink2 }}>
            {txt(sr.label)}
          </Text>
        </G>
      ))}
    </Svg>
  );
}

function StackedBars({ points, series, width, height }: { points: ReportSeriesPoint[]; series: { key: SeriesKey; color: string; label: string }[]; width: number; height: number }) {
  const left = 40;
  const bottom = 18;
  const top = 18;
  const iw = width - left - 6;
  const ih = height - bottom - top;
  const totals = points.map((p) => series.reduce((t, sr) => t + (p[sr.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 1));
  const bw = Math.max(2, (iw / Math.max(points.length, 1)) * 0.68);
  const step = Math.max(1, Math.ceil(points.length / 8));
  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <G key={i}>
          <Line x1={left} x2={width - 6} y1={top + ih - f * ih} y2={top + ih - f * ih} stroke={THEME.line} strokeWidth={0.7} />
          <Text x={left - 4} y={top + ih - f * ih + 3} style={{ fontSize: 6.5, fill: THEME.ink3 }} textAnchor="end">
            {compactAxis(max * f)}
          </Text>
        </G>
      ))}
      {points.map((p, i) => {
        const cx = left + (i + 0.5) * (iw / points.length);
        let acc = 0;
        return (
          <G key={p.key}>
            {series.map((sr) => {
              const v = p[sr.key] ?? 0;
              const h = (v / max) * ih;
              const yy = top + ih - acc - h;
              acc += h;
              return h > 0 ? <Rect key={sr.key} x={cx - bw / 2} y={yy} width={bw} height={h} fill={sr.color} /> : null;
            })}
            {i % step === 0 && (
              <Text x={cx} y={height - 4} style={{ fontSize: 6.5, fill: THEME.ink3 }} textAnchor="middle">
                {txt(p.label)}
              </Text>
            )}
          </G>
        );
      })}
      {series.map((sr, i) => (
        <G key={`lg-${sr.key}`}>
          <Rect x={left + i * 100} y={2} width={8} height={8} rx={2} fill={sr.color} />
          <Text x={left + 12 + i * 100} y={9} style={{ fontSize: 7.5, fill: THEME.ink2 }}>
            {txt(sr.label)}
          </Text>
        </G>
      ))}
    </Svg>
  );
}

function compactAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function HBar({ label, value, display, color, max = 1 }: { label: string; value: number; display: string; color: string; max?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
      <Text style={{ width: 120, fontSize: 8.5, color: THEME.ink2 }}>{txt(label)}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: THEME.surface2, borderRadius: 4 }}>
        <View style={{ width: `${Math.max(2, Math.min(100, (value / (max || 1)) * 100))}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ width: 44, textAlign: "right", fontSize: 8.5, fontWeight: 600 }}>{txt(display)}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Sections
// -----------------------------------------------------------------------------
function Summary({ model }: { model: ReportModel }) {
  const tileW = Math.floor((CW - 40) / 5) - 1;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {model.kpis.map((k, i) => (
          <KpiTile key={k.key} k={k} width={tileW} accent={model.brand.color} last={i % 5 === 4} />
        ))}
      </View>
      {model.byNetwork.length > 0 && (
        <View style={[s.card, { marginTop: 4 }]}>
          <Text style={s.cardTitle}>{txt(model.labels.byNetwork)}</Text>
          {model.byNetwork.map((n) => (
            <View key={n.network} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: THEME.line }}>
              <View style={{ width: 110, flexDirection: "row", alignItems: "center" }}>
                <NetworkDot network={n.network} size={9} />
                <Text style={{ marginLeft: 6, fontWeight: 600 }}>{txt(n.label)}</Text>
              </View>
              {n.kpis
                .filter((k) => ["followers", "reach", "views", "interactions", "engagementRate", "posts"].includes(k.key))
                .map((k) => (
                  <View key={k.key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 7, color: THEME.ink3 }}>{txt(k.label)}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>
                      {txt(k.display)}
                      {k.delta ? <Text style={{ fontSize: 7.5, color: k.delta.positive === false ? THEME.negative : k.delta.positive ? THEME.positive : THEME.ink3 }}>{txt(`  ${k.delta.display}`)}</Text> : null}
                    </Text>
                  </View>
                ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Audience({ model }: { model: ReportModel }) {
  const a = model.audience;
  if (!a) return <View style={s.card}><Text style={s.muted}>{txt(model.labels.noAudience)}</Text></View>;
  const maxAge = Math.max(...a.ageGender.map((r) => Math.max(r.female, r.male)), 0.01);
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={[s.card, { flex: 1.3, marginRight: 12 }]}>
        <Text style={s.cardTitle}>{txt(model.labels.ageGender)}</Text>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <Text style={{ color: THEME.women, fontWeight: 600, marginRight: 14 }}>{txt(`${model.labels.women} ${a.genders.female}`)}</Text>
          <Text style={{ color: THEME.men, fontWeight: 600 }}>{txt(`${model.labels.men} ${a.genders.male}`)}</Text>
        </View>
        {a.ageGender.map((r) => (
          <View key={r.age} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
            <Text style={{ width: 40, fontSize: 8.5, color: THEME.ink2 }}>{txt(r.age)}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ height: 6, width: `${(r.female / maxAge) * 100}%`, backgroundColor: THEME.women, borderRadius: 3, marginBottom: 2 }} />
              <View style={{ height: 6, width: `${(r.male / maxAge) * 100}%`, backgroundColor: THEME.men, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <View style={[s.card, { marginBottom: 12 }]}>
          <Text style={s.cardTitle}>{txt(model.labels.cities)}</Text>
          {a.cities.map((c) => (
            <HBar key={c.label} label={c.label} value={c.share} display={c.display} color={THEME.instagram} max={a.cities[0]?.share} />
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>{txt(model.labels.countries)}</Text>
          {a.countries.map((c) => (
            <HBar key={c.label} label={c.label} value={c.share} display={c.display} color={THEME.accent} max={a.countries[0]?.share} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Reach({ model }: { model: ReportModel }) {
  const pick = (keys: string[]) => model.kpis.filter((k) => keys.includes(k.key));
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {pick(["reach", "views", "profileVisits", "linkClicks"]).map((k, i, arr) => (
          <KpiTile key={k.key} k={k} width={Math.floor((CW - 30) / 4) - 1} accent={model.brand.color} last={i === arr.length - 1} />
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={[s.card, { flex: 1.4, marginRight: 12 }]}>
          <LineChart
            points={model.series.points}
            series={[
              { key: "reach", color: model.brand.color, label: model.labels.metrics.reach },
              { key: "views", color: THEME.accent, label: model.labels.metrics.views },
            ]}
            width={(CW - 12) * 0.583 - 28}
            height={290}
          />
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardTitle}>{txt(model.labels.followersEvolution)}</Text>
          <LineChart points={model.series.points} series={[{ key: "followers", color: THEME.positive, label: model.labels.metrics.followers }]} width={(CW - 12) * 0.417 - 28} height={270} />
        </View>
      </View>
    </View>
  );
}

function Engagement({ model }: { model: ReportModel }) {
  const pick = (keys: string[]) => model.kpis.filter((k) => keys.includes(k.key));
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {pick(["interactions", "engagementRate", "posts", "followersGained"]).map((k, i, arr) => (
          <KpiTile key={k.key} k={k} width={Math.floor((CW - 30) / 4) - 1} accent={model.brand.color} last={i === arr.length - 1} />
        ))}
      </View>
      <View style={s.card}>
        <StackedBars
          points={model.series.points}
          series={[
            { key: "likes", color: THEME.series.likes, label: model.labels.metrics.likes },
            { key: "comments", color: THEME.series.comments, label: model.labels.metrics.comments },
            { key: "shares", color: THEME.series.shares, label: model.labels.metrics.shares },
            { key: "saves", color: THEME.series.saves, label: model.labels.metrics.saves },
          ]}
          width={CW - 28}
          height={290}
        />
      </View>
    </View>
  );
}

function Formats({ model }: { model: ReportModel }) {
  const L = model.labels.table;
  if (!model.formats.length) return <View style={s.card}><Text style={s.muted}>{txt(model.labels.noPosts)}</Text></View>;
  const head = { fontSize: 8, color: THEME.ink3, fontWeight: 600 } as const;
  return (
    <View style={[s.card, { padding: 0 }]}>
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: THEME.surface2, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
        <Text style={[head, { flex: 2 }]}>{txt(L.format)}</Text>
        <Text style={[head, { flex: 1, textAlign: "right" }]}>{txt(L.posts)}</Text>
        <Text style={[head, { flex: 1, textAlign: "right" }]}>{txt(L.avgReach)}</Text>
        <Text style={[head, { flex: 1, textAlign: "right" }]}>{txt(L.avgInteractions)}</Text>
        <Text style={[head, { flex: 2, textAlign: "right" }]}>{txt(L.engagementRate)}</Text>
      </View>
      {model.formats.slice(0, 12).map((r) => (
        <View key={`${r.network}-${r.format}`} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1, borderTopColor: THEME.line }}>
          <View style={{ flex: 2, flexDirection: "row", alignItems: "center" }}>
            <NetworkDot network={r.network} size={9} />
            <Text style={{ marginLeft: 7, fontWeight: 600 }}>{txt(`${r.formatLabel}`)}</Text>
            <Text style={{ marginLeft: 4, color: THEME.ink3 }}>{txt(`· ${r.networkLabel}`)}</Text>
          </View>
          <Text style={{ flex: 1, textAlign: "right" }}>{txt(r.display.posts)}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{txt(r.display.avgReach)}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{txt(r.display.avgInteractions)}</Text>
          <View style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <View style={{ width: 120, height: 7, backgroundColor: THEME.surface2, borderRadius: 4, marginRight: 8 }}>
              <View style={{ width: `${Math.max(3, r.bar * 100)}%`, height: 7, borderRadius: 4, backgroundColor: networkColor(r.network) }} />
            </View>
            <Text style={{ width: 48, textAlign: "right", fontWeight: 800 }}>{txt(r.display.engagementRate)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TopPosts({ model, images }: { model: ReportModel; images: ImageMap }) {
  if (!model.topPosts.length) return <View style={s.card}><Text style={s.muted}>{txt(model.labels.noPosts)}</Text></View>;
  const cw = Math.floor((CW - 24) / 3) - 1;
  const L = model.labels.table;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {model.topPosts.map((p, i) => {
        const img = p.thumbnailUrl ? images.get(p.thumbnailUrl) : undefined;
        return (
          <View key={p.id} wrap={false} style={[s.card, { width: cw, marginRight: i % 3 === 2 ? 0 : 12, marginBottom: 12, padding: 0, flexDirection: "row", height: 206 }]}>
            <View style={{ width: 110, height: 204, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, backgroundColor: shade(networkColor(p.network), 0.75), alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {img ? (
                <Image src={img.dataUri} style={{ width: 110, height: 204, objectFit: "cover" }} />
              ) : (
                <Text style={{ fontSize: 9, fontWeight: 600, color: networkColor(p.network) }}>{txt(p.formatLabel)}</Text>
              )}
              <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: THEME.ink, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 8, fontWeight: 800 }}>{`#${i + 1}`}</Text>
              </View>
            </View>
            <View style={{ flex: 1, padding: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                <NetworkDot network={p.network} size={8} />
                <Text style={{ marginLeft: 5, fontSize: 7.5, color: THEME.ink2 }}>{txt(`${p.networkLabel} · ${p.formatLabel} · ${p.dateLabel}`)}</Text>
              </View>
              <Text style={{ fontSize: 8.5, lineHeight: 1.35, height: 96, overflow: "hidden" }}>{txt(p.caption.slice(0, 190))}</Text>
              <View style={{ marginTop: "auto" }}>
                {[
                  [L.reach, p.display.reach],
                  [L.interactions, p.display.interactions],
                  [L.engagementRate, p.display.engagementRate],
                ].map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderTopWidth: 1, borderTopColor: THEME.line }}>
                    <Text style={{ fontSize: 7.5, color: THEME.ink3 }}>{txt(k)}</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>{txt(v)}</Text>
                  </View>
                ))}
                {p.permalink && (
                  <Link src={p.permalink} style={{ fontSize: 7, color: THEME.orbit, marginTop: 3, textDecoration: "none" }}>
                    {txt(p.permalink.replace(/^https?:\/\/(www\.)?/, "").slice(0, 42))}
                  </Link>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Insights({ model }: { model: ReportModel }) {
  return (
    <View style={s.card}>
      {model.insights.map((ins, i) => (
        <View key={i} style={{ flexDirection: "row", paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: THEME.line }} wrap={false}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i === model.insights.length - 1 ? THEME.accent : model.brand.color, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: 800 }}>{String(i + 1)}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 10.5, lineHeight: 1.45 }}>
            {ins.segments.map((sg, k) => (
              <Text key={k} style={sg.bold ? { fontWeight: 800, color: THEME.ink } : { color: THEME.ink2 }}>
                {txt(sg.text)}
              </Text>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ model, images }: { model: ReportModel; images: ImageMap }) {
  const body: Record<ReportSectionKey, () => ReactNode> = {
    summary: () => <Summary model={model} />,
    audience: () => <Audience model={model} />,
    reach: () => <Reach model={model} />,
    engagement: () => <Engagement model={model} />,
    formats: () => <Formats model={model} />,
    top: () => <TopPosts model={model} images={images} />,
    insights: () => <Insights model={model} />,
  };
  return (
    <Document title={pdfSafe(`${model.brand.name} — ${model.period.title} · ${model.period.label}`)} author={pdfSafe(model.agency.name ?? "Orbit")} creator="Orbit" producer="Orbit" language={model.lang}>
      <Cover model={model} images={images} />
      {model.sections.map((sec) => (
        <SectionPage key={sec} model={model} section={sec} images={images}>
          {body[sec]()}
        </SectionPage>
      ))}
    </Document>
  );
}

/** Rend le rapport en PDF (Buffer). Les images sont téléchargées si non fournies. */
export async function renderReportPdf(model: ReportModel, opts: { images?: ImageMap } = {}): Promise<Buffer> {
  registerFonts();
  const images = opts.images ?? (await loadReportImages(model));
  return renderToBuffer(<ReportDocument model={model} images={images} />);
}
