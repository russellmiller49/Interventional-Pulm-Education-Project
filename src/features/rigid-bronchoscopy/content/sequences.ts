import type { StepSequence } from '@/features/skill-lab/engine/types'

/**
 * Ordered procedural workflows for the Rigid Bronchoscopy Practice section.
 * Steps are authored in the correct order; the UI shuffles them. Sequences
 * describe recognized rigid-bronchoscopy technique for simulation teaching only.
 *
 * References: chest-ip-2003, ernst-cao-2004, folch-stents-2018, asa-or-fire-2013.
 */
export const rigidBronchoscopySequences: StepSequence[] = [
  {
    id: 'rigid-intubation',
    title: 'Rigid bronchoscope intubation',
    prompt: 'Order the steps for intubating the trachea with a rigid bronchoscope.',
    steps: [
      {
        id: 'position',
        label:
          'Position the head and neck with the neck flexed and head extended, and protect the teeth',
        detail:
          'Aligning the axes and guarding the upper teeth/gums prepares for atraumatic passage.',
      },
      {
        id: 'insert-midline',
        label: 'Insert the scope in the midline over the tongue and identify the epiglottis',
        detail: 'A midline approach over the tongue brings the epiglottis and glottis into view.',
      },
      {
        id: 'lift-epiglottis',
        label: 'Lift the epiglottis and bring the vocal cords into view',
        detail: 'The tip is used to lift the epiglottis, exposing the cords for passage.',
      },
      {
        id: 'rock-and-roll',
        label: 'Rotate the bevel 90° and “rock and roll” the tip through the cords',
        detail:
          'Turning the bevel to the cords and gently rotating advances the rigid tube atraumatically past the glottis.',
      },
      {
        id: 'confirm-ventilation',
        label: 'Reposition midline, confirm tracheal placement, and connect ventilation',
        detail:
          'Confirming the tube is in the trachea and connecting the circuit re-establishes ventilation.',
      },
    ],
    rationale:
      'Rigid intubation is a fixed sequence: optimize the head/neck axes and protect the teeth, enter midline, lift the epiglottis, rotate the bevel to pass the cords with a rock-and-roll motion, then confirm placement and ventilate.',
  },
  {
    id: 'tumor-coring',
    title: 'Mechanical tumour coring / debulking',
    prompt: 'Order the steps for mechanically coring an obstructing endoluminal tumour.',
    steps: [
      {
        id: 'confirm-vent-fio2',
        label: 'Confirm ventilation and reduce FiO₂ before using any energy device',
        detail:
          'A shared, oxygen-rich airway is a fire risk; FiO₂ is minimized before laser/electrosurgery.',
      },
      {
        id: 'identify-lumen',
        label: 'Identify the residual lumen and the tumour margins',
        detail: 'Finding the true lumen first avoids creating a false passage or perforation.',
      },
      {
        id: 'devascularize',
        label: 'Devascularize the tumour surface with an ablative modality when appropriate',
        detail: 'Coagulating the surface first reduces bleeding during mechanical coring.',
      },
      {
        id: 'core',
        label: 'Core through the tumour with the bevel of the barrel and remove fragments',
        detail:
          'The rigid bevel shears the tumour along the lumen; fragments are retrieved as you go.',
      },
      {
        id: 'hemostasis',
        label: 'Achieve hemostasis and clear debris from the airway',
        detail:
          'Bleeding is controlled and fragments cleared so they do not soil the distal airway.',
      },
      {
        id: 'reassess',
        label: 'Reassess airway patency and ventilation',
        detail:
          'Confirming restored patency and stable ventilation closes the loop before moving on.',
      },
    ],
    rationale:
      'Coring is done safely by first securing ventilation and lowering FiO₂, finding the lumen, devascularizing before cutting, coring with the rigid bevel, then securing hemostasis and reassessing patency.',
  },
  {
    id: 'stent-deployment',
    title: 'Airway stent deployment',
    prompt: 'Order the steps for deploying an airway stent across a stenosis.',
    steps: [
      {
        id: 'measure',
        label: 'Measure the stenosis length and airway diameter to size the stent',
        detail: 'Correct sizing prevents migration (too small) and mucosal injury (too large).',
      },
      {
        id: 'dilate',
        label: 'Establish a lumen by coring or dilation as needed',
        detail:
          'A patent channel is created first so the delivery system can pass and the stent can expand.',
      },
      {
        id: 'position',
        label:
          'Position the delivery system across the stenosis under direct or fluoroscopic vision',
        detail: 'Accurate positioning spans the lesion with adequate stent on either side.',
      },
      {
        id: 'deploy',
        label: 'Deploy the stent and confirm expansion across the lesion',
        detail: 'Controlled deployment seats the stent across the stenosis.',
      },
      {
        id: 'confirm',
        label: 'Confirm position and patency and reassess ventilation',
        detail: 'Verifying seating, patency, and stable ventilation completes the deployment.',
      },
    ],
    rationale:
      'Stenting follows sizing: measure the lesion, create a lumen, position across the stenosis under vision, deploy, then confirm position, patency, and ventilation.',
  },
]
