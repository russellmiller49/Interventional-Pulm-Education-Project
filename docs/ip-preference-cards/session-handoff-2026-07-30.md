# IP preference cards — session handoff, 2026-07-30 (taxonomy v2)

Supersedes [`session-handoff-2026-07-27.md`](./session-handoff-2026-07-27.md), which remains
accurate for everything before this milestone — read it for the GUDID pipeline, the
tracheostomy transcription traps, the Olympus distribution exception, and the beta-access
model. None of that changed.

Branch: `claude/preference-cards-taxonomy-v2`, cut from `origin/main` at `d87b7e03`.

## What this milestone did

Six things, in dependency order. Each is a separate concern and each is independently
testable, but they ship together because M4 needs M2's role names and M5/M6 need M1's
mechanism.

### M1 — a governed way to add procedures and slots

`Procedures`, `Procedure_Slots`, and `Slot_Product_Options` used to come **only** from the
protected workbook. `seed/catalog-additions.json` could add products but not slots, and the
reviewed overlays could retarget a slot's role but never create one. Editing the xlsx would
have moved the protected workbook hash, invalidated the `sourceWorkbookSha256` binding inside
the completed-review artifact, and buried the rationale inside a binary.

`scripts/ip-preference-cards/apply-procedure-additions.ts` reads
`data/ip-preference-cards/reviewed/procedure-additions.json` and applies it in **two phases**,
which is the one design decision here worth understanding:

- `applyProcedureAdditionRoles` runs **before** the product merge. Vocabulary has to exist
  before content references it — `catalog-additions.json` maps products onto roles and is
  merged earlier, so a role introduced alongside the slot that needs it would not yet exist
  when the product merge validates against it.
- `applyProcedureAdditions` runs **after** the product merge, so a slot option can reference an
  added product, and **before** the reviewed overlays, so a review correction can still
  retarget anything added here.

Every rule is a hard import error, never a silent skip: colliding code, non-deterministic slot
id, unknown role, unknown procedure, unknown product, slot/option role mismatch, product
lacking the role, unmapped section, reused display order within a procedure, a procedure absent
from every `procedureGroups` entry, and a missing `reason` on any row. Sixteen rejection paths
are pinned in `apply-procedure-additions.test.ts`.

Slot ids are `stableId('SLOT', natural_key)` and the file must carry both, so a rerun is
idempotent by construction and a hand-edited id fails rather than forking.

### M2 — taxonomy v2

`src/features/preference-cards/domain/role-taxonomy.ts` is the single reviewed source for the
browse vocabulary and the role-code aliases.
`scripts/ip-preference-cards/apply-role-taxonomy.ts` canonicalizes the workbook's own rows
against it, and `assertCanonicalRoleTaxonomy` re-asserts over the final data after every
overlay has had its turn.

**33 free-text headings → a closed 19-heading vocabulary, all 19 in use.** Eight role
codes renamed:

| Was                       | Now                             |
| ------------------------- | ------------------------------- |
| `PLEUROSCOPE`             | `THORACOSCOPE_SEMIRIGID`        |
| `THORACOSCOPY_TELESCOPE`  | `THORACOSCOPE_RIGID`            |
| `PLEUROSCOPY_TROCAR`      | `THORACOSCOPY_TROCAR`           |
| `PLEURAL_BIOPSY_FORCEPS`  | `THORACOSCOPY_BIOPSY_FORCEPS`   |
| `PDT_KIT`                 | `PERC_TRACH_KIT`                |
| `GENERIC_ENERGY_PLATFORM` | `ENERGY_PLATFORM`               |
| `GENERIC_COLLATERAL_VENT` | `COLLATERAL_VENTILATION_SYSTEM` |
| `GENERIC_WLL_LAVAGE`      | `WLL_LAVAGE_CIRCUIT`            |

`GENERIC_WLL_LAVAGE` was left as "decomposed in M5" in the plan. Renaming it is what made the
decomposition possible without deleting a workbook row: the existing slot keeps its identity
and label as the lavage circuit, and four new named slots sit beside it.

**The aliases are permanent and must never be dropped.** `builder_inputs` stores `roleCode`
strings and family item ids embed the role as `family-role:{role}:{key}`, so a pre-rename saved
card still asks for the old code. `resolveCatalogPick` and `getFamilyPick` canonicalize on the
way in and return the new code, so re-saving migrates the card quietly. An alias never appears
in facets, in search, on the browse page, or in a rebuilt pick — pinned in
`role-taxonomy.test.ts`.

### M3 — regulatory status as its own axis

`RegulatoryStatus` on `ProductGovernanceRecord`, authored in the reviewed `productGovernance`
overlay, decorated in `decorateProduct` — the same workbook-free path the Olympus installed-base
governance already used, so no protected hash moves for it.

`productGovernance` now holds **two kinds** of record, and they are validated separately by the
same discriminator the applicator and the workbook exporter both use: an installed-base entry
names the exact slots it unlocks, a regulatory record names none. If you add a third kind,
extend that branch rather than widening the shared rule.

`/preference-cards/emerging` renders the breakthrough-designated cohort grouped by therapeutic
theme, linked from the catalog page. Those products take `slottingScope: 'not_applicable'`,
which excludes them from `searchProductsForRole`, `searchProductFamiliesForRole`,
`getUseDetail`, `getUseIndex` counts, `getFamilyPick`, and `resolveCatalogPick` — the last one
returns a new `product_not_slottable` code and is the wall that actually matters, because it is
the only one an untrusted save-time caller cannot route around.

The distinction the module has to keep: **only Zephyr has documented US marketing
authorization**, and it stays a normal selectable product that simply gains its PMA notation.
The Galvanize Aliya line is 510(k) cleared _for surgical ablation of soft tissue_, and its own
manufacturer does not promote an airway indication — so it is a normal catalog product whose
regulatory note says exactly that, not an emerging device.

### M4 — the missing platforms (F-02 and F-03 closed)

53 products across `scripts/ip-preference-cards/catalog-additions-taxonomy-v2.ts`, in three
evidence classes handled differently on purpose:

1. **GUDID-backed** — ERBE VIO 3 `10160-000`, APC 3 `10135-000`, both VIO 3 footswitches,
   Chartis `CHR-CA-12.0` / `CHR-CA-15.0` / `CHR-CO-100` / `CHR-CO-300`. Visible and verified.
2. **Manufacturer-documented but not UDI-listed** — the nine Richard Wolf mini-thoracoscopy
   items the workbook lacked (including the hook and coagulation electrodes), the Karl Storz
   optical dissection electrode, three mobile C-arms, LungVision, and the Aliya line. Hidden,
   candidate-grade, with an `availability_note` naming the missing record.
3. **Tier-4 secondary research only** — eight photodynamic items and six breakthrough devices.
   Same handling plus a source whose use policy forbids promotion from it alone.

The laser cohort started here as class 3 and was rebuilt from primary sources — see below.

### M5 — new roles and slots

19 new roles and 59 new slots. Laser (console / fibre / safety equipment) on `RIGID_BRONCH` and
`THERAPEUTIC_BRONCH`; procedural imaging (C-arm / tomosynthesis navigation / radiation
protection) on four procedures; the thoracoscopy electrode and its generator on
`MED_THORACOSCOPY`, which had no energy requirement at all; and whole lung lavage decomposed
from one opaque line into warmed saline supply, lavage circuit, fluid warmer, chest percussion,
and graduated effluent collection.

### M6 — two new procedures

`PHOTODYNAMIC_THERAPY` (12 slots across three staged sections — photosensitizer, light
activation, debridement) and `BRONCH_ABLATION` (22 slots). The ablation card carries real cryo,
APC, and laser content, and names microwave and pulsed electric field as `conditional` slots
with **no selectable product**, pointing at the emerging view. That is deliberate: a card
implying an investigational catheter is stocked would be worse than one that says the modality
exists and is not yet available.

## Counts

| Measure                          | Before | After |
| -------------------------------- | -----: | ----: |
| Catalog products                 |  1,474 | 1,526 |
| Roles                            |    116 |   135 |
| Browse headings in use           |     33 |    19 |
| Procedures                       |     13 |    15 |
| Procedure slots                  |    174 |   233 |
| Authored canonical slot options  |  2,073 | 2,073 |
| Unreviewed slot-option proposals |    429 |   795 |
| Roles with no catalog products   |      9 |    11 |

Authored options are flat because no exact slot option was authored for a new slot. An option
is a clinician-reviewed statement that a specific product belongs in a specific slot, and none
of these slots has been through that review — so the proposal generator surfaces non-selectable
candidates instead, which is the governed path.

`rolesWithoutCatalogProducts` went 9 → 11 rather than shrinking: M4 filled four previously empty
roles (`ENERGY_PLATFORM`, `COLLATERAL_VENTILATION_SYSTEM`, and both new thoracoscopy roles) and
M5 introduced six intentionally empty ones — the four whole-lung-lavage roles and
`RADIATION_PROTECTION` are hospital-local by design and resolve as custom lines, and
`PULSED_FIELD_ABLATION_CATHETER` holds only the INUMI needle. Net +2.

## Deliberate judgment calls

Worth knowing about, because a reasonable reviewer might have chosen differently:

- **The VIO CART and its fastening sets are not products.** `20180-000`, `20180-140/143/144`
  are printed in the VIO 3 brochure but have no FDA UDI record. The in-commercial-distribution
  rule that excludes the FUJIFILM EB-530XT applies to accessories too. The VIO 3 row's `notes`
  record where they went, so the gap is documented rather than silent.
- **`CHR-CA-12.0-XL` is not a product**, for the same reason — the IFU specifies it at a 76 cm
  working length, the UDI database does not carry it. Noted on the standard catheter.
- **The nine VIO 3 instrument cables were already in the catalog.** The plan expected them to
  be new; they are workbook rows under `ENERGY_CABLE_ADAPTER`. The generator was the missing
  row, not the cables.
- **`ENERGY_CABLE_ADAPTER` stayed under Therapeutic bronchoscopy** rather than moving to Energy
  platforms, following the plan's category table literally. Defensible either way — an ERBE
  connecting cable is a therapeutic-bronchoscopy consumable in the room — and it is a one-line
  change in `LEGACY_ROLE_CATEGORY_MAP` if you disagree.
- **Urology and stone laser platforms are excluded.** The research report names 56 laser items
  across every specialty; GreenLight XPS, RevoLix, Lumenis VersaPulse and the lithotripsy fibre
  families are deliberately absent, the same call the Auris `MUR-*` ureteroscopy SKUs got.
- **Three emerging devices carry no role.** dNerva, RejuvenAir, and NIO answer no requirement
  the module has. Inventing a role to hold them would be worse than leaving them role-less on
  the emerging view.
- **The Boston Scientific / Cook "Captura Pro" forceps were not added.** The supplied document
  (`ESC-D63441-EN-F`) has a Boston Scientific document number but names Cook Medical as the
  manufacturer, and no milestone in the plan consumes it. Resolve the attribution before
  adding those 32 SKUs.

## The laser section, rebuilt from primary sources

The first pass built the laser cohort from a Tier-4 research report, because that was the only
laser evidence on hand. Four clinical sources and a 43-document IFU/brochure folder then
arrived, and the section was rebuilt on them. This is worth reading as a worked example of the
selection rule, because a surgical-laser folder is mostly other people's specialties.

**The rule, applied to all 43 documents:** a laser device is listed only when its own labeling
names airway, bronchoscopic, or pulmonary use, **and** the wavelength and delivery form match
what the airway literature actually describes. Both halves are required. A long specialty list
that happens to contain "pulmonology" counts; a marketing line contradicted by the same page's
own specialty table does not.

### What went in (18 products, 8 new Tier-1 sources)

| Device                                                | Why                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| OmniGuide BeamPath CO2 Mark III waveguide fibre       | 510(k) K070157 — the only document in the set whose FDA **Indications for Use literally name pulmonology**                 |
| OmniGuide BeamPath FELS-25A console with IntelliGuide | Manual instructs on airway use directly: laser-safe tracheotomy tube, O₂ ≤30% while firing, "not below the carina"         |
| OmniGuide VELOCITY fibre (`332005`)                   | Publishes airway-specific settings — paediatric airway 30 psi at ≤10 W, adult glottic/subglottic 50 psi, O₂ ≤25%           |
| OmniGuide Gas Filter Unit (`ACC-GFU-100`)             | Required accessory for sterile-field gas delivery                                                                          |
| biolitec LEONARDO DUAL 45 and DUAL 200                | Brochure names "Lung metastases and bronchial tumors"; 980/1470 nm are exactly the two diode rows the literature tabulates |
| Quanta Opera EVO                                      | Dedicated Thoracic Surgery panel naming "Endoscopic airway treatment" and airway obstruction debulking                     |
| LISA RevoLix jr.                                      | Explicit "Pneumology: Bronchoscopy / Airway recanalization / Desobstruction / Tissue coagulation" block                    |
| LISA SureFib-SU, FlexiFib-SU, PercuFib-SU, RigiFib-SU | The fibres brochure's application matrix **ticks Bronchoscopy** for exactly these four families                            |

Six of the twelve clear both the manufacturer-document bar and an FDA UDI in-commercial-
distribution record, so they are **visible and verified** rather than hidden candidates — the
first laser products in the catalog to be selectable.

### The ForTec mobile-service line — and the reversal that produced it

The first pass **excluded** ForTec Medical: its KTP/Nd:YAG sheet named no airway use, so by the
rule it failed. That was wrong, and the thing that corrected it was ForTec's own site
structure — the company catalogues an **Interventional Pulmonology** product line, and the
vendor categorization is itself the airway claim the sheets do not make.

This matters more than one vendor. ForTec is a mobile service: a hospital books the console and
the technologist for the case rather than buying the platform. With Nd:YAG availability in the
United States now limited, that is how most centres reach Nd:YAG, KTP, and Ho:YAG at all — so
excluding mobile service had quietly excluded three of the wavelengths the literature leans on
hardest. Six products went in:

| Device                       | Medium       | What its own paperwork says                                                                                                                                                          |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **KTP/YAG Laser System**     | KTP + Nd:YAG | KTP 532 nm at 50 mW–36 W, Nd:YAG 1064 nm at 5–100 W. **The supplied clearance, K972575, is BPH only**, and the sheet's specialty list omits pulmonology                              |
| **Quanta Holmium**           | Ho:YAG       | 2100 nm at 35/60/100 W, penetration 0.3–0.4 mm. Sheet names no airway indication                                                                                                     |
| **neoV Laser**               | Diode        | 1470 nm CW/pulsed at 12 W. The **only** console in the whole set whose own page is written for bronchoscopy — "for pulmonology procedures", under a "Bronchoscopy Treatment" heading |
| **EVOLVE 180**               | Diode        | 980 nm to 180 W. Sheet describes **prostate vaporization only**; the airway literature runs 980 nm at about 20 W                                                                     |
| **Excalibur holmium fibre**  | Ho:YAG       | The page states it "can be used in inter. pulmonlogy procedures" (typo theirs). Sheath recesses the tip so it never touches the working channel                                      |
| **SmartScope holmium fibre** | Ho:YAG       | 272/365/550/1000 µm, sterile single-use. The page's pulmonary claim attaches to the Excalibur, not to this one                                                                       |

All six are candidate-grade and hidden. A rental catalog page is good evidence a device can be
_got_, and weak evidence of what it is cleared to _do_ — and every entry records exactly how far
its own paperwork goes, including the two places where the sheet describes a different organ
entirely. K972575 is registered as its own source precisely so the BPH-only boundary is
citable rather than a matter of memory.

ForTec also offers OmniGuide CO2 under the same line; that is noted on the FELS-25A console
rather than duplicated, since it is the same platform.

The laser cohort is now **18 products across six media** — CO2, diode, Ho:YAG, KTP + Nd:YAG,
thulium, and thulium + erbium — and the earlier note that no Nd:YAG or KTP source existed is
retired.

### What stayed out, and why

- **A.R.C. Laser FOX** — _was in the previous cohort._ A.R.C.'s own sheets are "devoted to
  lasers in ENT"; the printed applications are turbinate, polyp, septum, epistaxis, snoring,
  stapedotomy, myringotomy, DCR, tonsil. No supplied A.R.C. document names an airway
  application. A.R.C. does build the CO2 engine inside the OmniGuide IntelliGuide console — the
  company is in the airway chain, under someone else's label.
- **OmniGuide OTO-S and OTO-M fibres** — _also in the previous cohort._ Their cleared
  Indications for Use enumerate twelve specialties and pulmonology is not among them.
- **Lumenis VersaPulse / Boston Scientific Pulse 30H and 120H** — the only pulmonary word is one
  marketing line, which the bulleted specialty list on the same page omits.
- **LISA Sphinx and Sphinx Jr., LithoFib, SideFib, the 800 and 1000 µm RigiFib sizes,
  FlexGuard, RexScope/Telex; Quanta Litho 60, Cyber TM, Discovery Pico; Olympus Empower;
  OmniGuide Elevate ENT and BP-Robotic** — lithotripsy, BPH, ENT, and aesthetics.
- **The ForTec KTP/Nd:YAG mobile-service sheet** — the only KTP _and_ Nd:YAG source in the
  folder, and Nd:YAG is the wavelength the literature leans on hardest. But it is a rental
  offering with no manufacturer, no model number, and a specialty list that names no airway use.
  That US Nd:YAG access now runs largely through mobile service is recorded in the
  `LASER_CONSOLE` guidance instead, where it belongs.
- **biolitec LEONARDO DUAL 100** — printed in the brochure, no FDA UDI record. Same rule that
  excluded the Chartis XL. The Tier-4 report had claimed a "DUAL 45/100" pair; the real
  UDI-listed pair is 45 and 200.
- **biolitec Leonardo Duster fibres** — their own UDI text lists "urology, lithotripsy,
  gastroenterological surgery and gynecological surgery". Right manufacturer, wrong fibre.

### Lasing medium as a comparable column

`laser_type` is a new spec column, so the browse and comparison tables show the medium beside
each console and fibre rather than leaving the reader to know that LEONARDO means diode. It is
recorded **only where a source states it**, never inferred from a wavelength — the reader who
needs this column is exactly the reader who cannot make that inference:

| Medium           | Devices                      | Where it comes from                                                                                                                         |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CO2              | FELS-25A, VELOCITY, Mark III | Stated throughout the OmniGuide IFUs and the 510(k)                                                                                         |
| Diode            | LEONARDO DUAL 45 and 200     | "This highly compact diode laser… 980 nm and 1470 nm"                                                                                       |
| Thulium          | RevoLix jr.                  | "Your Table top surgical Thulium laser", continuous-wave DPSS                                                                               |
| Thulium + erbium | Opera EVO                    | The spec table gives only 1.9 µm + 1.5 µm; the medium comes from the brochure's own citations, which name "the Thulium/Erbium laser system" |
| _(blank)_        | The four LISA bare fibres    | A bare quartz fibre has no medium of its own and the brochure states no wavelength for any of them                                          |

All six media the airway literature tabulates in usable form are now represented. The three
that arrive only through mobile service — Nd:YAG, KTP, and Ho:YAG — are labelled as such in the
`LASER_CONSOLE` guidance, because how a device reaches the room is part of planning for it.

Adding the column surfaced a latent bug: `RoleComparisonTable` and `ProductFamilyTable` each
carry their own copy of the spec-reader switch, mirroring `specValue()` in `server/catalog.ts`
(which cannot be imported into a client component — it sits beside the statically-imported
catalog JSON). Both fell through to `null` on the new column, and `ProductFamilyTable` had been
silently dropping `material` and `coverage` the same way for as long as they have existed.
Both switches are now exhaustive over `SpecColumnKey`, so the next spec column is a compile
error rather than a column of em-dashes.

### Guidance and a fifth role

The role and slot text now carries real numbers from the literature rather than one power
range: the wavelength/penetration/power matrix (Nd:YAG 1064 nm, 5–15 mm, 20–40 W through CO₂
10,600 nm, <1 mm, 4–8 W), power density as distance-and-watts, contact versus non-contact, and
**Mehta's rule of 4** on the console slot. `LASER_RESISTANT_ETT` is a new role, because the
literature is explicit that a standard endotracheal tube should not be in the airway during
laser work and nothing recorded the alternative. It resolves as a custom line — no
laser-resistant tube document was supplied.

Where sources disagree, the module records the disagreement rather than averaging: Nd:YAG
penetration is 5–15 mm per Podder and Murgu, "up to 10 mm" per UpToDate, and the depth column
in the _J Thorac Dis_ table reads 0.5–1.5 mm, which contradicts that paper's own body text.
The 5–15 mm figure is the one carried.

## Found by an adversarial review pass, after the suite was already green

Four defects a passing test suite did not catch. Worth reading, because each is a shape that
will recur:

- **The regulatory badge was wired nowhere.** The labels were threaded to all nine call sites
  but the `regulatoryStatus` prop was never passed, so the badge rendered only on the emerging
  page — dead code everywhere else, and no test noticed because every test asserted on the
  labels. All seven per-product sites now pass it, and both family-summary rows show a
  unanimous value under the same rule distribution evidence already uses: a record for one size
  is not a claim about its siblings.
- **Equipment sets never canonicalized their stored role codes.** Sets live in `localStorage`
  and long outlive a rename. The _save_ path resolved aliases (it goes through
  `resolveCatalogPick`), but the _preview_ compared `member.roleCode` against the slot directly
  — so a pre-rename set would have previewed as covering nothing while saving fine. Divergence
  between preview and saved output is the exact failure this module is built to avoid.
  `parseStoredEquipmentSets` now canonicalizes members and `additionalCoveredRoles` on read.
- **The photodynamic light-protection slot was mapped to `GENERIC_PPE`** — staff personal
  protective equipment. A hospital's bronchoscopy PPE pack would have resolved a requirement
  that is actually about patient photosensitivity precautions. The precaution was already on
  the photosensitizer slot's notes, so the slot was both mis-roled and redundant; it is gone
  and the note is fuller.
- **"Named but unfillable" was not actually unfillable.** The microwave and pulsed-field slots
  had `allow_custom: true`, so someone could type "microwave catheter" into a free-text line
  that then prints on a pull list a technologist reads as stock on hand. Both are now
  `allow_custom: false`.

The review also confirmed the wall around the breakthrough cohort holds at every entry point,
and that `preferenceOverlays` — the one place a role code is compared without canonicalizing —
is always empty in production and only populated by tests.

## Traps that cost real time here

**The self-referential dedupe trap, again.** `catalog-products.json` is the _merged_ output, so
by the second run it already contains this generator's own additions. Skipping on "is this key
present?" drops every row on run two and re-adds it on run three — `git status` looks clean
because it compares against the last commit, not the previous run. The fix is the Olympus one:
ids are deterministic from the natural key, so compare the existing `product_id` against the one
you _would_ generate and emit anyway when they match. **Any future "already present?" check
against generated output needs the same care.** It was caught only by hashing the generated
files, re-running the whole pipeline, and hashing again.

**`proposalCorrectionsSha256` must be recomputed after the last edit to the corrections file.**
It is `sha256(JSON.stringify(parsedCorrections))` — the round-trip hash, not the file's bytes.
Rebinding it mid-edit produces a value that looks correct and silently stops identifying the
artifact it pins. Both this binding and `normalizedCorrectionsSha256` are now
`589bd1488027c570dbc674605c8a8cd1b1b7744c348afcf1a22d2b7b707a18d9`.

**`familyKey` splits on `product_kind`.** Filing the Chartis catheters and consoles under one
"Chartis Pulmonary Assessment System" brand family renders as two identical-looking rows.
Functional family names — `Chartis Catheter`, `Chartis Console`, `LungVision Platform`,
`LungVision Procedure Kit` — are the same fix Monarch and Galaxy needed, and
`energy-platforms.test.ts` pins family-name uniqueness across all nine new roles so it cannot
regress silently.

**The exact-slot review round trip had a hard 500-row cap** while the export now produces 798
rows, so the module's own output was rejected by its own importer. `MAX_REVIEW_IMPORT_ROWS` is
now 2,000. If the proposal set grows again, check this first.

**`build-catalog-additions.ts` calls `main()` at module load**, so it can never be a source of
shared helpers. `stableId` moved to `catalog-utils.ts` and `buildProductRecord` to
`catalog-addition-records.ts` for exactly that reason.

**A new axis on a shared record needs every consumer checked, not just the writer.** Adding
`regulatoryStatus` to `ProductGovernanceRecord` also widened what `productGovernance` means,
which broke a hardcoded invariant in the workbook exporter that assumed the table held only the
Olympus installed-base cohort. Grep for every reader of a table before changing what it can
contain.

**Ordering in `import-catalog.ts` matters and is not obvious.** Role taxonomy runs on the
workbook's own rows _before_ anything authored is merged, so every seed and overlay file can be
written against the reviewed vocabulary alone — and an addition that still names a retired role
fails the merge rather than being quietly canonicalized after the fact.

## Verification performed

```bash
npm run ip-cards:additions && npm run ip-cards:import && npm run ip-cards:coverage \
  && npm run ip-cards:scenarios && npm run ip-cards:validate-data && npm run ip-cards:seed
```

```bash
npx jest scripts/ip-preference-cards src/features/preference-cards src/i18n/translations.test.ts --runInBand
```

552 passing, 1 intentionally skipped (the live-OpenFDA integration test). `npm run type-check`
clean. `npm run lint` reports 0 errors and 18 warnings, all outside this module and unchanged
from the previous handoff's baseline. `npm run build` clean, and
`.next/server/app/[locale]/preference-cards/emerging` is in the output.

**Idempotence verified the way that actually catches drift**: hash all 21 generated files,
re-run the full pipeline, hash again — byte-identical. This is what caught the dedupe bug;
`git status` alone would not have.

### Browser walkthrough

Done on `npm run dev:claude` (port 3120), and it is what found the last two defects above:

- `/en/preference-cards/catalog/uses` — 19 headings in reviewed clinical order, not 33
  alphabetical ones, with both new procedures in the filter.
- `/en/preference-cards/catalog/uses/PLEUROSCOPE` — redirects to `THORACOSCOPE_SEMIRIGID`. An
  alias resolves but is never an address the module owns.
- `/en/preference-cards/catalog/uses/ENERGY_PLATFORM` — VIO 3 and APC 3, both verified, used
  by four procedures.
- `/en/preference-cards/emerging` — all six devices, grouped by theme, each naming its Tier-4
  evidence and carrying the excluded-by-design notice.
- `/en/preference-cards/new?scenario=bronch-ablation` — the microwave and pulsed-field slots
  render as conditional and unresolved with nothing selectable.
- `GET /api/preference-cards/catalog-search?role=MICROWAVE_ABLATION_CATHETER` → `{"options":[]}`.

## Not done

- **F-04 and F-05 remain deferred**, still for lack of evidence. F-04 needs an ERBECRYO 2
  console document — the UDI release does carry `20402-000`, so it is one manufacturer document
  away from closing. F-05 needs airway electrocautery snare evidence; the Steris catalog's
  snares are GI cold snares.
- **The es and zh-CN bundles carry English strings** for every new key, matching the existing
  convention for the whole `preferenceCards` namespace. Real translation is still a separate
  pass.
- **No clinician review of the new slots.** All 57 are draft, and the two new procedures are
  `Draft - clinician review required` like the other thirteen. The ablation and photodynamic
  cards in particular encode staging and modality choices that should be read by someone who
  does these procedures.
