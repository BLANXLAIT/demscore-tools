/**
 * Data envelope types for VIEWS conflict forecasts.
 *
 * Envelopes wrap raw API responses with provenance metadata, interpretation
 * guidance, and citation requirements — designed so LLMs consuming this data
 * see caveats alongside every result set.
 */

// ── Provenance metadata ─────────────────────────────────

export interface DataProvenance {
    /** Data source name */
    source: string;

    /** Forecast run identifier (e.g. "current", "2025-03") */
    version: string;

    /** Release status — always "forecast" for VIEWS data */
    releaseStatus: "forecast";

    /** ISO 8601 timestamp of when this data was fetched */
    fetchedAt: string;

    /** Required academic citations for this data */
    citations: string[];

    /** Context-specific warnings about data quality or limitations */
    caveats: string[];
}

// ── Envelope wrapper ────────────────────────────────────

export interface DataEnvelope<T> {
    /** The actual data records */
    data: T[];

    /** Provenance and attribution metadata */
    provenance: DataProvenance;

    /** Total number of records matching the query (may exceed data.length) */
    totalCount?: number;

    /**
     * LLM-facing interpretation guidance. Each string is a rule or caveat
     * that should inform how this data is presented to end users.
     */
    interpretationNotes: string[];
}

// ── Constants ───────────────────────────────────────────

export const VIEWS_CITATION =
    "Hegre et al. 2021. \"ViEWS2020: Revising and evaluating the ViEWS political violence early-warning system.\" Journal of Peace Research 58(3): 599-611.";

export const VIEWS_CAVEATS: string[] = [
    "These are PROBABILISTIC FORECASTS from a statistical model, NOT observed facts.",
    "Forecast accuracy DEGRADES with time horizon — near-term predictions (1-3 months) are substantially more reliable than long-range (12+ months).",
    "The 'main_mean' value is the ensemble model's expected fatality count — it is a statistical expectation, not a prediction of what WILL happen.",
    "The 'main_dich' value is the probability of >=25 battle-related deaths — it is a probability, not a certainty.",
    "Model performance varies by region and conflict type; predictions for historically volatile regions carry wider implicit uncertainty.",
    "Forecasts reflect patterns in historical data and do NOT account for future policy changes, peace agreements, or other intervening events.",
];

export const VIEWS_INTERPRETATION_NOTES: string[] = [
    "These are MODEL PREDICTIONS, not facts. NEVER say 'Country X WILL have N fatalities.'",
    "ALWAYS use conditional language: 'The VIEWS model estimates...', 'The forecast suggests...'",
    "Forecast reliability DEGRADES with time horizon — always state how far into the future a prediction extends.",
    "NEVER present main_mean as a precise count. It is a statistical expectation with substantial uncertainty.",
    "main_dich is a PROBABILITY (0-1) of >=25 BRDs, not a binary yes/no prediction.",
    "PROHIBITED language: 'will have', 'there will be', 'is going to experience' — use 'is predicted to', 'the model estimates', 'the forecast indicates'.",
    "When citing this data, attribute to VIEWS/PRIO and include the forecast run identifier.",
];

// ── Envelope factory ────────────────────────────────────

export function createViewsEnvelope<T>(
    data: T[],
    run: string,
    totalCount?: number,
): DataEnvelope<T> {
    return {
        data,
        provenance: {
            source: "VIEWS Forecasting (Peace Research Institute Oslo)",
            version: run,
            releaseStatus: "forecast",
            fetchedAt: new Date().toISOString(),
            citations: [VIEWS_CITATION],
            caveats: VIEWS_CAVEATS,
        },
        totalCount,
        interpretationNotes: VIEWS_INTERPRETATION_NOTES,
    };
}
