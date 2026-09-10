import { describe, expect, it } from 'vitest';

import { courseAssessments } from '@/content/courseAssessments';
import { lectureManifest } from '@/content/lectures';
import { welcomeLecture } from '@/content/welcome';
import {
  canAccessRoute,
  clearCourseAdminPasscode,
  getLockedRoutePath,
  getRouteLockReason,
  isCourseAdminSessionActive,
  isCourseVendorSessionActive,
  routeRequiresPretest,
  validateCourseAdminPasscode,
  validateCourseVendorPasscode,
  validatePretestAdminPasscode,
} from '@/lib/access';
import { createInitialLearnerProgress } from '@/lib/progress';

function createAdminStorage(passcode: string) {
  let storedPasscode = passcode;

  return {
    getItem: () => storedPasscode,
    removeItem: () => {
      storedPasscode = '';
    },
    setItem: (_key: string, value: string) => {
      storedPasscode = value;
    },
  };
}

function createPostCourseReadyState() {
  const state = createInitialLearnerProgress();

  state.preCourseSurvey.submittedAt = '2026-04-06T09:30:00.000Z';
  state.pretest.submittedAt = '2026-04-06T10:00:00.000Z';

  for (const lecture of [welcomeLecture, ...lectureManifest]) {
    state.lectureWatchStatus[lecture.id] = {
      completed: true,
      completedAt: '2026-04-06T09:00:00.000Z',
      durationSeconds: 60,
      lastOpenedAt: '2026-04-06T09:00:00.000Z',
      lastPositionSeconds: 60,
      quizUnlockedAt: '2026-04-06T09:00:00.000Z',
      watchedSeconds: 60,
    };
  }

  for (const assessment of courseAssessments.filter((entry) => entry.kind !== 'post-test')) {
    state.courseAssessmentResults[assessment.id] = {
      completedAt: '2026-04-06T11:00:00.000Z',
      correctCount: assessment.questions.length,
      totalCount: assessment.questions.length,
      percent: 100,
      attemptCount: 1,
      answers: [],
    };
  }

  return state;
}

describe('course access helpers', () => {
  it('keeps the home screen outside the pretest gate', () => {
    expect(routeRequiresPretest('home')).toBe(false);
    expect(routeRequiresPretest('progress')).toBe(false);
    expect(routeRequiresPretest('sponsors')).toBe(false);
    expect(routeRequiresPretest('admin')).toBe(false);
    expect(routeRequiresPretest('pretest')).toBe(false);
    expect(routeRequiresPretest('lectures')).toBe(false);
    expect(routeRequiresPretest('knobology')).toBe(false);
    expect(routeRequiresPretest('stations')).toBe(false);
    expect(routeRequiresPretest('case-001')).toBe(false);
    expect(routeRequiresPretest('simulator')).toBe(false);
    expect(routeRequiresPretest('tnm-staging')).toBe(false);
  });

  it('unlocks the pre-course flow after welcome while public training modules stay open', () => {
    const state = createInitialLearnerProgress();

    expect(canAccessRoute('lectures', state)).toBe(true);
    expect(canAccessRoute('progress', state)).toBe(true);
    expect(canAccessRoute('sponsors', state)).toBe(true);
    expect(canAccessRoute('pretest', state)).toBe(false);
    expect(getLockedRoutePath('pretest', '/pretest', state)).toBe('/');
    expect(canAccessRoute('knobology', state)).toBe(true);
    expect(canAccessRoute('stations', state)).toBe(true);
    expect(canAccessRoute('simulator', state)).toBe(true);
    expect(canAccessRoute('tnm-staging', state)).toBe(true);
    expect(getLockedRoutePath('knobology', '/knobology', state)).toBe('/knobology');
    expect(getLockedRoutePath('stations', '/stations/explore', state)).toBe('/stations/explore');
    expect(getRouteLockReason('simulator', state)).toBeNull();

    state.lectureWatchStatus['lecture-01'] = {
      completed: true,
      completedAt: '2026-04-06T09:00:00.000Z',
      durationSeconds: 60,
      lastOpenedAt: '2026-04-06T09:00:00.000Z',
      lastPositionSeconds: 60,
      quizUnlockedAt: '2026-04-06T09:00:00.000Z',
      watchedSeconds: 60,
    };

    expect(canAccessRoute('pretest', state)).toBe(true);

    state.preCourseSurvey.submittedAt = '2026-04-06T09:30:00.000Z';
    state.pretest.submittedAt = '2026-04-06T10:00:00.000Z';

    state.courseAssessmentResults['post-lecture-02'] = {
      completedAt: '2026-04-06T11:00:00.000Z',
      correctCount: 5,
      totalCount: 5,
      percent: 100,
      attemptCount: 1,
      answers: [],
    };

    expect(canAccessRoute('knobology', state)).toBe(true);
  });

  it('allows the admin/developer passcode to satisfy the pretest gate', () => {
    const state = createInitialLearnerProgress();

    expect(validatePretestAdminPasscode('EBUS_2026')).toBe(true);
    expect(validateCourseAdminPasscode('EBUS_2026')).toBe(true);
    expect(validatePretestAdminPasscode('wrong')).toBe(false);

    state.pretest.unlockedByPasscodeAt = '2026-04-15T10:00:00.000Z';

    expect(canAccessRoute('pretest', state)).toBe(true);
    expect(canAccessRoute('knobology', state)).toBe(true);
  });

  it('opens available routes while the course admin session is active', () => {
    const state = createInitialLearnerProgress();

    expect(isCourseAdminSessionActive(createAdminStorage('EBUS_2026'))).toBe(true);
    expect(isCourseAdminSessionActive(createAdminStorage('wrong'))).toBe(false);
    expect(canAccessRoute('pretest', state, { admin: true })).toBe(true);
    expect(canAccessRoute('post-course', state, { admin: true, nowMs: Date.parse('2026-05-31T14:59:59-07:00') })).toBe(
      true,
    );
    expect(canAccessRoute('simulator', state, { admin: true })).toBe(true);
    expect(getLockedRoutePath('simulator', '/simulator', state, { admin: true })).toBe('/simulator');
    expect(getRouteLockReason('simulator', state, { admin: true })).toBeNull();
  });

  it('keeps the virtual bronchoscopy case suppressed while the simplified simulator remains live', () => {
    const state = createInitialLearnerProgress();

    expect(canAccessRoute('simulator', state)).toBe(true);
    expect(canAccessRoute('case-001', state)).toBe(false);
    expect(canAccessRoute('case-001', state, { admin: true })).toBe(false);
    expect(canAccessRoute('case-001', state, { preview: true })).toBe(false);
    expect(getLockedRoutePath('case-001', '/cases/case-001', state, { admin: true })).toBe('/');
    expect(getRouteLockReason('case-001', state, { admin: true })).toBe('This module is not currently available.');
  });

  it('clears the course admin browser session when the admin logs out', () => {
    const storage = createAdminStorage('EBUS_2026');

    expect(isCourseAdminSessionActive(storage)).toBe(true);

    clearCourseAdminPasscode(storage);

    expect(isCourseAdminSessionActive(storage)).toBe(false);
  });

  it('unlocks learning routes for vendor preview without activating admin access', () => {
    const state = createInitialLearnerProgress();

    expect(validateCourseVendorPasscode('SoCal_EBUS_Sponsor')).toBe(true);
    expect(validateCourseVendorPasscode('EBUS_2026')).toBe(false);
    expect(isCourseVendorSessionActive(createAdminStorage('SoCal_EBUS_Sponsor'))).toBe(true);
    expect(isCourseAdminSessionActive(createAdminStorage('SoCal_EBUS_Sponsor'))).toBe(false);
    expect(canAccessRoute('pretest', state, { preview: true })).toBe(true);
    expect(canAccessRoute('post-course', state, { preview: true, nowMs: Date.parse('2026-05-31T14:59:59-07:00') })).toBe(
      true,
    );
    expect(canAccessRoute('simulator', state, { preview: true })).toBe(true);
    expect(getLockedRoutePath('simulator', '/simulator', state, { preview: true })).toBe('/simulator');
    expect(getRouteLockReason('simulator', state, { preview: true })).toBeNull();
  });

  it('locks the post-course route until the May 31 Pacific unlock time', () => {
    const state = createPostCourseReadyState();
    const justBeforeUnlock = Date.parse('2026-05-31T14:59:59-07:00');
    const atUnlock = Date.parse('2026-05-31T15:00:00-07:00');

    expect(canAccessRoute('post-course', state, { nowMs: justBeforeUnlock })).toBe(false);
    expect(getLockedRoutePath('post-course', '/post-course', state, { nowMs: justBeforeUnlock })).toBe('/lectures');
    expect(getRouteLockReason('post-course', state, { nowMs: justBeforeUnlock })).toBe(
      'Available after the live course on May 31, 2026 at 3:00 PM PT',
    );

    expect(canAccessRoute('post-course', state, { nowMs: atUnlock })).toBe(true);
  });

  it('opens post-course after the date for pre-test complete learners even when modules are incomplete', () => {
    const state = createPostCourseReadyState();
    delete state.courseAssessmentResults['post-lecture-02'];

    expect(canAccessRoute('post-course', state, { nowMs: Date.parse('2026-05-31T15:00:00-07:00') })).toBe(true);
    expect(getRouteLockReason('post-course', state, { nowMs: Date.parse('2026-05-31T15:00:00-07:00') })).toBeNull();
  });

  it('keeps post-course locked after the date until the learner completes the pre-test', () => {
    const state = createInitialLearnerProgress();

    expect(canAccessRoute('post-course', state, { nowMs: Date.parse('2026-05-31T15:00:00-07:00') })).toBe(false);
    expect(getRouteLockReason('post-course', state, { nowMs: Date.parse('2026-05-31T15:00:00-07:00') })).toBe(
      'Complete "Pre-test" to unlock the post-course survey and test.',
    );
  });
});
