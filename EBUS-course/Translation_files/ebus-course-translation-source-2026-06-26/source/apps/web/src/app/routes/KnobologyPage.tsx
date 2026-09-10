import { KnobologyPanel } from '@/features/knobology/KnobologyPanel';
import { QuizCard } from '@/features/quiz/QuizCard';
import { getKnobologyQuizQuestions } from '@/content/knobology';
import { useLearnerProgress } from '@/lib/progress';

export function KnobologyPage() {
  const { recordQuizResult, setModuleProgress, state } = useLearnerProgress();
  const questions = getKnobologyQuizQuestions();
  const lastControl = state.lastUsedKnobologyControl ?? 'depth';

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Module</div>
            <h2>Ultrasound foundations and EBUS knobology</h2>
          </div>
        </div>
        <div className="tag-row">
          <span className="tag">Last used control: {lastControl}</span>
          <span className="tag">Progress: {state.moduleProgress.knobology.percentComplete}%</span>
          <span className="tag">Reference follows the active control</span>
          <span className="tag">Educational approximation only</span>
        </div>
      </section>

      <KnobologyPanel />

      <QuizCard
        label="Knobology quiz"
        onComplete={(result) => {
          recordQuizResult({
            id: `knobology-${Date.now()}`,
            label: 'Knobology quiz',
            moduleId: 'knobology',
            correctCount: result.correctCount,
            totalCount: result.totalCount,
            percent: result.percent,
          });
          setModuleProgress('knobology', result.percent >= 80 ? 100 : 95, result.percent >= 80);
        }}
        questions={questions}
      />
    </div>
  );
}
