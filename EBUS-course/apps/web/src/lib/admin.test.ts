import { describe, expect, it } from 'vitest';

import { pretestContent } from '@/content/pretest';
import {
  buildAdminProgressSummary,
  getLearnerAverageProgress,
  isLearnerPostCourseComplete,
  normalizeAdminLearnerOverview,
  type AdminLearnerOverview,
} from '@/lib/admin';

function createLearner(overrides: Partial<AdminLearnerOverview> = {}): AdminLearnerOverview {
  return {
    id: 'learner-1',
    email: 'learner@example.edu',
    fullName: 'Learner One',
    degree: 'MD',
    institution: 'Training Program',
    institutionalEmail: 'learner@example.edu',
    fellowshipYear: 'first',
    flexibleBronchoscopyCount: 0,
    ebusCount: 0,
    ebusConfidence: 'moderate',
    approvalStatus: 'pending',
    approvedAt: null,
    approvedBy: null,
    inviteSentAt: null,
    lastSignInAt: null,
    onboardingCompletedAt: null,
    createdAt: null,
    updatedAt: null,
    snapshotUpdatedAt: null,
    pretestPercent: null,
    pretestSubmittedAt: null,
    pretestAnswers: [],
    preCourseSurvey: {
      responses: [],
      submittedAt: null,
      surveyId: 'pre-course-2026',
      updatedAt: null,
      version: null,
    },
    postCourseSurvey: {
      responses: [],
      submittedAt: null,
      surveyId: 'post-course-2026',
      updatedAt: null,
      version: null,
    },
    postTestAnswers: [],
    postTestSubmittedAt: null,
    totalTimeSpentSeconds: 0,
    moduleProgress: [],
    lectureSummary: {
      averageViewedPercent: 0,
      completedCount: 0,
      quizReadyCount: 0,
      totalWatchedSeconds: 0,
      lastOpenedAt: null,
    },
    ...overrides,
  };
}

describe('admin learner overview helpers', () => {
  it('normalizes RPC rows into dashboard-friendly learner records', () => {
    const firstPretestQuestion = pretestContent.questions[0]!;

    const learner = normalizeAdminLearnerOverview({
      learner_id: 'learner-1',
      email: 'learner@example.edu',
      full_name: 'Learner One',
      approval_status: 'approved',
      pretest_percent: 86,
      pretest_answers: {
        [firstPretestQuestion.id]: firstPretestQuestion.correctOptionId,
      },
      pre_course_survey_results: {
        surveyId: 'pre-course-2026',
        version: 1,
        submittedAt: '2026-04-20T09:30:00.000Z',
        responses: {
          'pgy-level': 'pgy-5',
          'standard-bronchoscopy-count': '26-50',
        },
        updatedAt: '2026-04-20T09:31:00.000Z',
      },
      post_course_survey_results: {
        surveyId: 'post-course-2026',
        version: 1,
        submittedAt: '2026-05-03T16:30:00.000Z',
        responses: {
          'planned-employment-model': 'academic-tertiary-center',
          'recommend-course-likelihood': '10',
        },
      },
      assessment_results: {
        'post-test': {
          completedAt: '2026-05-03T16:15:00.000Z',
          answers: [
            {
              questionId: 'post-test-q01',
              selectedOptionIds: ['a'],
              correctOptionIds: ['a'],
              isCorrect: true,
            },
          ],
        },
      },
      total_time_spent_seconds: 1200,
      module_progress: [
        {
          moduleId: 'knobology',
          percentComplete: 125,
          visitedAt: '2026-04-20T10:00:00.000Z',
          completedAt: null,
          timeSpentSeconds: 300,
        },
      ],
      lecture_summary: {
        averageViewedPercent: 45,
        completedCount: 3,
        quizReadyCount: 5,
        totalWatchedSeconds: 900,
        lastOpenedAt: '2026-04-21T10:00:00.000Z',
      },
    });

    expect(learner.approvalStatus).toBe('approved');
    expect(learner.pretestPercent).toBe(86);
    expect(learner.pretestAnswers[0]).toMatchObject({
      questionId: firstPretestQuestion.id,
      isCorrect: true,
      selectedOptionIds: [firstPretestQuestion.correctOptionId],
      correctOptionIds: [firstPretestQuestion.correctOptionId],
    });
    expect(learner.preCourseSurvey).toMatchObject({
      submittedAt: '2026-04-20T09:30:00.000Z',
      surveyId: 'pre-course-2026',
      version: 1,
    });
    expect(learner.preCourseSurvey.responses).toEqual([
      {
        prompt: 'Please list your PGY level.',
        questionId: 'pgy-level',
        response: '5',
      },
      {
        prompt:
          'Approximately how many standard bronchoscopies (non-EBUS or navigational) have you performed as the primary operator?',
        questionId: 'standard-bronchoscopy-count',
        response: '26-50',
      },
    ]);
    expect(learner.postCourseSurvey.responses).toEqual([
      {
        prompt: 'In what type of employment model do you hope to / plan on practicing after graduation?',
        questionId: 'planned-employment-model',
        response: 'Academic / university-based tertiary center',
      },
      {
        prompt: 'If asked, how likely are you to recommend this course to future pulmonary fellows?',
        questionId: 'recommend-course-likelihood',
        response: '10',
      },
    ]);
    expect(learner.postTestAnswers[0]).toMatchObject({
      questionId: 'post-test-q01',
      isCorrect: true,
      selectedOptionIds: ['a'],
      correctOptionIds: ['a'],
    });
    expect(learner.postTestSubmittedAt).toBe('2026-05-03T16:15:00.000Z');
    expect(isLearnerPostCourseComplete(learner)).toBe(true);
    expect(learner.totalTimeSpentSeconds).toBe(1200);
    expect(learner.moduleProgress[0]).toMatchObject({
      moduleId: 'knobology',
      percentComplete: 100,
      timeSpentSeconds: 300,
    });
    expect(learner.lectureSummary.completedCount).toBe(3);
    expect(learner.lectureSummary.quizReadyCount).toBe(5);
    expect(learner.lectureSummary.averageViewedPercent).toBe(45);
    expect(learner.lectureSummary.totalWatchedSeconds).toBe(900);
  });

  it('summarizes learner approval counts and average progress', () => {
    const pending = createLearner({
      moduleProgress: [
        { moduleId: 'pretest', percentComplete: 50, visitedAt: null, completedAt: null, timeSpentSeconds: 0 },
      ],
    });
    const approved = createLearner({
      id: 'learner-2',
      approvalStatus: 'approved',
      postCourseSurvey: {
        responses: [],
        submittedAt: '2026-05-31T22:30:00.000Z',
        surveyId: 'post-course-2026',
        updatedAt: null,
        version: null,
      },
      postTestSubmittedAt: '2026-05-31T22:15:00.000Z',
      moduleProgress: [
        { moduleId: 'pretest', percentComplete: 100, visitedAt: null, completedAt: null, timeSpentSeconds: 0 },
        { moduleId: 'lectures', percentComplete: 80, visitedAt: null, completedAt: null, timeSpentSeconds: 0 },
      ],
    });

    expect(getLearnerAverageProgress(approved)).toBe(90);
    expect(buildAdminProgressSummary([pending, approved])).toEqual({
      approvedCount: 1,
      averageProgressPercent: 70,
      pendingCount: 1,
      postCourseCompleteCount: 1,
      totalLearners: 2,
    });
  });

  it('requires post-test completion and post-course survey for admin completion highlighting', () => {
    expect(
      isLearnerPostCourseComplete(
        createLearner({
          postCourseSurvey: {
            responses: [],
            submittedAt: '2026-05-31T22:30:00.000Z',
            surveyId: 'post-course-2026',
            updatedAt: null,
            version: null,
          },
          postTestSubmittedAt: null,
        }),
      ),
    ).toBe(false);

    expect(
      isLearnerPostCourseComplete(
        createLearner({
          postCourseSurvey: {
            responses: [],
            submittedAt: '2026-05-31T22:30:00.000Z',
            surveyId: 'post-course-2026',
            updatedAt: null,
            version: null,
          },
          postTestSubmittedAt: '2026-05-31T22:15:00.000Z',
        }),
      ),
    ).toBe(true);
  });
});
