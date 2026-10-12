"""Generate iPrime brand assets (app icons, splash, favicon) for both mobile apps.

Re-run this whenever the brand colors or wordmark need to change.

    python scripts/generate-brand-assets.py

Requires: Pillow, plus Roboto_700Bold.ttf from @expo-google-fonts/roboto
(installed in mobile/customer-app/node_modules).
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = (
    ROOT
    / "mobile/customer-app/node_modules/@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf"
)

# Brand palette
ORANGE = (234, 88, 12, 255)        # #EA580C - already used for notifications + website themeColor
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)
WORDMARK = "iPrime"   # Full lettermark - used on every surface (icon, splash, favicon).


def fit_font(text: str, font_path: Path, max_w: int, max_h: int) -> ImageFont.FreeTypeFont:
    """Binary-search the largest font size whose rendered text fits within max_w x max_h."""
    lo, hi = 10, max(max_w, max_h)
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(str(font_path), mid)
        left, top, right, bottom = font.getbbox(text)
        if (right - left) <= max_w and (bottom - top) <= max_h:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return ImageFont.truetype(str(font_path), best)


def draw_centered(img: Image.Image, text: str, color, font_path: Path, width_ratio: float):
    """Render `text` centered in `img`, sized so its width is roughly width_ratio * img.width."""
    W, H = img.size
    max_w = int(W * width_ratio)
    max_h = int(H * 0.6)
    font = fit_font(text, font_path, max_w, max_h)
    left, top, right, bottom = font.getbbox(text)
    w, h = right - left, bottom - top
    # Subtract the bbox origin so the visual glyph (not the metric box) is centered.
    x = (W - w) // 2 - left
    y = (H - h) // 2 - top
    ImageDraw.Draw(img).text((x, y), text, font=font, fill=color)


def make_icon(size: int = 1024) -> Image.Image:
    """App icon: solid orange canvas, white "iPrime" wordmark. No transparency (iOS rejects it)."""
    img = Image.new("RGBA", (size, size), ORANGE)
    draw_centered(img, WORDMARK, WHITE, FONT_PATH, width_ratio=0.72)
    return img.convert("RGB")  # iOS icons must be opaque RGB


def make_adaptive_icon(size: int = 1024) -> Image.Image:
    """Android adaptive icon foreground: white "iPrime" wordmark on transparent.

    The 432/1024 ≈ 0.42 inner region is the documented Android safe area; everything
    outside may be cropped to a circle/squircle by the launcher, so we keep the mark
    well inside it. The orange background is supplied by app.json's
    android.adaptiveIcon.backgroundColor (#EA580C).
    """
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw_centered(img, WORDMARK, WHITE, FONT_PATH, width_ratio=0.36)
    return img


def make_splash_icon(size: int = 1024) -> Image.Image:
    """Splash centerpiece: white iPrime wordmark on transparent.

    Composites against app.json's splash.backgroundColor (#EA580C) for a solid
    orange brand splash with white wordmark - matches the iOS icon treatment.
    """
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw_centered(img, WORDMARK, WHITE, FONT_PATH, width_ratio=0.7)
    return img


def make_favicon(size: int = 256) -> Image.Image:
    """Web favicon: same treatment as app icon, smaller."""
    return make_icon(size)


def make_favicon_ico(out_path: Path) -> None:
    """Multi-resolution .ico for browser favicons (Next.js auto-loads app/favicon.ico)."""
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    # Pillow's ICO writer wants the largest source image and a sizes= list.
    base = make_icon(256)
    base.save(out_path, format="ICO", sizes=sizes)


def main() -> None:
    if not FONT_PATH.exists():
        raise SystemExit(f"Roboto font not found at {FONT_PATH}. Run npm install in mobile/customer-app first.")

    mobile_targets = [
        ROOT / "mobile" / "customer-app" / "assets",
        ROOT / "mobile" / "rider-app" / "assets",
        ROOT / "mobile" / "merchant-app" / "assets",
    ]

    icon = make_icon()
    adaptive = make_adaptive_icon()
    splash = make_splash_icon()
    favicon_png = make_favicon()

    for assets_dir in mobile_targets:
        assets_dir.mkdir(parents=True, exist_ok=True)
        icon.save(assets_dir / "icon.png", "PNG")
        adaptive.save(assets_dir / "adaptive-icon.png", "PNG")
        splash.save(assets_dir / "splash-icon.png", "PNG")
        favicon_png.save(assets_dir / "favicon.png", "PNG")
        print(f"Wrote 4 assets to {assets_dir}")

    # Web dashboards - Vite serves /public as the doc root.
    web_png_targets = [
        ROOT / "admin-dashboard" / "public" / "favicon.png",
        ROOT / "merchant-dashboard" / "public" / "favicon.png",
    ]
    for png_path in web_png_targets:
        png_path.parent.mkdir(parents=True, exist_ok=True)
        favicon_png.save(png_path, "PNG")
        print(f"Wrote {png_path}")

    # Marketing site - Next.js convention: app/favicon.ico
    ico_path = ROOT / "website" / "app" / "favicon.ico"
    make_favicon_ico(ico_path)
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
