/**
 * Every source the Dolphin Bronchoscopy module cites, by id.
 *
 * Teaching blocks, items and numbers cite these ids; a validator refuses an id that is not here.
 * The workshop material and the airway-mapping work are the owner's and his collaborators' (U.S.
 * Navy Marine Mammal Program and National Marine Mammal Foundation). They are read in place from
 * the owner's Drive and never copied into the repository; `docs/dolphin-bronchoscopy/README.md`
 * maps each id to the file it came from.
 */
export type DolphinSourceKind =
  /** A peer-reviewed paper. */
  | 'paper'
  /** A workshop or teaching deck. */
  | 'workshop'
  /** Work in preparation, not yet published: taught as counts with its basis. */
  | 'unpublished'
  /** A clinical form in use. */
  | 'form'
  /** This module's own CT case, measured by its build script. */
  | 'case-data'
  /** Photographs from a real bronchoscopy, used with permission. */
  | 'photographs'
  /** A reference text. */
  | 'book'

export interface DolphinSource {
  readonly id: string
  /** What a learner reads in a citation line. */
  readonly shortName: string
  readonly citation: string
  readonly year: number
  readonly kind: DolphinSourceKind
}

export const DOLPHIN_SOURCES = [
  {
    id: 'nmmp-workshop-2024',
    shortName: 'NMMP/NMMF bronchoscopy workshop, IAAAM 2024',
    citation:
      'Meegan J, Gildea K, Miller R. Dolphin Bronchoscopy Workshop (W-04). U.S. Navy Marine Mammal Program and National Marine Mammal Foundation; International Association for Aquatic Animal Medicine (IAAAM), 19 May 2024. Workshop slides, with the Module 1 slides on endoscopes (Gildea).',
    year: 2024,
    kind: 'workshop',
  },
  {
    id: 'nmmp-workshop-2025',
    shortName: 'NMMP/NMMF bronchoscopy workshop, IAAAM 2025',
    citation:
      'U.S. Navy Marine Mammal Program and National Marine Mammal Foundation. Cetacean bronchoscopy workshop with the three-dimensionally printed tracheobronchial model. IAAAM, 2025.',
    year: 2025,
    kind: 'workshop',
  },
  {
    id: 'nmmp-mapping-2026',
    shortName: 'NMMP airway mapping, ten dolphins (in preparation)',
    citation:
      'Sanchez GR, Meegan JM, Ross KP, Miller RJ. Airway mapping and development of a 3D-printed tracheobronchial model in the bottlenose dolphin (Tursiops truncatus). IAAAM 2026 poster and abstract; manuscript and the Dolphin CT Branching Data sheet in preparation.',
    year: 2026,
    kind: 'unpublished',
  },
  {
    id: 'nmmp-bronchoscopy-guide',
    shortName: 'NMMP/NMMF Bottlenose Dolphin Bronchoscopy Guide',
    citation:
      'U.S. Navy Marine Mammal Program and National Marine Mammal Foundation. Bottlenose Dolphin Bronchoscopy Guide: airway names from the nares to the numbered branches of the main bronchi.',
    year: 2026,
    kind: 'workshop',
  },
  {
    id: 'nmmp-form-2019',
    shortName: 'MMP Dolphin Bronchoscopy Form',
    citation:
      'Smith C. NMMP Dolphin Bronchoscopy Form. U.S. Navy Marine Mammal Program, 2019. Airway figure after Harper et al. 2001.',
    year: 2019,
    kind: 'form',
  },
  {
    id: 'tsang-2002',
    shortName: 'Tsang et al., J Wildl Dis 2002',
    citation:
      'Tsang KW, Kinoshita R, Rouke N, Yuen Q, Hu W, Lam WK. Bronchoscopy of cetaceans. Journal of Wildlife Diseases. 2002;38(1):224–227. doi:10.7589/0090-3558-38.1.224',
    year: 2002,
    kind: 'paper',
  },
  {
    id: 'smith-1999',
    shortName: 'Smith et al., Anat Rec 1999',
    citation:
      'Smith TL, Turnbull BS, Cowan DF. Morphology of the complex laryngeal gland in the Atlantic bottlenose dolphin, Tursiops truncatus. The Anatomical Record. 1999;254(1):98–106. doi:10.1002/(SICI)1097-0185(19990101)254:1<98::AID-AR13>3.0.CO;2-J',
    year: 1999,
    kind: 'paper',
  },
  {
    id: 'cozzi-2017',
    shortName: 'Cozzi et al., Anatomy of Dolphins 2017',
    citation:
      'Cozzi B, Huggenberger S, Oelschläger H. Anatomy of Dolphins: Insights into Body Structure and Function. London: Academic Press (Elsevier); 2017. Chapter 4 (the respiratory system) and chapter 5 (the larynx).',
    year: 2017,
    kind: 'book',
  },
  {
    id: 'ivancic-2014',
    shortName: 'Ivančić et al., Anat Rec 2014',
    citation:
      'Ivančić M, Solano M, Smith CR. Computed tomography and cross-sectional anatomy of the thorax of the live bottlenose dolphin (Tursiops truncatus). The Anatomical Record. 2014;297(5):901–915. doi:10.1002/ar.22900',
    year: 2014,
    kind: 'paper',
  },
  {
    id: 'venn-watson-2012',
    shortName: 'Venn-Watson et al., Dis Aquat Org 2012',
    citation:
      'Venn-Watson S, Daniels R, Smith C. Thirty year retrospective evaluation of pneumonia in a bottlenose dolphin Tursiops truncatus population. Diseases of Aquatic Organisms. 2012;99:237–242. doi:10.3354/dao02471',
    year: 2012,
    kind: 'paper',
  },
  {
    id: 'harper-2001',
    shortName: 'Harper et al., J Zoo Wildl Med 2001',
    citation:
      'Harper CMG, Borkowski R, Hoffman AM, Warner A. Development of a standardized nomenclature for bronchoscopy of the respiratory system of harbor porpoises (Phocoena phocoena). Journal of Zoo and Wildlife Medicine. 2001;32(2):190–195.',
    year: 2001,
    kind: 'paper',
  },
  {
    id: 'dolphin-001-ct',
    shortName: 'This module’s CT case',
    citation:
      'Bottlenose dolphin, male, 19 years, 213 kg; thoracic and head CT, 1.25 mm series. Airway segmented and measured by the module’s case build (scripts/airway-anatomy/build-dolphin-case.py, geometry-review.json).',
    year: 2026,
    kind: 'case-data',
  },
  {
    id: 'owner-spout-photographs',
    shortName: 'Bronchoscopy photographs, entering the spout',
    citation:
      'Bronchoscopy photographs of a bottlenose dolphin, entering the laryngeal spout from the nasopharynx. Russell Miller, 2026; used with permission.',
    year: 2026,
    kind: 'photographs',
  },
] as const satisfies readonly DolphinSource[]

export type DolphinSourceId = (typeof DOLPHIN_SOURCES)[number]['id']

export const dolphinSourceById: ReadonlyMap<string, DolphinSource> = new Map(
  DOLPHIN_SOURCES.map((source) => [source.id, source] as const),
)

export const DOLPHIN_SOURCE_IDS: ReadonlySet<string> = new Set(DOLPHIN_SOURCES.map((s) => s.id))

export function dolphinSourceLabel(sourceId: string): string {
  return dolphinSourceById.get(sourceId)?.shortName ?? sourceId
}
