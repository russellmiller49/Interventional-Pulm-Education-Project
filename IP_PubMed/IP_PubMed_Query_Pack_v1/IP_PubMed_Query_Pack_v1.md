# Interventional Pulmonology PubMed Query Pack v1

Prepared: 2026-07-26

Purpose: reproducible journal ingestion and high-recall, topic-based discovery for an interventional pulmonology literature index.

## Query conventions

- `[ta]`: journal title/abbreviation.
- `[tiab]`: title, abstract, and author keywords.
- `[mh]`: MeSH.
- `[dp]`: publication date.
- `[crdt]`: PubMed record creation date.
- `[lr]`: most recent citation modification date.
- `2000:3000[dp]`: future-proof publication-date range beginning in 2000.

Do not add `hasabstract`, English-language, human-only, or publication-type exclusions to ingestion queries. Those fields should be retained and filtered in the application.

## 1. Core journals: individual backfill queries

### Journal of Bronchology & Interventional Pulmonology

```text
J Bronchology Interv Pulmonol[ta] AND 2000:3000[dp]
```

Note: The current title began in 2009, but the NLM Catalog lists systematic PubMed coverage beginning with volume 19, issue 1 (January 2012). Use publisher/Crossref ingestion to audit and fill 2009-2011. The predecessor Journal of Bronchology (1994-2008) is a separate NLM record and does not have complete PubMed coverage.

### CHEST

```text
Chest[ta] AND 2000:3000[dp]
```

### American Journal of Respiratory and Critical Care Medicine

```text
Am J Respir Crit Care Med[ta] AND 2000:3000[dp]
```

### European Respiratory Journal

```text
Eur Respir J[ta] AND 2000:3000[dp]
```

Note: Does not include Eur Respir J Suppl unless that title is added explicitly.

### Thorax

```text
Thorax[ta] AND 2000:3000[dp]
```

### Annals of the American Thoracic Society

```text
Ann Am Thorac Soc[ta] AND 2000:3000[dp]
```

### Respiration

```text
Respiration[ta] AND 2000:3000[dp]
```

### Respirology

```text
Respirology[ta] AND 2000:3000[dp]
```

### Respiratory Medicine

```text
Respir Med[ta] AND 2000:3000[dp]
```

### Respiratory Research

```text
Respir Res[ta] AND 2000:3000[dp]
```

### Journal of Thoracic Disease

```text
J Thorac Dis[ta] AND 2000:3000[dp]
```

### Journal of Bronchology predecessor-title audit

The predecessor ran through 2008 under a separate NLM record. This query may retrieve any PubMed-linked records, but it should **not** be treated as a complete 2000-2008 archive. Use the publisher/Crossref to fill the gap.

```text
Journal of Bronchology[ta] AND 2000:2008[dp]
```

### Respiratory Endoscopy

No PubMed query is included. Use the J-STAGE source (online ISSN 2758-3813), then deduplicate by DOI and later PMID if PubMed indexing is added.

## 2. Core journals: combined validation query

Use this for count validation and manual checks. For ETL, individual journal-year jobs are preferred.

```text
(
  J Bronchology Interv Pulmonol[ta]
  OR Chest[ta]
  OR Am J Respir Crit Care Med[ta]
  OR Eur Respir J[ta]
  OR Thorax[ta]
  OR Ann Am Thorac Soc[ta]
  OR Respiration[ta]
  OR Respirology[ta]
  OR Respir Med[ta]
  OR Respir Res[ta]
  OR J Thorac Dis[ta]
)
AND 2000:3000[dp]
```

## 3. Optional ATS historical continuity

Add Proceedings of the American Thoracic Society when you want continuity before Annals of the American Thoracic Society.

```text
Proc Am Thorac Soc[ta] AND 2000:3000[dp]
```

Combined core-plus-continuity query:

```text
(
  J Bronchology Interv Pulmonol[ta]
  OR Chest[ta]
  OR Am J Respir Crit Care Med[ta]
  OR Eur Respir J[ta]
  OR Thorax[ta]
  OR Ann Am Thorac Soc[ta]
  OR Respiration[ta]
  OR Respirology[ta]
  OR Respir Med[ta]
  OR Respir Res[ta]
  OR J Thorac Dis[ta]
  OR Proc Am Thorac Soc[ta]
)
AND 2000:3000[dp]
```

## 4. Expanded journals

### Individual journal audit queries

- **Journal of Thoracic Oncology**: `J Thorac Oncol[ta] AND 2000:3000[dp]`

- **Lung Cancer**: `Lung Cancer[ta] AND 2000:3000[dp]`

- **The Lancet Respiratory Medicine**: `Lancet Respir Med[ta] AND 2000:3000[dp]`

- **The Annals of Thoracic Surgery**: `Ann Thorac Surg[ta] AND 2000:3000[dp]`

- **The Journal of Thoracic and Cardiovascular Surgery**: `J Thorac Cardiovasc Surg[ta] AND 2000:3000[dp]`

- **BMJ Open Respiratory Research**: `BMJ Open Respir Res[ta] AND 2000:3000[dp]`

- **ATS Scholar**: `ATS Sch[ta] AND 2000:3000[dp]`

### Expanded journal block

```text
(
  J Thorac Oncol[ta]
  OR Lung Cancer[ta]
  OR Lancet Respir Med[ta]
  OR Ann Thorac Surg[ta]
  OR J Thorac Cardiovasc Surg[ta]
  OR BMJ Open Respir Res[ta]
  OR ATS Sch[ta]
)
```

### Recommended expanded-journal production query

This retrieves only records with an IP signal from the expanded journals.

```text
(
  J Thorac Oncol[ta]
  OR Lung Cancer[ta]
  OR Lancet Respir Med[ta]
  OR Ann Thorac Surg[ta]
  OR J Thorac Cardiovasc Surg[ta]
  OR BMJ Open Respir Res[ta]
  OR ATS Sch[ta]
)
AND
(
  "Bronchoscopy"[mh]
  OR bronchoscop*[tiab]
  OR tracheobronchoscop*[tiab]
  OR endobronchial[tiab]
  OR transbronchial[tiab]
  OR "interventional pulmonology"[tiab]
  OR "interventional pulmonary"[tiab]
  OR "interventional bronchoscopy"[tiab]
  OR "advanced bronchoscopy"[tiab]
  OR EBUS[tiab]
  OR "EUS-B"[tiab]
  OR pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "local anesthetic thoracoscopy"[tiab]
  OR "local anaesthetic thoracoscopy"[tiab]
  OR "indwelling pleural catheter"[tiab]
  OR "indwelling pleural catheters"[tiab]
  OR "tunneled pleural catheter"[tiab]
  OR "tunneled pleural catheters"[tiab]
  OR thoracentes*[tiab]
  OR "central airway obstruction"[tiab]
  OR "airway stent"[tiab]
  OR "airway stents"[tiab]
  OR "tracheobronchial stent"[tiab]
  OR "tracheobronchial stents"[tiab]
  OR "bronchoscopic lung volume reduction"[tiab]
  OR "endobronchial valve"[tiab]
  OR "endobronchial valves"[tiab]
  OR "transbronchial lung cryobiopsy"[tiab]
  OR "transbronchial cryobiopsy"[tiab]
  OR "percutaneous tracheostomy"[tiab]
  OR "percutaneous dilatational tracheostomy"[tiab]
  OR "percutaneous dilational tracheostomy"[tiab]
  OR "bronchial thermoplasty"[tiab]
  OR "whole lung lavage"[tiab]
  OR "whole-lung lavage"[tiab]
)
AND 2000:3000[dp]
```

### Expanded all-record audit query

Use only for measuring yield and discovering false negatives in the topic block.

```text
(
  J Thorac Oncol[ta]
  OR Lung Cancer[ta]
  OR Lancet Respir Med[ta]
  OR Ann Thorac Surg[ta]
  OR J Thorac Cardiovasc Surg[ta]
  OR BMJ Open Respir Res[ta]
  OR ATS Sch[ta]
)
AND 2000:3000[dp]
```

## 5. All-PubMed master discovery query

This is a broad safety-net query. Run it through a cheap deterministic or embedding prescreen before an LLM because it will retrieve routine bronchoscopy literature as well as IP literature.

```text
(
  "Bronchoscopy"[mh]
  OR bronchoscop*[tiab]
  OR tracheobronchoscop*[tiab]
  OR endobronchial[tiab]
  OR transbronchial[tiab]
  OR "interventional pulmonology"[tiab]
  OR "interventional pulmonary"[tiab]
  OR "interventional bronchoscopy"[tiab]
  OR "advanced bronchoscopy"[tiab]
  OR EBUS[tiab]
  OR "EUS-B"[tiab]
  OR pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "local anesthetic thoracoscopy"[tiab]
  OR "local anaesthetic thoracoscopy"[tiab]
  OR "indwelling pleural catheter"[tiab]
  OR "indwelling pleural catheters"[tiab]
  OR "tunneled pleural catheter"[tiab]
  OR "tunneled pleural catheters"[tiab]
  OR thoracentes*[tiab]
  OR "central airway obstruction"[tiab]
  OR "airway stent"[tiab]
  OR "airway stents"[tiab]
  OR "tracheobronchial stent"[tiab]
  OR "tracheobronchial stents"[tiab]
  OR "bronchoscopic lung volume reduction"[tiab]
  OR "endobronchial valve"[tiab]
  OR "endobronchial valves"[tiab]
  OR "transbronchial lung cryobiopsy"[tiab]
  OR "transbronchial cryobiopsy"[tiab]
  OR "percutaneous tracheostomy"[tiab]
  OR "percutaneous dilatational tracheostomy"[tiab]
  OR "percutaneous dilational tracheostomy"[tiab]
  OR "bronchial thermoplasty"[tiab]
  OR "whole lung lavage"[tiab]
  OR "whole-lung lavage"[tiab]
)
AND 2000:3000[dp]
```

## 6. Modular All-PubMed discovery queries

Run these as separate jobs. Union by PMID, but retain every matched query ID as provenance and as a weak seed label.

### ip_broad_catchall: Broad IP catch-all

Cadence: `monthly_backfill_or_low_cost_prescreen`  
Precision profile: `high_recall_low_precision`

```text
(
  "Bronchoscopy"[mh]
  OR bronchoscop*[tiab]
  OR tracheobronchoscop*[tiab]
  OR "interventional pulmonology"[tiab]
  OR "interventional pulmonary"[tiab]
  OR "interventional bronchoscopy"[tiab]
  OR "advanced bronchoscopy"[tiab]
  OR EBUS[tiab]
  OR "EUS-B"[tiab]
  OR pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "indwelling pleural catheter"[tiab]
  OR "indwelling pleural catheters"[tiab]
  OR "tunneled pleural catheter"[tiab]
  OR "tunneled pleural catheters"[tiab]
  OR "bronchoscopic lung volume reduction"[tiab]
  OR "transbronchial lung cryobiopsy"[tiab]
  OR "percutaneous dilatational tracheostomy"[tiab]
  OR "percutaneous dilational tracheostomy"[tiab]
)
AND 2000:3000[dp]
```

### ebus_mediastinal_staging: EBUS, EUS-B, and mediastinal staging

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  EBUS[tiab]
  OR "EBUS-TBNA"[tiab]
  OR "EBUS-TBNB"[tiab]
  OR "endobronchial ultrasound"[tiab]
  OR "endobronchial ultrasonography"[tiab]
  OR "endobronchial ultrasound-guided"[tiab]
  OR "EUS-B"[tiab]
  OR "EUS-B-FNA"[tiab]
  OR "endoscopic ultrasound with bronchoscope"[tiab]
  OR "intranodal forceps biopsy"[tiab]
  OR "EBUS-IFB"[tiab]
  OR "mediastinal cryobiopsy"[tiab]
  OR "transbronchial mediastinal cryobiopsy"[tiab]
  OR (
    (TBNA[tiab] OR "transbronchial needle aspiration"[tiab] OR "mediastinal staging"[tiab])
    AND (bronchoscop*[tiab] OR mediastin*[tiab] OR lung[tiab] OR pulmon*[tiab])
  )
)
AND 2000:3000[dp]
```

### peripheral_navigation: Peripheral pulmonary lesions, navigation, and image confirmation

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  "peripheral pulmonary lesion"[tiab]
  OR "peripheral pulmonary lesions"[tiab]
  OR "peripheral lung lesion"[tiab]
  OR "peripheral lung lesions"[tiab]
  OR "pulmonary nodule"[tiab]
  OR "pulmonary nodules"[tiab]
  OR "lung nodule"[tiab]
  OR "lung nodules"[tiab]
)
AND
(
  bronchoscop*[tiab]
  OR "radial EBUS"[tiab]
  OR "R-EBUS"[tiab]
  OR "radial endobronchial ultrasound"[tiab]
  OR "guide sheath"[tiab]
  OR "ultrathin bronchoscopy"[tiab]
  OR "ultrathin bronchoscope"[tiab]
  OR "electromagnetic navigation"[tiab]
  OR "electromagnetic navigational bronchoscopy"[tiab]
  OR "navigation bronchoscopy"[tiab]
  OR "navigational bronchoscopy"[tiab]
  OR "virtual bronchoscopic navigation"[tiab]
  OR "virtual bronchoscopy"[tiab]
  OR "robotic bronchoscopy"[tiab]
  OR "robotic-assisted bronchoscopy"[tiab]
  OR "robot-assisted bronchoscopy"[tiab]
  OR "robotically assisted bronchoscopy"[tiab]
  OR "shape-sensing"[tiab]
  OR "shape sensing"[tiab]
  OR "cone-beam CT"[tiab]
  OR "cone beam CT"[tiab]
  OR "cone-beam computed tomography"[tiab]
  OR "cone beam computed tomography"[tiab]
  OR "mobile cone-beam CT"[tiab]
  OR "augmented fluoroscopy"[tiab]
  OR "3D fluoroscopy"[tiab]
  OR tomosynthesis[tiab]
  OR "tool-in-lesion"[tiab]
  OR "tool in lesion"[tiab]
)
AND 2000:3000[dp]
```

### peripheral_biopsy_localization: Peripheral biopsy, specimen adequacy, fiducials, and localization

Cadence: `weekly`  
Precision profile: `moderate_recall`

```text
(
  bronchoscop*[tiab]
  OR transbronchial[tiab]
  OR endobronchial[tiab]
)
AND
(
  "peripheral pulmonary lesion"[tiab]
  OR "peripheral pulmonary lesions"[tiab]
  OR "peripheral lung lesion"[tiab]
  OR "peripheral lung lesions"[tiab]
  OR "pulmonary nodule"[tiab]
  OR "pulmonary nodules"[tiab]
  OR "lung nodule"[tiab]
  OR "lung nodules"[tiab]
)
AND
(
  "needle biopsy"[tiab]
  OR "forceps biopsy"[tiab]
  OR cryobiops*[tiab]
  OR "transbronchial biopsy"[tiab]
  OR "molecular adequacy"[tiab]
  OR "molecular testing"[tiab]
  OR "genomic testing"[tiab]
  OR "next-generation sequencing"[tiab]
  OR "next generation sequencing"[tiab]
  OR "fiducial marker"[tiab]
  OR "fiducial markers"[tiab]
  OR "dye marking"[tiab]
  OR "dye localization"[tiab]
  OR "bronchoscopic localization"[tiab]
  OR "pleural dye marking"[tiab]
)
AND 2000:3000[dp]
```

### central_airway_obstruction: Central airway obstruction and therapeutic bronchoscopy

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  "central airway obstruction"[tiab]
  OR "malignant airway obstruction"[tiab]
  OR "benign airway obstruction"[tiab]
  OR "endobronchial obstruction"[tiab]
  OR "tracheal obstruction"[tiab]
  OR "bronchial obstruction"[tiab]
  OR "airway stenosis"[tiab]
  OR "tracheal stenosis"[tiab]
  OR "bronchial stenosis"[tiab]
  OR "subglottic stenosis"[tiab]
  OR "postintubation tracheal stenosis"[tiab]
  OR "post-intubation tracheal stenosis"[tiab]
  OR tracheobronchomalacia[tiab]
  OR "excessive dynamic airway collapse"[tiab]
)
AND
(
  bronchoscop*[tiab]
  OR endobronchial[tiab]
  OR "rigid bronchoscopy"[tiab]
  OR debulk*[tiab]
  OR recanali*[tiab]
  OR dilat*[tiab]
  OR stent*[tiab]
  OR electrocauter*[tiab]
  OR "argon plasma coagulation"[tiab]
  OR laser[tiab]
  OR cryotherap*[tiab]
  OR cryoextract*[tiab]
  OR "spray cryotherapy"[tiab]
  OR "photodynamic therapy"[tiab]
  OR brachytherap*[tiab]
  OR microdebrid*[tiab]
)
AND 2000:3000[dp]
```

### airway_stents: Airway stents and stent complications

Cadence: `weekly`  
Precision profile: `high_precision`

```text
(
  "airway stent"[tiab]
  OR "airway stents"[tiab]
  OR "tracheal stent"[tiab]
  OR "tracheal stents"[tiab]
  OR "bronchial stent"[tiab]
  OR "bronchial stents"[tiab]
  OR "tracheobronchial stent"[tiab]
  OR "tracheobronchial stents"[tiab]
  OR "silicone airway stent"[tiab]
  OR "silicone airway stents"[tiab]
  OR "metallic airway stent"[tiab]
  OR "metallic airway stents"[tiab]
  OR "hybrid airway stent"[tiab]
  OR "hybrid airway stents"[tiab]
  OR "Montgomery T-tube"[tiab]
  OR "Montgomery T tube"[tiab]
)
AND 2000:3000[dp]
```

### pleural_interventions: Pleural procedures, pleuroscopy, IPCs, drainage, and pleurodesis

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "local anesthetic thoracoscopy"[tiab]
  OR "local anaesthetic thoracoscopy"[tiab]
  OR "semirigid thoracoscopy"[tiab]
  OR "semi-rigid thoracoscopy"[tiab]
  OR "flexi-rigid thoracoscopy"[tiab]
  OR "indwelling pleural catheter"[tiab]
  OR "indwelling pleural catheters"[tiab]
  OR "tunneled pleural catheter"[tiab]
  OR "tunneled pleural catheters"[tiab]
  OR "tunnelled pleural catheter"[tiab]
  OR "tunnelled pleural catheters"[tiab]
  OR thoracentes*[tiab]
  OR "pleural biopsy"[tiab]
  OR "pleural biopsies"[tiab]
  OR pleurodesis[tiab]
  OR "thoracic ultrasound"[tiab]
  OR "pleural ultrasound"[tiab]
  OR "pleural drain"[tiab]
  OR "pleural drains"[tiab]
  OR "intercostal drain"[tiab]
  OR "intercostal drains"[tiab]
  OR (
    ("chest tube"[tiab] OR "chest tubes"[tiab] OR "pigtail catheter"[tiab] OR "pigtail catheters"[tiab])
    AND (pleur*[tiab] OR pneumothorax[tiab] OR empyema[tiab])
  )
  OR (
    ("intrapleural fibrinolytic"[tiab] OR "intrapleural fibrinolytics"[tiab] OR "intrapleural enzyme therapy"[tiab] OR "tPA DNase"[tiab])
    AND (empyema[tiab] OR "pleural infection"[tiab])
  )
)
AND 2000:3000[dp]
```

### bronchoscopic_lung_volume_reduction: Bronchoscopic lung-volume reduction and bronchoscopic COPD therapies

Cadence: `weekly`  
Precision profile: `high_precision`

```text
(
  "bronchoscopic lung volume reduction"[tiab]
  OR "bronchoscopic volume reduction"[tiab]
  OR "endobronchial valve"[tiab]
  OR "endobronchial valves"[tiab]
  OR "bronchial valve"[tiab]
  OR "bronchial valves"[tiab]
  OR Zephyr[tiab]
  OR Spiration[tiab]
  OR Chartis[tiab]
  OR "collateral ventilation"[tiab]
  OR "lung volume reduction coil"[tiab]
  OR "lung volume reduction coils"[tiab]
  OR RePneu[tiab]
  OR "bronchoscopic thermal vapor ablation"[tiab]
  OR "bronchoscopic thermal vapour ablation"[tiab]
  OR "bronchoscopic lung sealant"[tiab]
  OR "airway bypass"[tiab]
  OR "targeted lung denervation"[tiab]
)
AND
(
  emphysema[tiab]
  OR COPD[tiab]
  OR hyperinflation[tiab]
  OR "Pulmonary Emphysema"[mh]
)
AND 2000:3000[dp]
```

### persistent_air_leak_fistula: Persistent air leak and bronchoscopic fistula closure

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  "persistent air leak"[tiab]
  OR "prolonged air leak"[tiab]
  OR "alveolopleural fistula"[tiab]
  OR "alveolar-pleural fistula"[tiab]
  OR "bronchopleural fistula"[tiab]
  OR "broncho-pleural fistula"[tiab]
  OR "bronchocutaneous fistula"[tiab]
  OR "bronchobiliary fistula"[tiab]
)
AND
(
  bronchoscop*[tiab]
  OR endobronchial[tiab]
  OR intrabronchial[tiab]
  OR "endobronchial valve"[tiab]
  OR "endobronchial valves"[tiab]
  OR "bronchial valve"[tiab]
  OR "bronchial valves"[tiab]
  OR spigot*[tiab]
  OR "Watanabe spigot"[tiab]
  OR sealant*[tiab]
  OR glue[tiab]
  OR occluder*[tiab]
  OR Amplatzer[tiab]
  OR coil*[tiab]
)
AND 2000:3000[dp]
```

### transbronchial_cryobiopsy: Transbronchial and endobronchial cryobiopsy

Cadence: `weekly`  
Precision profile: `high_precision`

```text
(
  "transbronchial lung cryobiopsy"[tiab]
  OR "transbronchial cryobiopsy"[tiab]
  OR "transbronchial cryo-biopsy"[tiab]
  OR TBLC[tiab]
  OR TBCB[tiab]
  OR (
    (cryobiops*[tiab] OR "cryo-biopsy"[tiab] OR cryoprobe*[tiab])
    AND (transbronchial[tiab] OR endobronchial[tiab] OR bronchoscop*[tiab])
  )
)
AND 2000:3000[dp]
```

### hemoptysis_airway_bleeding: Hemoptysis and bronchoscopic airway-bleeding management

Cadence: `weekly`  
Precision profile: `moderate_recall`

```text
(
  hemoptysis[tiab]
  OR haemoptysis[tiab]
  OR "airway bleeding"[tiab]
  OR "endobronchial bleeding"[tiab]
  OR "bronchoscopic bleeding"[tiab]
)
AND
(
  bronchoscop*[tiab]
  OR endobronchial[tiab]
  OR "bronchial blocker"[tiab]
  OR "bronchial blockers"[tiab]
  OR "endobronchial blocker"[tiab]
  OR "endobronchial blockers"[tiab]
  OR tamponade[tiab]
  OR "topical hemostatic"[tiab]
  OR "topical haemostatic"[tiab]
  OR cryotherap*[tiab]
  OR electrocauter*[tiab]
  OR "argon plasma coagulation"[tiab]
  OR laser[tiab]
)
AND 2000:3000[dp]
```

### percutaneous_tracheostomy: Percutaneous tracheostomy and procedural guidance

Cadence: `weekly`  
Precision profile: `high_precision`

```text
(
  "percutaneous dilatational tracheostomy"[tiab]
  OR "percutaneous dilational tracheostomy"[tiab]
  OR "percutaneous tracheostomy"[tiab]
  OR "bronchoscopic tracheostomy"[tiab]
  OR "bronchoscopy-guided tracheostomy"[tiab]
  OR "bronchoscopic-guided tracheostomy"[tiab]
  OR "ultrasound-guided tracheostomy"[tiab]
  OR "ultrasound guided tracheostomy"[tiab]
)
AND 2000:3000[dp]
```

### other_advanced_bronchoscopy: Other advanced bronchoscopy: foreign bodies, thermoplasty, lavage, and transplant airways

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  "bronchial thermoplasty"[tiab]
  OR "whole lung lavage"[tiab]
  OR "whole-lung lavage"[tiab]
  OR (
    ("foreign body"[tiab] OR "foreign bodies"[tiab])
    AND (bronchoscop*[tiab] OR tracheobronch*[tiab] OR airway[tiab])
  )
  OR (
    (transplant*[tiab] OR "Lung Transplantation"[mh])
    AND (
      "airway complication"[tiab]
      OR "airway complications"[tiab]
      OR "bronchial stenosis"[tiab]
      OR "anastomotic stenosis"[tiab]
      OR "airway dehiscence"[tiab]
      OR "bronchial dehiscence"[tiab]
    )
    AND (bronchoscop*[tiab] OR endobronchial[tiab] OR stent*[tiab] OR dilat*[tiab])
  )
)
AND 2000:3000[dp]
```

### bronchoscopic_tumor_ablation: Bronchoscopic tumor ablation and emerging therapeutic technologies

Cadence: `weekly`  
Precision profile: `moderate_recall`

```text
(
  bronchoscop*[tiab]
  OR endobronchial[tiab]
  OR transbronchial[tiab]
)
AND
(
  "microwave ablation"[tiab]
  OR "radiofrequency ablation"[tiab]
  OR "thermal ablation"[tiab]
  OR "vapor ablation"[tiab]
  OR "vapour ablation"[tiab]
  OR "pulsed electric field"[tiab]
  OR "pulsed-field ablation"[tiab]
  OR "pulsed field ablation"[tiab]
  OR "photodynamic therapy"[tiab]
  OR brachytherap*[tiab]
  OR "spray cryotherapy"[tiab]
)
AND
(
  lung[tiab]
  OR pulmon*[tiab]
  OR airway*[tiab]
  OR bronch*[tiab]
  OR neoplasm*[tiab]
  OR cancer*[tiab]
  OR tumor*[tiab]
  OR tumour*[tiab]
)
AND 2000:3000[dp]
```

### education_simulation_quality: IP education, simulation, competency, workflow, and quality

Cadence: `monthly`  
Precision profile: `moderate_recall`

```text
(
  bronchoscop*[tiab]
  OR pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "interventional pulmonology"[tiab]
  OR "interventional pulmonary"[tiab]
)
AND
(
  simulation[tiab]
  OR simulator*[tiab]
  OR competency[tiab]
  OR competence[tiab]
  OR training[tiab]
  OR curriculum[tiab]
  OR "learning curve"[tiab]
  OR assessment[tiab]
  OR credential*[tiab]
  OR quality[tiab]
  OR workflow[tiab]
  OR ergonomics[tiab]
)
AND 2000:3000[dp]
```

### procedural_safety_anesthesia: Procedural safety, anesthesia, ventilation, and complications

Cadence: `monthly`  
Precision profile: `low_precision`

```text
(
  bronchoscop*[tiab]
  OR pleuroscop*[tiab]
  OR "medical thoracoscopy"[tiab]
  OR "interventional pulmonology"[tiab]
)
AND
(
  anesthesia[tiab]
  OR anaesthesia[tiab]
  OR sedation[tiab]
  OR ventilation[tiab]
  OR hypoxemia[tiab]
  OR hypoxaemia[tiab]
  OR bleeding[tiab]
  OR pneumothorax[tiab]
  OR complication*[tiab]
  OR safety[tiab]
)
AND 2000:3000[dp]
```

### ai_imaging_technology: AI, computer vision, imaging, and procedural technology

Cadence: `weekly`  
Precision profile: `high_recall`

```text
(
  bronchoscop*[tiab]
  OR endobronchial[tiab]
  OR transbronchial[tiab]
  OR EBUS[tiab]
  OR pleuroscop*[tiab]
)
AND
(
  "artificial intelligence"[tiab]
  OR "machine learning"[tiab]
  OR "deep learning"[tiab]
  OR "computer vision"[tiab]
  OR "image segmentation"[tiab]
  OR "image guidance"[tiab]
  OR "image registration"[tiab]
  OR "augmented reality"[tiab]
  OR "virtual reality"[tiab]
  OR radiomics[tiab]
  OR "neural network"[tiab]
  OR "neural networks"[tiab]
)
AND 2000:3000[dp]
```

## 7. Incremental synchronization templates

Use explicit dates generated from a stored watermark, with an overlap of several days. The example window below is illustrative.

### Newly created PubMed records

```text
(<SOURCE OR TOPIC QUERY>)
AND 2000:3000[dp]
AND 2026/07/12:2026/07/26[crdt]
```

### Revised PubMed records

```text
(<SOURCE OR TOPIC QUERY>)
AND 2000:3000[dp]
AND 2026/07/12:2026/07/26[lr]
```

Deduplicate by PMID and upsert changed metadata. A citation may be returned by both jobs.

## 8. Backfill execution pattern

For each journal or discovery module, generate one query per publication year, for example:

```text
Chest[ta] AND 2000[dp]
Chest[ta] AND 2001[dp]
...
Chest[ta] AND 2026[dp]
```

Record the source ID, exact query, publication year, retrieved PMID count, start and completion timestamps, and errors. Fetch PubMed XML in batches and keep the raw source payload or a source hash for reproducibility.

## 9. Required validation

- Confirm that a known landmark set is retrieved by at least one module.
- Review random exclusions from each expanded journal and each discovery module.
- Measure recall separately for EBUS, peripheral navigation, CAO, stents, pleural interventions, BLVR, air leaks, cryobiopsy, tracheostomy, and emerging technology.
- Re-run missed landmark articles against the query registry and add missing synonyms without silently changing prior query versions.
- Keep query versions in the database so every article has reproducible discovery provenance.
