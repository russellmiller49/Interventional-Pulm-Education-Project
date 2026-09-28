# Medical Thoracoscopy — reconciling the three plans

Three planning documents exist. None is in the repository. The
[implementation manifest](implementation-manifest.json) imports what the build needs from them and
records the file hash of each.

| Layer | Title                                                         | Lines | Holds                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1    | Medical Thoracoscopy (sponsored by Richard Wolf) — Build Plan |   338 | The inventory: nineteen sections, P1–P7, C1–C4, four controls, the procedure spine, the diagnostic table's rows, the module tree, the asset pipeline, budgets and the week-4 criteria |
| P     | Medical Thoracoscopy — Revised Build Plan                     |   177 | Five chapter names, the outcome alignment, seven corrected assumptions, and one sentence each for the opening demonstration, the decision guide and the hazard table                  |
| v2    | Medical Thoracoscopy — Revised Build Plan v2                  |   305 | The contracts. It cites P by line and contains none of the inventory                                                                                                                  |

**v2 governs wherever it differs from v1** (owner decision OD-07). v1 still supplies everything v2
refers to and does not contain.

v2 describes itself as a proposal for the owner to adopt, written without inspecting the
repository. OD-07 adopts it as the governing layer. It does not turn v2's proposals about clinical
teaching into clinical decisions.

## Where v2 changes v1

| Topic                       | v1                                                | v2, which governs                                                                                                                                                    | v2 section |
| --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A failed week-4 gate        | Fall back to authored survey poses with free look | Repair and revise the forecast. Scope stays                                                                                                                          | 1.1, 4.1   |
| Running short of time       | Cut the diorama, then the hero loop               | Every planned 3D experience stays                                                                                                                                    | 1.1, 3.7   |
| Unsafe actions              | Must never look beneficial in the simulation      | Never endorsed, never concealing risk, never fabricating success. Consequences are clinically reviewed and causally plausible; anything unsupported is "not modeled" | 1.3        |
| Collision                   | Tip sweep, shaft checked every 5 mm               | Swept volume for shaft and tool. Contact is defined by instrument part × region × action × scenario state                                                            | 3.4        |
| The prototype gate          | Survey, frame rate, fuzz run                      | Adds a narrow tool-contact spike, independent geometry fixtures, stale-result tests and real browser rendering                                                       | 4.1        |
| Spatial results             | Not versioned                                     | Every collision or coverage result names the snapshot it belongs to                                                                                                  | 3.2        |
| Coverage                    | A per-zone ledger, never a percentage             | Adds three separate states and the wording "model-estimated visible regions"                                                                                         | 3.6        |
| Performance                 | Frame-rate and loading targets                    | Each target is tied to named hardware, browser and quality. Anything untested stays NOT TESTED                                                                       | 1.2, 5.4   |
| The legacy module           | Retired late, once all nineteen sections exist    | Misleading teaching is removed now. Redirects wait for a reviewed destination                                                                                        | 4.5        |
| Lesson specification        | At least two misconceptions per section           | Record genuine misconceptions. No quota                                                                                                                              | 2.2        |
| Learner label for `/assess` | Integrated cases                                  | Cases                                                                                                                                                                | 2.2        |

## Assumptions corrected in P and kept by v2

v2 §1.3 keeps these in force. They are imported verbatim in the manifest under
`correctedAssumptions`.

| v1 assumed                                                | Corrected to                                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Airway colliders can be combined by minimum clearance     | Explicit cavity-versus-obstacle semantics. The airway helper reports positive clearance inside its mesh, which is the wrong sign for a lung obstacle |
| Refit the collision tree when the lung state changes      | Update the collision geometry on the CPU to match each morph state, then refit                                                                       |
| Tool diameter no larger than channel diameter proves fit  | Dimensional comparison is separate from manufacturer-confirmed compatibility                                                                         |
| Matching coordinate labels establish ultrasound alignment | Verify source identity, transforms, units, landmarks and patient position                                                                            |
| Re-expansion requires drain and seal                      | Prerequisites within a reviewed scenario. They do not guarantee expansion                                                                            |
| The self-paced policy governs this module automatically   | The module adopts it explicitly. The policy names nine other modules                                                                                 |
| A failed week-four gate triggers a reduced simulator      | Remediation and a revised schedule                                                                                                                   |

## Where the repository changes what the plans assumed

Found while preparing the build, against `origin/main` `519415e8`. Each is recorded so the
reasoning is not repeated.

| Plan statement                                                            | What was found                                                                                                                     | Consequence                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| v1: collide with `createLumenCollider` and `sweepClearance`               | Both sweep one sphere at the tip over geometry that never changes. `createMorphingCollider` does not exist                         | The module writes its own capsule collision on `three-mesh-bvh`'s `shapecast`. No new dependency     |
| v2 §3.5: bake morphed geometry with `StaticGeometryGenerator`, then refit | In the installed `three-mesh-bvh` 0.8.3, calling `generate()` again after only the morph weights change returns the previous shape | The module morphs its own collision geometry on the CPU and calls `refit()`, which behaves correctly |
| Implied by both: the library's segment-to-triangle distance               | `ExtendedTriangle.closestPointToSegment` reports 4.47 for a segment that passes through the triangle, where the distance is 0      | The module carries its own exact segment-to-triangle test                                            |
| v1: per-rib segments come from a new TotalSegmentator run                 | The existing segmentation already holds the rib cage, under the name "thoracic cavity". The twelve right ribs separate cleanly     | No new segmentation is needed for the prototype                                                      |
| v1: a pleural cavity mesh is available                                    | None exists                                                                                                                        | The pleural space is built from right lung and right effusion                                        |
| v1: runtime files in `public/models/…` are already covered                | They are excluded from the production image and served from storage                                                                | A merged slice shows the fallback in production until the owner runs the upload                      |
| v1 and v2: keep development routes unlisted                               | Any `.glb` or `.json` address is public whatever the page gate says                                                                | Only rights-cleared assets may be uploaded                                                           |
| v1: the four controls statement                                           | "where the scope points" trips the learner-copy check                                                                              | Learner wording proposed; the imported statement is unchanged                                        |

## What no layer defines

These are named in the plans and defined nowhere. They are authoring work, not imports.

- Which sections belong to which chapter. Proposed in [owner decisions](owner-decisions.md), T1.
- The stems and content of P1–P7 and C1–C4. Only titles and pairings exist.
- The opening whole-procedure demonstration, the procedural decision guide and the
  step → hazard → early sign → first response table. One sentence each.
- The survey's zone list.
- Browser, viewport, network and cache for each performance target.
