import { ViewsClient, type ViewsQueryOptions, type CountryMonthRow } from "@demscore/views";
import {
    VIEWS_CITATION,
    formatResponseText,
} from "../constants.js";

export async function handleConflictForecasts(
    args: Record<string, unknown>,
    client: ViewsClient,
): Promise<{ content: Array<{ type: string; text: string }>; metadata: Record<string, unknown> }> {
    const options: ViewsQueryOptions = {};
    if (args.iso) options.iso = args.iso as string[];
    if (args.gwno) options.gwno = args.gwno as number[];
    if (args.date_start) options.date_start = args.date_start as string;
    if (args.date_end) options.date_end = args.date_end as string;
    if (args.page) options.page = args.page as number;
    if (args.pagesize) options.pagesize = args.pagesize as number;

    const run = (args.run as string) ?? "current";
    const envelope = await client.getCountryMonthEnvelope(options, run);

    const summary = `${envelope.data.length} country-month forecast rows returned`;

    const textBlock = formatResponseText({
        toolName: "get_conflict_forecasts",
        dataType: "PROBABILISTIC FORECAST",
        source: envelope.provenance.source,
        version: envelope.provenance.version,
        interpretationRules: [
            "These are MODEL PREDICTIONS, NOT observed facts.",
            "NEVER say 'will have N fatalities' — use 'the model predicts' or 'the forecast suggests'.",
            "Forecast accuracy DEGRADES with time horizon — always note how far ahead.",
            "main_mean is a statistical expectation, NOT a guaranteed outcome.",
            "main_dich is a PROBABILITY (0-1), not a binary prediction.",
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
                        forecasts: envelope.data.map(summarizeForecast),
                        totalCount: envelope.totalCount,
                        provenance: envelope.provenance,
                    },
                    null,
                    2,
                ),
            },
        ],
        metadata: {
            dataType: "PROBABILISTIC FORECAST",
            caveats: envelope.provenance.caveats,
            required_citation: VIEWS_CITATION,
            forecastRun: run,
        },
    };
}

function summarizeForecast(row: CountryMonthRow) {
    return {
        country_id: row.country_id,
        name: row.name,
        isoab: row.isoab,
        gwcode: row.gwcode,
        year: row.year,
        month: row.month,
        month_id: row.month_id,
        main_mean: row.main_mean,
        main_dich: row.main_dich,
        main_mean_ln: row.main_mean_ln,
    };
}
