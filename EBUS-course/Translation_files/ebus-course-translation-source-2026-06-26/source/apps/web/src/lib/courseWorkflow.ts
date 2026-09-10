import {
  courseAssessments,
  finalPostTestAssessment,
  getCourseAssessmentById,
  postLectureCourseAssessments,
} from '@/content/courseAssessments';
import { lectureManifest } from '@/content/lectures';
import { welcomeLecture } from '@/content/welcome';
import type { CourseAssessmentContent } from '@/content/types';
import { formatCourseEndAvailability, isCourseEndUnlocked } from '@/lib/courseConfig';
import type { LearnerProgressState } from '@/lib/progress';

export type CourseWorkflowStepKind =
  | 'account'
  | 'welcome'
  | 'lecture'
  | 'pretest'
  | 'practice'
  | 'assessment'
  | 'post-test'
  | 'pre-course-survey'
  | 'survey'
  | 'certificate';

export interface CourseWorkflowStepDefinition {
  id: string;
  kind: CourseWorkflowStepKind;
  title: string;
  path: string;
  assessmentId?: string;
  lectureId?: string;
}

export interface CourseWorkflowStepModel extends CourseWorkflowStepDefinition {
  completed: boolean;
  lockedReason: string | null;
  percent: number;
  status: 'locked' | 'current' | 'available' | 'completed';
  unlocked: boolean;
}

export interface CourseGuidanceModel {
  completedCount: number;
  currentStep: CourseWorkflowStepModel | null;
  lockedCount: number;
  nextStep: CourseWorkflowStepModel | null;
  totalCount: number;
}

export interface CourseWorkflowOptions {
  admin?: boolean;
  accountComplete?: boolean;
  nowMs?: number;
  preview?: boolean;
}

function hasFullCoursePreviewAccess(options: CourseWorkflowOptions) {
  return Boolean(options.admin || options.preview);
}

function lectureStep(lectureId: string): CourseWorkflowStepDefinition {
  const lecture = lectureManifest.find((entry) => entry.id === lectureId);

  return {
    id: lectureId,
    kind: 'lecture',
    lectureId,
    title: lecture?.title ?? lectureId,
    path: '/lectures',
  };
}

function assessmentStep(assessmentId: string): CourseWorkflowStepDefinition {
  const assessment = getCourseAssessmentById(assessmentId);

  return {
    id: assessmentId,
    kind: assessment?.kind === 'post-test' ? 'post-test' : 'assessment',
    assessmentId,
    title: assessment?.title ?? assessmentId,
    path: assessment?.kind === 'post-test' ? `/post-course?assessment=${assessmentId}` : `/lectures?assessment=${assessmentId}`,
  };
}

function getTrailingLectureId(assessment: CourseAssessmentContent) {
  return assessment.requiredLectureIds[assessment.requiredLectureIds.length - 1] ?? null;
}

const lectureWorkflowSteps = lectureManifest.flatMap((lecture) => {
  const assessments = postLectureCourseAssessments.filter((assessment) => getTrailingLectureId(assessment) === lecture.id);

  return [lectureStep(lecture.id), ...assessments.map((assessment) => assessmentStep(assessment.id))];
});

export const courseWorkflowSteps: CourseWorkflowStepDefinition[] = [
  {
    id: 'account',
    kind: 'account',
    title: 'Sign up or log in',
    path: '/welcome',
  },
  {
    id: welcomeLecture.id,
    kind: 'welcome',
    lectureId: welcomeLecture.id,
    title: welcomeLecture.title,
    path: '/welcome',
  },
  {
    id: 'pre-course-survey',
    kind: 'pre-course-survey',
    title: 'Pre-course survey',
    path: '/pretest',
  },
  {
    id: 'pretest',
    kind: 'pretest',
    title: 'Pre-test',
    path: '/pretest',
  },
  ...lectureWorkflowSteps,
  ...(finalPostTestAssessment ? [assessmentStep(finalPostTestAssessment.id)] : []),
  {
    id: 'post-course-survey',
    kind: 'survey',
    title: 'Post-course survey',
    path: '/post-course?section=survey',
  },
  {
    id: 'certificate',
    kind: 'certificate',
    title: 'Certificate of completion',
    path: '/post-course?section=certificate',
  },
];

export function isPretestComplete(state: Pick<LearnerProgressState, 'pretest'>) {
  return Boolean(state.pretest.submittedAt || state.pretest.unlockedByPasscodeAt);
}

export function isPostCourseAssessmentUnlocked(
  state: Pick<LearnerProgressState, 'pretest'>,
  options: CourseWorkflowOptions = {},
) {
  if (hasFullCoursePreviewAccess(options)) {
    return true;
  }

  return isPretestComplete(state) && isCourseEndUnlocked(options.nowMs);
}

export function getPostCourseAssessmentLockReason(
  state: Pick<LearnerProgressState, 'pretest'>,
  options: CourseWorkflowOptions = {},
) {
  if (isPostCourseAssessmentUnlocked(state, options)) {
    return null;
  }

  if (!isCourseEndUnlocked(options.nowMs)) {
    return formatCourseEndAvailability();
  }

  return 'Complete "Pre-test" to unlock the post-course survey and test.';
}

export function isLectureComplete(state: Pick<LearnerProgressState, 'lectureWatchStatus'>, lectureId: string) {
  return Boolean(state.lectureWatchStatus[lectureId]?.completed);
}

export function isLectureQuizReady(state: Pick<LearnerProgressState, 'lectureWatchStatus'>, lectureId: string) {
  const watchState = state.lectureWatchStatus[lectureId];

  return Boolean(
    watchState?.completed ||
      watchState?.quizUnlockedAt ||
      watchState?.lastOpenedAt ||
      (watchState?.watchedSeconds ?? 0) > 0,
  );
}

export function isCoursePretestUnlocked(
  state: Pick<LearnerProgressState, 'lectureWatchStatus' | 'pretest'>,
  options: CourseWorkflowOptions = {},
) {
  if (hasFullCoursePreviewAccess(options)) {
    return true;
  }

  return isPretestComplete(state) || isLectureComplete(state, welcomeLecture.id);
}

export function isPreCourseSurveyComplete(state: Pick<LearnerProgressState, 'preCourseSurvey'>) {
  return Boolean(state.preCourseSurvey.submittedAt);
}

export function getCourseAssessmentProgress(
  state: Pick<LearnerProgressState, 'courseAssessmentResults'>,
  assessmentId: string,
) {
  return state.courseAssessmentResults[assessmentId] ?? null;
}

export function isCourseAssessmentComplete(
  state: Pick<LearnerProgressState, 'courseAssessmentResults'>,
  assessmentId: string,
) {
  return Boolean(getCourseAssessmentProgress(state, assessmentId)?.completedAt);
}

export function isCourseSurveyComplete(state: Pick<LearnerProgressState, 'courseSurvey'>) {
  return Boolean(state.courseSurvey.submittedAt);
}

export function isCourseCertificateUnlocked(
  state: Pick<LearnerProgressState, 'courseAssessmentResults' | 'courseSurvey'>,
) {
  const postTestComplete = finalPostTestAssessment
    ? isCourseAssessmentComplete(state, finalPostTestAssessment.id)
    : true;

  return postTestComplete && isCourseSurveyComplete(state);
}

function isAccountComplete(options: CourseWorkflowOptions = {}) {
  return options.accountComplete ?? true;
}

function getStepPercent(state: LearnerProgressState, step: CourseWorkflowStepDefinition, completed: boolean) {
  if (step.kind === 'lecture' && step.lectureId) {
    const watchState = state.lectureWatchStatus[step.lectureId];

    if (watchState?.completed) {
      return 100;
    }

    const durationSeconds = watchState?.durationSeconds ?? 0;
    const watchedSeconds = watchState?.watchedSeconds ?? 0;
    const watchedPercent =
      durationSeconds > 0 ? Math.round((watchedSeconds / durationSeconds) * 100) : Math.round((watchedSeconds / 600) * 100);

    return Math.max(completed ? 15 : 0, Math.min(90, watchedPercent));
  }

  if (completed) {
    return 100;
  }

  if (step.kind === 'pretest') {
    return state.moduleProgress.pretest.percentComplete;
  }

  return 0;
}

export function isCourseStepComplete(state: LearnerProgressState, step: CourseWorkflowStepDefinition) {
  return isCourseStepCompleteWithOptions(state, step, {});
}

function isCourseStepCompleteWithOptions(
  state: LearnerProgressState,
  step: CourseWorkflowStepDefinition,
  options: CourseWorkflowOptions,
) {
  if (step.kind === 'account') {
    return isAccountComplete(options);
  }

  if (step.kind === 'lecture' && step.lectureId) {
    return isLectureQuizReady(state, step.lectureId);
  }

  if (step.kind === 'welcome' && step.lectureId) {
    return isLectureComplete(state, step.lectureId);
  }

  if (step.kind === 'pre-course-survey') {
    return isPreCourseSurveyComplete(state);
  }

  if (step.kind === 'pretest' || step.kind === 'practice') {
    return isPretestComplete(state);
  }

  if ((step.kind === 'assessment' || step.kind === 'post-test') && step.assessmentId) {
    return isCourseAssessmentComplete(state, step.assessmentId);
  }

  if (step.kind === 'survey') {
    return isCourseSurveyComplete(state);
  }

  if (step.kind === 'certificate') {
    return isCourseCertificateUnlocked(state);
  }

  return false;
}

function getAssessmentLectureTitle(step: CourseWorkflowStepDefinition) {
  if (!step.assessmentId) {
    return step.title;
  }

  const assessment = getCourseAssessmentById(step.assessmentId);
  const lectureId = assessment ? getTrailingLectureId(assessment) : null;
  const lecture = lectureId ? lectureManifest.find((entry) => entry.id === lectureId) : null;

  return lecture?.title ?? step.title.replace(/^Post-lecture \d+(?:-\d+)? quiz:\s*/i, '');
}

export function getLockedReason(previousStep: CourseWorkflowStepDefinition | null) {
  if (!previousStep) {
    return null;
  }

  if (previousStep.kind === 'account') {
    return 'Create an account or sign in to unlock this step.';
  }

  if (previousStep.kind === 'welcome') {
    return `Complete "${previousStep.title}" to unlock this step.`;
  }

  if (previousStep.kind === 'pre-course-survey') {
    return 'Complete "Pre-course survey" to unlock this step.';
  }

  if (previousStep.kind === 'lecture') {
    return `Open "${previousStep.title}" to unlock this step.`;
  }

  if (previousStep.kind === 'pretest') {
    return 'Complete "Pre-test" to unlock this step.';
  }

  if (previousStep.kind === 'assessment') {
    return `Pass the "${getAssessmentLectureTitle(previousStep)}" quiz to unlock this step.`;
  }

  if (previousStep.kind === 'post-test') {
    return 'Complete the final post-test to unlock the post-course survey.';
  }

  if (previousStep.kind === 'survey') {
    return 'Complete the post-course survey to unlock the certificate.';
  }

  return `Complete "${previousStep.title}" to unlock this step.`;
}

function isTimeLockedStep(step: CourseWorkflowStepDefinition, options: CourseWorkflowOptions) {
  return (step.kind === 'post-test' || step.kind === 'survey') && !isCourseEndUnlocked(options.nowMs);
}

function isPostCourseAssessmentStep(step: CourseWorkflowStepDefinition) {
  return step.kind === 'post-test' || step.kind === 'survey';
}

function getStepLockReason({
  postCourseUnlocked,
  previousBlockingStep,
  state,
  step,
  timeLocked,
  options,
}: {
  postCourseUnlocked: boolean;
  previousBlockingStep: CourseWorkflowStepDefinition | null;
  state: LearnerProgressState;
  step: CourseWorkflowStepDefinition;
  timeLocked: boolean;
  options: CourseWorkflowOptions;
}) {
  if (postCourseUnlocked) {
    return null;
  }

  if (isPostCourseAssessmentStep(step)) {
    return getPostCourseAssessmentLockReason(state, options);
  }

  if (step.kind === 'certificate' && isPostCourseAssessmentUnlocked(state, options)) {
    const postTestComplete = finalPostTestAssessment
      ? isCourseAssessmentComplete(state, finalPostTestAssessment.id)
      : true;
    const surveyComplete = isCourseSurveyComplete(state);

    if (!postTestComplete && !surveyComplete) {
      return 'Complete the final post-test and post-course survey to unlock the certificate.';
    }

    if (!postTestComplete) {
      return 'Complete the final post-test to unlock the certificate.';
    }

    return 'Complete the post-course survey to unlock the certificate.';
  }

  return timeLocked && previousBlockingStep === null ? formatCourseEndAvailability() : getLockedReason(previousBlockingStep);
}

export function getCourseStepModels(state: LearnerProgressState, options: CourseWorkflowOptions = {}): CourseWorkflowStepModel[] {
  if (hasFullCoursePreviewAccess(options)) {
    return courseWorkflowSteps.map((step) => {
      const completed = isCourseStepCompleteWithOptions(state, step, options);

      return {
        ...step,
        completed,
        lockedReason: null,
        percent: getStepPercent(state, step, completed),
        status: completed ? 'completed' : 'available',
        unlocked: true,
      };
    });
  }

  let previousBlockingStep: CourseWorkflowStepDefinition | null = null;
  let priorStepsComplete = true;

  return courseWorkflowSteps.map((step) => {
    const completed = isCourseStepCompleteWithOptions(state, step, options);
    const timeLocked = isTimeLockedStep(step, options);
    const postCourseUnlocked = isPostCourseAssessmentStep(step) && isPostCourseAssessmentUnlocked(state, options);
    const unlocked = completed || postCourseUnlocked || (priorStepsComplete && !timeLocked);
    const status = completed ? 'completed' : unlocked && priorStepsComplete ? 'current' : unlocked ? 'available' : 'locked';
    const model: CourseWorkflowStepModel = {
      ...step,
      completed,
      lockedReason: unlocked
        ? null
        : getStepLockReason({
            postCourseUnlocked,
            previousBlockingStep,
            state,
            step,
            timeLocked,
            options,
          }),
      percent: getStepPercent(state, step, completed),
      status,
      unlocked,
    };

    if ((!completed || timeLocked) && priorStepsComplete) {
      previousBlockingStep = step;
      priorStepsComplete = false;
    } else if (!completed) {
      priorStepsComplete = false;
    }

    return model;
  });
}

export function getNextCourseStep(state: LearnerProgressState, options: CourseWorkflowOptions = {}) {
  return getCourseStepModels(state, options).find((step) => step.unlocked && !step.completed) ?? null;
}

export function getCourseGuidanceModel(steps: CourseWorkflowStepModel[]): CourseGuidanceModel {
  const currentIndex = steps.findIndex((step) => step.status === 'current');
  const fallbackIndex = steps.findIndex((step) => step.unlocked && !step.completed);
  const activeIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const currentStep = activeIndex >= 0 ? steps[activeIndex] ?? null : null;
  const nextStep = activeIndex >= 0 ? steps.slice(activeIndex + 1).find((step) => !step.completed) ?? null : null;

  return {
    completedCount: steps.filter((step) => step.completed).length,
    currentStep,
    lockedCount: steps.filter((step) => !step.unlocked).length,
    nextStep,
    totalCount: steps.length,
  };
}

export function getLectureModuleProgressSummary(state: LearnerProgressState) {
  const lectureModuleSteps = courseWorkflowSteps.filter((step) =>
    ['lecture', 'assessment', 'post-test', 'survey'].includes(step.kind),
  );
  const completedCount = lectureModuleSteps.filter((step) => isCourseStepCompleteWithOptions(state, step, {})).length;
  const totalCount = lectureModuleSteps.length;

  return {
    completed: totalCount > 0 && completedCount >= totalCount,
    completedCount,
    percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    totalCount,
  };
}

export function getLectureWorkflowStatus(state: LearnerProgressState, lectureId: string, options: CourseWorkflowOptions = {}) {
  return getCourseStepModels(state, options).find((step) => step.lectureId === lectureId) ?? null;
}

export function getAssessmentWorkflowStatus(
  state: LearnerProgressState,
  assessment: CourseAssessmentContent,
  options: CourseWorkflowOptions = {},
) {
  return getCourseStepModels(state, options).find((step) => step.assessmentId === assessment.id) ?? null;
}

export function getUnlockedCourseAssessments(state: LearnerProgressState, options: CourseWorkflowOptions = {}) {
  return courseAssessments.filter((assessment) => getAssessmentWorkflowStatus(state, assessment, options)?.unlocked);
}
