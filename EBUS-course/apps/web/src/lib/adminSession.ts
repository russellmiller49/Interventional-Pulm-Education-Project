import { useEffect, useState } from 'react';

import {
  COURSE_ADMIN_SESSION_CHANGE_EVENT,
  COURSE_ADMIN_SESSION_KEY,
  COURSE_VENDOR_SESSION_CHANGE_EVENT,
  COURSE_VENDOR_SESSION_KEY,
  isCourseAdminSessionActive,
  isCourseVendorSessionActive,
} from '@/lib/access';

const COURSE_ADMIN_SESSION_STORAGE_KEYS = [COURSE_ADMIN_SESSION_KEY];
const COURSE_ADMIN_SESSION_CHANGE_EVENTS = [COURSE_ADMIN_SESSION_CHANGE_EVENT];
const COURSE_VENDOR_SESSION_STORAGE_KEYS = [COURSE_VENDOR_SESSION_KEY];
const COURSE_VENDOR_SESSION_CHANGE_EVENTS = [COURSE_VENDOR_SESSION_CHANGE_EVENT];

function useCourseSessionActive(
  isActive: () => boolean,
  storageKeys: string[],
  changeEvents: string[],
) {
  const [isSessionActive, setIsSessionActive] = useState(isActive);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function updateSessionState() {
      setIsSessionActive(isActive());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === null || storageKeys.includes(event.key)) {
        updateSessionState();
      }
    }

    updateSessionState();
    for (const changeEvent of changeEvents) {
      window.addEventListener(changeEvent, updateSessionState);
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      for (const changeEvent of changeEvents) {
        window.removeEventListener(changeEvent, updateSessionState);
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [changeEvents, isActive, storageKeys]);

  return isSessionActive;
}

export function useCourseAdminSessionActive() {
  return useCourseSessionActive(
    isCourseAdminSessionActive,
    COURSE_ADMIN_SESSION_STORAGE_KEYS,
    COURSE_ADMIN_SESSION_CHANGE_EVENTS,
  );
}

export function useCourseVendorSessionActive() {
  return useCourseSessionActive(
    isCourseVendorSessionActive,
    COURSE_VENDOR_SESSION_STORAGE_KEYS,
    COURSE_VENDOR_SESSION_CHANGE_EVENTS,
  );
}
