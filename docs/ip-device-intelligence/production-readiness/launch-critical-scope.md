# Launch-critical scope

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

Frozen commit: `2f26cb7632fe4e8f6835a8528458b672e8f360c2`. Research cutoff:
`2026-08-10`.

This inventory was derived from generated repository data and exact external sources. “Public” means
`prototype_visible` in the frozen snapshot, not clinically approved or production-ready.

## Frozen global inventory

| Measure                                                    | Count |
| ---------------------------------------------------------- | ----: |
| Products                                                   | 1,532 |
| Roles                                                      |   135 |
| Procedures                                                 |    15 |
| Procedure slots                                            |   233 |
| Authored option memberships                                | 2,073 |
| Unreviewed proposals                                       |   813 |
| Product-role links                                         | 1,622 |
| Raw compatibility rows                                     |   187 |
| Source records                                             |    71 |
| Product-source links                                       | 1,850 |
| Public/selectable option memberships across the repository |   942 |

All 15 procedure records are draft. No clinical owner is recorded.

Across the three D1 procedures there are 57 slots, 568 option memberships, and 542 distinct products.
Across all 57 slots, 284 option memberships / 268 distinct products are public. The stricter Tier 2
cohort below includes only public, `verified_source` products on required/conditional Tier 1 slots.

## Tier 0 — owner-supplied exact configurations

Exact coverage is **35 commercially distinct targets**: 3 Medtronic and 32 Portex.

| Family                    | Exact configurations                                                                                                                                 | Frozen repository status                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Medtronic StraightShot M5 | `1899200`                                                                                                                                            | Wholly absent candidate                                |
| Medtronic airway blade    | `1884033HRE`, `1884035HRE`                                                                                                                           | Wholly absent candidates                               |
| Portex BLUperc            | `101/562/000`; `101/561/{070,080,090}`; `101/563/{070,080,090}`; `101/595/{070,080,090}`; `101/596/{070,080,090}`; `101/573/000`                     | Exact raw GUDID rows only; governed product incomplete |
| Portex BLUgriggs          | `101/543/{070,080,090}`; `101/893/{070,080,090}`; `101/541/{070,080,090}`; `101/891/{070,080,090}`; `101/540/{070,080,090}`; `101/892/{070,080,090}` | Exact raw GUDID rows only; governed product incomplete |

The official source expansion added six configurations beyond the prompt's starter list:
`101/540/{070,080,090}` and `101/892/{070,080,090}`.

Open FDA Class I records name affected lots for 29/32 Portex configurations:

- BLUperc `Z-3088-2024`: all twelve tube-containing `101/561`, `101/563`,
  `101/595`, and `101/596` configurations;
- BLUgriggs `Z-3087-2024`: seventeen configurations—`101/540/080`,
  `101/540/090`, and all sizes under `101/541`, `101/543`, `101/891`,
  `101/892`, and `101/893`.

`101/562/000`, `101/573/000`, and `101/540/070` are not listed in those two
records. That observation is not an all-units safety conclusion. All 32 raw GUDID records contain a
commercial-distribution field; that field is not evidence of local orderability.

Key structural findings:

- `PERC_TRACH_KIT` exists and is required by `PERC_TRACH`, but the 32 Portex codes have no
  governed product, proposal, role edge, BOM, or suppression behavior.
- Tube/no-tube, standard/Suctionaid, forceps/no-forceps, medication/no-medication, and size variants
  are materially distinct.
- BLUgriggs `101/543/*` and `101/893/*` omit forceps even though the technique uses Guidewire
  Dilating Forceps; the standalone exact forceps code was not located.
- A tube-containing kit could duplicate required tube, dressing, adapter, obturator, cannula, and
  preparation selections. No-tube kits must not satisfy a tube requirement.
- `RIGID_BRONCH_SHAVER` currently flattens controller, handpiece, foot control, disposable blade,
  irrigation, and access components into one single-select role.
- The bronchial blade has explicit rigid-bronchoscope application text; the tracheal blade's access
  platform remains unresolved. Neither relationship was governed here.

## Tier 1 — required/conditional role inventory

Tier 1 contains **45 slot memberships / 39 unique roles**.

### EBUS_TBNA — 11

| Requirement | Slot              | Role                   |
| ----------- | ----------------- | ---------------------- |
| required    | `SLOT-4648848CC3` | `EBUS_SCOPE`           |
| required    | `SLOT-7DFA66EA2D` | `VIDEO_PROCESSOR`      |
| required    | `SLOT-92874E31E1` | `ULTRASOUND_PROCESSOR` |
| required    | `SLOT-B19121A5B9` | `ULTRASOUND_CABLE`     |
| conditional | `SLOT-93655BF7C4` | `EBUS_BALLOON`         |
| required    | `SLOT-1AF4BEFE3B` | `EBUS_NEEDLE_FNA`      |
| required    | `SLOT-12ACA27E54` | `GENERIC_SPECIMEN`     |
| required    | `SLOT-2E3065C976` | `GENERIC_SUCTION`      |
| conditional | `SLOT-CD12842559` | `EBUS_NEEDLE_ADAPTER`  |
| conditional | `SLOT-F3BF1ECC7E` | `FLUOROSCOPY_C_ARM`    |
| conditional | `SLOT-1D13D48BD7` | `RADIATION_PROTECTION` |

The full procedure has 15 slots: 7 required, 4 conditional, 4 optional.

### THERAPEUTIC_BRONCH — 24

| Requirement | Slot              | Role                              |
| ----------- | ----------------- | --------------------------------- |
| required    | `SLOT-B79D3CF198` | `FLEX_SCOPE_THERAPEUTIC`          |
| required    | `SLOT-6BCA0B7A49` | `VIDEO_PROCESSOR`                 |
| required    | `SLOT-13609A744F` | `GENERIC_SUCTION`                 |
| conditional | `SLOT-FCE9E3810E` | `ENERGY_PLATFORM`                 |
| conditional | `SLOT-14453819D5` | `CRYOPROBE_FLEX`                  |
| conditional | `SLOT-3FE6796B6D` | `AIRWAY_BALLOON_DILATOR`          |
| conditional | `SLOT-D43C866FB5` | `PULMONARY_GUIDEWIRE`             |
| conditional | `SLOT-7412B3318B` | `INFLATION_DEVICE`                |
| conditional | `SLOT-45D721710F` | `AIRWAY_STENT_SEMS_COVERED`       |
| conditional | `SLOT-09A64B2C62` | `AIRWAY_STENT_SEMS_UNCOVERED`     |
| conditional | `SLOT-0F8FA96C28` | `GENERIC_SPECIMEN`                |
| conditional | `SLOT-97CFA5C9A2` | `APC_PROBE_FLEX`                  |
| conditional | `SLOT-90A43CBAEF` | `ENERGY_CABLE_ADAPTER`            |
| conditional | `SLOT-971BBE6BF8` | `CRYO_SYSTEM_ACCESSORY`           |
| conditional | `SLOT-D6B291DC80` | `BITE_BLOCK`                      |
| conditional | `SLOT-D7F2D36301` | `ENDOSCOPE_CLEANING_BRUSH`        |
| conditional | `SLOT-1538BC9076` | `APC_GAS_ACCESSORY`               |
| conditional | `SLOT-185FBB545F` | `LASER_CONSOLE`                   |
| conditional | `SLOT-34CDBAB683` | `LASER_FIBER`                     |
| conditional | `SLOT-6630AD392A` | `LASER_SAFETY_EQUIPMENT`          |
| conditional | `SLOT-EE17F755B2` | `LASER_RESISTANT_ETT`             |
| conditional | `SLOT-49F20FD8F8` | `FLUOROSCOPY_C_ARM`               |
| conditional | `SLOT-945FA4AAF8` | `RADIATION_PROTECTION`            |
| conditional | `SLOT-38E5FB60B9` | `TOMOSYNTHESIS_NAVIGATION_SYSTEM` |

The full procedure has 29 slots: 3 required, 21 conditional, 5 optional.

### CHEST_TUBE — 10

| Requirement | Slot              | Role                         |
| ----------- | ----------------- | ---------------------------- |
| conditional | `SLOT-708736B8C2` | `CHEST_TUBE_SMALL_BORE`      |
| conditional | `SLOT-D5C3DB0027` | `CHEST_TUBE_LARGE_BORE`      |
| conditional | `SLOT-4D849E266F` | `CHEST_TUBE_SURGICAL`        |
| required    | `SLOT-3631C94D7A` | `GENERIC_DRAINAGE_UNIT`      |
| required    | `SLOT-CE48C1B108` | `GENERIC_SUCTION`            |
| conditional | `SLOT-B4E5C6A7A9` | `IPC_DRAINAGE_KIT`           |
| required    | `SLOT-4BE1D79D6C` | `DRESSING_SECUREMENT`        |
| conditional | `SLOT-AECDA16326` | `PLEURAL_DRAINAGE_ACCESSORY` |
| conditional | `SLOT-702914B1CF` | `IPC_DRESSING_KIT`           |
| conditional | `SLOT-67171A33D4` | `IPC_MANAGEMENT_ACCESSORY`   |

The full procedure has 13 slots: 3 required, 7 conditional, 3 optional.

Duplicate Tier 1 roles across procedures are `GENERIC_SUCTION` ×3 and
`FLUOROSCOPY_C_ARM`, `GENERIC_SPECIMEN`, `RADIATION_PROTECTION`, and
`VIDEO_PROCESSOR` ×2.

## Tier 2 — primary public product cohort

The strict Tier 2 query is: required/conditional Tier 1 slot × `prototype_visible` ×
`verified_source`. It yielded **217 procedure-slot-product memberships, 202 distinct products, and
48 procedure-role-manufacturer-family surfaces**.

| Procedure          | Memberships | Role/product concentration                                                                                                                     |
| ------------------ | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| EBUS_TBNA          |          31 | EBUS balloon 1; adapter 1; scopes 2; ultrasound cable 1; ultrasound processor 1; video processors 4; FNA needles 21                            |
| THERAPEUTIC_BRONCH |         145 | balloons 18; covered stents 81; uncovered stents 18; bite blocks 2; brushes 6; scopes 5; inflation devices 7; guidewires 4; video processors 4 |
| CHEST_TUBE         |          41 | small-bore tube 1; drainage units 6; IPC kits 10; IPC dressing kits 2; IPC management 11; pleural accessories 11                               |
| **Total**          |     **217** | **202 distinct products** after cross-procedure deduplication                                                                                  |

Primary exact launch surfaces reviewed include:

- EBUS scopes `PRD-2FFEEB98B2` (BF-UC190F) and `PRD-F586C51621` (BF-UC180F);
- EBUS/therapeutic video choices `PRD-7E05B194BE`, `PRD-9BB524F077`,
  `PRD-A2FFE725BD`, and `PRD-EA1D57AC9A`;
- eight Cook exact needle/hub configurations governed by rules
  `RULE-3BBEB51543`, `RULE-4E3FFA7BA5`, `RULE-97EA51F06C`,
  `RULE-A3E5868A02`, `RULE-C3FACFBEA9`, `RULE-C464BAB756`,
  `RULE-D74D20F4CD`, and `RULE-E262211B9B`;
- 18 AERO and 15 AERO DV public configurations;
- ReSolve `PRD-B1E837841F` / `RTT14038MB`;
- the public Aspira/Rocket IPC cohorts.

### Tier 2 zero-public-product gaps

There are **23 required/conditional slot rows / 18 unique roles** with no strict Tier 2 product:

```text
APC_GAS_ACCESSORY APC_PROBE_FLEX CHEST_TUBE_LARGE_BORE
CHEST_TUBE_SURGICAL CRYOPROBE_FLEX CRYO_SYSTEM_ACCESSORY
DRESSING_SECUREMENT ENERGY_CABLE_ADAPTER ENERGY_PLATFORM
FLUOROSCOPY_C_ARM GENERIC_SPECIMEN GENERIC_SUCTION
LASER_CONSOLE LASER_FIBER LASER_RESISTANT_ETT
LASER_SAFETY_EQUIPMENT RADIATION_PROTECTION
TOMOSYNTHESIS_NAVIGATION_SYSTEM
```

This is a coverage finding, not permission to expose candidate/hidden products.

## Tier 3 — compatibility and safety

The frozen exemplar graph touches **32 procedure memberships / 31 distinct rules**: 28 verified, 1
candidate, and 2 unknown.

### EBUS — 12

```text
CMP-61818E81AF  unknown   role-level EBUS_SCOPE → EBUS_NEEDLE_FNA
CMP-FFA5337BF8  unknown   role-level EBUS_SCOPE → EBUS_NEEDLE_FNB
CMP-C9DF0E15EF  verified  CoreDx family statement
CMP-6DCB3DAE38  verified  Scivita bracket → HDVS-S300D
RULE-3BBEB51543 verified  Cook Olympus/non-Luer
RULE-4E3FFA7BA5 verified  Cook Olympus/non-Luer
RULE-97EA51F06C verified  Cook Pentax/Luer
RULE-A3E5868A02 verified  Cook Pentax/Luer
RULE-C3FACFBEA9 verified  Cook Pentax/Luer
RULE-C464BAB756 verified  Cook Pentax/Luer
RULE-D74D20F4CD verified  Cook Olympus/non-Luer
RULE-E262211B9B verified  Cook Olympus/non-Luer
```

### THERAPEUTIC_BRONCH — 7

```text
CMP-18FAEABA17 verified  APC probe requires ERBE APC/VIO
CMP-58DE7D49C4 candidate   Olympus hot-biopsy forceps → energy platform
CMP-6DCB3DAE38 verified  Scivita bracket → HDVS-S300D
CMP-8E19FBDE92 verified  Ion-specific forceps G53006
CMP-96DFBE173A verified  balloon → inflation device
CMP-C03EB3CD4E verified  balloon → 0.035-inch guidewire
CMP-E51941CB0F verified  cryoprobe → ERBECRYO 2
```

### CHEST_TUBE — 13, all verified

```text
Aspira / SRC025:
RULE-0673A3B60C RULE-092FCBD9DD RULE-21D7AFFDBB
RULE-6BDE2819F9 RULE-CF9D2B47C0 RULE-E9B402E86B

Rocket / SRC026:
RULE-1CC64E5F41 RULE-4616EF138F RULE-541C89AE7A
RULE-6D8FEF80AF RULE-A2C900E1AB RULE-AB5AD42944
RULE-ED8AEAB4CC
```

The chest rules resolve a source product but use broad “approved Aspira” or “Rocket IPC” target
prose, so they are not exact enforceable device-to-device edges.

In addition to these 31 frozen rules, the external research stream reviewed **14 prioritized
compatibility/safety claim surfaces**: EBUS platform, Cook hubs, recalled needle, therapeutic
platform, two balloon systems, ERBE, AERO sterility, stent indication, laser, Micro-Tech exact-code
gap, ReSolve/Oasis fit, Aspira system boundary, and Rocket R51401 revision.

The 14-surface figure is a broader read-only research inventory, not a manifest-coverage count. The
manifest contains exactly **9 Tier 3 targets / 9 Tier 3 records**; generated coverage and queue
reports represent only manifest candidates. Balloon, ERBE, stent-indication, laser/ETT, and
Micro-Tech inventory findings are documented scope/backlog context unless a candidate ID is named.

## Exact AERO/AERO DV impact

The confirmed sterile conflict affects these 33 public product IDs:

```text
PRD-04F9EBA54C PRD-0EF1C15F6B PRD-23E592FF23 PRD-29E6B2C2D0
PRD-2A67871443 PRD-2E03B33575 PRD-2EE09F18D7 PRD-3C2043D9ED
PRD-41BE0FC18C PRD-438D71C59C PRD-534A17E0C9 PRD-58DB5E4909
PRD-6407CF16C1 PRD-6488B1F637 PRD-65629D3931 PRD-71B93D1EA0
PRD-7389E0BD35 PRD-8B87F7D42B PRD-8E2214C53F PRD-941D1C2633
PRD-9C399CB432 PRD-BA677F5907 PRD-BAC7605565 PRD-BD9FC1E209
PRD-BDE6A1058E PRD-BFE5B739F0 PRD-C37147C7D7 PRD-C65DDE0FEC
PRD-DA836B059E PRD-EC1BF76FBC PRD-F227995333 PRD-F32CE903FF
PRD-FA59BE320F
```

AEROmini is a separate family and is not included in this conflict.

## Frozen source posture

The three exemplar surfaces link 666 product-source records to 33 unique source entries. Their source
types are:

| Type                              | Count |
| --------------------------------- | ----: |
| Manufacturer brochure             |     9 |
| Manufacturer catalog              |     9 |
| Seed workbook                     |     2 |
| Web capture                       |     2 |
| User guide                        |     2 |
| Compiled CSV                      |     1 |
| Manufacturer/distributor brochure |     1 |
| IFU                               |     1 |
| Flyer                             |     1 |
| Legacy catalog                    |     1 |
| User manual                       |     1 |
| Ordering capture                  |     1 |
| FDA/NLM snapshot                  |     1 |
| Product page                      |     1 |

`SRC007`, `SRC008`, `SRC020`, and `SRC045` are clearly undated. Many sources predate the
365-day review cue. Structural source linkage is not the same as current model-specific labeling.

## Runtime/readiness observations

Read-only local testing found:

| Check                          | Frozen behavior                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Public unlisted exemplar route | 200                                                                                   |
| Hidden product route           | 404                                                                                   |
| Candidate/non-exemplar route   | 404                                                                                   |
| Alias route                    | 307 redirect                                                                          |
| Noindex                        | Present                                                                               |
| Educational disclaimer         | Present                                                                               |
| Flag behavior                  | Production is not enabled; exact local env value can enable development               |
| Source usability               | Device page rendered no outbound source links/revision link                           |
| Mobile width                   | EBUS and chest fit at 375 px; therapeutic root measured 402 px                        |
| Loading/error boundaries       | No route-level `loading.tsx` or `error.tsx`                                           |
| Analytics                      | Local endpoint returned 500 before client creation because Supabase config was absent |
| Print                          | Partial; no complete critical-workspace print acceptance                              |
| Payload/performance            | Development behavior only; no production-build payload claim made                     |

No database or Supabase read/write succeeded, and no local or production state was mutated.

## Active-PR-only scope

**ACTIVE-PR CONTEXT — NOT PRESENT IN FROZEN MAIN SNAPSHOT**

- PR #91 removes four IPC roles from CHEST_TUBE and adds reviewed airway-adapter/bite-block changes.
- PR #92 makes the rigid-APC F-09 behavior conditional and adds definition-set retention/launch
  verification work.

Those observations are not counted as frozen data and require post-merge verification.

This inventory is educational governance material, not clinical advice.
