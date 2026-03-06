#!/usr/bin/env node

/**
 * Reads vitest JSON output (guardrails-report.json) and generates
 * a markdown compliance report (guardrails-report.md).
 */

import { readFileSync, writeFileSync } from "node:fs";

const INPUT = "guardrails-report.json";
const OUTPUT = "guardrails-report.md";

let report;
try {
    const raw = readFileSync(INPUT, "utf-8");
    report = JSON.parse(raw);
} catch {
    // If JSON report doesn't exist, generate a minimal failure report
    const md = `# Guardrails Compliance Report
Generated: ${new Date().toISOString()}
Status: **FAIL**

No test results found. The guardrails compliance tests may not have run.
`;
    writeFileSync(OUTPUT, md);
    console.log(`Wrote fallback report to ${OUTPUT}`);
    process.exit(0);
}

const suites = report.testResults ?? [];
let totalPassed = 0;
let totalFailed = 0;
const sections = {
    "SDK Layer (UCDP)": [],
    "SDK Layer (VIEWS)": [],
    "MCP Server Layer": [],
};

for (const suite of suites) {
    let sectionKey;
    if (suite.name?.includes("packages/sdk")) {
        sectionKey = "SDK Layer (UCDP)";
    } else if (suite.name?.includes("packages/views")) {
        sectionKey = "SDK Layer (VIEWS)";
    } else if (suite.name?.includes("packages/mcp-server")) {
        sectionKey = "MCP Server Layer";
    } else {
        continue;
    }

    for (const test of suite.assertionResults ?? []) {
        const passed = test.status === "passed";
        if (passed) totalPassed++;
        else totalFailed++;

        const icon = passed ? "[x]" : "[ ]";
        const title = test.ancestorTitles?.length
            ? `${test.ancestorTitles.join(" > ")} > ${test.title}`
            : test.title;
        sections[sectionKey].push(`- ${icon} ${title}`);
    }
}

const total = totalPassed + totalFailed;
const status = totalFailed === 0 ? "PASS" : "FAIL";

let md = `# Guardrails Compliance Report
Generated: ${new Date().toISOString()}
Status: **${status}**

`;

for (const [section, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    md += `## ${section}\n${items.join("\n")}\n\n`;
}

md += `## Summary\n${totalPassed}/${total} checks passed\n`;

writeFileSync(OUTPUT, md);
console.log(`Wrote compliance report to ${OUTPUT} (${status}: ${totalPassed}/${total})`);
