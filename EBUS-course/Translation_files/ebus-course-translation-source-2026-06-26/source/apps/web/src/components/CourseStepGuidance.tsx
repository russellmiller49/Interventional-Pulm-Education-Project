import { Link } from 'react-router-dom';

import { getCourseGuidanceModel, type CourseWorkflowStepModel } from '@/lib/courseWorkflow';

function getStepStatusText(step: CourseWorkflowStepModel | null, fallback: string) {
  if (!step) {
    return fallback;
  }

  if (step.completed) {
    return 'Completed';
  }

  if (!step.unlocked) {
    return step.lockedReason ?? 'Locked until previous step is complete.';
  }

  return 'Available now.';
}

export function CourseStepGuidance({ steps }: { steps: CourseWorkflowStepModel[] }) {
  const guidance = getCourseGuidanceModel(steps);
  const { currentStep, nextStep } = guidance;

  return (
    <section aria-label="Course progress guidance" className="section-card course-guidance">
      <div className="course-guidance__summary">
        <div>
          <div className="eyebrow">Current step</div>
          <h2>{currentStep?.title ?? 'All required steps complete'}</h2>
          <p>{getStepStatusText(currentStep, 'You have completed the currently required course flow.')}</p>
        </div>
        {currentStep?.unlocked && !currentStep.completed ? (
          <Link className="button" to={currentStep.path}>
            Open current step
          </Link>
        ) : null}
      </div>

      <div className="course-guidance__grid">
        <div className="course-guidance__item">
          <span>Next required step</span>
          <strong>{nextStep?.title ?? 'No remaining required step'}</strong>
          <small>{getStepStatusText(nextStep, 'Everything currently required is complete.')}</small>
        </div>
        <div className="course-guidance__item">
          <span>Completed</span>
          <strong>
            {guidance.completedCount} of {guidance.totalCount}
          </strong>
          <small>Required course steps recorded in this browser.</small>
        </div>
        <div className="course-guidance__item">
          <span>Locked until previous step is complete</span>
          <strong>{guidance.lockedCount}</strong>
          <small>Locked steps open automatically as earlier requirements are saved.</small>
        </div>
      </div>
    </section>
  );
}
