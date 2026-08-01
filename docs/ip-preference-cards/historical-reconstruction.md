# Historical reconstruction: catalog, families, hashes, and the protected base

Phase 4A made a saved card's _authored_ dependencies immutable: a release bundle pins the recipe,
the module versions, the modifier set, the rescue modules, the compatibility rules, and the role
table, each by content hash, and refuses to resolve a card whose pins have moved.

Four things were still open, and this is what closed them.

| Open item                       | Closed by                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| Historical catalog retention    | Content-addressed row store + per-release manifests                     |
| Stable product-family identity  | Reviewed, versioned family versions with explicit membership            |
| Snapshot integrity vs semantics | Three hashes with three jobs, plus a print-document hash                |
| Publication immutability        | `npm run ip-cards:release:check-base` against the protected base branch |

---

## 1. Published definitions are append-only relative to `origin/main`

`validateReleaseBundles` recomputes each frozen hash from the definitions in the same tree and
fails when they disagree. That catches an edited definition. It does **not** catch an edited
definition whose frozen hash was updated in the same commit: the tree then agrees with itself,
every suite is green, and the only evidence is a diff nobody read.

Self-consistency cannot detect a consistent rewrite. Only a second copy of what was published can.

```bash
npm run ip-cards:release:check-base
npm run ip-cards:release:check-base -- --base origin/main
npm run ip-cards:release:check-base -- --fixture path/to/fixture
```

The check projects both sides — the merge base of the protected branch, and the working tree —
down to what may not change, and compares:

| Class                                                                   | Behaviour                         |
| ----------------------------------------------------------------------- | --------------------------------- |
| Ids only on this branch                                                 | reported as **new**               |
| Definition hash of a published id                                       | immutable                         |
| Dependencies of a published id (recipe, module pins, set pins, catalog) | immutable                         |
| A published id disappearing                                             | violation                         |
| A `(line, semantic version)` pair reassigned to a different id          | violation                         |
| `releaseState` / `governanceState` moving forward                       | permitted                         |
| `publishedAt` / `retiredAt` / `approvedAt` set once                     | permitted; rewrite is a violation |
| `releaseNotes` / `reviewBasis` revised                                  | permitted                         |
| Current-release pointer moved                                           | permitted                         |

Retirement is metadata: `definitionHash` is outside the lifecycle fields, so retiring a release
cannot alter the historical clinical definition.

**A missing base is a failure, not a pass.** No remote, a shallow clone, a CI checkout that never
fetched — each exits non-zero and says which. A check that silently passes when it cannot look is
a green tick meaning "I verified nothing", and the one commit it would wave through is the one
rewriting a published release on a machine with no remote configured. `--fixture` exists so the
tests never need a remote at all.

### The pre-publication window

Today `origin/main` publishes **none** of the sixteen release bundles, the module ledger, the
catalog manifests, or the reviewed families: all of it was frozen on this branch and none of it has
merged. So every id is reported as new, and re-freezing any of them here is legitimate — nobody can
have a card pinned to a release that has never existed outside a feature branch.

The moment they merge, the same act becomes `publication_definition_mutated`.

---

## 2. Historical catalog retention

`catalogImportId` already hashed the artifacts the resolver reads, so it **detected** a catalog
move. Detecting a move is not being able to reconstruct what was there before it: a product
discontinued and dropped from the workbook took the identity of every saved pick that named it.

```text
catalog row content → canonical row hash → content-addressed immutable row store
catalog release      → manifest of exact row hashes → manifest hash
```

| Artifact                                   |   Size | Contents                                   |
| ------------------------------------------ | -----: | ------------------------------------------ |
| `generated/catalog-rows.json`              | 1.8 MB | 3,289 rows keyed by their own content hash |
| `generated/catalog-release-manifests.json` | 245 KB | one manifest per catalog release           |

The current release retains 1,532 product rows, 135 role rows, and 1,622 product-role rows. The
store is content-addressed, so a second release over an unchanged catalog adds nothing.

`catalogReleaseId` is computed exactly as before — the same digest the sixteen published bundles
already record — so this artifact _addresses_ content under an id that was already in use rather
than replacing it.

### The closure rule

A retained row may only carry values from the three files `catalogReleaseId` is computed over:
`catalog-products.json`, `product-roles.json`, `roles.json`. Anything derived from a fourth input
could change while the id sat still, and one id would then address two different manifests — the
one property a content address may not have. Three things are excluded for exactly this reason:

- **Role aliases** — pinned by the release bundle's `roleTaxonomyPin`.
- **Reviewed governance** (`slottingScope`, lifecycle context, regulatory status) — authored in
  `reviewed/external-review-corrections.json`. It answers a question about _today_, which is the
  right question to keep asking: a device withdrawn to investigational status should stop being
  attachable, not stay attachable because it once was.
- **Reviewed family membership** — a family version records its own catalog release and member
  list; membership is a statement _about_ a release, not a property of a row.
- **Product lineage** — retained only where a source explicitly authored it. No column does, so
  nothing is retained rather than something inferred.

Manufacturer grouping is likewise applied on the way _out_ rather than retained, because the alias
table lives in code (byte-protected by `protected-artifacts.test.ts`) and is not one of the three
inputs.

### The hospital-local boundary

Not retained, and named as data in `HISTORICAL_CATALOG_EXCLUDED_HOSPITAL_LOCAL_FIELDS`:

local approval · current inventory · storage location · preference rank · local item number ·
local description · current room capability · formulary status

Those are _supposed_ to be current. A physician reopening a card should see the requirements they
reviewed and the equipment the room has today; freezing them would pin a card to a shelf that has
since been emptied. None of them appears in the three catalog release inputs at all, which is what
makes the boundary checkable rather than merely stated.

### What reconstruction does now

`rebuildBuilderContext` resolves the pinned catalog release and reads product identity, role
mappings, and compatibility dimensions from it. **Nothing falls back to the current catalog.** A
missing manifest, a missing row, or a row that no longer hashes to what the manifest named is a
typed failure and a view-only card.

The one thing still read from current data is whether reviewed governance now holds a product out
of preference-card selection — see the closure rule above.

---

## 3. Reviewed product families

Two different things had been called a "product family".

**Discovery families** are `manufacturerGroup | familyName | productKind`, where `familyName` falls
back `brand_family` → `subcategory` → product name. Good picker, terrible identity: recomputed from
mutable labels on every request, and it over-merges. Two failures already in the catalog:

- **BD Safe-T-Centesis.** `PIG1260TSP` and `PIG1280TSP` are two sizes of the same PLUS tray, and
  only one carries a subcategory — so the two sizes land in _different_ groupings, and the one that
  fell back to `Thoracentesis Catheter` merges with every other BD thoracentesis catheter including
  the 6 Fr tray.
- **Argyle chest tubes.** Eight straight PVC catheters from 16 Fr to 40 Fr plus a right-angle share
  `subcategory: Surgical Chest Tube` with no `brand_family`. And none records `french_size`, so the
  "line stocked across …" wording a family pick prints would come out empty — a card promising a
  size range it cannot name.

**Reviewed family versions** are the persistable identity:

```ts
{
  ;(productFamilyVersionId,
    productFamilyCode,
    version,
    catalogReleaseId,
    roleCodes,
    displayName,
    memberProductIds,
    governanceState,
    supersedesProductFamilyVersionId,
    reviewBasis,
    definitionHash)
}
```

Membership is explicit, frozen, and hashed. A saved card pins four fields —
`productFamilyVersionId`, `catalogReleaseId`, the definition hash, and the role code — and every
one is re-verified server-side on reconstruction.

### What was seeded, and what was not

`seed/product-families.json` declares **18 approved family versions**, all under the airway-stent
roles (the only roles where `allowsSizeAtProcedure` permits a whole-line selection). Each was
seeded under one documented rule:

> Within the role, the manufacturer's own `brand_family` is authored (never a subcategory or
> product-name fallback), every member shares one `product_kind` and one `coverage` value, and the
> line has at least two members.

Membership is derived once at build time from that authoritative basis and frozen; the seed records
the reviewer's own member count, and a mismatch fails the build rather than letting a reviewed
membership drift. Each `reviewBasis` names the brand family, the role, the shared kind and
coverage, the primary source, and states plainly that the individual devices have not been
re-reviewed device by device.

**Left unreviewed, deliberately:**

| Grouping                                                | Why                                            |
| ------------------------------------------------------- | ---------------------------------------------- |
| Micro-Tech Tracheal Stent @ `AIRWAY_STENT_SEMS_COVERED` | mixes fully- and partially-covered variants    |
| Micro-Tech Y-Shaped Tracheal Stent @ `..._SEMS_COVERED` | mixes fully- and partially-covered variants    |
| VisionAir patient-specific stent service                | one product, a design service, no brand family |
| Everything outside the airway-stent roles               | not persistable at all today                   |

For an unreviewed grouping the picker keeps the line view for browsing, keeps every size
individually selectable, labels the grouping as catalog browsing, and **withholds** the whole-line
action. No custom "size at time of procedure" line is invented in its place.

`governanceState` here is about **family identity**, not clinical endorsement of the devices — a
card built from one still carries its prototype watermark like every other card in this prototype.

### Builder inputs advanced to version 4

| Version | Product lines recorded as         | Editable?                         |
| ------- | --------------------------------- | --------------------------------- |
| 2       | discovery key                     | no (superseded before this phase) |
| 3       | discovery key                     | only when it selected **no** line |
| 4       | reviewed family pin (four fields) | yes                               |

A version-3 card that selected a line gets a typed `legacy_family_identity` failure and stays
viewable, printable, shareable, and duplicable. It is never mapped to a reviewed family — not by
label similarity, not by manufacturer plus role, not by anything. There is no function that turns a
discovery key into a membership, and that absence is the mechanism.

A version-3 card with no family selection is unaffected: the refusal is scoped to the ambiguity
rather than to the version.

The pick id changed with it: `family-version:{id}` (and `family-version-role:{role}:{id}` when one
family version serves two of its roles). The old `family:` and `family-role:` forms stay parseable
so stored snapshots still render, and are never written again.

---

## 4. Three hashes, three questions

One hash was doing two jobs badly. To stop re-saving an unchanged card from churning its identity
it excluded `generatedAt`, so it never detected an edited timestamp; and because it covered every
field including rule-trace prose, a reworded trace message read as a changed card.

| Hash                    | Question                             | Notes                                                             |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `snapshotHash`          | is this the same stored card?        | unchanged in value and computation; what `snapshot_hash` holds    |
| `snapshotIntegrityHash` | has the stored snapshot been edited? | **every** field, including `generatedAt` and the other two hashes |
| `resolvedContentHash`   | does this card say the same thing?   | documented semantic projection                                    |

`snapshotHash` is kept because it is what every already-written row and every share link verifies
against, and because re-saving unchanged content must stay a no-op. It is no longer described as
evidence of what was printed — it is storage identity and nothing more.

`snapshotIntegrityHash` covers the other two, so editing them to agree with a doctored payload is
itself detected.

`resolvedContentHash` includes the release, catalog release, and contract identity, the module
versions, the modifiers, and per item the requirement key, role, effective requiredness, quantity,
conditional state, zone, phase, sequence, open/hold status, selected product and family identity,
suppression, compatibility state, and notes; plus warning codes, severities, and structured source
identities, and readiness. It excludes rule-trace prose, warning message text, display names where
a stable id exists, and `generatedAt` — each recorded with its reason in
`RESOLVED_CONTENT_HASH_EXCLUSIONS`.

Reading old rows is unchanged: a snapshot with no integrity hash verifies against the storage
identity it was written with, and `verifySnapshotIntegrity` returns `null` rather than `false` for
it. Nothing is rewritten on read.

### The printed-document audit

`card_snapshot` was described as the record of what a card said, and the print route renders its
header from the **row**: the heading, the physician, the draft/final badge, and the last-updated
timestamp are all stored in their own columns, all editable by `renameUserCard` without the card
re-resolving, and none of them covered by any hash the card carried.

Rather than fold row metadata into the snapshot — which would make a rename re-resolve a card and
churn its identity — the document gets its own hash:

```
printDocumentHash = H(snapshotIntegrityHash, cardId, title, physicianName, status, updatedAt)
```

Presentation stays out: the print mode (spatial versus chronological groups the same items under
different headings and drops nothing) and the locale (label translations and date formatting for
the same values). A hash that moved when a colleague opened the same card in Spanish would not be
telling anyone anything. It renders in the card header alongside the snapshot hash, and is omitted
on rows written before the split, which have no integrity hash to build one over.

---

## 5. The contract, in one place

`src/features/preference-cards/__tests__/resolver-contract-v1.test.ts` names each guarantee of
`ip-cards-resolver-contract/1` as its own clause: required modules cannot be omitted, unauthorized
modifiers never enter the context, duplicates collapse only when semantically equivalent,
conflicting duplicates block, role equality alone never deduplicates, an exact selection beats
preference ranking, an explicit null stays null, modifier and rescue sequencing are deterministic,
kit suppression is deterministic, unknown compatibility never passes, a required-unresolved
requirement warns rather than blocks, the semantic projection is deterministic, a moved
implementation digest is information, and a true contract mismatch is reported.

The distributed suites remain the detailed tests. This is the human-readable index — if a clause
has to be edited to make the suite pass, the contract moved and the version must move with it.

---

## Commands

```bash
npm run ip-cards:releases              # catalog retention + families + bundles + ledger
npm run ip-cards:release:check-base    # append-only publication check
npm run ip-cards:validate-data         # catalog and taxonomy integrity
```

`ip-cards:releases` writes nothing when any validation fails — a generated file that disagreed with
a failed validation would be a record of the mutation rather than a barrier to it.

## Not in this phase

No card upgrades, no release migration, no reconciliation UI, no "rebuild using current release",
no re-resolution comparison, no version-2 editing, no legacy family guessing, no new clinical
family definitions, no fuzzy matching, and no "latest" release selection. A newer release still
never reaches back into a saved card.
