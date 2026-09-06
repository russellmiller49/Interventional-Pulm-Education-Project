'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Whether a surface's sources are being cited for it somewhere else.
 *
 * Inside the lesson stage they are: the footer cites the lesson's whole set, folded away, so each
 * pane's own list would be the same records again in a place where they compete with the controls.
 * A list under this scope renders nothing and the footer speaks for it. Null everywhere else — the
 * offline render harness, panel tests, a debrief — so a panel standing on its own still cites what
 * it says.
 */
const StageSourcesContext = createContext<boolean>(false)

export function StageSourcesScope({ children }: { readonly children: ReactNode }) {
  return <StageSourcesContext.Provider value>{children}</StageSourcesContext.Provider>
}

/** True when the stage footer is citing this surface's sources for it. */
export function useStageSourcesCollected(): boolean {
  return useContext(StageSourcesContext)
}
