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
    claimScope: 'clinical-guideline',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for high-level central-airway-obstruction decision framing; preserve the stated evidence certainty and do not turn conditional guidance into a patient-specific directive.',
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
    claimScope: 'clinical-guideline',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Apply only to malignant central airway obstruction; retain recommendation grades and patient, airway, local-resource, and operator context.',
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
    claimScope: 'clinical-guideline',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Apply only to benign central airway obstruction and preserve etiology-specific uncertainty, removability considerations, and the need for an exit plan.',
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
    claimScope: 'airway-bench',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Keep GINA-Dumon results tied to the tested designs, sizes, fixtures, directions, and endpoints; do not convert them into clinical thresholds or a product ranking.',
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
    claimScope: 'airway-bench',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use only as device- and fixture-specific mechanics evidence; do not map measured force or modeled stress to mucosal pressure, injury, or patient risk.',
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
    claimScope: 'regulatory-construction',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for cleared construction and labeled-use description only; verify current labeling before making a regulatory or use statement.',
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
    claimScope: 'regulatory-construction',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for cleared construction and labeled-use description only; verify current labeling before making a regulatory, removal, or use statement.',
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
    claimScope: 'manufacturer-construction',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for manufacturer-stated construction and labeled features only; do not use it to support comparative outcomes or an architecture recommendation.',
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
    claimScope: 'clinical-trial',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'This is randomized, population-specific outcome evidence; physician review is required before transferring symptom or reintervention findings beyond the studied strategy and population.',
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
    claimScope: 'transferred-engineering',
    verifiedOn: '2026-07-11',
    supportLevel: 'conceptual-model',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use only to explain generic braid-and-cover mechanics; do not present its finite-element outputs as airway-device performance or clinical evidence.',
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
    claimScope: 'clinical-observational',
    verifiedOn: '2026-07-11',
    supportLevel: 'association',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Treat reported factors as retrospective associations from one platform; do not predict an individual fracture location, probability, or dwell-time threshold.',
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
    claimScope: 'transferred-engineering',
    verifiedOn: '2026-07-11',
    supportLevel: 'conceptual-model',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use as a general nitinol-fatigue framework only; airway loading, fixtures, cycle counts, and clinical consequences require separate evidence.',
    transferLimitation:
      'This general nitinol fatigue framework is not airway-specific and does not provide an airway dwell-time or failure threshold.',
  },
  {
    id: 'ost-infection-granulation-2012',
    citation:
      'Ost DE, Shah AM, Lei X, et al. Respiratory Infections Increase the Risk of Granulation Tissue Formation Following Airway Stenting in Patients With Malignant Airway Obstruction. Chest. 2012;141(6):1473-1481. doi:10.1378/chest.11-2005.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4694180/',
    doi: '10.1378/chest.11-2005',
    sourceType: 'peer-reviewed',
    applicability: 'clinical-guidance',
    claimScope: 'clinical-observational',
    verifiedOn: '2026-07-11',
    supportLevel: 'association',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use as observational evidence that infection may contribute to later granulation in malignant airway obstruction; do not imply deterministic causation or generalize the effect estimate to every patient or stent.',
    transferLimitation:
      'This retrospective malignant-airway-obstruction cohort supports an association between lower-respiratory infection and subsequent granulation, not a universal causal pathway or patient-specific risk estimate.',
  },
  {
    id: 'hu-granulation-diameter-2011',
    citation:
      'Hu HC, Liu YH, Wu YC, et al. Granulation tissue formation following Dumon airway stenting: the influence of stent diameter. Thoracic and Cardiovascular Surgeon. 2011;59(3):163-168. doi:10.1055/s-0030-1250667.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21480137/',
    doi: '10.1055/s-0030-1250667',
    sourceType: 'peer-reviewed',
    applicability: 'clinical-guidance',
    claimScope: 'clinical-observational',
    verifiedOn: '2026-07-11',
    supportLevel: 'association',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use as a study-specific association between stent-to-airway diameter relationship and granulation; do not encode its reported 90% cutoff as a sizing rule for other devices, anatomies, or patients.',
    transferLimitation:
      'The small observational study evaluated Dumon stent edge regions in a specific cohort; its reported diameter-ratio cutoff is not a universal oversizing threshold or validated patient-level risk equation.',
  },
  {
    id: 'gupta-granulation-review-2025',
    citation:
      'Gupta A, Slebos DJ, Pouwels SD. Lung implantable devices: the issue with granulation tissue. Breathe. 2025;21(3):240243. doi:10.1183/20734735.0243-2024.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12260914/',
    doi: '10.1183/20734735.0243-2024',
    sourceType: 'peer-reviewed',
    applicability: 'clinical-guidance',
    claimScope: 'review-mechanistic',
    verifiedOn: '2026-07-11',
    supportLevel: 'conceptual-model',
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use this mechanistic review to support a multifactorial tissue-response model involving persistent injury, surface and microbial factors, geometry, biomechanics, time, and host response; do not convert the model into a causal score.',
    transferLimitation:
      'This contemporary narrative review synthesizes plausible mechanisms across lung implantable devices; it does not validate an airway-stent-specific causal equation, cutoff, or individual risk prediction.',
  },
  {
    id: 'textbook-sems-2025',
    citation:
      'Gonuguntla HK, Varunn MD. Self-Expandable Metallic Stenting for Airway Management. In: Principles and Practice of Interventional Pulmonology. Springer Nature; 2025. doi:10.1007/978-3-031-49583-0_39-3.',
    url: 'https://doi.org/10.1007/978-3-031-49583-0_39-3',
    doi: '10.1007/978-3-031-49583-0_39-3',
    sourceType: 'textbook-chapter',
    applicability: 'curriculum-authoring',
    claimScope: 'secondary-chapter',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    sourcePages: ['3–15'],
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use to structure SEMS deployment, complication, removal, and follow-up teaching; attach primary guidance or current instructions for use to learner-facing clinical rules.',
    transferLimitation:
      'This secondary chapter synthesizes heterogeneous studies and author practice. It is not a current device instruction, comparative-effectiveness standard, or universal management protocol.',
  },
  {
    id: 'textbook-silicone-stents-2025',
    citation:
      'Dutau H, Guibert N. Endobronchial Silicone Stents for Airway Management. In: Principles and Practice of Interventional Pulmonology. Springer Nature; 2025. doi:10.1007/978-3-031-49583-0_40-1.',
    url: 'https://doi.org/10.1007/978-3-031-49583-0_40-1',
    doi: '10.1007/978-3-031-49583-0_40-1',
    sourceType: 'textbook-chapter',
    applicability: 'curriculum-authoring',
    claimScope: 'secondary-chapter',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    sourcePages: ['2', '8–11'],
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for the inner-to-outer diameter tradeoff, compression-dependent length behavior, silicone sizing workflow, and central involution in curved airways.',
    transferLimitation:
      'The chapter supplies qualitative relationships and author practice, not a validated airflow equation, buckling threshold, universal sizing rule, or product-independent force value.',
  },
  {
    id: 'textbook-y-stenting-2025',
    citation:
      'Gompelmann D. Y-Stenting Techniques. In: Principles and Practice of Interventional Pulmonology. Springer Nature; 2025. doi:10.1007/978-3-031-49583-0_41-1.',
    url: 'https://doi.org/10.1007/978-3-031-49583-0_41-1',
    doi: '10.1007/978-3-031-49583-0_41-1',
    sourceType: 'textbook-chapter',
    applicability: 'curriculum-authoring',
    claimScope: 'secondary-chapter',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    sourcePages: ['3', '5–7'],
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for whole-Y geometry, silicone and metallic deployment sequences, secretion burden, localized contact, and cohort-context outcome teaching.',
    transferLimitation:
      'Historical cohorts and author sizing or surveillance practices must retain population, device, and follow-up context and must not become universal rules.',
  },
  {
    id: 'textbook-stent-placement',
    citation:
      'Argento AC, Smith SB. Stent Placement. In: Practical Guide to Interventional Pulmonology. Chapter 10; pp. 101–111. Supplied chapter used for curriculum authoring.',
    sourceType: 'textbook-chapter',
    applicability: 'curriculum-authoring',
    claimScope: 'secondary-chapter',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    sourcePages: ['101–111'],
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for measurement, delivery, repositioning, immediate verification, and complication-response workflow.',
    transferLimitation:
      'The chapter includes source-specific heuristics and regulatory wording that require primary-source verification before learner-facing use.',
  },
  {
    id: 'textbook-airway-stents-primer-2025',
    citation:
      'Amjad MA, Jani PP, Cherian SV. Airway Stents: A Primer. In: International Textbook of Interventional Pulmonology. 2025; pp. 185–214.',
    url: 'https://cdn.wabip.com/wp-content/uploads/institute/ipi_textbook.pdf',
    sourceType: 'textbook-chapter',
    applicability: 'curriculum-authoring',
    claimScope: 'secondary-chapter',
    verifiedOn: '2026-07-11',
    supportLevel: 'explicit',
    sourcePages: ['185–214'],
    clinicalReviewStatus: 'draft',
    clinicalReviewNote:
      'Use for device-family comparison, buckling/angulation, longitudinal complications, symptom outcomes, and clinically contextualized examples.',
    transferLimitation:
      'Reported complication rates, surveillance schedules, and material comparisons reflect heterogeneous sources and must not be pooled into patient-level predictions or universal superiority claims.',
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
