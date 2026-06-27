import type { ActiveLocale } from './locale'

// Generated from Creative Commons category and image-description metadata.
const creativeCommonsTranslations: Partial<Record<ActiveLocale, Readonly<Record<string, string>>>> =
  {
    es: {
      '3D Printing – LUL tumor reconstruction (STL file processing)':
        'Impresión 3D – Reconstrucción de tumor del LUL (procesamiento de archivo STL)',
      '3D Reconstruction –  Virtual segmentectomy': 'Reconstrucción 3D – Segmentectomía virtual',
      '3D Reconstruction – Bronchial tree timeline (LMB stenosis and stent placement)':
        'Reconstrucción 3D – Cronología del árbol bronquial (estenosis del LMB y colocación de stent)',
      '3D Reconstruction – Broncho-vascular anatomy (LUL S1+2 with nodule)':
        'Reconstrucción 3D – Anatomía broncovascular (LUL S1+2 con nódulo)',
      '3D Reconstruction – Lung parenchyma segmentectomy simulation (S7+8 with nodule)':
        'Reconstrucción 3D – Simulación de segmentectomía del parénquima pulmonar (S7+8 con nódulo)',
      '3D Reconstruction – Venous drainage (LUL surgical dissection vs virtual)':
        'Reconstrucción 3D – Drenaje venoso (disección quirúrgica del LUL frente a reconstrucción virtual)',
      '3D Reconstruction – Virtual bronchoscopy (CT-based bronchial model)':
        'Reconstrucción 3D – Broncoscopia virtual (modelo bronquial basado en TC)',
      '3D printed stent (customized silicone for complex stenosis)':
        'Stent impreso en 3D (silicona personalizada para estenosis compleja)',
      '3D reconstructions': 'Reconstrucciones 3D',
      'APC and diode laser (endobronchial treatment sequence)':
        'APC y láser de diodo (secuencia de tratamiento endobronquial)',
      'Ablation – Fluoroscopy-guided cryoprobe with EBUS (1.1mm)':
        'Ablación – Crioprobe guiada por fluoroscopia con EBUS (1,1 mm)',
      'Adenoid Cystic Carcinoma (Cribriform Subtype)':
        'Carcinoma adenoide quístico (subtipo cribiforme)',
      'Adenoid cystic carcinoma (cribriform pattern, p40 and MYB IHC)':
        'Carcinoma adenoide quístico (patrón cribiforme, IHQ para p40 y MYB)',
      'Airway Management – Endobronchial Blockers (Schematic)':
        'Manejo de la vía aérea – Bloqueadores endobronquiales (esquema)',
      'Airway Management – Endobronchial Blockers (Types/Parts)':
        'Manejo de la vía aérea – Bloqueadores endobronquiales (tipos/piezas)',
      'Airway Stenosis – Montgomery T-tube placement procedure':
        'Estenosis de la vía aérea – Procedimiento de colocación de tubo en T de Montgomery',
      'Airway Stenosis – Post‑intubation (CT & bronchoscopy)':
        'Estenosis de la vía aérea – Posterior a intubación (TC y broncoscopia)',
      'Airway metastasis (LMB, hepatocellular carcinoma, laser/mechanical debulking)':
        'Metástasis en la vía aérea (LMB, carcinoma hepatocelular, reducción tumoral con láser/mecánica)',
      'Airway stents comparison (Polyflex, Ultraflex, Silmet, Nova-Stent, Dumon, Freitag, Hood)':
        'Comparación de stents de la vía aérea (Polyflex, Ultraflex, Silmet, Nova-Stent, Dumon, Freitag, Hood)',
      'Algorithm – Endobronchial-transbronchial ablation zones (anatomical guidance)':
        'Algoritmo – Zonas de ablación endobronquial-transbronquial (guía anatómica)',
      'Algorithm – Navigated CP-EBUS workflow (mediastinal lymph node diagnosis, 6-step schematic)':
        'Algoritmo – Flujo de trabajo de CP-EBUS navegado (diagnóstico de ganglios mediastínicos, esquema de 6 pasos)',
      'Algorithm – SSN 3D measurement index (CT histogram and texture features)':
        'Algoritmo – Índice de medición 3D de SSN (histograma de TC y características de textura)',
      'Algorithm/Procedure – iSGS treatment approaches (endoscopic laryngotracheoplasty techniques)':
        'Algoritmo/procedimiento – Enfoques terapéuticos para iSGS (técnicas de laringotraqueoplastia endoscópica)',
      'Ambu Disposable Bronchoscope': 'Broncoscopio desechable Ambu',
      'Amplatzer devices for bronchopleural fistula closure':
        'Dispositivos Amplatzer para el cierre de fístula broncopleural',
      'Anatomy – Internal mammary arteries on CT/3D':
        'Anatomía – Arterias mamarias internas en TC/3D',
      'Anatomy – Secondary lobule diagram (artery lobularis and pulmonary artery branch)':
        'Anatomía – Diagrama del lobulillo secundario (arteria lobular y rama de la arteria pulmonar)',
      'Anthropomorphic Lungman phantom': 'Fantoma pulmonar antropomórfico Lungman',
      'Appropriate vs Lateral Puncture': 'Punción apropiada frente a punción lateral',
      'Atelectasis Severity (ASSESS Scoring Schematic)':
        'Gravedad de la atelectasia (esquema de puntuación ASSESS)',
      'Atelectasis Severity (CT Examples I–III)':
        'Gravedad de la atelectasia (ejemplos de TC I–III)',
      'Augmented Fluoroscopy – Bronchoscopic localization':
        'Fluoroscopia aumentada – Localización broncoscópica',
      'Augmented Fluoroscopy – Coil deployment view':
        'Fluoroscopia aumentada – Vista de despliegue de coil',
      'Augmented Reality – Virtual 3D model overlay (bronchoscope location display)':
        'Realidad aumentada – Superposición de modelo virtual 3D (visualización de la ubicación del broncoscopio)',
      'Auto‑planning vs manual (MFS/HFS)': 'Planificación automática frente a manual (MFS/HFS)',
      'BAO complex tracheal stenosis (mechanical dilation, silicone stent)':
        'BAO con estenosis traqueal compleja (dilatación mecánica, stent de silicona)',
      'BAO from pulmonary amyloidoma (carina, 5-month follow-up)':
        'BAO por amiloidoma pulmonar (carina, seguimiento a 5 meses)',
      'BD stent (3-month follow-up, mucosal hyperplasia)':
        'Stent BD (seguimiento a 3 meses, hiperplasia mucosa)',
      'BD stent (immediate post-implantation)':
        'Stent BD (inmediatamente después de la implantación)',
      'Balloon Dilation (Incisions → Rigid Scope)':
        'Dilatación con balón (incisiones → broncoscopio rígido)',
      'Balloon Dilation (Timeline Sep–Oct 2021)':
        'Dilatación con balón (cronología sep–oct de 2021)',
      'Balloon Dilation and Stent (Timeline Oct–Nov 2021)':
        'Dilatación con balón y stent (cronología oct–nov de 2021)',
      'Biodegradable stent degradation (3-month follow-up)':
        'Degradación de stent biodegradable (seguimiento a 3 meses)',
      'Biopsy – CBCT‑guided lung nodule': 'Biopsia – Nódulo pulmonar guiado por CBCT',
      'Biopsy – CT‑guided lung nodule (multi‑plane)':
        'Biopsia – Nódulo pulmonar guiado por TC (multiplanar)',
      'Biopsy – CT‑guided: hemorrhage complication':
        'Biopsia – Guiada por TC: complicación hemorrágica',
      'Biopsy – CT‑guided: indications': 'Biopsia – Guiada por TC: indicaciones',
      'Biopsy – CT‑guided: pneumothorax complication':
        'Biopsia – Guiada por TC: complicación de neumotórax',
      'Biopsy – Fluoroscopy‑guided lung nodule':
        'Biopsia – Nódulo pulmonar guiado por fluoroscopia',
      'Biopsy – Specimen comparison (needle, forceps, cryobiopsy gross and frozen)':
        'Biopsia – Comparación de muestras (aguja, pinzas, criobiopsia macroscópica y congelada)',
      'Biopsy – Transbronchial cryobiopsy procedure (RLL, ILD, fluoroscopy-guided)':
        'Biopsia – Procedimiento de criobiopsia transbronquial (RLL, ILD, guiado por fluoroscopia)',
      'Biopsy – Ultrasound‑guided lung nodule': 'Biopsia – Nódulo pulmonar guiado por ecografía',
      'Brachytherapy – Endobronchial infiltration (LUL catheter placement and dose planning)':
        'Braquiterapia – Infiltración endobronquial (colocación de catéter en LUL y planificación de dosis)',
      'Bronchial stenosis (post-dilation and silicon stent placement)':
        'Estenosis bronquial (después de dilatación y colocación de stent de silicona)',
      'Bronchopleural Fistula – AD implantation (post-RML/RLL lobectomy)':
        'Fístula broncopleural – Implantación de AD (después de lobectomía de RML/RLL)',
      'Bronchopleural Fistula – AD implantation with CT/bronchoscopy correlation (post-LUL lobectomy)':
        'Fístula broncopleural – Implantación de AD con correlación TC/broncoscopia (después de lobectomía de LUL)',
      'Bronchoscopic Ablation – Argon plasma debulking':
        'Ablación broncoscópica – Reducción tumoral con plasma de argón',
      'Bronchoscopic Ablation – Microwave (CBCT verification)':
        'Ablación broncoscópica – Microondas (verificación con CBCT)',
      'Bronchoscopic Images –  Laser Photocoagulation (YAP/Nd:YAG)':
        'Imágenes broncoscópicas – Fotocoagulación con láser (YAP/Nd:YAG)',
      'Bronchoscopic Images – Cobblestoning': 'Imágenes broncoscópicas – Patrón en empedrado',
      'Bronchoscopic Images/CT – Dumon Oki stent (RMB extrinsic compression, post-stenting)':
        'Imágenes broncoscópicas/TC – Stent Dumon Oki (compresión extrínseca del RMB, después de colocar el stent)',
      'Bronchoscopic Images/CT – RML fistula stent management (placement, restenosis, removal timeline)':
        'Imágenes broncoscópicas/TC – Manejo de stent en fístula del RML (colocación, reestenosis y cronología de retirada)',
      'Bronchoscopic Images/CT – Tracheal stenosis (covered Ultraflex for lymphoma, R-CHOP therapy, 6-year survival)':
        'Imágenes broncoscópicas/TC – Estenosis traqueal (Ultraflex cubierto para linfoma, tratamiento R-CHOP, supervivencia de 6 años)',
      'Bronchoscopic Images/CT – Tracheal stenosis (spiral Z stent for thymic cancer, 6-year survival)':
        'Imágenes broncoscópicas/TC – Estenosis traqueal (stent espiral en Z para cáncer tímico, supervivencia de 6 años)',
      'Bronchoscopic Images/Pathology – ENB-guided methylene blue injection (S2a subsegmental, adenocarcinoma)':
        'Imágenes broncoscópicas/anatomía patológica – Inyección de azul de metileno guiada por ENB (subsegmento S2a, adenocarcinoma)',
      'Bronchoscopic Lung Volume Reduction': 'Reducción broncoscópica del volumen pulmonar',
      'CBCT – Brush Catheter Adjacent to Pleura (Axial)':
        'CBCT – Catéter con cepillo adyacente a la pleura (axial)',
      'CBCT – Brush Catheter Adjacent to Pleura (Sagittal)':
        'CBCT – Catéter con cepillo adyacente a la pleura (sagital)',
      'CBCT – Cios Spin unit': 'CBCT – Unidad Cios Spin',
      'CBCT – Lung nodule (center strike, multiplanar views)':
        'CBCT – Nódulo pulmonar (impacto central, vistas multiplanares)',
      'CBCT – Percutaneous nodule marking guidance':
        'CBCT – Guía para marcación percutánea de nódulos',
      'CBCT – Tool‑in‑lesion (EMN + EWC)': 'CBCT – Instrumento dentro de la lesión (EMN + EWC)',
      'CBCT‑Derived AF (Forceps/Cryobiopsy/Percutaneous)':
        'AF derivada de CBCT (pinzas/criobiopsia/percutánea)',
      'CBCT–DTS – Patient (CT vs intra‑op CBCT)':
        'CBCT–DTS – Paciente (TC frente a CBCT intraoperatoria)',
      'CBCT–DTS – Patient reconstruction (PL DTS)':
        'CBCT–DTS – Reconstrucción del paciente (PL DTS)',
      'CBCT–DTS – Phantom (CT vs intra‑op CBCT)':
        'CBCT–DTS – Fantoma (TC frente a CBCT intraoperatoria)',
      'CBCT–DTS – Phantom reconstruction (PL DTS)':
        'CBCT–DTS – Reconstrucción del fantoma (PL DTS)',
      'CBCT–DTS – Phantom reconstruction (SE DTS)':
        'CBCT–DTS – Reconstrucción del fantoma (SE DTS)',
      'CEUS – Subpleural lung tumor biopsy (needle positioning in vital tissue)':
        'CEUS – Biopsia de tumor pulmonar subpleural (posición de la aguja en tejido viable)',
      'COPD evaluation (CT inspiration/expiration, perfusion, quantitative analysis)':
        'Evaluación de COPD (TC en inspiración/espiración, perfusión, análisis cuantitativo)',
      'CP-EBUS real-time TBNA (mediastinal lymph node with dual video/US display)':
        'TBNA en tiempo real con CP-EBUS (ganglio mediastínico con visualización doble de video/ecografía)',
      'CP‑EBUS (Well‑Circumscribed Water‑Density Lesion)':
        'CP-EBUS (lesión bien delimitada con densidad de agua)',
      'CT Angio – Azygos vein ectasia': 'Angio-TC – Ectasia de la vena ácigos',
      'CT Correlation (LUL Endobronchial Hamartoma)':
        'Correlación por TC (hamartoma endobronquial del LUL)',
      'CT Signs (Split Pleura / Hemi‑Split)': 'Signos en TC (pleura dividida / hemi-split)',
      'CT after first SBRT': 'TC después de la primera SBRT',
      'CT –  Right lung mass': 'TC – Masa en pulmón derecho',
      'CT – Airway stent migration to stomach':
        'TC – Migración de stent de la vía aérea al estómago',
      'CT – Atelectasis/ventilation change pre/post stent':
        'TC – Cambio en atelectasia/ventilación antes y después del stent',
      'CT – BLVR occlusion methods (balloon vs valves, atelectasis patterns, accessory lobe expansion)':
        'TC – Métodos de oclusión para BLVR (balón frente a válvulas, patrones de atelectasia, expansión del lóbulo accesorio)',
      'CT – Bilateral SEMS (pre/post comparison, coronal views with patent stents)':
        'TC – SEMS bilaterales (comparación antes/después, vistas coronales con stents permeables)',
      'CT – Bilateral SEMS cases (multiplanar reconstruction, five patients)':
        'TC – Casos con SEMS bilaterales (reconstrucción multiplanar, cinco pacientes)',
      'CT – Bronchus signs (truncation, passage, no bronchus)':
        'TC – Signos bronquiales (truncamiento, paso, ausencia de bronquio)',
      'CT – Cavitary nodule (LLL squamous cell carcinoma)':
        'TC – Nódulo cavitado (carcinoma escamoso del LLL)',
      'CT – Cavitary nodule (RUL aspergilloma)': 'TC – Nódulo cavitado (aspergiloma del RUL)',
      'CT – Central tumor progression (vascular and bronchial compression)':
        'TC – Progresión de tumor central (compresión vascular y bronquial)',
      'CT – Complex nodule with bronchial interruption sign (LLL invasive adenocarcinoma, MIP vessel convergence)':
        'TC – Nódulo complejo con signo de interrupción bronquial (adenocarcinoma invasivo del LLL, convergencia vascular en MIP)',
      'CT – Complex nodule with bubble-like lucencies (RUL adenocarcinoma, mixed growth patterns)':
        'TC – Nódulo complejo con lucencias tipo burbuja (adenocarcinoma del RUL, patrones de crecimiento mixtos)',
      'CT – Cystic airspace with mural nodule (LUL adenocarcinoma)':
        'TC – Espacio aéreo quístico con nódulo mural (adenocarcinoma del LUL)',
      'CT – Cystic lesion (right superior mediastinum, posterior SVC)':
        'TC – Lesión quística (mediastino superior derecho, posterior a la SVC)',
      'CT – Features Predicting SSN Growth':
        'TC – Características predictoras del crecimiento de SSN',
      'CT – Ground glass nodule evolution (stable, progressive, part-solid transformation)':
        'TC – Evolución de nódulo en vidrio esmerilado (estable, progresivo, transformación a parcialmente sólido)',
      'CT – Hamartoma with Popcorn Calcifications':
        'TC – Hamartoma con calcificaciones en palomitas de maíz',
      'CT – IASLC 2R/4R mapping': 'TC – Mapeo IASLC de 2R/4R',
      'CT – IASLC stations 4L/5/5': 'TC – Estaciones IASLC 4L/5/5',
      'CT – Intrapulmonary Lymph Nodes (Triangular)':
        'TC – Ganglios linfáticos intrapulmonares (triangulares)',
      'CT – Intrathoracic goiter (diffuse tracheal narrowing, severe obstruction)':
        'TC – Bocio intratorácico (estrechamiento traqueal difuso, obstrucción grave)',
      'CT – LLL mass with left adrenal enlargement (heterogeneous enhancement)':
        'TC – Masa del LLL con aumento de tamaño de la suprarrenal izquierda (realce heterogéneo)',
      'CT – LMS obstruction: SCC vs ACC': 'TC – Obstrucción del LMS: SCC frente a ACC',
      'CT – LUL Lobulated Nodule (Hamartoma)': 'TC – Nódulo lobulado del LUL (hamartoma)',
      'CT – LUL Mass (Contrast; Axial/Coronal/Sagittal)':
        'TC – Masa del LUL (contraste; axial/coronal/sagital)',
      'CT – LUL pulmonary nodule (oblique fissure measurement)':
        'TC – Nódulo pulmonar del LUL (medición en la cisura oblicua)',
      'CT – Large left-sided pleural effusion': 'TC – Derrame pleural izquierdo de gran tamaño',
      'CT – Large tracheal lesion (95% obstruction, inferior third)':
        'TC – Lesión traqueal grande (obstrucción del 95 %, tercio inferior)',
      'CT – Lipoid pneumonia (RML with fat component)':
        'TC – Neumonía lipoidea (RML con componente graso)',
      'CT – Lobulated RLL Nodule (Adenocarcinoma)': 'TC – Nódulo lobulado del RLL (adenocarcinoma)',
      'CT – Loculated empyema': 'TC – Empiema loculado',
      'CT – Lung nodule with notch sign (lingula, large cell neuroendocrine carcinoma)':
        'TC – Nódulo pulmonar con signo de muesca (língula, carcinoma neuroendocrino de células grandes)',
      'CT – Malignant CAO stenting (Dumon Y stent, post-laser and debulking, multiplanar views)':
        'TC – Colocación de stent por CAO maligna (stent en Y de Dumon, después de láser y reducción tumoral, vistas multiplanares)',
      'CT – Mediastinal Adenopathy (Re‑Examination)':
        'TC – Adenopatías mediastínicas (reevaluación)',
      'CT – Mediastinal Mass (Re‑Examination)': 'TC – Masa mediastínica (reevaluación)',
      'CT – Mediastinal abscess (post-EBUS TBNA complication)':
        'TC – Absceso mediastínico (complicación posterior a EBUS-TBNA)',
      'CT – Mediastinal cyst (coronal)': 'TC – Quiste mediastínico (coronal)',
      'CT – Mediastinal cyst wall enhancement (axial)':
        'TC – Realce de la pared de quiste mediastínico (axial)',
      'CT – Mediastinal mass (tracheal invasion, esophageal mass, chest wall and cervical involvement)':
        'TC – Masa mediastínica (invasión traqueal, masa esofágica, afectación de pared torácica y cuello)',
      'CT – Multiple ground glass nodules (post-trauma, follow-up, post-surgical changes)':
        'TC – Múltiples nódulos en vidrio esmerilado (después de traumatismo, seguimiento, cambios posquirúrgicos)',
      'CT – Multiple nodules (carcinoid vs tuberculoma in oncology patient)':
        'TC – Múltiples nódulos (carcinoide frente a tuberculoma en paciente oncológico)',
      'CT – Multiple pulmonary nodules (spiculated morphology, varied PET uptake)':
        'TC – Múltiples nódulos pulmonares (morfología espiculada, captación variable en PET)',
      'CT – Multiple subsolid nodules (pure GGN vs part-solid, adenocarcinoma in situ vs minimally invasive)':
        'TC – Múltiples nódulos subsólidos (GGN puro frente a parcialmente sólido, adenocarcinoma in situ frente a mínimamente invasivo)',
      'CT – Navigation planning (PlanPoint software, segmented views with target pathway)':
        'TC – Planificación de navegación (software PlanPoint, vistas segmentadas con trayectoria al objetivo)',
      'CT – Nodule with bronchial interruption sign (RLL NSCLC with adrenal metastasis)':
        'TC – Nódulo con signo de interrupción bronquial (NSCLC del RLL con metástasis suprarrenal)',
      'CT – Nodule with bubble-like lucencies (RUL adenocarcinoma with lepidic growth)':
        'TC – Nódulo con lucencias tipo burbuja (adenocarcinoma del RUL con crecimiento lepídico)',
      'CT – Nodule with fissure retraction (adenocarcinoma)':
        'TC – Nódulo con retracción de la cisura (adenocarcinoma)',
      'CT – Nodule with irregular air bronchogram (RLL adenocarcinoma)':
        'TC – Nódulo con broncograma aéreo irregular (adenocarcinoma del RLL)',
      'CT – Pleural effusion (contiguous to primary lesion)':
        'TC – Derrame pleural (contiguo a la lesión primaria)',
      'CT – Pneumomediastinum and Subcutaneous Empysema':
        'TC – Neumomediastino y enfisema subcutáneo',
      'CT – Post-LVRS nodule': 'TC – Nódulo posterior a LVRS',
      'CT – Post-SBRT (11-month follow-up, ground-glass appearance)':
        'TC – Posterior a SBRT (seguimiento a 11 meses, aspecto en vidrio esmerilado)',
      'CT – Post-SBRT (2-month and 8-month follow-up)':
        'TC – Posterior a SBRT (seguimiento a 2 y 8 meses)',
      'CT – Post-operative bronchial kinking (lower lobar bronchus)':
        'TC – Acodamiento bronquial posoperatorio (bronquio lobar inferior)',
      'CT – Post-stent removal (tracheal patency)':
        'TC – Después de retirar el stent (permeabilidad traqueal)',
      'CT – Post‑EBUS timeline: complications': 'TC – Cronología posterior a EBUS: complicaciones',
      'CT – Post‑EBUS timeline: cyst enlargement':
        'TC – Cronología posterior a EBUS: aumento de tamaño del quiste',
      'CT – Post‑EBUS timeline: cyst smaller post‑TBNA':
        'TC – Cronología posterior a EBUS: quiste más pequeño después de TBNA',
      'CT – Post‑EBUS timeline: mediastinitis': 'TC – Cronología posterior a EBUS: mediastinitis',
      'CT – Post‑EBUS timeline: pleural effusion':
        'TC – Cronología posterior a EBUS: derrame pleural',
      'CT – Post‑op neck soft tissue: diffuse tracheal calcification':
        'TC – Tejidos blandos cervicales posoperatorios: calcificación traqueal difusa',
      'CT – Preoperative planning (RFID tag placement for S8a GGN, 3D reconstruction)':
        'TC – Planificación preoperatoria (colocación de etiqueta RFID para GGN S8a, reconstrucción 3D)',
      'CT – Pre‑LVRS': 'TC – Antes de LVRS',
      'CT – RFA treatment (3D thermodynamic reconstruction maps, pre/post comparison)':
        'TC – Tratamiento con RFA (mapas de reconstrucción termodinámica 3D, comparación antes/después)',
      'CT – RFID tag deviation (target vs actual placement site, 20.8mm distance)':
        'TC – Desviación de etiqueta RFID (objetivo frente a sitio real de colocación, distancia de 20,8 mm)',
      'CT – RLL mass with pleural effusion (compressive atelectasis, mass-like opacity)':
        'TC – Masa del RLL con derrame pleural (atelectasia compresiva, opacidad de aspecto tumoral)',
      'CT – RML orifice tumor with atelectasis': 'TC – Tumor del orificio del RML con atelectasia',
      'CT – RUL nodule with mediastinal adenopathy':
        'TC – Nódulo del RUL con adenopatías mediastínicas',
      'CT – Round well-delineated solid nodule (RLL squamous cell carcinoma)':
        'TC – Nódulo sólido redondo y bien delimitado (carcinoma escamoso del RLL)',
      'CT – SVC and right pulmonary artery compression (mediastinal mass)':
        'TC – Compresión de SVC y arteria pulmonar derecha (masa mediastínica)',
      'CT – SVC/PA Encasement (Middle Mediastinal Mass)':
        'TC – Invasión circunferencial de SVC/PA (masa mediastínica media)',
      'CT – Septated pleural effusion & “bubble sign”':
        'TC – Derrame pleural tabicado y «signo de la burbuja»',
      'CT – Sharply delineated oval nodule (LLL typical carcinoid)':
        'TC – Nódulo ovalado, de bordes nítidos (carcinoide típico del LLL)',
      'CT – Solid nodule with ground glass halo (RLL invasive aspergillosis)':
        'TC – Nódulo sólido con halo en vidrio esmerilado (aspergilosis invasiva del RLL)',
      'CT – Solitary lung nodule (2D and 3D MSCT with distance measurement)':
        'TC – Nódulo pulmonar solitario (MSCT 2D y 3D con medición de distancia)',
      'CT – Spiculated nodule (RLL squamous cell carcinoma)':
        'TC – Nódulo espiculado (carcinoma escamoso del RLL)',
      'CT – Spiculated nodule with calcifications (RUL apex, squamous cell carcinoma)':
        'TC – Nódulo espiculado con calcificaciones (vértice del RUL, carcinoma escamoso)',
      'CT – Spiculated nodule with notch sign (RUL small cell lung cancer with lymphadenopathy)':
        'TC – Nódulo espiculado con signo de muesca (cáncer microcítico del RUL con linfadenopatías)',
      'CT – Spiculated nodule with pleural tags (LUL adenocarcinoma with pleural invasion)':
        'TC – Nódulo espiculado con bandas pleurales (adenocarcinoma del LUL con invasión pleural)',
      'CT – Spiculated subpleural nodule (RUL apex with paraseptal emphysema)':
        'TC – Nódulo subpleural espiculado (vértice del RUL con enfisema paraseptal)',
      'CT – Squamous cell lung cancer (extrinsic obstruction, alveolus stent placement)':
        'TC – Cáncer pulmonar escamoso (obstrucción extrínseca, colocación de stent Alveolus)',
      'CT – Station 4R adenopathy': 'TC – Adenopatía en estación 4R',
      'CT – Subpleural Lobulated Nodule (Adenocarcinoma)':
        'TC – Nódulo subpleural lobulado (adenocarcinoma)',
      'CT – Subpleural reticulation & cysts (MIP selection)':
        'TC – Reticulación y quistes subpleurales (selección MIP)',
      'CT – Subpleural solid nodule (intrapulmonary lymph node, lingula)':
        'TC – Nódulo sólido subpleural (ganglio intrapulmonar, língula)',
      'CT – Suspicious Pulmonary Nodule (Right Lung)':
        'TC – Nódulo pulmonar sospechoso (pulmón derecho)',
      'CT – Temporal evolution of LMB obstruction & stenting':
        'TC – Evolución temporal de la obstrucción del LMB y colocación de stent',
      'CT – Thyroid mass with tracheal deviation': 'TC – Masa tiroidea con desviación traqueal',
      'CT – Tracheal Lesion (At Presentation)': 'TC – Lesión traqueal (en la presentación)',
      'CT – Tracheal and bilateral main bronchi stenosis (soft tissue thickening)':
        'TC – Estenosis traqueal y de ambos bronquios principales (engrosamiento de tejidos blandos)',
      'CT – Tracheal and bronchial wall thickening (left lung atelectasis and bronchiectasis)':
        'TC – Engrosamiento de paredes traqueal y bronquial (atelectasia y bronquiectasias del pulmón izquierdo)',
      'CT – Tracheal patency (post-stent and chemotherapy, 5-year follow-up)':
        'TC – Permeabilidad traqueal (después de stent y quimioterapia, seguimiento a 5 años)',
      'CT – Tracheal schwannoma causing obstruction':
        'TC – Schwannoma traqueal causante de obstrucción',
      'CT – Tracheal stenosis': 'TC – Estenosis traqueal',
      'CT – Triple dye injection (iodinated contrast, ICG, methylene blue near lung lesion)':
        'TC – Inyección de triple colorante (contraste yodado, ICG y azul de metileno cerca de la lesión pulmonar)',
      'CT – Tumor response after chemoradiation (tracheobronchial)':
        'TC – Respuesta tumoral después de quimiorradioterapia (traqueobronquial)',
      'CT – Tumor with cardiac invasion (left atrial involvement)':
        'TC – Tumor con invasión cardíaca (afectación de la aurícula izquierda)',
      'CT – Upper tracheal stenosis (axial and coronal views)':
        'TC – Estenosis de la tráquea superior (vistas axial y coronal)',
      'CT-guided cyanoacrylate localization': 'Localización con cianoacrilato guiada por TC',
      'CT-guided indocyanine green localization':
        'Localización con verde de indocianina guiada por TC',
      'CT-guided memory alloy coil localization':
        'Localización con coil de aleación con memoria guiada por TC',
      'CT/Bronchoscopy Correlation – Tracheal mass with near-complete obstruction':
        'Correlación TC/broncoscopia – Masa traqueal con obstrucción casi completa',
      'CT/Bronchoscopy Correlation – Tracheoesophageal fistula (esophageal tumor, stent placement with barium swallow)':
        'Correlación TC/broncoscopia – Fístula traqueoesofágica (tumor esofágico, colocación de stent con esofagograma de bario)',
      'CT/Bronchoscopy – Tracheal esophageal tumor (stent obstruction, APC recanalization)':
        'TC/broncoscopia – Tumor traqueoesofágico (obstrucción del stent, recanalización con APC)',
      'CT/Bronchoscopy – Tracheal polypoid metastasis (rigid bronchoscopy coring, APC)':
        'TC/broncoscopia – Metástasis polipoide traqueal (coring con broncoscopio rígido, APC)',
      'CT/Bronchoscopy – Tracheoesophageal fistula (SEMS placement and removal, stenosis management)':
        'TC/broncoscopia – Fístula traqueoesofágica (colocación y retirada de SEMS, manejo de la estenosis)',
      'CT/Bronchoscopy/Chest X-ray – LMB compression (thoracic aortic aneurysm, stent placement timeline)':
        'TC/broncoscopia/radiografía de tórax – Compresión del LMB (aneurisma de aorta torácica, cronología de colocación de stent)',
      'CT/Bronchoscopy/Chest X-ray – Mediastinal mass (LMB occlusion, stent placement)':
        'TC/broncoscopia/radiografía de tórax – Masa mediastínica (oclusión del LMB, colocación de stent)',
      'CT/CBCT Comparison – Atelectasis artifact (with and without ventilation protocol)':
        'Comparación TC/CBCT – Artefacto por atelectasia (con y sin protocolo de ventilación)',
      'CT/CBCT – DTS reconstruction (ART vs prior-aided, registered views)':
        'TC/CBCT – Reconstrucción DTS (ART frente a asistida por imagen previa, vistas registradas)',
      'CT/CBCT – Lung abscess drainage (rEBUS localization, needle placement, follow-up resolution)':
        'TC/CBCT – Drenaje de absceso pulmonar (localización con rEBUS, colocación de aguja, resolución en el seguimiento)',
      'CT/CBCT/EBUS – LLL nodule (CBCT-AF with EBUS-TBB, adenocarcinoma diagnosis)':
        'TC/CBCT/EBUS – Nódulo del LLL (CBCT-AF con EBUS-TBB, diagnóstico de adenocarcinoma)',
      'CT/CXR – Endobronchial Obstruction': 'TC/radiografía de tórax – Obstrucción endobronquial',
      'CT/Chest X-ray Correlation – Intratracheal tumor':
        'Correlación TC/radiografía de tórax – Tumor intratraqueal',
      'CT/Chest X-ray – RMB and carina obstruction (Y-stent placement)':
        'TC/radiografía de tórax – Obstrucción del RMB y la carina (colocación de stent en Y)',
      'CT/Cytology – Mediastinal lymphadenopathy (small cell lung carcinoma, H&E)':
        'TC/citología – Linfadenopatías mediastínicas (carcinoma pulmonar microcítico, H&E)',
      'CT/Cytology – Mediastinal mass with necrosis (EBUS-TBNA adenocarcinoma)':
        'TC/citología – Masa mediastínica con necrosis (adenocarcinoma por EBUS-TBNA)',
      'CT/EBUS/Cytology - Peripheral lesion with ROSE adenocarcinoma and small-cell lung cancer examples':
        'TC/EBUS/citología – Lesión periférica con ejemplos de adenocarcinoma y cáncer pulmonar microcítico en ROSE',
      'CT/Fluoroscopy – Y‑stent implantation': 'TC/fluoroscopia – Implantación de stent en Y',
      'CT/PET - Enlarged right paratracheal lymph node with FDG uptake':
        'TC/PET – Ganglio paratraqueal derecho aumentado de tamaño con captación de FDG',
      'CT/PET Correlation (Post‑Surgery Recurrence Cases)':
        'Correlación TC/PET (casos de recidiva posquirúrgica)',
      'CT/PET – Pulmonary lesion (surgical port mapping)':
        'TC/PET – Lesión pulmonar (mapeo de puertos quirúrgicos)',
      'CT/PET-CT – Chest imaging (multiplanar correlation)':
        'TC/PET-TC – Imagen torácica (correlación multiplanar)',
      'CT/PET/EUS – Superior mediastinal mass (hypermetabolic, endo-oesophageal puncture)':
        'TC/PET/EUS – Masa mediastínica superior (hipermetabólica, punción endoesofágica)',
      'CT/Path Correlation (LUL Endobronchial Mass)':
        'Correlación TC/anatomía patológica (masa endobronquial del LUL)',
      'CT/Path Correlation (Right Paratracheal)':
        'Correlación TC/anatomía patológica (paratraqueal derecha)',
      'CT/Path Correlation (Sarcoid Granuloma)':
        'Correlación TC/anatomía patológica (granuloma sarcoideo)',
      'CT/Pathology – Discordant histology (LUL mass, SCC vs adenosquamous carcinoma)':
        'TC/anatomía patológica – Histología discordante (masa del LUL, SCC frente a carcinoma adenoescamoso)',
      'CT/Pleuroscopy Correlation – Pleural nodules (lung cancer metastasis vs tuberculous pleurisy)':
        'Correlación TC/pleuroscopia – Nódulos pleurales (metástasis de cáncer pulmonar frente a pleuritis tuberculosa)',
      'CT/Spirometry – CAO pre/post stent (flow-volume loops, chemoradiotherapy response)':
        'TC/espirometría – CAO antes/después del stent (bucles flujo-volumen, respuesta a quimiorradioterapia)',
      'CT/Ultrasound/CEUS – Epithelioid mesothelioma (bronchial arterial enhancement, washout)':
        'TC/ecografía/CEUS – Mesotelioma epitelioide (realce arterial bronquial, lavado)',
      'CT/Ultrasound/CEUS – Epithelioid mesothelioma (circular pleural thickening, systemic arterial enhancement)':
        'TC/ecografía/CEUS – Mesotelioma epitelioide (engrosamiento pleural circular, realce arterial sistémico)',
      'CXR/CT – Lobar Obstruction': 'Radiografía de tórax/TC – Obstrucción lobar',
      'Central vs peripheral DVHs': 'DVH centrales frente a periféricos',
      'Chartis Assessment (Patient 1; RUL vs LUL; EIT)':
        'Evaluación Chartis (paciente 1; RUL frente a LUL; EIT)',
      'Chartis Pulmonary Assessment (System & Tracings)':
        'Evaluación pulmonar Chartis (sistema y trazados)',
      'Chest X-ray /CT – RMS endobronchial tumor':
        'Radiografía de tórax/TC – Tumor endobronquial del RMS',
      'Chest X-ray –  Postoperative Lobectom': 'Radiografía de tórax – Lobectomía posoperatoria',
      'Chest X-ray – Coil placement (post-interventional)':
        'Radiografía de tórax – Colocación de coil (posterior a intervención)',
      'Chest X-ray – Edema/effusions resolving after diuresis':
        'Radiografía de tórax – Resolución de edema/derrames después de diuresis',
      'Chest X-ray – Intrathoracic goiter management (ECMO support, ETT positioning, post-extubation)':
        'Radiografía de tórax – Manejo de bocio intratorácico (soporte ECMO, posición del ETT, posterior a extubación)',
      'Chest X-ray – Large left pneumothorax (post-bronchial valve, mediastinal shift)':
        'Radiografía de tórax – Neumotórax izquierdo grande (posterior a válvula bronquial, desviación mediastínica)',
      'Chest X-ray – Left lung atelectasis (pre/post stent for LMB stenosis)':
        'Radiografía de tórax – Atelectasia del pulmón izquierdo (antes/después de stent por estenosis del LMB)',
      'Chest X-ray – Post-chest tube placement (residual loculated pneumothorax)':
        'Radiografía de tórax – Después de colocar tubo torácico (neumotórax loculado residual)',
      'Chest X-ray – Post-valve LUL volume loss (hemothorax, endobronchial valves)':
        'Radiografía de tórax – Pérdida de volumen del LUL posterior a válvulas (hemotórax, válvulas endobronquiales)',
      'Chest X-ray – Postoperative Lobectomy with atelectasis of residual parenchyma':
        'Radiografía de tórax – Lobectomía posoperatoria con atelectasia del parénquima residual',
      'Chest X-ray – Pre-procedure COPD (bronchial valve candidate)':
        'Radiografía de tórax – COPD antes del procedimiento (candidato a válvula bronquial)',
      'Chest X-ray – RLL mass (initial and follow-up with pleural effusion)':
        'Radiografía de tórax – Masa del RLL (inicial y seguimiento con derrame pleural)',
      'Chest X-ray – Stent placement (LLL re-expansion)':
        'Radiografía de tórax – Colocación de stent (reexpansión del LLL)',
      'Chest X-ray – Thoracoscopy pre/post comparison (loculated empyema resolution)':
        'Radiografía de tórax – Comparación antes/después de toracoscopia (resolución de empiema loculado)',
      'Chest X-ray – Tracheal deviation & mediastinal shift':
        'Radiografía de tórax – Desviación traqueal y desplazamiento mediastínico',
      'Chest X-ray – Tracheal shadow (bilateral pulmonary infiltrates)':
        'Radiografía de tórax – Sombra traqueal (infiltrados pulmonares bilaterales)',
      'Chest X-ray/Bronchoscopy – SEMS removal with silicone stent replacement (tracheal stenosis, Grade III)':
        'Radiografía de tórax/broncoscopia – Retirada de SEMS y sustitución por stent de silicona (estenosis traqueal, grado III)',
      'Chest X-ray/CT Timeline – Pneumothorax management (drainage, stent placement, resolution)':
        'Cronología de radiografía de tórax/TC – Manejo de neumotórax (drenaje, colocación de stent, resolución)',
      'Chest X-ray/CT – LMB total occlusion (hilar mass with post-obstructive pneumonia)':
        'Radiografía de tórax/TC – Oclusión total del LMB (masa hiliar con neumonía posobstructiva)',
      'Chest X-ray/CT – Left spontaneous pneumothorax (chest tube, air-fluid level, specimen)':
        'Radiografía de tórax/TC – Neumotórax espontáneo izquierdo (tubo torácico, nivel hidroaéreo, muestra)',
      'Chest X-ray/CT/Bronchoscopy – SEMS removal failure (LMB, embedded stent, Natural stent insertion)':
        'Radiografía de tórax/TC/broncoscopia – Fracaso al retirar SEMS (LMB, stent incrustado, inserción de stent Natural)',
      'Chest X-ray/CT/Pleuroscopy – Precut and cryobiopsy technique (adenocarcinoma with HE staining)':
        'Radiografía de tórax/TC/pleuroscopia – Técnica de precorte y criobiopsia (adenocarcinoma con tinción HE)',
      'Chest X-ray/CT/Pleuroscopy – Precut technique (biphasic mesothelioma biopsy with CAM/HE staining)':
        'Radiografía de tórax/TC/pleuroscopia – Técnica de precorte (biopsia de mesotelioma bifásico con tinciones CAM/HE)',
      'Chest X-ray/CT/Ultrasound – Bilateral GGO (interlobular septal thickening, B-lines, pleural effusion)':
        'Radiografía de tórax/TC/ecografía – GGO bilaterales (engrosamiento septal interlobulillar, líneas B, derrame pleural)',
      'Chest X-ray/CT/Ultrasound – Mediastinal Hodgkin lymphoma (prevascular mass, airway compression, pleural effusion)':
        'Radiografía de tórax/TC/ecografía – Linfoma de Hodgkin mediastínico (masa prevascular, compresión de la vía aérea, derrame pleural)',
      'Classification – Bronchus sign types (CT-BS integrated schematic)':
        'Clasificación – Tipos de signo bronquial (esquema integrado CT-BS)',
      'Clinical Images – Post-operative T-tube insertion':
        'Imágenes clínicas – Inserción posoperatoria de tubo en T',
      'Clinical Images – Tracheostomy stomal ulcer (vertical incision, pre/post healing)':
        'Imágenes clínicas – Úlcera del estoma de traqueostomía (incisión vertical, antes/después de cicatrización)',
      'Combined Airway/Esophageal Stents (TEF; Fluoro‑Guided)':
        'Stents combinados de vía aérea/esófago (TEF; guiados por fluoroscopia)',
      'Confocal Laser Endomicroscopy – Squamous cell carcinoma vs adenocarcinoma (with cytology)':
        'Endomicroscopia confocal con láser – Carcinoma escamoso frente a adenocarcinoma (con citología)',
      'Conventional VAL-MAP technique (step-by-step)': 'Técnica VAL-MAP convencional (paso a paso)',
      'Cribriform tumor structure (H&E 40× and 200×)':
        'Estructura tumoral cribiforme (H&E 40× y 200×)',
      'Cryo Generator (ERBE; First‑Generation)':
        'Generador de crioterapia (ERBE; primera generación)',
      'Cryo Generator (ERBE‑CRYO II)': 'Generador de crioterapia (ERBE-CRYO II)',
      'Cryo-debulking (endoluminal tumor)': 'Reducción tumoral con crioterapia (tumor endoluminal)',
      'Cryotherapy (silicone stent-induced granulation)':
        'Crioterapia (granulación inducida por stent de silicona)',
      'Cryotherapy for polypoid tumors': 'Crioterapia para tumores polipoides',
      'Cumulative dose summation': 'Suma de dosis acumulada',
      'Cytokeratin immunohistochemistry (negative)':
        'Inmunohistoquímica de citoqueratina (negativa)',
      'Cytology - Aspergilloma (Diff-Quik smear and GMS stain)':
        'Citología – Aspergiloma (frotis Diff-Quik y tinción GMS)',
      'Cytology - Carcinoid/neuroendocrine tumor (Pap and H&E cell block)':
        'Citología – Tumor carcinoide/neuroendocrino (Pap y bloque celular H&E)',
      'Cytology - EBUS-TBNA Mycobacterium avium-intracellulare infection in PET-positive lymph node':
        'Citología – Infección por Mycobacterium avium-intracellulare en ganglio PET positivo mediante EBUS-TBNA',
      'Cytology - EBUS-TBNA granuloma in PET-positive lymph node':
        'Citología – Granuloma en ganglio PET positivo mediante EBUS-TBNA',
      'Cytology - EBUS-TBNA metastatic lung adenocarcinoma in PET-positive lymph node':
        'Citología – Adenocarcinoma pulmonar metastásico en ganglio PET positivo mediante EBUS-TBNA',
      'Cytology - EBUS-TBNA metastatic squamous cell carcinoma in PET-positive lymph node':
        'Citología – Carcinoma escamoso metastásico en ganglio PET positivo mediante EBUS-TBNA',
      'Cytology - Granular cell tumor (Diff-Quik, H&E, S100/SOX10)':
        'Citología – Tumor de células granulares (Diff-Quik, H&E, S100/SOX10)',
      'Cytology - Granuloma in lung specimen (Field stain; cryptococcal infection context)':
        'Citología – Granuloma en muestra pulmonar (tinción de Field; contexto de infección criptocócica)',
      'Cytology - Hamartoma (fibromyxoid stroma, adipose tissue, cartilage)':
        'Citología – Hamartoma (estroma fibromixoide, tejido adiposo, cartílago)',
      'Cytology - Lung adenocarcinoma (Diff-Quik, high magnification)':
        'Citología – Adenocarcinoma pulmonar (Diff-Quik, gran aumento)',
      'Cytology - Lung adenocarcinoma (Diff-Quik, very high magnification)':
        'Citología – Adenocarcinoma pulmonar (Diff-Quik, aumento muy alto)',
      'Cytology - Lung adenocarcinoma patterns (Pap and Diff-Quik)':
        'Citología – Patrones de adenocarcinoma pulmonar (Pap y Diff-Quik)',
      'Cytology - Malignant mesothelioma, epithelioid subtype (Pap, H&E, BerEP4/calretinin)':
        'Citología – Mesotelioma maligno, subtipo epitelioide (Pap, H&E, BerEP4/calretinina)',
      'Cytology - Non-small cell carcinoma (FNA)': 'Citología – Carcinoma no microcítico (FNA)',
      'Cytology - ROSE Diff-Quik examples (adenocarcinoma, squamous cell carcinoma, small cell carcinoma, tuberculosis)':
        'Citología – Ejemplos ROSE con Diff-Quik (adenocarcinoma, carcinoma escamoso, carcinoma microcítico, tuberculosis)',
      'Cytology - Sarcoidosis granuloma (Pap and H&E cell block)':
        'Citología – Granuloma por sarcoidosis (Pap y bloque celular H&E)',
      'Cytology - Small cell carcinoma (Pap and H&E cell block)':
        'Citología – Carcinoma microcítico (Pap y bloque celular H&E)',
      'Cytology - Small cell lung cancer (FNA, Field stain)':
        'Citología – Cáncer pulmonar microcítico (FNA, tinción de Field)',
      'Cytology - Squamous cell carcinoma (Pap and H&E cell block)':
        'Citología – Carcinoma escamoso (Pap y bloque celular H&E)',
      'Cytology - Synovial sarcoma (Pap, H&E, Bcl2, FISH)':
        'Citología – Sarcoma sinovial (Pap, H&E, Bcl2, FISH)',
      'Cytology - Tuberculosis granuloma (Pap and H&E cell block)':
        'Citología – Granuloma tuberculoso (Pap y bloque celular H&E)',
      'Cytology - WHO lung cytopathology: insufficient/inadequate specimen':
        'Citología – Citopatología pulmonar de la WHO: muestra insuficiente/inadecuada',
      'Cytology technique - Touch imprint ROSE from cryobiopsy specimen':
        'Técnica citológica – Impronta por contacto para ROSE de muestra de criobiopsia',
      'Cytology – Adenocarcinoma cells (high N/C ratio, TTF1 IHC)':
        'Citología – Células de adenocarcinoma (relación N/C alta, IHQ para TTF1)',
      'Cytology – Aspirated pus (epithelioid cells, lymphocytes, granuloma formation)':
        'Citología – Pus aspirado (células epitelioides, linfocitos, formación de granulomas)',
      'Cytology – EBUS-FNA cell block vs smear (subcarinal metastatic adenocarcinoma)':
        'Citología – Bloque celular frente a frotis de EBUS-FNA (adenocarcinoma metastásico subcarinal)',
      'Cytology – Lymphocytes in aspirated material (H&E)':
        'Citología – Linfocitos en material aspirado (H&E)',
      'Cytology – ROSE classification (Class 3 vs Class 4 cluster density)':
        'Citología – Clasificación ROSE (densidad de grupos de clase 3 frente a clase 4)',
      'Cytology – ROSE from EBUS-FNA (22G Mediglobe needle)':
        'Citología – ROSE de EBUS-FNA (aguja Mediglobe 22G)',
      'Cytology/Histology - False-negative EBUS-FNA from CLL/SLL lymph node':
        'Citología/histología – EBUS-FNA falso negativo de ganglio con CLL/SLL',
      'Cytology/Histology - False-negative EBUS-FNA from metastatic squamous cell carcinoma in lymph node capsule':
        'Citología/histología – EBUS-FNA falso negativo de carcinoma escamoso metastásico en la cápsula ganglionar',
      'Cytology/Histology - Suboptimal EBUS-FNA from classical Hodgkin lymphoma':
        'Citología/histología – EBUS-FNA subóptimo de linfoma de Hodgkin clásico',
      'Cytology/Histology - Suboptimal EBUS-FNA from granulomatous lymphadenitis with hyalinization':
        'Citología/histología – EBUS-FNA subóptimo de linfadenitis granulomatosa con hialinización',
      'Diagram – Automated radiotherapy planning (RatoGuide and RayStation workflow)':
        'Diagrama – Planificación automatizada de radioterapia (flujo de trabajo RatoGuide y RayStation)',
      'Diagram – Breath-hold technique (peak inspiration for intraprocedural imaging)':
        'Diagrama – Técnica de apnea (inspiración máxima para imagen intraprocedimiento)',
      'Diagram – Central airway obstruction types':
        'Diagrama – Tipos de obstrucción de la vía aérea central',
      'Diagram – DTS scan orbits (SE and PL trajectories)':
        'Diagrama – Órbitas de exploración DTS (trayectorias SE y PL)',
      'Diagram – EBUS and EUS (complementary mediastinal lymph node staging)':
        'Diagrama – EBUS y EUS (estadificación complementaria de ganglios mediastínicos)',
      'Diagram – Endobronchial tumor resection (electrocautery snare and RML sleeve lobectomy)':
        'Diagrama – Resección de tumor endobronquial (asa de electrocauterio y lobectomía en manguito del RML)',
      'Diagram – Lung nodule localization (spatial relationship to pleural surface)':
        'Diagrama – Localización de nódulo pulmonar (relación espacial con la superficie pleural)',
      'Diagram – MWA characteristics (ablation zones, oven effect, thermal sink effect)':
        'Diagrama – Características de MWA (zonas de ablación, efecto horno, efecto de disipación térmica)',
      'Diagram – Mediastinal lymph node stations (EUS, EBUS, combination coverage)':
        'Diagrama – Estaciones ganglionares mediastínicas (cobertura con EUS, EBUS y su combinación)',
      'Diagram – Normal vs iSGS trachea (anatomical comparison)':
        'Diagrama – Tráquea normal frente a tráquea con iSGS (comparación anatómica)',
      'Diagram – RATS biportal and uniportal access positioning (schematic)':
        'Diagrama – Posicionamiento de los accesos biportal y uniportal para RATS (esquema)',
      'Diagram – RATS main access positioning (schematic with mini-thoracotomy)':
        'Diagrama – Posicionamiento del acceso principal para RATS (esquema con minitoracotomía)',
      'Diagram – RATS main access positioning (schematic with tunneling)':
        'Diagrama – Posicionamiento del acceso principal para RATS (esquema con tunelización)',
      'Diagram – RATS main access positioning (schematic)':
        'Diagrama – Posicionamiento del acceso principal para RATS (esquema)',
      'Diagram – Robotic bronchoscopy room setup (Monarch, Ion, Galaxy platforms)':
        'Diagrama – Disposición de la sala para broncoscopia robótica (plataformas Monarch, Ion y Galaxy)',
      'Diagram – SSN natural history (seven progression types, growth rate classification)':
        'Diagrama – Historia natural de los SSN (siete tipos de progresión y clasificación por velocidad de crecimiento)',
      'Diagram – Tracheal ring injuries (classification)':
        'Diagrama – Lesiones de los anillos traqueales (clasificación)',
      'Diagram – Tracheostomy puncture deviation measurement (protractor technique)':
        'Diagrama – Medición de la desviación de la punción de traqueostomía (técnica con transportador)',
      'Diagram – VAL-MAP 2.0 workflow (microcoil placement, 3D reconstruction, fluoroscopy-guided resection)':
        'Diagrama – Flujo de trabajo de VAL-MAP 2.0 (colocación de microcoil, reconstrucción 3D y resección guiada por fluoroscopia)',
      'Diagram – VATS technique': 'Diagrama – Técnica de VATS',
      'Diagram – iSGS treatment approaches (dilation, resection, open surgery)':
        'Diagrama – Enfoques terapéuticos para la iSGS (dilatación, resección y cirugía abierta)',
      'Digital Pathology – Quantitative analysis workflow (calibration and threshold measurement)':
        'Patología digital – Flujo de trabajo del análisis cuantitativo (calibración y medición de umbrales)',
      'Direct Laryngoscopy – Subglottic stenosis (0-degree endoscope view)':
        'Laringoscopia directa – Estenosis subglótica (vista con endoscopio de 0 grados)',
      'Double lumen ETT for Y-stent placement (pusher system with monitoring tube)':
        'ETT de doble luz para la colocación de un stent en Y (sistema de empuje con tubo de monitorización)',
      'Double‑Lumen Tube via Stoma': 'Tubo de doble luz a través del estoma',
      'Dynamic stenosis and stent complications (Y-silicone stent, metallic stent, granulation)':
        'Estenosis dinámica y complicaciones de los stents (stent de silicona en Y, stent metálico y granulación)',
      'EBUS thyroid aspiration (poorly differentiated adenocarcinoma, TTF1/CEA/CK7 IHC)':
        'Aspiración tiroidea mediante EBUS (adenocarcinoma poco diferenciado, IHQ para TTF1/CEA/CK7)',
      'EBUS – Mini‑Forceps (Mediastinal Biopsy)': 'EBUS – Minipinzas (biopsia mediastínica)',
      'EBUS-FNA squamous cell carcinoma (H&E, p40 and CK14 IHC)':
        'Carcinoma escamoso por EBUS-FNA (H&E e IHQ para p40 y CK14)',
      'EBUS-TBNA staging - PET-positive lymph node diagnostic flowchart':
        'Estadificación mediante EBUS-TBNA: diagrama de flujo diagnóstico de un ganglio PET positivo',
      'EBUS-TBNA – Lymph node aspiration (pus drainage)':
        'EBUS-TBNA – Aspiración ganglionar (drenaje de pus)',
      'EBUS-TBNA – Subcarinal lymph node (sarcoidosis granuloma, color Doppler, ROSE correlation)':
        'EBUS-TBNA – Ganglio subcarinal (granuloma sarcoideo, Doppler color y correlación con ROSE)',
      'EBUS/CT Registration – Station 4L nodes (segmented ROI, virtual EBUS views)':
        'Registro EBUS/TC – Ganglios de la estación 4L (ROI segmentada y vistas virtuales de EBUS)',
      'EBUS/CT Registration – Station-10 lymph node (segmentation and ROI correlation)':
        'Registro EBUS/TC – Ganglio de la estación 10 (segmentación y correlación de la ROI)',
      'EBUS/CT/PET Correlation – Image-guided navigation (4R lymph node with 3D rendering)':
        'Correlación EBUS/TC/PET – Navegación guiada por imagen (ganglio 4R con renderizado 3D)',
      'EBUS/CT/PET Correlation – Transvascular EBUS-TBNA (interlobar lymph node and RUL nodule)':
        'Correlación EBUS/TC/PET – EBUS-TBNA transvascular (ganglio interlobar y nódulo del RUL)',
      'EBUS/EUS': 'EBUS/EUS',
      'EBUS/EUS – Combined station access map': 'EBUS/EUS – Mapa combinado de acceso a estaciones',
      'EBUS/EUS‑B – CT/PET/Path Correlation (Adenocarcinoma)':
        'EBUS/EUS-B – Correlación TC/PET/anatomía patológica (adenocarcinoma)',
      'EBUS/PET/CT Correlation – Image-guided navigation (4R lymph node, registered views)':
        'Correlación EBUS/PET/TC – Navegación guiada por imagen (ganglio 4R, vistas registradas)',
      'EBUS‑TBNA – Peripheral nodules (left lung)':
        'EBUS-TBNA – Nódulos periféricos (pulmón izquierdo)',
      'EBUS‑TBNA – Peripheral nodules (right lung)':
        'EBUS-TBNA – Nódulos periféricos (pulmón derecho)',
      'EIT/CT Correlation – BLVR perfusion distributions (balloon vs valves, left hemithorax)':
        'Correlación EIT/TC – Distribuciones de perfusión tras BLVR (balón frente a válvulas, hemitórax izquierdo)',
      'ENB (4D) – Multiplanar CT + Real‑Time Sampling':
        'ENB (4D) – TC multiplanar y muestreo en tiempo real',
      'ENB – CBCT Assistance (ICG Marking; Hybrid OR)':
        'ENB – Asistencia con CBCT (marcación con ICG; quirófano híbrido)',
      'ENB – CBCT‑Guided MWA (Devices & Steps)': 'ENB – MWA guiada por CBCT (dispositivos y pasos)',
      'ENB – Edge Catheter (EWC SD180EWCTE‑FT)': 'ENB – Catéter Edge (EWC SD180EWCTE-FT)',
      'ENB – Equipment (Therapeutic Scope + EWC + Cryoprobe)':
        'ENB – Equipo (broncoscopio terapéutico + EWC + criosonda)',
      'ENB – GGO Dye Marking (3D Recon + ENB Screen)':
        'ENB – Marcación con colorante de GGO (reconstrucción 3D + pantalla de ENB)',
      'ENB – Illumisite (Fluoroscopic Navigation Set)':
        'ENB – Illumisite (sistema de navegación fluoroscópica)',
      'ENB – Pleural Dye Marking (Workflow)':
        'ENB – Marcación pleural con colorante (flujo de trabajo)',
      'ENB – SuperDimension (Case 1 Mapping)': 'ENB – SuperDimension (mapeo del caso 1)',
      'ENB – SuperDimension (Case 2 Mapping)': 'ENB – SuperDimension (mapeo del caso 2)',
      'ENB – SuperDimension (Virtual Proximity at Target)': 'ENB – Proximidad virtual al objetivo',
      'ENB – Virtual-assisted lung mapping (LG catheter, indigo carmine injection sequence)':
        'ENB – Mapeo pulmonar asistido virtualmente (catéter LG, secuencia de inyección de índigo carmín)',
      'ENB – “Artery Sign” Pathway Planning':
        'ENB – Planificación de la trayectoria mediante el «signo de la arteria»',
      'EUS – Aortopulmonary Window (Landmark View)':
        'EUS – Ventana aortopulmonar (vista de referencia anatómica)',
      'EUS – Elastography (lung cancer evaluation)':
        'EUS – Elastografía (evaluación del cáncer de pulmón)',
      'EUS – Left adrenal mass (sliding view, needle placement)':
        'EUS – Masa suprarrenal izquierda (vista deslizante y colocación de la aguja)',
      'EUS – Lymph Nodes (Benign vs Malignant Patterns)':
        'EUS – Ganglios linfáticos (patrones benignos frente a malignos)',
      'EUS – Mediastinal Lymph Node (Breast Cancer Metastasis)':
        'EUS – Ganglio mediastínico (metástasis de cáncer de mama)',
      'EUS – Mediastinal Lymph Node (Sarcoidosis)': 'EUS – Ganglio mediastínico (sarcoidosis)',
      'EUS – Subcarinal Lymph Node (Diameter 21.4 mm)':
        'EUS – Ganglio subcarinal (diámetro de 21.4 mm)',
      'EUS – Thoracic Aorta (Mirror Image Artifact)':
        'EUS – Aorta torácica (artefacto en imagen especular)',
      'EUS/CT – Pulmonary embolism (right main pulmonary artery)':
        'EUS/TC – Embolia pulmonar (arteria pulmonar principal derecha)',
      'EUS‑B – FNA Findings (Left Atrium Invasion)':
        'EUS-B – Hallazgos de FNA (invasión de la aurícula izquierda)',
      'EUS‑B – Fujifilm (Landmarks)': 'EUS-B – Fujifilm (referencias anatómicas)',
      'Early Endobronchial Lesion (Silver Hue)':
        'Lesión endobronquial temprana (tonalidad plateada)',
      'Early squamous cell carcinoma (central airways)':
        'Carcinoma escamoso temprano (vías aéreas centrales)',
      'Elastography (Type 1–3 Examples)': 'Elastografía (ejemplos de los tipos 1–3)',
      'Elastography (subcarinal lymph node with lung adenocarcinoma)':
        'Elastografía (ganglio subcarinal con adenocarcinoma pulmonar)',
      'Elastography Types (inflammation vs small cell carcinoma with ROSE correlation)':
        'Tipos de elastografía (inflamación frente a carcinoma microcítico con correlación de ROSE)',
      'Electrosurgery (grounding plate, probe, snare, power unit with pedal)':
        'Electrocirugía (placa de retorno, sonda, asa y unidad de potencia con pedal)',
      'Endobronchial Mass (Tracheal Lesion at Presentation)':
        'Masa endobronquial (lesión traqueal en la presentación inicial)',
      'Endobronchial hamartoma (core-out and cryotherapy sequence)':
        'Hamartoma endobronquial (secuencia de extracción central y crioterapia)',
      'Endobronchial leiomyoma (LMB obstruction, EC snare/cryo debulking)':
        'Leiomioma endobronquial (obstrucción del LMB, reducción de volumen con asa de EC/crio)',
      'Endobronchial lipoma (cryorecanalization sequence)':
        'Lipoma endobronquial (secuencia de recanalización con crio)',
      'Endobronchial lipoma (mature adipose tissue with mucoid changes, H&E)':
        'Lipoma endobronquial (tejido adiposo maduro con cambios mucoides, H&E)',
      'Endobronchial mucous adenoma (treatment timeline with histology)':
        'Adenoma mucoso endobronquial (cronología del tratamiento con histología)',
      'Endobronchial tumor (middle lobe, pre/post resection)':
        'Tumor endobronquial (lóbulo medio, antes y después de la resección)',
      'Endobronchial tumor (polypoid lesion, H&E with myxoid stroma)':
        'Tumor endobronquial (lesión polipoide, H&E con estroma mixoide)',
      'Endobronchial tumor (pre- and post-ablation biopsy comparison, H&E)':
        'Tumor endobronquial (comparación de biopsias antes y después de la ablación, H&E)',
      'Endoluminal Carcinoid (Resection Correlation)':
        'Carcinoide endoluminal (correlación con la resección)',
      'Endometriosis (Visceral and Parietal; Lesion Types)':
        'Endometriosis (visceral y parietal; tipos de lesión)',
      Equipment: 'Equipo',
      'Esophageal Stent Migration (Relocation Under Fluoro)':
        'Migración de stent esofágico (reposicionamiento bajo fluoroscopia)',
      'Extrinsic CAO (silicone Y-stent for airway recanalization)':
        'CAO extrínseca (stent de silicona en Y para recanalización de la vía aérea)',
      'Extrinsic Compression (Example 1)': 'Compresión extrínseca (ejemplo 1)',
      'Extrinsic Compression (Goiter; Pre/Post‑Op)':
        'Compresión extrínseca (bocio; antes y después de la operación)',
      'FFOCT-DCI – Technique description (high-resolution 3D biopsy imaging)':
        'FFOCT-DCI – Descripción de la técnica (imagen 3D de biopsia de alta resolución)',
      'FOT placement above stenosis (rigid scope insertion with cuff)':
        'Colocación de FOT por encima de la estenosis (inserción de broncoscopio rígido con manguito)',
      'FOT placement for carinal obstruction (cuff inflation technique)':
        'Colocación de FOT para obstrucción carinal (técnica de inflado del manguito)',
      'Fibroepithelial tumor (LUL superior segment, pre/post treatment)':
        'Tumor fibroepitelial (segmento superior del LUL, antes y después del tratamiento)',
      'Fibrotic Stenosis (Left Main Bronchus)':
        'Estenosis fibrótica (bronquio principal izquierdo)',
      'Fluid Aspiration (Clear Yellow)': 'Aspiración de líquido (amarillo claro)',
      'Fluoroscopy – Bilateral SEMS placement (side-by-side method, step-by-step)':
        'Fluoroscopia – Colocación bilateral de SEMS (método lado a lado, paso a paso)',
      'Fluoroscopy – ICG‑Soaked Coil Deployment':
        'Fluoroscopia – Despliegue de coil impregnado con ICG',
      'Fluoroscopy – Transbronchial biopsy techniques (ultrathin vs thin bronchoscope with guide sheath)':
        'Fluoroscopia – Técnicas de biopsia transbronquial (broncoscopio ultrafino frente a fino con vaina guía)',
      'Fluoroscopy – rEBUS guidance': 'Fluoroscopia – Guía con rEBUS',
      'Fluoroscopy/CBCT – Multimodal navigation (RAB tool-in-lesion confirmation)':
        'Fluoroscopia/CBCT – Navegación multimodal (confirmación de la herramienta de RAB dentro de la lesión)',
      'Fluoroscopy/Chest X-ray – Visicoil fiducial markers (triangulated pattern, augmented fluoroscopy)':
        'Fluoroscopia/radiografía de tórax – Marcadores fiduciales Visicoil (patrón triangulado, fluoroscopia aumentada)',
      'Fluoroscopy/Pathology – Lung nodule resection confirmation (ICG-coil marker, specimen)':
        'Fluoroscopia/anatomía patológica – Confirmación de la resección de un nódulo pulmonar (marcador coil-ICG y espécimen)',
      'Fogarty Balloon (Hemoptysis Control)': 'Balón de Fogarty (control de la hemoptisis)',
      'Foreign Bodies – Tracheobronchial specimens (dental device, nail, coin, grape)':
        'Cuerpos extraños – Especímenes traqueobronquiales (dispositivo dental, clavo, moneda y uva)',
      'Foreign Body Removal (Examples)': 'Extracción de cuerpos extraños (ejemplos)',
      'Foreign body removal (intermediate bronchus, granulation cautery, basket/forceps techniques)':
        'Extracción de cuerpo extraño (bronquio intermedio, cauterización de granulación y técnicas con cesta/pinzas)',
      'Forensics – Tracheal ring injuries (autopsy)':
        'Medicina forense – Lesiones de los anillos traqueales (autopsia)',
      'Galaxy System (C-arm with TiLT tomosynthesis technology)':
        'Sistema Galaxy (arco en C con tecnología de tomosíntesis TiLT)',
      'Granulation Tissue (Distal to Stent)': 'Tejido de granulación (distal al stent)',
      'Granulation Tissue (Proximal to Stent)': 'Tejido de granulación (proximal al stent)',
      'HFJV devices': 'Dispositivos de HFJV',
      'HRCT fissure assessment (visual)': 'Evaluación visual de las cisuras mediante HRCT',
      'High-flow nasal oxygen (uses and contraindications)':
        'Oxígeno nasal de alto flujo (usos y contraindicaciones)',
      'Hybrid OR – CBCT System (Ceiling‑Mounted)':
        'Quirófano híbrido – Sistema de CBCT (montado en el techo)',
      'Hybrid OR – CBCT‑guided bronchoscopy setup':
        'Quirófano híbrido – Configuración de broncoscopia guiada por CBCT',
      'Hybrid OR – Mobile CBCT (Cios Spin) setup':
        'Quirófano híbrido – Configuración de CBCT móvil (Cios Spin)',
      'IR – Bronchial artery embolization for hemoptysis':
        'Radiología intervencionista – Embolización de la arteria bronquial por hemoptisis',
      'Illumisite (Fluoro Navigation + Tomosynthesis)':
        'Illumisite (navegación fluoroscópica + tomosíntesis)',
      'Image Processing – Registration algorithm comparison (MSE, MoMSE, improved MoMSE)':
        'Procesamiento de imágenes – Comparación de algoritmos de registro (MSE, MoMSE y MoMSE mejorado)',
      Imaging: 'Imagen',
      'Immunohistochemistry panel (CD20, Ki67, Bcl-2, TdT)':
        'Panel de inmunohistoquímica (CD20, Ki67, Bcl-2, TdT)',
      'Instrumentation – CoreCath 2.7S (Multimodal Debulking)':
        'Instrumentación – CoreCath 2.7S (reducción de volumen multimodal)',
      'Instrumentation – Crown‑Cut Tip Needle':
        'Instrumentación – Aguja con punta de corte en corona',
      'Instrumentation – Nodule Marking Kit (ICG/Guidewire/Brush/Coil)':
        'Instrumentación – Kit de marcación de nódulos (ICG/guía/cepillo/coil)',
      'Instrumentation – Olympus Accessories (Forceps, Guide Sheath)':
        'Instrumentación – Accesorios Olympus (pinzas y vaina guía)',
      'Integrated bronchoscope (video camera and 2D transducer, axes diagram)':
        'Broncoscopio integrado (videocámara y transductor 2D, diagrama de ejes)',
      'Intraoperative Imaging – ICG dye localization (VATS with fiducial marker)':
        'Imagen intraoperatoria – Localización con colorante ICG (VATS con marcador fiducial)',
      'Intraoperative Imaging – NIR fluorescence with ICG (Firefly mode vs white-light)':
        'Imagen intraoperatoria – Fluorescencia NIR con ICG (modo Firefly frente a luz blanca)',
      'Kaposi Sarcoma (Forceps vs Cryobiopsy vs FNA)':
        'Sarcoma de Kaposi (pinzas frente a criobiopsia frente a FNA)',
      'LMB occlusion management (microdebrider debulking, APC, stent placement)':
        'Tratamiento de la oclusión del LMB (reducción de volumen con microdesbridador, APC y colocación de stent)',
      'LMB stenosis (nitinol stent, 7-year follow-up)':
        'Estenosis del LMB (stent de nitinol, seguimiento a 7 años)',
      'Laser Console': 'Consola láser',
      'Laser coagulation (distal trachea SCC, Nd:YAG)':
        'Coagulación con láser (SCC de la tráquea distal, Nd:YAG)',
      'Laser tube (double cuff, laser guard foil) and rigid bronchoscopy ventilation challenge':
        'Tubo láser (doble manguito y lámina protectora contra láser) y reto de ventilación durante broncoscopia rígida',
      'Laser tube positioning (RMB anatomy)': 'Posicionamiento del tubo láser (anatomía del RMB)',
      'LaserJet catheter (dual lumen for gas delivery and pressure monitoring)':
        'Catéter LaserJet (doble luz para suministro de gas y monitorización de la presión)',
      'Laser–Stent Therapy for CAO': 'Tratamiento con láser y stent para CAO',
      'Lateral Puncture Risks (Force Vectors)':
        'Riesgos de la punción lateral (vectores de fuerza)',
      'Localization – CBCT‑assisted ENB marking':
        'Localización – Marcación por ENB asistida por CBCT',
      'Localization – Hookwire (CBCT‑guided)':
        'Localización – Alambre con gancho (guiado por CBCT)',
      'Localization – Lipiodol (CT‑guided)': 'Localización – Lipiodol (guiada por TC)',
      'Localization – Steel needle (CT‑guided)': 'Localización – Aguja de acero (guiada por TC)',
      'Localization – VNB‑guided ICG fluorescence':
        'Localización – Fluorescencia con ICG guiada por VNB',
      'Lung cryobiopsy (H&E and ex-vivo confocal microscopy)':
        'Criobiopsia pulmonar (H&E y microscopía confocal ex vivo)',
      'Lungpro-assisted metallic marker localization':
        'Localización de marcador metálico asistida por Lungpro',
      'Lymph Node Aspiration (Cytology/Granulomas)': 'Aspiración ganglionar (citología/granulomas)',
      'Lymph node squamous cell carcinoma (H&E low magnification)':
        'Carcinoma escamoso ganglionar (H&E a bajo aumento)',
      'MAO bilateral main bronchi (pre/post therapy, Y-stent)':
        'MAO de ambos bronquios principales (antes/después del tratamiento, stent en Y)',
      'MRI‑guided SBRT vs ITV planning': 'SBRT guiada por MRI frente a planificación con ITV',
      'MWA Inside Silicone Stent (Ball‑Valve Tumor)':
        'MWA dentro de un stent de silicona (tumor con mecanismo de válvula de bola)',
      'Magnetic Navigation – Pulmonary nodule localization (RUL, methylene blue, thoracoscopic verification)':
        'Navegación magnética – Localización de nódulo pulmonar (RUL, azul de metileno y verificación toracoscópica)',
      'Malignant mesothelioma (epithelioid and sarcomatoid, WT1 and calretinin IHC)':
        'Mesotelioma maligno (epitelioide y sarcomatoide, IHC para WT1 y calretinina)',
      'Manual vs automated pathways (RB8 nodule with REBUS confirmation)':
        'Trayectorias manuales frente a automatizadas (nódulo RB8 con confirmación mediante REBUS)',
      'Marking coil and ICG loading kit': 'Kit de carga de coil de marcación e ICG',
      'Mediastinitis with Tracheal Fistula Drainage':
        'Mediastinitis con drenaje de fístula traqueal',
      'Medical Thoracoscopy – Cryobiopsy (Peripheral Tumor)':
        'Toracoscopia médica – Criobiopsia (tumor periférico)',
      'Medical Thoracoscopy – Precut Biopsy (Stepwise)':
        'Toracoscopia médica – Biopsia con precorte (paso a paso)',
      'Metallic airway stent (main body, RUB, RMB branches)':
        'Stent metálico de vía aérea (cuerpo principal y ramas RUB y RMB)',
      'Microwave Ablation (LMS Tumor)': 'Ablación por microondas (tumor del LMS)',
      'Mini‑Open (Marks and Final Appearance)': 'Miniabordaje abierto (marcas y aspecto final)',
      Miscellaneous: 'Varios',
      'Mixed CAO (cryo-debulking and stent placement)':
        'CAO mixta (reducción de volumen con crio y colocación de stent)',
      'Mixed CAO Resected (Airway Restored)': 'CAO mixta resecada (vía aérea restaurada)',
      'Modified Y stent placement (bronchiectasis, occluded LUL branch)':
        'Colocación de stent en Y modificado (bronquiectasias, rama del LUL ocluida)',
      'Modified blade device (cylindrical handle with blade holder for bronchoscopy)':
        'Dispositivo de hoja modificado (mango cilíndrico con portacuchillas para broncoscopia)',
      'Modified silicone Y stent removal (post-tuberculous destroyed lung)':
        'Retirada de stent de silicona en Y modificado (pulmón destruido postuberculoso)',
      'Modified silicone stent design (main, lateral, and occluded branches with rings)':
        'Diseño modificado de stent de silicona (ramas principal, lateral y ocluida con anillos)',
      'Monarch system interface (conventional and virtual bronchoscopic pathways)':
        'Interfaz del sistema Monarch (trayectorias broncoscópicas convencional y virtual)',
      'Montgomery T-tube placement (subglottic stenosis, pre/post)':
        'Colocación de tubo en T de Montgomery (estenosis subglótica, antes/después)',
      'Multimodal CAO management (carinal SCC, laser, Y stent, radiation)':
        'Tratamiento multimodal de la CAO (SCC carinal, láser, stent en Y y radiación)',
      'Multimodal MCAO management (bilateral stent placement with spray cryotherapy)':
        'Tratamiento multimodal de la MCAO (colocación bilateral de stents con crioterapia por pulverización)',
      'Multimodal bronchoscope views (real vs virtual EBUS/video diagram)':
        'Vistas multimodales del broncoscopio (diagrama de EBUS/vídeo real frente a virtual)',
      'Multiple lung nodules (AIS, MIA, chronic inflammation, H&E)':
        'Múltiples nódulos pulmonares (AIS, MIA, inflamación crónica, H&E)',
      'NIV mask with bronchoscope entry port':
        'Mascarilla de NIV con puerto de entrada para broncoscopio',
      'NTM cavities pre/post valve': 'Cavidades por NTM antes/después de la válvula',
      'Needle Insertion into Target Mass': 'Inserción de la aguja en la masa objetivo',
      'Neoplasia in airway stent (endoscopic resection sequence)':
        'Neoplasia en stent de vía aérea (secuencia de resección endoscópica)',
      'Nuclear Medicine – Lung perfusion scintigraphy':
        'Medicina nuclear – Gammagrafía de perfusión pulmonar',
      'Olympus Exera III tower (bronchoscopes and processors)':
        'Torre Olympus Exera III (broncoscopios y procesadores)',
      'PDT (Early Lung Cancer; Fiber Alongside Lesion)':
        'PDT (cáncer de pulmón temprano; fibra junto a la lesión)',
      'PET – LLL mass': 'PET – Masa del LLL',
      'PET – Pulmonary Nodule': 'PET – Nódulo pulmonar',
      'PET-CT – Abnormal cartilage metabolism (thyroid, tracheal, rib cartilage)':
        'PET-TC – Metabolismo anómalo del cartílago (cartílagos tiroideo, traqueal y costal)',
      'PET/CT/Clinical – Mediastinal mass with tracheal compression (Ultraflex stent deployment, post-CTA)':
        'PET/TC/clínica – Masa mediastínica con compresión traqueal (despliegue de stent Ultraflex, después de CTA)',
      'PLCH vs HP (fibromyxoid foci and interstitial fibrosis)':
        'PLCH frente a HP (focos fibromixoides y fibrosis intersticial)',
      'Paratracheal tumor excision (covered stent with balloon dilation)':
        'Escisión de tumor paratraqueal (stent recubierto con dilatación con balón)',
      'Path Correlation (Malignant Mass Adjacent to Aorta)':
        'Correlación anatomopatológica (masa maligna adyacente a la aorta)',
      Pathology: 'Anatomía patológica',
      'Patient Positioning (Thoracoscopy)': 'Posicionamiento del paciente (toracoscopia)',
      'Percutaneous Dilatational Technique (Ciaglia)': 'Técnica de dilatación percutánea (Ciaglia)',
      'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)':
        'Broncoscopia periférica (navegación/robótica/imagen intraprocedimiento)',
      'Physiology – Mechanisms of Atelectasis & Resistance (Diagram)':
        'Fisiología – Mecanismos de atelectasia y resistencia (diagrama)',
      'Pleura/Vascular Tumor – CT/MR & pathology':
        'Tumor pleural/vascular – TC/MR y anatomía patológica',
      'Pleural Cryobiopsy vs Forceps (Tissue Integrity/Size)':
        'Criobiopsia pleural frente a pinzas (integridad/tamaño del tejido)',
      'Pleural Endometriosis with Stromal Invasion': 'Endometriosis pleural con invasión estromal',
      'Pleural Procedures': 'Procedimientos Pleurales',
      'Pleuropulmonary blastoma (chondrosarcoma, glandular and blastemal components, H&E)':
        'Blastoma pleuropulmonar (componentes condrosarcomatoso, glandular y blastematoso, H&E)',
      'Pleuroscopy Equipment – Conventional vs new pleuroscope comparison (biopsy forceps positioning)':
        'Equipo de pleuroscopia – Comparación del pleuroscopio convencional frente al nuevo (posición de las pinzas de biopsia)',
      'Pleuroscopy Equipment – Diameter comparison (LTF-240 vs LTF-Y0032)':
        'Equipo de pleuroscopia – Comparación de diámetros (LTF-240 frente a LTF-Y0032)',
      "Pleuroscopy instruments (semirigid scope, forceps, Abram's needle, cryoprobe)":
        'Instrumentos de pleuroscopia (endoscopio semirrígido, pinzas, aguja de Abrams y criosonda)',
      'Pleuroscopy – Biphasic mesothelioma and pleural metastasis (LTF-Y0032 with 180° curvature)':
        'Pleuroscopia – Mesotelioma bifásico y metástasis pleural (LTF-Y0032 con curvatura de 180°)',
      'Pleuroscopy – Empyema (thick loculated with fibrin membrane)':
        'Pleuroscopia – Empiema (loculaciones espesas con membrana de fibrina)',
      'Pleuroscopy – Lesion distribution map (visceral and parietal locations by segments)':
        'Pleuroscopia – Mapa de distribución de lesiones (ubicaciones viscerales y parietales por segmentos)',
      'Pleuroscopy – Malignant mesothelioma and lymphoma (NBI with vascular patterns)':
        'Pleuroscopia – Mesotelioma maligno y linfoma (NBI con patrones vasculares)',
      'Pleuroscopy/Bronchoscopy – Pleural adhesions and whitish mass (right bronchus intermedius)':
        'Pleuroscopia/broncoscopia – Adherencias pleurales y masa blanquecina (bronquio intermedio derecho)',
      'Pleuroscopy/Pathology – Normal parietal pleura pCLE features (chia seed sign, H&E correlation)':
        'Pleuroscopia/anatomía patológica – Características de la pleura parietal normal en pCLE (signo de semillas de chía, correlación con H&E)',
      'Pleuroscopy/Pathology – pCLE features (pleural metastasis with H&E correlation)':
        'Pleuroscopia/anatomía patológica – Características en pCLE (metástasis pleural con correlación H&E)',
      'Polypoid lesion (RMB vascularized tumor)': 'Lesión polipoide (tumor vascularizado del RMB)',
      'Postoperative timeline (pre-op to 3.5 years)':
        'Cronología posoperatoria (desde el preoperatorio hasta 3.5 años)',
      'Post‑PDT Debris (Bronchoscopic View)': 'Detritos posteriores a PDT (vista broncoscópica)',
      'Post‑Transplant Airway Complication Types':
        'Tipos de complicaciones de la vía aérea después del trasplante',
      'Post‑Transplant Hyperinflation (Patient 2; EIT+Chartis)':
        'Hiperinsuflación posterior al trasplante (paciente 2; EIT + Chartis)',
      'Post‑transplant – Stent for anastomotic dehiscence':
        'Después del trasplante – Stent para dehiscencia anastomótica',
      'Precut Step‑Up Biopsy Strategy (Schematic)':
        'Estrategia de biopsia escalonada con precorte (esquema)',
      'Predicted vs deliverable dose (DSC)': 'Dosis prevista frente a dosis administrable (DSC)',
      'Probe model (device tip and 2D fan-shaped view diagram)':
        'Modelo de sonda (punta del dispositivo y diagrama de vista 2D en abanico)',
      'Procedure – Guidewire positioning (14G IV catheter insertion)':
        'Procedimiento – Posicionamiento de la guía (inserción de catéter IV de 14G)',
      'Procedure – Sheath-free Amplatzer device deployment method (guide wire technique)':
        'Procedimiento – Método de despliegue sin vaina del dispositivo Amplatzer (técnica con guía)',
      'Procedure – Tracheostomy Ciaglia method (dilation and cannula insertion)':
        'Procedimiento – Método de Ciaglia para traqueostomía (dilatación e inserción de cánula)',
      'Procedure – Tracheostomy anatomical landmarks (fiberoptic guidance, depth marking, puncture angle)':
        'Procedimiento – Referencias anatómicas para traqueostomía (guía fibroóptica, marcación de profundidad y ángulo de punción)',
      'Protocol – Breath‑Hold Timing & Hemodynamics': 'Protocolo – Tiempo de apnea y hemodinámica',
      'Protocol – Ventilation (Recruitment / PEEP / “40 for 40” Note)':
        'Protocolo – Ventilación (reclutamiento/PEEP/nota «40 por 40»)',
      'Prototype CP-EBUS with electromagnetic sensor':
        'Prototipo de CP-EBUS con sensor electromagnético',
      'Purulent Aspiration (Gauge 19)': 'Aspiración purulenta (calibre 19)',
      'RAB – First‑pass peripheral sampling': 'RAB – Muestreo periférico en el primer pase',
      'RAB – Integrated multimodal monitors': 'RAB – Monitores multimodales integrados',
      'RAB – Ion platform': 'RAB – Plataforma Ion',
      'RAB – Microwave ablation platforms': 'RAB – Plataformas de ablación por microondas',
      'RAB – Monarch platform': 'RAB – Plataforma Monarch',
      'RAB – Navigation alignment (no rEBUS)': 'RAB – Alineación de la navegación (sin rEBUS)',
      'RATS – Azygos vein exposure': 'RATS – Exposición de la vena ácigos',
      'RATS – Dual‑port mapping': 'RATS – Mapeo de doble puerto',
      'RATS – Post‑azygos division': 'RATS – Después de la división de la vena ácigos',
      'RFID marker placement (wedge resection steps)':
        'Colocación de marcador RFID (pasos de la resección en cuña)',
      'ROSE/Pathology Comparison – Forceps vs cryobiopsy (metastatic urothelial carcinoma and adenocarcinoma)':
        'Comparación ROSE/anatomía patológica – Pinzas frente a criobiopsia (carcinoma urotelial metastásico y adenocarcinoma)',
      'Radial ultrasound probes (UM-S20-17S and UM-S20-20R-3)':
        'Sondas de ecografía radial (UM-S20-17S y UM-S20-20R-3)',
      'Radiation Protection – Operator shielding': 'Protección radiológica – Blindaje del operador',
      'Radiation shielding setup (lead-equivalent plate and curtain for operators)':
        'Configuración del blindaje radiológico (placa y cortina con equivalencia de plomo para los operadores)',
      Radiotherapy: 'Radioterapia',
      'Radiotherapy – IMRT vs VMAT comparison (66 Gy, dose-volume histogram)':
        'Radioterapia – Comparación de IMRT frente a VMAT (66 Gy, histograma dosis-volumen)',
      'Recanalization Post‑Procedure (Trachea)':
        'Recanalización después del procedimiento (tráquea)',
      'Rigid Bronchoscopy – Laser/Device Positioning':
        'Broncoscopia rígida – Posicionamiento del láser/dispositivo',
      'Rigid Bronchoscopy – Mechanical Debulking (Tip of Scope)':
        'Broncoscopia rígida – Reducción mecánica de volumen (punta del broncoscopio)',
      'Rigid Bronchoscopy – Microdebrider (Rotating Tip)':
        'Broncoscopia rígida – Microdesbridador (punta rotatoria)',
      'Rigid Bronchoscopy – Radial Incisions (Blade; 4/8/12 o’clock)':
        'Broncoscopia rígida – Incisiones radiales (hoja; posiciones de las 4/8/12 en punto)',
      'Rigid Bronchoscopy – Subglottic Stenosis (Severe; Pre‑Treatment)':
        'Broncoscopia rígida – Estenosis subglótica (grave; antes del tratamiento)',
      'Rigid Bronchoscopy – Ventilation via Side Port':
        'Broncoscopia rígida – Ventilación a través del puerto lateral',
      'Rigid bronchoscope (shaft with fenestration, multifunction head components)':
        'Broncoscopio rígido (tubo con fenestración y componentes del cabezal multifunción)',
      'Rigid bronchoscope and suction catheter (carina level)':
        'Broncoscopio rígido y catéter de aspiración (a nivel de la carina)',
      'Rigid bronchoscope marking (intubation length measurement)':
        'Marcación del broncoscopio rígido (medición de la longitud de intubación)',
      'Rigid bronchoscope tools (Karl Storz system, various lengths and instruments)':
        'Instrumentos de broncoscopia rígida (sistema Karl Storz, diversas longitudes e instrumentos)',
      'Rigid suction catheter setup (three-way stopcock and gas analyzer)':
        'Configuración de catéter rígido de aspiración (llave de tres vías y analizador de gases)',
      'Rigid suction catheter with gas analyzer connection':
        'Catéter rígido de aspiración conectado a un analizador de gases',
      'Robotic Bronchoscopy – Navigation platforms (Monarch, Ion, Galaxy with TILT technology)':
        'Broncoscopia robótica – Plataformas de navegación (Monarch, Ion y Galaxy con tecnología TILT)',
      'Robotic CBCT bronchoscope setup (designed bracket)':
        'Configuración robótica de broncoscopio con CBCT (soporte diseñado a medida)',
      'Robotic bronchoscopy interface (real-time and virtual bronchoscopic views)':
        'Interfaz de broncoscopia robótica (vistas broncoscópicas en tiempo real y virtual)',
      'Robotic system interface (real-time scope view, RUL nodule pathway)':
        'Interfaz del sistema robótico (vista del broncoscopio en tiempo real y trayectoria hacia un nódulo del RUL)',
      'Robotic – CBCT Collision Awareness (Alignment)':
        'Robótica – Detección de riesgo de colisión con CBCT (alineación)',
      'Robotic – Catheter Display with Distance Metrics':
        'Robótica – Visualización del catéter con métricas de distancia',
      'Robotic – Controller Interfaces (Ion/Monarch/Galaxy)':
        'Robótica – Interfaces de control (Ion/Monarch/Galaxy)',
      'Robotic – Floor Plan (Hybrid OR Layout)':
        'Robótica – Plano de la sala (disposición del quirófano híbrido)',
      'Robotic – Hybrid OR Workflow (Team & Screens)':
        'Robótica – Flujo de trabajo en quirófano híbrido (equipo y pantallas)',
      'Robotic – Ion + CBCT (Multiplanar Tool‑in‑Lesion)':
        'Robótica – Ion + CBCT (herramienta dentro de la lesión en vistas multiplanares)',
      'Robotic – Monarch (Multiscreen Panels)': 'Robótica – Monarch (paneles multipantalla)',
      'Robotic – Monarch + CBCT in Hybrid OR': 'Robótica – Monarch + CBCT en quirófano híbrido',
      'Robotic – Multisource Display (Fluoro/EBUS/CT)':
        'Robótica – Visualización multifuente (fluoroscopia/EBUS/TC)',
      'Robotic – Needle Aspiration (Tool Exit Orientation)':
        'Robótica – Aspiración con aguja (orientación de salida de la herramienta)',
      'Robotic – REBUS Patterns (Eccentric → Concentric)':
        'Robótica – Patrones de REBUS (excéntrico → concéntrico)',
      'Robotic – REBUS Target Relationship (Probe Orientation)':
        'Robótica – Relación entre REBUS y el objetivo (orientación de la sonda)',
      'Robotic – Registration Steps (Ion Example)':
        'Robótica – Pasos de registro (ejemplo con Ion)',
      'Robotic – Setup with Artis Zeego CBCT': 'Robótica – Configuración con CBCT Artis Zeego',
      'Robotic – System Comparison (Yield & Tech)':
        'Robótica – Comparación de sistemas (rendimiento diagnóstico y tecnología)',
      'Robotic – System Gallery (Monarch/Ion/Galaxy)':
        'Robótica – Galería de sistemas (Monarch/Ion/Galaxy)',
      'Robotic – Unicorn RAB System (China)': 'Robótica – Sistema RAB Unicorn (China)',
      'Room Setup (Fixed C‑Arm; Bronchoscopy Positioning)':
        'Disposición de la sala (arco en C fijo; posicionamiento para broncoscopia)',
      'S-100 immunohistochemistry (positive)': 'Inmunohistoquímica S-100 (positiva)',
      'SBRT plan: PET & dose (48 Gy)': 'Plan de SBRT: PET y dosis (48 Gy)',
      'SBRT plan: PET & dose (60 Gy)': 'Plan de SBRT: PET y dosis (60 Gy)',
      'SEMS for tracheoesophageal fistula (mechanical ventilation, no fluoroscopy)':
        'SEMS para fístula traqueoesofágica (ventilación mecánica, sin fluoroscopia)',
      'SEMS removal (embedded stent, laser vaporization, Y-shape SEMS, PTTS)':
        'Retirada de SEMS (stent incrustado, vaporización con láser, SEMS en Y y PTTS)',
      'Sarcoidosis granuloma (cytoblock with Crown Cut needle)':
        'Granuloma por sarcoidosis (bloque celular con aguja Crown Cut)',
      'Schematic – Flow‑Volume Loop Comparisons': 'Esquema – Comparación de bucles flujo-volumen',
      'Schematic – IASLC Mediastinal Landmarks (mPA/SVC/Esophagus)':
        'Esquema – Referencias mediastínicas de la IASLC (mPA/SVC/esófago)',
      'Schematic – Mediastinal LN Stations (EUS vs EBUS vs Combined)':
        'Esquema – Estaciones ganglionares mediastínicas (EUS frente a EBUS frente a combinación)',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 4L)':
        'Esquema – Mapa de estaciones (correlación IASLC ↔ Wang: 4L)',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 4R)':
        'Esquema – Mapa de estaciones (correlación IASLC ↔ Wang: 4R)',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 7)':
        'Esquema – Mapa de estaciones (correlación IASLC ↔ Wang: 7)',
      'Schematic – TBNA Needle vs Crown‑Cut (Tissue Acquisition)':
        'Esquema – Aguja de TBNA frente a Crown-Cut (obtención de tejido)',
      'Schematic – Types of Central Airway Obstruction (Freitag/Murgu)':
        'Esquema – Tipos de obstrucción de la vía aérea central (Freitag/Murgu)',
      'Self-retaining retractor (guidewire positioning with limiter ridge)':
        'Separador autorretentivo (posicionamiento de la guía con reborde limitador)',
      'Silicon and metal stents comparison': 'Comparación de stents de silicona y metálicos',
      'Silicon stent follow-up (1-month, granulation formation)':
        'Seguimiento de stent de silicona (1 mes, formación de granulación)',
      'Silicon stent follow-up (4-month, increased granulation)':
        'Seguimiento de stent de silicona (4 meses, aumento de la granulación)',
      'Silicon stent follow-up (6-month, removal with persistent stenosis)':
        'Seguimiento de stent de silicona (6 meses, retirada con estenosis persistente)',
      'Simulator (OR Setup & Interface)': 'Simulador (configuración del quirófano e interfaz)',
      'Single‑Use Bronchoscope (Airway Burn/Cryotherapy)':
        'Broncoscopio de un solo uso (quemadura de la vía aérea/crioterapia)',
      'Single‑Use Flexible Bronchoscope (SUFB)‑Guided PDT':
        'PDT guiada por broncoscopio flexible de un solo uso (SUFB)',
      'Slim Bronchoscopes and Radial Probes': 'Broncoscopios delgados y sondas radiales',
      'Specimen Comparison – Forceps biopsy vs cryobiopsy':
        'Comparación de especímenes – Biopsia con pinzas frente a criobiopsia',
      'Specimen – Biodegradable stent fibers (coughed fragments)':
        'Espécimen – Fibras de stent biodegradable (fragmentos expectorados)',
      'Specimen – Resected lung mass (RLL and RML)':
        'Espécimen – Masa pulmonar resecada (RLL y RML)',
      'Spherical tip flexible introducer (elastic spring design)':
        'Introductor flexible de punta esférica (diseño de resorte elástico)',
      'Spirometry/CT – Pre/post treatment comparison (tracheal tumor, flow-volume curves)':
        'Espirometría/TC – Comparación antes/después del tratamiento (tumor traqueal, curvas flujo-volumen)',
      'Stent – Through‑the‑scope (TTS) outcomes':
        'Stent – Resultados de colocación a través del broncoscopio (TTS)',
      'Stenting – Metallic Y stent for bronchopleural fistula (LLL)':
        'Colocación de stent – Stent metálico en Y para fístula broncopleural (LLL)',
      'Stenting – Metallic Y stent for bronchopleural fistula (RML deployment sequence)':
        'Colocación de stent – Stent metálico en Y para fístula broncopleural (secuencia de despliegue en el RML)',
      'Stenting – Metallic Y stent for bronchopleural fistula (RML migration and successful reimplantation)':
        'Colocación de stent – Stent metálico en Y para fístula broncopleural (migración en el RML y reimplantación satisfactoria)',
      'Stenting – Metallic Y stent removal (hook technique with radiography/CT confirmation)':
        'Colocación de stent – Retirada de stent metálico en Y (técnica con gancho y confirmación mediante radiografía/TC)',
      'Stenting –Distal Granulation at Endobronchial Stent':
        'Colocación de stent – Granulación distal en un stent endobronquial',
      'Stenting –Dumon Arm with Cut‑Out + Micro‑Tech “Stent‑in‑Stent”':
        'Colocación de stent – Rama Dumon con recorte + «stent dentro de stent» Micro-Tech',
      'Stenting –GINA Silicone Stent (Design/Anti‑Migration)':
        'Colocación de stent – Stent de silicona GINA (diseño/antimigración)',
      'Stenting –GINA vs Dumon (Bench Tests: Anti‑Migration/Force/Flex)':
        'Colocación de stent – GINA frente a Dumon (pruebas de banco: antimigración/fuerza/flexibilidad)',
      'Stenting –GINA vs Dumon (Porcine Stenosis Models; 21 Days)':
        'Colocación de stent – GINA frente a Dumon (modelos porcinos de estenosis; 21 días)',
      'Stenting –Hook‑Sheath Technique (Tracheal Stent Removal)':
        'Colocación de stent – Técnica de gancho y vaina (retirada de stent traqueal)',
      'Stenting –Micro‑Tech Straight FC‑SEMS': 'Colocación de stent – FC-SEMS recto Micro-Tech',
      'Stenting –Neo‑epithelialization (Metal Stents; 4 Patients)':
        'Colocación de stent – Neoepitelización (stents metálicos; 4 pacientes)',
      'Stenting –Polydioxanone Tracheal Stent (Radiopaque Markers)':
        'Colocación de stent – Stent traqueal de polidioxanona (marcadores radiopacos)',
      'Stenting –Post‑Placement Confirmation (Bronchoscopy)':
        'Colocación de stent – Confirmación posterior a la colocación (broncoscopia)',
      'Stenting –SEMS Deploying System (Aero; Merit Endotek)':
        'Colocación de stent – Sistema de despliegue de SEMS (Aero; Merit Endotek)',
      'Stenting –Silicone Stent Deploying System (Polyflex)':
        'Colocación de stent – Sistema de despliegue de stent de silicona (Polyflex)',
      'Stenting –Suture Fixation (Case #1; Sagittal CT & Neck View)':
        'Colocación de stent – Fijación con sutura (caso n.º 1; TC sagital y vista del cuello)',
      'Stenting –Suture Fixation (Case #9; Sagittal CT & Neck View)':
        'Colocación de stent – Fijación con sutura (caso n.º 9; TC sagital y vista del cuello)',
      'Stenting –Suture Fixation (Percutaneous Pad; Post‑Op CT)':
        'Colocación de stent – Fijación con sutura (almohadilla percutánea; TC posoperatoria)',
      'Stenting –Through‑the‑Scope (TTS) vs Over‑the‑Wire (OTW) Design':
        'Colocación de stent – Diseño a través del broncoscopio (TTS) frente a sobre guía (OTW)',
      'Stenting –Y Silicone in Stomach (Migration Case)':
        'Colocación de stent – Stent de silicona en Y en el estómago (caso de migración)',
      'Subglottic stenosis (IT knife palliation)':
        'Estenosis subglótica (paliación con cuchillo IT)',
      'Subglottic stenosis (balloon dilation, Kenalog injection, follow-up)':
        'Estenosis subglótica (dilatación con balón, inyección de Kenalog y seguimiento)',
      'Subglottic stenosis (needle knife incisions, Kenalog injection)':
        'Estenosis subglótica (incisiones con cuchillo de aguja e inyección de Kenalog)',
      Surgery: 'Cirugía',
      'TEF Coverage with Self‑Expanding Y SEMS (CT/Bronch)':
        'Cobertura de TEF con SEMS en Y autoexpandible (TC/broncoscopia)',
      'TPO (Carina/Main Bronchi)': 'TPO (carina/bronquios principales)',
      'TPO (Tracheobronchopathia Osteochondroplastica; Trachea)':
        'TPO (traqueobroncopatía osteocondroplásica; tráquea)',
      'Telemedicine – Intra‑op 3D anatomy & consult':
        'Telemedicina – Anatomía 3D intraoperatoria y consulta',
      'Therapeutic Bronchoscopy': 'Broncoscopia terapéutica',
      'Thoracoscopic Appearances (Solid/Fibrous/Thickened)':
        'Aspectos toracoscópicos (sólido/fibroso/engrosado)',
      'Thoracoscopy + Urokinase Fibrinolysis (Intrapleural Nets)':
        'Toracoscopia + fibrinólisis con uroquinasa (redes intrapleurales)',
      'Threaded tip dilator (guidewire technique)':
        'Dilatador con punta roscada (técnica con guía)',
      'Tissue core and blood contamination evaluation (H&E slides)':
        'Evaluación del cilindro de tejido y de la contaminación sanguínea (portaobjetos con H&E)',
      'Tracheal Anastomosis': 'Anastomosis traqueal',
      'Tracheal MAO (malignant melanoma, Polyflex stent)':
        'MAO traqueal (melanoma maligno, stent Polyflex)',
      'Tracheal Schwannoma (H&E Features)': 'Schwannoma traqueal (características en H&E)',
      'Tracheal Schwannoma (S100 Positive)': 'Schwannoma traqueal (S100 positivo)',
      'Tracheal Schwannoma (White Pedunculated Lesion)':
        'Schwannoma traqueal (lesión pediculada blanca)',
      'Tracheal adenoid cystic carcinoma (pre/post resection, follow-up)':
        'Carcinoma adenoide quístico traqueal (antes/después de la resección y seguimiento)',
      'Tracheal and LMB obstruction (stent placement, proximal and distal views)':
        'Obstrucción traqueal y del LMB (colocación de stent, vistas proximal y distal)',
      'Tracheal compression (rigid bronchoscopy dilation, Dumon Y stent at carina)':
        'Compresión traqueal (dilatación con broncoscopia rígida, stent Dumon en Y en la carina)',
      'Tracheal invasion and perforation (silicon Y-stent placement for fistula)':
        'Invasión y perforación traqueales (colocación de stent de silicona en Y por fístula)',
      'Tracheal lobulated mass (pre/post removal, 12-month follow-up)':
        'Masa traqueal lobulada (antes/después de la extracción, seguimiento a 12 meses)',
      'Tracheal papilloma (pre/post endobronchial treatment)':
        'Papiloma traqueal (antes/después del tratamiento endobronquial)',
      'Tracheal polypoid tumor (APC, cryoablation, snare resection sequence)':
        'Tumor polipoide traqueal (secuencia con APC, crioablación y resección con asa)',
      'Tracheal schwannoma (H&E with Antoni A/B areas, nuclear palisading)':
        'Schwannoma traqueal (H&E con áreas Antoni A/B y empalizada nuclear)',
      'Tracheal squamous cell carcinoma (diode laser coagulation, scabbard trachea)':
        'Carcinoma escamoso traqueal (coagulación con láser de diodo, tráquea en vaina de sable)',
      'Tracheal stenosis (covered Ultraflex for malignant lymphoma)':
        'Estenosis traqueal (Ultraflex recubierto para linfoma maligno)',
      'Tracheal stenosis measurement': 'Medición de la estenosis traqueal',
      'Tracheoesophageal Fistula': 'Fístula traqueoesofágica',
      'Tracheoesophageal fistula (covered Ultraflex with migration)':
        'Fístula traqueoesofágica (Ultraflex recubierto con migración)',
      'Tracheoesophageal fistula suturing (rigid bronchoscopy technique)':
        'Sutura de fístula traqueoesofágica (técnica de broncoscopia rígida)',
      Tracheostomy: 'Traqueostomía',
      'Transbronchial biopsy adenocarcinoma (RUL with ROSE, H&E)':
        'Adenocarcinoma por biopsia transbronquial (RUL con ROSE, H&E)',
      'Transillumination Landmarks (PoCUS Correlate)':
        'Referencias por transiluminación (correlación con PoCUS)',
      'Trocar Placement (7th Intercostal Space)': 'Colocación del trocar (7.º espacio intercostal)',
      'Tube Insertion over Introducer': 'Inserción del tubo sobre el introductor',
      'Tumor clearance (mechanical removal via rigid bronchoscope)':
        'Eliminación del tumor (extracción mecánica mediante broncoscopio rígido)',
      'Types of Malignant Airway Obstruction (Examples)':
        'Tipos de obstrucción maligna de la vía aérea (ejemplos)',
      'Typical Carcinoid (Pre/Post Laser Resection)':
        'Carcinoide típico (antes/después de la resección con láser)',
      'Ultrasound (Cannula Tip at T1)': 'Ecografía (punta de la cánula a nivel de T1)',
      'Ultrasound (Effusion Volume Estimation)': 'Ecografía (estimación del volumen del derrame)',
      'Ultrasound – A lines (reverberation artifacts of pleuropulmonary interface)':
        'Ecografía – Líneas A (artefactos de reverberación de la interfaz pleuropulmonar)',
      'Ultrasound – B lines (comet-tail artifacts, interlobular septa)':
        'Ecografía – Líneas B (artefactos en cola de cometa, tabiques interlobulillares)',
      'Ultrasound – B-lines timeline (days 1, 4, 7, 14)':
        'Ecografía – Cronología de las líneas B (días 1, 4, 7 y 14)',
      'Ultrasound – B1 lines (hemodynamic edema)': 'Ecografía – Líneas B1 (edema hemodinámico)',
      'Ultrasound – C lines (subpleural focal consolidation)':
        'Ecografía – Líneas C (consolidación focal subpleural)',
      'Ultrasound – Centralized tracheal puncture guidance':
        'Ecografía – Guía para punción traqueal centrada',
      'Ultrasound – Coalescent B2 lines (ground glass pattern)':
        'Ecografía – Líneas B2 confluentes (patrón en vidrio esmerilado)',
      'Ultrasound – Complex nonseptated pleural effusion (heterogeneous hyperechoic spots)':
        'Ecografía – Derrame pleural complejo no tabicado (focos hiperecogénicos heterogéneos)',
      'Ultrasound – E lines (subcutaneous emphysema)': 'Ecografía – Líneas E (enfisema subcutáneo)',
      'Ultrasound – ETT positioning (tracheal longitudinal view with cricoid and tracheal rings)':
        'Ecografía – Posicionamiento del ETT (vista longitudinal de la tráquea con cricoides y anillos traqueales)',
      'Ultrasound – Floating visceral pleura (atelectasis)':
        'Ecografía – Pleura visceral flotante (atelectasia)',
      'Ultrasound – Guidewire confirmation (axial view, right of midline)':
        'Ecografía – Confirmación de la guía (vista axial, a la derecha de la línea media)',
      'Ultrasound – Guidewire confirmation (longitudinal view, tracheal rings)':
        'Ecografía – Confirmación de la guía (vista longitudinal, anillos traqueales)',
      'Ultrasound – Intraoperative pulmonary nodule localization':
        'Ecografía – Localización intraoperatoria de nódulo pulmonar',
      'Ultrasound – Malignant pleural effusion (fibrinous septation)':
        'Ecografía – Derrame pleural maligno (tabicación fibrinosa)',
      'Ultrasound – Mesothelioma (pleural effusion, tumor masses, diaphragm infiltration, rib fracture)':
        'Ecografía – Mesotelioma (derrame pleural, masas tumorales, infiltración diafragmática y fractura costal)',
      'Ultrasound – Neurofibrosarcoma and neurofibroma (diaphragm paralysis, liver bulging)':
        'Ecografía – Neurofibrosarcoma y neurofibroma (parálisis diafragmática y abombamiento hepático)',
      'Ultrasound – Pleural adhesions (diaphragmatic to collapsed lung)':
        'Ecografía – Adherencias pleurales (del diafragma al pulmón colapsado)',
      'Ultrasound – Pleural biopsy technique (target identification, vascularization assessment)':
        'Ecografía – Técnica de biopsia pleural (identificación del objetivo y evaluación de la vascularización)',
      'Ultrasound – Pleural thickening (bat sign, oblique approach for rib shadow avoidance)':
        'Ecografía – Engrosamiento pleural (signo del murciélago, abordaje oblicuo para evitar la sombra costal)',
      'Ultrasound – Pleural thickening technique (transverse/longitudinal probe positioning)':
        'Ecografía – Técnica para engrosamiento pleural (posicionamiento transversal/longitudinal de la sonda)',
      'Ultrasound – Pneumothorax (absent lung sliding at pleural line)':
        'Ecografía – Neumotórax (ausencia de deslizamiento pulmonar en la línea pleural)',
      'Ultrasound – Sonographic anatomy (chest wall layers, pleural line, probe comparison)':
        'Ecografía – Anatomía ecográfica (capas de la pared torácica, línea pleural y comparación de sondas)',
      'Ultrasound – Trachea longitudinal view (cricoid and tracheal rings, 8 MHz probe)':
        'Ecografía – Vista longitudinal de la tráquea (cricoides y anillos traqueales, sonda de 8 MHz)',
      'Ultrasound – Trachea sagittal view (cricoid cartilage and five tracheal rings)':
        'Ecografía – Vista sagital de la tráquea (cartílago cricoides y cinco anillos traqueales)',
      'Ultrasound – Trachea sagittal view (guidewire entry point identification)':
        'Ecografía – Vista sagital de la tráquea (identificación del punto de entrada de la guía)',
      'Ultrasound – Tracheal puncture (axial view with needle at anterior wall)':
        'Ecografía – Punción traqueal (vista axial con la aguja en la pared anterior)',
      'Ultrasound – Tracheal vascular anatomy (duplex imaging, paramedian artery avoidance during puncture)':
        'Ecografía – Anatomía vascular traqueal (imagen dúplex y evitación de arteria paramediana durante la punción)',
      'Ultrasound – Z lines (bundle-shaped artifacts)':
        'Ecografía – Líneas Z (artefactos en forma de haz)',
      'Ultrasound/CEUS – Primary lung sarcoma (pleural metastasis, enhancement patterns)':
        'Ecografía/CEUS – Sarcoma pulmonar primario (metástasis pleural y patrones de realce)',
      'Ultrasound/CT Correlation – Pleural thickening (hypoecogenic lobular mass with circumferential pattern)':
        'Correlación ecografía/TC – Engrosamiento pleural (masa lobulada hipoecogénica con patrón circunferencial)',
      'Ultrasound/CT Correlation – Pleural thickening localization (solid/cystic/complex characteristics)':
        'Correlación ecografía/TC – Localización del engrosamiento pleural (características sólidas/quísticas/complejas)',
      'Ultrasound/Clinical – Tracheal transillumination with PoCUS guidance (cricothyroid membrane and puncture point)':
        'Ecografía/clínica – Transiluminación traqueal guiada por PoCUS (membrana cricotiroidea y punto de punción)',
      'Ultrasound/Pathology – Epithelioid mesothelioma (pleural effusion, solid tumor with biopsy)':
        'Ecografía/anatomía patológica – Mesotelioma epitelioide (derrame pleural y tumor sólido con biopsia)',
      'Ultrasound/Pleuroscopy Correlation – Pleural sliding sign, effusion, and adhesions':
        'Correlación ecografía/pleuroscopia – Signo de deslizamiento pleural, derrame y adherencias',
      'Ultrasound/Pleuroscopy – Pleural effusion patterns (anechoic, complex, septated, homogeneous)':
        'Ecografía/pleuroscopia – Patrones de derrame pleural (anecoico, complejo, tabicado y homogéneo)',
      'Ultrathin Bronchoscopy – rEBUS views & sampling':
        'Broncoscopia ultrafina – Vistas de rEBUS y muestreo',
      'VAL-MAP 2.0 technique (step-by-step)': 'Técnica VAL-MAP 2.0 (paso a paso)',
      'VAL-MAP – Dual dye technique (indigo carmine and ICG with NIR thoracoscopy)':
        'VAL-MAP – Técnica de doble colorante (índigo carmín e ICG con toracoscopia NIR)',
      'VBN + CBCT (Tip‑in‑Target Confirmation)':
        'VBN + CBCT (confirmación de la punta dentro del objetivo)',
      'Vascular wall–adjacent lesion': 'Lesión adyacente a la pared vascular',
      'Virtual Bronchoscopy (Archimedes)': 'Broncoscopia virtual (Archimedes)',
      'Virtual Bronchoscopy – Path Planning (Fly‑Through)':
        'Broncoscopia virtual – Planificación de la trayectoria (recorrido virtual)',
      'Virtual Bronchoscopy – Planning (Multiplanar Views)':
        'Broncoscopia virtual – Planificación (vistas multiplanares)',
      'Virtual Bronchoscopy – RFID Tag Placement (CT Correlation)':
        'Broncoscopia virtual – Colocación de etiqueta RFID (correlación con TC)',
      'Virtual Bronchoscopy – Route/Target Overlay':
        'Broncoscopia virtual – Superposición de ruta/objetivo',
      'Virtual Bronchoscopy – Veran (Lesion Access)':
        'Broncoscopia virtual – Veran (acceso a la lesión)',
      'Y-shaped airway stents (large bilateral and single-plugged designs)':
        'Stents de vía aérea en Y (diseños bilaterales grandes y con una rama obturada)',
      'Y-shaped stent removal (failed expansion, hook retrieval)':
        'Retirada de stent en Y (expansión fallida y extracción con gancho)',
      'Y‑SEMS for Severe Bilateral MAO (Recovery)':
        'Y-SEMS para MAO bilateral grave (recuperación)',
      'Zephyr Valves (RUL; RB1/RB3/RB2)': 'Válvulas Zephyr (RUL; RB1/RB3/RB2)',
      'Zephyr Valves (Size 4; LUL)': 'Válvulas Zephyr (tamaño 4; LUL)',
      'Zephyr valve placement (LB6 deployment sequence)':
        'Colocación de válvula Zephyr (secuencia de despliegue en LB6)',
      'Zephyr vs Spiration (In Situ Comparison)': 'Zephyr frente a Spiration (comparación in situ)',
      'iSGS proximal stenosis progression (cross-sectional evolution stages)':
        'Progresión de la estenosis proximal en iSGS (etapas de evolución transversal)',
      'rEBUS – Eccentric lung nodule (detailed procedure)':
        'rEBUS – Nódulo pulmonar excéntrico (procedimiento detallado)',
      'rEBUS – Views classification (concentric, eccentric, blizzard, no view)':
        'rEBUS – Clasificación de vistas (concéntrica, excéntrica, ventisca y sin imagen)',
    },
    'zh-CN': {
      '3D Printing – LUL tumor reconstruction (STL file processing)':
        '3D 打印 – LUL 肿瘤重建（STL 文件处理）',
      '3D Reconstruction –  Virtual segmentectomy': '3D 重建 – 虚拟肺段切除术',
      '3D Reconstruction – Bronchial tree timeline (LMB stenosis and stent placement)':
        '3D 重建 – 支气管树时间线（LMB 狭窄与支架置入）',
      '3D Reconstruction – Broncho-vascular anatomy (LUL S1+2 with nodule)':
        '3D 重建 – 支气管血管解剖（LUL S1+2 伴结节）',
      '3D Reconstruction – Lung parenchyma segmentectomy simulation (S7+8 with nodule)':
        '3D 重建 – 肺实质肺段切除模拟（S7+8 伴结节）',
      '3D Reconstruction – Venous drainage (LUL surgical dissection vs virtual)':
        '3D 重建 – 静脉引流（LUL 手术解剖与虚拟重建对比）',
      '3D Reconstruction – Virtual bronchoscopy (CT-based bronchial model)':
        '3D 重建 – 虚拟支气管镜（基于 CT 的支气管模型）',
      '3D printed stent (customized silicone for complex stenosis)':
        '3D 打印支架（用于复杂狭窄的定制硅酮支架）',
      '3D reconstructions': '3D 重建',
      'APC and diode laser (endobronchial treatment sequence)':
        'APC 与二极管激光（支气管腔内治疗顺序）',
      'Ablation – Fluoroscopy-guided cryoprobe with EBUS (1.1mm)':
        '消融 – 透视引导下结合 EBUS 的冷冻探针（1.1 mm）',
      'Adenoid Cystic Carcinoma (Cribriform Subtype)': '腺样囊性癌（筛状亚型）',
      'Adenoid cystic carcinoma (cribriform pattern, p40 and MYB IHC)':
        '腺样囊性癌（筛状结构，p40 和 MYB 免疫组化）',
      'Airway Management – Endobronchial Blockers (Schematic)':
        '气道管理 – 支气管内阻断器（示意图）',
      'Airway Management – Endobronchial Blockers (Types/Parts)':
        '气道管理 – 支气管内阻断器（类型/部件）',
      'Airway Stenosis – Montgomery T-tube placement procedure':
        '气道狭窄 – Montgomery T 管置入操作',
      'Airway Stenosis – Post‑intubation (CT & bronchoscopy)': '气道狭窄 – 插管后（CT 与支气管镜）',
      'Airway metastasis (LMB, hepatocellular carcinoma, laser/mechanical debulking)':
        '气道转移瘤（LMB、肝细胞癌、激光/机械减容）',
      'Airway stents comparison (Polyflex, Ultraflex, Silmet, Nova-Stent, Dumon, Freitag, Hood)':
        '气道支架对比（Polyflex、Ultraflex、Silmet、Nova-Stent、Dumon、Freitag、Hood）',
      'Algorithm – Endobronchial-transbronchial ablation zones (anatomical guidance)':
        '算法 – 支气管腔内—经支气管消融区域（解剖引导）',
      'Algorithm – Navigated CP-EBUS workflow (mediastinal lymph node diagnosis, 6-step schematic)':
        '算法 – 导航 CP-EBUS 工作流（纵隔淋巴结诊断，6 步示意图）',
      'Algorithm – SSN 3D measurement index (CT histogram and texture features)':
        '算法 – SSN 3D 测量指数（CT 直方图与纹理特征）',
      'Algorithm/Procedure – iSGS treatment approaches (endoscopic laryngotracheoplasty techniques)':
        '算法/操作 – iSGS 治疗方法（内镜喉气管成形技术）',
      'Ambu Disposable Bronchoscope': 'Ambu 一次性支气管镜',
      'Amplatzer devices for bronchopleural fistula closure':
        '用于封堵支气管胸膜瘘的 Amplatzer 装置',
      'Anatomy – Internal mammary arteries on CT/3D': '解剖 – CT/3D 中的内乳动脉',
      'Anatomy – Secondary lobule diagram (artery lobularis and pulmonary artery branch)':
        '解剖 – 次级肺小叶示意图（小叶动脉与肺动脉分支）',
      'Anthropomorphic Lungman phantom': 'Lungman 拟人肺模型',
      'Appropriate vs Lateral Puncture': '正确穿刺与侧向穿刺对比',
      'Atelectasis Severity (ASSESS Scoring Schematic)': '肺不张严重程度（ASSESS 评分示意图）',
      'Atelectasis Severity (CT Examples I–III)': '肺不张严重程度（CT 示例 I–III）',
      'Augmented Fluoroscopy – Bronchoscopic localization': '增强透视 – 支气管镜定位',
      'Augmented Fluoroscopy – Coil deployment view': '增强透视 – 线圈释放视图',
      'Augmented Reality – Virtual 3D model overlay (bronchoscope location display)':
        '增强现实 – 虚拟 3D 模型叠加（显示支气管镜位置）',
      'Auto‑planning vs manual (MFS/HFS)': '自动规划与手动规划对比（MFS/HFS）',
      'BAO complex tracheal stenosis (mechanical dilation, silicone stent)':
        'BAO 复杂气管狭窄（机械扩张、硅酮支架）',
      'BAO from pulmonary amyloidoma (carina, 5-month follow-up)':
        '肺淀粉样瘤导致的 BAO（隆嵴，5 个月随访）',
      'BD stent (3-month follow-up, mucosal hyperplasia)': 'BD 支架（3 个月随访，黏膜增生）',
      'BD stent (immediate post-implantation)': 'BD 支架（植入后即刻）',
      'Balloon Dilation (Incisions → Rigid Scope)': '球囊扩张（切开 → 硬质镜）',
      'Balloon Dilation (Timeline Sep–Oct 2021)': '球囊扩张（2021 年九月至十月时间线）',
      'Balloon Dilation and Stent (Timeline Oct–Nov 2021)':
        '球囊扩张与支架（2021 年十月至十一月时间线）',
      'Biodegradable stent degradation (3-month follow-up)': '可降解支架降解（3 个月随访）',
      'Biopsy – CBCT‑guided lung nodule': '活检 – CBCT 引导肺结节',
      'Biopsy – CT‑guided lung nodule (multi‑plane)': '活检 – CT 引导肺结节（多平面）',
      'Biopsy – CT‑guided: hemorrhage complication': '活检 – CT 引导：出血并发症',
      'Biopsy – CT‑guided: indications': '活检 – CT 引导：适应证',
      'Biopsy – CT‑guided: pneumothorax complication': '活检 – CT 引导：气胸并发症',
      'Biopsy – Fluoroscopy‑guided lung nodule': '活检 – 透视引导肺结节',
      'Biopsy – Specimen comparison (needle, forceps, cryobiopsy gross and frozen)':
        '活检 – 标本对比（针、活检钳、冷冻活检大体标本与冰冻切片）',
      'Biopsy – Transbronchial cryobiopsy procedure (RLL, ILD, fluoroscopy-guided)':
        '活检 – 经支气管冷冻活检操作（RLL、ILD、透视引导）',
      'Biopsy – Ultrasound‑guided lung nodule': '活检 – 超声引导肺结节',
      'Brachytherapy – Endobronchial infiltration (LUL catheter placement and dose planning)':
        '近距离放疗 – 支气管腔内浸润（LUL 导管置入与剂量规划）',
      'Bronchial stenosis (post-dilation and silicon stent placement)':
        '支气管狭窄（扩张及硅酮支架置入后）',
      'Bronchopleural Fistula – AD implantation (post-RML/RLL lobectomy)':
        '支气管胸膜瘘 – AD 植入（RML/RLL 肺叶切除术后）',
      'Bronchopleural Fistula – AD implantation with CT/bronchoscopy correlation (post-LUL lobectomy)':
        '支气管胸膜瘘 – AD 植入及 CT/支气管镜对照（LUL 肺叶切除术后）',
      'Bronchoscopic Ablation – Argon plasma debulking': '支气管镜消融 – 氩等离子体减容',
      'Bronchoscopic Ablation – Microwave (CBCT verification)': '支气管镜消融 – 微波（CBCT 验证）',
      'Bronchoscopic Images –  Laser Photocoagulation (YAP/Nd:YAG)':
        '支气管镜图像 – 激光光凝（YAP/Nd:YAG）',
      'Bronchoscopic Images – Cobblestoning': '支气管镜图像 – 鹅卵石样改变',
      'Bronchoscopic Images/CT – Dumon Oki stent (RMB extrinsic compression, post-stenting)':
        '支气管镜图像/CT – Dumon Oki 支架（RMB 外压，置入后）',
      'Bronchoscopic Images/CT – RML fistula stent management (placement, restenosis, removal timeline)':
        '支气管镜图像/CT – RML 瘘支架处理（置入、再狭窄及取出时间线）',
      'Bronchoscopic Images/CT – Tracheal stenosis (covered Ultraflex for lymphoma, R-CHOP therapy, 6-year survival)':
        '支气管镜图像/CT – 气管狭窄（淋巴瘤使用覆膜 Ultraflex，R-CHOP 治疗，生存 6 年）',
      'Bronchoscopic Images/CT – Tracheal stenosis (spiral Z stent for thymic cancer, 6-year survival)':
        '支气管镜图像/CT – 气管狭窄（胸腺癌螺旋 Z 支架，生存 6 年）',
      'Bronchoscopic Images/Pathology – ENB-guided methylene blue injection (S2a subsegmental, adenocarcinoma)':
        '支气管镜图像/病理 – ENB 引导亚甲蓝注射（S2a 亚段，腺癌）',
      'Bronchoscopic Lung Volume Reduction': '支气管镜肺减容',
      'CBCT – Brush Catheter Adjacent to Pleura (Axial)': 'CBCT – 邻近胸膜的刷检导管（轴位）',
      'CBCT – Brush Catheter Adjacent to Pleura (Sagittal)': 'CBCT – 邻近胸膜的刷检导管（矢状位）',
      'CBCT – Cios Spin unit': 'CBCT – Cios Spin 设备',
      'CBCT – Lung nodule (center strike, multiplanar views)':
        'CBCT – 肺结节（中心命中，多平面视图）',
      'CBCT – Percutaneous nodule marking guidance': 'CBCT – 经皮结节标记引导',
      'CBCT – Tool‑in‑lesion (EMN + EWC)': 'CBCT – 器械位于病灶内（EMN + EWC）',
      'CBCT‑Derived AF (Forceps/Cryobiopsy/Percutaneous)': 'CBCT 衍生 AF（活检钳/冷冻活检/经皮）',
      'CBCT–DTS – Patient (CT vs intra‑op CBCT)': 'CBCT–DTS – 患者（CT 与术中 CBCT 对比）',
      'CBCT–DTS – Patient reconstruction (PL DTS)': 'CBCT–DTS – 患者重建（PL DTS）',
      'CBCT–DTS – Phantom (CT vs intra‑op CBCT)': 'CBCT–DTS – 模型（CT 与术中 CBCT 对比）',
      'CBCT–DTS – Phantom reconstruction (PL DTS)': 'CBCT–DTS – 模型重建（PL DTS）',
      'CBCT–DTS – Phantom reconstruction (SE DTS)': 'CBCT–DTS – 模型重建（SE DTS）',
      'CEUS – Subpleural lung tumor biopsy (needle positioning in vital tissue)':
        'CEUS – 胸膜下肺肿瘤活检（针定位于活性组织）',
      'COPD evaluation (CT inspiration/expiration, perfusion, quantitative analysis)':
        'COPD 评估（吸气/呼气 CT、灌注、定量分析）',
      'CP-EBUS real-time TBNA (mediastinal lymph node with dual video/US display)':
        'CP-EBUS 实时 TBNA（纵隔淋巴结，视频/超声双屏显示）',
      'CP‑EBUS (Well‑Circumscribed Water‑Density Lesion)': 'CP-EBUS（边界清楚的水样密度病灶）',
      'CT Angio – Azygos vein ectasia': 'CT 血管成像 – 奇静脉扩张',
      'CT Correlation (LUL Endobronchial Hamartoma)': 'CT 对照（LUL 支气管腔内错构瘤）',
      'CT Signs (Split Pleura / Hemi‑Split)': 'CT 征象（胸膜分裂征 / hemi-split）',
      'CT after first SBRT': '首次 SBRT 后 CT',
      'CT –  Right lung mass': 'CT – 右肺肿块',
      'CT – Airway stent migration to stomach': 'CT – 气道支架移位至胃内',
      'CT – Atelectasis/ventilation change pre/post stent': 'CT – 支架前后肺不张/通气变化',
      'CT – BLVR occlusion methods (balloon vs valves, atelectasis patterns, accessory lobe expansion)':
        'CT – BLVR 阻断方法（球囊与活瓣、肺不张模式、附加肺叶扩张）',
      'CT – Bilateral SEMS (pre/post comparison, coronal views with patent stents)':
        'CT – 双侧 SEMS（前后对比，冠状位显示支架通畅）',
      'CT – Bilateral SEMS cases (multiplanar reconstruction, five patients)':
        'CT – 双侧 SEMS 病例（多平面重建，五例患者）',
      'CT – Bronchus signs (truncation, passage, no bronchus)':
        'CT – 支气管征（截断、通过、无支气管）',
      'CT – Cavitary nodule (LLL squamous cell carcinoma)': 'CT – 空洞性结节（LLL 鳞状细胞癌）',
      'CT – Cavitary nodule (RUL aspergilloma)': 'CT – 空洞性结节（RUL 曲霉球）',
      'CT – Central tumor progression (vascular and bronchial compression)':
        'CT – 中央型肿瘤进展（血管和支气管受压）',
      'CT – Complex nodule with bronchial interruption sign (LLL invasive adenocarcinoma, MIP vessel convergence)':
        'CT – 伴支气管中断征的复杂结节（LLL 浸润性腺癌，MIP 血管汇聚）',
      'CT – Complex nodule with bubble-like lucencies (RUL adenocarcinoma, mixed growth patterns)':
        'CT – 伴气泡样透亮区的复杂结节（RUL 腺癌，混合生长模式）',
      'CT – Cystic airspace with mural nodule (LUL adenocarcinoma)':
        'CT – 囊性气腔伴壁结节（LUL 腺癌）',
      'CT – Cystic lesion (right superior mediastinum, posterior SVC)':
        'CT – 囊性病变（右上纵隔，SVC 后方）',
      'CT – Features Predicting SSN Growth': 'CT – 预测 SSN 生长的特征',
      'CT – Ground glass nodule evolution (stable, progressive, part-solid transformation)':
        'CT – 磨玻璃结节演变（稳定、进展、转变为部分实性）',
      'CT – Hamartoma with Popcorn Calcifications': 'CT – 伴爆米花样钙化的错构瘤',
      'CT – IASLC 2R/4R mapping': 'CT – IASLC 2R/4R 定位',
      'CT – IASLC stations 4L/5/5': 'CT – IASLC 站 4L/5/5',
      'CT – Intrapulmonary Lymph Nodes (Triangular)': 'CT – 肺内淋巴结（三角形）',
      'CT – Intrathoracic goiter (diffuse tracheal narrowing, severe obstruction)':
        'CT – 胸内甲状腺肿（弥漫性气管狭窄、重度阻塞）',
      'CT – LLL mass with left adrenal enlargement (heterogeneous enhancement)':
        'CT – LLL 肿块伴左侧肾上腺增大（不均匀强化）',
      'CT – LMS obstruction: SCC vs ACC': 'CT – LMS 阻塞：SCC 与 ACC',
      'CT – LUL Lobulated Nodule (Hamartoma)': 'CT – LUL 分叶状结节（错构瘤）',
      'CT – LUL Mass (Contrast; Axial/Coronal/Sagittal)':
        'CT – LUL 肿块（增强；轴位/冠状位/矢状位）',
      'CT – LUL pulmonary nodule (oblique fissure measurement)': 'CT – LUL 肺结节（斜裂测量）',
      'CT – Large left-sided pleural effusion': 'CT – 大量左侧胸腔积液',
      'CT – Large tracheal lesion (95% obstruction, inferior third)':
        'CT – 大型气管病变（95% 阻塞，下三分之一）',
      'CT – Lipoid pneumonia (RML with fat component)': 'CT – 类脂性肺炎（RML 伴脂肪成分）',
      'CT – Lobulated RLL Nodule (Adenocarcinoma)': 'CT – RLL 分叶状结节（腺癌）',
      'CT – Loculated empyema': 'CT – 包裹性脓胸',
      'CT – Lung nodule with notch sign (lingula, large cell neuroendocrine carcinoma)':
        'CT – 伴切迹征的肺结节（舌段，大细胞神经内分泌癌）',
      'CT – Malignant CAO stenting (Dumon Y stent, post-laser and debulking, multiplanar views)':
        'CT – 恶性 CAO 支架置入（Dumon Y 型支架，激光和减容后，多平面视图）',
      'CT – Mediastinal Adenopathy (Re‑Examination)': 'CT – 纵隔淋巴结肿大（复查）',
      'CT – Mediastinal Mass (Re‑Examination)': 'CT – 纵隔肿块（复查）',
      'CT – Mediastinal abscess (post-EBUS TBNA complication)':
        'CT – 纵隔脓肿（EBUS-TBNA 后并发症）',
      'CT – Mediastinal cyst (coronal)': 'CT – 纵隔囊肿（冠状位）',
      'CT – Mediastinal cyst wall enhancement (axial)': 'CT – 纵隔囊肿壁强化（轴位）',
      'CT – Mediastinal mass (tracheal invasion, esophageal mass, chest wall and cervical involvement)':
        'CT – 纵隔肿块（气管侵犯、食管肿块、胸壁和颈部受累）',
      'CT – Multiple ground glass nodules (post-trauma, follow-up, post-surgical changes)':
        'CT – 多发磨玻璃结节（创伤后、随访、术后改变）',
      'CT – Multiple nodules (carcinoid vs tuberculoma in oncology patient)':
        'CT – 多发结节（肿瘤患者的类癌与结核瘤鉴别）',
      'CT – Multiple pulmonary nodules (spiculated morphology, varied PET uptake)':
        'CT – 多发肺结节（毛刺形态、PET 摄取不一）',
      'CT – Multiple subsolid nodules (pure GGN vs part-solid, adenocarcinoma in situ vs minimally invasive)':
        'CT – 多发亚实性结节（纯 GGN 与部分实性、原位腺癌与微浸润腺癌）',
      'CT – Navigation planning (PlanPoint software, segmented views with target pathway)':
        'CT – 导航规划（PlanPoint 软件，含目标路径的分割视图）',
      'CT – Nodule with bronchial interruption sign (RLL NSCLC with adrenal metastasis)':
        'CT – 伴支气管中断征的结节（RLL NSCLC 伴肾上腺转移）',
      'CT – Nodule with bubble-like lucencies (RUL adenocarcinoma with lepidic growth)':
        'CT – 伴气泡样透亮区的结节（RUL 腺癌伴贴壁生长）',
      'CT – Nodule with fissure retraction (adenocarcinoma)': 'CT – 伴叶间裂牵拉的结节（腺癌）',
      'CT – Nodule with irregular air bronchogram (RLL adenocarcinoma)':
        'CT – 伴不规则空气支气管征的结节（RLL 腺癌）',
      'CT – Pleural effusion (contiguous to primary lesion)': 'CT – 胸腔积液（与原发病灶相邻）',
      'CT – Pneumomediastinum and Subcutaneous Empysema': 'CT – 纵隔气肿与皮下气肿',
      'CT – Post-LVRS nodule': 'CT – LVRS 后结节',
      'CT – Post-SBRT (11-month follow-up, ground-glass appearance)':
        'CT – SBRT 后（11 个月随访，磨玻璃样表现）',
      'CT – Post-SBRT (2-month and 8-month follow-up)': 'CT – SBRT 后（2 个月和 8 个月随访）',
      'CT – Post-operative bronchial kinking (lower lobar bronchus)':
        'CT – 术后支气管扭曲（下叶支气管）',
      'CT – Post-stent removal (tracheal patency)': 'CT – 支架取出后（气管通畅）',
      'CT – Post‑EBUS timeline: complications': 'CT – EBUS 后时间线：并发症',
      'CT – Post‑EBUS timeline: cyst enlargement': 'CT – EBUS 后时间线：囊肿增大',
      'CT – Post‑EBUS timeline: cyst smaller post‑TBNA': 'CT – EBUS 后时间线：TBNA 后囊肿缩小',
      'CT – Post‑EBUS timeline: mediastinitis': 'CT – EBUS 后时间线：纵隔炎',
      'CT – Post‑EBUS timeline: pleural effusion': 'CT – EBUS 后时间线：胸腔积液',
      'CT – Post‑op neck soft tissue: diffuse tracheal calcification':
        'CT – 术后颈部软组织：弥漫性气管钙化',
      'CT – Preoperative planning (RFID tag placement for S8a GGN, 3D reconstruction)':
        'CT – 术前规划（S8a GGN 的 RFID 标签放置，3D 重建）',
      'CT – Pre‑LVRS': 'CT – LVRS 前',
      'CT – RFA treatment (3D thermodynamic reconstruction maps, pre/post comparison)':
        'CT – RFA 治疗（3D 热力学重建图，前后对比）',
      'CT – RFID tag deviation (target vs actual placement site, 20.8mm distance)':
        'CT – RFID 标签偏差（目标与实际放置位置，距离 20.8 mm）',
      'CT – RLL mass with pleural effusion (compressive atelectasis, mass-like opacity)':
        'CT – RLL 肿块伴胸腔积液（压迫性肺不张、肿块样阴影）',
      'CT – RML orifice tumor with atelectasis': 'CT – RML 开口肿瘤伴肺不张',
      'CT – RUL nodule with mediastinal adenopathy': 'CT – RUL 结节伴纵隔淋巴结肿大',
      'CT – Round well-delineated solid nodule (RLL squamous cell carcinoma)':
        'CT – 圆形、边界清楚的实性结节（RLL 鳞状细胞癌）',
      'CT – SVC and right pulmonary artery compression (mediastinal mass)':
        'CT – SVC 和右肺动脉受压（纵隔肿块）',
      'CT – SVC/PA Encasement (Middle Mediastinal Mass)': 'CT – SVC/PA 包绕（中纵隔肿块）',
      'CT – Septated pleural effusion & “bubble sign”': 'CT – 分隔性胸腔积液与“气泡征”',
      'CT – Sharply delineated oval nodule (LLL typical carcinoid)':
        'CT – 边界锐利的椭圆形结节（LLL 典型类癌）',
      'CT – Solid nodule with ground glass halo (RLL invasive aspergillosis)':
        'CT – 实性结节伴磨玻璃晕（RLL 侵袭性曲霉病）',
      'CT – Solitary lung nodule (2D and 3D MSCT with distance measurement)':
        'CT – 孤立性肺结节（2D 和 3D MSCT，含距离测量）',
      'CT – Spiculated nodule (RLL squamous cell carcinoma)': 'CT – 毛刺结节（RLL 鳞状细胞癌）',
      'CT – Spiculated nodule with calcifications (RUL apex, squamous cell carcinoma)':
        'CT – 伴钙化的毛刺结节（RUL 肺尖，鳞状细胞癌）',
      'CT – Spiculated nodule with notch sign (RUL small cell lung cancer with lymphadenopathy)':
        'CT – 伴切迹征的毛刺结节（RUL 小细胞肺癌伴淋巴结肿大）',
      'CT – Spiculated nodule with pleural tags (LUL adenocarcinoma with pleural invasion)':
        'CT – 伴胸膜牵拉带的毛刺结节（LUL 腺癌伴胸膜侵犯）',
      'CT – Spiculated subpleural nodule (RUL apex with paraseptal emphysema)':
        'CT – 胸膜下毛刺结节（RUL 肺尖伴间隔旁型肺气肿）',
      'CT – Squamous cell lung cancer (extrinsic obstruction, alveolus stent placement)':
        'CT – 肺鳞状细胞癌（外压性阻塞，Alveolus 支架置入）',
      'CT – Station 4R adenopathy': 'CT – 4R 站淋巴结肿大',
      'CT – Subpleural Lobulated Nodule (Adenocarcinoma)': 'CT – 胸膜下分叶状结节（腺癌）',
      'CT – Subpleural reticulation & cysts (MIP selection)': 'CT – 胸膜下网格影与囊变（MIP 选择）',
      'CT – Subpleural solid nodule (intrapulmonary lymph node, lingula)':
        'CT – 胸膜下实性结节（肺内淋巴结，舌段）',
      'CT – Suspicious Pulmonary Nodule (Right Lung)': 'CT – 可疑肺结节（右肺）',
      'CT – Temporal evolution of LMB obstruction & stenting': 'CT – LMB 阻塞与支架置入的时间演变',
      'CT – Thyroid mass with tracheal deviation': 'CT – 甲状腺肿块伴气管偏移',
      'CT – Tracheal Lesion (At Presentation)': 'CT – 气管病变（初诊时）',
      'CT – Tracheal and bilateral main bronchi stenosis (soft tissue thickening)':
        'CT – 气管及双侧主支气管狭窄（软组织增厚）',
      'CT – Tracheal and bronchial wall thickening (left lung atelectasis and bronchiectasis)':
        'CT – 气管和支气管壁增厚（左肺肺不张与支气管扩张）',
      'CT – Tracheal patency (post-stent and chemotherapy, 5-year follow-up)':
        'CT – 气管通畅（支架和化疗后，5 年随访）',
      'CT – Tracheal schwannoma causing obstruction': 'CT – 导致阻塞的气管神经鞘瘤',
      'CT – Tracheal stenosis': 'CT – 气管狭窄',
      'CT – Triple dye injection (iodinated contrast, ICG, methylene blue near lung lesion)':
        'CT – 三重染料注射（肺病灶附近的碘对比剂、ICG 和亚甲蓝）',
      'CT – Tumor response after chemoradiation (tracheobronchial)':
        'CT – 放化疗后肿瘤反应（气管支气管）',
      'CT – Tumor with cardiac invasion (left atrial involvement)':
        'CT – 肿瘤侵犯心脏（左心房受累）',
      'CT – Upper tracheal stenosis (axial and coronal views)': 'CT – 上段气管狭窄（轴位和冠状位）',
      'CT-guided cyanoacrylate localization': 'CT 引导氰基丙烯酸酯定位',
      'CT-guided indocyanine green localization': 'CT 引导吲哚菁绿定位',
      'CT-guided memory alloy coil localization': 'CT 引导记忆合金线圈定位',
      'CT/Bronchoscopy Correlation – Tracheal mass with near-complete obstruction':
        'CT/支气管镜对照 – 气管肿块伴近完全阻塞',
      'CT/Bronchoscopy Correlation – Tracheoesophageal fistula (esophageal tumor, stent placement with barium swallow)':
        'CT/支气管镜对照 – 气管食管瘘（食管肿瘤，支架置入及钡餐造影）',
      'CT/Bronchoscopy – Tracheal esophageal tumor (stent obstruction, APC recanalization)':
        'CT/支气管镜 – 气管食管肿瘤（支架阻塞，APC 再通）',
      'CT/Bronchoscopy – Tracheal polypoid metastasis (rigid bronchoscopy coring, APC)':
        'CT/支气管镜 – 气管息肉样转移瘤（硬质镜旋切，APC）',
      'CT/Bronchoscopy – Tracheoesophageal fistula (SEMS placement and removal, stenosis management)':
        'CT/支气管镜 – 气管食管瘘（SEMS 置入与取出、狭窄处理）',
      'CT/Bronchoscopy/Chest X-ray – LMB compression (thoracic aortic aneurysm, stent placement timeline)':
        'CT/支气管镜/胸片 – LMB 受压（胸主动脉瘤，支架置入时间线）',
      'CT/Bronchoscopy/Chest X-ray – Mediastinal mass (LMB occlusion, stent placement)':
        'CT/支气管镜/胸片 – 纵隔肿块（LMB 闭塞，支架置入）',
      'CT/CBCT Comparison – Atelectasis artifact (with and without ventilation protocol)':
        'CT/CBCT 对比 – 肺不张伪影（有与无通气方案）',
      'CT/CBCT – DTS reconstruction (ART vs prior-aided, registered views)':
        'CT/CBCT – DTS 重建（ART 与先验辅助，配准视图）',
      'CT/CBCT – Lung abscess drainage (rEBUS localization, needle placement, follow-up resolution)':
        'CT/CBCT – 肺脓肿引流（rEBUS 定位、穿刺针放置、随访消退）',
      'CT/CBCT/EBUS – LLL nodule (CBCT-AF with EBUS-TBB, adenocarcinoma diagnosis)':
        'CT/CBCT/EBUS – LLL 结节（CBCT-AF 联合 EBUS-TBB，诊断腺癌）',
      'CT/CXR – Endobronchial Obstruction': 'CT/胸片 – 支气管腔内阻塞',
      'CT/Chest X-ray Correlation – Intratracheal tumor': 'CT/胸片对照 – 气管内肿瘤',
      'CT/Chest X-ray – RMB and carina obstruction (Y-stent placement)':
        'CT/胸片 – RMB 与隆嵴阻塞（Y 型支架置入）',
      'CT/Cytology – Mediastinal lymphadenopathy (small cell lung carcinoma, H&E)':
        'CT/细胞学 – 纵隔淋巴结肿大（小细胞肺癌，H&E）',
      'CT/Cytology – Mediastinal mass with necrosis (EBUS-TBNA adenocarcinoma)':
        'CT/细胞学 – 纵隔肿块伴坏死（EBUS-TBNA 腺癌）',
      'CT/EBUS/Cytology - Peripheral lesion with ROSE adenocarcinoma and small-cell lung cancer examples':
        'CT/EBUS/细胞学 – 外周病变，ROSE 显示腺癌和小细胞肺癌示例',
      'CT/Fluoroscopy – Y‑stent implantation': 'CT/透视 – Y 型支架植入',
      'CT/PET - Enlarged right paratracheal lymph node with FDG uptake':
        'CT/PET – 右侧气管旁淋巴结增大并摄取 FDG',
      'CT/PET Correlation (Post‑Surgery Recurrence Cases)': 'CT/PET 对照（术后复发病例）',
      'CT/PET – Pulmonary lesion (surgical port mapping)': 'CT/PET – 肺病灶（手术切口定位）',
      'CT/PET-CT – Chest imaging (multiplanar correlation)': 'CT/PET-CT – 胸部影像（多平面对照）',
      'CT/PET/EUS – Superior mediastinal mass (hypermetabolic, endo-oesophageal puncture)':
        'CT/PET/EUS – 上纵隔肿块（高代谢，经食管穿刺）',
      'CT/Path Correlation (LUL Endobronchial Mass)': 'CT/病理对照（LUL 支气管腔内肿块）',
      'CT/Path Correlation (Right Paratracheal)': 'CT/病理对照（右侧气管旁）',
      'CT/Path Correlation (Sarcoid Granuloma)': 'CT/病理对照（结节病肉芽肿）',
      'CT/Pathology – Discordant histology (LUL mass, SCC vs adenosquamous carcinoma)':
        'CT/病理 – 组织学不一致（LUL 肿块，SCC 与腺鳞癌）',
      'CT/Pleuroscopy Correlation – Pleural nodules (lung cancer metastasis vs tuberculous pleurisy)':
        'CT/胸腔镜对照 – 胸膜结节（肺癌转移与结核性胸膜炎）',
      'CT/Spirometry – CAO pre/post stent (flow-volume loops, chemoradiotherapy response)':
        'CT/肺功能 – CAO 支架前后（流量-容积环、放化疗反应）',
      'CT/Ultrasound/CEUS – Epithelioid mesothelioma (bronchial arterial enhancement, washout)':
        'CT/超声/CEUS – 上皮样间皮瘤（支气管动脉强化、廓清）',
      'CT/Ultrasound/CEUS – Epithelioid mesothelioma (circular pleural thickening, systemic arterial enhancement)':
        'CT/超声/CEUS – 上皮样间皮瘤（环形胸膜增厚、体循环动脉强化）',
      'CXR/CT – Lobar Obstruction': '胸片/CT – 肺叶阻塞',
      'Central vs peripheral DVHs': '中央型与外周型 DVH 对比',
      'Chartis Assessment (Patient 1; RUL vs LUL; EIT)': 'Chartis 评估（患者 1；RUL 与 LUL；EIT）',
      'Chartis Pulmonary Assessment (System & Tracings)': 'Chartis 肺评估（系统与波形）',
      'Chest X-ray /CT – RMS endobronchial tumor': '胸片/CT – RMS 支气管腔内肿瘤',
      'Chest X-ray –  Postoperative Lobectom': '胸片 – 肺叶切除术后',
      'Chest X-ray – Coil placement (post-interventional)': '胸片 – 线圈置入（介入后）',
      'Chest X-ray – Edema/effusions resolving after diuresis': '胸片 – 利尿后水肿/积液消退',
      'Chest X-ray – Intrathoracic goiter management (ECMO support, ETT positioning, post-extubation)':
        '胸片 – 胸内甲状腺肿处理（ECMO 支持、ETT 位置、拔管后）',
      'Chest X-ray – Large left pneumothorax (post-bronchial valve, mediastinal shift)':
        '胸片 – 大量左侧气胸（支气管活瓣后、纵隔移位）',
      'Chest X-ray – Left lung atelectasis (pre/post stent for LMB stenosis)':
        '胸片 – 左肺肺不张（LMB 狭窄支架前后）',
      'Chest X-ray – Post-chest tube placement (residual loculated pneumothorax)':
        '胸片 – 胸管置入后（残余包裹性气胸）',
      'Chest X-ray – Post-valve LUL volume loss (hemothorax, endobronchial valves)':
        '胸片 – 活瓣后 LUL 容积减小（血胸、支气管内活瓣）',
      'Chest X-ray – Postoperative Lobectomy with atelectasis of residual parenchyma':
        '胸片 – 肺叶切除术后伴残余肺实质不张',
      'Chest X-ray – Pre-procedure COPD (bronchial valve candidate)':
        '胸片 – 操作前 COPD（支气管活瓣候选者）',
      'Chest X-ray – RLL mass (initial and follow-up with pleural effusion)':
        '胸片 – RLL 肿块（初始及伴胸腔积液的随访）',
      'Chest X-ray – Stent placement (LLL re-expansion)': '胸片 – 支架置入（LLL 复张）',
      'Chest X-ray – Thoracoscopy pre/post comparison (loculated empyema resolution)':
        '胸片 – 胸腔镜前后对比（包裹性脓胸消退）',
      'Chest X-ray – Tracheal deviation & mediastinal shift': '胸片 – 气管偏移与纵隔移位',
      'Chest X-ray – Tracheal shadow (bilateral pulmonary infiltrates)':
        '胸片 – 气管影（双侧肺浸润）',
      'Chest X-ray/Bronchoscopy – SEMS removal with silicone stent replacement (tracheal stenosis, Grade III)':
        '胸片/支气管镜 – 取出 SEMS 并更换硅酮支架（气管狭窄，III 级）',
      'Chest X-ray/CT Timeline – Pneumothorax management (drainage, stent placement, resolution)':
        '胸片/CT 时间线 – 气胸处理（引流、支架置入、消退）',
      'Chest X-ray/CT – LMB total occlusion (hilar mass with post-obstructive pneumonia)':
        '胸片/CT – LMB 完全闭塞（肺门肿块伴阻塞后肺炎）',
      'Chest X-ray/CT – Left spontaneous pneumothorax (chest tube, air-fluid level, specimen)':
        '胸片/CT – 左侧自发性气胸（胸管、气液平面、标本）',
      'Chest X-ray/CT/Bronchoscopy – SEMS removal failure (LMB, embedded stent, Natural stent insertion)':
        '胸片/CT/支气管镜 – SEMS 取出失败（LMB、支架嵌入、Natural 支架置入）',
      'Chest X-ray/CT/Pleuroscopy – Precut and cryobiopsy technique (adenocarcinoma with HE staining)':
        '胸片/CT/胸腔镜 – 预切开与冷冻活检技术（腺癌，HE 染色）',
      'Chest X-ray/CT/Pleuroscopy – Precut technique (biphasic mesothelioma biopsy with CAM/HE staining)':
        '胸片/CT/胸腔镜 – 预切开技术（双相型间皮瘤活检，CAM/HE 染色）',
      'Chest X-ray/CT/Ultrasound – Bilateral GGO (interlobular septal thickening, B-lines, pleural effusion)':
        '胸片/CT/超声 – 双侧 GGO（小叶间隔增厚、B 线、胸腔积液）',
      'Chest X-ray/CT/Ultrasound – Mediastinal Hodgkin lymphoma (prevascular mass, airway compression, pleural effusion)':
        '胸片/CT/超声 – 纵隔霍奇金淋巴瘤（血管前肿块、气道受压、胸腔积液）',
      'Classification – Bronchus sign types (CT-BS integrated schematic)':
        '分类 – 支气管征类型（CT-BS 综合示意图）',
      'Clinical Images – Post-operative T-tube insertion': '临床图像 – 术后 T 管置入',
      'Clinical Images – Tracheostomy stomal ulcer (vertical incision, pre/post healing)':
        '临床图像 – 气管切开造口溃疡（纵行切口，愈合前后）',
      'Combined Airway/Esophageal Stents (TEF; Fluoro‑Guided)':
        '气道/食管联合支架（TEF；透视引导）',
      'Confocal Laser Endomicroscopy – Squamous cell carcinoma vs adenocarcinoma (with cytology)':
        '共聚焦激光显微内镜 – 鳞状细胞癌与腺癌对比（含细胞学）',
      'Conventional VAL-MAP technique (step-by-step)': '常规 VAL-MAP 技术（分步图）',
      'Cribriform tumor structure (H&E 40× and 200×)': '肿瘤筛状结构（H&E 40× 和 200×）',
      'Cryo Generator (ERBE; First‑Generation)': '冷冻发生器（ERBE；第一代）',
      'Cryo Generator (ERBE‑CRYO II)': '冷冻发生器（ERBE-CRYO II）',
      'Cryo-debulking (endoluminal tumor)': '冷冻减容（腔内肿瘤）',
      'Cryotherapy (silicone stent-induced granulation)': '冷冻治疗（硅酮支架所致肉芽组织）',
      'Cryotherapy for polypoid tumors': '息肉样肿瘤冷冻治疗',
      'Cumulative dose summation': '累积剂量叠加',
      'Cytokeratin immunohistochemistry (negative)': '细胞角蛋白免疫组化（阴性）',
      'Cytology - Aspergilloma (Diff-Quik smear and GMS stain)':
        '细胞学 – 曲霉球（Diff-Quik 涂片和 GMS 染色）',
      'Cytology - Carcinoid/neuroendocrine tumor (Pap and H&E cell block)':
        '细胞学 – 类癌/神经内分泌肿瘤（Pap 与 H&E 细胞块）',
      'Cytology - EBUS-TBNA Mycobacterium avium-intracellulare infection in PET-positive lymph node':
        '细胞学 – PET 阳性淋巴结 EBUS-TBNA 显示鸟分枝杆菌复合群感染',
      'Cytology - EBUS-TBNA granuloma in PET-positive lymph node':
        '细胞学 – PET 阳性淋巴结 EBUS-TBNA 显示肉芽肿',
      'Cytology - EBUS-TBNA metastatic lung adenocarcinoma in PET-positive lymph node':
        '细胞学 – PET 阳性淋巴结 EBUS-TBNA 显示转移性肺腺癌',
      'Cytology - EBUS-TBNA metastatic squamous cell carcinoma in PET-positive lymph node':
        '细胞学 – PET 阳性淋巴结 EBUS-TBNA 显示转移性鳞状细胞癌',
      'Cytology - Granular cell tumor (Diff-Quik, H&E, S100/SOX10)':
        '细胞学 – 颗粒细胞瘤（Diff-Quik、H&E、S100/SOX10）',
      'Cytology - Granuloma in lung specimen (Field stain; cryptococcal infection context)':
        '细胞学 – 肺标本肉芽肿（Field 染色；隐球菌感染背景）',
      'Cytology - Hamartoma (fibromyxoid stroma, adipose tissue, cartilage)':
        '细胞学 – 错构瘤（纤维黏液样间质、脂肪组织、软骨）',
      'Cytology - Lung adenocarcinoma (Diff-Quik, high magnification)':
        '细胞学 – 肺腺癌（Diff-Quik，高倍）',
      'Cytology - Lung adenocarcinoma (Diff-Quik, very high magnification)':
        '细胞学 – 肺腺癌（Diff-Quik，超高倍）',
      'Cytology - Lung adenocarcinoma patterns (Pap and Diff-Quik)':
        '细胞学 – 肺腺癌形态（Pap 与 Diff-Quik）',
      'Cytology - Malignant mesothelioma, epithelioid subtype (Pap, H&E, BerEP4/calretinin)':
        '细胞学 – 恶性间皮瘤，上皮样亚型（Pap、H&E、BerEP4/钙网蛋白）',
      'Cytology - Non-small cell carcinoma (FNA)': '细胞学 – 非小细胞癌（FNA）',
      'Cytology - ROSE Diff-Quik examples (adenocarcinoma, squamous cell carcinoma, small cell carcinoma, tuberculosis)':
        '细胞学 – ROSE Diff-Quik 示例（腺癌、鳞状细胞癌、小细胞癌、结核）',
      'Cytology - Sarcoidosis granuloma (Pap and H&E cell block)':
        '细胞学 – 结节病肉芽肿（Pap 与 H&E 细胞块）',
      'Cytology - Small cell carcinoma (Pap and H&E cell block)':
        '细胞学 – 小细胞癌（Pap 与 H&E 细胞块）',
      'Cytology - Small cell lung cancer (FNA, Field stain)':
        '细胞学 – 小细胞肺癌（FNA、Field 染色）',
      'Cytology - Squamous cell carcinoma (Pap and H&E cell block)':
        '细胞学 – 鳞状细胞癌（Pap 与 H&E 细胞块）',
      'Cytology - Synovial sarcoma (Pap, H&E, Bcl2, FISH)':
        '细胞学 – 滑膜肉瘤（Pap、H&E、Bcl2、FISH）',
      'Cytology - Tuberculosis granuloma (Pap and H&E cell block)':
        '细胞学 – 结核性肉芽肿（Pap 与 H&E 细胞块）',
      'Cytology - WHO lung cytopathology: insufficient/inadequate specimen':
        '细胞学 – WHO 肺细胞病理：标本不足/不合格',
      'Cytology technique - Touch imprint ROSE from cryobiopsy specimen':
        '细胞学技术 – 冷冻活检标本触压印片 ROSE',
      'Cytology – Adenocarcinoma cells (high N/C ratio, TTF1 IHC)':
        '细胞学 – 腺癌细胞（高 N/C 比，TTF1 免疫组化）',
      'Cytology – Aspirated pus (epithelioid cells, lymphocytes, granuloma formation)':
        '细胞学 – 抽吸脓液（上皮样细胞、淋巴细胞、肉芽肿形成）',
      'Cytology – EBUS-FNA cell block vs smear (subcarinal metastatic adenocarcinoma)':
        '细胞学 – EBUS-FNA 细胞块与涂片对比（隆嵴下转移性腺癌）',
      'Cytology – Lymphocytes in aspirated material (H&E)': '细胞学 – 抽吸物中的淋巴细胞（H&E）',
      'Cytology – ROSE classification (Class 3 vs Class 4 cluster density)':
        '细胞学 – ROSE 分类（3 类与 4 类细胞团密度）',
      'Cytology – ROSE from EBUS-FNA (22G Mediglobe needle)':
        '细胞学 – EBUS-FNA 的 ROSE（Mediglobe 22G 针）',
      'Cytology/Histology - False-negative EBUS-FNA from CLL/SLL lymph node':
        '细胞学/组织学 – CLL/SLL 淋巴结 EBUS-FNA 假阴性',
      'Cytology/Histology - False-negative EBUS-FNA from metastatic squamous cell carcinoma in lymph node capsule':
        '细胞学/组织学 – 淋巴结包膜转移性鳞癌 EBUS-FNA 假阴性',
      'Cytology/Histology - Suboptimal EBUS-FNA from classical Hodgkin lymphoma':
        '细胞学/组织学 – 经典霍奇金淋巴瘤 EBUS-FNA 标本欠佳',
      'Cytology/Histology - Suboptimal EBUS-FNA from granulomatous lymphadenitis with hyalinization':
        '细胞学/组织学 – 伴玻璃样变的肉芽肿性淋巴结炎 EBUS-FNA 标本欠佳',
      'Diagram – Automated radiotherapy planning (RatoGuide and RayStation workflow)':
        '示意图 – 自动放疗规划（RatoGuide 与 RayStation 工作流）',
      'Diagram – Breath-hold technique (peak inspiration for intraprocedural imaging)':
        '示意图 – 屏气技术（术中成像时深吸气）',
      'Diagram – Central airway obstruction types': '示意图 – 中央气道阻塞类型',
      'Diagram – DTS scan orbits (SE and PL trajectories)':
        '示意图 – DTS 扫描轨迹（SE 与 PL 路径）',
      'Diagram – EBUS and EUS (complementary mediastinal lymph node staging)':
        '示意图 – EBUS 与 EUS（纵隔淋巴结互补分期）',
      'Diagram – Endobronchial tumor resection (electrocautery snare and RML sleeve lobectomy)':
        '示意图 – 支气管腔内肿瘤切除（电圈套器与 RML 袖式肺叶切除）',
      'Diagram – Lung nodule localization (spatial relationship to pleural surface)':
        '示意图 – 肺结节定位（与胸膜表面的空间关系）',
      'Diagram – MWA characteristics (ablation zones, oven effect, thermal sink effect)':
        '示意图 – MWA 特征（消融区、烤箱效应、热沉效应）',
      'Diagram – Mediastinal lymph node stations (EUS, EBUS, combination coverage)':
        '示意图 – 纵隔淋巴结分站（EUS、EBUS 及联合覆盖范围）',
      'Diagram – Normal vs iSGS trachea (anatomical comparison)':
        '示意图 – 正常气管与 iSGS 气管（解剖学对比）',
      'Diagram – RATS biportal and uniportal access positioning (schematic)':
        '示意图 – RATS 双孔与单孔入路定位（示意）',
      'Diagram – RATS main access positioning (schematic with mini-thoracotomy)':
        '示意图 – RATS 主入路定位（含小切口开胸示意）',
      'Diagram – RATS main access positioning (schematic with tunneling)':
        '示意图 – RATS 主入路定位（含隧道建立示意）',
      'Diagram – RATS main access positioning (schematic)': '示意图 – RATS 主入路定位（示意）',
      'Diagram – Robotic bronchoscopy room setup (Monarch, Ion, Galaxy platforms)':
        '示意图 – 机器人支气管镜检查室布局（Monarch、Ion、Galaxy 平台）',
      'Diagram – SSN natural history (seven progression types, growth rate classification)':
        '示意图 – SSN 自然史（七种进展类型及生长速度分类）',
      'Diagram – Tracheal ring injuries (classification)': '示意图 – 气管环损伤（分类）',
      'Diagram – Tracheostomy puncture deviation measurement (protractor technique)':
        '示意图 – 气管切开穿刺偏移测量（量角器法）',
      'Diagram – VAL-MAP 2.0 workflow (microcoil placement, 3D reconstruction, fluoroscopy-guided resection)':
        '示意图 – VAL-MAP 2.0 工作流程（微线圈置入、3D 重建及透视引导切除）',
      'Diagram – VATS technique': '示意图 – VATS 技术',
      'Diagram – iSGS treatment approaches (dilation, resection, open surgery)':
        '示意图 – iSGS 治疗方法（扩张、切除及开放手术）',
      'Digital Pathology – Quantitative analysis workflow (calibration and threshold measurement)':
        '数字病理 – 定量分析流程（校准与阈值测量）',
      'Direct Laryngoscopy – Subglottic stenosis (0-degree endoscope view)':
        '直接喉镜 – 声门下狭窄（0 度内镜视图）',
      'Double lumen ETT for Y-stent placement (pusher system with monitoring tube)':
        '用于置入 Y 形支架的双腔 ETT（带监测管的推进系统）',
      'Double‑Lumen Tube via Stoma': '经造口置入双腔管',
      'Dynamic stenosis and stent complications (Y-silicone stent, metallic stent, granulation)':
        '动态性狭窄及支架并发症（Y 形硅酮支架、金属支架及肉芽组织）',
      'EBUS thyroid aspiration (poorly differentiated adenocarcinoma, TTF1/CEA/CK7 IHC)':
        'EBUS 甲状腺穿刺抽吸（低分化腺癌，TTF1/CEA/CK7 免疫组化）',
      'EBUS – Mini‑Forceps (Mediastinal Biopsy)': 'EBUS – 微型活检钳（纵隔活检）',
      'EBUS-FNA squamous cell carcinoma (H&E, p40 and CK14 IHC)':
        'EBUS-FNA 鳞状细胞癌（H&E、p40 和 CK14 免疫组化）',
      'EBUS-TBNA staging - PET-positive lymph node diagnostic flowchart':
        'EBUS-TBNA 分期：PET 阳性淋巴结诊断流程图',
      'EBUS-TBNA – Lymph node aspiration (pus drainage)': 'EBUS-TBNA – 淋巴结穿刺抽吸（脓液引流）',
      'EBUS-TBNA – Subcarinal lymph node (sarcoidosis granuloma, color Doppler, ROSE correlation)':
        'EBUS-TBNA – 隆突下淋巴结（结节病肉芽肿、彩色多普勒及 ROSE 对照）',
      'EBUS/CT Registration – Station 4L nodes (segmented ROI, virtual EBUS views)':
        'EBUS/CT 配准 – 4L 站淋巴结（分割 ROI 与虚拟 EBUS 视图）',
      'EBUS/CT Registration – Station-10 lymph node (segmentation and ROI correlation)':
        'EBUS/CT 配准 – 10 站淋巴结（分割及 ROI 对照）',
      'EBUS/CT/PET Correlation – Image-guided navigation (4R lymph node with 3D rendering)':
        'EBUS/CT/PET 对照 – 影像引导导航（4R 淋巴结及 3D 渲染）',
      'EBUS/CT/PET Correlation – Transvascular EBUS-TBNA (interlobar lymph node and RUL nodule)':
        'EBUS/CT/PET 对照 – 经血管 EBUS-TBNA（叶间淋巴结及 RUL 结节）',
      'EBUS/EUS': 'EBUS/EUS',
      'EBUS/EUS – Combined station access map': 'EBUS/EUS – 联合分站到达范围图',
      'EBUS/EUS‑B – CT/PET/Path Correlation (Adenocarcinoma)':
        'EBUS/EUS-B – CT/PET/病理对照（腺癌）',
      'EBUS/PET/CT Correlation – Image-guided navigation (4R lymph node, registered views)':
        'EBUS/PET/CT 对照 – 影像引导导航（4R 淋巴结，配准视图）',
      'EBUS‑TBNA – Peripheral nodules (left lung)': 'EBUS-TBNA – 外周结节（左肺）',
      'EBUS‑TBNA – Peripheral nodules (right lung)': 'EBUS-TBNA – 外周结节（右肺）',
      'EIT/CT Correlation – BLVR perfusion distributions (balloon vs valves, left hemithorax)':
        'EIT/CT 对照 – BLVR 后灌注分布（球囊与瓣膜对比，左侧胸腔）',
      'ENB (4D) – Multiplanar CT + Real‑Time Sampling': 'ENB（4D）– 多平面 CT 与实时取样',
      'ENB – CBCT Assistance (ICG Marking; Hybrid OR)': 'ENB – CBCT 辅助（ICG 标记；复合手术室）',
      'ENB – CBCT‑Guided MWA (Devices & Steps)': 'ENB – CBCT 引导 MWA（器械与步骤）',
      'ENB – Edge Catheter (EWC SD180EWCTE‑FT)': 'ENB – Edge 导管（EWC SD180EWCTE-FT）',
      'ENB – Equipment (Therapeutic Scope + EWC + Cryoprobe)':
        'ENB – 设备（治疗型支气管镜 + EWC + 冷冻探针）',
      'ENB – GGO Dye Marking (3D Recon + ENB Screen)': 'ENB – GGO 染料标记（3D 重建 + ENB 屏幕）',
      'ENB – Illumisite (Fluoroscopic Navigation Set)': 'ENB – Illumisite（透视导航系统）',
      'ENB – Pleural Dye Marking (Workflow)': 'ENB – 胸膜染料标记（工作流程）',
      'ENB – SuperDimension (Case 1 Mapping)': 'ENB – SuperDimension（病例 1 映射）',
      'ENB – SuperDimension (Case 2 Mapping)': 'ENB – SuperDimension（病例 2 映射）',
      'ENB – SuperDimension (Virtual Proximity at Target)': 'ENB – 靶点虚拟邻近度',
      'ENB – Virtual-assisted lung mapping (LG catheter, indigo carmine injection sequence)':
        'ENB – 虚拟辅助肺定位（LG 导管、靛胭脂注射序列）',
      'ENB – “Artery Sign” Pathway Planning': 'ENB – “动脉征”路径规划',
      'EUS – Aortopulmonary Window (Landmark View)': 'EUS – 主动脉肺动脉窗（解剖标志视图）',
      'EUS – Elastography (lung cancer evaluation)': 'EUS – 弹性成像（肺癌评估）',
      'EUS – Left adrenal mass (sliding view, needle placement)':
        'EUS – 左肾上腺肿块（滑动视图及进针）',
      'EUS – Lymph Nodes (Benign vs Malignant Patterns)': 'EUS – 淋巴结（良性与恶性模式）',
      'EUS – Mediastinal Lymph Node (Breast Cancer Metastasis)': 'EUS – 纵隔淋巴结（乳腺癌转移）',
      'EUS – Mediastinal Lymph Node (Sarcoidosis)': 'EUS – 纵隔淋巴结（结节病）',
      'EUS – Subcarinal Lymph Node (Diameter 21.4 mm)': 'EUS – 隆突下淋巴结（直径 21.4 mm）',
      'EUS – Thoracic Aorta (Mirror Image Artifact)': 'EUS – 胸主动脉（镜像伪影）',
      'EUS/CT – Pulmonary embolism (right main pulmonary artery)':
        'EUS/CT – 肺栓塞（右肺动脉主干）',
      'EUS‑B – FNA Findings (Left Atrium Invasion)': 'EUS-B – FNA 所见（左心房侵犯）',
      'EUS‑B – Fujifilm (Landmarks)': 'EUS-B – Fujifilm（解剖标志）',
      'Early Endobronchial Lesion (Silver Hue)': '早期支气管内病变（银色调）',
      'Early squamous cell carcinoma (central airways)': '早期鳞状细胞癌（中央气道）',
      'Elastography (Type 1–3 Examples)': '弹性成像（1–3 型示例）',
      'Elastography (subcarinal lymph node with lung adenocarcinoma)':
        '弹性成像（肺腺癌伴隆突下淋巴结）',
      'Elastography Types (inflammation vs small cell carcinoma with ROSE correlation)':
        '弹性成像分型（炎症与小细胞癌对比，并与 ROSE 对照）',
      'Electrosurgery (grounding plate, probe, snare, power unit with pedal)':
        '电外科（负极板、探头、圈套器及带脚踏开关的电源主机）',
      'Endobronchial Mass (Tracheal Lesion at Presentation)': '支气管内肿块（初诊时气管病变）',
      'Endobronchial hamartoma (core-out and cryotherapy sequence)':
        '支气管内错构瘤（核心切除及冷冻治疗序列）',
      'Endobronchial leiomyoma (LMB obstruction, EC snare/cryo debulking)':
        '支气管内平滑肌瘤（LMB 阻塞，EC 圈套器/冷冻减瘤）',
      'Endobronchial lipoma (cryorecanalization sequence)': '支气管内脂肪瘤（冷冻再通序列）',
      'Endobronchial lipoma (mature adipose tissue with mucoid changes, H&E)':
        '支气管内脂肪瘤（成熟脂肪组织伴黏液样改变，H&E）',
      'Endobronchial mucous adenoma (treatment timeline with histology)':
        '支气管内黏液腺瘤（治疗时间线及组织学）',
      'Endobronchial tumor (middle lobe, pre/post resection)': '支气管内肿瘤（中叶，切除前后）',
      'Endobronchial tumor (polypoid lesion, H&E with myxoid stroma)':
        '支气管内肿瘤（息肉样病变，H&E 示黏液样间质）',
      'Endobronchial tumor (pre- and post-ablation biopsy comparison, H&E)':
        '支气管内肿瘤（消融前后活检对比，H&E）',
      'Endoluminal Carcinoid (Resection Correlation)': '腔内类癌（切除对照）',
      'Endometriosis (Visceral and Parietal; Lesion Types)':
        '子宫内膜异位症（脏层与壁层；病变类型）',
      Equipment: '设备',
      'Esophageal Stent Migration (Relocation Under Fluoro)': '食管支架移位（透视下复位）',
      'Extrinsic CAO (silicone Y-stent for airway recanalization)':
        '外压型 CAO（Y 形硅酮支架用于气道再通）',
      'Extrinsic Compression (Example 1)': '外源性压迫（示例 1）',
      'Extrinsic Compression (Goiter; Pre/Post‑Op)': '外源性压迫（甲状腺肿；术前/术后）',
      'FFOCT-DCI – Technique description (high-resolution 3D biopsy imaging)':
        'FFOCT-DCI – 技术说明（高分辨率 3D 活检成像）',
      'FOT placement above stenosis (rigid scope insertion with cuff)':
        '狭窄上方 FOT 置入（带套囊的硬质镜插入）',
      'FOT placement for carinal obstruction (cuff inflation technique)':
        '隆突阻塞的 FOT 置入（套囊充气技术）',
      'Fibroepithelial tumor (LUL superior segment, pre/post treatment)':
        '纤维上皮性肿瘤（LUL 上段，治疗前后）',
      'Fibrotic Stenosis (Left Main Bronchus)': '纤维性狭窄（左主支气管）',
      'Fluid Aspiration (Clear Yellow)': '液体抽吸（清亮黄色）',
      'Fluoroscopy – Bilateral SEMS placement (side-by-side method, step-by-step)':
        '透视 – 双侧 SEMS 置入（并列法，分步展示）',
      'Fluoroscopy – ICG‑Soaked Coil Deployment': '透视 – ICG 浸泡线圈释放',
      'Fluoroscopy – Transbronchial biopsy techniques (ultrathin vs thin bronchoscope with guide sheath)':
        '透视 – 经支气管活检技术（超细支气管镜与带导向鞘的细支气管镜对比）',
      'Fluoroscopy – rEBUS guidance': '透视 – rEBUS 引导',
      'Fluoroscopy/CBCT – Multimodal navigation (RAB tool-in-lesion confirmation)':
        '透视/CBCT – 多模态导航（确认 RAB 工具位于病灶内）',
      'Fluoroscopy/Chest X-ray – Visicoil fiducial markers (triangulated pattern, augmented fluoroscopy)':
        '透视/胸部 X 线 – Visicoil 基准标记物（三角定位模式、增强透视）',
      'Fluoroscopy/Pathology – Lung nodule resection confirmation (ICG-coil marker, specimen)':
        '透视/病理 – 肺结节切除确认（ICG-线圈标记物及标本）',
      'Fogarty Balloon (Hemoptysis Control)': 'Fogarty 球囊（咯血控制）',
      'Foreign Bodies – Tracheobronchial specimens (dental device, nail, coin, grape)':
        '异物 – 气管支气管标本（牙科装置、钉子、硬币、葡萄）',
      'Foreign Body Removal (Examples)': '异物取出（示例）',
      'Foreign body removal (intermediate bronchus, granulation cautery, basket/forceps techniques)':
        '异物取出（中间支气管、肉芽组织烧灼及网篮/活检钳技术）',
      'Forensics – Tracheal ring injuries (autopsy)': '法医学 – 气管环损伤（尸检）',
      'Galaxy System (C-arm with TiLT tomosynthesis technology)':
        'Galaxy 系统（采用 TiLT 断层合成技术的 C 形臂）',
      'Granulation Tissue (Distal to Stent)': '肉芽组织（支架远端）',
      'Granulation Tissue (Proximal to Stent)': '肉芽组织（支架近端）',
      'HFJV devices': 'HFJV 设备',
      'HRCT fissure assessment (visual)': 'HRCT 肺裂评估（目测）',
      'High-flow nasal oxygen (uses and contraindications)': '高流量鼻氧（用途与禁忌证）',
      'Hybrid OR – CBCT System (Ceiling‑Mounted)': '复合手术室 – CBCT 系统（吊顶式）',
      'Hybrid OR – CBCT‑guided bronchoscopy setup': '复合手术室 – CBCT 引导支气管镜检查配置',
      'Hybrid OR – Mobile CBCT (Cios Spin) setup': '复合手术室 – 移动式 CBCT（Cios Spin）配置',
      'IR – Bronchial artery embolization for hemoptysis': '介入放射学 – 支气管动脉栓塞治疗咯血',
      'Illumisite (Fluoro Navigation + Tomosynthesis)': 'Illumisite（透视导航 + 断层合成）',
      'Image Processing – Registration algorithm comparison (MSE, MoMSE, improved MoMSE)':
        '图像处理 – 配准算法比较（MSE、MoMSE、改进型 MoMSE）',
      Imaging: '影像学',
      'Immunohistochemistry panel (CD20, Ki67, Bcl-2, TdT)':
        '免疫组化面板（CD20、Ki67、Bcl-2、TdT）',
      'Instrumentation – CoreCath 2.7S (Multimodal Debulking)':
        '器械 – CoreCath 2.7S（多模态减瘤）',
      'Instrumentation – Crown‑Cut Tip Needle': '器械 – 冠状切割针尖',
      'Instrumentation – Nodule Marking Kit (ICG/Guidewire/Brush/Coil)':
        '器械 – 结节标记套件（ICG/导丝/刷/线圈）',
      'Instrumentation – Olympus Accessories (Forceps, Guide Sheath)':
        '器械 – Olympus 附件（活检钳、导向鞘）',
      'Integrated bronchoscope (video camera and 2D transducer, axes diagram)':
        '一体化支气管镜（摄像头与 2D 换能器、轴向示意图）',
      'Intraoperative Imaging – ICG dye localization (VATS with fiducial marker)':
        '术中成像 – ICG 染料定位（VATS 联合基准标记物）',
      'Intraoperative Imaging – NIR fluorescence with ICG (Firefly mode vs white-light)':
        '术中成像 – ICG 近红外荧光（Firefly 模式与白光对比）',
      'Kaposi Sarcoma (Forceps vs Cryobiopsy vs FNA)': '卡波西肉瘤（活检钳、冷冻活检与 FNA 对比）',
      'LMB occlusion management (microdebrider debulking, APC, stent placement)':
        'LMB 闭塞处理（微型清创器减瘤、APC 及支架置入）',
      'LMB stenosis (nitinol stent, 7-year follow-up)': 'LMB 狭窄（镍钛合金支架，随访 7 年）',
      'Laser Console': '激光主机',
      'Laser coagulation (distal trachea SCC, Nd:YAG)': '激光凝固（远端气管 SCC，Nd:YAG）',
      'Laser tube (double cuff, laser guard foil) and rigid bronchoscopy ventilation challenge':
        '激光气管导管（双套囊、激光防护箔）及硬质支气管镜通气挑战',
      'Laser tube positioning (RMB anatomy)': '激光气管导管定位（RMB 解剖）',
      'LaserJet catheter (dual lumen for gas delivery and pressure monitoring)':
        'LaserJet 导管（双腔，用于气体输送及压力监测）',
      'Laser–Stent Therapy for CAO': 'CAO 的激光–支架治疗',
      'Lateral Puncture Risks (Force Vectors)': '侧向穿刺风险（力矢量）',
      'Localization – CBCT‑assisted ENB marking': '定位 – CBCT 辅助 ENB 标记',
      'Localization – Hookwire (CBCT‑guided)': '定位 – 钩丝（CBCT 引导）',
      'Localization – Lipiodol (CT‑guided)': '定位 – 碘油（CT 引导）',
      'Localization – Steel needle (CT‑guided)': '定位 – 钢针（CT 引导）',
      'Localization – VNB‑guided ICG fluorescence': '定位 – VNB 引导 ICG 荧光',
      'Lung cryobiopsy (H&E and ex-vivo confocal microscopy)':
        '肺冷冻活检（H&E 及离体共聚焦显微镜）',
      'Lungpro-assisted metallic marker localization': 'Lungpro 辅助金属标记物定位',
      'Lymph Node Aspiration (Cytology/Granulomas)': '淋巴结穿刺抽吸（细胞学/肉芽肿）',
      'Lymph node squamous cell carcinoma (H&E low magnification)': '淋巴结鳞状细胞癌（H&E 低倍）',
      'MAO bilateral main bronchi (pre/post therapy, Y-stent)':
        '双侧主支气管 MAO（治疗前后，Y 形支架）',
      'MRI‑guided SBRT vs ITV planning': 'MRI 引导 SBRT 与 ITV 计划对比',
      'MWA Inside Silicone Stent (Ball‑Valve Tumor)': '硅酮支架内 MWA（球阀样肿瘤）',
      'Magnetic Navigation – Pulmonary nodule localization (RUL, methylene blue, thoracoscopic verification)':
        '磁导航 – 肺结节定位（RUL、亚甲蓝、胸腔镜验证）',
      'Malignant mesothelioma (epithelioid and sarcomatoid, WT1 and calretinin IHC)':
        '恶性间皮瘤（上皮样及肉瘤样，WT1 和 calretinin 免疫组化）',
      'Manual vs automated pathways (RB8 nodule with REBUS confirmation)':
        '手动与自动路径（RB8 结节，REBUS 确认）',
      'Marking coil and ICG loading kit': '标记线圈与 ICG 装载套件',
      'Mediastinitis with Tracheal Fistula Drainage': '纵隔炎伴气管瘘引流',
      'Medical Thoracoscopy – Cryobiopsy (Peripheral Tumor)': '内科胸腔镜 – 冷冻活检（外周肿瘤）',
      'Medical Thoracoscopy – Precut Biopsy (Stepwise)': '内科胸腔镜 – 预切开活检（分步展示）',
      'Metallic airway stent (main body, RUB, RMB branches)':
        '金属气道支架（主体及 RUB、RMB 分支）',
      'Microwave Ablation (LMS Tumor)': '微波消融（LMS 肿瘤）',
      'Mini‑Open (Marks and Final Appearance)': '小切口开放术（标记及最终外观）',
      Miscellaneous: '其他',
      'Mixed CAO (cryo-debulking and stent placement)': '混合型 CAO（冷冻减瘤及支架置入）',
      'Mixed CAO Resected (Airway Restored)': '混合型 CAO 切除后（气道恢复）',
      'Modified Y stent placement (bronchiectasis, occluded LUL branch)':
        '改良 Y 形支架置入（支气管扩张，LUL 分支闭塞）',
      'Modified blade device (cylindrical handle with blade holder for bronchoscopy)':
        '改良刀片装置（用于支气管镜操作的圆柱形手柄及刀片夹）',
      'Modified silicone Y stent removal (post-tuberculous destroyed lung)':
        '改良 Y 形硅酮支架取出（结核后毁损肺）',
      'Modified silicone stent design (main, lateral, and occluded branches with rings)':
        '改良硅酮支架设计（主支、侧支及带环封闭支）',
      'Monarch system interface (conventional and virtual bronchoscopic pathways)':
        'Monarch 系统界面（常规与虚拟支气管镜路径）',
      'Montgomery T-tube placement (subglottic stenosis, pre/post)':
        'Montgomery T 管置入（声门下狭窄，术前/术后）',
      'Multimodal CAO management (carinal SCC, laser, Y stent, radiation)':
        'CAO 多模态治疗（隆突 SCC、激光、Y 形支架及放疗）',
      'Multimodal MCAO management (bilateral stent placement with spray cryotherapy)':
        'MCAO 多模态治疗（双侧支架置入联合喷射冷冻治疗）',
      'Multimodal bronchoscope views (real vs virtual EBUS/video diagram)':
        '多模态支气管镜视图（真实与虚拟 EBUS/视频示意图）',
      'Multiple lung nodules (AIS, MIA, chronic inflammation, H&E)':
        '多发肺结节（AIS、MIA、慢性炎症，H&E）',
      'NIV mask with bronchoscope entry port': '带支气管镜入口的 NIV 面罩',
      'NTM cavities pre/post valve': 'NTM 空洞在瓣膜置入前后',
      'Needle Insertion into Target Mass': '针刺入靶肿块',
      'Neoplasia in airway stent (endoscopic resection sequence)': '气道支架内肿瘤（内镜切除序列）',
      'Nuclear Medicine – Lung perfusion scintigraphy': '核医学 – 肺灌注显像',
      'Olympus Exera III tower (bronchoscopes and processors)':
        'Olympus Exera III 主机系统（支气管镜及处理器）',
      'PDT (Early Lung Cancer; Fiber Alongside Lesion)': 'PDT（早期肺癌；光纤位于病灶旁）',
      'PET – LLL mass': 'PET – LLL 肿块',
      'PET – Pulmonary Nodule': 'PET – 肺结节',
      'PET-CT – Abnormal cartilage metabolism (thyroid, tracheal, rib cartilage)':
        'PET-CT – 软骨代谢异常（甲状软骨、气管软骨及肋软骨）',
      'PET/CT/Clinical – Mediastinal mass with tracheal compression (Ultraflex stent deployment, post-CTA)':
        'PET/CT/临床 – 纵隔肿块伴气管受压（Ultraflex 支架释放，CTA 后）',
      'PLCH vs HP (fibromyxoid foci and interstitial fibrosis)':
        'PLCH 与 HP 对比（纤维黏液样灶及间质纤维化）',
      'Paratracheal tumor excision (covered stent with balloon dilation)':
        '气管旁肿瘤切除（覆膜支架联合球囊扩张）',
      'Path Correlation (Malignant Mass Adjacent to Aorta)': '病理对照（邻近主动脉的恶性肿块）',
      Pathology: '病理学',
      'Patient Positioning (Thoracoscopy)': '患者体位（胸腔镜）',
      'Percutaneous Dilatational Technique (Ciaglia)': '经皮扩张技术（Ciaglia）',
      'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)':
        '外周支气管镜（导航/机器人/术中影像）',
      'Physiology – Mechanisms of Atelectasis & Resistance (Diagram)':
        '生理学 – 肺不张与阻力机制（示意图）',
      'Pleura/Vascular Tumor – CT/MR & pathology': '胸膜/血管肿瘤 – CT/MR 与病理',
      'Pleural Cryobiopsy vs Forceps (Tissue Integrity/Size)':
        '胸膜冷冻活检与活检钳对比（组织完整性/大小）',
      'Pleural Endometriosis with Stromal Invasion': '胸膜子宫内膜异位症伴间质浸润',
      'Pleural Procedures': '胸膜操作',
      'Pleuropulmonary blastoma (chondrosarcoma, glandular and blastemal components, H&E)':
        '胸膜肺母细胞瘤（软骨肉瘤样、腺体及胚芽成分，H&E）',
      'Pleuroscopy Equipment – Conventional vs new pleuroscope comparison (biopsy forceps positioning)':
        '胸腔镜设备 – 传统与新型胸腔镜比较（活检钳定位）',
      'Pleuroscopy Equipment – Diameter comparison (LTF-240 vs LTF-Y0032)':
        '胸腔镜设备 – 直径比较（LTF-240 与 LTF-Y0032）',
      "Pleuroscopy instruments (semirigid scope, forceps, Abram's needle, cryoprobe)":
        '胸腔镜器械（半硬质镜、活检钳、Abrams 针及冷冻探针）',
      'Pleuroscopy – Biphasic mesothelioma and pleural metastasis (LTF-Y0032 with 180° curvature)':
        '胸腔镜 – 双相型间皮瘤及胸膜转移（LTF-Y0032，180° 弯曲）',
      'Pleuroscopy – Empyema (thick loculated with fibrin membrane)':
        '胸腔镜 – 脓胸（厚壁分隔伴纤维蛋白膜）',
      'Pleuroscopy – Lesion distribution map (visceral and parietal locations by segments)':
        '胸腔镜 – 病变分布图（按肺段标示脏层与壁层位置）',
      'Pleuroscopy – Malignant mesothelioma and lymphoma (NBI with vascular patterns)':
        '胸腔镜 – 恶性间皮瘤及淋巴瘤（NBI 血管模式）',
      'Pleuroscopy/Bronchoscopy – Pleural adhesions and whitish mass (right bronchus intermedius)':
        '胸腔镜/支气管镜 – 胸膜粘连及白色肿块（右中间支气管）',
      'Pleuroscopy/Pathology – Normal parietal pleura pCLE features (chia seed sign, H&E correlation)':
        '胸腔镜/病理 – 正常壁层胸膜 pCLE 特征（奇亚籽征，与 H&E 对照）',
      'Pleuroscopy/Pathology – pCLE features (pleural metastasis with H&E correlation)':
        '胸腔镜/病理 – pCLE 特征（胸膜转移，与 H&E 对照）',
      'Polypoid lesion (RMB vascularized tumor)': '息肉样病变（RMB 富血供肿瘤）',
      'Postoperative timeline (pre-op to 3.5 years)': '术后时间线（术前至 3.5 年）',
      'Post‑PDT Debris (Bronchoscopic View)': 'PDT 后碎屑（支气管镜视图）',
      'Post‑Transplant Airway Complication Types': '移植后气道并发症类型',
      'Post‑Transplant Hyperinflation (Patient 2; EIT+Chartis)':
        '移植后过度充气（患者 2；EIT + Chartis）',
      'Post‑transplant – Stent for anastomotic dehiscence': '移植后 – 吻合口裂开的支架治疗',
      'Precut Step‑Up Biopsy Strategy (Schematic)': '预切开逐级活检策略（示意图）',
      'Predicted vs deliverable dose (DSC)': '预测剂量与可实施剂量对比（DSC）',
      'Probe model (device tip and 2D fan-shaped view diagram)':
        '探头模型（器械尖端及 2D 扇形视野示意图）',
      'Procedure – Guidewire positioning (14G IV catheter insertion)':
        '操作 – 导丝定位（置入 14G IV 导管）',
      'Procedure – Sheath-free Amplatzer device deployment method (guide wire technique)':
        '操作 – Amplatzer 器械无鞘释放法（导丝技术）',
      'Procedure – Tracheostomy Ciaglia method (dilation and cannula insertion)':
        '操作 – Ciaglia 气管切开法（扩张及套管置入）',
      'Procedure – Tracheostomy anatomical landmarks (fiberoptic guidance, depth marking, puncture angle)':
        '操作 – 气管切开解剖标志（纤维支气管镜引导、深度标记及穿刺角度）',
      'Protocol – Breath‑Hold Timing & Hemodynamics': '方案 – 屏气时机与血流动力学',
      'Protocol – Ventilation (Recruitment / PEEP / “40 for 40” Note)':
        '方案 – 通气（肺复张/PEEP/“40 for 40”说明）',
      'Prototype CP-EBUS with electromagnetic sensor': '带电磁传感器的 CP-EBUS 原型',
      'Purulent Aspiration (Gauge 19)': '脓性物抽吸（19 号）',
      'RAB – First‑pass peripheral sampling': 'RAB – 首次通过外周取样',
      'RAB – Integrated multimodal monitors': 'RAB – 集成式多模态监视器',
      'RAB – Ion platform': 'RAB – Ion 平台',
      'RAB – Microwave ablation platforms': 'RAB – 微波消融平台',
      'RAB – Monarch platform': 'RAB – Monarch 平台',
      'RAB – Navigation alignment (no rEBUS)': 'RAB – 导航对准（无 rEBUS）',
      'RATS – Azygos vein exposure': 'RATS – 奇静脉显露',
      'RATS – Dual‑port mapping': 'RATS – 双孔映射',
      'RATS – Post‑azygos division': 'RATS – 奇静脉离断后',
      'RFID marker placement (wedge resection steps)': 'RFID 标记物置入（楔形切除步骤）',
      'ROSE/Pathology Comparison – Forceps vs cryobiopsy (metastatic urothelial carcinoma and adenocarcinoma)':
        'ROSE/病理对比 – 活检钳与冷冻活检（转移性尿路上皮癌及腺癌）',
      'Radial ultrasound probes (UM-S20-17S and UM-S20-20R-3)':
        '径向超声探头（UM-S20-17S 和 UM-S20-20R-3）',
      'Radiation Protection – Operator shielding': '辐射防护 – 操作者屏蔽',
      'Radiation shielding setup (lead-equivalent plate and curtain for operators)':
        '辐射屏蔽配置（供操作者使用的铅当量防护板及防护帘）',
      Radiotherapy: '放射治疗',
      'Radiotherapy – IMRT vs VMAT comparison (66 Gy, dose-volume histogram)':
        '放疗 – IMRT 与 VMAT 比较（66 Gy，剂量-体积直方图）',
      'Recanalization Post‑Procedure (Trachea)': '术后再通（气管）',
      'Rigid Bronchoscopy – Laser/Device Positioning': '硬质支气管镜 – 激光/器械定位',
      'Rigid Bronchoscopy – Mechanical Debulking (Tip of Scope)':
        '硬质支气管镜 – 机械减瘤（镜身尖端）',
      'Rigid Bronchoscopy – Microdebrider (Rotating Tip)': '硬质支气管镜 – 微型清创器（旋转尖端）',
      'Rigid Bronchoscopy – Radial Incisions (Blade; 4/8/12 o’clock)':
        '硬质支气管镜 – 放射状切开（刀片；4/8/12 点方向）',
      'Rigid Bronchoscopy – Subglottic Stenosis (Severe; Pre‑Treatment)':
        '硬质支气管镜 – 声门下狭窄（重度；治疗前）',
      'Rigid Bronchoscopy – Ventilation via Side Port': '硬质支气管镜 – 经侧孔通气',
      'Rigid bronchoscope (shaft with fenestration, multifunction head components)':
        '硬质支气管镜（带开窗的镜筒及多功能头部组件）',
      'Rigid bronchoscope and suction catheter (carina level)':
        '硬质支气管镜及吸引导管（隆突水平）',
      'Rigid bronchoscope marking (intubation length measurement)':
        '硬质支气管镜标记（插管长度测量）',
      'Rigid bronchoscope tools (Karl Storz system, various lengths and instruments)':
        '硬质支气管镜器械（Karl Storz 系统，多种长度及器械）',
      'Rigid suction catheter setup (three-way stopcock and gas analyzer)':
        '硬质吸引导管配置（三通阀及气体分析仪）',
      'Rigid suction catheter with gas analyzer connection': '硬质吸引导管连接气体分析仪',
      'Robotic Bronchoscopy – Navigation platforms (Monarch, Ion, Galaxy with TILT technology)':
        '机器人支气管镜 – 导航平台（Monarch、Ion、采用 TILT 技术的 Galaxy）',
      'Robotic CBCT bronchoscope setup (designed bracket)':
        '机器人 CBCT 支气管镜配置（专门设计的支架）',
      'Robotic bronchoscopy interface (real-time and virtual bronchoscopic views)':
        '机器人支气管镜界面（实时与虚拟支气管镜视图）',
      'Robotic system interface (real-time scope view, RUL nodule pathway)':
        '机器人系统界面（实时镜下视图、RUL 结节路径）',
      'Robotic – CBCT Collision Awareness (Alignment)': '机器人 – CBCT 碰撞感知（对准）',
      'Robotic – Catheter Display with Distance Metrics': '机器人 – 带距离指标的导管显示',
      'Robotic – Controller Interfaces (Ion/Monarch/Galaxy)':
        '机器人 – 控制器界面（Ion/Monarch/Galaxy）',
      'Robotic – Floor Plan (Hybrid OR Layout)': '机器人 – 平面布局（复合手术室配置）',
      'Robotic – Hybrid OR Workflow (Team & Screens)': '机器人 – 复合手术室工作流程（团队与屏幕）',
      'Robotic – Ion + CBCT (Multiplanar Tool‑in‑Lesion)':
        '机器人 – Ion + CBCT（多平面确认工具位于病灶内）',
      'Robotic – Monarch (Multiscreen Panels)': '机器人 – Monarch（多屏面板）',
      'Robotic – Monarch + CBCT in Hybrid OR': '机器人 – 复合手术室内 Monarch + CBCT',
      'Robotic – Multisource Display (Fluoro/EBUS/CT)': '机器人 – 多源显示（透视/EBUS/CT）',
      'Robotic – Needle Aspiration (Tool Exit Orientation)': '机器人 – 针吸活检（工具出口方向）',
      'Robotic – REBUS Patterns (Eccentric → Concentric)': '机器人 – REBUS 模式（偏心 → 同心）',
      'Robotic – REBUS Target Relationship (Probe Orientation)':
        '机器人 – REBUS 与靶点关系（探头方向）',
      'Robotic – Registration Steps (Ion Example)': '机器人 – 配准步骤（Ion 示例）',
      'Robotic – Setup with Artis Zeego CBCT': '机器人 – Artis Zeego CBCT 配置',
      'Robotic – System Comparison (Yield & Tech)': '机器人 – 系统比较（诊断率与技术）',
      'Robotic – System Gallery (Monarch/Ion/Galaxy)': '机器人 – 系统图集（Monarch/Ion/Galaxy）',
      'Robotic – Unicorn RAB System (China)': '机器人 – Unicorn RAB 系统（中国）',
      'Room Setup (Fixed C‑Arm; Bronchoscopy Positioning)':
        '房间配置（固定式 C 形臂；支气管镜定位）',
      'S-100 immunohistochemistry (positive)': 'S-100 免疫组化（阳性）',
      'SBRT plan: PET & dose (48 Gy)': 'SBRT 计划：PET 与剂量（48 Gy）',
      'SBRT plan: PET & dose (60 Gy)': 'SBRT 计划：PET 与剂量（60 Gy）',
      'SEMS for tracheoesophageal fistula (mechanical ventilation, no fluoroscopy)':
        '用于气管食管瘘的 SEMS（机械通气，无透视）',
      'SEMS removal (embedded stent, laser vaporization, Y-shape SEMS, PTTS)':
        'SEMS 取出（支架嵌入、激光汽化、Y 形 SEMS、PTTS）',
      'Sarcoidosis granuloma (cytoblock with Crown Cut needle)':
        '结节病肉芽肿（Crown Cut 针细胞块）',
      'Schematic – Flow‑Volume Loop Comparisons': '示意图 – 流量-容积环比较',
      'Schematic – IASLC Mediastinal Landmarks (mPA/SVC/Esophagus)':
        '示意图 – IASLC 纵隔标志（mPA/SVC/食管）',
      'Schematic – Mediastinal LN Stations (EUS vs EBUS vs Combined)':
        '示意图 – 纵隔淋巴结分站（EUS、EBUS 及联合）',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 4L)':
        '示意图 – 分站图（IASLC ↔ Wang 对照：4L）',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 4R)':
        '示意图 – 分站图（IASLC ↔ Wang 对照：4R）',
      'Schematic – Stations Map (IASLC ↔ Wang Correlation: 7)':
        '示意图 – 分站图（IASLC ↔ Wang 对照：7）',
      'Schematic – TBNA Needle vs Crown‑Cut (Tissue Acquisition)':
        '示意图 – TBNA 针与 Crown-Cut 针对比（组织获取）',
      'Schematic – Types of Central Airway Obstruction (Freitag/Murgu)':
        '示意图 – 中央气道阻塞类型（Freitag/Murgu）',
      'Self-retaining retractor (guidewire positioning with limiter ridge)':
        '自持式牵开器（带限位凸缘的导丝定位）',
      'Silicon and metal stents comparison': '硅酮支架与金属支架比较',
      'Silicon stent follow-up (1-month, granulation formation)':
        '硅酮支架随访（1 个月，肉芽组织形成）',
      'Silicon stent follow-up (4-month, increased granulation)':
        '硅酮支架随访（4 个月，肉芽组织增多）',
      'Silicon stent follow-up (6-month, removal with persistent stenosis)':
        '硅酮支架随访（6 个月，取出后狭窄持续）',
      'Simulator (OR Setup & Interface)': '模拟器（手术室配置与界面）',
      'Single‑Use Bronchoscope (Airway Burn/Cryotherapy)': '一次性支气管镜（气道烧伤/冷冻治疗）',
      'Single‑Use Flexible Bronchoscope (SUFB)‑Guided PDT': '一次性软性支气管镜（SUFB）引导 PDT',
      'Slim Bronchoscopes and Radial Probes': '细径支气管镜及径向探头',
      'Specimen Comparison – Forceps biopsy vs cryobiopsy': '标本比较 – 活检钳与冷冻活检',
      'Specimen – Biodegradable stent fibers (coughed fragments)':
        '标本 – 可生物降解支架纤维（咳出碎片）',
      'Specimen – Resected lung mass (RLL and RML)': '标本 – 切除的肺肿块（RLL 与 RML）',
      'Spherical tip flexible introducer (elastic spring design)':
        '球形尖端柔性导入器（弹性弹簧设计）',
      'Spirometry/CT – Pre/post treatment comparison (tracheal tumor, flow-volume curves)':
        '肺功能/CT – 治疗前后比较（气管肿瘤、流量-容积曲线）',
      'Stent – Through‑the‑scope (TTS) outcomes': '支架 – 经内镜（TTS）置入的结局',
      'Stenting – Metallic Y stent for bronchopleural fistula (LLL)':
        '支架置入 – 用于支气管胸膜瘘的金属 Y 形支架（LLL）',
      'Stenting – Metallic Y stent for bronchopleural fistula (RML deployment sequence)':
        '支架置入 – 用于支气管胸膜瘘的金属 Y 形支架（RML 释放序列）',
      'Stenting – Metallic Y stent for bronchopleural fistula (RML migration and successful reimplantation)':
        '支架置入 – 用于支气管胸膜瘘的金属 Y 形支架（RML 移位后成功重新置入）',
      'Stenting – Metallic Y stent removal (hook technique with radiography/CT confirmation)':
        '支架置入 – 金属 Y 形支架取出（钩取技术，X 线/CT 确认）',
      'Stenting –Distal Granulation at Endobronchial Stent': '支架置入 – 支气管内支架远端肉芽组织',
      'Stenting –Dumon Arm with Cut‑Out + Micro‑Tech “Stent‑in‑Stent”':
        '支架置入 – Dumon 支臂开窗 + Micro-Tech“支架内支架”',
      'Stenting –GINA Silicone Stent (Design/Anti‑Migration)':
        '支架置入 – GINA 硅酮支架（设计/抗移位）',
      'Stenting –GINA vs Dumon (Bench Tests: Anti‑Migration/Force/Flex)':
        '支架置入 – GINA 与 Dumon 对比（台架试验：抗移位/作用力/柔韧性）',
      'Stenting –GINA vs Dumon (Porcine Stenosis Models; 21 Days)':
        '支架置入 – GINA 与 Dumon 对比（猪狭窄模型；21 天）',
      'Stenting –Hook‑Sheath Technique (Tracheal Stent Removal)':
        '支架置入 – 钩-鞘技术（气管支架取出）',
      'Stenting –Micro‑Tech Straight FC‑SEMS': '支架置入 – Micro-Tech 直型 FC-SEMS',
      'Stenting –Neo‑epithelialization (Metal Stents; 4 Patients)':
        '支架置入 – 新上皮化（金属支架；4 例患者）',
      'Stenting –Polydioxanone Tracheal Stent (Radiopaque Markers)':
        '支架置入 – 聚对二氧环己酮气管支架（不透射线标记物）',
      'Stenting –Post‑Placement Confirmation (Bronchoscopy)': '支架置入 – 置入后确认（支气管镜）',
      'Stenting –SEMS Deploying System (Aero; Merit Endotek)':
        '支架置入 – SEMS 释放系统（Aero；Merit Endotek）',
      'Stenting –Silicone Stent Deploying System (Polyflex)':
        '支架置入 – 硅酮支架释放系统（Polyflex）',
      'Stenting –Suture Fixation (Case #1; Sagittal CT & Neck View)':
        '支架置入 – 缝线固定（病例 #1；矢状位 CT 及颈部视图）',
      'Stenting –Suture Fixation (Case #9; Sagittal CT & Neck View)':
        '支架置入 – 缝线固定（病例 #9；矢状位 CT 及颈部视图）',
      'Stenting –Suture Fixation (Percutaneous Pad; Post‑Op CT)':
        '支架置入 – 缝线固定（经皮垫片；术后 CT）',
      'Stenting –Through‑the‑Scope (TTS) vs Over‑the‑Wire (OTW) Design':
        '支架置入 – 经内镜（TTS）与沿导丝（OTW）设计对比',
      'Stenting –Y Silicone in Stomach (Migration Case)':
        '支架置入 – 胃内 Y 形硅酮支架（移位病例）',
      'Subglottic stenosis (IT knife palliation)': '声门下狭窄（IT 刀姑息治疗）',
      'Subglottic stenosis (balloon dilation, Kenalog injection, follow-up)':
        '声门下狭窄（球囊扩张、Kenalog 注射及随访）',
      'Subglottic stenosis (needle knife incisions, Kenalog injection)':
        '声门下狭窄（针形刀切开及 Kenalog 注射）',
      Surgery: '外科',
      'TEF Coverage with Self‑Expanding Y SEMS (CT/Bronch)':
        '自膨式 Y 形 SEMS 覆盖 TEF（CT/支气管镜）',
      'TPO (Carina/Main Bronchi)': 'TPO（隆突/主支气管）',
      'TPO (Tracheobronchopathia Osteochondroplastica; Trachea)':
        'TPO（气管支气管骨软骨成形症；气管）',
      'Telemedicine – Intra‑op 3D anatomy & consult': '远程医疗 – 术中 3D 解剖与会诊',
      'Therapeutic Bronchoscopy': '治疗性支气管镜',
      'Thoracoscopic Appearances (Solid/Fibrous/Thickened)': '胸腔镜表现（实性/纤维性/增厚）',
      'Thoracoscopy + Urokinase Fibrinolysis (Intrapleural Nets)':
        '胸腔镜 + 尿激酶纤溶（胸膜腔内网状物）',
      'Threaded tip dilator (guidewire technique)': '螺纹尖端扩张器（导丝技术）',
      'Tissue core and blood contamination evaluation (H&E slides)':
        '组织条及血液污染评估（H&E 切片）',
      'Tracheal Anastomosis': '气管吻合',
      'Tracheal MAO (malignant melanoma, Polyflex stent)':
        '气管 MAO（恶性黑色素瘤，Polyflex 支架）',
      'Tracheal Schwannoma (H&E Features)': '气管神经鞘瘤（H&E 特征）',
      'Tracheal Schwannoma (S100 Positive)': '气管神经鞘瘤（S100 阳性）',
      'Tracheal Schwannoma (White Pedunculated Lesion)': '气管神经鞘瘤（白色带蒂病变）',
      'Tracheal adenoid cystic carcinoma (pre/post resection, follow-up)':
        '气管腺样囊性癌（切除前后及随访）',
      'Tracheal and LMB obstruction (stent placement, proximal and distal views)':
        '气管及 LMB 阻塞（支架置入，近端与远端视图）',
      'Tracheal compression (rigid bronchoscopy dilation, Dumon Y stent at carina)':
        '气管受压（硬质支气管镜扩张，隆突处 Dumon Y 形支架）',
      'Tracheal invasion and perforation (silicon Y-stent placement for fistula)':
        '气管侵犯及穿孔（瘘管的 Y 形硅酮支架置入）',
      'Tracheal lobulated mass (pre/post removal, 12-month follow-up)':
        '气管分叶状肿块（取出前后，随访 12 个月）',
      'Tracheal papilloma (pre/post endobronchial treatment)': '气管乳头状瘤（支气管内治疗前后）',
      'Tracheal polypoid tumor (APC, cryoablation, snare resection sequence)':
        '气管息肉样肿瘤（APC、冷冻消融及圈套切除序列）',
      'Tracheal schwannoma (H&E with Antoni A/B areas, nuclear palisading)':
        '气管神经鞘瘤（H&E 示 Antoni A/B 区及核栅栏状排列）',
      'Tracheal squamous cell carcinoma (diode laser coagulation, scabbard trachea)':
        '气管鳞状细胞癌（二极管激光凝固，刀鞘样气管）',
      'Tracheal stenosis (covered Ultraflex for malignant lymphoma)':
        '气管狭窄（恶性淋巴瘤采用覆膜 Ultraflex）',
      'Tracheal stenosis measurement': '气管狭窄测量',
      'Tracheoesophageal Fistula': '气管食管瘘',
      'Tracheoesophageal fistula (covered Ultraflex with migration)':
        '气管食管瘘（覆膜 Ultraflex 移位）',
      'Tracheoesophageal fistula suturing (rigid bronchoscopy technique)':
        '气管食管瘘缝合（硬质支气管镜技术）',
      Tracheostomy: '气管切开术',
      'Transbronchial biopsy adenocarcinoma (RUL with ROSE, H&E)':
        '经支气管活检腺癌（RUL，ROSE、H&E）',
      'Transillumination Landmarks (PoCUS Correlate)': '透照标志（PoCUS 对照）',
      'Trocar Placement (7th Intercostal Space)': '套管针置入（第 7 肋间隙）',
      'Tube Insertion over Introducer': '沿导入器置管',
      'Tumor clearance (mechanical removal via rigid bronchoscope)':
        '肿瘤清除（经硬质支气管镜机械取除）',
      'Types of Malignant Airway Obstruction (Examples)': '恶性气道阻塞类型（示例）',
      'Typical Carcinoid (Pre/Post Laser Resection)': '典型类癌（激光切除前后）',
      'Ultrasound (Cannula Tip at T1)': '超声（套管尖端位于 T1）',
      'Ultrasound (Effusion Volume Estimation)': '超声（积液量估算）',
      'Ultrasound – A lines (reverberation artifacts of pleuropulmonary interface)':
        '超声 – A 线（胸膜肺界面混响伪影）',
      'Ultrasound – B lines (comet-tail artifacts, interlobular septa)':
        '超声 – B 线（彗尾伪影，小叶间隔）',
      'Ultrasound – B-lines timeline (days 1, 4, 7, 14)':
        '超声 – B 线时间变化（第 1、4、7、14 天）',
      'Ultrasound – B1 lines (hemodynamic edema)': '超声 – B1 线（血流动力学性水肿）',
      'Ultrasound – C lines (subpleural focal consolidation)': '超声 – C 线（胸膜下局灶性实变）',
      'Ultrasound – Centralized tracheal puncture guidance': '超声 – 气管正中穿刺引导',
      'Ultrasound – Coalescent B2 lines (ground glass pattern)':
        '超声 – 融合性 B2 线（磨玻璃模式）',
      'Ultrasound – Complex nonseptated pleural effusion (heterogeneous hyperechoic spots)':
        '超声 – 复杂性非分隔胸腔积液（不均匀高回声点）',
      'Ultrasound – E lines (subcutaneous emphysema)': '超声 – E 线（皮下气肿）',
      'Ultrasound – ETT positioning (tracheal longitudinal view with cricoid and tracheal rings)':
        '超声 – ETT 定位（气管纵切面显示环状软骨及气管环）',
      'Ultrasound – Floating visceral pleura (atelectasis)': '超声 – 浮动脏层胸膜（肺不张）',
      'Ultrasound – Guidewire confirmation (axial view, right of midline)':
        '超声 – 导丝确认（横断面，位于中线右侧）',
      'Ultrasound – Guidewire confirmation (longitudinal view, tracheal rings)':
        '超声 – 导丝确认（纵切面，气管环）',
      'Ultrasound – Intraoperative pulmonary nodule localization': '超声 – 术中肺结节定位',
      'Ultrasound – Malignant pleural effusion (fibrinous septation)':
        '超声 – 恶性胸腔积液（纤维蛋白分隔）',
      'Ultrasound – Mesothelioma (pleural effusion, tumor masses, diaphragm infiltration, rib fracture)':
        '超声 – 间皮瘤（胸腔积液、肿块、膈肌浸润及肋骨骨折）',
      'Ultrasound – Neurofibrosarcoma and neurofibroma (diaphragm paralysis, liver bulging)':
        '超声 – 神经纤维肉瘤及神经纤维瘤（膈肌麻痹、肝脏膨隆）',
      'Ultrasound – Pleural adhesions (diaphragmatic to collapsed lung)':
        '超声 – 胸膜粘连（膈肌至萎陷肺）',
      'Ultrasound – Pleural biopsy technique (target identification, vascularization assessment)':
        '超声 – 胸膜活检技术（靶点识别、血供评估）',
      'Ultrasound – Pleural thickening (bat sign, oblique approach for rib shadow avoidance)':
        '超声 – 胸膜增厚（蝙蝠征，斜向入路避开肋骨声影）',
      'Ultrasound – Pleural thickening technique (transverse/longitudinal probe positioning)':
        '超声 – 胸膜增厚检查技术（探头横向/纵向放置）',
      'Ultrasound – Pneumothorax (absent lung sliding at pleural line)':
        '超声 – 气胸（胸膜线处肺滑动消失）',
      'Ultrasound – Sonographic anatomy (chest wall layers, pleural line, probe comparison)':
        '超声 – 超声解剖（胸壁各层、胸膜线及探头比较）',
      'Ultrasound – Trachea longitudinal view (cricoid and tracheal rings, 8 MHz probe)':
        '超声 – 气管纵切面（环状软骨及气管环，8 MHz 探头）',
      'Ultrasound – Trachea sagittal view (cricoid cartilage and five tracheal rings)':
        '超声 – 气管矢状面（环状软骨及五个气管环）',
      'Ultrasound – Trachea sagittal view (guidewire entry point identification)':
        '超声 – 气管矢状面（导丝进入点识别）',
      'Ultrasound – Tracheal puncture (axial view with needle at anterior wall)':
        '超声 – 气管穿刺（横断面显示针尖位于前壁）',
      'Ultrasound – Tracheal vascular anatomy (duplex imaging, paramedian artery avoidance during puncture)':
        '超声 – 气管血管解剖（双工成像，穿刺时避开旁正中动脉）',
      'Ultrasound – Z lines (bundle-shaped artifacts)': '超声 – Z 线（束状伪影）',
      'Ultrasound/CEUS – Primary lung sarcoma (pleural metastasis, enhancement patterns)':
        '超声/CEUS – 原发性肺肉瘤（胸膜转移及强化模式）',
      'Ultrasound/CT Correlation – Pleural thickening (hypoecogenic lobular mass with circumferential pattern)':
        '超声/CT 对照 – 胸膜增厚（低回声分叶状肿块，环周模式）',
      'Ultrasound/CT Correlation – Pleural thickening localization (solid/cystic/complex characteristics)':
        '超声/CT 对照 – 胸膜增厚定位（实性/囊性/复杂性特征）',
      'Ultrasound/Clinical – Tracheal transillumination with PoCUS guidance (cricothyroid membrane and puncture point)':
        '超声/临床 – PoCUS 引导气管透照（环甲膜及穿刺点）',
      'Ultrasound/Pathology – Epithelioid mesothelioma (pleural effusion, solid tumor with biopsy)':
        '超声/病理 – 上皮样间皮瘤（胸腔积液、实性肿瘤及活检）',
      'Ultrasound/Pleuroscopy Correlation – Pleural sliding sign, effusion, and adhesions':
        '超声/胸腔镜对照 – 胸膜滑动征、积液及粘连',
      'Ultrasound/Pleuroscopy – Pleural effusion patterns (anechoic, complex, septated, homogeneous)':
        '超声/胸腔镜 – 胸腔积液模式（无回声、复杂性、分隔性、均质性）',
      'Ultrathin Bronchoscopy – rEBUS views & sampling': '超细支气管镜 – rEBUS 视图及取样',
      'VAL-MAP 2.0 technique (step-by-step)': 'VAL-MAP 2.0 技术（分步展示）',
      'VAL-MAP – Dual dye technique (indigo carmine and ICG with NIR thoracoscopy)':
        'VAL-MAP – 双染料技术（靛胭脂及 ICG，NIR 胸腔镜）',
      'VBN + CBCT (Tip‑in‑Target Confirmation)': 'VBN + CBCT（确认尖端位于靶内）',
      'Vascular wall–adjacent lesion': '邻近血管壁的病变',
      'Virtual Bronchoscopy (Archimedes)': '虚拟支气管镜（Archimedes）',
      'Virtual Bronchoscopy – Path Planning (Fly‑Through)': '虚拟支气管镜 – 路径规划（飞越视图）',
      'Virtual Bronchoscopy – Planning (Multiplanar Views)': '虚拟支气管镜 – 规划（多平面视图）',
      'Virtual Bronchoscopy – RFID Tag Placement (CT Correlation)':
        '虚拟支气管镜 – RFID 标签置入（CT 对照）',
      'Virtual Bronchoscopy – Route/Target Overlay': '虚拟支气管镜 – 路径/靶点叠加',
      'Virtual Bronchoscopy – Veran (Lesion Access)': '虚拟支气管镜 – Veran（病灶到达）',
      'Y-shaped airway stents (large bilateral and single-plugged designs)':
        'Y 形气道支架（大型双侧及单支封堵设计）',
      'Y-shaped stent removal (failed expansion, hook retrieval)': 'Y 形支架取出（扩张失败，钩取）',
      'Y‑SEMS for Severe Bilateral MAO (Recovery)': '重度双侧 MAO 的 Y-SEMS（恢复）',
      'Zephyr Valves (RUL; RB1/RB3/RB2)': 'Zephyr 瓣膜（RUL；RB1/RB3/RB2）',
      'Zephyr Valves (Size 4; LUL)': 'Zephyr 瓣膜（4 号；LUL）',
      'Zephyr valve placement (LB6 deployment sequence)': 'Zephyr 瓣膜置入（LB6 释放序列）',
      'Zephyr vs Spiration (In Situ Comparison)': 'Zephyr 与 Spiration 对比（原位）',
      'iSGS proximal stenosis progression (cross-sectional evolution stages)':
        'iSGS 近端狭窄进展（横断面演变阶段）',
      'rEBUS – Eccentric lung nodule (detailed procedure)': 'rEBUS – 偏心性肺结节（详细操作）',
      'rEBUS – Views classification (concentric, eccentric, blizzard, no view)':
        'rEBUS – 视图分类（同心、偏心、暴风雪征、无图像）',
    },
  } as const

export function localizeCreativeCommonsText(locale: ActiveLocale = 'en', value: string) {
  return creativeCommonsTranslations[locale]?.[value.replace(/\s+/g, ' ').trim()] ?? value
}
