# Handoff — MT-02b thorax surfaces

| Field               | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 7 of the first build round; work package MT-02                                                                             |
| Branch              | `claude/mt-02b-thorax-surfaces`                                                                                            |
| Base                | `origin/main` `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                                   |
| Prerequisite slices | `claude/mt-03a-survey-specs` at `43306df4` (which carries slices A, B and 1 to 5), merged as the first commit (`8f049c8d`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-02b-thorax-surfaces.md`   |
| Owner decision      | OD-08; the approved first-round plan, sections 4.4 and 5 (row 7)                                                           |
| Date                | 2026-09-28                                                                                                                 |

## Why

The space engine, the survey ledger and the 3D scene all need the same anatomy: the pleural space
as one closed surface, divided into the survey zones; the ribs, numbered; what the Chest view shows
around them; and a port the telescope turns about. This slice builds them from the CT segmentation
and measures what the prototype's port rests on.

## The anatomy files are not in the repository

The rights register says the anatomy may be built and used on the build machine but not uploaded or
published until the segmentation's terms are settled (R-ANATOMY-SEGMENTATION, open item S4). The
repository is public, so committing the surfaces would publish them the moment a branch is pushed.
The surfaces are therefore built into the owner's local data; the repository holds the scripts and
the numbers measured from the surfaces. For the dev server, `build_thorax_surfaces.py
--install-dev` copies them into `public/models/medical-thoracoscopy/v1/anatomy/`, which `.gitignore`
now excludes. If you would rather commit them, that is your decision to make; nothing in the code
depends on where they live.

## What changed

| Path                                                                                                                   | Change                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/medical-thoracoscopy/thorax_common.py`                                                                        | New. The source files, the segments by measured content (the file's names are not trusted), the LPS frame, the presented position, the attribution, and a GLB writer and reader                                       |
| `scripts/medical-thoracoscopy/audit_thorax_sources.py`                                                                 | New. Pins the CT and the segmentation by hash, the one-slice offset between them from their origins, and 19 segments by volume, CT density, extent and pieces, each against the range it was identified by. `--check` |
| `scripts/medical-thoracoscopy/build_thorax_surfaces.py`                                                                | New. The pleural space, the survey zones, the ribs, the context, the port candidates and the port record, below                                                                                                       |
| `scripts/medical-thoracoscopy/validate_thorax_surfaces.py`                                                             | New. Reads the surfaces back with its own code and checks them against the committed record                                                                                                                           |
| `src/features/medical-thoracoscopy/content/data/anatomy/{source-audit,surfaces,ribs,port-candidates,port-record}.json` | New. Numbers only                                                                                                                                                                                                     |
| `src/features/medical-thoracoscopy/content/anatomy.ts`                                                                 | New. The records' schemas, and the presented position (`PRESENTATION_FROM_LPS`, `GRAVITY_LPS`) the scene will apply                                                                                                   |
| `src/features/medical-thoracoscopy/content/{data/pleural-zones.json,pleuralZones.ts}`                                  | The zone list gains `split`: how the build divides the surface, so lessons and asset keep one source                                                                                                                  |
| `src/features/medical-thoracoscopy/content/data/claim-register.json`                                                   | The asset surfaces that now exist are marked written: port-record (MT-C-0003), survey-zones (MT-C-0009, MT-C-0023), thorax-surfaces (MT-C-0017). No claim's wording changed                                           |
| `src/features/medical-thoracoscopy/__tests__/{anatomyRecords,registers}.test.ts`                                       | New, and updated for the asset surfaces                                                                                                                                                                               |
| `.gitignore`                                                                                                           | The dev copy of the anatomy                                                                                                                                                                                           |
| `docs/medical-thoracoscopy/{README.md,registers/claim-review-queue.md}`, `docs/local-authoring-assets.md`              | How the anatomy is built and where it lives; the queue printed again                                                                                                                                                  |

## What was built

| Surface            | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Result                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pleural space      | Right lung lobes and right effusion joined, closed with a 3 mm ball, holes filled; meshed, then simplified to 0.5 mm                                                                                                                                                                                                                                                                                                                                                           | 3,386.3 mL of voxels; 27,350 faces, watertight, outward, 3,375.5 mL meshed (0.3 % under)                                                                                                                                            |
| Survey zones       | Each face classed by the nearest tissue outside it (diaphragm or liver within 8 mm; mediastinal structures within 10 mm; otherwise chest wall), smoothed across neighbours, stray pieces absorbed; the apex above the lower border of rib 2 at its lateral-most 10 mm; the costophrenic recess a 10 mm band either side of where chest wall meets diaphragm; the chest wall split at 30 degrees either side of straight lateral, about the space's centroid in each 10 mm slab | Seven zones, each one connected piece, together holding every face once: diaphragm 12 %, costophrenic recess 9 %, back of the chest wall 24 %, apex 9 %, front of the chest wall 16 %, mediastinum 21 %, side of the chest wall 9 % |
| Ribs               | The right half of the rib cage, its front 30 % cut away, separates into twelve pieces; numbered by the height of the spinal end, highest first; the rest of each rib assigned to the nearest numbered piece. The sternum separated as a band either side of the midline                                                                                                                                                                                                        | Twelve right ribs, each watertight; the left ribs and the sternum as one node each. **The numbering awaits your check**                                                                                                             |
| Chest-view context | Diaphragm, heart, aorta, both venae cavae and the central pulmonary artery, meshed on a coarser grid; the skin left open where the scan's field ends                                                                                                                                                                                                                                                                                                                           | Under 8,000 faces a structure; 26,000 for the skin                                                                                                                                                                                  |

The three files total 4.5 MB before compression, which the next slice adds. Two builds gave
byte-identical files and records.

## The port candidates

For your decision on T6. Measured on one scan taken lying on the back with the arms down; not a
guide to choosing a port in a patient. The axillary lines are the course's own: 30 degrees either
side of straight lateral about the pleural space's centroid.

| Space | Line               | Rib gap, bone to bone (mm) | Chest wall, pleura to skin (mm) | Pleura to lung along the line (mm) | Pleura to nearest diaphragm (mm) |
| ----: | ------------------ | -------------------------: | ------------------------------: | ---------------------------------: | -------------------------------: |
|     5 | anterior axillary  |                       12.4 |                            45.8 |                                0.0 |                             89.6 |
|     5 | mid-axillary       |                        9.6 |            skin not in the scan |                                0.0 |                            107.6 |
|     5 | posterior axillary |                        7.8 |            skin not in the scan |                                0.0 |                            130.6 |
|     6 | anterior axillary  |                       12.8 |                            42.8 |                                0.0 |                             66.4 |
|     6 | mid-axillary       |                        9.9 |            skin not in the scan |                                0.5 |                             80.6 |
|     6 | posterior axillary |                        8.3 |                            66.2 |                                0.2 |                            110.0 |
|     7 | anterior axillary  |                       25.1 |                            31.5 |                                0.0 |                             34.5 |
| **7** | **mid-axillary**   |                   **15.0** |                        **40.0** |                            **0.2** |                         **62.7** |
|     7 | posterior axillary |                       12.8 |                            59.2 |                                0.0 |                             85.2 |
|     8 | anterior axillary  |                       29.9 |                            28.8 |                                0.8 |                             15.4 |
|     8 | mid-axillary       |                       23.2 |                            32.5 |                                6.5 |                             31.6 |
|     8 | posterior axillary |                       20.8 |                            36.8 |                                0.0 |                             56.5 |

What the table says:

- The default (bold) holds: the 7th space on the mid-axillary line is the highest on that line
  where the skin is in the scan. The 7.6 mm sleeve leaves 3.7 mm each side between the ribs.
- The gap measured here (15.0 mm) is narrower than the planning estimate (about 19 mm), because
  this measures the closest approach of the two ribs within 3 degrees of the line. The wall (40.0
  mm) agrees with the planning estimate (about 39 mm).
- On this scan the lung lies against the chest wall at almost every candidate: the 932 mL effusion
  lies behind the lung, as it does in a patient lying on the back. The working space in the lessons
  comes from the authored state in which air is in and the lung has fallen away (MT-C-0001 and
  MT-C-0002, both awaiting clinical review), not from the scan.
- The 8th space on the anterior axillary line is 15 mm from the diaphragm.

The port record (`port-record.json`) holds the pivot, at the rib level midway between the two
ribs' closest points; the corridor axis, into the chest along the pleural surface's normal; and the
disc of chest wall the shaft may cross, of radius half the gap.

## Claims and assets touched

- Claims: MT-C-0003, MT-C-0009, MT-C-0017 and MT-C-0023 list their asset surfaces as written. No
  wording changed and no revision was raised. Every decision remains NOT REVIEWED.
- Assets: none in the repository. In the owner's local data,
  `raw-assets/medical-thoracoscopy/anatomy/raw/{pleural-space,ribs,context}.glb`, with the hashes
  in `surfaces.json`. The asset ledger lists files the module serves; the compressed files the next
  slice produces are those, and their rows are added then.

## Checks run

| Command                                                                                                                                                    | Result                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `python3 scripts/medical-thoracoscopy/audit_thorax_sources.py --check`                                                                                     | Unchanged; all 19 segments inside their identified ranges                                                  |
| `python3 scripts/medical-thoracoscopy/build_thorax_surfaces.py`, twice                                                                                     | Identical files and records                                                                                |
| `python3 scripts/medical-thoracoscopy/validate_thorax_surfaces.py`                                                                                         | 0 failures. With a wrong hash and a wrong volume put into the record on purpose: both reported, 2 failures |
| `npx jest src/features/medical-thoracoscopy --runInBand`                                                                                                   | 13 suites, 202 tests, all passing                                                                          |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy`; `npx prettier --check`; `git diff --check` | Clean                                                                                                      |

The zone split was also looked at, rendered from the patient's right, from the medial side and
from below, and the ribs and context from the front and the right; the pictures are kept in the
session's scratch folder, not the repository.

## Real browser observations

Not opened: no page shows the anatomy yet. The scene arrives in slice 11.

## Checks not run

- **Blender re-import and compression.** The next slice packages the surfaces with the lung states
  and re-imports every file in Blender.
- **A radiologist's or anatomist's look at the rib numbering and the zone boundaries.**
- **The full suite, Storybook and the production build.** The next integration point is slice 14.

## Unresolved decisions

- **T6**: the prototype port, now with the measured table above.
- **Rib numbering**: counted from the spinal ends on this scan; yours to check.
- **S3 and S4**: the scan's identity and the segmentation's terms, which keep the anatomy out of
  the repository and off the site.
- **Whether to commit the anatomy files** once S4 is settled.

## What must not happen next

- Do not commit, upload or publish an anatomy file while R-ANATOMY-SEGMENTATION blocks it.
- Do not change a zone id, or the zone list's `split`, without rebuilding and checking the zones.
- Do not describe the prototype port as a safe, recommended or usual site.

This does not change publication status or constitute clinical approval.
