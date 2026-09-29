# Medical Thoracoscopy — repository baseline

Where the build started. Recorded on 2026-09-28.

## Commit and checkout

|                           |                                                                       |
| ------------------------- | --------------------------------------------------------------------- |
| Base                      | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`              |
| Worktree                  | `Interventional-Pulm-Education-Worktrees/claude-medical-thoracoscopy` |
| Branch convention         | One `claude/mt-NN-*` branch per slice, from `origin/main`             |
| Repository visibility     | Public, MIT licence                                                   |
| Other work on this module | None: no other branch, worktree or pull request touches it            |

Nothing for the module existed at the base: no `src/features/medical-thoracoscopy`, no
`docs/medical-thoracoscopy`, no `src/lib/sponsorship`, no `sponsorNotice` prop on the shared frame.

## Installed packages

No package is added, removed or upgraded for this module.

| Package              | Declared                                   | Installed |
| -------------------- | ------------------------------------------ | --------- |
| `next`               | 16.2.2                                     | 16.2.2    |
| `react`, `react-dom` | ^19.0.0                                    | 19.2.4    |
| `three`              | ^0.180.0                                   | 0.180.0   |
| `@react-three/fiber` | ^9.4.2                                     | 9.5.0     |
| `@react-three/drei`  | ^10.7.7                                    | 10.7.7    |
| `three-mesh-bvh`     | ^0.8.0                                     | 0.8.3     |
| `next-intl`          | ^4.13.0                                    | 4.13.0    |
| `zod`                | ^3.23.8                                    | 3.25.76   |
| `typescript`         | ^5.5.4                                     | 5.9.3     |
| `jest`               | ^30.3.0                                    | 30.3.0    |
| `jest-axe`           | ^10.0.0                                    | —         |
| `@playwright/test`   | ^1.62.0                                    | 1.62.0    |
| `gltf-pipeline`      | ^4.3.1                                     | 4.3.1     |
| `draco3d`            | not declared; arrives with `gltf-pipeline` | 1.5.7     |

There is no physics library and no post-processing library.

Two behaviours of `three-mesh-bvh` 0.8.3 were reproduced and are worked around inside the module;
see [plan reconciliation](plan-reconciliation.md).

## Tools on the build machine

| Tool      | Version                                                                             | Used for                                                             |
| --------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Node      | 26.5.0 locally. Production builds have been validated on 22.19.0                    | Everything in the repository                                         |
| Blender   | 5.1.0, run headless                                                                 | Device models; re-importing every exported file as a check           |
| Python    | 3.13 with numpy, scipy, SimpleITK, pynrrd, trimesh, scikit-image, Pillow, pygltflib | Reading the CT and segmentation; building and checking anatomy files |
| 3D Slicer | 5.12.3                                                                              | Not needed for the prototype                                         |

The build machine is an Apple M5 Max. It is none of the hardware the performance targets name,
so every target stays NOT TESTED until measured on that hardware.

## Running the gates on this machine

| Gate                      | Note                                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run type-check`      | Needs a larger heap once a production build has run, because the build's generated route types join the program. Measured at 5.4 GB with those types and 4.9 GB without. Run it as `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check` |
| `npm run build`           | Run with `NODE_OPTIONS=--max-old-space-size=4096`, the limit the production build was validated under                                                                                                                                          |
| `npm test -- --runInBand` | About 20 minutes                                                                                                                                                                                                                               |
| `npm run storybook:build` | Fails at the base; see the slice B handoff                                                                                                                                                                                                     |

## Policies the module works under

| Policy              | Where                                                                                  | What it means here                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent rules         | `AGENTS.md`, `CLAUDE.md`                                                               | Never commit to `main`. Stage reviewed paths only. No force-push, no rebasing a pushed branch. Storage uploads run only from the primary checkout, after asking |
| Local data          | [`docs/local-authoring-assets.md`](../local-authoring-assets.md)                       | Sources and raw assets are read in place, never copied into a checkout                                                                                          |
| Self-paced learning | [`docs/gap-remediation/self-paced/README.md`](../gap-remediation/self-paced/README.md) | Adopted explicitly by the [learning contract](learning-contract.md)                                                                                             |
| Gates               | [`docs/critical-care/testing-and-release.md`](../critical-care/testing-and-release.md) | Type-check, lint and focused tests per slice. Full tests, Storybook build and production build at integration points                                            |
| Asset delivery      | [`docs/module-asset-delivery.md`](../module-asset-delivery.md)                         | `public/models/**` is left out of the production image and served from storage                                                                                  |
| Shared lesson stage | `src/features/learning-module/stage/`                                                  | Used, not edited                                                                                                                                                |

## File boundaries

| Area           | Path                                              | Owner slice |
| -------------- | ------------------------------------------------- | ----------- |
| Module         | `src/features/medical-thoracoscopy/`              | 1 onward    |
| Routes         | `src/app/[locale]/medical-thoracoscopy/`          | 4           |
| Sponsorship    | `src/lib/sponsorship/`                            | 4           |
| Scripts        | `scripts/medical-thoracoscopy/`                   | 1, 3, 7, 8  |
| Runtime assets | `public/models/medical-thoracoscopy/v1/`          | 3, 7, 8     |
| Documents      | `docs/medical-thoracoscopy/`, `docs/sponsorship/` | 1, 2        |

The module imports only from `src/lib`, `src/components` and `src/features/learning-module`.

Files outside those areas that the first round changes, each in exactly one slice:

| File                                                                                                              | Slice | Change                                         |
| ----------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| `src/features/pleuroscopy/content/*`, `messages/*.json`                                                           | A     | Misleading legacy teaching removed             |
| `src/features/learning-module/components/ModuleFrameV2.tsx` and its stylesheet                                    | B     | Optional sponsorship slot                      |
| `src/lib/site-auth/access.ts`, `src/lib/draft-modules.ts`, `src/lib/non-public-modules.ts`, `.claude/launch.json` | 4     | The module's routes are registered as unlisted |

Sitemap, search, site navigation, the home page, `next.config.mjs` and redirects are not touched
in the first round.

## Access and assets, as found

- A public-unlisted route needs no sign-in and no local environment file, so the module can be
  opened in a browser from this worktree once its routes are registered.
- Any address ending in `.glb`, `.json` or `.bin` is served without sign-in, whatever the page
  gate says. A page flag is not protection for an asset.
- `.glb` files under `/models` are served as immutable for a year. `.json` manifests are served
  for five minutes. Model filenames therefore carry a content hash, and only the manifest is
  ever replaced.
- A merged slice that refers to a model shows its fallback in production until the owner uploads
  the files from the primary checkout. (Corrected on 2026-09-29: for the pleural space that fallback
  is not the cut, which needs the collision proxies, themselves anatomy files awaiting the upload;
  without them the spatial controls wait and say why.)

## Source material, as found

| Item                | Finding                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CT                  | `19_CT_HR.nii`, 512 × 512 × 666 voxels, 0.738 × 0.738 × 0.499 mm                                                                                                  |
| Segmentation        | Five layers, thirty segments. Its index is one slice ahead of the CT's                                                                                            |
| Identity            | Asserted to be AeroPath case 19, CC BY 4.0. Not verified against the archive                                                                                      |
| Segment names       | Not reliable. The segment named "thoracic cavity" holds the rib cage; the one named "bone" holds the shoulder girdle. Segments are identified by measured content |
| Scan position       | Supine, arms at the sides. The patient's right side runs past the edge of the scan on every slice that spans the pleural space                                    |
| Right pleural space | About 2.4 L of lung and 0.93 L of effusion                                                                                                                        |
| Device references   | Frames of a manufacturer animation, and four manufacturer documents that disagree in places                                                                       |

## Failures already present at the base

The full test suite was run on this machine against the base. The suites that fail there are
listed in the slice B handoff, so a later failure can be told apart from one this work introduces.
