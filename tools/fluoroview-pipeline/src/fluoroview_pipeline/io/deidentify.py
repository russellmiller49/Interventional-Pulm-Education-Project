"""Conservative DICOM metadata filtering for educational asset generation."""

from __future__ import annotations

PHI_KEYWORDS = {
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientSex",
    "AccessionNumber",
    "InstitutionName",
    "InstitutionAddress",
    "ReferringPhysicianName",
    "StudyDescription",
    "SeriesDescription",
    "OperatorsName",
}

SAFE_METADATA_KEYS = {
    "Modality",
    "Rows",
    "Columns",
    "PixelSpacing",
    "SliceThickness",
    "SpacingBetweenSlices",
    "ImageOrientationPatient",
    "RescaleSlope",
    "RescaleIntercept",
    "KVP",
}


def safe_dicom_metadata(dataset: object) -> dict[str, object]:
    """Return only non-identifying geometry/acquisition metadata."""

    safe: dict[str, object] = {}
    for key in SAFE_METADATA_KEYS:
        if hasattr(dataset, key):
            value = getattr(dataset, key)
            if hasattr(value, "__iter__") and not isinstance(value, (str, bytes)):
                safe[key] = [float(v) if _is_number_like(v) else str(v) for v in value]
            elif _is_number_like(value):
                safe[key] = float(value)
            else:
                safe[key] = str(value)
    return safe


def scrub_dataset_in_place(dataset: object) -> object:
    """Remove common PHI fields from a pydicom dataset.

    This helper is conservative and not a regulatory deidentification claim.
    """

    for key in PHI_KEYWORDS:
        if hasattr(dataset, key):
            delattr(dataset, key)
    return dataset


def _is_number_like(value: object) -> bool:
    try:
        float(value)  # type: ignore[arg-type]
        return True
    except (TypeError, ValueError):
        return False

