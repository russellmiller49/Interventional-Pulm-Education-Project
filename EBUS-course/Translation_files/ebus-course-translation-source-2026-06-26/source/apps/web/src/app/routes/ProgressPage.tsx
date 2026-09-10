import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { CourseStepGuidance } from '@/components/CourseStepGuidance';
import type { AppRouteId } from '@/content/types';
import { canAccessRoute } from '@/lib/access';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useAuth } from '@/lib/auth';
import { useCourseNow } from '@/lib/courseClock';
import {
  getCourseGuidanceModel,
  getCourseStepModels,
  type CourseWorkflowOptions,
  type CourseWorkflowStepModel,
} from '@/lib/courseWorkflow';
import type { LearnerProgressState, ModuleProgressId } from '@/lib/progress';
import { useLearnerProgress } from '@/lib/progress';

type ProgressModuleStatus = 'completed' | 'current' | 'unlocked' | 'locked';

interface ProgressModuleDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  routeId: AppRouteId;
  moduleIds?: ModuleProgressId[];
  matchesStep?: (step: CourseWorkflowStepModel) => boolean;
}

interface ProgressModuleCard {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: string;
  path: string;
  percent: number;
  status: ProgressModuleStatus;
  statusLabel: string;
}

const progressModuleDefinitions: ProgressModuleDefinition[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Account access, course orientation, and the welcome video review.',
    icon: 'ⓘ',
    path: '/welcome',
    routeId: 'welcome',
    matchesStep: (step) => step.id === 'account' || step.id === 'lecture-01',
  },
  {
    id: 'pretest',
    title: 'Pre-course Survey and Test',
    description: 'Baseline survey and pre-test completion before the lecture sequence.',
    icon: '◇',
    path: '/pretest',
    routeId: 'pretest',
    moduleIds: ['pretest'],
    matchesStep: (step) => step.id === 'pre-course-survey' || step.id === 'pretest',
  },
  {
    id: 'lectures',
    title: 'Lectures and Post-lecture Quizzes',
    description: 'Required course videos and the quizzes that unlock the next lecture.',
    icon: '▶',
    path: '/lectures',
    routeId: 'lectures',
    moduleIds: ['lectures'],
    matchesStep: (step) => (step.kind === 'lecture' && step.id !== 'lecture-01') || step.kind === 'assessment',
  },
  {
    id: 'knobology',
    title: 'EBUS Knobology',
    description: 'Interactive image optimization, Doppler, depth, gain, and tool basics.',
    icon: '◐',
    path: '/knobology',
    routeId: 'knobology',
    moduleIds: ['knobology'],
  },
  {
    id: 'stations',
    title: 'Mediastinal Stations',
    description: 'Station map, recognition practice, and CT to bronchoscopy to EBUS correlation.',
    icon: '◎',
    path: '/stations/explore',
    routeId: 'stations',
    moduleIds: ['station-map', 'station-explorer'],
  },
  {
    id: 'tnm-staging',
    title: 'TNM-9 Staging',
    description: '9th-edition staging reference, descriptor builders, and case practice.',
    icon: '◆',
    path: '/tnm-staging',
    routeId: 'tnm-staging',
    moduleIds: ['tnm-staging'],
  },
  {
    id: 'simulator',
    title: 'EBUS Simulator',
    description: 'Static anatomy-correlation simulator with guided station targeting.',
    icon: '◌',
    path: '/simulator',
    routeId: 'simulator',
    moduleIds: ['simulator'],
  },
  {
    id: 'post-course',
    title: 'Post-course Survey and Test',
    description: 'Final post-test, post-course survey, answer review, and certificate flow.',
    icon: '◈',
    path: '/post-course',
    routeId: 'post-course',
    matchesStep: (step) => step.kind === 'post-test' || step.kind === 'survey' || step.kind === 'certificate',
  },
];

function getStoredModulePercent(state: LearnerProgressState, moduleIds: ModuleProgressId[] = []) {
  if (moduleIds.length === 0) {
    return 0;
  }

  return Math.max(...moduleIds.map((moduleId) => state.moduleProgress[moduleId]?.percentComplete ?? 0));
}

function areStoredModulesComplete(state: LearnerProgressState, moduleIds: ModuleProgressId[] = []) {
  return (
    moduleIds.length > 0 &&
    moduleIds.every((moduleId) => {
      const progress = state.moduleProgress[moduleId];

      return Boolean(progress?.completedAt || (progress?.percentComplete ?? 0) >= 100);
    })
  );
}

function getStepPercent(steps: CourseWorkflowStepModel[]) {
  if (steps.length === 0) {
    return 0;
  }

  const percentSum = steps.reduce((sum, step) => sum + step.percent, 0);

  return Math.round(percentSum / steps.length);
}

function getStatusLabel(status: ProgressModuleStatus) {
  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'current') {
    return 'Required next';
  }

  if (status === 'unlocked') {
    return 'Unlocked';
  }

  return 'Locked';
}

function getProgressDetail({
  currentStep,
  firstLockedStep,
  status,
}: {
  currentStep: CourseWorkflowStepModel | null;
  firstLockedStep: CourseWorkflowStepModel | null;
  status: ProgressModuleStatus;
}) {
  if (status === 'completed') {
    return 'All required work for this module is saved.';
  }

  if (status === 'current') {
    return currentStep ? `Required next: ${currentStep.title}.` : 'This is the next required module.';
  }

  if (status === 'unlocked') {
    return 'Unlocked now. You can open this module when ready.';
  }

  return firstLockedStep?.lockedReason ?? 'Locked until previous required work is complete.';
}

export function buildProgressModuleCards({
  accessOptions,
  state,
  steps,
}: {
  accessOptions: CourseWorkflowOptions;
  state: LearnerProgressState;
  steps: CourseWorkflowStepModel[];
}): ProgressModuleCard[] {
  const guidance = getCourseGuidanceModel(steps);

  return progressModuleDefinitions.map((definition) => {
    const matchingSteps = definition.matchesStep ? steps.filter(definition.matchesStep) : [];
    const completedBySteps = matchingSteps.length > 0 && matchingSteps.every((step) => step.completed);
    const completedByProgress = areStoredModulesComplete(state, definition.moduleIds);
    const completed = completedBySteps || completedByProgress;
    const currentStep = matchingSteps.find((step) => step.id === guidance.currentStep?.id) ?? null;
    const firstLockedStep = matchingSteps.find((step) => !step.unlocked) ?? null;
    const workflowUnlocked = matchingSteps.length > 0 ? matchingSteps.some((step) => step.unlocked) : false;
    const routeUnlocked = canAccessRoute(definition.routeId, state, accessOptions);
    const unlocked = matchingSteps.length > 0 ? workflowUnlocked : routeUnlocked;
    const status: ProgressModuleStatus = completed
      ? 'completed'
      : currentStep
        ? 'current'
        : unlocked
          ? 'unlocked'
          : 'locked';
    const stepPercent = getStepPercent(matchingSteps);
    const storedPercent = getStoredModulePercent(state, definition.moduleIds);
    const percent = completed ? 100 : Math.max(stepPercent, storedPercent);

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      detail: getProgressDetail({ currentStep, firstLockedStep, status }),
      icon: definition.icon,
      path: definition.path,
      percent,
      status,
      statusLabel: getStatusLabel(status),
    };
  });
}

function ProgressMeter({ percent }: { percent: number }) {
  return (
    <span aria-hidden="true" className="progress-meter">
      <span className="progress-meter__bar" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

export function ProgressPage() {
  const { state } = useLearnerProgress();
  const { isSupabaseEnabled, profile } = useAuth();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const nowMs = useCourseNow();
  const accountComplete = !isSupabaseEnabled || Boolean(profile);
  const accessOptions = useMemo(
    () => ({
      accountComplete,
      admin: adminSessionActive,
      nowMs,
      preview: vendorSessionActive,
    }),
    [accountComplete, adminSessionActive, nowMs, vendorSessionActive],
  );
  const courseStepModels = useMemo(() => getCourseStepModels(state, accessOptions), [accessOptions, state]);
  const moduleCards = useMemo(
    () =>
      buildProgressModuleCards({
        accessOptions,
        state,
        steps: courseStepModels,
      }),
    [accessOptions, courseStepModels, state],
  );
  const guidance = getCourseGuidanceModel(courseStepModels);
  const completedModules = moduleCards.filter((module) => module.status === 'completed').length;
  const unlockedModules = moduleCards.filter(
    (module) => module.status === 'current' || module.status === 'unlocked',
  ).length;
  const lockedModules = moduleCards.filter((module) => module.status === 'locked').length;

  return (
    <div className="page-stack">
      <section className="section-card progress-dashboard">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Learner progress</div>
            <h2>Show my progress</h2>
            <p>
              See what is complete, what is required next, which modules are open now, and which modules remain locked.
            </p>
          </div>
          <div className="tag-row">
            <span className="tag">
              {completedModules}/{moduleCards.length} modules complete
            </span>
            <span className="tag">{unlockedModules} unlocked</span>
            <span className="tag">{lockedModules} locked</span>
          </div>
        </div>
        <div className="progress-dashboard__next">
          <div>
            <span>Required next</span>
            <strong>{guidance.currentStep?.title ?? 'All required steps complete'}</strong>
          </div>
          {guidance.currentStep?.unlocked && !guidance.currentStep.completed ? (
            <Link className="button" to={guidance.currentStep.path}>
              Open required step
            </Link>
          ) : null}
        </div>
      </section>

      <CourseStepGuidance steps={courseStepModels} />

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Module status</div>
            <h2>Completed, unlocked, and locked modules</h2>
            <p>These statuses use the same course unlock rules and saved browser progress as the rest of the portal.</p>
          </div>
        </div>

        <div className="progress-module-grid">
          {moduleCards.map((module) => (
            <article className={`progress-module-card progress-module-card--${module.status}`} key={module.id}>
              <div className="progress-module-card__heading">
                <span className="progress-module-card__icon" aria-hidden="true">
                  {module.icon}
                </span>
                <div>
                  <span>{module.statusLabel}</span>
                  <h3>{module.title}</h3>
                </div>
              </div>
              <p>{module.description}</p>
              <div className="progress-module-card__meter">
                <ProgressMeter percent={module.percent} />
                <span>{module.percent}%</span>
              </div>
              <div className="progress-module-card__footer">
                <small>{module.detail}</small>
                {module.status !== 'locked' ? (
                  <Link className="button button--ghost" to={module.path}>
                    Open
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
