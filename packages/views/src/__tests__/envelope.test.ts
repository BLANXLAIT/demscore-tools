import { describe, it, expect } from "vitest";
import {
    createViewsEnvelope,
    VIEWS_CITATION,
    VIEWS_CAVEATS,
    VIEWS_INTERPRETATION_NOTES,
} from "../envelope.js";

describe("VIEWS DataEnvelope compliance", () => {
    const envelope = createViewsEnvelope(
        [{ country_id: 1, name: "Syria" }],
        "current",
        500,
    );

    it("releaseStatus is always 'forecast'", () => {
        expect(envelope.provenance.releaseStatus).toBe("forecast");
    });

    it("includes non-empty provenance citations", () => {
        expect(envelope.provenance.citations).toHaveLength(1);
        expect(envelope.provenance.citations[0]).toBe(VIEWS_CITATION);
    });

    it("includes non-empty provenance caveats", () => {
        expect(envelope.provenance.caveats.length).toBeGreaterThan(0);
        expect(envelope.provenance.caveats).toEqual(VIEWS_CAVEATS);
    });

    it("interpretationNotes include forecast hedging language", () => {
        expect(envelope.interpretationNotes.length).toBeGreaterThan(0);
        const joined = envelope.interpretationNotes.join(" ");
        expect(joined).toContain("MODEL PREDICTIONS");
        expect(joined).toContain("NEVER");
        expect(joined).toContain("conditional");
    });

    it("caveats mention model limitations", () => {
        const joined = envelope.provenance.caveats.join(" ");
        expect(joined).toContain("PROBABILISTIC FORECASTS");
        expect(joined).toContain("statistical model");
    });

    it("caveats mention horizon degradation", () => {
        const joined = envelope.provenance.caveats.join(" ");
        expect(joined).toContain("DEGRADES");
        expect(joined).toContain("horizon");
    });

    it("includes VIEWS citation", () => {
        expect(envelope.provenance.citations).toContain(VIEWS_CITATION);
    });

    it("has a valid ISO 8601 fetchedAt timestamp", () => {
        const date = new Date(envelope.provenance.fetchedAt);
        expect(date.toISOString()).toBe(envelope.provenance.fetchedAt);
    });

    it("preserves data and totalCount", () => {
        expect(envelope.data).toEqual([{ country_id: 1, name: "Syria" }]);
        expect(envelope.totalCount).toBe(500);
    });

    it("identifies source as VIEWS/PRIO", () => {
        expect(envelope.provenance.source).toContain("VIEWS");
        expect(envelope.provenance.source).toContain("Peace Research Institute Oslo");
    });
});
