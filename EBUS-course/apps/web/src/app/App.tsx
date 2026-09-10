import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/AppShell';
import type { AppRouteId, NavigationItem } from '@/content/types';
import { HomePage } from '@/app/routes/HomePage';
import { ProgressPage } from '@/app/routes/ProgressPage';
import { WelcomePage } from '@/app/routes/WelcomePage';
import { AuthPage } from '@/app/routes/AuthPage';
import { AdminPage } from '@/app/routes/AdminPage';
import { AccountPage } from '@/app/routes/AccountPage';
import { SponsorsPage } from '@/app/routes/SponsorsPage';
import { StationsPage } from '@/app/routes/StationsPage';
import { StationsExplorePage } from '@/app/routes/stations/ExplorePage';
import { StationsFlashcardsPage } from '@/app/routes/stations/FlashcardsPage';
import { StationsHandbookPage } from '@/app/routes/stations/HandbookPage';
import { StationsQuizPage } from '@/app/routes/stations/StationsQuizPage';
import { SonographicInterpretationPage } from '@/app/routes/stations/SonographicInterpretationPage';
import { KnobologyPage } from '@/app/routes/KnobologyPage';
import { LecturesPage } from '@/app/routes/LecturesPage';
import { PretestPage } from '@/app/routes/PretestPage';
import { PostCoursePage } from '@/app/routes/PostCoursePage';
import { SimulatorPage } from '@/app/routes/SimulatorPage';
import { TnmStagingPage } from '@/app/routes/TnmStagingPage';
import { NotFoundPage } from '@/app/routes/NotFoundPage';
import { canAccessRoute, getLockedRoutePath, getRouteLockReason, isPublicTrainingRoute } from '@/lib/access';
import { useCourseShellText } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { useCourseNow } from '@/lib/courseClock';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useLearnerProgress } from '@/lib/progress';
import { recordModuleSession } from '@/lib/supabaseTracking';

const navItems: NavigationItem[] = [
  { id: 'home', label: 'Course home', icon: '⌂', path: '/' },
  { id: 'progress', label: 'My progress', icon: '✓', path: '/progress', hideInBottom: true },
  { id: 'welcome', label: 'Welcome', icon: 'ⓘ', path: '/welcome' },
  { id: 'sponsors', label: 'Sponsors', icon: '☆', path: '/sponsors' },
  { id: 'pretest', label: 'Pre-course survey and test', icon: '◇', path: '/pretest' },
  { id: 'lectures', label: 'Lectures', icon: '▶', path: '/lectures' },
  { id: 'knobology', label: 'Knobology', icon: '◐', path: '/knobology' },
  { id: 'stations', label: 'Stations', icon: '◎', path: '/stations' },
  { id: 'tnm-staging', label: 'TNM-9', icon: '◆', path: '/tnm-staging' },
  { id: 'simulator', label: 'Simulator', icon: '◌', path: '/simulator' },
  { id: 'post-course', label: 'Post-course survey and test', icon: '◈', path: '/post-course' },
];

const adminNavItem: NavigationItem = { id: 'admin', label: 'Dashboard', icon: '▣', path: '/admin' };
const publicEbusRouteIds = new Set<AppRouteId>(['knobology', 'stations', 'simulator']);

type PublicTrainingScope = 'ebus' | 'tnm';

function RouteLoadingFallback() {
  const t = useCourseShellText();

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="eyebrow">{t('Loading section')}</div>
        <h2>{t('Preparing course content...')}</h2>
      </section>
    </div>
  );
}

function resolveRouteId(pathname: string): AppRouteId | null {
  if (pathname === '/') {
    return 'home';
  }

  if (pathname.startsWith('/progress')) {
    return 'progress';
  }

  if (pathname.startsWith('/welcome')) {
    return 'welcome';
  }

  if (pathname.startsWith('/course-info') || pathname.startsWith('/home')) {
    return 'home';
  }

  if (pathname.startsWith('/admin')) {
    return 'admin';
  }

  if (pathname.startsWith('/sponsors')) {
    return 'sponsors';
  }

  if (pathname.startsWith('/stations')) {
    return 'stations';
  }

  if (pathname.startsWith('/tnm-staging')) {
    return 'tnm-staging';
  }

  if (pathname.startsWith('/pretest')) {
    return 'pretest';
  }

  if (pathname.startsWith('/post-course')) {
    return 'post-course';
  }

  if (pathname.startsWith('/knobology')) {
    return 'knobology';
  }

  if (pathname.startsWith('/lectures')) {
    return 'lectures';
  }

  if (pathname.startsWith('/simulator')) {
    return 'simulator';
  }

  return null;
}

function getTrackedModuleId(pathname: string) {
  if (pathname.startsWith('/pretest')) {
    return 'pretest';
  }

  if (pathname.startsWith('/post-course')) {
    return 'lectures';
  }

  if (pathname.startsWith('/lectures')) {
    return 'lectures';
  }

  if (pathname.startsWith('/knobology')) {
    return 'knobology';
  }

  if (pathname.startsWith('/stations')) {
    return 'stations';
  }

  if (pathname.startsWith('/tnm-staging')) {
    return 'tnm-staging';
  }

  if (pathname.startsWith('/simulator')) {
    return 'simulator';
  }

  return null;
}

function getPublicTrainingScope(): PublicTrainingScope | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get('publicTraining') !== '1') {
    return null;
  }

  return params.get('publicScope') === 'tnm' ? 'tnm' : 'ebus';
}

function getAdminPreviewMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('adminPreview') === '1';
}

function isRouteInPublicTrainingScope(routeId: AppRouteId | null, scope: PublicTrainingScope | null) {
  if (!routeId || !scope) {
    return false;
  }

  if (scope === 'tnm') {
    return routeId === 'tnm-staging';
  }

  return publicEbusRouteIds.has(routeId);
}

function getPublicNavItems(items: NavigationItem[], scope: PublicTrainingScope) {
  const routeIds = scope === 'tnm' ? new Set<AppRouteId>(['tnm-staging']) : publicEbusRouteIds;

  return items.filter((item) => routeIds.has(item.id));
}

function getPublicModeHeader(scope: PublicTrainingScope, t: (source: string) => string) {
  if (scope === 'tnm') {
    return {
      title: t('TNM-9 Staging'),
      subtitle: t('Standalone lung cancer staging module'),
    };
  }

  return {
    title: t('Public EBUS Training'),
    subtitle: t('Open knobology, stations, and simulator modules'),
  };
}

function useSiteAdminEntitlement(
  user: ReturnType<typeof useAuth>['user'],
  isSupabaseEnabled: boolean,
) {
  const [state, setState] = useState({ isLoading: false, isSiteAdmin: false });

  useEffect(() => {
    let active = true;
    setState({ isLoading: true, isSiteAdmin: false });

    async function loadSiteAdminEntitlement() {
      try {
        const response = await fetch('/api/admin/ebus-preview', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (response.ok) {
          const payload = (await response.json()) as { siteAdmin?: unknown };

          if (payload.siteAdmin === true) {
            if (active) {
              setState({ isLoading: false, isSiteAdmin: true });
            }
            return;
          }
        }
      } catch {
        // Standalone EBUS deployments do not have the main-site admin preview endpoint.
      }

      if (!isSupabaseEnabled || !user) {
        if (active) {
          setState({ isLoading: false, isSiteAdmin: false });
        }
        return;
      }

      try {
        const client = getSupabaseBrowserClient();

        if (!client) {
          if (active) {
            setState({ isLoading: false, isSiteAdmin: false });
          }
          return;
        }

        const { data } = await client
          .from('site_entitlements')
          .select('entitlement')
          .eq('user_id', user.id)
          .eq('entitlement', 'site_admin')
          .eq('status', 'active')
          .maybeSingle();

        if (active) {
          setState({ isLoading: false, isSiteAdmin: Boolean(data) });
        }
      } catch {
        if (active) {
          setState({ isLoading: false, isSiteAdmin: false });
        }
      }
    }

    void loadSiteAdminEntitlement();

    return () => {
      active = false;
    };
  }, [isSupabaseEnabled, user]);

  return state;
}

export function App() {
  const location = useLocation();
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();
  const { hydrated, recordModuleEngagement, state, visitRoute } = useLearnerProgress();
  const { isLoading: authLoading, isPasswordRecoverySession, isSupabaseEnabled, profile, user } = useAuth();
  const nowMs = useCourseNow();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const siteAdminEntitlement = useSiteAdminEntitlement(user, isSupabaseEnabled);
  const adminPreviewMode = getAdminPreviewMode();
  const appAdminSessionActive = adminSessionActive || siteAdminEntitlement.isSiteAdmin || adminPreviewMode;
  const previewSessionActive = appAdminSessionActive || vendorSessionActive;
  const accountComplete = !isSupabaseEnabled || Boolean(user);
  const accessOptions = useMemo(
    () => ({ accountComplete, admin: appAdminSessionActive, nowMs, preview: vendorSessionActive }),
    [accountComplete, appAdminSessionActive, nowMs, vendorSessionActive],
  );
  const localizedNavItems = useMemo(
    () => navItems.map((item) => ({ ...item, label: t(item.label) })),
    [t],
  );
  const localizedAdminNavItem = useMemo(
    () => ({ ...adminNavItem, label: t(adminNavItem.label) }),
    [t],
  );
  const sessionRef = useRef<{
    moduleId: ReturnType<typeof getTrackedModuleId>;
    path: string;
    startedAt: number;
  } | null>(null);
  const routeId = resolveRouteId(location.pathname);
  const publicTrainingScope = getPublicTrainingScope();
  const publicTrainingMode = isRouteInPublicTrainingScope(routeId, publicTrainingScope);
  const publicModeHeader = publicTrainingMode && publicTrainingScope ? getPublicModeHeader(publicTrainingScope, t) : undefined;
  const isAuthPath = location.pathname.startsWith('/auth');
  const isAdminPath = location.pathname.startsWith('/admin');
  const isSuppressedCasePath = location.pathname.startsWith('/cases/case-001');
  const isPublicTrainingPath = isPublicTrainingRoute(routeId);
  const isPublicOnboardingPath =
    location.pathname === '/' ||
    location.pathname.startsWith('/progress') ||
    location.pathname.startsWith('/welcome') ||
    location.pathname.startsWith('/course-info') ||
    location.pathname.startsWith('/home') ||
    location.pathname.startsWith('/pretest') ||
    location.pathname.startsWith('/sponsors') ||
    isSuppressedCasePath ||
    isPublicTrainingPath;

  const activeNavItems = useMemo(() => {
    if (publicTrainingMode && publicTrainingScope) {
      return getPublicNavItems(localizedNavItems, publicTrainingScope);
    }

    return appAdminSessionActive ? [...localizedNavItems, localizedAdminNavItem] : localizedNavItems;
  }, [appAdminSessionActive, localizedAdminNavItem, localizedNavItems, publicTrainingMode, publicTrainingScope]);

  const gatedNavItems = useMemo(() => {
    return activeNavItems.map((item) => ({
      ...item,
      locked: !canAccessRoute(item.id, state, accessOptions),
      lockedReason: getRouteLockReason(item.id, state, accessOptions) ?? undefined,
      path: getLockedRoutePath(item.id, item.path, state, accessOptions),
    }));
  }, [accessOptions, activeNavItems, state]);

  useEffect(() => {
    if (routeId) {
      visitRoute(routeId);
    }
  }, [location.pathname, visitRoute]);

  useEffect(() => {
    const now = Date.now();
    const currentModuleId = getTrackedModuleId(location.pathname);
    const previous = sessionRef.current;

    if (previous && (previous.path !== location.pathname || previous.moduleId !== currentModuleId)) {
      const durationSeconds = Math.max(1, Math.round((now - previous.startedAt) / 1000));
      recordModuleEngagement(previous.moduleId!, durationSeconds);

      if (isSupabaseEnabled && user) {
        const client = getSupabaseBrowserClient();

        if (client) {
          void recordModuleSession(client, user.id, {
            moduleId: previous.moduleId!,
            routePath: previous.path,
            startedAt: new Date(previous.startedAt).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationSeconds,
          }).catch(() => {
            // Local engagement totals remain available even if remote inserts fail.
          });
        }
      }
    }

    sessionRef.current = currentModuleId
      ? {
          moduleId: currentModuleId,
          path: location.pathname,
          startedAt: now,
        }
      : null;
  }, [isSupabaseEnabled, location.pathname, recordModuleEngagement, user]);

  useEffect(() => {
    function flushActiveSession() {
      const activeSession = sessionRef.current;

      if (!activeSession) {
        return;
      }

      const endedAt = Date.now();
      const durationSeconds = Math.max(1, Math.round((endedAt - activeSession.startedAt) / 1000));
      recordModuleEngagement(activeSession.moduleId!, durationSeconds);

      if (isSupabaseEnabled && user) {
        const client = getSupabaseBrowserClient();

        if (client) {
          void recordModuleSession(client, user.id, {
            moduleId: activeSession.moduleId!,
            routePath: activeSession.path,
            startedAt: new Date(activeSession.startedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            durationSeconds,
          }).catch(() => {
            // The next sync cycle still preserves local aggregate time.
          });
        }
      }

      sessionRef.current = {
        ...activeSession,
        startedAt: endedAt,
      };
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushActiveSession();
      }
    }

    window.addEventListener('beforeunload', flushActiveSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushActiveSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupabaseEnabled, recordModuleEngagement, user]);

  if (
    !hydrated ||
    (isSupabaseEnabled && authLoading && !previewSessionActive && !publicTrainingMode) ||
    (isSupabaseEnabled && Boolean(user) && siteAdminEntitlement.isLoading && !previewSessionActive)
  ) {
    return (
      <AppShell navItems={gatedNavItems} publicMode={publicModeHeader}>
        <div className="page-stack">
          <section className="section-card">
            <div className="eyebrow">{t('Loading workspace')}</div>
            <h2>{t('Preparing learner access...')}</h2>
          </section>
        </div>
      </AppShell>
    );
  }

  if (isSupabaseEnabled && !user && !previewSessionActive && !isAuthPath && !isAdminPath && !isPublicOnboardingPath) {
    const next = `${location.pathname}${location.search}`;

    return <Navigate replace to={localizePath(`/auth?next=${encodeURIComponent(next)}`)} />;
  }

  if (isSupabaseEnabled && user && isPasswordRecoverySession && !previewSessionActive && !isAuthPath && !isAdminPath) {
    return <Navigate replace to={localizePath('/auth?mode=reset-password')} />;
  }

  if (isSupabaseEnabled && user && profile?.mustSetPassword && !previewSessionActive && !isAuthPath && !isAdminPath) {
    const next = `${location.pathname}${location.search}`;

    return <Navigate replace to={localizePath(`/auth?next=${encodeURIComponent(next)}`)} />;
  }

  if (
    isSupabaseEnabled &&
    user &&
    profile?.approvalStatus === 'pending' &&
    !previewSessionActive &&
    !isAuthPath &&
    !isAdminPath &&
    !isPublicOnboardingPath
  ) {
    const next = `${location.pathname}${location.search}`;

    return <Navigate replace to={localizePath(`/auth?next=${encodeURIComponent(next)}`)} />;
  }

  if (routeId && !canAccessRoute(routeId, state, accessOptions)) {
    return <Navigate replace to={localizePath(getLockedRoutePath(routeId, location.pathname, state, accessOptions))} />;
  }

  return (
    <AppShell navItems={gatedNavItems} publicMode={publicModeHeader}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<ProgressPage />} path="/progress" />
          <Route element={<WelcomePage />} path="/welcome" />
          <Route element={<Navigate replace to={localizePath('/')} />} path="/course-info" />
          <Route element={<Navigate replace to={localizePath('/')} />} path="/home" />
          <Route element={<SponsorsPage />} path="/sponsors" />
          <Route element={<AuthPage />} path="/auth" />
          <Route element={<AdminPage />} path="/admin" />
          <Route element={<AccountPage />} path="/account" />
          <Route element={<PretestPage />} path="/pretest" />
          <Route element={<PostCoursePage />} path="/post-course" />
          <Route element={<StationsPage />} path="/stations">
            <Route element={<Navigate replace to={localizePath('explore')} />} index />
            <Route element={<StationsExplorePage />} path="explore" />
            <Route element={<SonographicInterpretationPage />} path="sonographic-interpretation" />
            <Route element={<StationsFlashcardsPage />} path="flashcards" />
            <Route element={<StationsQuizPage />} path="quiz" />
            <Route element={<StationsHandbookPage />} path="handbook" />
          </Route>
          <Route element={<KnobologyPage />} path="/knobology" />
          <Route element={<TnmStagingPage />} path="/tnm-staging" />
          <Route element={<LecturesPage />} path="/lectures" />
          <Route element={<Navigate replace to={localizePath('/lectures')} />} path="/quiz" />
          <Route element={<NotFoundPage />} path="/cases/case-001" />
          <Route
            element={
              <SimulatorPage
                showVirtualBronchoscopy={appAdminSessionActive || publicTrainingMode}
              />
            }
            path="/simulator"
          />
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
