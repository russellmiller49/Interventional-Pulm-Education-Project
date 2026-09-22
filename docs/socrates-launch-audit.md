# SOCRATES implementation audit — 2026-09-22

Recorded before implementation. Starting `origin/main`:
`bf613270a37a30cfd31a915a33758b808dfbff89`.
Branch: `codex/socrates-launch-readiness`; worktree: `codex-socrates-9-22`.
`git log d98bab79af9231eb1857e2da96cb75ca2068d85c..origin/main --` the
SOCRATES feature/routes/docs, migrations and site access file returned no commits.
Unrelated changes on current main are retained. No merge or deployment is authorized.

## Existing behavior and implementation mapping

| Requirement                                                                                                     | Existing implementation / planned change                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve paired zoom, regions, modes, retry                                                                     | Compose `ComparisonSlideViewer` and `DeepZoomViewer`; retain source-pixel geometry, parent/detail visibility engine, source resolver and fixed-origin relay.                                                                                                                                                                                                   |
| Fullscreen                                                                                                      | Reuse `NativeCtViewer` native-first/in-page-fallback pattern with Escape, focus restoration, a single mounted viewer and viewport retention. AnatomyViewer has a simpler native-only pattern.                                                                                                                                                                  |
| Case content, categories, vignettes, low/high observations, learning points, adequacy/cancer/optional diagnosis | Current `SocratesSlideDocument` only describes a slide and regions. Add explicit v2 case content and safe legacy upgrade. Keep case editing separate from the region inspector. No clinical material is fabricated.                                                                                                                                            |
| Legend                                                                                                          | No reviewed external annotation key exists in the feature. Add authorable labeled color entries and review status; show “Annotation key pending review” until approved.                                                                                                                                                                                        |
| Private notes / ON-SITE readiness                                                                               | Current tables are editor-only, but published snapshots are public through an RPC. Add protected structured readiness and provenance; learner projections allowlist fields. Imaging, identifier verification, de-identification, content review, applicable secondary ROSE, and holds gate study activation.                                                   |
| Persistence                                                                                                     | `socrates_slides`, `socrates_annotations`, and `socrates_revisions` use a legacy descriptor restriction; annotation explanation has no column. Add a forward migration and v2 RPC, persist structured case fields, explanation and paired URLs. Prove database round trips before using v2 saves. Leave the public sandbox's incompatible-save guard in place. |
| Legacy JSON / browser drafts                                                                                    | Retain `socrates-invenio-web-overlays:v1` workspace key and active draft restoration. Keep legacy parsing valid; add an explicit upgrade and current-schema export. Do not overwrite unreadable storage.                                                                                                                                                       |
| Catalog / existing URLs                                                                                         | Add unlisted/noindex `/[locale]/socrates`, grouped training catalog and direct training links. Retain `/socrates-demo`, its browser workspace and legacy published-slide links, and `/socrates-builder`.                                                                                                                                                       |
| Training                                                                                                        | Dedicated case page: inspect, request teaching interpretation, then review learning points and complete. Persist opened/revealed/completed events for authenticated participants; show honest persistence status. Region explanations are withheld from the initial inspection surface.                                                                        |
| Testing / identity                                                                                              | Reuse `supabaseServer().auth.getUser()`, active/expiring site entitlements and own-user rows, as in PCCM. Add participant entitlement. Testing uses its own component and server DTO without diagnosis-bearing titles/categories, region explanations, teaching content or private notes.                                                                      |
| Rounds / surveys                                                                                                | Structured versioned study, round membership/order and survey configuration. At least Round 1 and Round 2 supported, without assigning scientific meaning. Freeze membership/configuration once active; pin case revisions.                                                                                                                                    |
| Timing / finalization                                                                                           | Authenticated server-created attempts with server start/submission timestamps, elapsed duration, responses, confidence and completeness. Transactional idempotent finalization; no subsequent edits and no default feedback or score.                                                                                                                          |
| Monitoring / CSV                                                                                                | Site-admin-only dashboard and deterministic exports of coded participant IDs, training progress, round/case/version provenance, missing responses, time and confidence. No identity profile or specimen fields.                                                                                                                                                |
| Validation                                                                                                      | Existing suites unchanged, new schema/projection/builder/access/viewer/study tests, isolated PostgreSQL migration/RLS/transaction rehearsal, real Playwright journeys at 1440×900, 1280×800, 390×844 and enlarged text. Type-check, lint and production build; reproduce unrelated failures on recorded main.                                                  |

## Teaching design boundary

Audience: authorized clinician/trainee study participants; desktop image interpretation
with usable compact access. Scope: an authored image-interpretation workflow at the
“knows how” level, not clinical competence or certification. The learning spine is
inspect image → low-magnification observations → high-magnification observations →
reasoned interpretation → key learning points. The assessment surface collects the
study team's authored designations and confidence independently of teaching.
Content objectives, actual vignettes, real color mappings, diagnostic options,
confidence scale and round protocol remain study-team inputs. Synthetic fixtures
exercise interactions only. Completion measures activity, not ability.

## Risks to address

- A public published snapshot or sandbox RPC can bypass a client-only privacy filter:
  project at the database/server boundary and test RPC access directly.
- A testing DTO can leak diagnoses via titles, categories, attribution or region
  labels: use neutral test labels and a minimal slide projection.
- Editing a case or study mid-session invalidates provenance: pin immutable revisions
  and freeze active study configuration; current holds still stop participation.
- A browser retry can duplicate answers: enforce unique participant/round/case attempts
  and serialize finalization in PostgreSQL.
- Local Supabase is shared and may not be started/reset here. Validation uses a
  disposable PostgreSQL container, without touching shared Supabase or remote data.

Relevant database guidance reviewed: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [database functions](https://supabase.com/docs/guides/database/functions).
The current changelog has no relevant breaking change to the APIs used here.
