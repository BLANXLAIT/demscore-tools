#!/usr/bin/env node

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { UcdpClient } from "@demscore/ucdp";
import { ViewsClient } from "@demscore/views";
import {
    CONFLICT_EVENTS_DESCRIPTION,
    CONFLICT_FORECASTS_DESCRIPTION,
    TRAJECTORY_ANALYSIS_DESCRIPTION,
} from "./constants.js";
import { handleConflictEvents } from "./tools/conflict-events.js";
import { handleConflictForecasts } from "./tools/conflict-forecasts.js";
import { handleTrajectoryAnalysis } from "./tools/trajectory-analysis.js";

const server = new McpServer({
    name: "demscore",
    version: "0.1.0",
});

// Clients are initialized lazily to allow running without UCDP_TOKEN
// (forecast-only usage doesn't need it)
let ucdpClient: UcdpClient | undefined;
let viewsClient: ViewsClient | undefined;

function getUcdpClient(): UcdpClient {
    if (!ucdpClient) {
        const token = process.env.UCDP_TOKEN;
        if (!token) {
            throw new Error(
                "UCDP_TOKEN environment variable is required for conflict event queries",
            );
        }
        ucdpClient = new UcdpClient({ token });
    }
    return ucdpClient;
}

function getViewsClient(): ViewsClient {
    if (!viewsClient) {
        viewsClient = new ViewsClient();
    }
    return viewsClient;
}

// ── Register tools ──────────────────────────────────────

server.tool(
    "get_conflict_events",
    CONFLICT_EVENTS_DESCRIPTION,
    {
        country: z.array(z.number()).optional().describe("Gleditsch-Ward country codes to filter by"),
        start_date: z.string().optional().describe("Start date (YYYY-MM-DD) for filtering events"),
        end_date: z.string().optional().describe("End date (YYYY-MM-DD) for filtering events"),
        type_of_violence: z.array(z.number().int().min(1).max(3)).optional().describe("Violence type: 1=state-based, 2=non-state, 3=one-sided"),
        use_candidate: z.boolean().optional().describe("Use latest candidate (preliminary) data instead of stable release. Default: false."),
        page: z.number().int().optional().describe("Page number (1-indexed, default: 1)"),
        pagesize: z.number().int().optional().describe("Results per page (default: 100)"),
    },
    async (args) => {
        const result = await handleConflictEvents(args, getUcdpClient());
        return {
            content: result.content.map((c) => ({ type: "text" as const, text: c.text })),
        };
    },
);

server.tool(
    "get_conflict_forecasts",
    CONFLICT_FORECASTS_DESCRIPTION,
    {
        iso: z.array(z.string()).optional().describe("ISO alpha-3 country codes (e.g. ['SYR', 'IRQ'])"),
        gwno: z.array(z.number()).optional().describe("Gleditsch-Ward country numbers"),
        date_start: z.string().optional().describe("Forecast start date (YYYY-MM-DD)"),
        date_end: z.string().optional().describe("Forecast end date (YYYY-MM-DD)"),
        run: z.string().optional().describe("Forecast run ID (default: 'current')"),
        page: z.number().int().optional().describe("Page number (1-indexed)"),
        pagesize: z.number().int().optional().describe("Results per page (default: 1000)"),
    },
    async (args) => {
        const result = await handleConflictForecasts(args, getViewsClient());
        return {
            content: result.content.map((c) => ({ type: "text" as const, text: c.text })),
        };
    },
);

server.tool(
    "get_trajectory_analysis",
    TRAJECTORY_ANALYSIS_DESCRIPTION,
    {
        country_iso: z.string().describe("ISO alpha-3 country code (e.g. 'SYR')"),
        gwno: z.number().optional().describe("Gleditsch-Ward country number (alternative to country_iso)"),
    },
    async (args) => {
        const result = await handleTrajectoryAnalysis(
            args,
            getUcdpClient(),
            getViewsClient(),
        );
        return {
            content: result.content.map((c) => ({ type: "text" as const, text: c.text })),
        };
    },
);

// ── Start server ────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
