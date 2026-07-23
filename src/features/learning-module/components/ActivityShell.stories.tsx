import type { Meta, StoryObj } from '@storybook/react'
import { NextIntlClientProvider } from 'next-intl'

import { ActivityShell } from './ActivityShell'
import type { ActivityLayout } from './ActivityChrome'
import { EvidenceDrawer } from './EvidenceDrawer'
import { PatientContextBar } from './PatientContextBar'
import { ReferenceDrawer } from './ReferenceDrawer'
import { ResumeBanner } from './ResumeBanner'
import { SimulationLaunchGate } from './SimulationLaunchGate'
import { TaskPanel } from './TaskPanel'
import styles from './learning-module-v2.module.css'

const meta: Meta = {
  title: 'Learning module/Activity shell V2',
  component: ActivityShell,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={{}}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
}

export default meta

type Story = StoryObj

const noop = () => undefined

function ExampleViewport({ masked = false }: { masked?: boolean }) {
  return (
    <div className="grid h-full min-h-80 place-items-center bg-slate-950 p-6 text-center text-slate-100">
      <div>
        <div className="mx-auto mb-5 h-32 w-64 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950" />
        <strong>{masked ? 'Assessment patient cues masked' : 'Synthetic bedside monitor'}</strong>
        <p className="mt-2 max-w-md text-sm text-slate-300">
          Text equivalent: arterial and pulmonary artery signals are visible; signal validity has
          not yet been established.
        </p>
      </div>
    </div>
  )
}

function ExampleShell({
  mode = 'guided',
  theme = 'light',
  masked = false,
  layout = 'guided-lab',
}: {
  mode?: 'guided' | 'practice' | 'challenge'
  theme?: 'light' | 'dark'
  masked?: boolean
  layout?: ActivityLayout
}) {
  return (
    <ActivityShell
      layout={layout}
      breadcrumb="Critical care / Hemodynamics / PAC signal validation"
      activityTitle="PAC signal validation"
      phase="predict"
      mode={mode}
      progressLabel="Phase 2 of 6"
      theme={theme}
      maskedAssessment={masked}
      onHelp={noop}
      onReset={noop}
      onSaveAndExit={noop}
      patientContext={
        <PatientContextBar
          items={[
            { label: 'History', value: masked ? 'Available after commit' : 'Synthetic adult ICU' },
            { label: 'Support', value: 'PAC + arterial line' },
            { label: 'Key vital', value: 'MAP 61 mmHg' },
          ]}
          immediateGoal="Decide whether the pressure signal can support interpretation."
          safetyConstraints={['Validate the signal before treating a displayed value.']}
        />
      }
      viewport={<ExampleViewport masked={masked} />}
      currentTask={
        <TaskPanel
          mode={mode}
          objective="Commit to signal usability before performing corrective actions."
          requiredAction="Choose usable or not usable, then state the first validation step."
          targets={['Prediction submitted', 'Reason selected']}
          hint="Compare leveling, zeroing, dynamic response, and catheter position."
          onHintRequested={noop}
        >
          <button type="button" className={styles.primaryButton}>
            Commit prediction
          </button>
        </TaskPanel>
      }
      bottomContent="Prediction has not been submitted. The simulator response remains hidden."
      secondaryActions={
        <>
          <ReferenceDrawer
            entries={[
              {
                id: 'signal-validation-sequence',
                title: 'Signal validation sequence',
                summary: 'Level, zero, test dynamic response, and confirm catheter position.',
              },
            ]}
            trigger={
              <button type="button" className={styles.secondaryButton}>
                Reference
              </button>
            }
          />
          <EvidenceDrawer
            entries={[
              {
                id: 'pac-source',
                title: 'PAC waveform source record',
                sourceLabel: 'Versioned educational source',
                limitation: 'Synthetic signals do not predict patient-specific response.',
              },
            ]}
            trigger={
              <button type="button" className={styles.secondaryButton}>
                Evidence
              </button>
            }
          />
        </>
      }
    />
  )
}

export const GuidedDesktop: Story = {
  render: () => <ExampleShell layout="guided-lab" />,
}

export const NativeWorkbench: Story = {
  render: () => <ExampleShell mode="practice" theme="dark" layout="native-workbench" />,
  parameters: { backgrounds: { default: 'dark' } },
}

export const CaseWorkspace: Story = {
  render: () => <ExampleShell mode="practice" layout="case-workspace" />,
}

export const DidacticLesson: Story = {
  render: () => <ExampleShell layout="didactic-lesson" />,
}

export const ChallengeDesktop: Story = {
  render: () => <ExampleShell mode="challenge" layout="case-workspace" />,
}

export const DarkDeviceTheme: Story = {
  render: () => <ExampleShell mode="practice" theme="dark" />,
  parameters: { backgrounds: { default: 'dark' } },
}

export const MaskedAssessmentPatient: Story = {
  render: () => <ExampleShell mode="challenge" theme="dark" masked />,
  parameters: { backgrounds: { default: 'dark' } },
}

export const TabletOneSurface: Story = {
  render: () => (
    <div className="mx-auto max-w-screen-md">
      <ExampleShell mode="practice" />
    </div>
  ),
}

export const DesktopLaunchGate: Story = {
  render: () => (
    <SimulationLaunchGate
      activityTitle="PAC signal validation"
      minimumViewport="desktop"
      bandwidthClass="heavy"
      estimatedSizeLabel="Approximately 24 MB"
      lightweightAlternativeHref="/critical-care/reference"
      onSaveForLater={noop}
      forceGate
    >
      <ExampleShell />
    </SimulationLaunchGate>
  ),
}

export const TabletLaunchGate: Story = {
  render: () => (
    <div className="mx-auto max-w-screen-md">
      <SimulationLaunchGate
        activityTitle="PAC signal validation"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="Approximately 24 MB"
        lightweightAlternativeHref="/critical-care/reference"
        onSaveForLater={noop}
        forceGate
      >
        <ExampleShell />
      </SimulationLaunchGate>
    </div>
  ),
}

export const MobileLaunchGate: Story = {
  render: () => (
    <div className="mx-auto max-w-sm">
      <SimulationLaunchGate
        activityTitle="PAC signal validation"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="Approximately 24 MB"
        lightweightAlternativeHref="/critical-care/reference"
        onSaveForLater={noop}
        forceGate
      >
        <ExampleShell />
      </SimulationLaunchGate>
    </div>
  ),
}

export const LoadingResume: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-8">
      <ResumeBanner
        state="loading"
        title="Checking saved progress"
        description="Validating the local activity record and safe checkpoint."
      />
    </div>
  ),
}

export const IncompatibleResume: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-8">
      <ResumeBanner
        state="incompatible"
        title="Saved state uses an older activity version"
        description="Your completion history is preserved. The simulation will resume from the latest authored safe checkpoint."
        onStartSafe={noop}
      />
    </div>
  ),
}

export const ResumeError: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-8">
      <ResumeBanner
        state="error"
        title="The saved simulation could not be restored"
        description="No legacy record was changed. Start the activity again from a clean educational state."
        onStartSafe={noop}
      />
    </div>
  ),
}

export const ReducedMotion: Story = {
  render: () => (
    <div className={styles.reducedMotion}>
      <ExampleShell mode="guided" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'This story applies the same no-motion timing used by the prefers-reduced-motion rule so state and meaning can be reviewed without animation.',
      },
    },
  },
}
