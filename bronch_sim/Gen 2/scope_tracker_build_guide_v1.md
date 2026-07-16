# Universal Scope Tracker — Build & Bring-Up Guide (v1)

**Date:** July 2026 · **Hardware plan:** `universal_scope_tracker_plan_v4.md` (same folder)
**Training-only device. Never used for patient care.**

This is the bench-side reference for turning the v4 plan into a working controller once
parts arrive. The **web side is already built and verified** — both simulators poll for
the tracker on every frame, and a setup/diagnostics page is live. The firmware you write
just has to speak the contract, and everything lights up.

---

## 0. Current status — what exists, what you are building

| Layer                                                                                      | Status                                | Where                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| HID + serial contract                                                                      | ✅ authoritative, frozen              | `docs/scope-tracker-web-contract.md` (main site repo)                                           |
| Shared input library (decode, unwrap, profiles)                                            | ✅ built + unit-tested                | `src/lib/scope-input/core/` (vendored into both sims by `npm run sync:scope-input`)             |
| `/hardware` setup page (live bars, calibration profiles, Web Serial diagnostics, emulator) | ✅ live                               | `interventionalpulm.org/en/hardware` (or `localhost:3001/en/hardware`)                          |
| Bronch Navigation Trainer integration                                                      | ✅ verified with emulated device      | depth → drive, lever+roll → live steer, aim-and-press-A branch choice                           |
| EBUS simulator integration                                                                 | ✅ verified with emulated device      | depth → advance, roll → probe roll, lever → flexion, A=balloon, B=see-through, C/D=branch steer |
| Printable parts (9 STLs)                                                                   | ✅ generated, watertight, fit-checked | `cad/stl/` (parametric source `cad/scope_tracker_cad.py`)                                       |
| RP2040 firmware                                                                            | ⬜ **you build this**                 | §6 below                                                                                        |
| Physical assembly + calibration                                                            | ⬜ **you build this**                 | §4–§8 below                                                                                     |

**The one rule:** if firmware and this guide ever disagree with
`docs/scope-tracker-web-contract.md`, the contract wins. Change the contract first, then
both sides.

---

## 1. Bill of materials — receiving checklist

Prototype target ≈ $100–180 (plan §14). Check items off as they arrive.

### Electronics

- [ ] **Raspberry Pi Pico** (RP2040, native USB). Any RP2040 board works; a USB-C variant is nicer at the desk. You may want 2 (one spare / one for bench rig).
- [ ] **PAT9125EL optical flow breakout** — e.g. the Pimoroni PAT9125 breakout or a Prusa MK3 filament-sensor board. This is the depth+roll sensor. (Fallback if Phase 0 fails: PMW3360 module — bigger, SPI.)
- [ ] **2× PCA9615 differential-I²C breakouts** (e.g. SparkFun's) — one per module, they convert the lever bus to differential pairs for the 1.2 m cable.
- [ ] **AS5600 breakout** + **Ø6 × 2.5 mm diametric magnet** (must be _diametrically_ magnetized — axial ones won't work).
- [ ] **MCP23008 (or PCF8574) I²C GPIO expander breakout** — reads the Module A buttons over the same lever bus. _Optional for first light; buttons can come later._
- [ ] **3 mm IR LED + 3 mm IR phototransistor** (through-beam photogate pair) + 150 Ω and 10 kΩ resistors.
- [ ] **2× 7 mm panel-mount momentary switches** (buttons A/B; C/D can share the expander later).
- [ ] **6-conductor shielded cable, ~1.2 m, with two twisted pairs** (alarm/security cable works; so does a length of Cat5 inside braid) + **JST-GH or JST-XH 6-pin** connector set.
- [ ] 4.7 kΩ resistors ×4 (I²C pull-ups — only if your breakouts don't already have them; the SparkFun PCA9615 board does).

### Mechanical

- [ ] M3 screws: ~10× 10–12 mm (lid, jig, flange/stand), 2× 16 mm (clamp halves), 1× 30 mm + nyloc nut (follower axle). M3 washers.
- [ ] M2 × 5 mm self-tapping screws ×6 (sensor + Pico + PCA boards into printed bosses).
- [ ] **Felt sheet 3–4 mm** (polyester) _and_ high-density open-cell PU foam — Phase 0 compares both as wiper material (plan §6.2).
- [ ] **EVA foam 3 mm adhesive-backed** (compliant cap pad in the lid + bench-jig clamp).
- [ ] Moleskin or TPU strip (clamp pad lining), rubber bands or a small torsion spring (follower preload), zip ties.
- [ ] Silicone lubricant (the kind used in your sim lab) — needed for the _wet_ Phase 0 tests.
- [ ] The target scope: one **Ambu aScope 4/5** family member you'll standardize on (plan §3).

### Tools

Calipers (mandatory — several printed dimensions must be tuned to _your_ scope and boards), soldering iron, M2/M3 drivers, 300 mm ruler, a protractor or printed degree wheel for the roll jig.

---

## 2. Printed parts

Everything lives in `cad/`. STLs are ready to slice; `scope_tracker_cad.py` regenerates
them if you change a parameter:

```bash
cd "bronch_sim/Gen 2/cad"
python3 -m venv cadenv && ./cadenv/bin/pip install trimesh manifold3d numpy shapely matplotlib
./cadenv/bin/python scope_tracker_cad.py     # STLs -> stl/, previews -> preview/
```

### Measure FIRST, then (maybe) regenerate

Open `PARAMS` at the top of the script. The defaults assume an aScope-4-regular-like
scope; verify before printing the big parts:

| Parameter             | Default | Measure on                                           |
| --------------------- | ------- | ---------------------------------------------------- |
| `cord_od`             | 5.0     | insertion cord OD (slim ≈ 3.8, large ≈ 5.8)          |
| `handle_neck_od`      | 22.0    | the cylindrical neck where the Module A clamp seats  |
| `sensor_hole_spacing` | 17.0    | your PAT9125 breakout's mounting holes               |
| `sensor_surface_gap`  | 1.0     | PAT9125 focus height — tune in Phase 0 with shims    |
| `v_angle_deg`         | 100     | print 90 / 100 / 120 jig variants if Phase 0 wobbles |

### Part list & print settings

| STL                       | What it is                                                                                            | Print notes                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `bench_jig_base`          | **PRINT FIRST.** Phase 0 V-groove + PAT9125 pocket block                                              | PETG, 0.2 mm, 4 walls, 40 % infill                                                                                                 |
| `bench_jig_clamp`         | foam-padded clamp bar for the jig                                                                     | same                                                                                                                               |
| `module_b_base`           | tracker lower half: funnel → wiper slot → photogate → V-groove/sensor → flange, plus electronics tray | as exported (flat). The sensor cavity ceiling is a ~24 mm bridge — enable bridging cooling or paint-on supports in the cavity only |
| `module_b_lid`            | clamshell upper half (exported upside-down = correct orientation)                                     | no supports                                                                                                                        |
| `module_b_wiper_cassette` | C-slotted felt carrier — **print 3–4**, they're consumable holders                                    | 100 % infill is fine, it's tiny                                                                                                    |
| `module_a_clamp`          | handle-half: ring + lug pair + sensor tower/ears + button wing                                        | no supports needed (ears are full-height legs)                                                                                     |
| `module_a_clamp_cap`      | plain ring half with counterbored M3s                                                                 | prints on its flat split face                                                                                                      |
| `module_a_follower`       | lever follower arm: hub + magnet pocket + roller shoe                                                 | flat as exported                                                                                                                   |
| `desk_stand`              | flange holder for desk driving without a phantom                                                      | 20 % infill                                                                                                                        |

Material: **PETG or ASA** (plan §6.3). If V-groove friction is high after testing, the
insert surface can be smoothed (fine sanding + a wipe of PTFE dry lube).

Fit checks after printing: M3 self-taps bite firmly in the pilot holes (drill to 2.8 mm
if cracking), the wiper cassette slides into its slot with light friction, the flange
bolts to the desk stand, the follower hub spins freely on an M3 between the ears.

---

## 3. Recommended build order

Follows plan §11. Do not skip Phase 0 — it exists because lubricated-cord optical
tracking is the single biggest project risk.

1. **Phase 0 — bench jig** (§4): prove PAT9125 tracks the real cord, dry AND lubricated, and pick the wiper material. _Exit:_ thresholds in §8 table.
2. **Phase 1 — Module B alpha** (§5.2 + §6): full clamshell, depth+roll on the `/hardware` live bars.
3. **Phase 2 — Module A + cable** (§5.1): lever angle stable over the moving cable for 30 min.
4. **Phase 3 — integrated HID** (§7): all 3 DOF drive both simulators, latency feels < 30 ms.
5. **Phase 4 — robustness**: attach/detach cycles, wiper swaps, another user runs it cold using only the `/hardware` page.

---

## 4. Phase 0 — optical de-risking on the bench jig

Wiring (jig uses the Pico directly, no cable/PCA9615 yet):

| PAT9125 breakout | Pico                           |
| ---------------- | ------------------------------ |
| VCC              | 3V3 (pin 36)                   |
| GND              | GND                            |
| SDA              | GP2 (I²C1 SDA, physical pin 4) |
| SCL              | GP3 (I²C1 SCL, physical pin 5) |

1. Screw the PAT9125 into the jig cavity (chip up, aperture centered under the optical slot).
2. Lay a **sacrificial/expired scope cord** in the V-groove, foam side of the clamp bar down, snug but not crushing.
3. Flash the firmware in **serial-only mode** (§6.7) and open the `/hardware` page → _Serial diagnostics_ → Connect. You should see `state` messages with `dx/dy/squal` streaming.
4. Run the test matrix, logging from the serial console:

| Test           | Method                                                                                             | Pass                                                       |
| -------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Dry depth      | pull cord 300 mm along a ruler, 10×                                                                | ≤ ±5 mm error, ≤ ±3 mm repeatability                       |
| Dry roll       | rotate cord 360° against a degree wheel, 10×                                                       | ≤ ±10–15°                                                  |
| Helical        | insert + rotate together                                                                           | cross-coupling correctable by the 2×2 matrix (§8)          |
| **Lubricated** | silicone-lube the cord, repeat depth test **with felt wiper taped upstream**, then with foam wiper | no catastrophic drift; quality metric recovers after wiper |
| Drop-outs      | watch `squal` during fast strokes                                                                  | < 1 % of samples flagged                                   |
| Force          | spring scale on the cord                                                                           | added drag < 0.5 N                                         |

Tune `sensor_surface_gap` by shimming the breakout ±0.3 mm for maximum surface quality;
if you re-print, update the parameter. If the PAT9125 simply won't track your cord
finish after wiper + standoff tuning, the fallback path is PMW3360 (SPI) — the body
cavity is parametric, and the _web side does not change at all_.

---

## 5. Full wiring

### 5.1 Module A (lever module)

Local single-ended I²C, kept short, then out through PCA9615-A:

| Device    | Addr         | Notes                                                                                                                                      |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AS5600    | 0x36 (fixed) | board in the ear pocket, chip centered on the axle; diametric magnet in the follower hub, ~1–2.5 mm air gap through the 1.2 mm printed web |
| MCP23008  | 0x20         | buttons A–D between GP0–GP3 and GND, internal pull-ups enabled                                                                             |
| PCA9615-A | —            | local side to AS5600/MCP23008; differential side to the cable                                                                              |

Buttons A/B mount in the 7.2 mm wing holes; the PCA9615-A board zip-ties to the tower
slots. Line the clamp ring with moleskin/TPU, close the two halves around the handle
neck with 2× M3×16 — **never adhesive on the scope** (plan §2). Follower shoe rests on
the thumb lever with a rubber band from the arm post to the tower anchor hole for gentle
preload.

### 5.2 The 1.2 m cable (JST-GH 6-pin, both ends keyed)

| Pin | Signal | Wire                                                             |
| --- | ------ | ---------------------------------------------------------------- |
| 1   | 3V3    | power conductor                                                  |
| 2   | GND    | power conductor + shield (terminate shield **at Module B only**) |
| 3   | DSDA+  | twisted pair 1                                                   |
| 4   | DSDA−  | twisted pair 1                                                   |
| 5   | DSCL+  | twisted pair 2                                                   |
| 6   | DSCL−  | twisted pair 2                                                   |

### 5.3 Module B (cord tracker) — Pico pin map

| Pico pin         | Net                   | Goes to                                                                                                           |
| ---------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GP4 / GP5 (I²C0) | lever bus             | PCA9615-B local side                                                                                              |
| GP2 / GP3 (I²C1) | optical bus           | PAT9125                                                                                                           |
| GP6              | photogate input       | phototransistor collector (emitter→GND, 10 kΩ to 3V3 or internal pull-up). Beam blocked (cord present) → **high** |
| GP7              | calibrate button      | momentary to GND, internal pull-up                                                                                |
| GP16/17/18       | status RGB (optional) | LED + resistors; onboard LED works to start                                                                       |
| 3V3 / GND        | power                 | both sensor boards + cable pin 1/2                                                                                |
| USB              | HID + CDC             | to the computer                                                                                                   |

IR LED for the photogate lives in the lid pocket: 3V3 → 150 Ω → LED → GND, wires in the
lid's top groove. Phototransistor sits in the base pocket directly beneath it.

---

## 6. Firmware — implementing the contract

Everything normative is in `docs/scope-tracker-web-contract.md`; this section is the
practical translation. Recommended path: **CircuitPython 9+ for bring-up** (fastest to
iterate, both USB interfaces trivial), port the loop to C/pico-sdk later only if you
need the full 250 Hz (CircuitPython typically sustains ~100–150 Hz here, which already
feels instant in the sims).

### 6.1 USB identity (contract §2)

```python
# boot.py
import supervisor, usb_hid, usb_cdc

supervisor.set_usb_identification(
    manufacturer="IP Lab",
    product="IP ScopeTracker v4",   # MUST contain "ScopeTracker" - this is how the web finds you
    vid=0x2E8A,                     # Raspberry Pi
    pid=0x10C0,                     # any unused PID in the vendor space is fine for dev
)

GAMEPAD_REPORT_DESCRIPTOR = bytes((
    0x05, 0x01,        # Usage Page (Generic Desktop)
    0x09, 0x05,        # Usage (Gamepad)
    0xA1, 0x01,        # Collection (Application)
    0x85, 0x01,        #   Report ID (1)
    0x05, 0x09,        #   Usage Page (Button)
    0x19, 0x01, 0x29, 0x08,          # buttons 1..8
    0x15, 0x00, 0x25, 0x01,          # logical 0..1
    0x75, 0x01, 0x95, 0x08,          # 1 bit x 8
    0x81, 0x02,        #   Input (Data,Var,Abs)
    0x05, 0x01,        #   Usage Page (Generic Desktop)
    0x09, 0x30, 0x09, 0x31, 0x09, 0x32, 0x09, 0x35,   # X, Y, Z, Rz
    0x16, 0x01, 0x80,  #   logical min -32767
    0x26, 0xFF, 0x7F,  #   logical max  32767
    0x75, 0x10, 0x95, 0x04,          # 16 bit x 4
    0x81, 0x02,        #   Input (Data,Var,Abs)
    0xC0,              # End Collection
))

gamepad = usb_hid.Device(
    report_descriptor=GAMEPAD_REPORT_DESCRIPTOR,
    usage_page=0x01, usage=0x05,
    report_ids=(1,), in_report_lengths=(9,), out_report_lengths=(0,),
)
usb_hid.enable((gamepad,))
usb_cdc.enable(console=True, data=True)   # console = REPL, data = the JSON protocol
```

Axis order X, Y, Z, Rz ⇒ browser `axes[0..3]` = flexion, depth, sin(roll), cos(roll).

### 6.2 Axis encodings (contract §3.1 — copy exactly)

```python
def encode_axis(v):                    # -1.0..1.0 -> int16
    return max(-32767, min(32767, int(v * 32767)))

flex_axis  = encode_axis(flexion_norm)                     # +1 = tip toward image-up
depth_axis = encode_axis((min(max(depth_mm, 0), 1024) / 1024) * 2 - 1)
sin_axis   = encode_axis(math.sin(roll_rad))
cos_axis   = encode_axis(math.cos(roll_rad))
```

Button byte, bit = index (contract §3.2): 0=A 1=B 2=C 3=D 4=calibrate,
**5=photogate 6=lowQuality 7=fault** (5–7 are firmware status flags, not switches).

Report: `struct.pack("<B4h", buttons_byte, flex_axis, depth_axis, sin_axis, cos_axis)`
sent with `gamepad.send_report(payload, 1)` — 9 bytes, report id 1.

### 6.3 Sensors

- **AS5600** (lever): raw angle = reg `0x0C/0x0D` (12-bit). Map with the calibrated
  `lever.min / neutral / max` (§8.1) to −1…+1, neutral → 0.0.
- **PAT9125** (cord): verify `Product_ID1 (0x00) == 0x31`. Motion regs: `0x02` motion
  flag, `0x03/0x04` ΔX/ΔY low bytes, `0x12` shared high nibbles; set resolution via
  `0x0D/0x0E`. I²C address is strap-dependent (commonly 0x75; scan the bus). Quality
  proxy: `FRAME (0x17)` average brightness + `SHUTTER (0x14)` — scale to the contract's
  0-100 `squal` (e.g. `squal = frame * 100 // 255`, gate at `squal_min`, default 40).
- **Depth/roll math** (contract + plan §9.2): accumulate counts, then
  `[depth_mm, roll_deg] = M @ [dy_counts, dx_counts]` with the calibrated 2×2 `M`.
  Keep an _unbounded_ accumulated `roll_deg` for serial debug; HID gets sin/cos of it.

### 6.4 Main loop shape

```python
while True:
    now = supervisor.ticks_ms()
    read_pat9125_deltas()             # every pass, ~as fast as possible
    if time_for(lever, 4):            # ~250 Hz lever
        read_as5600(); read_buttons()
    integrate_matrix(); update_quality_flags()
    if time_for(hid, 8):              # ~125 Hz HID (contract: 125-250 Hz)
        gamepad.send_report(build_report(), 1)
    if streaming and time_for(serial, 1000 // stream_hz):
        usb_cdc.data.write(state_json() + b"\n")
    poll_serial_commands()            # newline-delimited JSON in, §6.5
    poll_calibrate_button()           # short press = zero depth, long = zero all
```

### 6.5 Serial protocol (contract §4)

Implement at minimum: reply `hello`, honor `stream {on, hz}`, `zero {what}`,
`get_cfg`/`set_cfg`/`save_cfg` (persist matrix + lever endpoints + squal_min to NVM/flash),
`cal {maneuver}` for `depth_100mm` / `roll_360` / `lever`, and `wiper_reset`. Unknown
`cmd` → `{"t":"err",...}`. Unknown _fields_ must be ignored. The `/hardware` page's
Serial panel is your test harness for all of this — every button there maps 1:1 to a
command.

### 6.6 Zero semantics (contract §3.3)

Depth zero at power-on, calibrate button, or `zero` command; **auto-zero must never fire
while depth > 50 mm**. Web consumes deltas, so a re-zero appears as one big jump the web
suppresses (limits: 200 mm / 90° per frame) — no special handling needed beyond that.

### 6.7 Serial-only mode (Phase 0)

For the bench jig, skip HID: just stream `state` JSON at 20–50 Hz with raw `dx/dy/squal`
and log. The web Serial panel and any terminal can capture it. Add HID in Phase 1.

---

## 7. First connection to the web app

1. Plug in Module B over USB. **Press any tracker button once** — browsers only expose a
   gamepad after a button press (this will be the #1 "it doesn't work" cause forever).
2. Open `/en/hardware`. _Connection & live signals_ should flip to **Connected** with
   your device id string. Flexion bar, depth mm, roll dial move with the hardware.
3. Sanity-check signs against the cheat sheet (contract §8): insert deeper → depth up;
   clockwise roll (looking toward the tip) → dial clockwise; lever toward tip-up → bar right.
   Wrong direction? Fix in firmware if it's a wiring/orientation truth, or flip the
   invert toggles in the _Calibration profile_ panel if it's user preference.
4. _Serial diagnostics_ → Connect (pick the **data** CDC interface, usually the second
   one) → live SQUAL, raw depth/roll, wiper counter, zero buttons.
5. Open the **Bronch Navigation Trainer** page — topbar chip should read _Scope
   connected_. Place a target, go to Practice, and drive: push = advance, lever+roll =
   steer, aim the crosshair at a branch label and press **A** (or just push ~4 mm) to
   commit. B = deselect/pause, C/D = cycle options (practice only).
6. Open the **SoCal EBUS course** simulator — control-rail chip _Scope connected_.
   Push/pull = advance/retract, roll = probe roll (±180° end stops are intentional),
   lever = flexion, **A** = balloon, **B** = see-through wall, **C/D** = branch steer in
   free drive.
7. No hardware handy? The `/hardware` _Emulator_ panel drives the identical pipeline —
   useful to confirm any weirdness is hardware, not web.

Profiles (deadzone, trims, gains, invert, device pinning) are saved per-browser and
picked up **live** by both simulators — no reload needed.

---

## 8. Calibration

### 8.1 Device-side (persists in firmware flash)

1. **Lever endpoints** — `cal lever` (or the guided flow you build): capture AS5600 raw
   at full tip-down, neutral (hands off), full tip-up → store min/neutral/max.
2. **Depth scale** — `cal depth_100mm`: pull exactly 100 mm along a ruler; firmware
   computes counts/mm.
3. **Roll scale** — `cal roll_360`: one full rotation against a degree wheel.
4. **Cross-coupling** — helical move; solve the 2×2 matrix so pure insertion produces
   < 1° apparent roll and pure roll < 1 mm apparent depth. Reject and retry if the
   helical residual exceeds ~5 mm / 10° (plan §9.4).
5. `save_cfg`, then re-verify with a second 100 mm pull and 360° turn.

### 8.2 Web-side (per user/browser, `/hardware` → Calibration profile)

Capture-neutral for lever trim, deadzone ≈ 0.04, expo to taste, depth/roll gain 1.0
(leave gains alone unless a sim's feel demands it), invert toggles, and _Pin connected
device_ once you're on final hardware so auto-detect never grabs a random gamepad.

### 8.3 Acceptance (Phase 3/4 exit — from plan §11)

- [ ] 300 mm insert error ≤ ±5 mm, repeatability ≤ ±3 mm ×10 cycles
- [ ] 360° roll error ≤ ±10–15°
- [ ] Lubricated cord passes after a wiper pass, no drift
- [ ] Added insertion force < 0.5 N
- [ ] Dropouts < 1 % during realistic motion
- [ ] 30 min continuous use, moving cable, zero lever-bus lockups
- [ ] Both simulators driven end-to-end; perceived latency < 30 ms
- [ ] Attach → calibrate → drive in under 2 minutes by someone who isn't you

---

## 9. Troubleshooting

| Symptom                             | Likely cause → fix                                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No gamepad in browser               | Nobody pressed a button yet → press one. Still nothing: check `chrome://device-log`, confirm product string contains `ScopeTracker`, confirm 9-byte report with id 1 |
| Gamepad appears but bars frozen     | Report descriptor/order mismatch — verify X,Y,Z,Rz axes and `<B4h` packing                                                                                           |
| Roll dial says "not valid"          | sin/cos axes not being driven (hypot < 0.5) — you're sending zeros; check the math                                                                                   |
| Depth moves the wrong way / too far | Sign or counts/mm off → redo §8.1 depth cal; user-level flip lives in the web profile                                                                                |
| Depth creeps at rest                | Optical noise → raise web profile noise gate slightly (0.05→0.1 mm); check cord isn't vibrating against the cap foam                                                 |
| SQUAL collapses when lubed          | Wiper worn/saturated → swap cassette felt (then _Serial → Wiper replaced_); also re-check `sensor_surface_gap`                                                       |
| Lever freezes, depth fine           | Lever I²C bus lockup — firmware should bus-recover + log; check cable pairs/shield, PCA9615 on both ends powered                                                     |
| Web Serial can't connect            | Chrome/Edge desktop only, page must be `localhost` or HTTPS, pick the **data** CDC interface, close other terminal apps holding the port                             |
| Sims ignore hardware                | Their toggle is on by default — check the chip in the trainer topbar / EBUS control rail says _Scope connected_; same browser profile as `/hardware`?                |
| Everything works, feel is "notchy"  | Increase HID rate toward 250 Hz, verify you send a report every cycle (not only on change)                                                                           |

---

## 10. Quick reference card

**HID:** axes `[flexion −1..1, depth (mm/1024)·2−1, sin(roll), cos(roll)]` ·
buttons `[A,B,C,D,CAL,gate,lowQ,fault]` · 16-bit axes, report id 1, 125–250 Hz ·
product string contains **ScopeTracker**, VID 0x2E8A.

**Serial (newline JSON):** `hello` · `stream{on,hz}` · `zero{what:depth|roll|all}` ·
`get_cfg` / `set_cfg{matrix,lever,squal_min}` / `save_cfg` · `cal{maneuver}` ·
`cal_abort` · `wiper_reset` → device answers `hello/state/ack/err/cfg/cal`.

**Signs:** insert deeper ⇒ depth ↑ · clockwise roll (operator view, looking distally) ⇒
roll ↑ · lever toward image-up ⇒ flexion +.

**Web entry points:** `/en/hardware` (setup) · `/en/bronch-navigation-trainer` ·
`/en/socal-ebus-course` → Simulator.
