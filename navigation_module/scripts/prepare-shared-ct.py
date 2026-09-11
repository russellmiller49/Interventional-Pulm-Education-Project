"""Derive a signed-HU preview from the read-only source CT (Slicer Python)."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--case-dir',type=Path,required=True);p.add_argument('--airway-case-dir',type=Path,required=True);a=p.parse_args()
casefile=a.case_dir/'case.json';case=json.loads(casefile.read_text());ct=case['ct']
with a.source.open('rb') as f:
    while f.readline().strip(): pass
    data=np.frombuffer(gzip.decompress(f.read()),dtype='<i2').reshape(tuple(ct['originalSizeXyz'][::-1]))
stride=ct['stride'];preview=data[::stride,::stride,::stride].copy()
if list(preview.shape[::-1])!=ct['sizeXyz']: raise ValueError('Preview dimensions do not match the case')
raw=preview.tobytes();filename='ct_preview_i16.raw.gz';compressed=gzip.compress(raw,compresslevel=6,mtime=0)
(a.case_dir/filename).write_bytes(compressed)
ct['signedPreview']={'url':filename,'sha256':hashlib.sha256(raw).hexdigest(),'sourceSha256':hashlib.sha256(a.source.read_bytes()).hexdigest()}
source=json.loads((a.airway_case_dir/'case_manifest.json').read_text())
ct['nativeBricks']=source['ct']['nativeBricks']
casefile.write_text(json.dumps(case,indent=2)+'\n')
print(json.dumps({'sizeXyz':ct['sizeXyz'],'signedRangeHu':[int(preview.min()),int(preview.max())],'compressedBytes':len(compressed),'sourceSha256':ct['signedPreview']['sourceSha256']}))
