export interface GlossaryTerm {
  term: string
  definition: string
}

export const chestDrainageGlossary: GlossaryTerm[] = [
  {
    term: 'Air leak meter',
    definition:
      'A visual or digital display that estimates air leaving the pleural space or system. Interpretation depends on patient state and system integrity.',
  },
  {
    term: 'Dependent loop',
    definition:
      'A low segment of tubing where fluid can pool and reduce drainage, especially when the unit is lower than the patient but tubing sags.',
  },
  {
    term: 'Dry suction regulator',
    definition:
      'A regulator or dial that sets a target suction level without using a wet suction-control water column.',
  },
  {
    term: 'Patient pressure float ball',
    definition:
      'A visual indicator used on some systems to display modeled patient-side pressure changes around the water seal chamber.',
  },
  {
    term: 'Tidaling',
    definition:
      'Respiratory swing in the water seal or pressure display. Absence can reflect obstruction, re-expansion, malposition, or system design.',
  },
  {
    term: 'Water seal',
    definition:
      'A one-way seal that lets air leave while preventing retrograde flow into the pleural space when maintained at the correct fill level.',
  },
]
