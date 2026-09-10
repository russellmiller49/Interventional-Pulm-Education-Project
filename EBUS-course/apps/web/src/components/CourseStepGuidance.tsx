import { Link } from 'react-router-dom';

import { useCourseShellText } from '@/i18n/courseShell';
import { useLocalizedPath } from '@/i18n/locale';
import { getCourseGuidanceModel, type CourseWorkflowStepModel } from '@/lib/courseWorkflow';

function getStepStatusText(step: CourseWorkflowStepModel | null, fallback: string, t: (source: string) => string) {
  if (!step) {
    return t(fallback);
  }

  if (step.completed) {
    return t('Completed');
  }

  if (!step.unlocked) {
    return t(step.lockedReason ?? 'Locked until previous step is complete.');
  }

  return t('Available now.');
}

export function CourseStepGuidance({ steps }: { steps: CourseWorkflowStepModel[] }) {
  const localizePath = useLocalizedPath();
  const t = useCourseShellText();
  const guidance = getCourseGuidanceModel(steps);
  const { currentStep, nextStep } = guidance;

  return (
    <section aria-label={t('Course progress guidance')} className="section-card course-guidance">
      <div className="course-guidance__summary">
        <div>
          <div className="eyebrow">{t('Current step')}</div>
          <h2>{currentStep ? t(currentStep.title) : t('All required steps complete')}</h2>
          <p>{getStepStatusText(currentStep, 'You have completed the currently required course flow.', t)}</p>
        </div>
        {currentStep?.unlocked && !currentStep.completed ? (
          <Link className="button" to={localizePath(currentStep.path)}>
            {t('Open current step')}
          </Link>
        ) : null}
      </div>

      <div className="course-guidance__grid">
        <div className="course-guidance__item">
          <span>{t('Next required step')}</span>
          <strong>{nextStep ? t(nextStep.title) : t('No remaining required step')}</strong>
          <small>{getStepStatusText(nextStep, 'Everything currently required is complete.', t)}</small>
        </div>
        <div className="course-guidance__item">
          <span>{t('Completed')}</span>
          <strong>
            {guidance.completedCount} {t('of')} {guidance.totalCount}
          </strong>
          <small>{t('Required course steps recorded in this browser.')}</small>
        </div>
        <div className="course-guidance__item">
          <span>{t('Locked until previous step is complete')}</span>
          <strong>{guidance.lockedCount}</strong>
          <small>{t('Locked steps open automatically as earlier requirements are saved.')}</small>
        </div>
      </div>
    </section>
  );
}
