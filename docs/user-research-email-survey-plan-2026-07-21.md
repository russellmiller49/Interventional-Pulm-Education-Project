# Targeted user-research email and survey plan

**Prepared:** July 21, 2026  
**Audience snapshot:** 173 non-admin registered users  
**Purpose:** Learn what different user groups need, convert feedback into a prioritized improvement backlog, and do so without over-contacting users or exposing personal data.

## Executive recommendation

Use a two-stage program:

1. Add a separate, optional preference for research and feedback invitations. The current site agreement permits usage analytics and deidentified or aggregate research, but it does not explicitly say that users may receive targeted research emails.
2. Run one small, role-stratified foundational survey among users who opt in. Then use occasional, short behavioral surveys to investigate a specific problem such as low return, unused Board Prep, or unmet pleural-learning demand.

Do not launch a research-email campaign until the site has a contact preference, a global unsubscribe mechanism, and a suppression list. In the meantime, an authenticated in-site invitation can ask users whether they want to participate, subject to the site's institutional research and privacy review.

## 1. Consent and contact boundary

### Current state

- 171 of 173 non-admin profiles have accepted the current analytics/research agreement.
- The agreement covers usage and performance analytics and anonymous, deidentified, or aggregate research and quality-improvement use.
- There is no distinct preference for receiving research or feedback emails. Therefore, the number of users with a verifiable research-contact opt-in is currently **zero**.
- Acceptance of the site agreement should not be treated as permission for promotional, educational-update, or research-recruitment email.

### Recommended preference copy

Place this unchecked option in account settings and, after institutional review, in a one-time authenticated prompt:

> Email me occasional invitations—no more than four per year—to provide feedback or participate in research about interventionalpulm.com. Participation is optional. My choice will not affect access to the site, and I can unsubscribe at any time.

Use a separate unchecked preference for educational updates. Do not bundle it with the research invitation preference or with required terms.

Store the exact wording/version, source, timestamp, and withdrawal timestamp for each choice. A user who declines should retain full site access.

## 2. Target audiences

The role groups below are mutually exclusive and suitable for a first-wave quota. The behavioral segments overlap with one another and with the role groups.

### Role groups

| Role group                           |   Users | Recommended research focus                                                 |
| ------------------------------------ | ------: | -------------------------------------------------------------------------- |
| Practicing clinicians and educators  |      97 | Clinical usefulness, trust, teaching workflows, and time constraints       |
| Trainees                             |      58 | Learning pathways, feedback, assessment, and preparation needs             |
| Industry                             |      18 | Neutrality, device education, evidence context, and professional use cases |
| **Total non-admin registered users** | **173** |                                                                            |

An additional **68 users are international**. Treat geography as an overlay rather than a separate role. Include international users across the role quotas and analyze US versus international experience only when the group is large enough to protect privacy.

### Behavioral segments worth investigating

| Signal                                                  | Users | Best initial channel                        | Question to answer                                                    |
| ------------------------------------------------------- | ----: | ------------------------------------------- | --------------------------------------------------------------------- |
| Eligible user did not return within seven days          |    99 | In-site opt-in, then email                  | What blocked the first useful experience?                             |
| No recorded activity in the last 14 days                |    89 | Email only if opted in                      | Is the content hard to find, irrelevant, or simply not top of mind?   |
| Three or more active days                               |    28 | In-site or opted-in email                   | What creates repeat value and should be expanded?                     |
| EBUS interest selected but no EBUS module visit         |    63 | In-site prompt                              | Is discovery, relevance, or content format the obstacle?              |
| Pleural interest selected but no pleural module visit   |   122 | In-site prompt                              | Which pleural topics and formats should be built or promoted first?   |
| Board Preparation goal selected but no Board Prep use   |    41 | In-site prompt                              | What type of question practice and feedback would be valuable?        |
| Podcast page visited but no tracked episode listen      |    29 | In-site prompt                              | Is playback, discovery, episode length, or topic selection the issue? |
| EBUS hub visited but no tracked EBUS submodule visit    |    17 | In-site prompt                              | Does the hub communicate a clear next step?                           |
| Active non-admin PCCM enrollment with no video progress |     3 | Direct course support, not a research blast | Is access or orientation blocking course start?                       |

Use a minimum reporting group of 10 invited users and suppress subgroup statistics with fewer than five responses. Never expose a user-level segment list in reports.

## 3. Recommended first-wave pilot

Invite only users who have explicitly opted into research contact.

### Sample and schedule

- Up to 15 practicing clinicians/educators
- Up to 15 trainees
- Up to 10 industry users
- Aim for at least 10 international users distributed across those role quotas
- Send one invitation and, only to nonresponders, one reminder five to seven days later
- Close the survey after 14 days
- Cap research invitations at one per 30 days and four per rolling 12 months per user
- Keep the foundational survey below three minutes: seven core questions and no more than three role-specific questions

If fewer opted-in users are available, run a smaller pilot rather than filling quotas with people who have not consented to contact.

### Selection rules

Within each quota, sample across engagement levels and geography. Do not select only highly active users; that would overstate satisfaction and miss onboarding problems. Exclude:

- Admin and test accounts
- Globally unsubscribed or suppressed addresses
- Hard bounces and prior spam complaints
- Anyone contacted for research in the preceding 30 days
- Users already participating in an interview on the same topic

## 4. Email templates

Use plain language, a recognizable sender, and a reply-monitored address. Personalize only with information users expect, such as first name. Avoid language such as “we saw that you did not…” because it can feel intrusive.

### Shared footer for every research invitation

> You are receiving this invitation because you chose to receive occasional feedback or research invitations from interventionalpulm.com. Participation is optional and will not affect your access to the site. Please do not include patient-identifying or other protected health information. [Unsubscribe from research invitations] · [Privacy information] · [Institutional name and postal address]

Survey links should contain a short-lived, opaque token. Do not put role, country, email address, or user ID in the URL.

### A. Practicing clinicians and educators

**Subject options**

- Which parts of interventionalpulm.com should we improve next?
- A 3-minute survey for clinicians and educators

**Body**

Hi {{first_name}},

We are improving interventionalpulm.com and would value your perspective as a clinician or educator. This short survey asks what is most useful, what is difficult to find, and which learning formats would fit your clinical or teaching work.

It should take about three minutes. Your responses will be reviewed in aggregate and used to prioritize site improvements.

[Share feedback]

Thank you for helping us make the site more useful.

— The interventionalpulm.com team

{{research_footer}}

### B. Trainees

**Subject options**

- Help improve the site for fellows and learners
- What would make interventionalpulm.com more useful for training?

**Body**

Hi {{first_name}},

We are planning the next improvements to interventionalpulm.com and want to understand what learners need most—from clear pathways and procedure preparation to questions, feedback, and progress tracking.

Would you take a three-minute survey? Your answers will help us decide what to improve first.

[Take the learner survey]

Participation is optional. Please do not include information about patients or identifiable clinical cases.

— The interventionalpulm.com team

{{research_footer}}

### C. Industry users

**Subject options**

- Help us keep device education useful and neutral
- A short survey about professional use of interventionalpulm.com

**Body**

Hi {{first_name}},

We are reviewing how interventionalpulm.com serves professionals who work with pulmonary technologies and devices. We would value your feedback on educational usefulness, evidence context, and how clearly the site separates education from promotion.

This survey should take about three minutes. Responses will be summarized with other feedback and used to improve the site.

[Share feedback]

— The interventionalpulm.com team

{{research_footer}}

### D. Users who did not return after their first visit

Use only after research-contact opt-in. Do not state that their activity was individually monitored.

**Subject:** Was anything difficult to find or use?

Hi {{first_name}},

We are working to make the first experience on interventionalpulm.com clearer and more useful. A two-minute survey asks what you expected to find and whether anything made it difficult to get started.

[Tell us about your experience]

Even one answer will help us improve onboarding and navigation.

— The interventionalpulm.com team

{{research_footer}}

### E. Users interested in pleural education

**Subject:** Which pleural education should we prioritize?

Hi {{first_name}},

We are deciding which pleural topics and learning formats to improve next. If this area is relevant to you, please take our two-minute survey and help us prioritize the work.

[Choose pleural priorities]

— The interventionalpulm.com team

{{research_footer}}

### F. Users with a Board Preparation goal

**Subject:** What would make Board Prep more useful?

Hi {{first_name}},

We are reviewing the Board Prep experience on interventionalpulm.com. This two-minute survey asks what question formats, explanations, and progress feedback would be most useful.

[Share Board Prep feedback]

— The interventionalpulm.com team

{{research_footer}}

### G. Users who visited the podcast page

**Subject:** What would make the Journal Club podcasts easier to use?

Hi {{first_name}},

We are improving the Journal Club podcast experience. This short survey asks about episode discovery, playback, length, topics, and supporting notes.

[Share podcast feedback]

— The interventionalpulm.com team

{{research_footer}}

### Reminder template

**Subject:** Reminder: help us choose the next site improvements

Hi {{first_name}},

If you have not yet had a chance, our short interventionalpulm.com survey remains open until {{close_date}}. It takes about three minutes, and your feedback will help us decide what to improve next.

[Share feedback]

If now is not a good time, no action is needed. This is the only reminder for this survey.

— The interventionalpulm.com team

{{research_footer}}

## 5. Foundational survey

### Opening disclosure

> We are collecting feedback to improve interventionalpulm.com. The survey takes about three minutes and is optional. Responses may be linked to your account and broad role or region so we can understand different user needs; reports will use aggregated or deidentified results. Do not include patient-identifying or other protected health information. Selecting “Start” indicates that you agree to participate in this feedback survey. [Privacy information] [Contact]

If the institutional determination requires different consent language, use that language instead. If identity linkage is unnecessary, make the survey anonymous and say so accurately.

### Seven core questions

1. **What is your main reason for using interventionalpulm.com?**  
   Select one: Learn a procedure; prepare for an assessment or board exam; teach others; review devices or techniques; keep up with evidence; support a formal course; explore the field; other.

2. **How easy is it to find useful content on the site?**  
   Five-point scale: Very difficult to Very easy, plus Not enough experience to say.

3. **Which areas should we improve first?**  
   Choose up to three: Navigation/search; onboarding; procedure modules; airway anatomy/navigation; EBUS; pleural; devices; Board Prep; podcasts/Journal Club; course experience; progress tracking; mobile experience; accessibility; other.

4. **Which learning formats are most useful to you?**  
   Choose up to three: Short videos; step-by-step modules; case-based questions; annotated images; interactive anatomy or simulation; podcasts; concise reference tables; downloadable checklists; live sessions; other.

5. **What most often prevents you from returning or completing content?**  
   Choose all that apply: Limited time; unsure where to start; content not relevant enough; content too long; difficult on mobile; technical or sign-in problem; prefer another resource; no reminder or reason to return; nothing prevents me; other.

6. **What single improvement would make you most likely to return?**  
   Short text response, optional, 300-character limit.

7. **Is there anything else we should know?**  
   Optional, 750-character limit. Repeat: “Do not include patient-identifying or protected health information.”

## 6. Role-specific branches

Show at most three questions based on the user's broad role. Include a “not applicable” option wherever appropriate.

### Trainee branch

1. When would you most likely use the site? Before a procedure; after a procedure; during a formal rotation/course; for board preparation; for independent study; other.
2. Which feedback would help most? Answer explanations; skill checklists; knowledge scores; progress over time; recommended next module; faculty feedback; none.
3. Would an assigned learning pathway from faculty be useful? Definitely not to Definitely yes.

### Practicing clinician or educator branch

1. What is your main professional use? Point-of-care review; skill development; teaching; curriculum planning; assessment; evidence update; other.
2. What would increase your confidence in using or recommending a module? References and dates; named faculty review; learning objectives; disclosures; evidence grading; downloadable teaching materials; CME information; other.
3. What is the longest module you would usually begin in one sitting? Under 5 minutes; 5–10; 11–20; 21–30; over 30; depends on topic.

### Industry branch

1. What is your main use? Understand procedures; learn device categories; train internal teams; understand clinical workflow; monitor evidence; other.
2. How well does the site distinguish neutral education from commercial promotion? Five-point scale, plus Not enough experience to say.
3. Which nonpromotional content would be most useful? Device-category comparisons; mechanism explanations; indications/contraindications; evidence summaries; workflow and setup; complication management; terminology; other.

## 7. Behavioral micro-surveys

These should take 30–90 seconds and answer one product decision. Prefer showing them in context on the site; email them only to opted-in users.

### First-visit or low-return survey

1. What did you come to the site to accomplish?
2. Did you find a clear place to start? Yes; partly; no.
3. What got in the way? Navigation; sign-in; page performance; mobile layout; content relevance; time; other.
4. What should the first page recommend for you?

### Pleural-priorities survey

1. Which topics matter most? Pleural ultrasound; thoracentesis; chest tubes; indwelling pleural catheters; medical thoracoscopy; pleurodesis; persistent air leak; pleural manometry; other.
2. Which format would you use first? Short video; step-by-step module; case questions; images; checklist; reference summary.
3. What is currently missing from the site?

### Board Prep survey

1. What are you preparing for, and on what approximate timeline? Include “prefer not to say.”
2. What should a useful session contain? Timed questions; untimed practice; explanations after each answer; topic review; performance by topic; spaced review.
3. What prevents you from starting the current Board Prep area?

### Podcast survey

1. What prevented or delayed listening? Could not find a relevant episode; playback problem; prefer another app; episode too long; wanted notes/transcript; saving for later; other.
2. Preferred episode length: Under 10; 10–20; 21–30; over 30 minutes.
3. Which companion material would help? Article link; key points; transcript; figures/tables; quiz; references; none.

### International-access survey

1. Did connection speed, media loading, or sign-in affect use?
2. Would transcripts, low-bandwidth media, downloadable summaries, or translations help?
3. Which language would be most useful? Ask only when there is a plausible plan to act on the answer.

## 8. Sending and data architecture

The repository already contains an email-notification pattern that can use Resend or SendGrid for transactional course messages. Do not reuse its queue for research outreach until research preferences, suppression, and invitation records are separated from transactional email.

### Conceptual tables

| Table                    | Essential fields                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_email_preferences` | `user_id`, separate `research_invites` and `education_updates` booleans, global unsubscribe, consent text version, source, timestamps, locale |
| `research_campaigns`     | Purpose, owner, audience definition, consent/determination reference, open/close dates, status                                                |
| `research_invitations`   | Campaign, user, segment snapshot, status, sent/reminder/completed timestamps, provider message ID, hashed opaque token                        |
| `research_responses`     | Invitation, question version, structured answer, submitted timestamp; store free text separately when practical                               |
| `email_suppressions`     | Normalized email hash or user, reason, provider event, created timestamp, reversible status where appropriate                                 |

Enforce one invitation per user per campaign. Record a segment snapshot at send time so later profile changes do not alter the analysis denominator.

### Access and database controls

- Enable row-level security on all tables exposed through Supabase's API.
- Let authenticated users read and change only their own contact preferences.
- Keep campaign membership, raw responses, and suppression data server-only for ordinary users.
- Use a privileged server function or Edge Function for sends; never expose the service-role key in browser code.
- Store only a hash of each survey access token and give the token an expiration date.
- Use least-privilege grants for the sending function and reporting role.
- Index foreign-key columns and add a partial index for invitations waiting to be sent or reminded.
- Use constrained status values and `timestamptz` for auditable events.
- Keep application logs aggregate; do not log survey tokens, email bodies, or free-text responses.
- Define a retention period for invitation metadata, raw responses, and free text before launch.

## 9. Compliance and governance checklist

This is operational guidance, not legal or institutional-review advice.

- Obtain an institutional determination about whether each effort is internal quality improvement, human-subjects research, or another activity before launch. HHS notes that quality-improvement activity is not automatically research, while work designed to develop or contribute to generalizable knowledge may be research: [HHS OHRP Quality Improvement Activities FAQ](https://www.hhs.gov/ohrp/regulations-and-policy/guidance/faq/quality-improvement-activities/index.html).
- For users relying on consent under European data-protection rules, consent should be freely given, specific, informed, indicated by a positive act, and as easy to withdraw as to give: [European Commission guidance on valid consent](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/grounds-processing/when-consent-valid_en).
- If US commercial-email rules apply, use accurate sender and subject information, include a valid postal address and clear opt-out, and honor opt-outs promptly: [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).
- Configure SPF, DKIM, and DMARC for the sending domain and include machine-readable unsubscribe headers where supported.
- Avoid open-tracking pixels. Delivery, bounce, survey start, completion, unsubscribe, and complaint data are enough to manage the program.
- Do not export contact lists to personal devices or unapproved survey tools.
- Use an institution-approved survey system and a business-associate agreement if the institution determines one is required. The simplest design is to prohibit collection of PHI entirely.
- Ask separately whether a respondent wants to be contacted for an interview. Do not infer interview consent from survey completion.

## 10. Measurement and analysis

### Campaign health

Track:

- Invitations attempted and delivered
- Hard and soft bounces
- Survey-link clicks, starts, and completions
- Completion rate using delivered invitations as the denominator
- Median completion time and question-level drop-off
- Research unsubscribes and spam complaints

Do not use open rate as a primary metric; privacy features make it unreliable, and tracking pixels create unnecessary surveillance.

### Insight analysis

- Compare practicing clinicians/educators, trainees, and industry users.
- Compare US and international respondents only when privacy thresholds are met.
- Do not publish a subgroup result with fewer than 10 invited users or five respondents.
- Show invitation and response counts beside every percentage.
- Compare respondents with the invited sample on broad role, geography, and prior engagement to describe response bias.
- Rank multi-select answers by count and percentage; do not imply statistical precision from this small pilot.
- Review free text for patient identifiers, redact immediately if found, and code only deidentified themes.
- Convert each supported finding into a product decision with an owner, expected outcome, and reassessment date.

### Suggested decision log

| Finding                                            | Evidence                        | Decision                           | Owner | Target date | Success measure       | Recheck date             |
| -------------------------------------------------- | ------------------------------- | ---------------------------------- | ----- | ----------- | --------------------- | ------------------------ |
| Example: learners cannot identify a starting point | Survey plus onboarding behavior | Add a role-based “Start here” path | TBD   | TBD         | Seven-day return rate | Four weeks after release |

## 11. Rollout sequence

1. Add separate research-contact and educational-update preferences plus an always-available unsubscribe page.
2. After privacy and institutional review, show one authenticated in-site prompt inviting users to set those preferences.
3. Document the quality-improvement/research determination and approved survey disclosure.
4. Run the foundational survey with the small role-stratified sample.
5. Publish a brief “what we heard and what we changed” update to close the feedback loop.
6. Run only one behavioral micro-survey at a time. Start with the first-visit/low-return problem or Board Prep because each points to an actionable existing experience.
7. For pleural education, first improve discovery of current material; wait about four weeks, then survey still-unreached opted-in users. This separates a navigation problem from a content-gap problem.
8. Automate recurring campaigns only after the manual pilot has acceptable delivery, completion, unsubscribe, complaint, and data-quality results.

## 12. Snapshot limitations

- Counts reflect the data available on July 21, 2026 and exclude admin accounts.
- Behavioral segments overlap; their counts must not be summed.
- Anonymous visitors cannot be represented in registered-user role or location analysis.
- Country values should be normalized before fine-grained geographic reporting.
- A recorded page visit does not prove content comprehension, and lack of a tracked event does not always prove lack of use.
- No emails were queued or sent, and no production database or preference changes were made while preparing this plan.
