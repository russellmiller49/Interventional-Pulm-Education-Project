import type { ScopeCommand } from '../components/scope/types'
import type { SourceRef } from '../data/sources'

/** Explicit Learn-only composition. Absent on every non-pilot lesson and Assess. */
export interface BronchLearnUnit {
  readonly id: string
  readonly heading: string
  readonly paragraphs: readonly string[]
  readonly notice?: string
  readonly sourceRefs: readonly SourceRef[]
  readonly support: 'orientation' | 'guided' | 'repeat' | 'check' | 'transfer'
  readonly orientation?: boolean
  readonly cue?: string
  readonly success?: string
  readonly demonstration?: readonly { readonly command: ScopeCommand; readonly caption: string }[]
}
