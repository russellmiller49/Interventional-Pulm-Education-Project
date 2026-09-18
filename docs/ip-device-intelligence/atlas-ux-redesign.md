# Device Atlas UX redesign (2026-09-18)

Branch `claude/device-9-18`. Goal: move the Devices / Device Atlas module from "raw catalog" to
a practical clinical device reference **without** touching the governed device data, the
evidence/provenance model, the safety logic, the normalized taxonomy, exact-identifier
behavior, localization, accessibility, or the preference-card surfaces.

Everything below is presentation and URL state. No governed data file, overlay, generator,
cohort predicate, or status mapping changed.

## The hierarchy the UI now follows

**Device class → device subtype → manufacturer product line → exact model/catalog item**, with
direct lookup (name, manufacturer, brand, catalog number, GTIN, class/subtype label, clinical
role, procedure) available at every step. Two intents stay separate:

- **Discovery** browses product lines (the index default).
- **Exact lookup** is model-first: a strict identifier match is pinned above the results in
  both views and under every sort, visibly marked, never inside a collapsed line.

## Audit findings that shaped the design

| Finding                                                                                                                                                                                                                              | Consequence                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `familyKey` = manufacturer + brand family + catalog kind. One brand range ("Karl Storz Thorax") spans **12 device classes / 133 products**; 271 cohort products record no `brand_family` and fall back to the canonical subcategory. | A result "family" is keyed on `familyKey` **+ normalized subtype**, labeled a _product line_ (display only), and flagged when it is a catalog grouping rather than a recorded brand family. The detail page's same-line list got the same subtype restriction. |
| `gauge` is typed numeric but reviewed rows carry strings (`"22G"`, `"19G/21G"`).                                                                                                                                                     | `parseGaugeValues` reads every gauge a record lists, so a gauge filter never mistakes those rows for "not recorded". Governed values are not rewritten.                                                                                                        |
| On bronchoscope records `min_working_channel_mm` holds the scope's **own** channel, not a tool requirement (consistent with the comparison page's existing note).                                                                    | Bronchoscopes get no "min. working channel" summary field, no `channelMax` filter, and no "recorded minimum working channel" statement. The verbatim size text still shows the channel.                                                                        |
| Stent `material` / `coverage` strings are inconsistent ("Silicone" vs "Medical-grade silicone").                                                                                                                                     | No material filter. Stent subtypes already encode covered / uncovered / silicone, so subtype browsing does that job; material and covering are shown as recorded.                                                                                              |
| The unresearched default status carries gate `review_required` (~70% of the cohort).                                                                                                                                                 | "Needs attention" placement uses matched safety actions, a gate _blocked_ by an active action, or a historical/conflicted market status — never the unresearched default, which is neither an alert nor reassurance.                                           |
| Procedures record no human-readable description (`scope` = "Adult draft", `notes` = version bookkeeping).                                                                                                                            | The procedure index shows name, authored equipment groups and status. No description was invented.                                                                                                                                                             |

## What changed, by phase

### 1 · Devices index (`/devices`)

- Compact task nav (Find a device · Prepare a procedure · Saved devices), plus **Compare (n)**
  while a comparison selection exists.
- **Browse by device type**: taxonomy classes as visible tiles with cohort counts — a fixed
  shortcut list in vocabulary order (not a ranking) plus "All device types (30)". Choosing a
  class reveals its **subtypes** (vocabulary order, empty ones omitted). All of it is plain
  links over the same `deviceClass` / `deviceSubtype` URL filters the form uses.
- Search leads; **device class, subtype, manufacturer** are always visible; clinical role,
  procedure and numeric specifications sit under **More filters**, which opens itself whenever
  one of them is active.
- **Active filter chips**: each removes exactly one filter (class takes its dependent subtype
  with it); "Clear all".
- Results header: count, **Product lines | Individual models** toggle, sort. View, sort, page
  and every filter live in the URL.
- Evidence/cohort explanation moved below the results (unchanged copy, still one disclosure).

### 2 · Family-first results

`domain/atlas-families.ts`. Filters run on models **first**; lines are built from the matching
models only, so counts, spec summaries and rows describe matches. A line card shows
manufacturer, line name, subtype, recorded spec summary ("recorded for k of n" when partial),
matching-model count, market status **only when unanimous**, and a model-level safety line
("k of n listed models have a recorded safety notice … applies to the marked models only").
Expanding lists up to 10 models (affected models are always included) in the same accessible
table as the model view; "View all n models" opens the model view filtered to that line
(`family` URL filter). A one-model line renders as that model. Save / Compare act on exact
models only.

### 3 · Category-aware specifications

`domain/device-display-config.ts` maps stable class codes to `summaryFields` / `filterFields`
for bronchoscope, needle, airway_stent, cryotherapy, pleural_drainage, forceps_instrument and
balloon_dilation, with a generic fallback for every other class. New URL filters: `gauge`,
`frenchMin/Max`, `workingLengthMin/Max` (plus the existing diameter, length, `channelMax`,
now reachable from the form). With a spec filter active the page states how many devices
matched, how many **could not be evaluated because the value is not recorded**, and links to
list exactly those (`specUnknown=only`). Wording is always "recorded value", never
"compatible".

### 4 · Device detail (`/devices/[productId]`)

Order: back link → manufacturer / name → subtype + class (words, not badges) → catalog number
· size → primary role and description → **key specifications** → compact status marks → Save
· Compare · View other models → status panel **lifted here only when there is a recorded
safety action or lifecycle question** → in-page nav (Overview | Specifications | Configuration
& use | Safety & status | Sources) → the sections. Nothing was removed; the status panel is
never collapsed.

- **Back to results** uses a validated `from` parameter: parsed through the index's own schema
  and re-serialized, so it can only ever yield a canonical `/devices?…` URL. Works in new tabs
  and shared links; a hostile value degrades to the plain index.
- **Configuration & use** leads with human-readable statements that already exist (reviewed
  configuration summary, recorded minimum working channel, the catalog note, the authored rule
  message); rule ids and expressions sit under "Rule and source details". Nothing is
  paraphrased or generated.
- **Same manufacturer product line** (mandatory heading kept) is now a table of same-line,
  same-subtype models, each with its own recorded specs and its own status.

### 5 · Comparison

`CompareSelection.tsx` (provider, button, tray, nav link) mirrors the saved-devices storage
contract — identifiers only, validated, bounded at the existing maximum of 4 — under its **own
key**, so saving and comparing never write to each other. Compare buttons: result rows,
one-model cards, line model rows, detail header, same-line table. The comparison page now
leads with category-specific technical rows, then safety & status, description, configuration,
general fields, sources; **Differences only** folds agreeing _specification_ rows only (type,
safety, status, description, configuration and all citations always remain). Below `md` the
table becomes a field-by-field stacked layout with every value tagged by device. No winner,
ranking or score.

### 6 · Procedures

Index cards lead with name, status and the template's **authored equipment groups**;
procedure code, template version, release bundle, slot bookkeeping and the coverage ladder
moved into **Template details**. The workspace gained a third view, **By equipment group**
(the authored `section`, verbatim). Requirement cards now say **"Devices listed for this
equipment requirement"** and link separately to **"devices related to this clinical role
(discovery only — not listed for this requirement)"**; the index says the same about the
procedure filter.

## Query-layer changes

- `catalog-search.ts`: `deviceSubtype`, `family`, `view`, `gauge`, `frenchMin/Max`,
  `workingLengthMin/Max`, `specUnknown`. All optional / defaulted; `view` and `specUnknown`
  degrade instead of invalidating a shared link.
- `searchCatalog`: the new range/exact checks and the `specUnknown: 'only'` listing. Behavior
  with none of the new fields set is unchanged (preference-card callers pass none).
- `searchAtlas`: one `searchCatalog` pass, then presentation — strict exact-identifier
  pinning, optional grouping, pagination of the shown unit. Its default view stays `models`,
  so existing callers and tests are unchanged; the index passes `families` explicitly.
- No database, migration, generator or governed-data change.

## Not implemented — the data does not support it

- Procedure descriptions (none recorded).
- Stent material / covering filters (inconsistent strings; use subtypes).
- "Kit versus individual device" for pleural drainage beyond the existing subtypes
  (`product_kind` is free text with ten spellings).
- Cryotherapy "console/configuration requirement" as a field — shown only where a reviewed
  configuration statement or catalog note already says it.
- Save / Compare on a whole product line (no identity to save; would imply equivalence).

## Data-quality observations (not changed here)

1. `gauge` mixed types (numbers and `"22G"`-style strings; one `"19G/21G"`).
2. `reuse_status` spelling: `"Single-use"` vs `"Single use"`.
3. Brand ranges used as `brand_family` for whole instrument catalogs (Karl Storz Thorax,
   Richard Wolf Thorax, Olympus Endoscopy Accessories) — 14 family keys span >1 device class.
4. 271 cohort products with no `brand_family`.
5. Bronchoscope rows store the scope channel in `min_working_channel_mm`.
6. `unknownFilter` interpolates an English filter name into a localized sentence
   (pre-existing pattern, followed for the two new filter names).

## Verification

See the PR description for the test, build and browser-verification record.
