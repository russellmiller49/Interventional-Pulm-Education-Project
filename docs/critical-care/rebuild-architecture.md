# Critical Care Learning System architecture

This document is the contributor map for the learner-facing critical-care rebuild. It describes
presentation and progress orchestration only; it does not authorize clinical-engine changes.

## Product boundary

The rebuild unifies navigation, activity presentation, progress, resume, reference, and debriefs.
It preserves every focused module engine and the integrated ICU Simulator engine.

The focused modules are independent learning laboratories. They may contribute normalized
competency evidence, but they never share mutable raw physiology. `src/features/icu-simulation`
remains the only cross-system environment with one synthetic patient, one clock, one replay, and
interacting organ-support adapters.

## Route contract

Global critical-care routes:

```text
/[locale]/critical-care
/[locale]/critical-care/pathways
/[locale]/critical-care/pathways/[pathwayId]
/[locale]/critical-care/cases
/[locale]/critical-care/labs
/[locale]/critical-care/reference
/[locale]/critical-care/notebook
/[locale]/critical-care/progress
```

Canonical module routes remain:

```text
/[locale]/icu-hemodynamics
/[locale]/mechanical-ventilation
/[locale]/mechanical-circulatory-support
/[locale]/cardiohelp-ecmo
/[locale]/baxter-crrt
/[locale]/icu-simulation
```

Each focused module migrates to Overview, Learn, Practice, and Assess at its existing base route.
Stable activity selection initially uses query parameters such as `?activity=`, `?case=`,
`?device=`, and `?mode=`. Existing deep links are retained until explicit redirect and progress
compatibility tests exist.

## Current engine and release inventory

| Module                                   | Engine/progress owner                         | Legacy storage                                          | Release boundary      |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------- | --------------------- |
| ICU Hemodynamics                         | `src/features/icu-hemodynamics`               | `icu-hemodynamics-progress-v2`; reads v1                | `unlisted-preview`    |
| Mechanical Ventilation                   | `src/features/mechanical-ventilation`         | `mechanical-ventilation-progress-v2`; reads Hamilton v1 | `tester-preview`      |
| Mechanical Circulatory Support           | `src/features/mechanical-circulatory-support` | `interventionalpulm:mcs-progress:v1`                    | `unlisted-preview`    |
| ECMO Management / CARDIOHELP console lab | `src/features/cardiohelp-ecmo`                | `cardiohelp-ecmo-progress-v1` (payload v2)              | `draft`               |
| CRRT / PrisMax console lab               | `src/features/baxter-crrt`                    | `baxter-crrt-progress-v3`                               | `unlisted-preview`    |
| Integrated ICU Simulator                 | `src/features/icu-simulation`                 | `icu-simulation-progress-v1`; local semantic session v1 | `private-development` |

Release constants, review status, evidence registries, robots metadata, site-auth access, search,
and sitemap tests are authoritative. The rebuild must not promote a module or change its clinical
review status.

## Shared layers

`src/features/learning-module/activity/` owns generic activity, phase, mode, persisted progress, and
resume schemas. Existing `ModuleSectionKey` and pleural progress behavior remain unchanged.

`src/features/learning-module/components/` owns the V2 structural shell: module navigation, fixed
simulation workspace, phase stepper, patient context, task panel, launch gate, reference/evidence
drawers, and debrief.

`src/features/critical-care/content/` owns lightweight catalogs for modules, activities, pathways,
competencies, assets, and reference cards. Catalogs use stable IDs and are Zod-validated.

Public critical-care routes build a least-privilege catalog projection on the server and pass only
reviewed, public-unlisted records to client components. Client import graphs must not depend on the
full catalogs, restricted module runtimes, or server-only progress adapters. Hiding draft/private
records after a client-side import is not an acceptable publication boundary.

`src/features/critical-care/progress/` owns read adapters over legacy module stores, normalized local
writes, resume selection, and recommendation logic. Adapters are projections; they do not mutate or
replace source stores.

## Persistence boundary

Normalized progress records store stable activity IDs, status, phase, mode, bounded scores/counts,
competency evidence IDs, and timestamps. Resume pointers may store activity, route/query, mode,
phase, synthetic scenario/device IDs, a safe checkpoint ID, and a payload version.

Never persist or synchronize waveform samples, high-frequency arrays, raw synthetic physiology,
free-text notes, PHI, or detailed device/semantic command histories. Exact integrated-ICU resume
continues to use its versioned local semantic replay. If exact restoration cannot be proven safe,
resume to the most recent authored checkpoint and disclose that behavior.

The existing `site_module_progress` table supports coarse module percentage and completed-section
sync only. Detailed normalized activity progress remains local until a separately reviewed server
contract exists; no new table is implied by this rebuild.

The global account-sync leaf receives only the reviewed public activity projection. Draft/private
module adapters are loaded only from their source-owned restricted route layouts. Both leaves
reconcile catalog-scoped hydration into the latest generic normalized envelope before writing, so
one subset cannot discard another subset's activities or newer resume pointer.

Lifecycle analytics are emitted from meaningful authored transitions rather than page scrolling.
Payloads contain only stable module/activity IDs and bounded mode/phase/outcome enums. Qualified
start is attributed after 30 visible seconds or the first meaningful interaction; no activity
payload contains clinical prose, synthetic truth, settings, waveforms, or command history.

## Non-goals

- No Redux or Zustand unification.
- No iframe wrappers for native React simulations.
- No rewrite of calculations, reducers, physics, waveforms, device ranges, scoring, or mastery.
- No mandatory single linear curriculum for experienced clinicians.
- No completion credit for a page view or scrolling.
- No leaderboards or generic points.
- No publication-stage changes or invented clinical assumptions.
