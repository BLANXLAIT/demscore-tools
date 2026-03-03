/**
 * Combined UCDP + VIEWS Conflict Intelligence Report
 *
 * Joins recent conflict events (UCDP, last 90 days) with forward-looking
 * fatality predictions (VIEWS, 36 months) to produce a trajectory analysis
 * showing which situations are escalating, stabilizing, or emerging.
 *
 * Usage:
 *   UCDP_TOKEN=your_token npx tsx demo/generate-combined-report.ts
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { UcdpClient } from "@demscore/ucdp";
import type { GedEventRaw } from "@demscore/ucdp";
import { ViewsClient } from "@demscore/views";

// ── Trajectory thresholds (named constants for tuning) ───

const ESCALATION_RATIO = 1.5;
const ESCALATION_MIN_PREDICTED = 5;
const DEESCALATION_RATIO = 1.5;
const DEESCALATION_MIN_RATE = 5;
const LATENT_RISK_DICH_THRESHOLD = 0.3;
const LATENT_RISK_MAX_DEATHS = 10;
const UNPREDICTED_DICH_THRESHOLD = 0.1;
const UNPREDICTED_MEAN_THRESHOLD = 5;
const EARLY_WARNING_DICH_THRESHOLD = 0.3;
const EARLY_WARNING_MAX_DEATHS = 5;

type Trajectory = "escalating" | "de-escalating" | "stable" | "latent-risk" | "unpredicted";

interface TrajectoryMeta {
    label: string;
    symbol: string;
    color: string;
}

const TRAJECTORY_META: Record<Trajectory, TrajectoryMeta> = {
    "escalating":     { label: "Escalating",     symbol: "\u2191", color: "#ef4444" },
    "de-escalating":  { label: "De-escalating",  symbol: "\u2193", color: "#10b981" },
    "stable":         { label: "Stable",         symbol: "\u2192", color: "#f59e0b" },
    "latent-risk":    { label: "Latent Risk",    symbol: "\u26a0", color: "#a855f7" },
    "unpredicted":    { label: "Unpredicted",    symbol: "?",      color: "#64748b" },
};

// ── Country centroids (ISO alpha-3 -> [lat, lon]) ────────

const CENTROIDS: Record<string, [number, number]> = {
    AFG: [33.9, 67.7], ALB: [41.2, 20.2], DZA: [28.0, 1.7], AGO: [-11.2, 17.9],
    ARG: [-38.4, -63.6], ARM: [40.1, 45.0], AUS: [-25.3, 133.8], AUT: [47.5, 14.6],
    AZE: [40.1, 47.6], BGD: [23.7, 90.4], BLR: [53.7, 27.9], BEL: [50.5, 4.5],
    BEN: [9.3, 2.3], BTN: [27.5, 90.4], BOL: [-16.3, -63.6], BIH: [43.9, 17.7],
    BWA: [-22.3, 24.7], BRA: [-14.2, -51.9], BRN: [4.5, 114.7], BGR: [42.7, 25.5],
    BFA: [12.2, -1.6], BDI: [-3.4, 29.9], KHM: [12.6, 105.0], CMR: [7.4, 12.4],
    CAN: [56.1, -106.3], CAF: [6.6, 20.9], TCD: [15.5, 18.7], CHL: [-35.7, -71.5],
    CHN: [35.9, 104.2], COL: [4.6, -74.3], COM: [-11.9, 43.9], COD: [-4.0, 21.8],
    COG: [-0.2, 15.8], CRI: [9.7, -83.8], CIV: [7.5, -5.5], HRV: [45.1, 15.2],
    CUB: [21.5, -77.8], CYP: [35.1, 33.4], CZE: [49.8, 15.5], DNK: [56.3, 9.5],
    DJI: [11.8, 42.6], DOM: [18.7, -70.2], ECU: [-1.8, -78.2], EGY: [26.8, 30.8],
    SLV: [13.8, -88.9], GNQ: [1.6, 10.3], ERI: [15.2, 39.8], EST: [58.6, 25.0],
    SWZ: [-26.5, 31.5], ETH: [9.1, 40.5], FIN: [61.9, 25.7], FRA: [46.2, 2.2],
    GAB: [-0.8, 11.6], GMB: [13.4, -15.3], GEO: [42.3, 43.4], DEU: [51.2, 10.5],
    GHA: [7.9, -1.0], GRC: [39.1, 21.8], GTM: [15.8, -90.2], GIN: [9.9, -11.4],
    GNB: [12.0, -15.2], GUY: [5.0, -59.0], HTI: [19.0, -72.3], HND: [15.2, -86.2],
    HUN: [47.2, 19.5], IND: [20.6, 79.0], IDN: [-0.8, 113.9], IRN: [32.4, 53.7],
    IRQ: [33.2, 43.7], IRL: [53.1, -8.2], ISR: [31.0, 34.9], ITA: [41.9, 12.6],
    JAM: [18.1, -77.3], JPN: [36.2, 138.3], JOR: [30.6, 36.2], KAZ: [48.0, 68.0],
    KEN: [-0.0, 37.9], PRK: [40.3, 127.5], KOR: [35.9, 128.0], KWT: [29.3, 47.5],
    KGZ: [41.2, 74.8], LAO: [19.9, 102.5], LVA: [56.9, 24.1], LBN: [33.9, 35.9],
    LSO: [-29.6, 28.2], LBR: [6.4, -9.4], LBY: [26.3, 17.2], LTU: [55.2, 23.9],
    MKD: [41.5, 21.7], MDG: [-18.8, 46.9], MWI: [-13.3, 34.3], MYS: [4.2, 101.9],
    MLI: [17.6, -4.0], MRT: [21.0, -10.9], MEX: [23.6, -102.6], MDA: [47.4, 28.4],
    MNG: [46.9, 103.8], MNE: [42.7, 19.4], MAR: [31.8, -7.1], MOZ: [-18.7, 35.5],
    MMR: [21.9, 96.0], NAM: [-22.1, 17.1], NPL: [28.4, 84.1], NLD: [52.1, 5.3],
    NZL: [-40.9, 174.9], NIC: [12.9, -85.2], NER: [17.6, 8.1], NGA: [9.1, 8.7],
    NOR: [60.5, 8.5], OMN: [21.5, 55.9], PAK: [30.4, 69.3], PAN: [8.5, -80.8],
    PNG: [-6.3, 143.9], PRY: [-23.4, -58.4], PER: [-9.2, -75.0], PHL: [12.9, 121.8],
    POL: [51.9, 19.1], PRT: [39.4, -8.2], QAT: [25.4, 51.2], ROU: [45.9, 25.0],
    RUS: [61.5, 105.3], RWA: [-1.9, 29.9], SAU: [23.9, 45.1], SEN: [14.5, -14.5],
    SRB: [44.0, 21.0], SLE: [8.5, -11.8], SGP: [1.4, 103.8], SVK: [48.7, 19.7],
    SVN: [46.2, 15.0], SOM: [5.2, 46.2], ZAF: [-30.6, 22.9], ESP: [40.5, -3.7],
    LKA: [7.9, 80.8], SDN: [12.9, 30.2], SUR: [3.9, -56.0], SWE: [60.1, 18.6],
    CHE: [46.8, 8.2], SYR: [35.0, 38.5], TWN: [23.7, 121.0], TJK: [38.9, 71.3],
    TZA: [-6.4, 34.9], THA: [15.9, 100.9], TLS: [-8.9, 126.0], TGO: [8.6, 1.2],
    TTO: [10.7, -61.2], TUN: [33.9, 9.5], TUR: [39.0, 35.2], TKM: [39.0, 59.6],
    UGA: [1.4, 32.3], UKR: [48.4, 31.2], ARE: [23.4, 53.8], GBR: [55.4, -3.4],
    USA: [37.1, -95.7], URY: [-32.5, -55.8], UZB: [41.4, 64.6], VEN: [6.4, -66.6],
    VNM: [14.1, 108.3], YEM: [15.6, 48.5], ZMB: [-13.1, 27.8], ZWE: [-19.0, 29.2],
    SSD: [6.9, 31.3], PSE: [31.9, 35.2], XKX: [42.6, 20.9],
};

// ── GW code → ISO mapping (built from VIEWS data) ───────

const GW_TO_ISO: Record<number, string> = {
    700: "AFG", 339: "ALB", 615: "DZA", 540: "AGO", 160: "ARG", 371: "ARM",
    900: "AUS", 305: "AUT", 373: "AZE", 771: "BGD", 370: "BLR", 211: "BEL",
    434: "BEN", 760: "BTN", 145: "BOL", 346: "BIH", 571: "BWA", 140: "BRA",
    835: "BRN", 355: "BGR", 439: "BFA", 516: "BDI", 811: "KHM", 471: "CMR",
    20: "CAN", 482: "CAF", 483: "TCD", 155: "CHL", 710: "CHN", 100: "COL",
    581: "COD", 484: "COG", 94: "CRI", 437: "CIV", 344: "HRV", 40: "CUB",
    352: "CYP", 316: "CZE", 390: "DNK", 522: "DJI", 42: "DOM", 130: "ECU",
    651: "EGY", 92: "SLV", 411: "GNQ", 531: "ERI", 366: "EST", 572: "SWZ",
    530: "ETH", 375: "FIN", 220: "FRA", 481: "GAB", 420: "GMB", 372: "GEO",
    255: "DEU", 452: "GHA", 350: "GRC", 90: "GTM", 438: "GIN", 404: "GNB",
    110: "GUY", 41: "HTI", 91: "HND", 310: "HUN", 750: "IND", 850: "IDN",
    630: "IRN", 645: "IRQ", 205: "IRL", 666: "ISR", 325: "ITA", 51: "JAM",
    740: "JPN", 663: "JOR", 705: "KAZ", 501: "KEN", 731: "PRK", 732: "KOR",
    690: "KWT", 703: "KGZ", 812: "LAO", 367: "LVA", 660: "LBN", 570: "LSO",
    450: "LBR", 620: "LBY", 368: "LTU", 343: "MKD", 580: "MDG", 553: "MWI",
    820: "MYS", 432: "MLI", 435: "MRT", 70: "MEX", 359: "MDA", 712: "MNG",
    341: "MNE", 600: "MAR", 541: "MOZ", 775: "MMR", 565: "NAM", 790: "NPL",
    210: "NLD", 920: "NZL", 93: "NIC", 436: "NER", 475: "NGA", 385: "NOR",
    698: "OMN", 770: "PAK", 95: "PAN", 910: "PNG", 150: "PRY", 135: "PER",
    840: "PHL", 290: "POL", 235: "PRT", 694: "QAT", 360: "ROU", 365: "RUS",
    517: "RWA", 670: "SAU", 433: "SEN", 345: "SRB", 451: "SLE", 830: "SGP",
    317: "SVK", 349: "SVN", 520: "SOM", 560: "ZAF", 230: "ESP", 780: "LKA",
    625: "SDN", 115: "SUR", 380: "SWE", 225: "CHE", 652: "SYR", 713: "TWN",
    702: "TJK", 510: "TZA", 800: "THA", 860: "TLS", 461: "TGO", 52: "TTO",
    616: "TUN", 640: "TUR", 701: "TKM", 500: "UGA", 369: "UKR", 696: "ARE",
    200: "GBR", 2: "USA", 165: "URY", 704: "UZB", 101: "VEN", 816: "VNM",
    679: "YEM", 551: "ZMB", 552: "ZWE", 626: "SSD", 6667: "PSE",
};

// ── Section A: Token validation and client setup ─────────

const token = process.env.UCDP_TOKEN;
if (!token) {
    console.error(
        "Missing UCDP_TOKEN environment variable.\n\n" +
        "Usage:\n" +
        "  UCDP_TOKEN=your_token npx tsx demo/generate-combined-report.ts\n\n" +
        "Get a token at: https://ucdp.uu.se/apidocs/",
    );
    process.exit(1);
}

const DAYS_90 = 90;
const MONTHS_IN_90D = DAYS_90 / 30.44; // ~2.957

const now = new Date();
const startDate = new Date(now.getTime() - DAYS_90 * 24 * 60 * 60 * 1000);
const startDateStr = startDate.toISOString().slice(0, 10);

const ucdpClient = new UcdpClient({ token });
const viewsClient = new ViewsClient();

async function main() {

// ── Section B: Fetch and aggregate data ──────────────────

// B1: Fetch UCDP events (state-based only, last 90 days)
console.log(`Fetching UCDP state-based events since ${startDateStr}...`);

const events: GedEventRaw[] = [];
for await (const event of ucdpClient.getCandidateEventsAll({
    StartDate: startDateStr,
    TypeOfViolence: 1,
})) {
    events.push(event);
}

console.log(`Fetched ${events.length} UCDP events.`);

// B2: Fetch VIEWS forecasts
console.log("Discovering latest VIEWS model run...");

const runs = await viewsClient.getRuns();
const latestRun = runs
    .filter((r: string) => r.startsWith("fatalities"))
    .sort()
    .pop();

if (!latestRun) {
    console.error("Could not find a VIEWS fatalities model run.");
    process.exit(1);
}

console.log(`Using VIEWS run: ${latestRun}`);
console.log("Fetching country-month state-based predictions...");

const viewsResponse = await viewsClient.queryByViolence("cm", "sb", {
    run: latestRun,
    pagesize: 10000,
});

const viewsRows = viewsResponse.data;
console.log(`Fetched ${viewsRows.length} VIEWS country-month rows.`);

// B3: Aggregate UCDP by GW code
interface UcdpAgg {
    gwcode: number;
    country: string;
    deaths: number;
    events: number;
    monthlyRate: number;
}

const ucdpByGw = new Map<number, UcdpAgg>();
for (const e of events) {
    // gwnoa can be CSV like "520,521" — take the first
    const gwStr = String(e.gwnoa).split(",")[0].trim();
    const gw = parseInt(gwStr, 10);
    if (isNaN(gw)) continue;

    const existing = ucdpByGw.get(gw);
    if (existing) {
        existing.deaths += e.best;
        existing.events++;
    } else {
        ucdpByGw.set(gw, {
            gwcode: gw,
            country: e.country,
            deaths: e.best,
            events: 1,
            monthlyRate: 0,
        });
    }
}
for (const agg of ucdpByGw.values()) {
    agg.monthlyRate = agg.deaths / MONTHS_IN_90D;
}

// B4: Aggregate VIEWS by GW code
interface ViewsAgg {
    gwcode: number;
    name: string;
    isoab: string;
    nearestMean: number;
    nearestDich: number;
    maxMean: number;
}

const minMonth = Math.min(...viewsRows.map((r: Record<string, unknown>) => r.month_id as number));
const allMonths = [...new Set(viewsRows.map((r: Record<string, unknown>) => r.month_id as number))].sort((a, b) => a - b);
const lastMonthId = allMonths[allMonths.length - 1];
const sampleFirst = viewsRows.find((r: Record<string, unknown>) => r.month_id === minMonth) as Record<string, unknown>;
const sampleLast = viewsRows.find((r: Record<string, unknown>) => r.month_id === lastMonthId) as Record<string, unknown>;

const forecastPeriod = `${sampleFirst.year}-${String(sampleFirst.month).padStart(2, "0")} to ${sampleLast.year}-${String(sampleLast.month).padStart(2, "0")}`;

const viewsByGw = new Map<number, ViewsAgg>();
for (const row of viewsRows) {
    const r = row as Record<string, unknown>;
    const gw = r.gwcode as number;
    const mainMean = (r.main_mean as number) ?? 0;
    const mainDich = (r.main_dich as number) ?? 0;
    const monthId = r.month_id as number;

    const existing = viewsByGw.get(gw);
    if (!existing) {
        viewsByGw.set(gw, {
            gwcode: gw,
            name: r.name as string,
            isoab: r.isoab as string,
            nearestMean: monthId === minMonth ? mainMean : 0,
            nearestDich: monthId === minMonth ? mainDich : 0,
            maxMean: mainMean,
        });
    } else {
        existing.maxMean = Math.max(existing.maxMean, mainMean);
        if (monthId === minMonth) {
            existing.nearestMean = mainMean;
            existing.nearestDich = mainDich;
        }
    }
}

// B5: Join on GW code and classify trajectory
interface JoinedCountry {
    gwcode: number;
    country: string;
    isoab: string;
    recentDeaths: number;
    recentEvents: number;
    monthlyRate: number;
    predictedFatalities: number;
    conflictProb: number;
    maxMean: number;
    trajectory: Trajectory;
}

function classify(ucdp: UcdpAgg | undefined, views: ViewsAgg | undefined): Trajectory {
    const rate = ucdp?.monthlyRate ?? 0;
    const deaths = ucdp?.deaths ?? 0;
    const predicted = views?.nearestMean ?? 0;
    const dich = views?.nearestDich ?? 0;

    // Latent risk: high probability but minimal recent activity
    if (dich > LATENT_RISK_DICH_THRESHOLD && deaths < LATENT_RISK_MAX_DEATHS) {
        return "latent-risk";
    }

    // Unpredicted: recent deaths but model doesn't see it
    if (deaths > 0 && dich < UNPREDICTED_DICH_THRESHOLD && predicted < UNPREDICTED_MEAN_THRESHOLD) {
        return "unpredicted";
    }

    // Escalating: prediction significantly exceeds recent rate
    if (predicted > rate * ESCALATION_RATIO && predicted > ESCALATION_MIN_PREDICTED) {
        return "escalating";
    }

    // De-escalating: recent rate significantly exceeds prediction
    if (rate > predicted * DEESCALATION_RATIO && rate > DEESCALATION_MIN_RATE) {
        return "de-escalating";
    }

    return "stable";
}

// Collect all GW codes from both sources
const allGwCodes = new Set([...ucdpByGw.keys(), ...viewsByGw.keys()]);
const joined: JoinedCountry[] = [];

for (const gw of allGwCodes) {
    const ucdp = ucdpByGw.get(gw);
    const views = viewsByGw.get(gw);

    // Skip countries with zero activity on both sides
    const deaths = ucdp?.deaths ?? 0;
    const predicted = views?.nearestMean ?? 0;
    const dich = views?.nearestDich ?? 0;
    if (deaths === 0 && predicted < 1 && dich < LATENT_RISK_DICH_THRESHOLD) continue;

    const iso = views?.isoab ?? GW_TO_ISO[gw] ?? "";
    const name = views?.name ?? ucdp?.country ?? `GW-${gw}`;

    joined.push({
        gwcode: gw,
        country: name,
        isoab: iso,
        recentDeaths: deaths,
        recentEvents: ucdp?.events ?? 0,
        monthlyRate: ucdp?.monthlyRate ?? 0,
        predictedFatalities: Math.round(predicted * 100) / 100,
        conflictProb: Math.round((dich) * 10000) / 100,
        maxMean: Math.round((views?.maxMean ?? 0) * 100) / 100,
        trajectory: classify(ucdp, views),
    });
}

// Sort by combined signal: max of deaths and predicted
joined.sort((a, b) => {
    const sigA = Math.max(a.recentDeaths, a.predictedFatalities);
    const sigB = Math.max(b.recentDeaths, b.predictedFatalities);
    return sigB - sigA;
});

// Stats
const totalEvents = events.length;
const totalDeaths = events.reduce((sum, e) => sum + e.best, 0);
const highRiskCount = joined.filter((c) => c.conflictProb > 50).length;
const escalatingCount = joined.filter((c) => c.trajectory === "escalating").length;

const dates = events.map((e) => e.date_start).sort();
const ucdpDateRange = events.length > 0
    ? `${dates[0]} to ${dates[dates.length - 1]}`
    : `${startDateStr} to ${now.toISOString().slice(0, 10)}`;

// Early warnings: high VIEWS probability but zero/minimal UCDP events
const earlyWarnings = joined
    .filter((c) => c.conflictProb > EARLY_WARNING_DICH_THRESHOLD * 100 && c.recentDeaths <= EARLY_WARNING_MAX_DEATHS)
    .sort((a, b) => b.conflictProb - a.conflictProb)
    .slice(0, 12);

const top15 = joined.slice(0, 15);
const top30 = joined.slice(0, 30);

// Map markers
const mapMarkers = joined
    .filter((c) => CENTROIDS[c.isoab])
    .map((c) => ({
        lat: CENTROIDS[c.isoab][0],
        lon: CENTROIDS[c.isoab][1],
        name: c.country,
        iso: c.isoab,
        deaths: c.recentDeaths,
        predicted: c.predictedFatalities,
        prob: c.conflictProb,
        trajectory: c.trajectory,
        signal: Math.max(c.recentDeaths, c.predictedFatalities),
    }));

console.log(`Joined ${joined.length} countries. Escalating: ${escalatingCount}, High-risk: ${highRiskCount}`);

// ── Section C: Generate HTML ─────────────────────────────

const reportData = {
    generated: now.toISOString(),
    ucdpDateRange,
    viewsRun: latestRun,
    forecastPeriod,
    totalEvents,
    totalDeaths,
    highRiskCount,
    escalatingCount,
    top15: top15.map((c) => ({
        name: c.country,
        deaths: c.recentDeaths,
        predicted: c.predictedFatalities,
        trajectory: c.trajectory,
    })),
    top30: top30.map((c) => ({
        name: c.country,
        iso: c.isoab,
        deaths: c.recentDeaths,
        events: c.recentEvents,
        rate: Math.round(c.monthlyRate * 10) / 10,
        predicted: c.predictedFatalities,
        prob: c.conflictProb,
        trajectory: c.trajectory,
    })),
    earlyWarnings: earlyWarnings.map((c) => ({
        name: c.country,
        iso: c.isoab,
        prob: c.conflictProb,
        deaths: c.recentDeaths,
    })),
    markers: mapMarkers,
    trajectoryMeta: TRAJECTORY_META,
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conflict Intelligence Brief</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --bg-card: rgba(255, 255, 255, 0.04);
    --bg-card-hover: rgba(255, 255, 255, 0.07);
    --border: rgba(255, 255, 255, 0.08);
    --text: #e2e8f0;
    --text-dim: #94a3b8;
    --text-bright: #f8fafc;
    --accent: #3b82f6;
    --red: #ef4444;
    --amber: #f59e0b;
    --green: #10b981;
    --purple: #a855f7;
    --grey: #64748b;
    --radius: 12px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.6; min-height: 100vh; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

  header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border); }
  header h1 { font-size: 1.75rem; font-weight: 600; color: var(--text-bright); margin-bottom: 0.5rem; letter-spacing: -0.02em; }
  header p { color: var(--text-dim); font-size: 0.875rem; line-height: 1.6; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
  .stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; backdrop-filter: blur(12px); text-align: center; }
  .stat-card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 0.25rem; }
  .stat-card .value { font-size: 1.75rem; font-weight: 700; color: var(--text-bright); font-variant-numeric: tabular-nums; }
  .stat-card .sub { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.25rem; }

  .section-title { font-size: 1.1rem; font-weight: 600; color: var(--text-bright); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .section-title::before { content: ''; width: 3px; height: 1.1em; background: var(--accent); border-radius: 2px; }

  .map-section { margin-bottom: 2.5rem; }
  #map { height: 420px; border-radius: var(--radius); border: 1px solid var(--border); z-index: 1; }

  .legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; justify-content: center; }
  .legend-item { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: var(--text-dim); }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }

  .chart-section { margin-bottom: 2.5rem; }
  .chart-legend { display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-dim); }
  .chart-legend-item { display: flex; align-items: center; gap: 0.35rem; }
  .chart-legend-swatch { width: 12px; height: 12px; border-radius: 2px; }
  .dual-bar-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .dual-bar-label { width: 140px; font-size: 0.8rem; color: var(--text); text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dual-bar-track { flex: 1; display: flex; gap: 2px; height: 22px; }
  .dual-bar-fill { height: 100%; border-radius: 3px; min-width: 0; }
  .dual-bar-value { width: 120px; font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono); font-variant-numeric: tabular-nums; flex-shrink: 0; }

  .table-section { margin-bottom: 2.5rem; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  thead th { text-align: left; padding: 0.75rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); border-bottom: 1px solid var(--border); font-weight: 600; }
  tbody td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody tr:hover { background: var(--bg-card-hover); }
  .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }

  .warnings-section { margin-bottom: 2.5rem; }
  .warning-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
  .warning-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; border-left: 3px solid var(--purple); }
  .warning-card .country-name { font-weight: 600; color: var(--text-bright); margin-bottom: 0.5rem; }
  .warning-card .prob-value { font-size: 2rem; font-weight: 700; color: var(--purple); font-variant-numeric: tabular-nums; }
  .warning-card .prob-label { font-size: 0.75rem; color: var(--text-dim); }
  .warning-card .note { font-size: 0.75rem; color: var(--text-dim); margin-top: 0.5rem; }

  .footer { text-align: center; padding-top: 2rem; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 0.8rem; line-height: 1.8; }
  .footer a { color: var(--accent); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .footer .citations { margin-top: 1rem; font-size: 0.7rem; color: #64748b; max-width: 750px; margin-left: auto; margin-right: auto; text-align: left; }
  .footer .citations p { margin-bottom: 0.4rem; }

  .leaflet-popup-content-wrapper { background: #1e293b !important; color: #e2e8f0 !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
  .leaflet-popup-tip { background: #1e293b !important; }
  .leaflet-popup-content { font-family: var(--font); font-size: 0.8rem; line-height: 1.5; margin: 10px 14px; }
</style>
</head>
<body>
<div class="container">

  <header>
    <h1>Conflict Intelligence Brief</h1>
    <p id="subtitle"></p>
  </header>

  <div id="stats" class="stats"></div>

  <div class="map-section">
    <div class="section-title">Risk Map</div>
    <div id="map"></div>
    <div class="legend" id="legend"></div>
  </div>

  <div class="chart-section">
    <div class="section-title">Actual vs. Predicted Fatalities (Top 15)</div>
    <div class="chart-legend" id="chart-legend"></div>
    <div id="dual-bar-chart"></div>
  </div>

  <div class="table-section">
    <div class="section-title">Trajectory Analysis (Top 30)</div>
    <table>
      <thead>
        <tr>
          <th>Country</th>
          <th>ISO</th>
          <th>Deaths (90d)</th>
          <th>Monthly Rate</th>
          <th>Predicted</th>
          <th>Prob %</th>
          <th>Trajectory</th>
        </tr>
      </thead>
      <tbody id="trajectory-body"></tbody>
    </table>
  </div>

  <div class="warnings-section" id="warnings-section">
    <div class="section-title">Early Warnings</div>
    <div class="warning-grid" id="warning-grid"></div>
  </div>

  <div class="footer">
    Generated by
    <a href="https://github.com/blanxlait/demscore-tools" target="_blank">@demscore/ucdp</a> +
    <a href="https://github.com/blanxlait/demscore-tools" target="_blank">@demscore/views</a> SDKs
    &middot;
    UCDP data from <a href="https://ucdp.uu.se" target="_blank">Uppsala Conflict Data Program</a>
    &middot;
    VIEWS data from <a href="https://viewsforecasting.org" target="_blank">VIEWS Forecasting</a> (PRIO)

    <div class="citations">
      <p><strong>UCDP citations:</strong></p>
      <p>Hegre, H&aring;vard, Mihai Croicu, Kristine Eck, and Stina H&ouml;gbladh (2020). Introducing the UCDP Candidate Events Dataset. <em>Research &amp; Politics</em>.</p>
      <p>Davies, S., Pettersson, T., Sollenberg, M., &amp; &Ouml;berg, M. (2025). Organized violence 1989&ndash;2024, and the challenges of identifying civilian victims. <em>Journal of Peace Research</em>, 62(4).</p>
      <p>Sundberg, Ralph and Erik Melander (2013). Introducing the UCDP Georeferenced Event Dataset. <em>Journal of Peace Research</em> 50(4).</p>
      <p>UCDP is part of and funded by <a href="https://demscore.com" target="_blank">DEMSCORE</a>, national research infrastructure grant 2021-00162 from the Swedish Research Council.</p>
      <p style="margin-top: 0.75rem"><strong>VIEWS:</strong></p>
      <p>The Violence &amp; Impacts Early-Warning System (VIEWS) is developed by the Department of Peace and Conflict Research, Uppsala University, and the Peace Research Institute Oslo (PRIO). VIEWS data is open access. See <a href="https://viewsforecasting.org" target="_blank">viewsforecasting.org</a> for methodology.</p>
    </div>
  </div>

</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
var DATA = ${JSON.stringify(reportData).replace(/</g, "\\u003c")};
var TMETA = DATA.trajectoryMeta;

// Subtitle
document.getElementById('subtitle').textContent =
    'UCDP: ' + DATA.ucdpDateRange +
    ' \\u2022 VIEWS run: ' + DATA.viewsRun +
    ' (' + DATA.forecastPeriod + ')' +
    ' \\u2022 Generated ' + new Date(DATA.generated).toLocaleDateString();

// Stats
(function() {
    var container = document.getElementById('stats');
    var cards = [
        { label: 'Events (90d)', value: DATA.totalEvents.toLocaleString(), sub: 'state-based' },
        { label: 'Fatalities (90d)', value: DATA.totalDeaths.toLocaleString(), sub: 'UCDP best estimate' },
        { label: 'High-Risk Forecasts', value: DATA.highRiskCount, sub: 'prob > 50%' },
        { label: 'Escalating', value: DATA.escalatingCount, sub: 'prediction exceeds recent rate' },
    ];
    cards.forEach(function(c) {
        var card = document.createElement('div');
        card.className = 'stat-card';
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = c.label;
        var val = document.createElement('div');
        val.className = 'value';
        val.textContent = typeof c.value === 'number' ? c.value.toLocaleString() : c.value;
        card.appendChild(label);
        card.appendChild(val);
        if (c.sub) {
            var sub = document.createElement('div');
            sub.className = 'sub';
            sub.textContent = c.sub;
            card.appendChild(sub);
        }
        container.appendChild(card);
    });
})();

// Legend
(function() {
    var container = document.getElementById('legend');
    var items = ['escalating', 'de-escalating', 'stable', 'latent-risk', 'unpredicted'];
    items.forEach(function(key) {
        var meta = TMETA[key];
        var item = document.createElement('div');
        item.className = 'legend-item';
        var dot = document.createElement('div');
        dot.className = 'legend-dot';
        dot.style.background = meta.color;
        item.appendChild(dot);
        item.appendChild(document.createTextNode(meta.symbol + ' ' + meta.label));
        container.appendChild(item);
    });
})();

// Map
(function() {
    var map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView([15, 20], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '\\u00a9 OpenStreetMap contributors \\u00a9 CARTO',
        maxZoom: 18,
    }).addTo(map);

    var maxSig = 1;
    DATA.markers.forEach(function(m) { if (m.signal > maxSig) maxSig = m.signal; });

    DATA.markers.forEach(function(m) {
        var meta = TMETA[m.trajectory];
        var radius = Math.max(4, Math.min(22, Math.sqrt(m.signal) * 2));
        var color = meta.color;

        var popupEl = document.createElement('div');
        var title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.color = '#f8fafc';
        title.textContent = m.name + ' (' + m.iso + ')';
        popupEl.appendChild(title);

        var details = document.createElement('div');
        details.style.color = '#94a3b8';
        details.style.fontSize = '0.75rem';
        details.style.marginTop = '4px';

        var lines = [
            'Deaths (90d): ' + m.deaths,
            'Predicted fatalities: ' + m.predicted,
            'Conflict probability: ' + m.prob.toFixed(0) + '%',
            'Trajectory: ' + meta.symbol + ' ' + meta.label,
        ];
        lines.forEach(function(line, i) {
            if (i > 0) details.appendChild(document.createElement('br'));
            details.appendChild(document.createTextNode(line));
        });
        popupEl.appendChild(details);

        L.circleMarker([m.lat, m.lon], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            weight: 1,
        }).bindPopup(popupEl).addTo(map);
    });
})();

// Dual bar chart
(function() {
    var legendContainer = document.getElementById('chart-legend');
    var legendItems = [
        { label: 'UCDP Deaths (90d)', color: '#3b82f6' },
        { label: 'VIEWS Predicted', color: '#f59e0b' },
    ];
    legendItems.forEach(function(item) {
        var el = document.createElement('div');
        el.className = 'chart-legend-item';
        var swatch = document.createElement('div');
        swatch.className = 'chart-legend-swatch';
        swatch.style.background = item.color;
        el.appendChild(swatch);
        el.appendChild(document.createTextNode(item.label));
        legendContainer.appendChild(el);
    });

    var container = document.getElementById('dual-bar-chart');
    var maxVal = 1;
    DATA.top15.forEach(function(c) {
        var m = Math.max(c.deaths, c.predicted);
        if (m > maxVal) maxVal = m;
    });

    DATA.top15.forEach(function(c) {
        var row = document.createElement('div');
        row.className = 'dual-bar-row';

        var label = document.createElement('div');
        label.className = 'dual-bar-label';
        label.textContent = c.name;
        label.title = c.name;
        row.appendChild(label);

        var track = document.createElement('div');
        track.className = 'dual-bar-track';

        var fill1 = document.createElement('div');
        fill1.className = 'dual-bar-fill';
        fill1.style.width = (c.deaths / maxVal * 50).toFixed(1) + '%';
        fill1.style.background = '#3b82f6';
        track.appendChild(fill1);

        var fill2 = document.createElement('div');
        fill2.className = 'dual-bar-fill';
        fill2.style.width = (c.predicted / maxVal * 50).toFixed(1) + '%';
        fill2.style.background = '#f59e0b';
        track.appendChild(fill2);

        row.appendChild(track);

        var val = document.createElement('div');
        val.className = 'dual-bar-value';
        val.textContent = c.deaths + ' / ' + c.predicted.toFixed(1);
        row.appendChild(val);

        container.appendChild(row);
    });
})();

// Trajectory table
(function() {
    var tbody = document.getElementById('trajectory-body');
    DATA.top30.forEach(function(c) {
        var tr = document.createElement('tr');
        var meta = TMETA[c.trajectory];

        var td1 = document.createElement('td');
        td1.textContent = c.name;
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        td2.className = 'mono';
        td2.textContent = c.iso;
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        td3.className = 'mono';
        td3.textContent = c.deaths.toLocaleString();
        if (c.deaths > 100) td3.style.color = 'var(--red)';
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.className = 'mono';
        td4.textContent = c.rate.toFixed(1);
        tr.appendChild(td4);

        var td5 = document.createElement('td');
        td5.className = 'mono';
        td5.textContent = c.predicted.toFixed(1);
        if (c.predicted > 50) td5.style.color = 'var(--red)';
        else if (c.predicted > 10) td5.style.color = 'var(--amber)';
        tr.appendChild(td5);

        var td6 = document.createElement('td');
        td6.className = 'mono';
        td6.textContent = c.prob.toFixed(0) + '%';
        if (c.prob > 50) td6.style.color = 'var(--red)';
        else if (c.prob > 20) td6.style.color = 'var(--amber)';
        tr.appendChild(td6);

        var td7 = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.background = meta.color + '22';
        badge.style.color = meta.color;
        badge.textContent = meta.symbol + ' ' + meta.label;
        td7.appendChild(badge);
        tr.appendChild(td7);

        tbody.appendChild(tr);
    });
})();

// Early warnings
(function() {
    var section = document.getElementById('warnings-section');
    if (DATA.earlyWarnings.length === 0) {
        section.style.display = 'none';
        return;
    }

    var grid = document.getElementById('warning-grid');
    DATA.earlyWarnings.forEach(function(c) {
        var card = document.createElement('div');
        card.className = 'warning-card';

        var name = document.createElement('div');
        name.className = 'country-name';
        name.textContent = c.name + ' (' + c.iso + ')';
        card.appendChild(name);

        var prob = document.createElement('div');
        prob.className = 'prob-value';
        prob.textContent = c.prob.toFixed(0) + '%';
        card.appendChild(prob);

        var probLabel = document.createElement('div');
        probLabel.className = 'prob-label';
        probLabel.textContent = 'conflict probability';
        card.appendChild(probLabel);

        var note = document.createElement('div');
        note.className = 'note';
        note.textContent = c.deaths === 0
            ? '0 recent events'
            : c.deaths + ' deaths in 90 days';
        card.appendChild(note);

        grid.appendChild(card);
    });
})();
<\/script>
</body>
</html>`;

// ── Section D: Write file and open browser ───────────────

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDir, "combined-report.html");

writeFileSync(outputPath, html, "utf-8");
console.log(`Report written to ${outputPath}`);

const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
try {
    execFileSync(openCmd, [outputPath]);
} catch {
    console.log(`Could not open browser automatically. Open ${outputPath} manually.`);
}

} // end main

main();
