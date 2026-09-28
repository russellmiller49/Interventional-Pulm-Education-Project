"""Tools for measuring the manufacturer's reference frames.

The frames are stills from a product animation, held in the owner's local data. They are read
in place and never copied into the repository. Only numbers leave this module.

Three tools are here:

- ``Frame``: a frame with sub-pixel sampling, a silhouette mask and profiles across a line.
- ``TubeCamera``: a pinhole camera fitted to a straight tube of known diameter and length. The
  tube's apparent width at each end gives the depth of that end, and its known length then fixes
  the focal length. Points on a plane through the tube's axis can then be read in millimetres.
- ``fit_ellipse``: the best ellipse through a set of points, for a circular part seen at an
  angle.
"""

from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

PPTX_PARTS = ("medical_thoracoscopy", "wolf images", "mini-thoracoscopy.pptx")


def read_frame_bytes(pptx: Path, number: int) -> bytes:
    """The bytes of one embedded frame, read from the presentation without unpacking it."""
    with zipfile.ZipFile(pptx) as archive:
        return archive.read(f"ppt/media/image{number}.png")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class Frame:
    def __init__(self, data: bytes, number: int):
        self.number = number
        self.sha256 = sha256_bytes(data)
        self.rgb = np.asarray(Image.open(io.BytesIO(data)).convert("RGB")).astype(np.float64)
        self.lum = self.rgb.mean(axis=2)
        self.height, self.width = self.lum.shape

    # The animation sits on a white card with black bars at the sides.
    def card(self) -> tuple[int, int, int, int]:
        light = self.lum > 200
        cols = np.nonzero(light.mean(axis=0) > 0.5)[0]
        rows = np.nonzero(light.mean(axis=1) > 0.5)[0]
        return int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1

    def centre(self) -> np.ndarray:
        x0, y0, x1, y1 = self.card()
        return np.array([(x0 + x1 - 1) / 2.0, (y0 + y1 - 1) / 2.0])

    def sample(self, points: np.ndarray) -> np.ndarray:
        x = points[:, 0]
        y = points[:, 1]
        x0 = np.clip(np.floor(x).astype(int), 0, self.width - 2)
        y0 = np.clip(np.floor(y).astype(int), 0, self.height - 2)
        fx = x - x0
        fy = y - y0
        lum = self.lum
        return (
            lum[y0, x0] * (1 - fx) * (1 - fy)
            + lum[y0, x0 + 1] * fx * (1 - fy)
            + lum[y0 + 1, x0] * (1 - fx) * fy
            + lum[y0 + 1, x0 + 1] * fx * fy
        )

    def colour_at(self, point: np.ndarray) -> np.ndarray:
        x = int(round(float(point[0])))
        y = int(round(float(point[1])))
        return self.rgb[np.clip(y, 0, self.height - 1), np.clip(x, 0, self.width - 1)]

    def object_mask(self, white: float = 238.0, drop_red_caption: bool = True) -> np.ndarray:
        """The largest object on the card.

        Background is the near-white region connected to the card's edge, so a bright highlight
        inside the object stays part of the object. The caption is saturated red and is removed.
        """
        x0, y0, x1, y1 = self.card()
        inside = np.zeros(self.lum.shape, dtype=bool)
        inside[y0:y1, x0:x1] = True
        near_white = (self.lum >= white) & inside
        labels, _count = ndi.label(near_white)
        border = (
            set(np.unique(labels[y0, x0:x1]))
            | set(np.unique(labels[y1 - 1, x0:x1]))
            | set(np.unique(labels[y0:y1, x0]))
            | set(np.unique(labels[y0:y1, x1 - 1]))
        )
        border.discard(0)
        mask = inside & ~np.isin(labels, list(border))
        if drop_red_caption:
            r, g, b = self.rgb[:, :, 0], self.rgb[:, :, 1], self.rgb[:, :, 2]
            red = (r > 120) & (r - g > 60) & (r - b > 40)
            mask &= ~ndi.binary_dilation(red, iterations=3)
        labels, count = ndi.label(mask)
        if count == 0:
            raise ValueError(f"frame {self.number}: no object found")
        sizes = ndi.sum(mask, labels, range(1, count + 1))
        return labels == (1 + int(np.argmax(sizes)))


@dataclass
class Line:
    origin: np.ndarray
    direction: np.ndarray

    @property
    def normal(self) -> np.ndarray:
        return np.array([-self.direction[1], self.direction[0]])

    def at(self, t: float, across: float = 0.0) -> np.ndarray:
        return self.origin + self.direction * t + self.normal * across

    @staticmethod
    def through(a, b) -> "Line":
        a = np.asarray(a, dtype=float)
        b = np.asarray(b, dtype=float)
        return Line(a, (b - a) / np.linalg.norm(b - a))

    def refined(self, offset: float, slope: float) -> "Line":
        direction = self.direction + slope * self.normal
        return Line(self.origin + self.normal * offset, direction / np.linalg.norm(direction))


def outer_edges(frame: Frame, line: Line, t: float, half: float, drop: float = 20.0,
                background: float | None = None, step: float = 0.25):
    """Where a profile across the line first leaves the background, on each side.

    Working inward from both ends makes this robust to highlights inside the object.
    """
    across = np.arange(-half, half + step, step)
    values = frame.sample(line.at(t)[None, :] + across[:, None] * line.normal[None, :])
    level = np.percentile(values, 97) if background is None else background
    threshold = level - drop
    below = np.nonzero(values < threshold)[0]
    if len(below) == 0 or below[0] == 0 or below[-1] == len(across) - 1:
        return None

    def crossing(outside: int, inside: int) -> float:
        v0, v1 = values[outside], values[inside]
        fraction = (threshold - v0) / (v1 - v0) if v1 != v0 else 0.0
        return float(across[outside] + fraction * (across[inside] - across[outside]))

    return crossing(below[0] - 1, below[0]), crossing(below[-1] + 1, below[-1])


def silhouette_edges(frame: Frame, line: Line, t: float, half: float, rim_px: float = 3.0,
                     step: float = 0.25, background: float | None = None):
    """Where a profile across the line leaves the background, on each side, at half contrast.

    A fixed threshold below the background places the edge deeper into the object wherever the
    object's own rim is light, and the rim of polished metal changes along a shaft. Here each edge
    is placed half way between the background and the object's luminance `rim_px` inside it.
    """
    across = np.arange(-half, half + step, step)
    values = frame.sample(line.at(t)[None, :] + across[:, None] * line.normal[None, :])
    level_bg = np.percentile(values, 97) if background is None else background
    below = np.nonzero(values < level_bg - 8.0)[0]
    if len(below) == 0 or below[0] == 0 or below[-1] == len(across) - 1:
        return None
    inset = int(round(rim_px / step))

    def edge(first_inside: int, inward: int) -> float:
        rim_index = int(np.clip(first_inside + inward * inset, 0, len(across) - 1))
        level = (level_bg + values[rim_index]) / 2
        index = first_inside
        while 0 < index < len(across) - 1 and values[index] > level:
            index += inward
        outside = index - inward
        v0, v1 = values[outside], values[index]
        fraction = (level - v0) / (v1 - v0) if v1 != v0 else 0.0
        return float(across[outside] + fraction * (across[index] - across[outside]))

    return edge(int(below[0]), 1), edge(int(below[-1]), -1)


def mask_run(mask: np.ndarray, line: Line, t: float, half: float, step: float = 0.5):
    """The stretch of the mask that the line passes through at t, as offsets across the line."""
    across = np.arange(-half, half + step, step)
    points = line.at(t)[None, :] + across[:, None] * line.normal[None, :]
    xi = np.clip(np.round(points[:, 0]).astype(int), 0, mask.shape[1] - 1)
    yi = np.clip(np.round(points[:, 1]).astype(int), 0, mask.shape[0] - 1)
    inside = mask[yi, xi]
    centre = int(np.argmin(np.abs(across)))
    if not inside[centre]:
        return None
    low = centre
    while low > 0 and inside[low - 1]:
        low -= 1
    high = centre
    while high < len(across) - 1 and inside[high + 1]:
        high += 1
    if low == 0 or high == len(across) - 1:
        return None
    return float(across[low] - step / 2), float(across[high] + step / 2)


def fit_line(x: np.ndarray, y: np.ndarray, rounds: int = 4, reject: float = 2.5):
    """Slope and intercept, with points far from the line dropped and the fit repeated."""
    keep = np.ones(len(x), dtype=bool)
    slope = intercept = 0.0
    for _ in range(rounds):
        design = np.vstack([x[keep], np.ones(keep.sum())]).T
        slope, intercept = np.linalg.lstsq(design, y[keep], rcond=None)[0]
        residual = y - (slope * x + intercept)
        spread = residual[keep].std()
        if spread == 0:
            break
        keep = np.abs(residual) < reject * spread
    residual = y[keep] - (slope * x[keep] + intercept)
    return float(slope), float(intercept), float(residual.std()), int(keep.sum())


class TubeCamera:
    """A pinhole camera fitted to a straight tube of known diameter and length."""

    def __init__(self, tip_px, end_px, width_tip, width_end, diameter_mm, length_mm, centre_px):
        self.centre = np.asarray(centre_px, dtype=float)
        xt, yt = np.asarray(tip_px, dtype=float) - self.centre
        xe, ye = np.asarray(end_px, dtype=float) - self.centre
        d = diameter_mm
        across = d * (xe / width_end - xt / width_tip)
        up = d * (ye / width_end - yt / width_tip)
        depth_squared = length_mm**2 - across**2 - up**2
        if depth_squared <= 0:
            raise ValueError("the tube is longer in the frame than its length allows")
        self.focal_px = float(np.sqrt(depth_squared) / (d * abs(1 / width_end - 1 / width_tip)))
        self.tip = np.array([xt * d / width_tip, yt * d / width_tip, self.focal_px * d / width_tip])
        self.end = np.array([xe * d / width_end, ye * d / width_end, self.focal_px * d / width_end])
        self.axis = (self.end - self.tip) / np.linalg.norm(self.end - self.tip)
        self.roll_deg = 0.0
        self._set_plane(0.0)

    def _set_plane(self, roll_deg: float) -> None:
        image_up = np.array([0.0, -1.0, 0.0])
        up = image_up - np.dot(image_up, self.axis) * self.axis
        up /= np.linalg.norm(up)
        side = np.cross(self.axis, up)
        angle = np.radians(roll_deg)
        self.up = np.cos(angle) * up + np.sin(angle) * side
        self.side = np.cross(self.axis, self.up)
        self.roll_deg = float(roll_deg)

    def set_roll(self, roll_deg: float) -> None:
        """Turn the measuring plane about the tube's axis."""
        self._set_plane(roll_deg)

    @property
    def tilt_deg(self) -> float:
        return float(np.degrees(np.arcsin(self.axis[2])))

    def to_plane(self, pixel) -> np.ndarray:
        """(u, v) in millimetres: u along the tube from its tip, v across it, on the plane."""
        x, y = np.asarray(pixel, dtype=float) - self.centre
        ray = np.array([x, y, self.focal_px])
        scale = np.dot(self.tip, self.side) / np.dot(ray, self.side)
        point = ray * scale
        return np.array([np.dot(point - self.tip, self.axis), np.dot(point - self.tip, self.up)])

    def depth(self, u: float, v: float = 0.0) -> float:
        return float((self.tip + self.axis * u + self.up * v)[2])

    def width_mm(self, width_px: float, u: float, v: float = 0.0) -> float:
        """A width across the view, at the depth of the point (u, v) on the plane."""
        return float(width_px * self.depth(u, v) / self.focal_px)


def fit_ellipse(points: np.ndarray):
    """Centre, semi-axes (major first) and the angle of the major axis, in radians."""
    from skimage.measure import EllipseModel

    if hasattr(EllipseModel, "from_estimate"):
        model = EllipseModel.from_estimate(points)
        centre = np.asarray(model.center, dtype=float)
        first, second = (float(value) for value in model.axis_lengths)
        angle = float(model.theta)
    else:  # scikit-image before 0.26
        model = EllipseModel()
        if not model.estimate(points):
            raise ValueError("no ellipse fits these points")
        cx, cy, first, second, angle = (float(value) for value in model.params)
        centre = np.array([cx, cy])
    if second > first:
        first, second = second, first
        angle += np.pi / 2
    return centre, first, second, angle
