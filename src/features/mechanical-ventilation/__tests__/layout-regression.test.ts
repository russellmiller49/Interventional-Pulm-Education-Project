import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('mechanical ventilation activity layout', () => {
  const componentStyles = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/mechanical-ventilation.module.css',
    ),
    'utf8',
  )
  const activityStyles = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/mechanical-ventilation-v2.module.css',
    ),
    'utf8',
  )
  const lessonSource = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/MechanicalVentilationLessonActivity.tsx',
    ),
    'utf8',
  )

  it('keeps waveform palette variables on the standalone console surface', () => {
    expect(componentStyles).toMatch(
      /\.moduleRoot,\s*\.bedsidePanel,\s*\.workflowPanel,\s*\.consoleShell\s*{[\s\S]*?--screen-line:\s*#[0-9a-f]+;[\s\S]*?--wave:\s*#[0-9a-f]+;/i,
    )
  })

  it('constrains both case and lesson content to an owned scroll viewport', () => {
    expect(activityStyles).toMatch(
      /\.caseViewport\s*{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/,
    )
    expect(lessonSource).toContain(
      'className="grid h-full min-h-0 content-start gap-3 overflow-auto bg-background p-3"',
    )
  })
})
