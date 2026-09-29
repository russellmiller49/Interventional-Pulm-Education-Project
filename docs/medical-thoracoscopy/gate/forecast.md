# Revised forecast, after the first round

Written at the prototype gate (slice 14), 2026-09-28, as the plans require: record what the round
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

1. **The collapsed lung (MT-C-0002).** With the lung as collapsed as the model makes it, the survey
   can see no region whole and almost none of the mediastinum (slice 10); and every line the port
   allows meets the lung before the chest wall, so the forceps cannot reach the costal pleura
   (slice 13). The biopsy section (13, "Parietal biopsies") cannot be built on this lung, and the
   survey's teaching reads oddly on it. The levers and the thirty-second recomputation are ready;
   the decision is the owner's, after a clinical look.
2. **The segmentation's terms (R-ANATOMY-SEGMENTATION).** Until they are settled, no anatomy file is
   uploaded, so a production build shows the cut and never the 3D views.
3. **The repository's own gates.** Nine test suites and the Storybook build fail on `origin/main`
   itself (slice B, and again on `4f9329f3` at this gate), and the site's theme provider blanks
   every page when a browser refuses storage (found here). None is this module's; each is raised as
   its own task. Until they are repaired, every full gate reads partial.

## The forecast

Build slices are estimated from this round's slices, by how much each milestone asks that is new: a
new 3D subsystem, a new kind of state, a new set of claims. They are estimates, not measurements.

| Milestone             | Work                                                                                                                                                                                               | Sections       | Build slices, estimated | Cannot finish before                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Decisions             | The owner's decisions the core rests on: the lung's collapse (MT-C-0002), the open T-items, the port                                                                                               | —              | none                    | The owner decides                                                                                                            |
| Core procedure        | Chest wall and port choice with reach; the ultrasound station; entry; making room; the pathology set and grammar; biopsy, energy, adhesions, each with reviewed transitions                        | 5, 8–10, 12–15 | 20 to 30                | The lung decision (biopsy needs the chest wall in reach); a clinical review of each transition before it shows a consequence |
| Complete experience   | The device explorer; the room and tower; talc; drain and re-expansion; the opening demonstration; the other sections; practice P1 to P7; cases C1 to C4; the reference page                        | 1–4, 16–19     | 30 to 40                | The manufacturer's materials the sponsor packet asks for (CAD, IFUs, brand kit, tower references, talc delivery)             |
| Retirement            | Redirects from `/pleural-procedures/pleuroscopy/*`; the old module removed                                                                                                                         | —              | 2 or 3                  | The new sections that replace it are reviewed                                                                                |
| Validation and launch | Clinical, manufacturer and rights reviews; the complete-course pilot; accessibility and device evidence; the asset upload and production check; the rollback rehearsal; the owner's publication PR | —              | 5 to 8                  | Every review lane, the pilot and the devices                                                                                 |

**Mid-January 2027 holds for the build** at anything near this round's pace. Whether it holds for
release depends on five things, in the order they will bite:

1. **The lung's collapse is decided before the core procedure's biopsy slices.** It is the first
   thing that can stop the build itself.
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
