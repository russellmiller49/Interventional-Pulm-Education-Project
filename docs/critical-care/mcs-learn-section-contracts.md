# MCS Learn: primary surfaces and section learning contracts

How the nine Mechanical Circulatory Support Learn sections are authored, and what a reviewer should
check. Companion to `mcs-model-limitations.md`, which covers what the simulation does and does not
represent.

## What a section is made of

Three authored modules, all validated when they load, so an incomplete section fails the build
rather than the learner:

| File                                  | Holds                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `content/primarySurfaces.ts`          | Which surface each section leads with, which region on it, and why. Plus the two target registries the components tag their regions against.                                                                                   |
| `content/learnControls.ts`            | Every control a section may point at: its label, where it lives, the simulator action it produces, the one variable it changes, and what moving it does _not_ establish.                                                       |
| `content/sectionLearningContracts.ts` | The section's full contract — clinical question, patient problem, pathway, recognize task, prediction, action, observation, the four causal levels, what it establishes and does not, the common misreading, and the transfer. |

The contract is the authority for everything the learner reads. `McsLearnPrimaryPane`,
`McsLearnTeachingPane` and `McsLearnActionPane` render it; none of them decides anything about it.

## The primary-surface map

Anatomy leads where the immediate task is topological. The monitor leads where it is a signal.
Sections that contain both are decided by the immediate objective, and the complementary half is
carried in the teaching pane.

| #   | Section                            | Surface | Target                                       | Why this one leads                                                                                           |
| --- | ---------------------------------- | ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `mcs-foundations-signals`          | monitor | `monitor:flow-account`                       | The task is separating three flow numbers that sit next to each other. Nothing turns on where a catheter is. |
| 2   | `mcs-foundations-mechanisms`       | anatomy | `anatomy:support-pathway-overview`           | Source, active component, destination for three mechanisms — a statement about topology.                     |
| 3   | `iabp-timing-triggering`           | monitor | `monitor:arterial-waveform`                  | A timing error is a shape on the arterial trace and is invisible anywhere else.                              |
| 4   | `iabp-efficacy-limits`             | monitor | `monitor:response-trend`                     | The ceiling shows up as pressure and effective flow separating over time.                                    |
| 5   | `impella-unloading-placement`      | anatomy | `anatomy:left-pump-inlet-and-outlet`         | Placement is the subject; the flow consequence follows from it.                                              |
| 6   | `impella-suction-purge-rv`         | anatomy | `anatomy:right-pump-caval-to-pulmonary-path` | The reason two pump flows must not be added is topological. The numbers alone invite the error.              |
| 7   | `lvad-parameters-assessment`       | monitor | `monitor:power-pulsatility`                  | The displayed flow is computed from power and speed; that is only visible with all three on screen.          |
| 8   | `lvad-alarms-emergencies`          | monitor | `monitor:alarms`                             | The alarm band and what produced it are the object of study.                                                 |
| 9   | `mcs-device-selection-integration` | monitor | `monitor:filling-pressures`                  | The limiting problem is named from the filling pressures, before any device is named.                        |

No adjacent pair shares both a target and a kind of task; the contract validator refuses one that
would.

## The six phases

`recognize → predict → act → observe → explain → transfer`, in order, per section.

- **Recognize** asks a real identification with authored options and feedback.
- **Predict** requires a commitment. The shared `AnswerVerdict` then says whether the read holds and
  why the alternatives do not — and does not advance. A separate Continue does.
- **Act** presents one control, highlighted, or states explicitly that no adjustment is expected.
  Whether the action has been done is a **state predicate** (`isActionSatisfied`), not a list of
  action ids: three sections build their starting state with the same control the learner is then
  asked to move, and an id-based check would open already satisfied.
- **Observe** compares readings captured on entry to Act against the live ones. Where the model does
  not represent something a learner might expect — the high-power pattern in section 8 leaves the
  delivered flow where it was — the contract says so rather than inventing a response.
- **Explain** walks pressure → flow → oxygen delivery → organ response and names one common
  misreading.
- **Transfer** changes one clinically meaningful condition and requires a committed answer plus the
  paired live work.

A section is recorded only after the whole sequence. There is no learner-facing control that records
a section, and completion copy says what it records: participation, not readiness.

## Running the harnesses

No `package.json` scripts — `package.json` is shared during this parallel round.

```bash
npx tsx scripts/critical-care/review-mcs-section-contracts.ts
```

Prints all nine contracts side by side, then drives each section's authored action through the
reducer and reports what actually moves. Exits non-zero on any flag: a target that is not on the
selected surface, a control that does not render on the section's pathway, an action predicate that
cannot be satisfied, a duplicate instruction or explanation, a non-finite reading, or an observation
in which nothing changes. `MCS_SECTION=<id>` narrows it to one section.

```bash
npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
```

Renders all nine live teaching panels at every reveal stage and both pane widths onto one page, and
gates on the checks a screenshot cannot make — including the wording the correction pass removed, the
congestion framework's provenance, and the cohort thresholds' cohort-specific labelling. Added by M4;
see [`mcs-live-teaching-panels.md`](./mcs-live-teaching-panels.md) for what each panel claims, what it
refuses to claim, and where the filling-pressure congestion framework comes from.

```bash
npx tsx scripts/critical-care/dump-mcs-signals.ts
```

The flow-chain table. Unchanged by this package; still the place to check that a right-sided pump
never appears in the systemic total.

## Clinical boundaries this package preserves

- Counterpulsation reports no device flow, in the model and in every contract.
- Left- and right-sided microaxial pathways stay distinct, and their flows are never summed —
  neither by the engine nor by any teaching surface. A test pins the presentation side as well as
  the model side.
- Every displayed pump flow is labelled an estimate; effective systemic delivery is labelled
  reasoned.
- Durable support is a different decision in kind, not a larger temporary one.
- The pulmonary pulsatility ratio moves only weakly with right-sided support in this model, and
  mostly through right atrial pressure. Sections 6 and 9 state that limitation on screen, and no
  section asks the learner to judge right-sided support from it. Engine behaviour is unchanged.

## Residual limitations

- **Below about 1024 px wide** the shared teaching workspace collapses to one full-width pane with a
  tab row, so the live surface and the task are one click apart rather than side by side. The
  threshold and the default pane belong to `ResizableTeachingWorkspace`, which this package does not
  modify.
- **Resizing the window** keeps the pane widths the learner last dragged, so the third pane absorbs
  the change and can become narrow until the page is reloaded. Same shared component.
- The module chrome above the activity viewport is 338 px at every window size. The workspace fits
  what is left; on a 1280×720 display that is 384 px of pane.
