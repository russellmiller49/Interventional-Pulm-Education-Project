import type { Source, SourceId } from '../types'

export const REVIEWED_ON = '2026-09-08'
export const SOURCES: Source[] = [
  {
    id: 'setser',
    authors: 'Setser R, Chintalapani G, Bhadra K, Casal RF.',
    title: 'Cone beam CT imaging for bronchoscopy: a technical review.',
    publication: 'J Thorac Dis. 12:7416–7428.',
    year: 2020,
    url: 'https://doi.org/10.21037/jtd-20-2382',
    kind: 'Technical review',
    supports:
      'Acquisition geometry, suite preparation, image artifacts, multiplanar review, and respiratory coordination.',
    limitation:
      'Historical systems and expert technique; device capabilities and ventilation settings do not transfer automatically.',
  },
  {
    id: 'wabip',
    authors: 'Wijma IN, Casal RF, Cheng GZ, et al.',
    title:
      'Radiation Principles, Protection, and Reporting for Interventional Pulmonology: A WABIP White Paper.',
    publication: 'Respiration. 103(11).',
    year: 2024,
    url: 'https://doi.org/10.1159/000540102',
    kind: 'Professional guidance',
    supports:
      'Bronchoscopy radiation optimization, staff protection, and standardized dose reporting.',
    limitation: 'Apply with local radiation safety rules and measured equipment performance.',
  },
  {
    id: 'aapm12',
    authors: 'Fisher RF, Applegate KE, Berkowitz LK, et al.',
    title: 'AAPM Medical Physics Practice Guideline 12.a: Fluoroscopy dose management.',
    publication: 'J Appl Clin Med Phys. 23:e13526.',
    year: 2022,
    url: 'https://doi.org/10.1002/acm2.13526',
    kind: 'Practice guideline',
    supports:
      'Reference air kerma, skin-dose interpretation, dose notifications and follow-up programs.',
    limitation:
      'Suggested action levels trigger review; they are neither a patient dose limit nor a prediction of injury.',
  },
  {
    id: 'tg272',
    authors: 'Lin PJP, Goode AR, Corwin FD, et al.',
    title:
      'AAPM Task Group Report 272: Comprehensive acceptance testing and evaluation of fluoroscopy imaging systems.',
    publication: 'Med Phys. 49:e1–e49.',
    year: 2022,
    url: 'https://doi.org/10.1002/mp.15429',
    kind: 'Technical report',
    supports:
      'Detector sampling, magnification modes, temporal behavior, and system commissioning.',
    limitation: 'Nominal pixel size and console labels do not establish actual performance.',
  },
  {
    id: 'tg125',
    authors: 'AAPM Task Group 125.',
    title:
      'Functionality and operation of fluoroscopic automatic brightness control/automatic dose rate control logic in modern cardiovascular and interventional angiography systems.',
    publication: 'AAPM Report 125.',
    year: 2012,
    url: 'https://www.aapm.org/pubs/reports/RPT_125.pdf',
    kind: 'Technical report',
    supports: 'Automatic exposure response, output controls and filtration.',
    limitation: 'Controller examples are system-specific; verify current equipment and software.',
  },
  {
    id: 'saad',
    authors: 'Saad F, Frysch R, Saalfeld S, et al.',
    title:
      'CT-augmented digital tomosynthesis image reconstruction in image-guided bronchoscopy interventions.',
    publication: 'Med Phys. 52:1468–1480.',
    year: 2025,
    url: 'https://doi.org/10.1002/mp.17551',
    kind: 'Primary study',
    supports: 'Limited-angle reconstruction and the influence of prior CT information.',
    limitation:
      'Phantom and six patient datasets; image-similarity improvement does not establish improved diagnostic yield.',
  },
  {
    id: 'sumner',
    authors: 'Sumner ET, Chang J, Patel PR, Bedi H, Shaller BD.',
    title: 'State of the art: peripheral diagnostic bronchoscopy.',
    publication: 'J Thorac Dis. 16:5409–5421.',
    year: 2024,
    url: 'https://doi.org/10.21037/jtd-24-346',
    kind: 'Technical review',
    supports:
      'What the platforms in use build from a DTS acquisition: the arc of rotation, the systems that render images resembling CT from it, the systems that do not, and the reported separation between a target drawn that way and the same target on CBCT.',
    limitation:
      'Narrative review of platforms available at the time of writing. The separation figure is the widest value from two cited comparisons, not a distribution; behaviour differs by vendor, version and case.',
  },
  {
    id: 'podder',
    authors: 'Podder S, Wagh A, Hogarth DK.',
    title: 'Digital tomosynthesis for navigational bronchoscopy: a clinical practice review.',
    publication: 'J Thorac Dis. 17:7379–7389.',
    year: 2025,
    url: 'https://doi.org/10.21037/jtd-2024-2063',
    kind: 'Technical review',
    supports:
      'The angular range of a bronchoscopy DTS acquisition against that of CT, the blurring of planes away from the chosen one, and the dose-for-information trade a narrower span makes.',
    limitation:
      'Narrative practice review. Its section-thickness figure is more favourable than the limited-angle depth resolution reported in the reconstruction literature, so the span is cited here and that figure is not.',
  },
  {
    id: 'mobile',
    authors: 'Salahuddin M, Bashour SI, Khan A, et al.',
    title: 'Mobile Cone-Beam CT-Assisted Bronchoscopy for Peripheral Lung Lesions.',
    publication: 'Diagnostics. 13:827.',
    year: 2023,
    url: 'https://doi.org/10.3390/diagnostics13050827',
    kind: 'Primary study',
    supports:
      'Mobile-suite workflow and separate fluoroscopy versus rotational exposure accounting.',
    limitation:
      'Retrospective single-center series; dose and outcome values are not universal benchmarks.',
  },
  {
    id: 'verhoeven',
    authors: 'Verhoeven RLJ, van der Sterren W, Kong W, et al.',
    title:
      'Cone-beam CT and Augmented Fluoroscopy-guided Navigation Bronchoscopy: Radiation Exposure and Diagnostic Accuracy Learning Curves.',
    publication: 'J Bronchol Intervent Pulmonol. 28:262–271.',
    year: 2021,
    url: 'https://doi.org/10.1097/LBR.0000000000000783',
    kind: 'Primary study',
    supports: 'Task-specific acquisition protocols and whole-procedure dose improvement.',
    limitation:
      'Learning-curve cohort with simultaneous workflow changes; no isolated causal effect of one control.',
  },
  {
    id: 'vespa',
    authors: 'Salahuddin M, Sarkiss M, Sagar AES, et al.',
    title:
      'Ventilatory Strategy to Prevent Atelectasis During Bronchoscopy Under General Anesthesia: A Multicenter Randomized Controlled Trial (VESPA Trial).',
    publication: 'Chest. 162:1393–1401.',
    year: 2022,
    url: 'https://doi.org/10.1016/j.chest.2022.06.045',
    kind: 'Randomized trial',
    supports: 'A bundled ventilation strategy reduced atelectasis in the studied setting.',
    limitation:
      'The bundle does not isolate the effect of PEEP, oxygen, airway device or recruitment; individualize with anesthesia.',
  },
  {
    id: 'ilocate',
    authors: 'Sagar AES, Sabath BF, Eapen GA, et al.',
    title:
      'Incidence and Location of Atelectasis Developed During Bronchoscopy Under General Anesthesia (I-LOCATE Trial).',
    publication: 'Chest.',
    year: 2020,
    url: 'https://doi.org/10.1016/j.chest.2020.05.565',
    kind: 'Primary study',
    supports: 'Dependent atelectasis during bronchoscopy and radial ultrasound interpretation.',
    limitation:
      'A specific surveyed population and anesthetic workflow; not a universal incidence estimate.',
  },
  {
    id: 'frontier',
    authors: 'Saghaie T, Williamson JP, Phillips M, et al.',
    title:
      'First-in-human use of a new robotic electromagnetic navigation bronchoscopic platform with integrated Tool-in-Lesion Tomosynthesis (TiLT) technology: the FRONTIER study.',
    publication: 'Respirology. 29:969–975.',
    year: 2024,
    url: 'https://doi.org/10.1111/resp.14778',
    kind: 'Primary study',
    supports: 'Feasibility of integrated robotic navigation and tomosynthesis.',
    limitation:
      'Small, single-arm feasibility study; no proof of equivalence to CBCT or superiority to other platforms.',
  },
  {
    id: 'confirm',
    authors: 'Husta BC, Cheng GZ, Batra H, et al.',
    title:
      'Shape-sensing robotic-assisted bronchoscopy with integrated mobile cone-beam CT for small nodules: results from the prospective multicentre CONFIRM study.',
    publication: 'Thorax. 81:267–275.',
    year: 2026,
    url: 'https://doi.org/10.1136/thorax-2025-223272',
    kind: 'Primary study',
    supports:
      'Integrated workflow outcomes and the distinction between tool localization and diagnostic yield.',
    limitation: 'Single-arm combined strategy; does not isolate the contribution of CBCT.',
  },
  {
    id: 'pritchett',
    authors: 'Pritchett MA, Schampaert S, de Groot JAH, et al.',
    title:
      'Cone-Beam CT With Augmented Fluoroscopy Combined With Electromagnetic Navigation Bronchoscopy for Biopsy of Pulmonary Nodules.',
    publication: 'J Bronchol Intervent Pulmonol. 25:274–282.',
    year: 2018,
    url: 'https://doi.org/10.1097/LBR.0000000000000536',
    kind: 'Primary study',
    supports: 'Registered target overlays and intraprocedural CBCT in a combined workflow.',
    limitation:
      'Retrospective combined-modality experience; a projected contour is not an independent live lesion measurement.',
  },
  {
    id: 'icrp',
    authors: 'International Commission on Radiological Protection.',
    title:
      'Occupational Radiological Protection in Interventional Procedures. ICRP Publication 139.',
    publication: 'Ann ICRP. 47(2).',
    year: 2018,
    url: 'https://www.icrp.org/publication.asp?id=ICRP%20Publication%20139',
    kind: 'Professional guidance',
    supports: 'Occupational protection, shielding, dosimetry, and pregnancy at work.',
    limitation:
      'Recommendations and enforceable regulations differ by jurisdiction; consult the local radiation safety officer.',
  },
  {
    id: 'skin',
    authors: 'Andersson J, Bednarek DR, Bolch W, et al.',
    title:
      'Estimation of patient skin dose in fluoroscopy: summary of a joint report by AAPM TG357 and EFOMP.',
    publication: 'Med Phys. 48:e671–e696.',
    year: 2021,
    url: 'https://doi.org/10.1002/mp.14910',
    kind: 'Technical report',
    supports: 'Why reference air kerma and peak skin dose differ.',
    limitation:
      'Dose estimation requires geometry and corrections; this module does not estimate individual skin dose.',
  },
]

export const SOURCE_BY_ID: ReadonlyMap<SourceId, Source> = new Map(
  SOURCES.map((source) => [source.id, source] as const),
)
