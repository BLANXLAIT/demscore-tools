import type {
    UcdpClientOptions,
    UcdpPaginatedResponse,
    PaginationParams,
    GedEventRaw,
    GedEventFilters,
    ArmedConflictRaw,
    ArmedConflictFilters,
    DyadicRaw,
    DyadicFilters,
    NonStateRaw,
    NonStateFilters,
    OneSidedRaw,
    OneSidedFilters,
    BattleDeathsRaw,
    BattleDeathsFilters,
} from "./types.js";
import {
    LATEST_STABLE_VERSION,
    latestCandidateVersion,
    candidateVersions,
} from "./versions.js";

const DEFAULT_BASE_URL = "https://ucdpapi.pcr.uu.se/api";
const DEFAULT_PAGE_SIZE = 100;
const RATE_LIMIT_PER_DAY = 5_000;

export class UcdpApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly url: string,
    ) {
        super(message);
        this.name = "UcdpApiError";
    }
}

export class UcdpClient {
    private readonly token: string;
    private readonly baseUrl: string;
    private readonly fetchFn: typeof globalThis.fetch;

    constructor(options: UcdpClientOptions) {
        if (!options.token) {
            throw new Error("UCDP API token is required");
        }
        this.token = options.token;
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.fetchFn = options.fetch ?? globalThis.fetch;
    }

    // ── GED Events ───────────────────────────────────────

    /**
     * Query the Georeferenced Event Dataset (GED).
     * Uses the stable annual release by default.
     */
    async getEvents(
        filters?: GedEventFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<GedEventRaw>> {
        return this.request<GedEventRaw>(
            "gedevents",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    /**
     * Query the GED Candidate dataset (monthly releases).
     * Automatically probes for the latest available version.
     */
    async getCandidateEvents(
        filters?: GedEventFilters,
    ): Promise<UcdpPaginatedResponse<GedEventRaw>> {
        return this.probeAndFetch<GedEventRaw>("gedevents", filters);
    }

    /**
     * Iterate through all pages of GED events.
     */
    async *getEventsAll(
        filters?: Omit<GedEventFilters, "page">,
        version?: string,
    ): AsyncGenerator<GedEventRaw> {
        yield* this.paginate<GedEventRaw>(
            "gedevents",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    /**
     * Iterate through all pages of GED Candidate events.
     * Probes for the latest available version, then paginates.
     */
    async *getCandidateEventsAll(
        filters?: Omit<GedEventFilters, "page">,
    ): AsyncGenerator<GedEventRaw> {
        const version = await this.probeVersion("gedevents");
        yield* this.paginate<GedEventRaw>("gedevents", version, filters);
    }

    // ── Armed Conflicts ──────────────────────────────────

    async getArmedConflicts(
        filters?: ArmedConflictFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<ArmedConflictRaw>> {
        return this.request<ArmedConflictRaw>(
            "ucdpprioconflict",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    async *getArmedConflictsAll(
        filters?: Omit<ArmedConflictFilters, "page">,
        version?: string,
    ): AsyncGenerator<ArmedConflictRaw> {
        yield* this.paginate<ArmedConflictRaw>(
            "ucdpprioconflict",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    // ── Dyadic ───────────────────────────────────────────

    async getDyadic(
        filters?: DyadicFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<DyadicRaw>> {
        return this.request<DyadicRaw>(
            "dyadic",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    async *getDyadicAll(
        filters?: Omit<DyadicFilters, "page">,
        version?: string,
    ): AsyncGenerator<DyadicRaw> {
        yield* this.paginate<DyadicRaw>(
            "dyadic",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    // ── Non-State ────────────────────────────────────────

    async getNonState(
        filters?: NonStateFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<NonStateRaw>> {
        return this.request<NonStateRaw>(
            "nonstate",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    async *getNonStateAll(
        filters?: Omit<NonStateFilters, "page">,
        version?: string,
    ): AsyncGenerator<NonStateRaw> {
        yield* this.paginate<NonStateRaw>(
            "nonstate",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    // ── One-Sided Violence ───────────────────────────────

    async getOneSided(
        filters?: OneSidedFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<OneSidedRaw>> {
        return this.request<OneSidedRaw>(
            "onesided",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    async *getOneSidedAll(
        filters?: Omit<OneSidedFilters, "page">,
        version?: string,
    ): AsyncGenerator<OneSidedRaw> {
        yield* this.paginate<OneSidedRaw>(
            "onesided",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    // ── Battle-Related Deaths ────────────────────────────

    async getBattleDeaths(
        filters?: BattleDeathsFilters,
        version?: string,
    ): Promise<UcdpPaginatedResponse<BattleDeathsRaw>> {
        return this.request<BattleDeathsRaw>(
            "battledeaths",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    async *getBattleDeathsAll(
        filters?: Omit<BattleDeathsFilters, "page">,
        version?: string,
    ): AsyncGenerator<BattleDeathsRaw> {
        yield* this.paginate<BattleDeathsRaw>(
            "battledeaths",
            version ?? LATEST_STABLE_VERSION,
            filters,
        );
    }

    // ── Internal methods ─────────────────────────────────

    private buildUrl(
        resource: string,
        version: string,
        filters?: Record<string, unknown>,
    ): string {
        const params = new URLSearchParams();
        params.set("pagesize", String(filters?.pagesize ?? DEFAULT_PAGE_SIZE));
        params.set("page", String(filters?.page ?? 1));

        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (key === "pagesize" || key === "page" || value == null) continue;
                if (Array.isArray(value)) {
                    params.set(key, value.join(","));
                } else {
                    params.set(key, String(value));
                }
            }
        }

        return `${this.baseUrl}/${resource}/${version}?${params.toString()}`;
    }

    private async request<T>(
        resource: string,
        version: string,
        filters?: Record<string, unknown>,
    ): Promise<UcdpPaginatedResponse<T>> {
        const url = this.buildUrl(resource, version, filters);

        const response = await this.fetchFn(url, {
            headers: { "x-ucdp-access-token": this.token },
        });

        if (!response.ok) {
            throw new UcdpApiError(
                `UCDP API returned ${response.status} for ${resource}/${version}`,
                response.status,
                url,
            );
        }

        return (await response.json()) as UcdpPaginatedResponse<T>;
    }

    private async *paginate<T>(
        resource: string,
        version: string,
        filters?: Record<string, unknown>,
    ): AsyncGenerator<T> {
        let page = 1;
        let totalPages = 1;

        do {
            const data = await this.request<T>(resource, version, {
                ...filters,
                page,
            });
            totalPages = data.TotalPages;

            for (const item of data.Result) {
                yield item;
            }

            page++;
        } while (page <= totalPages);
    }

    /**
     * Probe candidate versions to find the latest available one.
     * Tries the most recent expected version first, then falls back.
     */
    private async probeVersion(resource: string): Promise<string> {
        const versions = candidateVersions();

        for (const version of versions) {
            try {
                const data = await this.request<unknown>(resource, version, {
                    pagesize: 1,
                    page: 1,
                });
                if (data.Result.length > 0) {
                    return version;
                }
            } catch {
                // Version doesn't exist or returned error — try next
            }
        }

        // Fall back to stable if no candidate versions have data
        return LATEST_STABLE_VERSION;
    }

    private async probeAndFetch<T>(
        resource: string,
        filters?: Record<string, unknown>,
    ): Promise<UcdpPaginatedResponse<T>> {
        const version = await this.probeVersion(resource);
        return this.request<T>(resource, version, filters);
    }
}
