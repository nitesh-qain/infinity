# Infinity — v0 Spec & Phased Build Plan

> Repo copy of the live spec doc, as of 2026-10-07. The live doc is the master and holds the
> phase status tracker. If this copy and the live doc disagree, ask before acting.

v0 proves two things on LimeRoad (no login): plain-English cases become Playwright tests that pass at least 80% of the time, and app memory produces better test cases than the stock Playwright planner. It is built in 11 small phases, each ending in a review before the next one starts.

## Goals and success measures

v0 succeeds when approved cases pass at least 80% of the time and memory-based cases beat the Playwright planner's on acceptance and coverage.

| Goal | Measure | Target |
| --- | --- | --- |
| (a) English cases become working Playwright tests | Execution pass rate of approved cases | ≥ 80% |
| (b) Memory makes generated cases better | Generated cases accepted without edits | ≥ 70% |
| (b) Memory makes generated cases better | Coverage of the combined valid-scenario list | ≥ 80% |
| (b) Memory beats no memory | Same three numbers for the Playwright planner on the same input | Judged by Nitesh on case quality; numbers support it |

How each number is counted is in *Measuring v0*. Failure triage, healing and the manual-QA authoring test belong to v1.

## Scope

v0 is web only, on LimeRoad without login, built as a Claude Code repo template rather than a standalone tool.

**In v0**

- Target: https://www.limeroad.com, no login. Flows: search, left nav, category listing, filters, sorting, product page, add to cart (stop at the cart).
- Stack: TypeScript, Playwright, Playwright MCP for exploration, Claude Code as the runtime.
- App memory built from live exploration, with optional specs and screenshots as extra context.
- Two ways in for cases: Claude generates them from memory, or the user writes them and Claude normalizes them.
- Conversion of approved cases into page objects and specs.
- Playwright's default HTML report.
- A side-by-side comparison with the Playwright planner agent.

**Out of v0**

- Mobile and Appium.
- No-code mode.
- Custom reporting.
- Failure triage (real vs false failure) and any healing.
- CI.
- Login flows. They're added as a later batch once test credentials exist.
- A standalone CLI or app. That comes only after v0 proves the approach.
- Anything Loopsy-specific from test.agent. Only its fundamentals carry over.

## How it works

Claude does the work between the gates. Nothing moves past a gate without a person's approval.

1. **Discover**: Claude explores the live site through Playwright MCP (plus optional specs and screenshots).
2. **App memory**: graph (structure) + page files (business rules).
3. **Gate 1, QA approves memory**: fixes elements, adds missing business rules.
4. **Generate cases** from approved memory (element, relationship, end-to-end), or take **user-written cases** and normalize them to the standard format.
5. **Gate 2, QA approves cases**: every edit is logged.
6. **Page objects and specs**: conversion reads memory; locators checked live, then fixed in code.
7. **Run 3× and score**: no AI and no healing at runtime.
8. **Gate 3, QA confirms assertions**: only then does a pass count.

Conversion reads memory to find locators and page rules. The finished scripts never call AI or repair themselves while running.

## App memory

Memory has two parts that never overlap. The graph holds structure, and one md file per page holds business rules. The QA team approves both before any case is generated from them.

### The graph (`memory/graph.json`)

- It holds pages, elements, locators, relationships, flows and navigation, and nothing else.
- It's based on test.agent's prototype schema (`screen_id`, `source`/`target`, `navigation_index.edges`), versioned from `0.1`, and checked against `memory/schema/graph.schema.json`.
- Pages are modelled as **templates, not URLs**: one product-page node per layout (clothing, footwear), one listing node, one search-results node. LimeRoad should come to about 8–12 nodes, which keeps flow stitching under test.agent's ~10-screen truncation point.
- It's built from live exploration through Playwright MCP, so Claude clicks through and records where each element actually leads. Specs and screenshots are optional extra context.

An illustrative shape (the values are examples, not real LimeRoad data):

```json
{
  "schema_version": "0.1",
  "app": { "name": "LimeRoad", "base_url": "https://www.limeroad.com", "platform": "web" },
  "screens": [{
    "screen_id": "scr-listing",
    "name": "Category listing",
    "sample_urls": ["<two or three real URLs seen while exploring>"],
    "elements": [{
      "element_id": "el-filter-size",
      "label": "Size filter",
      "type": "checkbox_group",
      "action": "select",
      "navigates_to": null,
      "locators": [
        { "strategy": "role",   "value": "checkbox", "name": "M" },
        { "strategy": "testid", "value": null },
        { "strategy": "text",   "value": "Size" },
        { "strategy": "css",    "value": "<fallback>" }
      ],
      "last_verified": "2026-10-07"
    }]
  }],
  "relationships": [{
    "rel_id": "rel-001", "screen_id": "scr-listing", "type": "filters",
    "source": "el-filter-size", "target": "el-product-grid",
    "test_hint": "Every product shown has the selected size"
  }],
  "flows": [{ "flow_id": "flow-search-to-cart", "name": "Search to cart", "steps": [] }],
  "navigation_index": { "edges": [{ "from": "scr-home", "via": "el-search-submit", "to": "scr-search-results" }] }
}
```

### Element IDs

- **Re-discovery reuses existing IDs.** Claude reads the current graph first and keeps an element's ID when it is the same element.
- **New IDs follow a fixed naming rule.** The ID is built from the element's visible name and type, for example `el-add-to-cart-button`, so two runs land on the same ID.
- **Tested in P2.** Discovery runs twice on the same page, and the two graphs are compared. Any ID that changes is a bug in the rules.

### Locators

- Each element stores a ranked list in Playwright's preferred order: role with accessible name (`getByRole`), then test id, then text, then CSS as the last resort.
- Each element carries a `last_verified` date, which is the date Claude last confirmed it on the live page.
- Only the locators a case uses are checked again when that case is converted, then written into the page object as fixed values (see *From case to script*).

### Page files (`memory/pages/<screen_id>.md`)

- They hold business rules and functionality, for example: "Add to Cart stays disabled until a size is picked" or "Sorting by price applies only to the current category."
- They refer to elements only by graph ID (`el-add-to-cart`) and never redescribe them.
- If an md file mentions an element the graph doesn't have, Claude flags it for review instead of guessing.

### Relationship labels (`memory/labels.md`)

A relationship is how one element on a page affects another. Its label decides which check the generator writes. The core set is below. Claude may propose a new label for an app, but only together with its check pattern, and the QA team approves it. Labels that recur across apps move into the core set.

| Label | Meaning | Check pattern it produces | Origin |
| --- | --- | --- | --- |
| enables | Source makes target usable | Target disabled before, enabled after | test.agent |
| disables | Source makes target unusable | Target enabled before, disabled after | test.agent |
| reveals | Source shows target | Target hidden before, visible after | test.agent |
| hides | Source hides target | Target visible before, hidden after | test.agent |
| validates | Source input is checked | Invalid input shows an error and blocks; valid input proceeds | test.agent |
| computes | Target value derives from source | Target equals the expected derived value | test.agent |
| mutually_exclusive | Picking one unpicks the other | Selecting A deselects B | test.agent |
| required_before | A must happen before B | B is blocked or prompts until A is done | test.agent |
| filters | Source narrows a list | Every item shown matches the filter; the result count changes | New (LimeRoad) |
| sorts | Source reorders a list | The first N items are in the chosen order | New (LimeRoad) |
| updates | Source changes another element's state | Target changes as expected, e.g. cart badge +1 | New (LimeRoad) |

Relationships stay as one top-level array with a `screen_id` on each. Positive cases come before negative ones at every level, as in test.agent.

## Test cases

Every case, whether generated or written by a person, ends up in one standard English format, and nothing is converted until the QA team approves it.

### The standard format

- Numbered top-level steps in plain language. Navigation to a deep page is written as real steps, not as a precondition.
- Lettered checks (a, b, c) under the step they verify.
- Each case carries an ID, a title, the `screen_id`s it touches, and the `rel_id` or `flow_id` it traces to (for generated cases).

```markdown
TC-SRCH-003 · Search returns relevant products
Traces to: flow-search-to-cart · Screens: scr-home, scr-search-results

1. Open the LimeRoad homepage
2. Search for "kurti"
    a. Verify the search results page opens
    b. Verify at least one product is shown
    c. Verify every product title or category relates to kurtis
```

### Two ways in

1. **Generated.** Claude reads the approved memory (graph plus page files) and writes cases at three levels: element, relationship (one per `rel_id`) and end-to-end (one per `flow_id`). They're saved to `cases/generated/` for review.
2. **User-written.** The QA team drops loose cases ("check search for kurti works") into `cases/inbox/`. Claude rewrites each into the standard format and asks about anything it can't resolve from memory, for example which checks "works" should mean.

In both cases the QA team approves, edits or rejects each case. Approved cases move to `cases/approved/`, and only those get converted. Every edit is logged, because the "accepted as-is" metric depends on it.

## From case to script

Conversion reads memory, but running a test never does. Scripts use fixed locators, so a changed element fails loudly instead of being silently re-found.

- **Page objects.** Each page template in the graph becomes one TypeScript page object in `pages/`. The template's elements become its locators, and its relationships and common actions become reusable methods, for example `ListingPage.applyFilter('Size', 'M')`.
- **Locator check at generation time.** Before writing a locator into a page object, Claude opens the live page through MCP and confirms it resolves to exactly one element. Only the elements the case touches are checked, and other locators and older scripts are left alone. If a check fails, Claude stops and reports the broken locator, a proposed replacement, and every existing spec that uses it. Nothing changes until the QA team approves, because page objects are shared. Passing checks update `last_verified` in the graph.
- **Specs.** Each approved case becomes one test in `tests/`. Steps call page-object methods, and lettered checks become `expect` assertions. The case ID goes in the test title, so the HTML report maps back to the case.
- **Missing information.** If a case needs data memory doesn't have (for example "which size should be selected?"), Claude asks before writing code, never during a run.
- **No healing at runtime.** No self-healing locators, no AI calls during execution, and no automatic retries that hide failures. A failure is a failure, and v1 triage decides what it means.
- **Assertions on structure, not live data.** Because LimeRoad's products and prices change daily, checks verify structure (results appear, filters narrow the list, the product page shows a price) rather than exact products or prices, unless a case explicitly says otherwise.

## Measuring v0

Every number is logged per case in `scoring/metrics.tsv`, so the totals can be recounted at any time and checked against the HTML reports.

| Metric | Counted as | Target |
| --- | --- | --- |
| Execution pass rate | Approved cases that run green 3 out of 3 **and** whose assertions the QA team confirms check something real, divided by all approved cases converted | ≥ 80% |
| Accepted as-is | Generated cases approved with no edits, divided by all generated cases | ≥ 70% |
| Coverage | Valid scenarios a side covered, divided by the combined valid-scenario list | ≥ 80% |
| Clarification rounds | Questions Claude asked per case before conversion | Tracked, no target |

A test that passes but only checks "the page loaded" doesn't count as a pass. Failures caused by LimeRoad's live data (a product sold out, a banner moved) are logged with a note. Whether they are excluded is decided case by case.

### Comparison with the Playwright planner

1. The QA team provides specs and screenshots for a set of features in `inputs/<feature>/`.
2. **Same input for both sides:** the Playwright planner agent and our case generator each get those specs and screenshots plus access to the live site. Our side also has its approved memory, which is the variable being tested.
3. Both sides' cases go into one combined list. The QA team marks each scenario valid or invalid, and each side's coverage is its share of the valid list.
4. Planner cases are converted with Playwright's generator agent (healer off), and ours with our converter. Both are run the same way and scored on the same three metrics. Whether memory is worth it is decided by Nitesh's review of case quality, and the metrics are supporting evidence.

## Repo layout

One repo, owned by the user, in which Claude Code is the engine. The working name is Infinity.

```
infinity/
├─ CLAUDE.md                  rules: approval gates, no healing, conventions
├─ .claude/
│  ├─ skills/                  discover · generate-cases · normalize-case ·
│  │                           build-page-objects · convert-case · score-run
│  └─ agents/                  subagents, only where a step needs its own context
├─ memory/
│  ├─ graph.json               structure: pages, elements, locators, flows
│  ├─ schema/graph.schema.json
│  ├─ labels.md                relationship labels + check patterns
│  └─ pages/<screen_id>.md     business rules per page template
├─ inputs/<feature>/          specs + screenshots from the QA team
├─ cases/
│  ├─ inbox/                   user-written, loose
│  ├─ generated/               written by Claude, awaiting review
│  ├─ approved/                standard format, approved — the only input to conversion
│  └─ baseline/                Playwright planner output
├─ pages/                     generated page objects (.ts)
├─ tests/                     generated specs (.spec.ts)
├─ baseline-tests/            planner cases converted by Playwright's generator
├─ scoring/metrics.tsv        one row per case per run
├─ playwright.config.ts
└─ .env                       credentials — never read into memory or prompts
```

## Build phases

There are 11 phases, and each ends in a review. The next phase starts only after the review passes. Each phase is sized to be built and checked in one or two sittings. Status is tracked in the live spec doc.

| Phase | What you get at the end |
| --- | --- |
| P0 · Repo and smoke run | A TypeScript Playwright repo that runs one hand-written test on LimeRoad |
| P1 · Memory schema | Graph schema v0.1, page-file template, labels file |
| P2 · Discover one page | Homepage plus header/nav in graph and md, locators verified |
| P3 · Discover all pages | All in-scope templates, flows and navigation; memory approved |
| P4 · Inputs and planner baseline | Feature specs/screenshots in place; planner cases saved |
| P5 · Case generator | Memory-based English cases for the same features |
| P6 · Case scoring | Combined list, acceptance and coverage for both sides |
| P7 · Case normalizer | Loose user cases rewritten into the standard format |
| P8 · Page objects | One verified page object per template |
| P9 · Converter | Approved cases become specs: 5 first, then all |
| P10 · Run, score, verdict | Both sides executed 3×, metrics filled, v0 verdict |

### P0 · Repo and smoke run

- **Build:** Playwright TypeScript project, `CLAUDE.md` with the core rules (approval gates, no healing), Playwright MCP configured, `.env` in place, and one hand-written test: open the homepage, close any pop-up, run a search.
- **You review:** the repo structure and `CLAUDE.md` rules.
- **Done when:** the test passes 3 times in a row and the HTML report opens. If LimeRoad blocks automated browsers, this is where we find out.

### P1 · Memory schema

- **Build:** `graph.schema.json` (v0.1, prototype field names plus locators and `last_verified`), the page-file template, and `labels.md` with the 11 core labels.
- **You review:** the schema and the label check patterns.
- **Done when:** a hand-made sample for one page validates against the schema.

### P2 · Discover one page

- **Build:** the `discover` skill. Claude explores the homepage and header/nav through MCP and writes those nodes, elements, locators and relationships, plus `pages/scr-home.md`.
- **You review:** missing or wrong elements, wrong labels, and missing business rules.
- **Done when:** you approve the homepage memory, every locator resolves to exactly one element, and a second discovery run produces the same element IDs.

### P3 · Discover all pages

- **Build:** discovery across search results, category listing, filter and sort states, product pages (two templates: clothing and footwear) and cart. Flow stitching and the navigation index, plus a Mermaid map of the graph for review.
- **You review:** the map and each page file; you add business rules Claude couldn't see.
- **Done when:** memory for all in-scope templates is approved and stays under about 12 nodes.

### P4 · Inputs and planner baseline

- **Build:** you drop specs and screenshots per feature into `inputs/`. Claude runs the Playwright planner agent on the same features against the live site and saves its output to `cases/baseline/` untouched.
- **You review:** that the inputs are complete. You don't judge the planner output yet.
- **Done when:** baseline cases exist for every feature.

### P5 · Case generator

- **Build:** the `generate-cases` skill. It reads the approved memory and the same inputs and writes element, relationship and end-to-end cases in the standard format to `cases/generated/`.
- **You review:** approve, edit or reject each case. Edits are logged.
- **Done when:** every feature has generated cases and every case has a review decision.

### P6 · Case scoring

- **Build:** Claude merges both sides' scenarios into one combined list.
- **You review:** mark each scenario valid or invalid.
- **Done when:** acceptance and coverage for both sides are in `metrics.tsv`. This is the first read on goal (b).

### P7 · Case normalizer

- **Build:** the `normalize-case` skill. You write 5–10 loose cases into `cases/inbox/`. Claude rewrites them into the standard format and asks about anything unclear.
- **You review:** whether each rewrite means what you meant.
- **Done when:** all inbox cases are approved into `cases/approved/`.

### P8 · Page objects

- **Build:** the `build-page-objects` skill. It produces one page object per template from the graph, checks every locator live, and turns relationships into methods.
- **You review:** the methods' names and coverage. Can a manual QA read them?
- **Done when:** every page object compiles and every locator resolves to exactly one element on the live page.

### P9 · Converter

- **Build:** the `convert-case` skill. It turns approved cases into specs using the page objects, and asks about missing data before writing code. It does 5 cases first, then the rest.
- **You review:** the first 5 specs closely, especially whether the assertions are meaningful. After that, spot checks.
- **Done when:** every approved case has a spec, with no hand edits to the code.

### P10 · Run, score, verdict

- **Build:** the `score-run` skill. It runs our specs and the planner's converted specs 3 times each, then fills `metrics.tsv` and summarizes the results against the targets.
- **You review:** the HTML reports and the assertion check on each passing test.
- **Done when:** all metrics are final, and you decide what comes next: a second website, v1 triage, or rework.

## Risks

The biggest risk is fake greens: tests that pass because they check too little. The assertion review in P9 and P10 is the guard, so it must not be skipped when the numbers look good.

| Risk | Why it matters | Guard |
| --- | --- | --- |
| Fake greens | Live data pushes tests towards weak assertions | Every passing test's assertion is confirmed before it counts |
| Author is also the judge | One person writes the specs, approves memory and cases, and scores coverage; v0 tests only the founder case | A QAInfinity manual tester writes cases in v1 |
| Flow stitching truncates | test.agent saw it at ~10 screens | Templates keep LimeRoad at ~8–12 nodes; a chunked stitcher before the second site |
| Scope creep | No deadline, so v0 can absorb triage, healing and mobile | The *Out of v0* list is the fence |
| Unfair baseline | Extra context for our side would make the comparison meaningless | Same specs, screenshots and site access for both sides |
| Production site | LimeRoad is live and not a client | Low-volume runs, never past the cart; owned by Nitesh |

**Settled decisions**

- Memory vs planner: judged by Nitesh on case quality, not by a numeric margin.
- Repeatable discovery: Claude Code does not expose temperature, so ID stability comes from the *Element IDs* rules, tested in P2.
- Product pages: two templates, clothing and footwear.
- LimeRoad access (bot detection, fallback site, login credentials): owned by Nitesh, handled if and when an issue comes up.
- Working name: Infinity.
