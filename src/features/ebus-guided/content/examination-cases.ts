import type { ExaminationCase } from '../engine/examination'
import manifest from '../../../../EBUS-course/apps/web/public/simulator/case-001/models/guided-v1/asset-manifest.json'

/** Fictional written case. Clinical references, phantoms and case-001 acquisitions stay separate. */
export const EXAMINATION_CASE: ExaminationCase = {
  id: 'left-lung-workup-v1',
  version: 1,
  title: 'Left lung primary: examination and specimen record',
  sourceType: 'authored-case',
  geometryVersion: null,
  clinicalQuestion:
    'Obtain a diagnosis, establish the relevant nodal extent and preserve material for requested ancillary testing.',
  primaryLocation: 'Left lung primary',
  sources: ['ers2026', 'iaslc9', 'chest2024', 'ics2023', 'simulation'],
  context:
    'Authored teaching case. The imaging request describes two separate 4R nodes and targets at 7, 4L and 11L. This is a written nodal map; no supplied clinical image or model is registered to this case.',
  limitation:
    'The later examination and specimen findings are supplied fictional history. Your work records the plan and interprets that history; it does not perform a patient examination or generate tissue.',
  stations: [
    {
      id: '4R',
      indication: 'Contralateral mediastinal targets; preserve each node identity.',
      category: 'N3',
    },
    { id: '7', indication: 'Subcarinal target in the systematic examination.', category: 'N2' },
    {
      id: '4L',
      indication: 'Ipsilateral mediastinal target requiring anatomical and access assessment.',
      category: 'N2',
    },
    {
      id: '11L',
      indication: 'Ipsilateral interlobar target from the imaging request.',
      category: 'N1',
    },
  ],
  nodes: [
    {
      id: '4r-a',
      stationId: '4R',
      label: '4R · Node A',
      context:
        'Supplied examination history: target visualized and sampled; the aspirate contains blood without representative lymphoid or lesional material.',
      visualization: 'described',
      sampling: 'sampled',
      specimenIds: ['s-4r-a'],
    },
    {
      id: '4r-b',
      stationId: '4R',
      label: '4R · Node B',
      context:
        'Supplied examination history: a distinct target in the same station was visualized and sampled. ROSE reports malignant cells; final pathology and ancillary suitability remain pending.',
      visualization: 'described',
      sampling: 'sampled',
      specimenIds: ['s-4r-b'],
    },
    {
      id: '7-a',
      stationId: '7',
      label: '7 · Node A',
      context:
        'Supplied examination history: a subcarinal target was visualized and sampled. Final cytology reports representative lymphoid material without malignant cells.',
      visualization: 'described',
      sampling: 'sampled',
      specimenIds: ['s-7-a'],
    },
    {
      id: '4l-a',
      stationId: '4L',
      label: '4L · Target A',
      context:
        'Supplied examination history: a stable acceptable ultrasound window could not be obtained. The image was inadequate for the intended assessment.',
      visualization: 'image-inadequate',
      sampling: 'not-sampled',
      samplingReason: 'No acceptable stable window',
      specimenIds: [],
    },
    {
      id: '11l-a',
      stationId: '11L',
      label: '11L · Target A',
      context:
        'Supplied examination history: the team stopped acquisition for worsening procedural tolerance before examining this target.',
      visualization: 'not-examined',
      sampling: 'not-sampled',
      samplingReason: 'Procedure stopped before assessment',
      specimenIds: [],
    },
  ],
  specimens: [
    {
      id: 's-4r-a',
      nodeId: '4r-a',
      stationId: '4R',
      label: 'Specimen A · 4R, Node A',
      requestedTests: [
        {
          id: 'cytology',
          name: 'Cytology / cell block',
          protocol:
            'Case instruction: retain the individual specimen label and use the receiving cytopathology service’s supplied processing protocol.',
        },
      ],
    },
    {
      id: 's-4r-b',
      nodeId: '4r-b',
      stationId: '4R',
      label: 'Specimen B · 4R, Node B',
      requestedTests: [
        {
          id: 'cytology',
          name: 'Cytology / cell block',
          protocol:
            'Case instruction: submit this node’s separately identified material under the supplied cytopathology protocol.',
        },
        { id: 'biomarkers', name: 'Requested ancillary biomarkers', protocol: null },
      ],
    },
    {
      id: 's-7-a',
      nodeId: '7-a',
      stationId: '7',
      label: 'Specimen C · 7, Node A',
      requestedTests: [
        {
          id: 'cytology',
          name: 'Cytology / cell block',
          protocol:
            'Case instruction: retain station 7 identity and use the supplied cytopathology processing protocol.',
        },
      ],
    },
  ],
  results: [
    {
      id: 'r-4r-a-final',
      specimenId: 's-4r-a',
      phase: 'final',
      state: 'supplied',
      text: 'Blood only; no representative lymphoid or lesional material.',
    },
    {
      id: 'r-4r-b-rose',
      specimenId: 's-4r-b',
      phase: 'rose',
      state: 'supplied',
      text: 'On-site communication: malignant cells identified. This is provisional information.',
    },
    {
      id: 'r-4r-b-final',
      specimenId: 's-4r-b',
      phase: 'final',
      state: 'pending',
      text: 'Final pathology pending.',
    },
    {
      id: 'r-4r-b-ancillary',
      specimenId: 's-4r-b',
      phase: 'ancillary',
      state: 'pending',
      text: 'Ancillary suitability and results pending; medium and quantity requirements need laboratory clarification.',
    },
    {
      id: 'r-7-final',
      specimenId: 's-7-a',
      phase: 'final',
      state: 'supplied',
      text: 'Representative lymphoid material without malignant cells identified.',
    },
    {
      id: 'r-7-rose',
      specimenId: 's-7-a',
      phase: 'rose',
      state: 'not-available',
      text: 'No on-site interpretation supplied for this specimen.',
    },
  ],
  complications:
    'Supplied history: acquisition stopped for worsening procedural tolerance. No physiological recovery, injury severity or discharge readiness is supplied.',
  reportOptions: [
    {
      id: 'distinct-nodes',
      text: 'Two distinct 4R nodes were sampled under separate specimen identities within one anatomical station.',
      supportedBy: ['4r-a', '4r-b', 's-4r-a', 's-4r-b'],
    },
    {
      id: 'nonrepresentative',
      text: 'The 4R Node A aspirate is nonrepresentative; it does not establish a negative node.',
      supportedBy: ['r-4r-a-final'],
    },
    {
      id: 'provisional-pending',
      text: '4R Node B has provisional malignant cells on ROSE; final pathology and ancillary suitability/results remain pending.',
      supportedBy: ['r-4r-b-rose', 'r-4r-b-final', 'r-4r-b-ancillary'],
    },
    {
      id: 'seven-result',
      text: 'Station 7 contains representative lymphoid material without malignant cells in the supplied specimen.',
      supportedBy: ['r-7-final'],
    },
    {
      id: 'unresolved-targets',
      text: '4L was not sampled because no acceptable stable window was obtained; 11L was not examined or sampled before the procedure stopped.',
      supportedBy: ['4l-a', '11l-a'],
    },
    {
      id: 'procedure-limit',
      text: 'The examination remains incomplete. The responsible clinical team must reconcile the unresolved targets, final pathology, pending studies and recovery observations.',
      supportedBy: ['4l-a', '11l-a', 'r-4r-b-final', 'r-4r-b-ancillary'],
    },
  ],
}
export const MODEL_WINDOW_CASE: ExaminationCase = {
  id: 'case-001-station-seven-window',
  version: 1,
  title: 'Model case 001: subcarinal window',
  sourceType: 'model-case',
  geometryVersion: manifest.version,
  clinicalQuestion:
    'Record the supported anatomical identity and the limits of the acquired model window.',
  primaryLocation: 'Not applicable to this acquisition task',
  sources: ['atlas', 'simulation'],
  context:
    'One modeled target viewed from assisted bronchial starts. A changed position remains part of the same anatomy case.',
  limitation:
    'Model evidence is not a complete station survey, a sample, a negative tissue result or live guidance after reload.',
  stations: [
    { id: '7', indication: 'Subcarinal anatomical relationship and approach invariance.' },
  ],
  nodes: [
    {
      id: 'model-7-a',
      stationId: '7',
      label: 'Model target A',
      context: 'Use your acquired ultrasound and landmark checks.',
      visualization: 'described',
      sampling: 'not-supplied',
      specimenIds: [],
    },
  ],
  specimens: [],
  results: [],
  complications: 'Patient physiology and complications are not modeled.',
  reportOptions: [],
}
export const DESCRIPTION_CASE: ExaminationCase = {
  id: 'written-node-description-v1',
  version: 1,
  title: 'Describe the supplied nodal features',
  sourceType: 'authored-case',
  geometryVersion: null,
  clinicalQuestion:
    'Separate a written sonographic description from pathology and measurement claims.',
  primaryLocation: 'Not supplied',
  sources: ['ics2023', 'simulation'],
  context:
    'Written vignette: an anatomically identified station 7 node is oval with homogeneous internal echoes. The vignette supplies no measured size, Doppler assessment, expert border annotation or pathology result.',
  limitation:
    'This is description and reasoning from supplied features, not a scored clinical-image recognition task. Any reference image is a separate example.',
  stations: [{ id: '7', indication: 'Describe the supplied features.' }],
  nodes: [
    {
      id: 'described-7-a',
      stationId: '7',
      label: 'Described node',
      context: 'Oval contour; homogeneous internal echoes; other features not supplied.',
      visualization: 'described',
      sampling: 'not-supplied',
      specimenIds: [],
    },
  ],
  specimens: [],
  results: [],
  complications: 'Not supplied.',
  reportOptions: [],
}
