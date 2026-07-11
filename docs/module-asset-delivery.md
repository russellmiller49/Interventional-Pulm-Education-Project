# Module Asset Delivery

The app supports moving large educational assets out of `public/` while keeping local development
unchanged.

## Environment

Set these in production when the app server should serve same-origin asset URLs:

```env
NEXT_PUBLIC_MODULE_ASSET_BASE_URL=/module-assets/v1
MODULE_ASSET_ORIGIN=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
```

For direct CDN delivery instead of same-origin proxying, set `NEXT_PUBLIC_MODULE_ASSET_BASE_URL` to
the public Supabase Storage origin. Keep `MODULE_ASSET_ORIGIN` set too on Railway so legacy embedded
app asset paths can fall back to Supabase through Next.js rewrites when the heavy files are not in
the deployment package.

```env
NEXT_PUBLIC_MODULE_ASSET_BASE_URL=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
MODULE_ASSET_ORIGIN=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
```

In local development, leave both unset so existing `/public` paths continue to work.

## Bucket Layout

Use a public Supabase Storage bucket named `module-assets` with versioned paths:

```text
module-assets/
  v1/
    airway-anatomy/...
    airway-stent-mechanics/models/...
    bronch-navigation-trainer/app/cases/...
    draco/...
    fluoroview/...
    models/...
    socal-ebus-course/app/media/...
    socal-ebus-course/app/simulator/...
```

Keep the small embedded app shells in this repo:

- `public/socal-ebus-course/app/index.html`
- `public/socal-ebus-course/app/assets/*.js`
- `public/socal-ebus-course/app/assets/*.css`
- `public/bronch-navigation-trainer/app/index.html`
- `public/bronch-navigation-trainer/app/assets/*.js`
- `public/bronch-navigation-trainer/app/assets/*.css`

Move large media, model, raw volume, NRRD, STL, and JSON geometry payloads first.

Preview the upload set:

```bash
npm run upload:module-assets -- --dry-run
```

Upload or refresh the production bucket:

```bash
SUPABASE_URL=https://tqnhxlwvkkswuckszlee.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run upload:module-assets -- --upsert
```

The upload script also loads `.env.local`, so you can keep `NEXT_PUBLIC_SUPABASE_URL` and the
server-only `SUPABASE_SERVICE_ROLE_KEY` there for local uploads. For this Storage upload workflow,
use the legacy JWT-style `service_role` key from Supabase Project Settings > API Keys > Legacy API
Keys. Do not prefix it with `NEXT_PUBLIC_`.

The script creates `module-assets` if it does not exist and uploads the heavy asset prefixes under
`v1/`.

Scope the upload to a single module with `--only=<public-relative prefix>` (repeatable or
comma-separated) so you do not re-push every prefix:

```bash
# Push just the airway-anatomy module, leaving the other ~330 files in Storage untouched.
npm run upload:module-assets -- --upsert --only=airway-anatomy
```

## Shipping a new in-progress / admin-only module

`scripts/prepare-standalone.mjs` (`remoteAssetPrefixes`) trims these heavy prefixes out of the
Railway standalone bundle, so a new module's assets **do not exist on the deployed server**. If you
forget to upload them, requests fail in production even though everything works in local dev:

- a same-origin static/raw path falls through to the `MODULE_ASSET_ORIGIN` rewrite and Supabase
  Storage returns **HTTP 400** (`Object not found`) for the missing object, and
- a `/api/admin/.../[...path]` route that does `readFile(process.cwd()/public/...)` returns **404**,
  because the file was never copied into `.next/standalone/public`.

Checklist when adding a module whose assets live under `public/`:

1. Add its prefix to `remoteAssetPrefixes` in `scripts/prepare-standalone.mjs` (keeps the deploy
   small) **and** to `uploadPrefixes` in `scripts/upload-module-assets-to-supabase.mjs`.
2. Add a `MODULE_ASSET_ORIGIN` fallback rewrite for the prefix in `next.config.mjs`.
3. Upload the bytes: `npm run upload:module-assets -- --upsert --only=<prefix>`.
4. Verify: `curl -s -o /dev/null -w "%{http_code}\n" "$MODULE_ASSET_ORIGIN/<prefix>/<a file>"` is
   `200` (a missing object shows as `400`).

For an **admin-only** module, keep its asset requests on the **raw same-origin path** (e.g.
`/airway-anatomy/*`) so middleware (`src/proxy.ts` + the `getRequiredEntitlement` /
`isDevOnly*` rules in `src/lib/site-auth/access.ts`) enforces the `site_admin` gate and the fallback
rewrite then proxies the bytes from Storage. Do **not** route admin assets through
`resolveModuleAssetPath` (it prefixes `NEXT_PUBLIC_MODULE_ASSET_BASE_URL` and escapes the gate) or a
local-file API route (the files are trimmed from the standalone output).

## Hostinger Nginx

Use `docs/hostinger-module-assets.nginx.conf` as a production snippet. It creates a same-origin
`/module-assets/v1/` cache proxy and optional compatibility proxies for legacy embedded-app paths.
This is only needed if Hostinger is the application server or reverse proxy. If Hostinger is only
hosting DNS and Railway runs the app, use the Railway setup below instead.

## Railway

When Railway runs the Next app, Hostinger only needs to keep DNS pointed at Railway. Do not install
the Hostinger Nginx snippet.

1. Upload the assets to Supabase Storage with `npm run upload:module-assets -- --upsert`.
2. In the Railway service variables, set:

   ```env
   NEXT_PUBLIC_MODULE_ASSET_BASE_URL=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
   MODULE_ASSET_ORIGIN=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
   ```

3. Redeploy the Railway service so the `NEXT_PUBLIC_` value is present during the Next build.

`NEXT_PUBLIC_MODULE_ASSET_BASE_URL` makes updated module loaders request Supabase URLs directly.
`MODULE_ASSET_ORIGIN` enables Next.js fallback rewrites for legacy embedded app paths such as
`/airway-anatomy/...`, `/fluoroview/...`, `/models/...`, `/draco/...`,
`/bronch-navigation-trainer/app/cases/...`, and
`/socal-ebus-course/app/media/...`.

## Precompression

Before packaging static assets for a VPS, run:

```bash
npm run precompress:assets
```

This writes `.br` and `.gz` siblings for large JSON, JS, CSS, HTML, SVG, and WASM assets so Nginx
can serve compressed geometry/manifest files with `brotli_static` or `gzip_static`.

`npm run build` also runs `prepare:standalone`, which copies `.next/static` and only lightweight
public shell assets into `.next/standalone`. Heavy module payloads are expected to come from
`/module-assets/v1/` in production.
