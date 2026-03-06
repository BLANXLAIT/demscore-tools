# CLAUDE.md

## Project

Demscore Tools — TypeScript SDKs for conflict data and forecasting APIs from the [Demscore](https://demscore.com/) ecosystem.

Monorepo with npm workspaces.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@demscore/ucdp` | `packages/sdk` | Client for the UCDP Conflict Data API |
| `@demscore/views` | `packages/views` | Client for the VIEWS Forecasting API |
| `@demscore/mcp-server` | `packages/mcp-server` | MCP server for conflict data |
| `@demscore/skill` | `packages/skill` | Claude Code skill |

## Commands

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Run demo reports (from repo root)
UCDP_TOKEN=xxx npx tsx demo/generate-report.ts          # UCDP only
npx tsx demo/generate-views-report.ts                    # VIEWS only
UCDP_TOKEN=xxx npx tsx demo/generate-combined-report.ts  # Combined
```

## Demo Reports

Demo report generators live in `demo/`. Each produces a self-contained HTML file (gitignored):

- `generate-report.ts` → `report.html` — UCDP conflict events (last 90 days)
- `generate-views-report.ts` → `views-report.html` — VIEWS forecasts (36 months)
- `generate-combined-report.ts` → `combined-report.html` — Joined UCDP + VIEWS with trajectory analysis

All follow a four-section structure: A) setup/validation, B) fetch/aggregate, C) generate HTML, D) write file and open browser.

Screenshots for the README live in `docs/` (e.g., `docs/combined-report-screenshot.png`). To capture a new one: serve the HTML locally (`python3 -m http.server 8891` from `demo/`), open in Chrome, inject `html2canvas` from CDN via the Chrome extension's JavaScript tool, and trigger a download.

## Anti-Hallucination Guardrails

Three-layer defense preventing LLMs from misrepresenting conflict data:

1. **SDK Envelopes** — `DataEnvelope<T>` wraps data with provenance, citations, caveats, interpretationNotes. Use `*Envelope()` methods (e.g., `getEventsEnvelope()`, `getCountryMonthEnvelope()`).
2. **MCP Server** — Tool descriptions embed interpretation rules, prohibited language, and required attribution. Response text blocks include data type labels and caveats.
3. **Skill** — `packages/skill/skill.md` has 8 mandatory rules for responsible data presentation.

Design doc: `docs/anti-hallucination-guardrails.md`

Run guardrails compliance tests:
```bash
npx vitest run packages/sdk/src/__tests__/envelope.test.ts packages/views/src/__tests__/envelope.test.ts packages/mcp-server/src/__tests__/guardrails.test.ts
```

CI generates a compliance report artifact via `.github/workflows/guardrails.yml`.

## Architecture Notes

- UCDP and VIEWS data are joined on **Gleditsch-Ward country codes** (`gwnoa` in UCDP, `gwcode` in VIEWS)
- UCDP `gwnoa` is a string that can be CSV (e.g., `"520,521"`) — always parse the first integer
- VIEWS API is open access (no token); UCDP requires `UCDP_TOKEN` env var
- Demo reports embed data as `var DATA = {...}` with safe JSON (`<` → `\\u003c`) and use `createElement`/`textContent` (no innerHTML for data)
- Country centroids for Leaflet maps are hardcoded lookup tables (ISO alpha-3 → [lat, lon])
