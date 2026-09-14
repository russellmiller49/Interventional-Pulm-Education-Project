# Local authoring assets (Interventional-Pulm-Local-Data)

The production build (`npm run build`, the dev servers, Jest, Playwright) reads only what is
tracked in this repository. Everything that exists to _make_ the tracked files — raw Slicer and
Blender exports, source videos, private references, one-off renders, module build prompts — lives
outside Git in one folder so that every worktree stays small:

```
/Users/russellmiller/Projects/Interventional-Pulm-Local-Data
```

Override the location with the `IP_LOCAL_DATA` environment variable. The same root is recorded as
`externalDataRoot` in `<Local-Data>/config/worktrees.local.json`.

This document is the map. If you (human, Claude, or Codex) need source knowledge or a raw asset,
look here first, then read it from Local-Data by absolute path.

## Rules for agents

1. **Read in place.** Open Local-Data files by absolute path. Do not copy them into a checkout,
   do not `git add` them, and do not commit them. The `.gitignore` block "Relocated to
   Interventional-Pulm-Local-Data" blocks the old paths, but scoped copies elsewhere would not be
   caught.
2. **Regenerate, don't relocate.** When a derived file under `public/`, `src/`, or `data/` must
   be rebuilt, run the tracked script; the script resolves its input through the helpers below.
   Commit only the derived output the app actually reads.
3. **Private material stays private.** `private-references/`, `device-manuals/`, `gudid/`,
   `literature/`, `secrets/` and `authoring-imports/` contain copyrighted, institutional, or
   licensed material. Read it for knowledge; never quote it at length into tracked files, never
   upload it, never redistribute it. `secrets/` is never read into a transcript.
4. **Add new sources to Local-Data, not the repo.** A new segmentation, video, manual, or source
   PDF goes under the matching Local-Data folder (create a subfolder named like the module). Then
   add a row to the table below in the same PR that adds the script that reads it.
5. **Do not reorganize Local-Data** without updating this map, the helpers' callers, and
   `<Local-Data>/README.md`.

## Resolving paths from scripts

Node (ESM):

```js
import { localDataPath, requireLocalDataPath } from '../local-data-root.mjs'

const sourceDir = requireLocalDataPath('raw-assets', 'pleural-effusion-simulation')
```

Python (including scripts run inside Blender or 3D Slicer):

```python
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from local_data import local_data_path

SOURCE_DIR = local_data_path("raw-assets", "anatomy", "new_anatomy_module")
```

Shell:

```bash
LOCAL_DATA_ROOT="${IP_LOCAL_DATA:-/Users/russellmiller/Projects/Interventional-Pulm-Local-Data}"
```

Both helpers accept `IP_LOCAL_DATA` and fall back to the default path. `requireLocalDataPath` /
`require_local_data_path` raise a readable error that names the missing folder.

## Folder map

Former repository paths are listed so old prompts, handoffs, and memory notes can be followed.

### Raw authoring inputs — `raw-assets/`

| Local-Data path                                  | Contents                                                                                                                                    | Former repo path                                       | Read by                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raw-assets/anatomy/new_anatomy_module/`         | Slicer centerline scene and per-branch centerline exports, cleaned label workbook, `Airway.glb`                                             | `new_anatomy_module/`                                  | `scripts/airway-anatomy/generate-assets.py`, `scripts/rigid-bronchoscopy/build-realistic-airway.py`                                                                                         |
| `raw-assets/video/normal_airway_anotated_video/` | Source airway-survey video and the CVAT annotation export (zip + extracted XML)                                                             | `normal_airway_anotated_video/`                        | `scripts/airway-lesson/{render-video-assets,extract-overlays,extract-quiz-frames}.py`                                                                                                       |
| `raw-assets/pleural-effusion-simulation/`        | Pleural-effusion CT, segmentation, effusion and probe GLBs, PLUS scene (`plus/`), RAS surfaces (`updates/`)                                 | `Pleural_effusion_simulation/`                         | `scripts/thoracic-ultrasound/*.mjs`, `scripts/pleural-ultrasound/generate-pleural-sim-assets.mjs`, `scripts/pleural-ultrasound/plus/*`                                                      |
| `raw-assets/te-fistula/updated_fistual_5_25_26/` | TE-fistula segmentation source and notes                                                                                                    | `updated_fistual_5_25_26/`                             | manual; derived model is `public/models/te-fistula*.{glb,nrrd}`                                                                                                                             |
| `raw-assets/3d-assets/`                          | Blender sources and authoring GLBs: `Stents/`, `Cardiac/`, `Slicer Cardiac_model/`, `Tracheostomy/`, unfiled models, reference renders      | `3D assets/`                                           | `scripts/airway-stent-mechanics/prepare-model-assets.py`, `scripts/cardiac-assets/*`, `scripts/tracheostomy/*`                                                                              |
| `raw-assets/ebus-case-001/model/`                | EBUS case 001 CT slice series (axial/coronal/sagittal PNGs), station markups, full case GLB                                                 | `EBUS-course/model/{sliceSeries,markups,case_001.glb}` | `EBUS-course/scripts/case-001-enrichment.ts` (`npm run generate:case-001` inside `EBUS-course/`) — falls back here for `model/*`                                                            |
| `raw-assets/ebus-guided-models/phase-1/`         | Editable Blender anatomy/scope sources, derived Slicer review scene and acoustic label segmentation, source audit and markups               | —                                                      | `scripts/ebus-guided/models/{audit_sources,build_models,validate_and_package}.py` and `optimize.mjs`; browser exports in `EBUS-course/apps/web/public/simulator/case-001/models/guided-v1/` |
| `raw-assets/ebus-guided-models/additional/`      | Editable Blender A3–A6 sources and optimization intermediates for the generic needle, contact cutaway, analytic phantoms and EUS-B locators | —                                                      | `scripts/ebus-guided/models/{build_additional,validate_additional}.py` and `optimize-additional.mjs`; runtime exports in `EBUS-course/apps/web/public/simulator/case-001/models/guided-v2/` |
| `raw-assets/hardware/bronch_sim/`                | Scope-tracker hardware plans, Gen 1/Gen 2 CAD and STL                                                                                       | `bronch_sim/`                                          | reference only (`src/lib/scope-input/core/index.ts` header)                                                                                                                                 |

The four runtime files the SoCal EBUS app imports at build time stay tracked in
`EBUS-course/model/` (`case_001_ct.nrrd`, `case_001_segmentation.nrrd`, `CT_segmentation_1.glb`,
`CT_segmentation_2.glb`).

### Authoring imports — `authoring-imports/`

| Local-Data path                                                   | Contents                                                                                                            | Former repo path                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `authoring-imports/Imports/Board_Review_Book/`                    | Board-review chapter drafts (Markdown and updated HTML chapters)                                                    | `Imports/Board_Review_Book/`                                                    |
| `authoring-imports/Imports/C_arm module/`                         | C-arm module Slicer scene, labeled centerline table, tracheobronchial tree models, CT segmentation                  | `Imports/C_arm module/`                                                         |
| `authoring-imports/Imports/Lymphnode segmentation/`               | Mediastinal segmentation OBJ/MTL set                                                                                | `Imports/Lymphnode segmentation/`                                               |
| `authoring-imports/Imports/Rigid Bronchoscopy Training Module/`   | Early rigid-bronchoscopy curriculum draft and checklist                                                             | `Imports/Rigid Bronchoscopy Training Module/`                                   |
| `authoring-imports/Imports/Journal_Club_Podcasts/`                | Podcast episode source media                                                                                        | `Imports/Journal_Club_Podcasts/`                                                |
| `authoring-imports/Imports/3D volumes/`, `.../Updated 3D models/` | Volume and model drops that were never tracked                                                                      | (untracked in `Imports/`)                                                       |
| `authoring-imports/ebus-course/`                                  | EBUS course pre/post-course quizzes and surveys (.docx), translation exports, loose images and the updated pre-test | `EBUS-course/{Pre-course tests,surveys,Translation_files}` and loose root files |
| `authoring-imports/translation-work/`                             | es / zh-CN bulk translation patch, coverage JSON, validation log, source zip                                        | `Translation_files/`                                                            |

### Private references — `private-references/`

| Local-Data path                                    | Contents                                                          | Former repo path                         |
| -------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `private-references/pleural-knowledge/`            | Pleural source PDFs and the pleural analysis notes                | `pleural knowlege/`                      |
| `private-references/critical-care-full-textbooks/` | Critical-care textbooks (read-only mount in the primary checkout) | `Critical_Care_Reference/Full_textbooks` |
| `private-references/critical-care-summaries/`      | Critical-care synthesis notes                                     | `Critical_Care_Reference/Summary files`  |
| `private-references/preference-cards-ucsd/`        | UCSD institutional preference-card material                       | `Preference_card_module/UCSD`            |
| `private-references/clinical-language-sources/`    | Source material for the clinical-language-refactor skill          | —                                        |

### Renders, marketing, prompts, scratch

| Local-Data path         | Contents                                                                                                                                                                    | Former repo path       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `renders/output/`       | ICU hemodynamics signal-troubleshooting screenshots                                                                                                                         | `output/`              |
| `renders/outputs/`      | Creative-production drafts, airflow-prediction PowerPoint asset                                                                                                             | `outputs/`             |
| `marketing/`            | LinkedIn promo build scripts, manifests, screenshots, rendered videos and posters (run from here)                                                                           | `marketing/`           |
| `prompts-and-plans/`    | Module build prompts and plans (APC/electrocautery, scope size, stent physics, Baxter CRRT refactor, AI bronchoscopy video), FluoroView test guide, `GITINGEST.md` snapshot | root `*.md` / `*.docx` |
| `archive/root-scratch/` | One-off fix scripts (`fix-mdx-chars.py`, `fix-mermaid-*.py`, `tmp-mermaid.mjs`, `test-imports.mjs`)                                                                         | root                   |

### Folders that predate this map

| Local-Data path               | Contents                                                                                    | Mounted into the primary checkout as                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `secrets/.env.local`          | Environment file                                                                            | `.env.local` (symlink)                                                            |
| `literature/nbib-files/`      | PubMed NBIB corpus for the Literature module                                                | `IP_PubMed/nbib files` (symlink)                                                  |
| `device-manuals/`             | Critical-care device manuals, preference-card IFUs                                          | `Critical_Care_Reference/Device Manuals`, `Preference_card_module/...` (symlinks) |
| `gudid/accessgudid-*/`        | AccessGUDID full delimited release (~5.6 GB)                                                | `Preference_card_module/AccessGUDID_Delimited_Full_Release_*` (symlink)           |
| `Intro_courses/`              | Lecture videos, transcripts, the bronchoscopy-foundations v2 knowledge pack, pre/post tests | read by `scripts/bronchoscopy-foundations/import-manifest.mts`                    |
| `skills/`                     | Skill sources that are not version-controlled                                               | —                                                                                 |
| `recovery/`                   | Dated bundles and patches from repository clean-ups                                         | —                                                                                 |
| `config/worktrees.local.json` | Worktree root, external data root, and named input paths                                    | —                                                                                 |

Only the primary checkout carries the symlink mounts; worktrees do not. Scripts that need those
inputs should resolve them through the helpers or `config/worktrees.local.json` rather than the
mount names.

## What stays in the repository

- `public/` — everything the site serves, including the heavy module assets that
  `MODULE_ASSET_ORIGIN` also mirrors from Supabase Storage (`docs/module-asset-delivery.md`).
- `EBUS-course/apps/web/public/` and `navigation_module/web/public/` — media bundled into the
  embedded training apps.
- `data/`, `content/`, `messages/`, `docs/`, `podcasts/` metadata, `board_review_translations/`,
  the small `Preference_card_module/` catalog files, `IP_PubMed/` starter pack, and the two
  tracked `Critical_Care_Reference/` plans.

## Generated output that is ignored

`.deploy_push/`, `storybook-static/`, `artifacts/`, `public/*/app` embed builds,
`public/mv-console-preview/`, root `tmp-*.bin`. Regenerate these from their tracked scripts.

## History

- 2026-07-28: secrets, NBIB corpus, device manuals, GUDID, textbooks moved out and mounted back
  into the primary checkout by symlink.
- 2026-09-10: training-project repositories archived under `recovery/2026-09-10/`.
- 2026-09-12: raw assets, authoring imports, private pleural references, renders, marketing,
  prompts and root scratch moved out (this map); helper resolvers added; scripts repointed.
