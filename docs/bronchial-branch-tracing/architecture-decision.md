# Native stage with separate geometric and clinical evidence

The learning flow reuses the shared stage, NowCard, LookInLine, StepList, module navigation and activity-progress envelope. Feature-owned reducers control answer timing, actual responses and completion; viewers cannot award credit. No new renderer, state library, database, global style or shared-stage fork is introduced.

The exact public-unlisted root is `/learn/anatomy/branch-tracing`; its Learn/Practice/Assess subroutes inherit that policy and metadata. Preview assets under `/branch-tracing/preview-v1` receive noindex headers too. Nothing is registered in the site catalog, search or sitemap. Existing `/learn/anatomy/airway` and `/airway-anatomy/*` gates are unchanged. The owner explicitly authorized this narrow access-policy addition.

Two evidence classes are visible:

- **Synthetic**: explicit RAS-mm polyline/tube phantoms rendered as sampled axial intersections, a rotatable exterior schematic and a parent-view opening diagram. Exact discrete opening positions are geometric teaching assumptions; they are not clinical ostial measurements. Positive display roll is clockwise. The reference is withheld until the branch and opening map are submitted. Practice/Assess mount reference content only after final submission.
- **Existing CT**: one continuous, resampled, quantized preview, its matched source surface and graph. New PNGs are deterministic derivatives of an already-public uint8 volume. A self-contained GLB exposes only the complete airway node and mesh, with named branch nodes and materials removed. The compressed geometry buffer is preserved byte-for-byte. The browser applies the existing patient-new transform, welds duplicate vertices for normals without smoothing positions, and checks the exact derivative SHA. Camera movement follows polyline arc length; CT scrolling is independent. No candidate labels, target route, scored ostium or claim of source HU is exported.

All preview assets live under `/branch-tracing/preview-v1` and are included by the existing standalone packager. This avoids depending on the separate remote-asset fallback used for `fluoroview/cases`. The existing public Draco decoder remains shared. The deterministic package contains 6,414,026 bytes of image, model and graph assets; the surface derivative SHA is `24edef81dd18f10ea2c45b548a2410c54b9b5c5685e4fe221997b0534f3577f9`. Full hashes and sizes are in its manifest.

There is one progress store: the site's bounded activity envelope. Namespaced version IDs separate new content/assets/rubric from historical attempts. Each committed branch and completed map records first-attempt domain results exactly once, including hint use. Completion comes after a submitted transfer and manual Finish. Restart/reload preserves history and restarts incomplete work; old graph state is never restored. Route/sketch coordinates are session state. Explicit learner route export is local and is not analytics.

Reference host inspected: mechanical ventilation `VentilationStageHost`, base commit `7da3886e`, with the current shared StageLayout. Opening fractions 0.26/0.29, floors 300/280/340 and Steps → Teaching → Simulator are explicit. The feature wrapper supplies the viewport sizing that a non-critical-care route needs.

Authoring tools can later populate a reviewed clinical case contract. They cannot silently promote candidate labels or synthetic exercises into clinical assessment. The clinical worksheet lists the exact remaining decisions.
