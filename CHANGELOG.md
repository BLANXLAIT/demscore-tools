# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Anti-hallucination guardrails** — Three-layer defense preventing LLMs from misrepresenting conflict data and forecasts
  - `DataEnvelope<T>` wrapper types for both `@demscore/ucdp` and `@demscore/views` SDKs, carrying provenance metadata, required citations, caveats, and interpretation notes
  - Envelope methods on clients: `getEventsEnvelope()`, `getCandidateEventsEnvelope()`, `getArmedConflictsEnvelope()`, `getCountryMonthEnvelope()`, `getGridMonthEnvelope()`
- **`@demscore/mcp-server`** — New MCP server package with three guarded tools:
  - `get_conflict_events` — UCDP historical data with interpretation rules and prohibited language
  - `get_conflict_forecasts` — VIEWS predictions with forecast hedging requirements
  - `get_trajectory_analysis` — Combined heuristic with explicit "derived, not official" labeling
- **`@demscore/skill`** — Claude Code skill with 8 mandatory rules for responsible conflict data presentation
- **Design document** — `docs/anti-hallucination-guardrails.md` with threat model, research findings, and three-layer defense design
- **Guardrails compliance CI** — 50 automated tests verifying guardrails are structurally intact, with GitHub Actions workflow producing a markdown report artifact

## [0.1.0] - 2026-03-03

### Added

- **`@demscore/ucdp`** — TypeScript client for the UCDP Conflict Data API
  - GED events, armed conflicts, dyadic, non-state, one-sided violence, and battle deaths endpoints
  - Automatic candidate version probing
  - Pagination support with async generators
- **`@demscore/views`** — TypeScript client for the VIEWS Forecasting API
  - Country-month and grid-month forecast queries
  - Violence type and model-specific queries
  - Run discovery
- **Demo reports** — Interactive HTML reports generated from live API data
  - UCDP conflict events report with map and country breakdown
  - VIEWS forecast report with risk map and top-20 chart
  - Combined UCDP + VIEWS conflict intelligence brief with trajectory analysis
