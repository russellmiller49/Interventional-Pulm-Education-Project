# Revised forecast, after the first round

Written at the prototype gate (slice 14), 2026-09-28, and corrected on 2026-09-29 after the
independent review, as the plans require: record what the round
took, and forecast again from it (revised plan: "Record actual progress and revise the forecast";
first-round plan, section 5, "After the gate"). It forecasts the build. It cannot forecast the
owner's, the reviewers' or the manufacturer's time, and it says where those set the dates. The
release target stays mid-January 2027, as the plans retain it, subject to this forecast.

## What the first round took

| What                              | Measured                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Plan approved                     | 2026-09-27                                                                                                                        |
| Slices A to 13 committed          | 2026-09-28, from 06:42 to 21:38, Pacific time (the commits' own times)                                                            |
| Slice 14, this packet             | 2026-09-28, the same night                                                                                                        |
| Planned for the working prototype | Week four                                                                                                                         |
| Built                             | All sixteen slices within two calendar days of the approval, each with the checks the plan asks of it                             |
| What those times do not measure   | The effort of any one slice: some were prepared together and committed minutes apart. Nor any of the human work the gate waits on |

The round was fast because nearly all of it needed no one's decision: the defaults the plan
declares were built, and every one is still open (`owner-decisions.md`). From here on, almost every
milestone needs a decision, a review or a device before it can finish. The build's pace is no longer
what sets the dates.

## What the round found that changes the plan

1. **What limits the survey and the forceps: the lung, the port and the tilt envelope together.**
   With the lung as the model has it, the survey can see no region whole and almost none of the
   mediastinum (slice 10), and no line the forceps can take from the port reaches the costal pleura
   (slice 13). The first version of this forecast put that down to the collapse (MT-C-0002) alone.
   The independent review measured otherwise, with the shipped engine: with no lung at all, still no
   region can be reached whole (the lateral chest wall 5 of 145 samples); and with the lung unchanged,
   the authored along-rib limit or the rib gap at the port changes how many lines reach the costal
   pleura (0 of 9,645 as built; 7,289 with a 60° along-rib limit; 1,359 with a 25 mm rib gap). So the
   collapse, the port (T6, rib yielding), the along-rib limit and the optics are all levers, and "seen
   whole" is not reachable from this single port with a 0° telescope however far the lung falls.
   The owner has decided that seeing every region whole is not the survey's aim (OD-16) and that the
   lung, the port and the envelope wait for a separate decision packet (R9, OD-14). The biopsy section
   (13) cannot be built on the model as it is. These are the review's measurements, repeated here,
   not recommendations.
2. **The segmentation's terms (R-ANATOMY-SEGMENTATION).** Until they are settled, no anatomy file is
   uploaded, and a production build then has neither the 3D views nor the cut: the cut is computed
   from the collision proxies, which are anatomy files under the same block. The first version said
   production would show the cut; it cannot. Reading and navigation work; the spatial controls say
   why they cannot act. The device models and the anatomy-derived records are, meanwhile, already in
   the public repository on the pushed branches (recorded in the rights register, not approved).
3. **The repository's own gates.** Test suites and the Storybook build fail on `origin/main` itself
   (the full gates in the packet list them). The site's theme provider blanked every page when a
   browser refused storage; that is repaired in its own site pull request (R6), which the course's
   check of storage refused altogether needs merged first. Until `main`'s own failures are repaired,
   every full gate reads partial.
4. **Access.** The module now opens only for a site admin (OD-15), so merging a slice deploys nothing
   anonymous; publication remains a separate decision.

## The forecast

Build slices are estimated from this round's slices, by how much each milestone asks that is new: a
new 3D subsystem, a new kind of state, a new set of claims. They are estimates, not measurements.

| Milestone             | Work                                                                                                                                                                                               | Sections       | Build slices, estimated | Cannot finish before                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Decisions             | The owner's decisions the core rests on: the lung, the port and the tilt envelope (R9), the open T-items                                                                                           | —              | none                    | The owner decides                                                                                                          |
| Core procedure        | Chest wall and port choice with reach; the ultrasound station; entry; making room; the pathology set and grammar; biopsy, energy, adhesions, each with reviewed transitions                        | 5, 8–10, 12–15 | 20 to 30                | The R9 decision (biopsy needs the chest wall in reach); a clinical review of each transition before it shows a consequence |
| Complete experience   | The device explorer; the room and tower; talc; drain and re-expansion; the opening demonstration; the other sections; practice P1 to P7; cases C1 to C4; the reference page                        | 1–4, 16–19     | 30 to 40                | The manufacturer's materials the sponsor packet asks for (CAD, IFUs, brand kit, tower references, talc delivery)           |
| Retirement            | Redirects from `/pleural-procedures/pleuroscopy/*`; the old module removed                                                                                                                         | —              | 2 or 3                  | The new sections that replace it are reviewed                                                                              |
| Validation and launch | Clinical, manufacturer and rights reviews; the complete-course pilot; accessibility and device evidence; the asset upload and production check; the rollback rehearsal; the owner's publication PR | —              | 5 to 8                  | Every review lane, the pilot and the devices                                                                               |

**Mid-January 2027 holds for the build** at anything near this round's pace. Whether it holds for
release depends on five things, in the order they will bite:

1. **The lung, the port and the tilt envelope are decided (R9) before the core procedure's biopsy
   slices.** It is the first thing that can stop the build itself.
2. **The segmentation's rights are settled before the asset upload.** Without them there is no 3D in
   production at all.
3. **Clinical review keeps pace with writing.** Twenty-three claims wait now (twenty review
   pending, three proposed changes); the core adds its transitions and the complete experience its
   sections. Review that trails writing by weeks moves launch by weeks.
4. **The manufacturer's fact-check and materials** arrive before the device explorer and the tower.
5. **The named devices are measured early** (an M1 or Iris Xe laptop, an A14 iPad), in the core's
   first slices, not at the end: a frame-rate problem found late is the most expensive kind.

If any of these waits past the point it is needed, it, not the build, becomes the critical path, and
this forecast should be revised again with the date it moved to.

## What the gate asks next

Every item the gate could not settle by machine is prepared with a blank form in `forms/`: the
measurements on the named devices, the fellows' orientation pilot, the owner's judgment of the
Scope view, and a screen-reader pass. See the [gate packet](prototype-gate-packet.md).

This does not change publication status or constitute clinical approval.
