import { describe, it, expect } from "vitest";
import {
    createUcdpEnvelope,
    UCDP_CITATION,
    UCDP_CANDIDATE_CAVEATS,
    UCDP_STABLE_CAVEATS,
    UCDP_INTERPRETATION_NOTES,
} from "../envelope.js";

describe("UCDP DataEnvelope compliance", () => {
    const stableEnvelope = createUcdpEnvelope([{ id: 1 }], "25.1", 100);
    const candidateEnvelope = createUcdpEnvelope([{ id: 2 }], "26.0.3", 50);

    it("includes non-empty provenance citations", () => {
        expect(stableEnvelope.provenance.citations).toHaveLength(1);
        expect(stableEnvelope.provenance.citations[0]).toBe(UCDP_CITATION);
        expect(candidateEnvelope.provenance.citations[0]).toBe(UCDP_CITATION);
    });

    it("includes non-empty provenance caveats", () => {
        expect(stableEnvelope.provenance.caveats.length).toBeGreaterThan(0);
        expect(candidateEnvelope.provenance.caveats.length).toBeGreaterThan(0);
    });

    it("sets releaseStatus to 'stable' for stable versions", () => {
        expect(stableEnvelope.provenance.releaseStatus).toBe("stable");
    });

    it("sets releaseStatus to 'candidate' for candidate versions", () => {
        expect(candidateEnvelope.provenance.releaseStatus).toBe("candidate");
    });

    it("never sets releaseStatus to 'forecast' for UCDP data", () => {
        expect(stableEnvelope.provenance.releaseStatus).not.toBe("forecast");
        expect(candidateEnvelope.provenance.releaseStatus).not.toBe("forecast");
    });

    it("includes non-empty interpretationNotes", () => {
        expect(stableEnvelope.interpretationNotes.length).toBeGreaterThan(0);
        expect(stableEnvelope.interpretationNotes).toEqual(UCDP_INTERPRETATION_NOTES);
    });

    it("has a valid ISO 8601 fetchedAt timestamp", () => {
        const date = new Date(stableEnvelope.provenance.fetchedAt);
        expect(date.toISOString()).toBe(stableEnvelope.provenance.fetchedAt);
    });

    it("candidate envelope includes candidate-specific caveats", () => {
        for (const caveat of UCDP_CANDIDATE_CAVEATS) {
            expect(candidateEnvelope.provenance.caveats).toContain(caveat);
        }
    });

    it("stable envelope includes only stable caveats", () => {
        for (const caveat of UCDP_STABLE_CAVEATS) {
            expect(stableEnvelope.provenance.caveats).toContain(caveat);
        }
        for (const caveat of UCDP_CANDIDATE_CAVEATS) {
            expect(stableEnvelope.provenance.caveats).not.toContain(caveat);
        }
    });

    it("preserves data and totalCount", () => {
        expect(stableEnvelope.data).toEqual([{ id: 1 }]);
        expect(stableEnvelope.totalCount).toBe(100);
    });

    it("identifies source as UCDP", () => {
        expect(stableEnvelope.provenance.source).toContain("UCDP");
    });
});
