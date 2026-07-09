export type TracheostomySourceType =
  | 'guideline'
  | 'consensus'
  | 'trial'
  | 'review'
  | 'study'
  | 'source-brief'

export interface TracheostomyReference {
  id: string
  citation: string
  title: string
  url: string
  sourceType: TracheostomySourceType
  use: string
}

/**
 * Sources used by the tracheostomy learning module. The locally supplied
 * knowledge base is included as an authored source but has no deployable URL;
 * all external sources below link to a publisher, PubMed, PMC, or the National
 * Tracheostomy Safety Project.
 */
export const tracheostomyReferences: TracheostomyReference[] = [
  {
    id: 'tracheostomy-knowledge-base',
    citation: 'Tracheostomy Module Knowledge Base. User-supplied educational reference. 2026.',
    title: 'Tracheostomy Module Knowledge Base',
    url: '/tracheostomy/references#knowledge-base',
    sourceType: 'source-brief',
    use: 'Primary authored source for tube taxonomy, the PDT cognitive sequence, first-shift care, and the module scenarios. Clinical details are cross-checked against the sources below.',
  },
  {
    id: 'mussa-aarc-2021',
    citation:
      'Mussa CC, Gomaa D, Rowley DD, et al. AARC Clinical Practice Guideline: Management of Adult Patients with Tracheostomy in the Acute Care Setting. Respir Care. 2021;66(1):156-169. doi:10.4187/respcare.08206.',
    title: 'AARC management of adult patients with tracheostomy',
    sourceType: 'guideline',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32962998/',
    use: 'Supports multidisciplinary tracheostomy teams, evaluated care bundles, and protocol-directed weaning and decannulation.',
  },
  {
    id: 'blakeman-aarc-2022',
    citation:
      'Blakeman TC, Scott JB, Yoder MA, Capellari E, Strickland SL. AARC Clinical Practice Guidelines: Artificial Airway Suctioning. Respir Care. 2022;67(2):258-271. doi:10.4187/respcare.09548.',
    title: 'AARC artificial airway suctioning guideline',
    sourceType: 'guideline',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35078900/',
    use: 'Supports clinically indicated suctioning, adult preoxygenation, shallow-before-deep technique, avoiding routine saline, and limiting each suction application to 15 seconds or less.',
  },
  {
    id: 'mcgrath-ntsp-2012',
    citation:
      'McGrath BA, Bates L, Atkinson D, Moore JA; National Tracheostomy Safety Project. Multidisciplinary guidelines for the management of tracheostomy and laryngectomy airway emergencies. Anaesthesia. 2012;67(9):1025-1041. doi:10.1111/j.1365-2044.2012.07217.x.',
    title: 'Multidisciplinary tracheostomy and laryngectomy emergency guidelines',
    sourceType: 'consensus',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22731935/',
    use: 'Supports the universal emergency sequence: call for expert help, prioritize oxygenation, assess both potential airways, remove external attachments and the inner cannula, and assess tube patency with a suction catheter.',
  },
  {
    id: 'ntsp-emergency-algorithm',
    citation:
      'National Tracheostomy Safety Project. Emergency Care (Adults): Tracheostomy Algorithm and Bedhead Sign.',
    title: 'NTSP adult emergency tracheostomy algorithm',
    sourceType: 'guideline',
    url: 'https://tracheostomy.org.uk/healthcare-staff/emergency-care/emergency-algorithm-tracheostomy',
    use: 'Current official algorithm resource for blocked or displaced adult tracheostomy emergencies and airway-specific bedhead information.',
  },
  {
    id: 'ghattas-pdt-2021',
    citation:
      'Ghattas C, Alsunaid S, Pickering EM, Holden VK. State of the art: percutaneous tracheostomy in the intensive care unit. J Thorac Dis. 2021;13(8):5261-5276. doi:10.21037/jtd-19-4121.',
    title: 'State of the art: percutaneous tracheostomy in the ICU',
    sourceType: 'review',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8411160/',
    use: 'Supports team preparation, anatomy and ultrasound assessment, bronchoscopic guidance, tube selection, procedural sequencing, confirmation, and post-procedure management.',
  },
  {
    id: 'mitchell-consensus-2013',
    citation:
      'Mitchell RB, Hussey HM, Setzen G, et al. Clinical consensus statement: tracheostomy care. Otolaryngol Head Neck Surg. 2013;148(1):6-20. doi:10.1177/0194599812460376.',
    title: 'Clinical consensus statement: tracheostomy care',
    sourceType: 'consensus',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22990518/',
    use: 'Supports tube and cuff management, communication devices, emergency preparation, initial tube change planning, and decannulation prerequisites.',
  },
  {
    id: 'ntsp-speaking-valve',
    citation: 'National Tracheostomy Safety Project. One-way valves and ventilators.',
    title: 'NTSP one-way valves and ventilators',
    sourceType: 'guideline',
    url: 'https://tracheostomy.org.uk/healthcare-staff/vocalisation/one-way-valves-and-ventilators',
    use: 'Supports the requirement for a fully deflated cuff or cuffless tube, a patent expiratory path through the upper airway, and immediate valve removal if distress develops.',
  },
  {
    id: 'johnson-manometry-2009',
    citation:
      'Johnson DC, Campbell SL, Rabkin JD. Tracheostomy tube manometry: evaluation of speaking valves, capping and need for downsizing. Clin Respir J. 2009;3(1):8-14. doi:10.1111/j.1752-699X.2008.00100.x.',
    title: 'Tracheostomy tube manometry for speaking valves and capping',
    sourceType: 'study',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20298366/',
    use: 'Supports manometry as an objective adjunct when evaluating speaking-valve tolerance, capping, and the possible need for downsizing. Its reported pressure thresholds are examples from one pathway, not universal cutoffs.',
  },
  {
    id: 'hernandez-decannulation-2020',
    citation:
      'Hernandez Martinez G, Rodriguez ML, Vaquero MC, et al. High-Flow Oxygen with Capping or Suctioning for Tracheostomy Decannulation. N Engl J Med. 2020;383(11):1009-1017. doi:10.1056/NEJMoa2010834.',
    title: 'High-flow oxygen with capping or suctioning for decannulation',
    sourceType: 'trial',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32905673/',
    use: 'Shows that suction-frequency-based decannulation assessment can be effective in a defined adult ICU population; it does not establish a single universal capping duration or decannulation score.',
  },
  {
    id: 'medrinal-consensus-2026',
    citation:
      'Medrinal C, Delemazure J, Billard M, et al. Expert consensus-based clinical practice guidelines for care and weaning procedures in tracheostomized ICU patients after invasive mechanical ventilation. Ann Intensive Care. 2026;16:100045. doi:10.1016/j.aicoj.2026.100045.',
    title: 'Adult ICU tracheostomy care and weaning consensus',
    sourceType: 'consensus',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41859564/',
    use: 'Current adult ICU consensus for cuff-pressure monitoring, restoration of upper-airway airflow, speaking-valve safety, humidification, weaning, and individualized decannulation assessment.',
  },
  {
    id: 'allan-tif-2003',
    citation:
      'Allan JS, Wright CD. Tracheoinnominate fistula: diagnosis and management. Chest Surg Clin N Am. 2003;13(2):331-341. doi:10.1016/S1052-3359(03)00006-1.',
    title: 'Tracheoinnominate fistula: diagnosis and management',
    sourceType: 'review',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12755317/',
    use: 'Supports treating post-tracheostomy sentinel or major airway bleeding as an emergency, with cuff hyperinflation and trained digital compression as temporizing maneuvers while definitive surgical control is activated.',
  },
]
