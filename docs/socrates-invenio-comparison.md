# SOCRATES + Invenio comparison demo

The builder combines the paired tissue and color annotation images from the
[Invenio UCSD Slide Viewer](https://ucsd-slide-viewer-1080580899927.us-central1.run.app/)
with SOCRATES teaching regions. The provider's color annotations are already
rendered into its analysis image. Authors add their own region boundaries, short
summaries, and detailed explanations over the same image coordinates.

## Authoring a slide

1. Open `/en/socrates-demo#builder` for the company sandbox, or the protected
   `/en/socrates-builder` workspace.
2. Choose **Browse Invenio demo slides**, select a case, and **Load paired slide**.
   This starts a new draft. A slide link or a standalone Thinviewer comparison
   link can also be pasted into the existing source URL field.
3. Draw a parent region on either image. Give it a label, a brief summary, and a
   detailed explanation. Explain the observed tissue and its relationship to the
   provider's colors; cite clinical interpretations in the explanation.
4. Zoom in, select **Draw detail region**, and draw inside the parent. Add the
   finer explanation and choose **Reveal at current zoom**, or set the enter and
   exit zoom values manually.
5. Choose **Preview teaching view**. The images share pan, zoom, selection, and
   source-pixel teaching regions. Use **Tissue only**, **Color annotated**, or
   **Side by side** without losing your current region. **Return to editing**
   preserves the unsaved draft.
6. Export/import JSON for a portable draft, or save using the workspace's existing
   sandbox/editor workflow. Publishing still requires a site administrator.

The catalog is fetched live; it is not copied into application data. Its 59 image
pairs had matching descriptor dimensions when checked on September 8, 2026.
Loading a pair checks the dimensions of both images before replacing the current
slide. A failed load leaves the current teaching regions in place. Individual
viewer failures can be retried; the surviving image remains usable.

## Deployment

Apply `supabase/migrations/20260908233000_add_socrates_invenio_comparison.sql`
before deploying this application version. It permits the specific company demo
descriptor paths and adds an optional detailed explanation to saved annotations.
It updates protected save/publish and sandbox validation while retaining their
existing roles, policies, edit keys, and publishing rules. Existing single-image
documents and published snapshots remain compatible.

The demo host has no cross-origin response headers. `/api/socrates-invenio/[...path]`
relays only its catalog, DZI descriptors, and JPEG tiles from a fixed origin.
Requests omit credentials, reject redirects and unexpected content types, and use
a timeout. Images remain hosted by Invenio; no image files are added to this repo
or uploaded to storage. Availability depends on the provider's demo service.

## Validation

Run the focused application tests with:

```sh
npm test -- --runInBand src/features/socrates-builder src/features/socrates-demo src/app/api/socrates-invenio
```

The database regression check uses an isolated in-memory Postgres instance, with
the actual existing SOCRATES migrations and the new migration. It does not connect
to or change local or production Supabase:

```sh
npm install --prefix /tmp/socrates-postgres-test --no-audit --no-fund @electric-sql/pglite
node scripts/socrates-builder/verify-comparison-db.mjs /tmp/socrates-postgres-test/node_modules/@electric-sql/pglite
```

It verifies protected save/reload/publish, sandbox save/update/list, legacy
documents, explanation length limits, approved source checks, and the existing
role and edit-key protections.
