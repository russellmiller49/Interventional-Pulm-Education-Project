# SOCRATES case authoring, training and study sessions

SOCRATES now supports structured case authoring, deliberate training review and
authenticated survey-based testing. It measures participation and submitted
interpretations; it does not assign a score, pass threshold, competency or
certification. This implementation contains no reviewed clinical case series,
Steve's vignettes, actual Invenio color key or approved study protocol. No UCSD
ON-SITE case is asserted to be ready.

## Routes and access

| Route                                    | Surface and access                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/[locale]/socrates`                     | Unlisted/noindex module directory; recommended core first, ordered available membership and planned counts; diagnosis browsing remains secondary. Empty/error states are explicit. |
| `/[locale]/socrates/training/[caseId]`   | Verified account plus active, unexpired `socrates_participant` or `site_admin`; training inspection and teaching review.                                                           |
| `/[locale]/socrates/testing`             | Same entitlement plus study enrollment for testing; configured rounds and completion.                                                                                              |
| `/[locale]/socrates/testing/[attemptId]` | Own attempt only, active enrollment/study, ready pinned case.                                                                                                                      |
| `/[locale]/admin/socrates`               | `site_admin` only; configuration, enrollment, monitoring, pause/resume and CSV.                                                                                                    |
| `/[locale]/socrates-builder`             | Existing `socrates_editor`/`site_admin` authoring; only site administrators publish.                                                                                               |
| `/[locale]/socrates-demo`                | Existing browser demonstration and sandbox remain available.                                                                                                                       |

The module is not added to the global homepage or sitemap. Page metadata and API
headers discourage indexing; this is separate from authorization. Server routes
call `auth.getUser()` and check verified/nonanonymous identity and entitlement
expiry. API checks apply even if a caller bypasses the page proxy. Study data has
RLS, and writes occur only through checked database functions. Configuration and
other participants' answers are not readable to participants.

## Case packages and authoring

`SocratesCaseDocument` is the complete JSON authoring package with
`schemaVersion: 2`. The existing identity, slide and annotation fields remain:
stable database UUID, slug, title, revision, source-pixel rectangles, parent/detail
relationships, enter/exit zoom thresholds, labels, summaries and explanations.

`caseContent` adds category/subcategory, sort order, training/testing eligibility,
vignette, low/high-magnification observation arrays, learning points,
adequacy/cancer designation and reasoning, optional preliminary diagnosis and
reasoning, and a reviewed annotation legend with label/color/explanation entries.

The optional canonical `learnerNarrative` preserves complete workbook text after
reveal. Its explicit classification lines determine structured classification
fields; validators reject contradictory copies. Protected `curriculumSource`
metadata preserves original cells, notes, purpose, source row and workbook hash.
See the [author guide](socrates-author-guide.md) and
[bounded private importer](socrates-workbook-import.md).

`authorContent` contains internal highlight notes, provenance notes and readiness:
content review, de-identification and identifier matching verification, imaging/WSI
status, secondary ROSE status, technical hold and protected hold reason. There are
no name, MRN, DOB or specimen-ID fields. Authoring panels separate case, region and
internal/readiness content. Teaching/source edits reset content review to incomplete.
Changing sources clears case-level content/readiness so a prior review cannot be
carried onto a different slide accidentally.

Import validates the complete package and creates a new draft copy. Export includes
private author fields: **do not distribute authoring JSON to participants**. Old
unversioned/v1 overlays still parse without changing their original fields.
Explicit upgrade supplies empty case content, ineligible training/testing flags,
incomplete reviews and false verification flags. Unknown versions/fields are
rejected rather than silently dropped. Existing localStorage keys and selected
draft persistence remain unchanged; raw drafts are not rewritten on page load.

Protected saves call `save_socrates_case_v2` in a transaction. The case's current
revision is locked and compared with the submitted revision; a stale editor must
reload. The legacy save guard remains in place, as does the anonymous public
sandbox guard. Both also exist in the database. Public sandbox exports stay v1.

## Persistence and migration

Apply `supabase/migrations/20260922201126_socrates_training_study_v2.sql` before using
the new routes. The migration does not modify either historical SOCRATES migration
or seed any cases, participants, entitlements or active study.

The follow-up adds forward migrations
`20260923040205_socrates_curriculum_narrative_import.sql` and
`20260923042038_socrates_protected_workbook_import.sql`. They extend protected
narrative/source persistence and add curriculum modules, UUID memberships and
atomic import receipts. Six module metadata rows are seeded, with no clinical
cases or memberships. Module revisions and case revisions are independent.

| Storage                                                             | Purpose                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Existing `socrates_slides`                                          | Case identity/source/workflow; approved paired descriptor origin added; public snapshot is projected.  |
| Existing `socrates_annotations`                                     | Geometry and thresholds preserved; new bounded `explanation` column.                                   |
| Existing `socrates_revisions`                                       | Immutable validated full authoring snapshots for exact revision provenance; editor/server access only. |
| `socrates_case_content`                                             | Typed category, eligibility, observation arrays and interpretation columns.                            |
| `socrates_case_legend`                                              | Ordered, constrained legend rows.                                                                      |
| `socrates_case_readiness`                                           | Separate protected notes, review and hold columns.                                                     |
| `socrates_studies`, `socrates_study_rounds`, `socrates_study_cases` | Versioned study, validated survey definitions, ordered round membership and pinned revisions.          |
| `socrates_study_participants`                                       | Existing authenticated user UUID, enrollment and active state.                                         |
| `socrates_training_progress`                                        | Opened, revealed and completed server timestamps per user/case/revision.                               |
| `socrates_test_attempts`                                            | One user/study/round/case attempt, pinned provenance, responses, confidence, completeness and timing.  |

Survey definitions are bounded, validated JSON because item options vary by
protocol. Case/review data uses typed tables; revision snapshots are validated
audit copies, not an unrestricted public document store. Mutation grants on
legacy case/revision tables are narrowed to prevent bypassing the revision transaction.
The participant entitlement is added without dropping existing entitlement values.

To migrate an existing browser overlay: export it, import the file into the protected
builder, complete standalone content and review fields, save, then use the saved
case UUID/revision in the study configuration. Authoring exports retain paired
source URLs and explanations. Old published slides remain readable. New v2
published-slide links route to the training experience; no legacy record is
automatically upgraded. Testing-only cases do not need training publication.

## Training and viewing

The case opens with vignette and a large viewer. Teaching interpretations and
region explanations are fetched only after **Reveal teaching interpretation**.
The learner then reviews low magnification, high magnification, reasoned
interpretation and learning points before marking completion. Completion requires
a recorded reveal, and remains saved after reload. It is an activity record, not
evidence of competency. Empty teaching fields have honest pending-review states.

Training reuses the comparison viewer, source-pixel regions and zoom hysteresis.
Expand uses the repository's native-first fullscreen pattern with a fixed in-page
fallback. Escape/close restores focus, outside controls become inert while
expanded, and the viewer remains mounted. The source-pixel focus and relative zoom
are restored on OpenSeadragon resize; paired panes remain synchronized. Mobile
pan/pinch and the three image modes remain available.

In training, legend entries appear after teaching reveal and only after the author
marks a complete, non-placeholder key reviewed. Otherwise
the UI says **Annotation key pending review**. Labels accompany every swatch. No
medical categories or color meanings are inferred from the image.

## Study configuration and final responses

The dashboard accepts a validated JSON configuration. Download
`/socrates-study-template.json` for an explicitly synthetic draft containing Round 1
and Round 2. Replace placeholder case UUIDs/revisions, survey prompts/options,
confidence scale, version and presentation choices with the approved protocol.
Arrays define round and case order; no scientific meaning is attached to round
numbers. Participants may enter either configured round; prior cases within each
round must be submitted in order. Cross-round scheduling is a study-team procedure.

Each round configures adequacy, cancer and confidence items, and optional preliminary
diagnosis/free text, with per-item requiredness. Every non-free-text item uses
authored options. Legend, color image and postsubmission feedback are explicit
round settings and default off. If an active round shows a legend, its pinned case
must contain a reviewed, nonempty key. Activating freezes configuration permanently;
changes require a new study/version. Pause/resume preserves existing data.

Assign the participant entitlement using existing site administration, then enroll
the verified user's UUID in the dashboard. Enrollment does not create or expand a
global entitlement. Starts require active enrollment and a ready case. The server
creates start timestamps, study version, round/order and revision; clients cannot
choose participant IDs, overwrite timestamps or reopen finalized responses.

Finalization locks the attempt, validates configured options and required responses,
and records submission time, elapsed milliseconds, confidence and missing optional
items. Repeated/concurrent submissions return the first final response unchanged.
`response_complete` means required items passed validation; `missing_items` can still
list optional omissions. Elapsed interpretation time is wall-clock time from case
start to final submission, including loading, reloads and interruptions. It is not
an active-attention measurement. No scoring or automatic scientific interpretation
is added. Feedback remains absent unless explicitly enabled for that round.

## Readiness and privacy boundary

Activation requires testing eligibility, reviewed content, de-identification,
matching case/image labels, ready WSI, completed or inapplicable secondary ROSE,
no technical hold, and authored adequacy/cancer designations with reasoning.
Statuses include ready, incomplete and hold. The pinned revision must have passed
these checks **and** the current case must remain clear. A new hold blocks starts,
image/content access, finalization and study resume. This is a minimal release gate,
not the ON-SITE scan/specimen operations tracker.

Learner/test DTOs use allowlists. Internal notes/readiness, arbitrary source metadata,
provider URL/barcode, private region notes and diagnostic testing titles/categories
never enter those DTOs. Testing has its own component and sends no teaching arrays,
answer keys, ground-truth reasoning or region explanations before submission.
Images are authorized through opaque UUID/revision or attempt URLs. That relay
fetches only the existing approved fixed origins, omits credentials, refuses
redirects, validates content types and reconstructs DZI metadata without source
URLs. No image tiles are copied into the repository. Responses use private/no-store.

These controls protect application fields and URLs; they cannot determine whether
an image's pixels or freely authored teaching text contain an identifier. Reviewers
must inspect both before verifying de-identification, including navigation thumbnails.
The public publication RPC returns only v2 catalog/viewer metadata, with no answer
narrative, key, teaching arrays or private author metadata. Authenticated training
reveal remains the answer-bearing path. Use disjoint training/testing case sets
when the protocol requires preventing prior training exposure. The independent
public Invenio demo is still public: application authorization cannot revoke public
source availability. Participant UUIDs are coded identifiers, not a claim of formal
anonymization. The identity linkage stays in existing site administration.

## Monitoring and export

The admin dashboard shows enrolled participants, started/completed cases and rounds,
training completion, per-case response counts, missing items, elapsed milliseconds,
confidence, responses and case/revision/study provenance. CSV contains deterministic
ordered test and training rows, coded user UUIDs and no email/name/specimen columns.
Unreviewed free-text responses are visible only in the protected dashboard and
excluded from CSV. Spreadsheet formula prefixes are escaped. Admin reads paginate
beyond the default 1,000-row API cap. Export is a live read, not a cross-table
transaction snapshot; pause enrollment/testing for a formally frozen extract.

## Release inputs and validation limits

The study team still supplies vignettes/observations/reasoning, verified source
images and authorizations, the actual reviewed annotation key, diagnostic options,
confidence scale, case sets/order, feedback policy, version, training requirements,
round scheduling and retention/export procedures. No study is seeded or activated.

The [original validation report](socrates-launch-validation.md) and
[follow-up report](socrates-steve-followup.md) record tests and browser evidence.
Database rehearsal uses isolated PostgreSQL with real migrations, RLS and
transactions, plus synthetic Auth/PostgREST HTTP adapters for the browser. It is not
a production Supabase Auth, mail, proxy or load test. Normal staging migration/auth
verification remains part of a later authorized release. No deployment or remote
database mutation is part of this PR.
