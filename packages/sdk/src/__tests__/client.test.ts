import { describe, it, expect, vi, beforeEach } from "vitest";
import { UcdpClient, UcdpApiError } from "../client.js";

function mockFetch(data: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue({
        ok,
        status,
        json: async () => data,
    }) as unknown as typeof globalThis.fetch;
}

function paginatedResponse<T>(result: T[], totalCount?: number, totalPages = 1) {
    return {
        TotalCount: totalCount ?? result.length,
        TotalPages: totalPages,
        PreviousPageUrl: null,
        NextPageUrl: null,
        Result: result,
    };
}

describe("UcdpClient", () => {
    it("throws if no token provided", () => {
        expect(() => new UcdpClient({ token: "" })).toThrow("token is required");
    });

    it("sends token as x-ucdp-access-token header", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new UcdpClient({ token: "my-token", fetch: fetchFn });

        await client.getEvents();

        expect(fetchFn).toHaveBeenCalledTimes(1);
        const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(options.headers["x-ucdp-access-token"]).toBe("my-token");
    });

    it("uses stable version by default for getEvents", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new UcdpClient({ token: "t", fetch: fetchFn });

        await client.getEvents();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("gedevents/25.1");
    });

    it("passes filter params as query string", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new UcdpClient({ token: "t", fetch: fetchFn });

        await client.getEvents({
            StartDate: "2025-01-01",
            TypeOfViolence: 1,
            Country: [365, 369],
        });

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("StartDate=2025-01-01");
        expect(url).toContain("TypeOfViolence=1");
        expect(url).toContain("Country=365%2C369");
    });

    it("throws UcdpApiError on non-ok response", async () => {
        const fetchFn = mockFetch(null, false, 401);
        const client = new UcdpClient({ token: "bad", fetch: fetchFn });

        await expect(client.getEvents()).rejects.toThrow(UcdpApiError);
        await expect(client.getEvents()).rejects.toMatchObject({
            status: 401,
        });
    });

    it("allows custom base URL", async () => {
        const fetchFn = mockFetch(paginatedResponse([]));
        const client = new UcdpClient({
            token: "t",
            baseUrl: "https://custom.api/v1",
            fetch: fetchFn,
        });

        await client.getEvents();

        const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain("https://custom.api/v1/gedevents/");
    });

    it("paginates through all results", async () => {
        let callCount = 0;
        const fetchFn = vi.fn().mockImplementation(async (url: string) => {
            callCount++;
            const page = new URL(url).searchParams.get("page");
            return {
                ok: true,
                json: async () =>
                    paginatedResponse(
                        [{ id: callCount }],
                        2,
                        2, // 2 total pages
                    ),
            };
        }) as unknown as typeof globalThis.fetch;

        const client = new UcdpClient({ token: "t", fetch: fetchFn });
        const results: unknown[] = [];

        for await (const event of client.getEventsAll()) {
            results.push(event);
        }

        expect(results).toHaveLength(2);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    describe("getCandidateEvents", () => {
        it("probes versions until finding data", async () => {
            let callCount = 0;
            const fetchFn = vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    // First probe: empty
                    return { ok: true, json: async () => paginatedResponse([]) };
                }
                if (callCount === 2) {
                    // Second probe: has data
                    return {
                        ok: true,
                        json: async () =>
                            paginatedResponse([{ id: 1 }]),
                    };
                }
                // Actual fetch with found version
                return {
                    ok: true,
                    json: async () => paginatedResponse([{ id: 1 }]),
                };
            }) as unknown as typeof globalThis.fetch;

            const client = new UcdpClient({ token: "t", fetch: fetchFn });
            const result = await client.getCandidateEvents();

            expect(result.Result).toHaveLength(1);
        });

        it("falls back to stable version if all candidates fail", async () => {
            const fetchFn = vi.fn().mockImplementation(async (url: string) => {
                if (url.includes("gedevents/25.1")) {
                    return {
                        ok: true,
                        json: async () =>
                            paginatedResponse([{ id: 1, source: "stable" }]),
                    };
                }
                // All candidate probes fail
                return { ok: false, status: 404 };
            }) as unknown as typeof globalThis.fetch;

            const client = new UcdpClient({ token: "t", fetch: fetchFn });
            const result = await client.getCandidateEvents();

            expect(result.Result).toHaveLength(1);
        });
    });

    describe("other resources", () => {
        it("getArmedConflicts uses ucdpprioconflict resource", async () => {
            const fetchFn = mockFetch(paginatedResponse([]));
            const client = new UcdpClient({ token: "t", fetch: fetchFn });

            await client.getArmedConflicts();

            const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toContain("ucdpprioconflict/25.1");
        });

        it("getDyadic uses dyadic resource", async () => {
            const fetchFn = mockFetch(paginatedResponse([]));
            const client = new UcdpClient({ token: "t", fetch: fetchFn });

            await client.getDyadic();

            const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toContain("dyadic/25.1");
        });

        it("getNonState uses nonstate resource", async () => {
            const fetchFn = mockFetch(paginatedResponse([]));
            const client = new UcdpClient({ token: "t", fetch: fetchFn });

            await client.getNonState();

            const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toContain("nonstate/25.1");
        });

        it("getOneSided uses onesided resource", async () => {
            const fetchFn = mockFetch(paginatedResponse([]));
            const client = new UcdpClient({ token: "t", fetch: fetchFn });

            await client.getOneSided();

            const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toContain("onesided/25.1");
        });

        it("getBattleDeaths uses battledeaths resource", async () => {
            const fetchFn = mockFetch(paginatedResponse([]));
            const client = new UcdpClient({ token: "t", fetch: fetchFn });

            await client.getBattleDeaths();

            const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(url).toContain("battledeaths/25.1");
        });
    });
});
