import { describe, expect, it } from 'vitest';

import {
  chooseStoredLearnerProgress,
  createInitialLearnerProgress,
  getLearnerProgressStorageKey,
  learnerProgressReducer,
  normalizeLearnerProgress,
  parseStoredLearnerProgress,
} from '@/lib/progress';

describe('learnerProgressReducer', () => {
  it('records lecture completion and preserves the larger watched duration', () => {
    const initial = createInitialLearnerProgress();
    const state = learnerProgressReducer(initial, {
      type: 'setLectureState',
      lectureId: 'lecture-01',
      watchedSeconds: 120,
      completed: false,
    });
    const next = learnerProgressReducer(state, {
      type: 'setLectureState',
      lectureId: 'lecture-01',
      watchedSeconds: 30,
      completed: true,
    });

    expect(next.lectureWatchStatus['lecture-01']).toMatchObject({
      watchedSeconds: 120,
      completed: true,
      completedAt: expect.any(String),
      quizUnlockedAt: expect.any(String),
    });
  });

  it('stores lecture viewing metrics without requiring full completion', () => {
    const initial = createInitialLearnerProgress();
    const state = learnerProgressReducer(initial, {
      type: 'setLectureState',
      lectureId: 'lecture-02',
      durationSeconds: 1200,
      lastPositionSeconds: 35,
      quizReady: true,
      watchedSeconds: 30,
    });

    expect(state.lectureWatchStatus['lecture-02']).toMatchObject({
      completed: false,
      completedAt: null,
      durationSeconds: 1200,
      lastPositionSeconds: 35,
      quizUnlockedAt: expect.any(String),
      watchedSeconds: 30,
    });
  });

  it('accumulates tracked engagement time by learning module', () => {
    const initial = createInitialLearnerProgress();
    const next = learnerProgressReducer(initial, {
      type: 'recordModuleEngagement',
      moduleId: 'simulator',
      seconds: 95,
    });

    expect(next.engagement.simulator.totalSeconds).toBe(95);
    expect(next.engagement.simulator.lastTrackedAt).toEqual(expect.any(String));
  });

  it('tracks the simulator as a first-class module route', () => {
    const initial = createInitialLearnerProgress();
    const next = learnerProgressReducer(initial, {
      type: 'visitModule',
      moduleId: 'simulator',
    });

    expect(next.moduleProgress.simulator.percentComplete).toBe(15);
    expect(next.moduleProgress.simulator.visitedAt).toEqual(expect.any(String));
  });

  it('tracks TNM staging progress and case tag performance', () => {
    const initial = createInitialLearnerProgress();
    const visited = learnerProgressReducer(initial, {
      type: 'visitModule',
      moduleId: 'tnm-staging',
    });
    const attempted = learnerProgressReducer(visited, {
      type: 'recordTnmCaseAttempt',
      caseId: 'tnm-case-01',
      tags: ['T1c', 'N0'],
      correct: true,
    });

    expect(attempted.version).toBe(9);
    expect(attempted.moduleProgress['tnm-staging'].percentComplete).toBe(15);
    expect(attempted.tnmCaseStats['tnm-case-01']).toMatchObject({ attempts: 1, correct: 1 });
    expect(attempted.tnmTagStats.T1c).toMatchObject({ attempts: 1, correct: 1 });
    expect(attempted.lastViewedTnmCaseId).toBe('tnm-case-01');
  });

  it('normalizes malformed persisted state back to defaults', () => {
    const normalized = normalizeLearnerProgress({
      moduleProgress: {
        knobology: {
          visitedAt: 42,
          percentComplete: 500,
        },
      },
      bookmarkedStations: ['4R', null],
    });

    expect(normalized.moduleProgress.knobology.percentComplete).toBe(100);
    expect(normalized.moduleProgress.simulator.percentComplete).toBe(0);
    expect(normalized.moduleProgress['tnm-staging'].percentComplete).toBe(0);
    expect(normalized.moduleProgress.knobology.visitedAt).toBeNull();
    expect(normalized.bookmarkedStations).toEqual(['4R']);
    expect(normalized.engagement.lectures.totalSeconds).toBe(0);
    expect(normalized.engagement['tnm-staging'].totalSeconds).toBe(0);
    expect(normalized.courseAssessmentResults).toEqual({});
    expect(normalized.courseSurvey.submittedAt).toBeNull();
  });

  it('stores course assessment results and survey completion for the gated course path', () => {
    const initial = createInitialLearnerProgress();
    const assessed = learnerProgressReducer(initial, {
      type: 'recordCourseAssessmentResult',
      assessmentId: 'post-lecture-02',
      correctCount: 4,
      totalCount: 5,
      percent: 80,
      answers: [
        {
          questionId: 'quiz-q1',
          selectedOptionIds: ['a'],
          correctOptionIds: ['a'],
          isCorrect: true,
        },
      ],
    });
    const surveyed = learnerProgressReducer(assessed, {
      type: 'submitCourseSurvey',
      responses: {
        confidence: 'More confident with cpEBUS fundamentals',
      },
    });

    expect(assessed.courseAssessmentResults['post-lecture-02']).toMatchObject({
      correctCount: 4,
      totalCount: 5,
      percent: 80,
      attemptCount: 1,
      answers: [
        {
          questionId: 'quiz-q1',
          selectedOptionIds: ['a'],
          correctOptionIds: ['a'],
          isCorrect: true,
        },
      ],
      completedAt: expect.any(String),
    });
    expect(surveyed.courseSurvey.submittedAt).toEqual(expect.any(String));
    expect(surveyed.courseSurvey.responses.confidence).toBe('More confident with cpEBUS fundamentals');
  });

  it('stores and submits the web pretest locally', () => {
    const initial = createInitialLearnerProgress();
    const answered = learnerProgressReducer(initial, {
      type: 'setPretestAnswer',
      questionId: 'pretest-01',
      optionId: 'b',
    });
    const indexed = learnerProgressReducer(answered, {
      type: 'setPretestQuestionIndex',
      index: 9,
    });
    const submitted = learnerProgressReducer(indexed, {
      type: 'submitPretest',
      score: 16,
      answeredCount: 20,
      totalQuestions: 20,
    });

    expect(submitted.pretest.answers['pretest-01']).toBe('b');
    expect(submitted.pretest.currentQuestionIndex).toBe(9);
    expect(submitted.pretest.score).toBe(16);
    expect(submitted.pretest.answeredCount).toBe(20);
    expect(submitted.pretest.totalQuestions).toBe(20);
    expect(submitted.pretest.attemptCount).toBe(1);
    expect(submitted.pretest.submittedAt).toEqual(expect.any(String));
  });

  it('stores a separate passcode unlock for admin and developer access', () => {
    const initial = createInitialLearnerProgress();
    const unlocked = learnerProgressReducer(initial, {
      type: 'unlockPretestWithPasscode',
    });
    const repeated = learnerProgressReducer(unlocked, {
      type: 'unlockPretestWithPasscode',
    });

    expect(unlocked.pretest.unlockedByPasscodeAt).toEqual(expect.any(String));
    expect(unlocked.pretest.submittedAt).toBeNull();
    expect(repeated.pretest.unlockedByPasscodeAt).toBe(unlocked.pretest.unlockedByPasscodeAt);
  });

  it('parses legacy local progress payloads and scopes signed-in storage keys', () => {
    const parsed = parseStoredLearnerProgress({
      bookmarkedStations: ['4R'],
    });

    expect(parsed?.state.bookmarkedStations).toEqual(['4R']);
    expect(parsed?.savedAt).toBeNull();
    expect(getLearnerProgressStorageKey('learner-123')).toBe('socal-ebus-prep.web.learner-progress:learner-123');
  });

  it('prefers the newer remote snapshot over stale local storage', () => {
    const local = {
      savedAt: '2026-04-01T10:00:00.000Z',
      state: createInitialLearnerProgress(),
    };
    const remoteState = createInitialLearnerProgress();
    remoteState.pretest.submittedAt = '2026-04-02T09:00:00.000Z';
    const remote = {
      savedAt: '2026-04-02T10:00:00.000Z',
      state: remoteState,
    };

    expect(chooseStoredLearnerProgress(local, remote)).toBe(remote);
  });

  it('prefers the more complete remote snapshot over a newer stale local save', () => {
    const localState = createInitialLearnerProgress();
    localState.lectureWatchStatus['lecture-01'] = {
      completed: true,
      completedAt: '2026-05-01T17:00:00.000Z',
      durationSeconds: 600,
      lastOpenedAt: '2026-05-01T17:00:00.000Z',
      lastPositionSeconds: 60,
      quizUnlockedAt: '2026-05-01T17:00:00.000Z',
      watchedSeconds: 60,
    };

    const remoteState = createInitialLearnerProgress();
    remoteState.pretest.submittedAt = '2026-05-01T15:00:00.000Z';
    remoteState.pretest.answeredCount = 25;
    remoteState.pretest.totalQuestions = 25;
    remoteState.lectureWatchStatus['lecture-01'] = {
      completed: true,
      completedAt: '2026-05-01T15:00:00.000Z',
      durationSeconds: 600,
      lastOpenedAt: '2026-05-01T15:00:00.000Z',
      lastPositionSeconds: 600,
      quizUnlockedAt: '2026-05-01T15:00:00.000Z',
      watchedSeconds: 600,
    };
    remoteState.lectureWatchStatus['lecture-02'] = {
      completed: true,
      completedAt: '2026-05-01T15:00:00.000Z',
      durationSeconds: 600,
      lastOpenedAt: '2026-05-01T15:00:00.000Z',
      lastPositionSeconds: 600,
      quizUnlockedAt: '2026-05-01T15:00:00.000Z',
      watchedSeconds: 600,
    };

    const local = {
      savedAt: '2026-05-01T17:30:00.000Z',
      state: localState,
    };
    const remote = {
      savedAt: '2026-05-01T15:30:00.000Z',
      state: remoteState,
    };

    expect(chooseStoredLearnerProgress(local, remote)).toBe(remote);
  });
});
