import type { RecordTask } from '../engine/examination'
export interface RecordDecision {
  id: string
  label: string
  choices: [string, string][]
}
export const RECORD_DECISIONS: Record<RecordTask, RecordDecision[]> = {
  'station-window': [
    {
      id: 'station-basis',
      label: 'Basis for station identity',
      choices: [
        ['shape', 'The target’s rounded section'],
        ['landmarks', 'The target compartment and checked airway landmarks'],
        ['control', 'The scope rotation value'],
      ],
    },
    {
      id: 'survey-extent',
      label: 'Extent supported by this acquisition',
      choices: [
        ['complete', 'Complete clinical station survey'],
        ['window-only', 'This window only'],
        ['negative', 'Negative tissue assessment'],
      ],
    },
  ],
  'node-description': [
    {
      id: 'description',
      label: 'Description supported by the vignette',
      choices: [
        ['benign', 'Benign node on sonographic criteria'],
        ['appearance-only', 'Oval, homogeneous appearance; pathology undetermined'],
        ['malignant', 'Suspicious node; no central hilar structure described'],
      ],
    },
    {
      id: 'measurement',
      label: 'Measurement context',
      choices: [
        ['phantom', 'Use the earlier phantom’s millimeters'],
        ['not-supplied', 'No calibrated size is supplied'],
        ['pixels', 'Infer clinical size from the reference pixels'],
      ],
    },
  ],
  plan: [
    {
      id: 'station-count',
      label: 'How many anatomical stations do the two 4R nodes represent?',
      choices: [
        ['two', 'Two stations'],
        ['one', 'One station'],
        ['unknown', 'One or two, depending on the pathology of each'],
      ],
    },
  ],
  adequacy: [
    {
      id: 'rose-status',
      label: 'What does the on-site communication establish?',
      choices: [
        ['final', 'Final pathology and assay suitability'],
        ['provisional', 'Provisional specimen information'],
        ['all-stations', 'Results for the entire examination'],
      ],
    },
    {
      id: 'next-specimen',
      label: 'Next specimen decision',
      choices: [
        ['more-passes', 'Complete four passes before reassessing tolerance'],
        ['reconcile-safety', 'Reconcile requested studies, handling and procedural tolerance'],
        ['finish-all', 'Stop: malignant cells on ROSE complete the specimen plan'],
      ],
    },
    {
      id: 'without-rose',
      label: 'If ROSE is unavailable for a later procedure',
      choices: [
        ['assume', 'Assume visible aspirate is adequate'],
        ['planned-handling', 'Agree on acquisition, handling and follow-up'],
        ['morphology', 'Use node appearance as the adequacy result'],
      ],
    },
  ],
  allocation: [
    {
      id: 'specimen-identity',
      label: 'Identity at specimen handoff',
      choices: [
        ['separate', 'Retain each station, node and specimen label'],
        ['pool-station', 'Pool all specimens under one station'],
        ['pool-node', 'Combine both 4R nodes under one specimen identity'],
      ],
    },
  ],
  report: [
    {
      id: 'report-conclusion',
      label: 'Overall examination conclusion',
      choices: [
        ['negative', 'Negative systematic examination'],
        ['incomplete', 'Incomplete examination with unresolved targets'],
        ['complete', 'All stations adequately assessed'],
      ],
    },
    {
      id: 'follow-up',
      label: 'Responsibility for closing the loop',
      choices: [
        ['automatic', 'Pathology will contact the team if a result is abnormal'],
        [
          'responsible-team',
          'Responsible clinical team: reconcile results, recovery and next steps',
        ],
        ['dismiss', 'Follow up the sampled stations only'],
      ],
    },
  ],
}
export const RECORD_TASK_TITLES: Record<RecordTask, string> = {
  'station-window': 'Record this model window',
  'node-description': 'Build a structured node description',
  plan: 'Plan the examination',
  adequacy: 'Reconcile the specimen endpoints',
  allocation: 'Build the specimen plan',
  report: 'Build and review the report',
}
