# Phase D1 validation — gates, tests, and verification results

Phase D1 implementation document (2026-08-08), recording the validation of the vertical slice on branch `claude/device-intelligence-vertical-slice` (base `origin/main` @ `da4420f9`). Companion: [d1-implementation.md](./d1-implementation.md), [d1-review/](./d1-review/).

## 1. Data and publication gates (run at baseline AND after implementation)

| Gate                                  | Result                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ip-intel:audit`              | Byte-identical `data-readiness-audit.json` (`git diff` empty) both times                                                                           |
| `npm run ip-cards:release:check-base` | `54 published entries in the base; 54 unchanged, 0 advanced, 0 new` both times                                                                     |
| `npm run ip-cards:validate-data`      | Clean; workbook sha `fb25b24e…` unchanged                                                                                                          |
| `npm run build:content`               | Clean                                                                                                                                              |
| `npm run type-check`                  | Zero errors                                                                                                                                        |
| `npm run build`                       | Succeeds; `.next/server/app/[locale]/` contains `devices/`, `clinical-roles/`, `procedures/`                                                       |
| `npm run lint`                        | Zero errors. 19 pre-existing warnings, all in files this branch does not touch; every changed file lints clean (verified with a scoped eslint run) |
| Prettier                              | All changed files pass `--check`                                                                                                                   |

No database operation of any kind was performed; no migration was added; no release pointer or definition moved; no catalog/seed/reviewed/generated file changed.

## 2. Jest

- New: `src/features/device-intelligence/__tests__/` — 11 suites / 110 tests, all passing: route-access, atlas-filtering, procedure-registry, mechanisms, readiness, readiness-formulary, outputs, role-pages, messages, cohort-wall, accessibility (jest-axe). (Historical counts: 76 at initial validation, 90 after the owner-review regressions; the current figure includes the Codex C-01..C-08 correction regressions.)
- Affected existing scope (`src/features/preference-cards`, `src/lib`, `src/i18n`): 91 suites / 1,420 tests, all passing (two Codex C-06 regressions added) — including the publication-baseline, release-bundle-integrity, and golden-scenario suites, which pin that the preserved engines behave byte-identically.
- Full run (`npx jest`): exit 0 (completed during the session; re-run after the final edits before commit).

Deterministic assertions worth naming:

- The coverage ladder computed by `domain/coverage-ladder.ts` equals `data-readiness-audit.json` per role for all three exemplars (derived, not copied).
- Workspace slot totals/requiredness (15 = 7-4-4, 29 = 3-21-5, 13 = 3-7-3) equal the audit.
- Raw compatibility statements per workspace equal the audit's `resolvedRulesTouchingProcedure.ruleIds` (13 / 12 / 7).
- Atlas store holds exactly 753 products, every one `verified_source` + `prototype_visible`; every excluded product returns null on direct lookup.
- EBUS rescue reachability; THERAPEUTIC APC blocking failure via the documented fixture-injection through `resolveCard`; laser/imaging roles proposals-only/unmapped; CHEST_TUBE role replacement, mutual exclusion (`blocked`), kit BOM suppression, no-rescue fact.
- All eight readiness states, including the three fixture-only states; candidate/unknown/demo evidence never yields plain `ready`; proposals never satisfy coverage; every diagnostic carries a source identifier.
- Output projections (room/nursing/training/gap) share one resolved item set and are content-identical across repeated computation.
- Message parity and ICU formatting across en/es/zh-CN; copy-safety allowlist for equivalence/substitution wording; the two mandatory related-product headings verbatim; both watermark texts verbatim.

## 3. Browser verification

See [d1-review/browser-walkthrough.md](./d1-review/browser-walkthrough.md) for the full manifest — note that file is HISTORICAL pre-owner-correction evidence (its banner lists the observations superseded by F-01..F-32 and C-01..C-08). Summary: all six routes walked at 1600×900 with the three workspaces and three readiness pages; density spot-checks at 1440×900, 1280×720, and 1024×768; zero horizontal page overflow at any viewport (asserted via `scrollWidth`); `X-Robots-Tag: noindex, nofollow, noarchive` confirmed on live responses; hidden-product and non-exemplar 404s confirmed; legacy role alias 307 confirmed; es locale and the preserved-page cross-links confirmed. One defect found live (bare parameterized aria-label) was fixed and regression-guarded.

## 4. Indexing/navigation surface audit

- `src/app/sitemap.ts` is an explicit allowlist; no D1 route appears in it.
- `src/app/robots.txt` is unchanged; noindex is carried per page and per response header, the same posture as every existing public-unlisted module.
- Site search (`src/lib/site-search.ts`) filters through `isVisibleModulePath`, which returns false for all D1 paths.
- No navigation component references the new paths.

## 5. Adversarial review

Performed as a self-review pass plus an independent read-only agent pass over the full diff, focused on: candidate/hidden exposure, indexing/navigation exposure, equivalence wording, duplicated resolver logic, hardcoded procedure data, demo-as-real presentation, proposals-in-readiness, write paths, auth gaps, stale UI counts. Findings and dispositions are recorded in the PR description; every confirmed blocker/high finding was fixed before the PR was opened.

## 6. Owner-review correction pass (2026-08-09)

Applied on the same branch in response to
[d1-review/owner-review-findings.md](./d1-review/owner-review-findings.md); dispositions in
[d1-review/owner-review-dispositions.md](./d1-review/owner-review-dispositions.md). All gates
re-run after the corrections:

| Gate                                  | Result                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run ip-intel:audit`              | Byte-identical `data-readiness-audit.json` (`git diff` empty)                                                               |
| `npm run ip-cards:release:check-base` | `54 published entries in the base; 54 unchanged, 0 advanced, 0 new`                                                         |
| `npm run ip-cards:validate-data`      | Clean; workbook sha `fb25b24e…` unchanged                                                                                   |
| `npm run build:content`               | Clean (24 documents)                                                                                                        |
| `npm run type-check`                  | Zero errors                                                                                                                 |
| `npm run lint`                        | Zero errors; 18 pre-existing warnings, all in files this branch does not touch; changed files lint clean under a scoped run |
| Prettier                              | All changed files pass `--check`                                                                                            |
| Focused D1 jest                       | 9 suites / 90 tests (14 new owner-review regression tests), all passing                                                     |
| Affected scope jest                   | `preference-cards` + `lib` + `i18n`: 91 suites / 1,418 tests, all passing                                                   |
| Full `npx jest`                       | 515 suites passed / 6,493 tests passed (2 suites, 3 tests pre-existing skips)                                               |
| `npm run build`                       | Succeeds; `devices/`, `clinical-roles/`, `procedures/` present in `.next/server/app/[locale]/`; standalone prepared         |

Browser regression walkthrough (dev server, 1600×900): THERAPEUTIC_BRONCH workspace (laser
note; 9-of-26 acting summary; 17 inert modifiers badged behind the disclosure; releaseState
beside every code; canonical phase order Pre-room → Pre-induction/sedation → Airway access →
Therapeutic → Specimen handling → Post-procedure; promoted rescue disclaimer), CHEST_TUBE
workspace + room/nursing/training previews (kit-suppressed group with the resolver's reason;
divergent-pathway subsection and imbalance note; honest nursing panel; per-line IFU advisories
only in the discriminating case), EBUS_TBNA workspace (canonical phases) and readiness page
("Demo: Ready — see advisory" chips with the advisory quoted in the same cell; focusable named
scroll region), CHEST_TUBE readiness ("Demo: Not ready" headline; rescue-authoring-gap
sentence), LASER_CONSOLE and EBUS_NEEDLE_FNA role pages (availability line above products;
guidance-vs-criteria split; amber IFU banner replaced by the footer statement; ingestion
caption), AIRWAY_STENT_SILICONE_STRAIGHT (single-manufacturer note), device index and
ViziShot EBUS-TBNA needle detail (primary role + description under the H1; per-card
"Not recorded in reviewed sources:" collapse with zero residual placeholder rows; discovery
denominators and role-page link). `X-Robots-Tag: noindex, nofollow, noarchive` confirmed on
live responses. Console errors were exclusively the pre-existing dev-only `/api/analytics`
500s (known limitation #8).

Before commit, an independent four-lens adversarial agent review ran over the uncommitted
diff (constraint compliance, correctness, findings coverage, clinical copy), with each
candidate finding adversarially re-verified; the two confirmed findings (truth-pin scope of
the laser-pathway note; unpinned coverage claims in the long-term-drainage note) plus five
lower-severity confirmations were fixed in the same pass — details in
[d1-review/owner-review-dispositions.md](./d1-review/owner-review-dispositions.md) §5 — and
every gate above was re-run afterwards.

## 7. Final main-integration gates (2026-08-09)

`origin/main` @ `978279f2` (literature gold-import-compensation operations work — 21 files,
all under `scripts/literature/`, `docs/ip-literature/`, `supabase/verification/`, plus
npm-script additions in `package.json` and one `.prettierignore` entry) was merged into the
branch by `git merge --no-edit origin/main`: zero changed-file overlap with the D1 diff and
zero conflicts. Every gate was re-run on the integrated head:

| Gate                                  | Result on the integrated head                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Focused D1 jest                       | 9 suites / 90 tests, all passing                                                                                           |
| Affected scope jest                   | `preference-cards` + `lib` + `i18n`: 91 suites / 1,418 tests, all passing                                                  |
| Full `npx jest`                       | 518 suites passed / 6,621 tests passed (2 suites, 3 tests pre-existing skips; 0 failures) — main added 3 literature suites |
| `npm run type-check`                  | Zero errors                                                                                                                |
| `npm run lint`                        | Zero errors; 18 pre-existing warnings, all in files this branch does not touch                                             |
| Prettier                              | Every PR-changed file passes `--check`                                                                                     |
| `npm run ip-intel:audit`              | Byte-identical `data-readiness-audit.json` (`git diff` empty)                                                              |
| `npm run ip-cards:release:check-base` | `54 published entries in the base; 54 unchanged, 0 advanced, 0 new` — merge base is current `origin/main` @ `978279f2`     |
| `npm run ip-cards:validate-data`      | Clean; workbook sha `fb25b24e…` unchanged                                                                                  |
| `npm run build:content`               | Clean (24 documents); working tree clean afterwards                                                                        |
| `npm run build`                       | Succeeds; `devices/`, `clinical-roles/`, `procedures/` present in `.next/server/app/[locale]/`                             |

Post-integration browser smoke test (dev server, narrow by design — the full owner
walkthrough was not repeated): device index → Ambu aScope 5 Broncho 2.7/1.2 detail →
FLEX_SCOPE_SINGLE_USE role page, procedure index, all three workspaces (canonical phase
order verified on the phase view; laser-pathway note; 9-of-26 acting summary with the
17-modifier inert disclosure; divergent-pathway subsection; no-rescue authoring-gap
sentence; bleeding-module scope note), all three readiness routes ("Demo:"-qualified chips;
"Demo: Ready — see advisory" with the advisory quoted in-cell; named focusable scroll
regions; DEMO watermarks), and the CHEST_TUBE room output preview (kit-suppressed group
quoting the resolver's reason). Zero horizontal overflow at 1440×900 and 1280×720
(`scrollWidth` ≤ viewport on every page checked). `X-Robots-Tag: noindex, nofollow,
noarchive` on every response including 404s; hidden-product (`PRD-00C13A59AA`) and
non-exemplar (`RIGID_BRONCH`, incl. its readiness route) requests 404. Console errors were
exclusively the known dev-only `/api/analytics` failures (known limitation #8; they present
as 401 when the dev server has Supabase env but no signed-in browser session, 500 without
env — same endpoint, no page impact).

## 8. Codex correction pass (2026-08-09)

An independent Codex review of the frozen pair `978279f2 → 916f3fcc` returned eight
confirmed findings (C-01..C-08); their statements and dispositions are recorded in
[d1-review/codex-correction-pass.md](./d1-review/codex-correction-pass.md). Current
`origin/main` @ `ee3b33e9` (baxter-crrt live-pressure device, MV post-action coaching,
analytics route repair — 36 files) was merged once before the corrections: zero
changed-file overlap with the PR diff, zero conflicts. All eight findings were corrected at
the runtime level with new regressions, and every gate re-ran on the corrected head:

| Gate                                  | Result on the corrected head                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused D1 jest                       | 11 suites / 106 tests, all passing (2 new suites: `readiness-formulary` C-04 server integration, `cohort-wall` C-02/C-03 data-wide)         |
| Affected scope jest                   | `preference-cards` + `lib` + `i18n`: 91 suites / 1,420 tests, all passing                                                                   |
| Full `npx jest`                       | 526 suites passed / 6,854 tests passed (2 suites, 3 tests pre-existing skips; 0 failures) — main's merge added the CRRT/MV/analytics suites |
| `npm run type-check`                  | Zero errors                                                                                                                                 |
| `npm run lint`                        | Zero errors; 18 pre-existing warnings, all in files this branch does not touch                                                              |
| Prettier                              | Every PR-changed file passes `--check`                                                                                                      |
| `git diff --check`                    | Clean                                                                                                                                       |
| `npm run ip-intel:audit`              | Byte-identical `data-readiness-audit.json` (`git diff` empty)                                                                               |
| `npm run ip-cards:release:check-base` | `54 published entries in the base; 54 unchanged, 0 advanced, 0 new` — merge base is current `origin/main` @ `ee3b33e9`                      |
| `npm run ip-cards:validate-data`      | Clean; workbook sha `fb25b24e…` unchanged                                                                                                   |
| `npm run build:content`               | Clean (24 documents)                                                                                                                        |
| `npm run build`                       | Succeeds; `devices/`, `clinical-roles/`, `procedures/` present in `.next/server/app/[locale]/`; standalone prepared                         |

Targeted browser spot check (dev server on the corrected head, 1600×900): EBUS_TBNA and
THERAPEUTIC_BRONCH readiness now headline **Demo: Not ready** with the required
GENERIC_SUCTION row `not_ready`, its `Missing required product role` diagnostic visible and
the demo stand-in mapping still disclosed (C-01); the THERAPEUTIC_BRONCH workspace renders
the Retrieval basket/net slot with its 3 cohort options plus "4 authored options
(0 selectable) withheld from this public view…" and neither "Micro Retrieval Net" nor
`PRD-F43B951B75` anywhere in the served HTML (C-02); `/en/devices/PRD-6FF6668D03` renders
the generic withheld explanation for both its record-level compatibility note and
RULE-04C5B71790, with `BF-MP190F` and `PRD-CB1622624D` absent from the served HTML and
provenance (SRC029) retained (C-03); GENERIC_DRAINAGE_UNIT and TALC_VIAL role pages carry
the global non-institutional guidance qualifier adjacent to their verbatim governed text
(C-05); the preserved product page `PRD-05780FEDD7` again lists the legacy representatives
(`PRD-04F9EBA54C`, `PRD-84F7ABC615`, `PRD-03B374F7B8`), not the Primary-fit substitute
(C-06); the laser disclosure still renders on THERAPEUTIC_BRONCH from the derived governed
fact (C-07). Zero horizontal page overflow at 1600×900; `X-Robots-Tag: noindex, nofollow,
noarchive` on every checked response; `PRD-CB1622624D`, `PRD-F43B951B75`, and
`RIGID_BRONCH` all 404; both watermarks present; console errors were exclusively the known
`/api/analytics` 401 (dev-only, known limitation #8).

## 9. C-04b residual correction (2026-08-09)

Targeted Codex verification of head `4f6c5695` passed C-01, C-02, C-03, C-05, C-06, C-07,
C-08, the synthetic merge with current main, and every gate — and returned exactly one
reproducible MEDIUM residual inside C-04: a multi-role formulary row was eligible when ANY
one named role authorized the product, so a matching role suppressed another relevant
role's mismatch (reproduction and corrected semantics recorded in
[d1-review/codex-correction-pass.md](./d1-review/codex-correction-pass.md), "Residual
finding C-04b"). This session merged current `origin/main` @ `8098fb97` once (62 mainline
files — literature operations + ICU-hemodynamics cardiac-output work; zero changed-file
overlap, zero conflicts), corrected the eligibility rule to require every procedure-relevant
row role independently (server-side procedure-role intersection, deduplicated and sorted;
empty relevant sets fail closed; hidden stays fail-closed; row-level diagnostic reports
sorted relevant/mismatching role lists), and re-ran every gate:

| Gate                                  | Result on the C-04b head                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Focused D1 jest                       | 11 suites / 110 tests, all passing (C-04b unit set + the A+B / hidden-multi / non-EBUS-role integration regressions)          |
| Affected scope jest                   | `preference-cards` + `lib` + `i18n`: 91 suites / 1,420 tests, all passing                                                     |
| Full `npx jest`                       | 539 suites passed / 7,041 tests passed (2 suites, 3 tests pre-existing skips; 0 failures) — main's merge added its own suites |
| `npm run type-check`                  | Zero errors                                                                                                                   |
| `npm run lint`                        | Zero errors; 18 pre-existing warnings, all in files this branch does not touch                                                |
| Prettier                              | Every PR-changed file passes `--check`                                                                                        |
| `git diff --check`                    | Clean                                                                                                                         |
| `npm run ip-intel:audit`              | Byte-identical `data-readiness-audit.json` (`git diff` empty)                                                                 |
| `npm run ip-cards:release:check-base` | `54 published entries in the base; 54 unchanged, 0 advanced, 0 new`                                                           |
| `npm run ip-cards:validate-data`      | Clean; workbook sha `fb25b24e…` unchanged                                                                                     |
| `npm run build:content`               | Clean (24 documents)                                                                                                          |
| `npm run build`                       | Succeeds; `devices/`, `clinical-roles/`, `procedures/` present; standalone prepared                                           |

Because the real formulary scaffold still carries zero carried/preferred rows, C-04b is not
browser-visible and no data was added to make it so; the post-build browser smoke check was
limited to regression safety (EBUS readiness still "Demo: Not ready" via the GENERIC_SUCTION
structural gap; noindex headers; no hidden identity; no new console errors beyond the known
`/api/analytics` environment issue).
