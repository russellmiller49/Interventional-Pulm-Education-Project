# SOCRATES + Invenio comparison demo

The builder combines the paired tissue and color annotation images from the
[Invenio UCSD Slide Viewer](https://ucsd-slide-viewer-1080580899927.us-central1.run.app/)
with SOCRATES teaching regions. The provider's color annotations are already
rendered into its analysis image. Authors add their own region boundaries, short
summaries, and detailed explanations over the same image coordinates.

## Authoring a slide

1. Open `/en/socrates-demo` to explore the current teaching overlay, or
   `/en/socrates-demo#builder` to edit it. The first visit opens Case 006 with an
   illustrative parent region and nested detail; neither assigns clinical meaning.
2. To use another pair, choose **Browse Invenio demo slides**, select a case, and **Load paired slide**.
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
6. Changes save automatically in this browser. **View demo**, **Build a slide**,
   and page reloads use the currently selected draft, including its explanations.
   **Export overlay** or **Export JSON** downloads a portable copy. On another
   browser or computer, use **Import copy** to load it as an editable draft.

Drafts are stored under `socrates-invenio-web-overlays:v1` in localStorage for the
current origin. They do not automatically sync between browsers, devices, or
localhost and the deployed site. Clearing browser data removes these local copies;
export JSON before changing computers or clearing storage. Images stay on the
provider's host and are not embedded in the JSON file. A storage failure or
incomplete required field shows an auto-save warning and preserves the last valid
saved version; the current edit remains available in memory for export.

The workspace restores browser data before mounting a viewer, preventing the old
single-image sample from flashing or replacing a current pair on reload. Unreadable
stored data is retained rather than overwritten by an untouched starter example.

The catalog is fetched live; it is not copied into application data. Its 59 image
pairs had matching descriptor dimensions when checked on September 8, 2026.
Loading a pair checks the dimensions of both images before replacing the current
slide. A failed load leaves the current teaching regions in place. Individual
viewer failures can be retried; the surviving image remains usable.

## Deployment and existing saved slides

Deploy the application normally. **No database migration, database content copy,
or asset upload is required.** The default company-demo route does not load or
save SOCRATES database content.

Existing protected authoring and sandbox APIs retain their original database
format. They reject paired web overlays or nonempty detailed explanations before
saving, so a legacy save cannot silently drop the new text. The protected builder
links to the browser-based demo for this workflow. Explicit published-slide links
at `/en/socrates-demo?slide=<slug>` still read their existing published snapshot.
No schema or access-policy changes are included.

The demo host has no cross-origin response headers. `/api/socrates-invenio/[...path]`
relays only its catalog, DZI descriptors, and JPEG tiles from a fixed origin.
Requests omit credentials, reject redirects and unexpected content types, and use
a timeout. Images remain hosted by Invenio; no image files are added to this repo
or uploaded to storage. Availability depends on the provider's demo service.

## Validation

Run the focused application tests with:

```sh
npm test -- --runInBand src/features/socrates-builder src/features/socrates-demo src/app/api/socrates-invenio 'src/app/\[locale\]/socrates-demo' 'src/app/\[locale\]/socrates-builder'
npm run type-check
npm run lint
npm run build
```

Coverage includes paired viewport alignment, source-dimension checks, zoom-based
details, browser save/restore across view changes and remounts, active-draft
selection, storage failures, JSON round-tripping, and protection against sending
overlays to legacy database saves. The company-demo route is checked to ensure it
does not fetch an older published or sandbox document on a normal visit.
