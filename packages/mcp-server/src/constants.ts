/**
 * Centralized guardrail constants for the MCP server.
 * These are embedded in tool descriptions, response text blocks,
 * and structured metadata.
 */

// ── Citations ───────────────────────────────────────────

export const UCDP_CITATION =
    "Sundberg, Ralph, and Erik Melander. 2013. \"Introducing the UCDP Georeferenced Event Dataset.\" Journal of Peace Research 50(4): 523-532.";

export const VIEWS_CITATION =
    "Hegre et al. 2021. \"ViEWS2020: Revising and evaluating the ViEWS political violence early-warning system.\" Journal of Peace Research 58(3): 599-611.";

export const TOOLKIT_CITATION =
    "demscore-tools: TypeScript SDKs for UCDP and VIEWS conflict data. https://github.com/BLANXLAIT/demscore-tools";

// ── Tool descriptions ───────────────────────────────────

export const CONFLICT_EVENTS_DESCRIPTION = `Query historical conflict event data from the UCDP Georeferenced Event Dataset (GED).

Returns HISTORICAL OBSERVATIONS of past armed conflict events with fatality estimates.

INTERPRETATION RULES:
1. This data records PAST EVENTS — use past tense ("there were", "occurred", "recorded").
2. Fatality figures are ESTIMATES with uncertainty bands (best/low/high). NEVER present only the 'best' estimate.
3. The 'best' estimate is UCDP's most likely figure, NOT a confirmed body count.
4. code_status indicates data confidence: 'Clear' is highest; other values signal review flags.

PROHIBITED: "confirmed N deaths", "exactly N people died", "N fatalities" (without range)
REQUIRED: "UCDP estimates between LOW and HIGH fatalities (best estimate: BEST)", "according to UCDP data"

REQUIRED ATTRIBUTION: ${UCDP_CITATION}`;

export const CONFLICT_FORECASTS_DESCRIPTION = `Query conflict fatality forecasts from the VIEWS early-warning system (PRIO).

Returns PROBABILISTIC MODEL PREDICTIONS, not observed facts.

CRITICAL INTERPRETATION RULES:
1. These are MODEL PREDICTIONS, NOT facts. NEVER say "will have N fatalities."
2. ALWAYS use conditional language: "the model predicts", "the forecast suggests", "estimated at".
3. Forecast reliability DEGRADES with time horizon. Near-term (1-3 months) is more reliable than long-range (12+ months).
4. main_mean is a statistical expectation, NOT a prediction of what WILL happen.
5. main_dich is a PROBABILITY (0-1) of >=25 battle-related deaths, not a binary yes/no.

PROHIBITED: "Country X WILL have...", "There WILL BE conflict...", "N people will die"
REQUIRED: "The VIEWS model estimates...", "The forecast suggests...", "with a probability of X%"

REQUIRED ATTRIBUTION: ${VIEWS_CITATION}`;

export const TRAJECTORY_ANALYSIS_DESCRIPTION = `Analyze conflict trajectory by combining historical UCDP data with VIEWS forecasts.

Returns a DERIVED HEURISTIC analysis — trajectory labels (escalating/de-escalating/stable) are computed by this toolkit, NOT official UCDP or VIEWS assessments.

INTERPRETATION RULES:
1. Trajectory classifications are HEURISTIC LABELS computed from data trends, not authoritative assessments.
2. Historical data (UCDP) and forecast data (VIEWS) use DIFFERENT methodologies and CANNOT be directly compared.
3. Do NOT perform arithmetic on observed + predicted values (e.g., "total deaths across past and future").
4. Near-term forecast portions are more reliable than long-range portions.

PROHIBITED: "UCDP classifies this as escalating", "VIEWS says conflict will increase", "total of N deaths across 2024-2026"
REQUIRED: "Based on analysis by the demscore toolkit...", "The trajectory heuristic suggests...", "Historical UCDP data shows... while the VIEWS model predicts..."

REQUIRED ATTRIBUTION: ${UCDP_CITATION} AND ${VIEWS_CITATION} AND ${TOOLKIT_CITATION}`;

// ── Response text block templates ───────────────────────

export function formatResponseText(opts: {
    toolName: string;
    dataType: string;
    source: string;
    version: string;
    interpretationRules: string[];
    resultSummary: string;
    caveats: string[];
    citations: string[];
}): string {
    const rules = opts.interpretationRules.map((r, i) => `${i + 1}. ${r}`).join("\n");
    const caveatList = opts.caveats.map((c) => `- ${c}`).join("\n");
    const citationList = opts.citations.map((c) => `- ${c}`).join("\n");

    return `=== ${opts.toolName} (${opts.dataType}) ===
Source: ${opts.source} | Version: ${opts.version}
Data type: ${opts.dataType}

INTERPRETATION RULES:
${rules}

RESULTS: ${opts.resultSummary}

CAVEATS:
${caveatList}

REQUIRED CITATION:
${citationList}`;
}
