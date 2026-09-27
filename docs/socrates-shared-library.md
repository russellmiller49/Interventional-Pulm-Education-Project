# SOCRATES shared authoring and publication

`/[locale]/socrates-library` is the team authoring workspace. Verified accounts
with an active, unexpired `socrates_editor` or `site_admin` entitlement can use it.
The browser demo links to it and retains the existing private browser drafts.

## Author workflow

1. Open **Shared team library** from the browser slide workspace.
2. Choose **Import this browser’s drafts** or **Import library file** once. The
   latter accepts the prepared curriculum package or an exported author library.
   Workbook hash and source row identify a prepared slide across browsers; repeat
   imports preserve the existing shared draft. Other browser drafts use their
   stable local UUID. An import never replaces an existing protected author case.
3. Open **Edit slide** or **Build a new slide**. Edit context, diagnostic labels,
   teaching text, and bounding boxes in the existing annotation builder. Choose
   Unassigned, Teaching, or Testing. Valid changes save after a short typing pause.
4. Check **All changes saved to the team** before leaving. Other visible author
   tabs refresh every 10 seconds and on window focus. This is revision-based
   collaboration, not simultaneous character-by-character editing.
5. Complete the existing content, identity, de-identification, imaging, and
   secondary review fields. Only a site administrator can choose **Publish
   reviewed version**. Testing publication also requires reference interpretations.

Saving and publishing are different operations. A draft edit or assignment change
does not change the current learner release. Publication atomically selects the
reviewed case revision and its teaching/testing assignment. **Withdraw from
learners** removes that publication without deleting the draft. A current technical
hold or review/imaging/secondary-ROSE hold immediately blocks published delivery.
Routine incomplete review on a working draft leaves the previous release available.

Conflicts never silently replace a teammate’s changes. The author can compare the
local and server documents, export their edits, or use the team version while
retaining a browser recovery copy. **Export recovery copies** retrieves those copies.
Failed saves keep the working draft and display an error with a retry action.
Pending edits are backed up under an account-and-tab-specific browser key; the page
warns before unloading with unsaved edits. Browser drafts and exports remain private.

## Learner delivery

`/[locale]/socrates/learn` serves only released versions to verified accounts with
the existing participant/admin access. It checks for releases on focus and every
30 seconds. Teaching includes the published content and reviewed legend/regions.
Testing receives an explicit server projection: neutral title, opaque tissue image
path, dimensions, and empty teaching fields. No private notes, source identifiers,
diagnostic labels, color path, annotations, narrative, or answer keys are serialized
to testing clients. The image relay independently rejects testing color requests,
unpublished/withdrawn slides, and obsolete revisions. Responses remain tissue-only
after submission.

This feature shares **authoring content**. Learner practice progress and responses
on this new page remain browser-local and are scoped to the signed-in account.
Existing server-backed formal study configuration, enrollment, attempts, responses,
curriculum membership holds, and eligibility flags are unchanged. Publishing a
library slide does not enroll participants or activate a formal study.

## Database and rollout

Apply `20260927143811_socrates_shared_slide_library.sql` after the existing SOCRATES
migrations, then deploy the application. The migration adds `socrates_library_slides`
and checked RPCs using the existing immutable case revisions. Each mutation checks
the expected library version and case revision under row locks. Direct client DML
is denied; RLS allows only editors to read metadata. The raw release RPC is granted
only to `service_role` and is used behind authenticated server routes. Privileged
functions pin an empty search path and verify the author’s identity/entitlement.

The migration seeds no cases, entitlements, publications, or study records. Import
the private 59-slide package through an authorized editor session after deployment.
Do not commit the workbook, browser exports, labels, or private case packages.
Keep the original browser/export copy until the shared import is verified.

Validate on staging with two editor accounts and one participant account: save and
refresh, conflict resolution, reviewed publication, unpublished draft edits,
tissue-only testing, withdrawal, and entitlement expiry. Never use a local auth
bypass or synthetic fixture credentials in deployment.

## Validation

The isolated PostgreSQL rehearsal exercises real migrations, RLS, stale saves,
publication permissions/readiness, stable releases during draft edits, withdrawal,
holds, and repeated workbook imports. Run `node scripts/socrates/rehearsal.mjs`.
The rehearsal creates and removes its own PostgreSQL container; it does not start
or reset the shared local Supabase stack or connect to a remote database.

Focused Jest tests cover in-flight edits, offline recovery, conflict reconciliation,
published projections, and image-route restrictions. Browser checks use the
synthetic Auth/PostgREST adapter with that disposable database; they are not a
production Supabase Auth or deployment test.
