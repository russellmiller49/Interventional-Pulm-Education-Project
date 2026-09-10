# Realistic EBUS Sector Rendering & Vessel Merging

## Goal
Update the labeled EBUS sector view so that:
1. Vessels that overlap (e.g. azygos joining the SVC) render as a **single continuous lumen with one continuous bright wall**, not as separate stacked ellipses.
2. The default sector view looks like a real ultrasound image — anechoic vessel lumens, hyperechoic walls, hypoechoic lymph nodes, posterior enhancement, two-octave speckle — instead of saturated colored fill shapes that read as hand-drawn.
3. Color coding is preserved as an **educational tint mode** and as **hover/selected** highlight, so nothing is lost from the current pedagogy.

Ship behind a runtime flag so the existing rendering remains the safe default until the new style is validated by fellows.

## Files in scope
- `apps/web/src/features/simulator/SectorView.tsx` — main work
- `apps/web/src/features/simulator/types.ts` — small additions to extend render defaults
- `apps/web/src/features/simulator/simulator.css` — minor toggle styling
- `apps/web/src/features/simulator/SimulatorPage.tsx` — wire the toggle into the control rail (read first, only touch what's needed)

Do **not** change `sectorSource.ts`, `pose.ts`, the case manifest schema beyond the additive field below, or any data pipeline. The new pipeline reuses `SimulatorSectorRasterMask` data exactly as it exists today.

## Working style for this task
Follow the AGENTS.md flow:
1. Read `AGENTS.md` and the existing `SectorView.tsx` end-to-end before editing.
2. Write a short plan in your reply.
3. Make the changes additively — keep the old rendering path callable, gate the new path on a flag.
4. Run `npm run typecheck` and `npm run lint` (or whatever is configured in `apps/web`) before declaring done.
5. Summarize what changed, what was verified, and any follow-up risk at the end.

## Background — why the current rendering looks "drawn"
In the current `SectorView.tsx`, every `node` and `vessel` item is rendered through `drawRasterMask`, which:
- Tints the alpha mask with the structure's `item.color` (saturated blue for vessels, green for nodes).
- Edge-softens with a 1.6–2.2px blur.
- Composites each item independently onto the sector canvas.

Because each vessel is independently tinted and outlined, two overlapping vessels read as two pasted shapes with a visible color seam. Real EBUS instead shows: one black lumen, one bright wall surrounding the union of the lumens, posterior enhancement below cystic structures, and gray hypoechoic nodes with a faint capsule rim.

The fix is a small pipeline change, not a data-model change.

## Step 1 — Extend render defaults with a realism flag

In `apps/web/src/features/simulator/types.ts`, extend the `render_defaults` block on `SimulatorCaseManifest`:

```ts
export interface SimulatorCaseManifest {
  // ...
  render_defaults: {
    sector_angle_deg: number;
    max_depth_mm: number;
    roll_deg: number;
    sector_realism?: 'classic' | 'realistic'; // new, optional, defaults to 'classic'
  };
  // ...
}
```

The flag is **optional and additive** so no existing manifests need to be regenerated. Treat missing as `'classic'`.

## Step 2 — Add a runtime toggle

The flag's effective value at render time should be:
1. URL param `?sectorStyle=realistic` (highest priority, useful for fellow feedback links)
2. `localStorage.getItem('ebus.sectorStyle')` (sticky per-device)
3. `caseData.render_defaults.sector_realism` (per-case default)
4. `'classic'` (final fallback)

Read these inside `SectorView` once with `useMemo`. Provide a small button in the sector pane header next to the existing `simulator-chip` approach badge that toggles between `Classic` and `Realistic` and writes through to `localStorage`. Keep the button small — single text button, no icons. Add a CSS class `.simulator-sector-style-toggle` in `simulator.css` that matches the existing pill button style on the page.

## Step 3 — Add new helper functions in `SectorView.tsx`

Add the following helpers above the `SectorView` component (next to `drawRasterMask`). **Do not delete `drawRasterMask`** — the classic path keeps using it.

These helpers take the existing `SimulatorSectorRasterMask` (the per-item alpha grid you already produce) and treat it as alpha-only. They warp it into the fan with the **same row-warp math** as `drawRasterMask` so geometry matches pixel-for-pixel.

```ts
// Warp a raster mask's alpha into a target context as opaque WHITE pixels.
// Same row-warp math as drawRasterMask, but no per-item color tint.
function warpRasterAlphaIntoCanvas(
  target: CanvasRenderingContext2D,
  rasterMask: SimulatorSectorRasterMask,
  width: number,
  height: number,
) {
  const top = (8 * height) / 100;
  const fanHeight = (82 * height) / 100;
  const rowHeight = Math.max(1, fanHeight / Math.max(rasterMask.height - 1, 1) + 1.25);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = rasterMask.width;
  maskCanvas.height = rasterMask.height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;

  const image = maskCtx.createImageData(rasterMask.width, rasterMask.height);
  for (let i = 0; i < rasterMask.alpha.length && i < rasterMask.width * rasterMask.height; i += 1) {
    const a = clamp(Number(rasterMask.alpha[i]) || 0, 0, 255);
    image.data[i * 4]     = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = a;
  }
  maskCtx.putImageData(image, 0, 0);

  for (let row = 0; row < rasterMask.height; row += 1) {
    const depthRatio = rasterMask.height <= 1 ? 0 : row / (rasterMask.height - 1);
    const y = top + depthRatio * fanHeight - rowHeight / 2;
    const halfWidth = (depthRatio * 39 * width) / 100;
    const rowWidth = halfWidth * 2;
    if (rowWidth < 0.5) continue;
    target.drawImage(maskCanvas, 0, row, rasterMask.width, 1, width / 2 - halfWidth, y, rowWidth, rowHeight);
  }
}

// Union all vessel masks into a single opaque-white lumen canvas, fan-clipped.
function buildVesselLumen(items: SimulatorSectorItem[], width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const item of items) {
    if (item.kind !== 'vessel' || !item.rasterMask?.alpha?.length) continue;
    warpRasterAlphaIntoCanvas(ctx, item.rasterMask, width, height);
  }
  ctx.restore();
  return canvas;
}

// Wall = dilated lumen − lumen. Implemented as blur + alpha threshold + destination-out.
function buildWallFromLumen(lumen: HTMLCanvasElement, dilatePx: number) {
  const canvas = document.createElement('canvas');
  canvas.width = lumen.width;
  canvas.height = lumen.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.filter = `blur(${dilatePx}px)`;
  ctx.drawImage(lumen, 0, 0);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.data.length; i += 4) {
    data.data[i] = data.data[i] > 50 ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(lumen, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

// Tint a white-on-transparent mask to a flat color, preserving alpha.
function tintMask(mask: HTMLCanvasElement, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, mask.width, mask.height);
  return canvas;
}

// Posterior enhancement: bright wedge below cystic (vessel) lumens.
function drawPosteriorEnhancement(
  ctx: CanvasRenderingContext2D,
  lumen: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const proj = document.createElement('canvas');
  proj.width = lumen.width;
  proj.height = lumen.height;
  const px = proj.getContext('2d');
  if (!px) return;
  for (let i = 1; i <= 35; i += 1) {
    px.globalAlpha = 0.06 * (1 - i / 40);
    px.drawImage(lumen, 0, i * 5);
  }
  px.globalAlpha = 1;
  px.filter = 'blur(7px)';
  px.drawImage(proj, 0, 0);
  px.filter = 'none';
  const tinted = tintMask(proj, '#9aa39c');
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(tinted, 0, 0);
  ctx.restore();
}

// Hypoechoic node with capsule rim — replaces the saturated green ellipse for nodes.
function drawHypoechoicNode(
  ctx: CanvasRenderingContext2D,
  rasterMask: SimulatorSectorRasterMask,
  width: number,
  height: number,
) {
  const target = document.createElement('canvas');
  target.width = Math.ceil(width);
  target.height = Math.ceil(height);
  const tCtx = target.getContext('2d');
  if (!tCtx) return;
  tCtx.save();
  drawFanClip(tCtx, width, height);
  tCtx.clip();
  warpRasterAlphaIntoCanvas(tCtx, rasterMask, width, height);
  tCtx.restore();

  const tinted = tintMask(target, '#5a5e58');
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.filter = 'blur(0.6px)';
  ctx.globalAlpha = 0.78;
  ctx.drawImage(tinted, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  const wall = buildWallFromLumen(target, 1.4);
  const wallTinted = tintMask(wall, '#b0aa98');
  ctx.globalAlpha = 0.65;
  ctx.drawImage(wallTinted, 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Optional educational tint that re-introduces structure colors as a light overlay.
// Only call this when the user has hover/selection or a "tint" subtoggle on.
function drawEducationalTint(
  ctx: CanvasRenderingContext2D,
  vessels: SimulatorSectorItem[],
  nodes: SimulatorSectorItem[],
  width: number,
  height: number,
  activeId: string | null,
) {
  const r = (item: SimulatorSectorItem, color: string, alpha: number) => {
    if (!item.rasterMask?.alpha?.length) return;
    const target = document.createElement('canvas');
    target.width = Math.ceil(width);
    target.height = Math.ceil(height);
    const tCtx = target.getContext('2d');
    if (!tCtx) return;
    tCtx.save();
    drawFanClip(tCtx, width, height);
    tCtx.clip();
    warpRasterAlphaIntoCanvas(tCtx, item.rasterMask, width, height);
    tCtx.restore();
    const tinted = tintMask(target, color);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.drawImage(tinted, 0, 0);
    ctx.restore();
  };

  for (const v of vessels) r(v, v.color, activeId === v.id ? 0.40 : 0.18);
  for (const n of nodes)   r(n, n.color, activeId === n.id ? 0.42 : 0.22);
}
```

## Step 4 — Replace the per-item draw loop in the realistic path

Inside the existing `useEffect` `draw()`, after `drawSectorTexture(ctx, viewSize, viewSize)` and before `ctx.restore()`, branch on the resolved style. Keep the classic loop intact in the `else` branch.

```ts
if (sectorStyle === 'realistic') {
  const vessels = renderItems.filter(
    (i) => i.kind === 'vessel' && i.rasterMask?.alpha?.length,
  );
  const nodes = renderItems.filter(
    (i) => i.kind === 'node' && i.rasterMask?.alpha?.length,
  );

  if (vessels.length > 0) {
    const lumen = buildVesselLumen(vessels, viewSize, viewSize);

    // Posterior enhancement first — sits behind the lumen.
    drawPosteriorEnhancement(ctx, lumen, viewSize, viewSize);

    // Carve the lumen out of the speckle background, then refill with anechoic black.
    ctx.save();
    drawFanClip(ctx, viewSize, viewSize);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(lumen, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tintMask(lumen, '#080a0c'), 0, 0);

    // Outer bright wall — one continuous rim around the union.
    const outerWall = buildWallFromLumen(lumen, 2.6);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(tintMask(outerWall, '#dad6c8'), 0, 0);

    // Inner darker rim for depth.
    const innerWall = buildWallFromLumen(lumen, 1.0);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tintMask(innerWall, '#a9a596'), 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  for (const node of nodes) {
    drawHypoechoicNode(ctx, node.rasterMask!, viewSize, viewSize);
  }

  // Tint mode: light color overlay so structures remain colorimetrically identifiable.
  // Stronger alpha on the active item makes hover legible.
  if (educationalTintEnabled) {
    drawEducationalTint(ctx, vessels, nodes, viewSize, viewSize, activeStructure);
  }
} else {
  // Existing classic path: keep the for-loop calling drawRasterMask exactly as it is now.
  for (const item of renderItems) {
    if ((item.kind === 'node' || item.kind === 'vessel') && item.rasterMask?.alpha?.length) {
      drawRasterMask(ctx, item, item.rasterMask, viewSize, viewSize);
    }
  }
}
```

`educationalTintEnabled` should default to `true` in realistic mode — the tint is subtle and serves the educational use case. Expose it as a second runtime flag the same way as `sectorStyle` if you want it user-toggleable; otherwise hardcode it true for now.

## Step 5 — Update SVG overlay defaults so it stops competing with the canvas

In the SVG render block (the `renderItems.map` inside `<g clipPath="url(#simulatorFanClip)">`), the current default for nodes/vessels is to fill with `item.color` at high opacity. In realistic mode the canvas already shows the structure, so the SVG layer should default to **invisible** and only become visible on hover/focus.

Inside the `node`/`vessel` branch (the part that renders ellipses or contour paths), change the fill/stroke defaults to be conditional:

```ts
const inactiveFill = sectorStyle === 'realistic' ? 'transparent' : item.color;
const inactiveFillOpacity = sectorStyle === 'realistic' ? 0 : (active ? 0.98 : 0.92);
const inactiveStrokeOpacity = sectorStyle === 'realistic' ? 0 : (active ? 0.95 : 0.7);
const activeFillOpacity = sectorStyle === 'realistic' ? 0.40 : (active ? 0.98 : 0.92);
```

Then use these inside the `<path>` and `<ellipse>` props. The active highlight remains visible; the inactive background fill disappears in realistic mode but the hotspot `<g>` still receives mouse/keyboard events because it has child geometry.

**Important:** keep `pointerEvents="auto"` on the SVG layer and keep the existing `tabIndex={0}` on hotspots so keyboard navigation and the existing hover/leader-line system continue to work without modification.

## Step 6 — Persist the toggle and surface it in the header

Add a small button to the sector pane header (next to the existing `simulator-chip` approach badge):

```tsx
<button
  type="button"
  className="simulator-sector-style-toggle"
  onClick={() => {
    const next = sectorStyle === 'realistic' ? 'classic' : 'realistic';
    setSectorStyle(next);
    try { localStorage.setItem('ebus.sectorStyle', next); } catch {}
  }}
  aria-pressed={sectorStyle === 'realistic'}
>
  {sectorStyle === 'realistic' ? 'Realistic' : 'Classic'}
</button>
```

CSS to add to `simulator.css`:

```css
.simulator-sector-style-toggle {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #222a2c;
  color: #d9e5e1;
  font-size: 0.8rem;
  cursor: pointer;
}
.simulator-sector-style-toggle[aria-pressed="true"] {
  border-color: rgba(139, 212, 255, 0.55);
  background: rgba(139, 212, 255, 0.12);
  color: #d9f0ee;
}
```

## Things NOT to change
- The fan clip path `M50 7 L10 92 Q50 99 90 92 Z` and depth tick math. Geometry must stay pixel-identical so coordinates between the 3D scene pane and the sector pane remain synchronized.
- `drawSectorTexture` — the two-octave speckle and vignette already there are good. Realistic mode runs **after** the texture is laid down.
- The `renderItems` sort order. The classic path depends on it; the new path filters from the same array, so it inherits correctly.
- `drawRasterMask` itself. Leave it for the classic path. Refactoring later is fine but not in this change.
- The structure list (`.simulator-structure-list` row buttons at the bottom) — color swatches there are the right place for color coding.

## Verification

Functional checks:
1. Load a case in classic mode (default). Confirm pixel output is unchanged from `main` — diff a screenshot against the pre-change build for the same preset and pose.
2. Toggle to realistic mode. Confirm that for any preset where two vessels overlap (azygos + SVC at right paratracheal stations is the canonical test; pick the 4R or 11Rs preset where this happens), the lumens render as one continuous black region with one continuous bright wall around the union — no visible seam at the overlap.
3. Hover any vessel or node. Confirm the SVG hotspot still highlights, the leader line and callout still appear, the structure list row still highlights in sync.
4. Toggle the style three times. Confirm the toggle persists across a hard reload (`localStorage`).
5. Append `?sectorStyle=classic` to the URL while `localStorage` has `realistic`. Confirm the URL wins.

Code quality checks (per AGENTS.md "Quality bar"):
- `npm run typecheck` clean
- `npm run lint` clean (or note any pre-existing warnings unrelated to this change)
- App boots without console errors in both modes
- Vitest suite passes — `apps/web/src/features/simulator/simulator.test.ts` should still pass; no test changes required since data flow is unchanged

Performance sanity:
- Realistic mode does ~5 extra offscreen canvases per draw. At the current sector size (~700px square @ devicePixelRatio 2) this should stay under 8ms per draw on a modern laptop. If it doesn't, the cheapest win is to cache the lumen canvas per preset and invalidate only when `renderItems` identity changes — add this only if measured frame time exceeds 16ms.

## Acceptance criteria
- [ ] `sector_realism` is an optional, additive field on `render_defaults`. No existing manifest breaks.
- [ ] Runtime resolution order is URL → localStorage → manifest → 'classic'.
- [ ] Classic mode output is byte-equivalent to pre-change `main`.
- [ ] Realistic mode renders overlapping vessels as a single union with one continuous wall.
- [ ] Realistic mode renders nodes as hypoechoic gray with a capsule rim, not green chips.
- [ ] Posterior enhancement is visible below vessel lumens.
- [ ] Hover, focus, leader lines, callouts, and the structure list all behave identically in both modes.
- [ ] Header toggle persists in localStorage and `aria-pressed` reflects state.
- [ ] `npm run typecheck` and `npm run lint` clean. `simulator.test.ts` passes.

## Rollback
Single revert of this commit removes the realistic path entirely. The classic path is untouched, so rollback is risk-free. The optional manifest field is forward-compatible — leaving it in older case files after rollback is harmless because the field is `?` optional and the code no longer reads it.

## Follow-up risk to call out
- Color-blind users currently rely on color in classic mode. In realistic mode, the colored hover/highlight + the bottom legend remain the source of identification. Worth a usability check with a fellow before flipping the default.
- The `educationalTintEnabled` flag is hardcoded `true` in this change. If the team wants users to toggle tint independently from the realism mode, surface it as a second header pill in a follow-up PR.
- Posterior enhancement is rendered for all vessels uniformly. Real EBUS shows it most strongly behind cystic structures with no flow artifact; this is a stylization, not a physics simulation, and should be labeled as such if it ever ends up in marketing copy.
