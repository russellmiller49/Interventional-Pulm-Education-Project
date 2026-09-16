# MCS-AF-PRESENTATION-01 — the atrial-fibrillation trigger limitation, where the trigger is chosen

Presentation repair only. Prepared 2026-09-15 by an AI authoring assistant (Claude) at the owner's
request. **Nothing here is clinical or device approval, and nothing here resolves the clinical
disagreement.** [MCS-03](MCS-03-handoff.md) claim-review item `MCS-03-05` remains `NOT REVIEWED` in
[MCS-03-claim-review-queue.json](MCS-03-claim-review-queue.json); this task did not touch that file,
the model, or any answer key. Device Intelligence is out of scope and nothing under
`src/features/ip-device-intelligence` or its data was read or changed.

## Delivery and scope

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-mcs-af-presentation-01`, branch
  `claude/mcs-af-presentation-01`, cut from `origin/main` at `21fc130a` (merge of PR #227). The tree
  was clean.
- **Authoritative merged behavior, carried forward unchanged:** [MCS-01](MCS-01-handoff.md)
  (PR #217 — optional questions, explanation before answering, retry, location-only progress),
  [MCS-02](MCS-02-handoff.md) (PR #219 — matched filled/underfilled comparisons) and
  [MCS-03](MCS-03-handoff.md) (PR #223 — source classifications, the regraded `assume-ecg` option,
  the rewritten transfer label and explanation, the two worked-case model-limit lines).
- **Module-local.** Every changed and added file is under
  `src/features/mechanical-circulatory-support`. Nothing in `learning-module`, the shared stage,
  `critical-care` content, `src/lib`, routes, the catalog, progress storage, analytics or media
  changed. No dependency, migration, environment file or remote call was added. No URL was fetched
  and no source document was re-read: the wording is the wording MCS-03 already checked.
- G02 was not started.

## Where the limitation was already present

MCS-03 found the disagreement and deliberately held the model: in atrial fibrillation the engine
rates pressure triggering (0.74) above ECG (0.5) and internal (0.4), and clears its own
`iabp-trigger-unreliable` alarm on pressure, while the supplied Cardiosave material prefers ECG for
arrhythmias, advises against pressure triggering in a sustained irregular rhythm, and says not to
remain in internal triggering while the patient generates a cardiac output. MCS-03 wrote the
limitation onto four surfaces:

| Surface                                                                       | Where a learner meets it                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Transfer exercise label (`content/lessonTransfers.ts`, `requiredActionLabel`) | Steps pane, **below** the transfer's three answer choices         |
| Transfer explanation (same file, `item.explanation`)                          | Only after the answer is committed, or after **Show explanation** |
| IABP-02 and CAP-IABP-01 worked explanations (`content/scenarios.ts`, debrief) | Only after **Open worked explanation** / **Show explanation**     |
| Timing panel boundary (`components/teaching/IabpTimingTriggeringPanel.tsx`)   | Inside the live teaching panel, beside the synchrony figure       |

## Why learners did not see it at the relevant step

Two separate reasons, and MCS-03 recorded the first one as an open finding.

1. **The timing panel is never mounted on the Learn route for this section.** `iabp-timing-triggering`
   is an introductory section (`content/introductorySteps.ts`), and `McsTeachingColumn` takes its
   guided branch for introductory sections outside the loop walk — that branch renders the framing
   and explanation prose and never renders `McsTeachingPanel`. So the boundary's condition
   (`state.patient.rhythm === 'atrial-fibrillation'`) is unreachable on `/learn` for the one section
   whose transfer puts the patient in atrial fibrillation. MCS-03 described this as a stage-visibility
   question for the shared-stage owner; it is in fact module-local, and mounting the whole live panel
   on the transfer step would open far more teaching than the step intends.
2. **The other three surfaces are in the wrong place or the wrong moment for a trigger choice.** The
   trigger selector lives in the Simulator pane ("Controls for this task"); the exercise label is in
   the Steps pane below the answer choices, and the explanation and both debriefs open only after a
   commitment or a reveal. A learner who simply opened the selector — on the transfer step, in
   IABP-02, in CAP-IABP-01, or in the studio with the rhythm set to atrial fibrillation — could watch
   the modeled synchrony figure rise from 50% to 74% and the trigger alarm clear on pressure, with
   nothing on screen saying that the checked device labeling says the opposite.

## The presentation change

One conditional note, rendered beside the trigger selector, in both selectors the module has.

| File                                                            | Change                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `content/afTriggerLimit.ts` (new)                               | `MCS_AF_TRIGGER_LIMIT` — the sentences, and `mcsAfTriggerLimitApplies(state)` — IABP **and** modeled rhythm atrial fibrillation |
| `components/McsAfTriggerLimit.tsx` (new)                        | Renders the note, or `null`. No dispatch, no state, no disclosure, no control of its own                                        |
| `components/stage/McsTaskControls.tsx`                          | Renders it under the Trigger source selector; the selector gets `aria-describedby` pointing at it when it applies               |
| `components/McsControls.tsx`                                    | The same, in the full control panel the cases, the walkthroughs and the studio use                                              |
| `components/stage/mcs-stage.module.css`, `…-support.module.css` | One rule each: an amber left rule; in the full panel it spans the control grid so the sentences stay readable                   |
| `__tests__/mcs-af-presentation.test.tsx` (new)                  | 16 tests: the presentation through the interface, and the model and the holds pinned to the MCS-03 replay figures               |

Because the condition is read from live model state rather than from a lesson or case id, the note
follows the rhythm to every surface where the rhythm and an IABP meet: the Learn transfer step,
IABP-02, CAP-IABP-01 and an atrial fibrillation the learner sets in the studio. It is absent in
sinus and paced rhythm, absent for Impella and durable LVAD, and absent wherever there is no trigger
selector.

### The reused wording, in full

> **Model limit held for faculty review.** In atrial fibrillation this model rates pressure
> triggering above ECG triggering. The supplied Cardiosave material recommends ECG triggering for
> arrhythmias, warns against pressure triggering in a sustained irregular rhythm, and says not to
> keep internal triggering while the heart generates an output. Check a trigger choice against the
> console's own instructions and the trace, not against the modeled synchrony figure.

No clinical prose was written for this task. Sentence by sentence:

| Sentence                                            | Where MCS-03 already wrote it                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| "Model limit held for faculty review"               | Lead of the IABP-02 and CAP-IABP-01 worked explanations (`content/scenarios.ts`) |
| "In atrial fibrillation this model rates…"          | Timing panel boundary, verbatim (`IabpTimingTriggeringPanel.tsx`)                |
| "The supplied Cardiosave material recommends…"      | Timing panel boundary, verbatim                                                  |
| "Check a trigger choice against the console's own…" | Closing sentence of both worked explanations                                     |

It says the three things in order: what the simulation does, what the checked documents say, and
that the disagreement is held rather than settled. It recommends no trigger, and it makes no claim
about ECG outside the cited irregular-rhythm context — every clause is attributed to its owner
("this model rates…", "The supplied Cardiosave material…").

**One deliberate duplication.** The sentences now live in `content/afTriggerLimit.ts`, and the timing
panel still carries them inline. The MCS-03 claim-review queue pins `IabpTimingTriggeringPanel.tsx`
and that excerpt as a reviewer's locator (`mcs03-claim-review-queue.test.ts` greps the file), so the
panel was left byte-identical rather than editing the owner's review artifact. The new suite asserts
the panel's rendered boundary equals the composed constants word for word, so the two copies cannot
drift silently. If the queue is ever re-cut, the panel should import the constants and that
assertion can go.

## What did not change

- **The engine.** `computeIabpSupport` trigger coefficients, the timing-quality product, the
  `iabp-trigger-unreliable` threshold, every alarm and every derived metric are untouched.
- **The exercise.** Stem, the three options, their labels, rationales, plausibility values,
  `correctChoiceIds`, `reviewStatus: 'draft'`, `requiredActionIds`, `requiredActionLabel`,
  `isWorkSatisfied` and the transfer observation are all as MCS-03 left them. The MCS-03 regrade of
  `assume-ecg` to `reasonable-but-incomplete` and its Cardiosave rationale are unchanged.
- **The cases.** IABP-02 and CAP-IABP-01 keep their starting patients, starting devices (including
  CAP-IABP-01's internal trigger), permitted actions, success criteria and debriefs.
- **Selectability.** ECG, Arterial pressure and Internal all remain selectable; nothing is disabled,
  gated, graded or newly required, and the note carries no button, input or disclosure.
- **Progress and storage.** No key, writer, reducer or analytics payload changed; the MCS record is
  still location and visited topics only.
- **The MCS-03 records.** The claim-review queue, the observation guide, the source list and the
  shared critical-care records were read and not edited.

## Model and faculty holds still open

These are **not** resolved by this task and are the reason the note says "held for faculty review".

1. **`MCS-03-05`, the trigger coefficients.** In atrial fibrillation the model still rates pressure
   (0.74) above ECG (0.5) and internal (0.4), and still clears its trigger alarm only on pressure.
   Any change is a separate, reviewed engine task.
2. **IABP-02 still requires pressure triggering for its modeled useful-timing signal.** Its success
   criterion is `timingQualityPercent ≥ 60`. From the case's opening state, ECG reaches 50 and
   internal 40; only pressure reaches 74. Held for faculty/model review.
3. **CAP-IABP-01 still requires pressure triggering, and still opens on internal triggering.** Its
   criterion is `timingQualityPercent ≥ 65`. With both timing landmarks corrected to zero offset —
   everything else the case asks for — ECG reaches 50 and internal 40; only pressure reaches 74. The
   internal-trigger starting state, which the supplied Cardiosave material says not to keep while the
   patient generates output, is part of the same hold.

Both case holds are pinned by
`mcs-af-presentation.test.tsx` → "still reaches both cases' useful-timing signal only on pressure
triggering", so a reviewed model or criterion change has to come back through that assertion rather
than passing silently.

## Tests

Baseline was taken on the same tree before the change, so every comparison below is like for like.

| Suite                                                                                             | Before                            | After                             |
| ------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| `src/features/mechanical-circulatory-support` + `src/app/[locale]/mechanical-circulatory-support` | 37 suites, 766 tests, all passing | 38 suites, 782 tests, all passing |
| `src/features/critical-care` + `src/features/learning-module`                                     | 3 suites / 3 tests failing        | the same 3, unchanged             |
| `npx tsc --noEmit`                                                                                | clean                             | clean                             |
| ESLint on the changed files                                                                       | —                                 | clean                             |
| `npx prettier --check src/features/mechanical-circulatory-support`                                | —                                 | clean                             |
| `git diff --check`                                                                                | —                                 | clean                             |

The three pre-existing failures are unrelated to MCS and reproduce identically on the base commit:

- `critical-care/__tests__/curriculum-sequencing.test.tsx` — CRRT cases in authored station order;
- `critical-care/__tests__/accessibility.test.tsx` — the CRRT pressure-lab circuit image label;
- `critical-care/__tests__/learner-copy.test.ts` — 154 static-copy findings across several modules.
  The count is **154 before and 154 after**: the new component and content file add none.

New suite `__tests__/mcs-af-presentation.test.tsx` (16 tests), driven through the real stage and the
real reducer:

- the note is on the Learn transfer step with the selector still on ECG and the optional exercise not
  performed, and the selector's `aria-describedby` resolves to it;
- it stays on screen through pressure → ECG → internal → ECG, with all three always selectable and
  never disabled;
- it carries no button, input, select, link or disclosure;
- reopening the step restores ECG, keeps the note, fabricates no trigger action, and leaves the
  stored record as MCS-01's seven location fields;
- committing "Keep ECG triggering" still yields the MCS-03 rationale, with Try again and Continue
  both enabled, and the note outside the verdict;
- it applies to an IABP in atrial fibrillation and to nothing else (sinus, paced, Impella);
- it is on screen from the opening state of IABP-02 and CAP-IABP-01, before any action;
- the panel boundary and the constants match word for word; both debriefs still carry the lead and
  the closing sentence; the transfer label, key, options and plausibilities are unchanged;
- the model figures are pinned: atrial fibrillation ECG 50 / pressure 74 / internal 40 with the
  trigger alarm on ECG and internal and clear on pressure; sinus 100 / 90 / 62; the transfer work
  predicate satisfied by any trigger on a running balloon and by none on a stopped one.

## Browser evidence

Dev server `claude-mcs` (`next dev --port 3122 --webpack`) in this worktree, 1400 × 900, English,
signed out. The only console errors are `500`s from the absent `.env.local` Supabase keys, which are
an environment condition of a fresh worktree and predate this change; nothing in the changed
components logged.

| Route                                                | Observed                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learn?lesson=iabp-timing-triggering&phase=transfer` | Note under the Trigger source selector on entry; selector `ECG`; `data-transfer-work` `met=false`; status "You can explore any controls or continue…"; `aria-describedby` matches the note id |
| Same, selector → Arterial pressure                   | Synchrony 50 → 74 (captured comparison "increased (24 percentage points)"), "Trigger reliability reduced" gone — model unchanged — and the note still on screen                               |
| Same, selector → ECG again                           | Value `ecg`, alarm back, note still there, **Try again** enabled, primary "Continue to next section: Timed correctly, still not perfusing" enabled                                            |
| Same, answer "Keep ECG triggering…"                  | "Partly correct. Defensible as far as it goes, and it leaves a step out." with the MCS-03 Cardiosave rationale and explanation — unchanged                                                    |
| `learn?lesson=iabp-timing-triggering&phase=act`      | Sinus rhythm: no note                                                                                                                                                                         |
| `learn?lesson=iabp-efficacy-limits&phase=transfer`   | No note                                                                                                                                                                                       |
| `practice?case=IABP-02`                              | Note under the selector on load, trigger `ecg`, worked explanation still closed, "Counterpulsation is 50% synchronized"                                                                       |
| `assess?case=CAP-IABP-01`                            | Note on load, trigger `internal`, "Counterpulsation is 16% synchronized", worked explanation still closed                                                                                     |
| `practice?case=IABP-01`, `IMP-01`, `LVAD-03`         | Controls intact, no note                                                                                                                                                                      |
| `practice` (Mechanism Studio), IABP selected         | Sinus: no note. Rhythm → Atrial fibrillation: note appears and describes the selector                                                                                                         |

## Checks not run

Full `npm test`; production build; Playwright (including `e2e/mcs-unloading.spec.ts`); keyboard-only
and screen-reader passes; widths other than 1400 × 900; light-theme screenshots; `es` and `zh-CN`
wording (English only); authenticated sync or remote analytics; learner observation; faculty or
device review; any URL fetch or re-reading of the Cardiosave documents.

## Review status

**NOT REVIEWED.** `MCS-03-05` keeps its `NOT REVIEWED` decision with a null reviewer; this task made
an already-authored, already-unapproved limitation reachable at the control, and made no statement
about which trigger is correct. The two practice-case model holds above need faculty or device
review before any of the affected behavior changes. Device Intelligence remains out of scope.
