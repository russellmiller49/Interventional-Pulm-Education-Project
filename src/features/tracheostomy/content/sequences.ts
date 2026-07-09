import type { StepSequence } from '@/features/skill-lab/engine/types'

export interface TracheostomyStepSequence extends StepSequence {
  referenceIds: string[]
}

export const tracheostomySequences: TracheostomyStepSequence[] = [
  {
    id: 'pdt-cognitive-sequence',
    title: 'Percutaneous dilatational tracheostomy: cognitive sequence',
    prompt:
      'Arrange the safety gates for a bronchoscopy-guided percutaneous dilatational tracheostomy. This is a cognitive simulation, not a substitute for supervised procedural training.',
    steps: [
      {
        id: 'prepare-team',
        label:
          'Confirm indication, consent, team roles, equipment, monitoring, anticoagulation plan, rescue airway, and preoxygenation',
        detail: 'The team agrees on the primary and rescue plans before manipulating the airway.',
      },
      {
        id: 'position-map',
        label:
          'Position the patient and map the cricoid, tracheal midline, depth, thyroid tissue, and vessels by examination and ultrasound as appropriate',
        detail:
          'External mapping identifies whether the planned path is central, deep, deviated, or crossed by vascular structures.',
      },
      {
        id: 'sterile-field',
        label:
          'Prepare the sterile field, local plan, skin incision, and controlled blunt dissection',
        detail:
          'A controlled path to the pretracheal plane reduces force during needle entry and dilation.',
      },
      {
        id: 'control-ett',
        label:
          'Under bronchoscopy, withdraw and control the endotracheal tube so the cuff and tip are clear of the puncture site while ventilation is preserved',
        detail:
          'The ETT remains secured in a known position; accidental extubation and cuff puncture are anticipated hazards.',
      },
      {
        id: 'needle-entry',
        label: 'Enter the trachea in the midline with the needle directed caudally under vision',
        detail:
          'The bronchoscopic view confirms midline intraluminal entry and helps avoid posterior-wall injury.',
      },
      {
        id: 'wire',
        label: 'Advance and maintain control of a caudally directed J-wire',
        detail:
          'Wire position is reconfirmed before every device exchange; losing the wire means losing the tract.',
      },
      {
        id: 'initial-dilation',
        label: 'Create the initial tract over the controlled wire',
        detail:
          'The first dilation establishes a controlled path while wire direction and bronchoscopic position remain visible.',
      },
      {
        id: 'main-dilation',
        label: 'Perform the planned main dilation without advancing blindly against resistance',
        detail:
          'Unexpected resistance triggers reassessment of wire, tract, angle, anatomy, and device alignment.',
      },
      {
        id: 'insert-tube',
        label: 'Advance the selected tracheostomy tube over its introducer and wire into the lumen',
        detail:
          'The tube length, curve, cuff, and introducer must match the patient anatomy and prepared rescue plan.',
      },
      {
        id: 'restore-airway',
        label:
          'Remove the introducer and wire, insert the inner cannula, manage the cuff, and connect the circuit',
        detail:
          'The airway is converted from the placement system to the functioning tracheostomy tube without delay.',
      },
      {
        id: 'confirm',
        label:
          'Confirm waveform carbon dioxide, ventilation volumes, chest movement and breath sounds, cuff behavior, and bronchoscopic tube-tip position',
        detail: 'No single sign is sufficient; multimodal confirmation closes the placement loop.',
      },
      {
        id: 'secure-handoff',
        label:
          'Secure the tube and circuit, document exact device and depth, place airway signage, stock rescue equipment, and complete a structured handoff',
        detail:
          'The procedure is not complete until the next team can identify and rescue the airway safely.',
      },
    ],
    rationale:
      'The sequence protects oxygenation and wire control at every transition: plan, map, control the existing airway, enter and dilate under vision, place and prove the new airway, then create the post-procedure rescue system.',
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021'],
  },
  {
    id: 'first-shift-care',
    title: 'First-shift tracheostomy care',
    prompt:
      'Arrange the initial first-shift priorities after a newly placed adult tracheostomy arrives in your care area.',
    steps: [
      {
        id: 'verify-airway',
        label:
          'Verify waveform carbon dioxide or ventilation data, chest movement, breath sounds, tube depth, and clinical stability',
        detail:
          'Start by proving that the airway received in handoff is patent, positioned, and ventilating.',
      },
      {
        id: 'identify-tube-plan',
        label:
          'Identify the exact tube, placement technique and time, tract maturity, upper-airway patency, oral-intubation feasibility, and first-change plan',
        detail:
          'These facts determine whether rescue can occur from above, through the stoma, or only with expert surgical-airway support.',
      },
      {
        id: 'secure-movement',
        label: 'Check securement and assign tube-and-circuit stabilization for every turn or move',
        detail:
          'A newly placed tube is most vulnerable to traction, circuit torque, and false passage during movement.',
      },
      {
        id: 'cuff-circuit',
        label:
          'Confirm the indication for the cuff, measure pressure with a manometer using the local target, and reassess the circuit for leak or traction',
        detail:
          'Pilot-balloon feel and inflation volume do not replace measured cuff pressure or investigation of a new leak.',
      },
      {
        id: 'humidification-secretions',
        label:
          'Provide appropriate humidification, assess secretion burden, inspect the inner cannula, and suction only for clinical indications',
        detail:
          'Humidification and an immediately removable inner cannula reduce preventable occlusion; suction technique follows the local airway protocol.',
      },
      {
        id: 'bedside-rescue',
        label:
          'Place a same-size and one-size-smaller tube, obturator, spare inner cannula, suction, oxygen, bag-mask and stoma interfaces, and cuff manometer at the bedside',
        detail:
          'Rescue equipment must be visible, complete, and matched to the actual tube and airway anatomy.',
      },
      {
        id: 'skin-oral-mobility',
        label: 'Assess stoma and skin, provide oral care, and plan safe positioning and mobility',
        detail:
          'Airway care includes pressure-injury prevention, infection surveillance, secretion management, and early rehabilitation.',
      },
      {
        id: 'document-handoff',
        label:
          'Document findings and display airway-specific signage; hand off the emergency plan and who to call for replacement',
        detail:
          'The fresh or immature status remains explicit for at least 7 days or until the first planned change and local maturity criteria are met.',
      },
    ],
    rationale:
      'First-shift care moves from proving the airway, to identifying its anatomy and rescue routes, to preventing displacement and obstruction, and finally to making the plan visible for every subsequent responder.',
    referenceIds: [
      'tracheostomy-knowledge-base',
      'mussa-aarc-2021',
      'blakeman-aarc-2022',
      'mitchell-consensus-2013',
    ],
  },
]
