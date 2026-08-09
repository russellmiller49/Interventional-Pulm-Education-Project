# Phase D1 — owner review findings

Reviewer role: interventional pulmonology business manager (device/procedure domain).
Date: 2026-08-09. Subject: draft PR #88, branch `claude/device-intelligence-vertical-slice`.

**Method and its limits.** This is a source-and-data review, not a live browser walkthrough. I read
the four packet documents, every D1 route and component, the composed procedure data
(`procedure-compositions.json`, `recipe-modules.json`, `procedure-slots.json`,
`section-zone-phase-map.json`), the operational seed (`operational.ts`), the catalog cohort
(753 products), the role table (135 roles), the audit (`data-readiness-audit.json`), and the D1
test assertions. I could not execute the suite in this environment (native module arch mismatch),
so I verified behaviour by reading the code paths and the tests' own expectations rather than by
running them. Every quantitative claim below is computed from the repository data and is
reproducible. Viewport notes are inferred from the Tailwind breakpoints in the markup and are
flagged as such.

**Framing.** `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE` is unset in production, so nothing here is a
live patient-safety exposure today. I have therefore read "Blocker before merge" as **"must be
fixed before this is shown to any clinician, fellow, nurse, or vendor"** rather than "must be fixed
before the branch lands." If your intent is to land the scaffolding behind the flag and iterate,
both blockers below become Important and nothing else changes.

---

## 1. Owner dispositions

| Surface                          | Disposition                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Device index                     | **ACCEPT**                                                                                                   |
| Device detail                    | **MODIFY** — the two lead cards are majority "not recorded"; no functional orientation                       |
| Clinical-role page               | **MODIFY** — products above availability status; "selection guidance" framing overstates 75% of the corpus   |
| Procedure index                  | **ACCEPT**                                                                                                   |
| EBUS workspace                   | **MODIFY** — phase ordering inverted; sampling instruments zoned to the specimen station                     |
| Therapeutic workspace            | **MODIFY** — 17 of 26 modifier cards are inert while promising safety capability                             |
| Chest-tube workspace             | **MODIFY** — kit suppression invisible; IPC content dominates; drainage unit phased post-procedure           |
| Demo readiness                   | **MODIFY** — "Ready" chip can be read alone; otherwise the strongest surface in the slice                    |
| Output previews                  | **MODIFY** — 3 genuinely distinct, 1 correct link, 1 duplicate partition until `responsibleRole` is authored |
| **Overall D1 product direction** | **ACCEPT**                                                                                                   |

**On overall direction.** Accept, without reservation on the architecture or the safety posture. The
governance model — evidence axes never collapsed, proposals never coverage, demo never institution,
authored text never paraphrased, every diagnostic carrying its source id — is better than most
commercial device-intelligence products I have evaluated, and the restraint (no second resolver, no
compare view, no procurement claims) is the right call. What needs modification is almost entirely
**presentation of the authored data and the honest handling of what the data does not yet contain**.
The one strategic caution is in §7.

---

## 2. Blockers

### F-01 — Inert modifiers are rendered under "and their effects" with capability-promising copy

```
Route:      /en/procedures/THERAPEUTIC_BRONCH (also EBUS_TBNA, CHEST_TUBE)
Viewport:   all
Category:   Safety/evidence; Copy/terminology
```

**Observation:** The section is headed "Allowed modifiers and their effects." On
THERAPEUTIC_BRONCH it renders 26 modifier cards, of which **17 have `actions: []`** and produce no
structural effect whatsoever. Each still renders a full description sentence taken from
`modifier-definitions.json`:

- `LASER` — "Laser console/fiber, eyewear/signage, smoke evacuation, fire safety, credential/readiness prompt — Room credential and readiness rule"
- `ELECTROCAUTERY` — "Generator, probe/knife/snare/forceps, cable/adapters, return electrode if required, fire prompts"
- `CRYOTHERAPY` — "Cryosurgery unit, gas, footswitch, probe, adapters, thaw/specimen workflow — Typed platform compatibility"

The only difference between these and `APC` (which really does add six requirements including
`LOCAL_AIRWAY_FIRE_READINESS`) is that the effects `<ul>` renders empty. No label, no
"informational only" marker, no `releaseState` shown — `LASER` is `phase_1_1` and
`PLEURAL_MANOMETRY` is `phase_2`, and neither release state reaches the page.

Counts: EBUS_TBNA 13 cards / 10 inert; THERAPEUTIC_BRONCH 26 / 17 inert; CHEST_TUBE 11 / 7 inert.
On EBUS the inert set includes `ANES_GENERAL`, `ANES_MOD_SED`, `AIRWAY_ETT`, `AIRWAY_LMA` — the four
choices that most change an actual EBUS room setup.

This is the direct answer to your question _"Laser and imaging gaps are not accidentally presented
as available options."_ In the coverage ladder and the requirement browser, correctly handled. In
the modifier panel, **no** — a reader is told in plain prose that selecting Laser brings eyewear,
signage, smoke evacuation and fire safety, and nothing happens.

**Expected behavior:** Split the section, or badge each card. Minimum viable fix: an
`Informational — no structural effect in this release` badge on any modifier with zero actions, the
`releaseState` rendered beside the code, and the section subtitle changed to name the split
("9 of 26 allowed modifiers change the requirement list in this release"). Ideally move the inert
ones behind a disclosure so the acting nine are the page.

**Priority:** Blocker before merge.

---

### F-02 — Kit-suppressed requirements are computed, tested as "never silently dropped," and never rendered

```
Route:      /en/procedures/CHEST_TUBE?output=room (and ?output=nursing, ?output=training)
Viewport:   all
Category:   Data problem surfaced as a UI omission; Clinical content
```

**Observation:** `outputs.server.ts` computes `suppressedItems` with `{ itemId, label, roleCode,
rationale }`, and `outputs.test.ts` asserts it contains `LOCAL_CHEST_TUBE_SECUREMENT` under the test
name _"shows the BOM-suppressed requirement in the suppressed list, never silently dropped."_
`OutputsPanel.tsx` never reads the field. Grep confirms `suppressedItems` appears only in
`outputs.server.ts` and two test files.

Consequence on the chest-tube page with its default modifiers (`TECH_CHEST_TUBE_SMALL_BORE`,
`DIGITAL_DRAINAGE`): the securement/dressing pack that the small-bore kit BOM already contains
vanishes from Room setup, Nursing and Training with no explanation — while _the separate_
`DRESSING_SECUREMENT` role sits on the readiness page in red as the single reason CHEST_TUBE is
`not_ready`. Two adjacent presentations of the same clinical concept, one invisible and one alarming,
with nothing connecting them.

You listed "Kit-content suppression is understandable" as a review criterion. As built it is not
observable at all.

**Expected behavior:** Render a "Included in a selected kit — not listed separately" group in the
Room setup and Nursing previews, quoting `rationale` and naming the kit. Cheap: the data is already
shaped for it.

**Priority:** Blocker before merge.

---

## 3. Procedure workspaces

### F-03 — "By procedural phase" is ordered by first appearance in setup sequence, not by phase

```
Route:      /en/procedures/{code}?view=phases ; also ?output=training and ?output=nursing
Viewport:   all
Category:   Clinical content; Information architecture
```

**Observation:** `procedures.server.ts` builds `proceduralPhaseOrder` with `orderedDistinct(...)`
over requirements in authored order, and `outputs.server.ts` `groupBy` preserves first-appearance
order. Neither uses the canonical phase sequence that the message catalogue already declares.
Computed group order:

- **EBUS_TBNA:** Pre-room → Diagnostic → Specimen handling → **Pre-induction / sedation**
- **THERAPEUTIC_BRONCH:** Pre-room → **Therapeutic** → Pre-induction / sedation → Specimen handling → **Airway access** → Post-procedure

Airway access appears fifth on the therapeutic workspace, after therapeutic intervention and
specimen handling. Pre-induction is last on EBUS. This is the tab labelled "By procedural phase,"
and the Training preview (`outputs.training`) uses the same grouping — so the view sold as the
teaching artefact teaches an inverted procedure. The code comment on `training` even claims
"requirements in procedural-phase order," which is not what it does.

The "By setup zone" view is fine, because zone order carries no chronology.

**Expected behavior:** Order phase groups by the declared canonical sequence
(`pre_room` → `pre_induction_or_sedation` → `airway_access` → `diagnostic` → `therapeutic` →
`specimen_handling` → `rescue_or_contingency` → `post_procedure` → `unassigned`), with `unassigned`
always last. One constant array; no data change.

**Priority:** Blocker-adjacent — **Important before merge**, and I would fix it in the same commit as
F-01/F-02 because it is a five-line change with disproportionate credibility cost.

---

### F-04 — Sampling _instruments_ are zoned to the specimen station and phased to specimen handling

```
Route:      /en/procedures/EBUS_TBNA (zones + phases), ?output=room, ?output=nursing
Viewport:   all
Category:   Clinical content; Data problem rather than UI problem
```

**Observation:** `section-zone-phase-map.json` maps section `Sampling` →
`setup_zone: specimen_station`, `procedural_phase: specimen_handling`. That mapping is correct for
receptacles and wrong for instruments, and the EBUS template puts both in `Sampling`:

| Requirement                               | Zone assigned                        | Clinically belongs                   |
| ----------------------------------------- | ------------------------------------ | ------------------------------------ |
| EBUS-TBNA FNA needle (required)           | specimen_station / specimen_handling | back table or Mayo, diagnostic phase |
| EBUS FNB needle                           | specimen_station / specimen_handling | back table or Mayo, diagnostic phase |
| Intranodal mini-forceps                   | specimen_station / specimen_handling | back table, diagnostic phase         |
| Vacuum-locking syringe                    | specimen_station / specimen_handling | with the needle, at the field        |
| Airway wash/BAL trap                      | specimen_station / specimen_handling | correct                              |
| Slides, cell-block, formalin/RPMI, labels | specimen_station / specimen_handling | correct                              |

The same defect hits `BIOPSY_FORCEPS_FLEX` and `BAL_KIT` on THERAPEUTIC_BRONCH. Note the internal
contradiction: `EBUS_BALLOON` and `EBUS_NEEDLE_ADAPTER` sit in section `Scope accessory` and land
correctly on `back_table / diagnostic` — so on the zone view the needle adapter is on the back table
while the needle it adapts is at the specimen station.

A tech reading Room setup by zone would lay the 22G needle out at the cytology bench. This is the
single most consequential clinical error in the slice, and it is a data problem, not a UI problem.

**Expected behavior:** Split `Sampling` into `Sampling — instruments` (back_table / diagnostic) and
`Sampling — specimen handling` (specimen_station / specimen_handling), or add per-slot zone/phase
overrides for the six instrument slots. Either way, re-run the audit and re-pin the workspace tests.

**Priority:** Important before merge.

---

### F-05 — Chest drainage unit and suction tubing are phased `post_procedure`

```
Route:      /en/procedures/CHEST_TUBE?view=phases ; ?output=room ; ?output=training
Viewport:   all
Category:   Clinical content; Data problem rather than UI problem
```

**Observation:** Section `Drainage` maps to `equipment_tower / post_procedure`. Both required
non-catheter items on the chest-tube workspace inherit it: `GENERIC_DRAINAGE_UNIT` (required) and
`GENERIC_SUCTION` (required). A chest drainage unit must be unpacked, primed and connected _before_
the tube goes in — the tube is connected the moment it is placed. Phasing the drainage unit to
post-procedure inverts the one sequencing fact that matters most for a nurse setting up the room.

`PLEURAL_DRAINAGE_ACCESSORY` (one-way valves, adapters) inherits the same phase, with the same
consequence.

**Expected behavior:** `Drainage` → `equipment_tower / pre_induction_or_sedation` (set up and primed
before the procedure), leaving `Post-procedure` for the dressing/securement section where it
correctly already sits.

**Priority:** Important before merge.

---

### F-06 — Long-term IPC equipment dominates the chest-tube workspace, and is its best-covered content

```
Route:      /en/procedures/CHEST_TUBE ; /readiness ; ?output=gaps
Viewport:   all
Category:   Clinical content; Product strategy
```

**Observation:** You asked specifically whether IPC content confuses the chest-tube workflow. It does,
in two ways.

_By volume:_ 4 of 13 requirements (31%) are indwelling pleural catheter roles — `IPC_INSERTION_KIT`,
`IPC_DRAINAGE_KIT`, `IPC_DRESSING_KIT`, `IPC_MANAGEMENT_ACCESSORY` — all in section
`Long-term drainage`. A separate `IPC_PLACEMENT` procedure already exists in the catalog.

_By coverage — the worse problem:_ from the audit, all four IPC roles are `selectable_authored`,
while the actual chest-tube pathway is the weakest content on the page:

| Role                                                                   | Coverage rung                                |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| IPC_INSERTION_KIT / DRAINAGE_KIT / DRESSING_KIT / MANAGEMENT_ACCESSORY | selectable_authored (4/4)                    |
| CHEST_TUBE_SMALL_BORE                                                  | selectable_authored                          |
| CHEST_TUBE_LARGE_BORE                                                  | non_selectable_authored_only + demo stand-in |
| CHEST_TUBE_SURGICAL                                                    | non_selectable_authored_only                 |
| PNEUMOTHORAX_KIT                                                       | non_selectable_authored_only                 |
| GENERIC_SUCTION (required)                                             | proposals_only + demo stand-in               |
| DRESSING_SECUREMENT (required)                                         | no_option_no_proposal_unmapped               |

So a fellow browsing "Chest tube insertion" finds that the richest, most fully-authored product
content on the page is tunnelled-catheter equipment for a different procedure, while large-bore and
surgical tube options are non-selectable and securement has nothing at all.

**Expected behavior:** Two options, both defensible. (a) Move the four IPC roles out of the
CHEST_TUBE template into `IPC_PLACEMENT` and reach them from a "related procedure" link. (b) Keep
them but render `Long-term drainage` as a visually separated, collapsed subsection captioned as a
divergent pathway, and add a coverage caption to the workspace naming the imbalance. I recommend (a)
for the template and (b) as the interim display fix.

**Priority:** Important before merge (display); Acceptable follow-up (template change).

---

### F-07 — The laser pathway's fire-protection item has less coverage than its energy hardware

```
Route:      /en/procedures/THERAPEUTIC_BRONCH ; /en/clinical-roles/LASER_CONSOLE
Viewport:   all
Category:   Safety/evidence
```

**Observation:** From the audit, on THERAPEUTIC*BRONCH: `LASER_CONSOLE` `proposals_only`,
`LASER_FIBER` `proposals_only`, `LASER_SAFETY_EQUIPMENT` `proposals_only`, and
`LASER_RESISTANT_ETT` **`no_option_no_proposal_unmapped`**. The requirement cards therefore show
"Unreviewed proposals: n" on console, fibre and safety equipment, and "No option, no proposal, no
mapped product" on the laser-resistant tube. Nothing is selectable — correct — but the \_visual
gradient* runs the wrong way: the item that prevents an airway fire is the emptiest cell on the page,
and there is no statement anywhere that no laser pathway is selectable in this release. Compounded by
F-01 (the `LASER` modifier promises fire safety and does nothing).

Contrast `APC`, which is handled well: its modifier really does add `LOCAL_AIRWAY_FIRE_READINESS`.

**Expected behavior:** A one-sentence authored note on the therapeutic workspace: "No laser
requirement in this release has an authored selectable option; the laser pathway is not modelled and
must not be planned from this page." Independent of the ladder, so it cannot be read off the badges.

**Priority:** Important before merge.

---

### F-08 — Authored order is catalog-accretion order, not clinical sequence

```
Route:      /en/procedures/THERAPEUTIC_BRONCH (requirement cards show "Authored order n")
Viewport:   all
Category:   Clinical content; Information architecture
```

**Observation:** On THERAPEUTIC_BRONCH the energy chain is split across the list: Energy platform (4)
… APC probe (15), Energy cable (16), Cryo accessories (17), **Bite block (18), Cleaning brush (19)**,
APC gas accessories (20) … Laser console/fibre/safety (23–25). The cryoprobe (5) is twelve positions
from its accessories (17). The sequence reflects when rows were appended to the template, and the
requirement card surfaces it as "Authored order 18" beside a bite block wedged between two energy
accessories.

The zone view largely rescues this (all Energy → equipment_tower), which is why the zone view is the
better default. But the number is displayed prominently and implies an intended order it does not
carry.

**Expected behavior:** Either relabel to "Template row" (honest, low value), or drop it from the card
face and keep it in the data. Do not present accretion order as authored sequence.

**Priority:** Acceptable follow-up.

---

### F-09 — APC adds a _rigid_ applicator as `required` on a flexible-bronchoscopy scenario

```
Route:      /en/procedures/THERAPEUTIC_BRONCH (modifier APC) ; /readiness
Viewport:   all
Category:   Clinical content; Data problem rather than UI problem
```

**Observation:** `operational.ts` `apcSlots` includes `OPS-APC-RIGID` / `APC_APPLICATOR_RIGID` with
`requiredness: 'required'` and no dependency on `RIGID_AIRWAY`. Selecting APC on a purely flexible
case therefore makes a rigid APC applicator a hard requirement. It happens to be masked in the demo
because the pinned scenario selects `RIGID_AIRWAY` too, but the modifier card will list it under
"Adds 6 requirements" for any reader, and the readiness projection would raise
`missing_required_product_role` for a flexible-only card.

**Expected behavior:** `requiredness: 'conditional'` with `dependencyRule: 'Rigid system in use'`, or
a `set_requiredness` action gated on `RIGID_AIRWAY`.

**Priority:** Important before merge (seed data change, one line).

---

### F-10 — EBUS has no bite block or airway adapter while therapeutic bronchoscopy has both

```
Route:      /en/procedures/EBUS_TBNA
Viewport:   all
Category:   Clinical content
```

**Observation:** `FLEX_BRONCH_CORE` contributes only `VIDEO_PROCESSOR` and `GENERIC_SUCTION` to EBUS.
THERAPEUTIC_BRONCH carries `BITE_BLOCK` (conditional, "Oral insertion without protected airway") and
`BRONCH_ABLATION` carries `GENERIC_AIRWAY_ADAPTER`. A linear EBUS scope is almost always inserted
orally, and the risk of a patient biting a 6.9 mm ultrasound bronchoscope is the reason bite blocks
exist. The omission reads as a template-inheritance gap rather than a considered decision.

**Expected behavior:** Move `BITE_BLOCK` and `GENERIC_AIRWAY_ADAPTER` into `FLEX_BRONCH_CORE` so
every flexible procedure inherits them, with the existing dependency rules intact.

**Priority:** Important before merge.

---

### F-11 — The no-rescue statement is accurate but under-explains itself

```
Route:      /en/procedures/CHEST_TUBE ; /en/procedures/CHEST_TUBE/readiness
Viewport:   all
Category:   Copy/terminology; Safety/evidence
```

**Observation:** You asked that the absence of a rescue module read as a data/model fact, not a
clinical assertion. The copy does that — "This is a fact of the release-pinned composition — no
rescue pathway is invented here." Good.

What it omits is _why_: `operational.ts` exports exactly one rescue module in the entire system
(`MAJOR_AIRWAY_BLEEDING`), and no pleural modifier reaches it. The reader cannot tell whether pleural
rescue was considered and found unnecessary, or simply never authored. A chest tube has real rescue
scenarios — intercostal artery injury, re-expansion pulmonary oedema, tube dislodgement, organ
penetration — and silence on a clinical page tends to be read as reassurance.

**Expected behavior:** Extend the sentence: "Rescue modelling exists in this release only for major
airway bleeding; no pleural rescue module has been authored yet. Absence here is an authoring gap,
not a clinical statement that rescue planning is unnecessary."

**Priority:** Important before merge (copy only).

---

### F-12 — The bleeding rescue module's scope disclaimer is the least prominent text on the card

```
Route:      /en/procedures/EBUS_TBNA ; /en/procedures/THERAPEUTIC_BRONCH (Rescue pathways)
Viewport:   all
Category:   Safety/evidence; Visual design
```

**Observation:** The module content is clinically sound as _equipment readiness_ — second
high-capacity suction, large-channel backup scope, tamponade balloon capability, rigid backup,
ventilation/lung-isolation backup, all `emergency_only` / `emergency_cart` / `emergency_pull`. It
deliberately contains no cold saline, topical epinephrine, or TXA, and the description says so:
"Reusable equipment-readiness module; it is not a clinical management protocol." That disclaimer
renders as `text-xs text-muted-foreground` under the module name, above a bold five-item list that
looks exactly like a massive-haemoptysis checklist.

**Expected behavior:** Promote the disclaimer to a bordered note above the slot list, at body size.
The list is the thing a fellow will screenshot.

**Priority:** Important before merge (visual weight only).

---

### F-13 — Digital drainage is the _default_ modifier on the flagship chest-tube demo

```
Route:      /en/procedures/CHEST_TUBE ; /readiness ; all output previews
Viewport:   all
Category:   Product strategy; Clinical content
```

**Observation:** `chest-tube` scenario defaults are `DIGITAL_DRAINAGE` + `TECH_CHEST_TUBE_SMALL_BORE`.
The `replace_role` mechanism is a good demonstration and the effect copy is clear. But
`DIGITAL_DRAINAGE` is `releaseState: phase_1_1` and digital drainage is not the default standard of
care for chest tube insertion — conventional wet/dry-suction units are. Every output preview, the
readiness projection, and the room setup therefore show a digital system as the baseline. Combined
with `GENERIC_DRAINAGE_UNIT` being replaced out of view, a reader could take digital drainage as the
expected configuration.

**Expected behavior:** Either default to the conventional unit and present `DIGITAL_DRAINAGE` as the
selectable demonstration of `replace_role`, or keep the default and caption the scenario: "This demo
scenario selects digital drainage to exercise the role-replacement mechanism; it is not a statement
of standard practice."

**Priority:** Acceptable follow-up.

---

### F-14 — Small-bore vs large-bore branching is correct and legible

```
Route:      /en/procedures/CHEST_TUBE
Category:   Clinical content
```

**Observation:** `TECH_CHEST_TUBE_SMALL_BORE` and `TECH_CHEST_TUBE_LARGE_BORE` are declared mutually
exclusive, each promotes its own catheter role to `required` and removes the other two, and selecting
both resolves to `blocked` with `mutually_exclusive_modifiers`. The three catheter roles carry
distinct dependency rules ("Small-bore approach selected" / "Large-bore percutaneous approach
selected" / "Surgical/trocar approach selected"). This is the clearest mechanism demonstration in the
slice.

**Priority:** No change required.

---

### F-15 — ROSE and molecular-pathway effects are correct

```
Route:      /en/procedures/EBUS_TBNA (modifiers ROSE, SPEC_MOLECULAR)
Category:   Clinical content
```

**Observation:** `ROSE` adds station/personnel readiness plus slides, fixatives and cell-block
supplies; `SPEC_MOLECULAR` adds a preservation/transport bundle plus a pathology-adequacy readiness
check. Both are correctly framed as _local workflow readiness_ rather than as products, both are the
scenario defaults so the reader sees them applied, and both resolve to demo stand-ins that are
badged. Specimen handling on the EBUS page is understandable — with the caveat that the _instruments_
are misfiled into it (F-04).

**Priority:** No change required.

---

## 4. Device Atlas

### F-16 — The two lead cards on every device page are majority "not recorded"

```
Route:      /en/devices/{productId}
Viewport:   all; worst at ≥1024px where both cards sit side by side above the fold
Category:   Usability; Information architecture
```

**Observation:** Both cards render a fixed row set regardless of what exists. Across the 753-product
cohort:

| Field                  | Not recorded |
| ---------------------- | ------------ |
| gauge                  | 95.1%        |
| delivery_system_od_mm  | 92.2%        |
| french_size            | 86.7%        |
| min_working_channel_mm | 84.2%        |
| working_length_cm      | 76.0%        |
| length_mm              | 56.8%        |
| diameter_mm            | 49.5%        |
| size_display           | 25.5%        |
| reference_part_number  | 98.9%        |
| alternate_ids          | 96.1%        |
| global_part_number     | 64.3%        |
| gtin                   | 56.3%        |

A typical device page shows roughly **7 of 9 dimension rows and 4 of 8 identifier rows reading
"not recorded."** For **155 products (20.6%)** all eight dimension fields are blank, so the
"Dimensions and configuration" card is entirely empty and still occupies half the width above the
fold.

Answering your question directly: honest, yes — the `specsMissingNote` ("means the source documents
reviewed so far do not state it — not that the device lacks it") is exactly right. Overwhelming, also
yes. The most prominent real estate on the atlas is dominated by absence.

**Expected behavior:** Render present facts first, then collapse the empty ones into one honest line
— "Not recorded in reviewed sources: gauge, French size, delivery system OD, working length,
reference part number, alternate identifiers" — keeping `specsMissingNote` and keeping every field
name visible. Same honesty, a fifth of the page.

**Priority:** Important before merge.

---

### F-17 — The page does not answer "what is this device _for_"

```
Route:      /en/devices/{productId}
Viewport:   all
Category:   Information architecture; Clinical content
```

**Observation:** The header gives manufacturer, product name, verification badge, kind/category
badges, and `description` (absent for 13.4% of the cohort). Then two data cards. The clinical role
appears in section four as a bare pill; the role's own `description` and `selection_guidance` — which
is where the functional meaning lives, and which is already loaded on the role page — never appear on
the device page.

A fellow landing on a catalog number therefore learns the GTIN before they learn it is a 22G
EBUS-TBNA needle. Every one of the 753 cohort products has at least one role mapping, so there is no
data reason for this.

**Expected behavior:** Put the primary role name plus its one-line `description` directly under the
H1, before the identifier card.

**Priority:** Important before merge.

---

### F-18 — "Other manufacturers…" shows an arbitrary representative per vendor, capped at 6

```
Route:      /en/devices/{productId} — "Other manufacturers with products mapped to this clinical role"
Viewport:   all
Category:   Product strategy; Safety/evidence
```

**Observation:** `getProductDetail` iterates `productIdsByRole`, takes the first product from each
unseen `manufacturerGroupId`, and stops at 6. `role_fit` is not consulted, so a vendor's
"Secondary"-fit product can stand in for it; size is not matched, so on a 22G needle page the
neighbouring vendor may be represented by a 19G. Each card shows manufacturer, product name and
`sizeDisplay` only — and `sizeDisplay` is blank for a quarter of the cohort, in which case two
different-gauge needles render as visually identical cards.

The caption correctly denies equivalence and substitutability. It does not deny **representativeness**,
which is the actual inference a reader will draw from a tidy 6-card grid: "here are the alternatives."
There is also no "showing 6 of N" and no link to the full role listing from that section.

**Expected behavior:** Add the count and the honest selection rule to the caption ("One product per
manufacturer, selected arbitrarily from N mapped products; not a matched or comparable set"), prefer
`role_fit = Primary` when choosing the representative, and link the section heading to the role page.

**Priority:** Important before merge.

---

### F-19 — "Same manufacturer product line" is clinically safe

```
Route:      /en/devices/{productId}
Category:   Safety/evidence
```

**Observation:** `familyKey` is `manufacturerGroupId | familyName | product_kind`, so the grouping
genuinely cannot cross manufacturers. Siblings are sorted by diameter then French size then name,
which produces the clinically useful ascending-size list. The caption is correct and the section is
below identifiers and specs. The only residual risk is the shared one in F-18: siblings whose
`sizeDisplay` is blank render as indistinguishable names. Worth adding gauge/diameter as a fallback
label.

**Priority:** No change required (minor: size fallback — Acceptable follow-up).

---

### F-20 — Source citations are useful, not decorative

```
Route:      /en/devices/{productId} — Sources
Category:   Safety/evidence
```

**Observation:** Every one of the 753 cohort products carries at least one source row (502 have one,
213 have two, 38 have three; zero have none), and each renders title plus source id, publisher,
location, revision date, as-of date, reliability tier, claim type and verification status. That is
more provenance than any vendor catalog exposes, and it is the strongest single feature of the atlas.
Two notes: the metadata line is a `·`-joined `text-xs` run that is hard to scan, and there is no
outbound link or document reference — so a reader can see that a claim is sourced but cannot reach the
source.

**Expected behavior:** Keep as is for D1; consider a definition-list layout and a document reference
when `filename`/`use_policy` permits.

**Priority:** No change required.

---

## 5. Clinical-role pages

### F-21 — "Authored selection guidance" overstates what 75% of the corpus contains

```
Route:      /en/clinical-roles/{roleCode}
Viewport:   all
Category:   Copy/terminology; Clinical content
```

**Observation:** All 135 roles have `selection_guidance`, and the page renders it in a bordered
blockquote under the heading "Authored selection guidance" with the note "Quoted verbatim from the
governed role table; never paraphrased." Measured across the corpus: median length 73 characters;
**90 of 135 (67%) are under 90 characters**; **101 of 135 (75%) are filter or lookup instructions**;
only **4 of 135 exceed 400 characters**.

Representative contrast:

- `LASER_CONSOLE` (1118 chars) — "Wavelength decides tissue effect, and the choice is between depth and precision. Nd:YAG 1064 nm penetrates 5–15 mm and is the airway workhorse…" — this is real teaching content and it is excellent.
- `EBUS_NEEDLE_FNA` — "Filter by gauge, scope compatibility, minimum channel, and packaging."
- `AIRWAY_STENT_SEMS_COVERED` — "Filter by diameter, length, delivery profile, coverage, and release direction."
- `GENERIC_DRAINAGE_UNIT` — "Hospital formulary item."

The formal quotation apparatus applied to "Hospital formulary item." is a mismatch of frame and
content, and it will read as thin to exactly the audience you want to impress. The problem is the
label, not the text: "Filter by gauge, scope compatibility, minimum channel" is a perfectly good
_selection criterion_.

**Expected behavior:** Two keys. Render short/filter-style text under "Selection criteria" as an
inline line; reserve the blockquote and "Authored selection guidance" for substantive text. A length
threshold is a crude but workable discriminator until the field is split in the role table.

**Priority:** Important before merge.

---

### F-22 — Products are listed above their availability status

```
Route:      /en/clinical-roles/LASER_CONSOLE (worst case); any proposals-only role
Viewport:   all
Category:   Safety/evidence; Information architecture
```

**Observation:** Page order is: guidance → IFU advisory → **Atlas products mapped to this role** →
Procedures and slots using this role (with the authored-option status) → evidence legend.

On `LASER_CONSOLE` that means a reader gets the excellent Nd:YAG/diode teaching paragraph, then four
real, named, verified-source laser consoles grouped by manufacturer, and only after scrolling past
them reaches a table cell containing an "Unreviewed proposal" badge. Nothing on the page states
plainly that no laser console is an authored selectable option in any procedure.

This is where the "accidentally presented as available" risk actually lands — not on the workspace,
which handles it correctly, but on the role page, which is linked from every requirement card and
every readiness row.

**Expected behavior:** Hoist a role-level availability line directly under the H1, derived from the
same ladder the workspace uses: "No procedure in this release has an authored selectable option for
this role" / "Authored selectable options exist in 2 procedures." Cheap; `getRoleSlotUsage` already
returns the input.

**Priority:** Important before merge.

---

### F-23 — Manufacturer grouping helps for multi-vendor roles and hurts for single-vendor walls

```
Route:      /en/clinical-roles/AIRWAY_STENT_SILICONE_STRAIGHT, TRACH_TUBE_CUFFED, AIRWAY_STENT_SEMS_COVERED
Viewport:   worst below 1280px, where the grid drops to 2 then 1 column
Category:   Information architecture; Product strategy
```

**Observation:** Of the 79 roles with cohort products, **45 (57%) have exactly one manufacturer**, so
the grouping renders a single card with a redundant heading. Six roles render walls:

| Products | Manufacturers | Role                           |
| -------- | ------------- | ------------------------------ |
| 100      | 1             | AIRWAY_STENT_SILICONE_STRAIGHT |
| 86       | 1             | TRACH_TUBE_CUFFED              |
| 81       | 3             | AIRWAY_STENT_SEMS_COVERED      |
| 45       | 2             | CHEST_TUBE_SURGICAL            |
| 38       | 2             | CHEST_TUBE_LARGE_BORE          |
| 31       | 1             | TRACH_TUBE_CUFFLESS            |

100 links distinguished only by `sizeDisplay` (blank for a quarter of the cohort) in a 3-column grid
is the clearest instance of "too much raw catalog, too little practical orientation" in the slice.

Related product-strategy point: the counts are **ingestion-coverage counts, not market counts**. One
vendor contributing 100 silicone stents while linear EBUS scopes number 4 reflects which catalogs
were imported most completely. `cohortNote` covers under-representation ("Additional mapped products
may exist on authenticated surfaces") but not this over-representation, and a heading reading "Atlas
products mapped to this role (100 products)" invites a market-share reading.

**Expected behavior:** Above ~24 products, group by the size dimension the role's own guidance names
(diameter, French size, gauge) rather than by manufacturer, with manufacturer as a filter. Drop the
group heading when there is exactly one manufacturer, and say so instead ("All cohort products for
this role are from one manufacturer"). Extend `cohortNote` to state that counts reflect catalog
ingestion, not market availability.

**Priority:** Important before merge (single-manufacturer note + cohort caption); Acceptable
follow-up (size-based grouping).

---

### F-24 — The IFU advisory fires on 134 of 135 roles

```
Route:      /en/clinical-roles/{roleCode} ; ?output=training
Viewport:   all
Category:   Safety/evidence; Usability
```

**Observation:** `requires_current_ifu` is `true` for **134 of 135 roles**, so the amber banner
"confirm compatibility and sizing against the current IFU before clinical use" appears on
essentially every role page, and `training.currentIfuAdvisory` appears on essentially every line of
the Training preview. A warning with a 99.3% base rate carries no information and trains readers to
skip amber boxes — which matters because amber is also the draft-prototype watermark colour.

**Expected behavior:** State it once, globally, in the common footer note, and drop the per-role
banner; or keep the flag but render it only where it is discriminating. If it is genuinely universal,
it is a property of the atlas, not of a role.

**Priority:** Important before merge.

---

### F-25 — Proposal and non-selectable states are well modelled and clearly labelled

```
Route:      /en/clinical-roles/{roleCode} ; /en/procedures/{code}
Category:   Safety/evidence
```

**Observation:** "Unreviewed proposal — A machine-derived suggestion awaiting review. Never
selectable, never public beyond counts, and never satisfies coverage or readiness" is exact, and the
implementation matches it: proposals surface only as counts, `NO_COVERAGE_RUNGS` includes
`proposals_only`, and `readiness.ts` cannot let a proposal produce coverage. "Authored — not
selectable" with "reviewers deliberately hold out of selection; shown for context only" is likewise
precise. The four-state legend at the foot of the role page is the right teaching device and should
be reused on the device page.

**Priority:** No change required.

---

## 6. Demo readiness

### F-26 — A green "Ready" chip can be read without the advisory that qualifies it

```
Route:      /en/procedures/EBUS_TBNA/readiness (Linear EBUS bronchoscope row)
Viewport:   worst below ~1100px — the table is min-w-[860px] inside overflow-x-auto, so the
            Evidence column is off-screen on a 1024×768 or 13" laptop until horizontally scrolled
Category:   Safety/evidence; Visual design
```

**Observation:** This is known-limitation #9 seen from the reader's side. `readiness.test.ts` asserts
`ebusScope.state` is `'ready'`, and the same row carries a `resolverAdvisory` quoting the resolver's
"…requires current local verification." The disposition — keep spec §4 rule 1 verbatim, carry every
resolver message — is right on the data. The presentation is not: the state cell renders a saturated
emerald pill reading **"Ready"**, and the qualifying advisory is grey italic `text-xs` in the
rightmost of four columns inside a horizontally scrolling table. On a 13" laptop the reader sees the
green chip and not the caveat.

This is the one place in the slice where a screenshot could be honestly captioned "the system says
this is Ready."

**Expected behavior:** Do not change the state semantics. Change the chip: when
`resolverAdvisories.length > 0`, render "Ready — see advisory" (or "Ready ⚑") and move the advisory
into the state cell beneath the chip. Data unchanged, tests unchanged, screenshot no longer
misreadable.

**Priority:** Important before merge.

---

### F-27 — State labels should carry the demo qualifier

```
Route:      /en/procedures/{code}/readiness
Viewport:   all
Category:   Copy/terminology; Safety/evidence
```

**Observation:** The DEMO watermark is genuinely impossible to miss — violet, 2px border, flask icon,
`role="note"`, in-flow so it prints, and the headline "DEMO DATA — NOT AN ACTUAL INSTITUTION" is
verbatim-tested. The page title is "Demo readiness — {procedure}." All good. But the headline chip
and every row chip read bare "Ready" / "Ready with limitations" / "Not ready," and the three summary
tiles likewise. Detached from the watermark — by scroll position, by screenshot, by a print that
breaks between sections — they read as an assessment.

**Expected behavior:** Prefix the three state labels with "Demo:" in the message catalogue
(`"Demo: Ready"`). One-line change, three keys, zero logic.

**Priority:** Important before merge.

---

### F-28 — The rest of the readiness surface is correct and should be the template for the others

```
Route:      /en/procedures/{code}/readiness
Category:   Safety/evidence
```

**Observation:** Verified against the code:

- Demo stand-ins are visibly different — `demoStandInRoleCodes` forces a limitation, and a violet "Demo stand-in" badge renders in the evidence column. `plainReady` cannot be reached with `demoStandIn` true.
- Proposals never satisfy readiness — `proposals_only` is in `NO_COVERAGE_RUNGS`; a required requirement on that rung yields `missing_required_product_role`.
- Candidate/unknown evidence never yields unqualified readiness — `plainReady` requires `grade === 'verified_source'` _and_ `compatibilityState` neither `unknown` nor `fail`.
- The empty real formulary is described accurately — "Not ready — no institutional data recorded," with row/carried/preferred counts, and `realFormularyNote` explicitly denying it is institutional data. `carriedRows` and `preferredRows` are both 0 and the copy says so.
- Every diagnostic carries `sourceKind` + `sourceId`, rendered in monospace on the page.
- Nothing reads as procurement — `noProcurementNote` is explicit and `gaps.demoOnlyNote` repeats it.
- Nothing suggests your hospital has or lacks an item — the projection names the fictional organization and location in `demoProjectionNote`.
- `otherWarnings` guarantees no resolver output is silently dropped.

The headline outcomes are also honest: CHEST_TUBE `not_ready` (via the genuinely unmapped
`DRESSING_SECUREMENT`), EBUS_TBNA and THERAPEUTIC_BRONCH `ready_with_limitations`. Nothing resolves to
a flattering green.

**Priority:** No change required.

---

### F-29 — The readiness table is a wall of amber for contingency-heavy procedures

```
Route:      /en/procedures/THERAPEUTIC_BRONCH/readiness
Viewport:   all
Category:   Usability
```

**Observation:** `readiness.ts` degrades any unmapped contingency or optional requirement to
`ready_with_limitations`. THERAPEUTIC_BRONCH has 21 contingency slots out of 29, so most rows carry
an amber chip and the identical evidence text "No institutional mapping in the demo context." The
signal — the handful of rows that are genuinely instructive — is buried in repetition.

**Expected behavior:** Group or collapse rows whose only diagnostic is "no mapping, non-required,"
behind a count ("14 contingency requirements have no demo mapping"), leaving required rows and rows
with real diagnostics expanded.

**Priority:** Acceptable follow-up.

---

## 7. Output previews — are they five distinct views?

Answering the key question directly: **three genuinely distinct data views, one correct link, and one
that is currently the Training view with different fields.**

| Preview              | Verdict                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preference card      | Correct — a link into the preserved builder with the scenario id, explicitly not duplicated. This is the right restraint.                                                                                                                                                                                                     |
| Room setup by zone   | Genuinely distinct and the most immediately useful. Undermined by F-04 (needles at the specimen station) and F-05 (drainage unit post-procedure).                                                                                                                                                                             |
| Nursing / technician | **Duplicate partition.** `responsibleRole` is null on 100% of authored slots, so `nursing` collapses to one group ("No responsible role recorded") subdivided by procedural phase — the identical partition, in the identical order, over the identical line set as Training. The two differ only in which fields they print. |
| Training             | Distinct in content — authored `genericRequirement`, `selectionGuidance`, `dependencyRule`, IFU advisory, nothing machine-generated. Inherits the inverted phase order (F-03) and the near-universal IFU advisory (F-24).                                                                                                     |
| Demo/readiness gap   | Genuinely distinct and the most strategically valuable — the proposals-only / unmapped / non-selectable / demo-stand-in / dimension-gap partition is the artefact that tells you what to author next.                                                                                                                         |

```
Route:      /en/procedures/{code}?output=nursing
Viewport:   all
Category:   Information architecture
```

**F-30 Observation:** Known-limitation #3 is honest that `responsibleRole` is unauthored, but the tab
is still presented as one of five distinct views. Until responsible roles exist, the tab's honest
content is "we cannot group this yet."

**Expected behavior:** Either hide the Nursing tab behind the same condition that would populate it
(if every `responsibleRole` is null, show one explanatory panel instead of the phase subdivision), or
keep it and add a line stating that it will differ from Training only once responsible roles are
authored. Do not count it as a fifth view in any demo narrative.

**Priority:** Important before merge (framing); Acceptable follow-up (the authoring itself).

---

**F-31 — Gap-preview dimension count has no denominator**

```
Route:      /en/procedures/CHEST_TUBE?output=gaps
Category:   Copy/terminology
```

**Observation:** The tab reports "89 authored-option products have all eight dimension fields empty"
(test-pinned at 89 for CHEST_TUBE). 89 out of how many is not stated, and the count spans every
authored-option product across the procedure's slots — a much larger set than the 13 requirements
shown above it. Uninterpretable as rendered.

**Expected behavior:** "89 of N authored-option products across this procedure's slots."

**Priority:** Acceptable follow-up.

---

## 8. Cross-cutting

### F-32 — Horizontally scrolling tables are not keyboard-reachable

```
Route:      /en/devices ; /en/clinical-roles/{roleCode} ; /en/procedures/{code}/readiness
Viewport:   below ~900px logical width for the readiness table (min-w-[860px]); below ~760px for the role table
Category:   Accessibility
```

**Observation:** Three `overflow-x-auto` containers wrap tables with `min-w-[720px]` /
`min-w-[860px]`, and none has `tabIndex={0}`, `role="region"` or an accessible name. A keyboard-only
user cannot scroll them to reach the Evidence column — which on the readiness page is where the
advisory in F-26 lives. The jest-axe suite passes because jsdom has no layout, so
`scrollable-region-focusable` cannot fire. WCAG 2.1.1.

`LinkTabs` itself is well built — real anchors, `aria-current="page"`, visible focus rings, no client
JS.

**Expected behavior:** `tabIndex={0} role="region" aria-label={…}` on the three scroll containers.

**Priority:** Important before merge.

### F-33 — Workspace H1 and scenario title disagree on THERAPEUTIC_BRONCH

```
Route:      /en/procedures/THERAPEUTIC_BRONCH
Category:   Copy/terminology
```

**Observation:** `procedureName` comes from `procedures.json` ("Therapeutic flexible bronchoscopy")
while the composition, recipe and scenario are all named "Central airway obstruction / tumor
debulking." Both appear on the page — the first as the H1, the second in the Scenario row of the
overview list — with no statement that they are the same thing. The audit uses the first name and the
composition file uses the second, so the discrepancy will resurface in any exported artefact.

**Expected behavior:** Render the scenario title as a subtitle under the H1, or reconcile the names in
the data.

**Priority:** Acceptable follow-up.

### F-34 — Non-exemplar procedures are named but unreachable

```
Route:      /en/procedures ; /en/devices/{productId} ; /en/clinical-roles/{roleCode}
Category:   Usability
```

**Observation:** The exemplar framing is honest and well worded. But device pages and role pages list
authored slot usage across _all 15_ catalog procedures, linking only the three exemplars; the other
twelve render as inert text. A reader on an EBUS needle page sees `TB_RULEOUT` and `FLEX_DIAGNOSTIC`
named with no explanation of why they are not links, and `otherProceduresNote` lives on the index page
they may never visit.

**Expected behavior:** A short inline note where non-exemplar names appear ("Not a Phase D1 exemplar —
no workspace in this preview"), or a `title` attribute at minimum.

**Priority:** Acceptable follow-up.

### F-35 — Copy safety, indexing and exclusion posture verified

```
Route:      all D1 routes
Category:   Safety/evidence
```

**Observation:** Checked against the code, not just the claims. Every D1 page ends with
`unlistedNote` + `noEquivalenceNote`; both mandatory related-product headings are present verbatim;
`robots: { index: false, follow: false, noarchive: true }` is set in every `generateMetadata`; the
cohort predicate is applied at store construction so no query, facet, related list or direct URL can
reach a candidate or hidden product; `familyKey` cannot cross manufacturers; the deprecated-role 307
redirect matches existing canonicalization. The copy-safety allowlist approach — permitting the words
"equivalence"/"substitution" only in the keys that deny them, and requiring the negation — is a
technique worth keeping permanently.

**Priority:** No change required.

---

## 9. Recommended sequence

1. **Before showing anyone:** F-01 (inert modifier labelling), F-02 (render suppressed items),
   F-03 (canonical phase order), F-27 ("Demo:" state prefix), F-26 (Ready chip carries its advisory).
   All are small and all five are the difference between "prototype with honest gaps" and "prototype
   that misleads."
2. **Data fixes, same pass:** F-04 (split the `Sampling` section mapping), F-05 (`Drainage` phase),
   F-09 (rigid APC applicator conditional), F-10 (bite block and airway adapter into flex core).
   These change the audit; re-run `ip-intel:audit` and re-pin the workspace tests.
3. **Presentation, before a clinician walkthrough:** F-16 (collapse "not recorded"), F-17 (role in
   the header), F-21 (selection criteria vs guidance), F-22 (role availability line), F-24 (IFU
   advisory), F-32 (scroll regions), F-07 and F-11 and F-12 (three copy changes).
4. **Follow-up:** F-06 template split, F-08, F-13, F-23 size grouping, F-29, F-30 authoring,
   F-31, F-33, F-34.

## 10. What I would not change

The evidence model, the cohort predicate, the readiness state machine, the proposal handling, the
demo watermarking, the refusal to build a compare view, the decision to link rather than duplicate
the preference-card builder, the raw-statement/typed-rule split on device pages, and the choice to
quote authored clinician text verbatim rather than generate prose. Those are the hard parts and they
are right. The findings above are, almost without exception, about presenting that work well and
about being as explicit regarding gaps as the architecture already is regarding evidence.
