# Local authoring assets

The production application does not read raw authoring media from the repository root. Large local inputs and generated build artifacts are therefore excluded from Git so they do not inflate GitHub and Railway source snapshots.

## Local-only inputs

- Podcast MP3 and source-article PDF files under `podcasts/`. Production playback uses the private Supabase `journal-club-podcasts` bucket; `src/data/journal-club-podcasts.ts` remains the application metadata source.
- Raw GLB files under `3D assets/`, `anatomy_assets/`, `new_anatomy_module/`, `Pleural_effusion_simulation/`, `updated_fistual_5_25_26/`, and the raw import folders. Their preparation scripts and small configuration/metadata files remain tracked.
- Raw medical-imaging and mesh inputs under `Pleural_effusion_simulation/` and `Imports/` when they match the scoped ignore rules.

Keep these local inputs in backed-up project storage if future regeneration is required. Removing them from Git tracking does not delete an existing local copy.

## Generated output

- `.deploy_push/`
- `storybook-static/`
- `artifacts/`
- generated marketing videos, posters, contact sheets, and capture frames
- root `tmp-*.bin` scratch files

These outputs should be regenerated from their tracked source scripts when needed.

## Assets that remain tracked

Active application shells, manifests, and learner-facing files under `public/` remain tracked. Railway-specific exclusions mirror the remote payloads that `scripts/prepare-standalone.mjs` intentionally omits from the production image and that `MODULE_ASSET_ORIGIN` serves in production.
