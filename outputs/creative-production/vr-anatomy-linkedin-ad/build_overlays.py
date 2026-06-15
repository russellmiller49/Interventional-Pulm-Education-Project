from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
OVERLAYS = ROOT / "overlays"
OVERLAYS.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size, index=index)
            except OSError:
                continue
    return ImageFont.load_default(size=size)


FONT_HEAVY = font(72, 1)
FONT_CTA_DOMAIN = font(58, 1)
FONT_MEDIUM = font(43, 0)
FONT_SMALL = font(30, 0)
FONT_TINY = font(24, 0)

WHITE = (246, 251, 255, 255)
MUTED = (178, 205, 216, 255)
CYAN = (88, 232, 246, 255)
MINT = (121, 255, 196, 255)
NAVY = (5, 14, 24, 238)
NAVY_SOFT = (5, 14, 24, 205)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def add_shadowed_text(
    img: Image.Image,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill=WHITE,
    anchor: str = "la",
    align: str = "left",
    line_spacing: int = 12,
    stroke: int = 0,
):
    draw = ImageDraw.Draw(img)
    x, y = xy
    shadow_layers = [
        ((0, 6), (0, 0, 0, 115)),
        ((0, 2), (0, 0, 0, 170)),
    ]
    for offset, color in shadow_layers:
        draw.multiline_text(
            (x + offset[0], y + offset[1]),
            text,
            font=fnt,
            fill=color,
            anchor=anchor,
            align=align,
            spacing=line_spacing,
            stroke_width=stroke,
            stroke_fill=color,
        )
    draw.multiline_text(
        xy,
        text,
        font=fnt,
        fill=fill,
        anchor=anchor,
        align=align,
        spacing=line_spacing,
        stroke_width=stroke,
        stroke_fill=(0, 0, 0, 120) if stroke else None,
    )


def add_top_gradient(img: Image.Image, strength: int = 230, height: int = 360):
    grad = Image.new("RGBA", (W, height), (0, 0, 0, 0))
    pix = grad.load()
    for y in range(height):
        alpha = int(strength * (1 - y / height) ** 1.7)
        for x in range(W):
            pix[x, y] = (2, 11, 19, alpha)
    img.alpha_composite(grad, (0, 0))


def add_bottom_gradient(img: Image.Image, strength: int = 190, height: int = 320):
    grad = Image.new("RGBA", (W, height), (0, 0, 0, 0))
    pix = grad.load()
    for y in range(height):
        alpha = int(strength * (y / height) ** 1.45)
        for x in range(W):
            pix[x, y] = (2, 11, 19, alpha)
    img.alpha_composite(grad, (0, H - height))


def add_brand(draw: ImageDraw.ImageDraw, x: int = 92, y: int = 58):
    rounded_rect(draw, (x, y, x + 118, y + 46), 18, (4, 27, 40, 210), (72, 226, 238, 165), 2)
    draw.text((x + 22, y + 11), "IP LAB", font=FONT_TINY, fill=CYAN)
    rounded_rect(draw, (x + 138, y, x + 306, y + 46), 23, (121, 255, 196, 235), None)
    draw.text((x + 162, y + 11), "FREE", font=FONT_TINY, fill=(3, 15, 24, 255))
    draw.text((x + 330, y + 7), "interventionalpulm.com", font=FONT_SMALL, fill=WHITE)


def pill(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, color=CYAN):
    bbox = draw.textbbox((0, 0), text, font=FONT_TINY)
    tw = bbox[2] - bbox[0]
    outline = (color[0], color[1], color[2], 140)
    rounded_rect(draw, (x, y, x + tw + 38, y + 42), 21, (9, 36, 48, 218), outline, 2)
    draw.text((x + 19, y + 10), text, font=FONT_TINY, fill=color)


def make_overlay(
    name: str,
    title: str,
    subtitle: str,
    *,
    layout: str,
    tags: list[str] | None = None,
    hide_browser: bool = False,
):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    add_top_gradient(img, 238 if hide_browser else 172, 430 if hide_browser else 300)
    add_bottom_gradient(img, 175, 330)

    if hide_browser:
        cover_h = 470 if layout == "hero" else 250
        rounded_rect(draw, (0, 0, W, cover_h), 0, (3, 12, 22, 255))

    add_brand(draw)

    if layout == "hero":
        title_xy = (92, 154)
        add_shadowed_text(img, title_xy, title, FONT_HEAVY, fill=WHITE, stroke=1)
        title_bbox = draw.multiline_textbbox(
            title_xy,
            title,
            font=FONT_HEAVY,
            spacing=12,
            stroke_width=1,
        )
        subtitle_y = title_bbox[3] + 28
        add_shadowed_text(img, (96, subtitle_y), subtitle, FONT_MEDIUM, fill=MUTED)
        subtitle_bbox = draw.multiline_textbbox(
            (96, subtitle_y),
            subtitle,
            font=FONT_MEDIUM,
            spacing=12,
        )
        if tags:
            x = 96
            tag_y = subtitle_bbox[3] + 28
            for tag in tags:
                pill(draw, tag, x, tag_y, MINT if "VR" in tag else CYAN)
                x += draw.textbbox((0, 0), tag, font=FONT_TINY)[2] + 62
    elif layout == "lower":
        panel = (70, H - 245, W - 70, H - 70)
        rounded_rect(draw, panel, 34, NAVY_SOFT, (92, 226, 238, 105), 2)
        draw.rectangle((96, H - 245, 104, H - 70), fill=CYAN)
        add_shadowed_text(img, (128, H - 211), title, FONT_MEDIUM, fill=WHITE)
        add_shadowed_text(img, (128, H - 148), subtitle, FONT_SMALL, fill=MUTED)
    elif layout == "center":
        panel = (92, 132, 970, 475)
        rounded_rect(draw, panel, 36, NAVY, (92, 226, 238, 145), 2)
        title_xy = (132, 178)
        add_shadowed_text(img, title_xy, title, FONT_HEAVY, fill=WHITE, stroke=1)
        title_bbox = draw.multiline_textbbox(
            title_xy,
            title,
            font=FONT_HEAVY,
            spacing=12,
            stroke_width=1,
        )
        add_shadowed_text(img, (136, title_bbox[3] + 28), subtitle, FONT_SMALL, fill=MUTED)
    elif layout == "cta":
        panel = (92, 665, W - 92, 980)
        rounded_rect(draw, panel, 40, (3, 14, 24, 232), (121, 255, 196, 155), 2)
        draw.rectangle((132, 708, 142, 940), fill=MINT)
        add_shadowed_text(img, (176, 704), title, FONT_HEAVY, fill=WHITE, stroke=1)
        add_shadowed_text(img, (180, 805), subtitle, FONT_SMALL, fill=MUTED)
        add_shadowed_text(img, (180, 852), "interventionalpulm.com", FONT_CTA_DOMAIN, fill=WHITE, stroke=1)
        button = (1300, 842, 1748, 906)
        rounded_rect(draw, button, 32, (79, 234, 246, 238), None)
        button_text = "Completely free to use"
        button_bbox = draw.textbbox((0, 0), button_text, font=FONT_SMALL)
        button_text_x = button[0] + ((button[2] - button[0]) - (button_bbox[2] - button_bbox[0])) // 2
        draw.text((button_text_x, 859), button_text, font=FONT_SMALL, fill=(2, 15, 24, 255))
    else:
        raise ValueError(layout)

    img = img.filter(ImageFilter.GaussianBlur(radius=0.0))
    path = OVERLAYS / f"{name}.png"
    img.save(path)
    return path


def make_constant_polish():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    add_top_gradient(img, 78, 190)
    add_bottom_gradient(img, 110, 210)
    vignette = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(vignette)
    draw.ellipse((-240, -180, W + 240, H + 280), fill=0)
    vignette = Image.eval(vignette.filter(ImageFilter.GaussianBlur(90)), lambda p: min(70, int(p * 0.55)))
    edge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    edge.putalpha(vignette)
    img.alpha_composite(edge)
    path = OVERLAYS / "constant_polish.png"
    img.save(path)
    return path


overlays = [
    {
        "name": "01_hook",
        "start": 0.35,
        "end": 4.55,
        "path": str(
            make_overlay(
                "01_hook",
                "Put thoracic anatomy\nin the room",
                "Free interactive 3D anatomy for interventional pulmonary training.",
                layout="hero",
                tags=["Free signup", "3D anatomy", "VR-ready"],
                hide_browser=True,
            )
        ),
    },
    {
        "name": "02_browser",
        "start": 4.55,
        "end": 10.95,
        "path": str(
            make_overlay(
                "02_browser",
                "Start in the browser",
                "Review labeled anatomy with synced CT slices before entering VR.",
                layout="lower",
                hide_browser=True,
            )
        ),
    },
    {
        "name": "03_step_inside",
        "start": 10.95,
        "end": 14.35,
        "path": str(
            make_overlay(
                "03_step_inside",
                "Then step\ninside it",
                "A headset turns the model into a spatial anatomy lab.",
                layout="center",
            )
        ),
    },
    {
        "name": "04_headsets",
        "start": 14.35,
        "end": 23.8,
        "path": str(
            make_overlay(
                "04_headsets",
                "Works with VR headsets",
                "Use Apple Vision Pro or Meta Quest to view supported anatomy in immersive 3D.",
                layout="lower",
            )
        ),
    },
    {
        "name": "05_spatial",
        "start": 23.8,
        "end": 31.1,
        "path": str(
            make_overlay(
                "05_spatial",
                "Walk around the relationships",
                "Scale, rotate, and inspect structures from the angles that matter.",
                layout="lower",
            )
        ),
    },
    {
        "name": "06_stent",
        "start": 31.1,
        "end": 41.0,
        "path": str(
            make_overlay(
                "06_stent",
                "All models are\navailable in 3D",
                "Bring the full model library\ninto immersive review.",
                layout="hero",
                tags=["All models", "3D anatomy", "VR review"],
            )
        ),
    },
    {
        "name": "07_cta",
        "start": 41.0,
        "end": 50.5,
        "path": str(
            make_overlay(
                "07_cta",
                "Free 3D anatomy training",
                "Sign up free for immersive anatomy, bronchoscopy, and procedure modules at",
                layout="cta",
            )
        ),
    },
]

manifest = {
    "campaign": "VR anatomy LinkedIn signup ad",
    "source_video": "/Users/russellmiller/Movies/3D_Anatomy_1.mp4",
    "dimensions": {"width": W, "height": H, "fps": 30},
    "constant_polish": str(make_constant_polish()),
    "overlays": overlays,
    "copy": [
        "Put thoracic anatomy in the room",
        "Free interactive 3D anatomy",
        "Start in the browser",
        "Then step inside it",
        "Works with VR headsets",
        "Walk around the relationships",
        "All models are available in 3D",
        "Free 3D anatomy training",
        "Sign up free at interventionalpulm.com",
    ],
    "provenance": "User-provided video with deterministic text, bars, and polish overlays. No generated claims or third-party media.",
}

(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
