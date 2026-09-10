import { KnobologyPanel } from '@/features/knobology/KnobologyPanel';
import { QuizCard } from '@/features/quiz/QuizCard';
import { useCourseShellText } from '@/i18n/courseShell';
import { useLocalizedKnobologyQuizQuestions } from '@/i18n/localizedContent';
import { useLearnerProgress } from '@/lib/progress';

export function KnobologyPage() {
  const t = useCourseShellText();
  const { recordQuizResult, setModuleProgress, state } = useLearnerProgress();
  const questions = useLocalizedKnobologyQuizQuestions();
  const lastControl = state.lastUsedKnobologyControl ?? 'depth';

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">{t('Module')}</div>
            <h2>{t('Ultrasound foundations and EBUS knobology')}</h2>
          </div>
        </div>
        <div className="tag-row">
          <span className="tag">{t('Last used control:')} {t(lastControl)}</span>
          <span className="tag">{t('Progress:')} {state.moduleProgress.knobology.percentComplete}%</span>
          <span className="tag">{t('Reference follows the active control')}</span>
          <span className="tag">{t('Educational approximation only')}</span>
        </div>
      </section>

      <KnobologyPanel />

      <QuizCard
        label={t('Knobology quiz')}
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
