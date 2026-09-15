'use client'

import { HEMODYNAMICS_QUESTION_SORT } from '../../content/questionSort'
import { measurementOrigins } from '../../content/introductoryTeaching'
import { waveformAtlasById } from '../../content/waveformAtlas'
import type { IntroTeaching } from '../../content/stageLessons'
import type { HemodynamicSimulationState } from '../../engine/types'
import { NormalWaveformReference } from '../NormalWaveformReference'
import { WaveformAtlasFigure } from '../WaveformAtlasFigure'
import styles from './hemodynamics-stage.module.css'

export function IntroductoryTeaching({
  topic,
  state,
}: {
  readonly topic: IntroTeaching
  readonly state: HemodynamicSimulationState
}) {
  switch (topic) {
    case 'orientation':
      return (
        <section className={styles.teachingCard}>
          <h3>Measurements and their origins</h3>
          <p>
            A patient is hypotensive. Is the pressure low because flow is low, resistance is low, or
            several processes coexist? Start with the clinical question before choosing a monitoring
            method.
          </p>
          <dl className={styles.stopFacts}>
            {measurementOrigins.map((origin) => (
              <div key={origin.label}>
                <dt>{origin.label}</dt>
                <dd>{origin.text}</dd>
              </div>
            ))}
          </dl>
          <h4>Worked example · pressure and flow</h4>
          <p>
            Two illustrative patients have the same valid arterial mean pressure of 60 mmHg.
            Thermodilution cardiac output is 2.8 L/min in patient A and 7.0 L/min in patient B. The
            pressure is the same, but the volume of blood pumped each minute is different.
          </p>
          <p>
            The pressure measurement alone could not distinguish these patients. Flow measurements
            help evaluate the contributions of output and vascular resistance; examination,
            perfusion findings and echocardiography supply the clinical context. Neither reading
            alone establishes the cause, predicts benefit from fluid, or determines treatment.
          </p>
          <p className={styles.dockNote}>
            These are authored comparison values. They are not treatment targets.
          </p>
          <p>
            Hypotension alone is not an indication to place a PAC. The monitoring method depends on
            the clinical question and the patient.
          </p>
          <p className={styles.dockNote}>
            Next: interpret a different text vignette, then classify measurement origins.
          </p>
        </section>
      )
    case 'sort-example':
      return (
        <section className={styles.teachingCard}>
          <h3>A worked measurement classification</h3>
          <dl className={styles.stopFacts}>
            {HEMODYNAMICS_QUESTION_SORT.origins.map((origin) => (
              <div key={origin.id}>
                <dt>{origin.label}</dt>
                <dd>{origin.definition}</dd>
              </div>
            ))}
          </dl>
          <p>
            <strong>Worked classification:</strong> What is the right-atrial pressure from a
            correctly positioned proximal PAC port? This is a clinical measurement: pressure is
            transmitted to a transducer. Viewing this example does not count toward your responses
            to the seven independent questions.
          </p>
          <p>
            Here, “clinical measurement” includes thermodilution cardiac output obtained through its
            measurement method. Later lessons distinguish the raw temperature signal, method-derived
            flow, and further calculated variables such as resistance.
          </p>
        </section>
      )
    case 'level':
      return (
        <section className={styles.teachingCard}>
          <h3>Leveling</h3>
          <p>
            The transducer height sets the hydrostatic reference. Raising it above the reference
            makes the displayed pressure lower; lowering it makes the pressure higher. The offset
            shifts the whole waveform without changing its morphology or pulse pressure.
          </p>
          <p>
            Use the height control beside the hydrostatic illustration. The readouts come from the
            actual simulation. The separate arterial line and PAC share the reference-error setting
            in this simplified model.
          </p>
        </section>
      )
    case 'zero':
      return (
        <section className={styles.teachingCard}>
          <h3>Zeroing</h3>
          <p>
            Atmospheric pressure establishes the electronic zero. Leveling establishes the physical
            height. Zeroing a transducer that is too high or too low leaves the hydrostatic error in
            place.
          </p>
          <p>
            This demonstration isolates zeroing with the transducer at reference height and normal
            damping. The button represents the complete atmospheric-zero workflow; individual
            stopcock positions are not simulated.
          </p>
        </section>
      )
    case 'scale':
      return (
        <section className={styles.teachingCard}>
          <h3>Display scale</h3>
          <p>
            The scale control changes the vertical axis of the systemic arterial display, labeled
            ART. It does not change the measured arterial pressures, the PAC pressure, or the
            patient.
          </p>
          <p>
            A low scale may clip the arterial peak. Compare the ART axis and readout when changing
            the scale; do not interpret the size of a drawing without its units.
          </p>
        </section>
      )
    case 'response':
      return (
        <section className={styles.teachingCard}>
          <h3>Dynamic response</h3>
          <p>
            After a brief flush plateau, an acceptable system settles promptly. An overdamped system
            suppresses rapid changes; an underdamped system oscillates and exaggerates them. Neither
            is repaired by leveling or changing the display scale.
          </p>
          <p>
            Compare the labeled release examples before classifying a new line. The curves use the
            existing line-specific generator. They are qualitative teaching traces, not newly
            captured patient measurements.
          </p>
          <p>
            Before a clinical catheter flush, confirm the waveform, catheter position and a deflated
            balloon. Never flush a wedged or spontaneously wedged catheter. Follow the device
            instructions and supervised local procedure.
          </p>
        </section>
      )
    case 'normal-walk':
      return (
        <section className={styles.teachingCard}>
          <h3>Normal waveform reference · current walk stop</h3>
          <p>
            The reference follows the chamber selected by the walk. Its fixed scale, anatomy and ECG
            describe that chamber; the live monitor uses the separate teaching-patient values.
          </p>
          <NormalWaveformReference
            fixedPosition={
              state.catheter.position === 'introducer' ? 'ra' : state.catheter.position
            }
            concise
          />
        </section>
      )
    case 'rv-pa':
      return (
        <section className={styles.teachingCard}>
          <h3>Right ventricle versus pulmonary artery</h3>
          <p>
            Reference examples · shared 0–40 mmHg axis. Compare the low RV diastolic pressure with
            the PA diastolic step-up and valve-closure notch. Systolic height alone cannot
            distinguish them.
          </p>
          {['rv-normal', 'pa-normal'].map((id) => (
            <WaveformAtlasFigure
              key={id}
              entry={waveformAtlasById.get(id)!}
              scaleMaxMmHg={40}
              ecgLandmarks
              readable
            />
          ))}
        </section>
      )
    case 'components':
      return (
        <section className={styles.teachingCard}>
          <h3>Components of an atrial tracing</h3>
          <p>
            Begin with a confirmed normal right-atrial tracing in sinus rhythm. The a, c and v waves
            are pressure peaks; x and y are descents. Use the synchronized ECG to locate them in the
            cardiac cycle.
          </p>
          <p>
            These are idealized timing landmarks. The c wave can be subtle; conduction, rhythm,
            breathing and catheter transmission affect what is recognizable. PAWP has transmission
            delay and must not be assigned right-atrial timing without qualification.
          </p>
          <p>
            Select each component in the frozen demonstration. The next activity lets you find them
            on numbered regions, with an optional renumbered repeat and the labelled reference one
            click away.
          </p>
        </section>
      )
    case 'abnormal':
      return (
        <section className={styles.teachingCard}>
          <h3>Contrasting abnormal atrial patterns</h3>
          <p>
            Authored right-atrial pressure patterns on a shared axis illustrate altered atrial
            contraction. Rhythm-specific ECG timing is not modeled in these examples. Interpret the
            pressure pattern alongside the patient and echocardiography.
          </p>
          {['ra-cannon-a-wave', 'ra-atrial-fibrillation'].map((id) => (
            <div key={id}>
              <WaveformAtlasFigure
                entry={waveformAtlasById.get(id)!}
                scaleMaxMmHg={40}
                showEcg={false}
                readable
              />
              <p>{waveformAtlasById.get(id)!.summary}</p>
            </div>
          ))}
          <p>
            General mechanism comparison:{' '}
            {waveformAtlasById.get('ra-tricuspid-regurgitation')!.summary}{' '}
            {waveformAtlasById.get('ra-tamponade')!.summary}
          </p>
          <p className={styles.dockNote}>
            The labeled examples above illustrate altered atrial contraction. The later questions
            use different model tracings and clinical vignettes.
          </p>
          <details>
            <summary>Browse other abnormal patterns</summary>
            <p>
              The full atlas opens in Teaching once you check an answer or show the explanation.
            </p>
          </details>
        </section>
      )
    case 'attempt':
      return (
        <section className={styles.teachingCard} data-independent-guidance>
          <h3>Your attempt</h3>
          <p>
            Use the signal or vignette in this task. For a tracing question, check its units and
            timing against the ECG, then weigh your reading against the stated patient context. The
            example’s labels and feedback appear when you check an answer or open the explanation.
          </p>
          <p>
            Review an earlier teaching step with Back if needed. The live monitor remains at its
            current state; looking back does not restore an earlier patient snapshot.
          </p>
        </section>
      )
  }
}
