#!/usr/bin/env python3
"""Attach anatomical names without resampling, moving or rewriting any CT image.

The selected source polylines must exactly match the existing labeled case.
Textbook-guided subsegment/common-trunk assignments are explicit authoring data,
never inferred automatically from edge order, graph depth or screen position.
"""
import hashlib
import json
import math
from pathlib import Path
import subprocess


def read_verified(root, path, expected):
    raw = (root / path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected, f'Changed source: {path}'
    return json.loads(raw)


def segment_distance(point, a, b):
    vector = [y - x for x, y in zip(a, b)]
    squared = sum(v * v for v in vector)
    fraction = max(0, min(1, sum((p - x) * v for p, x, v in zip(point, a, vector)) / squared)) if squared else 0
    return math.dist(point, [x + fraction * v for x, v in zip(a, vector)])


def annotate(manifest, root):
    author = json.loads((root / 'scripts/branch-tracing/authoring/ct-traces.json').read_text())
    names = json.loads((root / 'scripts/branch-tracing/authoring/airway-nomenclature.json').read_text())
    graph = read_verified(root, 'public/fluoroview/cases/patient-new/metadata/airway_graph.json', author['graphSha256'])
    labeled = read_verified(root, names['graphPath'], names['graphSha256'])
    labels = read_verified(root, names['labelsPath'], names['labelsSha256'])
    edges = {e['id']: e for e in graph['edges']}
    labeled_edges = {e['id']: e for e in labeled['edges']}
    specs = {t['id']: t for t in author['traces']}
    assert manifest['sourceSha256'] == author['sourceSha256']
    assert manifest['sourceGraphSha256'] == author['graphSha256']

    def airway(edge_id):
        assignment = names['edges'][str(edge_id)]
        if assignment.get('existingLabel'):
            assert labels['edgeLabels'][str(edge_id)]['abbreviatedLabel'] == assignment['existingLabel']
        return names['airways'][assignment['airway']]

    for trace in manifest['traces']:
        spec = specs[trace['id']]
        parts = [edges[i] for i in spec['edges']]
        for edge in parts:
            other = labeled_edges[edge['id']]
            for field in ['pointsLps', 'startNodeId', 'endNodeId']:
                assert edge[field] == other[field], f'Case geometry mismatch at edge {edge["id"]}'
        route = []
        for edge in parts:
            label = airway(edge['id'])
            if not route or label['code'] != route[-1]['code']:
                route.append(label)
        trace['airwayPath'] = route
        # Locate the start in the same continuous polyline as the native exporter.
        distance = spec['trimStartMm']
        anchor_edge = parts[-1]['id']
        for edge in parts:
            length = sum(math.dist(a, b) for a, b in zip(edge['pointsLps'], edge['pointsLps'][1:]))
            if distance <= length:
                anchor_edge = edge['id']
                break
            distance -= length
        trace['anchor'].update(sourceEdgeId=anchor_edge, airway=airway(anchor_edge))
        for point in trace['checkpoints']:
            error, edge_id = min(
                (segment_distance(point['lps'], a, b), e['id'])
                for e in parts for a, b in zip(e['pointsLps'], e['pointsLps'][1:])
            )
            assert error < .0001, f'Checkpoint does not lie on its source route: {trace["id"]}'
            point.update(sourceEdgeId=edge_id, airway=airway(edge_id), landmark='')
        for point in trace['checkpoints']:
            repeated = [p for p in trace['checkpoints'] if p['airway']['code'] == point['airway']['code']]
            if len(repeated) > 1:
                # Positional qualifiers are relative to the sampled route, not new bronchial names.
                point['landmark'] = ['Proximal', 'Distal'][repeated.index(point)] if len(repeated) == 2 else ['Proximal', 'Midportion', 'Distal'][repeated.index(point)]
    manifest['nomenclature'] = {
        'version': names['version'], 'reference': names['reference'],
        'sourceLabelsSha256': names['labelsSha256'], 'sourceLabeledGraphSha256': names['graphSha256'],
        'correspondence': 'All selected complete LPS polylines and node connections match the existing labeled case exactly.',
        'method': 'Existing segment labels, parent/daughter topology and textbook figures; explicit anatomical assignments documented in authoring/airway-nomenclature.json. No finer suffix inferred from graph depth.',
    }
    return manifest


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    path = root / 'public/branch-tracing/native-v1/manifest.json'
    result = annotate(json.loads(path.read_text()), root)
    formatted = subprocess.run([str(root / 'node_modules/.bin/prettier'), '--stdin-filepath', str(path)], input=json.dumps(result).encode(), stdout=subprocess.PIPE, check=True, cwd=root).stdout
    path.write_bytes(formatted)
    print(f'Annotated {len(result["traces"])} routes and {sum(len(t["checkpoints"]) for t in result["traces"])} checkpoints; CT pixels and coordinates unchanged.')
