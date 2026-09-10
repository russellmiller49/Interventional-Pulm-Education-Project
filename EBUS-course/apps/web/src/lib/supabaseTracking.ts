import type { SupabaseClient } from '@supabase/supabase-js';

import { postCourseSurveyDefinition, preCourseSurveyDefinition } from '@/content/courseSurveys';
import { getLectureViewedPercent } from '@/features/lectures/watchProgress';
import type { LearnerProgressState, LectureWatchState } from '@/lib/progress';

export interface ModuleSessionRecordInput {
  moduleId: 'pretest' | 'lectures' | 'knobology' | 'stations' | 'tnm-staging' | 'simulator';
  routePath: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

function assertSupabaseWrite(
  result: {
    error: { message: string } | null;
  },
) {
  if (result.error) {
    throw new Error(result.error.message);
  }
}

function getStationsProgress(state: LearnerProgressState) {
  return Math.round(
    (state.moduleProgress['station-map'].percentComplete + state.moduleProgress['station-explorer'].percentComplete) / 2,
  );
}

function getStationsVisitedAt(state: LearnerProgressState) {
  const dates = [state.moduleProgress['station-map'].visitedAt, state.moduleProgress['station-explorer'].visitedAt].filter(
    Boolean,
  ) as string[];

  if (dates.length === 0) {
    return null;
  }

  return [...dates].sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function getStationsCompletedAt(state: LearnerProgressState) {
  const completedAt = [
    state.moduleProgress['station-map'].completedAt,
    state.moduleProgress['station-explorer'].completedAt,
  ].filter(Boolean) as string[];

  if (completedAt.length < 2) {
    return null;
  }

  return [...completedAt].sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function toLectureProgressRows(userId: string, lectureWatchStatus: Record<string, LectureWatchState>) {
  return Object.entries(lectureWatchStatus).map(([lectureId, value]) => ({
    learner_id: userId,
    lecture_id: lectureId,
    duration_seconds: Math.max(0, Math.floor(value.durationSeconds)),
    last_position_seconds: Math.max(0, Math.floor(value.lastPositionSeconds)),
    watched_seconds: Math.max(0, Math.floor(value.watchedSeconds)),
    viewed_percent: getLectureViewedPercent({
      durationSeconds: value.durationSeconds,
      watchedSeconds: value.watchedSeconds,
    }),
    completed: value.completed,
    completed_at: value.completedAt,
    last_opened_at: value.lastOpenedAt,
    quiz_unlocked_at: value.quizUnlockedAt,
    updated_at: new Date().toISOString(),
  }));
}

function toTrackedModuleRows(userId: string, state: LearnerProgressState) {
  return [
    {
      learner_id: userId,
      module_id: 'pretest',
      percent_complete: state.moduleProgress.pretest.percentComplete,
      visited_at: state.moduleProgress.pretest.visitedAt,
      completed_at: state.moduleProgress.pretest.completedAt,
      time_spent_seconds: state.engagement.pretest.totalSeconds,
    },
    {
      learner_id: userId,
      module_id: 'lectures',
      percent_complete: state.moduleProgress.lectures.percentComplete,
      visited_at: state.moduleProgress.lectures.visitedAt,
      completed_at: state.moduleProgress.lectures.completedAt,
      time_spent_seconds: state.engagement.lectures.totalSeconds,
    },
    {
      learner_id: userId,
      module_id: 'knobology',
      percent_complete: state.moduleProgress.knobology.percentComplete,
      visited_at: state.moduleProgress.knobology.visitedAt,
      completed_at: state.moduleProgress.knobology.completedAt,
      time_spent_seconds: state.engagement.knobology.totalSeconds,
    },
    {
      learner_id: userId,
      module_id: 'stations',
      percent_complete: getStationsProgress(state),
      visited_at: getStationsVisitedAt(state),
      completed_at: getStationsCompletedAt(state),
      time_spent_seconds: state.engagement.stations.totalSeconds,
    },
    {
      learner_id: userId,
      module_id: 'tnm-staging',
      percent_complete: state.moduleProgress['tnm-staging'].percentComplete,
      visited_at: state.moduleProgress['tnm-staging'].visitedAt,
      completed_at: state.moduleProgress['tnm-staging'].completedAt,
      time_spent_seconds: state.engagement['tnm-staging'].totalSeconds,
    },
    {
      learner_id: userId,
      module_id: 'simulator',
      percent_complete: state.moduleProgress.simulator.percentComplete,
      visited_at: state.moduleProgress.simulator.visitedAt,
      completed_at: state.moduleProgress.simulator.completedAt,
      time_spent_seconds: state.engagement.simulator.totalSeconds,
    },
  ].map((row) => ({
    ...row,
    updated_at: new Date().toISOString(),
  }));
}

function getLatestPretestAttempt(state: LearnerProgressState) {
  if (!state.pretest.submittedAt || state.pretest.attemptCount <= 0 || state.pretest.totalQuestions <= 0) {
    return null;
  }

  return {
    attempt_number: state.pretest.attemptCount,
    answered_count: state.pretest.answeredCount,
    answers: state.pretest.answers,
    percent: Math.round(((state.pretest.score ?? 0) / state.pretest.totalQuestions) * 100),
    score: state.pretest.score ?? 0,
    submitted_at: state.pretest.submittedAt,
    total_questions: state.pretest.totalQuestions,
  };
}

function toCourseSurveyRows(userId: string, state: LearnerProgressState) {
  return [
    {
      definition: preCourseSurveyDefinition,
      progress: state.preCourseSurvey,
    },
    {
      definition: postCourseSurveyDefinition,
      progress: state.courseSurvey,
    },
  ].flatMap(({ definition, progress }) => {
    if (!progress.submittedAt) {
      return [];
    }

    return [
      {
        learner_id: userId,
        survey_id: definition.id,
        survey_version: definition.version,
        responses: progress.responses,
        submitted_at: progress.submittedAt,
        updated_at: new Date().toISOString(),
      },
    ];
  });
}

export async function syncLearnerSnapshot(client: SupabaseClient, userId: string, state: LearnerProgressState) {
  const now = new Date().toISOString();
  const latestPretestAttempt = getLatestPretestAttempt(state);
  const courseSurveyRows = toCourseSurveyRows(userId, state);
  const lectureRows = toLectureProgressRows(userId, state.lectureWatchStatus);
  const trackedModuleRows = toTrackedModuleRows(userId, state);

  assertSupabaseWrite(
    await client.from('learner_progress_snapshots').upsert(
      {
        learner_id: userId,
        payload: state,
        updated_at: now,
      },
      { onConflict: 'learner_id' },
    ),
  );

  if (trackedModuleRows.length > 0) {
    assertSupabaseWrite(
      await client.from('learner_module_progress').upsert(trackedModuleRows, {
        onConflict: 'learner_id,module_id',
      }),
    );
  }

  if (lectureRows.length > 0) {
    assertSupabaseWrite(
      await client.from('learner_lecture_progress').upsert(lectureRows, {
        onConflict: 'learner_id,lecture_id',
      }),
    );
  }

  if (latestPretestAttempt) {
    assertSupabaseWrite(
      await client.from('learner_pretest_attempts').upsert(
        {
          learner_id: userId,
          ...latestPretestAttempt,
        },
        {
          onConflict: 'learner_id,attempt_number',
        },
      ),
    );
  }

  if (courseSurveyRows.length > 0) {
    assertSupabaseWrite(
      await client.from('learner_course_surveys').upsert(courseSurveyRows, {
        onConflict: 'learner_id,survey_id',
      }),
    );
  }
}

export async function recordModuleSession(client: SupabaseClient, userId: string, session: ModuleSessionRecordInput) {
  if (session.durationSeconds <= 0) {
    return;
  }

  assertSupabaseWrite(
    await client.from('learner_module_sessions').insert({
      learner_id: userId,
      module_id: session.moduleId,
      route_path: session.routePath,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      duration_seconds: session.durationSeconds,
    }),
  );
}
