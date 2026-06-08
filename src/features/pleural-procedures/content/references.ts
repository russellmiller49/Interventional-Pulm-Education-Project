import type { PleuralReference } from './types'

export const pleuralReferences: PleuralReference[] = [
  {
    id: 'bts-pleural-2023',
    citation:
      'Roberts ME, Arnold DT, Maskell NA, et al. British Thoracic Society Guideline for pleural disease. Thorax. 2023;78(Suppl 3):s1-s42.',
    sourceType: 'guideline',
    url: 'https://thorax.bmj.com/content/78/Suppl_3/s1',
    useNote:
      'Current pleural disease pathway framing across effusion, infection, pneumothorax, and MPE.',
  },
  {
    id: 'bts-procedures-2023',
    citation:
      'Asciak R, Bedawi EO, Bhatnagar R, et al. British Thoracic Society Clinical Statement on pleural procedures. Thorax. 2023;78(Suppl 3):s43-s68.',
    sourceType: 'guideline',
    url: 'https://thorax.bmj.com/content/78/Suppl_3/s43',
    useNote: 'Procedure safety, ultrasound, anticoagulation framing, and complication avoidance.',
  },
  {
    id: 'bts-quality-2026',
    citation:
      'British Thoracic Society. Quality Standard for Pleural Disease. BMJ Open Respiratory Research. 2026;13:e003760.',
    sourceType: 'guideline',
    url: 'https://bmjopenrespres.bmj.com/content/13/1/e003760',
    useNote: 'Quality standard context for current pleural service expectations.',
  },
  {
    id: 'ers-eacts-ests-2024',
    citation:
      'Walker S, Hallifax R, Ricciardi S, et al. Joint ERS/EACTS/ESTS clinical practice guidelines on adults with spontaneous pneumothorax. Eur Respir J. 2024;63:2300797.',
    sourceType: 'guideline',
    url: 'https://publications.ersnet.org/content/erj/63/5/2300797.full',
    useNote: 'Current pneumothorax decision-making and escalation framing.',
  },
  {
    id: 'mist2-2011',
    citation:
      'Rahman NM, Maskell NA, West A, et al. Intrapleural use of tissue plasminogen activator and DNase in pleural infection. N Engl J Med. 2011;365:518-526.',
    sourceType: 'trial',
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1012740',
    useNote: 'Combination tPA/DNase effect direction and monotherapy caution.',
  },
  {
    id: 'pit-2015',
    citation:
      'Hooper CE, Edey AJ, Wallis A, et al. Pleural irrigation trial: a randomized controlled pilot study. Eur Respir J. 2015;46:456-463.',
    sourceType: 'trial',
    url: 'https://publications.ersnet.org/content/erj/46/2/456',
    useNote:
      'Normal saline irrigation as an alternative teaching pathway when lytics are unsuitable.',
  },
  {
    id: 'mpe-ats-sts-str-2018',
    citation:
      'Feller-Kopman DJ, Reddy CB, DeCamp MM, et al. Management of malignant pleural effusions: an official ATS/STS/STR clinical practice guideline. Am J Respir Crit Care Med. 2018;198:839-849.',
    sourceType: 'guideline',
    url: 'https://www.atsjournals.org/doi/full/10.1164/rccm.201807-1415ST',
    useNote: 'Malignant pleural effusion management, expandability, IPC, and pleurodesis choices.',
  },
  {
    id: 'time2-2012',
    citation:
      'Davies HE, Mishra EK, Kahan BC, et al. Indwelling pleural catheter vs chest tube and talc pleurodesis for relief of dyspnea in MPE. JAMA. 2012;307:2383-2389.',
    sourceType: 'trial',
    useNote: 'IPC versus talc pleurodesis dyspnea and hospitalization teaching.',
  },
  {
    id: 'ample-2017',
    citation:
      'Thomas R, Fysh ETH, Smith NA, et al. Indwelling pleural catheter vs talc pleurodesis on hospitalization days in MPE. JAMA. 2017;318:1903-1912.',
    sourceType: 'trial',
    useNote: 'Hospital-day and reintervention comparison for MPE pathways.',
  },
  {
    id: 'ipc-plus-2018',
    citation:
      'Bhatnagar R, Keenan EK, Morley AJ, et al. Outpatient talc administration by indwelling pleural catheter for malignant effusion. N Engl J Med. 2018;378:1313-1322.',
    sourceType: 'trial',
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1716883',
    useNote: 'Talc via IPC improves pleurodesis compared with IPC alone in selected patients.',
  },
  {
    id: 'tapps-2020',
    citation:
      'Bhatnagar R, Luengo-Fernandez R, Kahan BC, et al. Thoracoscopy and talc poudrage compared with intercostal drainage and talc slurry infusion to manage MPE. Health Technol Assess. 2020;24:1-90.',
    sourceType: 'trial',
    useNote: 'Talc poudrage and slurry comparison for MPE pleurodesis teaching.',
  },
  {
    id: 'asap-2017',
    citation:
      'Wahidi MM, Reddy C, Yarmus L, et al. Randomized trial of pleural fluid drainage frequency in malignant pleural effusions. Am J Respir Crit Care Med. 2017;195:1050-1057.',
    sourceType: 'trial',
    useNote: 'Daily IPC drainage and autopleurodesis teaching.',
  },
  {
    id: 'feller-kopman-manometry-2006',
    citation:
      'Feller-Kopman D, Walkey A, et al. The relationship of pleural pressure to symptom development during therapeutic thoracentesis. Chest. 2006;129:1556-1560.',
    sourceType: 'peer-reviewed',
    useNote: 'Pleural manometry symptom and pressure teaching model.',
  },
  {
    id: 'light-2001',
    citation: 'Light RW. Pleural Diseases. 4th ed. Lippincott Williams & Wilkins; 2001.',
    sourceType: 'textbook',
    useNote: 'Classic Light criteria and pleural fluid analysis background.',
  },
  {
    id: 'creative-commons-catalog',
    citation: 'Repository-curated Creative Commons medical image catalog.',
    sourceType: 'asset-catalog',
    useNote:
      'Teaching image inventory used for pleural ultrasound, CT, pleuroscopy, and pathology visuals.',
  },
  {
    id: 'mendeley-lus-katumba-2025',
    citation:
      'Katumba A, Murindanyi S, Okila N, et al. A Dataset of Lung Ultrasound Images for Automated AI-based Lung Disease Classification. Mendeley Data, V2. 2025.',
    sourceType: 'dataset',
    url: 'https://doi.org/10.17632/hb3p34ytvx.2',
    useNote:
      'CC BY raw-image source for dataset-backed LUS label examples and image-quality variation.',
  },
  {
    id: 'figshare-lung-ultrasound-2025',
    citation:
      'Yin M. Lung Ultrasound Dataset. figshare. Dataset. 2025. doi:10.6084/m9.figshare.30093577.v1.',
    sourceType: 'dataset',
    url: 'https://doi.org/10.6084/m9.figshare.30093577.v1',
    useNote: 'CC BY raw-image source for benign and malignant lung-ultrasound context examples.',
  },
  {
    id: 'jannisborn-covid19-ultrasound',
    citation:
      'Born J, Wiedemann N, Cossio M, et al. COVID-19 Lung Ultrasound Dataset. GitHub dataset and row-level metadata.',
    sourceType: 'dataset',
    url: 'https://github.com/jannisborn/covid19_ultrasound',
    useNote:
      'Row-level Creative Commons video source for dynamic lung-ultrasound signs; individual licenses are verified before public embedding.',
  },
]

export function getPleuralReference(id: string) {
  return pleuralReferences.find((reference) => reference.id === id)
}
