import type {
    ViewsClientOptions,
    ViewsPaginatedResponse,
    ViewsQueryOptions,
    CountryMonthRow,
    GridMonthRow,
    LevelOfAnalysis,
    ViolenceType,
} from "./types.js";
import { createViewsEnvelope, type DataEnvelope } from "./envelope.js";

const DEFAULT_BASE_URL = "https://api.viewsforecasting.org";
const DEFAULT_PAGE_SIZE = 1000;

export class ViewsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly url: string,
    ) {
        super(message);
        this.name = "ViewsApiError";
    }
}

export class ViewsClient {
    private readonly baseUrl: string;
    private readonly fetchFn: typeof globalThis.fetch;
    private readonly pageSize: number;

    constructor(options?: ViewsClientOptions) {
        this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.fetchFn = options?.fetch ?? globalThis.fetch;
        this.pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
    }

    // ── Convenience methods ──────────────────────────────

    async getCountryMonth(
        options?: ViewsQueryOptions,
        run = "current",
    ): Promise<ViewsPaginatedResponse<CountryMonthRow>> {
        return this.query<CountryMonthRow>("cm", { ...options, run });
    }

    async *getCountryMonthAll(
        options?: Omit<ViewsQueryOptions, "page">,
        run = "current",
    ): AsyncGenerator<CountryMonthRow> {
        yield* this.paginate<CountryMonthRow>("cm", { ...options, run });
    }

    async getGridMonth(
        options?: ViewsQueryOptions,
        run = "current",
    ): Promise<ViewsPaginatedResponse<GridMonthRow>> {
        return this.query<GridMonthRow>("pgm", { ...options, run });
    }

    async *getGridMonthAll(
        options?: Omit<ViewsQueryOptions, "page">,
        run = "current",
    ): AsyncGenerator<GridMonthRow> {
        yield* this.paginate<GridMonthRow>("pgm", { ...options, run });
    }

    // ── Envelope methods ─────────────────────────────────

    /**
     * Query country-month forecasts and wrap the result in a DataEnvelope
     * with provenance metadata, citations, and interpretation guidance.
     */
    async getCountryMonthEnvelope(
        options?: ViewsQueryOptions,
        run = "current",
    ): Promise<DataEnvelope<CountryMonthRow>> {
        const response = await this.query<CountryMonthRow>("cm", { ...options, run });
        return createViewsEnvelope(response.data, run, response.row_count);
    }

    /**
     * Query grid-month forecasts and wrap in a DataEnvelope.
     */
    async getGridMonthEnvelope(
        options?: ViewsQueryOptions,
        run = "current",
    ): Promise<DataEnvelope<GridMonthRow>> {
        const response = await this.query<GridMonthRow>("pgm", { ...options, run });
        return createViewsEnvelope(response.data, run, response.row_count);
    }

    // ── Full control methods ─────────────────────────────

    async query<T = Record<string, unknown>>(
        loa: LevelOfAnalysis,
        options?: ViewsQueryOptions & { run?: string },
    ): Promise<ViewsPaginatedResponse<T>> {
        const run = options?.run ?? "current";
        const url = this.buildUrl(`/${run}/${loa}`, options);
        return this.request<T>(url);
    }

    async queryByViolence<T = Record<string, unknown>>(
        loa: LevelOfAnalysis,
        violence: ViolenceType,
        options?: ViewsQueryOptions & { run?: string },
    ): Promise<ViewsPaginatedResponse<T>> {
        const run = options?.run ?? "current";
        const url = this.buildUrl(`/${run}/${loa}/${violence}`, options);
        return this.request<T>(url);
    }

    async queryByModel<T = Record<string, unknown>>(
        loa: LevelOfAnalysis,
        violence: ViolenceType,
        model: string,
        options?: ViewsQueryOptions & { run?: string },
    ): Promise<ViewsPaginatedResponse<T>> {
        const run = options?.run ?? "current";
        const url = this.buildUrl(`/${run}/${loa}/${violence}/${model}`, options);
        return this.request<T>(url);
    }

    // ── Discovery ────────────────────────────────────────

    async getRuns(): Promise<string[]> {
        const url = `${this.baseUrl}/`;
        const response = await this.fetchFn(url);

        if (!response.ok) {
            throw new ViewsApiError(
                `VIEWS API returned ${response.status} for /`,
                response.status,
                url,
            );
        }

        const data = (await response.json()) as { runs: string[] };
        return data.runs;
    }

    // ── Internal methods ─────────────────────────────────

    private buildUrl(path: string, options?: ViewsQueryOptions): string {
        const params = new URLSearchParams();
        params.set("pagesize", String(options?.pagesize ?? this.pageSize));

        if (options?.page != null) {
            params.set("page", String(options.page));
        }

        if (options) {
            // Array filters use repeated params (FastAPI List[] params)
            const arrayFields: Array<[string, unknown[] | undefined]> = [
                ["iso", options.iso],
                ["countryid", options.countryid],
                ["gwno", options.gwno],
                ["priogrid", options.priogrid],
                ["month", options.month],
            ];

            for (const [key, values] of arrayFields) {
                if (values) {
                    for (const v of values) {
                        params.append(key, String(v));
                    }
                }
            }

            // Scalar filters
            const scalarFields: Array<[string, unknown]> = [
                ["lat", options.lat],
                ["lon", options.lon],
                ["lat_ne", options.lat_ne],
                ["lon_ne", options.lon_ne],
                ["lat_sw", options.lat_sw],
                ["lon_sw", options.lon_sw],
                ["date_start", options.date_start],
                ["date_end", options.date_end],
            ];

            for (const [key, value] of scalarFields) {
                if (value != null) {
                    params.set(key, String(value));
                }
            }
        }

        return `${this.baseUrl}${path}?${params.toString()}`;
    }

    private async request<T>(url: string): Promise<ViewsPaginatedResponse<T>> {
        const response = await this.fetchFn(url);

        if (!response.ok) {
            throw new ViewsApiError(
                `VIEWS API returned ${response.status}`,
                response.status,
                url,
            );
        }

        return (await response.json()) as ViewsPaginatedResponse<T>;
    }

    private async *paginate<T>(
        loa: LevelOfAnalysis,
        options?: ViewsQueryOptions & { run?: string },
    ): AsyncGenerator<T> {
        const run = options?.run ?? "current";
        let url: string | null = this.buildUrl(`/${run}/${loa}`, options);

        while (url) {
            const response = await this.fetchFn(url);

            if (!response.ok) {
                throw new ViewsApiError(
                    `VIEWS API returned ${response.status}`,
                    response.status,
                    url,
                );
            }

            const data = (await response.json()) as ViewsPaginatedResponse<T>;

            for (const item of data.data) {
                yield item;
            }

            // next_page is "" when no more pages (not null)
            url = data.next_page || null;
        }
    }
}
