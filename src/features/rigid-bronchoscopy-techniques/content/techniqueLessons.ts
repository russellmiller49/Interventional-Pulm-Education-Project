import type { TechniqueLesson } from '@/features/rigid-bronchoscopy-techniques/types'

/**
 * The nine technique micro-lessons. Objectives, safety statements, key movement
 * rules, and retrieval questions are UI text (never baked into the video).
 * `mainstem-direction` is the validated prototype and is produced first.
 *
 * This content supplements supervised simulation and clinical instruction and
 * does not independently credential a learner to perform rigid bronchoscopy.
 */

export const techniqueLessons: TechniqueLesson[] = [
  {
    id: 'positioning',
    order: 1,
    title: 'Equipment and patient positioning',
    objective: 'Identify the positioning and equipment checks required before rigid intubation.',
    approxDurationSeconds: 90,
    safetyStatement:
      'Uses an adult airway training manikin. Confirm dental protection and a shared team time-out before any scope entry.',
    keyMovementRule:
      'The operator works from the head of the bed with the manikin supine and the head at the working end of the table.',
    commonError: 'Beginning intubation before dental protection and ventilation are confirmed.',
    clipIds: ['RB-POS-001', 'RB-POS-002', 'RB-POS-003'],
    retrievalQuestions: [
      {
        id: 'positioning-q1',
        kind: 'order-steps',
        prompt: 'Order the pre-intubation checks before scope entry.',
        orderedSteps: [
          'Position manikin supine, head at the working end',
          'Place dental protection',
          'Assemble scope, telescope, suction, and ventilation',
          'Team time-out',
        ],
        explanation: 'Protection and shared readiness precede any airway entry.',
      },
    ],
  },
  {
    id: 'oral-entry',
    order: 2,
    title: 'Oral entry and epiglottis identification',
    objective:
      'Describe controlled oral entry and the visual sequence leading to identification of the epiglottis.',
    approxDurationSeconds: 90,
    safetyStatement:
      'Internal views are a validated or stylized 3D cutaway, not a real larynx. Pause and reposition when the expected landmark is not visible.',
    keyMovementRule:
      'Enter midline over the tongue and advance slowly without levering on the teeth.',
    commonError: 'Applying blind forward force when the epiglottis is not yet in view.',
    clipIds: ['RB-ORAL-001', 'RB-ORAL-002'],
    movementSync: true,
    retrievalQuestions: [
      {
        id: 'oral-entry-q1',
        kind: 'safe-or-unsafe',
        prompt:
          'The expected landmark is not visible, so the operator advances with steady forward pressure. Safe or unsafe?',
        options: ['Safe', 'Unsafe'],
        answerIndex: 1,
        explanation: 'Loss of the expected landmark should trigger repositioning, not blind force.',
      },
    ],
  },
  {
    id: 'glottic-passage',
    order: 3,
    title: 'Glottic exposure and cord passage',
    objective: 'Describe the coordinated movement required to expose and traverse the glottis.',
    approxDurationSeconds: 90,
    safetyStatement:
      'A synthetic training representation. The sequence is slow, atraumatic, continuously visualized, and contains no forceful advancement.',
    keyMovementRule:
      'Immediately before passing the opening, rotate the straight barrel ~90° to align its narrower dimension, then return to working orientation after passage.',
    commonError: 'Forcing passage without rotating to align the narrower barrel dimension.',
    clipIds: ['RB-GLOTTIS-001', 'RB-GLOTTIS-002', 'RB-GLOTTIS-003'],
    retrievalQuestions: [
      {
        id: 'glottic-passage-q1',
        kind: 'order-steps',
        prompt: 'Order the glottic-passage sequence.',
        orderedSteps: [
          'Expose the glottis with a small deliberate lift',
          'Rotate ~90° to align the narrower dimension',
          'Pass the opening under direct visualization',
          'Return the barrel to working orientation',
        ],
      },
    ],
  },
  {
    id: 'tracheal-advancement',
    order: 4,
    title: 'Tracheal advancement and carinal orientation',
    objective:
      'Demonstrate the relationship between the proximal barrel, distal bevel, airway centerline, and carina.',
    approxDurationSeconds: 90,
    safetyStatement:
      'Advance only while the lumen is directly visualized. Stop and recenter whenever anatomy is lost.',
    keyMovementRule:
      'Keep the bevel aligned to the airway centerline and advance only when visualized.',
    commonError: 'Continuing to advance after the lumen is no longer in view.',
    clipIds: ['RB-TRACH-001', 'RB-TRACH-002'],
    movementSync: true,
    retrievalQuestions: [
      {
        id: 'tracheal-advancement-q1',
        kind: 'multiple-choice',
        prompt: 'The lumen is lost mid-advancement. What is the next action?',
        options: [
          'Advance faster to regain the view',
          'Stop and recenter to re-establish visualization',
          'Rotate 180° and push',
          'Lever on the incisors to change angle',
        ],
        answerIndex: 1,
        explanation:
          'Loss of visualization means stop and recenter before any further advancement.',
      },
    ],
  },
  {
    id: 'scope-manipulation',
    order: 5,
    title: 'Scope-manipulation movement map',
    objective: 'Predict distal-tip response to isolated proximal movements.',
    approxDurationSeconds: 120,
    safetyStatement:
      'Movement vectors and arrows are deterministic overlays added in postproduction, not generated inside the image.',
    keyMovementRule:
      'A proximal movement produces a predictable, opposite-sense distal response; pause and predict before each reveal.',
    commonError: 'Assuming the distal tip moves in the same direction as the proximal barrel.',
    clipIds: ['RB-MOVE-001', 'RB-MOVE-002', 'RB-MOVE-003'],
    movementSync: true,
    retrievalQuestions: [
      {
        id: 'scope-manipulation-q1',
        kind: 'predict-distal-response',
        prompt:
          'The proximal barrel is moved toward the patient’s right. Which way does the distal tip point?',
        explanation:
          'Moving the proximal barrel toward patient-right pivots the distal tip toward patient-left.',
      },
    ],
  },
  {
    id: 'mainstem-direction',
    order: 6,
    title: 'Directing the rigid bronchoscope into the mainstem bronchi',
    objective:
      'Explain how patient head position and movement of the proximal rigid bronchoscope influence distal-tip alignment toward a selected mainstem bronchus.',
    approxDurationSeconds: 90,
    safetyStatement:
      'External maneuver only. Side is described in patient anatomical terms and every side-specific clip passes an explicit left/right check. Advance only after alignment under direct visualization.',
    keyMovementRule:
      'To target a mainstem bronchus, move the patient’s head and the proximal barrel toward the contralateral side; the distal tip then aligns toward the target side.',
    commonError:
      'Using the upper incisors as a fulcrum, or advancing before alignment is confirmed.',
    clipIds: [
      'RB-NAV-001',
      'RB-NAV-L-001',
      'RB-NAV-L-002',
      'RB-NAV-R-001',
      'RB-NAV-R-002',
      'RB-NAV-ERR-001',
      'RB-NAV-QUIZ-001',
    ],
    movementSync: true,
    retrievalQuestions: [
      {
        id: 'RB-NAV-QUIZ-001',
        kind: 'multiple-choice',
        prompt:
          'The intended target is the left mainstem bronchus. Which direction should the patient’s head and the proximal barrel move?',
        options: [
          'Head and proximal barrel toward the patient’s right',
          'Head and proximal barrel toward the patient’s left',
          'Head toward the left, proximal barrel toward the right',
          'Neither — advance straight without repositioning',
        ],
        answerIndex: 0,
        explanation:
          'Moving the head and proximal barrel toward patient-right aligns the distal tip toward the patient-left mainstem. Head movement alone does not guarantee entry — advance only after direct visualization.',
      },
    ],
  },
  {
    id: 'apple-coring',
    order: 7,
    title: 'Apple-coring mechanics',
    objective:
      'Describe the controlled use of the beveled rigid barrel for mechanical debulking of a predominantly intraluminal synthetic lesion.',
    approxDurationSeconds: 120,
    safetyStatement:
      'Internal mechanics are a synthetic, medically reviewed 3D visualization — labeled "Synthetic procedural visualization" — not a real patient. No blind or indiscriminate coring.',
    keyMovementRule:
      'Center the bevel at the tumor–lumen interface; use a short controlled advance with deliberate rotation while the airway wall stays stationary; pause, withdraw, extract, suction, reinspect.',
    commonError: 'Coring without a clearly distinguishable airway wall and intended lumen.',
    clipIds: ['RB-CORE-001', 'RB-CORE-002'],
    movementSync: true,
    retrievalQuestions: [
      {
        id: 'apple-coring-q1',
        kind: 'safe-or-unsafe',
        prompt:
          'The normal airway wall remains stationary while a central lesion core separates. Safe or unsafe?',
        options: ['Safe', 'Unsafe'],
        answerIndex: 0,
        explanation:
          'A stationary wall with a separating central core is the intended, controlled appearance.',
      },
    ],
  },
  {
    id: 'unsafe-mechanics',
    order: 8,
    title: 'Unsafe apple-coring mechanics',
    objective: 'Recognize visual cues that should cause the operator to stop and reassess.',
    approxDurationSeconds: 90,
    safetyStatement:
      'Every unsafe example freezes before serious injury is depicted. The overlay reads: Stop / Withdraw / Suction / Re-establish anatomy / Reassess the tissue plane.',
    keyMovementRule:
      'If the airway wall moves with the lesion or the distal lumen is lost, stop and reassess.',
    commonError: 'Continuing to core when the wall moves with the lesion or the lumen is lost.',
    clipIds: ['RB-UNSAFE-001', 'RB-UNSAFE-002'],
    retrievalQuestions: [
      {
        id: 'unsafe-mechanics-q1',
        kind: 'safe-or-unsafe',
        prompt:
          'The airway wall begins moving together with the lesion during rotation. Safe or unsafe?',
        options: ['Safe', 'Unsafe'],
        answerIndex: 1,
        explanation:
          'Wall moving with the lesion means loss of plane — stop, withdraw, and reassess.',
      },
    ],
  },
  {
    id: 'integrated-sequence',
    order: 9,
    title: 'Integrated manikin sequence',
    objective:
      'Mentally rehearse the full sequence from positioning through bilateral mainstem navigation.',
    approxDurationSeconds: 120,
    safetyStatement:
      'Assembled from previously approved clips with pause-and-predict points. It does not depict a real patient procedure.',
    keyMovementRule:
      'Each stage follows the same rules established in the individual lessons; pause to predict before each transition.',
    commonError: 'Treating the rehearsal as a substitute for supervised hands-on practice.',
    clipIds: ['RB-SEQ-001'],
    retrievalQuestions: [
      {
        id: 'integrated-sequence-q1',
        kind: 'order-steps',
        prompt: 'Order the integrated sequence.',
        orderedSteps: [
          'Positioning',
          'Oral entry',
          'Cord passage',
          'Tracheal advancement',
          'Mainstem direction',
          'Debulking mechanics',
        ],
      },
    ],
  },
]

export function getTechniqueLesson(id: string | null | undefined): TechniqueLesson | null {
  const normalized = id?.trim()
  if (!normalized) {
    return null
  }
  return techniqueLessons.find((lesson) => lesson.id === normalized) ?? null
}

/** Lessons in intended learner order. */
export function getOrderedTechniqueLessons(): TechniqueLesson[] {
  return [...techniqueLessons].sort((a, b) => a.order - b.order)
}
