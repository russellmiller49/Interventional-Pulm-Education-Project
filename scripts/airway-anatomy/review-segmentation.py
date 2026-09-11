"""Compare the unchanged source surface with the source binary labelmap in voxel units."""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
import numpy as np
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
seg=a.source/'SEGMENTATION.seg.nrrd';raw=seg.read_bytes();header,payload=raw.split(b'\n\n',1)
fields={line.split(':',1)[0]:line.split(':',1)[1].strip() for line in header.decode().splitlines() if ':' in line and ':=' not in line}
assert fields['type']=='unsigned char' and fields['dimension']=='3' and fields['encoding']=='gzip' and fields['space']=='left-posterior-superior'
size=[int(x) for x in fields['sizes'].split()]
directions=np.array([[float(x) for x in text.split(',')] for text in re.findall(r'\(([^)]+)\)',fields['space directions'])]).T
origin=np.array([float(x) for x in fields['space origin'].strip('()').split(',')])
volume=np.frombuffer(gzip.decompress(payload),dtype=np.uint8)
assert volume.size==int(np.prod(size))
image=vtk.vtkImageData();image.SetDimensions(*size);image.GetPointData().SetScalars(numpy_to_vtk((volume>0).astype(np.uint8),deep=True))
contour=vtk.vtkFlyingEdges3D();contour.SetInputData(image);contour.SetValue(0,.5);contour.Update()
reader=vtk.vtkSTLReader();reader.SetFileName(str(a.source/'airway_large.stl'));reader.Update()
surface=vtk.vtkPolyData();surface.DeepCopy(reader.GetOutput())
points=vtk_to_numpy(surface.GetPoints().GetData()).astype(np.float64)
ijk=(np.linalg.inv(directions)@(points-origin).T).T
transformed=vtk.vtkPoints();transformed.SetData(numpy_to_vtk(ijk,deep=True));surface.SetPoints(transformed)
distance=vtk.vtkDistancePolyDataFilter();distance.SetInputData(0,surface);distance.SetInputData(1,contour.GetOutput());distance.SignedDistanceOff();distance.ComputeSecondDistanceOff();distance.ComputeCellCenterDistanceOn();distance.Update()
vertices=vtk_to_numpy(distance.GetOutput().GetPointData().GetArray('Distance'))
centers=vtk_to_numpy(distance.GetOutput().GetCellData().GetArray('Distance'))
values=np.concatenate([vertices,centers])
report={'segmentationSha256':hashlib.sha256(raw).hexdigest(),'meshSha256':hashlib.sha256((a.source/'airway_large.stl').read_bytes()).hexdigest(),'coordinateMetric':'Euclidean distance in source IJK voxel units','verticesChecked':len(vertices),'triangleCentersChecked':len(centers),'medianVoxelDistance':float(np.median(values)),'p99VoxelDistance':float(np.quantile(values,.99)),'maxVoxelDistance':float(values.max()),'samplesOverOneVoxel':int(np.sum(values>1))}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
