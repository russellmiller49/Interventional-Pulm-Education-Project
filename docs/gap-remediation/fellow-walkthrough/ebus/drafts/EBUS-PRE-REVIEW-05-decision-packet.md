# EBUS-PRE-REVIEW-05 — owner decision packet: images, sources, model limits and curriculum

**What this is:** documentation that prepares owner decisions. **It is not** clinical approval,
faculty approval, a runtime change or media publication. Nothing in the application, its media,
schemas, keys, ids, stored state or source-review status was changed.

**Review status (amended 2026-09-24):** most Prompt-05 clinical and media decisions remain **NOT
REVIEWED**, with reviewer, role and review date empty. The owner has explicitly reviewed two bounded
matters, recorded in this amendment: **pre-procedure fasting is required for EBUS** (§4a; the exact
interval stays governed by local/anesthesia policy) and the **Depth3 visible-metadata finding and its
remediation candidate** (§1c). Technical verification of the Depth3 replacement candidate is not
rights or provenance clearance. No decision group is marked reviewed because one sub-question in it
was decided.

- **Amendment 2026-09-24:** PR head before amendment `7d654518`; `origin/main` at amendment
  `41a34608` — 10 commits past the baseline, none touching any EBUS or drafts path, so the branch was
  not rebased.

- **Baseline:** `85acc113be11f9acbd395f49e00fee4b69ceff71` = `origin/main` at start (2026-09-23),
  the verified post-Prompt-04 main (Prompt 04 merged as `90cf4cec`; its post-merge smoke passed, as
  supplied by the owner and not re-run here).
- **Inputs read:** `EBUS_MODULE_HANDOFF_2026-09-21.md`; package `00_START_HERE.md`, `05_…DRAFTS.md`,
  `OWNER_DECISIONS.md`, `SOURCE_CONTEXT.md`, `FEEDBACK_LEDGER.md/.json` (all 52 lane-05 rows and the
  related rows); the original walkthrough DOCX via the ledger's row-level extraction; Prompt 01–04
  handoffs, status files, the 04 copy table and both sanity reviews; `content/sources.ts` (source
  registry); `EBUS-course/…/knobology_lookup.json` and `station-media.json` (media registries);
  `docs/ebus-guided/remaining-work.md` R1–R5, `docs/ebus-guided/review.md` and the EBUS-01 question
  ledger (the existing review queue); the runtime content, engine and embedded workbench code.
- **Companions:** `EBUS-PRE-REVIEW-05-teaching-drafts.md` (≤10 item revisions, 2 storyboards,
  1 consolidation map, small copy proposals); `EBUS-PRE-REVIEW-05-asset-source-manifest.json`
  (78 decision objects, 128 asset records with recomputed SHA-256, 16 source records, one replacement-candidate record);
  `EBUS-PRE-REVIEW-05-status.json` (52 lane-05 IDs + 12 Prompt-04 carry-forward items).
- **Private evidence (outside Git):**
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-pre-review-05-2026-09-23/`
  — full-frame Doppler frames and contact sheets, the device-banner frame, CT corner crops. These
  contain recorded ultrasound pixels and one on-screen date; they are **not** committed.

The walkthrough is an AI persona's observation source. Its checkmarks and "nothing checked was
wrong" are not source verification; where this batch checked a claim, it says so and gives the
location.

**Workflow statuses** (not clinical approval): READY FOR OWNER DECISION · SOURCE VERIFICATION
INCOMPLETE · MEDIA / RIGHTS INPUT REQUIRED · LOCAL PROTOCOL REQUIRED · EXPERT IMAGE ANNOTATION
REQUIRED · RETAIN CURRENT BEHAVIOR · INSUFFICIENT EVIDENCE — HOLD.

## Executive decisions

| Group                                                   | IDs                                                                                                                                | Decision needed                                                                                                                                                                                                                        | Evidence status                                                                                                                                                                                                                  | Owner / reviewer                                           | Blocking input                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **G1** Image meaning, provenance, orientation           | L6-2, L6-7, L8-1, L8-2, L11-2, L13-2, L13-6, L14-3                                                                                 | What the Doppler recording teaches (A flow / B artifact / C both / D unsuitable); what the 4R/4L disc marks and each view's orientation; whether lesson 14 may name model labels after acquisition; Depth3 historical Git blob (A/B/C) | Pixel behaviour measured; **provenance, consent, de-identification, rights: UNKNOWN** for every recording and station image — except Depth3's visible metadata, owner-reviewed 2026-09-24 (§1c); its rights stay UNKNOWN         | Owner; EBUS faculty; thoracic radiology for CT orientation | Expert reading of the clip and images; provenance records                                   |
| **G2** Missing image-based teaching                     | L5-6, L13-4, L14-5, L15-2, L16-1, L16-2, L18-2, L20-6, L24-3, CS-1 (+ Q14, Q15)                                                    | Which few teaching purposes deserve an image, and from which evidence                                                                                                                                                                  | Model states exist for coupling, shadow, needle and 2R/10R presets; no verified node-feature, needle or station 8/9 images                                                                                                       | Owner; EBUS faculty                                        | Annotated, rights-cleared clinical images; faculty review of 2R/10R model targets           |
| **G3** Model fidelity, orientation, measurement         | L3-7, L3-14, L3-15, L11-6 (+ L12-4, L9-2/3/4, L10-1, L17-5, L19-2)                                                                 | Keep the wide model windows with an honest limitation, or commission calibration; add model-only orientation marks                                                                                                                     | Windows recomputed from the repo's own code; all numbers are model-derived or pixel counts                                                                                                                                       | Owner; anatomy/EBUS faculty                                | None for wording; calibration needs real rotation-tolerance evidence (none in repo)         |
| **G4** Clinical and source questions                    | L2-1, L2-2, L2-7, L17-6, L20-2, L20-3, L22-3, L23-3, L25-2, L25-3, L26-4 (+ L20-4, glossary Q4)                                    | Accept verified wording; decide whether to add anything that needs a local protocol or device IFU                                                                                                                                      | **2026 ERS/ESGE/ESTS and CHEST 2024/25 read in full and verified**; four items need a local protocol; IFU and AQuIRE full text missing; **fasting required before EBUS — owner decision 2026-09-24** (§4a; interval stays local) | Owner; thoracic oncology/EBUS faculty; cytopathology       | Local antithrombotic, specimen and bleeding protocols; scope IFU revision; AQuIRE full text |
| **G5** Running case, provisional staging, report fields | L22-2, L26-2 (+ L12-6, L26-3, L22-6)                                                                                               | Whether to add a learner-declared provisional-N field and how to word "nonrepresentative ≠ negative"                                                                                                                                   | N descriptors verified (IASLC 9th); the course already teaches the nonrepresentative limitation in its report options                                                                                                            | Owner; thoracic oncology faculty                           | Owner wording                                                                               |
| **G6** Better questions, less repetition                | L1-5, L1-8, L2-5, L6-4, L7-2, L8-3, L9-5, L16-4, L18-3, L19-4, L21-3, L21-5, L22-4, L25-4, PR-1, CS-2 (+ L2-6, L12-2, L15-3, L5-1) | Accept, revise or retain ten representative drafts (one per defect class) and the L21-3 scenario                                                                                                                                       | Drafts cite course text; R10 also cites the verified 2026 guideline                                                                                                                                                              | EBUS faculty                                               | L5-1 needs a choice among A/B/C                                                             |
| **G7** Consolidation and media delivery                 | L6-5 (+ Q13)                                                                                                                       | Keep four image lessons or plan a progressive workbench; whether to trial reversible clip derivatives                                                                                                                                  | Clip inventory complete; a lossless per-window cut is possible (0.5 s keyframes)                                                                                                                                                 | Owner; EBUS faculty for fidelity                           | G1 before any Doppler consolidation; fidelity review before any derivative                  |

---

## 1. Image identity, the Doppler clip, and orientation (G1)

**Why a decision is needed:** the course shows recorded patient ultrasound and station reference
images whose meaning, orientation and origin are not recorded anywhere this batch searched. The
walkthrough could not tell node from vessel, could not read the Doppler colour, and could not tell
which wall the 4R disc marks.

**Established (file/code facts):**

| Asset (repo path under `EBUS-course/apps/web/public/`)        | SHA-256 (first 16)                      | Facts                                                                                                                                       | Where it is used         |
| ------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `media/knobology/Depth_segments/Depth4.mp4`                   | `f9dd75dd0a744e53`                      | 37,688,981 B; H.264 Main L4.2, 1920×1080, 60 fps, 38.000 s, 2,280 frames, keyframe every 0.5 s, no audio; MainConcept export tag 2026-04-16 | Lessons 6, 7, 8, 10      |
| `media/knobology/Depth_segments/Depth{2,3,5,6,8}.mp4`         | see manifest                            | Same format; 15–44 MB each                                                                                                                  | Lesson 6                 |
| `media/stations/4R/bronchoscopy/view.png` / `view-marked.png` | `7c3c3442b12e9ab7` / `ed1dc909f0ebd4bb` | 509×430; **the blue disc is already in the unmarked image**; "-marked" adds only the "4R" text (494 px differ)                              | Lesson 13 reference step |
| `media/stations/4L/ct/{coronal,sagittal}.jpg`                 | `0ae316652e633033` / `393fbcb31ba331d3` | Print the internal id "B: case_001_ct" bottom-left (so do 10L, 10R, 11Ri, 7; no 4R or axial image does)                                     | Lesson 14 reference step |
| `simulator/case-001/geometry/acoustic-v2.u8.gz`               | `efa3bdc9bb372564`                      | Acoustic label volume behind every model-rendered sector                                                                                    | Lessons 3, 4, 11–14      |

- **Display treatment:** recorded clips are cropped by default to the measured image region
  x 480–1763, y 76–932 of 1920×1080, with a whole-frame toggle; no flip, rotation or CSS transform;
  held and saved frames keep the whole frame. Station images are shown unoptimized with no crop,
  flip or rotation, **no orientation marker and no orientation metadata** (EXIF Orientation = 1 only).
- **Captions:** "Recorded ultrasound clips · Educational controls"; the Doppler caption reads
  "Depth 4 cm · a flow-mode recording · clip Depth4_Color_Flow, 32.0–34.0 s of Depth4.mp4 · Color
  Doppler." Station figures: "Existing EBUS teaching library · Representative views, not a synchronized
  patient examination." **No caption states source, site, device, consent or de-identification.**
- **Provenance/rights/de-identification: UNKNOWN** — no record found in the repo, Local-Data or the
  recovered original EBUS-course repository. The existing open item is `remaining-work.md` R3;
  `review.md:93` says existing media "were not independently re-cleared". The Depth clips were exported
  from a Premiere timeline (`Knobology_clean_timeine.xml`); that project and the per-control source
  clips were not found.
- **De-identification observation (categories only):** `Depth3.mp4` 10.000–11.983 s (the
  `Depth3_Gain_6` window, from a different source clip) carries an on-screen header with demographic
  **field labels** (values blank in the inspected frame) and a **date-time stamp**, plus a device footer —
  outside the default crop, visible in the whole-frame view, kept in any held frame. The guided course
  cannot reach that window; the standalone SoCal lab probably can (not traced). No other clip shows header text.
  **Owner-reviewed 2026-09-24 — see §1c.**
- **Other observations for the owner:** two processor-keyboard stills (`eu-me2_main.jpg`,
  `eu-me2_image_enhance.jpg`, standalone lab only) carry Gemini-generated source filenames in XMP;
  `docs/ebus-guided/flow-redesign-evidence/{image-depth-held-recording,capture-held-recording}.png`
  are already-committed screenshots that include downscaled recorded frames (pre-existing; not changed;
  reviewed for the Depth3 header in §1c).

### 1c. Depth3 visible metadata and remediation (owner input 2026-09-24)

Asset: `EBUS-course/apps/web/public/media/knobology/Depth_segments/Depth3.mp4` — SHA-256
`4d64ef49dbc69b0e170a3fa8ba6d8e99d0f6b78b1d101800a6972b710d8681e8`, 35,315,925 B, 1920×1080, 60 fps,
38.000 s, H.264 Main, no audio, 2,280 frames (unchanged, still the runtime asset).

| Sub-question                                      | Status                                                                                          | Record                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visible metadata in the **original**              | **VISIBLE DATE/TIME CONFIRMED — OWNER REVIEWED** (Russell Miller, repository owner, 2026-09-24) | The owner inspected the whole clip. The only concerning visible clinical metadata is a full date/time in the device header at ~10–12 s; NAME/AGE/SEX labels are visible there but unpopulated in the reviewed frame; nothing else identifying was found. This session's sweep agrees: only frames 600–719 show anything outside the teaching region. **The original remains public in the repository.**    |
| Owner-supplied **redacted replacement candidate** | **REDACTED REPLACEMENT CANDIDATE — TECHNICALLY VERIFIED, NOT YET PUBLISHED**                    | `Depth3.mp4` (session attachment), SHA-256 `9780f54ad86c925d4cd7998f4209c74ea0a91b62ce38bcb6b6df93c09e601e21`, 34,933,352 B. Not committed; kept in session scratch. Details below.                                                                                                                                                                                                                        |
| Provenance, consent, publication rights           | **UNKNOWN**                                                                                     | Black-box redaction does not establish ownership, consent, rights or source provenance.                                                                                                                                                                                                                                                                                                                    |
| Historical Git blob                               | **OWNER DECISION REQUIRED**                                                                     | See below.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Committed screenshots                             | **REVIEWED — flagged Depth3 metadata window not present**                                       | All 10 PNGs in `docs/ebus-guided/flow-redesign-evidence/` were opened. The four with recorded frames (`image-depth-held-recording`, `capture-held-recording`, `capture-200-percent-text`, `recorded-phone-320`) show Depth8/Depth4 teaching frames with no device header, date/time or NAME/AGE/SEX field; the other six contain no recorded frame. Technical review by this session, not an owner review. |

**Candidate verification (decoded frames and direct inspection; no OCR):**

- **Playback:** 1920×1080 (16:9), 60 fps, 38.000 s, 2,280 frames, H.264 Main L4.2, yuv420p MP4, no
  audio — the same browser-decodable profile. Differences: keyframe every 1.0 s with B-frames (original
  every 0.5 s, I/P only) and BT.709 limited-range colour tags (original untagged). Neither blocks
  playback; the seek/loop timing (windows start on even seconds) should be re-checked when the file is
  adopted, and a 1-s GOP still allows a lossless 2-s window cut (§7).
- **Redaction:** frames 600–719 (10.000–11.983 s) carry opaque black boxes over the top header and the
  bottom device footer. Every pixel that was header/footer text in the original is ≤ 5/255 in the
  candidate; 8×-gain crops show uniform boxes with no ghost text. Inspected at 9.5, 10.0, 10.5, 11.0,
  11.5, 11.98 and 12.5 s. A 4-row sliver of the storage-indicator bar outline (y 1072–1075) remains below
  the footer box — a thin line with no text.
- **Rest of the video:** no frame outside 600–719 has more than 20 pixels above 60/255 outside the
  teaching region; a 1-fps contact sheet shows no header text elsewhere.
- **Whole-frame view:** the redaction is baked into the pixels, so the whole-frame toggle and any held
  frame show black boxes — safety does not depend on CSS cropping.
- **Teaching region fidelity:** at most 7 redacted pixels fall inside x 480–1763 / y 76–932 in any frame
  (box edges at the region border). PSNR inside the region against the original: median 52.0 dB, minimum
  45.2 dB (colour-flow frames). Native-resolution side-by-side crops of a grayscale frame (630) and a
  colour-Doppler frame (1980) show no visible change in speckle, borders, depth scale or colour map. The
  metric is screening; the visual comparison is the basis for the conclusion.
- **Container metadata:** creation time 2026-09-24T18:53:56Z; MainConcept/"AVC Coding" handler tags; an
  Adobe XMP editing history (Premiere Pro creator tools, source clip name, project paths on the author's
  workstation, edit dates). The original carries a comparable XMP packet naming its Premiere source clips.
  No patient-linked value was seen in either. None of this establishes de-identification of the
  recording itself.
- **Result:** PASS for visible redaction and teaching-region fidelity. Private evidence (includes
  unredacted original frames with the date):
  `…/renders/output/ebus-pre-review-05-2026-09-23/depth3-redaction-2026-09-24/` — not committed.

**Historical Git blob — OWNER DECISION REQUIRED.** The repository is public. The original bytes (Git
blob `9bc24d58…`) are reachable in history at two paths:
`public/socal-ebus-course/app/media/knobology/Depth_segments/Depth3.mp4` (commit `f75389da`,
2026-04-16) and the current `EBUS-course/…/Depth3.mp4` (commit `b6bb89db`, 2026-09-10). Replacing
the file in a future commit would remove the unredacted version from the current branch and site
build, **not** from public history, forks or existing clones.
Options: **A.** replace the current asset only and accept that the old blob remains in history ·
**B.** replace it and intentionally purge the original blob from history · **C.** pursue another
repository/GitHub remediation route suited to sensitive historical content. No history rewrite,
filter-repo/BFG run, force-push or GitHub removal request was made in this PR.

**Still unresolved and not generalized from Depth3:** original recording provenance, consent if
applicable, publication rights, rights/provenance of every other station image and clip, the
historical-blob decision, and the interpretation/identity of other clinical media. The Depth3 finding
is about one file.

### 1a. Doppler clip review sheet (L8-1, L8-2)

- **Exact clip:** `Depth4.mp4` (SHA-256 `f9dd75dd0a744e53d7df7491c8c1056c57297d1f1b8293e9e2a07c42b00b02e0`),
  lookup entry `Depth4_Color_Flow`, file window 32.000–34.000 s. `doppler_on.mp4` is **not** used by any code.
- **Runtime mapping:** lesson 8 Doppler off = `Depth4_Gain_4` (6–8 s); on = `Depth4_Color_Flow`.
  The clip opens paused on frame 1921 (contains 32.025 s); "Play clip" loops 32.025–33.955 s
  (frames 1921–2037).
- **Method (observed pixel behaviour only):** every frame decoded; a pixel counts as coloured when
  HSV S > 0.35 and V > 0.20, inside the display region, with static overlays (dotted colour-box
  outline, focus triangles, orientation dot) removed; colour-box interior = 197,703 px.

| Interval (s)      | Frames    | Share of colour box coloured | Spatial pattern                              |
| ----------------- | --------- | ---------------------------- | -------------------------------------------- |
| 32.000–32.100     | 1920–1925 | ~2.3%                        | 5–7 separate small regions                   |
| **32.100–33.117** | 1926–1986 | **mean 78%, max 83%**        | one connected region filling most of the box |
| 33.117–33.217     | 1987–1992 | 48% → 14%                    | fading                                       |
| 33.217–33.383     | 1993–2002 | ~5–6%                        | compact                                      |
| 33.383–33.750     | 2003–2024 | ≤0.5%                        | near zero                                    |
| 33.750–33.950     | 2025–2036 | 1–7%                         | compact                                      |

The walkthrough's 32.5–33.0 s interval: every frame 76–82%. Over one loop, 61 of 117 frames
(1.02 s of 1.93 s) are box-filling. Controls: lesson 8's grayscale state has 0 coloured pixels;
`doppler_off.mp4` at most 3.

- **Full-frame evidence (Local-Data, by frame):** 1927, 1938, 1947, 1960, 1976 (box-filling); 1921,
  1925, 2001, 2025, 2028 (compact); 1950, 1965, 1980 (32.5 / 32.75 / 33.0 s); 2037, 2039 (loop end,
  last frame); two contact sheets. Filenames and SHA-256 are in the manifest (`privateEvidence`).

| Layer                      | What it says                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observed                   | A 1-s episode in which colour fills most of the colour box, bracketed by frames with small separate colour regions                                                                           |
| Walkthrough interpretation | Flash (motion) artifact; discrete flow in only a few frames (AI persona; not validated)                                                                                                      |
| Authored teaching          | "The color represents detected flow in this recording and must be interpreted with the surrounding anatomy" (`doppler-observe-v2` key); lesson 8 teaches that absent colour is not clearance |
| **Unresolved (owner)**     | Whether any interval shows vascular flow, artifact, or both; which structure is the vessel or target                                                                                         |

**Owner decision — what is this recording meant to teach?**
**A.** vascular flow · **B.** flash/motion artifact · **C.** both · **D.** unsuitable as current teaching media.
Consequences: A → an expert chooses and annotates discrete-flow frames, and the loop may need a
reviewed segment choice; B → artifact teaching is new clinical content (settings teaching is out of
scope until reviewed); C → both of the above; D → the Doppler lab needs a replacement recording with
provenance. This batch does **not** choose, erase the artifact, pick a segment, re-encode, add settings
teaching, or call any frame a vessel.

### 1b. 4R/4L orientation and identity sheet (L11-2, L13-2, L13-6, L14-3)

| View                                        | Transform / camera metadata available                                                                                                                    | Source annotation                                              | Authored claim                                      | What is unknown                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 4R bronchoscopy still (disc)                | None beyond EXIF Orientation = 1; disc centroid 0.748 W, 0.205 H, ~107×100 px, RGB ≈ (21, 95, 129)                                                       | Disc is baked into the source image; author and method UNKNOWN | Station reference for 4R                            | Which wall/direction the disc marks; image rotation relative to the patient; who placed it |
| 4L bronchoscopy still (disc)                | Same; disc centroid 0.25 W, 0.22 H                                                                                                                       | Baked in; UNKNOWN                                              | Station reference for 4L                            | Same                                                                                       |
| 4R CT (axial/coronal/sagittal)              | Pixel sizes only; no orientation labels, no DICOM metadata in the JPEGs                                                                                  | "-marked" green region, author UNKNOWN                         | Station reference for 4R                            | Orientation of each view; crop/zoom history; source scan                                   |
| 4L CT                                       | Same; prints "B: case_001_ct"                                                                                                                            | As above                                                       | Station reference for 4L                            | As above; whether the id text should be removed (a media edit)                             |
| Lesson 14 sector (the "difficult 4L scene") | **Model-rendered**, exact: web [x,y,z] = patient [L,S,−P] (`bronchoscopy-core/devices.ts:19-20`); roll 0° = the preset's authored depth axis; start +55° | Model label volume                                             | "Assisted scan, not an access or needle simulation" | Nothing about the model; the walkthrough's −14° is a slider position, not a code value     |

- **What the model can say exactly (lesson 14):** at −14° the frame contains 7,200 px of label
  `station_4l` near the transducer and 22,981 px of label `aorta`, deeper; no `pulmonary_artery` label is
  in frame (it appears only from +41° to +90°). The model has one `aorta` label (no separate arch) and one
  `pulmonary_artery` label (no left/right). `imageLabelAt` (`imageDiscoveryPixels.ts:31-47`) can name the
  model label under any pixel, but lesson 14 never enables it. Computed offline through the repo code
  path; not re-checked in a browser.
- **No universal convention is applied.** "Anterior up", "patient right on the left" or "image left =
  cranial" are not written for any real image. Model-only statements use exact model ids.

**Owner options:** (1) supply attributable orientation and disc meaning for the 4R/4L stills → then a
legend and orientation mark can be drafted; (2) withdraw the disc images from teaching until then;
(3) for lesson 14, allow a post-acquisition reveal of model label names (`station_4l`, `aorta`) labelled
as model structures — a later runtime batch; (4) retain as is.
**Reviewer:** EBUS faculty / thoracic radiology. **Next action after decision:** a scoped runtime or
media batch only for the chosen option.

---

## 2. Missing image-based teaching (G2)

**Why:** the walkthrough wants images where the course teaches recognition in words. The course
policy prefers existing verified assets, then recorded frames of known identity, then clearly
labelled model states, then explicit ASSET REQUIRED blanks — and a text-only case may stay text-only.

| ID    | Teaching purpose                                 | What the learner must discriminate                                                           | Verified asset exists?   | Exact existing state                                                                                                                                                                | Annotation needed / exists                             | Calibration    | Rights / de-id                   | Proposed interaction                                           | Missing input                                           | Owner decision                       |
| ----- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- | -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| L5-6  | Coupling loss vs reflector shadow                | Where the signal stops and why                                                               | Yes (model)              | Lesson 5 cutaway `gap` / `shadow`; the difference is visible in the echo schematic only (3D reflector ≡ direct, 0 px)                                                               | Model labels only                                      | No             | Course-built                     | Paired panels, storyboard B1/B2; item R4                       | None                                                    | Approve pairing                      |
| L13-4 | 2R vs 4R from an image                           | Venous landmark level                                                                        | Partly                   | Model presets `station_2r_node_a`, `station_4r_node_a`; 2R/4R CT stills                                                                                                             | Model ids only; CT green regions of unknown authorship | No             | Model: course-built; CT: UNKNOWN | Storyboard A                                                   | Faculty review of 2R target and window; CT rights       | Approve storyboard A                 |
| L14-5 | 2L coverage; optional anatomy                    | 2L vs 4L at the arch                                                                         | Partly (model)           | Preset `station_2l_node_a` snapshot; no 2L lab                                                                                                                                      | Model ids                                              | No             | Course-built                     | Optional 2L model view                                         | 2L target review                                        | Add / retain                         |
| L15-2 | Hilar/interlobar image item                      | 10 vs 11 sublocations                                                                        | Not verified             | 10L/10R/11L/11R/11Ri stills exist but are **not registered** in `station-media.json`; 10L pair appears swapped; 11Ri unmarked lacks the disc; model presets 10R/11L/11Ri/11Rs exist | Needed                                                 | No             | UNKNOWN                          | Model-based item first                                         | Identity/rights of stills                               | Model-first / hold                   |
| L16-1 | Node features                                    | Shape, margin, echogenicity, central hilar structure, coagulation necrosis sign, vascularity | **No**                   | —                                                                                                                                                                                   | **Expert annotation required**                         | If sizes shown | UNKNOWN                          | **ASSET REQUIRED** side-by-side feature panels                 | Pathology-confirmed, annotated, rights-cleared examples | Commission / hold                    |
| L16-2 | Labelled node image in place of geometry diagram | Same as L16-1                                                                                | No                       | Course-drawn geometry diagram                                                                                                                                                       | Required                                               | —              | —                                | **ASSET REQUIRED**                                             | As L16-1                                                | Commission / hold                    |
| L18-2 | Stations 8/9 beside the oesophagus               | Lower mediastinal compartments                                                               | Partly (model)           | Lesson 19 route locators for 4L, 7, 8 (model); no 8/9 images                                                                                                                        | Model ids                                              | No             | Course-built                     | Course-drawn axial schematic or model view                     | Faculty-approved schematic                              | Choose format                        |
| L20-6 | Needle in plane                                  | Echogenic line vs tip                                                                        | No real still; model yes | Lesson 21 generic needle model                                                                                                                                                      | Required for a real still                              | No             | UNKNOWN                          | Model view now; **ASSET REQUIRED** for a real still            | Recorded needle frame with rights                       | Model / commission                   |
| L24-3 | "What is wrong with this image?"                 | Failure type → first correction                                                              | Mostly                   | Model coupling/shadow/needle states; `Depth4_Gain_8` (authored "washed out"); shallow-depth truncation **unconfirmed**; Doppler held for G1                                         | None on recorded frames                                | No             | Recorded: UNKNOWN                | Storyboard B                                                   | B4 confirmation; recording rights                       | Approve storyboard B                 |
| CS-1  | Images in integrated cases                       | —                                                                                            | —                        | Only `assessment-image` q1/q2 are image decisions                                                                                                                                   | —                                                      | —              | —                                | Point q1/q2 at storyboard B states; other cases stay text-only | —                                                       | RETAIN CURRENT BEHAVIOR for the rest |
| Q14   | EBUS-local CT orientation primer                 | CT orientation before station work                                                           | Partly                   | Lesson 1 links two open refreshers                                                                                                                                                  | Model-only orientation labels possible                 | No             | Course-built                     | Short primer using case-001 model/CT                           | Faculty review; new teaching                            | Commission / keep links              |
| Q15   | L18/L16 image needs                              | —                                                                                            | —                        | Covered by the L16-1, L16-2 and L18-2 rows                                                                                                                                          | —                                                      | —              | —                                | —                                                              | —                                                       | Fold into rows above                 |

Storyboards A (2R/4R/10R boundary comparison) and B (troubleshooting from genuine states) are drafted
in the teaching drafts §B with blank ASSET REQUIRED panels where evidence is missing.

---

## 3. Model fidelity, orientation and measurement (G3)

**Why:** fellows may read model windows as real rotation tolerances and model axes as image
conventions. **Nothing here recalibrates anything; no model threshold is a clinical norm.**

**Current technical state (computed from the repo's own pure modules at a 384-px render; edges
move ≤1° at the browser's other quality settings, ~5° at the test harness's 96 px):**

| Setup            | Lessons    | Target (model id)   | Authored start | **Observed model window** | Start inside?                          |
| ---------------- | ---------- | ------------------- | -------------- | ------------------------- | -------------------------------------- |
| RMS, offset 0    | 3, 11, 12  | station 7 node A    | +85°           | −71° to +49°              | No                                     |
| LMS, offset 0    | 12         | station 7 node A    | +85°           | −60° to +89°              | **Yes** (Prompt 03 explains the reset) |
| LMS, offset 3 mm | 12 changed | station 7 node A    | −75°           | −53° to +77°              | No                                     |
| 4R, offset 0     | 13         | `station_4r_node_a` | +85°           | −32° to +57°              | No                                     |
| 4R, offset 3 mm  | 13 changed | `station_4r_node_a` | −75°           | −30° to +54°              | No                                     |
| 4L, offset 0     | 14         | `station_4l_node_a` | +55°           | −49° to +44°              | No                                     |

- **Coordinates:** positions in patient LPS millimetres of the source scan; web [x,y,z] = patient
  [L,S,−P]; origin = the scanner frame, not an anatomical point; no CT registration exists
  (`case-transforms.json`).
- **Zero angle:** 0° = each preset's authored depth axis, carried along the centreline
  (`pose.ts:258-283`); roll is right-hand about the shaft (`pose.ts:311-315`), −90…+90° in 1° steps.
  The same "+" turn points anterior from the RMS start, posterior from LMS, toward patient right at 4R
  and anterior at 4L. No text defines 0°.
- **Sector orientation (model):** the plane contains the scope shaft; in the renderer image right is
  toward the head (`acoustic.ts:197-202, 275-289`); no marker is drawn. This is a model fact, **not** a
  statement about any processor's display.
- **Sampler and thresholds:** "in plane" = target label covers ≥ 8 px of the rendered sector
  (`acoustic.ts:305-320`); sweep tolerances 0.45 contact / ≤ 12° step / 5 frames / 20° span
  (`ebus-linked-contract.ts:66-75`, historical, no recorded rationale); `scan` goal = visible + contact
  ≥ 0.45; `coupling` = contact ≥ 0.8. **Why the windows are wide:** modelled node label radius
  6.3–7.0 mm with centre 7.6–10.0 mm from the shaft axis, plus the 8-px rule — not the tolerances.
  At ≥ half peak target area, the RMS window is only −40° to +23°.
- **Word trap:** "calibrated" in learner text (`prepare.ts:232`, `locate.ts:113,221,269`,
  `prepare.ts:316`) means how the start pose was placed, not clinical calibration.

| Item                  | Current behaviour                   | Learner risk                            | Proposed wording / visual                                                                                          | Purely explanatory?           | Decision / evidence needed for real calibration                                  |
| --------------------- | ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------- |
| L3-7, L11-6 (+ L12-4) | ~120° windows                       | Over-estimating rotation tolerance      | Teaching drafts D6 limitation sentence                                                                             | Yes                           | Faculty; real calibration would need device/patient rotation data (none in repo) |
| L3-14                 | No 0° reference or head/foot mark   | Misreading direction                    | D5 sentence; optional model-only "toward head" mark on the rendered sector                                         | Yes (model-only)              | Owner                                                                            |
| L3-15                 | Plane-along-shaft never stated      | Reading the sector as an axial CT slice | D4 sentence (model fact + "check your processor")                                                                  | Yes                           | Faculty; a processor display convention would need the device documentation      |
| L17-5 (Q2)            | Five ovals without station identity | —                                       | Hold; colour only from IASLC N definitions relative to a chosen primary side; do not print plan-task answers early | No (new anatomy on a drawing) | Faculty assigns ovals                                                            |
| L19-2 (Q5)            | One generic sentence per view       | No view-specific anatomy                | Compute model-only relations from mesh ids, faculty approves wording                                               | Partly                        | Faculty                                                                          |

**Measurement stays in two separate boxes:**

- **Analytic phantom (lesson 9):** the reference is genuinely model-derived — central elongated
  section 16.0 mm short axis / 32.0 mm long axis in phantom millimetres
  (`build_additional.py:132-145` → `model-contract.json`; `phantomPlaneReference`,
  `ebus-model-contract.ts:162-185`). Recording already refuses calipers more than 1.25 phantom mm from
  the exact border point (`ebus-model-contract.ts:213-217`). Options for L9-2/L9-4: show the reference
  and the learner's difference after recording, and ask a reflection question that uses the learner's
  number — no score. L9-3: label "phantom mm" and origin, or hide the fields.
- **Patient recording (lesson 10):** calipers are pixels of the 1920×1080 frame; two points count once
  > 0.025 of the frame apart; the UI already says it is "a distance on the picture, not a calibrated
  > measurement". **No expert caliper exists and none is proposed** (L10-1) until an attributable expert
  > annotation and a verified calibration exist. No accuracy score, no certification.

---

## 4. Clinical and source questions (G4)

All sources retrieved 2026-09-23. "Read in full" means the publisher/PMC full text was opened in this
batch; items marked _checked directly_ were compared verbatim by Claude, the rest by the batch's
research session. Short quotes only; locations given.

| ID                         | Current runtime wording (location)                                                                                                                   | Primary source                                                                                                                                                                                                                                      | Full text?                                                                                                           | Supports                                                                                                                                                                                                                                                                                                                            | Does not support / conflict                                                                                                                                                                                                                                                                          | Status · proposed owner decision                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **L26-4**                  | "…the 2026 ERS/ESGE/ESTS guideline no longer recommends routine add-on mediastinoscopy" (`complete.ts:192`; items `complete.ts:257`, `cases.ts:378`) | Korevaar DA … Annema JT. ERS/ESGE/ESTS clinical practice guidelines on endobronchial and oesophageal endosonography for the diagnosis and staging of lung cancer. _Eur Respir J_ 2026;68(2):2600097. DOI 10.1183/13993003.00097-2026; PMID 42167778 | **Yes — checked directly** (publisher HTML)                                                                          | PICO 4 / Table 1: "We do not recommend add-on confirmatory mediastinoscopy after a negative systematic endosonography" — strong recommendation against, low certainty; suspected or proven NSCLC with an indication for nodal staging. Justification: consider only when risk of a false-negative systematic endosonography is high | A ban; targeted (non-systematic) negatives; any definition of a representative sample. **Conflict:** 2015 ESGE/ERS/ESTS and ESTS 2014 recommended surgical staging after negative endosonography; ACCP 2013 remark (surgical staging if suspicion stays high). MEDIASTrial was **not** used as proof | **READY FOR OWNER DECISION** — current sentence is supported but softer than the source; optional closer paraphrase D1      |
| L17-6                      | "…2026 guideline favors systematic staging over a targeted examination… core mediastinal stations 4R, 4L, and 7" (`plan.ts:111`)                     | 2026 (above), PICO 2; De Leyn P et al., ESTS, _Eur J Cardiothorac Surg_ 2014;45:787-798 (PMID 24578407); Vilmann P et al., _ERJ_ 2015;46:40-60                                                                                                      | 2026 yes (checked directly: conditional, very low certainty); 2015 yes; **ESTS 2014 partial** (automated extraction) | 2026 matches the runtime; 2026 proposes visually assessing 4R/4L/7 and sampling when criteria suggest malignancy. ESTS 2014: nodes > 5 mm _can_ be visualised and sampled; 4R/4L/7 always sought                                                                                                                                    | A > 5 mm **sampling threshold** (feasibility statement only); 2015 samples ≥ 3 stations when the mediastinum is abnormal on CT/PET, no 5 mm rule                                                                                                                                                     | **SOURCE VERIFICATION INCOMPLETE** for ESTS 2014 — do not add a threshold; retain current wording                           |
| L18 (related, same source) | "The 2026 ERS/ESGE/ESTS guideline suggests combined EBUS plus EUS or EUS-B when feasible" (`plan.ts:199`)                                            | 2026, PICO 3                                                                                                                                                                                                                                        | Yes — checked directly                                                                                               | Conditional suggestion for combined EBUS-TBNA + EUS(-B)-FNA over EBUS-TBNA alone, moderate certainty                                                                                                                                                                                                                                | "when feasible" is the course's qualifier, not a quoted phrase                                                                                                                                                                                                                                       | Supported; no change proposed                                                                                               |
| **L22-3**                  | "…2024 CHEST guideline suggests ROSE and recommends four or more needle passes… suggests a 21G or 22G needle over a 19G" (`sample.ts:107-108`)       | Gilbert CR … Yarmus LB. Acquisition and Handling of EBUS-TBNA Samples: an ACCP guideline. _Chest_ 2025;167(3):899-909 (online 2024). DOI 10.1016/j.chest.2024.08.056; PMID 39343294                                                                 | **Yes — recs 3–5 checked directly**                                                                                  | Suspected malignancy: rec 3 ROSE (conditional, very low); rec 4 21/22G over 19G (conditional, very low); rec 5 ≥ 4 passes over ≤ 3 (**strong**, very low) — not conditioned on ROSE absence                                                                                                                                         | Nonmalignant disease (recs 6–9 differ); differs from CHEST 2016 (≥ 3 passes without ROSE)                                                                                                                                                                                                            | **RETAIN CURRENT BEHAVIOR**; optional registry year label D3                                                                |
| L2-1, L2-7                 | "Antithrombotic interruption … depend[s] on the drug, indication, patient, and local guidance; avoid a universal hold interval" (`prepare.ts:139`)   | Douketis JD et al., ACCP, _Chest_ 2022;162:e207-e243 (PMID 35964704); Du Rand IA et al., BTS, _Thorax_ 2013;68 Suppl 1 (PMID 23860341); ICS/IAB 2023 (PMC10401980)                                                                                  | ACCP yes; ICS yes; BTS partial (non-publisher copy, flowchart not read)                                              | ACCP Table 2: "Bronchoscopy ± biopsy" = low-to-moderate bleed risk; drug-class interruption recommendations worded for elective surgery/procedures. ICS (only EBUS-specific): aspirin may continue; clopidogrel may continue when thrombosis risk outweighs bleeding risk (3A)                                                      | EBUS is not named by ACCP; BTS excludes EBUS; **clopidogrel timing conflicts** (ACCP 5 days for surgery, BTS 7 days for biopsy, ICS may continue)                                                                                                                                                    | **LOCAL PROTOCOL REQUIRED** — no schedule added; L2-7 optional: cite ACCP 2022 only for risk stratification with its limits |
| L2-2                       | No dimensions in course (`prepare.ts:140`)                                                                                                           | Olympus BF-UC190F brochure ©2021 (OAIRES0121BRO38644), p.4                                                                                                                                                                                          | Yes (brochure)                                                                                                       | Distal end 6.6 mm, insertion tube 6.3 mm, working length 600 mm                                                                                                                                                                                                                                                                     | **Not an IFU**; no IFU revision found online or locally                                                                                                                                                                                                                                              | **SOURCE VERIFICATION INCOMPLETE** — keep generic unless the owner names a device and supplies its IFU                      |
| L20-2                      | Sequence key: target/path first, then protected needle and assembly                                                                                  | No primary source fixes this order                                                                                                                                                                                                                  | —                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                    | **READY FOR OWNER DECISION** — A: explain the intended dependency (D9); B: accept both orders (clinical/device review)      |
| L20-3                      | "Needle extension limits, sheath adjustment, suction, stylet handling, and sampling motions depend on the device and protocol" (`sample.ts:16`)      | Wahidi MM et al., CHEST 2016 (PMID 26402427); ICS/IAB 2023                                                                                                                                                                                          | Yes                                                                                                                  | Suction optional; stylet optional (ICS 1B); a pass = one entry/exit, typically 5–15 agitations (2016); ≥ 10 agitations (ICS, expert opinion); confirm needle retracted and locked                                                                                                                                                   | A universal step order                                                                                                                                                                                                                                                                               | **LOCAL PROTOCOL REQUIRED** (and device IFU) — no new sequence                                                              |
| L20-4 (Q1)                 | "An exposed tip can harm the patient or the equipment"                                                                                               | Device IFU (not available)                                                                                                                                                                                                                          | —                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                   | Specific harms not sourced                                                                                                                                                                                                                                                                           | **READY FOR OWNER DECISION** — hold specific wording until a source is chosen                                               |
| L23-3                      | "Collect separate material in the laboratory-approved sterile medium" (`sample.ts:237`, lesson 23 matching)                                          | Gilbert 2024/25 recs 2, 6; ICS/IAB 2023 §VI                                                                                                                                                                                                         | Yes                                                                                                                  | Either alternative media (formalin, RPMI, saline, PBS) or standard alcohol-based preparations acceptable (conditional); cell block routinely (ICS 2A)                                                                                                                                                                               | A universal default medium                                                                                                                                                                                                                                                                           | **LOCAL PROTOCOL REQUIRED**                                                                                                 |
| L25-2                      | No benchmark in course                                                                                                                               | Eapen GA et al., AQuIRE, _Chest_ 2013;143:1044-1053 (PMID 23117878)                                                                                                                                                                                 | **ABSTRACT ONLY — FULL TEXT NOT VERIFIED**                                                                           | 1,317 patients, 6 hospitals; complications 1.44%; pneumothorax 0.53%; transbronchial biopsy the only complication risk factor; age > 70, inpatient, deep sedation/GA associated with **escalation of care**                                                                                                                         | Complication definitions and co-procedures unchecked                                                                                                                                                                                                                                                 | **SOURCE VERIFICATION INCOMPLETE** — no benchmark until full text read                                                      |
| L25-3                      | "…initiate the team's airway and bleeding response"                                                                                                  | No authorized local protocol supplied                                                                                                                                                                                                               | —                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                                                                                                                    | **LOCAL PROTOCOL REQUIRED** — optional boundary sentence D7                                                                 |
| Glossary Q4                | Terms left undefined (`glossary.ts:6-7`)                                                                                                             | Official expansions (ERS 2026, CHEST, IASLC); ICS/IAB 2023 Table 5 for central hilar structure                                                                                                                                                      | Yes (IFU: search result only)                                                                                        | Expansions in teaching drafts D8                                                                                                                                                                                                                                                                                                    | Fujiwara 2010's own CHS definition: FULL TEXT NOT VERIFIED                                                                                                                                                                                                                                           | **READY FOR OWNER DECISION** — needs relaxing the Prompt-04 "course sentences only" rule                                    |

**Related sources recorded for G2/G5:** Fujiwara T et al., _Chest_ 2010;138:641-647 (PMID 20382710,
abstract only: round shape, distinct margin, heterogeneous echogenicity and coagulation necrosis sign
as independent predictors); Hylton DA et al., Canada Lymph Node Score, _J Thorac Cardiovasc Surg_
2020;159:2499-2507 (PMID 31926701, abstract only). Both are probability modifiers, not diagnosis;
naming them in lesson 16 is an owner decision after full-text reading.

**Local and device gaps:** no authorized local antithrombotic, specimen-media, bleeding-response or
needle-pass protocol has been supplied to this course; no scope/needle IFU revision is on file.
Institutional interventional-pulmonology unit documents exist in Local-Data
(`private-references/preference-cards-ucsd/`) — collected for the preference-card module, **not**
authorized as this course's local protocol, and not reproduced here. They are not used as public
source evidence. The owner decides whether they may serve.

### 4a. Pre-procedure fasting (owner input 2026-09-24)

| Sub-question                           | Status                                                                                           | Record                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| May patients eat or drink before EBUS? | **OWNER DECISION — fasting required before EBUS** (Russell Miller, repository owner, 2026-09-24) | Patients should not eat or drink before EBUS; pre-procedure fasting is required. This closes the earlier conflict question.                                                                                                                                                                     |
| Exact fasting interval                 | **LOCAL / ANESTHESIA POLICY REQUIRED** — NOT REVIEWED                                            | No universal interval is set. The course already directs fasting intervals to local guidance (`prepare.ts:219`: "Drug holds, fasting intervals, airway devices, and sedative doses must follow current local guidance…") and lists "fasting status" in the readiness review (`prepare.ts:139`). |

Future runtime concept, documentation only (teaching drafts D10, not implemented): "Patients should
fast before EBUS. Follow the applicable anesthesia and local procedural policy for the required fasting
interval."

**Registry corrections (proposed, not applied):** the `ers2026` title (teaching drafts D2); `chest2024`
issue year 2025 (D3); `combined2015` was read via its ERJ co-publication, not the Thieme PDF the
registry links.

---

## 5. Running case: provisional staging and report fields (G5)

**Supplied case facts only** (`EXAMINATION_CASE`, `examination-cases.ts:5-214`; authored fictional case):

| Kind                       | Content                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Known case facts           | Left lung primary. Stations planned: 4R (two distinct nodes, A and B), 7, 4L, 11L. Category declared per station in the plan task: 4R N3, 7 N2, 4L N2, 11L N1                                                                                                                                                                                                                                                      |
| Preliminary ROSE           | 4R node B: "malignant cells identified. This is provisional information." Station 7: no on-site interpretation supplied                                                                                                                                                                                                                                                                                            |
| Final pathology            | 4R node A: blood only, no representative lymphoid or lesional material. Station 7: representative lymphoid material without malignant cells. 4R node B: **pending**; ancillary suitability pending (medium/quantity need laboratory clarification)                                                                                                                                                                 |
| Unestablished              | 4L: no acceptable stable window, not sampled. 11L: not examined (procedure stopped for tolerance). No recovery observations, injury severity or discharge readiness                                                                                                                                                                                                                                                |
| Learner declarations today | Plan task: per-station category and station count; adequacy task: ROSE is provisional; report task: per-node visualization/sampling/reason, conclusion "incomplete", responsible team, and all six supported statements — including "The 4R Node A aspirate is nonrepresentative; it does not establish a negative node" and "4R Node B has provisional malignant cells on ROSE; final pathology … remain pending" |

**Already taught:** nonrepresentative ≠ negative (report option `nonrepresentative`, lesson 26); ROSE
is provisional (adequacy task). **Not asked:** what the provisional 4R finding would mean for the N
category, and what stays unestablished until final pathology.

**Sources:** N3 = contralateral mediastinal, contralateral hilar, or scalene/supraclavicular
involvement; N2a single / N2b multiple ipsilateral mediastinal stations (Huang J et al., IASLC N
descriptors for the 9th edition, _J Thorac Oncol_ 2024;19:766-785, Table 3, PMC12323887 — read).
No primary guideline sentence stating "nonrepresentative is not negative" was found; it remains the
course's own teaching statement (lesson 26 paragraph 1).

**Proposed field — DRAFT — NOT REVIEWED (documentation only; no schema change in this batch):**

| Property                     | Proposal                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field name                   | `provisional-n` (a new key in the existing open `decisions` record)                                                                                                                                                                                                      |
| Teaching purpose             | Recognize that a provisional malignant finding at a contralateral mediastinal station **would** imply N3 **if confirmed**, and that it is not yet final                                                                                                                  |
| Allowed states               | "Provisional N3 pending final pathology" · "N3 confirmed" · "No N category can be stated" · "Not yet declared" (initial)                                                                                                                                                 |
| Source dependency            | IASLC 9th N descriptors; the case's own ROSE/final-pathology split                                                                                                                                                                                                       |
| Provenance                   | `learner-declaration`; never derived or pre-filled                                                                                                                                                                                                                       |
| Relation to saved draft      | `decisions` is `z.record(text)`, so a new key needs no schema version. **But** adding an expectation to the existing `report:v1` task would change acceptance for learners who already completed it — prefer a new optional prompt or a new task version, owner's choice |
| Must never be auto-populated | The N category, a clinical stage, a management recommendation, "negative" for 4R node A, or anything inferred from preliminary ROSE                                                                                                                                      |
| Optional companion           | "What remains unestablished" (free text or fixed choices: final pathology of 4R node B; 4L; 11L; ancillary results) — learner-entered                                                                                                                                    |

**Prohibited inferences (restated):** no definitive stage, no management inference, no final
malignancy from ROSE, blood-only ≠ negative node, no specimen destinations invented (L22-6 stays
**INSUFFICIENT EVIDENCE — HOLD**: the case supplies requested tests and results, not destinations),
existing genuine learner declarations never overwritten. L12-6 and L26-3 (record messages and
defaults, grouped here by `OWNER_DECISIONS.md`) were handled in Prompt 01: **RETAIN CURRENT BEHAVIOR**.

**Owner decision:** add the learner-declared field (later runtime batch) / keep the current report
options. Reviewer: thoracic oncology faculty for wording.

---

## 6. Better questions and less repetition (G6)

Ten drafts, one per recurring defect class, are in the teaching drafts §A: R1 `purpose-predict`
(off-axis distractor), R2 `prep-predict` (worked example re-nouned), R3 `prep-transfer` and
R6 `seven-predict` (stem names the problem — Prompt-04 carry-forward L2-6, L12-2), R4
`cutaway-observe` (**L5-1**), R5 `depth-observe-v2` (length cue), R7 `hilar-predict` (re-asks the
matched row — L15-3), R8 `morphology-observe` (same vignette four times), R9 `recovery-observe`
(meta-question), R10 `followup-negative` (verbatim repeat of a guideline-recall item). Every draft is
DRAFT — NOT REVIEWED, cites course text for its rationale, and keeps the self-paced policy (no
concealment, scoring, mandatory attempts or delayed solutions). The remaining question rows get
per-row dispositions in §A.11, and the L21-3 recognition-first scenario — fixed, never random, in a
separate example state — is §A.12.

**L5-1 disposition: UNRESOLVED.** Options: A condition-neutral replacement (drafted) · B keep the
item and the Prompt-04 note · C one variant per held condition · D require the reflector state before
the check (**not recommended** — a new acquisition gate). The Prompt-02 data contract and the
Prompt-04 presentation note are unchanged.

**Measured bank fact:** the keyed option is the longest in 45 of 108 items; display order is rotated
per item, so length is the remaining cue.

---

## 7. Curriculum consolidation and media delivery (G7)

**Consolidation (Q13):** teaching drafts §C maps lessons 6, 7, 8 and 10 — deep links
(`/ebus-guided/learn?section=…`), activity ids, `taskId`s, genuine acquisition criteria, checks,
progress semantics (lesson-id-based self-paced record; session-only held evidence; legacy
`<taskId>:v<version>` keys), repetition vs intended retrieval, a possible progressive order, what
stays required/optional/separate, and seven migration risks. **Recommendation to the owner: decide G1
first** — the Doppler station cannot be consolidated while its recording's purpose is open.

**Media delivery (L6-5) — inventory:**

| File       | Bytes      | Video                                                                     | Duration / frames | Guided-course reach                  |
| ---------- | ---------- | ------------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| Depth2.mp4 | 44,110,477 | H.264 Main, 1920×1080, 60 fps, ~9.28 Mb/s, keyframe every 0.5 s, no audio | 38.000 s / 2,280  | Gain 4 window (6–8 s)                |
| Depth3.mp4 | 35,315,925 | same, ~7.43 Mb/s                                                          | same              | Gain 4 window                        |
| Depth4.mp4 | 37,688,981 | same, ~7.93 Mb/s                                                          | same              | 0–34 s (gain, contrast, colour flow) |
| Depth5.mp4 | 30,176,628 | same, ~6.35 Mb/s                                                          | same              | Gain 4 window                        |
| Depth6.mp4 | 34,181,612 | same, ~7.19 Mb/s                                                          | same              | Gain 4 window                        |
| Depth8.mp4 | 15,063,192 | same, ~3.16 Mb/s                                                          | same              | Gain 4 window (lesson 6 start)       |

- Each file is 19 consecutive 2-s windows (gain 1–8, contrast 1–8, colour, power, H-flow); no window
  is shared by two lookup entries. The `<video>` fetches the **whole** 38-s file to show one 2-s window.
- Per-frame colour counts in `Depth4.mp4` repeat in runs of 2–4 frames: the 60-fps file repeats
  source images. Whether repeated frames are pixel-identical was **not** established.
- Display is no longer ~208 px: Prompt 02 enlarged the view (≈ 493 px wide at 1246×1021) and an
  enlarge dialog scales to the viewport, so a low-resolution derivative would show its losses.
- No derivative exists in the repo; `public/socal-ebus-course/app` holds byte-identical build copies.

**Reversible derivative strategy — DRAFT — NOT REVIEWED (proposal; nothing converted):**

1. **Keep originals byte-for-byte** at their current paths. Derivatives live under a new versioned
   path (for example `media/knobology/derived/v1/`) with a mapping file per derivative:
   source path + source SHA-256 → derivative path + SHA-256, exact tool command, creation date,
   `fidelityReview: NOT REVIEWED`. The runtime would read the mapping and fall back to the original;
   restoring = removing the mapping entry.
2. **Trial first the option that loses nothing:** because keyframes fall every 0.5 s and every window
   starts on a 2-s boundary, each 2-s window can be cut with stream copy (no re-encode) — identical
   decoded frames, ≈ 2 MB per window at the current bitrate (arithmetic, not a produced file), and only
   the requested window is fetched. The seek offset (+0.025 s) and loop end (−0.045 s) must be re-checked
   against each cut file.
3. Only then consider lossy options (lower resolution, frame-rate decimation, lower bitrate), each as a
   separate derivative, and **do not assume** 720p / 30 fps / ~1 Mb/s is adequate.
4. **What must survive:** speckle texture and intermediate grey levels (lesson 7 teaches their loss),
   node border sharpness, the colour map's hue and extent and its frame-by-frame evolution in the
   Doppler window (the G1 episode timing), depth-scale ticks, the colour-box outline and focus markers,
   the whole frame for the whole-frame view, and identical colour conversion (the streams carry no colour
   tags).
5. **How the owner compares:** fixed frame indices (including the §1a Doppler frames) side by side at
   the enlarged display size; the colour-fraction timeline recomputed on the derivative and compared;
   PSNR/SSIM only as screening; a blinded original-vs-derivative viewing by the owner or faculty;
   adoption recorded per file.

**Owner decision:** trial the lossless window cut (later batch) / trial lossy derivatives with review /
retain originals (**RETAIN CURRENT BEHAVIOR** until decided).

---

## Owner review checklist

Fill in only after a real review. Leave blank otherwise. Rows 23–29 were added on 2026-09-24; only
rows 23 and 25 record actual owner decisions.

| #   | Decision                                                                                                | Retain / revise / hold / remove | Rationale                         | Source or annotation reference        | Reviewer       | Role             | Actual date |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------- | ------------------------------------- | -------------- | ---------------- | ----------- |
| 1   | G1 — Doppler recording purpose (A/B/C/D) and frames                                                     |                                 |                                   |                                       |                |                  |             |
| 2   | G1 — 4R/4L disc meaning and view orientation; internal id text on CT                                    |                                 |                                   |                                       |                |                  |             |
| 3   | G1 — recording and station-image provenance, consent, de-identification, rights                         |                                 |                                   |                                       |                |                  |             |
| 4   | G1 — lesson 14 model-label reveal after acquisition                                                     |                                 |                                   |                                       |                |                  |             |
| 5   | G2 — storyboard A (2R/4R/10R boundaries)                                                                |                                 |                                   |                                       |                |                  |             |
| 6   | G2 — storyboard B (troubleshooting from genuine states) and B4 clip                                     |                                 |                                   |                                       |                |                  |             |
| 7   | G2 — commission node-feature / needle / station 8–9 images, or hold                                     |                                 |                                   |                                       |                |                  |             |
| 8   | G3 — wide model windows: limitation wording or calibration                                              |                                 |                                   |                                       |                |                  |             |
| 9   | G3 — model-only orientation statements (D4, D5)                                                         |                                 |                                   |                                       |                |                  |             |
| 10  | G3 — phantom reference display and reflection question (L9-2/3/4)                                       |                                 |                                   |                                       |                |                  |             |
| 11  | G3 — L17-5 oval labels; L19-2 per-view anatomy                                                          |                                 |                                   |                                       |                |                  |             |
| 12  | G4 — L26-4 wording (verified; optional D1)                                                              |                                 |                                   |                                       |                |                  |             |
| 13  | G4 — antithrombotic, specimen-media, bleeding and pass-sequence local protocols                         |                                 |                                   |                                       |                |                  |             |
| 14  | G4 — device naming and IFU (L2-2, L20-4)                                                                |                                 |                                   |                                       |                |                  |             |
| 15  | G4 — AQuIRE benchmark after full-text reading                                                           |                                 |                                   |                                       |                |                  |             |
| 16  | G4 — glossary external definitions (D8) and registry corrections (D2, D3)                               |                                 |                                   |                                       |                |                  |             |
| 17  | G5 — provisional-N learner field                                                                        |                                 |                                   |                                       |                |                  |             |
| 18  | G6 — ten item drafts R1–R10 (per item)                                                                  |                                 |                                   |                                       |                |                  |             |
| 19  | G6 — L5-1 option A/B/C                                                                                  |                                 |                                   |                                       |                |                  |             |
| 20  | G6 — L21-3 recognition-first scenario                                                                   |                                 |                                   |                                       |                |                  |             |
| 21  | G7 — progressive workbench (after G1)                                                                   |                                 |                                   |                                       |                |                  |             |
| 22  | G7 — derivative trial (lossless cut first)                                                              |                                 |                                   |                                       |                |                  |             |
| 23  | G4 — Fasting required before EBUS                                                                       | Decided: fasting required       | Owner decision                    | §4a                                   | Russell Miller | Repository owner | 2026-09-24  |
| 24  | G4 — Exact fasting interval                                                                             | Hold: local/anesthesia policy   |                                   |                                       |                |                  |             |
| 25  | G1 — Depth3 visible date/time finding (full-video owner review; ~10–12 s only)                          | Reviewed                        | Owner inspected the complete clip | §1c                                   | Russell Miller | Repository owner | 2026-09-24  |
| 26  | G1 — Depth3 replacement candidate (technically verified; adoption in a separate task)                   |                                 |                                   | §1c, manifest `replacementCandidates` |                |                  |             |
| 27  | G1 — Depth3 rights/provenance/consent (still unresolved)                                                |                                 |                                   |                                       |                |                  |             |
| 28  | G1 — Historical Git blob: current-file replacement only (A) / history purge (B) / other remediation (C) |                                 |                                   | §1c                                   |                |                  |             |
| 29  | G1 — Committed screenshots: reviewed for flagged metadata (window not present); rights not reviewed     |                                 |                                   | §1c                                   |                |                  |             |

## Accounting

All 52 lane-05 IDs and all 12 Prompt-04 carry-forward items (L20-4, L17-5, L5-1, glossary Q4 with its
nine terms, L19-2, L2-6, L12-2, L15-3, L22-6, workbench Q13, CT primer Q14, image needs Q15) have a
decision object in the manifest and a row in the status file. None of them is marked reviewed. The
2026-09-24 amendment added seven decision objects (fasting requirement, fasting interval, Depth3
metadata, replacement candidate, Depth3 rights/provenance, historical blob, committed screenshots);
only `OWNER-FASTING-REQUIRED` and `DEPTH3-METADATA` carry an owner review.

## Not done / limits

- No faculty, clinical or source review. Owner review is limited to the two matters in §1c and §4a.
- No browser re-check of the lesson-14 −14° frame (computed offline through the repo code path).
- Full text **not** read: AQuIRE, Fujiwara 2010, Canada Lymph Node Score (abstracts only); ESTS 2014
  (automated extraction only). Publisher access for these redirected to institutional sign-in, and no
  credentials were used.
- Whether the standalone SoCal knobology lab reaches the Depth3 banner window was not traced.
- The committed screenshots were reviewed only for the flagged Depth3 metadata, not for rights.
