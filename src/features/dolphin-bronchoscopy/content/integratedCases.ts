import type { DolphinIntegratedCase } from './types'

/**
 * The integrated cases (Assess): one animal and one procedure each, three to five frames that draw
 * on several sections, the verdict at each frame and the debrief only at the end.
 *
 * A case states its own values (age, weight, times, the ledger it works); every other number in a
 * prompt, choice, rationale or debrief comes from a register row the case lists in `numberIds`.
 * Each frame that turns on a row of the trouble grammar names it, and the debrief prints that row.
 */
export const DOLPHIN_INTEGRATED_CASES: readonly DolphinIntegratedCase[] = [
  // ── 1. Go, and with what ───────────────────────────────────────────────────────────────────
  {
    id: 'second-pneumonia-this-year',
    title: 'A second pneumonia this year',
    situation:
      'A 22-year-old female bottlenose dolphin, 195 kg, has her second pneumonia this year. The first cleared on antibiotics chosen from a blow culture. Her soft cough and cloudy blow are back.',
    decisionId: 'go',
    sectionIds: [
      'why-scope-a-dolphin',
      'choosing-the-instrument',
      'before-the-day',
      'the-room-and-the-team',
      'sedation-and-numbing',
    ],
    objectiveIds: ['O6', 'O2'],
    frames: [
      {
        id: 'pneumonia-consult',
        time: 'The consult',
        situation:
          'The team asks for a new blow culture, so they can treat on its sensitivities as they did before.',
        prompt: 'What do you tell them about the blow?',
        choices: [
          {
            id: 'a',
            label:
              'A blow sample cannot stand for the lower airway; a lavage from a named bronchus can.',
            rationale:
              'The blow crosses the nasal passages and the wet blowhole. A recurrence after treatment on a blow culture is the moment to sample the lung itself.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Treat on the new culture’s sensitivities; it names the lung pathogen.',
            rationale:
              'The growth may come from anywhere on the passage. Treating on it again may miss what is in the lung.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'A second culture that grows the same organism confirms it is the lung pathogen.',
            rationale:
              'Two blows sample the same path twice. Agreement shows what lives on the passage, not what is in the lower airway.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Keep blow samples for trends, and add nothing else.',
            rationale:
              'Blows are useful for trends, but a second pneumonia needs a sample from the lower airway too.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'pneumonia-workup',
        time: 'Before booking',
        situation:
          'Her last bloodwork is a month old. She has had no thoracic imaging since the first pneumonia, and her sedation history sits in another facility’s records.',
        prompt: 'What comes before the bronchoscopy is booked?',
        choices: [
          {
            id: 'a',
            label:
              'Update her bloodwork, image the thorax, and get her sedation history, so the scope answers a framed question.',
            rationale:
              'Imaging tells you where to look and where to lavage. Bloodwork and her sedation history shape the plan for the day.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Book it now; the bronchoscopy itself will show where the disease is.',
            rationale:
              'Without imaging the survey has no target. A scope answers the question the workup has framed.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Image the thorax only; the month-old bloodwork will do.',
            rationale:
              'Imaging is the key step, but current bloodwork, with clotting times if you may brush, and her sedation history also shape the day.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Wait until she is sicker, so the lavage yields more.',
            rationale:
              'A sicker animal is a riskier one to sedate and scope. The question is ready to be framed now.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'pneumonia-instrument',
        time: 'Choosing the scope',
        situation:
          'The facility has a bronchoscope and a gastrointestinal endoscope. The team leans toward the longer gastrointestinal scope for its reach.',
        prompt: 'What must the scopist plan for with the gastrointestinal endoscope?',
        choices: [
          {
            id: 'a',
            label:
              'It insufflates air and steers with two levers; the bronchoscope has one thumb lever and no insufflation.',
            rationale:
              'Its working length is 1030 mm against the bronchoscope’s 600 mm, but the handling differs too. Insufflated air and a second lever change how you drive.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Nothing new; any flexible scope handles the same way.',
            rationale:
              'The two differ in insufflation and in their controls. The workshop compares them for that reason.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Only its length; reach is what matters in a large animal.',
            rationale:
              'Reach matters: a 55 cm bronchoscope reached only 3–4 cm past the carina in Tsang’s series. The air and the controls matter as well.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'It cannot be used through the blowhole.',
            rationale:
              'A gastroscope was the instrument Harper used to scope harbor porpoises, and the workshop compares the two for dolphins.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'pneumonia-team',
        time: 'The morning of',
        situation:
          'She is on the padded mat, sternal and wet. A trainer holding her head wears gloves but no mask or goggles.',
        prompt: 'What do you do before the scope goes in?',
        choices: [
          {
            id: 'a',
            label: 'Mask and goggles for the trainer and everyone near the head, then start.',
            rationale:
              'The head end is an exposure. The workshop asks masks and goggles of the whole team and of anyone near the head.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Start; trainers handle the body, not the airway.',
            rationale:
              'A trainer at the head is in the blow. Zoonoses such as Burkholderia are why Tsang’s team wore protection.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Move the trainer to the flukes and start.',
            rationale:
              'It removes one exposure but leaves the head unheld. Protect the trainer and keep her where she is needed.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Gloves are enough for anyone not holding the scope.',
            rationale:
              'Gloves protect the hands. The blow reaches the face, so masks and goggles are needed near the head.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'pneumonia-sedation',
        time: 'Sedation',
        situation:
          'Her sedation history arrives: she settled well on midazolam. She has fasted overnight.',
        prompt: 'Which plan fits the NMMP workshop protocol?',
        choices: [
          {
            id: 'a',
            label:
              'Midazolam 0.06–0.08 mg/kg IM first, with 0.01 mg/kg IV or IM top-ups as needed.',
            rationale:
              'That is the workshop’s first dose and top-up. Tsang gave 0.04–0.06 mg/kg IM; the sources differ, and both scale with weight.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Midazolam 0.01 mg/kg IV as the only dose.',
            rationale:
              'That is the top-up, given on top of a first dose. Alone it is unlikely to settle her for the procedure.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Midazolam 0.02–0.09 mg/kg IM, the range used for CT.',
            rationale:
              'Ivančić used that range to move dolphins to CT. The workshop gives a bronchoscopy range of its own.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'No sedation; topical lidocaine is enough.',
            rationale:
              'Lidocaine numbs the airway but does not calm the animal. The workshop sedates before starting and tops up during.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
    ],
    debrief:
      'A pneumonia that returns after treatment on a blow culture is the cue to sample the lower airway itself. The decision to go then rests on a framed question, an instrument whose handling the team knows, a protected team at the head and a sedation plan from the protocol.',
    numberIds: [
      'scope-working-length',
      'scope-reach-tsang',
      'midazolam-im-first',
      'midazolam-topup',
      'midazolam-im-tsang',
      'midazolam-im-ivancic',
    ],
    sourceIds: [
      'venn-watson-2012',
      'nmmp-workshop-2024',
      'tsang-2002',
      'harper-2001',
      'ivancic-2014',
    ],
  },

  // ── 2. Which site next ─────────────────────────────────────────────────────────────────────
  {
    id: 'the-opening-above-the-carina',
    title: 'An opening above the carina',
    situation:
      'A 17-year-old male bottlenose dolphin, 210 kg, sedated and sternal, his airway numbed. CT showed a patchy opacity in the right lung. The scope has just entered the trachea.',
    decisionId: 'next-site',
    sectionIds: ['below-the-larynx', 'the-survey-and-the-record', 'lavage'],
    objectiveIds: ['O1', 'O3', 'O4'],
    frames: [
      {
        id: 'opening-seen',
        time: 'Partway down the trachea',
        situation:
          'An opening appears in the side wall of the trachea. A division lies further ahead.',
        media: { frameId: 'trachea-rtb' },
        prompt: 'What is the opening?',
        choices: [
          {
            id: 'a',
            label: 'The right tracheal bronchus, a normal airway about 5 cm above the carina.',
            rationale:
              'It leaves the right wall of the trachea above the carina. Tsang gives about 5 cm; Ivančić measured a mean of 5.1 cm on CT.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The right main bronchus; the division ahead is a fold, not the carina.',
            rationale:
              'The main bronchi divide at the carina, ahead. An opening in the side wall above it is a separate bronchus.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'A blind diverticulum, to be avoided.',
            rationale:
              'It leads on into branches of its own. It is an airway, and the record names it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'An abnormal extra bronchus, to write up as a finding.',
            rationale:
              'The tracheal bronchus is normal anatomy in the bottlenose dolphin. It is recorded as a site, not a finding.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'opening-recorded',
        time: 'In the record',
        situation:
          'You look into the opening; its divisions are clean. The survey continues to the carina and both main bronchi.',
        prompt: 'How does this opening go in the record?',
        choices: [
          {
            id: 'a',
            label: 'As the right tracheal bronchus, reached, with what you saw.',
            rationale:
              'The NMMP form lists the tracheal bronchus as its own site. Write that it was reached and what was seen there.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'It stays off; the form lists only the main bronchi and their branches.',
            rationale:
              'The form lists the trachea, the tracheal bronchus and both main bronchi before the numbered branches.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'As RB1, the first right branch.',
            rationale:
              'RB1 is the first branch of the right main bronchus, past the carina. The tracheal bronchus leaves the trachea above it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Only if it looked abnormal.',
            rationale:
              'An honest record writes every site reached, normal or not, so the next bronchoscopist knows it was seen.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'opening-site',
        time: 'Choosing the lavage site',
        situation:
          'The survey is done. On review, CT traces the opacity to the airway that leaves the trachea above the carina. He is breathing regularly.',
        prompt: 'Where do you lavage?',
        choices: [
          {
            id: 'a',
            label:
              'Wedged in the division of the right tracheal bronchus that leads toward the opacity.',
            rationale:
              'Lavage samples what lies beyond the wedge. The branch that leads to the opacity is the one to sample.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The right main bronchus, the larger airway on that side.',
            rationale:
              'The right main bronchus does not lead to this opacity. Its branches sample other territory.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Both main bronchi, to be thorough.',
            rationale:
              'Neither leads to the opacity. Thoroughness here means the named branch that does.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'No lavage; the CT already shows the disease.',
            rationale: 'CT shows where, not what. Lavage gives the cells and the organism.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'opening-volume',
        time: 'The lavage',
        situation:
          'The scope is wedged in that division. Warm saline is drawn up in 60 mL syringes. He weighs 210 kg.',
        prompt: 'What total volume does the NMMP workshop allow?',
        choices: [
          {
            id: 'a',
            label: 'Up to 2 mL/kg, given in aliquots with gentle hand suction.',
            rationale:
              'The workshop scales lavage volume to weight. Aliquots with gentle suction recover what the branch gives back.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: '2 × 50 mL of warm saline, as Tsang gave it.',
            rationale:
              'That is Tsang’s volume, in two dolphins. The sources differ; the workshop scales the total to weight.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'Up to 4 mg/kg.',
            rationale:
              'That is the lidocaine maximum. The workshop’s lavage figure is a volume per kilogram.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'As much as it takes to get a cloudy return.',
            rationale:
              'The volume is set before you start. Chasing a return adds fluid without improving the sample.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
    ],
    debrief:
      'The opening in the trachea’s right wall was the right tracheal bronchus, normal anatomy about 5 cm above the carina. It goes in the record by name, and when the disease lies in its territory, the lavage belongs there. The workshop scales lavage to 2 mL/kg; Tsang instilled 2 × 50 mL.',
    numberIds: ['rtb-above-carina', 'bal-volume-nmmp', 'bal-volume-tsang', 'lidocaine-max'],
    sourceIds: ['tsang-2002', 'ivancic-2014', 'nmmp-form-2019', 'nmmp-workshop-2024'],
  },

  // ── 3. Continue, pause or stop: the approach ───────────────────────────────────────────────
  {
    id: 'nothing-but-pink-walls',
    title: 'Nothing but pink walls',
    situation:
      'A 12-year-old female bottlenose dolphin, 160 kg, sedated and sternal on the padded mat. The atomizer lidocaine is in. You enter the blowhole with the bronchoscope.',
    decisionId: 'continue-or-stop',
    sectionIds: ['from-blowhole-to-spout', 'entering-the-blowhole', 'trouble-during-the-procedure'],
    objectiveIds: ['O1', 'O3', 'O5'],
    frames: [
      {
        id: 'pink-blowhole',
        time: 'At the blowhole',
        troubleRowId: 'plug-mucus',
        situation:
          'A few millimeters past the blowhole, the whole view turns pink. No lumen shows.',
        prompt: 'What do your hands do first?',
        choices: [
          {
            id: 'a',
            label:
              'Stop, withdraw to the naris, suction, and find the passage again before advancing.',
            rationale:
              'A pink view within millimeters is the nasal plug or mucus against the lens. Back out to see, then find the way in.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on; the passage opens below the plug.',
            rationale:
              'Advancing with no lumen in view is advancing blindly, with the tip against the mucosa.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Turn up the light to see through it.',
            rationale:
              'Light does not see through tissue pressed on the lens. Distance from the wall is what brings the view back.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Suction where you are and advance once it clears.',
            rationale:
              'Suction is in the sequence, but the tip is against the plug. Withdraw to the naris first.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'pink-passage',
        time: 'In the nasal passage',
        situation:
          'Back at the naris, suction clears thick, tenacious mucus. A mucus-lined bony passage now runs ahead.',
        media: { frameId: 'naris-start' },
        prompt: 'What lies ahead along this passage?',
        choices: [
          {
            id: 'a',
            label: 'A bony passage 5–7 cm long, then the nasopharynx, 4–5 cm across.',
            rationale:
              'Tsang measured both. Expect copious mucus on the way, and the spout at the foot of the nasopharynx.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Turbinates that will catch the scope.',
            rationale: 'Dolphins have no turbinates. The passage is bony and lined with mucus.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'The larynx, directly below the passage.',
            rationale:
              'The passage opens into the nasopharynx first. The spout rises into it from below.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'The trachea, after a sharp turn.',
            rationale: 'The trachea lies below the larynx, past the nasopharynx and the spout.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'pink-fornix',
        time: 'Foot of the nasopharynx',
        troubleRowId: 'fornix',
        situation:
          'Three openings lie ahead. You steer toward the largest, on the left. It ends in a smooth blind pouch, and nothing moves with the next breath.',
        media: { frameId: 'spout-from-above' },
        prompt: 'What now?',
        choices: [
          {
            id: 'a',
            label: 'Pull back until both fornices are in view, then aim at the midline spout tip.',
            rationale:
              'A smooth blind end that does not move with a breath is a fornix. The spout tip lies between the two.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on; the pouch will open further down.',
            rationale: 'A fornix ends blind. Pushing presses the tip into the mucosa.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Suction and wait for the view to clear.',
            rationale: 'The view is not blocked; the tip is in a pouch. Suction will not move it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw to the naris and try the other nasal passage.',
            rationale: 'It would work, but you only need to back out of the pouch.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'pink-glottis',
        time: 'At the spout',
        troubleRowId: 'closed-glottis',
        situation:
          'The spout tip is centered in the view. She lies still and does not cough. The glottis is closed, and her next breath is due.',
        prompt: 'When do you advance?',
        choices: [
          {
            id: 'a',
            label: 'Hold, and advance only in the moment the glottis opens with the breath.',
            rationale:
              'The glottis bursts open for a fraction of a second with each breath. That moment is the way in.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Now, gently, before the breath; the glottis will give.',
            rationale: 'Pushing on a closed glottis risks laryngospasm and injury to the spout.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'After the breath, once the glottis has closed again.',
            rationale:
              'Closed is the state to wait through. The opening is brief, so advance in it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw and give more lidocaine first.',
            rationale:
              'She is still and not coughing, so the airway is numb enough. The glottis is simply closed.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
    ],
    debrief:
      'Every stage of this approach turned on one rule: never advance into a view you cannot read. A pink wall meant the plug or mucus, a blind pouch meant a fornix, and a closed glottis meant waiting for the breath. Each time the first move was back to a place you knew, or a pause.',
    numberIds: ['bony-nasal-passage', 'nasopharynx-width', 'breath-window'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024', 'nmmp-bronchoscopy-guide'],
  },

  // ── 4. More topical or more sedation ───────────────────────────────────────────────────────
  {
    id: 'a-cough-at-the-spout',
    title: 'A cough at the spout',
    situation:
      'A 25-year-old male bottlenose dolphin, 230 kg. Midazolam was given IM, and he lies calm on the mat. The atomizer and catheter lidocaine are in.',
    decisionId: 'topical-or-sedation',
    sectionIds: ['sedation-and-numbing', 'entering-the-blowhole', 'trouble-during-the-procedure'],
    objectiveIds: ['O2', 'O3', 'O5'],
    frames: [
      {
        id: 'cough-touch',
        time: 'At the spout',
        troubleRowId: 'spout-cough',
        situation:
          'The tip touches the spout. He coughs hard, the glottis clamps, and the scope is pushed back.',
        prompt: 'What do your hands do first?',
        choices: [
          {
            id: 'a',
            label: 'Stop and withdraw to the nasopharynx.',
            rationale:
              'The cough is the airway reacting to the tip. Backing off frees the glottis and ends the stimulus.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on between coughs while the glottis opens.',
            rationale:
              'The glottis is clamping. Pushing against it risks laryngospasm and injury to the spout.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Give a midazolam top-up with the scope where it is.',
            rationale:
              'He was calm before the tip touched. Sedation does not numb the spout, and it spaces his breaths.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Hold the tip on the spout until the cough settles.',
            rationale:
              'Waiting is in the sequence, but not with the tip still touching the spout that coughed.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'cough-which',
        time: 'In the nasopharynx',
        situation:
          'The scope is back in the nasopharynx. He breathes regularly and lies calm between breaths. The cough came the moment the tip touched.',
        prompt: 'More topical, or more sedation?',
        choices: [
          {
            id: 'a',
            label: 'More topical lidocaine on the spout, by atomizer or through the scope.',
            rationale:
              'A calm animal that coughs at the touch needs the airway numbed, not the animal calmed.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'A midazolam top-up of 0.01 mg/kg.',
            rationale:
              'He is already calm. Sedation does not numb the spout; keep the top-up for an animal still intolerant once numb.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Both at once, to be sure.',
            rationale:
              'Lidocaine first. A top-up he does not need spaces his breaths and adds nothing at the spout.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Neither; approach again straight away.',
            rationale:
              'Nothing has changed at the spout. The same touch will bring the same cough.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'cough-ledger',
        time: 'The ledger',
        situation:
          'Given so far: atomizer 10 mL and catheter 5 mL of 1%, which is 150 mg. At 4 mg/kg his maximum is 920 mg.',
        prompt: 'Can he have more lidocaine?',
        choices: [
          {
            id: 'a',
            label: 'Yes: 150 mg is well under his 920 mg, and each added milliliter is counted.',
            rationale:
              'One maximum covers every way lidocaine is given. Count the new dose against what is left.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'No; the atomizer and catheter are the whole allowance.',
            rationale:
              'Those are the first lines of the ledger. The maximum leaves room for jelly and the bronchial syringes.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Yes, without counting; lidocaine on the spout does not add to the total.',
            rationale:
              'Every milligram on the airway counts toward the one maximum, however it is given.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Yes, but only as 2%, so the volume stays small.',
            rationale:
              'Concentration changes the volume, not the milligrams. Either is counted against the same maximum.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'cough-again',
        time: 'The second approach',
        situation:
          'More lidocaine is on the spout, and he breathes regularly. At the spout tip he stays still, but the glottis is closed.',
        prompt: 'What now?',
        choices: [
          {
            id: 'a',
            label: 'Hold at the spout and advance only in the moment the glottis opens.',
            rationale:
              'He is numb and still; the glottis is simply closed. It opens briefly with each breath.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on gently against it; he is numb now.',
            rationale:
              'Numb does not mean open. Pushing on a closed glottis risks laryngospasm and injury.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'A midazolam top-up so the larynx relaxes.',
            rationale:
              'He is still and not coughing. Sedation will not open the glottis, and it spaces the breaths you are waiting for.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Withdraw and add still more lidocaine.',
            rationale:
              'The cough has gone and the airway is numb. More lidocaine only uses up the ledger.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
    ],
    debrief:
      'The cough was the airway answering the tip, not an animal that needed more sedation. Withdrawing freed the glottis, topical lidocaine numbed the spout, and every milliliter was counted against 4 mg/kg. A midazolam top-up of 0.01 mg/kg was kept for an animal still intolerant once the airway was numb.',
    numberIds: ['lidocaine-max', 'lidocaine-split', 'midazolam-topup'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002'],
  },

  // ── 5. Continue, pause or stop: the lavage ─────────────────────────────────────────────────
  {
    id: 'far-less-came-back',
    title: 'Far less came back',
    situation:
      'A 20-year-old female bottlenose dolphin, 185 kg. The survey is done, and an opacity on CT leads to a branch of the left main bronchus. At 2 mL/kg her lavage allowance is 370 mL.',
    decisionId: 'continue-or-stop',
    sectionIds: ['lavage', 'trouble-during-the-procedure'],
    objectiveIds: ['O4', 'O5'],
    frames: [
      {
        id: 'return-first',
        time: 'The first aliquot',
        troubleRowId: 'poor-return',
        situation:
          'With the scope in the branch, you instil 60 mL of warm saline. Gentle hand suction returns about 5 mL, and you can see lumen around the scope tip.',
        prompt: 'What is your first move?',
        choices: [
          {
            id: 'a',
            label: 'Re-seat the scope so it is wedged, then try gentle hand suction again.',
            rationale:
              'Lumen around the tip means the wedge is lost, so the saline has somewhere else to go. Wedged, the branch returns what it can.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Instil another aliquot at once to push the first one back.',
            rationale:
              'More saline into an unwedged branch spreads further. It does not bring the first aliquot back.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Strong wall suction to pull the fluid out.',
            rationale:
              'Strong suction pulls the airway wall onto the tip and returns less. The workshop uses hand suction or gentle wall suction.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Record the return and move to the other lung.',
            rationale:
              'Recording is in the sequence, but the wedge is lost and the branch still holds the saline. Re-seat first.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'return-wedged',
        time: 'Wedged again',
        situation:
          'Re-wedged, gentle suction brings back 15 mL more, cloudy. She breathes regularly.',
        prompt: 'What next?',
        choices: [
          {
            id: 'a',
            label: 'Instil the next planned aliquot and recover it the same way.',
            rationale:
              'The wedge is holding and the return is cloudy. A modest return is expected; continue with the plan.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Add aliquots beyond the plan until the return matches what went in.',
            rationale:
              'A modest return is expected. Unplanned aliquots add to the fluid left in the lung without improving the sample.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Stop; the return is too small to send.',
            rationale:
              'A small cloudy return is still a sample. Keep it cool and continue the plan.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Withdraw to the carina and lavage another branch instead.',
            rationale:
              'This branch leads to the opacity and the wedge is holding. Moving loses the target.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'return-record',
        time: 'The record',
        situation:
          'The planned aliquots are done: 180 mL in, 45 mL back, cloudy, on ice. She is breathing regularly.',
        prompt: 'What goes in the record?',
        choices: [
          {
            id: 'a',
            label: 'The branch by name, the volume instilled and the volume returned.',
            rationale:
              'The NMMP form records only the yield. Writing what went in lets the yield be read.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Only the 45 mL returned, since the form has no instilled field.',
            rationale:
              'The form asks for the yield, but 45 mL means little without the 180 mL that went in. Write both.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'The return as a share of her 370 mL allowance.',
            rationale:
              'The allowance is a ceiling, not what was given. The return is read against what went in.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Nothing until the laboratory reports.',
            rationale:
              'The procedure record is written now, while the volumes and the site are known.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
    ],
    debrief:
      'Far less came back than went in, and the first move was to restore the wedge and suction gently, not to add saline. A modest return is expected. Write both volumes, since the yield means little without what went in.',
    numberIds: ['bal-volume-nmmp'],
    sourceIds: ['nmmp-workshop-2024', 'tsang-2002', 'nmmp-form-2019'],
  },

  // ── 6. Continue, pause or stop: the brush ──────────────────────────────────────────────────
  {
    id: 'blood-after-the-brush',
    title: 'Blood after the brush',
    situation:
      'A 28-year-old male bottlenose dolphin, 220 kg. Lavage of a branch of the right main bronchus is done. The wall of that branch is reddened and thickened.',
    decisionId: 'continue-or-stop',
    sectionIds: ['brush-and-biopsy', 'trouble-during-the-procedure', 'recovery-and-return'],
    objectiveIds: ['O4', 'O5'],
    frames: [
      {
        id: 'blood-choose',
        time: 'Before sampling the wall',
        situation:
          'The wall is in clear view and the scope is steady. No one has measured how readily a dolphin airway bleeds after sampling.',
        prompt: 'How do you sample the wall?',
        choices: [
          {
            id: 'a',
            label: 'A brush of the wall in view, the smaller step up in bleeding risk.',
            rationale:
              'Tsang brushed the main bronchi and took no biopsy, because the bleeding tendency is unknown.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'A biopsy, for the larger sample.',
            rationale:
              'A biopsy is a larger step up in a bleeding risk this species has not measured. Brush first.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'c',
            label: 'A brush and a biopsy together, to save a second procedure.',
            rationale:
              'Each step up adds bleeding risk. Taking both at once stacks the risks before you know how this wall bleeds.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Nothing more; the lavage is enough.',
            rationale:
              'The lavage samples the branch, but a brush adds cells from the wall you can see, at a modest step up in risk.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'blood-fills',
        time: 'After the brush',
        troubleRowId: 'bleeding',
        situation: 'As the brush comes back, blood fills the lumen of the branch.',
        prompt: 'What do your hands do first?',
        choices: [
          {
            id: 'a',
            label: 'Keep the scope wedged in the branch and suction.',
            rationale: 'Wedged, the scope tamponades the branch and keeps blood out of the others.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Take a biopsy now, while the scope is there.',
            rationale: 'Sampling stops when bleeding starts. A biopsy adds to it.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Pull back to the carina to see where the blood goes.',
            rationale:
              'Pulling out of the branch lets blood spill into the others. The wedge confines it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Call the attending veterinarian and wait.',
            rationale:
              'Call, yes, but your hands hold the wedge and suction while someone else makes the call.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'blood-slows',
        time: 'A minute later',
        situation: 'Still wedged and suctioning, the bleeding slows. He breathes regularly.',
        prompt: 'What next?',
        choices: [
          {
            id: 'a',
            label: 'Cold saline, wait for it to stop, and take no more samples today.',
            rationale:
              'Cold saline and time let the branch settle under the wedge. With the bleeding tendency unknown, sampling ends here.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Brush a second site now that it has slowed.',
            rationale:
              'Slowing is not stopped, and the bleeding tendency is unknown. Sampling ends here.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Withdraw at once and end the procedure.',
            rationale:
              'Ending is right, but not before the bleeding stops. Leaving the wedge early lets blood spread.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Flush large volumes to wash the blood out.',
            rationale:
              'Large flushes carry blood into other branches. Cold saline in small amounts, with the wedge held, is the move.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'blood-recovery',
        time: 'Recovery',
        situation:
          'The bleeding has stopped and the scope is out. He had midazolam IM and one top-up, and his breathing is regular.',
        prompt: 'Where and how does he recover?',
        choices: [
          {
            id: 'a',
            label: 'Shallow water for about 30 min, with someone watching; reverse only if needed.',
            rationale:
              'Tsang recovered his dolphins in shallow water for about 30 min. Reversal is for an animal that needs it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Straight back into the main pool; he is breathing.',
            rationale:
              'A sedated dolphin belongs in shallow water with someone watching until it is fully awake.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Flumazenil for every animal before release.',
            rationale:
              'Reversal is given when it is needed, not by habit. He is breathing regularly.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Keep him on the mat until fully awake.',
            rationale:
              'Out of water he must be kept wet and cool, and recovery is meant for shallow water. Move him once breathing is regular.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
    ],
    debrief:
      'After a brush, blood filling the lumen calls for the scope to stay wedged, not to pull back. Wedged, it tamponades the branch and keeps blood out of the others; suction, cold saline and waiting follow, then no more sampling. Recovery is in shallow water, with someone watching.',
    numberIds: ['shallow-water-recovery'],
    sourceIds: ['tsang-2002', 'nmmp-workshop-2024'],
  },

  // ── 7. Continue, pause or stop: the breath-hold ────────────────────────────────────────────
  {
    id: 'a-long-breath-hold-halfway',
    title: 'A long breath-hold halfway through',
    situation:
      'A 30-year-old female bottlenose dolphin, 175 kg, booked for a survey and lavage. She has had midazolam IM and lies on the padded mat, sternal and wet.',
    decisionId: 'continue-or-stop',
    sectionIds: ['trouble-during-the-procedure', 'recovery-and-return', 'the-room-and-the-team'],
    objectiveIds: ['O2', 'O5'],
    frames: [
      {
        id: 'hold-roles',
        time: 'Before the scope goes in',
        situation:
          'Around the mat: the bronchoscopist, an assistant at the scope, the attending veterinarian with the drugs, and two trainers at the body. No one has been given her breathing to watch.',
        prompt: 'What do you settle before starting?',
        choices: [
          {
            id: 'a',
            label:
              'One person whose only job is to watch and call her breaths, heart rate and mentation.',
            rationale:
              'The bronchoscopist watches the screen. A long breath-hold is caught early only if someone watches for it alone.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The bronchoscopist watches the breathing between views.',
            rationale:
              'The bronchoscopist’s eyes are on the screen at the moments that matter most. Monitoring needs its own person.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'The attending veterinarian watches the breathing while giving drugs.',
            rationale: 'Drawing up and giving drugs takes their eyes away. One role per person.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Nothing; the ECG will show trouble.',
            rationale:
              'The ECG shows the heart, not the breaths. A lengthening breath-hold shows first in the breathing.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'hold-missed',
        time: 'Halfway',
        troubleRowId: 'breath-hold',
        situation:
          'Ten minutes in, the scope is in the left main bronchus. The trainer at her head calls that a breath is due and has not come. Her last hold was the longest today.',
        prompt: 'What do your hands do first?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw to the nasopharynx, or out, and let her breathe.',
            rationale:
              'No breath when one is due is the earliest sign. The scope across the glottis is the thing you can take away at once.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push on and finish the left side quickly.',
            rationale:
              'Breathing comes before the survey. Each moment with the scope across the glottis lets the hold lengthen.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'A midazolam top-up; she may be resisting the scope.',
            rationale: 'Nothing says she is resisting. More sedation spaces her breaths further.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Ask the attending veterinarian what to do, scope in place.',
            rationale:
              'Call, yes, but while your hands withdraw. Waiting leaves the scope across the glottis.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'hold-again',
        time: 'Scope in the nasopharynx',
        situation:
          'She takes one breath, then holds again, longer. Her heart rate has slowed since the start.',
        prompt: 'What is your next move?',
        choices: [
          {
            id: 'a',
            label: 'Scope out, oxygen, and stop the procedure.',
            rationale:
              'Breathing has not recovered with the scope withdrawn. Oxygen comes next, and the survey stops.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Go back through the glottis; she has breathed once.',
            rationale:
              'One breath is not recovery. The hold lengthened again, so the scope stays out.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Albuterol first, then oxygen.',
            rationale:
              'Albuterol is in the sequence, per the NMMP protocol, after oxygen and after the decision to stop.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Flumazenil, then carry on with the survey.',
            rationale:
              'Reversal may follow on the attending veterinarian’s order, but the survey stops when breathing does not recover.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'hold-recovery',
        time: 'Breathing again',
        situation:
          'With the scope out and oxygen given, her breaths come regularly again within minutes.',
        prompt: 'Where does she recover?',
        choices: [
          {
            id: 'a',
            label: 'Shallow water, with someone watching, until her breathing stays regular.',
            rationale:
              'She stays out of deep water until breathing is regular. Tsang recovered his dolphins in shallow water for about 30 min.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The main pool; she is breathing now.',
            rationale:
              'Her breathing has only just recovered. Deep water is for an animal whose breathing has stayed regular.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Shallow water, alone, for about 30 min.',
            rationale:
              'Shallow water fits, but someone watches. Her breathing has already faltered once today.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Back on the mat to finish the survey later today.',
            rationale:
              'The procedure stopped for her breathing. Finishing today brings back what stopped it.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
    ],
    debrief:
      'A lengthening breath-hold is the earliest sign, and it was caught because one person watched only the breathing. The first move was to withdraw and let her breathe, never to push on or add sedation. Oxygen followed, the procedure stopped when breathing did not settle, and recovery was in shallow water with someone watching.',
    numberIds: ['shallow-water-recovery'],
    sourceIds: ['nmmp-workshop-2024', 'ivancic-2014', 'tsang-2002'],
  },

  // ── 8. More topical or more sedation: the ledger ───────────────────────────────────────────
  {
    id: 'the-ledger-for-a-large-animal',
    title: 'The ledger for a large animal',
    situation:
      'An adult male bottlenose dolphin weighing 250 kg is booked for bronchoscopy. Lidocaine is on hand as 1% (10 mg per mL) and 2% (20 mg per mL).',
    decisionId: 'topical-or-sedation',
    sectionIds: ['sedation-and-numbing'],
    objectiveIds: ['O2'],
    frames: [
      {
        id: 'ledger-sheet',
        time: 'The worksheet',
        situation:
          'A colleague’s ledger, copied from the workshop’s worked example, gives a maximum of 724 mg: 72.4 mL of 1% or 36.2 mL of 2%.',
        prompt: 'What do you do with this ledger?',
        choices: [
          {
            id: 'a',
            label: 'Redo it for his own weight: 4 mg/kg times 250 kg.',
            rationale:
              'The maximum scales with weight. The workshop’s 724 mg belongs to its 181 kg example.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Use it; 724 mg is the NMMP maximum.',
            rationale:
              'The NMMP maximum is 4 mg/kg. The figure of 724 mg is that rule applied to a 181 kg dolphin.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Use it; a lower figure leaves a margin.',
            rationale:
              'It is below his maximum, so it does him no harm, but it is not his ledger. Work it from his weight.',
            plausibility: 'reasonable-but-incomplete',
          },
          {
            id: 'd',
            label: 'Double it, since he is a larger animal.',
            rationale: 'The maximum scales by the kilogram, not by a guess at size.',
            plausibility: 'incorrect-mechanism',
          },
        ],
      },
      {
        id: 'ledger-count',
        time: 'His maximum',
        situation:
          'Redone: 250 kg × 4 mg/kg = 1000 mg, which is 100 mL of 1% or 50 mL of 2%. The atomizer (10 mL) and catheter (5 mL) of 1% come to 150 mg.',
        prompt: 'How are the jelly and the bronchial syringes counted?',
        choices: [
          {
            id: 'a',
            label: 'Every milliliter given, at 20 mg per mL of 2%, added to the 150 mg.',
            rationale:
              'The ledger counts milligrams by every way they are given, against the one maximum.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Only the bronchial syringes; jelly is not counted.',
            rationale: 'The maximum covers every way lidocaine is given, the jelly included.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'By volume alone; a milliliter of 2% counts like a milliliter of 1%.',
            rationale:
              'Lidocaine 2% carries 20 mg per mL, twice the 10 mg of 1%. The ledger counts milligrams.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'From the plan alone; what is given on the day follows it.',
            rationale:
              'Planning is the start, but the ledger is kept as you give, since a cough changes what is needed.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'ledger-near',
        time: 'At the left main bronchus',
        situation:
          'Given so far: 150 mg by atomizer and catheter, and 35 mL of 2% as jelly and bronchial syringes, 700 mg. Total 850 mg of his 1000 mg. He coughs again.',
        prompt: 'How much more lidocaine can he have?',
        choices: [
          {
            id: 'a',
            label: 'Up to 150 mg more, counted, and then none.',
            rationale:
              'His maximum is 1000 mg and 850 mg is given. What is left is the whole remaining allowance.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Another 10 mL of 2%, as for each earlier bronchus.',
            rationale:
              'At 20 mg per mL that is more than the 150 mg left. It would take him past 1000 mg.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'As much as stops the cough; doses on the airway do not add up.',
            rationale:
              'Every milligram on the airway counts toward the one maximum, however it is given.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'None; stop the lidocaine at the first cough in the bronchi.',
            rationale:
              'He still has room in the ledger. Use it, counted, before reaching for sedation.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
      {
        id: 'ledger-full',
        time: 'At the maximum',
        situation:
          'He has now had 1000 mg in all. The cough settles briefly, then he coughs and resists at every advance.',
        prompt: 'What now?',
        choices: [
          {
            id: 'a',
            label: 'Pull back, give no more lidocaine, and top up midazolam at 0.01 mg/kg.',
            rationale:
              'The airway is at its maximum and he is still intolerant. That is when the sedation top-up has its place.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'One more syringe of 2%; the maximum is only a guide.',
            rationale: 'The maximum is the limit. Past it, lidocaine toxicity is the risk.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Switch to 1%; it is the weaker solution.',
            rationale:
              'Lidocaine 1% still carries 10 mg per mL, and every milligram counts against the same 1000 mg.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'End the procedure now, with the left side unsurveyed.',
            rationale:
              'Stopping is defensible if a top-up does not settle him. Then record the left branches as not reached.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
      },
    ],
    debrief:
      'The ledger is one maximum, 4 mg/kg of this animal’s own weight, with every way of giving lidocaine counted against it. The workshop’s 724 mg belongs to a 181 kg dolphin. Once the airway is at its maximum and he still resists, the next lever is sedation, not more lidocaine.',
    numberIds: ['lidocaine-max', 'lidocaine-split', 'midazolam-topup'],
    sourceIds: ['nmmp-workshop-2024'],
  },
]

export const dolphinIntegratedCaseById: ReadonlyMap<string, DolphinIntegratedCase> = new Map(
  DOLPHIN_INTEGRATED_CASES.map((integrated) => [integrated.id, integrated] as const),
)
