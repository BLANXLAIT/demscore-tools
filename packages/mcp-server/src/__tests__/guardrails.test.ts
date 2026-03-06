import { describe, it, expect, vi } from "vitest";
import {
    CONFLICT_EVENTS_DESCRIPTION,
    CONFLICT_FORECASTS_DESCRIPTION,
    TRAJECTORY_ANALYSIS_DESCRIPTION,
    formatResponseText,
} from "../constants.js";
import { handleConflictEvents } from "../tools/conflict-events.js";
import { handleConflictForecasts } from "../tools/conflict-forecasts.js";
import { handleTrajectoryAnalysis } from "../tools/trajectory-analysis.js";

// ── Tool description compliance ─────────────────────────

describe("Tool description guardrails", () => {
    const descriptions = [
        { name: "get_conflict_events", desc: CONFLICT_EVENTS_DESCRIPTION },
        { name: "get_conflict_forecasts", desc: CONFLICT_FORECASTS_DESCRIPTION },
        { name: "get_trajectory_analysis", desc: TRAJECTORY_ANALYSIS_DESCRIPTION },
    ];

    for (const { name, desc } of descriptions) {
        it(`${name} description contains INTERPRETATION RULES`, () => {
            expect(desc).toContain("INTERPRETATION RULES");
        });

        it(`${name} description contains REQUIRED ATTRIBUTION`, () => {
            expect(desc).toMatch(/REQUIRED ATTRIBUTION|REQUIRED:.*citation|Sundberg.*Melander/i);
        });
    }

    it("forecast tool description contains PROHIBITED language patterns", () => {
        expect(CONFLICT_FORECASTS_DESCRIPTION).toContain("PROHIBITED");
        expect(CONFLICT_FORECASTS_DESCRIPTION).toContain("WILL have");
    });

    it("trajectory tool description contains PROHIBITED language patterns", () => {
        expect(TRAJECTORY_ANALYSIS_DESCRIPTION).toContain("PROHIBITED");
    });

    it("events tool description identifies data as HISTORICAL", () => {
        expect(CONFLICT_EVENTS_DESCRIPTION).toContain("HISTORICAL");
    });

    it("forecasts tool description identifies data as PREDICTIONS", () => {
        expect(CONFLICT_FORECASTS_DESCRIPTION).toContain("MODEL PREDICTIONS");
    });

    it("trajectory tool description identifies data as HEURISTIC", () => {
        expect(TRAJECTORY_ANALYSIS_DESCRIPTION).toContain("HEURISTIC");
    });
});

// ── Response metadata and text compliance ───────────────

function mockUcdpClient() {
    return {
        getEventsEnvelope: vi.fn().mockResolvedValue({
            data: [{ id: 1, best: 10, low: 5, high: 20, code_status: "Clear", country: "Test", conflict_name: "Test", side_a: "A", side_b: "B", type_of_violence: 1, date_start: "2025-01-01", date_end: "2025-01-02", latitude: 0, longitude: 0 }],
            totalCount: 1,
            provenance: {
                source: "UCDP", version: "25.1", releaseStatus: "stable",
                fetchedAt: new Date().toISOString(),
                citations: ["Sundberg & Melander 2013"],
                caveats: ["Fatality estimates have uncertainty"],
            },
            interpretationNotes: ["These are historical observations"],
        }),
        getCandidateEventsEnvelope: vi.fn().mockResolvedValue({
            data: [],
            totalCount: 0,
            provenance: {
                source: "UCDP", version: "26.0.3", releaseStatus: "candidate",
                fetchedAt: new Date().toISOString(),
                citations: ["Sundberg & Melander 2013"],
                caveats: ["Candidate data"],
            },
            interpretationNotes: ["These are historical observations"],
        }),
    } as any;
}

function mockViewsClient() {
    return {
        getCountryMonthEnvelope: vi.fn().mockResolvedValue({
            data: [{ country_id: 1, name: "Syria", isoab: "SYR", gwcode: 652, year: 2026, month: 4, month_id: 556, main_mean: 45.2, main_dich: 0.78, main_mean_ln: 3.81 }],
            totalCount: 1,
            provenance: {
                source: "VIEWS", version: "current", releaseStatus: "forecast",
                fetchedAt: new Date().toISOString(),
                citations: ["Hegre et al. 2021"],
                caveats: ["These are probabilistic forecasts", "Accuracy degrades with horizon"],
            },
            interpretationNotes: ["Model predictions, not facts"],
        }),
    } as any;
}

describe("Response provenance compliance (embedded in JSON content)", () => {
    it("conflict events JSON includes provenance with caveats", async () => {
        const result = await handleConflictEvents({}, mockUcdpClient());
        const json = JSON.parse(result.content[1].text);
        expect(json.provenance.caveats).toBeDefined();
        expect(json.provenance.caveats.length).toBeGreaterThan(0);
    });

    it("conflict events JSON includes provenance with citations", async () => {
        const result = await handleConflictEvents({}, mockUcdpClient());
        const json = JSON.parse(result.content[1].text);
        expect(json.provenance.citations).toBeDefined();
        expect(json.provenance.citations.length).toBeGreaterThan(0);
    });

    it("conflict forecasts JSON includes provenance with caveats", async () => {
        const result = await handleConflictForecasts({}, mockViewsClient());
        const json = JSON.parse(result.content[1].text);
        expect(json.provenance.caveats).toBeDefined();
        expect(json.provenance.caveats.length).toBeGreaterThan(0);
    });

    it("conflict forecasts JSON includes provenance with citations", async () => {
        const result = await handleConflictForecasts({}, mockViewsClient());
        const json = JSON.parse(result.content[1].text);
        expect(json.provenance.citations).toBeDefined();
        expect(json.provenance.citations.length).toBeGreaterThan(0);
    });

    it("trajectory response text includes caveats section", async () => {
        const result = await handleTrajectoryAnalysis(
            { country_iso: "SYR", gwno: 652 },
            mockUcdpClient(),
            mockViewsClient(),
        );
        expect(result.content[0].text).toContain("CAVEATS");
    });

    it("trajectory response text includes citation section", async () => {
        const result = await handleTrajectoryAnalysis(
            { country_iso: "SYR", gwno: 652 },
            mockUcdpClient(),
            mockViewsClient(),
        );
        expect(result.content[0].text).toContain("REQUIRED CITATION");
    });
});

describe("Response text block compliance", () => {
    it("conflict events text includes INTERPRETATION RULES header", async () => {
        const result = await handleConflictEvents({}, mockUcdpClient());
        const text = result.content[0].text;
        expect(text).toContain("INTERPRETATION RULES");
    });

    it("conflict events text includes REQUIRED CITATION footer", async () => {
        const result = await handleConflictEvents({}, mockUcdpClient());
        const text = result.content[0].text;
        expect(text).toContain("REQUIRED CITATION");
    });

    it("conflict events text includes HISTORICAL OBSERVATIONS data type", async () => {
        const result = await handleConflictEvents({}, mockUcdpClient());
        const text = result.content[0].text;
        expect(text).toContain("HISTORICAL OBSERVATIONS");
    });

    it("conflict forecasts text includes PROBABILISTIC FORECAST data type", async () => {
        const result = await handleConflictForecasts({}, mockViewsClient());
        const text = result.content[0].text;
        expect(text).toContain("PROBABILISTIC FORECAST");
    });

    it("conflict forecasts text includes INTERPRETATION RULES header", async () => {
        const result = await handleConflictForecasts({}, mockViewsClient());
        const text = result.content[0].text;
        expect(text).toContain("INTERPRETATION RULES");
    });

    it("conflict forecasts text includes REQUIRED CITATION footer", async () => {
        const result = await handleConflictForecasts({}, mockViewsClient());
        const text = result.content[0].text;
        expect(text).toContain("REQUIRED CITATION");
    });

    it("trajectory text includes DERIVED HEURISTIC data type", async () => {
        const result = await handleTrajectoryAnalysis(
            { country_iso: "SYR", gwno: 652 },
            mockUcdpClient(),
            mockViewsClient(),
        );
        const text = result.content[0].text;
        expect(text).toContain("DERIVED HEURISTIC");
    });
});

describe("formatResponseText structure", () => {
    const text = formatResponseText({
        toolName: "test_tool",
        dataType: "TEST DATA",
        source: "Test Source",
        version: "1.0",
        interpretationRules: ["Rule one", "Rule two"],
        resultSummary: "2 results",
        caveats: ["Caveat one"],
        citations: ["Citation one"],
    });

    it("includes tool name and data type in header", () => {
        expect(text).toContain("test_tool");
        expect(text).toContain("TEST DATA");
    });

    it("includes source and version", () => {
        expect(text).toContain("Test Source");
        expect(text).toContain("1.0");
    });

    it("includes numbered interpretation rules", () => {
        expect(text).toContain("1. Rule one");
        expect(text).toContain("2. Rule two");
    });

    it("includes caveats section", () => {
        expect(text).toContain("CAVEATS");
        expect(text).toContain("Caveat one");
    });

    it("includes citation section", () => {
        expect(text).toContain("REQUIRED CITATION");
        expect(text).toContain("Citation one");
    });
});
