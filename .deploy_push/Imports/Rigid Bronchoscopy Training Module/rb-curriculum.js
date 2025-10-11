// rb-curriculum.js
// ES module to render the Rigid Bronchoscopy curriculum as a reusable component.
// Usage:
//   import { initRBCurriculum } from './rb-curriculum.js';
//   initRBCurriculum({ target: document.getElementById('rb'), data: './rigid-curriculum.json' });

export async function initRBCurriculum(options = {}) {
  const {
    target,
    data,
    storageKey = 'rb_curriculum_v1',
    passMark = 0.8,
    theme = {},
    onMonthComplete = () => {},
  } = options

  if (!target) throw new Error('initRBCurriculum: "target" element is required')

  // Apply theme as CSS variables on the target
  for (const [k, v] of Object.entries(theme)) {
    try {
      target.style.setProperty(`--${k}`, v)
    } catch {}
  }

  // Load curriculum data (array of {month,title,description,content:{...}})
  let curriculum
  if (Array.isArray(data)) {
    curriculum = data
  } else if (typeof data === 'string') {
    const res = await fetch(data)
    if (!res.ok) throw new Error(`Failed to load curriculum data from ${data}`)
    curriculum = await res.json()
  } else {
    throw new Error('initRBCurriculum: "data" must be an Array or a URL string to a JSON file')
  }

  // Restore state from storage
  let state = { completed: [], currentMonth: null, currentTab: 'overview' }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
    state = { ...state, ...saved }
  } catch {}

  // Scaffold HTML
  target.innerHTML = `
    <div class="rb-wrap" role="region" aria-label="Rigid Bronchoscopy Curriculum">
      <header class="rb-header">
        <h1>Rigid Bronchoscopy Fellowship Curriculum</h1>
        <p>12‑Month Interactive Training Program</p>
      </header>

      <section class="rb-progress" aria-label="Overall Progress">
        <div class="bar"><div class="fill" style="width:0%">0%</div></div>
      </section>

      <section class="rb-months" aria-live="polite"></section>

      <section class="rb-panel" hidden>
        <div class="rb-panel-head">
          <h2 class="rb-title"></h2>
          <button class="rb-close" aria-label="Close module">Close</button>
        </div>
        <div class="rb-tabs" role="tablist" aria-label="Month sections"></div>
        <div class="rb-tabpanel" role="tabpanel"></div>
      </section>
    </div>
  `

  const monthsEl = target.querySelector('.rb-months')
  const panel = target.querySelector('.rb-panel')
  const panelTitle = target.querySelector('.rb-title')
  const tabsEl = target.querySelector('.rb-tabs')
  const tabpanel = target.querySelector('.rb-tabpanel')
  const progressFill = target.querySelector('.rb-progress .fill')
  const closeBtn = target.querySelector('.rb-close')

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state))
  }

  function updateProgress() {
    const pct = Math.round((state.completed.length / curriculum.length) * 100)
    progressFill.style.width = pct + '%'
    progressFill.textContent = pct + '%'
  }

  function renderMonths() {
    monthsEl.innerHTML = ''
    curriculum
      .slice()
      .sort((a, b) => a.month - b.month)
      .forEach((m) => {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'rb-card'
        card.setAttribute('aria-pressed', state.currentMonth === m.month ? 'true' : 'false')
        if (state.completed.includes(m.month)) card.classList.add('completed')
        card.innerHTML = `
          <span class="num">${m.month}</span>
          <span class="title">${m.title}</span>
          <span class="desc">${m.description}</span>
        `
        card.addEventListener('click', () => openMonth(m))
        monthsEl.appendChild(card)
      })
  }

  function openMonth(m, fromHash = false) {
    state.currentMonth = m.month
    state.currentTab = state.currentTab || 'overview'
    persist()

    panelTitle.textContent = `Month ${m.month}: ${m.title}`
    renderTabs(m)
    panel.hidden = false

    if (!fromHash) {
      location.hash = `m=${m.month}&tab=${state.currentTab}`
    }

    // Smooth scroll if panel is off-screen
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function renderTabs(m) {
    const tabs = [
      { key: 'overview', label: 'Overview' },
      { key: 'indications', label: 'Key Concepts' },
      { key: 'equipment', label: 'Techniques' },
      { key: 'quiz', label: 'Assessment' },
      { key: 'reading', label: 'Reading' },
    ]

    tabsEl.innerHTML = ''
    tabs.forEach((t, idx) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rb-tab'
      b.role = 'tab'
      b.id = `tab-${t.key}`
      b.dataset.key = t.key
      b.setAttribute('aria-selected', t.key === state.currentTab ? 'true' : 'false')
      b.setAttribute('aria-controls', `panel-${t.key}`)
      b.textContent = t.label
      b.addEventListener('click', () => switchTab(m, t.key))
      b.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault()
          const tabs = Array.from(tabsEl.querySelectorAll('.rb-tab'))
          const current = tabs.findIndex((tb) => tb.dataset.key === state.currentTab)
          let next = current
          if (e.key === 'ArrowRight') next = (current + 1) % tabs.length
          if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length
          if (e.key === 'Home') next = 0
          if (e.key === 'End') next = tabs.length - 1
          tabs[next].focus()
          tabs[next].click()
        }
      })
      tabsEl.appendChild(b)
    })

    switchTab(m, state.currentTab || 'overview')
  }

  function upgradeLinks(container) {
    // Open reading links etc. safely in a new tab
    container.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    })
  }

  function switchTab(m, key) {
    state.currentTab = key
    persist()

    tabsEl.querySelectorAll('.rb-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', tab.dataset.key === key ? 'true' : 'false')
    })

    tabpanel.id = `panel-${key}`
    tabpanel.setAttribute('aria-labelledby', `tab-${key}`)

    // Inject HTML (trusted content provided by the site owner)
    tabpanel.innerHTML = m.content[key] || '<p>No content.</p>'
    upgradeLinks(tabpanel)

    if (key === 'quiz') attachQuizHandlers(m)

    // Update deep link
    location.hash = `m=${m.month}&tab=${key}`
  }

  function attachQuizHandlers(m) {
    // Remove any inline onclick from imported content buttons
    tabpanel.querySelectorAll('.submit-quiz').forEach((btn) => btn.removeAttribute('onclick'))

    tabpanel.querySelectorAll('.quiz-option').forEach((opt) => {
      opt.setAttribute('role', 'button')
      opt.setAttribute('tabindex', '0')
      opt.addEventListener('click', select)
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          select.call(opt)
        }
      })
      function select() {
        const q = this.closest('.quiz-question')
        q.querySelectorAll('.quiz-option').forEach((o) => o.classList.remove('selected'))
        this.classList.add('selected')
      }
    })

    const submit = tabpanel.querySelector('.submit-quiz')
    if (submit) {
      submit.addEventListener('click', () => {
        const questions = tabpanel.querySelectorAll('.quiz-question')
        let correct = 0
        questions.forEach((q) => {
          const selected = q.querySelector('.quiz-option.selected')
          q.querySelectorAll('.quiz-option').forEach((o) => {
            o.classList.remove('correct', 'incorrect')
            const isCorrect = o.dataset.correct === 'true'
            if (isCorrect) o.classList.add('correct')
          })
          if (selected && selected.dataset.correct !== 'true') {
            selected.classList.add('incorrect')
          }
          if (selected?.dataset.correct === 'true') correct++
        })
        const score = correct / (questions.length || 1)

        // Visual feedback on button
        if (score >= passMark) {
          submit.textContent = `Excellent! ${correct}/${questions.length} correct. Month ${m.month} completed!`
          submit.style.background = 'var(--success)'
          if (!state.completed.includes(m.month)) {
            state.completed.push(m.month)
            persist()
            renderMonths()
            updateProgress()
            try {
              onMonthComplete({ month: m.month, score })
            } catch {}
            target.dispatchEvent(
              new CustomEvent('rb:monthComplete', { detail: { month: m.month, score } }),
            )
          }
        } else {
          submit.textContent = `${correct}/${questions.length} correct. Review and try again.`
          submit.style.background = 'var(--danger)'
        }
      })
    }
  }

  // Close panel
  closeBtn.addEventListener('click', () => {
    panel.hidden = true
    state.currentMonth = null
    persist()
  })

  // Deep link support
  function syncFromHash() {
    const p = new URLSearchParams(location.hash.replace('#', ''))
    const m = Number(p.get('m'))
    const tab = p.get('tab') || 'overview'
    const found = curriculum.find((x) => x.month === m)
    if (found) {
      openMonth(found, true)
      switchTab(found, tab)
    }
  }
  window.addEventListener('hashchange', syncFromHash)

  // Initial render
  renderMonths()
  updateProgress()
  syncFromHash()
}
