import type { PleuralReference } from '@/features/pleural-procedures/content/types'

/**
 * Airway-procedure references for the Rigid Bronchoscopy module. A parallel list
 * to `pleuralReferences` (same shape) so the references page reuses the shared
 * rendering + `referencedIds()` filter. Citations only; guideline text is never
 * reproduced — Learn statements paraphrase and point here with `referenceIds`.
 */
export const airwayReferences: PleuralReference[] = [
  {
    id: 'chest-ip-2003',
    citation:
      'Ernst A, Silvestri GA, Johnstone D; American College of Chest Physicians. Interventional pulmonary procedures: guidelines from the American College of Chest Physicians. Chest. 2003;123(5):1693-1717.',
    sourceType: 'guideline',
    url: 'https://journal.chestnet.org/article/S0012-3692(15)33902-6/fulltext',
    useNote:
      'Foundational scope-of-practice framing for rigid bronchoscopy, ablative modalities, stents, and foreign-body retrieval.',
  },
  {
    id: 'ernst-cao-2004',
    citation:
      'Ernst A, Feller-Kopman D, Becker HD, Mehta AC. Central airway obstruction. Am J Respir Crit Care Med. 2004;169(12):1278-1297.',
    sourceType: 'peer-reviewed',
    url: 'https://www.atsjournals.org/doi/full/10.1164/rccm.200210-1181SO',
    useNote:
      'Central airway obstruction evaluation and the mechanical/ablative treatment toolkit (coring, laser, APC, cryo, stents).',
  },
  {
    id: 'sakr-dutau-2010',
    citation:
      'Sakr L, Dutau H. Massive hemoptysis: an update on the role of bronchoscopy in diagnosis and management. Respiration. 2010;80(1):38-58.',
    sourceType: 'peer-reviewed',
    url: 'https://karger.com/res/article/80/1/38/291171',
    useNote:
      'Central-airway hemorrhage recognition, lung isolation, tamponade, and endobronchial hemostasis teaching.',
  },
  {
    id: 'asa-or-fire-2013',
    citation:
      'Apfelbaum JL, Caplan RA, Barker SJ, et al. Practice advisory for the prevention and management of operating room fires: an updated report by the ASA Task Force on Operating Room Fires. Anesthesiology. 2013;118(2):271-290.',
    sourceType: 'guideline',
    url: 'https://pubs.asahq.org/anesthesiology/article/118/2/271/13538',
    useNote:
      'Operating-room fire triad, FiO₂ reduction during airway energy use, and the fire-response algorithm.',
  },
  {
    id: 'folch-stents-2018',
    citation: 'Folch E, Keyes C. Airway stents. Ann Cardiothorac Surg. 2018;7(2):273-283.',
    sourceType: 'peer-reviewed',
    url: 'https://www.annalscts.com/article/view/18959/html',
    useNote: 'Airway stent concepts, indications, and complications for the therapeutic overview.',
  },
]
