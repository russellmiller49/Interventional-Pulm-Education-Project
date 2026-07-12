import type { EvidenceReference } from '../engine/learningLabTypes'

export const evidenceRegistry = [
  {
    id: 'chest-cao-guideline-2024',
    citation:
      'Mahmood K, Frazer-Green L, Gonzalez AV, et al. Management of Central Airway Obstruction: An American College of Chest Physicians Clinical Practice Guideline. Chest. 2025;167(1):283-295. Published online July 17, 2024. doi:10.1016/j.chest.2024.06.3804.',
    url: 'https://journal.chestnet.org/article/S0012-3692%2824%2904614-2/fulltext',
    doi: '10.1016/j.chest.2024.06.3804',
    sourceType: 'clinical-guideline',
    applicability: 'clinical-guidance',
    transferLimitation:
      'The guideline repeatedly notes very-low-certainty evidence; recommendations require multidisciplinary judgment, local expertise, and patient-specific assessment.',
  },
  {
    id: 'wabip-malignant-stenting-2024',
    citation:
      'Chaddha U, Agrawal A, Kurman J, et al. World Association for Bronchology and Interventional Pulmonology (WABIP) guidelines on airway stenting for malignant central airway obstruction. Respirology. 2024;29(7):563-573. doi:10.1111/resp.14764.',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/resp.14764',
    doi: '10.1111/resp.14764',
    sourceType: 'clinical-guideline',
    applicability: 'clinical-guidance',
    transferLimitation:
      'Recommendations apply to malignant central airway obstruction and should not be generalized to benign disease or used as a product ranking.',
  },
  {
    id: 'wabip-benign-stenting-2025',
    citation:
      'Chaddha U, Agrawal A, Murgu S, et al. World Association for Bronchology and Interventional Pulmonology (WABIP) Guidelines on Airway Stenting for Benign Central Airway Obstruction. Respirology. 2025;30(7):587-604. doi:10.1111/resp.70068.',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/resp.70068',
    doi: '10.1111/resp.70068',
    sourceType: 'clinical-guideline',
    applicability: 'clinical-guidance',
    transferLimitation:
      'Benign stenoses are heterogeneous. The guideline does not establish one device or dwell strategy for every etiology, anatomy, or center.',
  },
  {
    id: 'jung-gina-2021',
    citation:
      'Jung HS, Chae G, Kim JH, et al. The mechanical characteristics and performance evaluation of a newly developed silicone airway stent (GINA stent). Scientific Reports. 2021;11:7958. doi:10.1038/s41598-021-87142-w.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8041787/',
    doi: '10.1038/s41598-021-87142-w',
    sourceType: 'peer-reviewed',
    applicability: 'airway-device-mechanics',
    transferLimitation:
      'Bench fixtures and a short porcine evaluation compare two particular silicone designs; measured forces are not universal clinical thresholds.',
  },
  {
    id: 'ratnovsky-airway-mechanics-2015',
    citation:
      'Ratnovsky A, Regev N, Wald S, Kramer M, Naftali S. Mechanical properties of different airway stents. Medical Engineering & Physics. 2015;37(4):408-415. doi:10.1016/j.medengphy.2015.02.008.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25753590/',
    doi: '10.1016/j.medengphy.2015.02.008',
    sourceType: 'peer-reviewed',
    applicability: 'airway-device-mechanics',
    transferLimitation:
      'The selected stents, fixtures, and numerical assumptions do not define a single stiffness or tissue-pressure ranking for all airway stents.',
  },
  {
    id: 'fda-bonastent-k140472',
    citation:
      'US Food and Drug Administration. 510(k) Summary K140472: BONASTENT Tracheal/Bronchial. Decision date October 17, 2014.',
    url: 'https://www.accessdata.fda.gov/cdrh_docs/pdf14/K140472.pdf',
    sourceType: 'regulatory',
    applicability: 'device-topology',
    transferLimitation:
      'A 510(k) summary documents the cleared device and substantial-equivalence review; it is not comparative clinical-effectiveness evidence.',
  },
  {
    id: 'fda-ultraflex-k230269',
    citation:
      'US Food and Drug Administration. 510(k) Summary K230269: Ultraflex Tracheobronchial Stent System. Decision date July 14, 2023.',
    url: 'https://www.accessdata.fda.gov/cdrh_docs/pdf23/K230269.pdf',
    sourceType: 'regulatory',
    applicability: 'device-topology',
    transferLimitation:
      'The summary supports the single-strand interwoven-loop and coverage descriptions; it does not support off-label use or superiority claims.',
  },
  {
    id: 'merit-aero-official',
    citation:
      'Merit Medical. AERO Fully Covered Tracheobronchial Stent: official product and device-description page. Accessed July 11, 2026.',
    url: 'https://www.merit.com/product/aero-tracheobronchial-stent/',
    sourceType: 'manufacturer',
    applicability: 'device-topology',
    transferLimitation:
      'Manufacturer descriptions identify construction and labeled features, not independent comparative outcomes or a recommendation for an individual patient.',
  },
  {
    id: 'spoc-trial-2020',
    citation:
      'Dutau H, Di Palma F, Thibout Y, et al. Impact of Silicone Stent Placement in Symptomatic Airway Obstruction due to Non-Small Cell Lung Cancer: The SPOC Trial. Respiration. 2020;99(4):344-352. doi:10.1159/000506601.',
    url: 'https://doi.org/10.1159/000506601',
    doi: '10.1159/000506601',
    sourceType: 'peer-reviewed',
    applicability: 'clinical-guidance',
    transferLimitation:
      'This randomized study addresses a defined malignant-obstruction population and silicone-stent strategy; it does not establish a universal indication for stenting.',
  },
  {
    id: 'mckenna-covered-braid-2021',
    citation:
      'McKenna CG, Vaughan TJ. A finite element investigation on design parameters of bare and polymer-covered self-expanding wire braided stents. Journal of the Mechanical Behavior of Biomedical Materials. 2021;115:104305. doi:10.1016/j.jmbbm.2020.104305.',
    url: 'https://doi.org/10.1016/j.jmbbm.2020.104305',
    doi: '10.1016/j.jmbbm.2020.104305',
    sourceType: 'peer-reviewed',
    applicability: 'transferred-engineering',
    transferLimitation:
      'This is a finite-element study of generic braided stents, not an airway clinical study; it supports mechanism-level teaching only.',
  },
  {
    id: 'chung-airway-fracture-2008',
    citation:
      'Chung FT, Lin SM, Chen HC, et al. Factors leading to tracheobronchial self-expandable metallic stent fracture. Journal of Thoracic and Cardiovascular Surgery. 2008;136(5):1328-1335. doi:10.1016/j.jtcvs.2008.05.039.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19026824/',
    doi: '10.1016/j.jtcvs.2008.05.039',
    sourceType: 'peer-reviewed',
    applicability: 'airway-device-mechanics',
    transferLimitation:
      'Retrospective associations from one metallic-stent platform do not predict fracture for every architecture, location, or dwell period.',
  },
  {
    id: 'pelton-nitinol-fatigue-2008',
    citation:
      'Pelton AR, Schroeder V, Mitchell MR, Gong XY, Barney M, Robertson SW. Fatigue and durability of Nitinol stents. Journal of the Mechanical Behavior of Biomedical Materials. 2008;1(2):153-164. doi:10.1016/j.jmbbm.2007.08.001.',
    url: 'https://doi.org/10.1016/j.jmbbm.2007.08.001',
    doi: '10.1016/j.jmbbm.2007.08.001',
    sourceType: 'peer-reviewed',
    applicability: 'transferred-engineering',
    transferLimitation:
      'This general nitinol fatigue framework is not airway-specific and does not provide an airway dwell-time or failure threshold.',
  },
] as const satisfies readonly EvidenceReference[]

export type EvidenceReferenceId = (typeof evidenceRegistry)[number]['id']

export const evidenceById: Readonly<Record<EvidenceReferenceId, EvidenceReference>> = Object.freeze(
  Object.fromEntries(evidenceRegistry.map((reference) => [reference.id, reference])) as Record<
    EvidenceReferenceId,
    EvidenceReference
  >,
)

export function getEvidenceReference(id: string): EvidenceReference {
  const reference = (evidenceById as Readonly<Record<string, EvidenceReference>>)[id]
  if (!reference) {
    throw new Error(`Unknown airway-stent evidence reference: ${id}`)
  }
  return reference
}

export function findMissingEvidenceRefs(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => !(id in evidenceById)))]
}

export function validateEvidenceRefs(ids: readonly string[]): {
  valid: boolean
  missing: string[]
} {
  const missing = findMissingEvidenceRefs(ids)
  return { valid: missing.length === 0, missing }
}

export function assertEvidenceRefsResolve(ids: readonly string[]): void {
  const missing = findMissingEvidenceRefs(ids)
  if (missing.length > 0) {
    throw new Error(`Unresolved airway-stent evidence references: ${missing.join(', ')}`)
  }
}

export function resolveEvidenceReferences(ids: readonly string[]): EvidenceReference[] {
  assertEvidenceRefsResolve(ids)
  return ids.map(getEvidenceReference)
}
