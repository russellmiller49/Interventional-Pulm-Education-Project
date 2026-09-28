# Medical Thoracoscopy — device register

_Printed from the register by `scripts/medical-thoracoscopy/render-registers.ts`. Do not edit by hand._

Device facts copied from manufacturer documents and from records the manufacturer submitted to the FDA device database, each with the document and place it was read. Nothing here has been fact-checked by the manufacturer: every fact check reads NOT REVIEWED. A dimensional comparison is not a statement of compatibility. Values that were measured from images or chosen by the author are marked as such and are not device facts.

Intended market: US (unresolved input). Assumed from the US sell sheet. The owner has not confirmed the market or the exact kit.

Every model is labelled "Educational rendering from published dimensions" until it is built from manufacturer CAD.

## Documents

| Id      | Document                                                                          | Number                                 | Publisher                                                        | Market        | Date       | Basis for the date                                                                               | Pages          |
| ------- | --------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------ | -------------- |
| S-US    | Mini-Thoracoscopy Set for single-port medical thoracoscopy                        | 2323-07.01-0624USA                     | Richard Wolf Medical Instruments Corporation                     | US            | 2024-06    | The 0624 in the document number. The file was created on 2024-08-13.                             | 2              |
| S-INT   | Mini Thoracoscopy Set for Single Port Technique                                   | B779en021221                           | Richard Wolf GmbH                                                | International | 2021-12    | The file was created on 2021-12-02.                                                              | 2              |
| S-CAT   | Bronchoscopy / Thoracoscopy / Mediastinoscopy catalogue, chapter 3: Thoracoscopy  | VI25, as printed in the page margin    | Richard Wolf GmbH                                                | International | 2025-10    | The file was created on 2025-10-22.                                                              | 122            |
| S-ERA   | ERAGONmodular mini 3.5 mm: comprehensive instrument solutions for minilaparoscopy | 1094-07.03-0622USA, from the file name | Richard Wolf Medical Instruments Corporation                     | US            | 2022-06    | The 0622 in the file name. The file was created on 2023-04-04.                                   | 8              |
| S-GUDID | AccessGUDID, full delimited release                                               | Release of 2026-07-23                  | US Food and Drug Administration and National Library of Medicine | US            | 2026-07-23 | The release date. Each record is cited by its primary device identifier and public version date. | Not applicable |

## Devices

### Operative telescope, 5.5 mm, with a 3.5 mm working channel

Product numbers: `8920.401` (telescope; US and International), `89204015` (bundle; US), `8920.4011` (bundle; International)

Modelled, and loaded by the week-4 pages.

| Item                                            | Value     | Kind of claim                  | Status           | Read in                                                                                                   | Fact check   | Note                                                                                                                      |
| ----------------------------------------------- | --------- | ------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Direction of view                               | 0°        | device fact                    | review pending   | S-US, page 2; S-CAT, page 43; S-INT, page 2; S-GUDID, device 04055207022092, public version of 2024-11-21 | NOT REVIEWED |                                                                                                                           |
| Shaft outer diameter                            | 5.5 mm    | device fact                    | review pending   | S-US, page 2; S-CAT, page 43; S-GUDID, device 04055207022092, public version of 2024-11-21                | NOT REVIEWED |                                                                                                                           |
| Shaft length                                    | 215 mm    | device fact                    | review pending   | S-US, page 2; S-CAT, page 43; S-GUDID, device 04055207022092, public version of 2024-11-21                | NOT REVIEWED | The shaft only. The body and the side eyepiece have their own anchors.                                                    |
| Total length                                    | 370 mm    | device fact                    | review pending   | S-CAT, page 43; S-GUDID, device 04055207022092, public version of 2024-11-21                              | NOT REVIEWED |                                                                                                                           |
| Working channel diameter                        | 3.5 mm    | device fact                    | review pending   | S-US, page 2; S-CAT, page 43; S-GUDID, device 04055207022092, public version of 2024-11-21                | NOT REVIEWED |                                                                                                                           |
| Eyepiece                                        | lateral   | device fact                    | review pending   | S-GUDID, device 04055207022092, public version of 2024-11-21                                              | NOT REVIEWED |                                                                                                                           |
| Automatic valve, inner diameter                 | 5.7 mm    | device fact                    | review pending   | S-US, page 2; S-CAT, page 42; S-GUDID, device 04055207022085, public version of 2024-11-26                | NOT REVIEWED | Part 8920.311.                                                                                                            |
| Sealing membrane diameter                       | 17 mm     | device fact                    | review pending   | S-US, page 2; S-CAT, page 42; S-INT, page 2                                                               | NOT REVIEWED | Part 89.103.                                                                                                              |
| How the image is carried                        | Not known | device fact                    | unresolved input | S-INT, page 2; S-GUDID, device 04055207022092, public version of 2024-11-21                               | NOT REVIEWED | Manufacturer documents differ on this. Nothing about the optics is taught until the manufacturer confirms it.             |
| Sealing cap supplied with the bundle            | Not known | device fact                    | unresolved input | S-US, page 2; S-CAT, page 42; S-INT, page 2                                                               | NOT REVIEWED | The US and international bundles list different sealing caps.                                                             |
| Field of view                                   | Not known | authored simulation assumption | unresolved input | None                                                                                                      | NOT REVIEWED | Not published in any document read. Until the manufacturer supplies it, the view uses an authored value, labelled as one. |
| Position of the optic on the distal face        | Not known | derived measurement            | unresolved input | None                                                                                                      | NOT REVIEWED | To be measured from a reference frame of the tip.                                                                         |
| Position of the channel exit on the distal face | Not known | derived measurement            | unresolved input | None                                                                                                      | NOT REVIEWED | To be measured from a reference frame of the tip.                                                                         |
| Length of the working channel, entry to exit    | Not known | derived measurement            | unresolved input | None                                                                                                      | NOT REVIEWED | To be measured from the side view. It sets how far a tool can reach beyond the tip.                                       |
| Angle of the eyepiece to the shaft              | Not known | derived measurement            | unresolved input | None                                                                                                      | NOT REVIEWED | To be measured from the side view.                                                                                        |

### Trocar sleeve, flexible, straight, with rubber cap

Product numbers: `8906.051` (sleeve; US and International)

Modelled, and loaded by the week-4 pages.

| Item                           | Value                                                                | Kind of claim       | Status           | Read in                                                                                                    | Fact check   | Note                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------- | ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| Capacity                       | 5.7 mm                                                               | device fact         | review pending   | S-US, page 2; S-CAT, page 42; S-CAT, page 50; S-GUDID, device 04055207021835, public version of 2024-11-21 | NOT REVIEWED |                                                                                                               |
| Working length                 | 60 mm                                                                | device fact         | unresolved input | S-US, page 2; S-CAT, page 42; S-CAT, page 50; S-GUDID, device 04055207021835, public version of 2024-11-21 | NOT REVIEWED | Manufacturer documents differ on this value. The value given is the one in the US documents.                  |
| Construction                   | flexible plastic sheath with thread, distal tip straight, rubber cap | device fact         | review pending   | S-GUDID, device 04055207021835, public version of 2024-11-21; S-CAT, page 50                               | NOT REVIEWED |                                                                                                               |
| Outer diameter over the thread | Not known                                                            | derived measurement | unresolved input | None                                                                                                       | NOT REVIEWED | Not published. To be measured from a reference frame. It decides how far the scope can tilt between two ribs. |

### Trocar for the flexible sleeve

Product numbers: `8906.151` (trocar; US and International)

Modelled.

| Item           | Value         | Kind of claim | Status         | Read in                                                                                    | Fact check   | Note |
| -------------- | ------------- | ------------- | -------------- | ------------------------------------------------------------------------------------------ | ------------ | ---- |
| Size           | 5.5 mm        | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-GUDID, device 04055207021880, public version of 2024-11-21 | NOT REVIEWED |      |
| Working length | 83 mm         | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-GUDID, device 04055207021880, public version of 2024-11-21 | NOT REVIEWED |      |
| Tip            | rounded, dull | device fact   | review pending | S-US, page 2; S-GUDID, device 04055207021880, public version of 2024-11-21                 | NOT REVIEWED |      |

### Trocar sleeve, straight, with membrane valve and insufflation valve

Product numbers: `8919.333` (sleeve; US)

Modelled.

| Item                           | Value                                                                                        | Kind of claim       | Status           | Read in                                                                                    | Fact check   | Note                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------- |
| Capacity                       | 5.5 mm                                                                                       | device fact         | review pending   | S-US, page 2; S-CAT, page 49; S-GUDID, device 04055207021996, public version of 2024-11-21 | NOT REVIEWED |                                                       |
| Working length                 | 62 mm                                                                                        | device fact         | review pending   | S-US, page 2; S-CAT, page 49; S-GUDID, device 04055207021996, public version of 2024-11-21 | NOT REVIEWED |                                                       |
| Construction                   | flexible plastic sheath with thread, distal tip straight, membrane valve, insufflation valve | device fact         | review pending   | S-GUDID, device 04055207021996, public version of 2024-11-21                               | NOT REVIEWED |                                                       |
| Outer diameter over the thread | Not known                                                                                    | derived measurement | unresolved input | None                                                                                       | NOT REVIEWED | Not published. To be measured from a reference frame. |

### Trocar for the sleeve with valves

Product numbers: `8919.3311` (trocar; US)

Modelled.

| Item           | Value         | Kind of claim | Status         | Read in                                                                                    | Fact check   | Note |
| -------------- | ------------- | ------------- | -------------- | ------------------------------------------------------------------------------------------ | ------------ | ---- |
| Size           | 5.5 mm        | device fact   | review pending | S-US, page 2; S-GUDID, device 04055207028735, public version of 2024-11-21                 | NOT REVIEWED |      |
| Working length | 104 mm        | device fact   | review pending | S-US, page 2; S-CAT, page 49; S-GUDID, device 04055207028735, public version of 2024-11-21 | NOT REVIEWED |      |
| Tip            | rounded, dull | device fact   | review pending | S-US, page 2; S-GUDID, device 04055207028735, public version of 2024-11-21                 | NOT REVIEWED |      |

### Double-spoon forceps, monopolar, 3.5 mm

Product numbers: `83912167` (bundle; US and International), `8391216` (jaw insert; US and International), `8391933` (insulated sheath tube; US and International), `83930074` (handle, pistol shaped, with lock; US and International)

Modelled, and loaded by the week-4 pages.

| Item                          | Value         | Kind of claim       | Status           | Read in                                                                                   | Fact check   | Note                                                                                         |
| ----------------------------- | ------------- | ------------------- | ---------------- | ----------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Shaft outer diameter          | 3.5 mm        | device fact         | review pending   | S-US, page 2; S-ERA, page 5; S-GUDID, device 04055207062562, public version of 2024-11-21 | NOT REVIEWED |                                                                                              |
| Sheath length                 | 330 mm        | device fact         | review pending   | S-US, page 2; S-INT, page 2; S-GUDID, device 04055207015636, public version of 2024-11-21 | NOT REVIEWED |                                                                                              |
| Jaw length                    | 12 mm         | device fact         | review pending   | S-GUDID, device 04055207042168, public version of 2024-11-21                              | NOT REVIEWED |                                                                                              |
| Jaw action                    | double action | device fact         | review pending   | S-GUDID, device 04055207042168, public version of 2024-11-21                              | NOT REVIEWED |                                                                                              |
| Energy                        | monopolar     | device fact         | review pending   | S-US, page 2; S-GUDID, device 04055207026625, public version of 2024-11-21                | NOT REVIEWED | Energy settings are never authored. They follow the instructions for use and local protocol. |
| Jaw opening angle, fully open | Not known     | derived measurement | unresolved input | None                                                                                      | NOT REVIEWED | To be measured from a reference frame.                                                       |

### Dissection forceps, monopolar, 3.5 mm

Product numbers: `83912227` (bundle; US), `8391222` (jaw insert; US), `8391933` (insulated sheath tube; US and International), `83930074` (handle, pistol shaped, with lock; US and International)

Modelled.

| Item                 | Value         | Kind of claim | Status         | Read in                                                                                   | Fact check   | Note |
| -------------------- | ------------- | ------------- | -------------- | ----------------------------------------------------------------------------------------- | ------------ | ---- |
| Shaft outer diameter | 3.5 mm        | device fact   | review pending | S-US, page 2; S-ERA, page 5; S-GUDID, device 04055207062500, public version of 2024-11-21 | NOT REVIEWED |      |
| Sheath length        | 330 mm        | device fact   | review pending | S-US, page 2; S-GUDID, device 04055207015636, public version of 2024-11-21                | NOT REVIEWED |      |
| Jaw length           | 14 mm         | device fact   | review pending | S-GUDID, device 04055207042229, public version of 2024-11-21                              | NOT REVIEWED |      |
| Jaw action           | double action | device fact   | review pending | S-GUDID, device 04055207042229, public version of 2024-11-21                              | NOT REVIEWED |      |

### Hook electrode, monopolar, 3.5 mm

Product numbers: `8379.452` (electrode; US and International)

Modelled.

| Item                 | Value  | Kind of claim | Status         | Read in                                                                                                                  | Fact check   | Note |
| -------------------- | ------ | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | ---- |
| Shaft outer diameter | 3.5 mm | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-INT, page 2; S-ERA, page 8; S-GUDID, device 04055207014936, public version of 2024-11-21 | NOT REVIEWED |      |
| Working length       | 310 mm | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-INT, page 2; S-ERA, page 8; S-GUDID, device 04055207014936, public version of 2024-11-21 | NOT REVIEWED |      |

### Coagulation electrode, button, monopolar, 3.5 mm

Product numbers: `8379.462` (electrode; US and International)

Modelled.

| Item                 | Value  | Kind of claim | Status         | Read in                                                                                                                  | Fact check   | Note |
| -------------------- | ------ | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | ---- |
| Shaft outer diameter | 3.5 mm | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-INT, page 2; S-ERA, page 8; S-GUDID, device 04055207014943, public version of 2024-11-21 | NOT REVIEWED |      |
| Working length       | 310 mm | device fact   | review pending | S-US, page 2; S-CAT, page 42; S-INT, page 2; S-ERA, page 8; S-GUDID, device 04055207014943, public version of 2024-11-21 | NOT REVIEWED |      |

### Probe, graduated, 3.5 mm

Product numbers: `8379.672` (probe; US and International)

Modelled.

| Item                         | Value     | Kind of claim       | Status           | Read in                                                                                   | Fact check   | Note                                                                                         |
| ---------------------------- | --------- | ------------------- | ---------------- | ----------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Shaft outer diameter         | 3.5 mm    | device fact         | review pending   | S-US, page 2; S-ERA, page 8; S-GUDID, device 04055207014967, public version of 2025-01-08 | NOT REVIEWED |                                                                                              |
| Working length               | 250 mm    | device fact         | unresolved input | S-US, page 2; S-ERA, page 8; S-GUDID, device 04055207014967, public version of 2025-01-08 | NOT REVIEWED | Manufacturer documents differ on this value. The value given is the one in the US documents. |
| Interval between graduations | Not known | derived measurement | unresolved input | None                                                                                      | NOT REVIEWED | Not published. To be measured from a reference frame.                                        |

### Suction tube

Product numbers: `8380.68` (suction tube; US and International)

Modelled.

| Item           | Value  | Kind of claim | Status           | Read in                                                                                                   | Fact check   | Note                                                                                         |
| -------------- | ------ | ------------- | ---------------- | --------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Outer diameter | 2.8 mm | device fact   | unresolved input | S-US, page 2; S-CAT, page 42; S-GUDID, device 04055207040041, public version of 2024-11-21                | NOT REVIEWED | Manufacturer documents differ on this value. The value given is the one in the US documents. |
| Working length | 450 mm | device fact   | review pending   | S-US, page 2; S-CAT, page 42; S-INT, page 2; S-GUDID, device 04055207040041, public version of 2024-11-21 | NOT REVIEWED |                                                                                              |

### Fibre light cable

Product numbers: `806625301` (bundle; US), `80662530` (cable; US), `8095.07` (adapter, projector side; US and International), `809509` (adapter, endoscope side; US and International)

Not modelled in the first round.

| Item         | Value   | Kind of claim | Status           | Read in                                                                    | Fact check   | Note                                                                                         |
| ------------ | ------- | ------------- | ---------------- | -------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Diameter     | 2.5 mm  | device fact   | unresolved input | S-US, page 2; S-GUDID, device 04055207026328, public version of 2026-05-18 | NOT REVIEWED | Manufacturer documents differ on this value. The value given is the one in the US documents. |
| Total length | 3000 mm | device fact   | unresolved input | S-US, page 2; S-GUDID, device 04055207026328, public version of 2026-05-18 | NOT REVIEWED | Manufacturer documents differ on this value. The value given is the one in the US documents. |

### ENDOCAM Logic 4K camera control unit

Product numbers: `5525301` (camera control unit; US and International), `55253011` (bundle; International)

Not modelled in the first round.

| Item                                   | Value     | Kind of claim | Status           | Read in                                                                     | Fact check   | Note                                                                                                                                                                                               |
| -------------------------------------- | --------- | ------------- | ---------------- | --------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tower configuration used with this set | Not known | device fact   | unresolved input | S-CAT, page 4; S-GUDID, device 04055207063286, public version of 2025-12-12 | NOT REVIEWED | Which camera head, light source, monitor and cables are used with this telescope, and how each connects, has not been established from a document. No reference images of the tower were supplied. |

### Talc delivery

Product numbers: None

Not modelled in the first round.

| Item            | Value               | Kind of claim | Status         | Read in        | Fact check   | Note                                                                                                                                                     |
| --------------- | ------------------- | ------------- | -------------- | -------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who supplies it | not part of the set | device fact   | review pending | S-CAT, page 42 | NOT REVIEWED | The catalogue says suitable pleurodesis sets are available on the market. Any talc delivery shown in the course is a generic model and names no product. |

## Fit

A dimensional comparison is shown beside each entry. It is never the basis for the status.

| Combination                                                                                                                | Market | Status                | Basis                                                                                             | Read in      | Dimensional comparison                                                                           | Fact check   |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- | ------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ | ------------ |
| operative-telescope + trocar-sleeve-flexible                                                                               | US     | documented compatible | Listed together as one set, whose instruments the sell sheet describes as compatible.             | S-US, page 2 | Shaft 5.5 mm, sleeve capacity 5.7 mm.                                                            | NOT REVIEWED |
| operative-telescope + trocar-sleeve-with-valves                                                                            | US     | documented compatible | Listed together as one set, whose instruments the sell sheet describes as compatible.             | S-US, page 2 | Shaft 5.5 mm, sleeve capacity 5.5 mm. The two published values are equal.                        | NOT REVIEWED |
| operative-telescope + double-spoon-forceps + dissection-forceps + hook-electrode + button-electrode + probe + suction-tube | US     | documented compatible | Listed together as one set, whose instruments the sell sheet describes as compatible.             | S-US, page 2 | Tools 3.5 mm or 2.8 mm, channel 3.5 mm. For the 3.5 mm tools the two published values are equal. | NOT REVIEWED |
| operative-telescope + camera-control-unit + light-cable                                                                    | US     | not established       | No document read describes the camera head, light source or connections used with this telescope. | None         | None                                                                                             | NOT REVIEWED |

## Needed and not known

| Device                                                              | Item                                            | Kind of claim                  | Needed by                                              | Note                                                                                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | How the image is carried                        | device fact                    | the-instrument                                         | Manufacturer documents differ on this. Nothing about the optics is taught until the manufacturer confirms it.                                                                                      |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Sealing cap supplied with the bundle            | device fact                    | the-instrument                                         | The US and international bundles list different sealing caps.                                                                                                                                      |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Field of view                                   | authored simulation assumption | normal-pleural-space, four-controls, systematic-survey | Not published in any document read. Until the manufacturer supplies it, the view uses an authored value, labelled as one.                                                                          |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Position of the optic on the distal face        | derived measurement            | four-controls, systematic-survey                       | To be measured from a reference frame of the tip.                                                                                                                                                  |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Position of the channel exit on the distal face | derived measurement            | taking-biopsies                                        | To be measured from a reference frame of the tip.                                                                                                                                                  |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Length of the working channel, entry to exit    | derived measurement            | taking-biopsies                                        | To be measured from the side view. It sets how far a tool can reach beyond the tip.                                                                                                                |
| Operative telescope, 5.5 mm, with a 3.5 mm working channel          | Angle of the eyepiece to the shaft              | derived measurement            | the-instrument                                         | To be measured from the side view.                                                                                                                                                                 |
| Trocar sleeve, flexible, straight, with rubber cap                  | Outer diameter over the thread                  | derived measurement            | four-controls, choosing-the-port, systematic-survey    | Not published. To be measured from a reference frame. It decides how far the scope can tilt between two ribs.                                                                                      |
| Trocar sleeve, straight, with membrane valve and insufflation valve | Outer diameter over the thread                  | derived measurement            | the-instrument                                         | Not published. To be measured from a reference frame.                                                                                                                                              |
| Double-spoon forceps, monopolar, 3.5 mm                             | Jaw opening angle, fully open                   | derived measurement            | taking-biopsies                                        | To be measured from a reference frame.                                                                                                                                                             |
| Probe, graduated, 3.5 mm                                            | Interval between graduations                    | derived measurement            | the-instrument                                         | Not published. To be measured from a reference frame.                                                                                                                                              |
| ENDOCAM Logic 4K camera control unit                                | Tower configuration used with this set          | device fact                    | room-and-tower                                         | Which camera head, light source, monitor and cables are used with this telescope, and how each connects, has not been established from a document. No reference images of the tower were supplied. |

This does not change publication status or constitute clinical approval.
