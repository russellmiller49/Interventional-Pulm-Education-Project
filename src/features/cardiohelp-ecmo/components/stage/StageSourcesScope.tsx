'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Whether a surface's sources are being cited for it somewhere else.
 *
 * Inside the lesson stage they are: the footer cites the lesson's whole set, folded away, so each
 * pane's own list would be the same records a third time in a place where they compete with the
 * controls. A list under this scope renders nothing and the footer speaks for it.
 *
 * Null everywhere else — the offline render harness, panel tests, the Practice debrief, the hub's
 * sources panel — so a panel standing on its own still cites what it says. That is also what lets
 * `stage-sources.test.ts` read a panel's real source set off its own markup and check the stage
 * collected all of it.
 */
const StageSourcesContext = createContext<boolean>(false)

export function StageSourcesScope({ children }: { readonly children: ReactNode }) {
  return <StageSourcesContext.Provider value>{children}</StageSourcesContext.Provider>
}

/** True when the stage footer is citing this surface's sources for it. */
export function useStageSourcesCollected(): boolean {
  return useContext(StageSourcesContext)
}
