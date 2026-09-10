# EBUS Content Authoring Guide

This repo now separates the interactive teaching flows from the richer handbook-style educational layer.

## Where to add content

- `content/modules/knobology.json`
  - Interactive knobology lab content, quick-reference cards, and the list of embedded knobology quiz IDs.
- `content/modules/knobology-advanced.json`
  - Handbook-style ultrasound foundations content rendered on the knobology route.
- `content/modules/mediastinal-anatomy.json`
  - Boundary rules and station-map teaching content rendered on the stations route.
- `content/modules/sonographic-interpretation.json`
  - CHS, CNS, margins, Doppler, and elastography teaching sections.
- `content/modules/procedural-technique.json`
  - Stepwise EBUS technique content.
- `content/modules/staging-strategy.json`
  - Sampling-order and N-stage decision content.
- `content/stations/core-stations.json`
  - Structured station detail content for map cards and station detail panels.
- `content/stations/station-correlations.json`
  - CT, bronchoscopy, and EBUS correlate copy plus recognition prompts.
- `content/quizzes/*.json`
  - Explanation-heavy quiz questions used by the mixed quiz page and module quizzes.

## Lesson module schema

Each handbook module follows this shape:

```json
{
  "id": "module-id",
  "title": "Module title",
  "summary": "One-paragraph summary",
  "learningObjectives": ["Objective 1"],
  "sections": [
    {
      "id": "section-id",
      "title": "Section title",
      "kind": "core-concept",
      "body": "Main teaching paragraph",
      "bullets": ["Optional bullets"],
      "checklist": ["Optional checklist"],
      "imageIds": ["station:4R:ct"],
      "pearl": "Optional pearl callout",
      "pitfall": "Optional pitfall callout",
      "caseVignette": {
        "title": "Optional case title",
        "scenario": "Short scenario",
        "prompt": "Teaching question",
        "takeaway": "Teaching takeaway"
      }
    }
  ]
}
```

Supported `kind` values are defined in [apps/web/src/content/types.ts](/Users/russellmiller/Projects/EBUS-course/apps/web/src/content/types.ts).

## Related image IDs

The handbook renderer can show image strips for section-level teaching art.

- Knobology controls: `knobology:depth`
- Station correlates: `station:4R:ct`, `station:4R:bronchoscopy`, `station:4R:ultrasound`

Only image-backed assets will render in the strip. Video-only assets are skipped.

## Station authoring checklist

When adding or updating a station in `content/stations/core-stations.json`, include:

- `iaslcName`
- `boundaryDefinition`
- `boundaryNotes`
- `nStageImplication`
- `bestEbusWindow`
- `landmarkVessels`
- `whatYouSee.ct`
- `whatYouSee.bronchoscopy`
- `whatYouSee.ultrasound`
- `safePunctureConsiderations`
- `stagingChangeFinding`

If you add a new station:

1. Add the station object to `content/stations/core-stations.json`.
2. Add its correlate copy to `content/stations/station-correlations.json`.
3. Add its node position to [apps/web/src/content/station-map-layout.web.json](/Users/russellmiller/Projects/EBUS-course/apps/web/src/content/station-map-layout.web.json).
4. Add any media entry to [apps/web/src/content/station-media.json](/Users/russellmiller/Projects/EBUS-course/apps/web/src/content/station-media.json).
5. Add map connections in [apps/web/src/content/stations.ts](/Users/russellmiller/Projects/EBUS-course/apps/web/src/content/stations.ts) if the station belongs in the schematic flow.

## Quiz authoring checklist

Each quiz item should include:

- `type`
- `options`
- `correctOptionIds`
- `explanation`
- `difficulty`
- `tags`
- An option-level `rationale` for every answer choice

Supported quiz types:

- `single-best-answer`
- `multi-select`
- `ordering`
- `image-interpretation`
- `case-vignette`

Notes:

- `multi-select` correctness is set-based, so answer order does not matter.
- `ordering` correctness is exact, so order does matter.
- `case-vignette` can include `caseTitle` and `caseSummary` for the question stem.

## Keeping the current architecture clean

- Keep teaching text in JSON or Markdown, not embedded in JSX.
- Keep new stations out of any `case3d` files unless a separate task explicitly targets that module.
- Prefer extending shared contracts in [apps/web/src/content/types.ts](/Users/russellmiller/Projects/EBUS-course/apps/web/src/content/types.ts) over creating one-off component props.
