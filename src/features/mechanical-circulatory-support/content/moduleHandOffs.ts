/**
 * Where a section hands the learner on to another critical care module.
 *
 * Round 3 of the critical care plan (owner, 2026-11-10): the five modules are one course, and the
 * natural hand-offs between them are links, not something the learner has to know to look for.
 * Section 2 compares the three devices this module teaches; ECMO is the support it leaves to its
 * own module, and until this the lesson named it only in one answer's feedback.
 *
 * The line is shown on the section's last task. It names no finding and no answer, and the
 * section's own deny patterns are run against it (`module-hand-offs.test.tsx`).
 */
export interface McsModuleHandOff {
  readonly sectionId: string
  /** Site path of the module handed on to. */
  readonly href: string
  readonly moduleTitle: string
  readonly line: string
}

export const mcsModuleHandOffs: readonly McsModuleHandOff[] = [
  {
    sectionId: 'mcs-foundations-mechanisms',
    href: '/cardiohelp-ecmo',
    moduleTitle: 'Cardiohelp ECMO',
    line: 'ECMO is a fourth kind of support, through a circuit outside the body. It has its own module.',
  },
]

export function mcsModuleHandOff(sectionId: string): McsModuleHandOff | null {
  return mcsModuleHandOffs.find((entry) => entry.sectionId === sectionId) ?? null
}
