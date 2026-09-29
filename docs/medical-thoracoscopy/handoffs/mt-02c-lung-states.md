# Handoff — MT-02c lung states

| Field               | Value                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 8 of the first build round; work package MT-02                                                                                |
| Branch              | `claude/mt-02c-lung-states`                                                                                                   |
| Base                | `origin/main` `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                                      |
| Prerequisite slices | `claude/mt-02b-thorax-surfaces` at `2fd1745a` (which carries slices A, B and 1 to 7), merged as the first commit (`a9f3c77c`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-02c-lung-states.md`          |
| Owner decision      | OD-08; the approved first-round plan, sections 4.4 and 5 (row 8)                                                              |
| Date                | 2026-09-28                                                                                                                    |

## Why

The survey happens in the room the lung leaves when it falls away. This slice makes the lung's
states, from the lung of the scan to the collapsed lung; the collision proxies every spatial
answer of the engine will come from; the points the visibility ledger samples each survey zone
with; and the fluid table. It packages all the anatomy with a manifest, and checks it three ways:
with the module's own reader, in Blender, and against the committed records.

## The anatomy files are not in the repository

As in slice 7: the segmentation's terms are not settled (rights register,
R-ANATOMY-SEGMENTATION), and the repository is public. Everything is built and packaged in the
owner's local data (`raw-assets/medical-thoracoscopy/anatomy/{raw,packaged}/`).
`package-anatomy.ts --install-dev` copies the packaged files into
`public/models/medical-thoracoscopy/v1/anatomy/`, which Git ignores, for the dev server. The
repository holds numbers and names only: the records, the generated manifest (file names, hashes,
sizes, triangle counts) and the ledger rows, which say `inRepository: false`.

## What changed

| Path                                                                                                            | Change                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/medical-thoracoscopy/thorax_remesh.py`                                                                 | New. Even triangle surfaces of a mask's smoothed surface: marching cubes, then edges split, collapsed (keeping a manifold) and flipped, vertices relaxed along the surface and put back on it                                             |
| `scripts/medical-thoracoscopy/thorax_mesh_checks.py`                                                            | New. The checks every script shares, written without mesh libraries: folded faces, faces through each other (within a surface or between two), exact distance and signed distance to a surface, winding numbers, the volume below a plane |
| `scripts/medical-thoracoscopy/build_lung_states.py`                                                             | New. The lung states, the collision proxies, the zone samples and the fluid table, below                                                                                                                                                  |
| `scripts/medical-thoracoscopy/validate_lung_states.py`                                                          | New. Reads the three new files with its own code, dequantises the lung, and checks every state, every blend, both proxies, the samples and the fluid table against the records                                                            |
| `scripts/medical-thoracoscopy/package-anatomy.ts`                                                               | New. Draco for the drawn surfaces, content-named files, the manifest and its generated copy, the ledger rows, and the dev copy                                                                                                            |
| `scripts/medical-thoracoscopy/validate_anatomy_blender.py`                                                      | New. Blender 5.1 imports every packaged file and the file as built and compares them; the lung state by state                                                                                                                             |
| `scripts/medical-thoracoscopy/build_thorax_surfaces.py`                                                         | The pleural space meshed with even triangles, and taking what lies between the lobes and the effusion; duplicated faces removed from the context; `--install-dev` moved to the packager (below)                                           |
| `scripts/medical-thoracoscopy/validate_thorax_surfaces.py`                                                      | No face of the pleural space or of any rib passes through another; no context face is repeated                                                                                                                                            |
| `scripts/medical-thoracoscopy/thorax_common.py`                                                                 | A GLB builder for morph targets, quantised attributes and point primitives, and a reader for them. The attribution's wording now matches `ATTRIBUTION.md`                                                                                 |
| `scripts/medical-thoracoscopy/package-device-kit.ts`                                                            | Its ledger rows say `inRepository: true`                                                                                                                                                                                                  |
| `src/features/medical-thoracoscopy/content/data/anatomy/{lung-states,proxies,zone-samples,fluid-table}.json`    | New. Numbers only                                                                                                                                                                                                                         |
| `src/features/medical-thoracoscopy/content/data/anatomy/{surfaces,port-candidates,port-record}.json`            | Measured again on the new surface (below)                                                                                                                                                                                                 |
| `src/features/medical-thoracoscopy/content/data/generated/anatomy.ts`                                           | New, generated. The anatomy manifest for page code                                                                                                                                                                                        |
| `src/features/medical-thoracoscopy/content/anatomy.ts`                                                          | Schemas for the four new records, which hold the checks as literals: no folded face, no crossing, nothing through the pleura                                                                                                              |
| `src/features/medical-thoracoscopy/content/data/claim-register.json`                                            | MT-C-0001 and MT-C-0002 list the lung-states asset as written. No wording changed                                                                                                                                                         |
| `src/features/medical-thoracoscopy/__tests__/{lungStates,registers}.test.ts`, `test-support/registerSchemas.ts` | New tests for the records, the manifest and the ledger; ledger rows carry `inRepository`                                                                                                                                                  |
| `docs/medical-thoracoscopy/registers/{asset-ledger.json,claim-review-queue.md}`                                 | Rows for the six anatomy files and the manifest; the queue printed again                                                                                                                                                                  |
| `docs/medical-thoracoscopy/{README,ATTRIBUTION}.md`, `docs/local-authoring-assets.md`, `.gitignore`             | The build order; the attribution's wording; where the packaged files are kept                                                                                                                                                             |

No page, route, learner text or engine code changed. The traceability rows are unchanged; the
scene's asset set is completed in slice 11.

## What was built

### The lung states

| Step | Volume (mL) | Share of the expanded lung | Gap at the port (mm) | Nearest the pleura comes (mm) |
| ---: | ----------: | -------------------------: | -------------------: | ----------------------------: |
|    0 |     2,339.6 |                       1.00 |                  0.9 |                          0.38 |
|    1 |     2,008.3 |                       0.86 |                  5.1 |                          0.80 |
|    2 |     1,730.2 |                       0.74 |                  9.1 |                          0.91 |
|    3 |     1,489.6 |                       0.64 |                 13.0 |                          0.98 |
|    4 |     1,299.0 |                       0.56 |                 16.4 |                          1.33 |
|    5 |     1,116.1 |                       0.48 |                 20.0 |                          1.44 |
|    6 |       957.8 |                       0.41 |                 23.5 |                          1.50 |
|    7 |       820.8 |                       0.35 |                 26.9 |                          1.59 |
|    8 |       702.5 |                       0.30 |                 30.1 |                          1.63 |

- **The expanded lung** is the scan's: the three right lobes, closed at 2 mm, eroded by 1 mm so it
  sits inside the drawn pleura, meshed as 29,610 even triangles (smallest angle 34°), the lobes as
  three primitives sharing one vertex array.
- **The collapse** is carried by a smooth flow: toward a point 12 mm inside the lung from the right
  hilar airway and vessels, with a drift along gravity in the presented position; near the pleura,
  no outward motion, sliding held back in proportion to how hard the lung is pressed (friction),
  and a barrier that keeps the lung 1.2 mm off the drawn surface. A smooth flow cannot tear a
  surface or pass it through itself. Along the way the vertices slide along the surface to keep
  the triangles even, which changes no shape, and a crease that sharpens by more than 45° is
  smoothed where it forms (54 times, 504 vertices). It runs until the gap at the port reaches the
  authored 30 mm; the eight steps are equal in flow time.
- **Checked** at every step, and at a quarter, half and three quarters between neighbouring steps
  (the scene blends them): no folded face, no face through another, no face through the pleura, and
  the lung at least 0.61 mm from it between steps (0.38 mm at the expanded state).
- **The file** holds the expanded lung and the eight steps as morph targets named "step 1" to
  "step 8": positions only, quantised to 16 bits (0.0035 mm); the normals are the expanded lung's,
  so a scene that morphs the lung recomputes them.
- **Authored**: the 30 mm gap and every value of the flow are the author's choices (MT-C-0002),
  made so the states clear the pleura without folding. The collapsed lung at 30 % of its volume
  follows from them; it is not measured and not from a source.

The lung was looked at in the presented position from above and from the front at steps 0, 4 and
8: it falls away from the lateral wall and the port toward the mediastinum, pulls back from the
apex and the diaphragm, and keeps its shape, the fissures showing as grooves. The pictures are in
the session's scratch folder, not the repository.

### The collision proxies

| Proxy                            | Triangles      | Offset | Distance from the drawn surface                                          |
| -------------------------------- | -------------- | -----: | ------------------------------------------------------------------------ |
| Pleural space, inside the pleura | 6,954          |   1 mm | its vertices 0.29 to 2.17 mm; the drawn surface at least 0.25 mm outside |
| Lung, one per step, around it    | 4,392 to 4,470 | 2.5 mm | its vertices 2.05 to 3.71 mm; the drawn lung at least 0.25 mm inside     |

- Each is meshed on a level set of a distance field and checked exactly: closed, outward, no face
  through itself or through its drawn surface, and the 0.25 mm clearance skin of the plan both
  ways. Where the pleura rises between the space proxy's triangles, the proxy is refined there (668
  edges split).
- The space proxy leaves out parts of the space thinner than 6 mm, which its triangles could not
  follow: the drawn surface lies up to 7.8 mm beyond it at the tip of the costophrenic recess.
- Halfway between two steps, the drawn lung lies inside one of the two steps' proxies: what lets
  the engine step the lung only with room around the instrument.
- Together, 11,424 triangles in use of the plan's 12,000.

### The zone samples

1,636 points, one per square centimetre of each zone (at least 32), area-weighted. Each is moved
to the nearest point of the space proxy and 0.25 mm inside it, so that no zone hides behind its own
proxy: most move 0.6 to 3 mm; at the recess tip, where the proxy stops short, up to 8.2 mm. They
are stored in the space proxy's file, one point primitive per zone.

### The fluid table

In the presented position: the volume of the pleural space below a level plane at right angles to
gravity, less the lung's, at every 2 mm from the space's lowest point to its top (174 mm), at each
step. Full, the space holds 3,417.6 mL; with the lung expanded, 1,078 mL of it is left for fluid;
collapsed, 2,715 mL. Authored, illustrative: the lung does not float or move with the fluid.

### The packaged files

| File                | Built (bytes) | Packaged (bytes) | Compression             |
| ------------------- | ------------: | ---------------: | ----------------------- |
| pleural-space       |       955,252 |          113,240 | Draco                   |
| ribs                |     2,541,124 |          364,936 | Draco                   |
| context             |     1,304,612 |          184,896 | Draco                   |
| lung-states         |     1,308,408 |        1,308,408 | none (16-bit positions) |
| proxy-pleural-space |       108,408 |          108,408 | none                    |
| proxy-lung          |       484,500 |          484,500 | none                    |

2,564,388 bytes in all, of the plan's 3 MB anatomy budget.

## What changed in slice 7's surfaces

1. **The pleural space is meshed with even triangles**: 39,620 (was 27,350), smallest angle 34°,
   edges 1.9 to 4.1 mm. The simplifier had left slivers and long thin triangles, up to 38 mm, that
   shade badly close up and fold when the surface moves.
2. **The space takes what lies between its parts**: whatever lies within 5 mm of two of the lobes
   and the effusion, the named solid structures excepted. The notches where fissures meet the
   lung's surface, and the rim the segmentation left unlabelled between the lung and the fluid, had
   left narrow clefts in the drawn wall deep inside the cavity. The space grew by 35 mL (3,386.3 to
   3,421.7 mL of voxels).
3. **The zones were split again** on the new surface; each is still one piece. The diaphragm's share
   rose from 12.4 to 14.3 % and the costophrenic recess's fell from 9.3 to 6.9 %; the rest moved by
   less than half a point.
4. **The port table was measured again.** The prototype port's row is unchanged except that its
   pleura point moved 0.15 mm and its corridor axis turned about 3°. Other rows changed:

   | Space | Line               | Was                            | Now                            |
   | ----: | ------------------ | ------------------------------ | ------------------------------ |
   |     5 | anterior axillary  | wall 45.8 mm                   | wall 43.8 mm                   |
   |     6 | anterior axillary  | wall 42.8 mm                   | wall 40.3 mm                   |
   |     6 | mid-axillary       | lung 0.5 mm, diaphragm 80.6 mm | lung 6.0 mm, diaphragm 85.7 mm |
   |     7 | anterior axillary  | wall 31.5 mm, lung 0.0 mm      | wall 33.8 mm, lung 4.8 mm      |
   |     7 | posterior axillary | wall 59.2 mm                   | skin not in the scan           |
   |     8 | anterior axillary  | lung 0.8 mm                    | lung 0.0 mm                    |
   |     8 | posterior axillary | wall 36.8 mm, lung 0.0 mm      | wall 58.3 mm, lung 9.0 mm      |

   The two posterior-axillary walls moved by more than 20 mm for a sub-millimetre change of surface:
   the ray from the pleura runs past the arm there, so those two measurements are not dependable.
   The lung depths grew where the space now takes the rim between the lung and the fluid.

5. **The context repeats no face.** Vertex clustering had put two faces on the same three vertices
   (diaphragm 99, heart 5, pulmonary artery 8, skin 13); Blender's re-import found them.
6. **The attribution's wording** in the files now matches `ATTRIBUTION.md`, which now says
   "remeshed or simplified".
7. **`--install-dev`** moved from the two build scripts to the packager, which installs the
   packaged, content-named files the manifest points at.
8. **No rib passes through itself.** Slice 7's simplified ribs did, at a few slivers: 1 to 7 pairs of
   faces in nine of the twelve right ribs, and 11 in the left ribs. Those spots are now smoothed
   until no face passes through another, and the validator checks every rib. The rib numbering is
   unchanged.

## Where this departs from the plan

- **One lung proxy per step, not one proxy morphed.** Plan section 4.5 has the engine morph one
  lung proxy through the steps. One triangulation carried through every step either cut through the
  lung's thin margins or needed more triangles than the budget holds. A proxy built from each step's
  own lung passes every check within it. The engine swaps proxies as the lung steps (slice 10).
- **The lung proxy is offset 2.5 mm, not 1 mm.** At 1 mm, the lung's thinnest margins (a radius near
  1.5 mm) need triangles of about 3 mm along some 600 mm of margin; 0.5 mm of the 2.5 covers the
  error of the voxel field the proxy is meshed from. The space proxy keeps the plan's 1 mm.
- **The lung file is not Draco-compressed.** gltf-pipeline compresses only the base of a mesh with
  morph targets; the positions are quantised to 16 bits instead.
- **The zone samples live in the space proxy's file**, one point primitive per zone, so one
  geometry generation identifies every spatial answer.

## Claims and assets touched

- Claims: MT-C-0001 and MT-C-0002 list the lung-states asset as written. No wording changed and no
  revision was raised. Every decision remains NOT REVIEWED. The depth of the collapse and every value
  of the flow are the author's (MT-C-0002).
- Assets: none in the repository. Ledger rows, not uploaded, for `pleural-space.465b3f983aa8.glb`,
  `ribs.dd18bf62b25c.glb`, `context.ab9834532cfa.glb`, `lung-states.272603d8d95a.glb`,
  `proxy-pleural-space.6c4048f8e9ee.glb`, `proxy-lung.9d7a1a5818da.glb` and the manifest, each with
  its full hash in the ledger.

## Checks run

| Command                                                                                                                                                                                      | Result                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `python3 scripts/medical-thoracoscopy/audit_thorax_sources.py --check`                                                                                                                       | Unchanged                                                                                                                   |
| `python3 scripts/medical-thoracoscopy/build_thorax_surfaces.py`, twice                                                                                                                       | Pleural space and ribs byte-identical; the context changed only by the duplicated faces removed between the runs            |
| `python3 scripts/medical-thoracoscopy/validate_thorax_surfaces.py`                                                                                                                           | 0 failures                                                                                                                  |
| `python3 scripts/medical-thoracoscopy/build_lung_states.py`, twice                                                                                                                           | Every step and blend passes; the second build byte-identical to the first, all three files and all four records             |
| `python3 scripts/medical-thoracoscopy/validate_lung_states.py`                                                                                                                               | 0 failures. With a wrong volume and a wrong proxy triangle count put into the records on purpose: both reported, 2 failures |
| `npx tsx scripts/medical-thoracoscopy/package-anatomy.ts --install-dev`                                                                                                                      | 6 files, 2,564,388 bytes of 3,145,728                                                                                       |
| `Blender --background --factory-startup --python scripts/medical-thoracoscopy/validate_anatomy_blender.py`                                                                                   | 6 files, 0 failures, the lung's nine states each at the record's volume                                                     |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts --check`                                                                                                                           | All pages current                                                                                                           |
| `npx jest src/features/medical-thoracoscopy --runInBand`                                                                                                                                     | 14 suites, 219 tests, all passing                                                                                           |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy scripts/medical-thoracoscopy/*.ts`; `npx prettier --check`; `git diff --check` | Clean                                                                                                                       |

## Real browser observations

Not opened: no page shows the anatomy yet. The scene arrives in slice 11.

## Checks not run

- **The files in a browser**: three.js's reading of the quantised morph targets is expected from
  its loader's support for KHR_mesh_quantization, and checked only in Blender so far. Slice 11.
- **A clinician's look at the collapsed lung** and at the gap at the port (MT-C-0002).
- **The full suite, Storybook and the production build.** The next integration point is slice 14.

## Unresolved decisions

- **MT-C-0001 and MT-C-0002**: the lung falling away, and how far; both await clinical review and
  block publication.
- **The departures above**: one lung proxy per step and its 2.5 mm offset. Yours to accept or send
  back; slice 10 is built on them.
- **T6**: the prototype port, with the table measured again; two posterior-axillary walls are not
  dependable.
- **Rib numbering**, **S3 and S4**, and **whether to commit the anatomy files**, as in slice 7.

## What must not happen next

- Do not commit, upload or publish an anatomy file while R-ANATOMY-SEGMENTATION blocks it.
- Do not change a zone id, the zone list's `split`, or the space's gap fill without rebuilding and
  checking the zones, the proxies and the samples.
- Do not show the collapsed lung, its depth or the fluid level as measured: they are authored.
- Do not describe the prototype port as a safe, recommended or usual site.

This does not change publication status or constitute clinical approval.
