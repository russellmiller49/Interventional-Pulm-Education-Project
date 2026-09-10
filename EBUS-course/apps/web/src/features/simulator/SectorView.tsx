import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { useCourseShellText } from '@/i18n/courseShell';

import { clamp, type SimulatorProbePose } from './pose';
import { physicsSnapshotMatchesPose } from './acousticAdapter';
import {
  persistSectorStyle,
  readBrowserSectorStyle,
  SECTOR_STYLE_OPTIONS,
  sectorRenderPath,
  type SectorRenderPath,
  type SectorStyle,
} from './sectorStyle';
import { formatSimulatorStation } from './stationIds';
import type { SimulatorCaseManifest, SimulatorPreset, SimulatorSectorItem, SimulatorSectorRasterMask, Vec2 } from './types';
import { useSimulatorPhysicsSnapshot } from './useSimulatorCase';

const SECTOR_STYLE_LABELS: Record<SectorStyle, string> = {
  classic: 'Classic',
  realistic: 'Realistic',
  physics: 'Physics',
};

const OPEN_CONTOUR_CLOSEABLE_CHORD_RATIO = 0.7;

function localizeSectorItemLabel(label: string, t: (source: string) => string) {
  return t(label.replace(/\s+region$/i, ''));
}

function hexToRgb(color: string) {
  const normalized = color.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((digit) => `${digit}${digit}`).join('')
    : normalized;
  const parsed = Number.parseInt(expanded, 16);

  if (!Number.isFinite(parsed) || expanded.length !== 6) {
    return { r: 147, g: 197, b: 111 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function tintForKind(kind: 'node' | 'vessel', alphaRatio: number, baseColor: string) {
  const base = hexToRgb(baseColor);

  if (kind === 'vessel') {
    const lowR = 10;
    const lowG = 13;
    const lowB = 16;
    const rimWeight = 4 * alphaRatio * (1 - alphaRatio);
    const tintMix = 0.28 + rimWeight * 0.36;
    return {
      r: Math.round(lerp(lowR, base.r, tintMix)),
      g: Math.round(lerp(lowG, base.g, tintMix)),
      b: Math.round(lerp(lowB, base.b, tintMix)),
      opacity: 0.84,
    };
  }

  const hsl = rgbToHsl(base.r, base.g, base.b);
  const high = hslToRgb(hsl.h, 0.28, 0.42);
  const lowMixT = 0.12;
  const lowR = lerp(0x1a, base.r, lowMixT);
  const lowG = lerp(0x1f, base.g, lowMixT);
  const lowB = lerp(0x1d, base.b, lowMixT);
  const t = smoothstep(0.15, 0.85, alphaRatio);
  return {
    r: Math.round(lerp(lowR, high.r, t)),
    g: Math.round(lerp(lowG, high.g, t)),
    b: Math.round(lerp(lowB, high.b, t)),
    opacity: 0.62,
  };
}

function adjustHsl(color: string, saturation: number, lightness: number) {
  const { r, g, b } = hexToRgb(color);
  const hsl = rgbToHsl(r, g, b);
  const out = hslToRgb(hsl.h, clamp(saturation, 0, 1), clamp(lightness, 0, 1));
  return `rgb(${out.r}, ${out.g}, ${out.b})`;
}

function drawFanClip(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sx = width / 100;
  const sy = height / 100;
  ctx.beginPath();
  ctx.moveTo(50 * sx, 7 * sy);
  ctx.lineTo(10 * sx, 92 * sy);
  ctx.quadraticCurveTo(50 * sx, 99 * sy, 90 * sx, 92 * sy);
  ctx.closePath();
}

function hash2(ix: number, iy: number) {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise2D(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function drawSectorTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#020303';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();

  const gradient = ctx.createLinearGradient(0, (7 * height) / 100, 0, (94 * height) / 100);
  gradient.addColorStop(0, '#303635');
  gradient.addColorStop(0.3, '#202526');
  gradient.addColorStop(0.72, '#111617');
  gradient.addColorStop(1, '#090b0c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const noise = document.createElement('canvas');
  noise.width = 240;
  noise.height = 240;
  const noiseCtx = noise.getContext('2d');

  if (noiseCtx) {
    const image = noiseCtx.createImageData(noise.width, noise.height);
    const baseScale = 0.045;
    for (let y = 0; y < noise.height; y += 1) {
      for (let x = 0; x < noise.width; x += 1) {
        const index = (y * noise.width + x) * 4;
        const n1 = valueNoise2D(x * baseScale, y * baseScale);
        const n2 = valueNoise2D(x * baseScale * 2, y * baseScale * 2);
        const n3 = valueNoise2D(x * baseScale * 4, y * baseScale * 4);
        const summed = (n1 * 0.6 + n2 * 0.3 + n3 * 0.15) / (0.6 + 0.3 + 0.15);
        const value = 28 + Math.floor(summed * 38);
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 42;
      }
    }
    noiseCtx.putImageData(image, 0, 0);
    ctx.globalAlpha = 0.32;
    ctx.drawImage(noise, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  const vignette = ctx.createRadialGradient(width * 0.5, 0, 0, width * 0.5, height, height * 1.15);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const bloom = ctx.createLinearGradient(0, (7 * height) / 100, 0, (25 * height) / 100);
  bloom.addColorStop(0, 'rgba(255,255,255,0.05)');
  bloom.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, (25 * height) / 100);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

// Classic per-item render: tint each raster mask with the structure color and
// composite it independently. Kept as the 'classic' sector style.
function drawRasterMask(
  ctx: CanvasRenderingContext2D,
  item: SimulatorSectorItem,
  rasterMask: SimulatorSectorRasterMask,
  width: number,
  height: number,
) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = rasterMask.width;
  maskCanvas.height = rasterMask.height;
  const maskCtx = maskCanvas.getContext('2d');

  if (!maskCtx) {
    return;
  }

  const kind: 'node' | 'vessel' = item.kind === 'vessel' ? 'vessel' : 'node';
  const image = maskCtx.createImageData(rasterMask.width, rasterMask.height);
  for (let index = 0; index < rasterMask.alpha.length && index < rasterMask.width * rasterMask.height; index += 1) {
    const alpha = clamp(Number(rasterMask.alpha[index]) || 0, 0, 255);
    const offset = index * 4;
    const tint = tintForKind(kind, alpha / 255, item.color);
    image.data[offset] = tint.r;
    image.data[offset + 1] = tint.g;
    image.data[offset + 2] = tint.b;
    image.data[offset + 3] = Math.round(alpha * tint.opacity);
  }
  maskCtx.putImageData(image, 0, 0);

  const top = (8 * height) / 100;
  const fanHeight = (82 * height) / 100;
  const rowHeight = Math.max(1, fanHeight / Math.max(rasterMask.height - 1, 1) + 1.25);
  const warpedCanvas = document.createElement('canvas');
  warpedCanvas.width = Math.ceil(width);
  warpedCanvas.height = Math.ceil(height);
  const warpedCtx = warpedCanvas.getContext('2d');

  if (!warpedCtx) {
    return;
  }

  warpedCtx.save();
  drawFanClip(warpedCtx, width, height);
  warpedCtx.clip();
  warpedCtx.imageSmoothingEnabled = true;
  warpedCtx.imageSmoothingQuality = 'high';
  for (let row = 0; row < rasterMask.height; row += 1) {
    const depthRatio = rasterMask.height <= 1 ? 0 : row / (rasterMask.height - 1);
    const y = top + depthRatio * fanHeight - rowHeight / 2;
    const halfWidth = (depthRatio * 39 * width) / 100;
    const rowWidth = halfWidth * 2;

    if (rowWidth < 0.5) {
      continue;
    }

    warpedCtx.drawImage(maskCanvas, 0, row, rasterMask.width, 1, width / 2 - halfWidth, y, rowWidth, rowHeight);
  }
  warpedCtx.restore();

  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.filter = item.kind === 'vessel' ? 'blur(2.2px)' : 'blur(1.6px)';
  ctx.drawImage(warpedCanvas, 0, 0, width, height);
  ctx.filter = 'none';
  ctx.restore();
}

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

  if (!maskCtx) {
    return;
  }

  const image = maskCtx.createImageData(rasterMask.width, rasterMask.height);
  for (let index = 0; index < rasterMask.alpha.length && index < rasterMask.width * rasterMask.height; index += 1) {
    const alpha = clamp(Number(rasterMask.alpha[index]) || 0, 0, 255);
    const offset = index * 4;
    image.data[offset] = 255;
    image.data[offset + 1] = 255;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = alpha;
  }
  maskCtx.putImageData(image, 0, 0);

  for (let row = 0; row < rasterMask.height; row += 1) {
    const depthRatio = rasterMask.height <= 1 ? 0 : row / (rasterMask.height - 1);
    const y = top + depthRatio * fanHeight - rowHeight / 2;
    const halfWidth = (depthRatio * 39 * width) / 100;
    const rowWidth = halfWidth * 2;

    if (rowWidth < 0.5) {
      continue;
    }

    target.drawImage(maskCanvas, 0, row, rasterMask.width, 1, width / 2 - halfWidth, y, rowWidth, rowHeight);
  }
}

function sectorCanvasPoint(
  point: Vec2,
  width: number,
  height: number,
  maxDepth: number,
  halfTan: number,
) {
  const [lateralMm, depthMm] = point;
  const depthRatio = clamp(depthMm / maxDepth, 0, 1);
  const x = 50 + (lateralMm / Math.max(maxDepth * halfTan, 1)) * 39;
  const y = 8 + depthRatio * 82;

  return {
    x: (clamp(x, 8, 92) / 100) * width,
    y: (clamp(y, 7, 93) / 100) * height,
  };
}

function drawSmoothedClosedContour(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  const deduped = points.length > 1 && Math.hypot(
    points[0].x - points[points.length - 1].x,
    points[0].y - points[points.length - 1].y,
  ) <= 1
    ? points.slice(0, -1)
    : points;

  if (deduped.length < 3) {
    return false;
  }

  ctx.beginPath();
  ctx.moveTo(deduped[0].x, deduped[0].y);

  for (let index = 0; index < deduped.length; index += 1) {
    const p0 = deduped[(index - 1 + deduped.length) % deduped.length];
    const p1 = deduped[index];
    const p2 = deduped[(index + 1) % deduped.length];
    const p3 = deduped[(index + 2) % deduped.length];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    );
  }

  ctx.closePath();
  ctx.fill();
  return true;
}

function convexHullCanvasPoints(points: Array<{ x: number; y: number }>) {
  if (points.length <= 3) {
    return points;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Array<{ x: number; y: number }> = [];
  const upper: Array<{ x: number; y: number }> = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function morphBinaryMask(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
  mode: 'dilate' | 'erode',
) {
  if (radius <= 0) {
    return source.slice();
  }

  const output = new Uint8Array(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = mode === 'erode' ? 1 : 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          if (mode === 'erode') {
            hit = 0;
            break;
          }
          continue;
        }

        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) {
            continue;
          }

          const xx = x + dx;
          if (xx < 0 || xx >= width) {
            if (mode === 'erode') {
              hit = 0;
              break;
            }
            continue;
          }

          const filled = source[yy * width + xx] > 0;
          if (mode === 'dilate' && filled) {
            hit = 1;
            break;
          }
          if (mode === 'erode' && !filled) {
            hit = 0;
            break;
          }
        }

        if ((mode === 'dilate' && hit) || (mode === 'erode' && !hit)) {
          break;
        }
      }

      output[y * width + x] = hit;
    }
  }

  return output;
}

function closeBinaryMask(source: Uint8Array, width: number, height: number, radius: number) {
  return morphBinaryMask(
    morphBinaryMask(source, width, height, radius, 'dilate'),
    width,
    height,
    radius,
    'erode',
  );
}

function componentBoundaryPoints(component: Array<{ x: number; y: number }>, mask: Uint8Array, width: number, height: number) {
  return component.filter(({ x, y }) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height || mask[yy * width + xx] === 0) {
          return true;
        }
      }
    }

    return false;
  });
}

function connectedComponents(mask: Uint8Array, width: number, height: number, minimumArea: number) {
  const visited = new Uint8Array(mask.length);
  const components: Array<Array<{ x: number; y: number }>> = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 || visited[index]) {
      continue;
    }

    const stack = [index];
    const component: Array<{ x: number; y: number }> = [];
    visited[index] = 1;

    while (stack.length) {
      const current = stack.pop()!;
      const x = current % width;
      const y = Math.floor(current / width);
      component.push({ x, y });

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || xx >= width || yy < 0 || yy >= height) {
            continue;
          }

          const next = yy * width + xx;
          if (mask[next] === 0 || visited[next]) {
            continue;
          }

          visited[next] = 1;
          stack.push(next);
        }
      }
    }

    if (component.length >= minimumArea) {
      components.push(component);
    }
  }

  return components;
}

function buildSmoothedRasterSourceCanvas(rasterMask: SimulatorSectorRasterMask, kind: 'node' | 'vessel') {
  const width = rasterMask.width;
  const height = rasterMask.height;
  const raw = document.createElement('canvas');
  raw.width = width;
  raw.height = height;
  const rawCtx = raw.getContext('2d');

  if (!rawCtx) {
    return raw;
  }

  const image = rawCtx.createImageData(width, height);
  for (let index = 0; index < width * height && index < rasterMask.alpha.length; index += 1) {
    const alpha = clamp(Number(rasterMask.alpha[index]) || 0, 0, 255);
    const offset = index * 4;
    image.data[offset] = 255;
    image.data[offset + 1] = 255;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = alpha;
  }
  rawCtx.putImageData(image, 0, 0);

  const scale = Math.max(width / 160, 1);
  const closed = solidifyMask(
    raw,
    kind === 'vessel' ? 2.5 * scale : 2.0 * scale,
    kind === 'vessel' ? 80 : 90,
    kind === 'vessel' ? 1.5 * scale : 1.0 * scale,
    kind === 'vessel' ? 110 : 130,
  );
  const closedCtx = closed.getContext('2d');

  if (!closedCtx) {
    return closed;
  }

  const closedData = closedCtx.getImageData(0, 0, width, height);
  const binary = new Uint8Array(width * height);
  for (let index = 0; index < binary.length; index += 1) {
    binary[index] = closedData.data[index * 4 + 3] > 0 ? 1 : 0;
  }

  const minimumArea = Math.round((kind === 'vessel' ? 90 : 42) * scale * scale);
  const components = connectedComponents(binary, width, height, minimumArea);
  const filtered = document.createElement('canvas');
  filtered.width = width;
  filtered.height = height;
  const filteredCtx = filtered.getContext('2d');

  if (!filteredCtx) {
    return closed;
  }

  const filteredImage = filteredCtx.createImageData(width, height);
  for (const component of components) {
    for (const point of component) {
      const offset = (point.y * width + point.x) * 4;
      filteredImage.data[offset] = 255;
      filteredImage.data[offset + 1] = 255;
      filteredImage.data[offset + 2] = 255;
      filteredImage.data[offset + 3] = 255;
    }
  }
  filteredCtx.putImageData(filteredImage, 0, 0);

  if (!components.length) {
    return filtered;
  }

  return solidifyMask(filtered, 0, 1, kind === 'vessel' ? 1.0 * scale : 0.8 * scale, kind === 'vessel' ? 110 : 140);
}

function warpAlphaCanvasIntoCanvas(
  target: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const top = (8 * height) / 100;
  const fanHeight = (82 * height) / 100;
  const rowHeight = Math.max(1, fanHeight / Math.max(maskCanvas.height - 1, 1) + 1.25);

  for (let row = 0; row < maskCanvas.height; row += 1) {
    const depthRatio = maskCanvas.height <= 1 ? 0 : row / (maskCanvas.height - 1);
    const y = top + depthRatio * fanHeight - rowHeight / 2;
    const halfWidth = (depthRatio * 39 * width) / 100;
    const rowWidth = halfWidth * 2;

    if (rowWidth < 0.5) {
      continue;
    }

    target.drawImage(maskCanvas, 0, row, maskCanvas.width, 1, width / 2 - halfWidth, y, rowWidth, rowHeight);
  }
}

function drawSmoothSectorItemMask(
  ctx: CanvasRenderingContext2D,
  item: SimulatorSectorItem,
  width: number,
  height: number,
  maxDepth: number,
  halfTan: number,
) {
  ctx.fillStyle = '#ffffff';
  let drewContour = false;

  for (const [index, contour] of (item.contoursMm ?? []).entries()) {
    if (!contourIsCloseable(contour, item.contourClosed?.[index])) {
      continue;
    }

    const mapped = contour.map((point) => sectorCanvasPoint(point, width, height, maxDepth, halfTan));
    drewContour = drawSmoothedClosedContour(ctx, mapped) || drewContour;
  }

  if (drewContour) {
    return true;
  }

  const position = sectorCanvasPoint([item.lateralMm, item.depthMm], width, height, maxDepth, halfTan);
  const xScale = (39 * width) / 100 / Math.max(maxDepth * halfTan, 1);
  const yScale = (82 * height) / 100 / Math.max(maxDepth, 1);
  let vector: [number, number] = item.majorAxisVectorMm ?? [1, 0];

  if (!item.majorAxisMm && item.lateralExtentMm && item.depthExtentMm) {
    const lateralSpan = item.lateralExtentMm[1] - item.lateralExtentMm[0];
    const depthSpan = item.depthExtentMm[1] - item.depthExtentMm[0];
    vector = Math.abs(lateralSpan) >= Math.abs(depthSpan) ? [1, 0] : [0, 1];
  }

  const vectorNorm = Math.hypot(vector[0], vector[1]) || 1;
  const unitLateral = vector[0] / vectorNorm;
  const unitDepth = vector[1] / vectorNorm;
  const lateralSpan = item.lateralExtentMm ? Math.abs(item.lateralExtentMm[1] - item.lateralExtentMm[0]) : 0;
  const depthSpan = item.depthExtentMm ? Math.abs(item.depthExtentMm[1] - item.depthExtentMm[0]) : 0;
  const majorMm = Math.max(item.majorAxisMm ?? Math.max(lateralSpan, depthSpan), item.kind === 'vessel' ? 4.5 : 6);
  const minorMm = Math.max(item.minorAxisMm ?? Math.min(lateralSpan || majorMm, depthSpan || majorMm), item.kind === 'vessel' ? 2.5 : 4);
  const majorScale = Math.hypot(unitLateral * xScale, unitDepth * yScale);
  const minorScale = Math.hypot(-unitDepth * xScale, unitLateral * yScale);
  const rawMajor = (majorMm / 2) * majorScale;
  const rawMinor = (minorMm / 2) * minorScale;
  const percentScale = width / 100;
  const angleRad = Math.atan2(unitDepth * yScale, unitLateral * xScale);
  const rx = item.kind === 'vessel'
    ? clamp(rawMajor, 4.8 * percentScale, 31 * percentScale)
    : clamp(rawMajor, 6.4 * percentScale, 10.5 * percentScale);
  const ry = item.kind === 'vessel'
    ? clamp(Math.min(rawMinor, rx * 0.3), 2.3 * percentScale, 9.5 * percentScale)
    : clamp(rawMinor, 3.8 * percentScale, 7 * percentScale);

  ctx.beginPath();
  ctx.ellipse(position.x, position.y, rx, ry, angleRad, 0, Math.PI * 2);
  ctx.fill();
  return true;
}

function buildSolidItemMask(
  item: SimulatorSectorItem,
  width: number,
  height: number,
  maxDepth: number,
  halfTan: number,
  closingPx: number,
  threshold: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (hasUsableSectorContourGeometry(item)) {
    drawSmoothSectorItemMask(ctx, item, width, height, maxDepth, halfTan);
  } else if (item.rasterMask?.alpha?.length) {
    const source = buildSmoothedRasterSourceCanvas(item.rasterMask, item.kind === 'vessel' ? 'vessel' : 'node');
    warpAlphaCanvasIntoCanvas(ctx, source, width, height);
  } else {
    drawSmoothSectorItemMask(ctx, item, width, height, maxDepth, halfTan);
  }
  ctx.restore();

  return solidifyMask(canvas, closingPx, threshold);
}

function cloneMask(mask: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.drawImage(mask, 0, 0);
  }

  return canvas;
}

function drawMaskInto(target: HTMLCanvasElement, mask: HTMLCanvasElement) {
  const ctx = target.getContext('2d');

  if (!ctx) {
    return;
  }

  ctx.drawImage(mask, 0, 0);
}

function subtractMask(mask: HTMLCanvasElement, blocker: HTMLCanvasElement, expandBlockerPx = 0) {
  const canvas = cloneMask(mask);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const subtractor = expandBlockerPx > 0
    ? solidifyMask(blocker, expandBlockerPx, 12, 0)
    : blocker;

  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(subtractor, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  return solidifyMask(canvas, 0, 1, 0);
}

function maskHasPixels(mask: HTMLCanvasElement) {
  const ctx = mask.getContext('2d');

  if (!ctx) {
    return false;
  }

  const data = ctx.getImageData(0, 0, mask.width, mask.height);
  for (let index = 3; index < data.data.length; index += 4) {
    if (data.data[index] > 0) {
      return true;
    }
  }

  return false;
}

function buildVesselLumen(
  items: SimulatorSectorItem[],
  width: number,
  height: number,
  maxDepth: number,
  halfTan: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const itemMasks = new Map<string, HTMLCanvasElement>();

  for (const item of items) {
    if (item.kind !== 'vessel' || !item.rasterMask?.alpha?.length) {
      continue;
    }

    const rawMask = buildSolidItemMask(item, width, height, maxDepth, halfTan, 6, 16);
    const itemMask = subtractMask(rawMask, canvas);

    if (!maskHasPixels(itemMask)) {
      continue;
    }

    itemMasks.set(item.id, itemMask);
    drawMaskInto(canvas, itemMask);
  }

  return {
    lumen: solidifyMask(canvas, 1, 1),
    itemMasks,
  };
}

function buildWallFromLumen(lumen: HTMLCanvasElement, dilatePx: number) {
  const canvas = document.createElement('canvas');
  canvas.width = lumen.width;
  canvas.height = lumen.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  ctx.filter = `blur(${dilatePx}px)`;
  ctx.drawImage(lumen, 0, 0);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.data.length; index += 4) {
    data.data[index] = data.data[index] > 50 ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(lumen, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}

function buildFanBoundaryMask(width: number, height: number, lineWidthPx: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  drawFanClip(ctx, width, height);
  ctx.lineWidth = lineWidthPx;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  return solidifyMask(canvas, 0, 1, 0);
}

// Convert soft alpha into a binary interior before wall/carve-out work.
function solidifyMask(
  input: HTMLCanvasElement,
  closingPx: number,
  threshold: number,
  smoothingPx = 1.4,
  smoothingThreshold = 96,
) {
  const canvas = document.createElement('canvas');
  canvas.width = input.width;
  canvas.height = input.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  ctx.filter = `blur(${closingPx}px)`;
  ctx.drawImage(input, 0, 0);
  ctx.filter = 'none';

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.data.length; index += 4) {
    data.data[index] = data.data[index] > threshold ? 255 : 0;
  }
  ctx.putImageData(data, 0, 0);

  if (smoothingPx <= 0) {
    return canvas;
  }

  const smoothed = document.createElement('canvas');
  smoothed.width = input.width;
  smoothed.height = input.height;
  const smoothCtx = smoothed.getContext('2d');

  if (!smoothCtx) {
    return canvas;
  }

  smoothCtx.filter = `blur(${smoothingPx}px)`;
  smoothCtx.drawImage(canvas, 0, 0);
  smoothCtx.filter = 'none';

  const smoothData = smoothCtx.getImageData(0, 0, smoothed.width, smoothed.height);
  for (let index = 3; index < smoothData.data.length; index += 4) {
    smoothData.data[index] = smoothData.data[index] > smoothingThreshold ? 255 : 0;
  }
  smoothCtx.putImageData(smoothData, 0, 0);

  return smoothed;
}

function tintMask(mask: HTMLCanvasElement, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, mask.width, mask.height);

  return canvas;
}

function drawPosteriorEnhancement(
  ctx: CanvasRenderingContext2D,
  lumen: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const projection = document.createElement('canvas');
  projection.width = lumen.width;
  projection.height = lumen.height;
  const projectionCtx = projection.getContext('2d');

  if (!projectionCtx) {
    return;
  }

  for (let index = 1; index <= 35; index += 1) {
    projectionCtx.globalAlpha = 0.06 * (1 - index / 40);
    projectionCtx.drawImage(lumen, 0, index * 5);
  }
  projectionCtx.globalAlpha = 1;
  projectionCtx.filter = 'blur(7px)';
  projectionCtx.drawImage(projection, 0, 0);
  projectionCtx.filter = 'none';

  const tinted = tintMask(projection, '#9aa39c');
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(tinted, 0, 0);
  ctx.restore();
}

function drawHypoechoicNode(
  ctx: CanvasRenderingContext2D,
  solid: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const tinted = tintMask(solid, '#5a5e58');
  ctx.save();
  drawFanClip(ctx, width, height);
  ctx.clip();
  ctx.filter = 'blur(0.6px)';
  ctx.globalAlpha = 0.78;
  ctx.drawImage(tinted, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  const wall = buildWallFromLumen(solid, 2);
  const wallTinted = tintMask(wall, '#b0aa98');
  ctx.globalAlpha = 0.65;
  ctx.drawImage(wallTinted, 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEducationalTint(
  ctx: CanvasRenderingContext2D,
  vessels: SimulatorSectorItem[],
  nodes: SimulatorSectorItem[],
  renderedMasks: Map<string, HTMLCanvasElement>,
  width: number,
  height: number,
  activeId: string | null,
) {
  const renderTint = (item: SimulatorSectorItem, color: string, alpha: number) => {
    if (alpha <= 0 || !item.rasterMask?.alpha?.length) {
      return;
    }

    const target = document.createElement('canvas');
    target.width = Math.ceil(width);
    target.height = Math.ceil(height);
    const targetCtx = target.getContext('2d');

    if (!targetCtx) {
      return;
    }

    const renderedMask = renderedMasks.get(item.id);
    if (!renderedMask) {
      return;
    }

    targetCtx.save();
    drawFanClip(targetCtx, width, height);
    targetCtx.clip();
    targetCtx.drawImage(renderedMask, 0, 0);
    targetCtx.restore();

    const tinted = tintMask(solidifyMask(target, 2, 20), color);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.drawImage(tinted, 0, 0);
    ctx.restore();
  };

  for (const vessel of vessels) {
    renderTint(vessel, vessel.color, activeId === vessel.id ? 0.45 : 0);
  }

  for (const node of nodes) {
    renderTint(node, node.color, activeId === node.id ? 0.5 : 0);
  }
}

function isClosedContour(points: Vec2[]): boolean {
  if (points.length < 4) {
    return false;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1.5;
}

export function contourIsCloseable(points: Vec2[], explicitClosed?: boolean): boolean {
  if (explicitClosed === true) {
    return true;
  }

  if (explicitClosed === false) {
    if (points.length < 4) {
      return false;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const chord = Math.hypot(first[0] - last[0], first[1] - last[1]);
    let perimeter = 0;

    for (let index = 1; index < points.length; index += 1) {
      perimeter += Math.hypot(
        points[index][0] - points[index - 1][0],
        points[index][1] - points[index - 1][1],
      );
    }

    return perimeter > 0 && chord / perimeter >= OPEN_CONTOUR_CLOSEABLE_CHORD_RATIO;
  }

  return isClosedContour(points);
}

/**
 * Structures already painted into the canvas keep their SVG geometry transparent so the
 * hover hotspots sit over the render without covering it. The physics snapshot image is a
 * full sector render, so it behaves like the realistic canvas path.
 */
export function sectorItemRendersOnCanvas(renderPath: SectorRenderPath, hasRasterMask: boolean): boolean {
  return (renderPath === 'realistic' || renderPath === 'physics') && hasRasterMask;
}

/**
 * Destination rectangle (canvas px) for the physics snapshot PNG so its mm geometry lines
 * up with the SVG label mapping: depth 0 sits at the fan apex (y = 8%), the snapshot's max
 * depth spans 82% scaled by its depth relative to the manifest depth, and its lateral
 * extent (±maxDepth·tan(halfAngle)) maps through the same ±39% lateral scale the labels use.
 */
export function physicsSnapshotPlacement(
  viewSize: number,
  snapshot: { max_depth_mm: number; sector_angle_deg: number },
  renderDefaults: { max_depth_mm: number; sector_angle_deg: number },
) {
  const manifestDepth = Math.max(renderDefaults.max_depth_mm, 1e-6);
  const manifestHalfTan = Math.max(Math.tan(THREE.MathUtils.degToRad(renderDefaults.sector_angle_deg / 2)), 1e-6);
  const snapshotDepth = Math.max(snapshot.max_depth_mm, 0);
  const snapshotHalfTan = Math.tan(THREE.MathUtils.degToRad(snapshot.sector_angle_deg / 2));
  const height = (82 / 100) * (snapshotDepth / manifestDepth) * viewSize;
  const halfWidth = (39 / 100) * ((snapshotDepth * snapshotHalfTan) / (manifestDepth * manifestHalfTan)) * viewSize;

  return {
    x: viewSize / 2 - halfWidth,
    y: (8 / 100) * viewSize,
    width: halfWidth * 2,
    height,
  };
}

export function hasUsableSectorContourGeometry(item: SimulatorSectorItem): boolean {
  const contours = item.contoursMm ?? [];

  if (contours.length === 0) {
    return false;
  }

  return contours.some((contour, index) => contourIsCloseable(contour, item.contourClosed?.[index]));
}

export function SectorView({
  activeStructure,
  caseData,
  compact = false,
  contactQuality = 1,
  pose=null,
  items,
  onEnlarge = null,
  onShowAll = null,
  selectedPreset,
  setActiveStructure,
  source,
}: {
  activeStructure: string | null;
  caseData: SimulatorCaseManifest;
  /** Side-slot rendering: the sector image gets the whole pane — the structure list and the
   * render-style switch are hidden until the pane is enlarged or the tri-view is restored. */
  compact?: boolean;
  /** Acoustic coupling of the transducer face in [0, 1]; below 1 the image is veiled. */
  contactQuality?: number;
  pose?: SimulatorProbePose|null;
  items: SimulatorSectorItem[];
  /** Promote this pane to the focus layout's large slot; hidden when already there. */
  onEnlarge?: (() => void) | null;
  /** Return from the focus layout to the tri-view grid; shown only on the focused pane. */
  onShowAll?: (() => void) | null;
  selectedPreset: SimulatorPreset | null;
  setActiveStructure: (value: string | null) => void;
  source: string;
}) {
  const t = useCourseShellText();
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maxDepth = caseData.render_defaults.max_depth_mm;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(caseData.render_defaults.sector_angle_deg / 2));
  const sectorDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return new URLSearchParams(window.location.search).get('sectorDebug') === '1';
  }, []);
  const resolvedInitialSectorStyle = useMemo(
    () => readBrowserSectorStyle(caseData.render_defaults.sector_realism),
    [caseData.render_defaults.sector_realism],
  );
  const [sectorStyle, setSectorStyle] = useState<SectorStyle>(resolvedInitialSectorStyle);

  useEffect(() => {
    setSectorStyle(resolvedInitialSectorStyle);
  }, [resolvedInitialSectorStyle]);

  // Station-anchored physics snapshot for the selected preset; only fetched while
  // the physics style is active so the other styles stay network-free.
  const { snapshot: physicsSnapshot, imageUrl: physicsImageUrl } = useSimulatorPhysicsSnapshot(
    caseData,
    sectorStyle === 'physics' ? selectedPreset?.preset_key ?? null : null,
  );
  const [physicsImage, setPhysicsImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!physicsImageUrl) {
      setPhysicsImage(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setPhysicsImage(image);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setPhysicsImage(null);
      }
    };
    image.src = physicsImageUrl;

    return () => {
      cancelled = true;
    };
  }, [physicsImageUrl]);

  // 'physics' falls back to the realistic path until the snapshot PNG is loaded.
  const renderPath = sectorRenderPath(sectorStyle, Boolean(physicsSnapshot && physicsImage && pose && physicsSnapshotMatchesPose(physicsSnapshot,caseData,pose)));
  const visibleItems = items.filter((item) => item.visible || item.kind === 'airway' || item.kind === 'contact');

  function itemPosition(item: SimulatorSectorItem) {
    const depthRatio = clamp(item.depthMm / maxDepth, 0, 1);
    const x = 50 + (item.lateralMm / Math.max(maxDepth * halfTan, 1)) * 39;
    const y = 8 + depthRatio * 82;

    return { x: clamp(x, 9, 91), y };
  }

  function sectorPoint(point: Vec2) {
    const [lateralMm, depthMm] = point;
    const depthRatio = clamp(depthMm / maxDepth, 0, 1);
    const x = 50 + (lateralMm / Math.max(maxDepth * halfTan, 1)) * 39;
    const y = 8 + depthRatio * 82;

    return { x: clamp(x, 8, 92), y: clamp(y, 7, 93) };
  }

  function contourPath(points: Vec2[], forceClosed = false) {
    if (points.length < 2) {
      return '';
    }

    const closed = isClosedContour(points) || forceClosed;
    const mapped = points.map(sectorPoint);

    if (mapped.length < 3) {
      const fallback = mapped
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');
      return `${fallback}${closed ? ' Z' : ''}`;
    }

    const get = (index: number) => {
      if (closed) {
        return mapped[((index % mapped.length) + mapped.length) % mapped.length];
      }
      return mapped[Math.max(0, Math.min(mapped.length - 1, index))];
    };

    const segCount = closed ? mapped.length : mapped.length - 1;
    const tension = 0.5;
    let d = `M${mapped[0].x.toFixed(2)} ${mapped[0].y.toFixed(2)}`;

    for (let i = 0; i < segCount; i += 1) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);
      const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
      const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
      const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
      const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;
      d += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    if (closed) {
      d += ' Z';
    }

    return d;
  }

  function itemShape(item: SimulatorSectorItem) {
    const xScale = 39 / Math.max(maxDepth * halfTan, 1);
    const yScale = 82 / Math.max(maxDepth, 1);
    let vector: [number, number] = item.majorAxisVectorMm ?? [1, 0];
    if (!item.majorAxisMm && item.lateralExtentMm && item.depthExtentMm) {
      const lateralSpan = item.lateralExtentMm[1] - item.lateralExtentMm[0];
      const depthSpan = item.depthExtentMm[1] - item.depthExtentMm[0];
      vector = Math.abs(lateralSpan) >= Math.abs(depthSpan) ? [1, 0] : [0, 1];
    }

    const vectorNorm = Math.hypot(vector[0], vector[1]) || 1;
    const unitLateral = vector[0] / vectorNorm;
    const unitDepth = vector[1] / vectorNorm;
    const lateralSpan = item.lateralExtentMm ? Math.abs(item.lateralExtentMm[1] - item.lateralExtentMm[0]) : 0;
    const depthSpan = item.depthExtentMm ? Math.abs(item.depthExtentMm[1] - item.depthExtentMm[0]) : 0;
    const majorMm = Math.max(item.majorAxisMm ?? Math.max(lateralSpan, depthSpan), item.kind === 'vessel' ? 4.5 : 6);
    const minorMm = Math.max(item.minorAxisMm ?? Math.min(lateralSpan || majorMm, depthSpan || majorMm), item.kind === 'vessel' ? 2.5 : 4);
    const majorScale = Math.hypot(unitLateral * xScale, unitDepth * yScale);
    const minorScale = Math.hypot(-unitDepth * xScale, unitLateral * yScale);
    const rawMajor = (majorMm / 2) * majorScale;
    const rawMinor = (minorMm / 2) * minorScale;
    const angleDeg = THREE.MathUtils.radToDeg(Math.atan2(unitDepth * yScale, unitLateral * xScale));

    if (item.kind === 'vessel') {
      const rx = clamp(rawMajor, 4.8, 31);
      const ry = clamp(Math.min(rawMinor, rx * 0.3), 2.3, 9.5);
      return { angleDeg, rx, ry };
    }

    return {
      angleDeg,
      rx: clamp(rawMajor, 6.4, 10.5),
      ry: clamp(rawMinor, 3.8, 7.0),
    };
  }

  function itemArea(item: SimulatorSectorItem) {
    const lateralSpan = item.lateralExtentMm ? Math.abs(item.lateralExtentMm[1] - item.lateralExtentMm[0]) : 0;
    const depthSpan = item.depthExtentMm ? Math.abs(item.depthExtentMm[1] - item.depthExtentMm[0]) : 0;
    const fromExtents = lateralSpan * depthSpan;
    const fromAxes = (item.majorAxisMm ?? 0) * (item.minorAxisMm ?? 0);
    return Math.max(fromExtents, fromAxes, 1);
  }

  const renderItems = [...visibleItems].sort((a, b) => {
    const kindOrder = { vessel: 0, node: 1, airway: 2, contact: 3 };
    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) return kindDiff;
    const areaDiff = itemArea(b) - itemArea(a);
    if (areaDiff !== 0) return areaDiff;
    return b.depthMm - a.depthMm;
  });
  const activeItem = renderItems.find((item) => item.id === activeStructure && item.kind !== 'contact') ?? null;
  const activeItemPosition = activeItem ? itemPosition(activeItem) : null;
  const activeCalloutSide = activeItemPosition && activeItemPosition.x <= 50 ? 'left' : 'right';
  const activeCalloutAnchor = activeItemPosition
    ? {
        x: activeCalloutSide === 'left' ? 13 : 87,
        y: clamp(activeItemPosition.y, 14, 86),
      }
    : null;
  const activeKindLabel = activeItem?.kind === 'node'
    ? 'lymph node'
    : activeItem?.kind === 'vessel'
      ? 'vessel'
      : activeItem?.kind === 'airway'
        ? 'airway'
        : '';

  useEffect(() => {
    const canvas = rasterCanvasRef.current;
    const parent = canvas?.parentElement;

    if (!canvas || !parent) {
      return;
    }

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return;
      }

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#020303';
      ctx.fillRect(0, 0, width, height);
      const viewSize = Math.min(width, height);
      const viewOffsetX = (width - viewSize) / 2;
      const viewOffsetY = (height - viewSize) / 2;
      ctx.save();
      ctx.translate(viewOffsetX, viewOffsetY);
      drawSectorTexture(ctx, viewSize, viewSize);

      if (renderPath === 'physics' && physicsSnapshot && physicsImage) {
        const placement = physicsSnapshotPlacement(viewSize, physicsSnapshot.metadata, caseData.render_defaults);
        ctx.save();
        drawFanClip(ctx, viewSize, viewSize);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(physicsImage, placement.x, placement.y, placement.width, placement.height);
        ctx.restore();

        // The educational hover tints composite over the snapshot exactly as they
        // do over the realistic render; only the background source changes.
        const physicsVessels = renderItems.filter((item) => item.kind === 'vessel' && item.rasterMask?.alpha?.length);
        const physicsNodes = renderItems.filter((item) => item.kind === 'node' && item.rasterMask?.alpha?.length);
        const physicsMasks = new Map<string, HTMLCanvasElement>();
        for (const item of [...physicsVessels, ...physicsNodes]) {
          physicsMasks.set(item.id, buildSolidItemMask(item, viewSize, viewSize, maxDepth, halfTan, 4, 18));
        }
        drawEducationalTint(ctx, physicsVessels, physicsNodes, physicsMasks, viewSize, viewSize, activeStructure);
        ctx.restore();
        return;
      }

      if (renderPath === 'classic') {
        for (const item of renderItems) {
          if ((item.kind === 'node' || item.kind === 'vessel') && item.rasterMask?.alpha?.length) {
            drawRasterMask(ctx, item, item.rasterMask, viewSize, viewSize);
          }
        }
        ctx.restore();
        return;
      }

      const vessels = renderItems.filter((item) => item.kind === 'vessel' && item.rasterMask?.alpha?.length);
      const nodes = renderItems.filter((item) => item.kind === 'node' && item.rasterMask?.alpha?.length);

      if (vessels.length > 0) {
        const renderedMasks = new Map<string, HTMLCanvasElement>();
        const { lumen, itemMasks: vesselMasks } = buildVesselLumen(vessels, viewSize, viewSize, maxDepth, halfTan);
        for (const [id, mask] of vesselMasks) {
          renderedMasks.set(id, mask);
        }

        drawPosteriorEnhancement(ctx, lumen, viewSize, viewSize);

        ctx.save();
        drawFanClip(ctx, viewSize, viewSize);
        ctx.clip();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(lumen, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tintMask(lumen, '#080a0c'), 0, 0);
        ctx.restore();

        const fanBoundaryMask = buildFanBoundaryMask(viewSize, viewSize, Math.max(5, viewSize * 0.018));
        const outerWall = subtractMask(buildWallFromLumen(lumen, 5), fanBoundaryMask);
        ctx.save();
        drawFanClip(ctx, viewSize, viewSize);
        ctx.clip();
        ctx.filter = 'blur(0.6px)';
        ctx.globalAlpha = 0.92;
        ctx.drawImage(tintMask(outerWall, '#dad6c8'), 0, 0);
        ctx.filter = 'none';
        ctx.restore();

        const innerWall = subtractMask(buildWallFromLumen(lumen, 2), fanBoundaryMask);
        ctx.save();
        drawFanClip(ctx, viewSize, viewSize);
        ctx.clip();
        ctx.globalAlpha = 0.6;
        ctx.drawImage(tintMask(innerWall, '#a9a596'), 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();

        const occupiedMask = cloneMask(lumen);
        for (const node of nodes) {
          const rawNodeMask = buildSolidItemMask(node, viewSize, viewSize, maxDepth, halfTan, 4, 18);
          const nodeMask = subtractMask(rawNodeMask, occupiedMask, 4);

          if (!maskHasPixels(nodeMask)) {
            continue;
          }

          renderedMasks.set(node.id, nodeMask);
          drawHypoechoicNode(ctx, nodeMask, viewSize, viewSize);
          drawMaskInto(occupiedMask, nodeMask);
        }

        drawEducationalTint(ctx, vessels, nodes, renderedMasks, viewSize, viewSize, activeStructure);
      } else {
        const renderedMasks = new Map<string, HTMLCanvasElement>();
        const occupiedMask = document.createElement('canvas');
        occupiedMask.width = Math.ceil(viewSize);
        occupiedMask.height = Math.ceil(viewSize);

        for (const node of nodes) {
          const rawNodeMask = buildSolidItemMask(node, viewSize, viewSize, maxDepth, halfTan, 4, 18);
          const nodeMask = subtractMask(rawNodeMask, occupiedMask, 2);

          if (!maskHasPixels(nodeMask)) {
            continue;
          }

          renderedMasks.set(node.id, nodeMask);
          drawHypoechoicNode(ctx, nodeMask, viewSize, viewSize);
          drawMaskInto(occupiedMask, nodeMask);
        }

        drawEducationalTint(ctx, vessels, nodes, renderedMasks, viewSize, viewSize, activeStructure);
      }
      ctx.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [activeStructure, caseData.render_defaults, halfTan, renderItems, maxDepth, physicsImage, physicsSnapshot, renderPath]);

  return (
    <section
      className={`simulator-sector-pane${compact ? ' simulator-sector-pane--compact' : ''}`}
      aria-label={t('Labeled EBUS sector')}
      data-sector-source={source}
    >
      <div className="simulator-pane-header">
        <div>
          <span className="eyebrow">{t('EBUS sector')}</span>
          <h2>
            {selectedPreset
              ? `${t('Station')} ${formatSimulatorStation(selectedPreset.station)} ${t('Node')} ${selectedPreset.node.toUpperCase()}`
              : t('Live free-drive sector')}
          </h2>
        </div>
        <div className="simulator-sector-header-actions">
          {onEnlarge ? (
            <button className="simulator-sector-style-toggle simulator-pane-layout-toggle" onClick={onEnlarge} type="button">
              {t('Enlarge')}
            </button>
          ) : null}
          {onShowAll ? (
            <button className="simulator-sector-style-toggle simulator-pane-layout-toggle" onClick={onShowAll} type="button">
              {t('All views')}
            </button>
          ) : null}
          <span className="simulator-chip">{selectedPreset?.approach ?? t('Free drive')}</span>
          <div className="simulator-sector-style-switch" role="group" aria-label={t('Sector render style')}>
            {SECTOR_STYLE_OPTIONS.map((style) => (
              <button
                key={style}
                type="button"
                className="simulator-sector-style-toggle"
                aria-pressed={sectorStyle === style}
                onClick={() => {
                  setSectorStyle(style);
                  persistSectorStyle(style);
                }}
              >
                {t(SECTOR_STYLE_LABELS[style])}
              </button>
            ))}
          </div>
          {sectorStyle === 'physics' && renderPath !== 'physics' ? (
            <span className="simulator-chip simulator-sector-style-badge">{t('No snapshot yet — realistic shown')}</span>
          ) : null}
        </div>
      </div>
      <div className="simulator-sector-viewport">
        <canvas
          ref={rasterCanvasRef}
          className="simulator-sector-raster-canvas"
          data-raster-mask-layer="clean-sector"
          aria-hidden="true"
        />
        <svg
          className="simulator-sector-svg"
          viewBox="0 0 100 100"
          role="img"
          aria-label={t('Synchronized labeled EBUS sector')}
          pointerEvents="auto"
        >
          <defs>
            <clipPath id="simulatorFanClip">
              <path d="M50 7 L10 92 Q50 99 90 92 Z" />
            </clipPath>
            <filter id="sectorEdgeSoften" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.35" />
            </filter>
            <filter id="sectorActiveGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="0.7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M50 7 L10 92 Q50 99 90 92 Z" fill="none" stroke="#d5dde0" strokeOpacity="0.76" strokeWidth="0.55" />
          <g clipPath="url(#simulatorFanClip)">
            <path d="M14 14 C27 22, 72 22, 86 14" stroke="#e7e4dd" strokeOpacity="0.22" strokeWidth="1.25" fill="none" />
            {renderItems.map((item) => {
              const position = itemPosition(item);
              const active = activeStructure === item.id;

              if (item.kind === 'airway') {
                const airwayStroke = adjustHsl(item.color, 0.55, active ? 0.78 : 0.6);
                return (
                  <path
                    key={item.id}
                    d="M45.8 14.2 C48.5 16.3, 51.5 16.3, 54.2 14.2"
                    onMouseEnter={() => setActiveStructure(item.id)}
                    onMouseLeave={() => setActiveStructure(null)}
                    stroke={airwayStroke}
                    strokeOpacity={active ? 0.92 : 0.78}
                    strokeWidth={active ? 2.0 : 1.4}
                    fill="none"
                  />
                );
              }

              if (item.kind === 'contact') {
                return <circle key={item.id} cx="50" cy="8" r="1.6" fill={item.color} />;
              }

              const shape = itemShape(item);
              const contourPaths = (item.contoursMm ?? []).map((contour, index) => ({
                closed: item.contourClosed?.[index] ?? isClosedContour(contour),
                path: contourPath(contour),
              })).filter((contour) => contour.path.length > 0);
              const baseHsl = (() => {
                const { r, g, b } = hexToRgb(item.color);
                return rgbToHsl(r, g, b);
              })();
              const rimColor = adjustHsl(item.color, clamp(baseHsl.s * 0.9, 0, 1), clamp(baseHsl.l * 0.55, 0.12, 0.5));
              const activeRim = adjustHsl(item.color, baseHsl.s, 0.88);
              const strokeColor = active ? activeRim : rimColor;
              const canvasRendered = sectorItemRendersOnCanvas(renderPath, Boolean(item.rasterMask?.alpha?.length));
              const inactiveFill = canvasRendered ? 'transparent' : item.color;
              const inactiveFillOpacity = canvasRendered ? 0 : active ? 0.98 : 0.92;
              const inactiveStrokeOpacity = canvasRendered ? 0 : active ? 0.95 : 0.7;
              const activeFillOpacity = canvasRendered ? 0 : active ? 0.98 : 0.92;
              const activeStrokeOpacity = canvasRendered ? 0 : 0.95;

              return (
                <g
                  key={item.id}
                  tabIndex={0}
                  className="simulator-sector-hotspot"
                  data-structure-id={item.id}
                  data-contour-count={contourPaths.length}
                  onMouseEnter={() => setActiveStructure(item.id)}
                  onMouseLeave={() => setActiveStructure(null)}
                  onFocus={() => setActiveStructure(item.id)}
                  onBlur={() => setActiveStructure(null)}
                  filter={active ? 'url(#sectorActiveGlow)' : undefined}
                  pointerEvents="all"
                >
                  {contourPaths.length > 0 ? (
                    contourPaths.map((contour, index) => (
                      <path
                        key={`${item.id}-contour-${index}`}
                        d={contour.path}
                        fill={contour.closed ? (active ? item.color : inactiveFill) : 'none'}
                        fillOpacity={contour.closed ? (active ? activeFillOpacity : inactiveFillOpacity) : 0}
                        stroke={strokeColor}
                        strokeOpacity={active ? activeStrokeOpacity : inactiveStrokeOpacity}
                        strokeWidth={active ? 0.6 : 0.35}
                        strokeLinejoin="round"
                        filter="url(#sectorEdgeSoften)"
                      />
                    ))
                  ) : (
                    <ellipse
                      cx={position.x}
                      cy={position.y}
                      rx={active ? shape.rx * 1.06 : shape.rx}
                      ry={active ? shape.ry * 1.06 : shape.ry}
                      transform={`rotate(${shape.angleDeg.toFixed(1)} ${position.x.toFixed(2)} ${position.y.toFixed(2)})`}
                      fill={active ? item.color : inactiveFill}
                      fillOpacity={active ? activeFillOpacity : inactiveFillOpacity}
                      stroke={strokeColor}
                      strokeOpacity={active ? activeStrokeOpacity : inactiveStrokeOpacity}
                      strokeWidth={active ? 0.6 : 0.35}
                      filter="url(#sectorEdgeSoften)"
                    />
                  )}
                </g>
              );
            })}
            {sectorDebugEnabled ? (
              <g className="simulator-sector-debug-overlay" pointerEvents="none">
                {renderItems.map((item) => {
                  const debug = item.rasterMask?.debug;

                  if (!debug) {
                    return null;
                  }

                  return (
                    <g key={`${item.id}-debug`}>
                      {(debug.finalContoursMm ?? []).map((contour, index) => (
                        <path
                          key={`${item.id}-debug-final-${index}`}
                          d={contourPath(contour, true)}
                          fill="#29d3ff"
                          fillOpacity="0.08"
                          stroke="#29d3ff"
                          strokeOpacity="0.72"
                          strokeWidth="0.18"
                        />
                      ))}
                      {(debug.hullsMm ?? []).map((contour, index) => (
                        <path
                          key={`${item.id}-debug-hull-${index}`}
                          d={contourPath(contour, true)}
                          fill="none"
                          stroke="#ffd447"
                          strokeDasharray="0.8 0.65"
                          strokeOpacity="0.78"
                          strokeWidth="0.16"
                        />
                      ))}
                      {(debug.rawPointsMm ?? []).map((point, index) => {
                        const mapped = sectorPoint(point);
                        return (
                          <circle
                            key={`${item.id}-debug-raw-${index}`}
                            cx={mapped.x}
                            cy={mapped.y}
                            r="0.12"
                            fill="#8fb3ff"
                            fillOpacity="0.28"
                          />
                        );
                      })}
                      {(debug.crossingPointsMm ?? []).map((point, index) => {
                        const mapped = sectorPoint(point);
                        return (
                          <circle
                            key={`${item.id}-debug-crossing-${index}`}
                            cx={mapped.x}
                            cy={mapped.y}
                            r="0.24"
                            fill="#ff4d6d"
                            fillOpacity="0.72"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            ) : null}
          </g>
          {activeItem && activeItemPosition && activeCalloutAnchor ? (
            <g className="simulator-sector-label-leader" pointerEvents="none">
              <path
                d={`M${activeItemPosition.x.toFixed(2)} ${activeItemPosition.y.toFixed(2)} L${activeCalloutAnchor.x.toFixed(2)} ${activeCalloutAnchor.y.toFixed(2)}`}
              />
              <circle cx={activeItemPosition.x} cy={activeItemPosition.y} r="0.8" />
            </g>
          ) : null}
          <line x1="94" y1="10" x2="94" y2="91" stroke="#758086" strokeOpacity="0.34" strokeWidth="0.5" />
          {[0, 10, 20, 30, 40].map((tick) => (
            <g key={tick}>
              <line x1="92.2" x2="94" y1={8 + (tick / maxDepth) * 82} y2={8 + (tick / maxDepth) * 82} stroke="#758086" strokeOpacity="0.38" strokeWidth="0.45" />
              <text x="95" y={9 + (tick / maxDepth) * 82} fill="#8d999e" fillOpacity="0.5" fontSize="2.55">
                {tick}
              </text>
            </g>
          ))}
          <text x="13" y="96" fill="#8d999e" fillOpacity="0.58" fontSize="2.55">
            {t('caudal')}
          </text>
          <text x="76" y="96" fill="#8d999e" fillOpacity="0.58" fontSize="2.55">
            {t('cephalic')}
          </text>
        </svg>
        <div
          aria-hidden="true"
          className="simulator-sector-contact-veil"
          style={{ opacity: Math.min(1, Math.max(0, 1 - contactQuality)) * 0.97 }}
        >
          <svg className="simulator-sector-contact-noise" role="presentation">
            <filter id="simulatorSectorContactNoise">
              <feTurbulence baseFrequency="0.9" numOctaves="2" seed="7" type="fractalNoise" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.45  0 0 0 0 0.47  0 0 0 0 0.5  0 0 0 0.35 0"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#simulatorSectorContactNoise)" />
          </svg>
          {contactQuality < 0.35 ? (
            <span>{t('No transducer contact — flex toward the wall')}</span>
          ) : null}
        </div>
        {activeItem && activeCalloutAnchor ? (
          <div
            className={`simulator-sector-callout simulator-sector-callout--${activeCalloutSide}`}
            style={{
              left: `${activeCalloutAnchor.x}%`,
              top: `${activeCalloutAnchor.y}%`,
            }}
          >
            <span className="simulator-sector-callout__swatch" style={{ backgroundColor: activeItem.color }} />
            <span className="simulator-sector-callout__text">
              <span>{localizeSectorItemLabel(activeItem.label, t)}</span>
              <span>{t(activeKindLabel)}</span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="simulator-structure-list">
        {visibleItems.filter((item) => item.kind !== 'contact').map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeStructure === item.id ? 'simulator-structure-row simulator-structure-row--active' : 'simulator-structure-row'}
            onMouseEnter={() => setActiveStructure(item.id)}
            onMouseLeave={() => setActiveStructure(null)}
            onFocus={() => setActiveStructure(item.id)}
            onBlur={() => setActiveStructure(null)}
          >
            <span className="simulator-swatch" style={{ backgroundColor: item.color }} />
            <span>{localizeSectorItemLabel(item.label, t)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
