/**
 * Every whitespace-only class the meaningful-string contract must refuse (P91-C4b).
 *
 * One named table, consumed by the parse-boundary matrix, the evaluator regressions, the
 * doctored custom-seed load, and the composition-generator input test, so every boundary
 * refuses the same corpus. The prior matrix claimed "non-empty meaningful strings" while
 * pinning only the empty string and a three-space note — which is exactly how a
 * three-space *dependency rule* survived it.
 */
export const BLANK_AUTHORED_STRING_CASES = [
  { name: 'the empty string', value: '' },
  { name: 'a single space', value: ' ' },
  { name: 'three ordinary spaces (the Codex reproduction)', value: '   ' },
  { name: 'a tab', value: '\t' },
  { name: 'a newline', value: '\n' },
  { name: 'mixed spaces, tabs, and newlines', value: ' \t\n ' },
] as const
