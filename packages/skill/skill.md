---
name: conflict-data-guardrails
description: Mandatory rules for responsible presentation of conflict data from UCDP and VIEWS forecasting systems
---

# Conflict Data Guardrails

These rules are **mandatory** whenever you use the demscore-tools MCP server, the `@demscore/ucdp` SDK, or the `@demscore/views` SDK to retrieve, analyze, or present conflict data.

---

## Rule 1: Distinguish Historical Data from Forecasts

UCDP provides **observed historical data**. VIEWS provides **model-generated forecasts**. Never conflate the two.

- **UCDP (past tense, observed):**
  - REQUIRED: "There were an estimated 150 fatalities" / "UCDP recorded 12 conflict events"
  - PROHIBITED: "There will be 150 fatalities" / "UCDP predicts 12 events"

- **VIEWS (conditional, probabilistic):**
  - REQUIRED: "The model predicts approximately 45 fatalities" / "The forecast suggests elevated risk"
  - PROHIBITED: "There will be 45 fatalities" / "The country will experience conflict"

## Rule 2: Uncertainty Is Non-Negotiable

Never present a single point estimate without its uncertainty range.

- **UCDP fatalities** — Always report best, low, and high estimates:
  - REQUIRED: "An estimated 150 fatalities (low: 80, high: 230)"
  - PROHIBITED: "150 people died" / "Confirmed 150 deaths"

- **VIEWS forecasts** — Always hedge predictions:
  - REQUIRED: "The model's main prediction is 45 fatalities, though actual outcomes could differ substantially"
  - PROHIBITED: "45 people will die next month"

## Rule 3: Prohibited Language Patterns

The following phrasings are **never acceptable** for forecast data:

| Prohibited | Use Instead |
|---|---|
| "will have" | "the model predicts" / "the forecast suggests" |
| "there will be" | "the model estimates there may be" |
| "is going to experience" | "is forecast to potentially experience" |
| "confirmed N deaths" (for UCDP best estimates) | "an estimated N fatalities (best estimate)" |
| "exactly N fatalities" | "approximately N fatalities (range: low-high)" |
| "certainly" / "definitely" / "inevitably" | "likely" / "the model suggests" / "based on current trends" |

## Rule 4: Forecast Horizon Matters

Always state how far ahead a VIEWS prediction extends. Reliability degrades with distance.

- **Near-term (1-3 months):** Higher confidence. Say: "In the near-term forecast (1-3 months), the model predicts..."
- **Medium-term (4-6 months):** Moderate confidence. Say: "Over the next 4-6 months, the model suggests... though medium-range forecasts carry greater uncertainty"
- **Long-range (7-12+ months):** Lower confidence. Say: "The 12-month forecast indicates... however, long-range predictions are substantially less reliable"

Never present a 12-month forecast with the same confidence framing as a 1-month forecast.

## Rule 5: Trajectory Classifications Are Heuristics

Labels like **"Escalating"**, **"De-escalating"**, and **"Stable"** from the demscore-tools trajectory analysis are **derived heuristics computed by this toolkit**. They are NOT official UCDP or VIEWS assessments.

- REQUIRED: "Based on demscore-tools trajectory analysis, the conflict appears to be escalating"
- REQUIRED: "The toolkit classifies this trend as de-escalating, based on comparing recent UCDP data with VIEWS forecasts"
- PROHIBITED: "UCDP classifies this conflict as escalating"
- PROHIBITED: "VIEWS assesses this as a de-escalating situation"

## Rule 6: Always Cite Sources

Every response using conflict data must include proper citations.

- **UCDP data:** Sundberg, Ralph, and Erik Melander. 2013. "Introducing the UCDP Georeferenced Event Dataset." *Journal of Peace Research* 50(4): 523-532.
- **VIEWS forecasts:** Hegre, Havard, et al. 2021. "ViEWS2020: Revising and Evaluating the ViEWS Political Violence Early-Warning System." *Journal of Peace Research* 58(3): 599-611.
- **Derived analysis (trajectory, combined reports):** Also cite: "Analysis generated using demscore-tools (https://github.com/blanxlait/demscore-tools)"

If you use both UCDP and VIEWS data in a single response, cite all three.

## Rule 7: Data Freshness

Always note the version and recency of the data you are presenting.

- **UCDP:** State the dataset version (e.g., "UCDP GED v24.1"). Distinguish between:
  - **Candidate data** (preliminary, not yet peer-reviewed, may be revised)
  - **Stable data** (peer-reviewed, finalized)
  - REQUIRED: "Based on UCDP candidate data (which is preliminary and subject to revision)..."
  - PROHIBITED: Presenting candidate data without noting its preliminary status

- **VIEWS:** State the forecast run date (e.g., "VIEWS forecast run: January 2026"). Note that forecasts are periodically re-run and earlier runs may no longer reflect the current model output.

## Rule 8: What You Cannot Do

These operations are **never valid**, regardless of user request:

1. **No extrapolation beyond model outputs.** If VIEWS forecasts 6 months ahead, do not extend to 12 months by "continuing the trend."
2. **No arithmetic mixing of observed and predicted values.** Do not add UCDP historical counts to VIEWS forecast counts to produce a "total." They measure different things across different time periods.
3. **No causal claims.** Neither UCDP data nor VIEWS forecasts establish causation. Say "is associated with" or "coincides with," never "caused" or "led to."
4. **No precision inflation.** Do not report more decimal places than the source data provides. Do not convert ranges into false point estimates.
5. **No country-level generalizations from sub-national data.** If data covers specific georeferenced events or grid cells, do not generalize to entire countries without qualification.

---

## Response Template

When presenting conflict data, structure your response as follows:

### 1. Summary (with hedging)

> Based on [UCDP data / VIEWS forecasts / combined analysis], [country/region] has [experienced / is forecast to potentially experience] [brief finding]. These findings are subject to the limitations noted below.

### 2. Key Findings (with uncertainty ranges)

- Present each finding with its uncertainty range
- State the time period and data source for each finding
- Use appropriate tense (past for UCDP, conditional for VIEWS)

### 3. Data Table (with uncertainty columns)

Always include low, best/main, and high columns:

| Country | Period | Best Estimate | Low | High | Source |
|---------|--------|---------------|-----|------|--------|
| Example | 2024 Q3 | 150 | 80 | 230 | UCDP GED v24.1 (candidate) |
| Example | 2025 Q1 (forecast) | 45 | — | — | VIEWS run Jan 2025 |

### 4. Caveats (explicit limitations)

- Data type (candidate vs. stable; forecast horizon)
- Trajectory labels are toolkit-derived heuristics, not official assessments
- Any joins between UCDP and VIEWS are approximate (matched on Gleditsch-Ward codes)
- Forecasts are model outputs, not certainties

### 5. Sources (full citations)

Include all applicable citations from Rule 6.
