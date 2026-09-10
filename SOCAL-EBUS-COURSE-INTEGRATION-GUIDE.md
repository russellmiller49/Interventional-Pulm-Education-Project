# SoCal EBUS Course Integration Guide

The complete course source now lives in `EBUS-course/` inside this repository.
The Vite app remains at `EBUS-course/apps/web`, with its existing content, models,
sponsors, and offline preparation tools in their original relative locations.

## Development and deployment

From the education repository root:

```sh
npm ci --legacy-peer-deps
npm run dev:ebus          # Vite app with hot reload
npm run dev              # Main site; automatically rebuilds embedded source changes
npm run build            # Both embedded apps, then Next.js and standalone packaging
npm run type-check:training-apps
npm run test:training-apps
```

Reload an embedded iframe after the main dev server reports a rebuild. The apps
retain separate lockfiles because their Vite, React, and Three.js versions differ.
Root installation automatically installs their dependencies. No second repository
commit or sync command is required. `npm run build:socal-ebus-course` is available
for an individual build.

## Files and URLs

- Course UI: `EBUS-course/apps/web/src`
- Course content: `EBUS-course/content` and `EBUS-course/apps/web/src/content`
- Course runtime media: `EBUS-course/apps/web/public`
- Imported case models: `EBUS-course/model`
- Shared controller implementation: `src/lib/scope-input/core`
- Site wrapper: `src/app/socal-ebus-course/page.tsx`
- Generated output, ignored by Git: `public/socal-ebus-course/app`

The wrapper stays at `/socal-ebus-course`, and the iframe entry stays at
`/socal-ebus-course/app/index.html`. Existing redirects, framing headers, CSP,
course identifiers, learner storage, and authentication callbacks are preserved.
Never edit generated files; edit their source and use the normal development or
build command.

## Environment and assets

The embedded build retains the existing mappings from root `NEXT_PUBLIC_*` values
to the course's `VITE_*` variables. Keep the root environment configured as before.
The default central auth callback is still
`https://interventionalpulm.org/auth/callback?app=socal-ebus-course`.
No database migration or authentication configuration change is part of this move.

Runtime media, models, and WASM pipelines now ship with the rebuilt standalone
app, including files named by content hashes. Existing remote asset rewrites remain
fallbacks for missing assets. This prevents an updated source asset from requiring
a separate upload to make a new build usable. Deployment size increases accordingly.

Local learning-outcome reports, scratch exports, and raw authoring scans remain
local and excluded from Git. See [migration notes](docs/training-project-migration.md).
