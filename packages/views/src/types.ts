// ── Client configuration ─────────────────────────────────

export interface ViewsClientOptions {
    /** Base URL override (default: https://api.viewsforecasting.org) */
    baseUrl?: string;

    /** Custom fetch implementation (default: global fetch) */
    fetch?: typeof globalThis.fetch;

    /** Rows per page (default: 1000, max: 10000) */
    pageSize?: number;
}

// ── API response shape ───────────────────────────────────

export interface ViewsPaginatedResponse<T> {
    next_page: string;
    prev_page: string;
    model_tree: string;
    models: string;
    row_count: number;
    page_count: number;
    page_cur: number;
    start_date: string;
    end_date: string;
    data: T[];
}

// ── Row types ────────────────────────────────────────────

export interface CountryMonthRow {
    country_id: number;
    name: string;
    isoab: string;
    gwcode: number;
    month_id: number;
    year: number;
    month: number;
    [key: string]: unknown;
}

export interface GridMonthRow {
    priogrid_gid: number;
    month_id: number;
    year: number;
    month: number;
    [key: string]: unknown;
}

// ── Enums ────────────────────────────────────────────────

export type ViolenceType = "sb" | "ns" | "os" | "px";

export const VIOLENCE_TYPE_LABELS: Record<ViolenceType, string> = {
    sb: "State-based conflict",
    ns: "Non-state conflict",
    os: "One-sided violence",
    px: "Political exclusion",
};

export type LevelOfAnalysis = "cm" | "pgm";

// ── Query options ────────────────────────────────────────

export interface ViewsQueryOptions {
    /** ISO alpha-3 country codes */
    iso?: string[];

    /** VIEWS country IDs */
    countryid?: number[];

    /** Gleditsch-Ward country numbers */
    gwno?: number[];

    /** PRIO-GRID cell IDs */
    priogrid?: number[];

    /** Latitude for point query */
    lat?: number;

    /** Longitude for point query */
    lon?: number;

    /** Bounding box: northeast latitude */
    lat_ne?: number;

    /** Bounding box: northeast longitude */
    lon_ne?: number;

    /** Bounding box: southwest latitude */
    lat_sw?: number;

    /** Bounding box: southwest longitude */
    lon_sw?: number;

    /** Start date (ISO string, e.g. "2025-01-01") */
    date_start?: string;

    /** End date (ISO string, e.g. "2025-12-31") */
    date_end?: string;

    /** VIEWS month IDs (1 = Jan 1980) */
    month?: number[];

    /** Rows per page */
    pagesize?: number;

    /** Page number (1-indexed) */
    page?: number;
}
