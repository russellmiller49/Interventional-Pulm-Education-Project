import imagesData from '@/data/creative-commons-images.json'
import {
  boardReviewCategoryLabels,
  boardReviewChapters,
  type BoardReviewCategory,
} from '@/data/board-review'

export interface SiteSearchResult {
  title: string
  description: string
  href: string
  section: string
  type: 'page' | 'board-review' | 'resource' | 'image-category'
  keywords?: readonly string[]
}

interface CreativeCommonsImageData {
  Category: string
  Image_url: string
  'Image Description': string
  article_title: string
  article_url: string
}

const creativeCommonsCategorySlugs: Record<string, string> = {
  '3D reconstructions': '3d-reconstructions',
  Imaging: 'imaging',
  Pathology: 'pathology',
  Miscellaneous: 'miscellaneous',
  'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)': 'peripheral-bronchoscopy',
  Surgery: 'surgery',
  'Therapeutic Bronchoscopy': 'therapeutic-bronchoscopy',
  Tracheostomy: 'tracheostomy',
  'EBUS/EUS': 'ebus-eus',
  Radiotherapy: 'radiotherapy',
  'Bronchoscopic Lung Volume Reduction': 'bronchoscopic-lung-volume-reduction',
  Equipment: 'equipment',
  'Pleural Procedures': 'pleural-procedures',
}

const staticResults: SiteSearchResult[] = [
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
    title: 'SoCal EBUS Course',
    description:
      'Fellow-prep course with lectures, station mapping, knobology, and 3D anatomy resources.',
    href: '/socal-ebus-course',
    section: 'Training',
    type: 'page',
    keywords: ['ebus', 'course', 'stations', 'fellows', 'knobology'],
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

const imageCategoryResults: SiteSearchResult[] = Object.entries(
  (imagesData as CreativeCommonsImageData[]).reduce<Record<string, CreativeCommonsImageData[]>>(
    (acc, image) => {
      acc[image.Category] = acc[image.Category] ?? []
      acc[image.Category].push(image)
      return acc
    },
    {},
  ),
).map(([category, images]) => ({
  title: `${category} images`,
  description: `${images.length} Creative Commons medical images in the ${category} collection.`,
  href: `/resources/creative-commons/${creativeCommonsCategorySlugs[category] ?? 'search'}`,
  section: 'Creative Commons Images',
  type: 'image-category',
  keywords: images
    .slice(0, 12)
    .flatMap((image) => [image['Image Description'], image.article_title, image.Category]),
}))

const searchIndex: SiteSearchResult[] = [
  ...staticResults,
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
