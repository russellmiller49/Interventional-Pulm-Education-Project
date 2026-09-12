# Daily-reference evidence review packet

This packet prepares a 50-product editorial pilot. It contains no new clinical approvals and is not imported by runtime code. All 23 products with stored active notices lead the queue. The next 27 are authored options in the existing procedure examples, with family rotation to reduce concentration in one line. This selection is an editorial policy; actual clinic usage has not been supplied.

## What has been prepared

- A reproducible 50-item batch with catalog identifiers, source locators, existing notices, source dates, review questions and input SHA-256 pins.
- Fifty bounded openFDA UDI catalog/model queries: 65 exact-string candidate records across 33 products; 17 queries returned no exact-string candidate. All 50 queries completed. Exact text equality has not adjudicated legal manufacturer, package identity or current availability.
- Candidate records use the September 2, 2026 UDI dataset where a dataset date was returned. No-result responses have no dataset date. Retrieval time is recorded separately. Leading zeros and configuration suffixes are preserved.
- Four official web pages were retrieved successfully and SHA-pinned in `web-sources.json`; full acquisition bytes remain in ignored local-data. Two manufacturer-grounded description/specification drafts are in `manufacturer-proposals.json`.
- The three draft procedure examples have a base-template gap inventory in `batch.json`; their live worksheets also show composed-scenario review findings.

## First description and specification decisions

| Product                           | Draft summary                                                              | Proposed measurements                                                                                          | Source                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Olympus BF-1TH190, PRD-4A04124FF2 | Therapeutic video bronchoscope for EVIS EXERA III; 2.8 mm working channel. | Insertion-tube diameter 6.0 mm; distal-end diameter 6.2 mm; working length 60 cm.                              | [Manufacturer product page](https://medical.olympusamerica.com/products/bronchoscope/therapeutic-bronchoscope-bf-1th190), Product Support / Specs. |
| Olympus BF-H190, PRD-D6F54A6D11   | Diagnostic video bronchoscope for EVIS EXERA III; 2.0 mm working channel.  | Insertion-tube diameter 5.1 mm; distal-end diameter 5.5 mm; source working length 600 mm, normalized to 60 cm. | [Manufacturer product page](https://content.olympusamerica.com/products/bronchoscope/diagnostic-bronchoscope-bf-h190), Product Support / Specs.    |

The manufacturer pages support these draft measurements, but neither page establishes current orderability or clears the existing recall notices. Their page footers are not treated as document-revision dates. Both exact UDI catalog/model searches returned no candidate; obtain the exact DI from labeling and reconcile it before approving an identity match. Full draft claims, source locators and remaining questions are in the JSON.

## Safety source review priority

For ERBE 20402-401, 20402-410 and 20402-411, the [FDA communication](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/cryoprobe-recall-erbe-usa-removes-flexible-cryoprobes) was updated May 28, 2026 for additional affected lots. The [manufacturer expansion notice](https://us.erbegroup.com/us-en/news-details/voluntary-medical-device-recall/) identifies the May 4 letter and links the affected-lot attachment and response form. Review the complete attachment and applicable unit identifiers before recording local action. Those records belong with the existing three active notices; fetching these pages has not changed the public snapshot or any gate.

The recall page contains an apparent length-unit typo in its affected-product description. Do not use that table to author dimensional specifications; consult the current product labeling. No local lot/serial inventory, recall response, quarantine or manufacturer communication was submitted by this work.

## Procedure review findings

| Composed example                  | Required items without a selectable option | Current IFU required | Responsible role missing | Other gap                                                |
| --------------------------------- | -----------------------------------------: | -------------------: | -----------------------: | -------------------------------------------------------- |
| Chest tube insertion              |                                          2 |                    8 |                        9 | No rescue module reachable through the allowed modifiers |
| EBUS-TBNA / EBUS-FNB              |                                          2 |                   17 |                       17 | Clinical owner not recorded                              |
| Therapeutic flexible bronchoscopy |                                          1 |                   30 |                       30 | Authored laser pathway lacks selectable device coverage  |

All three lack a recorded clinical owner and remain drafts. Counts above were checked in the rendered composed worksheets. They are authoring findings, not patient-specific equipment deficiencies. The owner should review each exact option/configuration, dependencies, current IFU, kit composition, open/hold conditions, rescue coverage and local role assignment before any operational release. The worksheet preserves the existing resolver’s kit-suppressed items separately.

## Product queue

| Order | Exact product                                                                                 | Catalog number     | Priority                 | UDI candidates |
| ----: | --------------------------------------------------------------------------------------------- | ------------------ | ------------------------ | -------------: |
|     1 | ERBE Flexible Cryoprobe 2.4 mm (PRD-05670F1B5F)                                               | 20402-411          | Recorded active notice   |              1 |
|     2 | Teleflex Arrow Pneumothorax Water-Seal Set (PRD-07CDEDC2AB)                                   | ASK-01500          | Recorded active notice   |              1 |
|     3 | Cook Medical Wayne Pneumothorax Catheter Set – Trocar (PRD-12231F4168)                        | G56532             | Recorded active notice   |              1 |
|     4 | Teleflex Arrow Percutaneous Cavity Drainage Kit – Curved (PRD-1D87D6EA1E)                     | AK-01600           | Recorded active notice   |              4 |
|     5 | Verathon GlideScope Core 15 (PRD-2FAFEA973E)                                                  | GlideScope Core 15 | Recorded active notice   |              0 |
|     6 | Intuitive Surgical Ion Fully Articulating Catheter (PRD-48C48C68BA)                           | 490105             | Recorded active notice   |              2 |
|     7 | Olympus BF-1TH190 Video Bronchoscope (PRD-4A04124FF2)                                         | BF-1TH190          | Recorded active notice   |              0 |
|     8 | Teleflex Arrow-Clarke Thoracentesis Kit (PRD-4F4AA966A9)                                      | AK-01000-T         | Recorded active notice   |              8 |
|     9 | Olympus Olympus OER-Pro Automated Endoscope Reprocessor (PRD-5543746F59)                      | OER-Pro            | Recorded active notice   |              1 |
|    10 | Intuitive Surgical Ion Flexision Biopsy Needle 19G (PRD-7397B6CA00)                           | 490104             | Recorded active notice   |              3 |
|    11 | Teleflex Arrow Pneumothorax Kit (PRD-7BE12DDECD)                                              | ASK-01500-JCM      | Recorded active notice   |              4 |
|    12 | ERBE Flexible Cryoprobe 1.7 mm (PRD-7DC3645CFA)                                               | 20402-410          | Recorded active notice   |              1 |
|    13 | Teleflex Arrow Pneumothorax Kit (PRD-7E17F5F17E)                                              | AK-01500           | Recorded active notice   |              5 |
|    14 | Olympus BF-XP190 Ultrathin Video Bronchoscope (PRD-88DA368B9C)                                | BF-XP190           | Recorded active notice   |              0 |
|    15 | Intuitive Surgical Ion Flexision Biopsy Needle 21G (PRD-8A4A27BDD7)                           | 490103             | Recorded active notice   |              2 |
|    16 | Cook Medical Wayne Pneumothorax Catheter Set and Tray – Seldinger (PRD-8C6C29BE46)            | G56535             | Recorded active notice   |              1 |
|    17 | Teleflex Arrow Percutaneous Cavity Drainage Kit – Straight (PRD-9143E639BA)                   | AK-01601           | Recorded active notice   |              3 |
|    18 | ERBE Flexible Cryoprobe 1.1 mm with 817 mm Oversheath (PRD-A2C49C9352)                        | 20402-401          | Recorded active notice   |              1 |
|    19 | Teleflex Arrow-Clarke Thoracentesis Kit (PRD-A72E811F09)                                      | AK-01000           | Recorded active notice   |              4 |
|    20 | Olympus BF-MP190F Video Bronchoscope (PRD-CB1622624D)                                         | BF-MP190F          | Recorded active notice   |              0 |
|    21 | Olympus BF-H190 Video Bronchoscope (PRD-D6F54A6D11)                                           | BF-H190            | Recorded active notice   |              0 |
|    22 | Intuitive Surgical Ion Flexision Biopsy Needle 23G (PRD-F43740CB5C)                           | 490102             | Recorded active notice   |              2 |
|    23 | Cook Medical Vinyl Connecting Tube (PRD-FD34401E04)                                           | G02898             | Recorded active notice   |              1 |
|    24 | Ambu Ambu aScope 5 Broncho HD 5.6/2.8 Sampler Set (PRD-04A0F61F62)                            | 622002000US        | Procedure example option |              1 |
|    25 | Atrium Medical (Getinge) Atrium Express Mini 500 Mobile Dry Seal Chest Drain (PRD-2F1DF55F3C) | 16400              | Procedure example option |              6 |
|    26 | Atrium Medical (Getinge) Atrium Oasis Dry Suction Water Seal Chest Drain (PRD-94C61697D9)     | 3600-100           | Procedure example option |              1 |
|    27 | Atrium Medical (Getinge) Atrium Ocean Water Seal Chest Drain (PRD-A31173136E)                 | 2002-057           | Procedure example option |              1 |
|    28 | Boston Scientific Acquire Pulmonary EBUS Fine Needle Biopsy Device (PRD-D826F63F9A)           | M00552351          | Procedure example option |              0 |
|    29 | Boston Scientific Alliance II Inflation Handle (PRD-35EC8EE328)                               | M00550620          | Procedure example option |              1 |
|    30 | Boston Scientific Amplatz Super Stiff Guidewire (PRD-5F801B5A8E)                              | M00550090          | Procedure example option |              1 |
|    31 | Boston Scientific CoreDx Pulmonary Mini-Forceps (PRD-C2875D269C)                              | M00515220          | Procedure example option |              1 |
|    32 | Boston Scientific CRE Single-Use Pulmonary Balloon Dilatation Catheter (PRD-189E7EF27A)       | M00550350          | Procedure example option |              1 |
|    33 | Boston Scientific CRE SteriFlate Disposable Inflation Device (PRD-61915862CE)                 | M00550630          | Procedure example option |              1 |
|    34 | Boston Scientific Expect Pulmonary EBUS-TBNA Needle (PRD-2302DA77DA)                          | M00558220          | Procedure example option |              1 |
|    35 | Boston Scientific Jagwire Single-Use Pulmonary Guidewire (PRD-602AA2F147)                     | M00515171          | Procedure example option |              0 |
|    36 | Boston Scientific Radial Jaw 4 Single-Use Pulmonary Biopsy Forceps (PRD-217AB10438)           | M00515202          | Procedure example option |              0 |
|    37 | Boston Scientific Rescue Pulmonary Grasping Forceps (PRD-9844E2B578)                          | M00515101          | Procedure example option |              0 |
|    38 | Boston Scientific Ultraflex Partially Covered Tracheobronchial Stent System (PRD-05780FEDD7)  | M00576560          | Procedure example option |              1 |
|    39 | Boston Scientific Zero Tip Single-Use Airway Retrieval Basket (PRD-4E9069C30F)                | M00513210          | Procedure example option |              1 |
|    40 | Butterfly Network Butterfly iQ3 Accessory Cable, Lightning, 2.50 m (PRD-35BAC12D9F)           | 900-20054-03       | Procedure example option |              0 |
|    41 | Cook Medical Fuhrman Pleural/Pneumopericardial Drainage Set and Tray (PRD-0410844D48)         | G55713             | Procedure example option |              1 |
|    42 | Cook Medical EchoTip Endobronchial HD Ultrasound Needle (PRD-19AC7F0794)                      | G53408             | Procedure example option |              1 |
|    43 | ERBE Pressure Reducer with Sensor for APC 2/APC 3, CGA Group (PRD-09AF1B1AE5)                 | 20134-006          | Procedure example option |              0 |
|    44 | ERBE Bipolar Connecting Cable, Martin Standard, 5 m (PRD-0A9806F6F2)                          | 20196-059          | Procedure example option |              0 |
|    45 | ERBE ERBECRYO 2 Exhaust Gas Hose, 5 m (PRD-0C821995AC)                                        | 20402-007          | Procedure example option |              0 |
|    46 | ERBE FiAPC Probe 3000 A (PRD-3A183102CF)                                                      | 20132-223          | Procedure example option |              0 |
|    47 | ERBE FiAPC plus Probe 3000 A with Filter (PRD-19BAA6E1D6)                                     | 20132-323          | Procedure example option |              1 |
|    48 | FUJIFILM SonoSite SonoSite L13-6 Transducer (PRD-075C3EC5EE)                                  | L13-6              | Procedure example option |              0 |
|    49 | FUJIFILM SonoSite SonoSite LX Ultrasound System (PRD-629828B799)                              | SonoSite LX        | Procedure example option |              0 |
|    50 | FUJIFILM SonoSite SonoSite PX Ultrasound System (PRD-59D02C1811)                              | SonoSite PX        | Procedure example option |              0 |

## Publication procedure

The existing [D2D evidence methodology](../d2d-review/methodology.md) requires: “Every public row requires one accountable physician-owner decision.” These preparations do not substitute for that decision. For each product, review identity/manufacturer/package evidence, reconcile source conflicts, disposition the draft description and every specification with its locator and evidence scope, and assess FDA plus manufacturer safety information separately. A no-candidate query is not a conclusion that the device is unlisted or unauthorized.

Record accountable owner decisions through the governed review workflow in a follow-on publication change. The frozen ten-product D2D pilot remains intact. These new draft files cannot be promoted by changing their status string or importing them directly into a page. New approved coverage requires reviewed registry/cohort integration and validation; it is not counted in the current ten reviewed descriptions.

Commands:

```sh
npm run ip-intel:daily-reference-review -- --check
# Generate a new immutable identity-candidate acquisition for a chosen date:
npm run ip-intel:daily-reference-acquire -- --snapshot YYYY-MM-DD
```

The review generator is offline. Only acquisition uses the public UDI endpoint, at two requests/second with bounded retries and 25 results/query. Any truncated query remains marked bounded. A failed query remains failed, and the previous snapshot is never overwritten. No page render uses web search or calls FDA.
