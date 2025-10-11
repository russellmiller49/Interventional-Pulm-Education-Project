// rb-curriculum-element.js
// Web Component wrapper around the curriculum module for <rb-curriculum> usage.
// Attributes:
//   data        - URL to a JSON file (rigid-curriculum.json)
//   pass-mark   - e.g., "0.8"
//   storage-key - optional custom storage key
//   theme-*     - CSS variable overrides, e.g., theme-primary="#123456"
//
// Example:
//   <rb-curriculum data="./rigid-curriculum.json" pass-mark="0.8"></rb-curriculum>
//
// Requires rb-curriculum.js to be available next to this file.

import { initRBCurriculum } from './rb-curriculum.js';

const STYLE = `:root{
  --primary:#2c3e50;
  --accent:#3498db;
  --success:#2ecc71;
  --danger:#e74c3c;
  --bg:#f5f7fa;
  --panel:#ffffff;
  --text:#1c2833;
  --muted:#5b6b7a;
  --shadow:0 10px 25px rgba(0,0,0,.12);
  --radius:14px;
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);
  color:var(--text);
  line-height:1.55;
}

.rb-wrap{max-width:1200px;margin:0 auto;padding:24px}

.rb-header{
  border-radius:16px;
  background:linear-gradient(135deg,#2c3e50 0%,#3498db 100%);
  color:#fff;
  padding:36px 24px;
  box-shadow:var(--shadow);
  position:relative;
  overflow:hidden;
  text-align:center;
}
.rb-header h1{margin:0 0 6px 0;font-size:28px}
.rb-header p{margin:0;opacity:.9}

.rb-progress{background:var(--panel);border-radius:12px;padding:16px;margin:20px 0;box-shadow:0 5px 15px rgba(0,0,0,.08)}
.rb-progress .bar{height:24px;background:#e9ecef;border-radius:12px;overflow:hidden}
.rb-progress .fill{height:100%;width:0%;display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:600;background:linear-gradient(90deg,var(--accent),var(--success));transition:width .35s ease}

.rb-months{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:16px;
}

.rb-card{
  border:0;
  border-radius:16px;
  background:var(--panel);
  box-shadow:0 6px 18px rgba(0,0,0,.08);
  padding:18px 16px;
  text-align:left;
  cursor:pointer;
  transition:transform .15s ease, box-shadow .15s ease;
  position:relative;
}
.rb-card:focus{outline:3px solid var(--accent); outline-offset:2px}
.rb-card:hover{transform:translateY(-2px); box-shadow:0 12px 28px rgba(0,0,0,.12)}
.rb-card.completed{border:2px solid var(--success)}
.rb-card.completed::after{
  content:'✓'; position:absolute; top:10px; right:10px; width:28px; height:28px;
  border-radius:50%; background:var(--success); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700
}
.rb-card .num{
  display:inline-flex; align-items:center; justify-content:center;
  width:44px;height:44px;border-radius:50%; background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;font-weight:700;margin-bottom:10px
}
.rb-card .title{display:block;font-size:18px;font-weight:700;color:#2c3e50;margin:4px 0}
.rb-card .desc{display:block;color:var(--muted);font-size:14px}

.rb-panel{background:var(--panel);margin-top:24px;padding:24px;border-radius:16px;box-shadow:var(--shadow)}
.rb-panel[hidden]{display:none}
.rb-panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px}
.rb-title{margin:0;font-size:22px}
.rb-close{border:0;background:var(--danger);color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
.rb-close:hover{filter:brightness(.95)}

.rb-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;margin-bottom:16px}
.rb-tab{border:0;background:#ecf0f1;border-radius:10px;padding:10px 14px;cursor:pointer}
.rb-tab[aria-selected="true"]{background:var(--accent);color:#fff}
.rb-tab:focus{outline:3px solid var(--accent); outline-offset:2px}

.rb-tabpanel{min-height:100px}

.quiz-option{background:#fff;border:2px solid transparent;border-radius:8px;padding:12px;margin:8px 0;cursor:pointer}
.quiz-option:hover{border-color:var(--accent); transform:translateX(3px)}
.quiz-option.selected{border-color:var(--accent); background:#e3f2fd}
.quiz-option.correct{border-color:var(--success); background:#d4edda}
.quiz-option.incorrect{border-color:var(--danger); background:#f8d7da}
.submit-quiz{border:0;background:var(--accent);color:#fff;border-radius:8px;padding:10px 18px;cursor:pointer}
.submit-quiz:hover{filter:brightness(.95)}

@media (prefers-reduced-motion: reduce){
  *{transition:none !important; animation:none !important}
}

@media (max-width: 680px){
  .rb-header h1{font-size:22px}
  .rb-title{font-size:18px}
}
`;

class RBCurriculum extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() { return ['data', 'pass-mark', 'storage-key']; }

  connectedCallback() {
    // Build shadow DOM structure
    const style = document.createElement('style');
    style.textContent = STYLE;

    // Host container into which the module will render
    const host = document.createElement('div');
    host.className = 'rb-host';

    this.shadowRoot.append(style, host);

    const dataUrl = this.getAttribute('data') || '';
    const passMark = parseFloat(this.getAttribute('pass-mark') || '0.8');
    const storageKey = this.getAttribute('storage-key') || 'rb_curriculum_v1';

    // Collect theme-* attributes
    const theme = {};
    for (const attr of this.getAttributeNames()) {
      if (attr.startsWith('theme-')) {
        const key = attr.replace('theme-','').trim();
        theme[key] = this.getAttribute(attr);
      }
    }

    initRBCurriculum({
      target: host,
      data: dataUrl,
      passMark,
      storageKey,
      theme
    });
  }
}

customElements.define('rb-curriculum', RBCurriculum);
