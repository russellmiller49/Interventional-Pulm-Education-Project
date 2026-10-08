/**
 * What this simulation is and is not, stated once, in one consistent place (F39).
 *
 * These sentences were printed open on step after step — "Every value is simulated…" on twenty
 * screens, the teaching-revision footnote on twelve — until a learner was skipping every grey
 * paragraph, the useful ones included. They are gathered here, unchanged in meaning, and rendered
 * as one disclosure at the top of every lesson step: the same place each time, one click away.
 *
 * This is the general statement only. A limit that changes how one particular figure or reading is
 * used stays beside that figure: the monitor still says it is not a product display, the readings
 * still say bedside findings are not simulated, the atrial-fibrillation trigger hold, the IABP
 * reference-contour boundary, the durable-pump estimator boundary and every case condition's class
 * are untouched and are not folded into this list.
 */

export const MCS_MODEL_LIMITS_HEADING = 'Limits of this simulation'

export const MCS_MODEL_LIMITS: readonly { readonly id: string; readonly statement: string }[] =
  Object.freeze([
    {
      id: 'simulated-values',
      statement:
        'Every value is simulated. Device estimates, modeled flow and volume, calculated pressure–flow products, and patient measurements have distinct meanings.',
    },
    {
      id: 'bedside-not-simulated',
      statement:
        'Patient examination, mentation, urine output, skin findings and lactate trends require bedside assessment; they are not simulated.',
    },
    {
      id: 'generic-representation',
      statement:
        'The monitor, the map and the controls are generic educational representations. No product display or manufacturer alarm limit is reproduced.',
    },
    {
      id: 'authored-magnitudes',
      statement:
        'Device principles follow each section’s references; response magnitudes and observation intervals are authored simulation behavior.',
    },
    {
      id: 'not-operational',
      statement:
        'Clinical device operation requires current manufacturer instructions, local protocol and the responsible mechanical-support team. No insertion, repositioning, purge, anticoagulation or alarm-limit instruction is given.',
    },
    {
      id: 'review-status',
      statement:
        'Teaching revision: September 2026 · draft for faculty review. Clinical, device and source review is not complete.',
    },
  ])
