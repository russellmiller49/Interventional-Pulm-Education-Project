import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'

import { translateHandoffText, type HandoffRawTranslator } from './handoff-core'

const visibleStringProps = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'ariaLabel',
  'backLabel',
  'body',
  'caption',
  'definition',
  'description',
  'diagnosisTheme',
  'emptyText',
  'explanation',
  'feedback',
  'eyebrow',
  'heading',
  'help',
  'hint',
  'helperText',
  'imageAlt',
  'instruction',
  'kicker',
  'label',
  'leftTitle',
  'message',
  'neutralVignette',
  'note',
  'overview',
  'placeholder',
  'prompt',
  'question',
  'revealLabel',
  'revealCaption',
  'rightTitle',
  'shortTitle',
  'sourceFindingLabel',
  'sourceRecordClass',
  'statement',
  'stem',
  'subheading',
  'subtitle',
  'summary',
  'tagline',
  'teachingPearl',
  'teachingPoint',
  'text',
  'title',
  'tooltip',
])

const visibleStructuredProps = new Set([
  ...visibleStringProps,
  'choices',
  'findings',
  'headers',
  'howToUse',
  'items',
  'learningObjectives',
  'leftItems',
  'objectives',
  'options',
  'questions',
  'rightItems',
  'rows',
  'steps',
])

function localizeVisibleValue(t: HandoffRawTranslator, value: unknown): unknown {
  if (typeof value === 'string') {
    return translateHandoffText(t, value)
  }

  if (Array.isArray(value)) {
    let changed = false
    const localized = value.map((item) => {
      const nextItem = localizeVisibleValue(t, item)
      changed ||= nextItem !== item
      return nextItem
    })
    return changed ? localized : value
  }

  if (!value || typeof value !== 'object' || isValidElement(value)) {
    return value
  }

  let changed = false
  const localized: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  }

  for (const [key, item] of Object.entries(localized)) {
    if (!visibleStructuredProps.has(key)) {
      continue
    }
    const nextItem = localizeVisibleValue(t, item)
    changed ||= nextItem !== item
    localized[key] = nextItem
  }

  return changed ? localized : value
}

function localizeNode(t: HandoffRawTranslator, node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return translateHandoffText(t, node)
  }

  if (Array.isArray(node)) {
    let changed = false
    const localized = node.map((child) => {
      const nextChild = localizeNode(t, child)
      changed ||= nextChild !== child
      return nextChild
    })
    return changed ? localized : node
  }

  if (!isValidElement(node)) {
    return node
  }

  const element = node as ReactElement<Record<string, unknown>>
  const props = element.props

  if (props['data-no-handoff-translate'] === true) {
    return node
  }

  let changed = false
  const nextProps: Record<string, unknown> = {}

  if ('children' in props) {
    const nextChildren = localizeNode(t, props.children as ReactNode)
    if (nextChildren !== props.children) {
      nextProps.children = nextChildren
      changed = true
    }
  }

  for (const propName of visibleStructuredProps) {
    if (!(propName in props)) {
      continue
    }
    const nextValue = localizeVisibleValue(t, props[propName])
    if (nextValue !== props[propName]) {
      nextProps[propName] = nextValue
      changed = true
    }
  }

  return changed ? cloneElement(element, nextProps) : node
}

/**
 * Localizes hardcoded learner-facing copy while leaving IDs, values, hrefs,
 * routes, URLs, numeric values, and component logic untouched.
 */
export function HandoffContent({ children }: { children: ReactNode }) {
  const t = useTranslations('handoff') as unknown as HandoffRawTranslator
  return localizeNode(t, children)
}
