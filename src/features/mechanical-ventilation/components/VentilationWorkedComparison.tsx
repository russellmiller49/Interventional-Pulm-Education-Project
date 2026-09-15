import type { VentilationQuestion } from '../content/learningQuestions'
import type { VentilationQuestionTeaching } from '../content/questionTeaching'
import { choiceFitLabel, VentilationSafetyNote } from './VentilationReinforcement'
import styles from './ventilation-course.module.css'

/**
 * A worked comparison shown in place of a question: the case, a comparison that teaches the
 * relationship, and every original reading explained. There is nothing to answer.
 */
export function VentilationWorkedComparison({
  question,
  teaching,
}: {
  readonly question: VentilationQuestion
  readonly teaching: VentilationQuestionTeaching
}) {
  const comparison = teaching.comparison
  if (!comparison) return null
  return (
    <section className={styles.question} data-worked-comparison={question.id}>
      <p className={styles.eyebrow}>Worked comparison</p>
      <p>{teaching.purpose}</p>
      <p>
        <strong>The case: </strong>
        {question.prompt}
      </p>
      <div className={styles.tableWrap}>
        <table
          className={`${styles.table} ${styles.comparisonTable}`}
          data-comparison={comparison.id}
        >
          <caption>{comparison.title}</caption>
          <thead>
            <tr>
              {comparison.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={cellIndex}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>{comparison.caption}</p>
      <div className={styles.feedback} data-reinforcement-explanation>
        <h3>Explanation</h3>
        <p>{teaching.explanation}</p>
        <p>
          <strong>What to check next: </strong>
          {teaching.nextCheck}
        </p>
        <details>
          <summary>How each reading fits this case</summary>
          {question.choices.map((choice) => (
            <div key={choice.id}>
              <p>
                <strong>{choice.label}. </strong>
                {choiceFitLabel(choice.id, question.correctId)}
                {choice.rationale}
              </p>
              {choice.safety ? <VentilationSafetyNote text={choice.safety} /> : null}
            </div>
          ))}
        </details>
      </div>
    </section>
  )
}
