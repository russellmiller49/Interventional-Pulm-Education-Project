# Medical Thoracoscopy — attribution

The repository's MIT licence covers its code. It does not cover the material below, which is used
under its own terms.

## Anatomy

The module's anatomical surfaces are derived from one CT scan, asserted to be case 19 of the
AeroPath dataset. **That identity has not been verified against the archive.**

|              |                                                                                                                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataset      | Hofstad E, Bouget D, Pedersen A, Støverud K-H, Langø T, Leira HO. _AeroPath: An airway segmentation benchmark dataset with challenging pathology._ Zenodo; 2023, version 1. <https://doi.org/10.5281/zenodo.10069289>                                                                                                             |
| Described in | Støverud KH, Bouget D, Pedersen A, et al. AeroPath: An airway segmentation benchmark dataset with challenging pathology and baseline method. _PLoS One._ 2024;19(10):e0311416. <https://doi.org/10.1371/journal.pone.0311416>                                                                                                     |
| Licence      | Creative Commons Attribution 4.0 International. <https://creativecommons.org/licenses/by/4.0/>                                                                                                                                                                                                                                    |
| Changes      | The material was modified. Surfaces were built from a segmentation of the scan, remeshed or simplified, divided into named regions and, for the lung, reshaped into authored states. The scan was taken with the patient lying on their back and is shown with the patient lying on their side. Nothing shown is the scan itself. |

The dataset's authors did not take part in this module and do not endorse it.

### What travels with each file

Every anatomy file the module serves carries this credit, the licence address and the statement
that the material was modified: in the asset manifest, inside the file, on the course's Reference
page and in the caption of each scene that shows it.

### What is not settled

- Whether the scan is the case it is asserted to be.
- Which tools produced the segmentation, and on what terms. The segmentation file names
  TotalSegmentator and MONAI Auto3DSeg.

Until both are settled, no anatomy file is uploaded or published. See the
[rights register](registers/rights-register.json).

## Instruments

The instrument models are original work, built for this module from published dimensions and from
measurements. They carry no manufacturer logo or wordmark, and are labelled "Educational
rendering from published dimensions" wherever they are shown.

Richard Wolf, ERAGON, PANOVIEW, ENDOCAM and ENDOLIGHT are names used by Richard Wolf GmbH and its
affiliates for their products. They appear here in plain text to identify those products. The
manufacturer has not supplied a trademark attribution format; when it does, this page follows it.

Manufacturer documents and images are not reproduced. Facts are cited with the document and page
they were read on, in the [device register](registers/device-register.md).

## Literature

Articles are cited, not reproduced. See the [source register](registers/source-register.md).
