# Critical-care hub — the organisation record, 2026-09-08

Branch `claude/critical-care-shared-and-hub`, cut from `origin/main` at `12186250`. Part B of the
shared-and-hub brief; Part A is [`shared-stage-items-record.md`](shared-stage-items-record.md).

The five modules each have a record; the surface that ties them together had none. This is the
first, in the shape of the module learner-review records: what was looked at, what was found,
what shipped, and what was deliberately not touched. It separates a defect from a design
preference the way those records do — a defect is something a learner would report as broken, a
preference is something a reviewer might do differently — and anything that would change the
hub's information architecture is a proposal here, not a change.

## Method

Walked as a learner on the dev server run from this worktree (port 3125, the tab's URL and port
checked before every reading), at the four widths the module rounds validated — 1024 × 768,
1280 × 720, 1440 × 900, 1600 × 900 — from the hub page into the "Shock and perfusion" pathway,
into the hemodynamics section it opens on, and back. Every screen was read through the DOM (the
Browser pane was hidden for most of the walk, which blanks screenshots but not the accessibility
tree or script reads). Audited against the `medical-education-modules` skill's principle 12, "One
door, one map", and rubric sections 5 (instruction / surface coherence) and 7 (navigation and
counts). Every claim in the brief was checked against `12186250` first.

## The hub, as found on `12186250`

- **Access.** Public-unlisted: no sign-in, `noindex`, and — by decision D-03 — absent from every
  site navigation. A learner reaches it by direct link and nothing on the site leads back to it.
- **Eight route surfaces** under `src/app/[locale]/critical-care/`: the hub page and `labs/`,
  `progress/`, `cases/`, `concepts/` (+ `[conceptId]`), `notebook/`, `reference/`, `pathways/`
  (+ `[pathwayId]`). No shared `layout.tsx`: each page mounts its component inside the site
  chrome and nothing else.
- **Twenty-one components**, six of them full-page library views of what the hub page already
  presents as sections: Labs, Cases, Concept index, Reference, Notebook, Progress.
- **Five clinical pathways** (the brief counted three; `content/pathways.ts` has five and the
  hub renders five), each a cross-module sequence with a "Suggested next activity".
- **Two module lists in `content/modules.ts`**, live at once, disagreeing on two names.

## Point by point

| Looked at                                                          | Found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Verdict              | What shipped                                                                                                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One term per module across every surface (rubric §7)               | On one hub screen the lab card said **"CARDIOHELP ECMO"** and **"Baxter CRRT"** while the quick-practice eyebrow said **"CRRT"**; the pathway milestone, the lab library, the cases page and the module's own page title all said **"ECMO Management"** / **"CRRT · PrisMax console lab"**. The launcher list was the only outlier.                                                                                                                                                                                                             | Defect               | The launcher takes its title and subtitle from the catalog and the card prints the subtitle; a test pins the agreement — HUB-OD-1. No old name renders anywhere.                        |
| The two module lists                                               | They serve different readers: the catalog carries activity-id prefixes, sections and the integrated flag for the dashboard, pathways and activity registry; the launcher carries the icon, eyebrow, description and topics one card prints, in a long-standing order, minus the simulator. Nothing read both for the same purpose.                                                                                                                                                                                                              | Design, documented   | Both kept; the file says why, and the launcher can no longer name a module differently — HUB-OD-1.                                                                                      |
| One door: a fresh learner's entry (skill principle 12)             | "Start here" → `/icu-hemodynamics/learn?activity=why-measure`; the pathway's "Suggested next activity" → the same section; that section is unit 1 of the canonical order. `hub-pathway-start-alignment.test.ts` pins the two surfaces to each other. A returning learner sees a filled **Resume activity** and a text-styled **Open recommendation**, both resolved through the same dashboard model.                                                                                                                                           | Correct as it stands | No change.                                                                                                                                                                              |
| Counts derived from the registry (rubric §7)                       | "N shared reference topics" counts the catalog; "Section 1 of 9" and "Step 1 of 5 · Recognize" come from the module registries; the two counters on one screen name different things.                                                                                                                                                                                                                                                                                                                                                           | Correct as it stands | No change.                                                                                                                                                                              |
| Where am I, what is next, how do I get back — inside a module      | Where: the stage header says "ICU Hemodynamics · Section 1 of 9" and each pane is captioned. Next: the Now card. **Back: nothing.** The breadcrumb goes to the module's own hub; the module's own nav is Overview / Learn / Practice / Assess; the site navigation has no critical-care entry by design. From inside any module the learning center is reachable only by the browser's back button or by typing the URL. Confirmed at 1024 × 768 and 1600 × 900.                                                                                | Defect, structural   | **Proposal HUB-P1**, not changed: the fix is chrome every module's shell would carry, and its shape (breadcrumb, back link, or a hub strip) is an information-architecture decision.    |
| How do I get back — from the six library views                     | Only the Pathways list links back ("← Critical Care Learning Center"); a pathway page links to the list. Labs, Cases, Concepts, Reference, Notebook and Progress have no link to the hub, and there is no route-group layout to give them one.                                                                                                                                                                                                                                                                                                  | Defect, structural   | **Proposal HUB-P2**, not changed: a shared `critical-care/layout.tsx` with one breadcrumb would fix all six at once and is exactly the kind of shared chrome the owner should shape.    |
| Six library views and eight routes against "one map"               | The hub page is already the map: its seven sections are the six libraries in miniature plus the return path. Labs lists the same five modules as the launcher, with their section names; Cases, Reference and Concepts are filters over the same catalog; Notebook and Progress are personal. None contradicts the hub, and every one derives from the one registry — the grouped-and-linear rule the skill allows. What they lack is the frame that says they are one place (HUB-P2).                                                          | Design, acceptable   | No change. Labs' overlap with the launcher is noted under proposals (HUB-P3).                                                                                                           |
| "Pathway" as a term                                                | Two concepts share it: the hub's five cross-module **clinical pathways** and each module's internal ordered **learning pathway** (`criticalCareLearningPathways`, "Pathway map and progress" on a module's overview tab). The skill asks for one concept per term.                                                                                                                                                                                                                                                                              | Vocabulary, minor    | **Proposal HUB-P4**; the module records own their word.                                                                                                                                 |
| The hemodynamics breadcrumb                                        | Reads "ICU Hemodynamics"; every hub surface and the page title read "ICU Hemodynamics Lab".                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Vocabulary, minor    | Left to the module; noted for its next round.                                                                                                                                           |
| Horizontal overflow, at all four widths                            | None on the hub (document width = viewport at 1024/1280/1440/1600), none on the pathway page, none inside the section. Launcher grid: two columns at 1024 and 1280, three at 1440 and 1600. Hub height 5 255 px at 1024 × 768, 4 306 px at 1600 × 900.                                                                                                                                                                                                                                                                                          | Correct as it stands | No change.                                                                                                                                                                              |
| `GET /api/critical-care/progress` "returns 500 on every page load" | Two causes, one local and one real. Without a `.env.local` the Supabase client is built from `undefined` and throws before the auth check — a 500 on every call, which is what a fresh worktree shows. With env, an anonymous request answers 401 and the page never calls the route (the sync client fires only for a signed-in user). For a signed-in learner **with any stored critical-care row** the read would fail its own response schema: zod's plain `datetime()` accepts only `Z`, PostgreSQL serializes `timestamptz` as `…+00:00`. | Defect, real         | Both schemas read with `datetime({ offset: true })`; a regression test uses a `+00:00` fixture and fails without the fix — HUB-OD-2.                                                    |
| `learner-review-cross-module-brief.md` truncated evidence rows     | 163 cells in the appendix cut mid-word: the renderer in the ECMO session (`render_appendix.py`) sliced evidence and fixes at 320 characters, collisions at 220 and extras at 300, with no ellipsis. Git history had only the cut version; the ECMO session's task output holds the audit's full JSON. Prettier had then rewritten the cut rows (unbalanced backticks made it read underscores as emphasis).                                                                                                                                     | Defect, docs         | Every rendered row rebuilt from the audit's JSON by position, skeleton-matched so hand-edited rows were left alone; 193 rows checked, 0 differ from source; prettier-stable — HUB-OD-3. |

## HUB-OD-1 — the launcher takes its name from the catalog

`criticalCareModules` (the five-card launcher) and `criticalCareModuleCatalog` (the six-entry
internal catalog) both stay, because nothing reads both for the same purpose and the launcher's
order and card fields are its own. What they may not do is disagree about a module's name, so the
launcher's `title` and `subtitle` are now spread in from the catalog entry of the same id
(`catalogIdentity`), the hub card prints the subtitle under the title so the device identity the
old title carried ("CARDIOHELP", "Baxter") stays on the card as "CARDIOHELP console lab" /
"PrisMax console lab", and `catalogs.test.ts` fails if any launcher entry's title, subtitle or href
differs from the catalog's. The catalog was moved above the launcher in the file because the
launcher now depends on it, and the file's leading comment records why two lists exist.

Not chosen: merging the lists. The launcher is a compatibility surface with a pinned order
(`release-boundary.test.ts`, `catalogs.test.ts`) and card-only fields; folding it into the catalog
would give the ICU simulator a launcher card by accident or need a flag to keep it off, either of
which is an information-architecture change this record only proposes.

## HUB-OD-2 — the progress read accepts the offset the database sends

`src/lib/critical-care-progress-sync.ts` and `progress/publicAccountSync.ts` both validated
`completedAt` and `lastVisitedAt` with `z.string().datetime()`, which rejects `+00:00`. PostgREST
emits `timestamptz` as ISO 8601 with a numeric offset, never `Z`; zod 3.25 confirms the rejection
directly (`datetime()` fails `2026-07-22T12:00:00+00:00`, `datetime({ offset: true })` passes it).
Every fixture in `route.test.ts` wrote `Z`, which is why the suite passed while the route could
not read a real row. The notebook schema in the same feature already read with the offset option.

The one check not run: a read-only `select to_json(now())` against the live database to show the
serialization in situ was blocked by the session's permission classifier, so this rests on
PostgreSQL's documented JSON output and the zod behaviour above. The route's client-side reader
parses with the same schema, so one change fixes both ends.

## HUB-OD-3 — the brief's appendix is rebuilt from its source, not retyped

The truncated rows came from `ev[:320]` in a renderer, and their full text survives only in the
ECMO session's workflow output. The repair pairs each rendered row with the JSON field it was
rendered from by position — module heading, finding id, row kind — and replaces the row only when
its punctuation-free skeleton is a strict prefix of the source's, so the status corrections the
brief received by hand after rendering are untouched. Two rows needed one extra step to stay
prettier-stable: a bare `node_modules/…` path in prose was pairing its underscore with the italic
"_Collides:_" label two lines down, and now sits in a code span; `__tests__` in prose is escaped.
The repaired file passes `prettier --check`, which lint-staged runs at commit.

## Proposals — structural, not done here

- **HUB-P1 — a way back to the learning center from inside a module.** Today none exists. Options,
  in rising order of change: a "Critical Care Learning Center" link in the shared
  `SectionHeader` breadcrumb ahead of the module's own crumb (touches all four stage adopters and
  ECMO's copy); the same link on each module's hub page; or a persistent hub strip. Whichever, it
  is the same chrome for six modules and should be decided once.
- **HUB-P2 — a route-group layout for `/critical-care/*`** carrying one breadcrumb ("Critical Care
  Learning Center › Labs"), so the six library views read as rooms of one house and each has a
  way back. Smallest change with the widest effect; it is still an information-architecture
  addition.
- **HUB-P3 — the Labs library.** It lists the five launcher modules again, adding only each
  module's section names, and its amber note repeats the hub's. Either give it something the hub
  lacks (the ICU simulator when it is visible; per-section progress) or retire it into the hub's
  launcher. Owner's call; the skill does not forbid a grouped view that mirrors the map.
- **HUB-P4 — one meaning for "pathway".** The hub's cross-module clinical pathways and the
  modules' internal learning pathways share the word. Renaming either is a cross-module vocabulary
  decision.

## Reported, and correct as it stands

- **"Eight routes and six library views" as a shape.** Read against "one door, one map", the hub
  page is the one map and the libraries are its sections at full size, sourced from one registry.
  Not wrong; under-framed (HUB-P2).
- **Two entry links for a returning learner** (Resume, filled; Recommendation, text). One is
  primary by styling and both resolve through the same model; the skill's one-CTA rule is about
  resolution, not link count.
- **The hub's length** (five to seven screens). A preference, not a report.
- **The "Preview · clinical review" badges and the labs page's release-gate note.** Honest
  boundaries, kept.

## Left for an owner decision

1. HUB-P1 and HUB-P2 — which chrome, and whether one change should cover both.
2. HUB-P3 — the Labs library's reason to exist.
3. HUB-P4 — "pathway".
4. Whether the `.env.local` symlink the primary checkout uses should be documented as a worktree
   step, since a fresh worktree without it reports the hub's API as broken on every page.

## Verification

Hub, walked at four widths; "overflow" is document width against viewport width:

| Viewport   | Overflow | Launcher columns | Page height | Lead entry (this learner state)         |
| ---------- | -------- | ---------------- | ----------- | --------------------------------------- |
| 1024 × 768 | none     | 2                | 5 255 px    | Start here → hemodynamics `why-measure` |
| 1280 × 720 | none     | 2                | 4 358 px    | Resume activity                         |
| 1440 × 900 | none     | 3                | 4 306 px    | Resume activity                         |
| 1600 × 900 | none     | 3                | 4 306 px    | Resume activity                         |

After HUB-OD-1 the launcher reads ICU Hemodynamics Lab · Mechanical Ventilation · Mechanical
Circulatory Support · ECMO Management (CARDIOHELP console lab) · CRRT (PrisMax console lab) at
every width, and neither old name appears in the hub's text. The pathway page and the hemodynamics
section had no overflow at 1024 × 768 or 1600 × 900; the section's pane widths at 1600 × 900 were
399 / 445 / 691, the numbers the MV record measured for the shared fractions.

`GET /api/critical-care/progress` with env and no session: 401. The regression test with a
`+00:00` row: fails on `12186250`'s schema, passes with HUB-OD-2. Suites on the final tree:
`npm run lint` 0 errors (15 warnings, identical to the baseline on `12186250`), `npm test` 743
suites / 11 426 tests, `tsc --noEmit` clean.
