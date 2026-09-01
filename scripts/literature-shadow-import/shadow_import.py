#!/usr/bin/env python3
"""Validate and prepare AI/ML literature shadow imports without remote writes."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sqlite3
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Iterator


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / "config/literature/shadow-atlas-v1.json"
MANIFEST_SCHEMA = "literature-shadow-prepared-import/1.0.0"
PREPARED_FILES = frozenset(
    {"runs.csv", "classifications.csv", "enhancements.csv", "terms.csv"}
)

RUN_FIELDS = (
    "run_key",
    "source_kind",
    "source_repository",
    "source_release_tag",
    "source_artifact_sha256",
    "model_key",
    "model_metadata",
    "status",
    "classification_count",
    "enhancement_count",
    "term_count",
    "class_counts",
    "zone_counts",
)
CLASSIFICATION_FIELDS = (
    "run_key",
    "pmid",
    "source_title",
    "source_journal",
    "source_publication_year",
    "predicted_relevance",
    "predicted_confidence",
    "inclusion_probability",
    "decision_zone",
    "predicted_category",
    "predicted_category_probability",
    "review_priority",
    "display_summary",
    "classifier_payload",
)
ENHANCEMENT_FIELDS = (
    "run_key",
    "pmid",
    "enhanced_display_summary",
    "enhanced_study_design",
    "primary_topic",
    "primary_technology",
    "primary_disease",
    "primary_clinical_purpose",
    "evidence_category",
    "metadata_confidence",
    "manual_review_priority",
    "proposed_relevance",
    "reclassification_action",
    "enhancement_payload",
)
TERM_FIELDS = (
    "run_key",
    "pmid",
    "facet",
    "term",
    "ordinal",
    "source_field",
    "source_kind",
)


class ShadowImportError(RuntimeError):
    """Raised when a source or prepared import violates the frozen contract."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_config(path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ShadowImportError(f"cannot read source lock: {error}") from error
    if value.get("schemaVersion") != "literature-shadow-atlas-source/1.0.0":
        raise ShadowImportError("source lock schema version drifted")
    return value


def open_read_only_sqlite(path: Path) -> sqlite3.Connection:
    if path.is_symlink() or not path.is_file():
        raise ShadowImportError(
            f"SQLite source is missing or not a regular file: {path}"
        )
    connection = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def scalar(connection: sqlite3.Connection, statement: str) -> Any:
    row = connection.execute(statement).fetchone()
    return row[0] if row else None


def inspect_atlas(
    path: Path, config: dict[str, Any], enforce_digest: bool = True
) -> dict[str, Any]:
    conference = config["conferenceProjection"]
    digest = sha256_file(path)
    if enforce_digest and digest != conference["sqliteSha256"]:
        raise ShadowImportError(
            "SQLite SHA-256 does not match the pinned conference runtime"
        )
    with open_read_only_sqlite(path) as connection:
        quick_check = scalar(connection, "pragma quick_check")
        if quick_check != "ok":
            raise ShadowImportError(f"SQLite quick_check failed: {quick_check}")
        counts = {
            "articleCount": scalar(connection, "select count(*) from classifications"),
            "enhancementCount": scalar(
                connection, "select count(*) from article_effective_enhancements"
            ),
            "termCount": scalar(
                connection, "select count(*) from all_article_enhancement_terms"
            ),
        }
        class_counts = dict(
            connection.execute(
                "select relevance_class, count(*) from classifications group by relevance_class"
            ).fetchall()
        )
    for key, actual in counts.items():
        if actual != conference[key]:
            raise ShadowImportError(
                f"pinned {key} drifted: expected {conference[key]}, got {actual}"
            )
    if class_counts != conference["classCounts"]:
        raise ShadowImportError("conference classification counts drifted")
    return {"sha256": digest, **counts, "classCounts": class_counts}


def json_value(raw: Any) -> Any:
    if raw is None or raw == "":
        return None
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as error:
            raise ShadowImportError(
                "source database contains malformed JSON"
            ) from error
    return raw


def atomic_csv(
    path: Path, fields: tuple[str, ...], rows: Iterable[dict[str, Any]]
) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".writing", dir=path.parent
    )
    count = 0
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="raise")
            writer.writeheader()
            for row in rows:
                writer.writerow({field: row.get(field, "") for field in fields})
                count += 1
        os.replace(temporary_name, path)
    finally:
        temporary = Path(temporary_name)
        if temporary.exists():
            temporary.unlink()
    return count


def ensure_empty_destination(path: Path) -> None:
    if path.is_symlink():
        raise ShadowImportError(f"prepared destination must not be a symlink: {path}")
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ShadowImportError(f"prepared destination must be absent or empty: {path}")
    path.mkdir(parents=True, exist_ok=True)


def classification_rows(
    connection: sqlite3.Connection, run_key: str
) -> Iterator[dict[str, Any]]:
    statement = """
      select a.pmid, a.title, a.journal, a.publication_year,
             c.relevance_class, c.relevance_confidence, c.topic_ids_json,
             c.clinical_purposes_json, c.disease_tags_json, c.technology_tags_json,
             c.study_design, c.display_summary, c.evidence_basis_json,
             c.reason_codes_json, c.inference_provenance_json
      from articles as a
      join classifications as c on c.pmid = a.pmid
      order by a.source_ordinal
    """
    for row in connection.execute(statement):
        payload = {
            "topic_ids": json_value(row["topic_ids_json"]),
            "clinical_purposes": json_value(row["clinical_purposes_json"]),
            "disease_tags": json_value(row["disease_tags_json"]),
            "technology_tags": json_value(row["technology_tags_json"]),
            "study_design": row["study_design"],
            "evidence_basis": json_value(row["evidence_basis_json"]),
            "reason_codes": json_value(row["reason_codes_json"]),
            "inference_provenance": json_value(row["inference_provenance_json"]),
        }
        yield {
            "run_key": run_key,
            "pmid": row["pmid"],
            "source_title": row["title"],
            "source_journal": row["journal"] or "",
            "source_publication_year": row["publication_year"],
            "predicted_relevance": row["relevance_class"],
            "predicted_confidence": row["relevance_confidence"],
            "inclusion_probability": "",
            "decision_zone": "conference_projection",
            "predicted_category": "",
            "predicted_category_probability": "",
            "review_priority": "",
            "display_summary": row["display_summary"],
            "classifier_payload": canonical_json(payload),
        }


def enhancement_rows(
    connection: sqlite3.Connection, run_key: str
) -> Iterator[dict[str, Any]]:
    statement = """
      select e.*,
             coalesce(core.metadata_confidence, adjacent.metadata_confidence) as confidence,
             coalesce(core.manual_review_priority, suggestion.manual_review_priority) as priority,
             suggestion.proposed_relevance, suggestion.reclassification_action
      from article_effective_enhancements as e
      left join article_enhancements as core on core.pmid = e.pmid
      left join adjacent_article_enhancements as adjacent on adjacent.pmid = e.pmid
      left join adjacent_reclassification_suggestions as suggestion on suggestion.pmid = e.pmid
      order by cast(e.pmid as integer), e.pmid
    """
    projected = {
        "pmid",
        "enhanced_display_summary",
        "enhanced_study_design",
        "primary_topic",
        "primary_technology",
        "primary_disease",
        "primary_clinical_purpose",
        "evidence_category",
        "confidence",
        "priority",
        "proposed_relevance",
        "reclassification_action",
    }
    for row in connection.execute(statement):
        payload = {
            key.removesuffix("_json"): json_value(row[key])
            for key in row.keys()
            if key not in projected and key.endswith("_json")
        }
        yield {
            "run_key": run_key,
            "pmid": row["pmid"],
            "enhanced_display_summary": row["enhanced_display_summary"] or "",
            "enhanced_study_design": row["enhanced_study_design"] or "",
            "primary_topic": row["primary_topic"] or "",
            "primary_technology": row["primary_technology"] or "",
            "primary_disease": row["primary_disease"] or "",
            "primary_clinical_purpose": row["primary_clinical_purpose"] or "",
            "evidence_category": row["evidence_category"] or "",
            "metadata_confidence": row["confidence"] or "",
            "manual_review_priority": row["priority"] or "",
            "proposed_relevance": row["proposed_relevance"] or "",
            "reclassification_action": row["reclassification_action"] or "",
            "enhancement_payload": canonical_json(payload),
        }


def term_rows(connection: sqlite3.Connection, run_key: str) -> Iterator[dict[str, Any]]:
    statement = """
      select pmid, field_group, value, ordinal, source_field, source
      from all_article_enhancement_terms
      order by cast(pmid as integer), pmid, field_group, ordinal
    """
    for row in connection.execute(statement):
        yield {
            "run_key": run_key,
            "pmid": row["pmid"],
            "facet": row["field_group"],
            "term": row["value"],
            "ordinal": row["ordinal"],
            "source_field": row["source_field"],
            "source_kind": row["source"],
        }


def artifact_descriptor(path: Path, rows: int) -> dict[str, Any]:
    return {
        "path": path.name,
        "rows": rows,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def finalize_manifest(
    output: Path, run_key: str, source: dict[str, Any], counts: dict[str, int]
) -> None:
    files = {
        name: artifact_descriptor(output / name, count)
        for name, count in (
            ("runs.csv", 1),
            ("classifications.csv", counts["classificationCount"]),
            ("enhancements.csv", counts["enhancementCount"]),
            ("terms.csv", counts["termCount"]),
        )
    }
    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "runKey": run_key,
        "source": source,
        "counts": counts,
        "files": files,
        "remoteApplyAuthorized": False,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def prepare_atlas(sqlite_path: Path, output: Path, config: dict[str, Any]) -> None:
    inspection = inspect_atlas(sqlite_path, config)
    ensure_empty_destination(output)
    source = config["conferenceProjection"]
    run_key = source["runKey"]
    with open_read_only_sqlite(sqlite_path) as connection:
        class_count = atomic_csv(
            output / "classifications.csv",
            CLASSIFICATION_FIELDS,
            classification_rows(connection, run_key),
        )
        enhancement_count = atomic_csv(
            output / "enhancements.csv",
            ENHANCEMENT_FIELDS,
            enhancement_rows(connection, run_key),
        )
        term_count = atomic_csv(
            output / "terms.csv", TERM_FIELDS, term_rows(connection, run_key)
        )
    run = {
        "run_key": run_key,
        "source_kind": "conference_projection",
        "source_repository": config["repository"],
        "source_release_tag": config["releaseTag"],
        "source_artifact_sha256": inspection["sha256"],
        "model_key": "gpt-5.6-luna-conference-projection",
        "model_metadata": canonical_json(
            {
                "projectionId": source["projectionId"],
                "predictionsSha256": source["predictionsSha256"],
            }
        ),
        "status": "prepared",
        "classification_count": class_count,
        "enhancement_count": enhancement_count,
        "term_count": term_count,
        "class_counts": canonical_json(inspection["classCounts"]),
        "zone_counts": canonical_json({"conference_projection": class_count}),
    }
    atomic_csv(output / "runs.csv", RUN_FIELDS, [run])
    counts = {
        "classificationCount": class_count,
        "enhancementCount": enhancement_count,
        "termCount": term_count,
    }
    finalize_manifest(
        output,
        run_key,
        {"kind": "conference_projection", "sqliteSha256": inspection["sha256"]},
        counts,
    )
    verify_prepared(output)


def find_column(headers: list[str], *candidates: str) -> str | None:
    normalized = {
        " ".join(header.strip().casefold().split()): header for header in headers
    }
    return next(
        (
            normalized[name.casefold()]
            for name in candidates
            if name.casefold() in normalized
        ),
        None,
    )


def prepare_ml(scored_csv: Path, output: Path, config: dict[str, Any]) -> None:
    if scored_csv.is_symlink() or not scored_csv.is_file():
        raise ShadowImportError(f"scored CSV is missing: {scored_csv}")
    ensure_empty_destination(output)
    model = config["screeningModel"]
    run_key = model["runKey"]
    class_counts: Counter[str] = Counter()
    zone_counts: Counter[str] = Counter()
    seen: set[str] = set()

    with scored_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        columns = {
            "pmid": find_column(headers, "pmid"),
            "title": find_column(headers, "title", "article title"),
            "journal": find_column(headers, "journal"),
            "year": find_column(headers, "publication year", "publication_year"),
            "probability": find_column(headers, "ml_prob_include"),
            "decision": find_column(headers, "ml_decision"),
            "zone": find_column(headers, "ml_zone"),
            "category": find_column(headers, "ml_pred_category"),
            "category_probability": find_column(headers, "ml_pred_category_prob"),
            "category_top3": find_column(headers, "ml_category_top3"),
        }
        if any(
            columns[key] is None
            for key in ("pmid", "title", "probability", "decision", "zone")
        ):
            raise ShadowImportError(
                "scored CSV lacks a required litscreen output column"
            )

        def rows() -> Iterator[dict[str, Any]]:
            for ordinal, source in enumerate(reader, 2):
                pmid = (source[columns["pmid"]] or "").strip()  # type: ignore[index]
                if not pmid.isdigit() or pmid in seen:
                    raise ShadowImportError(
                        f"invalid or duplicate PMID at scored row {ordinal}"
                    )
                seen.add(pmid)
                probability = float(source[columns["probability"]])  # type: ignore[index]
                if not 0 <= probability <= 1:
                    raise ShadowImportError(
                        f"probability outside [0,1] at scored row {ordinal}"
                    )
                decision = (source[columns["decision"]] or "").strip()  # type: ignore[index]
                zone = (source[columns["zone"]] or "").strip().replace("-", "_")  # type: ignore[index]
                if decision not in {"include", "exclude"} or zone not in {
                    "auto_include",
                    "review",
                    "auto_exclude",
                }:
                    raise ShadowImportError(
                        f"invalid decision or zone at scored row {ordinal}"
                    )
                class_counts[decision] += 1
                zone_counts[zone] += 1
                category = source.get(columns["category"] or "", "").strip()
                category_probability = source.get(
                    columns["category_probability"] or "", ""
                ).strip()
                payload = {
                    "categoryTop3": source.get(
                        columns["category_top3"] or "", ""
                    ).strip(),
                    "scoredRow": ordinal,
                }
                yield {
                    "run_key": run_key,
                    "pmid": pmid,
                    "source_title": source[columns["title"]],  # type: ignore[index]
                    "source_journal": source.get(columns["journal"] or "", ""),
                    "source_publication_year": source.get(columns["year"] or "", ""),
                    "predicted_relevance": decision,
                    "predicted_confidence": "",
                    "inclusion_probability": probability,
                    "decision_zone": zone,
                    "predicted_category": category,
                    "predicted_category_probability": category_probability,
                    "review_priority": "high" if zone == "review" else "",
                    "display_summary": "",
                    "classifier_payload": canonical_json(payload),
                }

        class_count = atomic_csv(
            output / "classifications.csv", CLASSIFICATION_FIELDS, rows()
        )
    atomic_csv(output / "enhancements.csv", ENHANCEMENT_FIELDS, [])
    atomic_csv(output / "terms.csv", TERM_FIELDS, [])
    run = {
        "run_key": run_key,
        "source_kind": "screening_ml",
        "source_repository": config["repository"],
        "source_release_tag": config["releaseTag"],
        "source_artifact_sha256": config["assets"]["screeningMl"]["sha256"],
        "model_key": model["winner"],
        "model_metadata": canonical_json(
            {
                "scoredCsvSha256": sha256_file(scored_csv),
                "lowThreshold": model["lowThreshold"],
                "highThreshold": model["highThreshold"],
            }
        ),
        "status": "prepared",
        "classification_count": class_count,
        "enhancement_count": 0,
        "term_count": 0,
        "class_counts": canonical_json(class_counts),
        "zone_counts": canonical_json(zone_counts),
    }
    atomic_csv(output / "runs.csv", RUN_FIELDS, [run])
    finalize_manifest(
        output,
        run_key,
        {"kind": "screening_ml", "scoredCsvSha256": sha256_file(scored_csv)},
        {"classificationCount": class_count, "enhancementCount": 0, "termCount": 0},
    )
    verify_prepared(output)


def csv_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def verify_prepared(path: Path) -> dict[str, Any]:
    if path.is_symlink() or not path.is_dir():
        raise ShadowImportError(
            f"prepared import is missing or not a real directory: {path}"
        )
    manifest_path = path / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ShadowImportError(f"cannot read prepared manifest: {error}") from error
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA:
        raise ShadowImportError("prepared manifest schema version drifted")
    if manifest.get("remoteApplyAuthorized") is not False:
        raise ShadowImportError(
            "prepared manifest must explicitly withhold remote apply"
        )
    files = manifest.get("files")
    if not isinstance(files, dict) or set(files) != PREPARED_FILES:
        raise ShadowImportError("prepared manifest file inventory drifted")
    counts = manifest.get("counts")
    if not isinstance(counts, dict) or any(
        not isinstance(counts.get(key), int) or counts[key] < 0
        for key in ("classificationCount", "enhancementCount", "termCount")
    ):
        raise ShadowImportError("prepared manifest counts are invalid")
    expected_rows = {
        "runs.csv": 1,
        "classifications.csv": counts["classificationCount"],
        "enhancements.csv": counts["enhancementCount"],
        "terms.csv": counts["termCount"],
    }
    for name, descriptor in files.items():
        if not isinstance(descriptor, dict) or descriptor.get("path") != name:
            raise ShadowImportError(f"prepared artifact descriptor drifted: {name}")
        if descriptor.get("rows") != expected_rows[name]:
            raise ShadowImportError(f"prepared manifest count disagrees with {name}")
        file_path = path / name
        if file_path.is_symlink() or not file_path.is_file():
            raise ShadowImportError(f"prepared artifact is missing: {name}")
        if file_path.stat().st_size != descriptor.get("bytes"):
            raise ShadowImportError(f"prepared byte count drifted: {name}")
        if sha256_file(file_path) != descriptor.get("sha256"):
            raise ShadowImportError(f"prepared SHA-256 drifted: {name}")
        if csv_rows(file_path) != descriptor.get("rows"):
            raise ShadowImportError(f"prepared row count drifted: {name}")
    return manifest


def open_csv_dicts(path: Path, fields: tuple[str, ...]) -> tuple[Any, csv.DictReader]:
    handle = path.open("r", encoding="utf-8", newline="")
    reader = csv.DictReader(handle)
    if tuple(reader.fieldnames or ()) != fields:
        handle.close()
        raise ShadowImportError(f"prepared CSV header drifted: {path.name}")
    return handle, reader


def insert_batches(
    connection: sqlite3.Connection,
    statement: str,
    values: Iterable[tuple[Any, ...]],
    batch_size: int = 2_000,
) -> int:
    batch: list[tuple[Any, ...]] = []
    count = 0
    for value in values:
        batch.append(value)
        if len(batch) == batch_size:
            connection.executemany(statement, batch)
            count += len(batch)
            batch.clear()
    if batch:
        connection.executemany(statement, batch)
        count += len(batch)
    return count


def rehearse_prepared(path: Path) -> dict[str, Any]:
    """Load prepared keys into an ephemeral relational model and validate its run receipt."""

    manifest = verify_prepared(path)
    with tempfile.TemporaryDirectory(
        prefix="literature-shadow-rehearsal-"
    ) as directory:
        rehearsal_database = Path(directory) / "rehearsal.sqlite"
        with sqlite3.connect(rehearsal_database) as connection:
            connection.execute("pragma foreign_keys = on")
            connection.executescript(
                """
                create table runs (
                  run_key text primary key
                );
                create table classifications (
                  run_key text not null references runs(run_key) on delete cascade,
                  pmid text not null,
                  primary key (run_key, pmid)
                );
                create table enhancements (
                  run_key text not null,
                  pmid text not null,
                  primary key (run_key, pmid),
                  foreign key (run_key, pmid)
                    references classifications(run_key, pmid) on delete cascade
                );
                create table terms (
                  run_key text not null,
                  pmid text not null,
                  facet text not null,
                  term text not null,
                  ordinal integer not null check (ordinal >= 0),
                  primary key (run_key, pmid, facet, term),
                  foreign key (run_key, pmid)
                    references enhancements(run_key, pmid) on delete cascade
                );
                """
            )

            runs_handle, runs_reader = open_csv_dicts(path / "runs.csv", RUN_FIELDS)
            try:
                runs = list(runs_reader)
            finally:
                runs_handle.close()
            if len(runs) != 1 or runs[0]["run_key"] != manifest["runKey"]:
                raise ShadowImportError(
                    "prepared import must contain exactly its manifested run"
                )
            run = runs[0]
            connection.execute(
                "insert into runs (run_key) values (?)", (run["run_key"],)
            )

            class_counts: Counter[str] = Counter()
            zone_counts: Counter[str] = Counter()
            classifications_handle, classifications_reader = open_csv_dicts(
                path / "classifications.csv", CLASSIFICATION_FIELDS
            )
            try:

                def classification_keys() -> Iterator[tuple[str, str]]:
                    for row in classifications_reader:
                        if not row["pmid"].isdigit():
                            raise ShadowImportError(
                                "prepared classification contains an invalid PMID"
                            )
                        class_counts[row["predicted_relevance"]] += 1
                        zone_counts[row["decision_zone"]] += 1
                        yield row["run_key"], row["pmid"]

                classification_count = insert_batches(
                    connection,
                    "insert into classifications (run_key, pmid) values (?, ?)",
                    classification_keys(),
                )
            finally:
                classifications_handle.close()

            enhancements_handle, enhancements_reader = open_csv_dicts(
                path / "enhancements.csv", ENHANCEMENT_FIELDS
            )
            try:
                enhancement_count = insert_batches(
                    connection,
                    "insert into enhancements (run_key, pmid) values (?, ?)",
                    ((row["run_key"], row["pmid"]) for row in enhancements_reader),
                )
            finally:
                enhancements_handle.close()

            terms_handle, terms_reader = open_csv_dicts(path / "terms.csv", TERM_FIELDS)
            try:

                def term_keys() -> Iterator[tuple[str, str, str, str, int]]:
                    for row in terms_reader:
                        try:
                            ordinal = int(row["ordinal"])
                        except ValueError as error:
                            raise ShadowImportError(
                                "prepared term contains an invalid ordinal"
                            ) from error
                        yield (
                            row["run_key"],
                            row["pmid"],
                            row["facet"],
                            row["term"],
                            ordinal,
                        )

                term_count = insert_batches(
                    connection,
                    "insert into terms (run_key, pmid, facet, term, ordinal) values (?, ?, ?, ?, ?)",
                    term_keys(),
                )
            finally:
                terms_handle.close()

            counts = {
                "classificationCount": classification_count,
                "enhancementCount": enhancement_count,
                "termCount": term_count,
            }
            if counts != manifest["counts"]:
                raise ShadowImportError(
                    "rehearsed counts do not match the prepared manifest"
                )
            count_keys = (
                ("classification_count", "classificationCount"),
                ("enhancement_count", "enhancementCount"),
                ("term_count", "termCount"),
            )
            if any(
                int(run[key]) != counts[manifest_key]
                for key, manifest_key in count_keys
            ):
                raise ShadowImportError("rehearsed counts do not match the run receipt")
            if json.loads(run["class_counts"]) != dict(class_counts):
                raise ShadowImportError(
                    "rehearsed class distribution does not match the run receipt"
                )
            if json.loads(run["zone_counts"]) != dict(zone_counts):
                raise ShadowImportError(
                    "rehearsed decision zones do not match the run receipt"
                )

            connection.rollback()

    return {
        "runKey": manifest["runKey"],
        "counts": counts,
        "classCounts": dict(class_counts),
        "zoneCounts": dict(zone_counts),
        "relationalIntegrity": "passed",
        "remoteApplyAuthorized": False,
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate")
    validate.add_argument("--sqlite", type=Path, required=True)
    prepare = subparsers.add_parser("prepare")
    prepare.add_argument("--sqlite", type=Path, required=True)
    prepare.add_argument("--output", type=Path, required=True)
    prepare_ml_parser = subparsers.add_parser("prepare-ml")
    prepare_ml_parser.add_argument("--scored-csv", type=Path, required=True)
    prepare_ml_parser.add_argument("--output", type=Path, required=True)
    verify = subparsers.add_parser("verify")
    verify.add_argument("--prepared", type=Path, required=True)
    rehearse = subparsers.add_parser("rehearse")
    rehearse.add_argument("--prepared", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    config = load_config(arguments.config)
    if arguments.command == "validate":
        print(
            json.dumps(
                inspect_atlas(arguments.sqlite, config), indent=2, sort_keys=True
            )
        )
    elif arguments.command == "prepare":
        prepare_atlas(arguments.sqlite, arguments.output, config)
        print(f"prepared conference shadow import: {arguments.output}")
    elif arguments.command == "prepare-ml":
        prepare_ml(arguments.scored_csv, arguments.output, config)
        print(f"prepared screening ML shadow import: {arguments.output}")
    elif arguments.command == "verify":
        manifest = verify_prepared(arguments.prepared)
        print(f"prepared shadow import verified: {manifest['runKey']}")
    else:
        receipt = rehearse_prepared(arguments.prepared)
        print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ShadowImportError, OSError, sqlite3.Error, ValueError) as error:
        raise SystemExit(f"literature shadow import failed: {error}")
