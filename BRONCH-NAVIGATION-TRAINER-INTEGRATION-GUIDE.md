# Bronch Navigation Trainer Integration Guide

The Bronch Navigation Trainer is authored outside this repository and served by
the main website as a built static app, matching the SoCal EBUS course pattern.

## Quick Summary

- Source app: `/Users/russellmiller/Projects/navigation_module/web`
- Main-site wrapper: `src/app/bronch-navigation-trainer/page.tsx`
- Generated static app: `public/bronch-navigation-trainer/app`
- Sync command: `npm run sync:bronch-navigation-trainer`

Do not hand-edit files under `public/bronch-navigation-trainer/app`; they are
replaced each time the sync command runs.

## External Build Behavior

The sync command builds the trainer with:

```bash
VITE_ENABLE_SCOPE_DEBUG=false
VITE_BASE_PATH=/bronch-navigation-trainer/app/
vite build
```

That keeps the public embedded version free of authoring-only tools: Scope
debug controls, candidate-label loading and overlays, and the central airway
review panel. The sync script also prunes generated candidate sidecar JSON from
the public app folder. The source repo keeps the default debug-enabled,
root-hosted workflow for calibration and local development.

## Standard Update Workflow

1. Edit trainer code in:

```bash
cd /Users/russellmiller/Projects/navigation_module/web
```

2. Rebuild and copy it into the main site:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
npm run sync:bronch-navigation-trainer
```

3. Verify the main site:

```bash
npm run build
npm run type-check
```
