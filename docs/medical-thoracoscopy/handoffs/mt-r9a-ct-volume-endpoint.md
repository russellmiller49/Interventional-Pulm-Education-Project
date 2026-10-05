# Handoff — MT-R9a the collapsed lung's volume, from CT

| Field               | Value                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Slice               | R9, first part: where the lung's collapse ends. Not the port, rib yielding or the along-rib limit                                 |
| Branch              | `claude/mt-r9a-ct-volume-endpoint`                                                                                                |
| Base                | `origin/main` `15c5244585ea1b9aea0d5e3dd7ae4dbb2c3a14e9` does not carry the module; the branch stands on the prerequisite below   |
| Prerequisite slices | `claude/mt-03e-gate-evidence` (pull request 307), head `2b3976639bdb0c9f409f3e80f503cfc12ce5ea24`, and through it the whole stack |
| Final head          | The commit that adds this file                                                                                                    |
| Owner decision      | OD-17 (2026-10-05), which settles open item I5 and supersedes OD-14 for the lung's collapse only                                  |
| Date                | 2026-10-05                                                                                                                        |

## Why

The collapsed lung's size was the author's choice: the flow stopped when the gap at the port
reached 30 mm. The owner asked for it to be set from measurement instead, using CTs with large
effusions, and chose the candidate that fits lung volume and keeps the authored position
(candidate D0 of the fit). The flow now stops when the lung fills 0.246 of the drawn pleural
space, the median measured in eleven supine chest CTs of other patients.

## What changed

| Path                                                                                                                        | Change                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/medical-thoracoscopy/build_lung_states.py`                                                                         | `COLLAPSE.gapAtPortMm` is gone; `endLungShareOfSpace` 0.246 replaces it. `collapse()` stops at the first step where the lung is no larger than that share of the drawn space. The record gains `spaceVolumeMl`, `endVolumeMl`                                                                                                                 |
| `scripts/medical-thoracoscopy/validate_lung_states.py`                                                                      | Three new checks: the drawn space's volume, the end volume as the recorded share of it, and the last state within 2 per cent under it                                                                                                                                                                                                         |
| `scripts/medical-thoracoscopy/build-tour-stops.ts`                                                                          | A region no position shows any of now gets the position that brings the most of it into the field, with `seenFromThere` 0. Every stop records `inFieldFromThere`                                                                                                                                                                              |
| `scripts/medical-thoracoscopy/package-anatomy.ts`                                                                           | The lung states and the lung proxy also list the right `R-COLLAPSE-VOLUME-CTS` in the asset ledger                                                                                                                                                                                                                                            |
| `src/features/medical-thoracoscopy/content/anatomy.ts`                                                                      | Schemas follow: the collapse's three new values in place of `gapAtPortMm`; `inFieldFromThere` on a tour stop                                                                                                                                                                                                                                  |
| `src/features/medical-thoracoscopy/engine/space/tourStops.ts`                                                               | A tour stop carries `seen`, how many of its region's samples it shows                                                                                                                                                                                                                                                                         |
| `src/features/medical-thoracoscopy/components/lesson/LessonActivities.tsx`                                                  | At a stop that shows none of its region, the tour tells the stop and does not ask the learner to name it. Two new lines of learner copy, `tourFaces` and `tourHidden`                                                                                                                                                                         |
| `src/features/medical-thoracoscopy/components/prototype/SpacePrototype.tsx`                                                 | The prototype starts at lung step 5, not 4: the first step at which its starting position is clear of the rebuilt lung                                                                                                                                                                                                                        |
| `src/features/medical-thoracoscopy/content/sections/` `normal-pleural-space.ts`, `four-controls.ts`, `systematic-survey.ts` | One line each, under "What you see, and where it comes from": "How far the lung has fallen" no longer says it was chosen by the author and not measured. It says the lung fills about a quarter of the space, the middle value measured beside large effusions on CT in other patients, and that where the lung rests is chosen by the author |
| `src/features/medical-thoracoscopy/content/data/anatomy/lung-states.json`                                                   | Rebuilt: nine states from 2,339.6 mL to 832.5 mL                                                                                                                                                                                                                                                                                              |
| `…/anatomy/proxies.json`, `fluid-table.json`                                                                                | Rebuilt with the lung. The pleural-space proxy and `zone-samples.json` are unchanged, byte for byte                                                                                                                                                                                                                                           |
| `…/anatomy/zone-reach.json`, `tour-stops.json`, `tool-contact.json`                                                         | Recomputed for the new lung proxy                                                                                                                                                                                                                                                                                                             |
| `src/features/medical-thoracoscopy/content/data/generated/anatomy.ts`                                                       | The manifest names the new files                                                                                                                                                                                                                                                                                                              |
| `src/features/medical-thoracoscopy/content/data/claim-register.json`                                                        | MT-C-0002 revision 2 and MT-C-0001 revision 3 (see below). Both stay NOT REVIEWED                                                                                                                                                                                                                                                             |
| `docs/medical-thoracoscopy/owner-decisions.md`                                                                              | OD-17 added; open item I5 removed                                                                                                                                                                                                                                                                                                             |
| `docs/medical-thoracoscopy/registers/rights-register.json`                                                                  | New item `R-COLLAPSE-VOLUME-CTS`: the CT-RATE scans the number was measured from, their licence and the open question                                                                                                                                                                                                                         |
| `docs/medical-thoracoscopy/ATTRIBUTION.md`                                                                                  | Credit for the dataset, and what is not settled                                                                                                                                                                                                                                                                                               |
| `docs/medical-thoracoscopy/registers/asset-ledger.json`, `claim-review-queue.md`                                            | Regenerated; the scene's totals follow the new file sizes                                                                                                                                                                                                                                                                                     |
| Tests: `lungStates`, `registers`, `spaceEngine`, `spaceJourneys`, `sectionLesson`                                           | Hold the new rule and the new records; two tests added (the told stop; the prototype's starting step on the real proxies)                                                                                                                                                                                                                     |

What did not change: the drift along gravity (40 mm) and every other value of the flow; the port;
the tilt limits; the optics; the pleural space, the ribs and the context; the zone samples; the
label "Authored, illustrative"; the eight steps. Mediastinal contact was not fitted. The lessons'
written copy is unchanged apart from the two activity lines and the one provenance line above.

### The lung, before and after

| Step | Before: volume (mL) | Before: gap at the port (mm) | After: volume (mL) | After: gap at the port (mm) |
| ---- | ------------------- | ---------------------------- | ------------------ | --------------------------- |
| 0    | 2,339.6             | 0.9                          | 2,339.6            | 0.9                         |
| 1    | 2,008.3             | 5.1                          | 2,063.4            | 4.3                         |
| 2    | 1,730.2             | 9.1                          | 1,802.1            | 8.0                         |
| 3    | 1,489.6             | 13.0                         | 1,594.7            | 11.3                        |
| 4    | 1,299.0             | 16.4                         | 1,410.3            | 14.4                        |
| 5    | 1,116.1             | 20.0                         | 1,229.4            | 17.8                        |
| 6    | 957.8               | 23.5                         | 1,085.6            | 20.7                        |
| 7    | 820.8               | 26.9                         | 944.5              | 23.8                        |
| 8    | 702.5               | 30.1                         | 832.5              | 26.6                        |

The end volume asked for is 840.74 mL (0.246 of 3,417.64 mL). The flow moves in steps of about
11 mL there, and stops at the first at or under it: 832.5 mL, 0.2436 of the space.

### What the larger lung does to the survey

| Measure, lung at step 8                                         | Before         | After |
| --------------------------------------------------------------- | -------------- | ----- |
| Zone samples that can be seen from some position, of 1,636      | 436            | 381   |
| Mediastinum samples that can be seen, of 342                    | 1              | 0     |
| Apex, of 146                                                    | 26             | 15    |
| Diaphragm, of 234                                               | 55             | 43    |
| Back of the chest wall, of 390                                  | 203            | 184   |
| Front of the chest wall, of 266                                 | 117            | 107   |
| Samples within the field's reach, of 1,636                      | 1,125          | 1,120 |
| Lung step at which the seated sleeve first clears the lung      | 3              | 4     |
| Lung step at which the start at depth 12 mm first clears        | 4              | 5     |
| Forceps: lines from the port that meet the lung before the wall | all            | all   |
| Forceps: nearest lung from the telescope's tip (mm)             | 22.4           | 18.8  |
| Lung proxies with a tunnel through them (R7)                    | 2 (steps 2, 4) | none  |

No part of the mediastinum can now be seen from any position the port allows. The tour of
section 6 needs a stop for every region, so its sixth stop takes the telescope to the position
that faces the most of the mediastinum (283 of 342 samples in the field, none seen) and says:
"The telescope faces the mediastinum. None of it comes into view from here. In this model that
is so from every position the port allows." The other six stops are where they were, except
the back of the chest wall, which moved by a few degrees.

## Claims and assets touched

- **MT-C-0002**, revision 1 to 2. The assertion no longer says the lung sits at an authored
  distance from the port. It says the lung fills about a quarter of the pleural space, that the
  share is the middle value measured beside large effusions on CT in other patients, and that
  where the lung rests is the author's choice. Source note and limitations say what the
  measurement is and is not. NOT REVIEWED.
- **MT-C-0001**, revision 2 to 3. Source note only: how far the lung falls is set from
  measurement on other patients; how quickly is the author's choice. NOT REVIEWED.
- `lung-states`: `272603d8d95a…` to `b19cd605c54ed2dd6b6514ff12fb5facd8e3917694b7ccc630954f13584f2427`, 1,308,408 bytes.
- `proxy-lung`: `9d7a1a5818da…` to `206b2fd0e70f52f6134b5da552283c5d759333e1d9735000b9ea79478a101e2e`, 485,480 bytes.
- `proxy-pleural-space`: unchanged, `6c4048f8e9ee…`.

The files are in the owner's local data, not in the repository and not uploaded. The earlier
builds are kept beside them in `anatomy/_before-ct-volume-endpoint-2026-10-05/`.

## Checks run

| Command                                                                                                    | Result                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3 scripts/medical-thoracoscopy/build_lung_states.py`, twice                                         | Every step and blend passes; the second build byte-identical to the first (three files, four records). 470 s each                                                                                  |
| `python3 scripts/medical-thoracoscopy/validate_lung_states.py`                                             | 0 failures                                                                                                                                                                                         |
| `npx tsx scripts/medical-thoracoscopy/package-anatomy.ts --install-dev`                                    | 6 files, 2,565,368 bytes of 3,145,728                                                                                                                                                              |
| `Blender --background --factory-startup --python scripts/medical-thoracoscopy/validate_anatomy_blender.py` | 6 files, 0 failures (Blender 5.1.0)                                                                                                                                                                |
| `npx tsx scripts/medical-thoracoscopy/build-zone-reach.ts`, `build-tour-stops.ts`, `build-tool-contact.ts` | Ran; results in the tables above                                                                                                                                                                   |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts --check`                                         | All pages current                                                                                                                                                                                  |
| `npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts`                                                | 10,000 journeys (70,000 moves; 197,963 poses judged along paths; 4,290 lung moves) and 2,000 forceps journeys (82,119 moves; 676,774 poses judged), on the new proxies: no problems, no seed added |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`                       | 32 suites, 461 tests, all passing (two new)                                                                                                                                                        |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`                                             | No errors                                                                                                                                                                                          |
| `npx eslint` on the changed TypeScript, `--max-warnings 0`; `npx prettier --check`; `git diff --check`     | Clean                                                                                                                                                                                              |

Before the tests were brought up to date, the first run against the rebuilt records failed five
tests in five suites, each for a reason this slice caused: two pins on the anatomy's rights, the
scene's byte total, the pinned tunnels in the lung proxies, and the tour, which had no stop for
the mediastinum and so was unavailable.

## Real browser observations

Headless Chromium 1243 with Metal, 1440 by 900 unless the check sets another size, against this
worktree's dev server on `localhost:3120`, signed in with the local-development cookie.

- `MT_BASE_URL=… MT_LOCAL_DEV_AUTH_TOKEN=… npx playwright test -c playwright.medical-thoracoscopy.config.ts`:
  22 of 23 pass (3.4 minutes), run twice with the same result. The one failure is "storage refused altogether", which
  needs the site's storage guard (R6, pull request 308). That change is not on this branch or
  its base; the gate-evidence handoff records the same dependency.
- The tour of section 6, taken to its sixth stop in the real scene: "Stop 6 of 7. The telescope
  faces the mediastinum. None of it comes into view from here. In this model that is so from
  every position the port allows. The inner wall of the space, with the heart behind it. What
  names it: Heart." The Scope view is filled by the lung. The five stops before it and the one
  after ask the learner to name the region, as before. The landmark line names the heart at a
  stop where the heart is not in view; that line is the section's own and was not changed.
- The corrected provenance line was read on the page.

## Checks not run

- The whole repository's Jest run, the production build and the Storybook build. This slice
  touches only the module; the base's known failures are recorded in the gate-evidence handoff.
- Performance measurements. The lung file is the same size and the lung proxy 980 bytes larger.
- Blends between states for the fit's other candidates: only this one was built.

## Unresolved decisions

- **Rights.** The number comes from CT-RATE, licensed CC BY-NC-SA 4.0. Whether one summary number
  measured from scans licensed for non-commercial use may set a value in a sponsored module, and
  whether share-alike reaches the lung built to it, is not decided (`R-COLLAPSE-VOLUME-CTS`). The
  number is in the public repository on any pushed branch that carries this change.
- **The dataset's citation** is not in the source register: its full citation has not been taken
  from the paper. `ATTRIBUTION.md` names the dataset, its licence and its arXiv number only.
- **Clinical review** of MT-C-0001 and MT-C-0002 at their new revisions, and of the two new
  lines of learner copy at the tour's mediastinum stop.
- **Whether this lung is the one to keep.** It is larger than the authored one and sits nearer
  the port. The mediastinum cannot be seen at all, and the forceps still cannot reach the chest
  wall. The fit's comparison candidates are in the owner's local data
  (`raw-assets/medical-thoracoscopy/collapse-study-2026-09-30/ct-rate-fit-2026-10-03/`).
- The port, rib yielding and the along-rib limit: still OD-14.
- The measurements are from supine scans with fluid in place. The model shows a patient on the
  side after drainage. No correction was made.

## What must not happen next

- Do not upload the lung states or the proxies. Rights are not approved (OD-13), and this slice
  adds an open rights question.
- Do not run `package-anatomy.ts` from a checkout that does not carry this slice: the files in
  the owner's local data are now this slice's, and an older checkout's records describe the
  earlier ones. To go back, restore `anatomy/_before-ct-volume-endpoint-2026-10-05/`.
- Do not present the collapsed lung's volume as this patient's, as a clinical finding, or as
  reviewed. Its label stays "Authored, illustrative".
- Do not push or open a pull request until the owner asks (OD-09).
- The local demonstrations made before this slice (the pleural-model progress video and viewer,
  the portable-trainer concept) show the earlier lung. They were not rebuilt.

This does not change publication status or constitute clinical approval.
