import {
  boardReviewCategoryLabels,
  boardReviewChapters,
  type BoardReviewCategory,
} from '@/data/board-review'
import { allEbusTrainingModules } from '@/data/ebus-training'
import { localizeSearchText } from '@/i18n/handoff-search'
import type { ActiveLocale } from '@/i18n/locale'
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

interface SiteSearchOptions {
  canViewDrafts?: boolean
  locale?: ActiveLocale
}

const localizedSearchOverrides: Partial<
  Record<
    ActiveLocale,
    Record<
      string,
      Partial<Pick<SiteSearchResult, 'description' | 'keywords' | 'section' | 'title'>>
    >
  >
> = {
  es: {
    '/resources': {
      title: 'Biblioteca de recursos',
      description:
        'Colección con pestañas de imágenes médicas Creative Commons y guías para clínicos constructores.',
      section: 'Recursos',
      keywords: ['recursos', 'guías', 'imágenes médicas', 'clinicos', 'docencia'],
    },
    '/resources/creative-commons': {
      title: 'Imágenes médicas Creative Commons',
      description:
        'Figuras médicas de licencia abierta de publicaciones revisadas por pares para uso educativo.',
      section: 'Recursos',
      keywords: ['imágenes', 'figuras', 'creative commons', 'presentaciones'],
    },
    '/board-prep': {
      title: 'Preparación IP Board',
      description:
        'Capítulos interactivos de repaso para preparación del examen de neumología intervencionista.',
      section: 'Aprendizaje',
      keywords: ['repaso', 'examen', 'capítulos', 'estudio', 'preguntas'],
    },
    '/journal-club-podcasts': {
      title: 'Podcasts de journal club',
      description:
        'Discusiones de audio sobre artículos de neumología intervencionista en inglés, español, mandarín, árabe y coreano.',
      section: 'Aprendizaje',
      keywords: ['podcast', 'journal club', 'artículos', 'español', 'mandarín'],
    },
    '/ebus-training': {
      title: 'Formación EBUS',
      description: 'Módulos abiertos de knobology, estaciones mediastínicas y simulador EBUS.',
      section: 'Formación EBUS',
      keywords: ['ebus', 'ultrasonido', 'mediastino', 'estaciones', 'simulador'],
    },
    '/tnm-9-staging': {
      title: 'Estadificación TNM-9',
      description:
        'Módulo independiente de estadificación de cáncer de pulmón con descriptores, grupos de estadio, mapa N y casos.',
      section: 'Estadificación',
      keywords: ['tnm', 'cáncer de pulmón', 'estadificación', 'mapa n'],
    },
    '/bronch-navigation-trainer': {
      title: 'Entrenador de navegación bronquial',
      description:
        'Simulador de navegación de TC a broncoscopio con decisiones de ramas, rutas objetivo y vistas virtuales.',
      section: 'Simulación',
      keywords: ['broncoscopía', 'navegación', 'tc', 'vía aérea', 'simulación'],
    },
    '/thermal-ablation': {
      title: 'Módulos interactivos de ablación térmica',
      description:
        'Física del láser, densidad de potencia, formas de onda de electrocauterio en una consola ERBE VIO 3 simulada, APC y seguridad contra incendios de la vía aérea.',
      section: 'Simulación',
      keywords: ['ablación térmica', 'láser', 'electrocauterio', 'apc', 'vio 3', 'incendio'],
    },
    '/peripheral-ablation': {
      title: 'Ablación de tumores pulmonares periféricos',
      description:
        'Física energía–tejido de RFA, microondas, crioablación y campo eléctrico pulsado (PEF, no térmico); simulador de zona de ablación con efecto sumidero de calor y el margen de 5 mm; confirmación de instrumento en la lesión; selección de modalidad y vía.',
      section: 'Simulación',
      keywords: [
        'ablación periférica',
        'rfa',
        'radiofrecuencia',
        'microondas',
        'crioablación',
        'campo eléctrico pulsado',
        'pef',
        'electroporación',
        'bola de hielo',
        'sumidero de calor',
        'margen de ablación',
      ],
    },
    '/pleural-procedures': {
      title: 'Procedimientos pleurales',
      description:
        'Enfermedad pleural, reconocimiento ecográfico, análisis de líquido pleural, neumotórax y drenajes.',
      section: 'Procedimientos pleurales',
      keywords: ['pleura', 'pleural', 'derrame', 'toracocentesis', 'ecografía', 'neumotórax'],
    },
    '/tracheostomy': {
      title: 'Laboratorio de Traqueostomía',
      description:
        'Anatomía 3D, mecánica del manguito, selección de tubos, cuidados, rescate de emergencias y preparación para la decanulación.',
      section: 'Vía aérea',
      keywords: ['traqueostomía', 'manguito', 'válvula fonatoria', 'decanulación', 'succión'],
    },
    '/learn/anatomy': {
      title: 'Visor anatómico interactivo 3D',
      description:
        'Explora estructuras de vía aérea, vasculatura y relaciones lobares con herramientas interactivas.',
      section: 'Aprendizaje',
      keywords: ['anatomía', 'vía aérea', 'modelos', 'segmentos'],
    },
  },
  'zh-CN': {
    '/resources': {
      title: '资源库',
      description: 'Creative Commons 医学图像和临床构建者学习指南的标签式集合。',
      section: '资源',
      keywords: ['资源', '指南', '医学图像', '教学'],
    },
    '/resources/creative-commons': {
      title: 'Creative Commons 医学图像',
      description: '来自同行评议出版物的开放许可医学图像，用于教育场景。',
      section: '资源',
      keywords: ['图像', '医学图像', 'figures', 'creative commons'],
    },
    '/board-prep': {
      title: 'IP Board 备考',
      description: '用于介入肺病学考试准备的交互式复习章节。',
      section: '学习',
      keywords: ['复习', '考试', '章节', '学习', '题库'],
    },
    '/journal-club-podcasts': {
      title: 'Journal Club 播客',
      description: '英语、西班牙语、普通话、阿拉伯语和韩语的介入肺病学文章音频讨论。',
      section: '学习',
      keywords: ['播客', 'journal club', '文章', '普通话'],
    },
    '/ebus-training': {
      title: 'EBUS 培训',
      description: '开放 EBUS 旋钮操作、纵隔分站和模拟器模块。',
      section: 'EBUS 培训',
      keywords: ['ebus', '超声', '纵隔', '分站', '模拟器'],
    },
    '/tnm-9-staging': {
      title: 'TNM-9 分期',
      description: '独立肺癌分期模块，包含描述符参考、分期分组、N 图谱和病例。',
      section: '分期',
      keywords: ['tnm', '肺癌', '分期', 'n 图谱'],
    },
    '/bronch-navigation-trainer': {
      title: '支气管导航训练器',
      description: '从 CT 到支气管镜的导航模拟器，包含分支决策、目标路径和虚拟镜视图。',
      section: '模拟',
      keywords: ['支气管镜', '导航', 'ct', '气道', '模拟'],
    },
    '/thermal-ablation': {
      title: '热消融交互模块',
      description:
        '激光物理、功率密度、模拟 ERBE VIO 3 主机上的电灼波形、APC 以及气道防火安全，含病例自测。',
      section: '模拟',
      keywords: ['热消融', '激光', '电灼', 'apc', 'vio 3', '气道火灾'],
    },
    '/peripheral-ablation': {
      title: '外周肺肿瘤消融',
      description:
        '射频、微波、冷冻与非热的脉冲电场(PEF)消融的能量-组织物理；消融区模拟器，演示热沉效应与 5 毫米安全边缘；器械到位确认；模式与路径选择；免疫效应；并发症与自测。',
      section: '模拟',
      keywords: [
        '外周消融',
        '射频消融',
        '微波消融',
        '冷冻消融',
        '脉冲电场',
        'pef',
        '电穿孔',
        '冰球',
        '热沉',
        '消融边缘',
        '经支气管消融',
        '免疫治疗',
      ],
    },
    '/pleural-procedures': {
      title: '胸膜操作',
      description: '胸膜疾病、超声模式识别、胸水分析、气胸路径和引流系统。',
      section: '胸膜操作',
      keywords: ['胸膜', '胸水', '胸腔穿刺', '超声', '气胸', '引流'],
    },
    '/tracheostomy': {
      title: '气管切开知识实验室',
      description: '三维解剖、套囊气流、套管选择、日常护理、急救演练与拔管准备度。',
      section: '气道',
      keywords: ['气管切开', '套囊', '发声阀', '拔管', '吸痰'],
    },
    '/learn/anatomy': {
      title: '交互式 3D 解剖查看器',
      description: '使用交互工具探索气道结构、血管和肺叶关系。',
      section: '学习',
      keywords: ['解剖', '气道', '模型', '肺段'],
    },
  },
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
    title: 'Journal Club Podcasts',
    description:
      'Article-focused interventional pulmonology journal club audio discussions in English, Spanish, Mandarin, Arabic, and Korean.',
    href: '/journal-club-podcasts',
    section: 'Learning',
    type: 'page',
    keywords: [
      'journal club',
      'podcasts',
      'audio',
      'articles',
      'papers',
      'lung nodules',
      'robotic bronchoscopy',
      'pleural disease',
      'airway obstruction',
      'blvr',
      'english',
      'spanish',
      'mandarin',
      'arabic',
      'korean',
    ],
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
    title: 'Thermal Ablation Interactive Modules',
    description:
      'Laser physics, power density, electrocautery waveforms on a simulated ERBE VIO 3 console, APC, and airway-fire safety with case-based self-assessment.',
    href: '/thermal-ablation',
    section: 'Simulation',
    type: 'page',
    keywords: [
      'thermal ablation',
      'laser',
      'nd:yag',
      'electrocautery',
      'electrosurgery',
      'vio 3',
      'apc',
      'argon plasma',
      'airway fire',
    ],
  },
  {
    title: 'Rigid Bronchoscopy',
    description:
      'Simulation-only rigid bronchoscopy training: equipment, indications, shared-airway ventilation, tumor coring, dilation, stents, foreign-body retrieval, endobronchial hemostasis, and operating-room airway-fire safety.',
    href: '/rigid-bronchoscopy',
    section: 'Bronchoscopy',
    type: 'page',
    keywords: [
      'rigid bronchoscopy',
      'central airway obstruction',
      'tumor coring',
      'debulking',
      'airway stent',
      'foreign body',
      'hemoptysis',
      'endobronchial hemostasis',
      'airway fire',
      'jet ventilation',
    ],
  },
  {
    title: 'Tracheostomy Knowledge Lab',
    description:
      'Interactive adult tracheostomy education with a 3D tube model, cuff and airflow animation, tube selection, care sequencing, emergency rescue, and decannulation readiness.',
    href: '/tracheostomy',
    section: 'Airway',
    type: 'page',
    keywords: [
      'tracheostomy',
      'trach tube',
      'cuff pressure',
      'speaking valve',
      'suctioning',
      'blocked tracheostomy',
      'decannulation',
      'tracheoinnominate fistula',
    ],
  },
  {
    title: 'Pleuroscopy (Medical Thoracoscopy)',
    description:
      'Simulation-only medical thoracoscopy training: indications and contraindications, rigid vs semi-rigid scopes, ultrasound-guided access, parietal biopsy, talc poudrage pleurodesis, and complication management.',
    href: '/pleural-procedures/pleuroscopy',
    section: 'Pleural Procedures',
    type: 'page',
    keywords: [
      'pleuroscopy',
      'medical thoracoscopy',
      'thoracoscopy',
      'pleural biopsy',
      'talc poudrage',
      'pleurodesis',
      'malignant pleural effusion',
      'semi-rigid thoracoscope',
    ],
  },
  {
    title: 'Peripheral Lung Tumor Ablation',
    description:
      'Energy–tissue physics of RFA, microwave, cryo, and non-thermal PEF (pulsed electric field); an ablation-zone simulator with heat-sink and the 5 mm margin; tool-in-lesion confirmation; modality/route selection; immune effects; complications and self-assessment.',
    href: '/peripheral-ablation',
    section: 'Simulation',
    type: 'page',
    keywords: [
      'peripheral ablation',
      'lung tumor ablation',
      'rfa',
      'radiofrequency ablation',
      'microwave ablation',
      'cryoablation',
      'pulsed electric field',
      'pef',
      'electroporation',
      'ice ball',
      'heat sink',
      'ablation margin',
      'transbronchial ablation',
      'immunotherapy',
    ],
  },
  {
    title: 'Pleural Procedures',
    description:
      'Pleural disease, ultrasound pattern recognition, fluid analysis, pneumothorax pathways, and drainage systems.',
    href: '/pleural-procedures',
    section: 'Pleural Procedures',
    type: 'page',
    keywords: ['pleural', 'effusion', 'thoracentesis', 'ultrasound', 'pneumothorax', 'drainage'],
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
    title: 'Intro Bronchoscopy',
    description:
      'Foundational bronchoscopy tools for scope sizing, airway reach concepts, and instrument compatibility.',
    href: '/intro-bronchoscopy',
    section: 'Bronchoscopy',
    type: 'page',
    keywords: ['intro bronchoscopy', 'scope sizing', 'working channel', 'airway reach'],
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

const ebusTrainingResults: SiteSearchResult[] = allEbusTrainingModules.map((module) => ({
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

function localizeSearchResult(
  item: SiteSearchResult,
  locale: ActiveLocale = 'en',
): SiteSearchResult {
  const override = localizedSearchOverrides[locale]?.[item.href]
  const merged = override
    ? {
        ...item,
        ...override,
        keywords: override.keywords ?? item.keywords,
      }
    : item

  if (locale === 'en') {
    return merged
  }

  if (merged.type === 'image-category') {
    const categoryName = localizeSearchText(locale, merged.keywords?.[0] ?? merged.title)
    const count = merged.description.match(/^\d+/)?.[0] ?? ''

    return {
      ...merged,
      title: locale === 'es' ? `Imágenes de ${categoryName}` : `${categoryName}图像`,
      description:
        locale === 'es'
          ? `${count} imágenes médicas Creative Commons en la colección ${categoryName}.`
          : `${categoryName}集合中的 ${count} 张 Creative Commons 医学图像。`,
      section: locale === 'es' ? 'Imágenes Creative Commons' : 'Creative Commons 图像',
      keywords: [categoryName],
    }
  }

  return {
    ...merged,
    title: localizeSearchText(locale, merged.title),
    description: localizeSearchText(locale, merged.description),
    section: localizeSearchText(locale, merged.section),
    keywords: merged.keywords?.map((keyword) => localizeSearchText(locale, keyword)),
  }
}

function getStaticResults(options: SiteSearchOptions = {}) {
  return allStaticResults
    .filter((item) =>
      isVisibleModulePath(item.href, {
        isAdmin: options.canViewDrafts === true,
      }),
    )
    .map((item) => localizeSearchResult(item, options.locale))
}

function getEbusTrainingResults(options: SiteSearchOptions = {}) {
  return ebusTrainingResults.filter((item) =>
    isVisibleModulePath(item.href, { isAdmin: options.canViewDrafts === true }),
  )
}

function getSearchIndex(options: SiteSearchOptions = {}) {
  return [
    ...getStaticResults(options),
    ...getEbusTrainingResults(options),
    ...vibeGuideSections,
    ...boardReviewResults,
    ...imageCategoryResults,
  ].map((item) => localizeSearchResult(item, options.locale))
}

export function getFeaturedSearchResults(options: SiteSearchOptions = {}) {
  return getStaticResults(options).slice(0, 6)
}

export function searchSite(rawQuery: string, limit = 60, options: SiteSearchOptions = {}) {
  const query = normalize(rawQuery)
  const terms = query.split(/\s+/).filter(Boolean)

  if (!terms.length) {
    return getFeaturedSearchResults(options)
  }

  return getSearchIndex(options)
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
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
