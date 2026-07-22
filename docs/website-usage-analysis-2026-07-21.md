# Website usage analysis

**Snapshot date:** July 21, 2026  
**Primary-site observation window:** June 4–July 21, 2026 (Pacific Time)  
**Southern California EBUS course window:** April 27–July 21, 2026  
**Privacy:** All queries were aggregate-only. Names, email addresses, and user-level records were not extracted into this report.

## Executive summary

- The site has **242 authentication accounts** and **215 unique users with recorded module activity** across the primary site and Southern California EBUS course. Four users appear in both datasets, so the combined count is deduplicated.
- The primary-site audience contains **173 non-admin profiles**. Of these, **162 (93.6%)** have at least one recorded module session. Initial activation is excellent: **158 (91.3%)** were active on their signup day.
- Repeat use is the central growth opportunity. Only **43 of 142 eligible users (30.3%)** returned on a later day within seven days of signup. The median active user used the site on **one day** and accumulated only **3.3 minutes** of recorded time, even though a small set of highly engaged users generated much longer sessions.
- Daily reach is growing. During the most recent seven days, the primary site had **49 active users and 588 sessions**, compared with **37 users and 463 sessions** in the prior seven days: **+32.4% users** and **+27.0% sessions**. Much of the increase coincides with new registrations and the PCCM Intro Course rather than broad repeat usage.
- The largest audience groups are interventional pulmonologists, pulmonologists, and fellows. **39.3%** of profiles are in training, and **39.3%** are outside the United States.
- By authenticated reach, the most-used established content families are **Resources (83 users)**, **EBUS Training (80)**, **Anatomy (71)**, **Bronchoscopy Navigation Trainer (50)**, **Journal Club Podcasts (40 page visitors)**, and **Board Prep (38)**.
- The strongest depth of engagement is in structured programs. The PCCM Intro Course has **60.7 verified video-watch hours** and **141 completed video-user records out of 144 progress records**. The Southern California EBUS course has **57 active learners**, of whom **52 used it on at least two days**.
- There is a large interest-to-use gap: **123 users selected pleural disease as an interest**, but only **one of those users** has a recorded visit to the new pleural module family. The pleural modules only first appeared in the data on July 12, so this is an early but important discoverability signal.
- Time totals are currently unreliable. A small number of stale or extremely long sessions dominate recorded hours. Unique users, session counts, qualified starts, video-watch progress, and completions should be used for decisions until the duration logic is corrected.

## What the data does and does not measure

The report uses live aggregate data from:

- `site_profiles`, `site_module_sessions`, `site_module_progress`, and `site_module_events`
- `journal_club_podcast_listens` and `journal_club_podcast_feedback`
- `pccm_intro_course_enrollments`, `pccm_intro_course_video_progress`, and assessment attempts
- `learner_profiles`, `learner_module_sessions`, and `learner_module_progress` for the Southern California EBUS course

Two primary-site admins were excluded using the same entitlement logic as the existing admin dashboard.

The primary tracker creates a session for each tracked route and counts time only while the page is visible. Its API requires an authenticated user. Consequently:

- Public or public-unlisted use by anonymous visitors is not represented.
- A “session” is closer to a tracked route visit than a conventional whole-site visit.
- Country is self-reported during onboarding. No city, state, IP-geolocation, referral source, campaign, device, or browser data is available.
- The production homepage did not expose a GA4 or Plausible script in its initial HTML on July 21. A production-only configuration could still exist, but no third-party traffic dataset was available for this analysis.
- Completion is only meaningful for modules that explicitly emit completion or progress events. A zero completion count for a simple reference page is not evidence that users failed the module.

### Measurement reliability

| Metric                                            |  Reliability | Interpretation                                                 |
| ------------------------------------------------- | -----------: | -------------------------------------------------------------- |
| Registered users, role, country, interests        |         High | Controlled profile fields except country, which is free text   |
| Unique authenticated users by module              |         High | Good measure of registered-user reach                          |
| Session count                                     |  Medium-high | Good for route activity, but route changes create new sessions |
| Primary-site active time                          |   Low-medium | Directional only because long sessions dominate totals         |
| EBUS active time                                  |          Low | Material stale-session inflation                               |
| PCCM video watched seconds and completion         |         High | Based on purpose-built video progress tracking                 |
| Anonymous/public traffic                          | Not measured | Public modules may be substantially undercounted               |
| Acquisition source, device, city, search behavior | Not measured | Cannot yet explain how users arrive or what they fail to find  |

## Audience: roles, career stage, and location

### Professional roles

| Role                              | Registered |  Active | Activation |
| --------------------------------- | ---------: | ------: | ---------: |
| Interventional pulmonologist      |         51 |      47 |      92.2% |
| Pulmonologist                     |         29 |      28 |      96.6% |
| Interventional pulmonology fellow |         19 |      19 |     100.0% |
| Industry                          |         18 |      16 |      88.9% |
| PCCM fellow                       |         14 |      13 |      92.9% |
| Pulmonary fellow                  |         12 |      11 |      91.7% |
| Medical student                   |          7 |       7 |     100.0% |
| All other roles                   |         23 |      21 |      91.3% |
| **Total**                         |    **173** | **162** |  **93.6%** |

The “other roles” group includes critical care fellows, thoracic surgeons, residents, intensivists, advanced practice providers, anesthesiologists, general surgeons, a chief resident, and a medical educator.

Career-stage mix:

- In training: **68 users (39.3%)**
- Less than five years in practice: **42 (24.3%)**
- Five to ten years: **32 (18.5%)**
- Ten to twenty years: **22 (12.7%)**
- More than twenty years: **9 (5.2%)**

The separate Southern California EBUS cohort has 61 approved learners: 55 MDs, 5 DOs, and 1 without a recorded degree. Thirty-five are first-year fellows, 13 second-year, 12 third-year, and 1 is not recorded.

### Location

“Location” is limited to the country users typed during registration.

| Normalized country | Registered |  Active | Activation |
| ------------------ | ---------: | ------: | ---------: |
| United States      |        105 |     100 |      95.2% |
| India              |         24 |      23 |      95.8% |
| Australia          |          6 |       5 |      83.3% |
| Portugal           |          6 |       5 |      83.3% |
| Spain              |          4 |       3 |      75.0% |
| Canada             |          3 |       3 |     100.0% |
| Other 20 countries |         25 |      23 |      92.0% |
| **Total**          |    **173** | **162** |  **93.6%** |

The site has users in **26 normalized countries**. International users account for **68 profiles (39.3%)**. India alone represents **13.9%** of the audience, suggesting meaningful demand for globally accessible, mobile-friendly, bandwidth-conscious content.

Country data needs cleanup. The 173 profiles contained 41 raw country spellings, which normalize to 26 countries; **60 profiles (34.7%)** used a value that required normalization. Examples include multiple spellings of the United States and India. A searchable ISO country selector would prevent this.

### Stated interests and goals

| Interest or goal           | Users | Share of profiles |
| -------------------------- | ----: | ----------------: |
| Interventional pulmonology |   140 |             80.9% |
| Flexible bronchoscopy      |   125 |             72.3% |
| Lung cancer                |   125 |             72.3% |
| EBUS                       |   123 |             71.1% |
| Pleural disease            |   123 |             71.1% |
| Peripheral bronchoscopy    |   111 |             64.2% |
| Robotic bronchoscopy       |   111 |             64.2% |
| Procedural skills goal     |   124 |             71.7% |
| Learn fundamentals goal    |   106 |             61.3% |
| Faculty development goal   |    91 |             52.6% |
| Teaching trainees goal     |    86 |             49.7% |
| Fellowship training goal   |    84 |             48.6% |
| Board preparation goal     |    60 |             34.7% |

This is a strong signal to personalize the home screen. The profile already contains enough information to recommend a first pathway without asking users another question.

## Daily and weekly usage

Across the 48 primary-site calendar days in the dataset:

- There was activity on **47 days**.
- Average daily active users: **6.0**; median: **5.0**.
- Average daily sessions: **38.7**; median: **27.5**.
- Peak users: **17 on July 15**, which was also the peak signup day with **13 new profiles**.
- Peak sessions: **222 on July 20**.
- Daily signups and daily active users are strongly correlated (**r = 0.81**). This supports the inference that recent reach growth is still acquisition-led; the return loop is not yet equally strong.

### Weekly primary-site activity

The first and last weeks are partial. Hours are raw and should be treated as directional.

| Week starting | Active users | Sessions | Raw hours | PCCM raw hours | Other-site raw hours |
| ------------- | -----------: | -------: | --------: | -------------: | -------------------: |
| Jun 1         |           13 |      104 |      3.92 |           0.00 |                 3.92 |
| Jun 8         |           19 |      154 |     11.44 |           0.00 |                11.44 |
| Jun 15        |           22 |      167 |      2.98 |           0.00 |                 2.98 |
| Jun 22        |           30 |      126 |      2.66 |           0.00 |                 2.66 |
| Jun 29        |           36 |      221 |      4.62 |           0.00 |                 4.62 |
| Jul 6         |           28 |      331 |     15.46 |           7.77 |                 7.69 |
| Jul 13        |           49 |      482 |     73.02 |          57.04 |                15.98 |
| Jul 20        |           18 |      271 |     20.08 |          15.76 |                 4.32 |

The week of July 13 is a real reach high, but the time spike is primarily the structured PCCM course. General-site raw time also increased, but much less dramatically.

### Activation and return behavior

| Funnel measure                                 |                      Result |
| ---------------------------------------------- | --------------------------: |
| Non-admin profiles                             |                         173 |
| Any primary-site session                       |                 162 (93.6%) |
| Active on signup day                           |                 158 (91.3%) |
| Eligible for seven-day return measurement      |                         142 |
| Returned on a later day within seven days      |                  43 (30.3%) |
| Used the site on two or more days at any point |  52 (32.1% of active users) |
| Used the site on only one day                  | 110 (67.9% of active users) |
| Activity span of at least seven days           |  29 (17.9% of active users) |
| Activity span of at least thirty days          |    5 (3.1% of active users) |

The site is very good at turning a registration into an immediate visit. The larger opportunity is giving users a reason and an easy path to return.

## Most-used content

The most defensible ranking is by distinct authenticated users. Families group hubs and subroutes so the ranking is not distorted by route naming.

| Content family                  | Unique users | Sessions | First recorded | Interpretation                                           |
| ------------------------------- | -----------: | -------: | -------------: | -------------------------------------------------------- |
| Resources                       |           83 |      324 |          Jun 4 | Broadest reach; Creative Commons is the main destination |
| EBUS Training                   |           80 |      283 |          Jun 4 | Strong hub reach and meaningful submodule use            |
| Anatomy                         |           71 |      137 |          Jun 4 | High reach with more sustained use than a simple hub     |
| Bronchoscopy Navigation Trainer |           50 |      114 |          Jun 4 | Strong specialized-tool adoption                         |
| Journal Club Podcasts page      |           40 |       67 |         Jun 22 | Good page discovery; play conversion is lower            |
| Board Prep                      |           38 |      154 |          Jun 4 | High total depth but only half enter a chapter           |
| FluoroView                      |           33 |       52 |          Jun 4 | Smaller reach with comparatively deeper visits           |
| TNM 9 Staging                   |           29 |       41 |          Jun 4 | Moderate reach, mostly short visits                      |
| PCCM Intro Course               |           14 |      217 |         Jul 10 | Small invited cohort with the greatest verified depth    |
| Therapeutic Bronchoscopy        |           12 |       35 |         Jul 13 | Too new for a stable ranking                             |
| Intro Bronchoscopy              |           11 |      133 |         Jun 15 | Small audience with repeated route use                   |
| Rigid Bronchoscopy              |           11 |       63 |         Jul 13 | Early uptake in a new pathway                            |

Important navigation funnels:

| Funnel                                           | Entry users | Follow-on users | Conversion |
| ------------------------------------------------ | ----------: | --------------: | ---------: |
| EBUS hub → any EBUS submodule                    |          80 |              63 |      78.8% |
| EBUS hub → Knobology                             |          80 |              36 |      45.0% |
| EBUS hub → Stations                              |          80 |              30 |      37.5% |
| EBUS hub → Simulator                             |          80 |              22 |      27.5% |
| Board Prep hub → any chapter                     |          38 |              19 |      50.0% |
| Podcast page → tracked listener                  |          40 |              11 |      27.5% |
| Users with EBUS interest → EBUS Training         |         123 |              60 |      48.8% |
| Users with Board Prep goal → Board Prep          |          60 |              19 |      31.7% |
| Users with pleural interest → new pleural family |         123 |               1 |       0.8% |

The Resources-to-Creative-Commons path exceeds 100% when calculated from hub visitors because many users enter the Creative Commons page directly. This is healthy deep-link behavior, not a funnel error.

## Least-used content

“Least used” means least used **among recorded authenticated sessions**. It is not a total-traffic ranking. Most low-reach standalone modules first appeared only between July 12 and July 16. Cardiohelp ECMO is also public-unlisted, so its anonymous usage is invisible.

Current low-reach families are:

| Content family      | Unique users | Sessions | First recorded | Caution                                             |
| ------------------- | -----------: | -------: | -------------: | --------------------------------------------------- |
| Cardiohelp ECMO     |            1 |        1 |         Jul 16 | Public-unlisted and very new; likely undercounted   |
| Peripheral Ablation |            1 |        2 |         Jul 13 | New module                                          |
| Thermal Ablation    |            1 |        4 |         Jul 13 | New module                                          |
| Tracheostomy        |            3 |        6 |         Jul 15 | New module                                          |
| Pleural Procedures  |            4 |      212 |         Jul 12 | Very few users with many course-linked route events |
| XR                  |            8 |       11 |          Jun 4 | Longer-exposed content with low authenticated reach |

Several established Board Prep chapters recorded only one or two users, including coding and billing, anesthesia for IP, lung cancer staging, lung cancer screening, airway stents, pleural infections, percutaneous tracheostomy, mechanical debridement and balloon dilatation, pneumothorax/prolonged air leak, and advanced peripheral bronchoscopy. The Board Prep hub receives traffic, but chapter discovery is weak.

## Structured-course analysis

### PCCM Intro Course

- **14 active non-admin Loma Linda enrollments**
- **12 assessment users**
- **11 video users**, or **78.6%** of active non-admin enrollments
- **144 video-user progress records**
- **141 completed records (97.9%)**
- **60.65 verified watched hours**
- Bronchoscopy pretest: 11 users, average 54.5%
- Pleural pretest: 12 users, average 73.9%
- Bronchoscopy and pleural posttests: 1 user each

Both Loma Linda and UCSD posttests are currently marked as not released, so the posttest counts should not be interpreted as attrition.

The first two bronchoscopy videos have 9 completions among 10 starters, while most subsequent Loma Linda videos have 9/9 or 10/10 completion. This suggests a small early-course onboarding gap, followed by excellent persistence among users who continue.

### Southern California EBUS Course

- **61 approved learners**
- **57 learners with sessions (93.4%)**
- **52 learners active on at least two days (91.2% of active learners)**
- Median active days per learner: **6**
- Peak week: May 25, with **50 active learners and 2,455 route sessions**

| Module      | Users with sessions | Progress completions | Average progress |
| ----------- | ------------------: | -------------------: | ---------------: |
| Lectures    |                  56 |                   21 |            72.6% |
| Pretest     |                  47 |                 55\* |            95.2% |
| Knobology   |                  35 |                    6 |            27.7% |
| Stations    |                  33 |                    0 |            23.4% |
| TNM Staging |                  31 |                    3 |            26.1% |
| Simulator   |                  28 |                    0 |            23.1% |
| Case 001    |                  27 |                    0 |             7.0% |

\*Progress was initialized or imported for some learners without a corresponding recorded route session, so pretest progress completions can exceed session users.

Repeat use is excellent for this cohort. The main questions are whether lower later-module completion reflects the intended course schedule and gating, incomplete tracking, or a real learner drop-off. Activity declined sharply after the May cohort peak; this may be expected if the course was scheduled rather than evergreen.

### Journal Club Podcasts

- Podcast page visitors: **40**
- Unique tracked listeners: **11**
- Listening sessions: **19**
- Verified listening time: **1.35 hours**
- Sessions reaching at least 95%: **7 (36.8%)**
- Average maximum progress per session: **47.0%**
- Feedback responses: **0**

The most-started episode was “A Dedicated Tracheobronchial Stent” with six sessions, but only one completion and 30.8% average maximum progress. The chest-drain-removal episode had three English sessions and two completions. Samples are too small to use episode rankings for editorial decisions yet.

The immediate opportunity is page-to-play conversion: only **27.5%** of podcast-page users have a tracked listen.

## Duration-data problem

Raw hours should not be used as a KPI until stale sessions are corrected.

| Dataset                  | Sessions | Raw hours | Hours with 30-min/session cap | Hours with 60-min/session cap | Share of raw time from 60+ minute sessions |
| ------------------------ | -------: | --------: | ----------------------------: | ----------------------------: | -----------------------------------------: |
| Primary site             |    1,856 |    134.18 |                         67.76 |                         84.37 |                                      56.5% |
| Southern California EBUS |    4,877 |  1,356.04 |                        328.19 |                        375.65 |                                      75.7% |

On the primary site, just **26 sessions (1.4%)** lasted at least one hour but generated 56.5% of raw time. The longest session was 7 hours 46 minutes. The median session was 13 seconds and the 90th percentile was 5 minutes.

In the EBUS dataset, **46 sessions (0.9%)** generated 75.7% of raw time. The longest session was approximately 119 hours. This is a clear stale-session defect, not plausible active learning time.

Recommended correction:

1. Preserve raw session data for auditability.
2. Add a cleaned analytics view with a documented idle/stale rule and an outlier flag.
3. Close a session server-side when heartbeats stop, rather than treating later cleanup as active duration.
4. Report active heartbeat intervals, not elapsed open-tab time.
5. Show both raw and cleaned duration during a transition period.

## Prioritized improvements

| Priority | Improvement                                                       | Evidence                                                                              | Success metric                                                                                                                            |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Fix stale-session duration and create a cleaned analytics view    | 56.5% of primary time and 75.7% of EBUS time comes from 60+ minute sessions           | Under 10% of measured time from flagged sessions; raw and cleaned totals visible                                                          |
| P0       | Measure anonymous traffic separately from authenticated learning  | Public/unlisted modules are invisible when users are signed out                       | Anonymous page views, qualified visits, referrals, campaigns, device class, and locale available without mixing them with learner records |
| P1       | Build a personalized “Continue learning” home section             | 93.6% activate, but only 30.3% return within seven days                               | Seven-day return rises from 30.3% to at least 40%                                                                                         |
| P1       | Promote pleural and Board Prep pathways based on stated interests | 71.1% selected pleural disease; 34.7% selected Board Prep; recorded use is much lower | Pleural interest-to-use reaches 10% after a full month; Board goal-to-use rises above 45%                                                 |
| P1       | Improve Board Prep chapter discovery                              | Only 50% of Board Prep hub users opened any chapter                                   | Hub-to-chapter conversion above 70%                                                                                                       |
| P1       | Improve podcast page-to-play conversion                           | 40 page users but only 11 listeners                                                   | Page-to-play conversion above 40%; completion above 45%                                                                                   |
| P1       | Nudge enrolled course users who have not started                  | 14 non-admin PCCM enrollments but 11 video users                                      | At least 90% of enrollees start a video                                                                                                   |
| P2       | Replace country free text with a searchable ISO selector          | 41 raw spellings for 26 countries; 34.7% require normalization                        | More than 98% standardized country values                                                                                                 |
| P2       | Add a canonical module catalog                                    | Module IDs are fragmented and zero-use modules cannot be identified reliably          | Every module has a title, family, release date, visibility, audience, and completion-tracking flag                                        |

### Recommended product changes

1. **Personalized return path.** Use interests, role, and training level to show one recommended next module, recent progress, and a resume button immediately after login.
2. **Qualified-start metric.** Separate hub bounces from meaningful starts by defining a qualified module start as at least 30 visible seconds or one meaningful interaction.
3. **Pleural pathway launch.** Place a clear Pleural Disease pathway on the logged-in home screen and notify users who selected pleural disease. Because the modules are new, evaluate after four complete weeks rather than against June-era content.
4. **Board Prep orientation.** Add “Start here,” “Most popular,” and “Continue” cards, plus topic filters. The hub has interest, but chapter selection is a friction point.
5. **Podcast conversion.** Put a prominent play/resume control above the fold, show episode length and learning objective, and request one-tap feedback only after substantial listening. Avoid autoplay.
6. **EBUS progression.** Make the intended order and unlock criteria explicit. If users are supposed to reach Simulator and Case 001, show their prerequisites and progress on every EBUS page.
7. **Low-bandwidth mode.** With 39.3% international use and a large India audience, provide clear asset sizes, poster images, transcript-first alternatives, and graceful 3D/video loading.
8. **Privacy-conscious acquisition analytics.** Capture landing page, UTM campaign, referrer category, device class, locale, and coarse country with short retention. Do not put free text, clinical data, or PHI in analytics payloads.

## Dashboard metrics to monitor next

The next dashboard should separate anonymous discovery from authenticated learning and should show:

- Daily, weekly, and monthly active users
- New versus returning active users
- Signup → qualified module start → seven-day return
- Unique users, qualified starts, and return visits per module
- Completion only for modules marked completion-capable
- Interest-to-use conversion by content family
- Course enrollment → first content start → completion
- Podcast page view → play → 50% → 95%
- Raw versus cleaned active time and number of flagged sessions
- Performance by locale, coarse country, and device class
- Release-age-normalized module reach, such as unique users per available day

## Appendix: primary-site daily usage

July 21 is partial. “Sessions” are tracked route sessions, not conventional whole-site sessions. Time is omitted from this table because of the duration-quality issue.

| Date (PT) | Active users | Sessions | New profiles |
| --------- | -----------: | -------: | -----------: |
| Jun 4     |            2 |       33 |            2 |
| Jun 5     |            1 |       14 |            0 |
| Jun 6     |            9 |       34 |            8 |
| Jun 7     |            5 |       23 |            5 |
| Jun 8     |            6 |       39 |            5 |
| Jun 9     |            6 |       15 |            3 |
| Jun 10    |            6 |       44 |            6 |
| Jun 11    |            1 |        1 |            1 |
| Jun 12    |            4 |       19 |            1 |
| Jun 13    |            3 |       27 |            0 |
| Jun 14    |            3 |        9 |            1 |
| Jun 15    |            4 |       22 |            2 |
| Jun 16    |            2 |        8 |            2 |
| Jun 17    |            3 |       16 |            2 |
| Jun 18    |            2 |        4 |            1 |
| Jun 19    |            4 |       14 |            2 |
| Jun 20    |            9 |       64 |            5 |
| Jun 21    |            4 |       39 |            2 |
| Jun 22    |            7 |       31 |            6 |
| Jun 23    |            9 |       22 |            8 |
| Jun 24    |            7 |       29 |            6 |
| Jun 25    |            6 |       20 |            3 |
| Jun 26    |            3 |        4 |            2 |
| Jun 27    |            3 |       15 |            2 |
| Jun 28    |            2 |        5 |            0 |
| Jun 29    |            3 |        7 |            1 |
| Jun 30    |            2 |       20 |            1 |
| Jul 1     |           11 |       63 |           10 |
| Jul 2     |           13 |       56 |           11 |
| Jul 3     |            9 |       52 |            8 |
| Jul 4     |            4 |        7 |            0 |
| Jul 5     |            4 |       16 |            2 |
| Jul 6     |            6 |       33 |            5 |
| Jul 7     |            0 |        0 |            0 |
| Jul 8     |            4 |       28 |            4 |
| Jul 9     |            9 |       45 |            5 |
| Jul 10    |            4 |       19 |            2 |
| Jul 11    |            8 |       66 |            5 |
| Jul 12    |            5 |      140 |            2 |
| Jul 13    |            9 |      114 |            4 |
| Jul 14    |           12 |       51 |            7 |
| Jul 15    |           17 |       86 |           13 |
| Jul 16    |           11 |       58 |            4 |
| Jul 17    |            4 |       26 |            3 |
| Jul 18    |            9 |       57 |            2 |
| Jul 19    |           12 |       90 |            3 |
| Jul 20    |           13 |      222 |            4 |
| Jul 21    |            6 |       49 |            2 |

## Reproducibility notes

- Aggregate queries were run against Supabase project `tqnhxlwvkkswuckszlee` on July 21, 2026.
- Dates were converted to `America/Los_Angeles` for daily and weekly reporting.
- Active site admins and course-admin entitlements were excluded from primary-site analytics.
- Module families use the portion of `module_id` before the first colon.
- Podcast completion means `completed_at` is present or maximum progress is at least 95%.
- Country normalization was query-time only; source profile values were not modified.
- No production data, schema, user profile, or entitlement was changed.
