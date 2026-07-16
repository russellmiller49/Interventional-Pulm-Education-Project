export interface MechanismScenarioLabCopy {
  eyebrow: string
  draftBadge: string
  reviewedBadge: string
  architectureLegend: string
  architectureCoverageLabel: string
  architectureCompletedLabel: string
  architecturePendingInstruction: string
  predictionLegend: string
  commitButton: string
  recommitButton: string
  committedLabel: string
  phaseLabel: string
  lockedPhaseLabel: string
  textEquivalentLabel: string
  inspectLabel: string
  observationLegend: string
  observationInstruction: string
  previousButton: string
  advanceButton: string
  completeArchitectureButton: string
  completeButton: string
  completedButton: string
  restartButton: string
  consequenceLabel: string
  outcomeDomainsLabel: string
  evidenceBoundaryLabel: string
  evidenceSourcesLabel: string
  constructionLabel: string
  behaviorLabel: string
  deploymentLabel: string
  notModeledLabel: string
  disclaimer: string
}

export const mechanismScenarioLabEnglishCopy: MechanismScenarioLabCopy = {
  eyebrow: 'Clinical mechanism scenario',
  draftBadge: 'Draft · clinical review required',
  reviewedBadge: 'Clinically reviewed',
  architectureLegend: 'Architecture family',
  architectureCoverageLabel: 'Required architecture coverage',
  architectureCompletedLabel: 'Completed',
  architecturePendingInstruction:
    'Complete the full prediction-to-consequence sequence for every architecture family.',
  predictionLegend: 'Commit your prediction',
  commitButton: 'Commit and reveal',
  recommitButton: 'Recommit and reveal',
  committedLabel: 'Committed interpretation',
  phaseLabel: 'Scenario phase',
  lockedPhaseLabel: 'Locked until prediction',
  textEquivalentLabel: 'Static text equivalent',
  inspectLabel: 'What to inspect',
  observationLegend: 'Required contributor check',
  observationInstruction: 'Confirm every item before advancing.',
  previousButton: 'Previous phase',
  advanceButton: 'Advance scenario',
  completeArchitectureButton: 'Complete architecture and continue',
  completeButton: 'Complete scenario',
  completedButton: 'Scenario completed',
  restartButton: 'Restart scenario',
  consequenceLabel: 'Consequence and debrief',
  outcomeDomainsLabel: 'Outcome domains',
  evidenceBoundaryLabel: 'Evidence boundary',
  evidenceSourcesLabel: 'Evidence used for this authored scene',
  constructionLabel: 'Construction',
  behaviorLabel: 'Motion to inspect',
  deploymentLabel: 'Deployment stages',
  notModeledLabel: 'This scene does not model',
  disclaimer:
    'For education and device-mechanics comparison only. Actual fit, deployment, surveillance, and outcomes depend on patient anatomy, disease, device model, current manufacturer instructions, procedural conditions, local expertise, and clinical judgment.',
}
