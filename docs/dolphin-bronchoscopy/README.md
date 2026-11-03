# Dolphin Bronchoscopy module

A self-paced module for veterinarians at `/[locale]/dolphin-bronchoscopy` (Overview, Learn,
Practice, Integrated cases, Reference). Release stage `unlisted-preview`: public by direct link,
noindex, absent from navigation, search and the sitemap, listed on `/admin/modules` and in the
development beta hub. Code: `src/features/dolphin-bronchoscopy/`.

It wraps two pages that stay where they are and link to it:

- `/learn/anatomy/dolphin-airway` — the synchronized bronchoscopy of the dolphin-001 CT
  (`AirwayAnatomyModule` with `DOLPHIN_AIRWAY_CASE`). The module embeds it through the module's
  optional `embed` prop (start pose, label rule, chrome, location callbacks, target beacon); with
  no `embed` the page and the human case render exactly as before.
- `/learn/anatomy/dolphin` — the whole-body 3D model, used by the anatomy sections.

## Sources (read in place, never copied)

Everything below lives in the owner's Google Drive or in published journals. Nothing from the
Drive is in the repository. Source ids are those of `src/features/dolphin-bronchoscopy/data/sources.ts`.

| Source id                 | Drive title or citation                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmmp-workshop-2024`      | "Dolphin Bronchoscopy Workshop 5-8-24 Version.pptx" (Meegan, Gildea, Miller; IAAAM W-04, 19 May 2024), folder "Dolphin Bronchoscopy workshop"; "Module1" Google Slides (Gildea) for bronchoscope vs GI endoscope |
| `nmmp-workshop-2025`      | IAAAM 2025 cetacean bronchoscopy workshop with the 3D-printed model (no separate deck found)                                                                                                                     |
| `nmmp-mapping-2026`       | "Poster_IAAAM_2026_Sanchez_Bronchoscopy_Model JMM edits.pptx"; "Abstract: IAAAM 2026"; the manuscript draft; "Dolphin CT Branching Data" (Sheet1)                                                                |
| `nmmp-bronchoscopy-guide` | Bottlenose Dolphin Bronchoscopy Guide (NMMP/NMMF), the airway names                                                                                                                                              |
| `nmmp-form-2019`          | "NMMP Dolphin Bronchoscopy Form", created by Carli Smith, 2019                                                                                                                                                   |
| `tsang-2002`              | Tsang KW et al. J Wildl Dis 2002;38(1):224–227                                                                                                                                                                   |
| `ivancic-2014`            | Ivančić M, Solano M, Smith CR. Anat Rec 2014;297(5):901–915                                                                                                                                                      |
| `venn-watson-2012`        | Venn-Watson S, Daniels R, Smith C. Dis Aquat Org 2012;99:237–242                                                                                                                                                 |
| `harper-2001`             | Harper CMG et al. J Zoo Wildl Med 2001;32(2):190–195                                                                                                                                                             |
| `dolphin-001-ct`          | The module's own CT case (`public/airway-anatomy/dolphin-001/`)                                                                                                                                                  |
| `owner-spout-photographs` | Eleven bronchoscopy photographs of entering the goosebeak, supplied by the owner in the authoring session (2026-11-03); two are in the repository as stills (rights ledger below)                                |

Not used: "Dolphin article update 4_28_24.docx" (it describes lobes; the dolphin lung has none).
The 169 MB "NMMP version annual training" deck could not be read through Drive export.

Every number the module teaches is in `content/teachingNumbers.ts` with its class, source, year,
locator and check date. The file header lists the corrections the 2026-11-03 source check made to
the build plan. `npm run numbers:signoff -- dolphin-bronchoscopy` prints the unsigned rows.

## Media and rights ledger

| Media                                                          | Rights                                                                               | Status                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/dolphin-bronchoscopy/frames/*.png`                     | Renders of the module's own simulator (`simulator-render` in `content/frameBank.ts`) | Shown                                                                                                                                             |
| `public/dolphin-bronchoscopy/frames/spout-*-photo.jpg`         | The owner's bronchoscopy photographs 1 and 7 of 11 (`owner-photo` in `frameBank.ts`) | Shown. Permission granted by the owner 2026-11-03; cropped square, no overlays or metadata                                                        |
| NMMP video stills and photographs (workshop "Pics and videos") | Holder: U.S. Navy Marine Mammal Program                                              | Not used. A still enters `frameBank.ts` as `nmmp-still` with `permission: 'pending'` and is never shown until `granted` is recorded with its date |

## Regenerating the frames

```bash
npx tsx scripts/dolphin-bronchoscopy/render-frames.mts            # every simulator frame
npx tsx scripts/dolphin-bronchoscopy/render-frames.mts carina     # one frame
DOLPHIN_PROBE_DIR=/tmp/probes npx tsx scripts/dolphin-bronchoscopy/render-frames.mts --probe=name:1:41.5:0:0
```

The script bundles `frame-harness.tsx` with esbuild, compiles the airway module's Tailwind
utilities, serves the bundle beside `public/airway-anatomy/dolphin-001`, and screenshots the
bronchoscope view in headless Chromium (SwiftShader). No dev server or sign-in. It fails if a pose
does not sit on the centerline label its frame claims. `--probe` renders an arbitrary pose (edge id,
distance, yaw, pitch) for choosing a pose before declaring it.

## Checks

```bash
npx jest src/features/dolphin-bronchoscopy src/lib/airway-anatomy "src/app/\[locale\]/dolphin-bronchoscopy" src/i18n
DOLPHIN_BRONCH_BASE_URL=http://localhost:3120 npx playwright test -c playwright.dolphin-bronchoscopy.config.ts
```

The feedback migration `supabase/migrations/20261103180000_add_dolphin_bronchoscopy_to_module_beta_feedback.sql`
must be applied from the primary checkout before the first beta-hub feedback post.

## Open questions for the owner

1. Rights for NMMP video stills and photographs. Frames stay simulator renders until a grant is recorded.
2. The Tursiops record. The module ships the 2019 NMMP form as the record and an extended form as a
   proposal; the real design comes from the NMMP.
3. RB14 is in the ten-animal series but not traced on this CT (13 branches on the right). A second
   case from the series would show it.
4. The variation teaching rests on ten animals in work not yet published, taught as counts. Confirm
   it may be summarized before publication, and how to cite it. The data sheet notes its CTs were
   flipped horizontally before reading: confirm the sides.
5. Numbers no source gives: oral diazepam and tramadol premedication, furosemide and albuterol doses,
   the lidocaine jelly volume, the expected lavage return. The module says "per the NMMP protocol".
6. The scope models behind the 600 mm and 1030 mm working lengths, so the device row can cite an IFU.
7. The workshop checklist line "Max lidocaine: Dose 2 mL/kg" reads as the lavage volume; the module
   teaches 4 mg/kg for lidocaine and 2 mL/kg for lavage.
8. Localization: English content now, chrome in Spanish and Simplified Chinese.
9. Cooling the lavage sample: in the build plan, and the workshop's supply list has an ice saline
   bath and cryovials, but no slide says to cool the sample. The lavage section teaches it; confirm.
10. Section 15's transfer uses a 45 kg juvenile so that 2 mL/kg falls below Tsang's 2 × 50 mL; confirm
    that a scope in an animal that size is realistic.
11. This CT's LB1 computes lateral, but the series records LB1 as dorsolateral in all five males (this
    animal is male) — possibly the flipped-CT note in the data sheet. The module does not state this
    CT's LB1 direction in teaching copy.
12. Taught from the workshop's human-practice slides or general bronchoscopy technique, not dolphin
    data, and said so in the copy where it matters: bleeding management after brushing (wedge,
    suction, ice saline; topical tranexamic acid and epinephrine named "per the NMMP protocol"), the
    platelet-count case, that lavage can lower oxygenation, why insufflation harms (inferred from the
    end-inspiratory breath-hold behind a shut glottis), turning the whole scope to aim sideways.
13. Lavage saline temperature: Tsang used warm saline; the deck's (human) technique slide says room
    temperature in 20–60 mL aliquots. The module teaches Tsang's warm saline; pick one or teach both.
14. Flumazenil: the only dose found is Ivančić's, given after CT; the practice case says so.
15. Asset weight: about 5 MB per scope section, 36 MB where the CT is loaded (sections that read it).
16. The spout tip as displayed is modelled on the owner's bronchoscopy photographs of entering the
    goosebeak (2026-11-03): a pale rounded tip with a triangular glottis, apex dorsal (confirmed by
    the owner 2026-11-03). The CT slit is about 8 × 3 mm and its tip bevelled, so the build shapes
    the tip and the first 20 mm of the lumen (`shape_spout_field`). The owner granted the
    photographs as stills the same day; photographs 1 and 7 are in sections 13 and 03 and the
    "Where is the tip?" drill. Still open: the dark, glossy rounded structure at the lower left of
    the aperture (the stills' alt text calls it only "a dark, glossy rounded surface"); and if the
    photographs belong to the Navy Marine Mammal Program rather than the owner, the holder in
    `frameBank.ts` should say so.
