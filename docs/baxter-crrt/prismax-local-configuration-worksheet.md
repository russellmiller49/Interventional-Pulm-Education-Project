# PrisMax local configuration and Phase 7 readiness worksheet

Status: `pending — not supplied`

Gate state: `not ready for formal device disposition or Phase 7 authorization`

Review state: every confirmation and approval below is intentionally unchecked

## Purpose and boundary

Use this worksheet to record the exact local PrisMax installation, operational configuration,
approved clinical policies, release candidate, and reviewer identities needed for formal PrisMax
device review and a Phase 7 decision. It supplements the
[PrisMax device review intake](./prismax-device-review-checklist.md); it does not replace that
review, the current operator's manual, local policy, hands-on device inspection, or clinical
approval.

The current repository profile is a draft educational profile. The supplied AW8035 manual and
Nordic specification sheet do not establish the local machine, market, software, options,
disposables, solutions, or practice. Do not infer an answer from those sources.

Rules for completing this worksheet:

- Record an exact value or explicitly state `not applicable`; do not use assumed defaults,
  undocumented customary practice, or a generic Baxter value.
- Cite the evidence for every answer: device screen/label, controlled local document, configuration
  export, manufacturer record, or reviewer-observed workflow. Include the exact revision, page or
  screen, date observed, and SHA-256 where a file exists.
- Keep device behavior, installed configuration, and local clinical policy in separate fields.
- Do not record passwords, service codes, IP addresses, network topology, patient data, free-text
  learner data, or other secrets in this repository.
- Mark a field complete only after a named reviewer checks it against the exact release candidate.
  A passing test, unchecked checklist, source inspection, or informal development approval is not
  sign-off.
- If the device, software, profile, content, local policy, or release candidate changes, reset every
  affected confirmation and approval to pending.

## 1. Worksheet control

| Field                                               | Required response      | Evidence/reference     | State   |
| --------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Worksheet record ID                                 | Pending — not supplied | Pending — not supplied | Pending |
| Institution/legal entity                            | Pending — not supplied | Pending — not supplied | Pending |
| Hospital/campus                                     | Pending — not supplied | Pending — not supplied | Pending |
| Clinical unit/service                               | Pending — not supplied | Pending — not supplied | Pending |
| Configuration owner                                 | Pending — not supplied | Pending — not supplied | Pending |
| Product/release owner                               | Pending — not supplied | Pending — not supplied | Pending |
| Date collection opened                              | Pending — not supplied | Pending — not supplied | Pending |
| Date collection frozen                              | Pending — not supplied | Pending — not supplied | Pending |
| Intended pilot cohort                               | Pending — not supplied | Pending — not supplied | Pending |
| Intended release locale(s)                          | Pending — not supplied | Pending — not supplied | Pending |
| Controlled storage location for supporting evidence | Pending — not supplied | Pending — not supplied | Pending |
| Evidence custodian                                  | Pending — not supplied | Pending — not supplied | Pending |

- [ ] The configuration owner confirms this worksheet describes one exact, identifiable local
      configuration rather than a blended or representative fleet.
- [ ] If multiple local configurations exist, each has a separate worksheet and profile decision.
- [ ] Supporting evidence has been reviewed for PHI, credentials, secrets, and prohibited network or
      service details before storage.

## 2. Release market and device identity

### 2.1 Market, regulatory, and labeling context

| Field                                           | Required response      | Evidence/reference     | State   |
| ----------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Country of installation and intended release    | Pending — not supplied | Pending — not supplied | Pending |
| Regulatory market/region                        | Pending — not supplied | Pending — not supplied | Pending |
| Local labeling language(s)                      | Pending — not supplied | Pending — not supplied | Pending |
| Device user-interface language(s)               | Pending — not supplied | Pending — not supplied | Pending |
| Intended care environment                       | Pending — not supplied | Pending — not supplied | Pending |
| Adult/pediatric institutional scope             | Pending — not supplied | Pending — not supplied | Pending |
| Market-specific manufacturer documentation set  | Pending — not supplied | Pending — not supplied | Pending |
| Market/configuration restrictions affecting use | Pending — not supplied | Pending — not supplied | Pending |

### 2.2 Installed device and configuration identifiers

Record identifiers from an authorized user-visible label, system-information screen, or controlled
asset record. Do not enter service credentials or protected configuration details.

| Field                                                                   | Required response      | Evidence/reference     | State   |
| ----------------------------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Manufacturer and exact commercial model                                 | Pending — not supplied | Pending — not supplied | Pending |
| Catalog/reference/part number                                           | Pending — not supplied | Pending — not supplied | Pending |
| UDI/device identifier, if applicable and safe to record                 | Pending — not supplied | Pending — not supplied | Pending |
| Local asset/fleet identifier                                            | Pending — not supplied | Pending — not supplied | Pending |
| Device serial number or approved redacted identifier                    | Pending — not supplied | Pending — not supplied | Pending |
| Hardware revision                                                       | Pending — not supplied | Pending — not supplied | Pending |
| Installed program/software version                                      | Pending — not supplied | Pending — not supplied | Pending |
| Software build/revision identifier                                      | Pending — not supplied | Pending — not supplied | Pending |
| Installed configuration/profile identifier                              | Pending — not supplied | Pending — not supplied | Pending |
| Configuration revision/version                                          | Pending — not supplied | Pending — not supplied | Pending |
| Licensed option/package identifiers                                     | Pending — not supplied | Pending — not supplied | Pending |
| Last locally approved software/configuration change date                | Pending — not supplied | Pending — not supplied | Pending |
| Exact user manual/IFU number, revision, date, and language in local use | Pending — not supplied | Pending — not supplied | Pending |
| Manufacturer field notice or addendum applicable to this installation   | Pending — not supplied | Pending — not supplied | Pending |

- [ ] A PrisMax-trained reviewer observed the identifiers on the exact target device or approved
      fleet record.
- [ ] The reviewer reconciled installed software and configuration with the exact local manual/IFU.
- [ ] Any difference between the installed configuration and repository draft profile is recorded in
      the discrepancy log below.

## 3. Enabled therapies and prescription configuration

Enter every therapy displayed to the local operator. Add rows as needed. Do not treat a therapy
mentioned in a manual or marketing sheet as locally enabled.

| Exact on-device therapy name | Enabled, disabled, or unavailable | Applicable patient scope | Configuration evidence | Reviewer/state |
| ---------------------------- | --------------------------------- | ------------------------ | ---------------------- | -------------- |
| Pending — not supplied       | Pending — not supplied            | Pending — not supplied   | Pending — not supplied | Pending        |
| Pending — not supplied       | Pending — not supplied            | Pending — not supplied   | Pending — not supplied | Pending        |
| Pending — not supplied       | Pending — not supplied            | Pending — not supplied   | Pending — not supplied | Pending        |

For every enabled therapy and disposable-set combination, record the exact allowed value ranges,
increments, units, defaults, rounding, validation, and dependency rules. Add one row per field and
combination.

| Therapy                | Set/configuration      | On-device field        | Minimum                | Maximum                | Increment/rounding     | Unit                   | Default or carry-forward behavior | Evidence/state |
| ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | --------------------------------- | -------------- |
| Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied            | Pending        |

- [ ] Blood-flow configuration is documented for every applicable therapy/set.
- [ ] PBP, dialysate, replacement, patient-fluid-removal, effluent, and any other displayed flow are
      each documented when present and explicitly marked not applicable when absent.
- [ ] Therapy/set/solution compatibility and invalid-combination behavior are documented.
- [ ] Prescription review, edit, confirmation, rounding, and out-of-range behavior are documented.
- [ ] Any Same Patient carry-forward behavior is documented separately from New Patient defaults.
- [ ] No range, increment, default, target, threshold, or compatibility rule has been inferred from a
      different device generation, set, market, or software revision.

## 4. Disposable sets and accessories

Record every locally stocked and enabled disposable set that may appear in the module. Use exact
labeling and catalog/reference numbers.

| Exact set name         | Catalog/reference number | Locally stocked        | Enabled on device      | Enabled therapy/configuration | Approved patient scope | Flow/range record      | Compatibility evidence | Reviewer/state |
| ---------------------- | ------------------------ | ---------------------- | ---------------------- | ----------------------------- | ---------------------- | ---------------------- | ---------------------- | -------------- |
| Pending — not supplied | Pending — not supplied   | Pending — not supplied | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending        |

Record each accessory or optional component independently.

| Exact accessory/component | Part/configuration identifier | Present on target device | Enabled/licensed       | Required or optional   | Supported therapies/sets | Evidence               | Reviewer/state |
| ------------------------- | ----------------------------- | ------------------------ | ---------------------- | ---------------------- | ------------------------ | ---------------------- | -------------- |
| Pending — not supplied    | Pending — not supplied        | Pending — not supplied   | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending — not supplied | Pending        |

- [ ] Set loading, line routing, connection, clamp, sensor, detector, and prime checks are mapped for
      each enabled set.
- [ ] Set life/time behavior and local replacement policy are separately documented.
- [ ] Locally prohibited, obsolete, or unavailable sets/accessories are explicitly excluded from the
      educational profile.
- [ ] Compatibility is supported by matching local labeling or controlled manufacturer evidence.

## 5. Pump, scale, syringe, clamp, and sensor inventory

Document the physical inventory and the installed software behavior. Do not infer a five-scale
configuration from optional Auto Effluent material or a four-scale configuration from Prismaflex.

| Component/position                    | Present                | Enabled                | Exact on-device label  | Supported function/fluids | Capacity or supported size | Units/precision        | Behavior when inactive/absent | Evidence/state |
| ------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------- | -------------------------- | ---------------------- | ----------------------------- | -------------- |
| Blood pump                            | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending — not supplied        | Pending        |
| PBP pump                              | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Dialysate/replacement 2 pump          | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Replacement pump                      | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Effluent pump                         | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Syringe pump                          | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| PBP scale position                    | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Dialysate scale position              | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Replacement scale position            | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Effluent scale position               | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Optional Auto Effluent scale/position | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Air detector                          | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Blood-leak detector                   | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Pressure sensor/monitoring positions  | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Line clamps                           | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |
| Other installed component             | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied    | Pending — not supplied     | Pending — not supplied | Pending                       |

For the syringe pump, also record:

| Field                                                 | Required response      | Evidence/reference     | State   |
| ----------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Supported syringe manufacturers/types                 | Pending — not supplied | Pending — not supplied | Pending |
| Supported syringe sizes                               | Pending — not supplied | Pending — not supplied | Pending |
| Local syringe-selection workflow                      | Pending — not supplied | Pending — not supplied | Pending |
| Configured delivery units and increments              | Pending — not supplied | Pending — not supplied | Pending |
| Locally permitted syringe contents/uses               | Pending — not supplied | Pending — not supplied | Pending |
| Bag/syringe change workflow and confirmation behavior | Pending — not supplied | Pending — not supplied | Pending |
| Empty/near-empty/misload alarm behavior               | Pending — not supplied | Pending — not supplied | Pending |

## 6. Auto Effluent configuration

| Field                                             | Required response      | Evidence/reference     | State   |
| ------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Auto Effluent available on exact target device    | Pending — not supplied | Pending — not supplied | Pending |
| Hardware/accessory identifier                     | Pending — not supplied | Pending — not supplied | Pending |
| Licensed software option/configuration identifier | Pending — not supplied | Pending — not supplied | Pending |
| Enabled or disabled locally                       | Pending — not supplied | Pending — not supplied | Pending |
| Supported therapies and sets                      | Pending — not supplied | Pending — not supplied | Pending |
| Supported bags/containers and volumes             | Pending — not supplied | Pending — not supplied | Pending |
| Setup and connection workflow                     | Pending — not supplied | Pending — not supplied | Pending |
| Scale/measurement/display behavior                | Pending — not supplied | Pending — not supplied | Pending |
| Contribution to displayed calculations            | Pending — not supplied | Pending — not supplied | Pending |
| Bag-change and empty-container behavior           | Pending — not supplied | Pending — not supplied | Pending |
| Alarm names, priorities, and machine reactions    | Pending — not supplied | Pending — not supplied | Pending |
| Local policy restrictions                         | Pending — not supplied | Pending — not supplied | Pending |

- [ ] Auto Effluent is represented only if presence, licensing, local enablement, supported
      combinations, calculations, and alarm behavior are all verified.
- [ ] If unavailable or disabled, the educational profile and artwork do not imply its presence.

## 7. Stocked solutions, containers, and volumes

Enter every solution the module may present, including inactive or prohibited options needed for
wrong-solution training. Transcribe from the controlled local formulary and product labeling; do not
derive composition from product-family names.

| Exact product/solution name | Manufacturer/catalog ID | Local formulary status | Intended role/pump     | Container volume(s)    | Exact labeled composition/concentrations | Compatible sets/therapies | Patient restrictions   | Evidence/state |
| --------------------------- | ----------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------------------------- | ------------------------- | ---------------------- | -------------- |
| Pending — not supplied      | Pending — not supplied  | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied                   | Pending — not supplied    | Pending — not supplied | Pending        |

| Solution-control field                                    | Required response      | Evidence/reference     | State   |
| --------------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Dialysate solutions stocked and approved                  | Pending — not supplied | Pending — not supplied | Pending |
| Replacement solutions stocked and approved                | Pending — not supplied | Pending — not supplied | Pending |
| PBP solutions stocked and approved                        | Pending — not supplied | Pending — not supplied | Pending |
| Citrate solutions stocked and approved                    | Pending — not supplied | Pending — not supplied | Pending |
| Calcium solutions stocked and approved                    | Pending — not supplied | Pending — not supplied | Pending |
| Other syringe/bag contents permitted by policy            | Pending — not supplied | Pending — not supplied | Pending |
| Exact selectable bag/container volumes                    | Pending — not supplied | Pending — not supplied | Pending |
| Solution and volume selection/edit workflow               | Pending — not supplied | Pending — not supplied | Pending |
| Barcode/double-check workflow, if applicable              | Pending — not supplied | Pending — not supplied | Pending |
| Substitution and shortage policy                          | Pending — not supplied | Pending — not supplied | Pending |
| Wrong-solution detection, response, and escalation policy | Pending — not supplied | Pending — not supplied | Pending |
| Storage/warming/use restrictions relevant to education    | Pending — not supplied | Pending — not supplied | Pending |

- [ ] Device-selectable solutions are distinguished from locally stocked and clinically approved
      solutions.
- [ ] Solution composition, concentration, and volume are versioned and reviewer-checked.
- [ ] No solution or compatibility claim comes only from the Nordic marketing sheet or a generic
      review article.

## 8. Anticoagulation and local protocol profiles

### 8.1 Approved approaches

| Approach                         | Approved, prohibited, or not applicable | Applicable roles/patients/therapies | Exact controlled protocol | Version/date/SHA-256   | Device setup implications | Reviewer/state |
| -------------------------------- | --------------------------------------- | ----------------------------------- | ------------------------- | ---------------------- | ------------------------- | -------------- |
| No anticoagulation               | Pending — not supplied                  | Pending — not supplied              | Pending — not supplied    | Pending — not supplied | Pending — not supplied    | Pending        |
| Systemic anticoagulation         | Pending — not supplied                  | Pending — not supplied              | Pending — not supplied    | Pending — not supplied | Pending — not supplied    | Pending        |
| Regional citrate anticoagulation | Pending — not supplied                  | Pending — not supplied              | Pending — not supplied    | Pending — not supplied | Pending — not supplied    | Pending        |
| Other local approach             | Pending — not supplied                  | Pending — not supplied              | Pending — not supplied    | Pending — not supplied | Pending — not supplied    | Pending        |

For each permitted non-citrate approach, record the exact drug/solution, formulation and
concentration, delivery route/pump, selectable units and increments, monitoring, adjustment,
hold/stop criteria, reversal/escalation, and role authorization in a versioned protocol profile.

### 8.2 Citrate/calcium activation gate

Citrate controls and CRRT-17 must remain disabled until every field below is supplied, reviewed, and
approved for the exact local protocol version.

| Required citrate/calcium field                    | Required response      | Evidence/reference     | State   |
| ------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Controlled protocol title/owner                   | Pending — not supplied | Pending — not supplied | Pending |
| Protocol version, effective date, and review date | Pending — not supplied | Pending — not supplied | Pending |
| Protocol file SHA-256                             | Pending — not supplied | Pending — not supplied | Pending |
| Eligible patient/therapy criteria and exclusions  | Pending — not supplied | Pending — not supplied | Pending |
| Exact citrate solution and concentration          | Pending — not supplied | Pending — not supplied | Pending |
| Exact calcium solution and concentration          | Pending — not supplied | Pending — not supplied | Pending |
| Exact dialysate/replacement solution requirements | Pending — not supplied | Pending — not supplied | Pending |
| Device pump/scale/syringe assignments             | Pending — not supplied | Pending — not supplied | Pending |
| Initial dosing rules and units                    | Pending — not supplied | Pending — not supplied | Pending |
| Citrate adjustment rules                          | Pending — not supplied | Pending — not supplied | Pending |
| Calcium adjustment rules                          | Pending — not supplied | Pending — not supplied | Pending |
| Target systemic and post-filter measurements      | Pending — not supplied | Pending — not supplied | Pending |
| Laboratory timing and reassessment rules          | Pending — not supplied | Pending — not supplied | Pending |
| Toxicity/complication recognition rules           | Pending — not supplied | Pending — not supplied | Pending |
| Hold/stop and escalation rules                    | Pending — not supplied | Pending — not supplied | Pending |
| Prescriber/operator role permissions              | Pending — not supplied | Pending — not supplied | Pending |
| Independent double-check requirements             | Pending — not supplied | Pending — not supplied | Pending |
| Pharmacist review                                 | Pending — not supplied | Pending — not supplied | Pending |
| Nephrology/critical-care/nursing review           | Pending — not supplied | Pending — not supplied | Pending |

- [ ] The citrate profile contains no rule inferred from a generic review, marketing sheet, or
      unmatched institutional protocol.
- [ ] Every actionable numeric rule and critical-error rule has a source and named reviewer.
- [ ] The exact reviewed citrate profile is locked to the exact content version and release hash.

## 9. Setup, navigation, operations, and user-level controls

Observe the exact target configuration and record machine behavior for each surface. Mark absent or
disabled surfaces explicitly rather than omitting them.

| Surface/workflow              | Exact local label and order | Available/enabled state | Required operator action and gate | Default/carry-forward behavior | Evidence/state |
| ----------------------------- | --------------------------- | ----------------------- | --------------------------------- | ------------------------------ | -------------- |
| Power-on/start                | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| New Patient                   | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Same Patient                  | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Patient                       | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Therapy                       | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Prescription                  | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Sets                          | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Fluids                        | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Prime                         | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Review                        | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Connect Patient               | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Start treatment               | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Therapy Operations            | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| History/events                | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Bag/syringe change            | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Screen lock/unlock            | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| User-level display/sound/help | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |
| Stop/end treatment            | Pending — not supplied      | Pending — not supplied  | Pending — not supplied            | Pending — not supplied         | Pending        |

- [ ] Procedure and Operations vocabulary and transitions match the target configuration.
- [ ] Setup, prime, review, connect, and start gates are mapped and tested.
- [ ] Only reviewed curriculum-required user-level tools are included.
- [ ] Administrator, service, connectivity, remote-control, and unsupported configuration surfaces
      remain outside the module.

## 10. Pressure, fluid-management, display, and history behavior

| Field                                                              | Required response      | Evidence/reference     | State   |
| ------------------------------------------------------------------ | ---------------------- | ---------------------- | ------- |
| Exact displayed pressure names, order, units, and sign conventions | Pending — not supplied | Pending — not supplied | Pending |
| Pressure operating-point behavior by therapy/set/flow              | Pending — not supplied | Pending — not supplied | Pending |
| Configurable pressure limits and adjustment permissions            | Pending — not supplied | Pending — not supplied | Pending |
| Filter pressure-drop calculation/display behavior                  | Pending — not supplied | Pending — not supplied | Pending |
| TMP calculation/display behavior                                   | Pending — not supplied | Pending — not supplied | Pending |
| Effluent-target calculation and absent-pump contribution behavior  | Pending — not supplied | Pending — not supplied | Pending |
| Patient-fluid-removal terminology and calculation                  | Pending — not supplied | Pending — not supplied | Pending |
| Catch-up/gain-loss terminology and calculation                     | Pending — not supplied | Pending — not supplied | Pending |
| Displayed prescribed-versus-delivered dose behavior                | Pending — not supplied | Pending — not supplied | Pending |
| Treatment, delivery, interruption, downtime, and set-time behavior | Pending — not supplied | Pending — not supplied | Pending |
| History categories, units, time windows, and export behavior       | Pending — not supplied | Pending — not supplied | Pending |
| Temperature fields and behavior, if present                        | Pending — not supplied | Pending — not supplied | Pending |

- [ ] Device-displayed fluid removal is distinguished from whole-patient balance in device wording,
      local policy, cases, and scoring.
- [ ] Pressure limits are treated as configuration-dependent device behavior, not universal clinical
      normals.
- [ ] Any unresolved source conflict remains inactive and is recorded in the discrepancy log.

## 11. Alarm and help behavior

Create one row for every alarm family used in the pilot, planned cases, or rapid safety drills. Use
short paraphrases in module content; keep exact source wording in controlled review evidence only.

| Exact local alarm name/code | Trigger and configured threshold | Priority/text/icon/sound | Pumps stopped or continued | Clamps/device reaction | Acknowledge/pause/reset behavior | Cause-clear behavior   | Help/source location   | Escalation/end/service behavior | Reviewer/state |
| --------------------------- | -------------------------------- | ------------------------ | -------------------------- | ---------------------- | -------------------------------- | ---------------------- | ---------------------- | ------------------------------- | -------------- |
| Pending — not supplied      | Pending — not supplied           | Pending — not supplied   | Pending — not supplied     | Pending — not supplied | Pending — not supplied           | Pending — not supplied | Pending — not supplied | Pending — not supplied          | Pending        |

At minimum, disposition each curriculum alarm family as implemented, planned, excluded, or not
applicable:

- [ ] Access pressure/access dysfunction.
- [ ] Return pressure and return disconnection.
- [ ] Filter pressure/TMP trend.
- [ ] Effluent pressure or delivery.
- [ ] Air detection.
- [ ] Blood-leak detection.
- [ ] Bag/scale, empty container, gain/loss, and leak behavior.
- [ ] Power interruption/restart behavior.
- [ ] Wrong or incompatible set/solution configuration.
- [ ] Repeated unresolved alarms requiring end-treatment or service escalation.

Additional confirmations:

- [ ] Alarm acknowledgement is documented separately from correction of the underlying cause.
- [ ] Each priority's visible, audible, help, acknowledge, silence/pause, and system-reaction behavior
      is verified on the target configuration.
- [ ] Exact thresholds, alarm names, pump/clamp consequences, and clearing rules are not inferred from
      another market, software version, set, or device generation.
- [ ] Local cause-first troubleshooting and escalation policy is linked without being presented as
      intrinsic machine behavior.
- [ ] User-facing help is mapped; service-only and administrator-only help remains excluded.

## 12. Stop, interruption, end treatment, and blood disposition

Record device behavior and clinical policy in separate columns.

| Workflow/decision                        | Exact device labels and sequence | Pump/clamp/circuit behavior | Resume/reload consequences | Device alarms/help     | Local policy/role authority | Evidence/state |
| ---------------------------------------- | -------------------------------- | --------------------------- | -------------------------- | ---------------------- | --------------------------- | -------------- |
| Temporary interruption                   | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Stop treatment                           | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| End treatment                            | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Recirculation, if supported              | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Return blood                             | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Discard/do not return blood              | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Set unload/disposal                      | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |
| Restart/new-set/new-treatment transition | Pending — not supplied           | Pending — not supplied      | Pending — not supplied     | Pending — not supplied | Pending — not supplied      | Pending        |

- [ ] Return-blood versus discard decisions are sourced to a controlled local policy and named
      clinical reviewers; no universal decision rule is inferred.
- [ ] The exact device prompts, irreversible actions, confirmation dialogs, and safe reset behavior
      are reviewed on the installed configuration.
- [ ] Stop/end behavior is tested independently from browser case reset and clean-state behavior.

## 13. Local controlled policies and operational decisions

Attach or cite each applicable controlled document. A title without version, effective date, owner,
and hash is insufficient for an actionable local profile.

| Policy/profile                             | Exact title and owner  | Version/effective/review dates | File SHA-256           | Applicable market/unit/roles | Required module behavior | Clinical reviewer/state |
| ------------------------------------------ | ---------------------- | ------------------------------ | ---------------------- | ---------------------------- | ------------------------ | ----------------------- |
| Adult CRRT operations/prescription         | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Device setup/prime/connect/start           | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Set/solution selection and verification    | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Non-citrate anticoagulation                | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Citrate/calcium                            | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Alarm troubleshooting/escalation           | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Bag/scale/syringe change                   | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Interruption/downtime documentation        | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Stop/end/return-blood/discard              | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Monitoring, reassessment, and escalation   | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Medication-clearance content, if included  | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Nutrition/electrolyte content, if included | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |
| Competency-credit policy                   | Pending — not supplied | Pending — not supplied         | Pending — not supplied | Pending — not supplied       | Pending — not supplied   | Pending                 |

## 14. Administrator, service, connectivity, and data exclusions

This worksheet records only the existence and educational disposition of excluded surfaces. Do not
capture their protected implementation details.

| Surface/decision                               | Exists on target configuration | Included in learner module | Required disposition/evidence                                    | State   |
| ---------------------------------------------- | ------------------------------ | -------------------------- | ---------------------------------------------------------------- | ------- |
| Password-protected administrator configuration | Pending — not supplied         | Pending — not supplied     | Must remain excluded; no credentials or settings recorded        | Pending |
| Manufacturer/service mode                      | Pending — not supplied         | Pending — not supplied     | Must remain excluded; no service procedure recorded              | Pending |
| Network/connectivity configuration             | Pending — not supplied         | Pending — not supplied     | Must remain excluded; no address, topology, or secret recorded   | Pending |
| Remote control or remote device operation      | Pending — not supplied         | Pending — not supplied     | Must remain excluded                                             | Pending |
| Data export/interface configuration            | Pending — not supplied         | Pending — not supplied     | Record only product/privacy disposition, not protected endpoints | Pending |
| Unsupported optional configuration             | Pending — not supplied         | Pending — not supplied     | Disabled or absent from profile                                  | Pending |

- [ ] The module contains no service, administrator, password, network-configuration, or remote-control
      simulation.
- [ ] Supporting screenshots/exports contain no credentials, IP addresses, hostnames, network
      topology, device secrets, PHI, or patient records.
- [ ] Any learner-facing user-level lock, sound, display, history, or help control is separately
      reviewed and is not a disguised administrator surface.

Record the local product/data decisions needed for Phase 7:

| Decision                                                 | Required response      | Owner/evidence         | State   |
| -------------------------------------------------------- | ---------------------- | ---------------------- | ------- |
| Pilot entitlement/cohort and access duration             | Pending — not supplied | Pending — not supplied | Pending |
| Intended roles and competency-credit eligibility         | Pending — not supplied | Pending — not supplied | Pending |
| Supervision and hands-on requirements                    | Pending — not supplied | Pending — not supplied | Pending |
| Detailed CRRT progress remains local-only or syncs       | Pending — not supplied | Pending — not supplied | Pending |
| Approved authenticated learning-record fields            | Pending — not supplied | Pending — not supplied | Pending |
| Telemetry fields, retention, access, and deletion policy | Pending — not supplied | Pending — not supplied | Pending |
| Support, incident, withdrawal, and rollback process      | Pending — not supplied | Pending — not supplied | Pending |
| Unlisted status permanent or publication-state-derived   | Pending — not supplied | Pending — not supplied | Pending |

## 15. Exact candidate and evidence version lock

All reviewers must review the same immutable candidate. Compute hashes from the exact files or
artifacts delivered for review; do not copy an earlier build's identifiers.

| Candidate/evidence item                           | Exact version/revision | Git commit/tag or source ID | SHA-256/content hash   | Generated/observed date | Custodian/evidence location | Reviewer/state |
| ------------------------------------------------- | ---------------------- | --------------------------- | ---------------------- | ----------------------- | --------------------------- | -------------- |
| Repository release commit                         | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Release branch/tag and clean-worktree attestation | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Deployable build artifact                         | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Deployed pilot URL/build ID                       | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| PrisMax device profile ID/version                 | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Pilot/full content version and registry           | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Engine version/state schema                       | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Progress schema/migration version                 | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Source registry/source matrix                     | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Exact local PrisMax manual/IFU PDF                | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Supplied AW8035 comparison copy                   | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Local CRRT protocol bundle                        | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Local citrate/calcium profile, if applicable      | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Local solution formulary/profile                  | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Automated test and build evidence                 | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |
| Browser/accessibility evidence package            | Pending — not supplied | Pending — not supplied      | Pending — not supplied | Pending — not supplied  | Pending — not supplied      | Pending        |

- [ ] Profile, content, engine, sources, policies, tests, browser evidence, and deployed build resolve to
      one frozen review candidate.
- [ ] Reviewers confirm the hashes above before recording findings or dispositions.
- [ ] A documented change-control rule identifies which changes invalidate which reviews.

## 16. Reviewer identity and scope

For each reviewer, record full name, professional role, organization, relevant credentials or
training, declared scope, conflict/independence statement, and contact location in the controlled
review record. Do not place unnecessary personal contact details in the repository.

| Required reviewer                                     | Identity               | Credentials/training evidence | Organization/role      | Assigned scope         | Conflict statement     | Review date            | Candidate hash confirmed | Decision/state |
| ----------------------------------------------------- | ---------------------- | ----------------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------ | -------------- |
| CRRT-experienced nephrologist                         | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending        |
| Critical care physician                               | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending        |
| CRRT nurse educator                                   | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending        |
| PrisMax-trained device reviewer                       | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending        |
| Pharmacist for affected content                       | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Nutrition/electrolyte specialist for affected content | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Accessibility reviewer                                | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Localization reviewer                                 | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Privacy/data steward                                  | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Product owner/pilot authorizer                        | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending                  |
| Publication/release approver                          | Pending — not supplied | Pending — not supplied        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied   | Pending        |

## 17. Discrepancy and unresolved-input log

Every inconsistency among the installed device, local documentation, repository profile, module
behavior, tests, or reviewer observation must remain open until adjudicated. Add rows as needed.

| Finding ID             | Configuration field/source IDs | Observed discrepancy or missing input | Safety/content impact  | Required action        | Owner                  | Evidence               | Disposition/state |
| ---------------------- | ------------------------------ | ------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ----------------- |
| Pending — not assigned | Pending — not supplied         | Pending — not supplied                | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Open/pending      |

- [ ] Every active numeric threshold, device action, alarm consequence, critical-error rule, solution,
      compatibility claim, and market-specific feature has matching exact-configuration evidence.
- [ ] Disputed formulas and unmatched market/device-generation claims remain inactive.
- [ ] Consequential findings have been corrected, retested, and re-reviewed against a newly frozen
      candidate where required.

## 18. Gate disposition

Initial disposition: `NOT READY — all inputs and approvals pending`.

Formal PrisMax device review may begin only when Sections 1-15 contain exact, evidenced responses
for the target configuration and a named PrisMax-trained reviewer accepts the review assignment for
the frozen candidate.

Phase 7 may begin only after:

- [ ] The exact three-case pilot candidate receives formal pilot acceptance after every mandatory
      canonical domain record is accepted, including separate privacy/data-governance,
      entitlement/security, product-owner, and publication-approval attestations.
- [ ] The exact local PrisMax market, installed program/software, configuration, therapies, sets,
      accessories, pumps/scales/syringe behavior, Auto Effluent state, solutions, anticoagulation,
      alarm/help behavior, and stop/end/blood-return behavior are resolved in a reviewed device
      profile.
- [ ] Applicable local policies and their hashes are recorded and approved.
- [ ] Intended learner roles, competency-credit boundary, entitlement, progress, telemetry, support,
      and publication-state decisions are approved.
- [ ] All consequential findings are closed and the frozen candidate passes the required automated,
      browser, accessibility, clinical, and device review evidence.
- [ ] The product owner explicitly authorizes Phase 7 curriculum expansion for that exact candidate.

The citrate pathway has an additional independent gate: every Section 8.2 input and approval must be
complete before citrate controls or CRRT-17 can be activated.

| Decision field                         | Required response      | Decision owner         | Candidate/version      | Date/evidence          | State   |
| -------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ------- |
| PrisMax configuration package complete | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending |
| Formal device review authorized        | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending |
| Pilot accepted                         | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending |
| Phase 7 expansion authorized           | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending |
| Citrate pathway authorized             | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending — not supplied | Pending |

No approval, readiness, installed value, or local practice is asserted by this blank worksheet.
