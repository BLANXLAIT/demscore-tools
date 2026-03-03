// ── Client configuration ─────────────────────────────────

export interface UcdpClientOptions {
    /** API access token (x-ucdp-access-token header) */
    token: string;

    /** Base URL override (default: https://ucdpapi.pcr.uu.se/api) */
    baseUrl?: string;

    /** Custom fetch implementation (default: global fetch) */
    fetch?: typeof globalThis.fetch;
}

// ── Shared pagination / response ─────────────────────────

export interface UcdpPaginatedResponse<T> {
    TotalCount: number;
    TotalPages: number;
    PreviousPageUrl: string | null;
    NextPageUrl: string | null;
    Result: T[];
}

export interface PaginationParams {
    /** Rows per page (default: 100) */
    pagesize?: number;

    /** Page number (1-indexed, default: 1) */
    page?: number;

    [key: string]: unknown;
}

// ── GED Events (gedevents) ───────────────────────────────

export interface GedEventRaw {
    id: number;
    relid: string;
    year: number;
    active_year: number;
    code_status: string;
    type_of_violence: number;
    conflict_dset_id: string;
    conflict_new_id: number;
    conflict_name: string;
    dyad_dset_id: string;
    dyad_new_id: number;
    dyad_name: string;
    side_a_dset_id: string;
    side_a_new_id: number;
    side_a: string;
    side_b_dset_id: string;
    side_b_new_id: number;
    side_b: string;
    number_of_sources: number;
    source_article: string;
    source_office: string;
    source_date: string;
    source_headline: string;
    source_original: string;
    where_prec: number;
    where_coordinates: string;
    where_description: string;
    adm_1: string;
    adm_2: string;
    latitude: number | null;
    longitude: number | null;
    geom_wkt: string;
    priogrid_gid: number;
    country: string;
    country_id: number;
    region: string;
    date_prec: number;
    date_start: string;
    date_end: string;
    deaths_a: number;
    deaths_b: number;
    deaths_civilians: number;
    deaths_unknown: number;
    best: number;
    high: number;
    low: number;
    gwnoa: string;
    gwnob: string;
    [key: string]: unknown;
}

export interface GedEventFilters extends PaginationParams {
    /** Event ID(s) */
    Id?: number | number[];

    /** Gleditsch-Ward country code(s) */
    Country?: number | number[];

    /** Bounding box: "y0 x0,y1 x1" */
    Geography?: string;

    /** Start date (YYYY-MM-DD) — filters on date_end */
    StartDate?: string;

    /** End date (YYYY-MM-DD) — filters on date_end */
    EndDate?: string;

    /** Violence type: 1=state-based, 2=non-state, 3=one-sided */
    TypeOfViolence?: number | number[];

    /** Dyad ID(s) — new format (v5.0+) */
    Dyad?: number | number[];

    /** Actor ID(s) — side_a_new_id or side_b_new_id */
    Actor?: number | number[];
}

// ── Armed Conflict (ucdpprioconflict) ────────────────────

export interface ArmedConflictRaw {
    conflict_id: number;
    location: string;
    side_a: string;
    side_b: string;
    incompatibility: number;
    territory_name: string;
    year: number;
    intensity_level: number;
    cumulative_intensity: number;
    type_of_conflict: number;
    start_date: string;
    start_prec: number;
    start_date2: string;
    start_prec2: number;
    ep_end: number;
    ep_end_date: string;
    ep_end_prec: number;
    gwno_a: string;
    gwno_a_2nd: string;
    gwno_b: string;
    gwno_b_2nd: string;
    gwno_loc: string;
    region: string;
    version: number;
    [key: string]: unknown;
}

export interface ArmedConflictFilters extends PaginationParams {
    Country?: number | number[];
    Conflict?: number | number[];
    Year?: number | number[];
    ConflictIncompatibility?: number | number[];
    ConflictType?: number | number[];
}

// ── Dyadic (dyadic) ─────────────────────────────────────

export interface DyadicRaw {
    dyad_id: number;
    conflict_id: number;
    location: string;
    side_a: string;
    side_b: string;
    year: number;
    type_of_conflict: number;
    territory_name: string;
    bd_best: number;
    bd_low: number;
    bd_high: number;
    [key: string]: unknown;
}

export interface DyadicFilters extends PaginationParams {
    Dyad?: number | number[];
    Conflict?: number | number[];
    Country?: number | number[];
    Year?: number | number[];
    ConflictIncompatibility?: number | number[];
    ConflictType?: number | number[];
}

// ── Non-State Conflict (nonstate) ────────────────────────

export interface NonStateRaw {
    ns_conflict_id: number;
    location: string;
    side_a: string;
    side_b: string;
    year: number;
    best_fatality_estimate: number;
    low_fatality_estimate: number;
    high_fatality_estimate: number;
    org_id_a: number;
    org_id_b: number;
    [key: string]: unknown;
}

export interface NonStateFilters extends PaginationParams {
    Country?: number | number[];
    Conflict?: number | number[];
    Org?: number | number[];
    Year?: number | number[];
}

// ── One-Sided Violence (onesided) ────────────────────────

export interface OneSidedRaw {
    actor_id: number;
    actor_name: string;
    year: number;
    best_fatality_estimate: number;
    low_fatality_estimate: number;
    high_fatality_estimate: number;
    is_government_actor: number;
    location: string;
    [key: string]: unknown;
}

export interface OneSidedFilters extends PaginationParams {
    Dyad?: number | number[];
    Country?: number | number[];
    Year?: number | number[];
}

// ── Battle-Related Deaths (battledeaths) ─────────────────

export interface BattleDeathsRaw {
    dyad_id: number;
    conflict_id: number;
    year: number;
    bd_best: number;
    bd_low: number;
    bd_high: number;
    side_a: string;
    side_b: string;
    location: string;
    [key: string]: unknown;
}

export interface BattleDeathsFilters extends PaginationParams {
    Dyad?: number | number[];
    Conflict?: number | number[];
    Country?: number | number[];
    Year?: number | number[];
    ConflictIncompatibility?: number | number[];
    ConflictType?: number | number[];
}

// ── Violence type helpers ────────────────────────────────

export type ViolenceType = 1 | 2 | 3;

export const VIOLENCE_TYPE_LABELS: Record<ViolenceType, string> = {
    1: "State-based conflict",
    2: "Non-state conflict",
    3: "One-sided violence",
};

// ── Code status values ───────────────────────────────────

export type CodeStatus =
    | "Clear"
    | "Check Deaths"
    | "Check Dyad"
    | "Check Type of Violence"
    | "Low Confidence";
