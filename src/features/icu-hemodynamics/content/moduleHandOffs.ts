/**
 * Where the course hands the learner on to another critical care module.
 *
 * Round 3 of the critical care plan (owner, 2026-11-10): the five modules are one course. This
 * module's last section ended on "Open the applied case" and said nothing of where its readings
 * are used next. The line names no finding and no answer; it is shown on a finished section.
 */
export const HEMODYNAMICS_NEXT_MODULE = {
  href: '/mechanical-circulatory-support',
  moduleTitle: 'Mechanical Circulatory Support',
  line: 'Where these readings are used next: a patient on an IABP, an Impella or an LVAD is read with the pressures, cardiac output and shock profiles from this module.',
} as const
