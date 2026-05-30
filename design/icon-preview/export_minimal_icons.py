from __future__ import annotations

from pathlib import Path
import re
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design" / "icon-preview" / "out-minimal"
TAURI = ROOT / "src-tauri" / "icons"
PUBLIC = ROOT / "public"
BRAND = ROOT / "src" / "assets" / "brand"


def load(name: str) -> Image.Image:
    return Image.open(SOURCE / name).convert("RGBA")


def save_png(img: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(path)


def save_ico(img: Image.Image, path: Path) -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, sizes=[(size, size) for size in sizes])


def save_icns(img: Image.Image, path: Path) -> None:
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    frames = [img.resize((size, size), Image.Resampling.LANCZOS) for size in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[-1].save(path, sizes=[(size, size) for size in sizes], append_images=frames[:-1])


def main() -> None:
    app = load("minimal-app-icon.png")
    ai = load("minimal-ai-icon.png")
    file_icon = load("minimal-file-icon.png")
    tray = load("minimal-tray-icon.png")
    lockup = load("minimal-logo-lockup.png")

    # Tauri desktop / Windows bundle icons.
    save_png(app, TAURI / "32x32.png", 32)
    save_png(app, TAURI / "64x64.png", 64)
    save_png(app, TAURI / "128x128.png", 128)
    save_png(app, TAURI / "128x128@2x.png", 256)
    save_png(app, TAURI / "icon.png", 512)
    save_ico(app, TAURI / "icon.ico")
    save_icns(app, TAURI / "icon.icns")

    for size in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
        save_png(app, TAURI / f"Square{size}x{size}Logo.png", size)
    save_png(app, TAURI / "StoreLogo.png", 50)

    # Android and iOS generated assets kept in sync for future cross-platform builds.
    android_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in android_sizes.items():
        save_png(app, TAURI / "android" / folder / "ic_launcher.png", size)
        save_png(app, TAURI / "android" / folder / "ic_launcher_round.png", size)
        save_png(app, TAURI / "android" / folder / "ic_launcher_foreground.png", size * 2)

    for path in (TAURI / "ios").glob("*.png"):
        match = re.match(r"AppIcon-(\d+(?:\.\d+)?)x\1@(\dx)", path.stem)
        if not match:
            match = re.match(r"AppIcon-(\d+(?:\.\d+)?)@(\dx)", path.stem)
        if not match:
            continue
        size = int(round(float(match.group(1))))
        if "@2x" in path.name:
            size *= 2
        elif "@3x" in path.name:
            size *= 3
        save_png(app, path, size)

    # Browser favicons used by Vite/dev and installed WebView resources.
    save_png(app, PUBLIC / "favicon-16x16.png", 16)
    save_png(app, PUBLIC / "favicon-32x32.png", 32)
    save_png(app, PUBLIC / "apple-touch-icon.png", 180)
    save_ico(app, PUBLIC / "favicon.ico")
    save_png(app, PUBLIC / "brand" / "marka-app-icon.png", 512)
    save_png(ai, PUBLIC / "brand" / "marka-ai-icon.png", 512)
    save_png(file_icon, PUBLIC / "brand" / "marka-file-icon.png", 512)
    save_png(tray, PUBLIC / "brand" / "marka-tray-icon.png", 512)

    # App-internal brand assets.
    BRAND.mkdir(parents=True, exist_ok=True)
    save_png(app, BRAND / "marka-app-icon.png", 512)
    save_png(ai, BRAND / "marka-ai-icon.png", 512)
    save_png(file_icon, BRAND / "marka-file-icon.png", 512)
    save_png(tray, BRAND / "marka-tray-icon.png", 512)
    lockup.save(BRAND / "marka-logo-lockup.png")


if __name__ == "__main__":
    main()
