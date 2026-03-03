import { describe, it, expect } from "vitest";
import { latestCandidateVersion, candidateVersions } from "../versions.js";

describe("latestCandidateVersion", () => {
    it("returns current month after the 20th", () => {
        const result = latestCandidateVersion(new Date(2026, 2, 25)); // March 25
        expect(result).toBe("26.0.3");
    });

    it("returns previous month before the 20th", () => {
        const result = latestCandidateVersion(new Date(2026, 2, 10)); // March 10
        expect(result).toBe("26.0.2");
    });

    it("returns current month on the 20th", () => {
        const result = latestCandidateVersion(new Date(2026, 2, 20)); // March 20
        expect(result).toBe("26.0.3");
    });

    it("handles January before 20th (rolls back to December)", () => {
        const result = latestCandidateVersion(new Date(2026, 0, 5)); // Jan 5
        expect(result).toBe("25.0.12");
    });

    it("handles January after 20th", () => {
        const result = latestCandidateVersion(new Date(2026, 0, 25)); // Jan 25
        expect(result).toBe("26.0.1");
    });

    it("uses 2-digit years", () => {
        const result = latestCandidateVersion(new Date(2030, 5, 25)); // June 25, 2030
        expect(result).toBe("30.0.6");
    });
});

describe("candidateVersions", () => {
    it("returns 3 versions by default", () => {
        const versions = candidateVersions(3, new Date(2026, 2, 25));
        expect(versions).toEqual(["26.0.3", "26.0.2", "26.0.1"]);
    });

    it("handles year boundary", () => {
        const versions = candidateVersions(3, new Date(2026, 0, 25)); // Jan 25
        expect(versions).toEqual(["26.0.1", "25.0.12", "25.0.11"]);
    });

    it("before 20th starts from previous month", () => {
        const versions = candidateVersions(3, new Date(2026, 2, 10)); // March 10
        expect(versions).toEqual(["26.0.2", "26.0.1", "25.0.12"]);
    });

    it("supports custom count", () => {
        const versions = candidateVersions(6, new Date(2026, 2, 25));
        expect(versions).toHaveLength(6);
        expect(versions[5]).toBe("25.0.10");
    });
});
