from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out-minimal"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#15181d"
INK_2 = "#2b3138"
PAPER = "#f6f1e6"
LINE = "#d7ccbb"
ACCENT = "#d96d3b"
ACCENT_2 = "#f6b167"
BLUE = "#6388d1"
GREEN = "#6f9a71"
BG = "#eee8dc"
MUTED = "#616b75"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def rr(draw: ImageDraw.ImageDraw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def soft_shadow(size: int, box, radius, offset, blur, alpha=55):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = offset
    shifted = (box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy)
    d.rounded_rectangle(shifted, radius=radius, fill=(16, 18, 22, alpha))
    return img.filter(ImageFilter.GaussianBlur(blur))


def draw_m_mark(draw: ImageDraw.ImageDraw, s: float, color: str, width: int):
    pts = [(78 * s, 162 * s), (78 * s, 98 * s), (112 * s, 138 * s), (146 * s, 98 * s), (146 * s, 162 * s)]
    draw.line(pts, fill=color, width=width, joint="curve")


def sparkle(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill: str):
    draw.polygon(
        [
            (cx, cy - r),
            (cx + r * 0.24, cy - r * 0.24),
            (cx + r, cy),
            (cx + r * 0.24, cy + r * 0.24),
            (cx, cy + r),
            (cx - r * 0.24, cy + r * 0.24),
            (cx - r, cy),
            (cx - r * 0.24, cy - r * 0.24),
        ],
        fill=fill,
    )


def icon(size: int, variant: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 256
    d = ImageDraw.Draw(img)

    tile = (34 * s, 28 * s, 222 * s, 228 * s)
    img.alpha_composite(soft_shadow(size, tile, 44 * s, (0, 10 * s), 14 * s), (0, 0))

    rr(d, tile, 44 * s, INK)
    rr(d, (44 * s, 38 * s, 212 * s, 218 * s), 34 * s, INK_2)

    doc = (72 * s, 50 * s, 172 * s, 198 * s)
    rr(d, doc, 14 * s, PAPER)
    d.polygon([(145 * s, 50 * s), (172 * s, 77 * s), (145 * s, 77 * s)], fill="#e5dac9")
    d.line([(145 * s, 50 * s), (145 * s, 77 * s), (172 * s, 77 * s)], fill="#cabfac", width=max(1, int(2 * s)))
    d.line([(90 * s, 88 * s), (150 * s, 88 * s)], fill=LINE, width=max(2, int(5 * s)))

    draw_m_mark(d, s, INK, max(5, int(9 * s)))

    if variant == "app":
        rr(d, (156 * s, 154 * s, 214 * s, 212 * s), 18 * s, ACCENT)
        d.line([(171 * s, 184 * s), (183 * s, 171 * s), (194 * s, 186 * s), (205 * s, 165 * s)], fill="#fff6ec", width=max(2, int(6 * s)))
    elif variant == "ai":
        rr(d, (156 * s, 154 * s, 214 * s, 212 * s), 18 * s, ACCENT)
        sparkle(d, 186 * s, 183 * s, 20 * s, "#fff6ec")
        sparkle(d, 204 * s, 71 * s, 15 * s, ACCENT_2)
    elif variant == "file":
        rr(d, (156 * s, 154 * s, 214 * s, 212 * s), 18 * s, BLUE)
        d.text((170 * s, 157 * s), "#", font=font(int(41 * s), True), fill="#f7fbff")
    elif variant == "tray":
        rr(d, (64 * s, 64 * s, 192 * s, 192 * s), 32 * s, PAPER)
        draw_m_mark(d, s, INK, max(7, int(12 * s)))

    return img


def lockup() -> Image.Image:
    img = Image.new("RGBA", (940, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    img.alpha_composite(icon(180, "app"), (46, 60))
    d.text((255, 88), "marka.md", font=font(72, True), fill=INK)
    d.text((260, 170), "minimal markdown workspace", font=font(26), fill=MUTED)
    return img


def card(asset: Image.Image, title: str, note: str) -> Image.Image:
    out = Image.new("RGBA", (290, 370), "#f8f4eb")
    d = ImageDraw.Draw(out)
    rr(d, (8, 8, 282, 362), 22, "#fffaf2", "#ded5c4", 2)
    out.alpha_composite(asset.resize((180, 180), Image.LANCZOS), (55, 44))
    d.text((28, 250), title, font=font(24, True), fill=INK)
    d.text((28, 287), note, font=font(16), fill=MUTED)
    return out


def main():
    assets = {
        "minimal-app-icon.png": icon(1024, "app"),
        "minimal-ai-icon.png": icon(1024, "ai"),
        "minimal-file-icon.png": icon(1024, "file"),
        "minimal-tray-icon.png": icon(1024, "tray"),
        "minimal-logo-lockup.png": lockup(),
    }
    for name, image in assets.items():
        image.save(OUT / name)

    sheet = Image.new("RGBA", (1280, 500), BG)
    d = ImageDraw.Draw(sheet)
    d.text((42, 30), "marka.md minimal icon proposal", font=font(40, True), fill=INK)
    d.text((44, 82), "single document mark, limited palette, clearer at tray and shortcut sizes", font=font(21), fill=MUTED)
    cards = [
        card(assets["minimal-app-icon.png"], "App", "main shortcut / installer"),
        card(assets["minimal-ai-icon.png"], "AI", "proofread / prompt action"),
        card(assets["minimal-file-icon.png"], "File", "markdown association"),
        card(assets["minimal-tray-icon.png"], "Tray", "small monochrome-safe mark"),
    ]
    for i, c in enumerate(cards):
        sheet.alpha_composite(c, (42 + i * 305, 118))
    sheet.save(OUT / "minimal-icon-set-preview.png")


if __name__ == "__main__":
    main()
