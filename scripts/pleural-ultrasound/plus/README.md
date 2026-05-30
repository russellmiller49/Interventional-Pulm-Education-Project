# Pleural ultrasound PLUS quickstart

This is the practical path from a 3D Slicer segmentation to more anatomically realistic ultrasound frames for the browser simulator.

The key idea: use 3D Slicer for patient anatomy, use PLUS Toolkit as an offline frame generator, and let the web app load cached frames. PLUS is native C++/PlusServer software, not a browser package.

## 1. Export surfaces from 3D Slicer

Load the CT and segmentation in Slicer, then make sure each segment has a closed surface representation.

The export helper is tailored to these segment names:

```text
skin
thoracic cavity
diaphragm
pulmonary artery
spine
right pleural effusion
pulmonary vein
muscle
liver
upper lobe of left lung
bone
upper lobe of right lung
lower lobe of left lung
heart
lower lobe of right lung
left pleural effusion
trachea and bronchus
aorta
middle lobe of right lung
stomach
spleen
left kidney
esophagus
pancreas
inferior vena cava
superior vena cava
portal vein and splenic vein
thyroid
gallbladder
right kidney
```

Then export one STL per structure into:

```text
Pleural_effusion_simulation/plus/Models/
```

Expected output:

```text
skin.stl
muscle.stl
rib.stl
lung.stl
pleural-fluid.stl
right-pleural-effusion.stl
left-pleural-effusion.stl
diaphragm.stl
liver.stl
spleen.stl
heart.stl
airway.stl
great-vessels.stl
upper-abdominal-organs.stl
thoracic-cavity.stl
esophagus.stl
thyroid.stl
```

The minimum files needed by the current PLUS XML are:

```text
skin.stl
muscle.stl
rib.stl
lung.stl
pleural-fluid.stl
right-pleural-effusion.stl
diaphragm.stl
liver.stl
spleen.stl
```

You can export from the Slicer UI, but the helper script is safer because it merges lung lobes, bone/spine, and bilateral effusions into the PLUS-facing files:

1. Open `Segmentations`.
2. Select the pleural effusion segmentation.
3. Under `Export/import models and labelmaps`, export visible segments to models.
4. Save each model as STL with the filenames above.

Run the helper script from Slicer's Python Interactor with this one-liner:

```python
exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-export-plus-surfaces.py").read())
```

Do not paste only the middle of the script into the interactor. If Slicer executes a line such as `"filename": "great-vessels.stl",` by itself, Python will throw `IndentationError: unexpected indent`.

## 2. Build PLUS on macOS

Install prerequisites:

```bash
brew install cmake git qt5
```

Build with PlusBuild:

```bash
cd ~/Projects
git clone https://github.com/PlusToolkit/PlusBuild.git
mkdir PlusBuild-bin
cd PlusBuild-bin
cmake -DCMAKE_BUILD_TYPE=Release ../PlusBuild
cmake --build . --config Release --parallel
```

The first build can take a long time because VTK, ITK, OpenIGTLink, and related dependencies are downloaded and built.

On this machine, `PlusServer` was built under:

```text
/Users/russellmiller/Projects/PlusBuild-bin/bin/
```

On other PLUS builds, the binaries may instead be under:

```text
~/Projects/PlusBuild-bin/PlusLib-bin/bin/
```

## 3. Prepare a PLUS simulation folder

Create:

```text
Pleural_effusion_simulation/plus/
  PlusDeviceSet_PleuralEffusionSimulator.xml
  Models/
    skin.stl
    muscle.stl
    rib.stl
    lung.stl
    pleural-fluid.stl
    diaphragm.stl
    liver.stl
    spleen.stl
```

Copy this template:

```bash
cp scripts/pleural-ultrasound/plus/PlusDeviceSet_PleuralEffusionSimulator.template.xml \
  Pleural_effusion_simulation/plus/PlusDeviceSet_PleuralEffusionSimulator.xml
```

Then tune the material parameters in the XML. The template is intentionally a starting point, not a validated acoustic model.

The patient-derived STL files can be very large. Before running PlusServer,
generate a decimated PLUS-specific copy:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
/Applications/Slicer.app/Contents/bin/PythonSlicer \
  scripts/pleural-ultrasound/plus/decimate-plus-surfaces.py
```

The current XML reads from:

```text
Pleural_effusion_simulation/plus/ModelsLowRes/
```

Keep the original full-resolution exports in `Models/`; `ModelsLowRes/` is
only the runtime-friendly copy used by PLUS.

## 4. Start the transform sender and PlusServer

PLUS needs an OpenIGTLink tracker source before `PlusServer` starts. The helper
below sends `Probe` and `Reference` TDATA elements in the `Tracker` frame on
`127.0.0.1:18946`. PLUS combines those element names with
`ToolReferenceFrame="Tracker"` to create `ProbeToTracker` and
`ReferenceToTracker` internally. Its default probe pose is tuned to start from
the right lateral chest wall and aim medially through the right pleural
effusion.

Recommended one-command start:

```bash
cd /Users/russellmiller/Projects/Interventional-Pulm-Education-Project
PLUS_BIN=/Users/russellmiller/Projects/PlusBuild-bin/bin \
  scripts/pleural-ultrasound/plus/run-plus-simulator.sh
```

If you want to run the two pieces manually, start the transform sender first:

```bash
python3 scripts/pleural-ultrasound/plus/send-probe-transform.py --rate 30 --sweep
```

Then start PlusServer:

```bash
/Users/russellmiller/Projects/PlusBuild-bin/bin/PlusServer \
  --config-file=Pleural_effusion_simulation/plus/PlusDeviceSet_PleuralEffusionSimulator.xml \
  --verbose=3
```

If PlusServer starts cleanly, connect from Slicer:

1. Open `OpenIGTLinkIF`.
2. Add connector.
3. Set type to client.
4. Host: `localhost`.
5. Port: `18944` for the simulated image stream.
6. Click `Active`.

Expected startup signs:

```text
Plus OpenIGTLink server listening ... port 18944
Server status: Server(s) are running.
```

The sender uses `TDATA` rather than plain `TRANSFORM` messages to avoid the
repeated PLUS warning about missing `TransformStatus` metadata.

The outgoing stream is the PLUS `TrackedVideoStream`, so Slicer should receive
an `Image` node embedded to `Reference` plus a companion `ProbeToReference`
transform. If the Slicer connector was already active during an earlier failed
run, turn `Active` off and back on after restarting PlusServer.

### Adjusting the probe pose

Do not hand-edit `ProbeToReference` in Slicer while PLUS is connected. It is an
incoming transform, so the next OpenIGTLink frame will overwrite Slicer's local
edit. Use the pose helper instead; the transform sender re-reads this JSON file
while `run-plus-simulator.sh` is active:

```bash
python3 scripts/pleural-ultrasound/plus/set-probe-pose.py --preset largest-pocket
python3 scripts/pleural-ultrasound/plus/set-probe-pose.py --nudge pa -5
python3 scripts/pleural-ultrasound/plus/set-probe-pose.py --nudge is 10
python3 scripts/pleural-ultrasound/plus/set-probe-pose.py --rotate rx 5
```

The axes match Slicer's transform labels:

```text
LR / x: left-right, mostly lateral chest-wall position
PA / y: posterior-anterior, probe contact depth around the chest wall
IS / z: inferior-superior, caudal-cranial level
rx / ry / rz: rotation about those same Slicer axes, in degrees
```

Use small nudges, usually 5 to 10 mm, and watch the resliced anatomy in Slicer.
Use smaller rotation nudges, usually 2 to 5 degrees.
If PLUS is not running, the command still updates:

```text
Pleural_effusion_simulation/plus/current-probe-pose.json
```

Then restart `run-plus-simulator.sh` and reconnect Slicer's OpenIGTLinkIF
connector.

If changing one slice background changes all slice views, Slicer's linked-slice
control is enabled. Turn off the chain/link icon in each slice controller, or
run this in Slicer's Python Interactor:

```python
exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-set-plus-view-layout.py").read())
```

That sets Red and Yellow to the CT, Green to `Image_Reference`, and unlinks the
slice controls.

## 4a. Calibrate a patient-specific pleural window

Before judging image realism, make sure the probe ray actually crosses the
fluid pocket and avoids ribs, diaphragm, and solid organs. Score candidate
right-lateral central rays with:

```bash
/Applications/Slicer.app/Contents/bin/PythonSlicer \
  scripts/pleural-ultrasound/plus/probe-window-candidates.py
```

The current default transform sender pose is the top-scored right effusion
window from the low-resolution surfaces:

```text
x=184.2 mm, y=110.4 mm, z=-382.9 mm
```

To test another scored window, update the live pose file:

```bash
python3 scripts/pleural-ultrasound/plus/set-probe-pose.py --preset alternate-interspace
```

If markup landmarks have been saved under:

```text
Pleural_effusion_simulation/plus/markups/
```

derive a safer interspace pose from the rib, diaphragm, liver, and saved skin
entry landmarks:

```bash
python3 scripts/pleural-ultrasound/plus/pose-from-markups.py
python3 scripts/pleural-ultrasound/plus/pose-from-markups.py --apply
```

## 5. Generate frame cache for the web module

The next implementation step is an image capture driver:

1. Sweep probe transforms with `send-probe-transform.py`.
2. Capture the simulated B-mode image stream from `localhost:18944`.
3. Save frames as WebP/PNG.
4. Write `frames.json` with probe pose metadata.
5. Add the frame cache URL to `case.json`.

The browser simulator can then prefer PLUS frames and fall back to its current educational ray-march image when no cached frame matches the current probe pose.

## Recommended first milestone

Do not try to solve the entire frame cache first. Aim for one static image:

1. Export the minimum STL files.
2. Start the transform sender and PlusServer.
3. Confirm Slicer receives a simulated image stream on port `18944`.
4. Save one screenshot/frame.
5. Compare anatomy orientation against the browser probe pose.

Once one frame is anatomically oriented correctly, batch generation becomes much easier.
