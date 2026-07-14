export type PccmTechnicalVideoProvider = 'nejm' | 'youtube'

export interface PccmTechnicalProcedureVideo {
  description: string
  embedUrl?: string
  id: string
  provider: PccmTechnicalVideoProvider
  publisher: string
  sourceTitle: string
  sourceUrl: string
  title: string
}

export const pccmPleuralTechnicalProcedureVideos: readonly PccmTechnicalProcedureVideo[] = [
  {
    description: 'Stepwise demonstration of pleural access and fluid drainage using thoracentesis.',
    embedUrl: 'https://www.youtube-nocookie.com/embed/-lg_IsbMujY?rel=0',
    id: 'pleural-technical-thoracentesis',
    provider: 'youtube',
    publisher: 'AABIP',
    sourceTitle: 'Thoracentesis',
    sourceUrl: 'https://www.youtube.com/watch?v=-lg_IsbMujY',
    title: 'Thoracentesis Technique',
  },
  {
    description: 'Percutaneous small-bore chest tube insertion using a pigtail catheter.',
    embedUrl: 'https://www.youtube-nocookie.com/embed/v8H4589BOcs?rel=0',
    id: 'pleural-technical-pigtail-insertion',
    provider: 'youtube',
    publisher: 'AABIP',
    sourceTitle: 'Percutaneous Chest Tube Insertion - Pigtail Catheter',
    sourceUrl: 'https://www.youtube.com/watch?v=v8H4589BOcs',
    title: 'Pigtail Catheter Insertion Technique',
  },
  {
    description:
      'Publisher-hosted demonstration of surgical chest tube insertion (tube thoracostomy).',
    id: 'pleural-technical-surgical-chest-tube',
    provider: 'nejm',
    publisher: 'New England Journal of Medicine',
    sourceTitle: 'Chest-Tube Insertion',
    sourceUrl: 'https://www.nejm.org/doi/full/10.1056/NEJMvcm071974',
    title: 'Surgical Chest Tube Insertion Technique',
  },
  {
    description: 'Overview of chest drainage system chambers, setup, and function.',
    embedUrl: 'https://www.youtube-nocookie.com/embed/WsJuaFf2OdE?rel=0',
    id: 'pleural-technical-drainage-system',
    provider: 'youtube',
    publisher: 'AABIP',
    sourceTitle: 'Chest Tube Drainage System: Overview',
    sourceUrl: 'https://www.youtube.com/watch?v=WsJuaFf2OdE',
    title: 'Chest Tube Drainage Apparatus Overview',
  },
]
