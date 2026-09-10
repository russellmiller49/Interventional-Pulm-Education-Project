import { describe, expect, it } from 'vitest';

import { courseAssessments, finalPostTestAssessment } from '@/content/courseAssessments';
import { lectureManifest } from '@/content/lectures';
import {
  getCourseGuidanceModel,
  getAssessmentWorkflowStatus,
  getCourseStepModels,
  getLectureWorkflowStatus,
  getNextCourseStep,
  isCoursePretestUnlocked,
} from '@/lib/courseWorkflow';
import { createInitialLearnerProgress, learnerProgressReducer } from '@/lib/progress';

describe('courseWorkflow', () => {
  it('starts with account access before welcome when account is incomplete', () => {
    const state = createInitialLearnerProgress();
    const steps = getCourseStepModels(state, { accountComplete: false });

    expect(steps.find((step) => step.id === 'account')?.unlocked).toBe(true);
    expect(steps.find((step) => step.id === 'lecture-01')?.unlocked).toBe(false);
    expect(steps.find((step) => step.id === 'pretest')?.unlocked).toBe(false);
    expect(isCoursePretestUnlocked(state)).toBe(false);
    expect(getNextCourseStep(state, { accountComplete: false })?.id).toBe('account');

    expect(getCourseStepModels(state, { accountComplete: true }).find((step) => step.id === 'lecture-01')?.unlocked).toBe(
      true,
    );
    expect(getNextCourseStep(state, { accountComplete: true })?.id).toBe('lecture-01');
  });

  it('unlocks the pre-course survey after account and welcome, then Lecture 1 after survey and pre-test submission', () => {
    const afterIntro = learnerProgressReducer(createInitialLearnerProgress(), {
      type: 'setLectureState',
      lectureId: 'lecture-01',
      completed: true,
      watchedSeconds: 120,
    });

    expect(isCoursePretestUnlocked(afterIntro)).toBe(true);
    expect(
      getCourseStepModels(afterIntro, { accountComplete: true }).find((step) => step.id === 'pre-course-survey')
        ?.unlocked,
    ).toBe(true);
    expect(getCourseStepModels(afterIntro, { accountComplete: true }).find((step) => step.id === 'pretest')?.unlocked).toBe(
      false,
    );

    const afterSurvey = learnerProgressReducer(afterIntro, {
      type: 'submitPreCourseSurvey',
      responses: { confidence: 'moderate' },
    });

    const afterPretest = learnerProgressReducer(afterSurvey, {
      type: 'submitPretest',
      score: 20,
      answeredCount: 25,
      totalQuestions: 25,
    });

    expect(
      getCourseStepModels(afterPretest, { accountComplete: true }).find((step) => step.id === 'lecture-02')?.unlocked,
    ).toBe(true);
  });

  it('summarizes current, next, completed, and locked workflow steps for learner guidance', () => {
    const state = createInitialLearnerProgress();
    const steps = getCourseStepModels(state, { accountComplete: false });
    const guidance = getCourseGuidanceModel(steps);

    expect(guidance.currentStep?.id).toBe('account');
    expect(guidance.nextStep?.id).toBe('lecture-01');
    expect(guidance.completedCount).toBe(0);
    expect(guidance.lockedCount).toBeGreaterThan(0);

    const afterAccount = getCourseGuidanceModel(getCourseStepModels(state, { accountComplete: true }));

    expect(afterAccount.currentStep?.id).toBe('lecture-01');
    expect(afterAccount.completedCount).toBe(1);
  });

  it('requires a post-lecture quiz before unlocking the next lecture', () => {
    const state = createInitialLearnerProgress();
    state.lectureWatchStatus['lecture-01'] = {
      completed: true,
      completedAt: '2026-04-10T09:00:00.000Z',
      durationSeconds: 120,
      lastOpenedAt: '2026-04-10T08:30:00.000Z',
      lastPositionSeconds: 120,
      quizUnlockedAt: '2026-04-10T08:30:00.000Z',
      watchedSeconds: 120,
    };
    state.preCourseSurvey.submittedAt = '2026-04-10T09:30:00.000Z';
    state.pretest.submittedAt = '2026-04-10T10:00:00.000Z';
    state.lectureWatchStatus['lecture-02'] = {
      completed: false,
      completedAt: null,
      durationSeconds: 1200,
      lastOpenedAt: '2026-04-10T10:30:00.000Z',
      lastPositionSeconds: 45,
      quizUnlockedAt: '2026-04-10T10:30:00.000Z',
      watchedSeconds: 45,
    };

    expect(getCourseStepModels(state).find((step) => step.id === 'post-lecture-02')?.unlocked).toBe(true);
    expect(getCourseStepModels(state).find((step) => step.id === 'post-lecture-02')?.path).toBe(
      '/lectures?assessment=post-lecture-02',
    );
    expect(getCourseStepModels(state).find((step) => step.id === 'lecture-03')?.unlocked).toBe(false);

    const afterQuiz = learnerProgressReducer(state, {
      type: 'recordCourseAssessmentResult',
      assessmentId: 'post-lecture-02',
      correctCount: 5,
      totalCount: 5,
      percent: 100,
      answers: [],
    });

    expect(getCourseStepModels(afterQuiz).find((step) => step.id === 'lecture-03')?.unlocked).toBe(true);
  });

  it('unlocks the final post-test and post-course survey after course end once the pre-test is complete', () => {
    const state = createInitialLearnerProgress();
    state.pretest.submittedAt = '2026-04-10T10:00:00.000Z';

    const beforeCourseEnd = getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T14:59:59-07:00') });

    expect(beforeCourseEnd.find((step) => step.kind === 'post-test')?.unlocked).toBe(false);
    expect(beforeCourseEnd.find((step) => step.id === 'post-course-survey')?.lockedReason).toBe(
      'Available after the live course on May 31, 2026 at 3:00 PM PT',
    );

    const afterCourseEnd = getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:00:00-07:00') });

    expect(afterCourseEnd.find((step) => step.id === 'lecture-02')?.unlocked).toBe(false);
    expect(afterCourseEnd.find((step) => step.kind === 'post-test')?.unlocked).toBe(true);
    expect(afterCourseEnd.find((step) => step.id === 'post-course-survey')?.unlocked).toBe(true);
    expect(afterCourseEnd.find((step) => step.id === 'certificate')?.lockedReason).toBe(
      'Complete the final post-test and post-course survey to unlock the certificate.',
    );

    state.courseSurvey.submittedAt = '2026-05-31T22:05:00.000Z';

    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.unlocked).toBe(false);
    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.lockedReason).toBe(
      'Complete the final post-test to unlock the certificate.',
    );
  });

  it('unlocks the certificate after the final post-test and survey', () => {
    const state = createInitialLearnerProgress();
    state.lectureWatchStatus['lecture-01'] = {
      completed: true,
      completedAt: '2026-04-10T09:00:00.000Z',
      durationSeconds: 120,
      lastOpenedAt: '2026-04-10T08:30:00.000Z',
      lastPositionSeconds: 120,
      quizUnlockedAt: '2026-04-10T08:30:00.000Z',
      watchedSeconds: 120,
    };
    state.preCourseSurvey.submittedAt = '2026-04-10T09:30:00.000Z';
    state.pretest.submittedAt = '2026-04-10T10:00:00.000Z';

    for (const lecture of lectureManifest) {
      state.lectureWatchStatus[lecture.id] = {
        completed: true,
        completedAt: '2026-04-12T11:00:00.000Z',
        durationSeconds: 600,
        lastOpenedAt: '2026-04-12T10:30:00.000Z',
        lastPositionSeconds: 600,
        quizUnlockedAt: '2026-04-12T10:30:00.000Z',
        watchedSeconds: 600,
      };
    }

    for (const assessment of courseAssessments) {
      state.courseAssessmentResults[assessment.id] = {
        completedAt: '2026-04-12T12:00:00.000Z',
        correctCount: assessment.questions.length,
        totalCount: assessment.questions.length,
        percent: 100,
        attemptCount: 1,
        answers: [],
      };
    }

    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'post-course-survey')?.unlocked).toBe(true);
    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.unlocked).toBe(false);
    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.lockedReason).toBe(
      'Complete the post-course survey to unlock the certificate.',
    );

    state.courseSurvey.submittedAt = '2026-04-12T12:15:00.000Z';

    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.unlocked).toBe(true);

    if (finalPostTestAssessment) {
      delete state.courseAssessmentResults[finalPostTestAssessment.id];
    }

    expect(getCourseStepModels(state, { nowMs: Date.parse('2026-05-31T15:01:00-07:00') }).find((step) => step.id === 'certificate')?.unlocked).toBe(false);
  });

  it('unlocks the full course workflow for admin preview without marking steps complete', () => {
    const state = createInitialLearnerProgress();
    const steps = getCourseStepModels(state, { admin: true });

    expect(steps.every((step) => step.unlocked)).toBe(true);
    expect(steps.find((step) => step.id === 'pretest')?.completed).toBe(false);
    expect(steps.find((step) => step.id === 'certificate')?.lockedReason).toBeNull();
    expect(getNextCourseStep(state, { admin: true })?.id).toBe('lecture-01');
    expect(getLectureWorkflowStatus(state, 'lecture-20', { admin: true })?.unlocked).toBe(true);
    expect(getAssessmentWorkflowStatus(state, courseAssessments[0]!, { admin: true })?.unlocked).toBe(true);
  });

  it('unlocks the full course workflow for sponsor preview without marking steps complete', () => {
    const state = createInitialLearnerProgress();
    const steps = getCourseStepModels(state, { preview: true });

    expect(steps.every((step) => step.unlocked)).toBe(true);
    expect(steps.find((step) => step.id === 'pretest')?.completed).toBe(false);
    expect(isCoursePretestUnlocked(state, { preview: true })).toBe(true);
    expect(getLectureWorkflowStatus(state, 'lecture-20', { preview: true })?.unlocked).toBe(true);
    expect(getAssessmentWorkflowStatus(state, courseAssessments[0]!, { preview: true })?.unlocked).toBe(true);
  });
});
