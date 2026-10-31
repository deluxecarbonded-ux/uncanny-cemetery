#!/usr/bin/env python3
"""
Exotic Browser — Pure Monochrome (#000000 & #FFFFFF) Brand Asset Generator.
Strictly zero borders, zero outlines, zero gradients, zero color tints.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BRAND_DIR = ASSETS / "gecko-branding"
ASSETS.mkdir(parents=True, exist_ok=True)
BRAND_DIR.mkdir(parents=True, exist_ok=True)


def render_exotic_mark(size: int = 1024, dark_bg: bool = True) -> Image.Image:
    """
    Renders the Exotic architectural geometric monogram at `size`x`size`
    using only solid #000000 and #FFFFFF surfaces (zero borders, zero outlines, zero gradients).
    """
    bg_rgba = (0, 0, 0, 255) if dark_bg else (255, 255, 255, 255)
    fg_rgba = (255, 255, 255, 255) if dark_bg else (0, 0, 0, 255)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.06)
    radius = int(size * 0.20)

    # Solid frameless monochrome squircle container — strictly zero outline/border
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=radius,
        fill=bg_rgba,
    )

    # Architectural geometric "E" precision bars inside
    bar_h = int(size * 0.092)
    left_x = int(size * 0.26)
    right_x = int(size * 0.74)
    mid_right_x = int(size * 0.63)

    top_y = int(size * 0.25)
    mid_y = int(size * 0.50) - bar_h // 2
    bot_y = int(size * 0.75) - bar_h

    spine_w = int(size * 0.096)
    draw.rectangle([left_x, top_y, right_x, top_y + bar_h], fill=fg_rgba)
    draw.rectangle([left_x, top_y, left_x + spine_w, mid_y + bar_h], fill=fg_rgba)
    draw.rectangle([left_x, mid_y, mid_right_x, mid_y + bar_h], fill=fg_rgba)

    gap_y = mid_y + bar_h + int(size * 0.055)
    draw.rectangle([left_x, gap_y, left_x + spine_w, bot_y + bar_h], fill=fg_rgba)
    draw.rectangle([left_x, bot_y, right_x, bot_y + bar_h], fill=fg_rgba)

    sq_x = right_x - bar_h
    draw.rectangle([sq_x, mid_y, right_x, mid_y + bar_h], fill=fg_rgba)

    return img


def make_svg_mark(dark_bg: bool = True) -> str:
    bg = "#000000" if dark_bg else "#ffffff"
    fg = "#ffffff" if dark_bg else "#000000"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <rect x="8" y="8" width="112" height="112" rx="24" fill="{bg}"/>
  <rect x="33" y="32" width="62" height="12" fill="{fg}"/>
  <rect x="33" y="32" width="12" height="38" fill="{fg}"/>
  <rect x="33" y="58" width="47" height="12" fill="{fg}"/>
  <rect x="83" y="58" width="12" height="12" fill="{fg}"/>
  <rect x="33" y="76" width="12" height="20" fill="{fg}"/>
  <rect x="33" y="84" width="62" height="12" fill="{fg}"/>
</svg>
"""


def make_wordmark_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40" fill="currentColor">
  <text x="0" y="29" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="26" font-weight="400">Exotic</text>
</svg>
"""


def main() -> None:
    master_dark = render_exotic_mark(1024, dark_bg=True)
    master_light = render_exotic_mark(1024, dark_bg=False)

    master_dark.resize((256, 256), Image.Resampling.LANCZOS).save(
        ASSETS / "exotic-dark-256.png", format="PNG"
    )
    master_light.resize((256, 256), Image.Resampling.LANCZOS).save(
        ASSETS / "exotic-light-256.png", format="PNG"
    )

    ico_sizes = [(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)]
    master_dark.save(ASSETS / "exotic.ico", format="ICO", sizes=ico_sizes)
    master_dark.save(BRAND_DIR / "exotic-dark.ico", format="ICO", sizes=ico_sizes)
    master_light.save(BRAND_DIR / "exotic-light.ico", format="ICO", sizes=ico_sizes)

    for px in (16, 32, 48, 64, 128):
        im = master_dark.resize((px, px), Image.Resampling.LANCZOS)
        im.save(BRAND_DIR / f"icon{px}.png", format="PNG")
        im.save(BRAND_DIR / f"default{px}.png", format="PNG")

    master_dark.resize((96, 96), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "about-logo.png", format="PNG"
    )
    master_dark.resize((192, 192), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "about-logo@2x.png", format="PNG"
    )
    master_light.resize((96, 96), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "about-logo-private.png", format="PNG"
    )
    master_light.resize((192, 192), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "about-logo-private@2x.png", format="PNG"
    )
    master_dark.resize((128, 128), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "about.png", format="PNG"
    )

    for px in (70, 150):
        tile = Image.new("RGBA", (px, px), (0, 0, 0, 255))
        mark_sz = int(px * 0.64)
        mark = master_dark.resize((mark_sz, mark_sz), Image.Resampling.LANCZOS)
        off = (px - mark_sz) // 2
        tile.paste(mark, (off, off), mark)
        tile.save(BRAND_DIR / f"VisualElements_{px}.png", format="PNG")

        ptile = Image.new("RGBA", (px, px), (255, 255, 255, 255))
        pmark = master_light.resize((mark_sz, mark_sz), Image.Resampling.LANCZOS)
        ptile.paste(pmark, (off, off), pmark)
        ptile.save(BRAND_DIR / f"PrivateBrowsing_{px}.png", format="PNG")

    (BRAND_DIR / "about-logo.svg").write_text(make_svg_mark(True), encoding="utf-8")
    (BRAND_DIR / "about-wordmark.svg").write_text(make_wordmark_svg(), encoding="utf-8")
    (BRAND_DIR / "firefox-wordmark.svg").write_text(make_wordmark_svg(), encoding="utf-8")

    # NSIS Modern UI 2 Bitmaps — Strictly Solid #000000 Monochrome (Zero Borders, Zero Gradients)
    sidebar = Image.new("RGB", (164, 314), (0, 0, 0))
    icon_88 = master_light.resize((88, 88), Image.Resampling.LANCZOS)
    sidebar.paste(icon_88, (38, 48), icon_88)
    sidebar.save(ASSETS / "installer-sidebar.bmp", format="BMP")

    header = Image.new("RGB", (150, 57), (0, 0, 0))
    icon_38 = master_light.resize((38, 38), Image.Resampling.LANCZOS)
    header.paste(icon_38, (100, 9), icon_38)
    header.save(ASSETS / "installer-header.bmp", format="BMP")

    print("Generated Exotic frameless monochrome brand assets in:", ASSETS)


if __name__ == "__main__":
    main()
