import type { CrrtOperationalRun, CrrtLearnOperation, OperationalCommand } from './operationalModel'

/** A Learn projection of unchanged CRRT-14. No case clone, scoring or physiological model. */
export function nextCrrtIntegrationCommand(
  run: CrrtOperationalRun,
  operation?: CrrtLearnOperation,
): OperationalCommand | null {
  if (run.id !== 'integration') return null
  const session = run.session
  const now = session.simulation.simulationTimeSeconds
  const done = (suffix: string) => session.performedInterventionIds.includes(`crrt14-${suffix}`)
  const perform = (suffix: string, label: string, explanation: string): OperationalCommand => ({
    id: suffix,
    label,
    explanation,
    action: { type: 'PERFORM_INTERVENTION', interventionId: `crrt14-${suffix}` },
  })
  const observe = (until: number, label: string, explanation: string): OperationalCommand => ({
    id: `observe-${until}`,
    label,
    explanation,
    action: { type: 'ADVANCE_TIME', seconds: until - now },
  })
  if (operation === 'integration-entry') {
    if (!done('assess-patient-device'))
      return perform(
        'assess-patient-device',
        'Review patient and treatment',
        'Record assessment of the starting context. Assessment changes no physiology or flow.',
      )
    if (!done('advance-to-pattern'))
      return perform(
        'advance-to-pattern',
        'Record the first 30 minutes',
        'Advance this existing case exactly to its first event. Compare the new readings with the starting record.',
      )
  }
  if (operation === 'integration-inspect' && done('advance-to-pattern')) {
    if (!done('inspect-access-path'))
      return perform(
        'inspect-access-path',
        'Record the selected circuit inspection',
        'Perform the existing case inspection. This is an authored observation, not an animated physical examination.',
      )
    if (!done('pause-treatment'))
      return perform(
        'pause-treatment',
        'Pause modeled delivery',
        'This explicit case action stops delivery. The generic alert did not automatically stop the pumps.',
      )
    if (now < 2400)
      return observe(
        2400,
        'Record 10 minutes paused',
        'Observe the interruption while external patient inputs and outputs continue.',
      )
  }
  if (
    operation === 'integration-action' &&
    crrtIntegrationTaskComplete(run, 'integration-inspect') &&
    run.integrationPlan
  ) {
    if (run.integrationPlan === 'correct') {
      if (!done('reposition-access'))
        return perform(
          'reposition-access',
          'Apply the verified case correction',
          'Use the existing case action for the verified regional restriction. No catheter maneuver or clamp sequence is taught; treatment remains paused.',
        )
      if (!done('resume-treatment'))
        return perform(
          'resume-treatment',
          'Resume this corrected simulation',
          'Resume is permitted here only after the modeled pause and correction. Actual patient/device resumption requires its own safety verification and protocol.',
        )
    }
    if (now < 3600)
      return observe(
        3600,
        'Record to 1 hour',
        run.integrationPlan === 'defer'
          ? 'The case stays paused while help is sought. This records additional downtime, not a clinical recommendation to wait.'
          : 'Record 20 minutes after resumption. Read the new profile and actual delivery; do not erase the preceding interruption.',
      )
  }
  if (
    operation === 'integration-reassess' &&
    run.integrationPlan === 'correct' &&
    now === 3600 &&
    !done('confirm-restored-delivery')
  )
    return perform(
      'confirm-restored-delivery',
      'Record reassessment of this run',
      'Confirm the displayed profile and delivery; clinical reassessment includes the patient, cause, circuit and recurrence.',
    )
  return null
}

export function crrtIntegrationTaskComplete(
  run: CrrtOperationalRun,
  operation?: CrrtLearnOperation,
): boolean {
  if (run.id !== 'integration') return false
  const session = run.session
  const now = session.simulation.simulationTimeSeconds
  const done = (suffix: string) => session.performedInterventionIds.includes(`crrt14-${suffix}`)
  switch (operation) {
    case 'integration-entry':
    case 'integration-profile':
      return done('advance-to-pattern')
    case 'integration-inspect':
    case 'integration-decision':
      return done('inspect-access-path') && done('pause-treatment') && now >= 2400
    case 'integration-action':
    case 'integration-balance':
      return (
        now === 3600 &&
        (run.integrationPlan === 'defer'
          ? session.simulation.device.deliveryState === 'paused'
          : run.integrationPlan === 'correct' &&
            done('resume-treatment') &&
            session.simulation.device.deliveryState === 'running')
      )
    case 'integration-reassess':
      return now === 3600 && (run.integrationPlan === 'defer' || done('confirm-restored-delivery'))
    default:
      return false
  }
}
