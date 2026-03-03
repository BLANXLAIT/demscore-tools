/**
 * VIEWS Conflict Forecast Report Generator
 *
 * Fetches country-level conflict predictions from the VIEWS Forecasting API
 * and generates a self-contained HTML report with interactive map,
 * risk rankings, and forecast table.
 *
 * Usage:
 *   npx tsx demo/generate-views-report.ts
 *
 * No API token required — VIEWS is open access.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ViewsClient } from "@demscore/views";

// ── Section A: Client setup and run discovery ────────────────

const client = new ViewsClient();

async function main() {

console.log("Discovering latest VIEWS model run...");

const runs = await client.getRuns();
const latestRun = runs
    .filter((r: string) => r.startsWith("fatalities"))
    .sort()
    .pop();

if (!latestRun) {
    console.error("Could not find a fatalities model run.");
    process.exit(1);
}

console.log(`Using run: ${latestRun}`);

// ── Section B: Fetch and aggregate data ─────────────────────

console.log("Fetching country-month state-based conflict predictions...");

const response = await client.queryByViolence("cm", "sb", {
    run: latestRun,
    pagesize: 10000,
});

const rows = response.data;
console.log(`Fetched ${rows.length} country-month rows.`);

if (rows.length === 0) {
    console.log("No data returned. Exiting.");
    process.exit(0);
}

// Find the nearest forecast month (minimum month_id)
const minMonth = Math.min(...rows.map((r: Record<string, unknown>) => r.month_id as number));
const nearestRows = rows.filter((r: Record<string, unknown>) => r.month_id === minMonth);

// Extract forecast period info
const sampleRow = nearestRows[0] as Record<string, unknown>;
const forecastYear = sampleRow.year as number;
const forecastMonth = sampleRow.month as number;

// All unique months in the dataset
const allMonths = [...new Set(rows.map((r: Record<string, unknown>) => r.month_id as number))].sort((a, b) => a - b);
const lastMonth = allMonths[allMonths.length - 1];
const lastRow = rows.find((r: Record<string, unknown>) => r.month_id === lastMonth) as Record<string, unknown>;
const lastYear = lastRow.year as number;
const lastMo = lastRow.month as number;

// Aggregate: for each country, take the max main_mean across all forecast months
const countryMap = new Map<string, {
    name: string;
    isoab: string;
    gwcode: number;
    maxMean: number;
    nearestMean: number;
    nearestDich: number;
    forecastMonths: number;
}>();

for (const row of rows) {
    const r = row as Record<string, unknown>;
    const iso = r.isoab as string;
    const mainMean = (r.main_mean as number) ?? 0;
    const mainDich = (r.main_dich as number) ?? 0;
    const monthId = r.month_id as number;

    const existing = countryMap.get(iso);
    if (!existing) {
        countryMap.set(iso, {
            name: r.name as string,
            isoab: iso,
            gwcode: r.gwcode as number,
            maxMean: mainMean,
            nearestMean: monthId === minMonth ? mainMean : 0,
            nearestDich: monthId === minMonth ? mainDich : 0,
            forecastMonths: 1,
        });
    } else {
        existing.maxMean = Math.max(existing.maxMean, mainMean);
        existing.forecastMonths++;
        if (monthId === minMonth) {
            existing.nearestMean = mainMean;
            existing.nearestDich = mainDich;
        }
    }
}

const countries = [...countryMap.values()].sort((a, b) => b.maxMean - a.maxMean);
const highRiskCount = countries.filter((c) => c.nearestDich > 0.5).length;
const topCountries = countries.slice(0, 20);
const tableCountries = countries.slice(0, 30);
const uniqueCountries = countries.length;
const forecastMonthCount = allMonths.length;

// Country centroids for map (ISO alpha-3 → [lat, lon])
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

// Build map markers
const markers = countries
    .filter((c) => CENTROIDS[c.isoab])
    .map((c) => ({
        lat: CENTROIDS[c.isoab][0],
        lon: CENTROIDS[c.isoab][1],
        name: c.name,
        iso: c.isoab,
        mean: Math.round(c.maxMean * 100) / 100,
        dich: Math.round(c.nearestDich * 100) / 100,
    }));

// ── Section C: Generate HTML ────────────────────────────────

const reportData = {
    generated: new Date().toISOString(),
    run: latestRun,
    forecastPeriod: `${forecastYear}-${String(forecastMonth).padStart(2, "0")} to ${lastYear}-${String(lastMo).padStart(2, "0")}`,
    uniqueCountries,
    forecastMonthCount,
    highRiskCount,
    topCountries: topCountries.map((c) => ({
        name: c.name,
        iso: c.isoab,
        maxMean: Math.round(c.maxMean * 100) / 100,
    })),
    tableCountries: tableCountries.map((c) => ({
        name: c.name,
        iso: c.isoab,
        maxMean: Math.round(c.maxMean * 100) / 100,
        nearestMean: Math.round(c.nearestMean * 100) / 100,
        nearestDich: Math.round(c.nearestDich * 100) / 100,
    })),
    markers,
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VIEWS Conflict Forecast Report</title>
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
    --radius: 12px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.6; min-height: 100vh; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

  header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border); }
  header h1 { font-size: 1.75rem; font-weight: 600; color: var(--text-bright); margin-bottom: 0.5rem; letter-spacing: -0.02em; }
  header p { color: var(--text-dim); font-size: 0.875rem; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
  .stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; backdrop-filter: blur(12px); }
  .stat-card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 0.25rem; }
  .stat-card .value { font-size: 1.75rem; font-weight: 700; color: var(--text-bright); font-variant-numeric: tabular-nums; }
  .stat-card .sub { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.25rem; }

  .section-title { font-size: 1.1rem; font-weight: 600; color: var(--text-bright); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .section-title::before { content: ''; width: 3px; height: 1.1em; background: var(--accent); border-radius: 2px; }

  .map-section { margin-bottom: 2.5rem; }
  #map { height: 420px; border-radius: var(--radius); border: 1px solid var(--border); z-index: 1; }

  .chart-section { margin-bottom: 2.5rem; }
  .bar-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .bar-label { width: 160px; font-size: 0.85rem; color: var(--text); text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 24px; background: var(--bg-card); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
  .bar-value { width: 80px; font-size: 0.8rem; color: var(--text-dim); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .table-section { margin-bottom: 2.5rem; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  thead th { text-align: left; padding: 0.75rem 1rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); border-bottom: 1px solid var(--border); font-weight: 600; }
  tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  tbody tr:hover { background: var(--bg-card-hover); }
  .risk-high { color: var(--red); font-weight: 700; }
  .risk-medium { color: var(--amber); font-weight: 600; }
  .risk-low { color: var(--green); }
  .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .footer { text-align: center; padding-top: 2rem; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 0.8rem; line-height: 1.8; }
  .footer a { color: var(--accent); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .footer .citations { margin-top: 1rem; font-size: 0.7rem; color: #64748b; max-width: 700px; margin-left: auto; margin-right: auto; text-align: left; }
  .footer .citations p { margin-bottom: 0.4rem; }

  .leaflet-popup-content-wrapper { background: #1e293b !important; color: #e2e8f0 !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
  .leaflet-popup-tip { background: #1e293b !important; }
  .leaflet-popup-content { font-family: var(--font); font-size: 0.8rem; line-height: 1.5; margin: 10px 14px; }
</style>
</head>
<body>
<div class="container">

  <header>
    <h1>VIEWS Conflict Forecast</h1>
    <p>State-based violence predictions &bull; Run: ${latestRun.replace(/</g, "&lt;")} &bull; Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  </header>

  <div id="stats" class="stats"></div>

  <div class="map-section">
    <div class="section-title">Predicted Conflict Risk by Country</div>
    <div id="map"></div>
  </div>

  <div class="chart-section">
    <div class="section-title">Highest Risk Countries (Top 20)</div>
    <div id="bar-chart"></div>
  </div>

  <div class="table-section">
    <div class="section-title">Country Forecast Details</div>
    <table>
      <thead>
        <tr>
          <th>Country</th>
          <th>ISO</th>
          <th>Peak Predicted Fatalities</th>
          <th>Nearest Month Fatalities</th>
          <th>Conflict Probability</th>
        </tr>
      </thead>
      <tbody id="forecast-body"></tbody>
    </table>
  </div>

  <div class="footer">
    Generated by <a href="https://github.com/blanxlait/demscore-tools" target="_blank">@demscore/views SDK</a>
    &middot;
    Data from <a href="https://viewsforecasting.org" target="_blank">VIEWS Forecasting</a> (PRIO)

    <div class="citations">
        <p><strong>About VIEWS:</strong></p>
        <p>The Violence &amp; Impacts Early-Warning System (VIEWS) is developed by the Department of Peace and Conflict Research, Uppsala University, and the Peace Research Institute Oslo (PRIO).</p>
        <p>VIEWS data is open access. See <a href="https://viewsforecasting.org" target="_blank">viewsforecasting.org</a> for methodology and documentation.</p>
    </div>
  </div>

</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
var DATA = ${JSON.stringify(reportData).replace(/</g, "\\u003c")};

// Stats
(function() {
    var container = document.getElementById('stats');
    var cards = [
        { label: 'Countries', value: DATA.uniqueCountries, sub: 'with predictions' },
        { label: 'Forecast Period', value: DATA.forecastPeriod, sub: DATA.forecastMonthCount + ' months', small: true },
        { label: 'High Risk', value: DATA.highRiskCount, sub: 'conflict probability > 50%' },
        { label: 'Model Run', value: DATA.run, sub: 'VIEWS fatalities model', small: true },
    ];
    cards.forEach(function(c) {
        var card = document.createElement('div');
        card.className = 'stat-card';
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = c.label;
        var val = document.createElement('div');
        val.className = 'value';
        if (c.small) val.style.fontSize = '1rem';
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

// Bar chart
(function() {
    var container = document.getElementById('bar-chart');
    var maxVal = DATA.topCountries.length > 0 ? DATA.topCountries[0].maxMean : 1;
    DATA.topCountries.forEach(function(c) {
        var row = document.createElement('div');
        row.className = 'bar-row';

        var label = document.createElement('span');
        label.className = 'bar-label';
        label.textContent = c.name;
        label.title = c.name;
        row.appendChild(label);

        var track = document.createElement('div');
        track.className = 'bar-track';
        var fill = document.createElement('div');
        fill.className = 'bar-fill';
        var pct = (c.maxMean / maxVal) * 100;
        fill.style.width = pct + '%';

        // Color gradient: green → yellow → red
        var ratio = c.maxMean / maxVal;
        if (ratio > 0.5) {
            fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else if (ratio > 0.15) {
            fill.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
        } else {
            fill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        }
        track.appendChild(fill);
        row.appendChild(track);

        var val = document.createElement('span');
        val.className = 'bar-value';
        val.textContent = c.maxMean.toFixed(1) + ' (' + c.iso + ')';
        row.appendChild(val);

        container.appendChild(row);
    });
})();

// Table
(function() {
    var tbody = document.getElementById('forecast-body');
    DATA.tableCountries.forEach(function(c) {
        var tr = document.createElement('tr');

        var td1 = document.createElement('td');
        td1.textContent = c.name;
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        td2.className = 'mono';
        td2.textContent = c.iso;
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        td3.className = 'mono';
        if (c.maxMean > 50) td3.className += ' risk-high';
        else if (c.maxMean > 10) td3.className += ' risk-medium';
        else td3.className += ' risk-low';
        td3.textContent = c.maxMean.toFixed(1);
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.className = 'mono';
        td4.textContent = c.nearestMean.toFixed(1);
        tr.appendChild(td4);

        var td5 = document.createElement('td');
        td5.className = 'mono';
        if (c.nearestDich > 0.5) td5.className += ' risk-high';
        else if (c.nearestDich > 0.2) td5.className += ' risk-medium';
        else td5.className += ' risk-low';
        td5.textContent = (c.nearestDich * 100).toFixed(0) + '%';
        tr.appendChild(td5);

        tbody.appendChild(tr);
    });
})();

// Map
(function() {
    var map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView([15, 30], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 18,
    }).addTo(map);

    var maxMean = 1;
    DATA.markers.forEach(function(m) { if (m.mean > maxMean) maxMean = m.mean; });

    DATA.markers.forEach(function(m) {
        var ratio = m.mean / maxMean;
        var radius = Math.max(4, Math.min(22, Math.sqrt(m.mean) * 2));
        var color;
        if (ratio > 0.3) color = '#ef4444';
        else if (ratio > 0.1) color = '#f59e0b';
        else if (ratio > 0.02) color = '#10b981';
        else color = '#1e40af';

        L.circleMarker([m.lat, m.lon], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            weight: 1,
        })
        .bindPopup(
            '<div style="font-weight:600;color:#f8fafc">' + m.name + ' (' + m.iso + ')</div>' +
            '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">' +
            'Peak predicted fatalities: <strong>' + m.mean + '</strong><br>' +
            'Conflict probability: <strong>' + (m.dich * 100).toFixed(0) + '%</strong></div>'
        )
        .addTo(map);
    });
})();
<\/script>
</body>
</html>`;

// ── Section D: Write file and open browser ──────────────────

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDir, "views-report.html");

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
