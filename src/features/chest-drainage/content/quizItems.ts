export interface QuizItem {
  id: string
  prompt: string
  choices: string[]
  answerIndex: number
  explanation: string
  referenceIds: string[]
}

export const chestDrainageQuizItems: QuizItem[] = [
  {
    id: 'dry-suction-indicator',
    prompt:
      'The dry suction dial is set to -20 cm H2O, but the suction monitor bellows/indicator is not visible. What is the best first interpretation?',
    choices: [
      'The dial target is set, but source suction/setup may be insufficient.',
      'The patient must have no air leak.',
      'The drainage unit should be tipped briefly to reset the float.',
      'The patient tube should be clamped while troubleshooting.',
    ],
    answerIndex: 0,
    explanation:
      'A dry suction target needs adequate source suction and correct setup before the indicator confirms function.',
    referenceIds: ['teleflex-ifu', 'sorino-2024'],
  },
  {
    id: 'continuous-bubbling',
    prompt:
      'Continuous bubbling is seen in the water seal area. Which sequence best matches the module model?',
    choices: [
      'Assess the patient, then evaluate tube, unit, connections, suction source, and disease physiology.',
      'Increase wall suction until bubbling disappears.',
      'Clamp the patient tube and leave it clamped for routine observation.',
      'Ignore it if the collection chamber is not full.',
    ],
    answerIndex: 0,
    explanation:
      'Troubleshooting starts with the patient and then moves through the circuit deliberately.',
    referenceIds: ['bts-2023', 'sorino-2024'],
  },
  {
    id: 'no-tidaling',
    prompt: 'No tidaling is seen in a stable patient. What does the simulator teach?',
    choices: [
      'No tidaling has a differential diagnosis; it is not automatically an emergency.',
      'No tidaling always proves the chest tube is clotted.',
      'No tidaling always proves the lung is fully expanded.',
      'No tidaling means suction must be increased before assessing the patient.',
    ],
    answerIndex: 0,
    explanation:
      'No tidaling can occur with obstruction, dependent loop, malposition, re-expansion, positive-pressure ventilation, or system design.',
    referenceIds: ['zisis-2015', 'sorino-2024'],
  },
  {
    id: 'reexpansion-risk',
    prompt:
      'A large chronic pneumothorax is being drained and high suction is requested. What should the educational model emphasize?',
    choices: [
      'Avoid abrupt high negative pressure without patient assessment, imaging context, and local protocol.',
      'High suction is always safest because it expands the lung fastest.',
      'Water seal depth no longer matters once suction is on.',
      'Digital drains remove the need for clinical judgment.',
    ],
    answerIndex: 0,
    explanation:
      'The module intentionally models risk rising with chronic collapse, rapid expansion, and high negative pressure.',
    referenceIds: ['bts-2023', 'sorino-2024'],
  },
]
