# P92 Codex corrections — final bounded pass on PR #92

Independent Codex review of PR #92 (definition-set retention + F-09) confirmed the
integrated architecture, F-09, historical release resolution, the PR #91 regression
closures, release-impact reporting, card boundaries, the prospective current-main merge,
the full repository gates, and browser behavior — and returned exactly four directly
related findings. This pass closes all four. Reviewed head: `9c80d6e3`; the pass sits on
the ordinary merge of `origin/main` `99ad5991`.

## P92-C1 (HIGH) — a future live alias could reinterpret a historical role

**Reproduction (reviewed head):** add a live alias `APC_APPLICATOR_RIGID →
ENERGY_PLATFORM`, resolve `release-rigid-bronch-v1-0`: resolution reported ok while the
rigid APC applicator's canonical role became `ENERGY_PLATFORM`. The
conservative-extension check guarded retained alias _keys_, not active historical role
codes, and alias application read the live table.

**Correction:** alias application moved onto the release's **resolved** taxonomy.
`BuildContext` carries `roleCodeAliases` as a release-pinned field (enforced by the
context-field classification in `release-bundle.ts`); every canonicalization in the pinned
chain — `rebuild-builder-context`, historical catalog picks, family pins, the rebuild
plan and probe — goes through `roleCanonicalizerFor(context.roleCodeAliases)`. The live
table serves only current-data surfaces (catalog browse, pickers, the client equipment-set
library). `liveTaxonomyExtendsRetained` remains as the governance tripwire: a live table
that _contradicts_ retained content fails resolution typed (`release_pin_missing`) for
every release that retained it. The protected historical role universe — every code
reachable through the release's pinned recipe slots, module slots, modifier-added slots,
rescue modules, compatibility participants, retained aliases, and pinned catalog mappings
— is protected structurally, because release-semantic canonicalization no longer consults
live data at all.

**Proof:** `release-taxonomy-stability.test.ts` (17 tests over the real ledger data):
direct/two-hop/chain captures and per-universe-category captures byte-identical (card and
context digests); contradictions typed for old and new releases; benign alias/category
extensions byte-identical; same-process old→new→old and interleaved resolution stable.
Negative control: restoring live-table application reproduces the exact Codex regression
(`Expected: APC_APPLICATOR_RIGID, Received: ENERGY_PLATFORM`). See
`definition-set-retention.md` §3.6 (rewritten).

## P92-C2 (MEDIUM) — the generator accepted rewritten first-publisher attribution

**Correction:** `runBuildReleaseBundles` phase A now derives the deterministic first
publisher for every ledger entry — publication order is `publishedAt` ascending with the
release id as tiebreak (`comparePublicationOrder`) over the frozen release universe — and
`validateDefinitionSetAttribution` fails the build before any of the ten targets is
written when the recorded attribution is a non-existent, draft, or empty publisher, a
release that does not pin the exact (set id, hash) pair, or any later publisher. The
ledger fold itself now runs in publication order, and duplicate (set, hash) keys in the
raw on-disk ledger are refused before the fold can silently collapse them.
`ip-cards:release:check-base` remains the independent second layer.

**Proof:** ten unit tests in `definition-set-ledger.test.ts` (including the committed
real-data zero-message check) and six literal-CLI probes in
`build-release-bundles.atomicity.test.ts` — every forged case exits 1 with the set id,
hash, recorded and expected publisher named, all ten targets byte-identical under
sentinels, directory listing unchanged; the valid case regenerates canonically and is
idempotent.

## P92-C3 (MEDIUM) — off-mode verification accepted an incomplete robots header

**Correction:** one canonical predicate, `missingRobotsDirectives`, used by both verifier
modes: X-Robots-Tag parsed as a comma-separated directive set (ASCII-trimmed,
case-insensitive, exact `[a-z0-9_-]` words), requiring `noindex` + `nofollow` +
`noarchive`; failures name the missing directive. Adversarial-pass hardenings: a
user-agent-scoped header (`googlebot: …`) stops crediting later tokens (a scoped
directive binds one crawler, not all); non-ASCII whitespace tails are not stripped;
valued directives (`unavailable_after:` etc.) stay accepted; the robots **metadata**
check now requires the same full triple; empty and absent headers are reported
distinctly.

**Proof:** the unit matrix (incomplete/absent/malformed/UA-scoped rejections;
order/case/whitespace/repeat/extra-directive acceptance) and both harness modes against
the real production build: `--mode=off` 22/22, `--mode=on` 64/64.

## P92-C4 (MEDIUM) — identity scanning missed manufacturer + short identities

**Reproduction (reviewed head):** hidden product `PRD-104DF655AD` (Olympus, KV-6 Suction
Pump, catalog/model `KV-6`): a served `Olympus KV-6` produced no leak because the bare
identifier sat under the five-character standalone floor.

**Correction:** `deriveIdentityLeakTokens` derives manufacturer-qualified composites from
every identifier field (catalog, global/reference part, alternate ids) **before** the
standalone floor, with a deterministic hyphen→space variant and NBSP/whitespace
normalization (`normalizeIdentityWhitespace`, applied symmetrically to the served body in
`servedIdentityLeaks`). Each composite runs the same four data-derived exclusions on the
exact composite string — a standalone exclusion never carries over. GTIN fields are not
composed (their 12-digit floor never discards one, so the standalone token already
screens every body). Matching stays deterministic and boundary-guarded: no fuzzing, no
flags inside longer identifier runs, no bridging of separated content.

**Proof:** the Codex reproduction pinned (`<title>Olympus KV-6</title>` → leak); the
data-wide sweep recomputes exactly the **17** real manufacturer + below-floor identifier
pairs and requires each detectable in title/aria/JSON-RSC/punctuation shapes with
embedded-substring negative controls; the exclusion-interaction regression proves
`eu-me3` (public-copy-excluded standalone) still detects as `olympus eu-me3`. The
adversarial pass (Lens D) then hardened the scan further — see below — and the mode-on
harness now screens **3,269** identity tokens across ten scanned bodies with zero leaks.

## Adversarial self-review

Four independent read-only lenses ran before commit, and every reproducible
BLOCKER/HIGH/MEDIUM finding inside this pass's scope was fixed before push:

- **Taxonomy history (Lens A): PASS.** No BLOCKER/HIGH/MEDIUM. Its two LOWs were fixed
  anyway: the stale `liveTaxonomyExtendsRetained` docstring still describing pre-P92-C1
  live-table application (rewritten), and prototype-key hygiene in the canonicalizers
  (`Object.hasOwn` so a stored code like `constructor` canonicalizes to itself).
- **Publication provenance (Lens B): PASS.** Every in-tree forgery refused before any
  write. The one pass-through — a consistent seed `publishedAt` rewrite steering the
  derivation — is the documented self-consistency boundary, and Lens B verified the
  independent second layer (`ip-cards:release:check-base`) fires on it with
  `publication_lifecycle_field_rewritten` violations. Its LOW (raw TypeError on a
  wrong-shape ledger `entries`) got a curated shape guard. The pre-existing, out-of-diff
  observation that check-base is wired into no CI workflow is recorded as a follow-up
  task rather than widened into this pass.
- **Robots safety (Lens C): PASS with one MEDIUM, fixed.** A fully user-agent-scoped
  header (`googlebot: nosnippet, noindex, nofollow, noarchive`) satisfied the directive
  set while binding no other crawler; the predicate now treats an unknown `name:` token
  as a user-agent scope and stops crediting later directives (unscoped directives before
  the scope still count). Its LOWs were fixed too: strict ASCII token validation (a raw
  Latin-1 NBSP tail no longer trims into a credit), the robots **metadata** check now
  requires the full triple, and empty-vs-absent headers report distinctly.
- **Identity leakage (Lens D): findings, all fixed.** HIGH-1: two D1-rendered vocabulary
  sources sat outside every exclusion corpus and collided with derived tokens (a cohort
  `subcategory` equal to a hidden product's name; a governed role `description`
  containing another) — the launch gate passed only by pagination/sort luck. The
  rendered-vocabulary corpus now includes cohort classification terms
  (`subcategory`/`primary_category`/`product_kind`) and role `description`/
  `selection_guidance`, closing both live-demonstrated collisions and the exhaustively
  computed latent inventory (exactly those two). HIGH-2: short distinctive trade names
  ("GSS Y Stent", "RevoLix jr.") had no token at all — `product_name` now composes with
  the manufacturer exactly like the identifier fields ("novatech gss y stent",
  "lisa laser products revolix jr."). MEDIUM-1: the cohort-identity exclusion used plain
  substring containment, so hidden catalog number `10520` vanished because its digits sit
  inside an unrelated cohort GTIN; the containment is now boundary-matched with the same
  predicate as the detection, and the bare catalog-number cell detects again. MEDIUM-2:
  the scan set was widened to the procedures index and the canonical clinical-role page
  (ten scanned bodies; mode-on total now 68 checks). Its LOW (hex `&#xA0;` NBSP entities
  undecoded) was fixed alongside.

## Unchanged in this pass

F-09 clinical text and release ids; clinical procedure content; product data (AERO,
EBUS-processor, Portex, microdebrider rows untouched); clinical-owner fields;
navigation; sitemap; noindex policy; the production feature flag (still off); database
and Supabase state. The duplicate RIGID_BRONCH APC rows remain the documented owner
decision, and the Ultra evidence packet was not ingested.
