import type { StepSequence } from '@/features/skill-lab/engine/types'

/**
 * Ordered procedural workflows for the Pleuroscopy Practice section. Steps are
 * authored in the correct order; the UI shuffles them. Sequences describe
 * recognized medical-thoracoscopy technique for simulation teaching only.
 *
 * References: bts-lat-2010 (LAT technique), bts-procedures-2023 (US, safety),
 * tapps-2020 / talc-safety-2007 (poudrage).
 */
export const pleuroscopySequences: StepSequence[] = [
  {
    id: 'entry-technique',
    title: 'Single-port pleuroscopy entry',
    prompt: 'Order the steps for gaining safe access to the pleural space under local anaesthetic.',
    steps: [
      {
        id: 'position',
        label: 'Position the patient in the lateral decubitus position, affected side up',
        detail: 'Exposes the access site and lets the lung and fluid settle favourably.',
      },
      {
        id: 'ultrasound',
        label: 'Confirm a safe intercostal entry site with ultrasound',
        detail:
          'Identifies an interspace with fluid or an accessible space and avoids the diaphragm and organs.',
      },
      {
        id: 'anaesthetic',
        label: 'Infiltrate local anaesthetic down to the parietal pleura',
        detail: 'Anaesthetize the track, including the sensitive parietal pleura, before incision.',
      },
      {
        id: 'incision',
        label: 'Make the incision and bluntly dissect to the pleura over a rib',
        detail:
          'Blunt dissection over the top of a rib avoids the intercostal neurovascular bundle.',
      },
      {
        id: 'pneumothorax',
        label: 'Enter the pleura and allow a controlled pneumothorax so the lung falls away',
        detail:
          'Letting air in drops the lung from the chest wall, creating room and protecting it from the trocar.',
      },
      {
        id: 'cannula',
        label: 'Insert the cannula and pass the scope to confirm pleural access',
        detail:
          'The scope confirms you are in the pleural space before any biopsy or insufflation.',
      },
    ],
    rationale:
      'Access is built up in a fixed order — position, image, anaesthetize, dissect over a rib, let the lung fall away, then confirm with the scope — so the lung is protected and the neurovascular bundle is avoided before any instrument enters.',
  },
  {
    id: 'talc-poudrage',
    title: 'Talc poudrage pleurodesis workflow',
    prompt: 'Order the steps for talc poudrage after inspection and biopsy.',
    steps: [
      {
        id: 'complete-survey',
        label: 'Complete the systematic pleural survey and take parietal biopsies',
        detail: 'Diagnosis and staging come first; poudrage is done once sampling is finished.',
      },
      {
        id: 'drain-fluid',
        label: 'Drain residual fluid and confirm the lung can re-expand',
        detail:
          'Poudrage needs pleural apposition — a trapped lung that will not re-expand is a poor pleurodesis candidate.',
      },
      {
        id: 'insufflate',
        label: 'Insufflate graded (large-particle) talc evenly over the pleural surfaces',
        detail:
          'Even distribution of graded talc promotes uniform symphysis while limiting systemic particle spread.',
      },
      {
        id: 'drain-place',
        label: 'Place the chest drain under direct vision',
        detail:
          'A well-positioned drain evacuates air and fluid so the pleural surfaces stay apposed.',
      },
      {
        id: 'post-manage',
        label: 'Manage controlled drainage and monitor for complications',
        detail:
          'Controlled drainage supports apposition while watching for re-expansion pulmonary oedema and air leak.',
      },
    ],
    rationale:
      'Poudrage follows diagnosis: survey and biopsy first, confirm the lung re-expands (apposition is required), distribute graded talc evenly, then secure a drain and manage it in a controlled way so the surfaces stay apposed.',
  },
]
