import { describe, it, expect, vi } from "vitest";
import { ViewsClient, ViewsApiError } from "../client.js";

function mockFetch(data: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        json: async () => data,
    }) as unknown as typeof globalThis.fetch;
}

function paginatedResponse<T>(data: T[], opts?: Partial<{ next_page: string; page_count: number; page_cur: number }>) {
    return {
        next_page: opts?.next_page ?? "",
        prev_page: "",
        model_tree: "",
        models: "",
        row_count: data.length,
        page_count: opts?.page_count ?? 1,
        page_cur: opts?.page_cur ?? 1,
        start_date: "2025-01-01",
        end_date: "2025-12-01",
        data,
    };
}

describe("ViewsClient", () => {
    it("constructs with no arguments", () => {
        expect(() => new ViewsClient()).not.toThrow();
    });

    it("builds correct URL path for /{run}/{loa}", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.query("cm");

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/current/cm?");
    });

    it("builds correct URL path for /{run}/{loa}/{tv}", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.queryByViolence("pgm", "sb");

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/current/pgm/sb?");
    });

    it("builds correct URL path for /{run}/{loa}/{tv}/{model}", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.queryByModel("cm", "os", "fatalities002");

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/current/cm/os/fatalities002?");
    });

    it("defaults run to 'current'", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.getCountryMonth();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/current/cm?");
    });

    it("allows custom run", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.getCountryMonth({}, "2025-03");

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/2025-03/cm?");
    });

    it("produces repeated params for array filters", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.getCountryMonth({ iso: ["SYR", "IRQ"] });

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("iso=SYR");
        expect(url).toContain("iso=IRQ");
    });

    it("appends scalar filters correctly", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.getCountryMonth({
            date_start: "2025-01-01",
            date_end: "2025-12-31",
            lat: 35.5,
            lon: 38.2,
        });

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("date_start=2025-01-01");
        expect(url).toContain("date_end=2025-12-31");
        expect(url).toContain("lat=35.5");
        expect(url).toContain("lon=38.2");
    });

    it("throws ViewsApiError on non-ok response", async () => {
        const fetchFn = mockFetch(null, false, 500);
        const client = new ViewsClient({ fetch: fetchFn });

        await expect(client.getCountryMonth()).rejects.toThrow(ViewsApiError);
        await expect(client.getCountryMonth()).rejects.toMatchObject({
            status: 500,
        });
    });

    it("allows custom base URL", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({
            baseUrl: "https://custom.views.org/api",
            fetch: fetchFn,
        });

        await client.getCountryMonth();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("https://custom.views.org/api/current/cm?");
    });

    it("paginates following next_page URLs, stops on empty string", async () => {
        let callCount = 0;
        const fetchFn = vi.fn().mockImplementation(async () => {
            callCount++;
            return {
                ok: true,
                json: async () =>
                    paginatedResponse(
                        [{ country_id: callCount }],
                        {
                            next_page: callCount < 3 ? `https://api.viewsforecasting.org/current/cm?page=${callCount + 1}` : "",
                            page_count: 3,
                            page_cur: callCount,
                        },
                    ),
            };
        }) as unknown as typeof globalThis.fetch;

        const client = new ViewsClient({ fetch: fetchFn });
        const results: unknown[] = [];

        for await (const row of client.getCountryMonthAll()) {
            results.push(row);
        }

        expect(results).toHaveLength(3);
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("getRuns returns array from response", async () => {
        const fetchFn = mockFetch({ runs: ["2025-01", "2025-02", "current"] });
        const client = new ViewsClient({ fetch: fetchFn });

        const runs = await client.getRuns();

        expect(runs).toEqual(["2025-01", "2025-02", "current"]);
    });

    it("uses default pageSize from constructor", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn, pageSize: 500 });

        await client.getCountryMonth();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("pagesize=500");
    });

    it("getGridMonth uses pgm level of analysis", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new ViewsClient({ fetch: fetchFn });

        await client.getGridMonth();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("/current/pgm?");
    });
});
