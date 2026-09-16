import { createRoot } from 'react-dom/client'
import { StageLayout } from '../../src/features/cardiohelp-ecmo/components/stage/StageLayout'
import { scrollTaskPaneToTop } from '../../src/features/cardiohelp-ecmo/components/stage/scrollTaskPaneToTop'

function Content({ name }: { name: string }) {
  return (
    <div>
      <button onClick={(event) => scrollTaskPaneToTop(event.currentTarget)}>Top of {name}</button>
      <div style={{ height: 1400 }}>Overflow fixture for {name}</div>
      <button onClick={(event) => scrollTaskPaneToTop(event.currentTarget)}>
        Return to {name}
      </button>
    </div>
  )
}

// Only the fallback is synthetic: the shell, CSS, shared workspace and handlers are real imports.
createRoot(document.getElementById('ecmo-layout-fixture')!).render(
  <StageLayout
    stageId="fixed-fixture"
    label="Fixed Learn layout fixture"
    header={<h1>Fixed Learn header</h1>}
    contextStrip={<p>Fixture context</p>}
    task={<Content name="Steps" />}
    teaching={<Content name="Teaching" />}
    simulator={<Content name="Simulator" />}
  />,
)
