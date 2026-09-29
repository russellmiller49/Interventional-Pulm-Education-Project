# Medical Thoracoscopy — module documents

A new top-level course at `/medical-thoracoscopy`: nineteen Learn sections in five chapters, seven
practice scenarios, four integrated cases and full-3D experiences, taught on the Richard Wolf
Mini-Thoracoscopy Set. Richard Wolf sponsors the module. The owner keeps editorial control.

The module is in development. Nothing here is published, clinically reviewed, fact-checked by the
manufacturer or cleared for rights unless a record in this folder says so, names who decided, and
gives the date.

## Read in this order

| Document                                                | What it settles                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [Owner decisions](owner-decisions.md)                   | What the owner has decided, and what is still open with the default being built                                                             |
| [Implementation manifest](implementation-manifest.json) | The imported inventory: sections, scenarios, cases, controls, spine, budgets, gate criteria. Each item names the plan and line it came from |
| [Plan reconciliation](plan-reconciliation.md)           | The three planning layers, where they differ, and which one governs                                                                         |
| [Learning contract](learning-contract.md)               | How the course treats the learner: self-paced, explanation first, nothing graded                                                            |
| [Fidelity contract](fidelity-contract.md)               | What each 3D experience does and does not represent                                                                                         |
| [Module plan](module-plan.md)                           | Learner, spine, controls, the one diagnostic table, and the order concepts are taught in                                                    |
| [Section authoring guide](section-authoring-guide.md)   | How to write one section                                                                                                                    |
| [Review lanes](review-lanes.md)                         | Who reviews what, kept separate: clinical, manufacturer, rights                                                                             |
| [Device register](registers/device-register.md)         | Every device fact, where it was read, and what is still not known. Printed from the device definitions                                      |
| [Claim review queue](registers/claim-review-queue.md)   | Every claim awaiting a reviewer. Printed from the claim register                                                                            |
| [Source register](registers/source-register.md)         | The literature and the anatomy dataset, with how much of each was read                                                                      |
| [Rights register](registers/rights-register.json)       | What the module may do with each thing it uses, and what may not be uploaded                                                                |
| [Asset ledger](registers/asset-ledger.json)             | Every file the module serves, against its budget                                                                                            |
| [Performance table](registers/performance-table.json)   | The targets, and what has been measured against them                                                                                        |
| [Traceability](registers/traceability.json)             | For each experience: outcome, content, claims, assets, tests, decisions, evidence                                                           |
| [Attribution](ATTRIBUTION.md)                           | Credit and licence for the anatomy, and how the instruments are labelled                                                                    |
| [Sponsorship policy](../sponsorship/POLICY.md)          | Draft. Who decides what when a module is sponsored                                                                                          |
| [Repository baseline](repository-baseline.md)           | Where the build started: commit, packages, policies, file boundaries                                                                        |
| [Handoffs](handoffs/)                                   | One per slice: what changed, what was checked, what was not                                                                                 |
| [Prototype gate packet](gate/prototype-gate-packet.md)  | The first round's gate, criterion by criterion: what was shown, how, and what is NOT TESTED or NOT RUN                                      |
| [Revised forecast](gate/forecast.md)                    | What the first round took, and the forecast from it                                                                                         |
| [Gate forms](gate/forms/)                               | Blank forms for what the gate leaves to people and devices: device measurements, the fellows' pilot, the Scope view, a screen reader        |

## Device kit

The instrument models are built from the device definitions by
`scripts/medical-thoracoscopy/build_device_kit.py` and served from
`public/models/medical-thoracoscopy/v1/devices/`, listed in its `manifest.json`. Values the
manufacturer has not published were measured from its product-animation stills: the record is
`src/features/medical-thoracoscopy/content/data/reference-measurements.json`, written by
`measure_reference_frames.py`, and every value there is a derived measurement with a tolerance.
The order the scripts run in, and what each checks, is in the
[device-kit handoff](handoffs/mt-02a-device-kit.md).

## Anatomy

The anatomy is built from one CT scan and its segmentation, in the owner's local data. The scripts
run in this order:

1. `scripts/medical-thoracoscopy/audit_thorax_sources.py`: pins both files by hash and every
   segment the build uses by its measured content. `--check` fails if either has changed.
2. `build_thorax_surfaces.py`: the pleural space divided into the survey zones, the numbered ribs,
   the Chest view's context, the port-candidate table and the port record.
3. `validate_thorax_surfaces.py`: reads the surfaces back with its own code and checks them against
   the committed record.
4. `build_lung_states.py`: the lung from expanded to collapsed in eight steps (authored, awaiting
   clinical review: MT-C-0001, MT-C-0002), the collision proxies of the pleural space and of the
   lung at each step, the zone sample points and the fluid table. Every step, and the blends between
   steps, is checked for folded and crossing triangles and for staying inside the pleura.
5. `validate_lung_states.py`: reads those files back with its own code and checks them against the
   committed records.
6. `npx tsx scripts/medical-thoracoscopy/package-anatomy.ts --install-dev`: compresses the drawn
   surfaces, names every file by its content, writes the manifest (and its generated copy,
   `content/data/generated/anatomy.ts`) and the ledger rows, and copies the files to a folder Git
   ignores, for the dev server.
7. `validate_anatomy_blender.py`, in Blender 5.1: imports every packaged file and compares it with
   the file as built, the lung state by state.

Surfaces meant to be seen close up or to move (the pleural space, the lung) are meshed as even
triangles on the mask's smoothed surface (`thorax_remesh.py`); `thorax_mesh_checks.py` holds the
checks every script shares, written without mesh libraries.

The files are not in the repository: the segmentation's terms are not settled (rights register,
R-ANATOMY-SEGMENTATION), and the repository is public. What is committed is the numbers measured
from them, in `src/features/medical-thoracoscopy/content/data/anatomy/`. See the
[thorax-surfaces handoff](handoffs/mt-02b-thorax-surfaces.md) and the
[lung-states handoff](handoffs/mt-02c-lung-states.md).

## Space pane

The pane that shows the pleural space is a seam, written before anything that draws it:
`src/features/medical-thoracoscopy/components/space/types.ts`. A lesson hands the pane the space
engine's state, plain JSON; the pane sends commands back, one step of one control each. The pane
works nothing out: what is in view, what has been seen and what stops the telescope all come from
the engine, so the same commands give the same ledger whichever pane draws them.

- `SpaceFallbackPane` draws it without WebGL: the Chest view as a cut through the space along the
  telescope, the Scope view in words, the control dock, the model's estimate and the keys.
- `ControlDock` holds the second control's three parts; a held button repeats and lets go when the
  window loses focus or the tab is hidden; under reduced motion a press is one step, and a waiting
  model moves on with Step. While the anatomy loads or cannot be had, the controls say why they wait.
- `ZoneLedger` is the model's estimate, in the survey section's words, with no number and no total.
- `spaceKeyMap.ts` is the key map as data; the help panel reads it.
- `test-support/spaceTestDouble.tsx` stands in for the engine, and `SpacePaneDouble` for the pane,
  in tests.

The contract changes only by adding. See the
[space-contract handoff](handoffs/mt-02d-space-contract.md).

`SpacePane` (slice 11) draws the Chest and Scope views in 3D where the browser can, on one canvas,
lazily loaded, and the cut otherwise, saying why; `SpacePaneShell` holds everything the two share.
`useSpaceEngine` hosts the engine in the browser: it loads the proxies, turns commands into simulated
actions and runs the clock while the lung moves. The engineering prototype at
`/medical-thoracoscopy/prototype/space` shows the pane with no lesson around it, outside the
curriculum and the progress record. See the [space-scene handoff](handoffs/mt-03b-space-scene.md).

## Space engine

`src/features/medical-thoracoscopy/engine/space/` moves the telescope about the port, stops it where
the anatomy and the device stop it, and keeps the model's estimate of what it has shown. It is pure
code; everything that owns a BVH is in `engine/space/spatial/`, and the state is plain JSON.

- `loadSpace.ts` builds the space from the two packaged proxy files (bytes, the same in Node and the
  browser), and the resolver the reducer asks its spatial questions.
- `fulcrum.ts` makes a pose (two tilts in the port's frame, a depth, a roll) into the telescope's
  axis, its parts and its optical frame; `spatial/sweep.ts` takes one step of one control only as far
  as the measured clearance allows, and names what stopped it.
- `spaceReducer.ts` takes simulated actions only, on a whole-millisecond clock; `spaceReplay.ts`
  replays a script under any schedule of ticks to the same events.
- `coverage.ts` is the ledger; `zoneReach.ts` reads reach, which
  `npx tsx scripts/medical-thoracoscopy/build-zone-reach.ts` computes from the proxies in the owner's
  local data. Recompute it after any change to the proxies, the port, the device or the engine's
  authored values: the engine ignores a reach record made for another snapshot, and a test fails.
- `paneState.ts` gives a pane the engine's state as the slice-9 contract has it.
- The tests judge the sweep with a brute force that shares no code with the collider, on analytic
  scenes (`test-support/spaceScenes.ts`) and, where the local data holds them, on the real proxies.

See the [space-engine handoff](handoffs/mt-02e-space-engine.md): what the model lets a survey see,
and the values the engine authors.

## Tool contact

One table of contact (`engine/space/contactPolicy.ts`) serves moving about the space and touching a
target: every part of the instrument, against every region, in every phase of the tool, authorised
or not. Only the forceps' jaws may touch, and only an authorised teaching target, with the forceps
out of the channel; everything else is refused with the part named. `toolChannel.ts` makes the
forceps into capsules beyond the tip; `spatial/spatialWorld.ts` measures every part against every
surface under the table's rule, each pair keeping its own skin; `spatial/sweep.ts` moves the
forceps with the telescope and along the channel. Drawing the telescope out, or the forceps in, is
never refused by a surface: each passes only through space the instrument already fills.

The engineering prototype at `/medical-thoracoscopy/prototype/tool-contact` shows it with the
forceps and one illustrative nodule, outside the curriculum and the progress record; the hub links
it while the module is in development. It is not a biopsy lesson and shows no effect on tissue. The
nodule and the two places the page starts from come from
`npx tsx scripts/medical-thoracoscopy/build-tool-contact.ts`, which writes
`content/data/anatomy/tool-contact.json`; recompute it after any change to the proxies, the port,
the device or the engine's authored values. With the lung the model has now, the lung lies in front
of every line the port allows, so the nodule sits on the lung's surface rather than the chest wall.
See the [contact-spike handoff](handoffs/mt-03d-contact-spike.md).

## Written sections

A section is data: one file in `src/features/medical-thoracoscopy/content/sections/`, in the shape
`content/types.ts` gives, checked by `content/sectionValidation.ts` as the section index loads. The
regions a survey visits are one list, `content/data/pleural-zones.json`, which the lessons and the
anatomy asset both read. A section can be written before the lesson that shows it exists; a learner
can open it only once the curriculum marks it available. Sections 6, 7 and 11 are written (see the
[survey-specs handoff](handoffs/mt-03a-survey-specs.md)) and available: the Learn page opens an
available section as its lesson (`components/lesson/SectionLesson.tsx`), the parts in document flow in
the order the section's question sets, with the course, the teaching example and the scope controls
kept apart. The lesson session (`engine/stageSession.ts`) holds nothing that is stored. See the
[survey-lesson handoff](handoffs/mt-03c-survey-lesson.md).

## Checks in a real browser

`e2e/medical-thoracoscopy.spec.ts`, against a local server only:

    MT_BASE_URL=http://localhost:3134 npx playwright test -c playwright.medical-thoracoscopy.config.ts

It walks a fresh learner's path, refuses and corrupts storage, reads the canvas's pixels, does the
survey by keyboard alone, taps, scrolls, reduces motion, takes WebGL away, breaks a file, the decoder
and the context, checks five layouts, the words a learner reads or hears and axe, drives the contact
spike, and writes the first measurements to `test-results/medical-thoracoscopy/`. The prototype
gate's fuzz on the real proxies is `npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts`.

## Status words

Every open item in these documents carries one of five statuses, taken from the revised plan:

| Status                              | Meaning                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| Retained decision                   | Decided in an earlier plan and kept                          |
| Proposed change                     | Put forward for the owner; not decided                       |
| Unresolved input                    | A fact or file the build needs and does not have             |
| Review pending                      | Written, waiting for a named reviewer                        |
| Accepted with attributable approval | A named person decided, on a date, against a stated revision |

Claim and asset records use **NOT REVIEWED** until a reviewer records a decision. An empty
decision is not approval. Measurements that were not taken are **NOT TESTED**; checks that were not
run are **NOT RUN**.

## Rules that hold across every slice

- The planning documents, the CT, the segmentation, manufacturer documents and the Wolf reference
  images stay outside the repository. They are read in place.
- The repository is public. Sponsor correspondence, contract terms, contact names and the list of
  discrepancies between manufacturer documents stay in the owner's local data.
- Manufacturer images are reference only. They are never committed, never uploaded, and no model
  carries a manufacturer mark.
- The shared lesson stage is used, not edited.
- No new dependencies.
- A green test run is not clinical approval.
