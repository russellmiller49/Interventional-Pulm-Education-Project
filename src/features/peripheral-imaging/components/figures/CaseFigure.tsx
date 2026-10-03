'use client'

import { caseFigureFor, type CaseFigureDeclaration } from '../../content/caseFigures'
import { DtsAbsenceFigure } from './DtsAbsenceFigure'
import { SamplingWindowCaseFigure } from './SamplingWindowCaseFigure'
import { StandingPositionsPlan } from './StandingPositionsPlan'

type CaseFigureComponent = (props: {
  readonly declaration: CaseFigureDeclaration
  readonly revealed: boolean
}) => React.ReactNode

/** Every declared case figure has exactly one renderer; `case-figures.test.ts` holds the two lists equal. */
export const CASE_FIGURE_RENDERERS: Readonly<Record<string, CaseFigureComponent>> = {
  'practice:dts-interpretation-practice-1:figure': DtsAbsenceFigure,
  'capstone:case-5-v2:figure': SamplingWindowCaseFigure,
  'practice:staff-protection-practice-1:figure': StandingPositionsPlan,
}

/**
 * The figure a case declares, if any. `revealed` is true once the learner has opened the explanation
 * or checked an answer; it decides only which readouts show, never the figure's state.
 */
export function CaseFigure({
  caseKind,
  caseId,
  revealed,
}: {
  readonly caseKind: 'practice' | 'integrated'
  readonly caseId: string
  readonly revealed: boolean
}) {
  const declaration = caseFigureFor(caseKind, caseId)
  if (!declaration) return null
  const Renderer = CASE_FIGURE_RENDERERS[declaration.identity]
  return Renderer ? <Renderer declaration={declaration} revealed={revealed} /> : null
}
