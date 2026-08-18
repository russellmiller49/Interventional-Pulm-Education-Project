/**
 * The embedded single-page physician-review UI. No external assets, no CDN, no framework:
 * the page is served by the loopback server and talks only to same-origin `/api/*` routes.
 * All interpolation happens client-side from JSON; this file is a static string.
 */

export function reviewPageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Luna Triage Review</title>
<style>
  :root {
    --bg: #f6f7f9; --panel: #ffffff; --ink: #1a2333; --muted: #5b667a;
    --line: #d9dee7; --accent: #0f5f8a; --good: #17663a; --bad: #8a1f2d; --warn: #8a5a10;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         color: var(--ink); background: var(--bg); }
  header { display: flex; gap: 16px; align-items: baseline; padding: 10px 18px;
           background: #10263a; color: #fff; }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .op { opacity: 0.75; font-size: 13px; }
  header .spacer { flex: 1; }
  header button { background: #2a5d84; color: #fff; border: 0; border-radius: 6px;
                  padding: 6px 12px; cursor: pointer; }
  main { display: grid; grid-template-columns: 290px 1fr; gap: 14px; padding: 14px 18px; }
  aside { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
          padding: 12px; align-self: start; position: sticky; top: 12px; }
  aside label { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 2px; }
  aside select, aside input { width: 100%; padding: 5px 7px; border: 1px solid var(--line);
          border-radius: 6px; background: #fff; font-size: 13px; }
  aside .counts { font-size: 12px; color: var(--muted); margin-top: 12px;
                  border-top: 1px solid var(--line); padding-top: 8px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
          padding: 18px 20px; }
  .card h2 { margin: 0 0 6px; font-size: 18px; line-height: 1.35; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .chip { font-size: 12px; padding: 2px 9px; border-radius: 999px; background: #eef2f7;
          border: 1px solid var(--line); color: var(--ink); }
  .chip.profile { background: #e8f1f7; border-color: #b9d4e6; }
  .chip.risk { background: #fbeaea; border-color: #e4b8bd; color: var(--bad); }
  .chip.reason { background: #f1ecfb; border-color: #cfc2ee; }
  .abstract { white-space: pre-wrap; margin: 12px 0; }
  .absent { color: var(--muted); font-style: italic; }
  .panel { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
           margin: 10px 0; background: #fafbfd; }
  .panel h3 { margin: 0 0 6px; font-size: 13px; color: var(--muted); text-transform: uppercase;
              letter-spacing: 0.04em; }
  .luna-decision { font-weight: 600; }
  .luna-decision.obvious_irrelevant { color: var(--bad); }
  .luna-decision.potentially_relevant { color: var(--good); }
  .luna-decision.insufficient_evidence { color: var(--warn); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .actions button { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line);
                    background: #fff; cursor: pointer; font-size: 14px; }
  .actions button.active { outline: 3px solid #9cc3da; }
  .actions .key { display: inline-block; min-width: 18px; text-align: center; margin-right: 6px;
                  border: 1px solid var(--line); border-radius: 4px; font-size: 12px;
                  padding: 0 4px; background: #f0f3f8; }
  footer.nav { display: flex; align-items: center; gap: 12px; margin-top: 14px;
               color: var(--muted); font-size: 13px; }
  footer.nav button { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--line);
                      background: #fff; cursor: pointer; }
  .decided { font-size: 13px; margin-top: 8px; color: var(--good); }
  .toast { position: fixed; bottom: 16px; right: 16px; background: #10263a; color: #fff;
           border-radius: 8px; padding: 10px 14px; font-size: 13px; opacity: 0;
           transition: opacity 0.2s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .empty { padding: 60px 0; text-align: center; color: var(--muted); }
  kbd { border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; background: #f0f3f8; }
</style>
</head>
<body>
<header>
  <h1>Luna Stage-A physician review</h1>
  <span class="op" id="op-label"></span>
  <span class="spacer"></span>
  <span class="op" id="progress"></span>
  <button id="export-btn" title="Write override manifests and the audit receipt">Export manifests</button>
</header>
<main>
  <aside>
    <label>Queue</label>
    <select id="f-queue">
      <option value="all">All records</option>
      <option value="negatives">Negative queue (all candidates)</option>
      <option value="mandatory">Mandatory review (risk-flagged)</option>
      <option value="sample">Audit sample</option>
    </select>
    <label>Review state</label>
    <select id="f-review">
      <option value="all">All</option>
      <option value="undecided">Undecided</option>
      <option value="decided">Decided (any action)</option>
      <option value="retain_for_stage_b">Retained for Stage B</option>
      <option value="confirm_deprioritization_candidate">Confirmed deprioritization</option>
      <option value="insufficient_evidence">Marked insufficient evidence</option>
      <option value="flag_systematic_miss">Flagged systematic miss</option>
    </select>
    <label>Luna decision</label>
    <select id="f-triage">
      <option value="all">All</option>
      <option value="obvious_irrelevant">obvious_irrelevant</option>
      <option value="potentially_relevant">potentially_relevant</option>
      <option value="insufficient_evidence">insufficient_evidence</option>
      <option value="(none)">No valid output</option>
    </select>
    <label>Confidence band</label>
    <select id="f-confidence">
      <option value="all">All</option>
      <option value="high">high</option>
      <option value="medium">medium</option>
      <option value="low">low</option>
    </select>
    <label>Reason code</label>
    <select id="f-reason"><option value="all">All</option></select>
    <label>Evidence profile</label>
    <select id="f-profile">
      <option value="all">All</option>
      <option value="metadata_with_abstract">With abstract</option>
      <option value="metadata_without_abstract">Without abstract</option>
    </select>
    <label>Risk flag</label>
    <select id="f-risk">
      <option value="all">All</option>
      <option value="(any)">Any risk flag</option>
      <option value="(none)">No risk flags</option>
    </select>
    <label>Journal contains</label>
    <input id="f-journal" type="text" placeholder="e.g. Chest" />
    <label>Year band</label>
    <select id="f-year">
      <option value="all">All</option>
      <option>pre-1970</option><option>1970s</option><option>1980s</option>
      <option>1990s</option><option>2000s</option><option>2010s</option>
      <option>2020s</option><option>unknown</option>
    </select>
    <label>Publication type</label>
    <select id="f-pubtype"><option value="all">All</option></select>
    <div class="counts" id="filter-counts"></div>
    <div class="counts">
      Keys: <kbd>R</kbd> retain · <kbd>D</kbd> confirm deprioritization ·
      <kbd>U</kbd> insufficient · <kbd>F</kbd> flag miss · <kbd>J</kbd>/<kbd>K</kbd> or
      arrows navigate
    </div>
  </aside>
  <section id="card-holder"><div class="empty">Loading…</div></section>
</main>
<div class="toast" id="toast"></div>
<script>
(function () {
  'use strict'
  var records = []
  var index = 0
  var summary = null

  function el(id) { return document.getElementById(id) }
  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }
  function toast(message) {
    var node = el('toast')
    node.textContent = message
    node.classList.add('show')
    setTimeout(function () { node.classList.remove('show') }, 1600)
  }
  function filterQuery() {
    return [
      'queue=' + encodeURIComponent(el('f-queue').value),
      'review=' + encodeURIComponent(el('f-review').value),
      'triage=' + encodeURIComponent(el('f-triage').value),
      'confidence=' + encodeURIComponent(el('f-confidence').value),
      'reason=' + encodeURIComponent(el('f-reason').value),
      'profile=' + encodeURIComponent(el('f-profile').value),
      'risk=' + encodeURIComponent(el('f-risk').value),
      'journal=' + encodeURIComponent(el('f-journal').value),
      'yearBand=' + encodeURIComponent(el('f-year').value),
      'pubType=' + encodeURIComponent(el('f-pubtype').value),
    ].join('&')
  }
  function chip(text, cls) {
    return '<span class="chip ' + (cls || '') + '">' + esc(text) + '</span>'
  }
  function render() {
    var holder = el('card-holder')
    if (records.length === 0) {
      holder.innerHTML = '<div class="card"><div class="empty">No records match the current filters.</div></div>'
      el('progress').textContent = ''
      return
    }
    if (index >= records.length) index = records.length - 1
    if (index < 0) index = 0
    var r = records[index]
    var luna = r.luna
    var html = '<div class="card">'
    html += '<h2>' + esc(r.title) + '</h2>'
    html += '<div class="chips">'
    html += chip(r.journal || 'Journal not recorded')
    html += chip(r.publicationYear === null ? 'Year unknown' : r.publicationYear)
    html += chip(r.evidenceProfile, 'profile')
    if (r.language) html += chip(r.language)
    r.publicationTypes.forEach(function (t) { html += chip(t) })
    html += '</div>'
    if (r.abstract) {
      html += '<div class="abstract">' + esc(r.abstract) + '</div>'
    } else {
      html += '<div class="abstract absent">No abstract is available for this record.</div>'
    }
    if (r.meshTerms.length > 0) {
      html += '<div class="panel"><h3>MeSH</h3><div class="chips">'
      r.meshTerms.forEach(function (t) { html += chip(t) })
      html += '</div></div>'
    }
    if (r.keywords.length > 0) {
      html += '<div class="panel"><h3>Keywords</h3><div class="chips">'
      r.keywords.forEach(function (t) { html += chip(t) })
      html += '</div></div>'
    }
    html += '<div class="panel"><h3>Luna triage</h3>'
    if (luna) {
      html += '<div><span class="luna-decision ' + esc(luna.decision) + '">' + esc(luna.decision) +
        '</span> · confidence ' + esc(luna.confidenceBand) + '</div><div class="chips">'
      luna.reasonCodes.forEach(function (code) { html += chip(code, 'reason') })
      html += '</div>'
    } else {
      html += '<div class="absent">No valid model output (' + esc(r.terminalState) + '); advances by default.</div>'
    }
    html += '<div style="margin-top:6px;font-size:13px;color:var(--muted)">Route: ' + esc(r.route) +
      (r.mandatoryReview ? ' · mandatory physician review' : '') +
      (r.inAuditSample ? ' · audit sample' : '') + '</div>'
    html += '</div>'
    html += '<div class="panel"><h3>Coordinator risk flags</h3>'
    if (r.riskFlags.length > 0) {
      html += '<div class="chips">'
      r.riskFlags.forEach(function (flag) { html += chip(flag, 'risk') })
      html += '</div>'
    } else {
      html += '<div class="absent">No deterministic risk signals.</div>'
    }
    html += '</div>'
    html += '<div class="actions">'
    var actions = [
      ['retain_for_stage_b', 'R', 'Retain for Stage B'],
      ['confirm_deprioritization_candidate', 'D', 'Confirm deprioritization'],
      ['insufficient_evidence', 'U', 'Insufficient evidence'],
      ['flag_systematic_miss', 'F', 'Flag systematic miss'],
    ]
    actions.forEach(function (action) {
      var active = r.decision && r.decision.action === action[0] ? ' active' : ''
      html += '<button class="act' + active + '" data-action="' + action[0] + '">' +
        '<span class="key">' + action[1] + '</span>' + esc(action[2]) + '</button>'
    })
    html += '</div>'
    if (r.decision) {
      html += '<div class="decided">Decided: ' + esc(r.decision.action) + ' (revision ' +
        r.decision.revision + ', ' + esc(r.decision.decidedAt) + ')</div>'
    }
    html += '<footer class="nav">'
    html += '<button id="prev-btn">&#8592; Previous (K)</button>'
    html += '<button id="next-btn">Next (J) &#8594;</button>'
    html += '<span>' + (index + 1) + ' of ' + records.length + ' filtered</span>'
    html += '</footer></div>'
    holder.innerHTML = html
    el('progress').textContent = summary
      ? summary.decided + ' / ' + summary.total + ' reviewed'
      : ''
    holder.querySelectorAll('button.act').forEach(function (button) {
      button.addEventListener('click', function () { decide(button.getAttribute('data-action')) })
    })
    el('prev-btn').addEventListener('click', function () { move(-1) })
    el('next-btn').addEventListener('click', function () { move(1) })
  }
  function move(delta) {
    index += delta
    if (index < 0) index = 0
    if (index >= records.length) index = records.length - 1
    render()
  }
  function refresh(keepIndex) {
    return fetch('/api/records?' + filterQuery())
      .then(function (response) { return response.json() })
      .then(function (payload) {
        records = payload.records
        summary = payload.summary
        if (!keepIndex) index = 0
        var counts = el('filter-counts')
        counts.textContent = payload.filtered + ' of ' + payload.total + ' records match'
        var reasonSelect = el('f-reason')
        if (reasonSelect.options.length === 1) {
          payload.reasonCodes.forEach(function (code) {
            var option = document.createElement('option')
            option.value = code
            option.textContent = code
            reasonSelect.appendChild(option)
          })
          payload.riskFlags.forEach(function (flag) {
            var option = document.createElement('option')
            option.value = flag
            option.textContent = flag
            el('f-risk').appendChild(option)
          })
          payload.publicationTypes.forEach(function (type) {
            var option = document.createElement('option')
            option.value = type
            option.textContent = type
            el('f-pubtype').appendChild(option)
          })
        }
        render()
      })
  }
  function decide(action) {
    if (records.length === 0) return
    var record = records[index]
    fetch('/api/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordId: record.recordId, action: action }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('decision failed')
        return response.json()
      })
      .then(function (payload) {
        record.decision = payload.decision
        summary = payload.summary
        toast(action.replace(/_/g, ' '))
        move(1)
      })
      .catch(function () { toast('Decision was not saved') })
  }
  document.addEventListener('keydown', function (event) {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT')) return
    var key = event.key.toLowerCase()
    if (key === 'j' || event.key === 'ArrowRight' || event.key === 'ArrowDown') move(1)
    else if (key === 'k' || event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(-1)
    else if (key === 'r') decide('retain_for_stage_b')
    else if (key === 'd') decide('confirm_deprioritization_candidate')
    else if (key === 'u') decide('insufficient_evidence')
    else if (key === 'f') decide('flag_systematic_miss')
  })
  ;['f-queue', 'f-review', 'f-triage', 'f-confidence', 'f-reason', 'f-profile', 'f-risk',
    'f-year', 'f-pubtype'].forEach(function (id) {
    el(id).addEventListener('change', function () { refresh(false) })
  })
  el('f-journal').addEventListener('input', function () { refresh(false) })
  el('export-btn').addEventListener('click', function () {
    fetch('/api/export', { method: 'POST' })
      .then(function (response) { return response.json() })
      .then(function (payload) { toast('Exported ' + payload.files.length + ' artifacts') })
      .catch(function () { toast('Export failed') })
  })
  fetch('/api/operation')
    .then(function (response) { return response.json() })
    .then(function (payload) {
      el('op-label').textContent = payload.operationId + ' · ' + payload.cohort
    })
  refresh(false)
})()
</script>
</body>
</html>
`
}
