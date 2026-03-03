/**
 * UCDP dataset versioning utilities.
 *
 * Stable GED: annual releases, format "YEAR.1" (e.g. "25.1")
 * GED Candidate: monthly releases on the 20th, format "YY.0.M" (e.g. "26.0.2")
 *
 * Years are 2-digit in the API (25 = 2025, 26 = 2026).
 */

/** The latest known stable GED version. */
export const LATEST_STABLE_VERSION = "25.1";

/**
 * Compute the latest expected GED Candidate version based on the current date.
 *
 * Candidate data is extracted and published on the 20th of each month.
 * Before the 20th, the previous month's data is the latest available.
 *
 * @param now - Date to compute from (default: current date)
 * @returns Version string like "26.0.2" (Feb 2026 candidate)
 */
export function latestCandidateVersion(now: Date = new Date()): string {
    let year = now.getFullYear() % 100; // 2-digit year per UCDP convention
    let month = now.getMonth() + 1; // 1-indexed

    if (now.getDate() < 20) {
        month -= 1;
        if (month < 1) {
            month = 12;
            year -= 1;
        }
    }

    return `${year}.0.${month}`;
}

/**
 * Generate a list of candidate versions to try, starting from the most recent
 * expected version and stepping backward. Useful for version probing when the
 * latest version may not be published yet.
 *
 * @param count - Number of versions to generate (default: 3)
 * @param now - Date to compute from (default: current date)
 * @returns Array of version strings, newest first
 */
export function candidateVersions(
    count = 3,
    now: Date = new Date(),
): string[] {
    const versions: string[] = [];
    let year = now.getFullYear() % 100;
    let month = now.getMonth() + 1;

    if (now.getDate() < 20) {
        month -= 1;
        if (month < 1) {
            month = 12;
            year -= 1;
        }
    }

    for (let i = 0; i < count; i++) {
        versions.push(`${year}.0.${month}`);
        month -= 1;
        if (month < 1) {
            month = 12;
            year -= 1;
        }
    }

    return versions;
}
