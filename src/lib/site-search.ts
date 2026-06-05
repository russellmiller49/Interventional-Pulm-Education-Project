import {
  boardReviewCategoryLabels,
  boardReviewChapters,
  type BoardReviewCategory,
} from '@/data/board-review'
import { publicEbusTrainingModules } from '@/data/ebus-training'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { listCreativeCommonsCategories } from '@/lib/creative-commons'

export interface SiteSearchResult {
  title: string
  description: string
  href: string
  section: string
  type: 'page' | 'board-review' | 'resource' | 'image-category'
  keywords?: readonly string[]
}

const allStaticResults: SiteSearchResult[] = [
  {
    title: 'Resource Library',
    description:
      'Tabbed collection for Creative Commons medical images and clinician-builder learning guides.',
    href: '/resources',
    section: 'Resources',
    type: 'page',
    keywords: ['resources', 'guides', 'medical images', 'vibe coding', 'clinician builders'],
  },
  {
    title: 'Creative Commons Medical Images',
    description:
      'Curated open-license medical figures from peer-reviewed publications for educational use.',
    href: '/resources/creative-commons',
    section: 'Resources',
    type: 'resource',
    keywords: ['images', 'figures', 'creative commons', 'medical images', 'presentations'],
  },
  {
    title: 'Vibe Coding for Clinicians',
    description:
      'Beginner-friendly guide for clinicians learning AI-assisted coding, IDEs, Git, and agentic workflows.',
    href: '/resources/vibe-coding-for-clinicians',
    section: 'Resources',
    type: 'resource',
    keywords: ['ai coding', 'codex', 'prompting', 'github', 'ide', 'clinicians'],
  },
  {
    title: 'IP Board Prep',
    description:
      'Interactive board review chapters for interventional pulmonology exam preparation.',
    href: '/board-prep',
    section: 'Learning',
    type: 'page',
    keywords: ['board review', 'exam', 'chapters', 'study', 'questions'],
  },
  {
    title: 'EBUS Training',
    description:
      'Open EBUS knobology, mediastinal station, and simulator modules without course participant lockout.',
    href: '/ebus-training',
    section: 'EBUS Training',
    type: 'page',
    keywords: ['ebus', 'knobology', 'stations', 'mediastinal', 'simulator', 'ultrasound'],
  },
  {
    title: 'TNM-9 Staging',
    description:
      'Standalone lung cancer staging module with descriptor reference, stage grouping, N map, and cases.',
    href: '/tnm-9-staging',
    section: 'Staging',
    type: 'page',
    keywords: ['tnm', 'tnm 9', 'tnm-9', 'lung cancer staging', 'stage grouping', 'n map'],
  },
  {
    title: 'Southern California EBUS Course Participant Portal',
    description:
      'Participant portal for the Southern California EBUS Course with lectures, surveys, tests, progress tracking, and course-specific materials.',
    href: '/socal-ebus-course',
    section: 'Training',
    type: 'page',
    keywords: ['socal ebus', 'southern california', 'course', 'participants', 'lectures'],
  },
  {
    title: 'Bronch Navigation Trainer',
    description:
      'CT-to-bronchoscope navigation simulator with branch decisions, target paths, and virtual scope views.',
    href: '/bronch-navigation-trainer',
    section: 'Simulation',
    type: 'page',
    keywords: ['bronchoscopy', 'navigation', 'ct', 'airway', 'nodule', 'simulation'],
  },
  {
    title: 'Pleural Fluid Analysis',
    description:
      'Advanced module for interpreting pleural fluid results with ranked differentials, quiz mode, clinical context, Light criteria, pseudoexudates, rare diseases, and targeted testing.',
    href: '/pleural-procedures/pleural-fluid-analysis',
    section: 'Pleural Procedures',
    type: 'page',
    keywords: [
      'pleural fluid',
      'pleural effusion',
      'lights criteria',
      'pseudoexudate',
      'thoracentesis',
      'pfa',
      'chylothorax',
      'empyema',
      'yellow nail syndrome',
      'urinothorax',
      'bilothorax',
    ],
  },
  {
    title: 'Interactive 3D Anatomy Viewer',
    description:
      'Explore airway structures, vasculature, and lobar relationships with interactive anatomy tools.',
    href: '/learn/anatomy',
    section: 'Learning',
    type: 'page',
    keywords: ['3d anatomy', 'airway', 'models', 'viewer', 'segments'],
  },
  {
    title: 'FluoroView',
    description:
      'Browser-based fluoroscopy simulator for airway orientation, C-arm sweeps, and segmental anatomy.',
    href: '/fluoroview',
    section: 'Simulation',
    type: 'page',
    keywords: ['fluoroscopy', 'simulation', 'c-arm', 'airway', 'navigation'],
  },
  {
    title: 'IP Registry',
    description:
      'Procedure-suite registry concept for interventional pulmonology workflow and quality tracking.',
    href: '/ip-registry',
    section: 'Tools',
    type: 'page',
    keywords: ['registry', 'procedure', 'quality', 'documentation', 'analytics'],
  },
]

const staticResults = allStaticResults.filter((item) => isVisibleModulePath(item.href))

const ebusTrainingResults: SiteSearchResult[] = publicEbusTrainingModules.map((module) => ({
  title: module.title,
  description: module.description,
  href: module.href,
  section: 'EBUS Training',
  type: 'page',
  keywords: module.keywords,
}))

const vibeGuideSections: SiteSearchResult[] = [
  {
    title: 'What vibe coding means for physicians',
    description:
      'How clinicians can use AI coding assistants while keeping clinical judgment and review in the loop.',
    href: '/resources/vibe-coding-for-clinicians#start',
    section: 'Vibe Coding Guide',
    type: 'resource',
    keywords: ['vibe coding', 'ai assistant', 'physicians', 'clinical architect'],
  },
  {
    title: 'Tool stack chooser',
    description:
      'Pick between chat assistants, notebooks, Streamlit, React, IDEs, and coding agents by project goal.',
    href: '/resources/vibe-coding-for-clinicians#tool-stack',
    section: 'Vibe Coding Guide',
    type: 'resource',
    keywords: ['tools', 'streamlit', 'react', 'cursor', 'windsurf', 'codex'],
  },
  {
    title: 'GitHub basics for physicians',
    description:
      'Plain-English guide to repositories, commits, branches, pull requests, issues, and project checkpoints.',
    href: '/resources/vibe-coding-for-clinicians#github',
    section: 'Vibe Coding Guide',
    type: 'resource',
    keywords: ['git', 'github', 'commit', 'branch', 'repository'],
  },
  {
    title: 'Prompt library for clinicians',
    description:
      'Copy-ready planning, debugging, workbench, research dashboard, and teaching app prompts.',
    href: '/resources/vibe-coding-for-clinicians#prompts',
    section: 'Vibe Coding Guide',
    type: 'resource',
    keywords: ['prompt', 'debugging', 'planning', 'teaching app', 'research app'],
  },
  {
    title: 'Safety and governance checklist',
    description:
      'Privacy, security, validation, regulatory, and pre-share guardrails for healthcare software prototypes.',
    href: '/resources/vibe-coding-for-clinicians#safety',
    section: 'Vibe Coding Guide',
    type: 'resource',
    keywords: ['safety', 'privacy', 'phi', 'security', 'validation', 'governance'],
  },
]

const boardReviewResults: SiteSearchResult[] = boardReviewChapters.map((chapter) => ({
  title: chapter.title,
  description: chapter.summary || chapter.description,
  href: `/board-prep/${chapter.slug}`,
  section: boardReviewCategoryLabels[chapter.category as BoardReviewCategory],
  type: 'board-review',
  keywords: [...chapter.tags, ...chapter.focus, ...chapter.examDomains],
}))

const imageCategoryResults: SiteSearchResult[] = listCreativeCommonsCategories().map(
  (category) => ({
    title: `${category.name} images`,
    description: `${category.count} Creative Commons medical images in the ${category.name} collection.`,
    href: `/resources/creative-commons/${category.slug}`,
    section: 'Creative Commons Images',
    type: 'image-category',
    keywords: [category.name],
  }),
)

const searchIndex: SiteSearchResult[] = [
  ...staticResults,
  ...ebusTrainingResults,
  ...vibeGuideSections,
  ...boardReviewResults,
  ...imageCategoryResults,
]

export function getFeaturedSearchResults() {
  return staticResults.slice(0, 6)
}

export function searchSite(rawQuery: string, limit = 60) {
  const query = normalize(rawQuery)
  const terms = query.split(/\s+/).filter(Boolean)

  if (!terms.length) {
    return getFeaturedSearchResults()
  }

  return searchIndex
    .map((item) => ({ item, score: scoreItem(item, query, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item)
}

function scoreItem(item: SiteSearchResult, query: string, terms: string[]) {
  const title = normalize(item.title)
  const description = normalize(item.description)
  const section = normalize(item.section)
  const keywords = normalize((item.keywords ?? []).join(' '))
  const haystack = `${title} ${description} ${section} ${keywords}`

  let score = 0

  if (title === query) score += 80
  if (title.includes(query)) score += 36
  if (section.includes(query)) score += 18
  if (description.includes(query)) score += 12
  if (keywords.includes(query)) score += 18

  for (const term of terms) {
    if (title.includes(term)) score += 10
    if (section.includes(term)) score += 5
    if (description.includes(term)) score += 3
    if (keywords.includes(term)) score += 4
    if (!haystack.includes(term)) score -= 2
  }

  return score
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
