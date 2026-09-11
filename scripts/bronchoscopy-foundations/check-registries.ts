/** Citation and copy check for the shared registries (spine, control panel, grammar). */
import { SCOPE_CONTROL_PANEL } from '../../src/features/bronchoscopy-foundations/content/controlPanel'
import { BRONCH_GRAMMAR } from '../../src/features/bronchoscopy-foundations/content/grammar'
import { bronchLearnerCopyErrors } from '../../src/features/bronchoscopy-foundations/content/learnerCopy'
import { SPINE_STOPS } from '../../src/features/bronchoscopy-foundations/content/spine'
import { sourceRefErrors } from '../../src/features/bronchoscopy-foundations/data/sources'

const errors: string[] = []
for (const stop of SPINE_STOPS) {
  stop.sourceRefs.forEach((ref, i) => errors.push(...sourceRefErrors(`spine ${stop.id} ${i}`, ref)))
  for (const text of [
    stop.title,
    stop.precise,
    stop.analogy,
    stop.checklistLabel,
    ...stop.checklist,
  ]) {
    errors.push(...bronchLearnerCopyErrors(`spine ${stop.id}`, text))
  }
}
SCOPE_CONTROL_PANEL.sourceRefs.forEach((ref, i) =>
  errors.push(...sourceRefErrors(`control panel ${i}`, ref)),
)
for (const control of SCOPE_CONTROL_PANEL.controls) {
  for (const text of [control.plainName, control.changes, control.doesNotChange]) {
    errors.push(...bronchLearnerCopyErrors(`control ${control.id}`, text))
  }
}
for (const row of BRONCH_GRAMMAR) {
  row.sourceRefs.forEach((ref, i) => errors.push(...sourceRefErrors(`grammar ${row.id} ${i}`, ref)))
  for (const text of [row.see, row.lives, ...row.shortlist])
    errors.push(...bronchLearnerCopyErrors(`grammar ${row.id}`, text))
}
console.log(errors.length ? errors.join('\n') : 'registries clean')
