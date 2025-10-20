import { BRANCH_GROUPS, type BranchGroup } from './grouping'

export interface UIHandles {
  canvas: HTMLCanvasElement
  raoSlider: HTMLInputElement
  cranSlider: HTMLInputElement
  dtsToggle: HTMLInputElement
  radiusToggle: HTMLInputElement
  labelsToggle: HTMLInputElement
  statsEl: HTMLElement
  legendEl: HTMLElement
  groupContainer: HTMLElement
  groupToggles: Map<string, HTMLInputElement>
  raoValueEl: HTMLElement
  cranValueEl: HTMLElement
}

export function initUI(): UIHandles {
  const canvas = getElement<HTMLCanvasElement>('viewport')
  const raoSlider = getElement<HTMLInputElement>('control-rao')
  const cranSlider = getElement<HTMLInputElement>('control-cran')
  const dtsToggle = getElement<HTMLInputElement>('toggle-dts')
  const radiusToggle = getElement<HTMLInputElement>('toggle-radius')
  const labelsToggle = getElement<HTMLInputElement>('toggle-labels')
  const statsEl = getElement<HTMLElement>('stats')
  const legendEl = getElement<HTMLElement>('legend')
  const groupContainer = getElement<HTMLElement>('group-toggles')
  const raoValueEl = getElement<HTMLElement>('rao-value')
  const cranValueEl = getElement<HTMLElement>('cran-value')

  const groupToggles = buildGroupToggles(groupContainer, BRANCH_GROUPS)

  return {
    canvas,
    raoSlider,
    cranSlider,
    dtsToggle,
    radiusToggle,
    labelsToggle,
    statsEl,
    legendEl,
    groupContainer,
    groupToggles,
    raoValueEl,
    cranValueEl,
  }
}

export function updateAngleDisplays(handles: UIHandles) {
  handles.raoValueEl.textContent = `${handles.raoSlider.value}°`
  handles.cranValueEl.textContent = `${handles.cranSlider.value}°`
}

export function populateLegend(handles: UIHandles, legendEntries: LegendEntry[]): void {
  const { legendEl } = handles
  legendEl.innerHTML = ''
  for (const entry of legendEntries) {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'legend-group'
    const title = document.createElement('div')
    title.className = 'legend-title'
    title.textContent = entry.groupLabel
    groupDiv.appendChild(title)
    for (const item of entry.items) {
      const row = document.createElement('div')
      row.className = 'legend-row'
      const swatch = document.createElement('span')
      swatch.className = 'legend-swatch'
      swatch.style.backgroundColor = item.color
      row.appendChild(swatch)
      const labelSpan = document.createElement('span')
      labelSpan.textContent = item.label
      row.appendChild(labelSpan)
      groupDiv.appendChild(row)
    }
    legendEl.appendChild(groupDiv)
  }
}

export interface LegendEntry {
  groupKey: string
  groupLabel: string
  items: { label: string; color: string }[]
}

function buildGroupToggles(container: HTMLElement, groups: BranchGroup[]) {
  container.innerHTML = ''
  const toggles = new Map<string, HTMLInputElement>()
  for (const group of groups) {
    const wrapper = document.createElement('label')
    wrapper.className = 'toggle-row'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = true
    input.dataset.groupKey = group.key
    const span = document.createElement('span')
    span.textContent = group.label
    wrapper.appendChild(input)
    wrapper.appendChild(span)
    container.appendChild(wrapper)
    toggles.set(group.key, input)
  }
  return toggles
}

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) {
    throw new Error(`Missing element #${id}`)
  }
  return el as T
}
