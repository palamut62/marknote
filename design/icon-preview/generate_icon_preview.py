from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#20252b"
MUTED = "#59636e"
PAPER = "#f8f5eb"
PAPER_2 = "#e8e0cf"
ACCENT = "#d86b35"
ACCENT_2 = "#f5a45e"
BLUE = "#597fc6"
GREEN = "#5f8f68"
SHADOW = (20, 24, 30, 42)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def sparkle(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill: str):
    points = [
        (cx, cy - r),
        (cx + r * 0.22, cy - r * 0.22),
        (cx + r, cy),
        (cx + r * 0.22, cy + r * 0.22),
        (cx, cy + r),
        (cx - r * 0.22, cy + r * 0.22),
        (cx - r, cy),
        (cx - r * 0.22, cy - r * 0.22),
    ]
    draw.polygon(points, fill=fill)


def draw_document_mark(size: int, variant: str = "app") -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 256

    # shadow and base tile
    rounded(d, (24 * s, 28 * s, 232 * s, 232 * s), 48 * s, SHADOW)
    rounded(d, (20 * s, 18 * s, 228 * s, 226 * s), 44 * s, INK)
    rounded(d, (30 * s, 28 * s, 218 * s, 216 * s), 36 * s, "#303841")

    # paper
    doc = (58 * s, 42 * s, 186 * s, 202 * s)
    rounded(d, doc, 18 * s, PAPER, "#ffffff", max(1, int(2 * s)))
    d.polygon(
        [(154 * s, 42 * s), (186 * s, 74 * s), (154 * s, 74 * s)],
        fill=PAPER_2,
    )
    d.line([(154 * s, 42 * s), (154 * s, 74 * s), (186 * s, 74 * s)], fill="#cfc5b4", width=max(1, int(2 * s)))

    # markdown rails
    d.line([(76 * s, 90 * s), (168 * s, 90 * s)], fill="#cfc5b4", width=max(2, int(5 * s)))
    d.line([(76 * s, 112 * s), (152 * s, 112 * s)], fill="#cfc5b4", width=max(2, int(5 * s)))

    # M glyph
    m_font = font(int(68 * s), bold=True)
    d.text((75 * s, 112 * s), "M", font=m_font, fill=INK)
    d.text((142 * s, 133 * s), "d", font=font(int(38 * s), bold=True), fill=ACCENT)

    # accent block
    rounded(d, (150 * s, 148 * s, 214 * s, 212 * s), 16 * s, ACCENT)
    d.line([(164 * s, 184 * s), (177 * s, 170 * s), (192 * s, 188 * s), (207 * s, 160 * s)], fill="#fff7ed", width=max(2, int(7 * s)))

    if variant == "ai":
        sparkle(d, 192 * s, 58 * s, 20 * s, ACCENT_2)
        sparkle(d, 210 * s, 92 * s, 9 * s, "#fff7ed")
    elif variant == "file":
        d.text((72 * s, 151 * s), "#", font=font(int(54 * s), bold=True), fill=BLUE)
    elif variant == "tray":
        rounded(d, (84 * s, 83 * s, 172 * s, 173 * s), 18 * s, PAPER, None)
        d.text((99 * s, 96 * s), "M", font=font(int(58 * s), bold=True), fill=INK)

    return img


def draw_logo_lockup() -> Image.Image:
    img = Image.new("RGBA", (900, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    mark = draw_document_mark(220, "ai")
    img.alpha_composite(mark, (42, 50))
    d.text((300, 92), "marka.md", font=font(76, bold=True), fill=INK)
    d.text((304, 175), "local markdown editor for AI-ready notes", font=font(28), fill=MUTED)
    d.line((306, 225, 650, 225), fill=ACCENT, width=8)
    return img


def label_card(base: Image.Image, title: str, subtitle: str) -> Image.Image:
    card = Image.new("RGBA", (300, 390), "#f7f3ea")
    d = ImageDraw.Draw(card)
    rounded(d, (8, 8, 292, 382), 18, "#fffaf0", "#ded5c4", 2)
    preview = base.resize((196, 196), Image.LANCZOS)
    card.alpha_composite(preview, (52, 40))
    d.text((28, 258), title, font=font(25, bold=True), fill=INK)
    d.text((28, 294), subtitle, font=font(17), fill=MUTED)
    return card


def main():
    assets = {
        "marka-app-icon.png": draw_document_mark(1024, "app"),
        "marka-ai-icon.png": draw_document_mark(1024, "ai"),
        "marka-file-icon.png": draw_document_mark(1024, "file"),
        "marka-tray-icon.png": draw_document_mark(1024, "tray"),
        "marka-logo-lockup.png": draw_logo_lockup(),
    }
    for name, image in assets.items():
        image.save(OUT / name)

    cards = [
        label_card(assets["marka-app-icon.png"], "App icon", "installer, window, shortcut"),
        label_card(assets["marka-ai-icon.png"], "AI action", "proofread and prompt tools"),
        label_card(assets["marka-file-icon.png"], "Markdown file", ".md association"),
        label_card(assets["marka-tray-icon.png"], "Tray icon", "small-size readable mark"),
    ]
    sheet = Image.new("RGBA", (1280, 520), "#ece5d8")
    d = ImageDraw.Draw(sheet)
    d.text((44, 34), "marka.md icon set proposal", font=font(42, bold=True), fill=INK)
    d.text((46, 88), "clean document mark, warm accent, readable at shortcut/tray sizes", font=font(22), fill=MUTED)
    for index, card in enumerate(cards):
        sheet.alpha_composite(card, (40 + index * 310, 120))
    sheet.save(OUT / "marka-icon-set-preview.png")


if __name__ == "__main__":
    main()
