# Training project consolidation

Both projects are maintained in this Git repository:

| Project            | Editable app            | Other project files  |
| ------------------ | ----------------------- | -------------------- |
| Navigation trainer | `navigation_module/web` | `navigation_module/` |
| SoCal EBUS         | `EBUS-course/apps/web`  | `EBUS-course/`       |

The import uses the working files, including uncommitted navigation code and
calibration. Source branches, commits, and the original working-tree status are
recorded in `training-project-migration.json`. Original repositories, including their Git history and uncommitted files, are
archived under
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/recovery/2026-09-10/training-project-repositories/`.
The old project paths are symlinks to the new source folders. Do future edits in
this repository. No submodules or nested Git repositories are used.

## One-repository workflow

1. Install from the root with `npm ci --legacy-peer-deps`. The postinstall script
   installs each embedded app using its existing lockfile.
2. Use `npm run dev:navigation` or `npm run dev:ebus` for app-level hot reload.
   Use `npm run dev`, `dev:codex`, or `dev:claude` for the whole site. These build
   the embedded apps initially and watch source changes, including shared input
   code. Reload the iframe after a rebuild.
3. Run `npm run build` for deployment. It always rebuilds both apps first and
   includes their runtime assets in the standalone output.
4. Commit source changes here. Generated `public/*/app` bundles are ignored.

App-level dependencies and type checks remain separate from the Next.js compiler.
The root Jest suite ignores the imported app test trees; course tests run with its
own Vitest setup. Scope input is shared through direct TypeScript re-exports.

## Preservation and local-only material

The import preserves source layout and available runtime assets. The main site's
existing raw-data policy continues to exclude offline source scans, large
intermediate exports, private reports, and assistant/editor caches. These files
are retained locally rather than published. Recreate node_modules and Python
virtual environments in the new location instead of copying machine-specific
installed environments. The old Git metadata is retained only in the original
backup repositories.

Navigation runtime `.raw` and `.stl` files, EBUS case imports, media, and pipelines
are versioned as build inputs. Generated bundle files were removed from the Git
index. No auth database changes or remote asset uploads are required by the move.
The standalone site is larger because it carries the two apps' runtime assets.

## Validation commands

```sh
npm run build:training-apps
npm run type-check:training-apps
npm run test:training-apps
npm run lint
npm run build
npm run type-check
```

`test:training-apps` checks built embedded URLs, required navigation payloads,
authoring-sidecar pruning, shared input adapters, and the existing course tests.
Build the apps before running the artifact checks.

## Migration verification (2026-09-10)

- Root lint, full production build, and TypeScript check passed.
- Both app builds and app TypeScript checks passed.
- All 221 course tests, 37 shared-controller tests, 23 navigation Python tests,
  and 4 embedded-artifact checks passed.
- Both embedded entry points rendered in Chromium without runtime exceptions.
  The localhost-only navigation authoring UI requests a pruned optional candidate
  sidecar (404), matching the existing embedded-build behavior.
- Source edits and shared-controller edits triggered automatic rebuilds.
- SIGTERM during startup stopped the development launcher and its build group.
- Standalone packaging contains all 13 navigation files (54.5 MiB) and all
  214 EBUS files (279.9 MiB).
- Source files were compared with the originals; differences are limited to
  migration configuration, shared-source adapters, portable Slicer paths, and
  trailing blank-line cleanup. Local scans and learning reports are preserved.

Existing Vite chunk-size and Mermaid/Webpack dependency warnings remain.
