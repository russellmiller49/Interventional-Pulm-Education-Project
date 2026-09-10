import { useMemo } from 'react';

import knobologyData from '../../../../content/modules/knobology.json';
import knobologyAdvancedData from '../../../../content/modules/knobology-advanced.json';
import mediastinalAnatomyData from '../../../../content/modules/mediastinal-anatomy.json';
import proceduralTechniqueData from '../../../../content/modules/procedural-technique.json';
import sonographicInterpretationData from '../../../../content/modules/sonographic-interpretation.json';
import stagingStrategyData from '../../../../content/modules/staging-strategy.json';
import stationExplorerContentData from '../../../../content/modules/station-explorer.json';
import stationMapContentData from '../../../../content/modules/station-map.json';
import knobologyQuizData from '../../../../content/quizzes/knobology-advanced.json';
import mediastinalQuizData from '../../../../content/quizzes/mediastinal-anatomy.json';
import proceduralQuizData from '../../../../content/quizzes/procedural-technique.json';
import sonographicQuizData from '../../../../content/quizzes/sonographic-interpretation.json';
import stagingQuizData from '../../../../content/quizzes/staging-strategy.json';
import stationCorrelationsData from '../../../../content/stations/station-correlations.json';
import stationsData from '../../../../content/stations/core-stations.json';

import esKnobologyData from '@/content/locales/es/content/modules/knobology.json';
import esKnobologyAdvancedData from '@/content/locales/es/content/modules/knobology-advanced.json';
import esMediastinalAnatomyData from '@/content/locales/es/content/modules/mediastinal-anatomy.json';
import esProceduralTechniqueData from '@/content/locales/es/content/modules/procedural-technique.json';
import esSonographicInterpretationData from '@/content/locales/es/content/modules/sonographic-interpretation.json';
import esStagingStrategyData from '@/content/locales/es/content/modules/staging-strategy.json';
import esStationExplorerContentData from '@/content/locales/es/content/modules/station-explorer.json';
import esStationMapContentData from '@/content/locales/es/content/modules/station-map.json';
import esKnobologyQuizData from '@/content/locales/es/content/quizzes/knobology-advanced.json';
import esMediastinalQuizData from '@/content/locales/es/content/quizzes/mediastinal-anatomy.json';
import esProceduralQuizData from '@/content/locales/es/content/quizzes/procedural-technique.json';
import esSonographicQuizData from '@/content/locales/es/content/quizzes/sonographic-interpretation.json';
import esStagingQuizData from '@/content/locales/es/content/quizzes/staging-strategy.json';
import esStationCorrelationsData from '@/content/locales/es/content/stations/station-correlations.json';
import esStationsData from '@/content/locales/es/content/stations/core-stations.json';
import zhCnKnobologyData from '@/content/locales/zh-CN/content/modules/knobology.json';
import zhCnKnobologyAdvancedData from '@/content/locales/zh-CN/content/modules/knobology-advanced.json';
import zhCnMediastinalAnatomyData from '@/content/locales/zh-CN/content/modules/mediastinal-anatomy.json';
import zhCnProceduralTechniqueData from '@/content/locales/zh-CN/content/modules/procedural-technique.json';
import zhCnSonographicInterpretationData from '@/content/locales/zh-CN/content/modules/sonographic-interpretation.json';
import zhCnStagingStrategyData from '@/content/locales/zh-CN/content/modules/staging-strategy.json';
import zhCnStationExplorerContentData from '@/content/locales/zh-CN/content/modules/station-explorer.json';
import zhCnStationMapContentData from '@/content/locales/zh-CN/content/modules/station-map.json';
import zhCnKnobologyQuizData from '@/content/locales/zh-CN/content/quizzes/knobology-advanced.json';
import zhCnMediastinalQuizData from '@/content/locales/zh-CN/content/quizzes/mediastinal-anatomy.json';
import zhCnProceduralQuizData from '@/content/locales/zh-CN/content/quizzes/procedural-technique.json';
import zhCnSonographicQuizData from '@/content/locales/zh-CN/content/quizzes/sonographic-interpretation.json';
import zhCnStagingQuizData from '@/content/locales/zh-CN/content/quizzes/staging-strategy.json';
import zhCnStationCorrelationsData from '@/content/locales/zh-CN/content/stations/station-correlations.json';
import zhCnStationsData from '@/content/locales/zh-CN/content/stations/core-stations.json';
import { getKnobologyMedia, getStationMedia } from '@/content/media';
import stationMapLayoutData from '@/content/station-map-layout.web.json';
import type {
  CombinedStation,
  EducationalModuleContent,
  KnobologyModuleContent,
  QuizQuestionContent,
  RootModuleId,
  StationContent,
  StationCorrelationContent,
  StationExplorerModuleContent,
  StationMapLayout,
  StationMapModuleContent,
  StationZoneKey,
} from '@/content/types';
import { useLocale, type AppLocale } from '@/i18n/locale';
import { mergeLocalizedValue } from '@/i18n/overlay';

interface LocaleBodyOverlay {
  modules: {
    knobology: unknown;
    knobologyAdvanced: unknown;
    mediastinalAnatomy: unknown;
    proceduralTechnique: unknown;
    sonographicInterpretation: unknown;
    stagingStrategy: unknown;
    stationExplorer: unknown;
    stationMap: unknown;
  };
  quizzes: {
    knobologyAdvanced: unknown;
    mediastinalAnatomy: unknown;
    proceduralTechnique: unknown;
    sonographicInterpretation: unknown;
    stagingStrategy: unknown;
  };
  stations: {
    coreStations: unknown;
    stationCorrelations: unknown;
  };
}

const stationMapLayout = stationMapLayoutData as StationMapLayout;
const baseKnobologyContent = knobologyData as KnobologyModuleContent;
const baseKnobologyAdvancedContent = knobologyAdvancedData as EducationalModuleContent;
const baseMediastinalAnatomyContent = mediastinalAnatomyData as EducationalModuleContent;
const baseProceduralTechniqueContent = proceduralTechniqueData as EducationalModuleContent;
const baseSonographicInterpretationContent = sonographicInterpretationData as EducationalModuleContent;
const baseStagingStrategyContent = stagingStrategyData as EducationalModuleContent;
const baseStationMapContent = stationMapContentData as StationMapModuleContent;
const baseStationExplorerContent = stationExplorerContentData as StationExplorerModuleContent;
const baseStations = stationsData as StationContent[];
const baseStationCorrelations = stationCorrelationsData as StationCorrelationContent[];
const baseQuizGroups = {
  knobologyAdvanced: knobologyQuizData as QuizQuestionContent[],
  mediastinalAnatomy: mediastinalQuizData as QuizQuestionContent[],
  sonographicInterpretation: sonographicQuizData as QuizQuestionContent[],
  proceduralTechnique: proceduralQuizData as QuizQuestionContent[],
  stagingStrategy: stagingQuizData as QuizQuestionContent[],
};

const bodyOverlays: Partial<Record<AppLocale, LocaleBodyOverlay>> = {
  es: {
    modules: {
      knobology: esKnobologyData,
      knobologyAdvanced: esKnobologyAdvancedData,
      mediastinalAnatomy: esMediastinalAnatomyData,
      proceduralTechnique: esProceduralTechniqueData,
      sonographicInterpretation: esSonographicInterpretationData,
      stagingStrategy: esStagingStrategyData,
      stationExplorer: esStationExplorerContentData,
      stationMap: esStationMapContentData,
    },
    quizzes: {
      knobologyAdvanced: esKnobologyQuizData,
      mediastinalAnatomy: esMediastinalQuizData,
      sonographicInterpretation: esSonographicQuizData,
      proceduralTechnique: esProceduralQuizData,
      stagingStrategy: esStagingQuizData,
    },
    stations: {
      coreStations: esStationsData,
      stationCorrelations: esStationCorrelationsData,
    },
  },
  'zh-CN': {
    modules: {
      knobology: zhCnKnobologyData,
      knobologyAdvanced: zhCnKnobologyAdvancedData,
      mediastinalAnatomy: zhCnMediastinalAnatomyData,
      proceduralTechnique: zhCnProceduralTechniqueData,
      sonographicInterpretation: zhCnSonographicInterpretationData,
      stagingStrategy: zhCnStagingStrategyData,
      stationExplorer: zhCnStationExplorerContentData,
      stationMap: zhCnStationMapContentData,
    },
    quizzes: {
      knobologyAdvanced: zhCnKnobologyQuizData,
      mediastinalAnatomy: zhCnMediastinalQuizData,
      sonographicInterpretation: zhCnSonographicQuizData,
      proceduralTechnique: zhCnProceduralQuizData,
      stagingStrategy: zhCnStagingQuizData,
    },
    stations: {
      coreStations: zhCnStationsData,
      stationCorrelations: zhCnStationCorrelationsData,
    },
  },
};

function getBodyOverlay(locale: AppLocale) {
  return bodyOverlays[locale] ?? null;
}

function normalizeZone(zone: string): StationZoneKey {
  const lower = zone.toLowerCase();

  if (lower.includes('subcarinal')) {
    return 'subcarinal';
  }

  if (lower.includes('hilar')) {
    return 'hilar';
  }

  return 'upper';
}

function getNodeByStationId(stationId: string) {
  return stationMapLayout.nodes.find((node) => node.stationId === stationId);
}

function getCorrelationByStationId(correlations: StationCorrelationContent[], stationId: string) {
  return correlations.find((entry) => entry.stationId === stationId);
}

export function getLocalizedKnobologyContent(locale: AppLocale): KnobologyModuleContent {
  return mergeLocalizedValue(baseKnobologyContent, getBodyOverlay(locale)?.modules.knobology);
}

export function getLocalizedKnobologyAdvancedContent(locale: AppLocale): EducationalModuleContent {
  return mergeLocalizedValue(baseKnobologyAdvancedContent, getBodyOverlay(locale)?.modules.knobologyAdvanced);
}

export function getLocalizedMediastinalAnatomyContent(locale: AppLocale): EducationalModuleContent {
  return mergeLocalizedValue(baseMediastinalAnatomyContent, getBodyOverlay(locale)?.modules.mediastinalAnatomy);
}

export function getLocalizedSonographicInterpretationContent(locale: AppLocale): EducationalModuleContent {
  return mergeLocalizedValue(
    baseSonographicInterpretationContent,
    getBodyOverlay(locale)?.modules.sonographicInterpretation,
  );
}

export function getLocalizedProceduralTechniqueContent(locale: AppLocale): EducationalModuleContent {
  return mergeLocalizedValue(baseProceduralTechniqueContent, getBodyOverlay(locale)?.modules.proceduralTechnique);
}

export function getLocalizedStagingStrategyContent(locale: AppLocale): EducationalModuleContent {
  return mergeLocalizedValue(baseStagingStrategyContent, getBodyOverlay(locale)?.modules.stagingStrategy);
}

export function getLocalizedStationEducationModules(locale: AppLocale): EducationalModuleContent[] {
  return [
    getLocalizedMediastinalAnatomyContent(locale),
    getLocalizedSonographicInterpretationContent(locale),
    getLocalizedProceduralTechniqueContent(locale),
    getLocalizedStagingStrategyContent(locale),
  ];
}

export function getLocalizedStationMapContent(locale: AppLocale): StationMapModuleContent {
  return mergeLocalizedValue(baseStationMapContent, getBodyOverlay(locale)?.modules.stationMap);
}

export function getLocalizedStationExplorerContent(locale: AppLocale): StationExplorerModuleContent {
  return mergeLocalizedValue(baseStationExplorerContent, getBodyOverlay(locale)?.modules.stationExplorer);
}

export function getLocalizedQuizQuestions(locale: AppLocale, moduleId?: RootModuleId): QuizQuestionContent[] {
  const overlay = getBodyOverlay(locale);
  const questions = [
    ...mergeLocalizedValue(baseQuizGroups.knobologyAdvanced, overlay?.quizzes.knobologyAdvanced),
    ...mergeLocalizedValue(baseQuizGroups.mediastinalAnatomy, overlay?.quizzes.mediastinalAnatomy),
    ...mergeLocalizedValue(baseQuizGroups.sonographicInterpretation, overlay?.quizzes.sonographicInterpretation),
    ...mergeLocalizedValue(baseQuizGroups.proceduralTechnique, overlay?.quizzes.proceduralTechnique),
    ...mergeLocalizedValue(baseQuizGroups.stagingStrategy, overlay?.quizzes.stagingStrategy),
  ];

  return moduleId ? questions.filter((question) => question.moduleId === moduleId) : questions;
}

export function getLocalizedKnobologyReferenceCards(locale: AppLocale) {
  return getLocalizedKnobologyContent(locale).quickReferenceCards.map((card) => ({
    ...card,
    media: getKnobologyMedia(card.id),
  }));
}

export function getLocalizedKnobologyQuizQuestions(locale: AppLocale): QuizQuestionContent[] {
  const knobologyContent = getLocalizedKnobologyContent(locale);
  const questionIds = new Set(knobologyContent.quizQuestionIds);

  return getLocalizedQuizQuestions(locale, 'knobology').filter((question) => questionIds.has(question.id));
}

export function getLocalizedStations(locale: AppLocale): CombinedStation[] {
  const overlay = getBodyOverlay(locale);
  const stations = mergeLocalizedValue(baseStations, overlay?.stations.coreStations);
  const correlations = mergeLocalizedValue(baseStationCorrelations, overlay?.stations.stationCorrelations);

  return stations.flatMap((station) => {
    const mapNode = getNodeByStationId(station.id);
    const correlation = getCorrelationByStationId(correlations, station.id);

    if (!mapNode || !correlation) {
      return [];
    }

    return [
      {
        ...station,
        zoneKey: normalizeZone(station.zone),
        aliases: correlation.aliases,
        landmarkChecklist: correlation.landmarkChecklist,
        mapNode,
        views: correlation.views,
        quizItems: correlation.quizItems,
        media: getStationMedia(station.id),
      },
    ];
  });
}

export function useLocalizedKnobologyContent() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedKnobologyContent(locale), [locale]);
}

export function useLocalizedKnobologyAdvancedContent() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedKnobologyAdvancedContent(locale), [locale]);
}

export function useLocalizedKnobologyReferenceCards() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedKnobologyReferenceCards(locale), [locale]);
}

export function useLocalizedKnobologyQuizQuestions() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedKnobologyQuizQuestions(locale), [locale]);
}

export function useLocalizedStationEducationModules() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedStationEducationModules(locale), [locale]);
}

export function useLocalizedSonographicInterpretationContent() {
  const { locale } = useLocale();

  return useMemo(() => getLocalizedSonographicInterpretationContent(locale), [locale]);
}

export function useLocalizedStationsContent() {
  const { locale } = useLocale();

  return useMemo(
    () => ({
      explorerContent: getLocalizedStationExplorerContent(locale),
      layout: stationMapLayout,
      mapContent: getLocalizedStationMapContent(locale),
      stations: getLocalizedStations(locale),
    }),
    [locale],
  );
}
