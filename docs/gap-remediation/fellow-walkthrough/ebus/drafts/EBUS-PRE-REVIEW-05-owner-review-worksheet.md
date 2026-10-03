# EBUS-PRE-REVIEW-05 — OWNER DECISION REVIEW

Prepared 2026-10-03 from `origin/main` **60e3bd642a92fc25714141ad8e6c8d877510f8e7**.
**18 decision groups: Tier 1 = 4; Tier 2 = 12; Tier 3 = 2.**
Owner decisions recorded 2026-10-03 from Russell Miller's explicit instructions: **OD-01 OPTION A;
OD-02 OPTION A (true vascular flow), annotation RETAIN CURRENT; OD-03 APPROVE WITH EDIT / MODIFY;
OD-04A APPROVE MEDIA by owner attestation; OD-04B HOLD for historical Git policy.**

Use the checkboxes under **Decision requested**; record any edit, scope limitation, reviewer/role,
and actual decision date there. OD-01–OD-04 instead record **Owner decision / Owner disposition**
below. All other unchecked choices remain **NOT REVIEWED**. A decision about one subpart does not
approve the others. HOLD preserves an unresolved issue within its stated scope. These are owner
review priorities, not learner progression gates.

Evidence references below: [Packet](EBUS-PRE-REVIEW-05-decision-packet.md),
[Drafts](EBUS-PRE-REVIEW-05-teaching-drafts.md),
[Manifest](EBUS-PRE-REVIEW-05-asset-source-manifest.json), and
[Status](EBUS-PRE-REVIEW-05-status.json). Source verification is carried forward from their
2026-09-23 review; no new literature review occurred here. The owner decisions below are recorded
from the current instructions; they do not upgrade literature verification. **Source fact**,
**course/model behavior**, **draft wording**, **engineering observation**, **local-protocol
dependency**, **media/rights dependency**, and **owner clinical judgment** remain distinct.
Course content files have no diff between the packet baseline `85acc113` and this baseline;
engineering observations below are attributed to the packet, not newly measured.

Two existing owner decisions are preserved: fasting is required (OD-10), and the Depth3 metadata
finding was reviewed (OD-04). Per the owner's current task instructions, Depth3 redaction was
merged, the production object replaced, stable cache versioning merged, and browser-cache
remediation completed. This supersedes the packet's stale “candidate/not yet published” language
only. The subsequent OD-04A owner attestation resolves the rights/provenance hold for current
clinical course media; OD-04B holds historical repository cleanup/removal policy. Other asset-specific
de-identification reviews are not declared complete. PRs #316/#322 are **CLOSED** engineering work.
Their repairs are not reopened. Prompt 06 is not started by this worksheet; this is not Prompt 06.
Elsewhere, recorded media UNKNOWN/input-required statuses describe the source packet's evidence or
proposed additions; OD-04A governs rights/provenance of current clinical course media. Image identity,
annotations, unused/new media, and source-verification holds remain unresolved unless decided below.

## TIER 1 — Must decide before Prompt 06

Only existing evidence/claim mismatches, accepted sequence behavior, and disposition of media
already in use are here. The owner may explicitly HOLD an affected portion out of Prompt 06;
that does not block unrelated scoped work or confer whole-course acceptance.

### OD-01

**ID:** OD-01

**Topic:** L5-1 held-image/question alignment.

**Why owner input was required:** The question assumes a reflector image, while the held condition
can differ. Choosing the teaching intent determines later question and acquisition behavior.

**Current state:** Runtime still asks “Why did changing gain fail to remove the dark region behind
the reflector?” The learner inspects five conditions but may hold any one; gain is raised in the
air-gap step. The mismatch note and evidence contract remain. The owner has selected the
condition-neutral comparison; runtime implementation is pending a separate task.

**Verified evidence:** Course/model behavior: Drafts R4 and Packet §6. The recorded Prompt-04
engineering comparison distinguishes shadow in the echo schematic only; the 3D reflector and
direct-contact views were identical. The owner selection is a teaching decision, not new source verification.

**Draft/proposed option(s):** Options considered; the selection is recorded below.

| Choice                                        | Learner problem addressed                                                                            | Later content/runtime burden                                                                 | Self-paced effect / wording review                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A — condition-neutral mechanism comparison    | Compares air gap at the transducer with attenuation beyond a reflector, regardless of the held state | Adopt/review R4 wording; decide held-image policy and question identity in a later batch     | No new gate; existing mechanism wording needs final review, no new clinical claim proposed                               |
| B — retain question and mismatch note         | Explains why the question and held image differ; leaves the mismatch unresolved                      | No new content or runtime burden                                                             | Preserves current self-paced behavior; no additional clinical wording                                                    |
| C — variants matched to actual held condition | Makes the check refer to the learner's evidence                                                      | Five authored variants, condition routing, review of each rationale and evidence association | Can remain self-paced; additional condition-specific clinical/teaching wording required                                  |
| D — require reflector before checking         | Ensures the frame matches the question; does not itself establish that gain was changed there        | New acquisition gate and revised instructions/acceptance logic                               | Previously considered undesirable because it changes self-paced policy; additional rationale and wording review required |

**Dependencies / holds:** Final wording and held-image policy/question identity are later scoped
content/engineering work. No runtime, ID, key, gate, or evidence contract changes occur here.

**Owner decision:** **OWNER DECISION: OPTION A** — Russell Miller, repository owner; recorded
2026-10-03 from the current instructions. Use the condition-neutral air-gap versus reflector
mechanism comparison. This resolves the held-image mismatch in the chosen teaching design without
creating an acquisition gate or requiring multiple condition-specific variants.

### OD-02

**ID:** OD-02

**Topic:** Doppler purpose, interpretation, and annotations.

**Why owner input was required:** The current answer asserts detected flow in this recording;
clinical interpretation of the asset required an owner decision.

**Current state:** Lesson 8 uses `Depth4_Color_Flow`, 32–34 s of `Depth4.mp4`; Doppler-off uses
6–8 s. The key says color represents detected flow. The course teaches “Absent color is not
clearance for puncture.” The owner has resolved the current clip's interpretation as true vascular
flow and chosen to retain the current unlabeled task initially. Runtime/media remain unchanged.

**Verified evidence:** Packet §1a records generic course teaching and a roughly one-second
box-filling color episode with compact/near-zero intervals. Pixel counts do not establish clinical
interpretation; **true vascular flow is the owner's current clinical judgment**. The packet records
no separate primary-source verification of the exact absent-color sentence. No local/device color
convention or acquisition settings are newly verified.

**Draft/proposed option(s):** Options considered: A vascular-flow demonstration; B artifact
teaching; C both; D unsuitable/replacement. Annotation options were expert labels, retained
unlabeled task, or hold. The selected dispositions are below; no frame selection or annotation is
required by the owner's initial choice to retain the current task.

**Dependencies / holds:** OD-04A records rights/provenance approval by owner attestation. New
frame-specific labels or settings/color-direction teaching require separate review and device
evidence where applicable. The absent-color safety principle remains; no vessel/target label or
safe puncture path is assigned by this worksheet. Asset-specific de-identification limits remain.

**Owner decision:** **OWNER DECISION: OPTION A** — Russell Miller, repository owner; recorded
2026-10-03 from the current instructions. The Doppler clip represents **true vascular flow**.
This resolves clinical interpretation of the current clip as a vascular-flow demonstration.

Annotation field: **RETAIN CURRENT** — retain the current unlabeled task initially. No new
annotations or lesson/media changes are implemented in this pass.

### OD-03

**ID:** OD-03

**Topic:** Lesson-20 clinical sequence and needle workflow.

**Why owner input was required:** Accepted ordering affects learner feedback; protected assembly
preparation and exposing/advancing a needle must not be treated as interchangeable steps.

**Current state:** Runtime orders target/live-image/path confirmation before protected assembly
preparation per the IFU; reversed order receives “Reconsider the order.” The owner has modified
the wording concept below. Accepted sequence behavior has not been changed in this recording pass.

**Verified evidence:** Packet §4 / Manifest L20-2/L20-3: no primary source fixes the order of the
first two checkpoints. CHEST 2016 and ICS/IAB 2023 verify some elements, including optional
suction/stylet use, not a universal pass sequence or local workflow. The approved wording below
is an owner content decision, not newly verified procedural guidance.

**Draft/proposed option(s):** D9 originally placed confirmation before needle preparation “so a
lost target never meets an exposed needle.” Alternatives were enforcing that order, accepting more
than one order, retaining behavior, or holding for protocol. The owner modified this concept to
distinguish protected preparation from exposure/advancement, as recorded below.

**Dependencies / holds:** Detailed sheath/stylet/suction technique remains **IFU/local-protocol
dependent**. Optional sourced-element additions remain undecided. Any later accepted-sequence
implementation requires its own scoped review; this decision does not itself change runtime behavior.

**Owner decision:** **OWNER DECISION: APPROVE WITH EDIT / MODIFY** — Russell Miller, repository
owner; recorded 2026-10-03 from the current instructions. Owner-approved concept:

> Protected needle/assembly preparation may occur according to the device and local workflow.
> Confirm the intended target, live ultrasound image, and an acceptable vascular path immediately
> before needle exposure and advancement.

The owner does not want wording that incorrectly equates protected preparation with unsafe
premature needle exposure. This is a wording/content decision only, not an implementation step.

Optional sourced elements: ☐ APPROVE ☐ APPROVE WITH EDIT: `______` ☐ RETAIN CURRENT ☐ HOLD

### OD-04

**ID:** OD-04 (sub-decisions OD-04A and OD-04B)

**Topic:** Current media rights/provenance and historical Git cleanup/removal policy.

**Why owner input was required:** Permission to use current media required an owner attestation;
historical repository-object policy required a separate disposition. Technical redaction alone
could not decide either issue.

**Current state:** Depth3's metadata finding was owner-reviewed; redacted serving copies,
production-object replacement, stable cache versioning, and browser-cache remediation are
**COMPLETED**. Current clinical course media rights/provenance are now approved by owner attestation
(OD-04A). Historical Git cleanup/removal policy remains **HOLD** (OD-04B).

**Verified evidence:** Packet §1c records the 2026-09-24 metadata review and separate technical
screenshot review. The Manifest's UNKNOWN rights/provenance entries are the earlier record;
OD-04A supersedes that hold for the current clinical videos/images through an explicit owner
attestation, not an independent provenance audit. Replacing serving copies does not remove
historical Git objects. Other asset-specific de-identification findings retain their documented scope.

**Draft/proposed option(s):** Current-media options were substantiated permission/provenance,
restriction/replacement, or hold. History options were accepting the old blob remaining,
commissioning an intentional purge, another remediation route, or hold. The two selected
sub-decisions follow; no cleanup/removal action is authorized or performed here.

**Dependencies / holds:** Current-media permission does not retroactively declare every asset's
de-identification review complete. Source-CT audit, unused/proposed media, and rights of documentation
screenshots outside current clinical course use are not newly approved. Historical remediation/policy
remains a separate task; it does not reopen the completed technical redaction remediation.

**Owner disposition:** Russell Miller, repository owner; recorded 2026-10-03 from the current instructions.

**OD-04A — Current media rights/provenance: OWNER DECISION: APPROVE MEDIA.** Owner attestation:

- The clinical videos and images used in the EBUS course are owner-provided and/or owner-controlled materials.
- The owner has permission to use them for this educational course.

This resolves the rights/provenance hold for the current media as an **owner attestation**. It does
not retroactively declare every asset de-identification review complete beyond already documented
asset-specific findings. The Depth3 technical metadata issue was already remediated.

**OD-04B — Historical Git object: OWNER DECISION: HOLD.** The historical unredacted Git object
remains a separate remediation/policy task. Current serving copies have already been remediated;
this hold applies only to historical repository cleanup/removal policy and does not reopen the
technical redaction remediation.

## TIER 2 — Can remain held through Prompt 06 if explicitly documented

These proposals can remain excluded while current behavior and its limitations remain documented.
A HOLD does not approve an image, definition, clinical claim, or local workflow.

### OD-05

**ID:** OD-05

**Topic:** Orientation, scope axis, ultrasound plane, and processor caveat.

**Why owner input is required:** Model facts need clear wording without implying a clinical device convention.

**Current state:** No explicit 0° reference or image head/foot marker. D4/D5 are drafts.

**Verified evidence:** Packet §3 / Manifest L3-14/L3-15: model 0° is the preset's authored depth
axis carried along the centerline; the sector plane contains the shaft and model image-right
points toward the head. No Olympus/Fujifilm display convention is verified. General clinical
plane wording still needs a source if stated beyond this model.

**Draft/proposed option(s):** D4 describes the plane along the scope and says “In this model,
image right is toward the patient's head; check the orientation convention of the processor you
use.” D5 says “0° is the direction the assisted start faces the target; it is not an anatomical
direction.” Alternative precision edit for review: “In this model, 0° is the preset's authored
depth axis; it is not a universal anatomical direction.” Optional model-only head/foot marker.

**Dependencies / holds:** Faculty wording choice; verified device documentation before any
processor-specific rule. Defer markers/general clinical claim while preserving model-only scope.

**Decision requested:** Wording: ☐ APPROVE D4/D5 as drafts ☐ APPROVE WITH EDIT: `______`
☐ RETAIN CURRENT ☐ HOLD. Marker: ☐ APPROVE ☐ HOLD ☐ OTHER: `______`

### OD-06

**ID:** OD-06

**Topic:** Model fidelity, station representation, and measurement limits.

**Why owner input is required:** Fellows must not infer clinical calibration from model visibility,
coordinates, or practice calipers.

**Current state:** Broad rotation windows; model labels simplify anatomy. Phantom reference exists;
recorded-frame calipers measure pixels. No clinical accuracy score or expert recording caliper.

**Verified evidence:** Packet §3 records an RMS model window of −71° to +49°, driven by label
geometry/visibility, not a clinical tolerance. The phantom central elongated section is 16/32
phantom mm. Lesson-10 measurements have no verified pixel-to-mm calibration. These are model/code
facts, not source-verified patient measurements; Prompt-03 status repairs remain closed.

**Draft/proposed option(s):** D6: “In this model the target stays visible over a wide rotation
range because the modeled node is large and close to the airway. Do not read the range as the
rotation a real node tolerates.” Retain with explicit limitations, or commission later calibration.
Optional phantom reference/difference and reflection after recording, without scoring; label
coordinates “phantom mm” and origin, or hide them. Keep recorded calipers as control practice.

**Dependencies / holds:** No clinical calibration may be implied. Recalibration needs real evidence;
expert overlays need attributable annotation plus verified calibration. Optional measurement
feedback and station-model enrichment can remain held without changing geometry or thresholds.

**Decision requested:** Model: ☐ APPROVE D6 ☐ APPROVE WITH EDIT ☐ RETAIN CURRENT ☐ HOLD /
commission evidence: `______`. Phantom: ☐ APPROVE reference/reflection ☐ LABEL units ☐ HIDE fields
☐ RETAIN CURRENT ☐ HOLD. Recorded calipers: ☐ RETAIN CURRENT ☐ HOLD proposed overlay

### OD-07

**ID:** OD-07

**Topic:** Station/anatomy imagery, Storyboard A, per-view anatomy, and optional image teaching.

**Why owner input is required:** The owner/faculty must assign or approve anatomy; filenames and
existing colored regions do not verify station identity.

**Current state:** No new image panels are approved. Difficult 4L model identity is separate from
real 4R/4L still orientation and disc meaning. L17-5 ovals have no station identity; L19-2 has only
generic per-route statements.

**Verified evidence:** Packet §§1b–3 and Drafts Storyboard A inventory existing model presets and
unverified stills. Model labels include `station_4l` and `aorta`, not a separate arch or sided
pulmonary artery. Those are authored model IDs, not newly assigned clinical labels.

**Draft/proposed option(s):** Choose format/scope by row; no anatomical assignment is made here.

| Use                                                    | Model sufficient as an option?                                                                    | Clinical image / review needed                                                                                                            | Rights/provenance dependency                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Storyboard A: 2R/4R/10R relationships                  | Yes for a labeled model comparison, after faculty target/boundary review and 2R/10R window checks | CT comparison needs attributable orientation and annotation                                                                               | OD-04; source CT clearance also unverified                          |
| Difficult 4L view                                      | Post-acquisition model-label reveal, or retain unlabeled                                          | Any real-image identity requires expert reading                                                                                           | Separate model/source-CT and real-image clearance                   |
| 4R/4L discs, per-view orientation, internal CT ID      | Model cannot establish what the still's disc means                                                | Supply annotation; retain as is with unresolved status; or withdraw disc stills. Owner decides whether internal ID text should be removed | UNKNOWN; no edit here                                               |
| L17-5 ovals / L19-2 route anatomy                      | Faculty may assign ovals / review relations derived from exact mesh IDs                           | No current per-view relations verified; no inferred labels or premature case answers                                                      | Model/source-CT limits remain                                       |
| Optional 2L; hilar/interlobar; stations 8/9; CT primer | Reviewed model/schematic may suffice; keep existing refresher links is an option                  | 2L target review; hilar still identities unverified (10L pair possibly swapped, 11Ri disc inconsistency); no 8/9 images                   | Clinical stills need rights and identity; no mandatory tab visiting |
| Node features / replacement of geometry diagram        | Geometry cannot substitute for clinical morphology evidence                                       | Pathology-confirmed, expert-annotated stills required for the proposed clinical feature panels                                            | ASSET REQUIRED; source and rights review                            |

**Dependencies / holds:** Expert image annotation and media approval are separate. No synchronized
CT/model claim: packet reports no registration. All optional enrichment may remain held; OD-04
still governs disposition of media currently used. Fujiwara/CLNS naming also depends on OD-11.

**Decision requested:** Identify row(s): `______` ☐ APPROVE model-only proposal ☐ SUPPLY/APPROVE MEDIA
☐ RETAIN CURRENT ☐ HOLD ☐ MODIFY: `______`

### OD-08

**ID:** OD-08

**Topic:** Storyboard B / acquisition troubleshooting and real needle imagery.

**Why owner input is required:** The course needs an owner choice of teaching format; clinical
recordings must actually show the proposed failure.

**Current state:** Existing model states support coupling loss, reflector shadow in the echo
schematic, and shaft-visible/tip-lost teaching. No verified real needle still or shallow-depth
example. L6-2 also lacks expert target/far-margin identification in each depth recording.

**Verified evidence:** Drafts B: B1/B2/B5 are model-derived. B3 `Depth4_Gain_8` at 14–16 s is
_authored_ as washed-out, not independently clinically verified. B4 candidate Depth2/Depth3 gain-4
far-margin truncation is unconfirmed. B6 Doppler is excluded pending OD-02.

**Draft/proposed option(s):** Approve model panels; commission expert-confirmed B3/B4 and a real
needle-in-plane still (L20-6); or hold. Recorded teaching needs real reviewed imagery, while model
mechanisms can use existing states. Limit integrated-case imagery to decisions helped by a picture;
other text-only cases may stay text-only.

**Dependencies / holds:** OD-04 clearance, faculty interpretation/annotation, missing B4 asset.
Separate example state must never write learner acquisitions, held evidence, drafts, or progress.
Optional panels can remain held; no stand-in clinical image.

**Decision requested:** ☐ APPROVE model panels only ☐ SUPPLY/APPROVE MEDIA for depth annotations/B3/B4/needle
☐ RETAIN CURRENT ☐ HOLD ☐ MODIFY: `______`

### OD-09

**ID:** OD-09

**Topic:** Specific harm and bleeding/emergency-response language.

**Why owner input is required:** General safety teaching does not specify an institutional response.

**Current state:** “An exposed tip can harm the patient or the equipment”; “initiate the team's
airway and bleeding response.” No authorized local bleeding protocol supplied.

**Verified evidence:** Packet §4 / Prompt-04 Q1: retraction/locking elements have source support;
channel/scope damage and airway injury wording was not verified against a device IFU.

**Draft/proposed option(s):** Q1: “An exposed tip can damage the working channel and the scope,
or injure the airway” — held for source/faculty review. D7 append: “The specific response follows
your institution's protocol and is practiced in hands-on training.” Retain general safety wording
while holding exact institutional response details.

**Dependencies / holds:** Specific-harm source or attributable faculty statement; authorized local
response protocol for any detail. No medication reversal, escalation pathway, or emergency steps
invented. R9's possible resumption scenario requires separate faculty judgment under OD-15.

**Decision requested:** Harm wording: ☐ APPROVE WITH EDIT and source: `______` ☐ RETAIN CURRENT ☐ HOLD
Boundary D7: ☐ APPROVE ☐ APPROVE WITH EDIT ☐ RETAIN CURRENT ☐ SUPPLY LOCAL PROTOCOL ☐ HOLD

### OD-10

**ID:** OD-10

**Topic:** Fasting, antithrombotics, and preparation policy.

**Why owner input is required:** Fasting wording can be finalized; exact intervals and drug-specific
examples require the applicable policy.

**Current state:** **OWNER DECIDED, Russell Miller, 2026-09-24: patients should not eat or drink
before EBUS; fasting is required.** This is not offered for reconsideration. Current teaching
reviews fasting status and directs intervals, drug holds, airway devices, and sedative doses to
local guidance.

**Verified evidence:** Packet §4a records the owner decision. Packet §4 documents ACCP 2022 as
general perioperative guidance, BTS 2013 as partial and excluding EBUS, and ICS/IAB 2023 as
EBUS-specific; these do not supply an authorized local schedule. Existing private institutional
references were not authorized as this course's policy.

**Draft/proposed option(s):** D10: “Patients should fast before EBUS. Follow the applicable
anesthesia and local procedural policy for the required fasting interval.” Keep drug handling
individualized; add aspirin/P2Y12/DOAC examples only after authorized policy and owner scope choice.

**Dependencies / holds:** Exact fasting interval and drug-hold details: **LOCAL PROTOCOL REQUIRED**.
No interval or dose inferred. Specific policy additions may remain held while generic preparation
teaching and the fasting-required owner decision are preserved.

**Decision requested:** Final D10 wording only: ☐ APPROVE ☐ APPROVE WITH EDIT: `______` ☐ HOLD wording
Policy-specific additions: ☐ SUPPLY LOCAL PROTOCOL ☐ RETAIN CURRENT generic guidance ☐ HOLD

### OD-11

**ID:** OD-11

**Topic:** Source-dependent claims and source-registry wording.

**Why owner input is required:** Verification supports bounded claims; it does not approve course
wording, select a device, or authorize local practice.

**Current state:** Source statuses below are copied from Prompt-05, not upgraded. Current source
claims can remain while unsupported additions stay held.

**Verified evidence:** Packet §4 and Manifest `sources` (retrieved 2026-09-23):

| Claim/source                                     | Recorded verification and limit                                                                                                                                                                                              | Current / proposed choice for review                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026 ERS/ESGE/ESTS, L26-4                        | Full text; PICO 4 supports a **strong recommendation against routine add-on confirmatory mediastinoscopy after negative systematic endosonography, low certainty**; may still be considered when false-negative risk is high | Current “no longer recommends routine”; D1 closer paraphrase “recommends against routine add-on confirmatory mediastinoscopy” plus high-risk qualification; retain the negative-systematic premise |
| CHEST sampling, L22-3                            | Full text, recs 3–5 directly checked: suspected malignancy; ROSE and 21/22G over 19G conditional/very low; ≥4 passes over ≤3 strong/very low, not conditional on absent ROSE                                                 | Retain current claims; D3 label “2024 online; Chest 2025.” Do not generalize to nonmalignant disease                                                                                               |
| Systematic/combined staging, L17-6 / related L18 | 2026 PICO 2 conditional/very low; PICO 3 combined approach conditional/moderate. ESTS 2014 **partial automated extraction**, not fully verified                                                                              | Retain current systematic/combined language. “When feasible” is a course qualifier. Do not turn >5 mm visualization/sampling feasibility into a sampling threshold                                 |
| Fujiwara 2010 / CLNS 2020                        | **ABSTRACT ONLY — FULL TEXT NOT VERIFIED**                                                                                                                                                                                   | Current feature-description teaching; hold named schemes/expanded claims until full-text review; morphology is not diagnosis                                                                       |
| AQuIRE 2013, L25-2                               | **ABSTRACT ONLY — FULL TEXT NOT VERIFIED**; definitions/co-procedures unchecked                                                                                                                                              | No benchmark currently; hold numerical benchmark until full-text/population review. Escalation-of-care associations must not become complication risk factors                                      |
| Device dimensions / IFU, L2-2                    | Olympus brochure read; **not an IFU**, no scope/needle revision supplied                                                                                                                                                     | Keep generic device/conduit language; name devices/dimensions only with selected device and verified IFU. No Olympus/Fujifilm convention inferred                                                  |
| Preparation references, L2-7                     | ACCP 2022 full text; BTS 2013 partial, flowchart unread, excludes EBUS; ICS 2023 full text                                                                                                                                   | Optional ACCP context with limits; optional BTS only explicitly as non-EBUS context; neither supplies local holds                                                                                  |

**Draft/proposed option(s):** Choose per row. D2 corrects the ERS guideline title; D3 corrects the
CHEST year label without changing source IDs. Older 2014/2015 guidance differs on surgical staging;
owner may choose to explain that conflict. `combined2015` was read through the ERJ co-publication,
not the registry's Thieme PDF; MEDIASTrial is an unread lead, not guideline verification. CHEST
2016/ICS 2023, IASLC ninth-edition N descriptors, and ACCP 2013 staging retain their recorded
full-text status; their workflow/case uses are bounded in OD-03/OD-13/OD-14.

**Dependencies / holds:** Missing full texts, IFU revisions, and local protocols stay missing.
HOLD affects the proposed addition, not permission to silently alter existing claims.

**Decision requested:** For **each unresolved row** (record row + choice): `______`
☐ APPROVE CURRENT WORDING ☐ USE PROPOSED WORDING ☐ HOLD FOR SOURCE ☐ MODIFY: `______`
Registry D2/D3 / older-guidance context: ☐ APPROVE ☐ APPROVE WITH EDIT ☐ RETAIN CURRENT ☐ HOLD

### OD-12

**ID:** OD-12

**Topic:** Glossary expansion (Prompt-04 Q4).

**Why owner input is required:** External definitions would relax the existing “course sentences only” rule.

**Current state:** Nine term groups remain unexpanded/undefined; D8 is **NOT REVIEWED**.

**Verified evidence:** Manifest NAV-3-Q4 / Drafts D8 record official expansion support except IFU
(search-result-only status). ICS/IAB 2023 Table 5 was read for CHS; Fujiwara's definition was not
verified in full text.

**Draft/proposed option(s):** Straightforward terminology: TNM — tumor, node, metastasis
classification; IASLC — International Association for the Study of Lung Cancer; NSCLC — non-small
cell lung cancer; PET — positron emission tomography; FNA — fine-needle aspiration;
ERS/ESGE/ESTS — European Respiratory Society / European Society of Gastrointestinal Endoscopy /
European Society of Thoracic Surgeons; CHEST — American College of Chest Physicians and its
guideline series (draft contextual wording). IFU — instructions for use, manufacturer document
(expansion still source-incomplete). Central hilar structure / CHS is source-dependent: D8 points
to ICS's linear, flat, hyperechoic central area; no Fujiwara-specific definition claimed.

**Dependencies / holds:** Full expansion may be approved in scope while IFU/CHS remain held for
source/wording review. No source status upgrade or automatic adoption.

**Decision requested:** ☐ FULL EXPANDED GLOSSARY, subject to stated holds ☐ ONLY COMMON
ABBREVIATIONS ☐ RETAIN CURRENT GLOSSARY ☐ MODIFY: `______` ☐ HOLD

### OD-13

**ID:** OD-13

**Topic:** Running case, provisional staging, report semantics, and carry-forward information.

**Why owner input is required:** A new declaration changes what learners record and potentially task acceptance.

**Current state:** Authored left-primary case: 4R node B has provisional malignant ROSE, final
pathology pending; node A is blood-only/nonrepresentative; station 7 has representative material
without malignancy. 4L was not sampled; 11L not examined. Existing report teaches these limits and
an incomplete examination. L12-6/L26-3 record/default repairs remain closed/current.

**Verified evidence:** Packet §5: IASLC ninth-edition N descriptors, Table 3, verified in full text.
“Nonrepresentative ≠ negative” is existing course teaching; the packet found no primary guideline
sentence for that wording. Case results are fictional supplied facts, not new clinical evidence.

**Draft/proposed option(s):** Add a learner-declared provisional-N prompt (initial “Not yet
declared”), with the draft choices “Provisional N3 pending final pathology,” “N3 confirmed,” and
“No N category can be stated”; these are proposed response choices, not findings. Optional
“What remains unestablished” field carries final pathology, unsampled/unexamined targets, and
ancillary uncertainty forward. Or keep current report options.

**Dependencies / holds:** Faculty approves meaning and whether the future field is optional or
requires a separately versioned task. Never auto-populate stage, final malignancy from ROSE,
management, or a negative result for node A; never overwrite genuine declarations. Optional new
fields may remain held without reopening reporting repairs.

**Decision requested:** ☐ APPROVE proposed optional field scope ☐ APPROVE WITH EDIT: `______`
☐ RETAIN CURRENT ☐ HOLD ☐ OTHER task-acceptance proposal: `______`

### OD-14

**ID:** OD-14

**Topic:** L22-6 specimen destinations and L23-3 laboratory media.

**Why owner input is required:** Missing destinations would be new case facts; a generic guideline
cannot supply the intended local specimen workflow.

**Current state:** L22-6 is **INSUFFICIENT EVIDENCE — HOLD**. The case gives requested studies and
results, not which specimen went where. The `s-4r-b` biomarker protocol is null; medium/quantity
and ancillary suitability require laboratory clarification. L23-3 says “laboratory-approved
sterile medium.”

**Verified evidence:** Packet §§4–5 / Manifest L22-6: no authored destination mapping. CHEST and
ICS media guidance was read but establishes no universal local default or case-specific destination.

**Draft/proposed option(s):** Owner supplies intended specimen-to-test/destination mapping as
explicit case facts and an authorized laboratory handling protocol, or retain HOLD. Keep current
laboratory-approved-medium wording until then.

**Dependencies / holds:** Cytopathology/local laboratory input for destinations, containers/media,
quantity and biomarker workflow. No inference from generic practice; not required while the
destination diagram and media defaults remain excluded.

**Decision requested:** ☐ SUPPLY LOCAL PROTOCOL / authored case mapping: `______` ☐ HOLD L22-6
L23-3: ☐ RETAIN CURRENT ☐ SUPPLY LOCAL PROTOCOL ☐ HOLD proposed media defaults

### OD-15

**ID:** OD-15

**Topic:** Question-revision classes and intentional retrieval (R1–R10).

**Why owner input is required:** The owner chooses pedagogic scope and reviews clinical distractors;
repetition alone is not a defect.

**Current state:** Ten representative drafts, not a bank rewrite. R4 is decided only in OD-01.
The recorded 45/108 longest-key observation is descriptive, not psychometric validation.

**Verified evidence:** Drafts §A and §C.2 distinguish these classes:

| Class                                                            | Representative review choice                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implausible distractor / worked example reworded / answer length | R1 replaces the probe-type distractor with a staging misconception; R2 clarifies which blood thinner was stopped; R5 moves the far-margin caveat to feedback |
| Stem supplies the answer                                         | R3 describes a conduit/ventilation setup; R6 describes anatomy instead of saying “subcarinal”                                                                |
| True duplicate                                                   | R7 follows matching with a new boundary case (11L → proposed 10R); R10 replaces repeated guideline recall with an unassessed-target scenario                 |
| Repeated vignette; useful retrieval                              | R8 varies morphology while preserving “describe, don't diagnose”; L22-4, contact-before-gain and cross-chapter absent-color retrieval are intentional        |
| Visible teaching supplies the answer                             | L7-2 worked settings and L8-3 key point stay visible; optional length balancing is separate. No concealment or mandatory attempts                            |
| Clinical application replacing a meta-question                   | R9 proposes team reassessment after a bleeding event; whether resumption belongs at this level is an owner/faculty judgment                                  |

**Draft/proposed option(s):** Apply selected revision classes; retain; modify; hold. Preserve L1-5's
three-way matching distinction, PR-1's useful laterality check, the granuloma misconception item,
and case 5's supplied-pathology interpretation unless explicitly changed. Storyboard A supplies
optional drill variety (OD-07); L21-5 repetition is linked to OD-16.

**Dependencies / holds:** R2 unsafe flag; R3 conduit wording; R6 anatomical limits; R7 boundary
review; R9 resumption/unsafe flag; R10 incomplete-examination scenario all require faculty choice.
New question identities/keys would need separately scoped work; none changes here. Visible teaching,
explanations, and self-paced access remain. Optional revisions can stay held.

**Decision requested:** Class(es)/draft exceptions: `______` ☐ APPLY PROPOSED REVISION CLASS
☐ RETAIN ☐ MODIFY: `______` ☐ HOLD

### OD-16

**ID:** OD-16

**Topic:** L21 recognition-first needle scenario.

**Why owner input is required:** Recognizing loss of tip/resistance changes the teaching task from
pressing a demonstration control to interpreting a supplied example.

**Current state:** Learners introduce resistance/change plane themselves; required model steps remain.

**Verified evidence:** Drafts §A.12 uses existing lost-tip and resistance model states and current
course safety text; no real clinical image or device-specific technique is verified by the model.

**Draft/proposed option(s):** Optional fixed sequence, “Example — not your acquisition”: pause at
loss of tip and then resistance, ask what changed/what to do, with explanations available first.
Keep demonstrations and genuine acquisition steps. This is separate from R4's held-image decision.

**Dependencies / holds:** Faculty/device review of the “retract the sheath” distractor, or drop it.
Never randomize, score, or write example state to learner evidence, drafts, or progress. Optional
scenario can remain held with existing demonstrations retained.

**Decision requested:** ☐ APPLY PROPOSED REVISION CLASS ☐ RETAIN ☐ MODIFY: `______` ☐ HOLD

## TIER 3 — Future enhancement / not required for current acceptance

### OD-17

**ID:** OD-17

**Topic:** Progressive workbench / four-lesson structure.

**Why owner input is required:** Consolidation changes curriculum navigation and evidence handling.

**Current state:** Depth, Gain/contrast, Doppler, Capture are four separate lessons and Practice labs.

**Verified evidence:** Drafts §C maps lesson/task IDs, acquisition criteria, links, and progress.
One workbench supports four distinct acquisitions; “reviewed” is lesson-based and held evidence is
session-only. Existing technical repairs are closed.

**Draft/proposed option(s):** 1 retain four lessons; 2 later progressive single-page workbench;
3 hold consolidation until Doppler/image decisions are complete.

**Dependencies / holds:** Preserve lesson IDs, activity/question IDs and keys, task IDs, acquisition
criteria, deep links, Practice-lab entries, legacy keys and self-paced progress semantics. Hold
still requires genuine acquisition; Continue without an image remains available. No carryover of
one station's evidence into another. OD-02/OD-04 precede any consolidation.

**Decision requested:** ☐ OPTION 1 — RETAIN CURRENT ☐ OPTION 2 — later consolidation
☐ OPTION 3 — HOLD until image decisions ☐ OTHER: `______`

### OD-18

**ID:** OD-18

**Topic:** Recording delivery / reversible derivatives.

**Why owner input is required:** Smaller files must preserve teaching fidelity and approved media use.

**Current state:** L6-5 is backlog; no derivative trial approved. Packet size/keyframe inventory is
historical, particularly for the now-replaced Depth3 file.

**Verified evidence:** Packet §7 describes full-file retrieval for short windows and a proposed
lossless window-cut strategy. No produced derivative or acceptable lossy setting was verified;
current files would need fresh timing/format checks in a later trial.

**Draft/proposed option(s):** Retain current runtime versions, subject to OD-04; commission lossless
per-window trial; or commission separately reviewed lossy trials. “Preserve originals” must mean
preserve the current redacted runtime asset, never restore unredacted Depth3.

**Dependencies / holds:** OD-04, per-file provenance mapping and fidelity review at enlarged size;
retain texture, borders, color evolution, depth scale, whole-frame view, and seek/loop behavior.
Future performance work is unnecessary for this documentation acceptance.

**Decision requested:** ☐ RETAIN CURRENT ☐ APPROVE later lossless trial ☐ APPROVE WITH EDIT /
later lossy trial: `______` ☐ HOLD

## Mapping appendix — Prompt-05 row/source ID → worksheet decision ID

The following tables account for all 52 lane-05 IDs, all 12 Prompt-04 carry-forward entries, all
7 related accounted rows, and all 7 amendment objects: **78/78 Manifest decision objects**.
Grouping alone is not approval. The explicitly recorded OD-01–OD-04 owner dispositions supersede
only their stated subparts. Other table statuses retain the original source dispositions; OD-04A
resolves current clinical-media rights/provenance, not new-image identity/annotation or unused-media
holds. Tier-2/3 choices, all source-verification statuses, and existing retain/closed dispositions stay intact.

### All 52 lane-05 rows

| Source ID | Worksheet ID | Grouping / retained disposition                                              |
| --------- | ------------ | ---------------------------------------------------------------------------- |
| L1-5      | OD-15        | RETAIN CURRENT BEHAVIOR                                                      |
| L1-8      | OD-15        | READY FOR OWNER DECISION                                                     |
| L2-1      | OD-10        | LOCAL PROTOCOL REQUIRED                                                      |
| L2-2      | OD-11        | SOURCE VERIFICATION INCOMPLETE                                               |
| L2-5      | OD-15        | READY FOR OWNER DECISION                                                     |
| L2-7      | OD-11        | READY FOR OWNER DECISION; related OD-10                                      |
| L3-7      | OD-06        | READY FOR OWNER DECISION                                                     |
| L3-14     | OD-05        | READY FOR OWNER DECISION                                                     |
| L3-15     | OD-05        | READY FOR OWNER DECISION                                                     |
| L5-6      | OD-08        | READY FOR OWNER DECISION; related OD-01                                      |
| L6-2      | OD-08        | EXPERT IMAGE ANNOTATION REQUIRED; related OD-02, OD-07                       |
| L6-4      | OD-15        | READY FOR OWNER DECISION                                                     |
| L6-5      | OD-18        | Future performance work; historical inventory is not current Depth3 metadata |
| L6-7      | OD-04A       | APPROVE MEDIA by owner attestation; de-identification scope unchanged        |
| L7-2      | OD-15        | RETAIN CURRENT BEHAVIOR                                                      |
| L8-1      | OD-02        | OPTION A — true vascular flow; unlabeled task RETAIN CURRENT                 |
| L8-2      | OD-02        | RETAIN CURRENT unlabeled; new annotation remains unapproved                  |
| L8-3      | OD-15        | RETAIN CURRENT BEHAVIOR; related OD-02                                       |
| L9-5      | OD-15        | READY FOR OWNER DECISION                                                     |
| L11-2     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L11-6     | OD-06        | READY FOR OWNER DECISION                                                     |
| L13-2     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L13-4     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L13-6     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L14-3     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L14-5     | OD-07        | READY FOR OWNER DECISION                                                     |
| L15-2     | OD-07        | EXPERT IMAGE ANNOTATION REQUIRED                                             |
| L16-1     | OD-07        | MEDIA / RIGHTS INPUT REQUIRED; related OD-11                                 |
| L16-2     | OD-07        | MEDIA / RIGHTS INPUT REQUIRED                                                |
| L16-4     | OD-15        | READY FOR OWNER DECISION                                                     |
| L17-6     | OD-11        | SOURCE VERIFICATION INCOMPLETE                                               |
| L18-2     | OD-07        | READY FOR OWNER DECISION                                                     |
| L18-3     | OD-15        | READY FOR OWNER DECISION                                                     |
| L19-4     | OD-15        | READY FOR OWNER DECISION                                                     |
| L20-2     | OD-03        | APPROVE WITH EDIT / MODIFY; wording only, runtime unchanged                  |
| L20-3     | OD-03        | LOCAL PROTOCOL REQUIRED; related OD-11                                       |
| L20-6     | OD-08        | MEDIA / RIGHTS INPUT REQUIRED; related OD-16                                 |
| L21-3     | OD-16        | READY FOR OWNER DECISION                                                     |
| L21-5     | OD-15        | READY FOR OWNER DECISION                                                     |
| L22-2     | OD-13        | READY FOR OWNER DECISION                                                     |
| L22-3     | OD-11        | RETAIN CURRENT BEHAVIOR                                                      |
| L22-4     | OD-15        | RETAIN CURRENT BEHAVIOR                                                      |
| L23-3     | OD-14        | LOCAL PROTOCOL REQUIRED                                                      |
| L24-3     | OD-08        | READY FOR OWNER DECISION                                                     |
| L25-2     | OD-11        | SOURCE VERIFICATION INCOMPLETE                                               |
| L25-3     | OD-09        | LOCAL PROTOCOL REQUIRED                                                      |
| L25-4     | OD-15        | READY FOR OWNER DECISION; related OD-09                                      |
| L26-2     | OD-13        | READY FOR OWNER DECISION                                                     |
| L26-4     | OD-11        | READY FOR OWNER DECISION; related OD-15                                      |
| PR-1      | OD-15        | READY FOR OWNER DECISION; related OD-07                                      |
| CS-1      | OD-08        | RETAIN CURRENT BEHAVIOR                                                      |
| CS-2      | OD-15        | READY FOR OWNER DECISION                                                     |

### All 12 Prompt-04 carry-forward entries

| Source ID       | Worksheet ID | Grouping / retained disposition                                   |
| --------------- | ------------ | ----------------------------------------------------------------- |
| L20-4           | OD-09        | Q1; READY FOR OWNER DECISION                                      |
| L17-5           | OD-07        | Q2; READY FOR OWNER DECISION                                      |
| L5-1            | OD-01        | Q3; OPTION A — condition-neutral mechanism comparison             |
| NAV-3-Q4        | OD-12        | Q4; READY FOR OWNER DECISION                                      |
| L19-2           | OD-07        | Q5; READY FOR OWNER DECISION                                      |
| L2-6            | OD-15        | Q6; READY FOR OWNER DECISION                                      |
| L12-2           | OD-15        | Q6; READY FOR OWNER DECISION                                      |
| L15-3           | OD-15        | Q7; READY FOR OWNER DECISION                                      |
| L22-6           | OD-14        | Q11; INSUFFICIENT EVIDENCE — HOLD; owner must supply destinations |
| Q13-workbench   | OD-17        | Q13; READY FOR OWNER DECISION                                     |
| Q14-ct-primer   | OD-07        | Q14; READY FOR OWNER DECISION                                     |
| Q15-image-needs | OD-07        | Q15; MEDIA / RIGHTS INPUT REQUIRED                                |

### All 7 related accounted rows

| Source ID | Worksheet ID | Grouping / retained disposition               |
| --------- | ------------ | --------------------------------------------- |
| L12-4     | OD-06        | READY FOR OWNER DECISION                      |
| L9-2      | OD-06        | READY FOR OWNER DECISION                      |
| L9-3      | OD-06        | READY FOR OWNER DECISION                      |
| L9-4      | OD-06        | READY FOR OWNER DECISION                      |
| L10-1     | OD-06        | READY FOR OWNER DECISION                      |
| L12-6     | OD-13        | RETAIN CURRENT; Prompt-01 repair not reopened |
| L26-3     | OD-13        | RETAIN CURRENT; Prompt-01 repair not reopened |

### All 7 amendment decision objects

| Source ID                        | Worksheet ID | Grouping / retained disposition                                     |
| -------------------------------- | ------------ | ------------------------------------------------------------------- |
| OWNER-FASTING-REQUIRED           | OD-10        | OWNER DECIDED; substance preserved, only wording pending            |
| LOCAL-FASTING-INTERVAL           | OD-10        | LOCAL PROTOCOL REQUIRED; no duration selected                       |
| DEPTH3-METADATA                  | OD-04        | OWNER REVIEWED; do not reopen technical repair                      |
| DEPTH3-REPLACEMENT-CANDIDATE     | OD-04        | Completed per current owner update; stale adoption hold superseded  |
| DEPTH3-RIGHTS-PROVENANCE         | OD-04A       | APPROVE MEDIA; owner attestation, de-identification scope unchanged |
| DEPTH3-HISTORICAL-BLOB           | OD-04B       | HOLD — historical policy only; technical remediation complete       |
| PUBLIC-SCREENSHOTS-FLOW-REDESIGN | OD-04        | Technical check complete; rights outside course use unresolved      |

### Other packet/source references and Prompt-04 disposition context

These references add no decisions and do not reopen resolved or rejected proposals.

| Row/source ID                                                 | Worksheet decision ID                                                              | Accounting / rationale                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Packet G1–G7                                                  | OD-01–OD-18                                                                        | All executive groups decomposed above; original statuses remain in the source documents                                                      |
| Drafts R1, R2, R3, R5, R6, R7, R8, R9, R10                    | OD-15                                                                              | Revision classes, with clinical subparts explicitly held for review                                                                          |
| Drafts R4; §A.12                                              | OD-01; OD-16                                                                       | Held-image choice and separate recognition example                                                                                           |
| Storyboard A; B; §C                                           | OD-07; OD-08; OD-17                                                                | Image formats and later consolidation                                                                                                        |
| D1, D2, D3                                                    | OD-11                                                                              | Guideline wording and registry corrections                                                                                                   |
| D4, D5; D6; D7; D8; D9; D10                                   | OD-05; OD-06; OD-09; OD-12; OD-03; OD-10                                           | All ten copy proposals accounted                                                                                                             |
| ers2026; chest2024; combined2015; ests2014                    | OD-11                                                                              | Recorded source statuses preserved; no new verification                                                                                      |
| accp2022; bts2013; ics2023; chest2016                         | OD-10, OD-11; OD-03, OD-14                                                         | Local preparation / needle / specimen claims remain bounded                                                                                  |
| aquire2013; fujiwara2010; clns2020                            | OD-11                                                                              | Abstract-only holds; morphology imagery also OD-07                                                                                           |
| iaslc-n9; accp2013-staging                                    | OD-13, OD-11                                                                       | N descriptors / historical staging guidance; no new staging rule                                                                             |
| olympus-bf-uc190f; IFU                                        | OD-11, OD-05, OD-09, OD-12                                                         | Brochure ≠ IFU; convention/harm/definition gaps remain                                                                                       |
| mediastrial-lead; local-ucsd-ip                               | OD-11; OD-10, OD-14, OD-09                                                         | Unread trial lead; private references are not authorized course protocols                                                                    |
| Manifest assets (128), privateEvidence, replacementCandidates | OD-04; OD-02, OD-07, OD-08, OD-18                                                  | Current clinical media approved by owner attestation (OD-04A); no new pixel review or audit; historical Git policy HOLD (OD-04B)             |
| Packet owner checklist 1–11                                   | OD-02, OD-04, OD-07, OD-08, OD-06, OD-05                                           | Image, model and measurement choices grouped                                                                                                 |
| Packet owner checklist 12–22                                  | OD-11, OD-10, OD-14, OD-09, OD-03, OD-12, OD-13, OD-15, OD-01, OD-16, OD-17, OD-18 | Clinical, glossary, case, question and future-work choices grouped                                                                           |
| Packet owner checklist 23–29                                  | OD-10, OD-04                                                                       | Earlier fasting/metadata decisions preserved; current media attestation OD-04A recorded; technical remediation complete; history OD-04B HOLD |
| Prompt-04 Q8 / L16-3 alternative                              | OD-15                                                                              | Deferred/not planned: new feature-picker task; current retitle already makes the task truthful                                               |
| Prompt-04 Q9 / L23-2 alternative                              | OD-14, OD-15                                                                       | Concealing lab instructions remains rejected; new media options require local protocol                                                       |
| Prompt-04 Q10 / L10-3, L1-10, L4-6, L17-4, L6-3               | OD-15, OD-17                                                                       | Concealment/goal-only alternatives remain rejected; guided teaching and limits stay visible                                                  |
| Prompt-04 Q12 / L24-2 second half                             | OD-08                                                                              | Future case-flow reuse remains not planned; adding case teaching is outside current acceptance                                               |
| Prompt-04 Q13 / L12-7, L13-5, §D                              | OD-17                                                                              | Four-lesson navigation proposal; not implementation                                                                                          |
| Prompt-04 Q14 / L1-3                                          | OD-07                                                                              | Optional local CT primer; existing links can remain                                                                                          |
| Drafts Storyboard A PR-2 context; B L4/L7 context             | OD-07; OD-08                                                                       | Context for model/image teaching, not reopened engineering rows                                                                              |
| Drafts §C L10-4 and acquisition-context rows                  | OD-17, OD-06                                                                       | Preserve acquisition/progress semantics; no new calibration or capture task                                                                  |
| Prompt-03 L3-7, L11-6, L12-4; orientation/image/caliper holds | OD-06, OD-05, OD-07, OD-02                                                         | Carry forward clinical/model questions only; presentation/status repairs remain closed                                                       |

### Validation record

ID accounting checked against the current Status and all Manifest decision objects: 52 lane rows,
12 carry-forward entries, 7 related rows, and 7 amendment objects, with no omissions. Prompt-04
Q1–Q15 context remains accounted for. OD-01–OD-04 use the requested topic, rationale, current state,
evidence, options and dependencies fields, with Owner decision/disposition replacing Decision requested.
The remaining 14 decision groups retain their undecided choices and tiers. Only the owner's explicit
OD-01 OPTION A, OD-02 true vascular flow / unlabeled-task RETAIN CURRENT, OD-03 modified concept,
OD-04A media attestation and OD-04B historical HOLD are newly recorded. No other unresolved item is
approved, no source status is upgraded, and no local protocol or global de-identification clearance
is inferred. Fasting-required and the earlier Depth3 metadata review remain preserved. Only this
worksheet is updated; the four Prompt-05 source files, runtime, tests, media, schemas, question IDs
and keys are unchanged. Prompt 06 is not started; no merge or deployment is performed.
