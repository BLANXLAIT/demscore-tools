import { UcdpClient, type GedEventFilters, type GedEventRaw } from "@demscore/ucdp";
import { formatResponseText } from "../constants.js";

export async function handleConflictEvents(
    args: Record<string, unknown>,
    client: UcdpClient,
): Promise<{ content: Array<{ type: string; text: string }> }> {
    const filters: GedEventFilters = {};
    if (args.country) filters.Country = args.country as number[];
    if (args.start_date) filters.StartDate = args.start_date as string;
    if (args.end_date) filters.EndDate = args.end_date as string;
    if (args.type_of_violence)
        filters.TypeOfViolence = args.type_of_violence as number[];
    if (args.page) filters.page = args.page as number;
    if (args.pagesize) filters.pagesize = args.pagesize as number;

    const useCandidate = args.use_candidate === true;
    const envelope = useCandidate
        ? await client.getCandidateEventsEnvelope(filters)
        : await client.getEventsEnvelope(filters);

    const summary = `${envelope.data.length} events returned (${envelope.totalCount} total matching)`;

    const textBlock = formatResponseText({
        toolName: "get_conflict_events",
        dataType: "HISTORICAL OBSERVATIONS",
        source: envelope.provenance.source,
        version: envelope.provenance.version,
        interpretationRules: [
            "These are records of PAST conflict events, not predictions.",
            "Fatality figures are ESTIMATES — always report best/low/high range.",
            "code_status 'Clear' = highest confidence; other values = flagged for review.",
            ...(useCandidate
                ? ["This is CANDIDATE data — preliminary, not yet peer-reviewed."]
                : []),
        ],
        resultSummary: summary,
        caveats: envelope.provenance.caveats,
        citations: envelope.provenance.citations,
    });

    return {
        content: [
            { type: "text", text: textBlock },
            {
                type: "text",
                text: JSON.stringify(
                    {
                        events: envelope.data.map(summarizeEvent),
                        totalCount: envelope.totalCount,
                        provenance: envelope.provenance,
                    },
                    null,
                    2,
                ),
            },
        ],
    };
}

function summarizeEvent(event: GedEventRaw) {
    return {
        id: event.id,
        date_start: event.date_start,
        date_end: event.date_end,
        country: event.country,
        conflict_name: event.conflict_name,
        side_a: event.side_a,
        side_b: event.side_b,
        type_of_violence: event.type_of_violence,
        best_fatality_estimate: event.best,
        low_fatality_estimate: event.low,
        high_fatality_estimate: event.high,
        code_status: event.code_status,
        latitude: event.latitude,
        longitude: event.longitude,
    };
}
