export interface StentMechanicsReference {
  id: number
  citation: string
  sourceType: 'peer-reviewed' | 'regulatory' | 'standard' | 'manufacturer'
  note?: string
}

export const stentMechanicsReferences: StentMechanicsReference[] = [
  {
    id: 1,
    citation:
      'Jung HS, Chae G, Kim JH, et al. The mechanical characteristics and performance evaluation of a newly developed silicone airway stent (GINA stent). Scientific Reports. 2021;11:7958. doi:10.1038/s41598-021-87142-w.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 2,
    citation:
      'Ratnovsky A, Regev N, Wald S, Kramer M, Naftali S. Mechanical properties of different airway stents. Medical Engineering & Physics. 2015;37:408-415. doi:10.1016/j.medengphy.2015.02.008.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 3,
    citation:
      'Ivanick N, Mahoney W, Pachimatla AG, Yendamuri S, Gesthalter Y. A retrospective comparison of silicone and hybrid metal tracheobronchial Y stents. Journal of Thoracic Disease. 2025;17:4701-4712. doi:10.21037/jtd-2025-307.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 6,
    citation:
      'E. Benson Hood Laboratories. Efer Rigid Bronchoscope & Stent Placement Kit User Manual. Revision 8/2022; copyright 2023.',
    sourceType: 'manufacturer',
    note: 'Manufacturer technical manual; not comparative clinical evidence.',
  },
  {
    id: 12,
    citation:
      'Isayama H, Nakai Y, Toyokawa Y, et al. Measurement of radial and axial forces of biliary self-expandable metallic stents. Gastrointestinal Endoscopy. 2009;70:37-44.',
    sourceType: 'peer-reviewed',
    note: 'Transferred mechanical concept; airway-specific thresholds are not established.',
  },
  {
    id: 13,
    citation:
      'Stoeckel D, Pelton A, Duerig T. Self-expanding nitinol stents: material and design considerations. European Radiology. 2004;14:292-301.',
    sourceType: 'peer-reviewed',
    note: 'General nitinol and vascular-device mechanics.',
  },
  {
    id: 14,
    citation:
      'ASTM International. ASTM F3067-26: Standard Guide for Radial Loading of Balloon-Expandable and Self-Expanding Vascular Stents. 2026.',
    sourceType: 'standard',
    note: 'Methodological template; it does not validate airway clinical performance and excludes several airway-relevant geometries.',
  },
  {
    id: 15,
    citation:
      'International Organization for Standardization. ISO 25539-2:2020. Cardiovascular implants—Endovascular devices—Part 2: Vascular stents. 2020.',
    sourceType: 'standard',
    note: 'Vascular framework used only as a methodological reference.',
  },
  {
    id: 16,
    citation:
      'US Food and Drug Administration. Non-Clinical Engineering Tests and Recommended Labeling for Intravascular Stents and Associated Delivery Systems. Guidance for Industry and FDA Staff. 2010.',
    sourceType: 'regulatory',
    note: 'Vascular guidance; airway-specific phantoms and loading modes remain necessary.',
  },
  {
    id: 17,
    citation:
      'US Food and Drug Administration. 510(k) Summary K243126: DUMON Silicone Tracheobronchial Stent. 2024.',
    sourceType: 'regulatory',
  },
  {
    id: 18,
    citation:
      'US Food and Drug Administration. 510(k) Summary K182743: Patient-Specific Airway Stent. October 23, 2019.',
    sourceType: 'regulatory',
  },
  {
    id: 19,
    citation:
      'US Food and Drug Administration. 510(k) Summary K141584: Ultraflex Tracheobronchial Stent System. 2014.',
    sourceType: 'regulatory',
  },
  {
    id: 20,
    citation:
      'US Food and Drug Administration. 510(k) Summary K140472: BONASTENT Tracheal/Bronchial. 2014.',
    sourceType: 'regulatory',
  },
  {
    id: 22,
    citation:
      'Jiang Y, Shan Q, Huang W, et al. Innovative design addressing complex airway stenosis: multidimensional performance assessment of a novel Y-shaped airway stent. Biocybernetics and Biomedical Engineering. 2024;44:534-542. doi:10.1016/j.bbe.2024.08.010.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 23,
    citation:
      'Uemura M, Ozai Y, Hamabe L, Yoshida T, Tanaka R. Mechanical characteristics of different braiding methods used in canine self-expanding tracheal stents. Journal of Veterinary Science. 2026;27(1):e14. doi:10.4142/jvs.25156.',
    sourceType: 'peer-reviewed',
    note: 'Preclinical veterinary evidence.',
  },
  {
    id: 24,
    citation:
      'Kim JH, Choi JY, Yoon HY. Evaluation of mechanical properties of self-expanding metal stents for optimization of tracheal collapse in dogs. Canadian Journal of Veterinary Research. 2022;86(3):188-193.',
    sourceType: 'peer-reviewed',
    note: 'Preclinical veterinary evidence.',
  },
  {
    id: 26,
    citation:
      'Chung FT, et al. Factors leading to tracheobronchial self-expandable metallic stent fracture. Journal of Thoracic and Cardiovascular Surgery. 2008;136:1328-1335.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 27,
    citation:
      'Farahani MM, Bakhtiyari A, Beshkoofe S, et al. Numerical simulation of the effect of geometric parameters on silicone airway stent migration. Frontiers in Mechanical Engineering. 2023;9:1215895. doi:10.3389/fmech.2023.1215895.',
    sourceType: 'peer-reviewed',
  },
  {
    id: 39,
    citation:
      'McKenna CG, Vaughan TJ. A finite element investigation of the mechanical behavior of covered braided stents. Journal of the Mechanical Behavior of Biomedical Materials. 2021;115:104305.',
    sourceType: 'peer-reviewed',
    note: 'General covered-braid mechanics; transfer to airway use requires caution.',
  },
  {
    id: 43,
    citation:
      'Pelton AR, Schroeder V, Mitchell MR, Gong XY, Barney M, Robertson SW. Fatigue and durability of nitinol stents. Journal of the Mechanical Behavior of Biomedical Materials. 2008;1:153-164.',
    sourceType: 'peer-reviewed',
    note: 'General nitinol fatigue framework.',
  },
]

export const sourceDocumentLabel =
  'Mechanical Properties, Design Architecture, and Tissue Interaction of Airway Stents (technical synthesis, July 2026)'
