/** Every source the course cites. Lessons and the numbers register refer to these by id. */
export const SOURCES = [
  {
    id: 'issa2023',
    title:
      'Issa MA, Clementsen PF, et al. Using the endoscope for endobronchial ultrasound in the esophagus. J Vis Exp 2023',
    url: 'https://doi.org/10.3791/65741',
    type: 'Technique description',
  },
  {
    id: 'ers2026',
    title:
      'ERS/ESGE/ESTS clinical practice guidelines on endobronchial and oesophageal endosonography for the diagnosis and staging of lung cancer (2026)',
    url: 'https://doi.org/10.1183/13993003.00097-2026',
    type: 'Guideline',
  },
  {
    id: 'combined2015',
    title:
      'ESGE/ERS/ESTS guideline: combined endobronchial and esophageal endosonography for the diagnosis and staging of lung cancer (2015)',
    url: 'https://doi.org/10.1055/s-0034-1392040',
    type: 'Guideline',
  },
  {
    id: 'korevaar2016',
    title:
      'Korevaar DA, et al. Added value of combined endobronchial and oesophageal endosonography for mediastinal nodal staging in lung cancer: a systematic review and meta-analysis. Lancet Respir Med 2016',
    url: 'https://doi.org/10.1016/S2213-2600(16)30317-4',
    type: 'Systematic review and meta-analysis',
  },
  {
    id: 'oki2024',
    title:
      'Oki M, et al. Utility of adding oesophageal to endobronchial endosonography when staging lung cancer: a randomised trial. ERJ Open Res 2024',
    url: 'https://doi.org/10.1183/23120541.00326-2024',
    type: 'Randomised trial',
  },
  {
    id: 'moretti2023',
    title:
      'Moretti A, et al. Performance of EUS-FNA and EUS-B-FNA for the diagnosis of left adrenal gland metastases in patients with lung cancer: a systematic review and meta-analysis. Lung Cancer 2023',
    url: 'https://doi.org/10.1016/j.lungcan.2023.107391',
    type: 'Systematic review and meta-analysis',
  },
] as const

export type SourceId = (typeof SOURCES)[number]['id']

export const SOURCE_IDS: ReadonlySet<string> = new Set(SOURCES.map((source) => source.id))
