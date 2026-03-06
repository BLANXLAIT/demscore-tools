/**
 * Data envelope types for UCDP conflict data.
 *
 * Envelopes wrap raw API responses with provenance metadata, interpretation
 * guidance, and citation requirements — designed so LLMs consuming this data
 * see caveats alongside every result set.
 */

// ── Provenance metadata ─────────────────────────────────

export interface DataProvenance {
    /** Data source name */
    source: string;

    /** Dataset version string (e.g. "25.1", "26.0.3") */
    version: string;

    /**
     * Release status of this data:
     * - "stable": Annual peer-reviewed release
     * - "candidate": Monthly preliminary release (not yet peer-reviewed)
     */
    releaseStatus: "candidate" | "stable";

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

export const UCDP_CITATION =
    "Sundberg, Ralph, and Erik Melander. 2013. \"Introducing the UCDP Georeferenced Event Dataset.\" Journal of Peace Research 50(4): 523-532.";

export const UCDP_CANDIDATE_CAVEATS: string[] = [
    "This is CANDIDATE data — preliminary, monthly release that has NOT been peer-reviewed.",
    "Fatality estimates may be revised in subsequent stable releases.",
    "Events may be reclassified, merged, or removed in the annual peer-reviewed release.",
    "code_status values other than 'Clear' indicate data quality concerns.",
];

export const UCDP_STABLE_CAVEATS: string[] = [
    "Fatality counts are estimates with uncertainty bands (best/low/high). Never present only the 'best' estimate without noting the range.",
    "code_status values other than 'Clear' indicate events flagged for review.",
];

export const UCDP_INTERPRETATION_NOTES: string[] = [
    "These are HISTORICAL OBSERVATIONS of past conflict events, not predictions.",
    "Fatality figures are ESTIMATES — always report the best/low/high range, never a single number alone.",
    "The 'best' estimate is UCDP's most likely figure, not a confirmed count.",
    "code_status indicates data confidence: 'Clear' is highest confidence; other values signal review flags.",
    "When citing this data, attribute to UCDP and include the dataset version.",
];

// ── Envelope factory ────────────────────────────────────

export function createUcdpEnvelope<T>(
    data: T[],
    version: string,
    totalCount?: number,
): DataEnvelope<T> {
    const isCandidate = version.includes(".0.");

    return {
        data,
        provenance: {
            source: "Uppsala Conflict Data Program (UCDP)",
            version,
            releaseStatus: isCandidate ? "candidate" : "stable",
            fetchedAt: new Date().toISOString(),
            citations: [UCDP_CITATION],
            caveats: isCandidate
                ? [...UCDP_CANDIDATE_CAVEATS, ...UCDP_STABLE_CAVEATS]
                : UCDP_STABLE_CAVEATS,
        },
        totalCount,
        interpretationNotes: UCDP_INTERPRETATION_NOTES,
    };
}
