#!/usr/bin/env python3
"""Read-only local asset inventory. No scene, source, or external repository writes."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    'public/airway-anatomy/case-001/case_manifest.json',
    'public/airway-anatomy/case-001/ct/target_clean_ct_preview_i16.raw',
    'public/airway-anatomy/case-001/lumen-v2.glb',
    'public/airway-anatomy/case-001/metadata/airway_graph.json',
    'public/airway-anatomy/case-001/metadata/centerline_labels.json',
    'public/fluoroview/cases/patient-new/case_manifest.json',
    'public/fluoroview/cases/patient-new/ct/ct_preview_uint8.raw',
    'public/fluoroview/cases/patient-new/metadata/airway_graph.json',
    'public/fluoroview/cases/patient-new/airway_segments.glb',
    'public/fluoroview/airway_full.glb',
    'public/airway-lesson/airway-survey-ct.json',
    'new_anatomy_module/labels_cleaned_names.xlsx',
]


def main():
    rows = []
    for name in FILES:
        data = (ROOT / name).read_bytes()
        rows.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    graph = json.loads((ROOT / FILES[3]).read_text())
    labels = json.loads((ROOT / FILES[4]).read_text())['edgeLabels']
    grouped = {}
    for value in labels.values():
        name = value['abbreviatedLabel']
        grouped[name] = grouped.get(name, 0) + 1
    print(json.dumps({
        'siteCommitAtInventory': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'assets': rows, 'case001Nodes': len(graph['nodes']), 'case001Edges': len(graph['edges']),
        'spreadsheetAssociatedEdgeCountsNotReviewedAnatomicalCounts': grouped,
        'clinicalApproval': 'No checkpoint-level physician approval record established by this audit.',
    }, indent=2))


if __name__ == '__main__':
    main()
