import {
  TROUBLESHOOTING_PATIENT,
  TROUBLESHOOTING_PERSISTENT,
  TROUBLESHOOTING_RULE,
  TROUBLESHOOTING_STEPS,
} from '../content/troubleshooting'
import styles from './course.module.css'

/**
 * The lesson's troubleshooting questions as one ordered flow beside the briefing (L24-2), in
 * place of the generic transducer sketch that used to fill this pane. Every line is the lesson's
 * own text; see `content/troubleshooting.ts` for how each row is traced.
 */
export function TroubleshootingFlow() {
  return (
    <section className={styles.figure} data-troubleshooting-flow aria-labelledby="ebus-ladder">
      <h2 id="ebus-ladder">The lesson’s troubleshooting questions</h2>
      <p className={styles.muted}>
        In the order this lesson asks them. Where the lesson pairs a question with an example
        problem, the example is shown with it.
      </p>
      <ol className={styles.ladder}>
        {TROUBLESHOOTING_STEPS.map((step) => (
          <li key={step.question} data-ladder-step>
            <p className={styles.ladderQuestion}>{step.question}</p>
            {step.example ? (
              <dl>
                <dt>Example problem</dt>
                <dd>{step.example.observed}</dd>
                <dt>What the lesson says to do</dt>
                <dd>{step.example.response}</dd>
              </dl>
            ) : (
              <p className={styles.muted}>The lesson asks this without a paired example.</p>
            )}
          </li>
        ))}
      </ol>
      <p>
        <strong>Then:</strong> {TROUBLESHOOTING_RULE}
      </p>
      <section className={styles.ladderNote} aria-label="When a correction does not resolve it">
        <p>{TROUBLESHOOTING_PERSISTENT.text}</p>
        <dl>
          <dt>Example problem</dt>
          <dd>{TROUBLESHOOTING_PERSISTENT.example.observed}</dd>
          <dt>What the lesson says to do</dt>
          <dd>{TROUBLESHOOTING_PERSISTENT.example.response}</dd>
        </dl>
      </section>
      {/*
       * The patient-safety paragraph is beside this flow in the lesson text; it is pointed to, in
       * its own first sentence, rather than printed twice on one screen.
       */}
      <p className={styles.notice} data-troubleshooting-patient>
        <strong>Throughout:</strong> {TROUBLESHOOTING_PATIENT} The lesson text beside this flow says
        when to pause acquisition.
      </p>
    </section>
  )
}
