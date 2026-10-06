# Infinity — rules for every Claude Code session

Infinity is an AI-assisted UI automation framework. This repo is **v0**: a Claude Code
repo template that proves two things on https://www.limeroad.com (no login):

1. Plain-English test cases become Playwright tests that pass (target: ≥ 80% of approved cases).
2. App memory produces better test cases than the stock Playwright planner agent.

The full spec is `docs/spec.md`. Read the sections relevant to the current phase before
doing any work. If this file and the spec disagree, stop and ask.

## Phase discipline

- Work on **one phase at a time**. The user names the phase at the start of the session
  (P0 … P10, see `docs/spec.md` → Build phases).
- Build only what that phase lists. Do not start the next phase, and do not build ahead
  "because it will be needed later".
- When the phase's build is done, **stop** and present a review checklist: what was built,
  what the user must review, and whether each "Done when" condition is met (with evidence).
- Never mark a phase done yourself. The user approves it.
- Do not commit. Propose a commit message; the user commits after approving the phase.

## Ask, don't assume

- If something is unclear, missing or contradicts the spec, ask before acting.
- Never invent business rules, test data or expected behaviour. Missing information is a
  question for the user, not a guess.

## Human approval gates (never skip, never self-approve)

1. **Memory** (`memory/`): the QA team approves graph and page files before any case is
   generated from them.
2. **Cases** (`cases/`): only cases in `cases/approved/` are converted to code. Every
   generated or normalized case waits for approval; every edit the user makes is logged.
3. **Results**: a passing test counts only after the user confirms its assertions check
   something real.

## No healing, ever

- No self-healing locators, no AI calls during test execution, no fallback locator chains
  at runtime.
- `playwright.config.ts` keeps `retries: 0`. A failure is reported as a failure.
- If a locator breaks, stop and report it (see Locators). Never swap it silently.

## App memory rules

- `memory/graph.json` holds **structure only**: screens (page templates), elements,
  locators, relationships, flows, navigation. It must validate against
  `memory/schema/graph.schema.json`.
- `memory/pages/<screen_id>.md` holds **business rules only** and refers to elements by
  graph ID (e.g. `el-add-to-cart-button`). Never redescribe elements there.
- If a page file mentions an element the graph does not have, flag it. Do not guess.
- Model **page templates, not URLs** (one product-page node per layout: clothing,
  footwear). Target ≈ 8–12 screens for LimeRoad.
- Relationship labels come only from `memory/labels.md`. A new label may be proposed only
  together with its check pattern, and needs user approval.

### Element IDs

- Before (re)discovery, read the current graph and **reuse an element's existing ID** when
  it is the same element.
- New IDs follow one rule: `el-` + visible name + element type, lowercase, hyphenated
  (e.g. `el-add-to-cart-button`). Screens: `scr-` + name (e.g. `scr-search-results`).

### Locators

- Store a ranked list per element in Playwright's preferred order:
  `getByRole` (role + accessible name) → test id → text → CSS (last resort).
- Each element carries `last_verified` (the date it was last confirmed on the live page).
- When converting a case, check **only the locators that case uses**, on the live page,
  and confirm each resolves to exactly one element. Leave other locators and older
  scripts alone.
- If a check fails: stop and report the broken locator, a proposed replacement, and every
  existing spec that uses it. Change nothing until the user approves (page objects are shared).

## Test cases

- One standard English format: numbered steps in plain language; lettered checks (a, b, c)
  under the step they verify; navigation written as real steps; each case has an ID,
  title, the `screen_id`s it touches, and the `rel_id`/`flow_id` it traces to.
- Positive cases before negative cases.
- Loose user-written cases in `cases/inbox/` are rewritten into the standard format and
  shown for approval before conversion.

## Code conventions

- TypeScript + Playwright Test. Chromium only for v0.
- One page object per page template in `pages/`; elements become locators, relationships
  and common actions become methods.
- One test per approved case in `tests/`; the case ID starts the test title
  (e.g. `TC-SRCH-003 · Search returns relevant products`).
- Assert on structure, not live data (results appear, filters narrow the list, a price is
  shown) unless the case explicitly says otherwise.
- Ask for missing test data before writing code, never during a run.

## Target site etiquette (LimeRoad is a live production site)

- No login. Never go past the cart. Never place orders or submit forms with real data.
- Keep volume low: `workers: 1`, no load or stress runs, no crawling beyond the in-scope flows.
- If the site blocks automation (captcha, bot wall), stop and report what you saw.

## Secrets

- Credentials live in `.env` only. Never read them into memory files, prompts, logs,
  test titles or commit messages. `.env` is git-ignored.

## Metrics

- Log per case per run in `scoring/metrics.tsv` (tab-separated), as defined in
  `docs/spec.md` → Measuring v0.
