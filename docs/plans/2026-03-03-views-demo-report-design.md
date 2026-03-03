# VIEWS Forecast Report Generator — Design Doc

**Date:** 2026-03-03
**Status:** Approved

## Goal

Create a demo report for the `@demscore/views` SDK showing country-level conflict forecasts — the forward-looking complement to the UCDP actuals report.

## Key API Findings

- `"current"` is NOT a valid run alias. Must discover latest run from `GET /` → `{runs: [...]}` and pick the latest `fatalities003_*` entry.
- Violence-type endpoint `/{run}/cm/sb` returns `main_mean` (predicted fatalities), `main_dich` (binary conflict probability), `main_mean_ln` (log-transformed).
- Country-month data includes `country_id`, `name`, `isoab`, `gwcode`, `year`, `month` but NO lat/lon — need embedded country centroid lookup.
- Data has multiple forecast months per country (36 months forward). We'll aggregate the nearest forecast month per country.

## Script: `demo/generate-views-report.ts`

Same pattern as UCDP demo — zero dependencies beyond the SDK, writes self-contained HTML.

### Data Flow

1. `ViewsClient.getRuns()` → find latest `fatalities003_*` run
2. `queryByViolence("cm", "sb", { run, pagesize: 10000 })` → state-based predictions
3. Filter to nearest forecast month, aggregate per country
4. Rank countries by `main_mean` (predicted fatalities)

### Report Layout (dark theme, matching UCDP)

1. **Header** — "VIEWS Conflict Forecast" + model run + generation date
2. **Stats strip** — 4 cards: Countries, Forecast Period, Model Run, High Risk Countries (main_dich > 0.5)
3. **Map** — Leaflet with country markers at centroids, colored by risk (green→yellow→red gradient based on main_mean), sized by prediction magnitude
4. **Highest Risk bar chart** — top 20 countries by main_mean
5. **Forecast Table** — top 30: country, ISO, predicted fatalities (main_mean), conflict probability (main_dich), year-month

### Country Centroids

Embed a static lookup of ~200 country centroids keyed by `isoab` (ISO alpha-3). This is a well-known dataset and small enough (~10KB) to inline.

### Output

- `demo/views-report.html` (gitignored)
- Run: `npx tsx demo/generate-views-report.ts`
