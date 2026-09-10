import { useEffect, useState } from 'react';

export function useCourseNow(pollMs = 30_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    function refreshNow() {
      setNowMs(Date.now());
    }

    const intervalId = window.setInterval(refreshNow, pollMs);
    window.addEventListener('focus', refreshNow);
    document.addEventListener('visibilitychange', refreshNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', refreshNow);
    };
  }, [pollMs]);

  return nowMs;
}
