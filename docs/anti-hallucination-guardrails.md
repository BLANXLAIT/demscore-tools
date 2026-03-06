# Anti-Hallucination Guardrails for Conflict Data

A design document describing how demscore-tools prevents LLM hallucination when presenting armed conflict data and forecasts.

---

## 1. Problem Statement

demscore-tools provides TypeScript SDKs for two authoritative conflict data sources: the Uppsala Conflict Data Program (UCDP), which publishes georeferenced observations of armed conflict events, and the VIEWS forecasting system from the Peace Research Institute Oslo, which produces probabilistic predictions of future political violence.

Both datasets deal with human fatalities. Misrepresentation is not merely embarrassing — it can distort policy decisions, undermine academic credibility, and cause real harm to affected populations.

Large language models introduce specific risks when they consume this data:

- **Probabilistic forecasts presented as certainties.** A VIEWS `main_mean` of 45 is a statistical expectation from an ensemble model, not a statement that 45 people will die. LLMs naturally produce declarative sentences and will strip the conditional framing unless forced to preserve it.

- **Uncertainty ranges silently dropped.** UCDP fatality estimates always carry `best`, `low`, and `high` values. An LLM summarizing "150 fatalities" without the range (80--230) manufactures false precision from inherently uncertain data.

- **Temporal confusion between past and future.** UCDP records historical observations. VIEWS produces forward-looking predictions. An LLM that mixes tenses or fails to label the data source can present model output as observed fact.

- **Attribution and provenance stripped.** Academic datasets require citation. Preliminary "candidate" UCDP data requires explicit caveats about its unreviewed status. Without structural enforcement, LLMs will omit both.

- **Causal fabrication from correlation.** Neither dataset establishes causation. An LLM that writes "conflict increased because of..." when the data only shows a temporal pattern is hallucinating a causal relationship.

These failure modes are well-documented in grounded generation research. The challenge is building guardrails that survive the full path from API response to LLM-generated text — across SDKs, tool servers, and prompt instructions.

---

## 2. Threat Model

We categorize hallucination threats by type, with concrete examples drawn from the UCDP and VIEWS data models.

### Factual Escalation

The LLM inflates or presents point estimates as definitive.

- **Trigger:** VIEWS returns `main_mean: 500` for a country-month.
- **Hallucination:** "VIEWS predicts 500 fatalities next month."
- **Reality:** The model mean is 500, but the implicit uncertainty range could span 100--2000. The value is a statistical expectation, not a prediction of what will happen.

### Temporal Confusion

The LLM conflates historical observations with future predictions.

- **Trigger:** A query returns both UCDP events from 2024 and VIEWS forecasts for 2026.
- **Hallucination:** "There were 300 fatalities in 2024 and 450 in 2026" — presented as parallel facts.
- **Reality:** The 2024 figure is an observed estimate; the 2026 figure is a model prediction with degrading accuracy over time.

### False Precision

The LLM presents estimates as exact counts.

- **Trigger:** UCDP event with `best: 347, low: 200, high: 500`.
- **Hallucination:** "Exactly 347 people were killed."
- **Reality:** 347 is UCDP's best estimate within a range. The word "exactly" is never appropriate for conflict fatality data.

### Attribution Stripping

The LLM presents data without source, version, or methodology context.

- **Trigger:** Any data presentation.
- **Hallucination:** "There were 12 conflict events in the region last quarter."
- **Reality:** Without identifying UCDP GED v24.1 (candidate), the user cannot assess data quality, recency, or reliability.

### Causal Fabrication

The LLM manufactures causal explanations from temporal or spatial patterns.

- **Trigger:** UCDP data shows increasing fatalities in a region over three quarters.
- **Hallucination:** "Conflict increased because of the breakdown in peace negotiations."
- **Reality:** The data shows a temporal pattern. Causation requires analysis that neither UCDP nor VIEWS provides.

### Candidate-as-Final

The LLM presents preliminary data as peer-reviewed.

- **Trigger:** UCDP candidate data (monthly preliminary release).
- **Hallucination:** "According to UCDP's verified data, there were 85 events."
- **Reality:** Candidate data has not been peer-reviewed. Events may be reclassified, merged, or removed in the annual stable release.

---

## 3. Research Findings

The guardrail design draws on established patterns in grounded generation, structured data interchange, and domain-specific best practices.

### Grounded Generation

Citation-grounded architectures — where every LLM claim must trace to a specific data field — achieve near-zero hallucination rates on structured data tasks. The key insight is that hallucination is a retrieval problem: if the model is forced to ground every assertion in a provided data structure, fabrication becomes structurally difficult.

demscore-tools applies this by co-locating interpretation rules with the data itself. An LLM cannot access a fatality count without also receiving the caveats that govern how it should be presented.

### Schema-as-Documentation

JSON Schema `description` fields serve as inline documentation for LLM tool callers. When a property is described as "statistical expectation from ensemble model, NOT a prediction of what will happen," the model receives this guidance at the point of data access. This is more effective than relying on system prompts alone, which can be displaced by long contexts.

### Structured Content Envelopes

Wrapping raw data in metadata envelopes that carry provenance, freshness, and confidence information ensures that context travels with the data. The envelope pattern is drawn from data engineering best practices (event sourcing, audit logging) adapted for LLM consumption.

### Redundant Guardrails

A single guardrail layer is insufficient. Caveats must appear in:
1. The SDK response envelope (data layer)
2. The MCP tool description (tool layer)
3. The MCP response text (response layer)
4. The skill instructions (prompt layer)

If any one layer is ignored or truncated, the others still carry the guidance.

### MCP Specification Mechanisms

The Model Context Protocol (2025-06-18 specification) provides several mechanisms for structured guardrails:

- **Tool `description`**: Free text that the model reads before deciding how to use a tool. We embed interpretation rules, prohibited language, and attribution requirements here.
- **`content` blocks**: Text and structured data returned alongside tool results. We use text blocks to inject caveats and citations into every response.
- **Content `annotations`**: Metadata on content blocks signaling priority and audience.

### UCDP Best Practices

- Fatalities always carry three estimates: `best` (most likely), `low` (minimum), `high` (maximum). Reporting only `best` without the range is methodologically incorrect.
- `code_status` signals data confidence: `Clear` is highest; `Check Deaths`, `Check Dyad`, `Check Type of Violence`, and `Low Confidence` indicate events flagged during coding.
- Candidate data (version strings containing `.0.`) is preliminary. Stable releases are annual and peer-reviewed.

### VIEWS Best Practices

- `main_mean` is the ensemble model's expected fatality count — a statistical expectation, not a point prediction.
- `main_dich` is the probability of 25 or more battle-related deaths — a probability between 0 and 1, not a binary classification.
- Forecast accuracy degrades with time horizon. Near-term (1--3 months) is substantially more reliable than long-range (12+ months).
- Forecasts reflect historical patterns and do not account for future policy changes, peace agreements, or other intervening events.

---

## 4. Three-Layer Defense Design

### Layer 1: SDK Envelopes

Every API response is wrapped in a `DataEnvelope<T>` that carries provenance metadata, citations, caveats, and interpretation notes alongside the raw data. An LLM consuming this data cannot access the records without also seeing the guardrails.

**Envelope interface** (shared structure across both SDKs):

```typescript
export interface DataProvenance {
    source: string;
    version: string;
    releaseStatus: "candidate" | "stable" | "forecast";
    fetchedAt: string;
    citations: string[];
    caveats: string[];
}

export interface DataEnvelope<T> {
    data: T[];
    provenance: DataProvenance;
    totalCount?: number;
    interpretationNotes: string[];
}
```

**UCDP envelope factory** (`packages/sdk/src/envelope.ts`):

```typescript
export const UCDP_INTERPRETATION_NOTES: string[] = [
    "These are HISTORICAL OBSERVATIONS of past conflict events, not predictions.",
    "Fatality figures are ESTIMATES — always report the best/low/high range, never a single number alone.",
    "The 'best' estimate is UCDP's most likely figure, not a confirmed count.",
    "code_status indicates data confidence: 'Clear' is highest confidence; other values signal review flags.",
    "When citing this data, attribute to UCDP and include the dataset version.",
];

export function createUcdpEnvelope<T>(
    data: T[],
    version: string,
    totalCount?: number,
): DataEnvelope<T> {
    const isCandidate = version.includes(".0.");

    return {
        data,
        provenance: {
            source: "Uppsala Conflict Data Program (UCDP)",
            version,
            releaseStatus: isCandidate ? "candidate" : "stable",
            fetchedAt: new Date().toISOString(),
            citations: [UCDP_CITATION],
            caveats: isCandidate
                ? [...UCDP_CANDIDATE_CAVEATS, ...UCDP_STABLE_CAVEATS]
                : UCDP_STABLE_CAVEATS,
        },
        totalCount,
        interpretationNotes: UCDP_INTERPRETATION_NOTES,
    };
}
```

**VIEWS envelope factory** (`packages/views/src/envelope.ts`):

```typescript
export const VIEWS_INTERPRETATION_NOTES: string[] = [
    "These are MODEL PREDICTIONS, not facts. NEVER say 'Country X WILL have N fatalities.'",
    "ALWAYS use conditional language: 'The VIEWS model estimates...', 'The forecast suggests...'",
    "Forecast reliability DEGRADES with time horizon — always state how far into the future a prediction extends.",
    "NEVER present main_mean as a precise count. It is a statistical expectation with substantial uncertainty.",
    "main_dich is a PROBABILITY (0-1) of >=25 BRDs, not a binary yes/no prediction.",
    "PROHIBITED language: 'will have', 'there will be', 'is going to experience' — use 'is predicted to', 'the model estimates', 'the forecast indicates'.",
    "When citing this data, attribute to VIEWS/PRIO and include the forecast run identifier.",
];

export function createViewsEnvelope<T>(
    data: T[],
    run: string,
    totalCount?: number,
): DataEnvelope<T> {
    return {
        data,
        provenance: {
            source: "VIEWS Forecasting (Peace Research Institute Oslo)",
            version: run,
            releaseStatus: "forecast",
            fetchedAt: new Date().toISOString(),
            citations: [VIEWS_CITATION],
            caveats: VIEWS_CAVEATS,
        },
        totalCount,
        interpretationNotes: VIEWS_INTERPRETATION_NOTES,
    };
}
```

Key design decisions:

- **`releaseStatus` is typed, not free-form.** UCDP data is `"candidate"` or `"stable"`; VIEWS data is always `"forecast"`. This prevents ambiguity at the type level.
- **Candidate detection is automatic.** UCDP version strings containing `.0.` indicate candidate releases. The SDK infers this so callers cannot forget to set the flag.
- **Caveats are cumulative.** Candidate data receives both candidate-specific and stable caveats, since it carries all the uncertainty of stable data plus additional preliminary-data risks.
- **Interpretation notes use imperative language.** Phrases like "NEVER say" and "ALWAYS use" are deliberate — LLMs respond more reliably to direct instructions than to suggestions.

### Layer 2: MCP Server

The MCP server exposes UCDP and VIEWS data as tools. Each tool definition carries guardrails in three places:

**Tool description** — read by the model before it decides how to call the tool and how to present results:

```
UCDP Georeferenced Event Data — historical observations of armed conflict.

INTERPRETATION RULES:
- These are OBSERVED EVENTS, not predictions
- Fatalities are ESTIMATES with best/low/high ranges
- NEVER present 'best' without the uncertainty range
- code_status other than 'Clear' means the event is flagged

PROHIBITED:
- "confirmed N deaths" — use "estimated N fatalities (range: low-high)"
- Presenting candidate data without noting preliminary status

REQUIRED ATTRIBUTION:
- Cite: Sundberg & Melander 2013
- State dataset version and release status
```

**Response content blocks** — injected into every tool result so the model sees caveats alongside the data:

```
[DATA TYPE: UCDP Historical Observations — NOT predictions]
[RELEASE: Candidate (preliminary, not peer-reviewed)]
[CAVEATS: Fatality estimates may be revised. Events may be reclassified.]
[CITATION: Sundberg & Melander 2013, UCDP GED v25.0.1]
```

The combination of description-level rules and response-level caveats means that even if the model skips the tool description on subsequent calls, the response itself still carries the guardrails.

### Layer 3: Skill Instructions

The Claude Code skill (`packages/skill/skill.md`) defines 8 mandatory rules that govern any response using conflict data. These rules operate at the prompt level — the final layer before the model generates text.

The 8 rules:

1. **Distinguish historical data from forecasts.** UCDP is past tense, observed. VIEWS is conditional, probabilistic.
2. **Uncertainty is non-negotiable.** Never present a single point estimate without its range.
3. **Prohibited language patterns.** Explicit table of banned phrasings and their replacements.
4. **Forecast horizon matters.** Always state how far ahead a VIEWS prediction extends, with confidence framing that degrades by distance.
5. **Trajectory classifications are heuristics.** Labels like "Escalating" are toolkit-derived, not official UCDP or VIEWS assessments.
6. **Always cite sources.** Every response includes Sundberg & Melander 2013, Hegre et al. 2021, and demscore-tools attribution as applicable.
7. **Data freshness.** State version, release status, and recency.
8. **What you cannot do.** No extrapolation beyond model outputs, no arithmetic mixing of observed and predicted values, no causal claims, no precision inflation, no country-level generalizations from sub-national data.

The skill also provides a **response template** with five sections (Summary, Key Findings, Data Table, Caveats, Sources) that structurally forces the inclusion of uncertainty ranges, source attribution, and limitation disclosures.

### How the Layers Interact

```
API Response
    |
    v
SDK Envelope (Layer 1)
    - provenance.releaseStatus: "candidate"
    - provenance.caveats: ["This is CANDIDATE data...", ...]
    - interpretationNotes: ["These are HISTORICAL OBSERVATIONS...", ...]
    |
    v
MCP Tool Response (Layer 2)
    - Tool description: interpretation rules, prohibited language
    - Response text: data type label, caveats, citation
    |
    v
Skill Instructions (Layer 3)
    - 8 mandatory rules
    - Prohibited/required language patterns
    - Response template with uncertainty columns
    |
    v
LLM-Generated Text
    - Grounded in envelope data
    - Constrained by tool description
    - Formatted per skill template
```

Each layer is independently sufficient to prevent the most dangerous hallucinations. Together, they provide defense in depth — if the model ignores one layer, the others still constrain its output.

---

## 5. Guardrails Compliance Testing

Automated tests verify that each layer of the defense is correctly implemented and that guardrails are not accidentally removed during development.

### SDK Envelope Tests

- Every `DataEnvelope` returned by `createUcdpEnvelope` and `createViewsEnvelope` has non-empty `citations`, `caveats`, and `interpretationNotes` arrays.
- UCDP candidate versions (containing `.0.`) produce `releaseStatus: "candidate"` with candidate-specific caveats.
- UCDP stable versions produce `releaseStatus: "stable"`.
- VIEWS envelopes always produce `releaseStatus: "forecast"`.
- `fetchedAt` is a valid ISO 8601 timestamp.

### MCP Tool Description Tests

- Every tool description contains the string `INTERPRETATION RULES`.
- Every UCDP tool description contains `OBSERVED` or `historical`.
- Every VIEWS tool description contains `FORECAST` or `prediction`.
- Every tool description contains `PROHIBITED` and `REQUIRED ATTRIBUTION`.

### Skill Instruction Tests

- The skill file contains all 8 rule headers.
- The prohibited language table includes `will have`, `there will be`, and `is going to experience`.
- The response template includes `Caveats` and `Sources` sections.
- Both academic citations (Sundberg & Melander 2013, Hegre et al. 2021) appear in full.

### CI Integration

A GitHub Actions workflow runs the compliance test suite on every push:

```yaml
name: Guardrails Compliance
on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

Test failures block merges, ensuring that guardrail regressions cannot reach the main branch.

---

## 6. References

- Sundberg, Ralph, and Erik Melander. 2013. "Introducing the UCDP Georeferenced Event Dataset." *Journal of Peace Research* 50(4): 523-532.

- Hegre, Havard, et al. 2021. "ViEWS2020: Revising and Evaluating the ViEWS Political Violence Early-Warning System." *Journal of Peace Research* 58(3): 599-611.

- Model Context Protocol Specification. 2025-06-18. https://spec.modelcontextprotocol.io/

- VIEWS Methodology Documentation. Peace Research Institute Oslo. https://viewsforecasting.org/

- UCDP Definitions and Methodology. Uppsala University. https://ucdp.uu.se/
