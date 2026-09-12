/** Keep a new junction visible inside its existing shared-stage scroll pane. */
export function resetPaneScroll(element: HTMLElement | null) {
  for (let pane = element; pane && pane !== document.body; pane = pane.parentElement) {
    if (
      /^(auto|scroll)$/.test(getComputedStyle(pane).overflowY) &&
      pane.scrollHeight > pane.clientHeight
    ) {
      pane.scrollTop = 0
      return
    }
  }
}
