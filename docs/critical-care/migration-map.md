# Critical-care migration map

The rebuild is incremental. Every stage keeps the application buildable, preserves old routes and
storage keys, and adds tests in the same change.

| Stage | Scope                                                                                                  | Compatibility checkpoint                                                   |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| PR 0  | Contributor docs and representative asset inventory                                                    | No runtime behavior change                                                 |
| PR 1  | Activity/catalog schemas, six legacy read adapters, normalized progress/resume, recommendations        | Legacy keys remain untouched; corrupt/version-mismatched data fails safely |
| PR 2  | ModuleFrameV2, ModuleNavV2, ActivityShell, stepper, context/task panels, drawers, debrief, launch gate | Old shared learning components remain backward compatible                  |
| PR 3  | Hemodynamics PAC signal-validation vertical slice and routed scaffolds                                 | Existing reducer/calculations/waveforms unchanged; safe checkpoint resume  |
| PR 4  | Critical-care dashboard, pathways, cases, labs, reference, and progress                                | Release-eligible old cards remain under Quick launch; direct URLs remain   |
| PR 5  | Remaining hemodynamics Learn activities, eight Practice cases, masked Assess, references/debrief       | V1/V2 legacy progress remains readable                                     |
| PR 6  | Mechanical Ventilation Overview/Learn/Practice/Assess and device setup                                 | Hamilton v1 migration remains non-destructive; 15-case scoring unchanged   |
| PR 7  | Shared module frame and fixed activity workspace for MCS, ECMO, and CRRT                               | URLs, curricula, gates, themes, and module-specific progress unchanged     |
| PR 8  | Searchable reference, local notebook, complete asset governance                                        | Saved stable IDs resolve after reload; heavy assets have alternatives      |
| PR 9  | Pathway-to-integrated-ICU recommendations, shared activity workspace, and competency evidence          | Integrated patient/clock/replay/therapy adapters unchanged                 |
| PR 10 | Existing coarse account sync, bounded analytics, low-bandwidth/accessibility/release hardening         | No new progress table; detailed replay stays local                         |

Public critical-care pages receive a server-built, least-privilege catalog projection. Draft and
private source catalogs remain available to authorized module routes and server code, but public
client bundles do not import them and never receive their titles, descriptions, activity IDs,
scenario IDs, or links.

The five-card launcher remains an authoring and compatibility surface. Its public projection shows
only cards whose existing release boundary permits public-unlisted discovery; it does not promote a
draft module merely to preserve the historical card count.

## Legacy-to-normalized projections

- Hemodynamics: case attempts/completion/best score/mastery and last PAC/case workspace project to
  activity status and resume. The v1 key is read only through the existing v2 migration path.
- Ventilation: 15 shared case completions/scores plus device-specific attempts and preferred device
  project to activity status and setup. The Hamilton v1 record is retained.
- MCS: lesson completion, case/capstone completion/mastery, last device/section/activity project
  directly; its existing private storage key is preserved.
- ECMO: guided lesson completion, case completion/scores, VV/VA last activity, and mastery project
  from the existing key whose payload version is 2.
- CRRT: seven lessons, 17 Practice cases, drills/tools, and the masked capstone project from the
  strict V3 DTO. Content-version mismatch continues to fail closed.
- ICU Simulator: six scenario completion/mastery records project to capstone competency evidence;
  exact session resume remains owned by `icu-simulation-session-v1` semantic replay.

## Route migration notes

Hemodynamics and Mechanical Ventilation begin with only their base routes and therefore receive
new Learn, Practice, and Assess files. MCS, ECMO, CRRT, and ICU Simulator already have routed
sections. `/icu-simulation/sandbox` remains available and is not renamed into the shared grammar.

The HAMILTON-C6 route remains a compatibility redirect into Mechanical Ventilation. No duplicate
route is removed until locale-aware redirect, release, analytics, and progress tests prove parity.

## Stop conditions

Stop and document a blocker when implementation would require an unreviewed change to clinical
content, model behavior, device range, scoring, critical-error rules, or publication status. Do not
invent a clinical value or silently promote pending evidence.
