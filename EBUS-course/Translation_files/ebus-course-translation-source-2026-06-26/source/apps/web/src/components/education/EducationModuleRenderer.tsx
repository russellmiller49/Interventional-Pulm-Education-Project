import { resolveEducationImages, type RelatedImageAsset } from '@/content/education';
import type {
  EducationalModuleContent,
  LessonCaseVignette,
  LessonSection,
  QuizQuestionContent,
  StationBoundaryDefinition,
  StationStagingImplication,
} from '@/content/types';
import { isQuizAnswerCorrect } from '@/lib/quiz';

import './education.css';

function formatSectionKind(kind: LessonSection['kind']): string {
  return kind.replace(/-/g, ' ');
}

function formatCorrectAnswer(question: QuizQuestionContent): string {
  if (question.type === 'ordering') {
    return question.correctOptionIds
      .map((optionId, index) => {
        const option = question.options.find((entry) => entry.id === optionId);
        return `${index + 1}. ${option?.label ?? optionId}`;
      })
      .join('  ');
  }

  return question.correctOptionIds
    .map((optionId) => question.options.find((entry) => entry.id === optionId)?.label ?? optionId)
    .join(', ');
}

export function LearningObjectivesCard({
  objectives,
  title = 'Learning objectives',
}: {
  objectives: string[];
  title?: string;
}) {
  return (
    <article className="education-card education-card--objectives">
      <div className="eyebrow">{title}</div>
      <ul className="plain-list education-objectives">
        {objectives.map((objective) => (
          <li key={objective}>{objective}</li>
        ))}
      </ul>
    </article>
  );
}

export function ClinicalPearlCallout({ children }: { children: string }) {
  return (
    <aside className="education-callout education-callout--pearl">
      <strong>Clinical pearl</strong>
      <p>{children}</p>
    </aside>
  );
}

export function PitfallCallout({ children }: { children: string }) {
  return (
    <aside className="education-callout education-callout--pitfall">
      <strong>Pitfall</strong>
      <p>{children}</p>
    </aside>
  );
}

export function StagingImplicationBadge({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'accent';
}) {
  return (
    <span className={`staging-badge staging-badge--${tone}`}>
      <strong>{label}</strong>
      <span>{value}</span>
    </span>
  );
}

export function StationBoundaryCard({
  boundary,
  notes,
}: {
  boundary: StationBoundaryDefinition;
  notes: string[];
}) {
  const entries = [
    { label: 'Superior', value: boundary.superior },
    { label: 'Inferior', value: boundary.inferior },
    { label: 'Medial', value: boundary.medial },
    { label: 'Lateral', value: boundary.lateral },
    { label: 'Anterior', value: boundary.anterior },
    { label: 'Posterior', value: boundary.posterior },
  ].filter((entry) => Boolean(entry.value));

  return (
    <article className="education-card">
      <div className="eyebrow">Station boundary</div>
      <div className="boundary-grid">
        {entries.map((entry) => (
          <div key={entry.label} className="boundary-grid__item">
            <strong>{entry.label}</strong>
            <p>{entry.value}</p>
          </div>
        ))}
      </div>
      {notes.length ? (
        <ul className="plain-list education-list">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function LandmarkChecklist({
  items,
  title = 'Landmark checklist',
}: {
  items: string[];
  title?: string;
}) {
  return (
    <article className="education-card education-card--checklist">
      <div className="eyebrow">{title}</div>
      <ul className="plain-list education-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export function RelatedImagesStrip({ items }: { items: RelatedImageAsset[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="related-images-strip">
      {items.map((item) => (
        <figure key={item.id} className="related-images-strip__item">
          <img alt={item.label} loading="lazy" src={item.src} />
          <figcaption>
            <strong>{item.label}</strong>
            {item.note ? <span>{item.note}</span> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function CaseVignetteCard({ vignette }: { vignette: LessonCaseVignette }) {
  return (
    <article className="education-card education-card--case">
      <div className="eyebrow">Case vignette</div>
      <h3>{vignette.title}</h3>
      <p>{vignette.scenario}</p>
      <div className="education-case">
        <strong>Question</strong>
        <p>{vignette.prompt}</p>
      </div>
      <div className="education-case education-case--takeaway">
        <strong>Takeaway</strong>
        <p>{vignette.takeaway}</p>
      </div>
    </article>
  );
}

export function ArtifactCard({
  section,
  images,
}: {
  section: LessonSection;
  images: RelatedImageAsset[];
}) {
  return (
    <article className="education-card education-card--artifact">
      <div className="eyebrow">{formatSectionKind(section.kind)}</div>
      <h3>{section.title}</h3>
      <p>{section.body}</p>
      {section.bullets?.length ? (
        <ul className="plain-list education-list">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      <RelatedImagesStrip items={images} />
      {section.pearl ? <ClinicalPearlCallout>{section.pearl}</ClinicalPearlCallout> : null}
      {section.pitfall ? <PitfallCallout>{section.pitfall}</PitfallCallout> : null}
    </article>
  );
}

export function QuizExplanationPanel({
  question,
  selectedOptionIds,
  showDifficulty = true,
}: {
  question: QuizQuestionContent;
  selectedOptionIds: string[];
  showDifficulty?: boolean;
}) {
  const correct = isQuizAnswerCorrect(question, selectedOptionIds);
  const showMeta = showDifficulty || question.tags.length > 0;

  return (
    <div className={`quiz-explanation-panel${correct ? ' quiz-explanation-panel--success' : ''}`}>
      {showMeta ? (
        <div className="quiz-explanation-panel__meta">
          {showDifficulty ? <span className="tag">Difficulty: {question.difficulty}</span> : null}
          {question.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="quiz-explanation-panel__answer">
        <strong>Correct answer</strong>
        <p>{formatCorrectAnswer(question)}</p>
      </div>
      <p>{question.explanation}</p>
      <div className="stack-list">
        {question.options.map((option) => {
          const isCorrect = question.correctOptionIds.includes(option.id);
          const wasSelected = selectedOptionIds.includes(option.id);

          return (
            <article
              key={option.id}
              className={`education-option-rationale${
                isCorrect ? ' education-option-rationale--correct' : ' education-option-rationale--incorrect'
              }${!isCorrect && wasSelected ? ' education-option-rationale--selected' : ''}`}
            >
              <strong>{option.label}</strong>
              <p>{option.rationale}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function EducationSectionCard({ section }: { section: LessonSection }) {
  const images = resolveEducationImages(section.imageIds);

  if (section.kind === 'artifact') {
    return <ArtifactCard images={images} section={section} />;
  }

  return (
    <article className={`education-card education-card--${section.kind}`}>
      <div className="eyebrow">{formatSectionKind(section.kind)}</div>
      <h3>{section.title}</h3>
      <p>{section.body}</p>
      {section.bullets?.length ? (
        <ul className="plain-list education-list">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {section.checklist?.length ? <LandmarkChecklist items={section.checklist} title="Checklist" /> : null}
      <RelatedImagesStrip items={images} />
      {section.caseVignette ? <CaseVignetteCard vignette={section.caseVignette} /> : null}
      {section.pearl ? <ClinicalPearlCallout>{section.pearl}</ClinicalPearlCallout> : null}
      {section.pitfall ? <PitfallCallout>{section.pitfall}</PitfallCallout> : null}
    </article>
  );
}

export function EducationModuleRenderer({
  module,
  compact = false,
}: {
  module: EducationalModuleContent;
  compact?: boolean;
}) {
  return (
    <section className="section-card reference-card">
      <div className="section-card__heading">
        <div>
          <div className="eyebrow">Handbook</div>
          <h2>{module.title}</h2>
          <p>{module.summary}</p>
        </div>
      </div>
      <div className={`education-module${compact ? ' education-module--compact' : ''}`}>
        <LearningObjectivesCard objectives={module.learningObjectives} />
        {module.sections.map((section) => (
          <EducationSectionCard key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
}

export function StationStagingSummary({
  staging,
  accessProfile,
}: {
  staging: StationStagingImplication;
  accessProfile: string;
}) {
  return (
    <div className="staging-summary">
      <StagingImplicationBadge label="Access" tone="accent" value={accessProfile} />
      <StagingImplicationBadge label="Ipsilateral" tone="neutral" value={staging.ipsilateral} />
      <StagingImplicationBadge label="Contralateral" tone="warning" value={staging.contralateral} />
      <p>{staging.note}</p>
    </div>
  );
}
