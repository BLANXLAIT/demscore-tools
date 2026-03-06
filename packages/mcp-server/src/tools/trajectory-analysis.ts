import { UcdpClient, type GedEventRaw } from "@demscore/ucdp";
import { ViewsClient, type CountryMonthRow } from "@demscore/views";
import {
    UCDP_CITATION,
    VIEWS_CITATION,
    TOOLKIT_CITATION,
    formatResponseText,
} from "../constants.js";

export async function handleTrajectoryAnalysis(
    args: Record<string, unknown>,
    ucdpClient: UcdpClient,
    viewsClient: ViewsClient,
): Promise<{ content: Array<{ type: string; text: string }>; metadata: Record<string, unknown> }> {
    const iso = args.country_iso as string;
    const gwno = args.gwno as number | undefined;

    // Fetch VIEWS forecasts for country
    const viewsEnvelope = await viewsClient.getCountryMonthEnvelope(
        { iso: [iso] },
        "current",
    );

    // Fetch recent UCDP candidate events if gwno is available
    let ucdpEvents: GedEventRaw[] = [];
    let ucdpVersion = "N/A";
    if (gwno) {
        const ucdpEnvelope = await ucdpClient.getCandidateEventsEnvelope({
            Country: [gwno],
        });
        ucdpEvents = ucdpEnvelope.data;
        ucdpVersion = ucdpEnvelope.provenance.version;
    }

    // Compute trajectory heuristic
    const trajectory = computeTrajectory(ucdpEvents, viewsEnvelope.data);

    const textBlock = formatResponseText({
        toolName: "get_trajectory_analysis",
        dataType: "DERIVED HEURISTIC",
        source: "demscore-tools trajectory analysis",
        version: `UCDP ${ucdpVersion} + VIEWS ${viewsEnvelope.provenance.version}`,
        interpretationRules: [
            "Trajectory labels (escalating/de-escalating/stable) are HEURISTIC COMPUTATIONS by this toolkit.",
            "These are NOT official UCDP or VIEWS assessments.",
            "Historical (UCDP) and forecast (VIEWS) data use DIFFERENT methodologies.",
            "Do NOT add observed counts to predicted values.",
            "Near-term forecast portions are more reliable than long-range.",
        ],
        resultSummary: `${iso}: ${trajectory.classification} (confidence: ${trajectory.confidence})`,
        caveats: [
            "Trajectory classification is a simplified heuristic, not a rigorous statistical assessment.",
            "UCDP and VIEWS use different counting methodologies — direct comparison has limitations.",
            "This analysis does not account for policy changes, peace processes, or other intervening factors.",
            ...viewsEnvelope.provenance.caveats.slice(0, 2),
        ],
        citations: [UCDP_CITATION, VIEWS_CITATION, TOOLKIT_CITATION],
    });

    return {
        content: [
            { type: "text", text: textBlock },
            {
                type: "text",
                text: JSON.stringify(
                    {
                        country: iso,
                        trajectory,
                        historical: {
                            eventCount: ucdpEvents.length,
                            dataSource: "UCDP",
                            version: ucdpVersion,
                        },
                        forecast: {
                            monthCount: viewsEnvelope.data.length,
                            dataSource: "VIEWS",
                            run: viewsEnvelope.provenance.version,
                        },
                    },
                    null,
                    2,
                ),
            },
        ],
        metadata: {
            dataType: "DERIVED HEURISTIC",
            caveats: [
                "Trajectory labels are heuristic, not official assessments.",
                "Historical and forecast data use different methodologies.",
                "Do not mix observed and predicted values arithmetically.",
            ],
            required_citation: `${UCDP_CITATION} AND ${VIEWS_CITATION} AND ${TOOLKIT_CITATION}`,
        },
    };
}

interface TrajectoryResult {
    classification: "escalating" | "de-escalating" | "stable" | "insufficient-data";
    confidence: "low" | "medium" | "high";
    historicalTrend: string;
    forecastTrend: string;
}

function computeTrajectory(
    events: GedEventRaw[],
    forecasts: CountryMonthRow[],
): TrajectoryResult {
    if (events.length === 0 && forecasts.length === 0) {
        return {
            classification: "insufficient-data",
            confidence: "low",
            historicalTrend: "No historical events available",
            forecastTrend: "No forecast data available",
        };
    }

    // Historical trend: compare first half vs second half of events by fatalities
    let historicalTrend = "stable";
    if (events.length >= 4) {
        const mid = Math.floor(events.length / 2);
        const firstHalf = events.slice(0, mid);
        const secondHalf = events.slice(mid);
        const firstAvg = avg(firstHalf.map((e) => e.best));
        const secondAvg = avg(secondHalf.map((e) => e.best));

        if (secondAvg > firstAvg * 1.25) historicalTrend = "escalating";
        else if (secondAvg < firstAvg * 0.75) historicalTrend = "de-escalating";
    }

    // Forecast trend: compare early vs late forecast months
    let forecastTrend = "stable";
    if (forecasts.length >= 4) {
        const mid = Math.floor(forecasts.length / 2);
        const earlyMonths = forecasts.slice(0, mid);
        const lateMonths = forecasts.slice(mid);
        const earlyAvg = avg(
            earlyMonths.map((f) => (f.main_mean as number) ?? 0),
        );
        const lateAvg = avg(
            lateMonths.map((f) => (f.main_mean as number) ?? 0),
        );

        if (lateAvg > earlyAvg * 1.25) forecastTrend = "escalating";
        else if (lateAvg < earlyAvg * 0.75) forecastTrend = "de-escalating";
    }

    // Combined classification
    let classification: TrajectoryResult["classification"] = "stable";
    if (historicalTrend === "escalating" && forecastTrend === "escalating") {
        classification = "escalating";
    } else if (
        historicalTrend === "de-escalating" &&
        forecastTrend === "de-escalating"
    ) {
        classification = "de-escalating";
    } else if (historicalTrend === "escalating" || forecastTrend === "escalating") {
        classification = "escalating";
    } else if (
        historicalTrend === "de-escalating" ||
        forecastTrend === "de-escalating"
    ) {
        classification = "de-escalating";
    }

    // Confidence based on data availability
    const confidence: TrajectoryResult["confidence"] =
        events.length >= 10 && forecasts.length >= 6
            ? "medium"
            : "low";

    return {
        classification,
        confidence,
        historicalTrend: `${historicalTrend} (based on ${events.length} events)`,
        forecastTrend: `${forecastTrend} (based on ${forecasts.length} forecast months)`,
    };
}

function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}
