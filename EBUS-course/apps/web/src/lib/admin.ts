import { finalPostTestAssessment } from '@/content/courseAssessments';
import {
  type CourseSurveyDefinition,
  type CourseSurveyResponseRow,
  getCourseSurveyResponseRows,
  postCourseSurveyDefinition,
  preCourseSurveyDefinition,
} from '@/content/courseSurveys';
import { pretestContent } from '@/content/pretest';
import type { PretestQuestionContent, QuizQuestionContent } from '@/content/types';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export interface AdminModuleProgress {
  moduleId: string;
  percentComplete: number;
  visitedAt: string | null;
  completedAt: string | null;
  timeSpentSeconds: number;
}

export interface AdminLectureSummary {
  averageViewedPercent: number;
  completedCount: number;
  quizReadyCount: number;
  totalWatchedSeconds: number;
  lastOpenedAt: string | null;
}

export interface AdminAnswerDetail {
  questionId: string;
  prompt: string;
  selectedOptionIds: string[];
  selectedLabels: string[];
  correctOptionIds: string[];
  correctLabels: string[];
  isCorrect: boolean;
}

export interface AdminSurveyResult {
  responses: CourseSurveyResponseRow[];
  submittedAt: string | null;
  surveyId: string;
  updatedAt: string | null;
  version: number | null;
}

export interface AdminLearnerOverview {
  id: string;
  email: string | null;
  fullName: string | null;
  degree: string | null;
  institution: string | null;
  institutionalEmail: string | null;
  fellowshipYear: string | null;
  flexibleBronchoscopyCount: number | null;
  ebusCount: number | null;
  ebusConfidence: string | null;
  approvalStatus: 'pending' | 'approved';
  approvedAt: string | null;
  approvedBy: string | null;
  inviteSentAt: string | null;
  lastSignInAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  snapshotUpdatedAt: string | null;
  pretestPercent: number | null;
  pretestSubmittedAt: string | null;
  pretestAnswers: AdminAnswerDetail[];
  preCourseSurvey: AdminSurveyResult;
  postCourseSurvey: AdminSurveyResult;
  postTestAnswers: AdminAnswerDetail[];
  postTestSubmittedAt: string | null;
  totalTimeSpentSeconds: number;
  moduleProgress: AdminModuleProgress[];
  lectureSummary: AdminLectureSummary;
}

export interface AdminProgressSummary {
  approvedCount: number;
  averageProgressPercent: number;
  pendingCount: number;
  postCourseCompleteCount: number;
  totalLearners: number;
}

const DEFAULT_LECTURE_SUMMARY: AdminLectureSummary = {
  averageViewedPercent: 0,
  completedCount: 0,
  quizReadyCount: 0,
  totalWatchedSeconds: 0,
  lastOpenedAt: null,
};

function readString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(candidate: unknown): string[] {
  return Array.isArray(candidate) ? candidate.filter((value): value is string => typeof value === 'string') : [];
}

function readApprovalStatus(value: unknown): 'pending' | 'approved' {
  return value === 'approved' ? 'approved' : 'pending';
}

function normalizeModuleProgress(candidate: unknown): AdminModuleProgress[] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const raw = entry as Record<string, unknown>;
    const moduleId = readString(raw.moduleId);

    if (!moduleId) {
      return [];
    }

    return [
      {
        moduleId,
        percentComplete: Math.max(0, Math.min(100, readNumber(raw.percentComplete) ?? 0)),
        visitedAt: readString(raw.visitedAt),
        completedAt: readString(raw.completedAt),
        timeSpentSeconds: Math.max(0, Math.floor(readNumber(raw.timeSpentSeconds) ?? 0)),
      },
    ];
  });
}

function normalizeLectureSummary(candidate: unknown): AdminLectureSummary {
  if (!candidate || typeof candidate !== 'object') {
    return DEFAULT_LECTURE_SUMMARY;
  }

  const raw = candidate as Record<string, unknown>;

  return {
    averageViewedPercent: Math.max(0, Math.min(100, Math.floor(readNumber(raw.averageViewedPercent) ?? 0))),
    completedCount: Math.max(0, Math.floor(readNumber(raw.completedCount) ?? 0)),
    quizReadyCount: Math.max(0, Math.floor(readNumber(raw.quizReadyCount) ?? 0)),
    totalWatchedSeconds: Math.max(0, Math.floor(readNumber(raw.totalWatchedSeconds) ?? 0)),
    lastOpenedAt: readString(raw.lastOpenedAt),
  };
}

function getPretestOptionLabel(question: PretestQuestionContent, optionId: string) {
  return question.options.find((option) => option.id === optionId)?.label ?? optionId;
}

function getQuizOptionLabel(question: QuizQuestionContent, optionId: string) {
  return question.options.find((option) => option.id === optionId)?.label ?? optionId;
}

function normalizePretestAnswerDetails(candidate: unknown): AdminAnswerDetail[] {
  const rawAnswers = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};

  if (Object.keys(rawAnswers).length === 0) {
    return [];
  }

  return pretestContent.questions.map((question) => {
    const selectedOptionId = readString(rawAnswers[question.id]);
    const selectedOptionIds = selectedOptionId ? [selectedOptionId] : [];
    const correctOptionIds = [question.correctOptionId];

    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionIds,
      selectedLabels: selectedOptionIds.map((optionId) => getPretestOptionLabel(question, optionId)),
      correctOptionIds,
      correctLabels: correctOptionIds.map((optionId) => getPretestOptionLabel(question, optionId)),
      isCorrect: selectedOptionId === question.correctOptionId,
    };
  });
}

function normalizePostTestAnswerDetails(candidate: unknown): AdminAnswerDetail[] {
  if (!finalPostTestAssessment || !candidate || typeof candidate !== 'object') {
    return [];
  }

  const assessmentResults = candidate as Record<string, unknown>;
  const postTestResult = assessmentResults[finalPostTestAssessment.id];

  if (!postTestResult || typeof postTestResult !== 'object') {
    return [];
  }

  const answerRecords = (postTestResult as Record<string, unknown>).answers;

  if (!Array.isArray(answerRecords)) {
    return [];
  }

  const answerByQuestionId = new Map(
    answerRecords.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const raw = entry as Record<string, unknown>;
      const questionId = readString(raw.questionId);

      return questionId
        ? [
            [
              questionId,
              {
                selectedOptionIds: normalizeStringArray(raw.selectedOptionIds),
                correctOptionIds: normalizeStringArray(raw.correctOptionIds),
                isCorrect: raw.isCorrect === true,
              },
            ] as const,
          ]
        : [];
    }),
  );

  return finalPostTestAssessment.questions.map((question) => {
    const answer = answerByQuestionId.get(question.id);
    const selectedOptionIds = answer?.selectedOptionIds ?? [];
    const correctOptionIds = answer?.correctOptionIds.length ? answer.correctOptionIds : question.correctOptionIds;

    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionIds,
      selectedLabels: selectedOptionIds.map((optionId) => getQuizOptionLabel(question, optionId)),
      correctOptionIds,
      correctLabels: correctOptionIds.map((optionId) => getQuizOptionLabel(question, optionId)),
      isCorrect: answer?.isCorrect ?? false,
    };
  });
}

function normalizePostTestSubmittedAt(candidate: unknown) {
  if (!finalPostTestAssessment || !candidate || typeof candidate !== 'object') {
    return null;
  }

  const assessmentResults = candidate as Record<string, unknown>;
  const postTestResult = assessmentResults[finalPostTestAssessment.id];

  if (!postTestResult || typeof postTestResult !== 'object') {
    return null;
  }

  return readString((postTestResult as Record<string, unknown>).completedAt);
}

function normalizeSurveyResult(candidate: unknown, definition: CourseSurveyDefinition): AdminSurveyResult {
  const raw = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
  const responses = raw.responses && typeof raw.responses === 'object' ? (raw.responses as Record<string, unknown>) : {};
  const stringResponses = Object.fromEntries(
    Object.entries(responses).flatMap(([questionId, value]) =>
      typeof value === 'string' ? [[questionId, value]] : [],
    ),
  );

  return {
    responses: getCourseSurveyResponseRows(definition, stringResponses),
    submittedAt: readString(raw.submittedAt),
    surveyId: readString(raw.surveyId) ?? definition.id,
    updatedAt: readString(raw.updatedAt),
    version: readNumber(raw.version),
  };
}

export function normalizeAdminLearnerOverview(candidate: unknown): AdminLearnerOverview {
  const raw = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};

  return {
    id: readString(raw.learner_id) ?? '',
    email: readString(raw.email),
    fullName: readString(raw.full_name),
    degree: readString(raw.degree),
    institution: readString(raw.institution),
    institutionalEmail: readString(raw.institutional_email),
    fellowshipYear: readString(raw.fellowship_year),
    flexibleBronchoscopyCount: readNumber(raw.flexible_bronchoscopy_count),
    ebusCount: readNumber(raw.ebus_count),
    ebusConfidence: readString(raw.ebus_confidence),
    approvalStatus: readApprovalStatus(raw.approval_status),
    approvedAt: readString(raw.approved_at),
    approvedBy: readString(raw.approved_by),
    inviteSentAt: readString(raw.invite_sent_at),
    lastSignInAt: readString(raw.last_sign_in_at),
    onboardingCompletedAt: readString(raw.onboarding_completed_at),
    createdAt: readString(raw.created_at),
    updatedAt: readString(raw.updated_at),
    snapshotUpdatedAt: readString(raw.snapshot_updated_at),
    pretestPercent: readNumber(raw.pretest_percent),
    pretestSubmittedAt: readString(raw.pretest_submitted_at),
    pretestAnswers: normalizePretestAnswerDetails(raw.pretest_answers),
    preCourseSurvey: normalizeSurveyResult(raw.pre_course_survey_results, preCourseSurveyDefinition),
    postCourseSurvey: normalizeSurveyResult(raw.post_course_survey_results, postCourseSurveyDefinition),
    postTestAnswers: normalizePostTestAnswerDetails(raw.assessment_results),
    postTestSubmittedAt: normalizePostTestSubmittedAt(raw.assessment_results),
    totalTimeSpentSeconds: Math.max(0, Math.floor(readNumber(raw.total_time_spent_seconds) ?? 0)),
    moduleProgress: normalizeModuleProgress(raw.module_progress),
    lectureSummary: normalizeLectureSummary(raw.lecture_summary),
  };
}

export function isLearnerPostCourseComplete(
  learner: Pick<AdminLearnerOverview, 'postCourseSurvey' | 'postTestSubmittedAt'>,
) {
  return Boolean(learner.postTestSubmittedAt && learner.postCourseSurvey.submittedAt);
}

export function getLearnerAverageProgress(learner: Pick<AdminLearnerOverview, 'moduleProgress'>) {
  const activeModuleProgress = learner.moduleProgress.filter(
    (module) => module.moduleId !== 'quiz' && module.moduleId !== 'case-001',
  );

  if (activeModuleProgress.length === 0) {
    return 0;
  }

  const total = activeModuleProgress.reduce((sum, module) => sum + module.percentComplete, 0);

  return Math.round(total / activeModuleProgress.length);
}

export function buildAdminProgressSummary(learners: AdminLearnerOverview[]): AdminProgressSummary {
  const approvedCount = learners.filter((learner) => learner.approvalStatus === 'approved').length;
  const pendingCount = learners.length - approvedCount;
  const postCourseCompleteCount = learners.filter(isLearnerPostCourseComplete).length;
  const progressTotal = learners.reduce((sum, learner) => sum + getLearnerAverageProgress(learner), 0);

  return {
    approvedCount,
    averageProgressPercent: learners.length > 0 ? Math.round(progressTotal / learners.length) : 0,
    pendingCount,
    postCourseCompleteCount,
    totalLearners: learners.length,
  };
}

export async function fetchAdminLearnerOverview(passcode: string) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for this environment.');
  }

  const { data, error } = await client.rpc('get_admin_learner_overview', {
    admin_passcode: passcode,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data.map(normalizeAdminLearnerOverview) : [];
}

export async function approveLearner(passcode: string, learnerId: string) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for this environment.');
  }

  const { error } = await client.rpc('approve_learner', {
    admin_passcode: passcode,
    target_learner_id: learnerId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
