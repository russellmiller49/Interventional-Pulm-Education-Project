export interface ChestDrainageReference {
  id: string
  citation: string
  sourceType: 'peer-reviewed' | 'guideline' | 'manufacturer' | 'web-standard' | 'textbook'
  url?: string
  useNote: string
}

export const chestDrainageReferences: ChestDrainageReference[] = [
  {
    id: 'zisis-2015',
    citation: 'Zisis C, et al. Chest drainage systems in use. Ann Transl Med. 2015;3(3):43.',
    sourceType: 'peer-reviewed',
    url: 'https://atm.amegroups.org/article/view/5790/html',
    useNote: 'System evolution, water seal, wet suction, and chamber design concepts.',
  },
  {
    id: 'george-2016',
    citation:
      'George RS, Papagiannopoulos K. Advances in chest drain management in thoracic disease. J Thorac Dis. 2016;8(Suppl 1):S55-S64.',
    sourceType: 'peer-reviewed',
    url: 'https://jtd.amegroups.org/article/view/5906/html',
    useNote: 'Digital drainage trends, air leak interpretation, and modern management context.',
  },
  {
    id: 'antonicelli-2022',
    citation:
      'Antonicelli A, et al. Chest Drainage Therapy: What Comes out of Pandora’s Box Can Affect Patient Outcomes. J Clin Med. 2022;11:5311.',
    sourceType: 'peer-reviewed',
    url: 'https://www.mdpi.com/2077-0383/11/18/5311',
    useNote:
      'Device performance heterogeneity and caution around assuming all systems behave alike.',
  },
  {
    id: 'sorino-2024',
    citation:
      'Sorino C, et al. Chest Tubes and Pleural Drainage: History and Current Status in Pleural Disease Management. J Clin Med. 2024;13:6331.',
    sourceType: 'peer-reviewed',
    url: 'https://www.mdpi.com/2077-0383/13/21/6331',
    useNote:
      'Current drainage system concepts, complications, and pleural procedure safety framing.',
  },
  {
    id: 'bts-2023',
    citation:
      'British Thoracic Society. Pleural Disease guideline and Clinical Statement on Pleural Procedures. July 2023.',
    sourceType: 'guideline',
    url: 'https://www.brit-thoracic.org.uk/clinical-resources/guidelines/pleural-disease/',
    useNote:
      'Guideline context for pleural disease and procedural safety; local policy still applies.',
  },
  {
    id: 'ers-eacts-ests-2024',
    citation:
      'Walker S, et al. Joint ERS/EACTS/ESTS clinical practice guidelines on adults with spontaneous pneumothorax. Eur Respir J. 2024;63:2300797.',
    sourceType: 'guideline',
    useNote: 'Pneumothorax strategy context and escalation framing.',
  },
  {
    id: 'sts-2024',
    citation:
      'Kent MS, et al. Society of Thoracic Surgeons Expert Consensus Document on the Management of Pleural Drains following Pulmonary Lobectomy. Ann Thorac Surg. 2024;118:764-777.',
    sourceType: 'guideline',
    useNote: 'Post-lobectomy drain management context and removal-pathway caveats.',
  },
  {
    id: 'teleflex-ifu',
    citation: 'Teleflex. Pleur-evac dry suction / dry seal setup materials and IFU materials.',
    sourceType: 'manufacturer',
    useNote:
      'Device-specific setup must be checked against the current manufacturer IFU before clinical use.',
  },
  {
    id: 'wcag-22',
    citation: 'W3C. Web Content Accessibility Guidelines (WCAG) 2.2. W3C Recommendation.',
    sourceType: 'web-standard',
    url: 'https://www.w3.org/TR/WCAG22/',
    useNote:
      'Accessibility target for keyboard controls, visible text equivalents, and motion handling.',
  },
]
