import type { CurriculumMonth } from '@/types/curriculum'

export const rigidBronchoscopyCurriculum: CurriculumMonth[] = [
  {
    month: 1,
    title: 'Introduction, Indications, and Equipment Basics',
    description:
      "Overview of rigid bronchoscopy's role, clinical indications, and basic equipment familiarization",
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Understand the role of rigid bronchoscopy in interventional pulmonology
- Identify clinical indications and contraindications
- Recognize and name all components of the rigid bronchoscope
- Compare rigid vs. flexible bronchoscopy applications

### Introduction to Rigid Bronchoscopy

Rigid bronchoscopy (RB) is a cornerstone skill in interventional pulmonology, providing unique capabilities for managing complex airway pathology. This month introduces the fundamental concepts that will form the foundation for your year-long training.

#### Key Historical Context

Rigid bronchoscopy was the first bronchoscopic technique, pioneered by Gustav Killian in 1897 for foreign body removal. Despite the advent of flexible bronchoscopy, rigid bronchoscopy remains irreplaceable for certain procedures.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Clinical Indications

#### Therapeutic Indications
- **Malignant Central Airway Obstruction (CAO):** Tumor debulking, laser therapy, stent placement
- **Benign CAO:** Post-intubation stenosis, inflammatory strictures
- **Massive Hemoptysis:** Superior suction capability and airway control
- **Foreign Body Aspiration:** Large bore allows use of various retrieval instruments
- **Silicone Stent Placement:** Requires rigid bronchoscope for deployment

#### Diagnostic Indications
- Large airway biopsies when bleeding risk is high
- Assessment before surgical resection

#### Important Note

Absolute contraindications are few: cervical spine instability, severe hemodynamic instability. Most contraindications are relative and must be weighed against potential benefits.`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Rigid Bronchoscope Components

Equipment Assembly Demonstration Video

#### Main Components:
- **Bronchoscope Barrel:** Available in sizes 3-18mm diameter, various lengths
- **Telescopes:** 0°, 30°, and 90° viewing angles
- **Light Source:** High-intensity cold light source
- **Ventilation Ports:** Side ports for ventilation connection
- **Working Channel:** For instrument passage

#### Common Accessories:
- Large biopsy forceps
- Suction catheters (various sizes)
- Foreign body retrieval forceps
- Optical forceps
- Cleaning brushes

#### Size Selection Guidelines:

| Patient Type | Typical Size Range |
| --- | --- |
| Adult Male | 8.5-9.5 mm |
| Adult Female | 7.5-8.5 mm |
| Pediatric | 3-7 mm |`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Clinical Problem Solving

**Scenario:** Patient with post-intubation tracheal stenosis, failed dilation x2. You place a silicone stent. Two weeks later, they return with dyspnea. Most likely cause?


                                A) Stent fracture
                                B) Mucus plugging
                                C) Tracheomalacia
                                D) Pneumothorax
**Technical Question:** When deploying a Y-stent at the carina, which limb should be positioned first?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Comprehensive Review:** Folch E, et al. "Airway stents" *Ann Cardiothorac Surg* 2018
                            
                            
                                **Technical Guide:** Dutau H, et al. "Silicone stents - The rigid bronchoscopy approach" *J Bronchology Interv Pulmonol* 2019
                            
                            
                                **Complications:** Oki M, Saka H. "Airway stenting for patients with malignant central airway obstruction" *Respirology* 2018`,
      },
    ],
  },
  {
    month: 2,
    title: 'Anesthesia and Airway Management',
    description:
      'Principles of anesthesia management during RB, ventilation strategies, and patient safety',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Understand why TIVA is preferred for rigid bronchoscopy
- Master ventilation strategies: controlled, spontaneous-assisted, and jet ventilation
- Recognize and manage anesthetic complications
- Coordinate effectively with the anesthesia team

### Anesthesia for Rigid Bronchoscopy

Rigid bronchoscopy requires close collaboration with anesthesia. Unlike flexible bronchoscopy, RB typically requires general anesthesia with specific considerations for the open airway system.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Total Intravenous Anesthesia (TIVA)

#### Why TIVA is Essential:
- **Open Ventilation System:** Inhaled anesthetics would vent to the OR environment
- **Variable Depth Requirements:** Need for rapid adjustments during procedure
- **Safety:** Avoids exposure of OR staff to anesthetic gases

#### Common TIVA Regimens:
- **Induction:** Propofol 1-2 mg/kg + Fentanyl 1-2 mcg/kg
- **Maintenance:** Propofol infusion 100-200 mcg/kg/min + Remifentanil 0.05-0.2 mcg/kg/min
- **Muscle Relaxation:** Rocuronium or succinylcholine for intubation

#### Clinical Pearl

Short-acting agents allow rapid emergence important for airway protection post-procedure. Always ensure reversal agents are immediately available.`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Ventilation Strategies

Jet Ventilation Setup and Monitoring Video

#### 1. Controlled Ventilation
- Standard positive pressure through side port
- Allows ETCO2 monitoring
- May cause movement during delicate procedures

#### 2. Spontaneous-Assisted Ventilation
- Patient breathes spontaneously with pressure support
- Less movement, better for laser work
- Requires lighter anesthesia plane

#### 3. Jet Ventilation
- **Advantages:** Minimal airway movement, excellent surgical conditions
- **Settings:** Driving pressure 20-50 psi, Rate 100-150/min
- **Risks:** Barotrauma (rare), hypercapnia, difficult monitoring

| Ventilation Mode | Best For | Limitations |
| --- | --- | --- |
| Controlled | Routine cases, teaching | Movement with breaths |
| Spontaneous | Diagnostic procedures | Light anesthesia only |
| Jet | Laser, precise work | No ETCO2, hypercapnia risk |`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Knowledge Check

**Question 1:** Why is TIVA preferred over inhaled anesthetics for rigid bronchoscopy?


                                A) Lower cost
                                B) Open ventilation system would vent gases to OR
                                C) Better muscle relaxation
                                D) Faster recovery time
**Question 2:** What is the main advantage of jet ventilation during rigid bronchoscopy?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Primary:** Diaz-Mendoza J, et al. - Anesthesia considerations and ventilation modes sections
                            
                            
                                **Secondary:** Pathak V, et al. "Ventilation and Anesthetic Approaches for Rigid Bronchoscopy" *Ann Am Thorac Soc* 2014
                            
                            
                                **Reference:** ASA Guidelines for Management of the Difficult Airway - relevant sections`,
      },
    ],
  },
  {
    month: 3,
    title: 'Rigid Scope Intubation Technique',
    description:
      'Master the fundamental skill of rigid bronchoscope intubation and basic airway navigation',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Perform smooth, atraumatic rigid bronchoscope intubation
- Navigate to all major airways systematically
- Recognize and avoid common technical errors
- Manage difficult intubation scenarios

### Mastering Rigid Bronchoscope Intubation

Rigid bronchoscope intubation is the foundational skill for all advanced procedures. Studies show achieving consistent first-pass success requires 10-20 supervised attempts. This month focuses on deliberate practice to build muscle memory and confidence.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Step-by-Step Intubation Technique

#### Pre-Intubation Setup:
1. **Patient Positioning:** Sniffing position (flexion at lower C-spine, extension at atlanto-occipital joint)

2. **Equipment Check:** Appropriate scope size, light source functioning, suction ready

3. **Tooth Protection:** Always use dental guard or wet gauze

4. **Team Communication:** Confirm anesthesia ready, ventilation plan clear

#### Intubation Sequence:
1. **Scope Entry:** Insert scope over tongue midline, advance to visualize epiglottis

2. **Epiglottis Elevation:** Use scope bevel to gently lift epiglottis anteriorly

3. **Vocal Cord Visualization:** Identify cords, note any pathology

4. **The 90° Rotation:** Turn scope 90° to align bevel with cord opening

5. **Gentle Advancement:** Pass through cords with steady pressure, never force

6. **Confirmation:** Visualize tracheal rings, carina in distance

#### Critical Safety Point

If resistance is met at vocal cords, STOP. Reassess position, consider smaller scope, or use laryngoscope assistance. Forcing risks laryngeal trauma or arytenoid dislocation.`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Navigation and Troubleshooting

First-Person View: Rigid Scope Intubation and Navigation

#### Systematic Airway Examination:
1. **Trachea:** Note position, patency, mucosal appearance

2. **Carina:** Sharp or blunted? Fixed or mobile?

3. **Main Bronchi:** Advance to each, assess patency

4. **Lobar Orifices:** Visualize with telescope or flexible scope through rigid

#### Common Challenges & Solutions:

| Challenge | Solution |
| --- | --- |
| Cannot visualize epiglottis | Adjust head position, use laryngoscope, consider awake intubation |
| Vocal cords in spasm | Deepen anesthesia, topical lidocaine, gentle technique |
| Excessive secretions | Suction before advancing, antisialagogue premedication |
| Subglottic stenosis | Serial dilation with progressively larger scopes |`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Skills Assessment

**Scenario 1:** During rigid scope insertion, you meet resistance at the vocal cords. What is your next action?


                                A) Apply more force to pass through
                                B) Stop, reassess position, consider smaller scope
                                C) Rotate the scope 180°
                                D) Ask anesthesia for more paralysis
**Scenario 2:** The optimal head position for rigid bronchoscope intubation is:`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Primary:** Ernst A, Herth FJF. "Principles and Practice of Interventional Pulmonology" - Chapter on Rigid Bronchoscopy Technique
                            
                            
                                **Technical:** Mahmood K, et al. "Evaluation of a Tool to Assess Bronchoscopy Competence: RIGID-TASC" *Ann Am Thorac Soc* 2017
                            
                            
                                **Video Resource:** AABIP Rigid Bronchoscopy Training Videos (available to members)`,
      },
    ],
  },
  {
    month: 4,
    title: 'Mechanical Tumor Debulking & Foreign Body Removal',
    description:
      'Learn fundamental therapeutic techniques using mechanical methods through the rigid scope',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Perform mechanical tumor debulking safely and effectively
- Master foreign body retrieval techniques
- Manage massive hemoptysis with rigid bronchoscopy
- Select appropriate instruments for different scenarios

### Mechanical Interventions

The rigid bronchoscope itself is a powerful therapeutic tool. Its large working channel allows passage of substantial instruments and provides superior suction for managing bleeding and debris.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Tumor Debulking Techniques

#### The "Coring" Technique:
1. Position scope tip at tumor edge

2. Apply gentle forward pressure with rotation

3. Use scope barrel to core out central tumor

4. Withdraw scope with tumor inside

5. Clear debris, reassess, repeat as needed

#### Rigid Forceps Debulking:
- **Instrument Selection:** Large cup forceps for friable tumors, alligator for firm tissue
- **Technique:** Bite, twist gently, withdraw - avoid pulling to prevent bleeding
- **Tips:** Work from center outward, maintain visualization, have suction ready

#### Managing Bleeding During Debulking
1. Position patient (bleeding side down if unilateral)

                            2. Large volume iced saline irrigation

                            3. Rigid scope tamponade

                            4. Have APC/laser ready for coagulation

                            5. Consider topical epinephrine (1:10,000)`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Foreign Body Removal

Case Video: Foreign Body Retrieval Techniques

#### Instrument Selection by Object Type:

| Foreign Body Type | Preferred Instrument | Technique Tips |
| --- | --- | --- |
| Organic (food, nuts) | Optical forceps, baskets | May fragment - remove all pieces |
| Metallic (pins, coins) | Alligator forceps, magnets | Grasp firmly, orient for removal |
| Teeth/bones | Retrieval basket, forceps | Check for associated trauma |
| Plastic objects | Cryoprobe, forceps | May be radiolucent |

#### Retrieval Principles:
1. **Never push distally** - If object moves deeper, stop and reassess

2. **Protect the airway** - Have backup plan if object dislodges

3. **Complete inspection** - Always bronch after removal for fragments

4. **Document thoroughly** - Photo if possible, describe retrieval`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Clinical Decision Making

**Case 1:** 65-year-old with near-complete left main bronchus obstruction by squamous cell carcinoma. Best initial approach?


                                A) Mechanical debulking with rigid scope coring
                                B) Immediate stent placement
                                C) Flexible bronchoscopy with APC
                                D) Referral to radiation oncology
**Case 2:** During tumor debulking, brisk bleeding occurs. Your first action should be:`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Primary:** Ost D, et al. "Therapeutic bronchoscopy for malignant central airway obstruction" *Chest* 2015
                            
                            
                                **Technique:** Semaan R, Yarmus L. "Rigid bronchoscopy and silicone stents" *Clin Chest Med* 2015
                            
                            
                                **Foreign Body:** Sehgal IS, et al. "Foreign Body Inhalation in the Adult Population" *Med Sci* 2015`,
      },
    ],
  },
  {
    month: 5,
    title: 'Advanced Ablation Techniques',
    description:
      'Master laser therapy, electrocautery, APC, and cryotherapy for airway interventions',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Understand principles and safety of each ablative modality
- Select appropriate ablation technique for specific lesions
- Prevent and manage complications including airway fires
- Integrate ablation with other therapeutic modalities

### Ablative Technologies in Rigid Bronchoscopy

Ablative techniques allow precise tissue destruction for tumor debulking, hemostasis, and airway recanalization. Each modality has unique characteristics that determine its optimal use.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Laser Therapy

#### Nd:YAG Laser (1064 nm wavelength):
- **Mechanism:** Tissue vaporization through thermal energy
- **Settings:** 20-40 watts, pulse duration 0.5-1.0 seconds
- **Advantages:** Excellent for bulky tumors, immediate effect
- **Disadvantages:** Fire risk, expensive, requires training

#### Laser Fire Prevention Protocol

**MANDATORY:**

                            • FiO2 ≤ 40% (ideally ≤ 30%)

                            • Use jet ventilation when possible

                            • Have saline and fire extinguisher immediately available

                            • All personnel wear protective eyewear

                            • Never fire at dry tissue or reflected surfaces

#### Electrocautery & Argon Plasma Coagulation:

| Feature | Electrocautery | APC |
| --- | --- | --- |
| Contact required | Yes | No (2-5mm distance) |
| Depth of penetration | Variable, deeper | Superficial (2-3mm) |
| Best use | Cutting, deep coagulation | Surface bleeding, flat lesions |
| Settings | Blend 2, 30-40W | 40W, 1.5 L/min flow |`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Cryotherapy

Demonstration: Cryotherapy Probe Techniques

#### Cryotherapy Principles:
- **Mechanism:** Tissue destruction via freeze-thaw cycles (-40 to -80°C)
- **Probe sizes:** 1.9mm, 2.4mm flexible probes
- **Freeze time:** 10-30 seconds depending on application

#### Applications:
1. **Cryorecanalization:** Freeze tumor → Extract en bloc with probe

2. **Cryobiopsy:** Superior tissue architecture preservation

3. **Foreign body/clot extraction:** Freeze and remove adherent material

4. **Spray cryotherapy:** For diffuse disease (requires special equipment)

#### Choosing the Right Modality:


                        
                            **Clinical Scenarios:**

                            • **Bulky endobronchial tumor:** Laser or mechanical + laser

                            • **Bleeding tumor surface:** APC (safest for hemostasis)

                            • **Benign granulation tissue:** Cryotherapy or low-power laser

                            • **Web-like stenosis:** Electrocautery knife or laser

                            • **Highly vascular tumor:** Avoid laser, use cryo or mechanical`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Safety and Decision Making

**Critical Thinking 1:** You're using Nd:YAG laser for tumor ablation. The anesthesiologist reports FiO2 is 60%. Your action?


                                A) Proceed with extra caution
                                B) Stop immediately and reduce FiO2 to ≤40%
                                C) Switch to electrocautery
                                D) Continue but use shorter pulses
**Critical Thinking 2:** For superficial bleeding from a friable tumor, the best ablation choice is:`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Comprehensive Review:** Dutau H, et al. "A 20-year experience with laser resection" *Chest* 2020
                            
                            
                                **Safety Focus:** Folch E, Mehta AC. "Airway interventions in the tracheobronchial tree" *Semin Respir Crit Care Med* 2018
                            
                            
                                **Registry Data:** Ost D, et al. "Complications Following Therapeutic Bronchoscopy (AQuIRE)" *Am J Respir Crit Care Med* 2015`,
      },
    ],
  },
  {
    month: 6,
    title: 'Airway Dilation & Stenosis Management',
    description:
      'Master techniques for managing benign airway stenosis through dilation procedures',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Perform safe airway dilation using rigid scopes and balloons
- Recognize different types of stenosis and their management
- Understand the role of dilation in multimodal therapy
- Prevent and manage dilation complications

### Managing Benign Airway Stenosis

Benign stenoses often require repeated interventions. Understanding the underlying pathology guides treatment selection between dilation, ablation, stenting, or surgical referral.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Types of Benign Stenosis

#### Classification by Etiology:

| Type | Common Causes | Treatment Approach |
| --- | --- | --- |
| Post-intubation | Cuff pressure injury | Dilation ± laser ± stent |
| Post-tracheostomy | Stoma site scarring | Serial dilation, surgery |
| Inflammatory | Wegener's, sarcoid | Medical therapy + dilation |
| Idiopathic | Unknown | Serial dilations common |

#### Rigid Bronchoscope Dilation Technique:
1. **Assessment:** Measure stenosis diameter and length

2. **Progressive dilation:** Start 1-2mm below current diameter

3. **Gentle advancement:** Steady pressure, watch for blanching

4. **Incremental increases:** Advance by 1mm increments

5. **Stop points:** Mucosal tear, significant resistance, or target diameter

#### Pearl: The "Rule of 3s"

For safe dilation:

                            • Dilate maximum 3mm per session

                            • Wait 3 weeks between sessions

                            • Consider alternatives after 3 failed attempts`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Balloon Bronchoplasty

Video: CRE Balloon Dilation Technique

#### Balloon Selection and Technique:
- **CRE Balloons:** 3 diameters per balloon (e.g., 12-13.5-15mm)
- **Sizing:** Start at stenosis diameter, increase gradually
- **Inflation time:** 30-60 seconds at target pressure
- **Pressure monitoring:** Use manometer, never exceed rated pressure

#### Combining Techniques:
1. **Laser + Dilation:** Radial incisions before dilation for fibrotic stenosis

2. **Dilation + Steroid injection:** For inflammatory stenoses

3. **Dilation + Mitomycin C:** May reduce restenosis (evidence mixed)

4. **Dilation + Stenting:** For stenoses that recur rapidly

#### Complication Recognition & Management:


                        
                            **Warning Signs During Dilation:**

                            • Sudden loss of resistance → possible perforation

                            • Subcutaneous emphysema → stop immediately

                            • Significant bleeding → likely mucosal tear

                            • Stridor post-procedure → edema, consider steroids


                            **Management:** Stop dilation, assess damage, consider CT, surgical consultation if perforation suspected`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Clinical Decision Making

**Case Study:** 45-year-old woman with 6mm tracheal stenosis 2cm below vocal cords, post-intubation. Currently 12mm normal tracheal diameter. Best initial approach?


                                A) Dilate immediately to 12mm
                                B) Progressive rigid dilation to 9mm maximum
                                C) Laser resection without dilation
                                D) Immediate tracheal resection referral
**Technical Question:** During balloon dilation, you notice subcutaneous emphysema developing. Your immediate action?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Guidelines:** Galluccio G, et al. "Interventional endoscopy in the management of benign tracheal stenoses" *Eur Respir J* 2019
                            
                            
                                **Technique Review:** Bacon JL, et al. "Benign central airway stenosis" *Dis Mon* 2019
                            
                            
                                **Outcomes:** Rahman NA, et al. "Flexible bronchoscopic management of benign tracheal stenosis" *J Bronchology Interv Pulmonol* 2018`,
      },
    ],
  },
  {
    month: 7,
    title: 'Airway Stenting Techniques',
    description: 'Master silicone stent placement and management of stent-related complications',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Select appropriate stent type and size for various pathologies
- Deploy silicone stents through rigid bronchoscope
- Manage stent complications including migration and obstruction
- Plan long-term stent surveillance and care

### Airway Stenting Principles

Stenting provides structural support for compromised airways. Silicone stents, requiring rigid bronchoscopy for placement, remain the gold standard for benign disease due to their removability and lower granulation tissue formation.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Stent Selection Guide

#### Types of Airway Stents:

| Stent Type | Advantages | Disadvantages | Best Use |
| --- | --- | --- | --- |
| Silicone (Dumon) | Removable, repositionable, cheap | Migration risk, thick wall | Benign disease |
| SEMS (metallic) | Easy placement, thin wall | Difficult removal, granulation | Malignant disease |
| Hybrid | Less migration, partially covered | Complex, expensive | Selected cases |
| Y-stents | Carinal pathology coverage | Difficult placement | Carinal lesions |

#### Sizing Principles:
- **Diameter:** 10-20% larger than stenosis, match normal airway
- **Length:** Extend 5mm beyond pathology on each end
- **Special considerations:** Account for dynamic changes with breathing

#### Clinical Pearl: Stent Migration Prevention

• Use studded (external studs) stents when possible

                            • Ensure adequate sizing - too small = migration

                            • Consider hooded stents for proximal trachea

                            • Avoid stenting purely extrinsic compression without intrinsic component`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Silicone Stent Deployment

Video: Dumon Stent Loading and Deployment

#### Step-by-Step Deployment:
1. **Preparation:**
- Confirm stent size and type
- Lubricate stent with saline
- Test deployment system

2. **Loading:**
- Fold stent and load into applicator
- Ensure proper orientation (studs out)
- Secure pusher mechanism

3. **Deployment:**
- Position loaded applicator at target site
- Deploy distal end first
- Gradually release while maintaining position
- Adjust with forceps if needed

4. **Confirmation:**
- Assess position and patency
- Check for appropriate expansion
- Clear any secretions

#### Managing Stent Complications:


                        
                            **Common Complications & Solutions:**


                            **Migration (5-20%):**

                            • Reposition with forceps or remove/replace

                            • Consider different size or type


                            **Mucus plugging (10-30%):**

                            • Regular nebulized saline/mucolytics

                            • Bronchoscopic cleaning PRN


                            **Granulation tissue (15-40%):**

                            • Laser or APC ablation

                            • Consider stent removal if recurrent


                            **Infection:**

                            • Culture-directed antibiotics

                            • Remove if persistent`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Clinical Problem Solving

**Scenario:** Patient with post-intubation tracheal stenosis, failed dilation x2. You place a silicone stent. Two weeks later, they return with dyspnea. Most likely cause?


                                A) Stent fracture
                                B) Mucus plugging
                                C) Tracheomalacia
                                D) Pneumothorax
**Technical Question:** When deploying a Y-stent at the carina, which limb should be positioned first?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Comprehensive Review:** Folch E, et al. "Airway stents" *Ann Cardiothorac Surg* 2018
                            
                            
                                **Technical Guide:** Dutau H, et al. "Silicone stents - The rigid bronchoscopy approach" *J Bronchology Interv Pulmonol* 2019
                            
                            
                                **Complications:** Oki M, Saka H. "Airway stenting for patients with malignant central airway obstruction" *Respirology* 2018`,
      },
    ],
  },
  {
    month: 8,
    title: 'Complication Management & Emergency Protocols',
    description:
      'Master recognition and management of rigid bronchoscopy complications and emergencies',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Recognize complications early and respond appropriately
- Execute emergency protocols including hemorrhage control
- Understand risk stratification and prevention strategies
- Lead crisis management in the bronchoscopy suite

### Complication Prevention and Management

While rigid bronchoscopy is generally safe (major complications ~3-4%), the ability to rapidly recognize and manage complications is essential. Most complications are manageable when identified early.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Complication Recognition and Initial Management

#### Major Complications by Frequency:

| Complication | Incidence | Recognition | Immediate Action |
| --- | --- | --- | --- |
| Hemorrhage | 0.5-2% | Brisk bleeding obscuring view | Tamponade, position, suction |
| Hypoxemia | 2-5% | SpO2 <90%, cyanosis | Pause procedure, clear airway |
| Pneumothorax | 0.1-0.5% | Subcutaneous emphysema | Stop procedure, CXR stat |
| Airway fire | Rare | Flash, smoke | Remove O2, flood with saline |

#### Hemorrhage Management Algorithm:


                        
                            **Step 1: Control**

                            • Wedge rigid scope against bleeding site

                            • Turn patient bleeding-side down

                            • Large volume iced saline irrigation


                            
                            **Step 2: Identify Source**

                            • Clear field with suction

                            • Localize bleeding vessel/tumor


                            
                            **Step 3: Definitive Management**

                            • APC/laser for coagulation

                            • Topical epinephrine (1:10,000)

                            • Consider bronchial blocker

                            • Interventional radiology backup


                            
                            **Step 4: Secure Airway**

                            • Consider intubating opposite lung

                            • ICU transfer for monitoring`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Emergency Equipment and Protocols

Simulation Video: Managing Massive Hemorrhage

#### Essential Emergency Equipment Checklist:
- ✓ Multiple rigid bronchoscopes (backup sizes)
- ✓ High-flow suction (x2 setups)
- ✓ Iced saline (2-3 liters immediately available)
- ✓ Hemostatic agents (epinephrine, thrombin)
- ✓ APC/electrocautery ready
- ✓ Bronchial blockers
- ✓ Emergency airway cart
- ✓ Fire extinguisher (CO2)

#### Crisis Resource Management:


                        
                            **Communication Protocol:**

                            1. **Call out complication clearly:** "We have significant bleeding"

                            2. **Assign roles:** Primary operator, assistant, anesthesia, circulator

                            3. **Closed-loop communication:** Confirm all orders received

                            4. **Regular updates:** "Bleeding controlled, patient stable"


                            
                            **Team Roles During Crisis:**

                            • **Bronchoscopist:** Control bleeding, maintain airway

                            • **Anesthesia:** Hemodynamics, oxygenation, blood products

                            • **Assistant:** Prepare equipment, medications

                            • **Circulator:** Call for help, document
#### Prevention Strategies:
1. **Patient Selection:** Risk stratify (ASA score, urgency, comorbidities)

2. **Pre-procedure Planning:** Review imaging, have backup plans

3. **Technical Excellence:** Gentle technique, appropriate force

4. **Team Preparation:** Brief team on patient risks, emergency plans`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Emergency Scenario Management

**Critical Scenario:** During laser tumor ablation, you see a flash and smoke. What is your FIRST action?


                                A) Increase suction
                                B) Remove all oxygen sources immediately
                                C) Continue laser at lower power
                                D) Insert flexible scope to assess
**Management Priority:** Patient develops severe hypoxemia (SpO2 75%) during rigid bronchoscopy. After pausing the procedure, your next action?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Registry Data:** Ost DE, et al. "Complications Following Therapeutic Bronchoscopy for Malignant CAO: Results of the AQuIRE Registry" *Chest* 2015
                            
                            
                                **Safety Review:** Mahmood K, et al. "Complications of Therapeutic Bronchoscopy" *Clin Chest Med* 2018
                            
                            
                                **Crisis Management:** Lamb C, et al. "Crisis Management in Interventional Pulmonology" *J Bronchology Interv Pulmonol* 2019`,
      },
    ],
  },
  {
    month: 9,
    title: 'Complex Case Management',
    description:
      'Integrate advanced techniques for managing complex airway pathology with multidisciplinary approaches',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Plan and execute multimodal airway interventions
- Manage complex anatomical challenges (carinal, bilateral disease)
- Coordinate multidisciplinary care effectively
- Recognize when to refer for surgical management

### Advanced Case Management

Complex airway cases require integration of all learned techniques, careful planning, and often multidisciplinary collaboration. Success depends on thorough assessment, appropriate technique selection, and recognizing limitations.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Approach to Complex Cases

#### Complex Case Categories:


                        
                            **1. Anatomically Challenging:**

                            • Carinal tumors requiring Y-stents

                            • Long-segment stenosis (>4cm)

                            • Multiple stenoses at different levels

                            • Tracheoesophageal fistulas


                            
                            **2. High-Risk Patients:**

                            • Severe cardiac/pulmonary comorbidities

                            • Prior radiation with friable tissue

                            • Bleeding diathesis

                            • Single functioning lung


                            
                            **3. Technical Complexity:**

                            • Need for multiple modalities

                            • Prior failed interventions

                            • Tumor involving >50% circumference

                            • Mixed intrinsic/extrinsic compression
#### Multimodal Strategy Example - Carinal Tumor:
1. **Assessment:** CT imaging, pulmonary function, surgical candidacy

2. **Team Assembly:** IP, thoracic surgery, anesthesia, oncology

3. **Procedure Planning:**
- Mechanical debulking of tumor bulk
- Laser ablation of residual tumor
- Y-stent placement if extrinsic component
- Plan for potential ECMO if needed

4. **Backup Plans:** Surgical standby, IR for bleeding`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Special Techniques and Considerations

Case Presentation: Complex Carinal Y-Stent Placement

#### Tracheoesophageal Fistula Management:


                        
                            **Dual Stenting Approach:**

                            1. **Airway First:** Place covered tracheal/bronchial stent

                            2. **Coordinate with GI:** Esophageal stent placement

                            3. **Stent Selection:** Covered SEMS or silicone

                            4. **Positioning:** Ensure stents don't compress each other

                            5. **Follow-up:** High risk of migration/complications
#### Decision Algorithm: Surgery vs. Bronchoscopic Management

| Factor | Favors Surgery | Favors Bronchoscopy |
| --- | --- | --- |
| Patient fitness | Good surgical candidate | High surgical risk |
| Stenosis length | <4cm tracheal | >4cm or bronchial |
| Disease type | Localized benign | Malignant, multifocal |
| Prior treatment | Failed bronchoscopy | No prior intervention |

#### Staging Complex Procedures:

Consider breaking complex cases into stages:
- **Stage 1:** Establish airway patency (debulking/dilation)
- **Stage 2:** Definitive therapy (stenting) after recovery
- **Benefits:** Reduced procedure time, better planning, safer`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Complex Case Planning

**Case Challenge:** 72-year-old with lung cancer involving carina, 80% obstruction of left main bronchus, 50% right. Best approach?


                                A) Right pneumonectomy
                                B) Tumor debulking followed by Y-stent
                                C) Radiation therapy only
                                D) Bilateral separate stents
**Decision Point:** Patient with 5cm benign tracheal stenosis post-radiation. Failed dilation x3. Next step?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Complex Cases:** Murgu S, et al. "Central airway obstruction: Benign strictures, tracheobronchomalacia, and malignancy-related obstruction" *Chest* 2016
                            
                            
                                **Multidisciplinary Approach:** Stratakos G, et al. "Survival and quality of life benefit after endoscopic management of malignant CAO" *J Cancer* 2016
                            
                            
                                **Y-Stent Technique:** Dutau H, et al. "The use of self-expandable metallic stents in the airways in the adult population" *Expert Rev Respir Med* 2014`,
      },
    ],
  },
  {
    month: 10,
    title: 'Teaching and Leadership',
    description: 'Develop skills in bronchoscopy suite leadership, team management, and teaching',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Lead bronchoscopy teams effectively during procedures
- Teach rigid bronchoscopy skills to junior learners
- Implement quality improvement initiatives
- Develop effective communication strategies

### Leadership in the Bronchoscopy Suite

As you progress toward independence, developing leadership and teaching skills becomes essential. Effective procedure leadership improves outcomes, team satisfaction, and creates a culture of safety.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Effective Team Leadership

#### Pre-Procedure Briefing Components:


                        
                            **The WHO-Adapted Timeout:**

                            1. **Team Introductions:** Names and roles

                            2. **Patient Verification:** Identity, procedure, consent

                            3. **Procedure Plan:** Steps, equipment needs

                            4. **Anticipated Challenges:** Difficult anatomy, bleeding risk

                            5. **Emergency Plans:** Who does what if complications

                            6. **Questions:** "Does anyone have concerns?"
#### Communication During Procedures:
- **Clear directives:** "Please prepare the 8mm balloon dilator"
- **Think aloud:** "I'm seeing friable tissue, switching to gentle technique"
- **Regular updates:** "Dilation complete, good result, preparing stent"
- **Acknowledge team:** "Excellent camera work" "Thank you for the quick setup"

#### Creating Psychological Safety:

#### Key Leadership Principles

• Encourage speaking up about safety concerns

                            • Admit your own uncertainties when appropriate

                            • Debrief after difficult cases without blame

                            • Celebrate team successes

                            • Model continuous learning`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Teaching Rigid Bronchoscopy

Teaching Demonstration: Guiding a Learner Through First Intubation

#### Progressive Teaching Framework:

| Stage | Learner Role | Teacher Role | Key Points |
| --- | --- | --- | --- |
| Observation | Watch and learn | Narrate actions | Explain decision-making |
| Assistance | Help with setup | Guide participation | Build confidence |
| Partial performance | Do simple steps | Close supervision | Immediate feedback |
| Full performance | Complete procedure | Available backup | Debrief after |

#### Effective Feedback Techniques:


                        
                            **The "SBI" Model:**

                            • **Situation:** "During the intubation attempt..."

                            • **Behavior:** "I noticed you lifted the epiglottis very gently..."

                            • **Impact:** "Which gave excellent visualization and prevented trauma"


                            
                            **Constructive Correction:**

                            • **Wrong:** "You're holding it wrong"

                            • **Better:** "Try angling the scope more anteriorly - like this - it helps visualize the cords better"
#### Quality Improvement Initiatives:
- **Complication tracking:** Monthly review of all complications
- **Procedure times:** Monitor efficiency improvements
- **Patient outcomes:** 30-day follow-up data
- **Team feedback:** Regular surveys on suite functioning
- **Equipment optimization:** Standardize setups and preferences`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Leadership Scenarios

**Teaching Moment:** A junior fellow is struggling with rigid scope intubation, becoming frustrated. Best approach?


                                A) Take over immediately to save time
                                B) Offer specific guidance and encouragement
                                C) Let them struggle to build character
                                D) Criticize their technique publicly
**Team Leadership:** During timeout, anesthesia expresses concern about patient's cardiac status. Your response?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Required Reading


                            
                                **Education:** Mahmood K, et al. "Teaching and Evaluating Rigid Bronchoscopy" *Ann Am Thorac Soc* 2017
                            
                            
                                **Team Science:** Reader TW, et al. "Non-technical skills in the intensive care unit" *Br J Anaesth* 2016
                            
                            
                                **Quality Improvement:** Ernst A, et al. "Quality Improvement in Interventional Pulmonology" *Clin Chest Med* 2018`,
      },
    ],
  },
  {
    month: 11,
    title: 'Independent Practice Preparation',
    description: 'Refine skills and prepare for autonomous rigid bronchoscopy practice',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Learning Objectives
- Demonstrate readiness for independent practice
- Review and consolidate all major techniques
- Address remaining knowledge or skill gaps
- Plan for continued skill development post-fellowship

### Transition to Independence

This month focuses on consolidating your skills and ensuring readiness for independent practice. You should now be comfortable leading cases with minimal supervision.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Comprehensive Skill Review

#### Self-Assessment Checklist:


                        
                            **Technical Skills - Rate Your Confidence (1-5):**

                            ☐ Rigid bronchoscope intubation (including difficult airways)

                            ☐ Mechanical tumor debulking

                            ☐ Laser therapy (setup, safety, technique)

                            ☐ Electrocautery and APC

                            ☐ Cryotherapy applications

                            ☐ Balloon and rigid dilation

                            ☐ Silicone stent placement

                            ☐ Y-stent deployment

                            ☐ Foreign body removal

                            ☐ Hemorrhage control

                            ☐ Emergency airway management


                            
                            **Non-Technical Skills:**

                            ☐ Patient selection and risk stratification

                            ☐ Procedure planning and equipment preparation

                            ☐ Team leadership and communication

                            ☐ Complication recognition and management

                            ☐ Teaching and supervision

                            ☐ Quality improvement participation
#### Advanced Technique Integration:

You should now be combining techniques fluidly:
- Mechanical debulking → Laser ablation → Stent placement
- Dilation → Ablation of granulation → Stent adjustment
- Managing bleeding while maintaining ventilation
- Coordinating with anesthesia during complex ventilation scenarios`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Building Your Practice

Video Portfolio: Fellow Case Presentations

#### Essential Elements for Starting a Rigid Bronchoscopy Service:

| Category | Requirements | Considerations |
| --- | --- | --- |
| Equipment | Scopes, light source, accessories | Budget $50-100K initial |
| Team | Trained nurses, RT, anesthesia | Dedicated team improves outcomes |
| Facilities | OR or equipped bronch suite | Need anesthesia capabilities |
| Support | Surgery, IR backup | Essential for complications |
| Credentialing | Hospital privileges | Document training, cases |

#### Maintaining Competency:


                        
                            **Ongoing Skill Development:**

                            • **Case Volume:** Aim for minimum 20-30 rigid cases/year

                            • **Continuing Education:** Annual conferences, workshops

                            • **Proctoring:** Invite experts for complex cases initially

                            • **Simulation:** Regular practice maintains skills

                            • **Quality Metrics:** Track your outcomes systematically

                            • **Peer Review:** Regular M&M conferences
#### Career Development Pathways:
- **Academic:** Research in airway interventions, teaching
- **Clinical Excellence:** High-volume referral center
- **Innovation:** Device development, technique refinement
- **Leadership:** Build regional centers of excellence`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Board-Style Review

**Comprehensive Case:** 68-year-old with NSCLC causing 90% tracheal obstruction 3cm above carina. Stridor at rest. Best initial management?


                                A) Urgent rigid bronchoscopy with tumor debulking
                                B) Radiation therapy consultation
                                C) Comfort care given advanced disease
                                D) Attempt flexible bronchoscopy first
**Technical Decision:** Silicone stent placed 2 weeks ago for benign stenosis. Patient returns with dyspnea, no fever. CXR normal. Most likely diagnosis?`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Advanced Resources


                            
                                **Comprehensive Text:** Ernst A, Herth FJF (Eds). "Principles and Practice of Interventional Pulmonology" - Review key chapters
                            
                            
                                **Latest Guidelines:** Wahidi MM, et al. "AABIP Guidelines on Training and Competency" *J Bronchology Interv Pulmonol* 2023
                            
                            
                                **Future Directions:** Chen A, et al. "Robotic Bronchoscopy and Future of Interventional Pulmonology" *Chest* 2023`,
      },
    ],
  },
  {
    month: 12,
    title: 'Final Assessment and Certification',
    description:
      'Complete comprehensive evaluation and receive certification for rigid bronchoscopy competency',
    sections: [
      {
        id: 'overview',
        title: 'Overview & Objectives',
        body: `### Final Competency Objectives
- Pass comprehensive written and practical examinations
- Demonstrate mastery of all rigid bronchoscopy techniques
- Show leadership and teaching abilities
- Plan for continued professional development

### Certification Requirements

This final month includes comprehensive assessment of your knowledge and skills through multiple modalities, ensuring you meet or exceed competency standards for independent practice.`,
      },
      {
        id: 'indications',
        title: 'Clinical Focus & Decision-Making',
        body: `### Final Assessment Components

#### 1. Written Examination (100 questions):


                        
                            **Topic Distribution:**

                            • Equipment and Setup: 10%

                            • Anesthesia Considerations: 10%

                            • Indications/Contraindications: 15%

                            • Technical Procedures: 25%

                            • Complication Management: 20%

                            • Case-Based Scenarios: 20%


                            
                            **Passing Score:** 80% or higher

                            **Format:** Multiple choice, case scenarios
#### 2. Practical Skills Stations:

| Station | Time | Assessment |
| --- | --- | --- |
| Intubation & Navigation | 10 min | RIGID-TASC scoring |
| Therapeutic Intervention | 15 min | Tumor debulking or dilation |
| Stent Deployment | 15 min | Silicone stent placement |
| Emergency Scenario | 10 min | Hemorrhage management |

#### 3. Case Presentation & Defense:
- Present 3 complex cases you managed
- Include complications and learning points
- Defend management decisions
- Discuss alternative approaches`,
      },
      {
        id: 'equipment',
        title: 'Skills Lab & Simulation',
        body: `### Competency Documentation

Final Skills Assessment Recording

#### Minimum Case Requirements:


                        
                            **Documented Procedures (as primary operator):**

                            ✓ Rigid bronchoscope intubations: ≥30

                            ✓ Therapeutic procedures: ≥20

                            ✓ Tumor debulking: ≥10

                            ✓ Ablative procedures: ≥10

                            ✓ Airway dilations: ≥5

                            ✓ Stent placements: ≥10

                            ✓ Emergency/bleeding management: ≥3


                            
                            **Total rigid bronchoscopy cases: ≥50**
#### Certification Portfolio Contents:
1. **Procedure Log:** All cases with outcomes

2. **Complication Summary:** Personal complication rate analysis

3. **Video Documentation:** Best examples of technique

4. **Teaching Evidence:** Feedback from learners supervised

5. **QI Project:** One completed improvement initiative

6. **Reflective Essay:** Growth and future goals (2 pages)

#### Feedback Summary & Action Plan:


                        
                            **Areas of Excellence:**

                            [Individualized feedback on strengths]


                            
                            **Areas for Continued Growth:**

                            [Specific skills to refine]


                            
                            **Recommended Next Steps:**

                            • Advanced workshops in [specific techniques]

                            • Proctorship for [complex procedures]

                            • Research opportunities in [areas of interest]`,
      },
      {
        id: 'quiz',
        title: 'Assessment & Reflection',
        body: `### Final Self-Assessment

**Readiness Check:** A colleague asks you to help with a complex carinal Y-stent. You feel:


                                A) Unprepared - need more training
                                B) Confident with appropriate preparation
                                C) Would only assist, not lead
                                D) Would refer elsewhere
**Career Planning:** Your primary goal for rigid bronchoscopy practice is:`,
      },
      {
        id: 'reading',
        title: 'Reading & Resources',
        body: `### Continuing Education Resources


                            
                                **Professional Society:** Join AABIP - access to guidelines, courses, networking
                            
                            
                                **Annual Meeting:** AABIP Annual Conference - latest techniques and research
                            
                            
                                **Advanced Courses:** 

                                • AABIP Rigid Bronchoscopy Course

                                • European Respiratory Society IP Courses

                                • Industry-sponsored advanced workshops
                            
                            
                                **Journals to Follow:**

                                • Journal of Bronchology & Interventional Pulmonology

                                • Chest

                                • Respiration

                                • Seminars in Respiratory and Critical Care Medicine
### 🎓 Congratulations!

**You have completed the Rigid Bronchoscopy Fellowship Curriculum**

Your dedication to mastering this essential skill will enable you to provide life-saving interventions for patients with complex airway disease.`,
      },
    ],
  },
]
