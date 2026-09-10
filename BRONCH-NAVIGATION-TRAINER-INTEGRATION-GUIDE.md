# Bronch Navigation Trainer Integration Guide

The trainer source lives in `navigation_module/` inside this repository. Its Vite
app is `navigation_module/web`; the Python preparation tools remain beside it.

- Edit UI and controller behavior in `navigation_module/web/src`.
- Edit cases and calibration in `navigation_module/web/public/cases`.
- Run `npm run dev:navigation` for the Vite authoring app with scope debug enabled.
- Run `npm run dev` for the main site. It builds both embedded apps on startup and
  automatically rebuilds changed source; reload the iframe after a rebuild.
- Run `npm run build` to build both apps and the main site for deployment.

The wrapper and URLs remain `/bronch-navigation-trainer` and
`/bronch-navigation-trainer/app/index.html`. Embedded builds set
`VITE_ENABLE_SCOPE_DEBUG=false` and the appropriate subpath, and prune candidate
sidecars. The existing loopback-only authoring behavior is preserved.

`public/bronch-navigation-trainer/app` is ignored generated output. Never edit or
commit it. An individual rebuild is available as
`npm run build:bronch-navigation-trainer`; repository syncing is no longer needed.

Both apps import the shared controller source at `src/lib/scope-input/core`.
Runtime cases are committed under the source app and ship with the standalone
site. Offline source scans under `navigation_module/data`, annotations, and
pipeline outputs stay local under the existing raw-data policy.

See [migration notes](docs/training-project-migration.md) for provenance and checks.
