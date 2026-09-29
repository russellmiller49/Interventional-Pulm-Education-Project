# Handoff — MT-02e space engine

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 10 of the first build round; work package MT-02                                                                              |
| Branch              | `claude/mt-02e-space-engine`                                                                                                 |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main has not moved since slice 9)                                  |
| Prerequisite slices | `claude/mt-02d-space-contract` at `523198d0` (which carries slices A, B and 1 to 9), merged as the first commit (`5b53a684`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-02e-space-engine.md`        |
| Owner decision      | OD-08; the approved first-round plan, sections 4.5 and 7 (row 10)                                                            |
| Date                | 2026-09-28                                                                                                                   |

## Why

The lessons need an engine that moves the telescope about the port, stops it where the anatomy and
the device stop it, says what stopped it, and keeps the model's estimate of what the telescope has
shown. This slice builds it to the contract slice 9 wrote: pure code, state as plain JSON, one
geometry for every spatial answer, and a replay that gives the same events whatever the ticks. The
scene (slice 11) and the lesson (slice 12) drive it.

## What changed

| Path                                                                                                                           | Change                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/engine/space/spatial/`                                                                      | New. Everything that owns a BVH: the proxy reader and checks, exact distances, winding numbers, capsule clearance, the spatial world, the sweep, visibility |
| `src/features/medical-thoracoscopy/engine/space/{vec,portDefinition,instrument,fulcrum}.ts`                                    | New. The port's frame, the instrument, and a pose made into the telescope's axis, parts and optical frame                                                   |
| `src/features/medical-thoracoscopy/engine/space/{loadSpace,spaceSnapshot,spaceReducer,spaceReplay}.ts`                         | New. The loaded space and the resolver the reducer asks; the snapshot; the reducer; the replay                                                              |
| `src/features/medical-thoracoscopy/engine/space/{coverage,zoneReach,outcomes,contactPolicy,spaceWords}.ts`                     | New. The ledger; reach; what may be shown as a consequence; the contact table; the engine's words                                                           |
| `src/features/medical-thoracoscopy/engine/space/{crossSection,paneState}.ts`                                                   | New. The cut the pane without WebGL draws, and the engine's state as the slice-9 contract has it                                                            |
| `src/features/medical-thoracoscopy/components/space/types.ts`                                                                  | One rule of the ledger removed, a correction (below)                                                                                                        |
| `scripts/medical-thoracoscopy/build_thorax_surfaces.py`                                                                        | Measures how deep each rib is along the corridor beside the gap                                                                                             |
| `src/features/medical-thoracoscopy/content/data/anatomy/{port-candidates,port-record}.json`                                    | The ribs' depths, measured. Nothing else changed: the surfaces rebuilt byte for byte                                                                        |
| `scripts/medical-thoracoscopy/build-zone-reach.ts`, `content/data/anatomy/zone-reach.json`                                     | New. Reach, computed by the engine from the proxies in the owner's local data; numbers only                                                                 |
| `src/features/medical-thoracoscopy/content/anatomy.ts`                                                                         | Schemas for the ribs' depths and the reach record                                                                                                           |
| `src/features/medical-thoracoscopy/content/data/generated/anatomy.ts`, `docs/medical-thoracoscopy/registers/asset-ledger.json` | The port record's new hash in the anatomy manifest. Every packaged file kept its hash                                                                       |
| `src/features/medical-thoracoscopy/test-support/{spaceFixtures,spaceScenes}.ts`                                                | New. Analytic scenes, a seeded generator, and two judges of distance that share no code with the collider                                                   |
| `src/features/medical-thoracoscopy/__tests__/{spaceSpatial,spaceEngine,spaceSweepFuzz}.test.ts`                                | New                                                                                                                                                         |
| `src/features/medical-thoracoscopy/__tests__/spacePane.test.tsx`                                                               | The corrected rule                                                                                                                                          |
| `docs/medical-thoracoscopy/README.md`                                                                                          | A "Space engine" section                                                                                                                                    |

No page, route, learner text, claim or section changed. No page runs the engine yet.

## How the engine is built

- **Pure, and in two parts.** `engine/space/` is plain domain code; everything that owns a BVH is
  in `engine/space/spatial/`. The state is plain JSON: no renderer object, index, clock or callback.
  The reducer asks a resolver its spatial questions and commits the answers.
- **One geometry.** Collision, contact and visibility all use the collision proxies, read by the
  module's own GLB reader, the same in Node and the browser, and checked closed, outward and finite
  as they load. The engine works in the scan's millimetres.
- **The fulcrum.** A pose is two tilts in the port's frame, a depth and a roll. Across the ribs the
  tilt is limited where the sleeve's width and the ribs' depth fill the gap between them; the gap
  and, now, the depth are measured on the scan (8.9 mm, the deeper of ribs 7 and 8), giving 33.5°.
  Along the ribs the limit is authored. The two limits bound an ellipse. The hand and the tip move
  opposite ways, as section 7 teaches: the hand toward the head swings the tip toward the feet.
- **Collision.** The sleeve and the telescope's shaft are capsules. Their clearance from the wall
  (less the port's own patch, which the sleeve crosses) and from the lung is the exact distance from
  each segment to the nearest triangle, less the radius, found through `three-mesh-bvh`'s
  `shapecast` with the module's own segment test, since the library's own is wrong for a segment
  that passes through a triangle. Boxes are ordered and passed by on a cheap lower bound of their
  distance, triangles on their bounding spheres, and the four queries (sleeve and shaft, wall and
  lung) share one running least, so each later one looks only for something nearer. The BVH is built
  on a copy of the index, so every triangle is numbered as in the proxy.
- **The sweep.** A command moves one control one step. The move goes on only as far as the measured
  clearance allows: no point of the instrument moves further than the move's bound on motion, so no
  surface, however thin, can be crossed between two checks, whatever the move's size. At the
  0.25 mm clearance skin it goes on in pieces shorter than the clearance, each kept only if it opens
  the clearance. What is left is refused with the part named and what stopped it: the ribs, the wall
  and its region, the lung, the telescope in as far as it goes, or back in the sleeve. The engine
  never moves the instrument for the learner.
- **Inside and outside.** A start is refused unless the instrument is clear by the skin and its tip
  lies inside the space and outside the lung, by winding number. After that, never coming within the
  skin of a surface means never changing side.
- **The moving lung.** One proxy per step (slice 8), swapped as the lung steps. The lung takes a
  step every 400 ms, and only with 0.5 mm of room around the instrument; otherwise it is held where it
  is, the pane says so, and it tries again when the instrument next moves. Under reduced motion the
  clock waits and Step moves it one step.
- **The reducer** takes only simulated actions (a command, a tick, a target for the lung); course
  navigation and loading a teaching example are other types, and loading an example builds a new
  state. The clock is whole milliseconds and moves only on a tick. Every event is stamped with the
  time it fell due, so any schedule of ticks replays to the same state. A command issued against
  another snapshot changes nothing.
- **Visibility and the ledger.** A sample is in view when it lies in the round field, within range,
  facing the telescope, with neither the wall nor the lung between. A region is seen when every one
  of its samples has been (T12, the default). For the rest, the reason is the one the learner can
  still act on, in this order: not looked at yet; hidden by something in the way; out of reach from
  this port.
- **Reach** is the field's, not the sight's: the plan's "outside this model's reach". A sample is
  reachable when some position the port allows brings it into the field, within range and facing the
  telescope, whatever lies in the way; what lies in the way is the second reason. It is computed
  offline, at the lung's last step, by `build-zone-reach.ts` over a grid of positions, and recorded
  with the snapshot it was computed for. The engine uses it only while that snapshot is current;
  otherwise the ledger never says out of reach.
- **Outcomes.** No clinical consequence is modelled. The lung falling away is authored, labelled
  awaiting clinical review, and blocks publication (MT-C-0001, MT-C-0002).
- **Contact.** One table of every part, region, phase of the tool and authorisation: 216 rows. Only
  the extended working element may touch an authorised teaching target. These are engineering
  permissions, not statements about clinical safety.
- **The cut** for the pane without WebGL is the plane through the pivot that holds the telescope's
  axis and the direction of the head, seen from the patient's front with the head to the right; each
  run of wall carries its region.

## Values the engine authors

Each is the engine's own choice, not a device fact or a clinical margin, and each is named in the
snapshot's optics (the first three) or in the file that holds it.

| Value                                              | Where                     | Why                                                                                                                                      |
| -------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The sleeve's tip 5 mm past the pleura              | `instrument.ts`           | How far the sleeve is pushed in is the operator's; the device definitions do not fix it                                                  |
| View range 200 mm                                  | `instrument.ts`           | Long enough to see across the space, so that what is out of reach is set by the port and the tilt, not by a distance nobody has measured |
| Tilt along the ribs 40°                            | `instrument.ts`           | No bone stops the sleeve along the ribs; the chest wall's soft tissue does, and the model does not have it                               |
| Steps of 2°, 2 mm and 5°                           | `spatial/sweep.ts`        | The interaction's                                                                                                                        |
| A lung step every 400 ms, with 0.5 mm of room      | `spaceReducer.ts`         | The interaction's                                                                                                                        |
| Skin 0.25 mm, numeric 0.001 mm, port's patch 10 mm | `spatial/spatialWorld.ts` | Modelling tolerances, never clinical margins                                                                                             |

The view range was 100 mm while the engine was built; at that range no position saw any of the
apex, which the port reaches only across most of the space. The ribs' depth was an authored 10 mm
(31.4°) until it was measured.

## What the model lets the survey see

From `zone-reach.json`, at the lung's last step, over 43,032 positions:

| Region               | Samples | In the field from some position | Seen, with nothing in the way, from some position |
| -------------------- | ------: | ------------------------------: | ------------------------------------------------: |
| Diaphragm            |     234 |                             164 |                                                55 |
| Costophrenic recess  |     113 |                              47 |                                                29 |
| Posterior chest wall |     390 |                             279 |                                               203 |
| Apex                 |     146 |                              96 |                                                26 |
| Anterior chest wall  |     266 |                             211 |                                               117 |
| Mediastinum          |     342 |                             323 |                                                 1 |
| Lateral chest wall   |     145 |                               5 |                                                 5 |

- **Around the port**, the lateral chest wall is out of reach: a straight-viewing telescope cannot
  turn back to the wall it passes through, as section 11 says.
- **The collapsed lung hides most of the rest.** At slice 8's last step the lung is 30 mm from the
  port and lies against most of the mediastinum (211 of its 342 samples are within 5 mm of the lung's
  proxy). From this port the model sees almost none of the mediastinum, about a quarter of the
  diaphragm and a fifth of the apex, and no region can be seen whole: every region ends a survey
  partly seen or not seen, mostly hidden by something in the way. This follows from the authored
  collapse (MT-C-0002), not from a source. The plan put "how far the collapsed lung sits from the
  port" in the review queues because it shapes what the survey can reach; this is that effect,
  measured. If the
  clinician's look finds the lung should fall further, or lie flatter on the mediastinum,
  `build_lung_states.py` holds the levers (`COLLAPSE`: the gap at the port, the friction that holds
  the lung's medial face, the drift along gravity); after a rebuild, `build-zone-reach.ts` recomputes
  reach in half a minute, and a test fails until it does.

## Faults found and fixed while building

All three were in this slice's own code, before it was committed.

- **The fulcrum turned both tilts the wrong way**, so the tip followed the hand. The landmark tests
  caught it.
- **`three-mesh-bvh` reorders the index buffer it is given**, in place: the triangle a stop was
  reported against was the wrong one, on the wrong wall, and the region named in a refusal with it.
  The index is now built on a copy, and every triangle is numbered as in the proxy; a test checks the
  triangle that sets each clearance and that the mesh is unchanged.
- **Lung events were stamped with the tick that reached them**, so different schedules of ticks gave
  different events, and a lung let go after being held caught up several steps at once. Each event
  now carries the time it fell due, and a held lung goes on at its own pace from when it moves.

## The ledger rule removed

Slice 9's contract refused a ledger in which a region was partly seen and not looked at yet ("a
region partly seen has been looked at"). That was wrong: part of a region can have been seen while
the rest has not been in the field. The reason then says what the learner can still do, look at the
rest. The rule is gone and the pane test now expects such a ledger to be valid.

## Departures from the plan

- **The moving lung** was to morph one collision proxy and refit it (`spatial/mutableProxy.ts`,
  `lungState.ts`). Slice 8 built one proxy per step instead, so the engine swaps them; the rule that
  a step is taken only with room around the instrument is kept.
- **`toolChannel.ts`** (a tool's shaft and working element) is not built: no section uses a tool
  before the contact spike (slice 13). The contact table already holds their rows.
- **`engine/stageSession.ts`**, which ties the reducer to the lesson stage, comes with the lesson host
  (slice 12).

## Claims and assets touched

No claim was added or reworded. The port record gained the ribs' depth; every packaged anatomy file
kept its hash, and the anatomy manifest records the port record's new hash.

## Checks run

| Command                                                                                                                                                                                                                | Result                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/medical-thoracoscopy/__tests__/{spaceSpatial,spaceEngine}.test.ts`                                                                                                                              | 2 suites, 64 tests, all passing; the tests on the real proxies ran, the local data being here                                                                                                          |
| `npx jest src/features/medical-thoracoscopy/__tests__/spaceSweepFuzz.test.ts`                                                                                                                                          | 2 tests, passing, in about 80 s: 10,000 sequences on analytic scenes (30,000 moves, each judged; more than 5,000 commands taken pressed against something) and 1,000 on the real proxies (3,000 moves) |
| `npx jest src/features/medical-thoracoscopy`                                                                                                                                                                           | 18 suites, 307 tests, all passing                                                                                                                                                                      |
| `python3 scripts/medical-thoracoscopy/build_thorax_surfaces.py`                                                                                                                                                        | Every surface file byte-identical; the two port records gain the ribs' depths                                                                                                                          |
| `python3 scripts/medical-thoracoscopy/validate_thorax_surfaces.py`                                                                                                                                                     | 0 failures                                                                                                                                                                                             |
| `npx tsx scripts/medical-thoracoscopy/package-anatomy.ts --install-dev`                                                                                                                                                | Every file's hash unchanged; the manifest records the port record's new hash                                                                                                                           |
| `npx tsx scripts/medical-thoracoscopy/build-zone-reach.ts`, twice                                                                                                                                                      | The same record both times                                                                                                                                                                             |
| The engine's suites with four faults planted, one at a time: the tilt left out of the sweep's bound on motion; lung events stamped at the tick; hidden put before not looked at; triangles numbered in the BVH's order | Each caught: the judge finds the telescope 0.4 mm into the plate; two tests fail; one; five. The files then restored byte for byte                                                                     |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy scripts/medical-thoracoscopy`; `npx prettier --check`; `git diff --check`                                | Clean                                                                                                                                                                                                  |

## Real browser observations

Not opened: no page runs the engine yet. The scene (slice 11) and the lesson (slice 12) run it in a
real browser.

## Checks not run

- **The engine in a browser**, and how long a command takes there. In Node, on the real proxies,
  loading the two proxy files takes about 50 ms and one view of the 1,636 samples 0.7 ms; of 2,000
  commands, the median took two clearance queries and 0.1 ms, the 95th percentile about ten queries
  and 0.5 ms, and the slowest 9 ms. Slice 11 measures it where it matters.
- **The scene's camera against the engine's optical frame**: slice 11.

## Unresolved decisions

- **The collapsed lung** (MT-C-0002): what the survey can see follows from it (above).
- **The authored values** above, the view range and the tilt along the ribs above all.
- **T12** stays the default; the ledger's order of reasons is the engine's.
- Everything open after slice 9 stays open: MT-C-0001, the lung proxy's departures from the plan, T6,
  the rib numbering, S3 and S4, the pivot's words and keys.

## What must not happen next

- Do not let a pane or the scene work out collision, contact or what is in view: they are the
  engine's, and the ledger must be the same whichever pane draws it.
- Do not answer a spatial question from the drawn meshes; only from the proxies.
- Do not use the reach record for any snapshot but the one it names; after any change to the proxies,
  the port, the device or the authored values, recompute it.
- Do not move the instrument for the learner, or model a consequence without an accepted claim.
- Do not give a stamp other than the time an event fell due.

## Repair after the independent review (2026-09-29): R2, R4, R5, R7

The independent review (at `ba6f870d`) found four things in this slice. Repaired here; the anatomy,
the lung's collapse, the port, the optics and the authored limits are unchanged (OD-11, OD-14).

**R4, snapshot identity.** The snapshot hashed the port record, the device definitions and the
authored optics only. It now also names:

| Part          | What it adds                                                                                                                                                   | Why                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `port`        | a digest of the port's frame as the engine uses it, after the record's hash                                                                                    | the port candidates' rib points set the direction across the ribs (`portFrame()`), and no hash covered them |
| `rules` (new) | the step sizes, the clearance skin, the skin piece share, the numeric tolerance, the port's excluded patch, the lung's room and the view's occlusion tolerance | each decides where a move stops or what counts as seen                                                      |

The reach record also names its grid, and `currentReach` refuses a record made on another grid.
The pane takes reach only from a record made for the engine's own snapshot (`reachFits`: every part
but the scenario and the lung step, and the same proxies whatever target a scenario adds). Reviewed
and not added: the fluid (drained in every scenario; no spatial answer reads the fluid table), the
scenario's start (a new start restarts the engine, which drops everything computed before), and
anything the renderer alone holds. The forceps' authored values join in slice 13's repair.
`zone-reach.json` was rebuilt with `npx tsx scripts/medical-thoracoscopy/build-zone-reach.ts`
(39 s, 43,032 positions): the same reach as before, sample for sample, and the counts per region
are unchanged. New stale tests: a record for other rules, another port frame, other proxies or
another grid is refused; a command issued against other rules or another port changes nothing; a
turn of 1° in the rib direction or 0.01 mm in the rib gap changes the port's identity.

**R5, the ledger's reach.** A sample was reachable only if the offline grid said so, so a sample the
learner had had in the field (hidden behind the lung) could be called out of reach. It is now
reachable if the grid says so or the learner has had it in the field. The record's digit per sample
now says 0 out of the field, 1 in the field only behind something, 2 seeable, so the ledger can say
what the owner's decision OD-16 asks: a region is **seen as far as this model reaches**
(`seen-to-reach`) when some of it has been seen and none of the rest can be, from any position the
model tried; the reason then says whether the rest is hidden or out of reach. No percentage, score
or completion target was added; the lesson's own note gains the state as a choice.

**R7, the lung's steps.** A lung step was accepted on the instrument's unsigned clearance alone,
which cannot see a step that closes the lung all around the instrument (the review's finding 10). A
step is now also refused while the telescope's tip would lie inside the new lung (winding number).
A test builds that case on an analytic scene and sees it refused; clearance alone would have let it
through. `spaceJourneys.test.ts` checks, by the judge's own routes (ray parity, its own counting),
that the space and every lung step are closed, manifold, consistently wound and outward, and that
no lung proxy point lies further outside the space proxy than the records allow (the lung proxy's
recorded distance from the drawn lung, plus the drawn pleura's from the space proxy, less the drawn
lung's recorded clearance: 9.7 to 10.9 mm). Measured: at most 6.12 mm at step 0 and 2.47 to 3.67 mm
at steps 1 to 8. The drawn lung and the proxy come from one build and have the same steps.

**Finding for the owner (R7): steps 2 and 4 of the lung proxy each have one tunnel** (Euler
characteristic 0; every other step, and the space, 2). They are closed and outward, so the winding
number and the clearance hold, and the journeys at step 4 find nothing wrong; whether a tunnel could
admit an instrument has not been established. The measured shape is pinned by the test. Rebuilding
the proxies belongs with the lung decision (R9), not this repair.

**R2, a stronger fuzz.** `fuzzJourneys` (test-support) judges every move along its path, not only
where it ends: a move along the axis sweeps exactly the instrument at its deeper end; a pivot is
judged at poses at most 0.1 mm of end-point motion apart and certified between them by the Lipschitz
bound, halving an interval where that bound is not enough. Along a move it requires no penetration
(the plan's tolerance, −0.001 mm); where a move stops, the clearance skin. It classifies axis points
inside the space and outside the lung by ray parity (the engine uses winding numbers), and asks the
lung to move a step either way through the reducer, as the learner's space does, judging the result.
Preserved failing seeds live in `test-support/fuzz-seeds.json` and are replayed every run (none so
far). The first run found a pivot that passed 0.24957 mm from a surface mid-move: inside the skin,
nowhere near contact, and what the engine's pieces at the skin allow; the path criterion was
corrected to the engine's contract, not the engine to the judge. Fuzzing is evidence, not proof.

Not repaired, recorded: the review's finding 15 (the sleeve's start slides along the axis as the tilt
changes, which the motion bound omits; at most about 0.09 mm a step on this port, inside the
port's excluded patch).

This does not change publication status or constitute clinical approval.
