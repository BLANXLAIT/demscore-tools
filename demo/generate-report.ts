/**
 * UCDP Conflict Events Report Generator
 *
 * Fetches recent conflict event data from the UCDP GED Candidate API
 * and generates a self-contained HTML report with interactive map,
 * charts, and summary statistics.
 *
 * Usage:
 *   UCDP_TOKEN=your_token npx tsx demo/generate-report.ts
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
    UcdpClient,
    VIOLENCE_TYPE_LABELS,
} from "@demscore/ucdp";
import type { GedEventRaw, ViolenceType } from "@demscore/ucdp";

// ── Section A: Token validation and client setup ────────────

const token = process.env.UCDP_TOKEN;
if (!token) {
    console.error(
        "Missing UCDP_TOKEN environment variable.\n\n" +
        "Usage:\n" +
        "  UCDP_TOKEN=your_token npx tsx demo/generate-report.ts\n\n" +
        "Get a token at: https://ucdp.uu.se/apidocs/",
    );
    process.exit(1);
}

const now = new Date();
const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
const startDateStr = startDate.toISOString().slice(0, 10);

const client = new UcdpClient({ token });

// ── Section B: Fetch and aggregate data ─────────────────────

console.log(`Fetching UCDP candidate events since ${startDateStr}...`);

const events: GedEventRaw[] = [];
for await (const event of client.getCandidateEventsAll({ StartDate: startDateStr })) {
    events.push(event);
}

console.log(`Fetched ${events.length} events.`);

if (events.length === 0) {
    console.log("No events found in the date range. Exiting.");
    process.exit(0);
}

// Top 15 countries by event count
const countryMap = new Map<string, { count: number; deaths: number }>();
for (const e of events) {
    const entry = countryMap.get(e.country) ?? { count: 0, deaths: 0 };
    entry.count++;
    entry.deaths += e.best;
    countryMap.set(e.country, entry);
}
const topCountries = [...countryMap.entries()]
    .map(([name, { count, deaths }]) => ({ name, count, deaths }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

// By violence type
const violenceColors: Record<number, string> = { 1: "#ef4444", 2: "#f59e0b", 3: "#8b5cf6" };
const violenceMap = new Map<number, { count: number; deaths: number }>();
for (const e of events) {
    const entry = violenceMap.get(e.type_of_violence) ?? { count: 0, deaths: 0 };
    entry.count++;
    entry.deaths += e.best;
    violenceMap.set(e.type_of_violence, entry);
}
const byViolence = [1, 2, 3].map((type) => {
    const entry = violenceMap.get(type) ?? { count: 0, deaths: 0 };
    return {
        type,
        label: VIOLENCE_TYPE_LABELS[type as ViolenceType],
        color: violenceColors[type],
        count: entry.count,
        deaths: entry.deaths,
    };
});

// Deadliest events (top 10)
const deadliest = [...events]
    .sort((a, b) => b.best - a.best)
    .slice(0, 10)
    .map((e) => ({
        date_start: e.date_start,
        country: e.country,
        dyad_name: e.dyad_name,
        best: e.best,
        low: e.low,
        high: e.high,
        source_headline: e.source_headline,
    }));

// Map markers
const markers = events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
        lat: e.latitude as number,
        lon: e.longitude as number,
        deaths: e.best,
        type: e.type_of_violence,
        country: e.country,
        dyad: e.dyad_name,
        date: e.date_start,
        headline: e.source_headline,
    }));

// Scalar stats
const totalEvents = events.length;
const totalDeaths = events.reduce((sum, e) => sum + e.best, 0);
const civilianDeaths = events.reduce((sum, e) => sum + e.deaths_civilians, 0);
const countryCount = countryMap.size;

const dates = events.map((e) => e.date_start).sort();
const dateRange = { min: dates[0], max: dates[dates.length - 1] };

// ── Section C: Generate HTML string ─────────────────────────

const reportData = {
    topCountries,
    byViolence,
    deadliest,
    markers,
    totalEvents,
    totalDeaths,
    civilianDeaths,
    countryCount,
    dateRange,
    generatedAt: now.toISOString(),
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UCDP Conflict Events Report</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    background: #0a0a0f;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

.header {
    text-align: center;
    margin-bottom: 2.5rem;
}
.header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 0.5rem;
}
.header .subtitle {
    color: #94a3b8;
    font-size: 0.95rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}
.stat-card {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
    text-align: center;
}
.stat-card .value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
}
.stat-card .label {
    color: #94a3b8;
    font-size: 0.85rem;
    margin-top: 0.25rem;
}
.stat-card .sub {
    color: #94a3b8;
    font-size: 0.75rem;
}

#map {
    height: 420px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 2rem;
    z-index: 0;
}

.section-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 1rem;
}

.bar-chart {
    margin-bottom: 2rem;
}
.bar-row {
    display: flex;
    align-items: center;
    margin-bottom: 0.4rem;
}
.bar-label {
    width: 140px;
    text-align: right;
    padding-right: 12px;
    font-size: 0.8rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}
.bar-track {
    flex: 1;
    height: 22px;
    position: relative;
    display: flex;
    align-items: center;
}
.bar-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 4px;
    min-width: 2px;
    transition: width 0.3s;
}
.bar-value {
    margin-left: 8px;
    font-size: 0.75rem;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
}

.violence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}
.violence-card {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
    border-left: 4px solid;
}
.violence-card .type-label {
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 0.5rem;
}
.violence-card .type-stat {
    font-size: 0.85rem;
    color: #94a3b8;
}
.violence-card .type-stat strong {
    color: #e2e8f0;
}

.table-wrapper {
    overflow-x: auto;
    margin-bottom: 2rem;
}
table {
    width: 100%;
    border-collapse: collapse;
}
th {
    text-align: left;
    padding: 0.75rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
td {
    padding: 0.75rem;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: top;
}
td.deaths-cell .best {
    color: #ef4444;
    font-weight: 700;
}
td.deaths-cell .range {
    color: #94a3b8;
    font-size: 0.75rem;
}
td.headline-cell {
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.footer {
    text-align: center;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-size: 0.8rem;
}
.footer a {
    color: #3b82f6;
    text-decoration: none;
}
.footer a:hover {
    text-decoration: underline;
}

/* Leaflet popup dark theme overrides */
.leaflet-popup-content-wrapper {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
}
.leaflet-popup-tip {
    background: #1e293b !important;
}
.leaflet-popup-content {
    font-size: 0.8rem !important;
    line-height: 1.5 !important;
}
.leaflet-popup-content strong {
    color: #f8fafc;
}
</style>
</head>
<body>

<div class="header">
    <h1>UCDP Conflict Events Report</h1>
    <div class="subtitle" id="subtitle"></div>
</div>

<div class="stats-grid" id="stats-grid"></div>

<div id="map"></div>

<h2 class="section-title">Events by Country (Top 15)</h2>
<div class="bar-chart" id="bar-chart"></div>

<h2 class="section-title">By Violence Type</h2>
<div class="violence-grid" id="violence-grid"></div>

<h2 class="section-title">Deadliest Events</h2>
<div class="table-wrapper">
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Country</th>
                <th>Dyad</th>
                <th>Deaths</th>
                <th>Source</th>
            </tr>
        </thead>
        <tbody id="deadliest-body"></tbody>
    </table>
</div>

<div class="footer">
    Generated by <a href="https://github.com/blanxlait/demscore-tools" target="_blank">@demscore/ucdp SDK</a>
    &middot;
    Data from <a href="https://ucdp.uu.se" target="_blank">Uppsala Conflict Data Program</a>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
var DATA = ${JSON.stringify(reportData)};

function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Subtitle
document.getElementById('subtitle').textContent =
    DATA.dateRange.min + ' to ' + DATA.dateRange.max +
    ' \\u2022 Generated ' + new Date(DATA.generatedAt).toLocaleDateString();

// Stats grid
(function() {
    var grid = document.getElementById('stats-grid');
    var stats = [
        { value: DATA.totalEvents.toLocaleString(), label: 'Total Events', sub: '' },
        { value: DATA.totalDeaths.toLocaleString(), label: 'Fatalities', sub: DATA.civilianDeaths.toLocaleString() + ' civilian' },
        { value: DATA.countryCount.toLocaleString(), label: 'Countries', sub: '' },
        { value: DATA.dateRange.min + ' \\u2013 ' + DATA.dateRange.max, label: 'Date Range', sub: '' }
    ];
    stats.forEach(function(s) {
        var card = document.createElement('div');
        card.className = 'stat-card';
        var valueEl = document.createElement('div');
        valueEl.className = 'value';
        valueEl.textContent = s.value;
        card.appendChild(valueEl);
        var labelEl = document.createElement('div');
        labelEl.className = 'label';
        labelEl.textContent = s.label;
        card.appendChild(labelEl);
        if (s.sub) {
            var subEl = document.createElement('div');
            subEl.className = 'sub';
            subEl.textContent = s.sub;
            card.appendChild(subEl);
        }
        grid.appendChild(card);
    });
})();

// Map
(function() {
    var map = L.map('map').setView([15, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '\\u00a9 OpenStreetMap contributors \\u00a9 CARTO',
        maxZoom: 18
    }).addTo(map);

    var typeColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#8b5cf6' };
    DATA.markers.forEach(function(m) {
        var radius = Math.max(4, Math.min(20, Math.sqrt(m.deaths) * 2.5));
        var color = typeColors[m.type] || '#3b82f6';
        var popupEl = document.createElement('div');
        var strong1 = document.createElement('strong');
        strong1.textContent = m.country;
        popupEl.appendChild(strong1);
        popupEl.appendChild(document.createElement('br'));
        popupEl.appendChild(document.createTextNode(m.dyad));
        popupEl.appendChild(document.createElement('br'));
        popupEl.appendChild(document.createTextNode(m.date));
        popupEl.appendChild(document.createElement('br'));
        var deathLine = document.createTextNode('Deaths: ');
        popupEl.appendChild(deathLine);
        var strong2 = document.createElement('strong');
        strong2.textContent = String(m.deaths);
        popupEl.appendChild(strong2);
        if (m.headline) {
            popupEl.appendChild(document.createElement('br'));
            var em = document.createElement('em');
            em.textContent = m.headline;
            popupEl.appendChild(em);
        }
        L.circleMarker([m.lat, m.lon], {
            radius: radius,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.5
        }).addTo(map).bindPopup(popupEl);
    });
})();

// Bar chart
(function() {
    var container = document.getElementById('bar-chart');
    var maxCount = DATA.topCountries.length > 0 ? DATA.topCountries[0].count : 1;
    DATA.topCountries.forEach(function(c) {
        var row = document.createElement('div');
        row.className = 'bar-row';

        var label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = c.name;
        row.appendChild(label);

        var track = document.createElement('div');
        track.className = 'bar-track';
        var fill = document.createElement('div');
        fill.className = 'bar-fill';
        fill.style.width = (c.count / maxCount * 100).toFixed(1) + '%';
        track.appendChild(fill);
        row.appendChild(track);

        var val = document.createElement('div');
        val.className = 'bar-value';
        val.textContent = c.count + ' events / ' + c.deaths + ' deaths';
        row.appendChild(val);

        container.appendChild(row);
    });
})();

// Violence type cards
(function() {
    var grid = document.getElementById('violence-grid');
    DATA.byViolence.forEach(function(v) {
        var card = document.createElement('div');
        card.className = 'violence-card';
        card.style.borderLeftColor = v.color;

        var lbl = document.createElement('div');
        lbl.className = 'type-label';
        lbl.textContent = v.label;
        card.appendChild(lbl);

        var s1 = document.createElement('div');
        s1.className = 'type-stat';
        var b1 = document.createElement('strong');
        b1.textContent = v.count.toLocaleString();
        s1.appendChild(b1);
        s1.appendChild(document.createTextNode(' events'));
        card.appendChild(s1);

        var s2 = document.createElement('div');
        s2.className = 'type-stat';
        var b2 = document.createElement('strong');
        b2.textContent = v.deaths.toLocaleString();
        s2.appendChild(b2);
        s2.appendChild(document.createTextNode(' fatalities'));
        card.appendChild(s2);

        grid.appendChild(card);
    });
})();

// Deadliest events table
(function() {
    var tbody = document.getElementById('deadliest-body');
    DATA.deadliest.forEach(function(e) {
        var tr = document.createElement('tr');

        var td1 = document.createElement('td');
        td1.textContent = e.date_start;
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        td2.textContent = e.country;
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        td3.textContent = e.dyad_name;
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.className = 'deaths-cell';
        var bestSpan = document.createElement('span');
        bestSpan.className = 'best';
        bestSpan.textContent = String(e.best);
        td4.appendChild(bestSpan);
        td4.appendChild(document.createTextNode(' '));
        var rangeSpan = document.createElement('span');
        rangeSpan.className = 'range';
        rangeSpan.textContent = '(' + e.low + '\\u2013' + e.high + ')';
        td4.appendChild(rangeSpan);
        tr.appendChild(td4);

        var td5 = document.createElement('td');
        td5.className = 'headline-cell';
        td5.textContent = e.source_headline || '';
        td5.title = e.source_headline || '';
        tr.appendChild(td5);

        tbody.appendChild(tr);
    });
})();
<\/script>
</body>
</html>`;

// ── Section D: Write file and open browser ──────────────────

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDir, "report.html");

writeFileSync(outputPath, html, "utf-8");
console.log(`Report written to ${outputPath}`);

const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
try {
    execFileSync(openCmd, [outputPath]);
} catch {
    console.log(`Could not open browser automatically. Open ${outputPath} manually.`);
}
