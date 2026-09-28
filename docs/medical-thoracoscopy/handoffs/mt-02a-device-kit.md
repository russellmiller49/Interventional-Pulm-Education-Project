# Handoff — MT-02a device kit

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Slice               | 3 of the first build round; work package MT-02                                                                      |
| Branch              | `claude/mt-02a-device-kit`                                                                                          |
| Base                | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`                                                            |
| Prerequisite slices | `claude/mt-00c-foundation-registers` at `7fc69d2b`, merged into this branch as its first commit                     |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-02a-device-kit.md` |
| Owner decision      | OD-07 and OD-08. The approved first-round plan, section 4.3                                                         |
| Date                | 2026-09-28                                                                                                          |

## Why

The course shows the manufacturer's instruments in 3D, and the space engine needs their real
dimensions: where the optic sits on the tip, where a tool leaves the channel, how far it can
reach, how wide the sleeve is between two ribs. The manufacturer publishes some of these and not
others. This slice measures the rest from the manufacturer's animation stills, records each
measurement with a tolerance, and builds every instrument from one definitions file, so a model
can never drift from the facts it was built on.

## What changed

| Path                                                                                     | Change                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/medical-thoracoscopy/measure_reference_frames.py`                               | New. Measures frames 2, 3, 7 and 13 in place and writes the record. `--check` repeats the measurement and compares                                                    |
| `scripts/medical-thoracoscopy/mt_reference.py`                                           | Adds `silhouette_edges`: an edge at half contrast between the background and the object's own rim                                                                     |
| `src/features/medical-thoracoscopy/content/data/reference-measurements.json`             | New. 44 measurements, numbers only, each with its frame, method and tolerance, and the list of variations its tolerance came from                                     |
| `src/features/medical-thoracoscopy/content/referenceMeasurements.ts`                     | New. The record's schema. No course page imports it                                                                                                                   |
| `src/features/medical-thoracoscopy/content/data/device-definitions.json`                 | Version 2. The frames as document `S-FRAMES`; 35 measured values and 2 outlines, each naming its record entries; authored values; forms; a standard for each device   |
| `src/features/medical-thoracoscopy/content/deviceDefinitions.ts`                         | Measured entries must carry `measurement`, `tolerance` and the frame; forms; `publishedNumber` refuses anything that is not a device fact; `modelledNumber`, `formOf` |
| `src/features/medical-thoracoscopy/content/deviceKitDigest.ts`                           | New. A digest of exactly what the generator reads                                                                                                                     |
| `scripts/medical-thoracoscopy/build_device_kit.py`                                       | New. Blender 5.1, headless. Builds twelve models in the device frame, with anchors and provenance                                                                     |
| `scripts/medical-thoracoscopy/validate_device_kit.py`                                    | New. Reads the raw models with its own code and checks them against the definitions                                                                                   |
| `scripts/medical-thoracoscopy/package-device-kit.ts`                                     | New. Draco compression, content-hashed names, manifest, generated copy, ledger rows                                                                                   |
| `scripts/medical-thoracoscopy/validate_device_kit_blender.py`                            | New. Decodes each packaged model in Blender and compares it with its source                                                                                           |
| `scripts/medical-thoracoscopy/{render_device_previews,compose_reference_comparisons}.py` | New. Previews, and each model laid over its reference frame. Both write to local data only                                                                            |
| `public/models/medical-thoracoscopy/v1/devices/`                                         | New. Twelve models and `manifest.json`                                                                                                                                |
| `src/features/medical-thoracoscopy/content/data/generated/deviceKit.ts`                  | New, generated. The manifest for page code                                                                                                                            |
| `src/features/medical-thoracoscopy/__tests__/deviceKit.test.ts`                          | New                                                                                                                                                                   |
| `src/features/medical-thoracoscopy/__tests__/registers.test.ts`                          | The test that said nothing had been measured is replaced by tests that every measured value equals the record, with its tolerance                                     |
| `src/features/medical-thoracoscopy/test-support/renderRegisters.ts`                      | The device register prints tolerances, the record entries behind each value, standards and forms                                                                      |
| `docs/medical-thoracoscopy/registers/device-register.md`                                 | Printed again                                                                                                                                                         |
| `docs/medical-thoracoscopy/registers/asset-ledger.json`                                  | Rows for the twelve models and the manifest. None uploaded                                                                                                            |
| `docs/medical-thoracoscopy/registers/rights-register.json`                               | R-DEVICE-MODELS now says where the models are held                                                                                                                    |
| `docs/medical-thoracoscopy/README.md`                                                    | A device-kit section                                                                                                                                                  |

No route, page, learner-facing text or engine code exists yet. The traceability rows are
unchanged: they gain assets when each experience's asset set is complete (anatomy in slices 7
and 8, the scene in slice 11).

### Outside the repository

In the owner's local data, under `raw-assets/medical-thoracoscopy/`:

| Folder                           | What                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `measurements/`                  | The full record: every intermediate value, every variation, and the fitted camera poses                             |
| `devices/raw/`, `devices/blend/` | The uncompressed models and their Blender sources                                                                   |
| `devices/previews/`              | Each model alone from three sides and at its working end; renders through the fitted cameras                        |
| `devices/comparisons/`           | **Contain the manufacturer's images.** Frames 2 and 13 with the model over them; frame 3 rectified beside the model |
| `devices/validation-*.json`      | The two validators' reports                                                                                         |

`medical_thoracoscopy/sponsor/manufacturer-fact-check-packet.md` gained a section: what was
measured from the stills, and two readings that do not match the published values. Not sent.

## How to rebuild the kit

Run in this order from this checkout. `B` is `/Applications/Blender.app/Contents/MacOS/Blender`.

| Step | Command                                                                                                  | Checks                                              |
| ---: | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
|    1 | `python3 scripts/medical-thoracoscopy/measure_reference_frames.py` (or `--check`)                        | The record repeats                                  |
|    2 | `$B --background --factory-startup --python scripts/medical-thoracoscopy/build_device_kit.py`            | Twelve models built; byte-identical on a rerun      |
|    3 | `python3 scripts/medical-thoracoscopy/validate_device_kit.py`                                            | Every check below, on the raw models                |
|    4 | `npx tsx scripts/medical-thoracoscopy/package-device-kit.ts`                                             | Refuses models built from other definitions         |
|    5 | `$B --background --factory-startup --python scripts/medical-thoracoscopy/validate_device_kit_blender.py` | Packaged models decode to their sources             |
|    6 | `$B … render_device_previews.py -- --matched`, then `python3 … compose_reference_comparisons.py`         | Sheets for the owner, in local data                 |
|    7 | `npx tsx scripts/medical-thoracoscopy/render-registers.ts`, then Prettier on the register pages          | After any change to the definitions                 |
|    8 | `npx jest src/features/medical-thoracoscopy --runInBand`                                                 | The committed kit matches the committed definitions |

A change to a dimension in the definitions changes the geometry digest, and the kit tests fail
until steps 2 to 5 are run. A reviewer's recorded decision does not change the digest.

## What was measured, and how

Frames 2 and 13 are perspective views. A pinhole camera is fitted to the telescope shaft, whose
diameter (5.5 mm) and length (215 mm) are published; points on the plane through the shaft and
the eyepiece are then read in millimetres, with that plane turned about the shaft until the
eyepiece end lies at the published total length (370 mm). Frame 3, the distal face, is read as an
affine view of a circle. Frame 7 is read at one scale, because the shaft's width does not change
along it.

A tolerance is the root sum of squares of how far a value moved when each assumption was varied
(principal point, where the tip and the body are read, the edge rule, the eyepiece end, the dark
and rim thresholds on the face), plus one pixel. The variations are listed in the record.

Findings that matter:

- **A fixed edge threshold biases the camera.** The metal's rim is lighter near the body than at
  the tip, so a threshold a fixed step below the background narrows the far end and exaggerates
  the perspective. Edges are now placed at half contrast. The old rule is kept as a variation,
  which is why the sleeve's diameter carries ±0.6 mm: the white plastic and the metal respond to
  the two rules differently.
- **Two views agree on the eyepiece.** Read independently on frame 13 (a different view and a
  different camera fit), the eyepiece stands at 29.4° ± 2.0° and meets the shaft 238.9 ± 1.5 mm
  from the tip, against 29.6° ± 1.0° and 239.0 ± 1.0 mm on frame 2. A test holds the two together.
- **The models lie on the frames.** Rendered through the fitted cameras, the telescope lies on
  frame 2 and the telescope with the sleeve on frame 13, eyepiece included; the rectified face of
  frame 3 lies on the model's face. The sheets are in local data.
- **The channel's lowest point is the shaft's own wall**, as frame 3 shows. The model lets the
  lumen reach the wall there; so modelled, it admits the published 3.5 mm (3.50 mm in the model).
- **The optic lies on the line through the channel and the face's centre**: its housing is
  0.03 ± 0.2 mm off it.
- **The earlier roll of 9.15° was not reproduced** (5.8° now): the roll depends on exactly where
  the eyepiece end is read. The dimensions read on the plane do not: they move by less than their
  tolerances across the variations.

Authored, and labelled so in the definitions: the field of view (75°), where the hand holds the
telescope (250 mm), that the eyepiece lies in the plane of the optic and the channel, the light
post (drawn to lie on its outline in frame 2 through that frame's camera; frame 4 agrees), the
stopcock (placed where frame 2 hides it; it falls on the real one in frame 13), the sleeve's
thread and rounding, the spoon jaws' form, a simplified forceps handle, and the forms of the
eight draft parts. The hook is drawn within the shaft's diameter so that it passes the channel.

## Claims and assets touched

Claims: none added or changed.

Assets, all `uploaded: false`, all under R-DEVICE-MODELS, which blocks upload:

| Model                           | Standard |  Bytes | Triangles | Decoded bytes |
| ------------------------------- | -------- | -----: | --------: | ------------: |
| `operative-telescope`           | full     | 67,320 |    22,266 |       458,724 |
| `trocar-sleeve-flexible`        | full     | 18,840 |     5,488 |       120,960 |
| `double-spoon-forceps`          | full     | 20,696 |     3,680 |        75,840 |
| `operative-telescope-cutaway`   | full     |  9,832 |       835 |        25,746 |
| `trocar-for-flexible-sleeve`    | draft    |  7,472 |       928 |        26,400 |
| `trocar-sleeve-with-valves`     | draft    | 13,992 |     2,342 |        60,180 |
| `trocar-for-sleeve-with-valves` | draft    |  7,544 |       928 |        26,400 |
| `dissection-forceps`            | draft    | 16,176 |     2,560 |        55,008 |
| `hook-electrode`                | draft    |  9,992 |     2,048 |        43,584 |
| `button-electrode`              | draft    | 12,752 |     2,816 |        58,128 |
| `probe`                         | draft    | 13,040 |     3,456 |        80,352 |
| `suction-tube`                  | draft    |  7,520 |       720 |        18,240 |

The three prototype parts come to 106,856 bytes and 31,434 triangles together (the plan
estimated about 17,000; the budget is 2.5 MB and 50,000 triangles per model). File names carry
the first twelve hex digits of each file's SHA-256; the manifest and the ledger carry the full
hashes.

## Checks run

| Command                                                                          | Result                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `measure_reference_frames.py --check`                                            | 44 measurements, 0 differ                                |
| `build_device_kit.py`, run twice                                                 | 12 models; byte-identical across runs                    |
| `validate_device_kit.py`                                                         | 12 models, 0 failures                                    |
| `package-device-kit.ts`, run twice                                               | Same content hashes both times                           |
| `validate_device_kit_blender.py`                                                 | 12 packaged models imported in Blender 5.1.0, 0 failures |
| `npx jest src/features/medical-thoracoscopy --runInBand`                         | 3 suites, 84 tests, all passing                          |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts --check`               | All three pages match their registers                    |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                      | Clean                                                    |
| `npx eslint src/features/medical-thoracoscopy scripts/medical-thoracoscopy/*.ts` | No findings                                              |
| `npx prettier --check` on every changed file                                     | Clean                                                    |
| `git diff --check`                                                               | Clean                                                    |

What the raw-model validator checks: the definitions, record and generator hashes in each model
equal the files now; the label and units; no manufacturer name or mark in any node, mesh,
material or extra; no textures; a material on every surface; finite geometry; the triangle
budget; every anchor present, placed and pointed as its extras say; the published lengths and
diameters within 0.02 mm; the closed jaws, every tool and the sheath inside the channel's
measured circle; the telescope inside the sleeve's capacity. A dimensional comparison is not a
statement of compatibility.

## Real browser observations

Not opened. No page loads the models yet. The models were decoded by Blender's importer; they
have not been decoded by three.js's Draco loader, which happens in slice 11.

## Checks not run

- **No manufacturer fact-check.** Every measured and authored value is NOT REVIEWED.
- **The models have not been seen in the app** or decoded in a browser.
- **Full test suite, Storybook build, production build.** The next integration point follows
  slice 5.
- **The Python scripts are not linted**: the repository has no Python linter configured.

## Unresolved decisions

- **R-DEVICE-MODELS**: who owns the models and whether depicting the product design needs the
  manufacturer's permission. It blocks upload.
- The manufacturer's own values for everything in the fact-check packet, including the two
  readings that disagree with published values. S5 is unchanged: those appear only in the packet.
- The forceps handle is a stand-in until the device explorer.

## What must not happen next

- Do not upload the models. When the owner authorises it, from the primary checkout:
  `npm run upload:module-assets -- --upsert --only=models/medical-thoracoscopy`.
- Do not edit a measured value by hand: measure again. Do not edit a model, the manifest or the
  generated copy by hand: rebuild and repackage.
- Do not commit anything from `devices/comparisons/` or `devices/previews/`.
- Do not describe a measured or authored value to a learner as a fact about the device.

This does not change publication status or constitute clinical approval.
