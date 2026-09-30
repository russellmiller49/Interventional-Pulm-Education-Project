# Comparison tray lookup recovery — local handoff

Base: `46c5bb94f779a1464da6198bba4bcf8550379419`, freshly fetched after the Mac reconnected.
Branch/worktree: `codex/device-compare-lookup-retry-20260930`, under the project's worktree root.
The local evidence checkpoint records the exact repair commit and changed-file hashes.

## Reconciliation and selected scope

The September 19 module packs remain historical proposals; later merged work and current
roadmaps take precedence. Device Intelligence's daily-reference and Atlas UX increments
already implement saved lists, comparisons and physician-reviewed reference coverage.
New exact-product conclusions and clinical/operational procedure approvals still need
owner review. This slice repairs the existing comparison utility, without selecting a
new evidence tranche or adjudicating a product's status.

Fresh GitHub metadata still shows Wolf #295–307 and BBT #273, PI #279, MCS #284,
MV #290 and BF #291 open. Their lanes were not duplicated. Both Device Intelligence
worktrees were clean; the recent `codex/device-9-28` lane had no Device Intelligence
source/data/documentation delta against fetched main. Process working-directory checks
found no Device Intelligence writer. Live session inventory was unavailable, so these
checks do not certify every session's intent; no ownership conflict was observed.

The reviewed overnight heads remain preserved: CRRT `fb6f3910`, Hemodynamics `11d7c6fb`,
and ECMO `046ae64a`. No reviewed worktree or roadmap artifact was edited.

## Before and after

Before, `CompareTray` caught a failed HTTP/network name lookup and stored an empty
resolved result. The tray offered no failure message or retry. Unchanged-main Chromium
reproduced a failed lookup with two selected IDs, zero alerts and zero retry controls.
Three new component regressions failed on the unchanged implementation.

After, a failure is keyed to the exact current selection and offers an accessible error
message plus **Retry device lookup**. Retry requests the same IDs through the existing
GET-only cohort-filtered endpoint. Success clears the failure. A late response from an
obsolete selection cannot replace current names. A successful empty lookup is not
misrepresented as a transport failure, and neither failure nor retry changes either list.

The added row initially made the fixed tray obscure a device button at 390 px and 200%
root text. The tray now caps its height at 40 dynamic viewport percent and scrolls when
necessary. A measured spacer reserves its rendered height. Retry and the existing compare
link remain keyboard-reachable; page controls remain usable. No shared chrome was changed.

Only transport-error UI strings were added to English, Spanish and Chinese locale bundles.
Product facts, data generators, safety/recommendation gates, inclusion, permissions,
storage formats, maximum selection count, institutional behavior and clinical copy are unchanged.

## Verification

| Check                                                                                        | Result                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New regression on unchanged main                                                             | **3 failed, 11 passed** in the comparison suite                                                                                                                                                                        |
| Final focused Jest                                                                           | **3 suites, 22 tests passed**, 0 failed; comparison, saved workspace, shared saved-device API                                                                                                                          |
| Initial browser verification                                                                 | 4 passed, 1 failed: the newly added error row blocked second selection at enlarged text; failure log/report retained                                                                                                   |
| Final Chromium verification                                                                  | **5 passed**, 0 failed/skipped: en 1440×900, en/es/zh-CN 390×844, en 390×844 with 200% root text                                                                                                                       |
| Browser assertions                                                                           | Real device selection, failed lookup, keyboard access to Compare and Retry, successful unchanged API lookup, identical stored comparison IDs, saved-list independence, no tray horizontal overflow, spacer containment |
| ESLint, Prettier, whitespace                                                                 | Passed for changed paths                                                                                                                                                                                               |
| Full repository/module suites, full TypeScript, production build, beta/production validation | **NOT RUN**; evidence is from an isolated dev preview                                                                                                                                                                  |
| Native browser zoom, other browser engines, human translation/clinical review                | **NOT PERFORMED**; root-text enlargement is not native zoom                                                                                                                                                            |

A final rerun initially could not connect because the owned preview had exited; all five
cases failed before reaching the UI. The failure log/report are retained separately.
Restarting that localhost preview restored access, and the final five journeys passed.
Preview telemetry also logged missing Supabase configuration; no configuration or shared
service was changed, and telemetry persistence was not validated.

Short focused checks were run serially under the local long-job guidance. No long deterministic
job requiring `codex-run-and-wake`, expensive model review or broad test suite was launched.

## Artifacts and next step

Evidence lives outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/device-compare-lookup-retry-20260930/`.
It includes unchanged-browser JSON/screenshot, failing-before and passing-after Jest logs,
initial browser failure log/report, final browser report, screenshots and geometry attachments,
sanitized preview log, patch and commit checkpoint. The preview uses synthetic/local UI state,
committed catalog data and an ephemeral local-auth token; no patient data or owner credentials.

Independent review of this local commit is next. Product coverage/review-tranche selection,
clinical/device/rounding decisions, media rights and sponsor permissions remain with their
existing owners. Wolf and literature work remain separately assigned. No push, PR, publication,
merge, deployment, shared-data write or further implementation tranche was performed.
