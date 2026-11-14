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

Everything below lives in the owner's Google Drive or in published journals and books. Nothing from the
Drive is in the repository. Source ids are those of `src/features/dolphin-bronchoscopy/data/sources.ts`.

| Source id                 | Drive title or citation                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nmmp-workshop-2024`      | "Dolphin Bronchoscopy Workshop 5-8-24 Version.pptx" (Meegan, Gildea, Miller; IAAAM W-04, 19 May 2024), folder "Dolphin Bronchoscopy workshop"; "Module1" Google Slides (Gildea) for bronchoscope vs GI endoscope |
| `nmmp-workshop-2025`      | IAAAM 2025 cetacean bronchoscopy workshop with the 3D-printed model (no separate deck found)                                                                                                                     |
| `nmmp-mapping-2026`       | "Poster_IAAAM_2026_Sanchez_Bronchoscopy_Model JMM edits.pptx"; "Abstract: IAAAM 2026"; the manuscript draft; "Dolphin CT Branching Data" (Sheet1)                                                                |
| `nmmp-bronchoscopy-guide` | Bottlenose Dolphin Bronchoscopy Guide (NMMP/NMMF), the airway names                                                                                                                                              |
| `nmmp-form-2019`          | "NMMP Dolphin Bronchoscopy Form", created by Carli Smith, 2019                                                                                                                                                   |
| `tsang-2002`              | Tsang KW et al. J Wildl Dis 2002;38(1):224–227                                                                                                                                                                   |
| `smith-1999`              | Smith TL, Turnbull BS, Cowan DF. Anat Rec 1999;254(1):98–106 (the laryngeal gland; PMID 9892423)                                                                                                                 |
| `cozzi-2017`              | Cozzi B, Huggenberger S, Oelschläger H. Anatomy of Dolphins. Academic Press, 2017; chapters 4 and 5 (larynx, laryngeal gland). Read in place from a PDF copy, never copied                                       |
| `ivancic-2014`            | Ivančić M, Solano M, Smith CR. Anat Rec 2014;297(5):901–915                                                                                                                                                      |
| `venn-watson-2012`        | Venn-Watson S, Daniels R, Smith C. Dis Aquat Org 2012;99:237–242                                                                                                                                                 |
| `harper-2001`             | Harper CMG et al. J Zoo Wildl Med 2001;32(2):190–195                                                                                                                                                             |
| `dolphin-001-ct`          | The module's own CT case (`public/airway-anatomy/dolphin-001/`)                                                                                                                                                  |
| `nmmp-spout-photographs`  | Eleven NMMP bronchoscopy photographs of entering the goosebeak, supplied by the owner in the authoring session (2026-11-03); two are in the repository as stills (rights ledger below)                           |
| `nmmp-annual-training`    | "Dolphin Bronchoscopy Workshop - NMMP version annual training.pptx" (Meegan et al., revised February 2025), owner's local References folder; slide numbers are presentation order                                |
| `van-bonn-2018`           | Van Bonn W, Dover S. Applied flexible and rigid endoscopy. CRC Handbook of Marine Mammal Medicine, 3rd ed., 2018, ch. 25, pp. 553–566                                                                            |
| `haulena-2018`            | Haulena M, Schmitt T. Anesthesia. CRC Handbook of Marine Mammal Medicine, 3rd ed., 2018, ch. 26, pp. 567–606                                                                                                     |
| `nollens-2018`            | Nollens HH, Venn-Watson S, Gili C, McBain JF. Cetacean medicine. CRC Handbook of Marine Mammal Medicine, 3rd ed., 2018, ch. 40, pp. 887–907                                                                      |
| `reidarson-2018`          | Reidarson TH, García-Párraga D, Wiederhold NP. Marine mammal mycoses. CRC Handbook of Marine Mammal Medicine, 3rd ed., 2018, ch. 19 (Table 19.1, p. 391; p. 415)                                                 |
| `dover-2001`              | Dover SR, Van Bonn W. Flexible and rigid endoscopy in marine mammals. CRC Handbook of Marine Mammal Medicine, 2nd ed., 2001, ch. 27                                                                              |
| `haulena-heath-2001`      | Haulena M, Heath RB. Marine mammal anesthesia. CRC Handbook of Marine Mammal Medicine, 2nd ed., 2001, ch. 29 (Table 1, pp. 658–659)                                                                              |
| `bossart-2001`            | Bossart GD, Reidarson TH, Dierauf LA, Duffield DA. Clinical pathology. CRC Handbook of Marine Mammal Medicine, 2nd ed., 2001, ch. 19 (hemostatic parameters, p. 421)                                             |
| `smith-2012`              | Smith CR et al. Dis Aquat Org 2012;101:243–255 (pulmonary ultrasound in the NMMP dolphins)                                                                                                                       |
| `judge-2014`              | Judge EP et al. Am J Respir Cell Mol Biol 2014;51(3):334–343 (brushes and forceps, p. 340)                                                                                                                       |
| `owner-bench-clips`       | The owner's bench clips of the forceps, brush and needle, at the tip and in the hand (2026-11-03)                                                                                                                |

Not used: "Dolphin article update 4_28_24.docx" (it describes lobes; the dolphin lung has none).
The 169 MB "NMMP version annual training" deck could not be read through Drive export; it is read in
place from the owner's local copy in their References folder (outside Git), as are the CRC Handbooks
(2nd and 3rd editions), Smith 2012 and the 2019 form.

Every number the module teaches is in `content/teachingNumbers.ts` with its class, source, year,
locator and check date. The file header lists the corrections the 2026-11-03 source check made to
the build plan. `npm run numbers:signoff -- dolphin-bronchoscopy` prints the unsigned rows.

## Media and rights ledger

| Media                                                                | Rights                                                                                            | Status                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/dolphin-bronchoscopy/frames/*.png`                           | Renders of the module's own simulator (`simulator-render` in `content/frameBank.ts`)              | Shown                                                                                                                                             |
| `public/dolphin-bronchoscopy/frames/spout-*-photo.jpg`               | Holder: U.S. Navy Marine Mammal Program; photographs 1 and 7 of 11 (`nmmp-still`)                 | Shown. Supplied by the owner, who granted their use 2026-11-03; cropped square, no overlays or metadata                                           |
| `public/bronchoscopy-instruments/clips/*`                            | The owner's bench clips of forceps, brush and needle, supplied for teaching (`owner-bench-clips`) | Shown in the instrument lab (dolphin section 16, Bronchoscopy Foundations). Muted, re-encoded                                                     |
| Other NMMP video stills and photographs (workshop "Pics and videos") | Holder: U.S. Navy Marine Mammal Program                                                           | Not used. A still enters `frameBank.ts` as `nmmp-still` with `permission: 'pending'` and is never shown until `granted` is recorded with its date |

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
   proposal; the real design comes from the NMMP. The paper form has free-text lines per site and
   no drug fields; the report act splits each line into reached, appearance, secretions and sample,
   and its status line says so. Its three lavage inputs follow the form's three yield blanks in order
   (right tracheal bronchus, right lung, left lung), named in the status line; labeling each input by
   region needs a small change in `ReportControl`.
3. RB14 is in the ten-animal series but not traced on this CT (13 branches on the right). A second
   case from the series would show it.
4. The variation teaching rests on ten animals in work not yet published, taught as counts. Confirm
   it may be summarized before publication, and how to cite it. The data sheet notes its CTs were
   flipped horizontally before reading: confirm the sides.
5. Numbers no source gives. Partly answered 2026-11-03. Oral diazepam now has sourced values, taught
   side by side: the NMMP drug sheet (annual training, slide 33) lists 0.1 mg/kg PO or IM; Haulena and
   Heath 2001 (p. 659, Table 1) list 0.2 mg/kg PO an hour before bronchoscopy (Reidarson 1998); Tsang
   gave 0.16–0.17 mg/kg PO. The expected lavage return: Van Bonn and Dover 2018 (p. 556) know of no
   controlled studies, standardized methods or expected values for lavage in marine mammals, so no
   source gives one, and the lavage section says so. Still unsourced: tramadol, albuterol, the
   lidocaine jelly volume; furosemide has a dose only on the held emergency table (question 17). The
   module says "per the NMMP protocol" for these.
6. The scope models behind the 600 mm and 1030 mm working lengths, so the device row can cite an IFU.
7. Resolved 2026-11-03. The annual-training checklist (slide 44) prints "Max lidocaine: Dose 4mg/kg"
   and "Max saline: Dose 2 mL/kg" on separate lines; `bal-volume-nmmp` and `lidocaine-max` cite it.
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
14. Flumazenil: three values, taught as differing. The NMMP drug sheet (annual training, slide 33)
    gives 0.010 mg/kg IM; Ivančić gave 0.003–0.012 mg/kg IV or IM after CT; Haulena and Schmitt 2018
    (Table 26.1, p. 572) list 0.04 mg/kg with no route. The recovery practice case keys the NMMP
    value, inside Ivančić's range; confirm.
15. Asset weight: about 5 MB per scope section, 36 MB where the CT is loaded (sections that read it).
16. The spout tip as displayed is modelled on NMMP bronchoscopy photographs of entering the
    goosebeak (2026-11-03): a pale rounded tip with a triangular glottis, apex dorsal (confirmed by
    the owner 2026-11-03). The CT slit is about 8 × 3 mm and its tip bevelled, so the build shapes
    the tip and the first 20 mm of the lumen (`shape_spout_field`). The owner supplied the
    photographs and granted them as stills the same day, credited to the Navy Marine Mammal
    Program; photographs 1 and 7 are in sections 13 and 03 and the "Where is the tip?" drill. The owner identified the dark, glossy rounded structure in the lower
    part of the opening as the laryngeal gland (2026-11-03), which matches Smith 1999 (a constant
    lymphoepithelial gland in the rostroventral larynx over the cricoid) and Cozzi 2017; section 13
    and the stills' revealed descriptions now name it. Resolved.
17. The NMMP emergency drug table (annual training slide 33, "Dolphin Procedure Drug Doses", worked
    for a 181 kg dolphin) is not taught until the owner checks it; only its diazepam and flumazenil
    lines are. Its epinephrine line, 0.1 mg/kg IV, IT or IC (18.1 mg at 181 kg), looks high.
18. Annual training slide 21 labels the dark rounded structure in the spout photograph "Epiglottis";
    the owner identified it as the laryngeal gland (question 16), and the module teaches the gland.
    Confirm which, and whether the slide changes.
19. Does IV lidocaine on the emergency table (2 mg/kg, IV slowly) count toward the 4 mg/kg maximum?
    The module counts the topical routes only (atomizer, catheter injection, jelly, bronchial syringes).
20. Is the sheathed cytology brush on the NMMP tray (annual training slide 47) acceptable for culture,
    where Tsang used double-sheath sterile brushes?
21. The gastrointestinal scope's working length is 110 cm on the annual slide (slide 11) and 1030 mm
    on the 2024 Module 1 slide. Name the scope (question 6), so one row can cite its IFU.
22. The annual deck's anatomy notes (slide 23) say the marginal lymph nodes drain "each lung lobe";
    the module teaches that the dolphin lung has no lobes (the same slide's body says "No lobation";
    Cozzi 2017, p. 100).
23. The checklist's "ice saline bath" (slide 47; laid out in The room and the team): for bleeding, or
    for cooling the sample? See question 9.
