# SoCal EBUS Course Integration Guide

This guide explains how the SoCal EBUS Course is wired into the main Interventional Pulmonology website, where the source of truth lives, and what to watch out for when making changes.

## Quick Summary

The SoCal EBUS Course is not authored directly inside this repository.

- The course app source lives in the separate `EBUS-course` repository.
- The main website serves a built static copy of that app from this repository.
- The main website wraps that static app with a page, navigation entry, and iframe.

In short:

- Edit the course in `EBUS-course`
- Sync the built output into this repo
- Verify the main site still builds and serves it correctly

## Repositories and Responsibilities

### 1. Source course repository

Path:

```text
/Users/russellmiller/Projects/EBUS-course
```

This is the source of truth for:

- Course content
- Course routes
- Knobology
- Stations
- Lectures
- Pretest
- 3D case viewer
- Course-specific styles and logic

Important source files include:

- `apps/web/src/main.tsx`
- `apps/web/src/lib/assets.ts`
- `apps/web/src/content/*`
- `apps/web/src/features/*`

### 2. Main website repository

Path:

```text
/Users/russellmiller/Projects/Interventional-Pulm-Education-Project
```

This repository owns:

- The website navigation
- The `/socal-ebus-course` wrapper page
- The static bundled copy of the course
- The redirect and iframe/security configuration needed to serve the embedded app

Important integration files include:

- `src/app/socal-ebus-course/page.tsx`
- `src/components/layout/Navigation.tsx`
- `src/app/page.tsx`
- `next.config.mjs`
- `scripts/sync-socal-ebus-course.mjs`
- `public/socal-ebus-course/app/*`

## Source of Truth vs Generated Output

This is the most important concept in the setup.

### Source of truth

The editable course code is in:

```text
EBUS-course/apps/web
```

### Generated output

The built, synced output that the main site serves is in:

```text
Interventional-Pulm-Education-Project/public/socal-ebus-course/app
```

Do not hand-edit files inside:

```text
public/socal-ebus-course/app
```

Those files are generated and will be overwritten the next time the sync script runs.

## What to Edit, Depending on the Goal

### If you want to change the course itself

Edit the `EBUS-course` repository.

Examples:

- Add a new lecture
- Change knobology behavior
- Update station images
- Adjust pretest questions
- Change 3D anatomy viewer behavior
- Tweak course-specific styling

### If you want to change how the main website presents the course

Edit the main website repository.

Examples:

- Rename the nav item
- Change the intro text above the embedded course
- Change the layout of the `/socal-ebus-course` page
- Change iframe sizing
- Change the homepage CTA

### If you want to change how the embedded course is served

Edit the main website repository.

Examples:

- Redirect behavior for `/socal-ebus-course/app`
- CSP and iframe headers
- Sync/build workflow

## Standard Update Workflow

### Workflow A: Update course content or course UI

1. Make your edits in:

```bash
cd /Users/russellmiller/Projects/EBUS-course
```

2. Rebuild and sync the course into the main site:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
npm run sync:socal-ebus-course
```

3. Verify the main site:

```bash
npm run build
npm run type-check
```

4. Commit changes in both repositories if needed.

### Workflow B: Update only the wrapper page or navigation

1. Edit files in:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
```

2. Verify:

```bash
npm run build
npm run type-check
```

No course sync is needed if you did not change the `EBUS-course` source app.

## Sync Script

The sync script lives here:

```text
scripts/sync-socal-ebus-course.mjs
```

It does two things:

1. Builds the `EBUS-course` web app with the correct base path
2. Copies the built output into:

```text
public/socal-ebus-course/app
```

Command:

```bash
npm run sync:socal-ebus-course
```

## Important Technical Details

### 1. The embedded app is served as a static bundle

The main site does not import the `EBUS-course` source code directly at runtime.

It serves a built copy of the course from the `public` directory.

### 2. The real app entry is `index.html`

The actual static app entry is:

```text
/socal-ebus-course/app/index.html
```

The friendly URL:

```text
/socal-ebus-course/app
```

is redirected there by `next.config.mjs`.

### 3. The course is embedded via iframe

The page:

```text
src/app/socal-ebus-course/page.tsx
```

embeds the course with an iframe.

That means the static app must be allowed to render in a frame.

### 4. Frame headers matter

The embedded course path needs frame-safe headers.

The relevant config is in:

```text
next.config.mjs
```

If `X-Frame-Options` is too strict, the iframe will fail even if the app path itself is correct.

### 5. CSP matters for fonts and assets

The course uses Google Fonts and static assets under the embedded path.

If fonts or styles fail unexpectedly, check the CSP configuration in `next.config.mjs`.

### 6. The course app was modified to support subpath hosting

The source course app includes subpath-aware logic so it can be hosted under:

```text
/socal-ebus-course/app/
```

Key support files:

- `EBUS-course/apps/web/src/lib/assets.ts`
- `EBUS-course/apps/web/src/main.tsx`

These changes help with:

- Correct media paths
- Correct pipeline paths
- Embedded routing behavior

### 7. Shared Supabase auth callbacks are routed through the main site

The shared Supabase project should keep its Site URL set to:

```text
https://interventionalpulm.org
```

For SoCal EBUS password recovery, use this redirect URL:

```text
https://interventionalpulm.org/auth/callback?app=socal-ebus-course&authMode=reset-password
```

The main site owns the central callback at:

```text
src/app/auth/callback/route.ts
```

That callback only routes to apps listed in:

```text
src/lib/supabase/auth-redirect.ts
```

It preserves Supabase hash and query tokens in the browser and forwards recovery links to:

```text
/socal-ebus-course/app/?authMode=reset-password#access_token=...
```

If Supabase requires a wildcard allow-list entry for query-bearing callbacks, allow:

```text
https://interventionalpulm.org/auth/callback**
```

## Common Gotchas

### Gotcha 1: Editing generated files

Problem:

You edit something inside:

```text
public/socal-ebus-course/app
```

Why this is bad:

- It is generated output
- The next sync will overwrite it

Correct fix:

- Make the edit in `EBUS-course`
- Re-run `npm run sync:socal-ebus-course`

### Gotcha 2: Course change does not show up on the website

Problem:

You updated `EBUS-course`, but the main site still shows the old version.

Cause:

The built static copy in `public/socal-ebus-course/app` was not refreshed.

Fix:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
npm run sync:socal-ebus-course
```

### Gotcha 3: `/socal-ebus-course/app` returns 404

Possible causes:

- The bundle is missing from `public/socal-ebus-course/app`
- The sync script was not run
- Redirect behavior in `next.config.mjs` changed

Checks:

- Confirm `public/socal-ebus-course/app/index.html` exists
- Re-run the sync script
- Restart the Next dev server if config changed

### Gotcha 4: The iframe is blank or blocked

Possible causes:

- Wrong iframe URL
- `X-Frame-Options` too strict
- CSP blocking fonts or scripts
- CSP blocking `data:` WebAssembly fetches used by the 3D viewer
- `.gitignore` excluding synced `.mp4` files so Railway deploys without videos

Checks:

- Confirm the iframe points to `/socal-ebus-course/app/index.html`
- Check `next.config.mjs`
- If the 3D viewer says `Failed to fetch`, confirm the embedded app CSP allows `data:` in `connect-src`
- If videos fail only after deployment, confirm `public/socal-ebus-course/app/**/*.mp4` is not being ignored
- Restart the dev server after config changes

### Gotcha 5: Type-check fails with `contentlayer/generated` missing

Cause:

The generated contentlayer files were not built yet.

Fix:

```bash
npm run build:content
npm run type-check
```

or simply:

```bash
npm run build
```

### Gotcha 6: You changed `next.config.mjs` but nothing changed in the browser

Cause:

Next config changes often require a dev server restart.

Fix:

- Stop the dev server
- Start it again

## Recommended Verification Checklist

After a course-related change:

1. Run:

```bash
npm run sync:socal-ebus-course
```

2. Run:

```bash
npm run build
```

3. Run:

```bash
npm run type-check
```

4. Manually check:

- `/socal-ebus-course`
- `/socal-ebus-course/app`
- `/socal-ebus-course/app/index.html`

5. Confirm:

- The iframe loads
- The dedicated view opens
- Course images, videos, and 3D assets load
- Synced `.mp4` files are present in the main repo before you push

## Commit Strategy

Because this integration spans two repositories, you may need to commit in both places.

### Commit in `EBUS-course` when:

- You changed course code or content

### Commit in `Interventional-Pulm-Education-Project` when:

- You changed the wrapper page
- You changed navigation
- You changed `next.config.mjs`
- You re-synced the static bundle

If you changed both, commit both.

## Short Decision Guide

If you ask yourself, "Where should I make this change?"

Use this rule:

- Course behavior/content/UI: `EBUS-course`
- Website integration/navigation/embed: `Interventional-Pulm-Education-Project`
- Generated bundle: never hand-edit

## Future Improvement Option

If this workflow starts feeling heavy, the next architecture step would be a true single-repository integration where the course source is moved into the main site instead of being built and copied in as a static bundle.

That would reduce the two-repo sync overhead, but it would also be a larger refactor.
