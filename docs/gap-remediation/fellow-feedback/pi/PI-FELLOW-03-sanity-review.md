# PR #262 — independent technical sanity review

Reviewed September 22, 2026 by Codex. This is a technical review of Prompt 03, not clinical approval,
a fellow walkthrough, or combined release acceptance. No merge or deployment was performed.

**SANITY REVIEW: READY TO MERGE after the bounded corrections recorded below.** The original
reviewed head required corrections; this disposition applies to the repair commit on the PR.

## Baseline and isolation

- Original PR head: `b91654d6241d84fb792b82a885a4f5bab185a0aa`, branch `claude/pi-2-9-21`.
- Fetched `origin/main`: `2124cd0f3483db6534ab65bf6dd3730b59fee463`. It had not advanced from the
  implementation base, so there were no intervening overlapping PI, shared-learning, test or
  dependency changes to reconcile.
- GitHub reported OPEN, unmerged, MERGEABLE, CLEAN. The actual 49-file PR diff was reviewed.
- Fresh dedicated checkout: `/Users/russellmiller/.codex/worktrees/codex-pr262-sanity`; repair work
  is on `codex/pr262-sanity-fixes` and is pushed as a normal fast-forward to the authorized PR branch.
  The original Claude checkout was not modified, switched or reset. PR head was rechecked before
  editing. The review checkout was newly created and had no other active session.
- Separate baseline checkout: `/Users/russellmiller/.codex/worktrees/codex-pr262-base`.
- Dedicated servers: review port 3172 and baseline port 3173. `lsof` confirmed review PID 91152's cwd
  was the dedicated review checkout. Both served their own Next build output. Playwright launched
  disposable browser contexts, with no existing browser profile or patient data.
- Local evidence: `/tmp/pr262-review/`. Dependencies were used read-only from existing installs;
  no protected environment file was read or copied, and no shared Supabase/upload command ran.

Read the Prompt 03 task and all 37 Teaching entries in the external implementation pack, the current
03 handoff/text map/owner packets, and relevant 01/02 preservation and acceptance records. The local
NBIB record for PMID 35803302 was read independently. The walkthrough remains AI-assisted persona
evidence, not a learner study.

## Findings at the original head and bounded corrections

Paths below are relative to `src/features/peripheral-imaging/`, except the e2e/doc paths. Line numbers
in this table identify the **original reviewed head**, not the subsequent repair.

| Priority | Original location                                                                                           | Reproduction / violation                                                                                                                                                                                                                                                             | Required correction applied                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | `content/transferOrigins.ts:105`                                                                            | Fresh direct entry to Section 10, skip to its closing question: “you first met it” asserted personal history that the registry derives only from pathway order. Violates truthful optional review.                                                                                   | “It first appears” describes the course. Source link, item/key, reveal/retry and unanswered exit remain.                                                                                                                                             |
| P2       | `components/stage/ChainWalkCard.tsx:35`; `components/stage/TeachingPanels.tsx:497`; `data/lessons.ts:440`   | Pulse ownership and CBCT provenance were asserted in their teaching cards despite unresolved owner packets. CBCT added a universal prior-CT exclusion omitted from both packet and map. Section 7 repeated the drafted binning definition without its glossary's provisional status. | Visible draft/source-owner status on the two accounts; replace the unrecorded prior-CT exclusion with existing Section 14 capability-separation wording; reference the visibly held binning definition. No clinical decision taken.                  |
| P2       | `content/reconstruction.ts:85`; `content/glossary.ts:317`; `data/lessons.ts:673`                            | New “nothing ... has to be inferred” and “until they agree” wording was stronger than the named local passages; the map described it as unchanged meaning.                                                                                                                           | Retain the existing wide-rotation/volume and projection-comparison statements; remove those unsupported additions. Correct the map and packet.                                                                                                       |
| P2       | `content/doseQuantities.ts:39`; `components/suite/views/DoseView.tsx:74`                                    | New lead/table generalized equality along the beam while the original panel explicitly described two free-air model planes.                                                                                                                                                          | Restore the free-air/uniform model boundary in the lead and use the existing glossary's integrated-over-area definition in the table. Equations and numbers unchanged.                                                                               |
| P2       | `components/stage/TeachingPanels.tsx:392`; `components/stage/imaging-stage.module.css` reconstruction table | Actual screenshots show “sampling component (teal)” clipped by the 200-unit SVG and phone comparison columns breaking ordinary words into fragments. Existing `toBeVisible`/outer-width assertions did not catch either.                                                             | Center the text annotation inside the existing SVG; stack comparison cells with modality labels at phone widths. Add SVG bounding-box and stacked-cell browser assertions. Anatomy/figure geometry unchanged.                                        |
| P3       | `e2e/peripheral-imaging.spec.ts:1216`                                                                       | Closed-details filter skipped the still-visible summary as well as hidden content. Existing keyboard check stopped at “Show me where”; new glossary opening used pointer clicks only.                                                                                                | Exclude only actually collapsed descendants, retaining summaries including nested-disclosure handling. Exercise Tab from navigation to summary, Enter open/close and expanded-text reachability; open glossary by keyboard throughout reflow checks. |
| P2       | `PI-FELLOW-03-handoff.md` disposition/counts; `PI-FELLOW-03-text-map.md`                                    | The actual table had 34 repaired / 3 held, while prose said 33 / 4 and counted 2.6 and 2.7 inconsistently. Material new CBCT prior-CT text was absent; several “No meaning change” entries overstated source preservation.                                                           | Correct mutually exclusive row dispositions and six-packet mapping, document omitted text and semantic changes, retain historical implementation test results as historical.                                                                         |

There were no P1 findings. No fixes were made to formulas, clinical thresholds, reconstruction
algorithms, storage, scoring, progression or other modules.

## All 37 Teaching rows, independently reconciled

“Repaired” below means the assigned safe technical/presentation work is present, not source approval.
“Held + safe” means a substantive owner decision remains. Each source ledger ID appears once.

| Source ID | Final disposition                | Implementation evidence and scope                                                                                                            |
| --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| O2        | Repaired                         | Hub/Learn ledes, Section 1 and modality names expand DTS/CBCT; glossary link present.                                                        |
| CW1       | Repaired                         | All 19 closing-item origins traced; 17 optional-review labels and correct origin links, 2 original headings; course-order wording corrected. |
| CW2       | Repaired                         | General boundary consolidated; section limits, held-image framing, immediate safety and draft status retained.                               |
| CW3       | Repaired as provisional delivery | Section-local glossary and Help use registered content/implementation semantics; binning and stored contour visibly await owner review.      |
| CW4       | Repaired                         | Framing question visible outside disclosure; recap restates it without requiring an answer.                                                  |
| CW5       | Repaired                         | Concise chosen/best/takeaway recap; full AnswerVerdict and source context remain in disclosure.                                              |
| 1.1       | Repaired                         | Section 1 sampling definition and Section 15 link; tip/component labels, now fully inside SVG.                                               |
| 1.3       | Held + safe                      | Existing Section 9 rEBUS/atelectasis limitation forwarded; optional new interpretation not adopted.                                          |
| 1.6       | Repaired                         | Same verified opening-question mechanism as CW4; source row retained.                                                                        |
| 1.8       | Repaired                         | MPR/thin-reformat and side-window definitions available; instrument differences retained.                                                    |
| 2.6       | Held + safe                      | Consistent angle labels and implementation-based signs; clinical LAO/RAO mapping still absent.                                               |
| 2.7       | Held + safe                      | Pulse ownership account present with explicit source-owner draft status at both stops.                                                       |
| 2.8       | Repaired                         | Seven reused demonstration openings identify first section and new objective; original examples remain accessible.                           |
| 2.11      | Repaired                         | Baseline-first activity title, projection legend and implementation-derived readout meanings.                                                |
| 2.14      | Repaired                         | Stored-contour terminology consistent for the same state; worked example leads; definition still draft.                                      |
| 3.2       | Held + safe                      | Shared packet with 2.6; no inferred clinical labels substituted for signed angles.                                                           |
| 3.3       | Repaired                         | Existing usable rule leads; device caveats accessible; binning points to the draft entry.                                                    |
| 3.4       | Repaired                         | Section 7 reminder names Section 3 and the new concept; no example or control removed.                                                       |
| 3.6       | Repaired within Prompt 03        | Density-class/ray meaning supplied without naming an organ. Prompt 02 presets/default preserved, not counted as a new camera repair.         |
| 3.9       | Repaired                         | Tube-load arithmetic context and non-dose qualification; no exposure target added.                                                           |
| 3.10      | Repaired                         | Existing Section 9 limitation brought forward; clinical reconciliation belongs to 1.3 packet.                                                |
| 3.11      | Repaired                         | Learner-facing biopsy-clearance limit; existing correct choice unchanged.                                                                    |
| 4.1       | Repaired                         | Analogy, larger diagrams and short comparison; full account accessible; phone rows now stack.                                                |
| 4.4       | Repaired                         | Reconstruction glosses and example-first ordering; unsupported convergence addition removed.                                                 |
| 4.6       | Repaired                         | Spread matches `smearWidth`/`dtsShift`, including zero on the object's plane.                                                                |
| 5.1       | Repaired                         | CBCT lead, Section 10 link, full comparison disclosure; no section deleted.                                                                  |
| 5.3       | Repaired                         | Scout legend says teaching tolerance, not device specification, and no collision/clearance check.                                            |
| 5.4       | Held + safe                      | Actual CBCT flow, not DTS flow; explicitly provisional; unrecorded prior-CT exclusion removed.                                               |
| 6.1       | Repaired                         | Same source-forwarded definition as 1.1; Section 15 tri-planar demonstration unchanged.                                                      |
| 6.3       | Repaired                         | Modeled-lesion labels, honest low-resolution CT context; geometry and images unchanged.                                                      |
| 6.5       | Repaired, editorial packet open  | VESPA description checked against local PMID 35803302; effect-size addition remains unapplied.                                               |
| 7.1       | Repaired                         | Rule precedes arithmetic, readable precision and exact-value disclosure; free-air qualification restored.                                    |
| 7.2       | Repaired                         | Four-quantity table and eight-field value-free template; clipboard output contains no measurements.                                          |
| 7.3       | Repaired within Prompt 03        | Existing detector-side/tube-side point moved forward with lateral/spin limits; scene-size work not claimed here.                             |
| 7.4       | Repaired                         | Existing primary-beam warning rendered as a separate callout in Section 17. “7.4” is the feedback ID.                                        |
| PR4       | Repaired                         | Section 1 links existing `two-dimensional-practice-1`; original case content unchanged.                                                      |
| IC4       | Repaired                         | Safety tag explained as teaching emphasis; no weighting, scoring, answer persistence or restrictions added.                                  |

**Final: 32 repaired, 5 held + safe, 0 already resolved, 0 not reproduced.** Original prose's four
intended held IDs were 1.3, 2.6, 2.7, 3.2; original row 2.6 contradicted that classification. The
review additionally classifies substantive CBCT confirmation (5.4) as held.

The six packets map as follows: (1) rEBUS → 1.3 + 3.10; (2) signed angles → 2.6 + 3.2;
(3) pulse ownership → 2.7; (4) CBCT → 5.4; (5) VESPA → 6.5; (6) drafted definitions → CW3,
with binning used by 3.3 and stored contour by 2.14. Thus packet count and held-row count legitimately
differ, but the original mutually exclusive row accounting was nevertheless inconsistent.

## Six owner areas and provenance

- **rEBUS:** existing qualified Section 9 statement moved forward, sources carried with it. No new
  decision on what a concentric view establishes. Existing glossary/chain wording was not silently
  marked clinically reviewed.
- **Angles:** model-positive detector movements match `suiteFrame`/`beamDirection`; clinical console
  mapping remains unapplied. This is implementation description, not device-convention validation.
- **Pulse ownership:** still a proposed map, now visibly provisional in the source and detector
  cards. The general system-dependent caveat alone was not adequate evidence of owner approval.
- **CBCT:** modality routing is technically correct; substantive provenance account now explicitly
  awaits owner review. The universal prior-CT exclusion was neither in the cited reconstruction
  account nor the packet and has been removed. Existing “every direction”/truncation statements
  require the owner's source judgment, not a technical test's approval.
- **VESPA:** local registered abstract independently supports the study design, bundled
  intervention/comparator, CT outcome timing and “no differences found” complication statement.
  Neither the lesson nor glossary inserts the proposed numerical effect size. The lesson retains
  the individualization warning; editorial confirmation is still open.
- **Draft definitions:** both glossary entries already printed “Drafted from the course’s sources,
  awaiting the owner’s review.” They were not hidden metadata. Stored contour describes the
  acquisition/annotation boundary and remains a draft. Binning's separate inline gloss lacked that
  status and is corrected. No source authorization was inferred from a source ID's existence.

Registry checks: transfer origins derive real authored/rendered question references;
demonstration origins derive shared examples and preserve values; related cases resolve existing
case IDs. Dose rows carry existing source IDs and definitions; the blank template is independent of
model/learner values. Warning inventory describes actual selectors and categories. Glossary source
labels name real local blocks or implementation symbols, but most section-teaching definitions are
paraphrases, not verbatim quotations. The validator checks linkage, not clinical entailment.

Representative text-map checks covered acronym expansion, rEBUS forward-copy, glossary terms,
optional review, reminders, opening/recap, warning consolidation, readouts/signs, reconstruction,
CBCT flow, dose table/template and safety tags. Corrections explicitly record the omitted prior-CT
sentence, the stronger reconstruction assertions, free-air qualifier, projection legend and exact
runtime labels. Earlier claims of “No meaning change” for those substantive additions are not accepted.

## State, calculations and previous contracts

Read the behavioral-file diff rather than relying on green tests. `physics.ts` changes only three
relationship labels; `dtsModel.ts` only overlay labels; `labMetrics.ts` adds descriptions and changes
control labels. Formula bodies, constants, thresholds/tolerances, anatomical coordinates, camera
configuration, DTS planes, overlay calculations and acquisition engines are unchanged. Dose display
rounding is presentation-only and exact values remain available. `types.ts` adds an optional safety
callout. No dependency, schema, publication/review flag, progress reducer or storage implementation
is changed.

An independent base-versus-repair executable snapshot comparison returned IDENTICAL for: lesson
IDs/check IDs/prerequisites; step IDs/phases/completion and gate fields; interactions and choice
IDs/labels/correct keys; transfer identities where present; suite specs; control ranges/defaults;
demonstration values; fixed states and evidence classifications for both rounds. The exact three
illustrative-only identities remain `current-anatomy:example:0`, `changing-anatomy:example:0`,
`staff-protection:example:0`.

Browser checks verified authored examples independent of learner history, saved acquisition versus
live display, optional DTS overlays and withheld overlays on checks, projection enlargement keyboard
entry and immediate Escape/Close dismissal, vertical touch scrolling through the 3D wrapper, per-axis
live thin sections with slabs, and all six camera presets. Self-paced reveal, retry and unanswered
finish remain available and do not fabricate stored responses. No Prompt 01/02 contract was reopened.

## The two e2e changes

**Help:** skipping collapsed content is correct; skipping its visible summary was not. The repair
retains summary text in reachability checks and separately opens the glossary by keyboard. The
long-content test now traverses Close → Show me where → summary using Tab, opens/closes with Enter,
checks expanded content and restores focus. Reflow tests also open the glossary with the keyboard
and check that all expanded text is reachable by dialog scrolling.

**Scene labels:** all eight labels, overlap checks, containment and leader/proximity checks remain.
Suite, Beam, Anterior, Side, Head, Target, return to Suite, orbit change and resize are exercised.
Independent animation-frame probes over 1.8 seconds per preset found the same excursions on baseline
and original head: Beam 1 sampled frame, Side 1, Head 1, Target 2; none for Suite/Anterior. Final
positions were contained. `CameraRig` sets positions in an effect with damping disabled; this is
existing label/DOM frame synchronization, not a new Prompt 03 camera animation. Two rounded stable
reads cannot mathematically rule out arbitrary future movement, but there is no delayed animation
in this path and the longer probe found no late movement after settlement. Persistent bad count,
overlap or containment still times out. The changed snapshot is faithful to the settled-layout
contract and does not hide a newly introduced visual regression.

## Browser and accessibility

Verified affected surfaces at 1280×900, 1024×768, 390×844, 320×740, 1280×900 with 200% root text,
and 320×740 with 200% root text (also 1440×900). Inspected screenshots, not just bounding boxes.
Glossary, expanded Help, reconstruction comparison, dose table/template and Section 1 definition
were exercised. Visual inspection found the two layout defects above; repaired surfaces were rerun.
Normal-text pages have no horizontal overflow. At 1280/200%, baseline and original head both measure
1331px solely because of the same shared-header link (`right = 1330.765625`, outside PI).
PI containers and affected surfaces fit; this baseline defect was not used to excuse PI clipping.
The smallest doubled-text view needs substantial vertical scrolling; this is root-text enlargement,
not native browser zoom. Existing Help CSS-zoom checks are separately labelled as CSS zoom.

## Validation accounting

All browser results are local direct routes, not production or beta-wrapper acceptance.

| Run                                                                       | Result                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original-head PI + shared-learning Jest                                   | 59 suites, 535 tests passed.                                                                                                                                                 |
| Original-head focused browser selection                                   | 26 unique tests passed, no failures.                                                                                                                                         |
| Initial type-check                                                        | Failed: reused primary dependency install lacked declared `fake-indexeddb`, causing TS2307 and downstream TS7019 in unrelated module-beta tests.                             |
| Type-check with reviewed checkout's dependency install                    | Passed. No package or lockfile changes.                                                                                                                                      |
| First repair Jest                                                         | 57 suites passed, 2 failed; 537 tests passed, 2 failed. Two old copy assertions still required the removed CBCT overstatement.                                               |
| Repair Jest after assertions test the corrected bounded claim             | 59 suites, 539 tests passed; repeated after final label/table repair.                                                                                                        |
| PI route Jest                                                             | 1 suite, 9 tests passed. Final combined relevant total: 60 suites / 548 unique tests.                                                                                        |
| First repair browser selection                                            | 23 passed, 1 failed: beam-stop caption stayed at 0° during navigation instead of 30°. Source edits/HMR overlapped this run; cause not proven. No assertion was weakened.     |
| Isolated beam-stop rerun                                                  | 3/3 repetitions passed; counts as one unique passing test, not three.                                                                                                        |
| Final affected browser selection                                          | 16/16 passed, including all seven reflow conditions, keyboard Help, review/case/recap and walk/camera checks.                                                                |
| Additional independent probes                                             | Baseline/head frame and header comparison; actual draft surfaces, primary-beam warning, clearance wording and blank clipboard template; base/head identity/value comparison. |
| Final repository type-check; changed-path ESLint; formatting; diff checks | All passed after final source repair; ESLint reports no warnings.                                                                                                            |

The supplemental surface probe first timed out after it skipped a still-loading read step and
ran past the scout surface. Its navigation was corrected to wait for reading-step readiness (the
same rule as the committed suite); the complete probe then passed, including actual clipboard
contents. This was a probe correction, not an application/test-assertion relaxation. The independent
identity probe also needed its temporary import name corrected to the actual `fixedExampleValues`
export before it ran; its four final comparisons were identical.

Focused browser selections overlap and are **not added together**. The initial 26 plus newly exercised
walk conditions and normal 1280 full-surface reflow provide 31 unique existing-spec checks, with
reruns listed separately. No full production build or all-62 rerun was required for this bounded
review. The known unrelated BBT manifest failure was not rerun or treated as a PI result.

## Remaining limits and recommendation

All six owner packets remain open in the senses distinguished above. Explicitly provisional material
is not clinical/source approval. Existing Prompt 01/02 layout tradeoffs and the shared-header overflow
remain. Browser tests cannot establish clinical correctness or learner effectiveness. No new media,
assessment batch, publication change or Prompt 04/05/06 work was started.

**SANITY REVIEW: READY TO MERGE** applies only to this corrected, bounded Prompt 03 batch with those
holds preserved. No merge or deployment is authorized by this report.
