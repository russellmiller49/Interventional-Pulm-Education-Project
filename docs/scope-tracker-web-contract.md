# Universal Scope Tracker — Firmware ↔ Web Contract (v1)

**Status:** Authoritative interface contract for the hardware described in
`bronch_sim/Gen 2/universal_scope_tracker_plan_v4.md`.
The web side (this repo + the two embedded simulator repos) is implemented against this
contract **before** the firmware exists. When the RP2040 firmware is written, it must
implement exactly what is specified here (or this document must be revised first, then
both sides updated together).

**Consumers**

| Consumer                         | Repo                                                              | Uses                                             |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| `/[locale]/hardware` setup route | this repo (`src/lib/scope-input`, `src/components/scope-tracker`) | HID runtime + Web Serial diagnostics/calibration |
| Bronch Navigation Trainer        | `../navigation_module/web` (vendored `src/scope-input/`)          | HID runtime only                                 |
| SoCal EBUS simulator             | `../EBUS-course/apps/web` (vendored `src/lib/scope-input/`)       | HID runtime only                                 |

The canonical TypeScript implementation of this contract lives in
`src/lib/scope-input/core/` in this repo and is copied into the two Vite repos by
`npm run sync:scope-input` (also invoked automatically by both embed sync scripts).
**Never edit the vendored copies.**

---

## 1. Transport model

- **Runtime input:** USB HID gamepad (Gamepad API in the browser). One synchronized
  report stream carries all three DOFs + buttons, fused in Module B firmware
  (plan v4 §4, §9.3).
- **Calibration / diagnostics:** USB CDC serial (Web Serial API), newline-delimited
  JSON (§4 below). Runtime never depends on serial; a user who only plugs in and
  presses a button gets full simulator control from HID alone.
- **No BLE.** Removed in plan v4.

## 2. Device identity

- MCU: RP2040 (TinyUSB composite device: HID gamepad + CDC serial).
- USB VID `0x2E8A` (Raspberry Pi). PID: any unassigned value from the vendor space.
- **USB product string MUST contain `ScopeTracker`** (case-insensitive, e.g.
  `IP ScopeTracker v4`). Chromium exposes gamepad ids like
  `IP ScopeTracker v4 (Vendor: 2e8a Product: 000a)`.

Web-side device matching precedence (implemented in `core/detect.ts`):

1. Explicit `gamepad.id` string saved in the active profile (manual pick in `/hardware`).
2. `/scope[\s_-]?tracker/i` test against `gamepad.id`.
3. Fallback heuristic: id contains vendor `2e8a` **and** the pad reports ≥ 4 axes and
   ≥ 8 buttons. (Lets pre-release firmware without the product string still work.)

## 3. HID gamepad report

16-bit logical axes, report rate 125–250 Hz (plan v4 §9.1). The browser normalizes each
axis to a float in **[-1, +1]**; everything below is specified in browser-normalized units.

### 3.1 Axes

| Index | Name            | Encoding                                         | Notes                                                                                                                                                                                                                                                            |
| ----- | --------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Flexion         | `-1 … +1`                                        | `+1` = tip fully deflected toward **image-up** (anterior with neutral roll). `-1` = fully down. Firmware maps calibrated lever min/neutral/max onto this range; neutral lever ⇒ `0.0`.                                                                           |
| 1     | Insertion depth | `axis = clamp(depth_mm, 0, 1024) / 1024 * 2 − 1` | `depth_mm` is absolute insertion since the last depth zero (flange plane). Full scale **1024 mm**; 16-bit ⇒ ~0.03 mm resolution. Values behind the zero plane clamp to `-1`.                                                                                     |
| 2     | `sin(roll)`     | `-1 … +1`                                        | Roll is the rotation of the cord about the insertion axis. **Positive = clockwise as seen by the operator looking along the insertion direction (proximal → distal).** `roll = 0` at the position held during roll zero.                                         |
| 3     | `cos(roll)`     | `-1 … +1`                                        | At `roll = 0`: axis2 = 0, axis3 = +1. Web reconstructs `roll = atan2(axis2, axis3)` and unwraps to a continuous angle. If `hypot(axis2, axis3) < 0.5` the web treats roll as **invalid** (device not ready / not a scope tracker) and holds the last good value. |

Why sin/cos: gamepad axes are bounded, roll is not; the pair wraps cleanly with no
discontinuity and lets the web accumulate unlimited continuous roll (plan v4 §9.3).

### 3.2 Buttons

| Index | Name         | Type       | Meaning                                                                                                                                           |
| ----- | ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `a`          | momentary  | Module A tactile button 1 (primary simulator action).                                                                                             |
| 1     | `b`          | momentary  | Module A tactile button 2.                                                                                                                        |
| 2     | `c`          | momentary  | Module A tactile button 3.                                                                                                                        |
| 3     | `d`          | momentary  | Module A tactile button 4.                                                                                                                        |
| 4     | `calibrate`  | momentary  | Module B calibrate/zero button (also handled inside firmware; exposed so UIs can react).                                                          |
| 5     | `photogate`  | **status** | `1` = cord present at the gate (tip has passed the zero plane).                                                                                   |
| 6     | `lowQuality` | **status** | `1` = SQUAL below threshold or dropout rate above threshold (plan v4 §7.2). Runtime shows the "replace wiper / wipe cord / check insert" warning. |
| 7     | `fault`      | **status** | `1` = hardware fault latched (lever I²C bus down, optical sensor init failure, …). Details available over serial.                                 |

Status "buttons" are firmware-driven flags, never user presses. Web code must not
treat indexes 5–7 as user input.

### 3.3 Zero semantics

- **Depth zero:** set at power-on, by the Module B calibrate button, or by serial
  `{"cmd":"zero","what":"depth"}`. Firmware may also auto-suggest zero from the
  photogate edge; auto-zero must never fire while `depth_mm > 50`.
- **Roll zero:** set at power-on and by `{"cmd":"zero","what":"roll"}` (or `"all"`).
- Simulators consume depth/roll as **deltas** between frames (see §6), so a re-zero
  mid-session shows up as one large jump; the web delta tracker suppresses any
  single-frame depth jump > 200 mm or roll jump > 90° and resynchronizes instead.

## 4. Web Serial (CDC) protocol

Newline-delimited JSON (`\n` terminated, UTF-8, one object per line, ≤ 512 bytes).
Nominal 115200 baud (ignored by CDC). Protocol version: **1**.

### 4.1 Device → host

```jsonc
{"t":"hello","proto":1,"fw":"0.1.0","dev":"scope-tracker","hw":"v4"}
// on connect and in reply to {"cmd":"hello"}

{"t":"state","ms":123456,"depth_mm":142.6,"roll_deg":412.5,"flex":0.31,
 "lever_deg":18.2,"squal":78,"dx":-3,"dy":118,"gate":1,"btn":3,
 "wiper":14,"fault":0}
// telemetry at the rate set by "stream" (default 20 Hz). roll_deg is RAW ACCUMULATED
// (unbounded) roll for debugging; btn/fault are bitmasks matching §3.2 indexes 0-4 / fault bits.

{"t":"ack","cmd":"zero","ok":true}
{"t":"err","cmd":"set_cfg","msg":"matrix rejected: helical residual 9.1mm"}

{"t":"cfg","matrix":[1.02,-0.011,0.004,0.98],"lever":{"min":-42.0,"neutral":0.0,"max":38.5},
 "squal_min":40,"wiper_limit":25,"wiper":14}
// reply to get_cfg / after set_cfg

{"t":"cal","maneuver":"depth_100mm","phase":"capturing","samples":812}
{"t":"cal","maneuver":"depth_100mm","phase":"done","result":{"counts_per_mm":102.4}}
// guided-calibration progress (plan v4 §9.2 maneuvers)
```

### 4.2 Host → device

```jsonc
{"cmd":"hello"}
{"cmd":"stream","on":true,"hz":20}          // hz 1..100
{"cmd":"zero","what":"depth"}               // "depth" | "roll" | "all"
{"cmd":"get_cfg"}
{"cmd":"set_cfg","matrix":[1,0,0,1],"lever":{"min":-42,"neutral":0,"max":38.5},"squal_min":40}
{"cmd":"save_cfg"}                          // persist to flash/EEPROM
{"cmd":"cal","maneuver":"depth_100mm"}      // "depth_100mm" | "roll_360" | "helical" | "lever"
{"cmd":"cal_abort"}
{"cmd":"wiper_reset"}                       // after replacing the wiper cassette
```

Unknown fields must be ignored by both sides; unknown `cmd` gets `{"t":"err",...}`.
This lets either side add fields without a version bump.

## 5. Web-side calibration profile (localStorage)

Device-level calibration (2×2 optical matrix, lever endpoints) lives **in firmware**.
The web profile stores per-user/per-sim shaping only. Canonical schema + defaults:
`core/profile.ts`. Storage (per browser origin):

- `scopeTracker.profiles.v1` — JSON array of profiles.
- `scopeTracker.activeProfileId.v1` — id of the active profile.
- Changes are broadcast on `BroadcastChannel("scope-tracker")` as
  `{"type":"profiles-updated"}` so same-origin iframes (both embedded sims) pick up
  edits from `/hardware` live. Sims must also work with no stored profile
  (built-in defaults).

```jsonc
{
  "version": 1,
  "id": "default",
  "name": "Default",
  "device": { "gamepadId": null }, // exact id string when manually picked
  "flexion": { "invert": false, "deadzone": 0.04, "trim": 0.0, "expo": 0.0 },
  "depth": { "invert": false, "noiseGateMm": 0.05, "gain": 1.0 },
  "roll": { "invert": false, "gain": 1.0 },
  "buttons": { "swapAB": false },
}
```

## 6. How simulators consume input

Shared rules (implemented once in `core/`):

- **Flexion — absolute.** After deadzone/trim/expo/invert, map `-1…+1` onto the sim's
  articulation range (per-sim constants; e.g. EBUS `-30°…+90°`, trainer pitch steer).
- **Depth — delta.** `dDepthMm = depth_mm[n] − depth_mm[n−1]`, applied to the sim's
  insertion coordinate with `profile.depth.gain` (default 1.0 ⇒ 1 physical mm = 1 sim mm).
  Delta mapping is absolute tracking with a re-zeroable offset: it survives depth
  re-zero, HID clamp saturation, and virtual paths shorter than the physical cord.
- **Roll — delta** of the continuous unwrapped angle, `profile.roll.gain` applied.
- **Buttons — edge events** (`pressed` on this frame), not level state, for UI actions.
- Sims poll once per animation frame via `GamepadScopeSource.sample(now)`; polling,
  decoding, unwrapping, gating and edge detection all live in the shared core.

## 7. Testing without hardware

- `core/virtual-source.ts` provides `VirtualScopeSource` (same interface as
  `GamepadScopeSource`) driven by UI sliders on `/hardware` ("Emulator" section).
- Any page can be driven by patching the Gamepad API with a plain object shaped like a
  Gamepad (`id` containing `ScopeTracker`, `axes: [f, d, sin, cos]`,
  `buttons: [{pressed}...]`, `connected: true`); the decoder reads only those fields.
  This is how automated/preview verification drives the embedded sims end-to-end.

## 8. Sign-convention cheat sheet (firmware authors)

| Physical action                                              | HID result                                    |
| ------------------------------------------------------------ | --------------------------------------------- |
| Thumb lever pushed so the **tip curls toward image-up**      | axis0 → `+1`                                  |
| Scope **inserted** deeper past the flange                    | axis1 increases (0 mm = `-1`, 1024 mm = `+1`) |
| Cord rotated **clockwise** (operator view, looking distally) | `atan2(axis2, axis3)` increases               |
| Tip present at photogate                                     | button5 = 1                                   |
| SQUAL below threshold                                        | button6 = 1                                   |
