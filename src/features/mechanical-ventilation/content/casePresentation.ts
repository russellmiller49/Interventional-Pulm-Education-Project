import { mechanicalVentilationCases } from './runtimeCases'

/**
 * Presentation titles for the fifteen clinical cases.
 *
 * A case's own title names its diagnosis ("Sudden loss of compliance: tension pneumothorax"), which
 * is the answer to the question the case asks. Every surface a learner sees before the debrief —
 * the pathway accordion, the Practice picker, the pairing offered at the end of a section — names
 * the case by what the bedside shows instead. The diagnosis returns in the debrief.
 */
const presentationTitles: Readonly<Record<string, string>> = {
  'MV-01': 'Low saturation in an adult with stiff lungs on volume control',
  'MV-02': 'A scooped pressure trace and strong efforts on volume control',
  'MV-03': 'Paired breaths and rising volumes in a sedated adult',
  'MV-04': 'Deep sedation, yet efforts appear after each machine breath',
  'MV-05': 'A breathless adult whose exhalations never quite finish',
  'MV-06': 'Falling blood pressure and rising pressures in an adult with tight airways',
  'MV-07': 'A weak adult whose efforts do not always start a breath',
  'MV-08': 'More machine breaths than efforts',
  'MV-09': 'Supported breaths that end while the patient is still pulling',
  'MV-10': 'Supported breaths that keep pushing after the effort has ended',
  'MV-11': 'Uncomfortable at the start of every supported breath',
  'MV-12': 'A sedated adult whose breaths wax and wane on generous support',
  'MV-13': 'A high-pressure alarm in a ventilated adult',
  'MV-14': 'A sudden high-pressure alarm with a falling blood pressure',
  'MV-15': 'Awake, anxious and air-hungry on the ventilator',
}

export function ventilationCasePresentationTitle(caseId: string): string {
  const title = presentationTitles[caseId]
  if (!title) throw new Error(`No presentation title for case ${caseId}`)
  return title
}

{
  const missing = mechanicalVentilationCases
    .map((definition) => definition.id)
    .filter((id) => !presentationTitles[id])
  if (missing.length > 0) {
    throw new Error(`Cases without a presentation title: ${missing.join(', ')}`)
  }
  for (const id of Object.keys(presentationTitles)) {
    if (!mechanicalVentilationCases.some((definition) => definition.id === id)) {
      throw new Error(`Presentation title for unknown case ${id}`)
    }
  }
}
