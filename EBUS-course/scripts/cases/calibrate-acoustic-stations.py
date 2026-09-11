"""Reconcile relocated station targets with the active airway, using Slicer VTK.

The four demonstrated route mismatches are migrated; all transducer contacts are
reconciled with the active surface. Anatomy is never moved.
The before/after records make these case-specific calibration changes reviewable.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import vtk


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--case-dir', type=Path, required=True)
    args = parser.parse_args()
    root = args.case_dir
    filename = root / 'case_manifest.simplified.web.json'
    manifest = json.loads(filename.read_text())
    lines = {l['line_index']: l for l in json.loads((root / manifest['assets']['centerlines']).read_text())['polylines']}
    airway = json.loads((root / manifest['assets']['airway_mesh']).read_text())
    points = vtk.vtkPoints()
    for p in airway['vertices']:
        points.InsertNextPoint(*p)
    cells = vtk.vtkCellArray()
    for tri in airway['triangles']:
        cells.InsertNextCell(3, tri)
    poly = vtk.vtkPolyData(); poly.SetPoints(points); poly.SetPolys(cells)
    locator = vtk.vtkOBBTree(); locator.SetDataSet(poly); locator.BuildLocator()
    report_path = root / 'geometry/station-calibration-v2.json'
    previous = json.loads(report_path.read_text())['changes'] if report_path.exists() else []
    changes = []
    fields = ['centerline_s_mm', 'contact', 'shaft_axis', 'depth_axis', 'lateral_axis']
    def lps(v):
        return [float(v[0]), float(-v[2]), float(v[1])]
    for preset in manifest['presets']:
        move_route = preset['station'] in ['2l', '2r', '11ri', '11rs']
        line = lines[preset['line_index']]
        lengths, line_points = np.array(line['cumulative_lengths_mm']), np.array(line['points'])
        def point(s):
            return np.array([np.interp(s, lengths, line_points[:, axis]) for axis in range(3)])
        target = np.array(preset['target'])
        samples = np.arange(5, line['total_length_mm']-3, .1)
        s = float(min(samples, key=lambda s: np.linalg.norm(point(s)-target))) if move_route else preset['centerline_s_mm']
        anchor = point(s)
        tangent = point(min(s+5, lengths[-1]))-point(max(0, s-5)) if move_route else np.array(preset['shaft_axis'])
        tangent /= np.linalg.norm(tangent)
        depth = target-anchor if move_route else np.array(preset['depth_axis'])
        depth -= tangent * np.dot(depth, tangent)
        depth /= np.linalg.norm(depth)
        hits = vtk.vtkPoints()
        locator.IntersectWithLine(anchor, anchor+depth*80, hits, None)
        if not hits.GetNumberOfPoints():
            raise RuntimeError(f'No airway contact for {preset["preset_key"]}')
        wall = np.array(hits.GetPoint(0))
        contact = wall - depth*.45
        prior = next((c['before'] for c in previous if c['preset'] == preset['preset_key']), {f:preset[f] for f in fields})
        preset['centerline_s_mm'] = s
        for key, vector in [('contact',contact), ('shaft_axis',tangent), ('depth_axis',depth), ('lateral_axis',np.cross(tangent,depth))]:
            preset[key] = vector.tolist()
            preset[key+'_lps'] = lps(vector)
        preset['contact_to_target_distance_mm'] = float(np.linalg.norm(target-contact))
        changes.append({'preset':preset['preset_key'], 'before':prior, 'after':{f:preset[f] for f in fields},
                        'reason':'Relocated target: nearest contact on its existing route restores the longitudinal scan plane.' if move_route else 'Reconcile the transducer contact with the active airway surface; route position and calibrated axes are preserved.',
                        'targetUnchanged':True, 'wallClearanceMm':.45})
    filename.write_text(json.dumps(manifest, indent=2)+'\n')
    report_path.write_text(json.dumps({'sourceGeometrySha256':manifest['assets']['acoustic_volume']['source_geometry_sha256'],
                                     'method':'Nearest route position, projected scan direction, first active airway surface intersection', 'changes':changes}, indent=2)+'\n')
    print(json.dumps([{'preset':c['preset'],'oldS':c['before']['centerline_s_mm'],'newS':c['after']['centerline_s_mm']} for c in changes]))


if __name__ == '__main__':
    main()
