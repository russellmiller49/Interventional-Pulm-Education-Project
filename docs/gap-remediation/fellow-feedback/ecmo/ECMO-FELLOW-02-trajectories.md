# ECMO-FELLOW-02 — matched-time trajectory comparison

Every case below was replayed through the reducer along the same plans on two trees: the baseline
(`origin/main` at `9fbdbddc`) and the repaired branch. The plans are
`src/features/cardiohelp-ecmo/test-support/causalTrajectories.ts`; the full rows, including every
action row read at its own unchanged simulation time, are in `ECMO-FELLOW-02-trajectories.json`.

- **Times are modeled seconds**: compressed simulation steps, not a bedside time course.
- **Paths**: A time only · B assessment only · C intended treatment · D harmful or ineffective path.
  Each case's plan names the exact actions and the second they were taken.
- **Reading**: VA `spo2` is the right-arm reading. Values are at t = 0 (as loaded), 3, 8 and 20
  modeled seconds.
- **Nothing here is clinical validation.** It records what this bounded teaching model does, before
  and after the software repairs; the physiology itself remains with the owner decisions named in
  the handoff.

## How to read a row

A no-action path (A) that moves is either the case's own story — deterioration the fault is
authored to produce — or an artifact. After the repair, the only no-action movement left is story:
hemorrhage, tension pneumothorax and tamponade still deteriorate, the VV air case still falls off
support, and the gas case still accumulates CO₂. Movement that was an artifact — an authored value
pulled toward a generic patient, or a default the case never authored settling into place — is gone.
Where a treatment path (C) differs from A at the same second, that difference is what the treatment
caused in this model.

## Reproduce

```
npx esbuild scripts/cardiohelp-ecmo/dump-causal-trajectories.mts --bundle --platform=node \
  --format=esm --outfile=node_modules/.cache/ecmo/causal.mjs
node node_modules/.cache/ecmo/causal.mjs repaired repaired.json
```

For the baseline, copy `test-support/causalTrajectories.ts` and the script into a checkout of
`9fbdbddc` and run the same two commands there: the plans use only engine entry points that exist on
both trees.

## Matched-time comparison

| Case | Signal          | Path | Baseline t0 / 3 / 8 / 20  | Repaired t0 / 3 / 8 / 20  |
| ---- | --------------- | ---- | ------------------------- | ------------------------- |
| C1   | spo2            | A    | 77.3 / 75.2 / 74 / 74     | 78 / 75.9 / 74 / 74       |
| C1   | spo2            | C    | 77.3 / 79.4 / 82.9 / 91.3 | 78 / 80.1 / 83.6 / 92     |
| C1   | spo2            | D    | 77.3 / 74.7 / 78.2 / 86.6 | 78 / 74.7 / 78.2 / 86.6   |
| C1   | paCO2           | A    | 64.4 / 68.6 / 75.6 / 76   | 63 / 67.2 / 74.2 / 76     |
| C1   | paCO2           | C    | 64.4 / 60.2 / 53.2 / 46   | 63 / 58.8 / 51.8 / 46     |
| C1   | paCO2           | D    | 64.4 / 65.8 / 58.8 / 46   | 63 / 64.4 / 57.4 / 46     |
| C1   | lactate         | A    | 3.1 / 2.8 / 2.3 / 1.8     | 3.2 / 3.2 / 3.2 / 3.2     |
| C1   | lactate         | C    | 3.1 / 2.8 / 2.3 / 1.8     | 3.2 / 2.9 / 2.4 / 1.8     |
| C1   | lactate         | D    | 3.1 / 2.8 / 2.3 / 1.8     | 3.2 / 3.1 / 2.6 / 1.8     |
| C1   | workOfBreathing | A    | high / high / high / high | high / high / high / high |
| C1   | workOfBreathing | C    | high / high / high / high | high / high / high / high |
| C1   | workOfBreathing | D    | high / high / high / high | high / high / high / high |
| C2   | map             | A    | 53 / 50 / 46 / 46         | 54 / 51 / 46 / 46         |
| C2   | map             | C    | 53 / 65 / 65 / 65         | 54 / 65 / 65 / 65         |
| C2   | map             | D    | 53 / 58 / 53 / 46         | 54 / 59 / 54 / 46         |
| C2   | lactate         | A    | 4.9 / 5.2 / 5.7 / 6.9     | 4.8 / 5.1 / 5.6 / 6.8     |
| C2   | lactate         | C    | 4.9 / 4.6 / 4.1 / 2.9     | 4.8 / 4.5 / 4 / 2.8       |
| C2   | lactate         | D    | 4.9 / 5.2 / 5.7 / 6.9     | 4.8 / 5.1 / 5.6 / 6.8     |
| C2   | flow            | A    | 2.56 / 2.98 / 2.56 / 2.56 | 2.56 / 2.98 / 2.56 / 2.56 |
| C2   | flow            | C    | 2.56 / 4.05 / 4.05 / 4.05 | 2.56 / 4.05 / 4.05 / 4.05 |
| C2   | flow            | D    | 2.56 / 2.98 / 2.56 / 2.56 | 2.56 / 2.98 / 2.56 / 2.56 |
| C3   | map             | A    | 47 / 44 / 42 / 42         | 48 / 45 / 42 / 42         |
| C3   | map             | C    | 47 / 47 / 47 / 47         | 48 / 48 / 48 / 48         |
| C3   | map             | D    | 47 / 44 / 43 / 43         | 48 / 45 / 44 / 44         |
| C3   | cvp             | A    | 19 / 20 / 20 / 20         | 18 / 20 / 20 / 20         |
| C3   | cvp             | C    | 19 / 8 / 8 / 8            | 18 / 8 / 8 / 8            |
| C3   | cvp             | D    | 19 / 20 / 8 / 8           | 18 / 20 / 8 / 8           |
| C3   | airwayPressure  | A    | 39 / 40 / 40 / 40         | 38 / 40 / 40 / 40         |
| C3   | airwayPressure  | C    | 39 / 24 / 24 / 24         | 38 / 24 / 24 / 24         |
| C3   | airwayPressure  | D    | 39 / 40 / 24 / 24         | 38 / 40 / 24 / 24         |
| C3   | flow            | A    | 2.47 / 2.89 / 2.47 / 2.47 | 2.47 / 2.89 / 2.47 / 2.47 |
| C3   | flow            | C    | 2.47 / 4.05 / 4.05 / 4.05 | 2.47 / 4.05 / 4.05 / 4.05 |
| C3   | flow            | D    | 2.47 / 0 / 4.05 / 4.05    | 2.47 / 0 / 4.05 / 4.05    |
| C3   | pumpRunning     | A    | on / on / on / on         | on / on / on / on         |
| C3   | pumpRunning     | C    | on / on / on / on         | on / on / on / on         |
| C3   | pumpRunning     | D    | on / off / on / on        | on / off / on / on        |
| C4   | spo2            | A    | 84.7 / 86.8 / 86.8 / 86.8 | 84 / 84 / 84 / 84         |
| C4   | spo2            | C    | 84.7 / 86.8 / 90.3 / 98.7 | 84 / 86.1 / 89.6 / 98     |
| C4   | paCO2           | A    | 43.4 / 46 / 46 / 46       | 46 / 46 / 46 / 46         |
| C4   | paCO2           | C    | 43.4 / 46 / 46 / 46       | 46 / 46 / 46 / 46         |
| C5   | spo2            | A    | 78.7 / 80.8 / 84.3 / 91.3 | 78 / 78 / 78 / 78         |
| C5   | spo2            | B    | 78.7 / 80.8 / 84.3 / 91.3 | 78 / 78 / 78 / 78         |
| C5   | spo2            | C    | 78.7 / 80.8 / 84.3 / 92.7 | 78 / 80.1 / 83.6 / 92     |
| C5   | spo2            | D    | 78.7 / 76.1 / 79.6 / 88   | 78 / 74 / 77.5 / 85.9     |
| C5   | preOxygenator   | A    | 75.4 / 76.5 / 78.3 / 82.3 | 75.4 / 75.4 / 75.4 / 75.4 |
| C5   | preOxygenator   | B    | 75.4 / 76.5 / 78.3 / 82.3 | 75.4 / 75.4 / 75.4 / 75.4 |
| C5   | preOxygenator   | C    | 75.4 / 59.2 / 62.4 / 70.1 | 75.4 / 58.5 / 61.8 / 69.5 |
| C5   | preOxygenator   | D    | 75.4 / 78.4 / 58.1 / 65.8 | 75.4 / 77.8 / 56.1 / 63.9 |
| C6   | paCO2           | A    | 89.4 / 90 / 90 / 90       | 88 / 90 / 90 / 90         |
| C6   | paCO2           | C    | 89.4 / 85.2 / 78.2 / 61.4 | 88 / 83.8 / 76.8 / 60     |
| C6   | spo2            | A    | 92.3 / 90.2 / 86.7 / 82   | 93 / 90.9 / 87.4 / 82     |
| C6   | spo2            | C    | 92.3 / 94.4 / 96.9 / 96.9 | 93 / 95.1 / 96.9 / 96.9   |
| C7   | spo2            | A    | 83.3 / 82 / 82 / 82       | 84 / 82 / 82 / 82         |
| C7   | spo2            | C    | 83.3 / 85.4 / 88.9 / 96.9 | 84 / 86.1 / 89.6 / 96.9   |
| VAC1 | spo2            | A    | 85.3 / 83.2 / 82 / 82     | 86 / 83.9 / 82 / 82       |
| VAC1 | spo2            | C    | 85.3 / 87.4 / 90.9 / 96   | 86 / 88.1 / 91.6 / 96     |
| VAC1 | femoral         | A    | 85.3 / 83.2 / 82 / 82     | 86 / 83.9 / 82 / 82       |
| VAC1 | femoral         | C    | 85.3 / 87.4 / 90.9 / 98.5 | 86 / 88.1 / 91.6 / 98.5   |
| VAC1 | map             | A    | 42 / 39 / 38 / 38         | 43 / 40 / 38 / 38         |
| VAC1 | map             | C    | 42 / 45 / 50 / 62         | 43 / 46 / 51 / 63         |
| VAC1 | pulsePressure   | A    | 10 / 16 / 18 / 18         | 8 / 8 / 8 / 8             |
| VAC1 | pulsePressure   | C    | 10 / 16 / 18 / 18         | 8 / 8 / 8 / 8             |
| VAC1 | nativeOutput    | A    | 1.3 / 1.9 / 2.4 / 2.4     | 1.2 / 1.2 / 1.2 / 1.2     |
| VAC1 | nativeOutput    | C    | 1.3 / 1.9 / 2.4 / 2.4     | 1.2 / 1.2 / 1.2 / 1.2     |
| VAC1 | lactate         | A    | 7.3 / 7.6 / 8 / 8         | 7.2 / 7.5 / 8 / 8         |
| VAC1 | lactate         | C    | 7.3 / 7 / 6.5 / 5.3       | 7.2 / 6.9 / 6.4 / 5.2     |
| VAC2 | map             | A    | 45 / 42 / 40 / 40         | 46 / 43 / 40 / 40         |
| VAC2 | map             | C    | 45 / 65 / 70 / 71         | 46 / 64 / 69 / 71         |
| VAC2 | map             | D    | 45 / 49 / 44 / 40         | 46 / 50 / 45 / 40         |
| VAC2 | cvp             | A    | 21 / 22 / 22 / 22         | 20 / 22 / 22 / 22         |
| VAC2 | cvp             | C    | 21 / 8 / 8 / 8            | 20 / 8 / 8 / 8            |
| VAC2 | cvp             | D    | 21 / 22 / 22 / 22         | 20 / 22 / 22 / 22         |
| VAC2 | pulsePressure   | A    | 8 / 14 / 18 / 18          | 6 / 6 / 6 / 6             |
| VAC2 | pulsePressure   | C    | 8 / 14 / 18 / 18          | 6 / 6 / 6 / 6             |
| VAC2 | pulsePressure   | D    | 8 / 14 / 18 / 18          | 6 / 6 / 6 / 6             |
| VAC2 | nativeOutput    | A    | 4.4 / 4 / 3.5 / 2.4       | 2.4 / 2.4 / 2.4 / 2.4     |
| VAC2 | nativeOutput    | C    | 4.4 / 4 / 3.5 / 2.4       | 2.4 / 2.4 / 2.4 / 2.4     |
| VAC2 | nativeOutput    | D    | 4.4 / 4 / 3.5 / 2.4       | 2.4 / 2.4 / 2.4 / 2.4     |
| VAC3 | map             | A    | 51 / 48 / 48 / 48         | 52 / 49 / 48 / 48         |
| VAC3 | map             | C    | 51 / 62 / 67 / 73         | 52 / 65 / 66 / 73         |
| VAC3 | map             | D    | 51 / 48 / 48 / 48         | 52 / 49 / 48 / 48         |
| VAC3 | lactate         | A    | 5.2 / 5.5 / 6 / 7.2       | 5.1 / 5.4 / 5.9 / 7.1     |
| VAC3 | lactate         | C    | 5.2 / 5.5 / 5.6 / 4.4     | 5.1 / 5.4 / 5.5 / 4.3     |
| VAC3 | lactate         | D    | 5.2 / 5.5 / 6 / 7.2       | 5.1 / 5.4 / 5.9 / 7.1     |
| VAC3 | flow            | A    | 4.43 / 4.43 / 4.43 / 4.43 | 4.43 / 4.43 / 4.43 / 4.43 |
| VAC3 | flow            | C    | 4.43 / 4.43 / 4.43 / 4.43 | 4.43 / 4.43 / 4.43 / 4.43 |
| VAC3 | flow            | D    | 4.43 / 4.68 / 4.68 / 4.68 | 4.43 / 4.68 / 4.68 / 4.68 |
| VAC3 | pulsePressure   | A    | 23 / 18 / 18 / 18         | 25 / 25 / 25 / 25         |
| VAC3 | pulsePressure   | C    | 23 / 18 / 18 / 18         | 25 / 25 / 25 / 25         |
| VAC3 | pulsePressure   | D    | 23 / 18 / 18 / 18         | 25 / 25 / 25 / 25         |
| VAC3 | nativeOutput    | A    | 4.4 / 4 / 3.5 / 2.4       | 4.5 / 4.5 / 4.5 / 4.5     |
| VAC3 | nativeOutput    | C    | 4.4 / 4 / 3.5 / 2.4       | 4.5 / 4.5 / 4.5 / 4.5     |
| VAC3 | nativeOutput    | D    | 4.4 / 4 / 3.5 / 2.4       | 4.5 / 4.5 / 4.5 / 4.5     |
| VAC4 | spo2            | A    | 84.7 / 86.8 / 90.3 / 96   | 84 / 84 / 84 / 84         |
| VAC4 | spo2            | C    | 84.7 / 86.8 / 90.3 / 96   | 84 / 86.1 / 89.6 / 96     |
| VAC4 | map             | A    | 57 / 60 / 65 / 69         | 56 / 56 / 56 / 56         |
| VAC4 | map             | C    | 57 / 60 / 65 / 74         | 56 / 59 / 64 / 74         |
| VAC4 | lactate         | A    | 4.8 / 4.5 / 4 / 2.8       | 4.9 / 4.9 / 4.9 / 4.9     |
| VAC4 | lactate         | C    | 4.8 / 4.5 / 4 / 2.8       | 4.9 / 4.6 / 4.1 / 2.9     |
| VAC5 | spo2            | A    | 78.7 / 80.8 / 82 / 82     | 78 / 78 / 78 / 78         |
| VAC5 | spo2            | C    | 78.7 / 83.9 / 82 / 82     | 78 / 86 / 86 / 86         |
| VAC5 | spo2            | D    | 78.7 / 80.8 / 82 / 82     | 78 / 78 / 78 / 78         |
| VAC5 | pulsePressure   | A    | 26 / 20 / 18 / 18         | 28 / 28 / 28 / 28         |
| VAC5 | pulsePressure   | C    | 26 / 20 / 18 / 18         | 28 / 28 / 28 / 28         |
| VAC5 | pulsePressure   | D    | 26 / 20 / 18 / 18         | 28 / 28 / 28 / 28         |
| VAC5 | nativeOutput    | A    | 3.4 / 3.1 / 2.6 / 2.4     | 3.5 / 3.5 / 3.5 / 3.5     |
| VAC5 | nativeOutput    | C    | 3.4 / 3.1 / 2.6 / 2.4     | 3.5 / 3.5 / 3.5 / 3.5     |
| VAC5 | nativeOutput    | D    | 3.4 / 3.1 / 2.6 / 2.4     | 3.5 / 3.5 / 3.5 / 3.5     |
| VAC5 | map             | A    | 72 / 72 / 72 / 72         | 72 / 72 / 72 / 72         |
| VAC5 | map             | C    | 72 / 72 / 72 / 72         | 72 / 72 / 72 / 72         |
| VAC5 | map             | D    | 72 / 73 / 73 / 73         | 72 / 73 / 73 / 73         |
| VAC5 | flow            | A    | 4.3 / 4.3 / 4.3 / 4.3     | 4.3 / 4.3 / 4.3 / 4.3     |
| VAC5 | flow            | C    | 4.3 / 4.3 / 4.3 / 4.3     | 4.3 / 4.3 / 4.3 / 4.3     |
| VAC5 | flow            | D    | 4.3 / 4.56 / 4.56 / 4.56  | 4.3 / 4.56 / 4.56 / 4.56  |
| VAC6 | limbNirs        | A    | 33 / 30 / 28 / 28         | 34 / 31 / 28 / 28         |
| VAC6 | limbNirs        | C    | 33 / 68 / 68 / 68         | 34 / 66 / 68 / 68         |
| VAC6 | pulsePressure   | A    | 33 / 27 / 18 / 18         | 18 / 18 / 18 / 18         |
| VAC6 | pulsePressure   | C    | 33 / 27 / 18 / 18         | 18 / 18 / 18 / 18         |
| VAC6 | nativeOutput    | A    | 4.4 / 4 / 3.5 / 2.4       | 2.4 / 2.4 / 2.4 / 2.4     |
| VAC6 | nativeOutput    | C    | 4.4 / 4 / 3.5 / 2.4       | 2.4 / 2.4 / 2.4 / 2.4     |
| VAC7 | map             | A    | 49 / 52 / 57 / 60         | 48 / 48 / 48 / 48         |
| VAC7 | map             | C    | 49 / 52 / 57 / 69         | 48 / 51 / 56 / 68         |
| VAC7 | spo2            | A    | 88.7 / 90.8 / 94.3 / 96   | 88 / 88 / 88 / 88         |
| VAC7 | spo2            | C    | 88.7 / 90.8 / 94.3 / 96   | 88 / 90.1 / 93.6 / 96     |
| VAC7 | lactate         | A    | 4.3 / 4 / 3.5 / 2.3       | 4.4 / 4.4 / 4.4 / 4.4     |
| VAC7 | lactate         | C    | 4.3 / 4 / 3.5 / 2.3       | 4.4 / 4.1 / 3.6 / 2.4     |
| IV   | paCO2           | A    | 44.4 / 48.6 / 55.6 / 60   | 43 / 43 / 43 / 43         |
| IV   | paCO2           | C    | 44.4 / 48.6 / 55.6 / 72.4 | 43 / 47.2 / 54.2 / 71     |
| IV   | paCO2           | D    | 44.4 / 48.6 / 55.6 / 72.4 | 43 / 43 / 47.2 / 64       |
| IV   | spo2            | A    | 95.7 / 96.9 / 96.9 / 96.9 | 95 / 95 / 95 / 95         |
| IV   | spo2            | C    | 95.7 / 93.6 / 90.1 / 82   | 95 / 92.9 / 89.4 / 82     |
| IV   | spo2            | D    | 95.7 / 96.9 / 94.8 / 86.4 | 95 / 95 / 92.9 / 84.5     |
| IV   | workOfBreathing | A    | low / low / low / low     | low / low / low / low     |
| IV   | workOfBreathing | C    | low / low / low / high    | low / low / low / high    |
| IV   | workOfBreathing | D    | low / low / low / high    | low / low / low / low     |
| IV   | respiratoryRate | A    | 18 / 18 / 18 / 18         | 20 / 20 / 20 / 20         |
| IV   | respiratoryRate | C    | 18 / 18 / 18 / 32         | 20 / 20 / 20 / 32         |
| IV   | respiratoryRate | D    | 18 / 18 / 18 / 32         | 20 / 20 / 20 / 20         |
| IA   | spo2            | A    | 82.3 / 82 / 82 / 82       | 83 / 83 / 83 / 83         |
| IA   | spo2            | C    | 82.3 / 82 / 82 / 82       | 83 / 83 / 83 / 83         |
| IA   | pulsePressure   | A    | 22 / 18 / 18 / 18         | 24 / 24 / 24 / 24         |
| IA   | pulsePressure   | C    | 22 / 18 / 18 / 18         | 24 / 24 / 24 / 24         |
| IA   | nativeOutput    | A    | 2.9 / 2.6 / 2.4 / 2.4     | 3 / 3 / 3 / 3             |
| IA   | nativeOutput    | C    | 2.9 / 2.6 / 2.4 / 2.4     | 3 / 3 / 3 / 3             |
| IA   | paCO2           | A    | 43.4 / 46 / 46 / 46       | 46 / 46 / 46 / 46         |
| IA   | paCO2           | C    | 43.4 / 46 / 46 / 46       | 46 / 46 / 46 / 46         |
