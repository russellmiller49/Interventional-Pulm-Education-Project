import type { PleuralReference } from '@/features/pleural-procedures/content/types'

/**
 * Airway-procedure references for the Rigid Bronchoscopy module. A parallel list
 * to `pleuralReferences` (same shape) so the references page reuses the shared
 * rendering + `referencedIds()` filter. Citations only; guideline text is never
 * reproduced — Learn statements paraphrase and point here with `referenceIds`.
 */
export const airwayReferences: PleuralReference[] = [
  {
    id: 'diaz-jimenez-interventions-2023',
    citation:
      'Díaz-Jiménez JP, Rodríguez AN, editors. Interventions in Pulmonary Medicine. 3rd ed. Cham: Springer Nature Switzerland; 2023. Rigid bronchoscopy pp. 51-70; Sarkiss M. Anesthesia for interventional bronchoscopic procedures pp. 71-88.',
    sourceType: 'textbook',
    url: 'https://doi.org/10.1007/978-3-031-22610-6',
    useNote:
      'Source for bronchial-versus-tracheal tube geometry, contralateral ventilation through bronchial fenestrations, controlled and spontaneous-assisted ventilation, jet ventilation, circuit leak, and expiratory-egress teaching.',
  },
  {
    id: 'pathak-ventilation-2014',
    citation:
      'Pathak V, Welsby I, Mahmood K, et al. Ventilation and anesthetic approaches for rigid bronchoscopy. Ann Am Thorac Soc. 2014;11(4):628-634.',
    sourceType: 'peer-reviewed',
    url: 'https://doi.org/10.1513/AnnalsATS.201309-302FR',
    useNote:
      'Clinical review basis for distinguishing conventional controlled ventilation, assisted spontaneous ventilation, and low- versus high-frequency jet ventilation, including the need for an unobstructed expiratory pathway.',
  },
  {
    id: 'sarkiss-eapen-airway-management-2022',
    citation:
      'Sarkiss M, Eapen GA. Airway management for central airway and transbronchial lung procedures. Curr Anesthesiol Rep. 2022;12:390-397.',
    sourceType: 'peer-reviewed',
    url: 'https://doi.org/10.1007/s40140-022-00535-z',
    useNote:
      'Principal storyboard source for the separate anaesthesia-circuit and jet connections, controlled/spontaneous-assisted ventilation through the breathing circuit, proximal leak, passive expiration, and breath-to-breath trapping behind a ball-valve obstruction.',
  },
  {
    id: 'chest-cao-guideline-2025',
    citation:
      'Mahmood K, Frazer-Green L, Gonzalez AV, et al. Management of central airway obstruction: an American College of Chest Physicians clinical practice guideline. Chest. 2025;167(1):283-295. Published online July 17, 2024.',
    sourceType: 'guideline',
    url: 'https://doi.org/10.1016/j.chest.2024.06.3804',
    useNote:
      'Neutral ventilation-mode framing: for rigid therapeutic bronchoscopy under general anaesthesia, either jet or controlled/spontaneous-assisted ventilation is conditionally suggested with very low certainty of evidence.',
  },
  {
    id: 'putz-jet-ventilation-2016',
    citation:
      'Putz L, Mayné A, Dincq AS. Jet ventilation during rigid bronchoscopy in adults: a focused review. Biomed Res Int. 2016;2016:4234861.',
    sourceType: 'peer-reviewed',
    url: 'https://doi.org/10.1155/2016/4234861',
    useNote:
      'Review basis for qualitative low- and high-frequency jet pulse teaching, open-system entrainment, passive expiration, and the importance of unobstructed expiratory egress.',
  },
  {
    id: 'yang-jet-model-2025',
    citation:
      'Yang M, Deng Z, He X, et al. Jet ventilation dynamics in rigid bronchoscope: insights from a simulated experimental model. BMC Anesthesiol. 2025;25:332.',
    sourceType: 'peer-reviewed',
    url: 'https://doi.org/10.1186/s12871-025-03200-0',
    useNote:
      'Physical bench-model basis for visually distinguishing normal/low-frequency and high-frequency jet pulse patterns. The module remains qualitative because bench findings do not establish patient-specific settings or clinical outcomes.',
  },
  {
    id: 'efer-ordering-information',
    citation: 'Hood Laboratories. Efer Bronchoscope Ordering Information. Accessed July 10, 2026.',
    sourceType: 'web-standard',
    url: 'https://hoodlabs.com/efer-bronchoscope-ordering-information/',
    useNote:
      'Manufacturer part numbers and published dimensions for bases, tubes, caps, endoscopes, forceps, and suction catheters represented in the assembly lab.',
  },
  {
    id: 'efer-user-manual',
    citation:
      'Hood Laboratories. Efer Rigid Bronchoscope & Stent Placement Kit User Manual. F1072G056, revision 8/2022.',
    sourceType: 'web-standard',
    url: 'https://hoodlabs.com/wp-content/uploads/EFER-BRONCHOSCOPE-USER-MANUAL.pdf',
    useNote:
      'Manufacturer-described assembly relationships: red-dot alignment, quarter-turn tube lock, lateral obturator connection, cap selection, telescope/camera/light-source attachment, and the C1/C2 light-guide adapter pieces.',
  },
  {
    id: 'efer-forceps',
    citation: 'Hood Laboratories. Efer Bronchoscope Forceps. Accessed July 10, 2026.',
    sourceType: 'web-standard',
    url: 'https://hoodlabs.com/efer-bronchoscope-forceps/',
    useNote:
      'Manufacturer dimensions and functional descriptions for the modeled BPS2001 and BPS2002 semi-rigid forceps.',
  },
  {
    id: 'efer-endoscope',
    citation: 'Hood Laboratories. Efer Bronchoscope Endoscopes. Accessed July 10, 2026.',
    sourceType: 'web-standard',
    url: 'https://hoodlabs.com/efer-bronchoscope-endoscope/',
    useNote:
      'Manufacturer diameter, viewing direction, and compatibility information for the BX-5500-FA telescope.',
  },
  {
    id: 'stryker-camera-systems',
    citation: 'Stryker. Camera Systems. Accessed July 10, 2026.',
    sourceType: 'web-standard',
    url: 'https://www.stryker.com/us/en/portfolios/medical-surgical-equipment/surgical-visualization/camera-systems.html',
    useNote:
      'Functional reference for a generic endoscopic camera-head and coupler model; the supplied photograph was not sufficient to identify an exact camera model.',
  },
  {
    id: 'karl-storz-light-cable',
    citation:
      'KARL STORZ. Fiber Optic Light Cable 495NAC, 230 cm, diameter 3.5 mm. Accessed July 10, 2026.',
    sourceType: 'web-standard',
    url: 'https://www.karlstorz.com/us/en/product-detail-page.htm?cat=1000071971&productID=1000060267',
    useNote:
      'Manufacturer exemplar for nominal cable length and diameter; connector geometry in the teaching model remains generic.',
  },
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
