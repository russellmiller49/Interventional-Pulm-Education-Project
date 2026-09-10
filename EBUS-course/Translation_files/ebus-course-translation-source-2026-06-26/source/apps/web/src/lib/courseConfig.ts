export const COURSE_END_AT = '2026-05-31T15:00:00-07:00';

export const COURSE_END_AT_MS = Date.parse(COURSE_END_AT);

export function isCourseEndUnlocked(nowMs = Date.now()) {
  return nowMs >= COURSE_END_AT_MS;
}

export function formatCourseEndAvailability() {
  return 'Available after the live course on May 31, 2026 at 3:00 PM PT';
}
