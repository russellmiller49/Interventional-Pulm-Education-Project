/**
 * Shared types for the Learn → Practice → Assess module template.
 *
 * The flagship Pleural Ultrasound module is the first consumer; other pleural
 * modules adopt the same shapes so the shell (header + nav), the Learn renderer,
 * the assessment wrapper, and cross-module progress all stay consistent.
 */

export type ModuleSectionKey = 'learn' | 'practice' | 'assessment'

export interface ModuleNavItem {
  href: string
  title: string
  description: string
}

/** A single image used to teach inside a Learn block. */
export interface LearnFigure {
  src: string
  /** Neutral alt text — never leak the diagnostic label here. */
  alt: string
  /** Teaching caption: what to look for in the image. */
  caption: string
  attribution?: string
  sourceUrl?: string
  license?: string
}

/**
 * One unit of didactic teaching. `level: 'advanced'` blocks render inside the
 * collapsible "Go deeper" area; everything else is core (always visible).
 */
export interface LearnBlock {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  figure?: LearnFigure
  level?: 'core' | 'advanced'
}

/** Pre-fetched board-chapter prose, passed from a server component into Learn. */
export interface BoardDeepDiveSection {
  id: string
  title: string
  content: string
}
