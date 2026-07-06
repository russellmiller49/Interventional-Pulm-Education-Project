export type PccmQuestionCategory = 'bronchoscopy' | 'pleural'

export interface PccmAssessmentOption {
  id: string
  text: string
}

export interface PccmAssessmentQuestion {
  id: string
  category: PccmQuestionCategory
  stem: string
  options: PccmAssessmentOption[]
  correctId: string
  explanation: string
  imageUrl?: string
}

export const pccmAssessmentQuestions = [
  {
    id: 'bronchoscopy-q01',
    category: 'bronchoscopy',
    stem: 'A right lower lobe transbronchial lung biopsy is performed for evaluation of a peripheral lower lobe lung mass. The final sample resulted in a large piece and brisk bleeding from the target segmental airway. Which of the following is the MOST APPROPRIATE maneuver at this point?',
    options: [
      {
        id: 'a',
        text: 'Wedge the bronchoscope within the segmental bronchus',
      },
      {
        id: 'b',
        text: 'Instill 2 ml of topical epinephrine within the lobar bronchus',
      },
      {
        id: 'c',
        text: 'Place the patient in right lateral decubitus position',
      },
      {
        id: 'd',
        text: 'Intubate the patient with a single-lumen large-bore endotracheal tube',
      },
    ],
    correctId: 'a',
    explanation:
      'Brisk bleeding after transbronchial biopsy is managed first by isolating the bleed from the rest of the respiratory tree. The fastest bronchoscopic maneuver is to wedge the bronchoscope into the bleeding segmental bronchus. This provides local tamponade and limits blood spillover and potential compromise of gas exchange.\nTopical epinephrine or iced saline can be useful, but instilling medication into the lobar bronchus before isolating the segment delays the most important first step. Also, small volume epinephrine is unlikely to reach the peripheral site of bleeding, and this approach is better suited for endobronchial and visible mucosal bleeds. Dependent positioning can help after the bleeding side is identified, but it does not immediately tamponade the target airway.\nA single-lumen large-bore endotracheal tube may be needed if the situation becomes more emergent and/or if initial therapies, but this step can be prevented in a large majority of cases by simple isolation of the bleeding segment by wedge. After wedging for 30-120 seconds, the operator reassesses and escalates as needed to iced saline, vasoactive agents, tranexamic acid, balloon blockade, advanced local therapy, or embolization.',
  },
  {
    id: 'bronchoscopy-q02',
    category: 'bronchoscopy',
    imageUrl: '/pccm-intro-course/assessments/bronchoscopy/image1.png',
    stem: "What is the airway represented at the 9-o'clock position in this picture?",
    options: [
      {
        id: 'a',
        text: 'The anterior segmental bronchus of the right upper lobe',
      },
      {
        id: 'b',
        text: 'The bronchus intermedius',
      },
      {
        id: 'c',
        text: 'The lateral segmental bronchus of the lingula',
      },
      {
        id: 'd',
        text: 'The posterior basilar segmental bronchus of the right lower lobe',
      },
    ],
    correctId: 'a',
    explanation:
      "The image shows the right upper lobe trifurcation, often remembered as the reverse Mercedes sign. The orientation seen in the question stem is the most commonly encountered when entering the right upper lobe bronchus and the 9-o'clock airway (anterior aspect of the patient) is the anterior segmental bronchus.\nThe bronchus intermedius lies distal to the right upper lobe takeoff and leads toward the right middle and lower lobes. The lingula is part of the left upper lobe, and the posterior basilar segment belongs to the right lower lobe, so neither fits this trifurcation.\nGeneral tips: Scope rotation can change what appears left or right on screen, so the branch pattern and nearby landmarks should be used together. Also, a useful mental check is to name the lobe first, then the segmental pattern. The right upper lobe has apical, anterior, and posterior segmental bronchi; the right middle lobe two segments (medial and lateral), the lower lobe has a superior and 4 basilar segments (medial, anterior, lateral, posterior). The left upper lobe includes the superior division, with 2 segments (apicoposterior and anterior), and the lingula with two segments (superior, inferior). The left lower lobe is similar to the right lower lobe, except the medial and anterior basilar segments are combined into an anteromedial segment.",
  },
  {
    id: 'bronchoscopy-q03',
    category: 'bronchoscopy',
    stem: 'You are called by the bedside ICU nurse and respiratory therapist for worsening airway pressures in a mechanically ventilated patient with right pneumonia. Ten minutes prior, suctioning for copious mucus caused minor bleeding that resolved. The patient is mildly sedated, ventilator tubing is patent, a size 8.0 endotracheal tube is present, peak airway pressure is 60 cm H2O, static end-inspiratory pressure is 19 cm H2O, SpO2 is 88%, and end-tidal CO2 has increased. A STAT bronchoscopy is planned. Which of the following is MOST appropriate for the procedure in this situation?',
    options: [
      {
        id: 'a',
        text: 'Switch to pressure-control mode, capping peak inspiratory pressure at 30 mm Hg',
      },
      {
        id: 'b',
        text: 'Utilize an outer diameter 6.0 and working channel 2.8 mm bronchoscope',
      },
      {
        id: 'c',
        text: 'Maintain FiO2 at 50% to avoid oxygen toxicity.',
      },
      {
        id: 'd',
        text: 'Minimize sedation and/or antitussives to prevent cardiorespiratory collapse',
      },
    ],
    correctId: 'b',
    explanation:
      'The key ventilator clue is a very high peak pressure with a normal static end-inspiratory pressure. That pattern points to increased airway resistance, such as mucus plugging, tube obstruction, bronchospasm, or airway narrowing, rather than reduced lung compliance.\nBronchoscopy through an endotracheal tube can worsen airway resistance and gas exchange. Appropriate preparation includes preoxygenation, adequate sedation or antitussive therapy, and choosing a bronchoscope small enough to preserve ventilation through the size 8.0 tube while still allowing effective suction. A rough rule is to choose a bronchoscope with an outer diameter ~2mm small than the inner diameter of the existing airway. In this case, the therapeutic scope described in option B matches the needs of this case well.\nSwitching to pressure-control mode and capping inspiratory pressure is not appropriate here because the obstructed system would likely receive a much lower tidal volume. In a patient already hypoxemic and retaining CO2, that will likely worsen ventilation rather than solve the resistance problem, and potentially lead to cardiac arrest if the procedure is prlonged.\nThe bronchoscope itself partially occludes the endotracheal tube, so the preprocedure plan should preserve the largest possible annular space around the scope. Close communication with the respiratory therapist is essential: monitor tidal volume, pressure alarms, oxygen saturation, and CO2 while suctioning the obstruction efficiently. The interaction should be dynamic and the bronchoscopist should stop if saturation or tidal volume decrease significantly or for a prolonged period, withdraw the scope to re-establish ventilation, and re-enter only when the patient can tolerate further airway maneuvers.',
  },
  {
    id: 'bronchoscopy-q04',
    category: 'bronchoscopy',
    stem: 'A young, previously healthy adult patient is hospitalized for aspiration of a foreign body. She reports a sudden choking and coughing sensation while laughing and eating grapes a few hours before presentation. She is comfortable, occasionally coughs and clears her throat, has normal vital signs, and has focal right-sided high-pitched bronchial sounds. Chest CT confirms a round, smooth, hypodense object impacting the proximal right lower lobe bronchus with distal segmental atelectasis. Of the choices listed, which is the MOST APPROPRIATE approach to extracting this foreign body?',
    options: [
      {
        id: 'a',
        text: 'Rigid bronchoscopy under general anesthesia, utilizing large rigid forceps',
      },
      {
        id: 'b',
        text: 'Flexible bronchoscopy under general anesthesia, endotracheal tube, utilizing flexible smooth cup forceps',
      },
      {
        id: 'c',
        text: 'Flexible bronchoscopy under moderate sedation, endotracheal tube, utilizing cryoprobe',
      },
      {
        id: 'd',
        text: 'Flexible bronchoscopy under moderate sedation, no artificial airway, utilizing snare-basket',
      },
    ],
    correctId: 'd',
    explanation:
      'Important factors to consider for planning foreign body extraction, are characteristics of the object itself (size, shape, organicity) and the clinical presentation (patient status, timeframe of the aspiration). This is a stable, healthy adult with a smooth, round, organic foreign body lodged beyond the central airway, presumably an acutely aspirated grape given the clinical history. A snare-basket is well suited for extraction in this case because it can encircle and seize the object. A grape is compressible, smooth, and slippery; a basket can surround it, whereas forceps may crush or lose it. While an endotracheal tube helps protect the vocal cords from sharp objects, it can limit removal of a larger materials through the airway, and a grape large enough to lodge in the proximal lower lobe bronchus may have difficulty traversing the tube, regardless of the tools used.\nRigid bronchoscopy under general anesthesia is important for unstable patients, central airway obstruction, pediatric foreign bodies, large or sharp objects, in chronic aspiration when destruction of granulation tissue and other salvage methods may be needed to free the foreign body, or failed flexible extraction. \nIn summary, flexible bronchoscopy without an artificial airway is the best initial approach for the specific scenario presented, as the others are either inappropriate or unnecessary. As with any foreign body extraction, the operator should still be prepared to escalate to general anesthesia, rigid bronchoscopy, or airway control if the object migrates, fragments, or causes respiratory compromise.',
  },
  {
    id: 'bronchoscopy-q05',
    category: 'bronchoscopy',
    imageUrl: '/pccm-intro-course/assessments/bronchoscopy/image2.png',
    stem: 'Upon completion of a bronchoalveolar lavage while targeting moderate sedation in a patient with suspected atypical infection, the airway findings shown below are noted. How are these findings best described?\n\nAirway at end inspiration and during cough.',
    options: [
      {
        id: 'a',
        text: 'Intrinsic invasion of the trachea by tumor',
      },
      {
        id: 'b',
        text: 'Extrinsic compression of the trachea by tumor',
      },
      {
        id: 'c',
        text: 'Saber-sheath trachea',
      },
      {
        id: 'd',
        text: 'Dynamic airway collapse',
      },
    ],
    correctId: 'd',
    explanation:
      'The paired images compare end inspiration with coughing. The airway is relatively open at end inspiration but narrows markedly posteriorly during cough, which is the hallmark of dynamic airway collapse rather than a fixed lesion.\nIntrinsic tumor invasion usually produces an endoluminal mass, mucosal disruption, or focal fixed narrowing. Extrinsic compression from tumor would result in constant indentation from outside the airway. Saber-sheath trachea is a fixed tracheal shape abnormality, not a cough-induced collapse pattern.\nDynamic airway collapse or tracheobronchomalacia can be exaggerated by coughing, forced exhalation, and sedation. During bronchoscopy, the location and severity should be documented, and management should be based on symptoms, comorbid disease, and response to airway-supportive measures. The finding is often incidental, but it can explain cough, wheeze, secretion retention, or difficulty weaning from ventilation.',
  },
  {
    id: 'bronchoscopy-q06',
    category: 'bronchoscopy',
    stem: 'Which of the following is the MOST CORRECT description of bronchoscope anatomy and/or function?',
    options: [
      {
        id: 'a',
        text: 'A therapeutic bronchoscope is defined by its outer diameter',
      },
      {
        id: 'b',
        text: 'Single-use disposable bronchoscopes are more financially costly for a bronchoscopy practice than reusable scopes',
      },
      {
        id: 'c',
        text: 'Angulation of scope flexion exceeds that of scope extension',
      },
      {
        id: 'd',
        text: 'A convex-probe endobronchial ultrasound transducer must be attached to the tip of a conventional flexible scope before use',
      },
    ],
    correctId: 'c',
    explanation:
      'Flexible bronchoscopes use control cables to bend the distal tip. In typical scope design, the degree of flexion exceeds the degree of extension (option C). Practically, tip flexibility affects navigation, especially when turning into upper-lobe or sharply angled segmental airways. Operators can compensate with scope rotation, patient positioning, and careful withdrawal or advancement. Forcing the lever or torquing against resistance can damage the scope and injure mucosa. Flexibility also affects tool use. A biopsy forceps, needle, or brush exits in the direction of the working channel, so tip deflection and scope orientation determine whether the tool reaches the intended mucosal or parenchymal target and forcing past resistance may cause scope or tool damage.\nA therapeutic bronchoscope is not defined only by outer diameter. The practical therapeutic capability is strongly related to the working-channel size, suction capacity, and compatibility with tools. Likewise, the cost comparison between reusable and single-use scopes depends on volume, reprocessing costs, infection-control needs, and repair costs.\nConvex-probe EBUS is not a removable transducer attached to a standard flexible scope. It is a dedicated instrument with an integrated ultrasound probe and needle channel. Understanding these design features helps the bronchoscopist choose the correct scope and avoid equipment misuse.',
  },
  {
    id: 'bronchoscopy-q07',
    category: 'bronchoscopy',
    stem: 'A bronchoalveolar lavage is performed on a patient. After instilling 150 ml into the target airway, about 10 ml in return is obtained. Which of the following MOST likely explains this resulting BAL fluid recovery?',
    options: [
      {
        id: 'a',
        text: 'Wedge was obtained in a segmental rather than a sub-segmental airway',
      },
      {
        id: 'b',
        text: 'A good wedge of the target airway was maintained during lavage',
      },
      {
        id: 'c',
        text: 'Lavage was performed in the posterior lower lobe of a ventilated patient',
      },
      {
        id: 'd',
        text: 'Lavage was performed for pneumonia in an otherwise young, healthy patient',
      },
    ],
    correctId: 'c',
    explanation:
      'Ten milliliters returned after 150 ml instilled is poor BAL recovery. Common factors contributing to poor-return include targeting of dependent segments, patients on mechanical ventilation, older age, obstructive lung disease, poor wedge, distal airway placement, and excessive suction.\nThe posterior lower lobe in a ventilated patient combines two major risk factors: dependent positioning and positive-pressure ventilation. To improve return, maintain a stable wedge, use gentle suction, avoid scope migration, and choose a less dependent target when clinically acceptable.\nA commonly used target for BAL is the right middle lobe or lingula because these airways often allow a stable wedge, are anterior, and thus provide better fluid return. A very low return can make cell counts and microbiologic results less reliable, so the operator should interpret the sample in light of technique and target site.',
  },
  {
    id: 'bronchoscopy-q08',
    category: 'bronchoscopy',
    stem: 'An otherwise healthy patient hospitalized with influenza is transferred to the ICU on hospital day 2 and intubated for acute hypoxemic respiratory failure due to ARDS. CT shows dense right lower lobe consolidation with early cavitation, diffuse bilateral ground-glass opacities, and borderline enlarged thoracic nodes. The patient has a history of recent myocardial infarction, pulmonary hypertension, lung protective vent settings with FiO2 100%, PEEP 15 resulting in a pH 7.28, pCO2 52, PaO2 55, a mild vasopressor requirement, platelet count 68,000/microliter. Empiric antimicrobials have been inititated. Bronchoscopy with BAL is requested. Which of the following MOST ACCURATELY describes how to proceed?',
    options: [
      {
        id: 'a',
        text: 'BAL should be performed to assess for ventilator-associated bacterial pneumonia',
      },
      {
        id: 'b',
        text: 'BAL should be deferred due to current level of thrombocytopenia',
      },
      {
        id: 'c',
        text: 'BAL should be deferred due to current underlying cardiovascular disease',
      },
      {
        id: 'd',
        text: 'BAL should be deferred due to current impairment in gas exchange',
      },
    ],
    correctId: 'd',
    explanation:
      'This patient has severe gas-exchange impairment: FiO2 100%, PEEP 15, PaO2 55, acidosis, hypercapnia, ARDS, and mild shock. Bronchoscopy increases airway resistance and BAL will further worsen oxygenation and ventilation in this patient with no reserve. Bronchoscopy should not be performed as oxygenation and ventilation can’t be guaranteed, the only absolute contraindication for the procedure. Nonbronchoscopic management, including tracheal aspirate, imaging, and empiric treatment can be used while the patient is stabilized.\nThe platelet count and cardiovascular history are relevant procedural risks, but they are not the main reason to defer this lavage. \nIf bronchoscopy ultimately becomes necessary despite severe hypoxemia, it should be done with a clear indication, experienced personnel, use of tools that will maximize benefit and minimize further risk, preoxygenation, ventilator adjustments, hemodynamic support, and a plan to abort if oxygenation or ventilation deteriorates.',
  },
  {
    id: 'bronchoscopy-q09',
    category: 'bronchoscopy',
    stem: 'Which of the following about normal bronchial anatomy is CORRECT?',
    options: [
      {
        id: 'a',
        text: 'The left mainstem bronchus bifurcates from the tracheal midline at about 25 degrees and is about 30 mm in length',
      },
      {
        id: 'b',
        text: 'The bronchus intermedius is about the length of or slightly longer than the right main bronchus',
      },
      {
        id: 'c',
        text: 'The right lung has 11 segmental bronchi, whereas the left has only 10',
      },
      {
        id: 'd',
        text: 'The middle lobe bronchus bifurcates into a superior and inferior division',
      },
    ],
    correctId: 'b',
    explanation:
      'The right main bronchus is short, about 15-20 mm, and the bronchus intermedius is roughly 20 mm. Therefore, the bronchus intermedius is about the length of, or slightly longer than, the right main bronchus.\nThe left mainstem bronchus is longer and more angled than the right: approximately 40-50 mm long and about 40 degrees from the tracheal midline. The 25-degree angle better describes the right main bronchus.\nThe right lung usually has 10 bronchial segments, and the left is commonly described with 8. The right middle lobe divides into medial and lateral segments, not superior and inferior divisions. \nDuring live bronchoscopy, anatomy is learned as a sequence rather than as isolated facts. From the carina, recognize the short right main bronchus, the right upper-lobe takeoff, the bronchus intermedius, and then the middle and lower lobes; on the left, expect a longer mainstem before upper and lower lobe division.',
  },
  {
    id: 'bronchoscopy-q10',
    category: 'bronchoscopy',
    imageUrl: '/pccm-intro-course/assessments/bronchoscopy/image3.png',
    stem: 'Which of the following represents the anterior aspect of this patient?\n\nTracheal view during bronchoscopy.',
    options: [
      {
        id: 'a',
        text: "12-o'clock",
      },
      {
        id: 'b',
        text: "3-o'clock",
      },
      {
        id: 'c',
        text: "6-o'clock",
      },
      {
        id: 'd',
        text: "9-o'clock",
      },
    ],
    correctId: 'c',
    explanation:
      "In the tracheal image, the anterior aspect corresponds to 6-o'clock. The key landmark is tracheal structure: C-shaped cartilaginous rings form the anterior and lateral walls, while the posterior wall is membranous and contains the trachealis muscle.\nHere, the posterior membranous wall is oriented toward the top of the endoscopic field. The opposite side of the lumen, at the lower part of the image, therefore represents the anterior trachea.\nBronchoscopic orientation changes with patient position, head rotation, and scope torque. Rather than assuming the top of the screen is anterior, the operator should repeatedly identify cartilage rings, the membranous wall, and branch anatomy before describing lesions or navigating.\nThis principle also helps when documenting airway abnormalities. A lesion described as anterior, posterior, right lateral, or left lateral should be based on airway landmarks (and, thus, the patient’s position), not the operator's hand position or a rotated video image. Re-checking landmarks before biopsy, dilation, or stent planning reduces incorrect localization and management.",
  },
  {
    id: 'bronchoscopy-q11',
    category: 'bronchoscopy',
    stem: 'A balloon blocker is placed for recurrent and persistent massive right lower lobe bronchopulmonary hemorrhage related to chronic bronchiectasis. The patient is stabilized, deeply sedated, and paralyzed in the ICU, with peak airway pressure 30-35 cm H2O. During preparation for transfer to interventional radiology (IR) for bronchial artery embolization, there is a sudden increase of peak airway pressure and loss of tidal volume. Which of the following should be performed next?',
    options: [
      {
        id: 'a',
        text: 'Further inflate the endotracheal tube (ETT) cuff',
      },
      {
        id: 'b',
        text: 'Further inflate the balloon blocker',
      },
      {
        id: 'c',
        text: 'Emergent left chest tube placement',
      },
      {
        id: 'd',
        text: 'Bedside bronchoscopy',
      },
    ],
    correctId: 'd',
    explanation:
      'A sudden rise in peak pressure with loss of tidal volume points toward increased resistance to gas delivery, either in the airway (including vent circuit) or the lung, resulting in premature termination of the breath after reaching preset ‘alarm’ values. A patient with a balloon blocker placed for massive active bronchopulmonary hemorrhage requires careful monitoring that might suggest malfunction of the blocker. The blocker could migrate proximally or deflate. In the former scenario, the blocker can lead to large airway or even endotracheal tube obstruction. Blockers may change position either due to patient movements (important to maintain paralysis), or changes in position of either the blocker itself or the ETT to which it is secured. Balloon deflation may permit ongoing hemorrhage to cause airway flooding and secondary obstruction from clot formation. All these mishaps would result in the physiology described. Because the patient is paralyzed, coughing or ventilator dyssynchrony is unlikely to explain the abrupt change. To properly and rapidly diagnose and manage a potentially catastrophic clinical development, an emergent bedside bronchoscopy is warranted. Single-use bronchoscopes, which are readily available in many modern ICUs, are a good choice in this situation.\nInflating the ETT cuff is not necessary as an ETT leak would cause a drop, not rise, in airway pressures. Further inflating of the balloon blocker may ultimately be necessary, but only after a deflation has been diagnosed and airway flooding by ongoing hemorrhage ruled out. If a migration is the problem, inappropriate blocker overinflation would potentially exacerbate, not solve the situation. A contralateral pneumothorax is possible given preferential gas delivery to the opposite, healthy lung. However, a balloon malfunction is more likely, and an accurate diagnosis is critical before empiric chest tube placement.',
  },
  {
    id: 'bronchoscopy-q12',
    category: 'bronchoscopy',
    stem: 'In which of the following scenarios is bronchoalveolar lavage (BAL) MOST helpful?',
    options: [
      {
        id: 'a',
        text: 'A patient with poor dentition, frequent aspiration, general malaise, and a right lower lobe consolidation',
      },
      {
        id: 'b',
        text: 'A patient with AIDS, dry cough and dyspnea for 3 weeks, and bilateral ground-glass lung opacities',
      },
      {
        id: 'c',
        text: 'A patient with a 100 pack-year smoking history and a slowly growing 18 mm part-solid right lung nodule',
      },
      {
        id: 'd',
        text: 'A patient with 3 days of pharyngitis, cough, rhinorrhea, and low-grade fever',
      },
    ],
    correctId: 'b',
    explanation:
      'Bronchoscopy with BAL is most helpful when it will more efficiently identify infection or an alternative diagnosis over other available methods. AIDS with subacute dry cough, dyspnea, and bilateral ground-glass opacities is a classic presentation of Pneumocystis jirovecii pneumonia. BAL performs very well in this clinical context, and the patient’s dry cough is less likely to yield a diagnosis via sputum sampling.\nAspiration pneumonia in a patient with poor dentition is often treated empirically, and BAL is of limited added value. A slowly growing part-solid nodule requires tissue diagnosis to rule out cancer, for which BAL is a poor choice due to low yield. Short-duration pharyngitis, cough, rhinorrhea, and low-grade fever suggest an uncomplicated viral upper respiratory infection, where invasive sampling is not justified.',
  },
  {
    id: 'bronchoscopy-q13',
    category: 'bronchoscopy',
    imageUrl: '/pccm-intro-course/assessments/bronchoscopy/image4.png',
    stem: 'Which of the following best describes the airway mucosa shown below?\n\nBronchoscopic mucosal appearance.',
    options: [
      {
        id: 'a',
        text: 'Normal',
      },
      {
        id: 'b',
        text: 'Nodular and ulcerated',
      },
      {
        id: 'c',
        text: 'Edematous and hypervascular',
      },
      {
        id: 'd',
        text: 'Exudative and necrotic',
      },
    ],
    correctId: 'c',
    explanation:
      'The image shows swollen, erythematous mucosa with prominent superficial blood vessels. Those visual findings are best described as edematous and hypervascular. Edematous hypervascular mucosa may reflect inflammation, infection, edema, vascular congestion, or malignant infiltration. The bronchoscopist should document the location and distribution of the findings and avoid unnecessary trauma during inspection, as such mucosa is often friable.\nNodular mucosa will be raised and ‘bumpy’, ulcerated mucosa will have mucosal breaks often with a pale-white base which may easily bleed, exudates and necrosis will demonstrate purulence, often manifest as dark tissue, sometimes with sloughing.',
  },
  {
    id: 'bronchoscopy-q14',
    category: 'bronchoscopy',
    stem: 'Which of the following is CORRECT about bronchoscopic diagnostic sampling tools and techniques?',
    options: [
      {
        id: 'a',
        text: 'Forceps biopsy-obtained tissue can be placed in saline to evaluate for infection',
      },
      {
        id: 'b',
        text: 'Bronchial brushings are an effective tool for peribronchial lymph node sampling',
      },
      {
        id: 'c',
        text: 'Bronchoalveolar lavage has a pneumothorax risk of about 1-5%',
      },
      {
        id: 'd',
        text: 'Transbronchial needle aspiration is primarily used for sampling peripheral lung nodules',
      },
    ],
    correctId: 'a',
    explanation:
      'Forceps biopsy tissue can be placed in sterile saline when infection is part of the differential diagnosis. Saline preserves tissue for microbiology. Formalin is used for histopathology but kills bacteria and thus prevents culture, so specimen handling must match the intended test.\nBronchial brushings are useful for mucosal or visible endobronchial abnormalities, but they do not traverse the airway and sample peribronchial lymph nodes. Nodes are accessed with transbronchial needle aspiration, often guided by convex-probe EBUS, a very common procedure and the guideline-directed choice for mediastinal staging in suspected lung cancer. BAL itself has very low pneumothorax risk; that risk is more associated with transbronchial lung biopsy.',
  },
  {
    id: 'bronchoscopy-q15',
    category: 'bronchoscopy',
    stem: 'A bronchoalveolar lavage is performed in a patient with diffuse parenchymal lung disease. The anterior segment of the right upper lobe is chosen and a good wedge obtained. After instillation of a 60 ml aliquot of sterile saline, 30 ml of fluid is recovered. What is the MOST APPROPRIATE next step in the procedure?',
    options: [
      {
        id: 'a',
        text: 'Move the bronchoscope to the middle lobe and perform a lavage there',
      },
      {
        id: 'b',
        text: 'Maintain wedge and instill an additional 40 ml sterile saline',
      },
      {
        id: 'c',
        text: 'Maintain wedge, position the patient in left lateral decubitus and slight Trendelenburg, and continue fluid aspiration',
      },
      {
        id: 'd',
        text: 'Conclude the procedure as you have adequate fluid recovery',
      },
    ],
    correctId: 'b',
    explanation:
      'BAL technique should minimize proximal airway contamination by avoiding suctioning while maneuvering to the target airway, and then maintaining a good wedge in the selected airway. A 60 ml aliquot with 30 ml recovery is a good first return, but it is not yet a complete lavage. Adequate lavage volume requires instilling 100-300 ml total, divided into several aliquots of about 50-100 ml, to ensure adequate peripheral reach and robust alveolar sampling. Therefore, the next step is to maintain the wedge and instill additional sterile saline.\nMoving to another lobe introduces a new site, increasing contamination risk and is unnecessary for diffuse disease. Positioning maneuvers may be useful when return is poor, which is not the case in this stem. Concluding early would sacrifice diagnostic yield and standardization.',
  },
  {
    id: 'pleural-q01',
    category: 'pleural',
    stem: 'Which physiologic mechanism normally provides the dominant route for pleural liquid clearance?',
    options: [
      {
        id: 'a',
        text: 'Parietal pleural lymphatic stomata draining to systemic lymphatics',
      },
      {
        id: 'b',
        text: 'Active secretion by visceral pleura into pulmonary venous capillaries',
      },
      {
        id: 'c',
        text: 'Bulk absorption through visceral pleura into pulmonary lymphatics',
      },
      {
        id: 'd',
        text: 'Passive evaporation across mesothelium into adjacent alveolar gas',
      },
    ],
    correctId: 'a',
    explanation:
      'Normal pleural liquid homeostatic balance depends on low-volume filtration, largely from systemic microvessels of the parietal pleura, and efficient removal through parietal pleural lymphatics. The parietal pleura contains lymphatic stomata that communicate with subpleural lymphatic channels. This system can increase clearance when pleural liquid formation rises. Thus, parietal pleural lymphatic stomata are the key safety valve for pleural liquid clearance. Effusions usually result from one or a combination of increased formation, such as elevated systemic venous pressures, or impaired resorption, such as lymphatic obstruction by malignancy. Thus, pleural effusions can arise from systemic, pulmonary, or primarily pleural processes.\nChoice B is incorrect because while the visceral pleura is important for mechanical coupling to lung parenchyma, it is not the dominant route for pleural liquid removal in humans and visceral pleural mesothelium does not actively secrete pleural liquid into pulmonary venous capillaries. Choice C is incorrect because bulk absorption across visceral pleura into pulmonary lymphatics is not the principal clearance pathway. Choice D is incorrect because pleural liquid is not cleared by evaporation into alveolar gas—the pleural space is a closed serous cavity rather than an airway-facing compartment.',
  },
  {
    id: 'pleural-q02',
    category: 'pleural',
    stem: 'A 68-year-old man with metastatic lung adenocarcinoma has a large right malignant pleural effusion and severe orthopnea. Ultrasound shows a large anechoic effusion with a mobile diaphragm and no thick septations. Therapeutic thoracentesis is performed with a manometer attached. After removal of 900 mL, his dyspnea improves but he develops ipsilateral chest tightness; pleural pressure falls from +4 to -28 cm H2O with a steep pressure-volume curve. Postprocedure chest radiograph shows a basilar pleural air-fluid level without new alveolar infiltrates. Which physiologic abnormality best explains this event?',
    options: [
      {
        id: 'a',
        text: 'Increased pleural liquid secretion from tumor neovascularity',
      },
      {
        id: 'b',
        text: 'Unexpandable lung from pleural malignancy',
      },
      {
        id: 'c',
        text: 'Bronchopleural fistula due to procedure-related lung injury',
      },
      {
        id: 'd',
        text: 'Hydrostatic pulmonary edema after rapid fluid removal',
      },
    ],
    correctId: 'b',
    explanation:
      'The combination of symptomatic improvement, chest tightness during drainage, a steep fall in pleural pressure, and evidence of a basilar pleural air-fluid level is a classic presentation of an unexpandable (“trapped”) lung after effusion drainage. In malignant pleural disease, lung expansion may be limited by visceral pleural tumor or fibrosis, chronic atelectasis, or an obstructed bronchus. When fluid is removed, the lung cannot fill the space, so pleural pressure becomes markedly negative and the patient may develop chest discomfort, likely due to stimulation of thoracic visceral autonomics. Pleural manometry is not required for every thoracentesis, but the physiologic pattern is useful. When the patient develops chest discomfort or pleural pressure falls sharply, continuing drainage to a predetermined volume is less important than stopping, reassessing symptoms, and planning definitive therapy around lung expandability rather than radiographic appearance alone. \nChoice A is incorrect because tumor-related fluid formation explains recurrent effusion but not the steep pressure drop during drainage. Choice C is incorrect because a bronchopleural fistula is more likely to produce an apical or apicolateral pleural air collection, rather than the basilar location more commonly seen with an ‘ex vacuo’ pneumothorax. Choice D is incorrect because re-expansion pulmonary edema would present with new alveolar opacities, hypoxemia, and cough—not present in this case.',
  },
  {
    id: 'pleural-q03',
    category: 'pleural',
    stem: 'A 70-year-old man with a 40-pack-year smoking history and prior shipyard work presents with 6 weeks of weight loss and a recurrent left pleural effusion. Temperature is 36.9 C, heart rate is 92/min, and oxygen saturation is 94% on room air. Thoracic ultrasound shows a moderate effusion with irregular parietal pleural thickening. Contrast-enhanced CT of the chest, abdomen, and pelvis using 1.25-mm reconstructions shows nodular circumferential pleural thickening involving the mediastinal pleura. Initial thoracentesis yields an exudate. 100 mL is sent for cytology with direct smear and cell block, and cytology is negative. Which next diagnostic step is most appropriate?',
    options: [
      {
        id: 'a',
        text: 'Repeat cytology with serial 10-mL pleural fluid samples',
      },
      {
        id: 'b',
        text: 'Order serum tumor markers to diagnose pleural malignancy',
      },
      {
        id: 'c',
        text: 'Perform PET-CT',
      },
      {
        id: 'd',
        text: 'Obtain image-guided or thoracoscopic pleural biopsy',
      },
    ],
    correctId: 'd',
    explanation:
      'This patient has high pretest probability for pleural malignancy, including mesothelioma, because of asbestos exposure, weight loss, recurrent unilateral exudative effusion, ultrasound pleural thickening, and CT evidence of nodular circumferential pleural disease involving the mediastinum. Pleural fluid cytology is an appropriate initial test for suspected secondary pleural malignancy, but a negative result should prompt further investigation when suspicion remains. The yield of fluid cytology varies by tumor type and is low in mesothelioma. For cases of a high pre-test probability for malignancy such as the one presented, a negative cytology is not sufficiently reassuring. In contrast, tissue provides both a histologic diagnosis, combining both immunohistochemistry and molecular testing. Image-guided pleural biopsy or thoracoscopic biopsy should be selected based on target visibility, local expertise, need for fluid control, and patient fitness. \nChoice A is incorrect because repeatedly sending small-volume cytology after an adequate negative sample is inefficient, especially when a low-yield tumor type is suspected. Choice B is incorrect because serum biomarkers are not recommended to diagnose secondary pleural malignancy and would not replace tissue. Choice C is incorrect because PET-CT may support a diagnosis when CT or clinical features are suspicious and histology is negative or invasive sampling is not an option, but it should not delay biopsy when a safe target exists. While it may be useful in guiding the biopsy target in cases of focal disease, in this scenario the pattern is diffuse and circumferential. Blind, non-image-guided pleural biopsy should also be avoided because image-guided and thoracoscopic approaches improve yield and safety.',
  },
  {
    id: 'pleural-q04',
    category: 'pleural',
    stem: 'A 58-year-old woman with rheumatoid arthritis develops progressive dyspnea over 2 weeks. She is afebrile, heart rate is 82/min, blood pressure is 128/74 mm Hg, and oxygen saturation is 97% on room air. Chest radiography shows a moderate unilateral left pleural effusion. Ultrasound shows a 4-cm simple fluid pocket without septations. Diagnostic thoracentesis yields clear yellow fluid. Serum protein is 6.8 g/dL, serum lactate dehydrogenase (LDH) is 180 U/L, and the laboratory upper limit of normal for serum LDH is 240 U/L. Pleural fluid protein is 3.0 g/dL and pleural fluid LDH is 115 U/L. How should the fluid be classified by Light criteria?',
    options: [
      {
        id: 'a',
        text: 'Transudate because the pleural LDH is below two-thirds the serum LDH upper limit',
      },
      {
        id: 'b',
        text: 'Exudate because the pleural fluid-to-serum LDH ratio is greater than 0.6',
      },
      {
        id: 'c',
        text: 'Exudate because the pleural fluid protein concentration exceeds 2.5 g/dL',
      },
      {
        id: 'd',
        text: 'Transudate because the pleural fluid-to-serum protein ratio is less than 0.5',
      },
    ],
    correctId: 'b',
    explanation:
      'Light’s criteria classify a pleural effusion as an exudate when any one of three criteria is met: pleural fluid-to-serum protein ratio greater than 0.5, pleural fluid-to-serum LDH ratio greater than 0.6, or pleural LDH greater than two-thirds of the serum LDH upper limit of normal. In this case, the protein ratio is 3.0/6.8 = 0.44, so the protein criterion is negative. The absolute pleural LDH is 115 U/L, which is below two-thirds of the serum LDH upper limit of normal (160 U/L), so the absolute LDH criterion is also negative. The pleural fluid-to-serum LDH ratio, however, is 115/180 = 0.64, which is above 0.6 and therefore classifies the fluid as an exudate. \nChoice A is incorrect because failing the absolute LDH criterion does not make the fluid a transudate when another criterion is positive. Choice C is incorrect because pleural protein concentration alone is not one of the original Light’s criteria; the relevant protein measure is the pleural-to-serum ratio. Choice D is incorrect because the protein ratio is below threshold, but the LDH ratio is still positive.',
  },
  {
    id: 'pleural-q05',
    category: 'pleural',
    stem: 'A 24-year-old tall man with no known lung disease and a 4-pack-year smoking history presents with sudden right pleuritic chest pain while playing basketball. Temperature is 36.7 C, heart rate is 86/min, blood pressure is 124/76 mm Hg, respiratory rate is 16/min, and oxygen saturation is 98% on room air. He reports mild pain but no dyspnea at rest. Upright chest radiograph shows a large right pneumothorax without mediastinal shift. He lives 15 minutes from the hospital, has reliable transportation, and can return for reassessment. Which initial management strategy is most appropriate?',
    options: [
      {
        id: 'a',
        text: 'Intercostal chest tube drainage and hospitalization due to large size of pneumothorax',
      },
      {
        id: 'b',
        text: 'Conservative management with observation and planned follow-up',
      },
      {
        id: 'c',
        text: 'Hospitalization and urgent surgical pleurodesis to prevent recurrence',
      },
      {
        id: 'd',
        text: 'Immediate needle aspiration to relieve pain',
      },
    ],
    correctId: 'b',
    explanation:
      'In a clinically stable adult with primary spontaneous pneumothorax who is asymptomatic or minimally symptomatic and has no physiologic compromise, conservative management can be considered regardless of radiographic size when close follow-up and return precautions are feasible. The modern approach emphasizes symptoms, physiology, safety of intervention, patient values, and local expertise rather than size of the pneumothorax alone. The NEJM conservative-management trial in primary spontaneous pneumothorax supported noninferiority of conservative management in selected patients and fewer serious adverse events, and BTS 2023 guidelines incorporate this patient-centered approach. \nChoice A is incorrect because size alone is no longer an indication for invasive management in otherwise low-risk primary spontaneous pneumothorax, although size may affect procedural safety if intervention is chosen. Choice C is incorrect because urgent surgery is generally reserved for recurrence prevention in selected high-risk scenarios, tension physiology, persistent air leak, or specific occupations; it is not required for every first presentation. Choice D is incorrect because needle aspiration or tube drainage is reasonable when conservative or ambulatory management is unsuitable, but aspiration is not mandatory for a minimally symptomatic stable patient. Shared decision-making is still essential: some patients may prioritize rapid radiographic re-expansion, while others may prioritize avoiding procedures and hospitalization.\nConservative care still requires analgesia, smoking cessation counseling, clear instructions to return for dyspnea or worsening pain, and scheduled reassessment with imaging. A patient who becomes more symptomatic, cannot attend follow-up, or strongly prefers immediate intervention may reasonably move to ambulatory drainage, needle aspiration, or tube drainage.',
  },
  {
    id: 'pleural-q06',
    category: 'pleural',
    stem: 'Which practice improves microbiologic yield from pleural fluid when pleural infection is suspected?',
    options: [
      {
        id: 'a',
        text: 'Refrigerating the pleural fluid sample overnight before inoculation',
      },
      {
        id: 'b',
        text: 'Sending cytology alone because empyema cultures are generally sterile',
      },
      {
        id: 'c',
        text: 'Inoculating pleural fluid into aerobic and anaerobic blood culture bottles at the bedside',
      },
      {
        id: 'd',
        text: 'Adding formalin to the pleural fluid specimen before Gram stain',
      },
    ],
    correctId: 'c',
    explanation:
      'Bedside inoculation of pleural fluid into aerobic and anaerobic blood culture bottles, in addition to standard sterile containers, improves microbiologic yield in suspected pleural infection. This matters because cultures are frequently negative, especially after antibiotics, yet organism identification helps narrow therapy and detect resistant or unusual pathogens. Also, ensuring anaerobic evaluation is included in the microbiologic analysis is important because anaerobes and polymicrobial infection are important in community-acquired pleural infection and aspiration-associated disease, which often involve oral flora.\nRefrigerating the sample overnight before inoculation (option A incorrect) delays processing and can reduce recovery. Cytology alone (option B incorrect) may be appropriate when malignancy is suspected, but it is not a microbiologic test for pleural infection. Formalin (option D incorrect) preserves tissue for histopathology but kills organisms and is inappropriate for culture. Practical collection should include adequate volume, Gram stain, aerobic and anaerobic cultures, and additional tests guided by the clinical context.\n\n--------------',
  },
  {
    id: 'pleural-q07',
    category: 'pleural',
    stem: 'A 73-year-old man with severe COPD, FEV1 28% predicted, and chronic hypoxemia is admitted with a secondary spontaneous pneumothorax. A 14F chest tube connected to an underwater seal is placed under ultrasound-guided landmarking. Five days later he is comfortable on 2 L/min oxygen but continues to have a grade 1-2 air leak during expiration, and chest radiograph shows a well-placed pleural drain but incomplete lung re-expansion. He is judged a poor operative candidate after thoracic surgery evaluation. Which adjunctive treatment is most appropriate to consider?',
    options: [
      {
        id: 'a',
        text: 'Escalation of wall suction',
      },
      {
        id: 'b',
        text: 'Chest tube removal with discharge on oral antibiotics',
      },
      {
        id: 'c',
        text: 'Upsize the chest tube to size 20F',
      },
      {
        id: 'd',
        text: 'Autologous blood pleurodesis',
      },
    ],
    correctId: 'd',
    explanation:
      'In practice, management of a case such as the one presented should include review of tube position and patency, optimization of COPD, consideration of digital air-leak monitoring if available, early multidisciplinary discussion, and alignment with patient goals. For patients who can tolerate surgery, operative repair and recurrence prevention remain important and high-yield options. For this patient, less invasive pleural or bronchoscopic approaches are more appropriate. This patient has persistent air leak after chest tube drainage for secondary spontaneous pneumothorax and is not a surgical candidate. BTS 2023 guidelines notes insufficient evidence to make a firm recommendation for one best treatment, but as a good practice point, autologous blood pleurodesis or endobronchial therapies should be considered when surgery is unsuitable. Bronchoscopic one-way valves can be useful when the responsible airway can be localized, and blood patch pleurodesis may shorten hospitalization in selected patients. A useful bedside framework is to separate the problem into three questions: Is the lung re-expanding? Is there ongoing air leak? Is the patient fit for definitive surgery? In this scenario there is incomplete re-expansion with persistent leak and poor surgical fitness, making less invasive pleural or bronchoscopic leak-control strategies the most relevant options.\nChoice A is incorrect because routine suction has not shown clear benefit for persistent air leak and can sometimes perpetuate air flow through a fistula; suction may be used selectively but should not be viewed as definitive. Choice B is incorrect because removing the tube with ongoing bubbling and incomplete re-expansion risks clinical deterioration. Choice C is incorrect because the current tube is of sufficient caliber to evacuate a small-moderate persistent air leak and a larger tube size is unlikely to solve the leak, while causing unnecessary patient discomfort.',
  },
  {
    id: 'pleural-q08',
    category: 'pleural',
    stem: 'A 52-year-old woman is evaluated in the emergency department 4 days after hip arthroplasty for acute dyspnea and pleuritic chest discomfort. Temperature is 37.1 C, blood pressure is 118/70 mm Hg, heart rate is 118/min, respiratory rate is 24/min, and oxygen saturation is 91% on room air. Bedside BLUE-protocol lung ultrasound in the semirecumbent position shows bilateral anterior A-lines with lung sliding, no anterior B-lines, no posterolateral tissue sign and no pleural effusion. Which diagnosis should be most suspected by this profile?',
    options: [
      {
        id: 'a',
        text: 'Cardiogenic pulmonary edema',
      },
      {
        id: 'b',
        text: 'Pneumonia',
      },
      {
        id: 'c',
        text: 'Acute pulmonary embolism',
      },
      {
        id: 'd',
        text: 'Right pneumothorax',
      },
    ],
    correctId: 'c',
    explanation:
      'In the BLUE protocol, an A-profile with preserved anterior lung sliding suggests an aerated anterior lung surface. When this profile is paired with a postoperative state, tachycardia, pleuritic symptoms, and hypoxemia a venous thromboembolism is most suspected. A bilateral femoral vein ultrasound should be performed next. The BLUE protocol was developed for rapid bedside sorting of acute respiratory failure, and it performs best when ultrasound findings are interpreted with pretest probability, hemodynamics, and confirmatory testing when the result will change treatment or procedural risk. It is not a replacement for definitive pulmonary embolism testing when required, but it can rapidly prioritize diagnosis and management. In a stable postoperative patient, CT pulmonary angiography or an evidence-based PE pathway may follow, but the bedside profile supports immediate PE-focused evaluation and anticoagulation assessment.\nChoice A is incorrect because cardiogenic pulmonary edema is associated with a B-profile: diffuse bilateral anterior B-lines with lung sliding. Choice B is incorrect because pneumonia would be suggested by evidence of consolidation (e.g., “tissue sign”) or a pleural effusion in the posterolateral-alveolar-pleural syndrome (PLAPS) examination point, which is absent in this case. Choice D is incorrect because pneumothorax in the BLUE framework requires absent anterior lung sliding with A-lines and a lung point; this patient has preserved sliding.',
  },
  {
    id: 'pleural-q09',
    category: 'pleural',
    stem: 'A 67-year-old man with diabetes is treated for pleural infection. A 14F pigtail catheter was placed under ultrasound guidance into a right posterior collection, and he has received appropriate antibiotics for 48 hours. Temperature remains 38.2 C. Drain output has stopped despite flushing and no evidence of tube malfunction. Contrast-enhanced CT with 1.0-mm reconstructions shows a residual multiloculated pleural collection with the tube in the expected position. Platelet count is 230,000/uL, INR is 1.1, and therapeutic anticoagulation has been held. Which next step is most appropriate?',
    options: [
      {
        id: 'a',
        text: 'Streptokinase through the existing drain',
      },
      {
        id: 'b',
        text: 'DNase through the existing drain',
      },
      {
        id: 'c',
        text: 'Tissue plasminogen activator plus DNase through the existing drain',
      },
      {
        id: 'd',
        text: 'Exchange the current drain for a size 20F tube',
      },
    ],
    correctId: 'c',
    explanation:
      'For pleural infection with residual collection after initial chest tube drainage has ceased, combination intrapleural tissue plasminogen activator (tPA) plus DNase should be considered. The MIST2 trial demonstrated that the combination improved radiographic clearance and reduced surgical referral and hospital stay compared with placebo, while single-agent tPA or DNase was ineffective. BTS 2023 guidelines recommends the combination when drainage has stopped and a residual collection remains, after a bleeding-risk assessment. A commonly used regimen is tPA 10 mg plus DNase 5 mg twice daily for 3 days. Alternative tPA dosing or drug schedule strategies can be considered in higher bleeding-risk patients or for practical concerns. \nChoice A is incorrect because streptokinase is not recommended for pleural infection by current BTS guidance. Choice B is incorrect because single-agent DNase should not be used. DNA breakdown without fibrinolysis is insufficient and in MIST-2 was associated with increased surgical referral. Choice D is incorrect because the current tube is considered equivalent to larger tubes for draining complicated pleural effusions, while decreasing patient discomfort. The existing tube should first be checked for position and patency, and the collection must be accessible to the drain. There is no evidence the current tube is malfunctioning or misplaced. If pleural lysis fails, or if there is ongoing sepsis, failure of lung re-expansion, or an organized pleural peel early thoracic surgical evaluation should be obtained, especially in cases with good prognosis and surgical candidacy. VATS is generally preferred over thoracotomy when surgery is required and appropriate.',
  },
  {
    id: 'pleural-q10',
    category: 'pleural',
    stem: 'A 64-year-old woman with metastatic breast cancer has recurrent dyspnea 10 days after a therapeutic thoracentesis removed 1.2 L of pleural fluid. She is afebrile, ECOG performance status is 1, and oxygen saturation is 95% on room air. Ultrasound shows a moderate free-flowing right effusion without septations. After repeat drainage, chest radiograph shows full lung expansion. She wants durable symptom relief and hopes to avoid prolonged hospitalization, but she is concerned about managing a tube at home. Which first-line definitive management discussion is most appropriate?',
    options: [
      {
        id: 'a',
        text: 'Serial therapeutic thoracenteses',
      },
      {
        id: 'b',
        text: 'Indwelling pleural catheter or talc pleurodesis',
      },
      {
        id: 'c',
        text: 'Deferral of pleural intervention until systemic therapy is completed',
      },
      {
        id: 'd',
        text: 'Surgical decortication',
      },
    ],
    correctId: 'b',
    explanation:
      'A symptomatic recurrent malignant pleural effusion warrants a definitive pleural intervention rather than repeated aspirations alone, especially when prognosis and functional status are reasonable. For a patient with known expandable lung, current BTS and ATS/STS/STR guidance supports offering either an indwelling pleural catheter or chemical pleurodesis as first-line therapy for symptomatic MPE. Randomized trials show both strategies improve dyspnea and quality of life. Indwelling pleural catheters generally reduce initial hospital days and repeat pleural procedures, but they require home drainage and can affect body image and infection risk. Talc pleurodesis avoids a semipermanent catheter but usually requires inpatient chest tube drainage or thoracoscopy and can fail in up to 25% of cases.\nChoice A is incorrect because repeated thoracenteses are not definitive and increase the burden of recurrent procedures, although the first therapeutic aspiration is useful to assess symptom response and lung expansion. Choice C is incorrect because definitive pleural intervention should not be deferred solely until systemic anticancer therapy is completed when the patient is symptomatic. Tumor type and therapy poorly correlate with effusion recurrence. Choice D is incorrect because decortication is reserved for selected patients, particularly those with nonexpandable lung and appropriate surgical fitness, and is not routine first-line management for expandable-lung MPE.',
  },
  {
    id: 'pleural-q11',
    category: 'pleural',
    stem: 'Which pleural fluid result in a nonpurulent parapneumonic effusion most strongly supports intercostal drain placement rather than antibiotics alone?',
    options: [
      {
        id: 'a',
        text: 'pH 7.16',
      },
      {
        id: 'b',
        text: 'Protein 3.2 g/dL',
      },
      {
        id: 'c',
        text: 'Pleural-to-serum protein ratio 0.55',
      },
      {
        id: 'd',
        text: 'Neutrophil-predominant cell count',
      },
    ],
    correctId: 'a',
    explanation:
      'In a patient with a parapneumonic effusion, pleural fluid pH of 7.16 is below the key 7.20 threshold and strongly supports drainage of an accessible collection in addition to antibiotic therapy. Low pH reflects high pleural-space metabolic activity and impaired glucose transport and is a central criterion for complicated parapneumonic effusion. The result should be interpreted with attention to collection technique, because local anesthetic contamination, delay, air, and heparin can alter pH. In the absence of pH measurement, a glucose level of less than 40 mg/dL can be used to predict a complicated effusion and guide intercostal drain placement in a suspected parapneumonic effusion. \nPleural fluid protein 3.2 g/dL (option B incorrect) and a pleural-to-serum protein ratio of 0.55 (option C incorrect) are frequently seen in with parapneumonic effusions, but do not by themselves suggest the need for tube drainage. Neutrophil predominance (option D incorrect) is expected with acute inflammation and pneumonia, but it is less decisive than low pH, purulence, positive Gram stain/culture, or high-risk imaging. \n\n--------------',
  },
  {
    id: 'pleural-q12',
    category: 'pleural',
    stem: 'A 79-year-old man with severe emphysema and chronic kidney disease is evaluated before diagnostic thoracentesis for a suspected complicated left parapneumonic pleural effusion. He takes apixaban for a recent large PE and persistent DVT. Anticoagulation has been continued and the potential benefit of sampling the pleural effusion has been considered enough to outweigh the associated bleeding risk. He is afebrile, heart rate is 88/min, blood pressure is 136/78 mm Hg, and oxygen saturation is 94% on room air. Thoracic ultrasound shows a 5-cm posterolateral pocket with a positive plankton sign. For the needle insertion site, the trainee chooses a posterior interspace 3 cm lateral to the spinous process, just above the rib. However, the supervising attending physician proposes moving to a more lateral position along the same intercostal space. What is the rationale behind this adjusted approach?',
    options: [
      {
        id: 'a',
        text: 'Intercostal artery size and course are more variable near the paravertebral region',
      },
      {
        id: 'b',
        text: 'Internal mammary arteries supply the posterior costal pleura',
      },
      {
        id: 'c',
        text: 'Pulmonary veins drain the parietal pleura',
      },
      {
        id: 'd',
        text: 'Phrenic nerve branches occupy the posterior intercostal space',
      },
    ],
    correctId: 'a',
    explanation:
      'The main thoracentesis-associated risk in this patient is bleeding, and the anatomy of the intercostal arteries are the concern as they represent the primary source of pleural hemorrhage in this setting. Traditional teaching emphasizes staying just above the rib to avoid the neurovascular bundle, but this rule is least reliable near the paravertebral region. In posterior interspaces, intercostal arteries can take a variable, tortuous course and may not be protected by the inferior margin of the rib. Also, older patients can have narrower rib spaces and more tortuous vessels. Combined with a potential increase in bleeding risk in the setting of ongoing anticoagulation, choosing a lateral approach, if possible, rather than a very posterior site becomes even more important. This anatomic nuance is why thoracic ultrasound should identify a safe window rather than simply confirm fluid. The ideal window characterizes skin-pleural distance, fluid depth, diaphragm position, lung movement, and expected vessel location. In an older anticoagulated patient, careful site selection can help avert a major bleeding complication.\nChoice B is incorrect because the internal mammary artery is an anterior parasternal structure and is not the principal hazard in the proposed postero-paravertebral puncture. Choice C is incorrect because pulmonary veins drain the visceral pleura and lung; they do not define the major bleeding risk during a costal parietal pleural puncture. Choice D is incorrect because phrenic nerve branches are not located in every posterior interspace, and local anesthetic is standard for a safe and tolerable procedure.',
  },
  {
    id: 'pleural-q13',
    category: 'pleural',
    stem: 'A 77-year-old woman with heart failure with reduced ejection fraction is admitted with volume overload and bilateral pleural effusions. She improves after 3 days of intravenous furosemide, but a moderate right effusion persists. She is afebrile, heart rate is 78/min, blood pressure is 118/70 mm Hg, and oxygen saturation is 95% on room air. Ultrasound shows simple fluid without septations. Thoracentesis is performed and pleural fluid protein is 3.9 g/dL, serum protein is 7.0 g/dL, pleural fluid LDH is 110 U/L, serum LDH is 210 U/L, pleural fluid albumin is 2.6 g/dL, and serum albumin is 4.0 g/dL. Which interpretation best fits this fluid profile?',
    options: [
      {
        id: 'a',
        text: 'Malignant exudate',
      },
      {
        id: 'b',
        text: 'Tuberculous pleuritis',
      },
      {
        id: 'c',
        text: 'Diuretic-associated heart-failure pseudoexudate',
      },
      {
        id: 'd',
        text: 'Chylothorax',
      },
    ],
    correctId: 'c',
    explanation:
      'The pleural fluid-to-serum protein ratio is 3.9/7.0 = 0.56, so the sample meets one exudative Light criterion. However, the clinical setting strongly supports heart failure after diuresis, the ultrasound is simple, and the LDH criteria are negative. Diuresis can concentrate pleural protein and convert a biochemical transudate into a pseudoexudate by Light’s criteria. The serum-to-pleural albumin gradient is a useful measure in this clinical context, and in this case is 4.0 - 2.6 = 1.4 g/dL. This is above the established 1.2 g/dL threshold and supports reclassification as a transudative heart-failure effusion. \nChoice A is incorrect because Light’s criteria are intentionally sensitive for exudates and can misclassify diuretic-treated transudates. Also, a malignant diagnosis is not suspected given the clinical presentation. Choice B is incorrect because an elevated serum-to-pleural albumin gradient supports a transudative mechanism, not tuberculous pleuritis, and again the history is not suggestive. Choice D is incorrect because chylothorax is evaluated by triglycerides and chylomicrons, not by a low LDH ratio.',
  },
  {
    id: 'pleural-q14',
    category: 'pleural',
    stem: 'A 62-year-old woman with reduced ejection fraction heart failure and chronic kidney disease presents with 2 weeks of progressive exertional dyspnea and right-sided chest heaviness. She has been noncompliant with home medications. She is afebrile, blood pressure is 138/74 mm Hg, heart rate is 86/min, respiratory rate is 22/min, and oxygen saturation is 91% on room air. Thoracic ultrasound with a curvilinear probe shows bilateral anterior B-lines, a simple large anechoic right pleural effusion extending from the base to the mid-scapular line, with compressive atelectasis and no septations. There is also a small left simple pleural effusion. She undergoes right ultrasound-guided therapeutic thoracentesis with removal of 1.5 L. Within minutes she reports that breathing feels easier, but oxygen saturation increases only to 92% and bedside spirometry improves only modestly. Which mechanism best accounts for the post-procedure clinical findings?',
    options: [
      {
        id: 'a',
        text: 'Improvement of intrapulmonary shunt',
      },
      {
        id: 'b',
        text: 'Reduced diaphragmatic distortion and improved respiratory system mechanics',
      },
      {
        id: 'c',
        text: 'Resolution of alveolar edema from a shift in plasma oncotic pressure',
      },
      {
        id: 'd',
        text: 'Normalization of pleural lymphatic flow with lower pulmonary vascular resistance',
      },
    ],
    correctId: 'b',
    explanation:
      'Dyspnea is the most common clinical manifestation related to a pleural effusion. Its rapid improvement after large volume thoracentesis is best explained by improvement in diaphragmatic mechanics rather than that of lung volume or shunt physiology. Large effusions can alter pleural pressure, expand the hemithorax, flatten or evert the hemidiaphragm, and impair the efficiency of diaphragmatic contraction. Pleural pressure studies also support the concept that symptom generation during drainage relates to pressure-volume behavior and respiratory mechanics rather than only the amount of fluid removed. Spirometric improvement after thoracentesis is usually only modest, about a few hundred milliliters per liter removed. Arterial oxygenation may not improve substantially because the underlying intrapulmonary shunt or parenchymal process often persist. Even moderate hypoxemia is rarely attributed to a pleural effusion, and more likely reflects an alveolar filling process or other shunt physiology, such as hydrostatic pulmonary edema seen in this case. Drainage may therefore produce prompt symptomatic relief by improving respiratory system mechanics even when gas exchange changes little. \nChoice A and C overstate the oxygen effect. A marked immediate rise in arterial oxygen tension is not expected in most patients when the primary cause of the underling shunt physiology has not been treated. Choice D concerns lymphatic physiology, which is important for pleural fluid turnover, but it does not explain the immediate relief after a therapeutic drainage.',
  },
  {
    id: 'pleural-q15',
    category: 'pleural',
    stem: 'A 55-year-old man with newly diagnosed mediastinal lymphoma presents with progressive dyspnea. Temperature is 36.9 C, heart rate is 96/min, and oxygen saturation is 94% on room air. CT with 1.25-mm reconstructions shows a large left pleural effusion and bulky mediastinal lymphadenopathy without pleural nodularity. Thoracic ultrasound shows a free-flowing effusion. Thoracentesis yields opaque fluid. Pleural triglyceride level is 238 mg/dL, cholesterol is 52 mg/dL, hematocrit is 1%, and Gram stain is negative. Which diagnosis best explains the effusion?',
    options: [
      {
        id: 'a',
        text: 'Pseudochylothorax',
      },
      {
        id: 'b',
        text: 'Complicated parapneumonic effusion',
      },
      {
        id: 'c',
        text: 'Hemothorax',
      },
      {
        id: 'd',
        text: 'Chylothorax',
      },
    ],
    correctId: 'd',
    explanation:
      'Milky or opaque pleural fluid with triglycerides above 110 mg/dL strongly supports chylothorax, and lymphoma is a classic nontraumatic cause through thoracic duct obstruction or disruption. Chylomicron testing can confirm uncertain cases, particularly when triglyceride values are intermediate or the patient is fasting. The low pleural cholesterol also fits chylothorax rather than pseudochylothorax. \nChoice A is incorrect because pseudochylothorax occurs in long-standing inflammatory effusions such as rheumatoid pleuritis or chronic tuberculosis; it is typically cholesterol rich, may contain cholesterol crystals, and does not reflect thoracic duct chyle leakage. Choice B is incorrect because complicated parapneumonic effusion is driven by infection and low pleural pH or glucose; Gram stain can be negative, but the opaque high-triglyceride fluid and lymphoma context point elsewhere. Choice C is incorrect because hemothorax requires a high pleural fluid hematocrit (>0.5) relative to blood; this sample is not bloody. Management focuses on treating the cause, relieving symptoms, and reducing chyle flow with dietary fat modification using medium-chain triglycerides, possible octreotide, and drainage when needed. Persistent high-output chylothorax may require lymphangiography with embolization or surgical thoracic duct ligation, depending on etiology and local expertise.',
  },
] as const satisfies readonly PccmAssessmentQuestion[]

export const pccmBronchoscopyQuestions = pccmAssessmentQuestions.filter(
  (question) => question.category === 'bronchoscopy',
)

export const pccmPleuralQuestions = pccmAssessmentQuestions.filter(
  (question) => question.category === 'pleural',
)
