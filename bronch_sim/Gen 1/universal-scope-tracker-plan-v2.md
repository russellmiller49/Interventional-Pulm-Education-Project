# Universal Single-Use Scope Tracker — Engineering Plan v2

**Concept:** A two-module, clip-on, open-hardware kit that turns _any_ disposable bronchoscope into a tracked input device for the interventionalpulm.com simulator — with **zero modification to the scope**. Module A senses the thumb lever (tip flexion); Module B is a pass-through tracker the insertion cord runs through, sensing insertion depth and roll optically. Attach in under a minute, hand the scope back untouched.

**Design rules (non-negotiable):**

1. No adhesive, drilling, or disassembly of the scope — tool-free clamp-on only.
2. Scope-agnostic: per-model fit comes from cheap printed adapters, not redesigns.
3. Phantom-optional: the tracker bolts to a phantom, clamps to a manikin, or sits standalone on a desk.
4. Browser-native: enumerates as a USB HID gamepad (works everywhere) with a Web Serial side-channel for calibration.

---

## 1. System architecture

```
        MODULE A — LEVER MODULE                      MODULE B — CORD TRACKER
   ┌─────────────────────────────┐             ┌────────────────────────────────┐
   │ C-clamp on handle neck      │   I2C cable │ Guide bore (swappable insert)  │
   │ Spring-loaded follower arm  │ ──1.2 m───▶ │ Optical flow sensor under cord │
   │ AS5600 at module hinge      │  (or BLE)   │   Y-axis = insertion depth     │
   │ Printed shoe rides lever    │             │   X-axis = roll                │
   └─────────────┬───────────────┘             │ Photogate auto-zero            │
                 │  scope insertion cord       │ RP2040 + USB-C ──▶ Browser     │
                 └──────────── passes through ▶│ Flange: phantom / manikin /    │
                                               │         desk stand (optional)  │
                                               └────────────────────────────────┘
```

All three bronchoscopy DOFs are captured without touching scope internals:

| DOF             | Sensed by | Where  | Principle                                                                                        |
| --------------- | --------- | ------ | ------------------------------------------------------------------------------------------------ |
| Tip flexion     | Module A  | Handle | Follower arm angle = lever angle (AS5600, 12-bit)                                                |
| Insertion depth | Module B  | Cord   | Optical flow, Y-axis                                                                             |
| Roll            | Module B  | Cord   | Optical flow, X-axis                                                                             |
| Buttons         | Module A  | Handle | 1–2 tactile switches on the module body (the real suction button stays functional and untouched) |

Sensing roll at the cord rather than the handle is _more_ faithful, not less: it measures torque as the airway actually receives it, torsional lag included.

---

## 2. Module A — Lever Module

**Mechanism.** A printed C-clamp closes around the handle neck with a thumbscrew; soft TPU pads grip without marking. The module body carries its own hinge, on which a spring-loaded **follower arm** pivots; a printed **shoe** at the arm's tip rests on (or lightly cups) the thumb lever. A light torsion spring (~0.05 N·m) keeps the shoe in contact through the full lever throw. The encoder measures the _module's own hinge angle_ — the scope is never glued, magnetized, or modified.

**Sensing.** AS5600 magnetic encoder at the hinge with a Ø6×2.5 mm diametric magnet pressed into the follower-arm hub. 12-bit absolute (0.09°), contactless, no wear. Lever throws on disposable scopes are ~±50–60°; map calibrated min/max to ±100% flexion.

**The adapter library is the universality strategy.** Two printed parts vary per scope model — the clamp pads and the lever shoe. Each is a 10-minute print defined by a handful of parameters (neck diameter, lever offset, paddle width). Publish them as a parametric build123d/OpenSCAD library: launch with aScope 4 Broncho profiles (Slim/Regular/Large share a handle), then community-contributed profiles for aScope 5, BFlex, H-SteriScope, ONE Pulmo. A printed "fit gauge" card helps users pick or request a profile.

**Variants.**

- _Wired (v1, default):_ AS5600 I2C runs down a 1.2 m 4-core silicone cable to Module B (100 kHz, twisted pairs, 2.2 kΩ pullups at the tracker end; PCA9615 differential extender as a $4 fallback if ever needed). The cable drapes toward the base exactly like a real umbilical.
- _Wireless (Phase 4):_ ESP32-C3 Super Mini + 250 mAh LiPo + TP4056 charger in the module body (+~$10), pairing to the browser via Web Bluetooth or to Module B via ESP-NOW. Cable-free "clip and go," at the cost of a battery to manage.

---

## 3. Module B — Cord Tracker

**Sensing principle.** The insertion cord passes through two close-fitting guide bores; between them, an optical flow sensor (gaming-mouse class) images the cord surface from ~2.4 mm below through an aperture. Surface motion decomposes natively into **Y = insertion** and **X = roll** — one solid-state sensor, no preload mechanics, no slip-prone friction wheels, and simultaneous push-and-twist is handled by construction. This is the same principle commercial catheter-tracking simulators use.

**Sensor candidates (test both in Phase 0):**

|               | PMW3360                                                                                                                        | PAT9125                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Interface     | SPI                                                                                                                            | I2C                                                                                           |
| Cost (module) | $10–14                                                                                                                         | $4–8                                                                                          |
| Resolution    | up to 12,000 CPI                                                                                                               | up to 1,275 CPI                                                                               |
| Init          | requires SROM firmware blob upload (widely redistributed in open projects, but a licensing gray zone for a clean open release) | none — fully clean                                                                            |
| Prior art     | FPS mice, sim catheter trackers                                                                                                | **Prusa MK3 filament sensor — literally shipped to track a round 1.75 mm filament optically** |

The PAT9125's filament-sensor heritage is the strongest signal this works on a round cord: even at 1,275 CPI it resolves ~0.02 mm of insertion and ~0.4° of roll on a 5 mm cord — far beyond training needs. Default to PAT9125 if Phase 0 tracking is clean; keep PMW3360 as the high-end fallback.

**Mechanical details.**

- **Bore inserts:** swappable printed sleeves (optionally PTFE-lined) covering Ø2.8–6.3 mm cords across brands. Snug enough to hold sensor standoff constant, loose enough not to add felt friction; a leaf-spring or foam wiper opposite the sensor keeps the cord seated against the reference surface.
- **Photogate auto-zero:** an IR photo-interrupter straddles the bore at a known station; the beam-break edge when the tip first passes re-zeros depth every insertion. No magnet in the scope, no manual zeroing, immune to any accumulated optical drift.
- **Cross-check for free:** disposable cords carry printed depth markings; an optional firmware routine detects mark transitions in the optical signal as a periodic sanity check on counts-per-mm calibration.
- **Mounting flange:** one standardized bolt pattern on the exit face. Accessories dock to it: the printed airway phantom's inlet, a manikin adapter, or a simple desk stand. The flange spec is published so anyone can design attachments.
- **Electronics bay:** RP2040 (Pi Pico), USB-C, status LED, calibrate button, and the JST input from Module A all live here. One cable to the computer.

---

## 4. Calibration and signal chain

- **Depth scale:** counts-per-mm is fixed by sensor CPI but verify per build (and per cord finish) with a one-time 100 mm slide against a printed ruler jig; store in flash.
- **Roll scale:** counts-per-degree depends on cord circumference. The bore insert ID implies the diameter, so selecting the insert in the setup wizard sets the scale; a 360° twist against the jig refines it.
- **Auto-zero:** photogate edge → depth = 0 at a known station. Withdrawal past the gate re-arms it.
- **Filtering:** 1-Euro filter per axis in firmware (low lag during fast motion, smooth at rest); ±2-count deadband on depth.
- **Health monitoring:** optical sensors report surface quality (SQUAL); firmware flags low-trackability cords and the UI surfaces it ("clean the cord / try the matte insert").

## 5. Electronics

| Pico pin                 | Net        | Destination                                                                  |
| ------------------------ | ---------- | ---------------------------------------------------------------------------- |
| GP4/GP5 (I2C0)           | SDA/SCL    | Module A cable: AS5600 (+ buttons via PCF8574 or direct GPIO lines in cable) |
| GP6/GP7 (I2C1) _or_ SPI0 | sensor bus | PAT9125 (I2C) or PMW3360 (SPI)                                               |
| GP10                     | PHOTOGATE  | IR interrupter output                                                        |
| GP11                     | BTN_CAL    | Calibrate button                                                             |
| GP16                     | WS2812     | Status LED                                                                   |
| 3V3/GND                  | power      | Both modules; 100 nF at each device, 10 µF at cable entry                    |

Bus power only (<50 mA). v1 on perfboard with JST connectors per subassembly; a JLCPCB run (~$12 for five boards) once the design stabilizes collapses assembly to 20 minutes.

## 6. Firmware

Carries over from v1 (PlatformIO, earlephilhower RP2040 core, dual-core split, 250 Hz sensor loop, flash-stored calibration, UF2 releases via GitHub Actions) with these changes:

- **Optical driver:** PAT9125 = simple I2C polling of delta-X/Y registers at 1 kHz, accumulate in firmware. PMW3360 = SPI motion-burst reads + SROM upload at init (isolate the blob in a clearly-licensed submodule if used).
- **Report content:** flexion (16-bit), roll (accumulated degrees, 16-bit), depth (mm ×10, 16-bit normalized over a configurable span), buttons, SQUAL byte on the serial channel.
- **USB:** composite device unchanged — HID gamepad (universal, zero-permission) + CDC serial (calibration wizard, raw counts, SQUAL).

## 7. Web app integration

Unchanged from v1 in structure — this is the part of the plan that was always scope-agnostic:

- `ScopeInputProvider` abstraction with Gamepad API (runtime, all browsers incl. Safari) and Web Serial (dev + calibration wizard) implementations behind a `useScopeInput()` hook; client-only dynamic imports; HTTPS already satisfied on Vercel.
- **Mapping:** depth → arc-length along the VMTK centerline; branch commit at bifurcations from flexion+roll vector vs child-branch tangents with hysteresis; lever → tip pitch; roll → camera roll. Sensor→screen latency budget ~<30 ms; no extra smoothing in JS.
- **Setup wizard** (`/hardware` route): connect, live bars, insert-size picker (sets roll scale), lever min/max capture, SQUAL indicator, profile stored locally then in Supabase.
- **Real-video companion mode (optional, pairs perfectly):** expired scopes' cameras typically still work; aScope → aView 2 Advance (HDMI/3G-SDI out) → ~$20 UVC capture dongle → `getUserMedia()`. Real intraluminal video of the phantom beside the sensor-driven 3D map view — a poor-man's navigational bronchoscopy rig, plus recording and overlay quizzes.

## 8. Optional phantom (accessory, not prerequisite)

The v1 phantom design carries over intact — CT → Slicer/VMTK segmentation, 2–2.5 mm shelled halves in translucent PETG, screw-together parting plane, smoothed lumen — with one change: its inlet is now just another **flange attachment** for Module B. Same centerline JSON drives the digital twin. Pediatric, distorted-anatomy, and EBUS-node variants all become community-printable accessories on the same flange standard.

## 9. Bill of materials

**Module B — Cord Tracker**

| Item                                             | Cost    |
| ------------------------------------------------ | ------- |
| Raspberry Pi Pico                                | $5      |
| PAT9125 module (or PMW3360: +$8)                 | $6      |
| IR photo-interrupter                             | $1      |
| WS2812 LED, button, perfboard, JST kit, passives | $7      |
| USB-C cable                                      | $3      |
| Printed housing + inserts (~90 g)                | $2      |
| **Subtotal**                                     | **$24** |

**Module A — Lever Module (wired)**

| Item                                          | Cost       |
| --------------------------------------------- | ---------- |
| AS5600 + diametric magnet                     | $4         |
| Torsion spring, thumbscrew, M3 inserts/screws | $4         |
| 1.2 m 4-core silicone cable + JST             | $4         |
| Tactile buttons ×2                            | $1         |
| Printed clamp/arm/shoe/pads (~50 g)           | $1.50      |
| **Subtotal**                                  | **$14.50** |

**Kit total: ≈$40 wired / ≈$50 with BLE lever option.** Scope: free (expired-unused stock). Optional phantom accessory: ~$30–40 in filament and hardware. Optional real-video capture dongle: ~$20. Versus $20k+ commercial trackers, the open-source story writes itself.

## 10. Build phases

**Phase 0 — Tracking validation (1 weekend, ~$15).** PAT9125 and/or PMW3360 dev module + a real aScope cord taped over it. Measure counts-per-mm linearity over 300 mm, roll tracking through 720°, SQUAL across cord brands/finishes, lift-off behavior. _This single experiment retires the project's only real risk._ Exit: clean tracking on ≥1 sensor.

**Phase 1 — Cord tracker v1 (1–2 weekends).** Housing, bore inserts, photogate, firmware, Web Serial into the existing sim. Exit: physical insertion and twist drive the virtual scope.

**Phase 2 — Lever module (1–2 weekends).** Clamp + follower arm for aScope 4, calibration wizard. Exit: all three DOFs live; a fellow can navigate to a named segment virtually.

**Phase 3 — Productize (2 weekends).** HID gamepad mode, flange standard + desk stand + phantom adapter, illustrated build guide, `/hardware` release (CERN-OHL-P + MIT).

**Phase 4 — Extensions.** BLE lever module, dual-sensor differential tracking, real-video companion mode, additional scope profiles, session telemetry → Supabase competency dashboards.

## 11. Risks

| Risk                                        | Likelihood   | Mitigation                                                                                                                                                 |
| ------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optical tracking poor on some cord finishes | **The** risk | Phase 0 tests both sensors on multiple brands; leaf-spring keeps standoff constant; matte-liner insert variant; wheel-encoder module as published fallback |
| Roll scale error from diameter variation    | Medium       | Insert-ID sets scale; 360° jig calibration; cm-marking cross-check                                                                                         |
| Lever shoe fit varies across scope models   | Medium       | Parametric adapter library + fit gauge; community profiles                                                                                                 |
| I2C over 1.2 m lever cable                  | Low          | 100 kHz, twisted pairs, pullups; PCA9615 fallback                                                                                                          |
| Bore friction changes scope feel            | Low          | PTFE liner, generous clearance, friction budget <0.5 N                                                                                                     |
| Classroom durability                        | High         | Heat-set inserts, sacrificial JST connectors, strain reliefs, spare STLs                                                                                   |

## 12. Validation and publication

A validated, scope-agnostic, ~$40 open-hardware bronchoscopy tracker has no published equivalent. Study design writes itself: bench accuracy vs a linear stage and rotary jig; in-phantom agreement vs electromagnetic navigation ground truth (available at NMCSD); face/content validity with PCCM fellows on the virtual-nav task. Targets: _Simulation in Healthcare_, _ATS Scholar_, or _JoBIP_ — and the build guide doubles as the supplement.

## 13. Repo packaging

```
/hardware
  /cad           # build123d/OpenSCAD sources + STEP; /adapters parametric library
  /stl           # housings, inserts, shoes, pads, desk stand, flange spec sheet
  /firmware      # PlatformIO; CI → UF2 releases
  /electronics   # wiring diagram, BOM.csv with links
  /docs          # build guide, calibration guide, scope-profile contribution guide
```

Licenses: firmware/app code MIT; hardware CERN-OHL-P-2.0. The scope-profile contribution guide is the community flywheel — every new disposable scope on the market becomes a pull request, not a redesign.
