"""Run in a separate 3D Slicer process. Publish derived meshes and a quantized CT atlas.

IMAGING_SOURCE_DIR points to the existing FluoroView New_patient source folder.
IMAGING_OUTPUT_DIR points to public/peripheral-imaging/anatomy in the worktree.
Never writes to source files or exports DICOM/NRRD headers or patient identifiers.
"""
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import traceback

import numpy as np
from scipy import ndimage
from PIL import Image
import slicer
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from authored_nodule import parameters as nodule_parameters, bake as bake_nodule


def surface(mask, spacing, origin, budget):
    image = vtk.vtkImageData()
    image.SetDimensions(*mask.shape[::-1])
    image.SetSpacing(*spacing)
    image.SetOrigin(*origin)
    image.GetPointData().SetScalars(numpy_to_vtk(np.ascontiguousarray(mask, dtype=np.uint8).ravel(), deep=True))
    iso = vtk.vtkFlyingEdges3D()
    iso.SetInputData(image)
    iso.SetValue(0, 0.5)
    iso.Update()
    return polish(iso.GetOutput(), budget)


def polish(poly, budget):
    triangles = vtk.vtkTriangleFilter()
    triangles.SetInputData(poly)
    smooth = vtk.vtkWindowedSincPolyDataFilter()
    smooth.SetInputConnection(triangles.GetOutputPort())
    smooth.SetNumberOfIterations(18)
    smooth.SetPassBand(0.08)
    smooth.BoundarySmoothingOff()
    smooth.NormalizeCoordinatesOn()
    smooth.Update()
    decimate = vtk.vtkQuadricDecimation()
    decimate.SetInputConnection(smooth.GetOutputPort())
    decimate.SetTargetReduction(max(0, 1 - budget / max(1, smooth.GetOutput().GetNumberOfCells())))
    decimate.Update()
    normals = vtk.vtkPolyDataNormals()
    normals.SetInputConnection(decimate.GetOutputPort())
    normals.SplittingOff()
    normals.ConsistencyOn()
    normals.AutoOrientNormalsOn()
    normals.Update()
    result = vtk.vtkPolyData()
    result.DeepCopy(normals.GetOutput())
    return result


def write_glb(path, layers):
    binary = bytearray()
    doc = {'asset': {'version': '2.0', 'generator': '3D Slicer / FluoroView derived anatomy'},
           'scene': 0, 'scenes': [{'nodes': [0]}],
           'nodes': [{'name': 'CT-derived thorax, millimeters to meters', 'scale': [.001] * 3, 'children': []}],
           'meshes': [], 'materials': [], 'bufferViews': [], 'accessors': []}

    def accessor(array, kind, component, target):
        array = np.ascontiguousarray(array)
        while len(binary) % 4:
            binary.append(0)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': array.nbytes, 'target': target})
        binary.extend(array.tobytes())
        value = {'bufferView': view, 'componentType': component, 'count': len(array), 'type': kind}
        if kind == 'VEC3':
            value.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        doc['accessors'].append(value)
        return len(doc['accessors']) - 1

    stats = []
    for name, poly, color, opacity in layers:
        positions = vtk_to_numpy(poly.GetPoints().GetData()).astype('<f4')
        normals = vtk_to_numpy(poly.GetPointData().GetNormals()).astype('<f4')
        cells = vtk_to_numpy(poly.GetPolys().GetData()).reshape(-1, 4)[:, 1:].astype('<u4').ravel()
        p = accessor(positions, 'VEC3', 5126, 34962)
        n = accessor(normals, 'VEC3', 5126, 34962)
        idx = accessor(cells, 'SCALAR', 5125, 34963)
        material = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [opacity], 'metallicFactor': .04, 'roughnessFactor': .48}, 'doubleSided': True}
        if opacity < 1:
            material['alphaMode'] = 'BLEND'
        doc['materials'].append(material)
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': p, 'NORMAL': n}, 'indices': idx, 'material': len(doc['materials']) - 1}]})
        doc['nodes'].append({'name': name, 'mesh': len(doc['meshes']) - 1})
        doc['nodes'][0]['children'].append(len(doc['nodes']) - 1)
        stats.append({'name': name, 'triangles': len(cells) // 3, 'boundsMm': [positions.min(0).tolist(), positions.max(0).tolist()]})
    doc['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary += b'\0' * ((-len(binary)) % 4)
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(binary)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
    return stats


def main():
    source = Path(os.environ['IMAGING_SOURCE_DIR'])
    out = Path(os.environ['IMAGING_OUTPUT_DIR'])
    out.mkdir(parents=True, exist_ok=True)
    volume = slicer.util.loadVolume(str(source / 'target_clean_ct.nrrd'))
    ijk = vtk.vtkMatrix4x4()
    volume.GetIJKToRASMatrix(ijk)
    original = slicer.util.arrayFromVolume(volume)
    # This existing case is axis aligned; fail instead of silently dropping orientation.
    assert all(abs(ijk.GetElement(i, j)) < 1e-6 for i in range(3) for j in range(3) if i != j)
    assert ijk.GetElement(0, 0) < 0 and ijk.GetElement(1, 1) < 0 and ijk.GetElement(2, 2) > 0
    center_ras = np.array([ijk.GetElement(i, 3) + ijk.GetElement(i, i) * (original.shape[2-i] - 1) / 2 for i in range(3)])
    center_las = center_ras * [-1, 1, 1]
    first_las = np.array([-ijk.GetElement(0, 3), ijk.GetElement(1, 3) + ijk.GetElement(1, 1) * (original.shape[1]-1), ijk.GetElement(2, 3)])
    origin = first_las - center_las
    spacing = np.abs([ijk.GetElement(i, i) for i in range(3)]) * 2
    hu = original[::2, ::-2, ::2].copy()
    print('Preparing surface masks', hu.shape, flush=True)
    body = np.zeros_like(hu, dtype=bool)
    for k in range(len(hu)):
        labels, count = ndimage.label(hu[k] > -450)
        if count:
            sizes = np.bincount(labels.ravel()); sizes[0] = 0
            body[k] = ndimage.binary_fill_holes(labels == sizes.argmax())
    body = ndimage.binary_closing(body, iterations=2)
    lungs = (hu < -350) & body
    labels, _ = ndimage.label(lungs)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    lungs = np.isin(labels, np.argsort(sizes)[-2:])
    lungs = ndimage.binary_closing(lungs, iterations=2)
    for k in range(len(lungs)):
        lungs[k] = ndimage.binary_fill_holes(lungs[k])
    bones = (hu > 210) & body
    labels, _ = ndimage.label(bones)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    bones = sizes[labels] > 25
    model = slicer.util.loadModel(str(source / 'Final_airway_target.vtk'))
    transform = vtk.vtkTransform()
    matrix = vtk.vtkMatrix4x4(); matrix.Identity()
    for i, sign in enumerate([-1, 1, 1]):
        matrix.SetElement(i, i, sign)
        matrix.SetElement(i, 3, -center_las[i])
    transform.SetMatrix(matrix)
    transformed = vtk.vtkTransformPolyDataFilter(); transformed.SetTransform(transform); transformed.SetInputData(model.GetPolyData()); transformed.Update()
    reverse = vtk.vtkReverseSense(); reverse.SetInputData(transformed.GetOutput()); reverse.ReverseCellsOn(); reverse.ReverseNormalsOn(); reverse.Update()
    layers = [
        ('Thoracic envelope', surface(body, spacing, origin, 10000), [.53, .64, .69], .055),
        ('Lungs', surface(lungs, spacing, origin, 18000), [.33, .69, .70], .13),
        ('Ribs and spine', surface(bones, spacing, origin, 75000), [.87, .82, .71], .52),
        ('Airways', polish(reverse.GetOutput(), 60000), [.77, .88, .85], 1),
    ]
    stats = write_glb(out / 'thorax.glb', layers)
    print('Exported anatomy layers', stats, flush=True)
    # Lossy, quantized derived teaching volume. The source volume is never published.
    target_shape = np.array([192, 192, 192])
    resized = ndimage.zoom(hu.astype(np.float32), target_shape / np.array(hu.shape), order=1, prefilter=False)
    new_spacing = spacing * (np.array(hu.shape[::-1])-1) / (target_shape[::-1]-1)
    nodule = nodule_parameters()
    resized = bake_nodule(resized, origin, new_spacing, nodule)
    hu_range = [-1100, 1800]
    encoded = np.clip(np.rint((resized - hu_range[0]) * 255 / (hu_range[1] - hu_range[0])), 0, 255).astype(np.uint8)
    atlas = np.zeros((12*192, 16*192), dtype=np.uint8)
    for k, plane in enumerate(encoded):
        row, col = divmod(k, 16)
        atlas[row*192:(row+1)*192, col*192:(col+1)*192] = plane
    Image.fromarray(atlas).save(out / 'ct-atlas.png', optimize=True)
    new_spacing = spacing * (np.array(hu.shape[::-1])-1) / (target_shape[::-1]-1)
    # SlicerHeart's installed rendering presets accompany the prior FluoroView calibration.
    heart_root = Path(slicer.app.slicerHome) / 'Extensions-34627/SlicerHeart/lib/Slicer-5.12/qt-scripted-modules'
    presets = sorted(p.name for p in (heart_root/'Resources/VolumeRendering').glob('FluoroRenderingPreset_*.vp'))
    report = {
        'schema': 'peripheral-imaging-anatomy/v1', 'generator': '3D Slicer ' + slicer.app.applicationVersion,
        'source': 'Existing FluoroView teaching CT and Final_airway_target surface',
        'sourceSha256': hashlib.sha256((source/'target_clean_ct.nrrd').read_bytes()).hexdigest(),
        'airwaySourceSha256': hashlib.sha256((source/'Final_airway_target.vtk').read_bytes()).hexdigest(),
        'authoredNodule': nodule,
        'atlasSha256': hashlib.sha256((out/'ct-atlas.png').read_bytes()).hexdigest(),
        'coordinateSystem': 'LAS', 'units': 'mm', 'sizeXyz': target_shape[::-1].tolist(),
        'originMm': origin.tolist(), 'spacingMm': new_spacing.tolist(), 'huRange': hu_range,
        'atlasColumns': 16, 'atlasRows': 12, 'layers': stats, 'slicerHeartPresets': presets,
        'limitations': 'Threshold-derived context surfaces and quantized teaching volume; not a diagnostic segmentation or CT. The part-solid target is authored and baked into the CT atlas; the tool remains an analytic overlay.'
    }
    (out/'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    # Local QA axial image to select an intrapulmonary authored target in the same coordinates.
    k = int(round((-30 - origin[2]) / new_spacing[2]))
    Image.fromarray(np.clip((resized[k] + 1000) / 1400 * 255, 0, 255).astype(np.uint8)[::-1]).resize((768,768)).save('/tmp/imaging-anatomy-axial.png')
    print('Anatomy and CT atlas complete', flush=True)


try:
    main()
except Exception:
    traceback.print_exc()
    slicer.app.exit(1)
else:
    slicer.app.exit(0)
