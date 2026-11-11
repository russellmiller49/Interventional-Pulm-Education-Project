# Beta module versioning

## V1 revision registry

[The registry](../src/features/module-beta/revisions.ts) is the source of reviewer-facing versions.
The hub card and feedback toolbar read the same newest-first history. The toolbar displays the
version of the module named in the wrapper. Hub visibility still comes from the rollout stages.
An empty history displays “Version history not yet available.”

To advance a module, propose an explicit entry in a PR and have the module owner approve the
revision and its changelog before merge. Keep the ID of each approved revision stable and never
reuse it. Assign the next sequence for that module. The highest sequence is current, independent
of the display label, entry position, date, commit or deployment. Include a verified release
date only when one is available. Describe concrete changes, give their category, and say whether
they warrant clinical or educational re-review. Leave unrelated modules' entries alone.

Use existing lesson or section IDs. Include a path only if the module's current navigation
supports it. The section link opens a new beta testing tab at that destination with feedback
available, so the current tab keeps its place and any unsent draft. A section link opens the
current module. Historical module snapshots are outside V1. Keep links to the same section ID
consistent across revisions and remove a path when the navigation no longer supports it.

### Establishing module baselines

V1 starts with an empty registry. After the relevant module changes have merged, identify the
content intended for beta testing and record the exact source revision in the baseline PR.
Ask the owner to explicitly approve the module version, changelog, and section links before
adding the entry. Each module can establish its baseline separately.

Internal content versions, simulator builds, review-round labels and deployment dates do not
establish a beta baseline or tell us what an earlier tester saw. A content merge or deployment
alone does not advance the reviewer-facing version.

## Proposed V2 attribution and storage

The attribution contract is **module ID plus immutable revision ID**, with an optional revision
ID for untracked content. The version label is for display. Review form version still identifies
the questionnaire schema.

1. Bind the revision when the reviewer loads the module content. On submit, validate the pair
   server-side against approved revision records and the revision presented in that session.
   Confirm that a wrapper and its same-origin content agree across a rollout. Reports may capture
   a page belonging to a different module than the wrapper, so resolve attribution against the
   captured module and its rendered revision. If attribution is unavailable, store a null
   revision. For stale forms or tabs, retain the draft and either explicitly save against the
   older revision when it is still identifiable or ask the reviewer to reload before starting
   a review of the current revision. An edit must preserve the revision of the review being edited.
2. Mirror approved registry entries into a server-only `module_beta_revisions` table through an
   explicit, idempotent release step. Use `revision_id` as the primary key and unique constraints
   on `(module_id, revision_id)`, `(module_id, sequence)`, and `(module_id, display_version)`.
   Keep referenced revisions and reject changes to their identity or order. Stage registry data
   before clients can submit it. Add nullable `revision_id` to `module_beta_feedback` with an
   indexed composite foreign key `(module_id, revision_id)`. Preserve report IDs, retry
   behavior, and screenshot links. Include revision in any version-aware retry comparison while
   continuing to recognize legacy retries.
3. Keep `module_beta_reviews` and its existing `(user_id, module_id)` upsert for legacy and
   untracked reviews. Add a versioned overall-review table with the same answer, form version,
   profile, and timestamp fields, a non-null revision ID with the composite foreign key, and a
   unique key on `(user_id, module_id, revision_id)`. Index the foreign key for revision queries.
   Upsert the same review within a revision. A review of a new revision creates a new row, leaving
   the earlier review independently editable. Keep service-role-only access, row-level security,
   and the existing account and admin checks. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
   and [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).
4. Add tables and the nullable report column before changing API writes. Leave existing feedback
   and overall reviews in place with unknown revision attribution. Never backfill from report or
   review timestamps, branch history, deployment dates, form versions, or the current revision.
   Return both legacy and versioned rows to the reviewer and admin through the existing authorized
   APIs. Before enabling writes, rehearse the rollout against representative legacy rows, with
   tests for old clients, retries, stale tabs, edits and cross-module IDs. Retain the added rows
   and columns on an application rollback, and make the versioned reviews available again when
   the new application is restored.

When a review references a known older revision and the current sequence is higher, show “You
reviewed v0.2. This module is now v0.3.” Offer separate actions to edit that review and start the
current one. Once the current revision has a review, show it as submitted. For an unversioned
review, show “Overall review submitted · Version not recorded” and keep its edit action. With
both types present, the version comparison uses only a versioned review.

V2 requires separate approval for the schema, staged rollout, and application behavior. Before
that work, reconcile the existing migration history and deployed schema using the documented
beta deployment procedure. See [Development beta testing](module-beta-testing.md#deployment).
