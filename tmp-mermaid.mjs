import mermaid from './node_modules/mermaid/dist/mermaid.esm.mjs';
mermaid.initialize({startOnLoad:false});
const chart = `flowchart TD\nA[Symptomatic endobronchial lesion] --> B{Urgent relief needed?}\nB -- Yes, high-grade obstruction/retention --> C[Immediate debulking: rigid/mechanical +/- laser/electrocautery or cryoadhesion]\nC --> D{Residual endoluminal disease?}\nD -- Yes --> E[Consider delayed modality below]\nB -- No/after initial debulking --> E[Consider delayed modality below]\nE --> F{Lesion characteristics}\nF -->|Superficial, visible margins; size <=1 cm; central| G[PDT (drug->light->48h debridement)]\nF -->|Endoluminal tumor/granulation; need high FiO2; stent in situ| H[Cryoablation +/- staged debridement]\nF -->|Retreatment after EBRT; palliation with re-aeration goal| I[HDR EBB planning & delivery]\nG --> J[Schedule follow-up bronchoscopy and surveillance]\nH --> J\nI --> J`;
try {
  await mermaid.parse(chart);
  console.log('parsed ok');
} catch (err) {
  console.error('parse fail', err);
}
