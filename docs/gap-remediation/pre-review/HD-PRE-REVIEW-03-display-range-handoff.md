# HD Batch 03 — one display-range repair

Base: `46c5bb94f779a1464da6198bba4bcf8550379419` (freshly fetched September 30, 2026).
Branch: `codex/hd03-plot-clipping-20260930`. This handoff travels with the local repair commit;
its exact commit ID is recorded in the accompanying local evidence checkpoint.

## Reproduction and scope

The source pack's L3-02 (report Figure 16, pp. 29–38) describes choosing RA's
**Low-pressure detail 0–20 mmHg**, then **Next stop** to RV/PA. Batch 03 section A
requires display-range integrity without changing waveform samples or physiology.
The unchanged current main still reproduces this in the normal reference at
`/en/icu-hemodynamics/learn?activity=waveform-interpretation`.

Before: the RV pressure path had minimum SVG y=66, with **124 sample coordinates pinned
to that top boundary**, no clip path and no clipping notice. The drawn systolic plateau
and RVSP marker falsely represented the selected axis maximum as the peak.

After: RV minimum y=25.6; PA minimum y=19.8, with **zero coordinates pinned to y=66**.
The original coordinates are geometrically clipped within the pressure plot (y=66–192),
while the ECG and respiratory lanes remain separate. Off-axis landmarks are not drawn
at a false boundary value. A visible range notice is appended verbatim to the complete
existing accessible description, including caller-supplied descriptions. Legend teaching
and existing source statements remain available.

The selected axis remains an explicit user choice; deliberate display-fault examples are
preserved. No waveform generator, sampling, respiratory offset, artifact transform,
engine state, grading, progress, clinical number or clinical/device review status changed.
Some existing modeled respiratory troughs also fall below zero on the shared reference
axis; the same geometric rule now discloses this without changing those model values.

## Ownership and preservation

Fresh GitHub metadata showed no open Hemodynamics PR. The existing
`claude/hemodynamics-2-9-22` worktree was clean with no Hemodynamics source delta against
main. Inspected development-process working directories did not occupy that tree.
Live session inventory was unavailable, so these checks do not certify every session's
intent. The user explicitly assigned this isolated slice.

Only this new worktree was edited. Existing CRRT acceptance/repair evidence, the ECMO
local patch, Wolf review stack, other open module PR lanes and literature work were
left untouched. No push, PR, merge, deployment or shared-state write was performed.

## Verification

| Check                                                                                        | Outcome                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New component regression on unchanged base                                                   | **3 failed, 1 passed**; failures expose upper/lower clamping and changed pressure coordinates                                                                            |
| Final focused/compatibility Jest                                                             | **4 suites, 87 tests passed**, 0 failed; display range, waveform teaching, H2/H3 reference/PAC safety, recognition practice                                              |
| Chromium real lesson journeys, isolated dev server                                           | **4 passed**, 0 failed; RA narrow axis → RV → PA → shared axis                                                                                                           |
| Browser conditions                                                                           | 1204×987 dark, 1440×900 light, 390×844 light, 1024×768 dark with **200% root text**; actual theme asserted                                                               |
| Browser range/geometry checks                                                                | Original off-axis coordinates, valid plot clip bounds, no off-axis landmark points, visible/equivalent notice, no figure-local horizontal overflow, shared-axis recovery |
| Changed-path ESLint, Prettier, whitespace                                                    | Passed                                                                                                                                                                   |
| Full module/repository suites, full TypeScript, production build, production/beta acceptance | **NOT RUN**, outside this bounded presentation slice; browser evidence is dev-only                                                                                       |
| Human clinical/device validation and native browser zoom                                     | **NOT PERFORMED**; root-text enlargement is not native zoom                                                                                                              |

The first compatibility run had one exact accessible-description assertion fail because
the renderer now appends the range notice. Its replacement still requires the complete
canonical description, followed only by the visible notice; axis and chamber checks remain.
The final run is green. The browser harness was corrected to assert actual theme rather
than infer it from a button label; the final four journeys use those assertions.

The preview used the existing ephemeral localhost-auth mechanism, no `.env.local` or
real Supabase credentials. A preliminary auth redirect logged missing-Supabase-configuration
noise; the authenticated lesson rendered and was tested without backend access.

## Evidence and carry-forward

Local evidence (outside Git):
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/hd03-plot-clipping-2026-09-30/`

Includes `before-geometry.json`, `before-rv-narrow.png`, `jest-before.log`,
`jest-compatibility-final.log`, `browser-final.log`, `browser-report.json`, screenshots
and JSON geometry attachments under `browser-results/`, plus the local commit checkpoint
and patch. Figure screenshots can contain the existing fixed site header; the 1204-pixel
full-page capture from the document top avoids that overlay. No patient data is present.

This closes only the reproduced normal-reference clamping manifestation of L3-02.
`WaveformStrip` is a separate renderer and was not changed or accepted here. Broader
Batch 03 plot/readability/workbench issues, existing annotation collisions, all model/source
holds and clinical review decisions remain open. Independent review of this local commit
is the next step; no further tranche was started.
