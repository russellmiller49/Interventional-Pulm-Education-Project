/**
 * What an Explain step opens, where a section would otherwise open everything at once.
 *
 * Measured in November 2026, the four application sections' Explain steps ran 1,400 to 2,400
 * visible words: every block after the commitment stood open together. Nothing here removes a
 * sentence. It names what folds under its own heading, by section, so the choice is data a
 * clinician can read and change rather than a rule buried in a component.
 */

/**
 * The live panel's sub-sections that fold on the Explain step. Only parts that are neither the
 * section's stated idea nor its primary target fold; a section with no entry keeps its whole
 * panel open.
 *
 * - IABP limits: the idea is a correct device that is still insufficient, read on the response
 *   trend. The note on what the screen does not model folds.
 * - Impella suction: the idea is what two pump numbers add up to, read on the right-sided
 *   pathway. Right-sided filling with the pulsatility ratio, and the alarm list, fold; each folded
 *   heading keeps its live value.
 * - LVAD alarms and device selection: every open part is the idea or the target, so nothing folds.
 */
export const MCS_EXPLAIN_FOLDED_PANEL_SECTIONS: Readonly<Record<string, readonly string[]>> = {
  'iabp-efficacy-limits': ['efficacy-unmodeled'],
  'impella-suction-purge-rv': ['rv-papi', 'rv-alarms'],
}

/**
 * The sections whose Explain step prints the whole diagnostic table. It is whole where it first
 * stands open (IABP limits) and in the capstone, where reading across its rows is the task. The
 * other sections print their own highlighted rows, with the whole table one press away.
 */
export const MCS_WHOLE_GRAMMAR_TABLE_SECTIONS: readonly string[] = [
  'iabp-efficacy-limits',
  'mcs-device-selection-integration',
]
