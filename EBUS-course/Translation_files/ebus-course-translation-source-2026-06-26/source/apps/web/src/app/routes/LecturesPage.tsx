import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CourseStepGuidance } from '@/components/CourseStepGuidance';
import { getCourseAssessmentById, postLectureCourseAssessments } from '@/content/courseAssessments';
import { courseInfo } from '@/content/course';
import { lectureManifest } from '@/content/lectures';
import type { CourseAssessmentContent } from '@/content/types';
import { AabipVideoLibrary } from '@/features/lectures/AabipVideoLibrary';
import { LectureCard } from '@/features/lectures/LectureCard';
import { QuizCard } from '@/features/quiz/QuizCard';
import { useCourseAdminSessionActive, useCourseVendorSessionActive } from '@/lib/adminSession';
import { useCourseNow } from '@/lib/courseClock';
import {
  getAssessmentWorkflowStatus,
  getCourseAssessmentProgress,
  getCourseStepModels,
  getLectureModuleProgressSummary,
  getLectureWorkflowStatus,
  getNextCourseStep,
  type CourseWorkflowStepModel,
} from '@/lib/courseWorkflow';
import type { QuizResult } from '@/lib/quiz';
import { type CourseAssessmentProgress, type LectureStateUpdate, useLearnerProgress } from '@/lib/progress';

const VIDEO_TABS = [
  { id: 'course-videos', label: 'Course Videos' },
  { id: 'aabip-videos', label: 'AABIP Videos' },
] as const;

type VideoTabId = (typeof VIDEO_TABS)[number]['id'];
type AssessmentInteractionMode = 'attempt' | 'review';

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return 'Not completed';
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function getAssessmentScoreLabel(assessment: CourseAssessmentContent, progress: CourseAssessmentProgress | null) {
  if (!progress?.completedAt) {
    return `${assessment.questions.length} questions`;
  }

  return `${progress.percent}% saved`;
}

function getAssessmentRequirementLabel(assessment: CourseAssessmentContent) {
  const lectureLabels = assessment.requiredLectureIds.map((lectureId) => {
    const lecture = lectureManifest.find((entry) => entry.id === lectureId);

    return lecture?.week ?? lecture?.title ?? lectureId;
  });

  return lectureLabels.length > 0 ? `After ${lectureLabels.join(' + ')}` : 'After required lecture';
}

function getTrailingLectureId(assessment: CourseAssessmentContent) {
  return assessment.requiredLectureIds[assessment.requiredLectureIds.length - 1] ?? null;
}

function getSavedAssessmentAnswers(progress: CourseAssessmentProgress | null) {
  if (!progress) {
    return {};
  }

  return Object.fromEntries(
    progress.answers.map((answer) => [answer.questionId, answer.selectedOptionIds]),
  );
}

function getProgressPercent(completedCount: number, totalCount: number) {
  return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
}

function CourseAssessmentSummary({
  active,
  assessment,
  onSelect,
  onRetake,
  onReview,
  progress,
  workflow,
}: {
  active: boolean;
  assessment: CourseAssessmentContent;
  onSelect: () => void;
  onRetake: () => void;
  onReview: () => void;
  progress: CourseAssessmentProgress | null;
  workflow: CourseWorkflowStepModel | null;
}) {
  const locked = !workflow?.unlocked;
  const completed = Boolean(progress?.completedAt);
  const reviewSupported = (progress?.answers.length ?? 0) > 0;

  return (
    <article className={`course-assessment-card course-assessment-card--inline${active ? ' course-assessment-card--active' : ''}`}>
      <div className="course-assessment-card__heading">
        <div>
          <span className="eyebrow">{assessment.kind === 'post-test' ? 'Post-test' : 'Post-lecture quiz'}</span>
          <strong>{assessment.title}</strong>
          <span>{getAssessmentRequirementLabel(assessment)}</span>
        </div>
        <span className="tag">{getAssessmentScoreLabel(assessment, progress)}</span>
      </div>
      {locked ? <small>{workflow?.lockedReason ?? 'Open the required lecture to unlock this quiz.'}</small> : null}
      {completed ? (
        <div className="course-assessment-card__completion">
          <strong>✓ Score recorded.</strong>
          <small>Completed {formatTimestamp(progress?.completedAt)}. You may continue to the next required step.</small>
        </div>
      ) : null}
      <div className="button-row button-row--wrap">
        {completed ? (
          <>
            {reviewSupported ? (
              <button className="button button--ghost" disabled={locked} onClick={onReview} type="button">
                Review quiz
              </button>
            ) : null}
            <button className="button button--ghost" disabled={locked} onClick={onRetake} type="button">
              Retake quiz
            </button>
          </>
        ) : (
          <button className="button button--ghost" disabled={locked} onClick={onSelect} type="button">
            {active ? 'Continue quiz' : 'Start quiz'}
          </button>
        )}
      </div>
    </article>
  );
}

export function LecturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assessmentModeById, setAssessmentModeById] = useState<Record<string, AssessmentInteractionMode>>({});
  const [assessmentAttemptNonceById, setAssessmentAttemptNonceById] = useState<Record<string, number>>({});
  const [lecturePlaybackPauseToken, setLecturePlaybackPauseToken] = useState(0);
  const {
    recordCourseAssessmentResult,
    recordQuizResult,
    setLectureState,
    setModuleProgress,
    state,
  } = useLearnerProgress();
  const adminSessionActive = useCourseAdminSessionActive();
  const vendorSessionActive = useCourseVendorSessionActive();
  const nowMs = useCourseNow();
  const accessOptions = useMemo(
    () => ({ admin: adminSessionActive, nowMs, preview: vendorSessionActive }),
    [adminSessionActive, nowMs, vendorSessionActive],
  );
  const reviewedCount = lectureManifest.filter((lecture) => state.lectureWatchStatus[lecture.id]?.completed).length;
  const quizReadyCount = lectureManifest.filter((lecture) => {
    const watchState = state.lectureWatchStatus[lecture.id];

    return watchState?.quizUnlockedAt || watchState?.completed;
  }).length;
  const activeTab = searchParams.get('tab') === 'aabip-videos' ? 'aabip-videos' : 'course-videos';
  const selectedAssessmentParam = searchParams.get('assessment');
  const selectedCourseAssessmentId =
    selectedAssessmentParam && getCourseAssessmentById(selectedAssessmentParam)?.kind === 'post-lecture-quiz'
      ? selectedAssessmentParam
      : null;
  const nextCourseStep = getNextCourseStep(state, accessOptions);
  const courseStepModels = useMemo(() => getCourseStepModels(state, accessOptions), [accessOptions, state]);
  const activeAssessmentId = selectedCourseAssessmentId ?? nextCourseStep?.assessmentId ?? null;
  const lectureModuleProgress = getLectureModuleProgressSummary(state);
  const completedAssessments = postLectureCourseAssessments.filter(
    (assessment) => state.courseAssessmentResults[assessment.id]?.completedAt,
  ).length;

  const assessmentsByTrailingLectureId = useMemo(() => {
    return postLectureCourseAssessments.reduce<Record<string, CourseAssessmentContent[]>>((grouped, assessment) => {
      const lectureId = getTrailingLectureId(assessment);

      if (!lectureId) {
        return grouped;
      }

      return {
        ...grouped,
        [lectureId]: [...(grouped[lectureId] ?? []), assessment],
      };
    }, {});
  }, []);

  const handleLectureUpdate = useCallback(
    (lectureId: string, update: LectureStateUpdate) => {
      const wasWorkflowComplete = getLectureWorkflowStatus(state, lectureId, accessOptions)?.completed ?? false;
      const completesWorkflowStep = Boolean(
        update.completed || update.quizReady || update.opened || (update.watchedSeconds ?? 0) > 0,
      );
      const nextCompletedCount =
        lectureModuleProgress.completedCount + (!wasWorkflowComplete && completesWorkflowStep ? 1 : 0);

      setLectureState(lectureId, update);

      if (completesWorkflowStep) {
        setModuleProgress(
          'lectures',
          getProgressPercent(nextCompletedCount, lectureModuleProgress.totalCount),
          nextCompletedCount >= lectureModuleProgress.totalCount,
        );
      }
    },
    [accessOptions, lectureModuleProgress.completedCount, lectureModuleProgress.totalCount, setLectureState, setModuleProgress, state],
  );

  function stopLecturePlayback() {
    setLecturePlaybackPauseToken((current) => current + 1);
  }

  function handleTabChange(nextTab: VideoTabId) {
    if (nextTab !== activeTab) {
      stopLecturePlayback();
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextTab === 'course-videos') {
      nextSearchParams.delete('tab');
    } else {
      nextSearchParams.set('tab', nextTab);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  function handleAssessmentSelect(assessmentId: string) {
    stopLecturePlayback();

    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.delete('tab');
    nextSearchParams.set('assessment', assessmentId);
    setSearchParams(nextSearchParams, { replace: true });
    setAssessmentModeById((current) => ({
      ...current,
      [assessmentId]: 'attempt',
    }));
  }

  function handleAssessmentReview(assessmentId: string) {
    handleAssessmentSelect(assessmentId);
    setAssessmentModeById((current) => ({
      ...current,
      [assessmentId]: 'review',
    }));
  }

  function handleAssessmentRetake(assessmentId: string) {
    handleAssessmentSelect(assessmentId);
    setAssessmentModeById((current) => ({
      ...current,
      [assessmentId]: 'attempt',
    }));
    setAssessmentAttemptNonceById((current) => ({
      ...current,
      [assessmentId]: (current[assessmentId] ?? 0) + 1,
    }));
  }

  function handleCourseAssessmentComplete(
    assessment: CourseAssessmentContent,
    result: QuizResult,
  ) {
    setAssessmentModeById((current) => ({
      ...current,
      [assessment.id]: 'attempt',
    }));
    const wasComplete = Boolean(state.courseAssessmentResults[assessment.id]?.completedAt);
    const nextCompletedCount = lectureModuleProgress.completedCount + (wasComplete ? 0 : 1);
    const answers = result.items.map((item) => ({
      questionId: item.question.id,
      selectedOptionIds: item.selectedOptionIds,
      correctOptionIds: item.question.correctOptionIds,
      isCorrect: item.isCorrect,
    }));

    recordCourseAssessmentResult({
      assessmentId: assessment.id,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      percent: result.percent,
      answers,
    });
    recordQuizResult({
      id: `${assessment.id}-${Date.now()}`,
      label: assessment.title,
      moduleId: 'lectures',
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      percent: result.percent,
    });
    setModuleProgress(
      'lectures',
      getProgressPercent(nextCompletedCount, lectureModuleProgress.totalCount),
      nextCompletedCount >= lectureModuleProgress.totalCount,
    );
  }

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Lecture module</div>
            <h2>Course videos and post-lecture quizzes</h2>
            <p>
              Open each lecture to unlock its quiz in place. The next lecture still opens only after the required quiz
              is submitted.
            </p>
          </div>
          <div className="tag-row">
            <span className="tag">{lectureManifest.length} course videos</span>
            <span className="tag">{completedAssessments}/{postLectureCourseAssessments.length} quizzes</span>
            <span className="tag">Current: {nextCourseStep?.title ?? 'Complete'}</span>
          </div>
        </div>
        <div aria-label="Video library tabs" className="button-row button-row--wrap" role="tablist">
          {VIDEO_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                aria-controls={`lectures-panel-${tab.id}`}
                aria-selected={isActive}
                className={`control-pill${isActive ? ' control-pill--active' : ''}`}
                id={`lectures-tab-${tab.id}`}
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <CourseStepGuidance steps={courseStepModels} />

      {activeTab === 'course-videos' ? (
        <div aria-labelledby="lectures-tab-course-videos" id="lectures-panel-course-videos" role="tabpanel">
          <section className="section-card">
            <div className="section-card__heading">
              <div>
                <div className="eyebrow">Lecture manifest</div>
                <h2>Prep window: {courseInfo.prepWindow}</h2>
                <p>
                  Start with the welcome tab, then complete the pre-course survey and test. Lecture quizzes unlock in
                  sequence; the final post-test, survey, answers, and certificate live in the post-course tab.
                </p>
              </div>
            </div>
            <div className="mini-card-grid">
              {courseInfo.prepTopics.map((topic) => (
                <article key={topic} className="mini-card">
                  <p>{topic}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-card">
            <div className="section-card__heading">
              <div>
                <div className="eyebrow">Progress</div>
                <h2>{lectureModuleProgress.completedCount} of {lectureModuleProgress.totalCount} lecture-module steps complete</h2>
                <p>
                  {quizReadyCount} of {lectureManifest.length} lectures opened for quiz; {reviewedCount} fully viewed.{' '}
                  {nextCourseStep ? `Current step: ${nextCourseStep.title}` : 'All course steps are complete.'}
                </p>
              </div>
              <div className="tag-row">
                <span className="tag">{lectureModuleProgress.percent}% complete</span>
              </div>
            </div>
            <div className="stack-list">
              {lectureManifest.map((lecture) => {
                const workflowStatus = getLectureWorkflowStatus(state, lecture.id, accessOptions);
                const lectureAssessments = assessmentsByTrailingLectureId[lecture.id] ?? [];

                return (
                  <div key={lecture.id} className="lecture-workflow-item">
                    <LectureCard
                      defaultExpanded={workflowStatus?.status === 'current'}
                      lecture={lecture}
                      locked={!workflowStatus?.unlocked}
                      lockedReason={workflowStatus?.lockedReason}
                      onUpdateWatchState={handleLectureUpdate}
                      pauseToken={lecturePlaybackPauseToken}
                      watchState={state.lectureWatchStatus[lecture.id]}
                    />
                    {lectureAssessments.map((assessment) => {
                      const workflow = getAssessmentWorkflowStatus(state, assessment, accessOptions);
                      const progress = getCourseAssessmentProgress(state, assessment.id);
                      const active = activeAssessmentId === assessment.id;
                      const activeMode = assessmentModeById[assessment.id];
                      const shouldShowQuiz = Boolean(active && workflow?.unlocked && (!progress?.completedAt || activeMode));
                      const reviewMode = Boolean(progress?.completedAt && activeMode === 'review');
                      const attemptNonce = assessmentAttemptNonceById[assessment.id] ?? 0;

                      return (
                        <div key={assessment.id} className="lecture-assessment-stack">
                          <CourseAssessmentSummary
                            active={active}
                            assessment={assessment}
                            onSelect={() => handleAssessmentSelect(assessment.id)}
                            onRetake={() => handleAssessmentRetake(assessment.id)}
                            onReview={() => handleAssessmentReview(assessment.id)}
                            progress={progress}
                            workflow={workflow}
                          />
                          {shouldShowQuiz ? (
                            <QuizCard
                              key={
                                reviewMode
                                  ? `${assessment.id}-review-${progress?.attemptCount ?? 0}`
                                  : `${assessment.id}-attempt-${attemptNonce}`
                              }
                              allowRetake={Boolean(progress?.completedAt)}
                              completionMessage="You may continue to the next required step."
                              completionRecordedInitially={Boolean(reviewMode)}
                              initialAnswers={reviewMode ? getSavedAssessmentAnswers(progress) : undefined}
                              label={assessment.title}
                              onComplete={(result) => handleCourseAssessmentComplete(assessment, result)}
                              onRetake={() => handleAssessmentRetake(assessment.id)}
                              questions={assessment.questions}
                              readOnly={Boolean(reviewMode)}
                              revealAnswers
                              showDifficultyLabel={false}
                              showRunningScore={false}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <AabipVideoLibrary labelledBy="lectures-tab-aabip-videos" panelId="lectures-panel-aabip-videos" />
      )}
    </div>
  );
}
