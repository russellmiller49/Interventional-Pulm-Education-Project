# Rapid Onsite Cytology Annotation Workflow

Use this for offline hotspot calibration. QuPath helps identify or draw candidate cell regions, while the browser workbench is the final teaching-coordinate editor.

## Open A Slide In QuPath

QuPath is expected at:

```bash
/Applications/QuPath-0.7.0-arm64.app/Contents/MacOS/QuPath-0.7.0-arm64
```

List available cytology slides:

```bash
npm run rose:qupath -- --list
```

Open a slide:

```bash
npm run rose:qupath -- diff-quik-adenocarcinoma-high
```

Remote Wikimedia/NCBI images are cached into `.tmp/rapid-onsite-cytology/qupath-images/` before QuPath opens them. Local imported images are opened from `public/images/creative-commons/pathology/`.

## Export From QuPath

In QuPath, draw or select the annotation objects you want to use as candidate hotspots. Export them as GeoJSON using QuPath's object export workflow.

Then convert the GeoJSON bounding boxes into the module's normalized ellipse schema:

```bash
npm run rose:qupath:convert -- exported-objects.geojson 4272 2848
```

Use the natural image width and height shown in the browser workbench or QuPath image metadata.

## Final Calibration

Open the dev-only workbench:

```text
http://localhost:3001/rapid-onsite-cytology/annotate
```

Paste or manually apply candidate coordinates, then drag/resize/nudge hotspots until they match the intended cells. Copy the slide JSON and update `src/features/rapid-onsite-cytology/content/slides.ts`.

QuPath, Cellpose-SAM, TIA Toolbox, CONCH, and HISTAI are offline annotation aids only. The shipped teaching module uses reviewed hotspots and does not make automated diagnostic claims.
