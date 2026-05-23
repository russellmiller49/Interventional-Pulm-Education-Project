# Module Asset Delivery

The app supports moving large educational assets out of `public/` while keeping local development
unchanged.

## Environment

Set these in production:

```env
NEXT_PUBLIC_MODULE_ASSET_BASE_URL=/module-assets/v1
MODULE_ASSET_ORIGIN=https://tqnhxlwvkkswuckszlee.supabase.co/storage/v1/object/public/module-assets/v1
```

For direct CDN delivery instead of same-origin proxying, set `NEXT_PUBLIC_MODULE_ASSET_BASE_URL` to
the public Supabase Storage origin. In local development, leave it unset so existing `/public` paths
continue to work.

## Bucket Layout

Use a public Supabase Storage bucket named `module-assets` with versioned paths:

```text
module-assets/
  v1/
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

The script creates `module-assets` if it does not exist and uploads the heavy asset prefixes under
`v1/`.

## Hostinger Nginx

Use `docs/hostinger-module-assets.nginx.conf` as a production snippet. It creates a same-origin
`/module-assets/v1/` cache proxy and optional compatibility proxies for legacy embedded-app paths.

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
