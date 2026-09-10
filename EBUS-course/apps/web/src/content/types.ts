export type RootModuleId =
  | 'pretest'
  | 'knobology'
  | 'station-map'
  | 'station-explorer'
  | 'case-3d-explorer'
  | 'tnm-staging';
export type AppRouteId =
  | 'home'
  | 'progress'
  | 'welcome'
  | 'admin'
  | 'sponsors'
  | 'pretest'
  | 'post-course'
  | 'stations'
  | 'knobology'
  | 'lectures'
  | 'quiz'
  | 'case-001'
  | 'simulator'
  | 'tnm-staging';
export type TrackedLearningRouteId = Exclude<AppRouteId, 'home' | 'progress' | 'welcome' | 'admin' | 'sponsors' | 'post-course'>;
export type StationZoneKey = 'upper' | 'subcarinal' | 'hilar';
export type ExplorerViewId = 'ct' | 'bronchoscopy' | 'ultrasound';
export type LessonSectionKind =
  | 'overview'
  | 'learning-objectives'
  | 'core-concept'
  | 'landmarks'
  | 'pitfall'
  | 'clinical-pearl'
  | 'technique'
  | 'staging'
  | 'artifact'
  | 'sonographic-pattern'
  | 'case';
export type QuizQuestionType =
  | 'single-best-answer'
  | 'multi-select'
  | 'ordering'
  | 'image-interpretation'
  | 'case-vignette';
export type QuizDifficulty = 'basic' | 'intermediate' | 'advanced';
export type StationAccessProfile = 'EBUS' | 'EUS-B' | 'Both' | 'Visualized only';
export type KnobologyControlId =
  | 'depth'
  | 'gain'
  | 'contrast'
  | 'color-doppler'
  | 'calipers'
  | 'freeze'
  | 'save';
export type TnmPrimarySide = 'right' | 'left';
export type TnmStageableTCategory = 'T1a' | 'T1b' | 'T1c' | 'T2a' | 'T2b' | 'T3' | 'T4';
export type TnmTCategory = 'TX' | 'T0' | 'Tis' | 'T1mi' | TnmStageableTCategory;
export type TnmStageableNCategory = 'N0' | 'N1' | 'N2a' | 'N2b' | 'N3';
export type TnmNCategory = 'NX' | TnmStageableNCategory;
export type TnmMCategory = 'M0' | 'M1a' | 'M1b' | 'M1c1' | 'M1c2';
export type TnmStageGroup =
  | '0'
  | 'IA1'
  | 'IA2'
  | 'IA3'
  | 'IB'
  | 'IIA'
  | 'IIB'
  | 'IIIA'
  | 'IIIB'
  | 'IIIC'
  | 'IVA'
  | 'IVB';
export type TnmReferenceCategory = 'T' | 'N' | 'M' | 'Stage';
export type TnmStationStatusValue = 'unassessed' | 'sampled-negative' | 'positive';
export type TnmSeparateNoduleRuleId = 'none' | 'same-lobe' | 'different-ipsilateral-lobe' | 'contralateral-lobe';
export type TnmTumorLocationId = 'peripheral' | 'central' | 'pleural' | 'mediastinal' | 'diaphragmatic';

export interface TnmSelection {
  t: TnmStageableTCategory;
  n: TnmStageableNCategory;
  m: TnmMCategory;
}

export interface TnmReferenceCard {
  id: string;
  category: TnmReferenceCategory;
  title: string;
  summary: string;
  bullets: string[];
  changedFrom8th: string;
}

export interface TnmCategoryOption<TValue extends string> {
  id: TValue;
  label: string;
  descriptor: string;
}

export interface TnmStageMatrixRow {
  t: TnmStageableTCategory;
  descriptor: string;
  stages: Record<TnmStageableNCategory, TnmStageGroup>;
}

export interface TnmStageMatrixContent {
  sourceLabel: string;
  tCategories: Array<TnmCategoryOption<TnmStageableTCategory>>;
  nCategories: Array<TnmCategoryOption<TnmStageableNCategory>>;
  mCategories: Array<TnmCategoryOption<TnmMCategory>>;
  mStageOverrides: Partial<Record<TnmMCategory, TnmStageGroup>>;
  rows: TnmStageMatrixRow[];
}

export interface TnmTBuilderLocation {
  id: TnmTumorLocationId;
  label: string;
  summary: string;
}

export interface TnmTBuilderInvasionRule {
  id: string;
  label: string;
  t: TnmStageableTCategory;
  summary: string;
}

export interface TnmTBuilderSeparateNoduleRule {
  id: TnmSeparateNoduleRuleId;
  label: string;
  t?: TnmStageableTCategory;
  m?: TnmMCategory;
  summary: string;
}

export interface TnmTBuilderContent {
  locations: TnmTBuilderLocation[];
  invasionRules: TnmTBuilderInvasionRule[];
  separateNoduleRules: TnmTBuilderSeparateNoduleRule[];
  atelectasisNote: string;
}

export interface TnmBuilderState {
  primarySide: TnmPrimarySide;
  sizeCm: number;
  locationId: TnmTumorLocationId;
  invasionIds: string[];
  hasAtelectasisOrPneumonitis: boolean;
  separateNodule: TnmSeparateNoduleRuleId;
}

export interface TnmStationRule {
  stationId: string;
  label: string;
  groupId: string;
  side: TnmPrimarySide | 'midline' | 'external';
  basin: 'mediastinal' | 'hilar' | 'intrapulmonary' | 'supraclavicular' | 'scalene';
  external: boolean;
}

export interface TnmCaseContent {
  id: string;
  title: string;
  difficulty: QuizDifficulty;
  focusTags: string[];
  ctFindings: string[];
  petFindings: string[];
  ebusFindings: string[];
  expected: TnmSelection & {
    stage: TnmStageGroup;
  };
  feedback: string;
}

export interface ModuleContent {
  id: RootModuleId;
  slug: string;
  shortTitle: string;
  title: string;
  summary: string;
  overview: string;
  estimatedMinutes: number;
  route: string;
  goals: string[];
  plannedExperiences: string[];
  relatedStationIds: string[];
}

export interface QuizQuestionOption {
  id: string;
  label: string;
  rationale: string;
}

export interface QuestionImageAsset {
  alt: string;
  caption: string;
  src: string;
}

export type PretestQuestionType = 'single-best-answer' | 'scenario' | 'image-interpretation';
export type PretestImageAssetKey =
  | 'pretest-q2-figure'
  | 'pretest-q8-figure'
  | 'pretest-q22-figure'
  | 'ebus-2026-final-station-4r'
  | 'ebus-2026-final-mediastinal-pet'
  | 'ebus-2026-final-reverberation';

export interface PretestQuestionOption {
  id: string;
  label: string;
}

export interface PretestQuestionContent {
  id: string;
  prompt: string;
  type: PretestQuestionType;
  imageAssetKey: PretestImageAssetKey | null;
  options: PretestQuestionOption[];
  correctOptionId: string;
}

export interface PretestContent {
  id: 'pretest';
  title: string;
  summary: string;
  instructions: string[];
  demoPolicy: string;
  questions: PretestQuestionContent[];
}

export interface QuizQuestionContent {
  id: string;
  moduleId: RootModuleId;
  prompt: string;
  type: QuizQuestionType;
  imageAsset?: QuestionImageAsset;
  options: QuizQuestionOption[];
  correctOptionIds: string[];
  explanation: string;
  difficulty: QuizDifficulty;
  tags: string[];
  caseTitle?: string;
  caseSummary?: string;
}

export type CourseAssessmentKind = 'post-lecture-quiz' | 'post-test';

export interface CourseAssessmentContent {
  id: string;
  kind: CourseAssessmentKind;
  title: string;
  sourceFile: string;
  requiredLectureIds: string[];
  questions: QuizQuestionContent[];
}

export interface CourseInfoQuickFact {
  value: string;
  label: string;
  detail?: string;
}

export interface CourseInfoAgendaItem {
  time: string;
  title: string;
  detail: string;
}

export interface CourseInfoFeature {
  title: string;
  detail: string;
}

export interface CourseInfoDirection {
  origin: string;
  detail: string;
}

export interface CourseInfoImageAsset {
  src: string;
  alt: string;
  caption?: string;
}

export interface CourseInfoVisuals {
  logo: CourseInfoImageAsset;
  hero: CourseInfoImageAsset;
  inset: CourseInfoImageAsset;
  gallery: CourseInfoImageAsset[];
}

export interface CourseInfoEndorsement {
  text: string;
  image: CourseInfoImageAsset;
}

export interface CourseInfoContent {
  courseTitle: string;
  hostLine: string;
  hostDepartment: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  venueDetail: string;
  audience: string;
  overview: string;
  quickFacts: CourseInfoQuickFact[];
  positioningHighlights: string[];
  courseDirectors: string[];
  facultySummary: string;
  facultyInstitutions: string[];
  formatHighlights: string[];
  experienceHighlights: CourseInfoFeature[];
  prepWindow: string;
  prepTopics: string[];
  liveSessionTracks: CourseInfoFeature[];
  liveDayAgenda: CourseInfoAgendaItem[];
  addressLines: string[];
  parkingNote: string;
  travelNote: string;
  travelDirections: CourseInfoDirection[];
  facilityUrl: string;
  endorsement: CourseInfoEndorsement;
  visuals: CourseInfoVisuals;
}

export interface ProceduralVideoContentItem {
  id: string;
  playlistIndex: number;
  title: string;
  youtubeId: string;
}

export interface ProceduralVideoLibraryContent {
  id: string;
  title: string;
  summary: string;
  playlistTitle: string;
  playlistUrl: string;
  videos: ProceduralVideoContentItem[];
}

export interface StationAssetKeys {
  map: string;
  ct: string;
  bronchoscopy: string;
  ultrasound: string;
}

export interface LessonCaseVignette {
  title: string;
  scenario: string;
  prompt: string;
  takeaway: string;
}

export interface LessonSection {
  id: string;
  title: string;
  kind: LessonSectionKind;
  body: string;
  bullets?: string[];
  imageIds?: string[];
  relatedStationIds?: string[];
  pearl?: string;
  pitfall?: string;
  checklist?: string[];
  caseVignette?: LessonCaseVignette;
}

export interface EducationalModuleContent {
  id: string;
  title: string;
  summary: string;
  learningObjectives: string[];
  sections: LessonSection[];
}

export interface StationBoundaryDefinition {
  superior: string;
  inferior: string;
  medial?: string;
  lateral?: string;
  anterior?: string;
  posterior?: string;
}

export interface StationStagingImplication {
  ipsilateral: string;
  contralateral: string;
  note: string;
}

export interface StationPerspectiveChecklist {
  ct: string[];
  bronchoscopy: string[];
  ultrasound: string[];
}

export interface StationContent {
  id: string;
  displayName: string;
  shortLabel: string;
  iaslcName: string;
  zone: string;
  laterality: string;
  description: string;
  accessNotes: string;
  accessProfile: StationAccessProfile;
  bestEbusWindow: string;
  landmarkVessels: string[];
  boundaryDefinition: StationBoundaryDefinition;
  boundaryNotes: string[];
  nStageImplication: StationStagingImplication;
  clinicalImportance: string;
  memoryCues: string[];
  confusionPairs: string[];
  commonConfusionPair: string;
  relatedStationIds: string[];
  whatYouSee: StationPerspectiveChecklist;
  safePunctureConsiderations: string[];
  stagingChangeFinding: string;
  assetKeys: StationAssetKeys;
}

export interface StationMapLandmark {
  id: string;
  kind: 'tube' | 'branch' | 'hub';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
}

export interface StationMapNode {
  stationId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StationMapLayout {
  designWidth: number;
  designHeight: number;
  landmarks: StationMapLandmark[];
  nodes: StationMapNode[];
}

export interface StationMapQuizRound {
  id: string;
  stationId: string;
  prompt: string;
  hint: string;
  explanation: string;
}

export interface StationMapModuleContent {
  introSections: Array<{
    id: string;
    title: string;
    summary: string;
    takeaway: string;
  }>;
  mapTips: string[];
  flashcardPrompt: string;
  quizRounds: StationMapQuizRound[];
  reviewChecklist: string[];
  extensionNote: string;
}

export interface ExplorerViewContent {
  title: string;
  orientation: string;
  focusLabel: string;
  caption: string;
  visualAnchor:
    | 'upper-left'
    | 'upper-right'
    | 'middle-left'
    | 'middle-right'
    | 'center'
    | 'lower-left'
    | 'lower-right';
}

export interface StationRecognitionQuizItem {
  id: string;
  viewId: ExplorerViewId;
  prompt: string;
  optionIds: string[];
  explanation: string;
}

export interface StationCorrelationContent {
  stationId: string;
  aliases: string[];
  landmarkChecklist: string[];
  views: Record<ExplorerViewId, ExplorerViewContent>;
  quizItems: StationRecognitionQuizItem[];
}

export interface StationExplorerModuleContent {
  introSections: Array<{
    id: string;
    title: string;
    summary: string;
    takeaway: string;
  }>;
  reviewPrompts: string[];
  extensionNote: string;
}

export interface KnobologyLessonSection {
  id: string;
  title: string;
  summary: string;
  bestMove: string;
  pitfall: string;
}

export interface KnobologyCorrectionExercise {
  id: string;
  title: string;
  symptom: string;
  instructions: string;
  focusControl: 'depth' | 'gain' | 'contrast';
  start: {
    depth: number;
    gain: number;
    contrast: number;
  };
  target: {
    depth: number;
    gain: number;
    contrast: number;
  };
  successMessage: string;
}

export interface KnobologyReferenceCard {
  id: KnobologyControlId;
  title: string;
  whenToUse: string;
  whatChanges: string;
  noviceTrap: string;
}

export interface KnobologyDopplerLab {
  title: string;
  brief: string;
  prompt: string;
  safePathId: string;
  paths: Array<{
    id: string;
    label: string;
    description: string;
  }>;
}

export interface KnobologyModuleContent {
  primerSections: KnobologyLessonSection[];
  controlLabExercises: KnobologyCorrectionExercise[];
  dopplerLab: KnobologyDopplerLab;
  quickReferenceCards: KnobologyReferenceCard[];
  quizQuestionIds: string[];
}

export interface StationAnnotationRegion {
  label: string;
  points: Array<[number, number]>;
}

export interface StationAnnotationSet {
  width: number;
  height: number;
  regions: StationAnnotationRegion[];
}

export interface StationMediaVariant {
  id: string;
  label: string;
  image?: string;
  revealImage?: string;
  note?: string;
  annotationKey?: string;
  annotations?: StationAnnotationSet;
}

export interface StationMediaEntry {
  ctVariants?: StationMediaVariant[];
  bronchoscopyVariants?: StationMediaVariant[];
  ebusVariants?: StationMediaVariant[];
  ctImage?: string;
  ctAnnotatedImage?: string;
  bronchoscopyImage?: string;
  bronchoscopyVideo?: string;
  ebusImage?: string;
  ebusVideo?: string;
  notes?: string[];
}

export interface KnobologyMediaEntry {
  comparisonImages?: string[];
  clips?: string[];
  caption?: string;
}

export interface LectureManifestItem {
  id: string;
  title: string;
  subtitle: string;
  week: string;
  duration: string;
  poster?: string;
  thumbnail?: string;
  video?: string;
  embedUrl?: string;
  resourceUrl?: string;
  resourceLabel?: string;
  topics: string[];
  status: 'available' | 'locked';
}

export interface NavigationItem {
  id: AppRouteId;
  label: string;
  icon: string;
  path: string;
  hideInBottom?: boolean;
  locked?: boolean;
  lockedReason?: string;
}

export interface SponsorContent {
  id: string;
  name: string;
  logoSrc: string;
  websiteUrl: string;
}

export interface AppModuleCard {
  id: AppRouteId;
  title: string;
  description: string;
  accent: string;
  icon: string;
  path: string;
}

export interface ZoneTheme {
  bg: string;
  border: string;
  text: string;
  label: string;
}

export interface CombinedStation extends StationContent {
  zoneKey: StationZoneKey;
  aliases: string[];
  landmarkChecklist: string[];
  mapNode: StationMapNode;
  views: Record<ExplorerViewId, ExplorerViewContent>;
  quizItems: StationRecognitionQuizItem[];
  media: StationMediaEntry;
}

export interface StationMapConnection {
  from: string;
  to: string;
}

export interface CombinedCaseManifest {
  caseId: string;
  title: string;
  description: string;
  assets: {
    glbFile: string;
    ctVolumeFile: string;
    segmentationFile: string;
  };
  sliceSeries: Record<
    'axial' | 'coronal' | 'sagittal',
    {
      folder: string;
      count: number;
      displayOrientation: string;
    }
  >;
  stations: Array<{
    id: string;
    label: string;
    groupLabel: string;
    targetIds: string[];
    primaryTargetId: string;
  }>;
}
