/** Exact identifiers read on live manufacturer U.S. product pages on 2026-09-17.
 * PDFs, foreign catalogs and family-only pages do not upgrade confidence. */
export const manufacturerSources = [
  {
    manufacturer: 'Karl Storz',
    identifiers: ['10370U'],
    title: 'KARL STORZ U.S. product listing',
    url: 'https://www.karlstorz.com/us/en/product-detail-page.htm?cat=1000071971&productID=1000117255',
  },
  {
    manufacturer: 'Olympus',
    identifiers: ['BF-1TH190'],
    title: 'Olympus U.S. therapeutic bronchoscope',
    url: 'https://medical.olympusamerica.com/products/bronchoscope/therapeutic-bronchoscope-bf-1th190',
  },
  {
    manufacturer: 'Olympus',
    identifiers: ['BF-H190', 'BF-Q190'],
    title: 'Olympus U.S. BF-190 lineup',
    url: 'https://medical.olympusamerica.com/products/bf-190',
  },
  {
    manufacturer: 'Cook Medical',
    identifiers: [
      'G44109',
      'G44114',
      'G44120',
      'C-AEBS-5.0-50-SPH-AS',
      'C-AEBS-7.0-65-SPH-AS',
      'C-AEBS-9.0-78-SPH-AS',
    ],
    title: 'Cook U.S. Arndt blocker ordering table',
    url: 'https://www.cookmedical.com/products/cc_aebs_webds/',
  },
  {
    manufacturer: 'Cook Medical',
    identifiers: ['G57703', 'C-PTISY-100-HC-G-NA'],
    title: 'Cook U.S. Blue Rhino ordering table',
    url: 'https://www.cookmedical.com/products/a10321c1-93db-469a-9b3b-6c139143cb49/',
  },
] as const
export const novatechRestriction = {
  title: 'Novatech U.S. market restrictions',
  url: 'https://novatech.fr/en/about-us',
}
