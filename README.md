# UCDP Tools

TypeScript SDK, MCP Server, and Claude Code Skill for the [UCDP](https://ucdp.uu.se/) (Uppsala Conflict Data Program) API.

Access conflict event data, armed conflict datasets, battle-related deaths, and more from the world's most widely used data source on organized violence.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@ucdp/sdk`](packages/sdk) | TypeScript client for the UCDP API | Beta |
| [`@ucdp/mcp-server`](packages/mcp-server) | MCP server for LLM tool use | Planned |
| [`packages/skill`](packages/skill) | Claude Code skill | Planned |

## Quick Start

```typescript
import { UcdpClient } from "@ucdp/sdk";

const client = new UcdpClient({ token: "your-api-token" });

// Get the latest monthly conflict events (auto-probes version)
const { Result: events } = await client.getCandidateEvents({
    StartDate: "2025-01-01",
    TypeOfViolence: 1, // State-based conflicts
});

for (const event of events) {
    console.log(`${event.date_start} | ${event.country} | ${event.dyad_name} | ${event.best} deaths`);
}

// Paginate through all events
for await (const event of client.getEventsAll({ Country: 365 })) {
    console.log(event.source_headline);
}
```

## UCDP API Datasets

| Dataset | Method | Description |
|---------|--------|-------------|
| GED Events | `getEvents()` | Georeferenced events (stable annual) |
| GED Candidate | `getCandidateEvents()` | Monthly-updated events (auto-probes version) |
| Armed Conflicts | `getArmedConflicts()` | UCDP/PRIO conflict-level data |
| Dyadic | `getDyadic()` | Dyad-level conflict data |
| Non-State | `getNonState()` | Non-state conflict data |
| One-Sided Violence | `getOneSided()` | One-sided violence data |
| Battle Deaths | `getBattleDeaths()` | Battle-related death estimates |

Every method has a paginating `*All()` variant that returns an `AsyncGenerator`.

## UCDP API Access

Request an API token at the [UCDP API docs](https://ucdp.uu.se/apidocs/). Rate limit: 5,000 requests/day.

## Versioning Notes

- **Stable GED**: Annual release, format `YEAR.1` (e.g. `25.1`). Finalized data through prior year.
- **GED Candidate**: Monthly release on the 20th, format `YY.0.M` (e.g. `26.0.2`). The SDK auto-probes for the latest available version.

## License

MIT
