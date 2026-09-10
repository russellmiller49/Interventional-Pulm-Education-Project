import type { AppRouteId } from '@/content/types';
import {
  getCourseStepModels,
  getLockedReason,
  getPostCourseAssessmentLockReason,
  isCoursePretestUnlocked,
  isPostCourseAssessmentUnlocked,
  isPretestComplete,
} from '@/lib/courseWorkflow';
import type { LearnerProgressState } from '@/lib/progress';

export const COURSE_ADMIN_SHARED_PASSCODE = 'EBUS_2026';
export const COURSE_VENDOR_SHARED_PASSCODE = 'SoCal_EBUS_Sponsor';
export const PRETEST_ADMIN_UNLOCK_PASSCODE = COURSE_ADMIN_SHARED_PASSCODE;
export const COURSE_ADMIN_SESSION_KEY = 'socal-ebus-prep.web.admin-passcode';
export const COURSE_VENDOR_SESSION_KEY = 'socal-ebus-prep.web.vendor-passcode';
export const COURSE_ADMIN_SESSION_CHANGE_EVENT = 'socal-ebus-prep.admin-session-change';
export const COURSE_VENDOR_SESSION_CHANGE_EVENT = 'socal-ebus-prep.vendor-session-change';

type CourseAccessStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export interface CourseAccessOptions {
  admin?: boolean;
  accountComplete?: boolean;
  nowMs?: number;
  preview?: boolean;
}

export { isPretestComplete };

const publicTrainingRouteIds = new Set<AppRouteId>(['knobology', 'stations', 'simulator', 'tnm-staging']);
const suppressedRouteIds = new Set<AppRouteId>(['case-001']);

export function isPublicTrainingRoute(routeId: AppRouteId | null) {
  return Boolean(routeId && publicTrainingRouteIds.has(routeId));
}

export function validateCourseAdminPasscode(value: string) {
  return value.trim() === COURSE_ADMIN_SHARED_PASSCODE;
}

export function validateCourseVendorPasscode(value: string) {
  return value.trim() === COURSE_VENDOR_SHARED_PASSCODE;
}

export function validatePretestAdminPasscode(value: string) {
  return validateCourseAdminPasscode(value);
}

function getBrowserSessionStorage(): CourseAccessStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function dispatchCourseAdminSessionChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(COURSE_ADMIN_SESSION_CHANGE_EVENT));
}

function dispatchCourseVendorSessionChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(COURSE_VENDOR_SESSION_CHANGE_EVENT));
}

export function getStoredCourseAdminPasscode(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  const storedPasscode = storage?.getItem(COURSE_ADMIN_SESSION_KEY) ?? '';

  return validateCourseAdminPasscode(storedPasscode) ? storedPasscode : '';
}

export function getStoredCourseVendorPasscode(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  const storedPasscode = storage?.getItem(COURSE_VENDOR_SESSION_KEY) ?? '';

  return validateCourseVendorPasscode(storedPasscode) ? storedPasscode : '';
}

export function isCourseAdminSessionActive(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  return Boolean(getStoredCourseAdminPasscode(storage));
}

export function isCourseVendorSessionActive(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  return Boolean(getStoredCourseVendorPasscode(storage));
}

export function storeCourseAdminPasscode(value: string, storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  storage?.setItem(COURSE_ADMIN_SESSION_KEY, value.trim());
  dispatchCourseAdminSessionChange();
}

export function storeCourseVendorPasscode(value: string, storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  storage?.setItem(COURSE_VENDOR_SESSION_KEY, value.trim());
  dispatchCourseVendorSessionChange();
}

export function clearCourseAdminPasscode(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  storage?.removeItem(COURSE_ADMIN_SESSION_KEY);
  dispatchCourseAdminSessionChange();
}

export function clearCourseVendorPasscode(storage: CourseAccessStorage | null = getBrowserSessionStorage()) {
  storage?.removeItem(COURSE_VENDOR_SESSION_KEY);
  dispatchCourseVendorSessionChange();
}

export function routeRequiresPretest(routeId: AppRouteId | null) {
  return Boolean(
    routeId &&
      !suppressedRouteIds.has(routeId) &&
      !isPublicTrainingRoute(routeId) &&
      !['home', 'progress', 'welcome', 'admin', 'sponsors', 'lectures', 'pretest', 'post-course'].includes(routeId),
  );
}

function getRoutePrerequisiteStepId(routeId: AppRouteId): string | null {
  if (routeId === 'pretest') {
    return 'lecture-01';
  }

  if (routeId === 'knobology') {
    return 'post-lecture-02';
  }

  if (routeId === 'stations') {
    return 'post-lecture-05';
  }

  if (routeId === 'tnm-staging' || routeId === 'simulator') {
    return 'post-lecture-08';
  }

  return null;
}

function getRouteFallbackPath(routeId: AppRouteId) {
  if (routeId === 'pretest') {
    return '/';
  }

  if (routeId === 'post-course') {
    return '/lectures';
  }

  return '/lectures';
}

export function canAccessRoute(
  routeId: AppRouteId,
  state: LearnerProgressState,
  options: CourseAccessOptions = {},
) {
  if (suppressedRouteIds.has(routeId)) {
    return false;
  }

  if (options.admin || options.preview) {
    return true;
  }

  if (
    routeId === 'home' ||
    routeId === 'progress' ||
    routeId === 'welcome' ||
    routeId === 'admin' ||
    routeId === 'sponsors' ||
    routeId === 'lectures' ||
    isPublicTrainingRoute(routeId)
  ) {
    return true;
  }

  if (routeId === 'pretest') {
    return isCoursePretestUnlocked(state, options);
  }

  if (routeId === 'post-course') {
    return isPostCourseAssessmentUnlocked(state, options);
  }

  const steps = getCourseStepModels(state, options);
  const prerequisiteId = getRoutePrerequisiteStepId(routeId);

  if (!prerequisiteId) {
    return true;
  }

  return Boolean(steps.find((step) => step.id === prerequisiteId)?.completed);
}

export function getLockedRoutePath(
  routeId: AppRouteId,
  path: string,
  state: LearnerProgressState,
  options: CourseAccessOptions = {},
) {
  if (suppressedRouteIds.has(routeId)) {
    return '/';
  }

  if (canAccessRoute(routeId, state, options)) {
    return path;
  }

  if (routeId === 'post-course') {
    return getRouteFallbackPath(routeId);
  }

  if (routeId !== 'pretest' && canAccessRoute('pretest', state, options) && !isPretestComplete(state)) {
    return '/pretest';
  }

  return getRouteFallbackPath(routeId);
}

export function getRouteLockReason(
  routeId: AppRouteId,
  state: LearnerProgressState,
  options: CourseAccessOptions = {},
) {
  if (suppressedRouteIds.has(routeId)) {
    return 'This module is not currently available.';
  }

  if (canAccessRoute(routeId, state, options)) {
    return null;
  }

  if (routeId === 'pretest') {
    return 'Complete "Welcome, acknowledgments, course intro" to unlock this step.';
  }

  if (routeId === 'post-course') {
    return getPostCourseAssessmentLockReason(state, options);
  }

  const prerequisiteId = getRoutePrerequisiteStepId(routeId);
  const prerequisite = prerequisiteId ? getCourseStepModels(state, options).find((step) => step.id === prerequisiteId) : null;

  if (!prerequisite) {
    return null;
  }

  return getLockedReason(prerequisite);
}
