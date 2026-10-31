#!/usr/bin/env python3
"""
Rebrands a Mozilla Gecko runtime directory (`omni.ja`, `browser/omni.ja`,
window icons, VisualElements, and `application.ini`) into **Exotic** while
keeping 100% of Gecko's CSS, color tokens, built-in theme manifests, and
image/web rendering stylesheets untouched.
"""

from __future__ import annotations

import re
import shutil
import struct
import sys
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND_DIR = ROOT / "assets" / "gecko-branding"


def read_omnijar_entries(path: Path) -> list[tuple[str, bytes]]:
    raw = path.read_bytes()
    eocd = raw.rfind(b"PK\x05\x06")
    if eocd == -1:
        raise ValueError(f"Not a valid omnijar/zip archive: {path}")

    _, _, _, _, total, _, cd_pos, _ = struct.unpack("<4sHHHHIIH", raw[eocd : eocd + 22])
    entries: list[tuple[str, bytes]] = []
    pos = cd_pos

    for _ in range(total):
        (
            csig,
            _,
            _,
            _,
            method,
            _,
            _,
            _,
            csize,
            _,
            nlen,
            elen,
            clen,
            _,
            _,
            _,
            lhoff,
        ) = struct.unpack("<4sHHHHHHIIIHHHHHII", raw[pos : pos + 46])
        if csig != b"PK\x01\x02":
            raise ValueError(f"Unexpected central directory signature in {path}: {csig!r}")

        name = raw[pos + 46 : pos + 46 + nlen].decode("utf-8")
        pos += 46 + nlen + elen + clen

        _, _, _, _, _, _, _, _, _, lnlen, lelen = struct.unpack(
            "<4sHHHHHIIIHH", raw[lhoff : lhoff + 30]
        )
        data_start = lhoff + 30 + lnlen + lelen
        payload = raw[data_start : data_start + csize]
        if method == 8:
            payload = zlib.decompress(payload, -15)
        elif method != 0:
            raise ValueError(f"Unsupported compression method {method} in {name}")

        entries.append((name, payload))

    return entries


def write_standard_omnijar(path: Path, entries: list[tuple[str, bytes]]) -> None:
    tmp = path.with_suffix(".ja.tmp")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in entries:
            zi = zipfile.ZipInfo(filename=name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_STORED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, data)
    tmp.replace(path)


def sanitize_properties_text(text: str) -> str:
    out: list[str] = []
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith(("#", "!")) or "=" not in line:
            out.append(line)
            continue
        idx = line.index("=")
        rhs = line[idx + 1 :]
        rhs = rhs.replace("Mozilla Firefox", "Exotic").replace("Mozilla Foundation", "Exotic Project")
        rhs = re.sub(r"\bFirefox\b", "Exotic", rhs)
        rhs = re.sub(r"\bMozilla\b", "Exotic", rhs)
        out.append(line[: idx + 1] + rhs)
    return "".join(out)


def sanitize_ftl_text_outside_placeables(text: str) -> str:
    def replace_segment(seg: str) -> str:
        seg = seg.replace("Mozilla Firefox", "Exotic")
        seg = seg.replace("Mozilla Foundation", "Exotic Project")
        seg = re.sub(r"\bFirefox\b", "Exotic", seg)
        seg = re.sub(r"\bMozilla\b", "Exotic", seg)
        return seg

    def transform_rhs(rhs: str) -> str:
        parts = re.split(r"(\{[^}]*\})", rhs)
        return "".join(
            p if (p.startswith("{") and p.endswith("}")) else replace_segment(p)
            for p in parts
        )

    out_lines: list[str] = []
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("#") or not stripped:
            out_lines.append(line)
            continue

        if "=" in line and not line.startswith((" ", "\t")):
            idx = line.index("=")
            out_lines.append(line[: idx + 1] + transform_rhs(line[idx + 1 :]))
        elif line.startswith((" ", "\t")) and "=" in stripped and stripped.startswith("."):
            idx = line.index("=")
            out_lines.append(line[: idx + 1] + transform_rhs(line[idx + 1 :]))
        elif line.startswith((" ", "\t")):
            out_lines.append(transform_rhs(line))
        else:
            out_lines.append(line)

    return "".join(out_lines)


BRAND_FTL = """\
-brand-shorter-name = Exotic
-brand-short-name = Exotic
-brand-shortcut-name = Exotic
-brand-full-name = Exotic
-brand-product-name = Exotic
-vendor-short-name = Exotic
trademarkInfo = Exotic Browser.
"""

BRAND_PROPERTIES = """\
brandShorterName=Exotic
brandShortName=Exotic
brandFullName=Exotic
vendorShortName=Exotic
"""

BRAND_DTD = """\
<!ENTITY brandShorterName "Exotic">
<!ENTITY brandShortName "Exotic">
<!ENTITY brandFullName "Exotic">
<!ENTITY vendorShortName "Exotic">
<!ENTITY trademarkInfo.part1 "">
"""

TOOLKIT_BRANDINGS_FTL = """\
-facebook-container-brand-name = Container Isolation
-monitor-brand-name = Exotic Monitor
-monitor-brand-short-name = Monitor
-mozmonitor-brand-name = Exotic Monitor
-pocket-brand-name = Saved Pages
-send-brand-name = Exotic Send
-screenshots-brand-name = Exotic Capture
-mozilla-vpn-brand-name = Exotic Network
-profiler-brand-name = Exotic Profiler
-translations-brand-name = Exotic Translate
-relay-brand-name = Exotic Relay
-relay-brand-short-name = Relay
-fakespot-brand-name = Review Check
-solo-ai-brand-name = Assistant
-thunderbird-brand-name = Mail
-thunderbird-brand-short-name = Mail
-mdn-brand-name = Web Docs
-yelp-brand-name = Directory
-fakespot-website-name = local
-fakespot-brand-full-name = Review Check
-firefox-suggest-brand-name = Exotic Suggest
-firefox-home-brand-name = Exotic Start
-firefoxview-brand-name = Exotic Workspace
-firefoxlabs-brand-name = Exotic Labs
-smart-window-brand-name =
    { $plural-form ->
        [true] Exotic Windows
       *[false] Exotic Window
    }
"""

EXOTIC_DEFAULT_BOOKMARKS_HTML = """\
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<html>
<head>
  <meta charset="UTF-8">
  <title>Exotic Bookmarks</title>
</head>
<body>
<h1>Exotic Bookmarks</h1>
<dl><p>
  <dt><h3>Bookmarks</h3></dt>
  <dl><p>
    <dt><a href="https://duckduckgo.com/">DuckDuckGo</a></dt>
    <dt><a href="https://github.com/">GitHub</a></dt>
    <dt><a href="https://www.wikipedia.org/">Wikipedia</a></dt>
    <dt><a href="https://news.ycombinator.com/">Hacker News</a></dt>
  </dl><p>
</dl>
</body>
</html>
"""

EXOTIC_BRANDING_PREFS = """\
pref("startup.homepage_override_url", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");
pref("app.releaseNotesURL", "");
pref("app.releaseNotesURL.aboutDialog", "");
pref("app.ReleaseNotesURL.prompt", "");
pref("app.vendorURL", "");
pref("app.support.baseURL", "");
pref("app.feedback.baseURL", "");
pref("browser.Search.param.ms-pc", "");
pref("general.useragent.override", "Exotic/5.0 (Windows NT 10.0; Win64; x64) ExoticEngine/159.0 Exotic/159.0");
pref("extensions.InstallTrigger.enabled", false);
pref("privacy.trackingprotection.enabled", false);
pref("privacy.fingerprintingProtection", true);
pref("privacy.fingerprintingProtection.overrides", "+CanvasRandomization,+WebGLRandomization,+WebGLRenderCapability,+JSMathFdlibm,+FontVisibilityBaseSystem,+FontVisibilityRestrictGenerics,+NavigatorHWConcurrencyTiered,+ScreenAvailToResolution,+WindowScreenXY,+WindowInnerScreenXY,+DeviceSensors,+PointerEvents,+CSSPointerCapabilities");
pref("privacy.globalprivacycontrol.enabled", true);
pref("privacy.donottrackheader.enabled", true);
pref("webgl.enable-debug-renderer-info", false);
pref("network.connectivity-service.enabled", true);
pref("network.http.fast-fallback-to-IPv4", true);
"""


def patch_browser_omnijar(omni_path: Path) -> None:
    entries = read_omnijar_entries(omni_path)
    patched: list[tuple[str, bytes]] = []

    branding_asset_map = {
        "chrome/browser/content/branding/icon16.png": BRAND_DIR / "icon16.png",
        "chrome/browser/content/branding/icon32.png": BRAND_DIR / "icon32.png",
        "chrome/browser/content/branding/icon48.png": BRAND_DIR / "icon48.png",
        "chrome/browser/content/branding/icon64.png": BRAND_DIR / "icon64.png",
        "chrome/browser/content/branding/icon128.png": BRAND_DIR / "icon128.png",
        "chrome/browser/content/branding/about.png": BRAND_DIR / "about.png",
        "chrome/browser/content/branding/about-logo.png": BRAND_DIR / "about-logo.png",
        "chrome/browser/content/branding/about-logo@2x.png": BRAND_DIR / "about-logo@2x.png",
        "chrome/browser/content/branding/about-logo-private.png": BRAND_DIR / "about-logo-private.png",
        "chrome/browser/content/branding/about-logo-private@2x.png": BRAND_DIR / "about-logo-private@2x.png",
        "chrome/browser/content/branding/about-logo.svg": BRAND_DIR / "about-logo.svg",
        "chrome/browser/content/branding/about-wordmark.svg": BRAND_DIR / "about-wordmark.svg",
        "chrome/browser/content/branding/firefox-wordmark.svg": BRAND_DIR / "firefox-wordmark.svg",
        "chrome/browser/content/branding/document.ico": BRAND_DIR / "exotic-dark.ico",
        "chrome/browser/content/browser/icons/minimal-dark.ico": BRAND_DIR / "exotic-dark.ico",
        "chrome/browser/content/browser/icons/minimal-light.ico": BRAND_DIR / "exotic-light.ico",
    }

    for name, data in entries:
        if name == "localization/en-US/branding/brand.ftl":
            patched.append((name, BRAND_FTL.encode("utf-8")))
        elif name == "chrome/en-US/locale/branding/brand.properties":
            patched.append((name, BRAND_PROPERTIES.encode("utf-8")))
        elif name == "chrome/en-US/locale/branding/brand.dtd":
            patched.append((name, BRAND_DTD.encode("utf-8")))
        elif name == "defaults/preferences/firefox-branding.js":
            patched.append((name, EXOTIC_BRANDING_PREFS.encode("utf-8")))
        elif name == "chrome/browser/content/browser/default-bookmarks.html":
            patched.append((name, EXOTIC_DEFAULT_BOOKMARKS_HTML.encode("utf-8")))
        elif name in branding_asset_map and branding_asset_map[name].exists():
            patched.append((name, branding_asset_map[name].read_bytes()))
        elif name.startswith("chrome/browser/content/browser/icons/") and name.endswith(".ico"):
            patched.append((name, (BRAND_DIR / "exotic-dark.ico").read_bytes()))
        elif name.startswith("localization/") and name.endswith(".ftl"):
            txt = data.decode("utf-8", errors="ignore")
            patched.append((name, sanitize_ftl_text_outside_placeables(txt).encode("utf-8")))
        elif "/locale/" in name and name.endswith(".properties"):
            txt = data.decode("utf-8", errors="ignore")
            patched.append((name, sanitize_properties_text(txt).encode("utf-8")))
        else:
            patched.append((name, data))

    write_standard_omnijar(omni_path, patched)


def patch_root_omnijar(omni_path: Path) -> None:
    entries = read_omnijar_entries(omni_path)
    patched: list[tuple[str, bytes]] = []

    for name, data in entries:
        if name == "localization/en-US/toolkit/branding/brandings.ftl":
            patched.append((name, TOOLKIT_BRANDINGS_FTL.encode("utf-8")))
        elif name.startswith("localization/") and name.endswith(".ftl"):
            txt = data.decode("utf-8", errors="ignore")
            patched.append((name, sanitize_ftl_text_outside_placeables(txt).encode("utf-8")))
        elif "/locale/" in name and name.endswith(".properties"):
            txt = data.decode("utf-8", errors="ignore")
            patched.append((name, sanitize_properties_text(txt).encode("utf-8")))
        else:
            patched.append((name, data))

    write_standard_omnijar(omni_path, patched)


def rebrand_runtime(runtime_dir: Path) -> None:
    print(f"==> Deep-rebranding Gecko runtime at: {runtime_dir}")
    root_omni = runtime_dir / "omni.ja"
    browser_omni = runtime_dir / "browser" / "omni.ja"

    if root_omni.exists():
        patch_root_omnijar(root_omni)
    if browser_omni.exists():
        patch_browser_omnijar(browser_omni)

    default_icons_dir = runtime_dir / "browser" / "chrome" / "icons" / "default"
    default_icons_dir.mkdir(parents=True, exist_ok=True)
    for px in (16, 32, 48, 64, 128):
        shutil.copy2(BRAND_DIR / f"default{px}.png", default_icons_dir / f"default{px}.png")
    shutil.copy2(BRAND_DIR / "exotic-dark.ico", default_icons_dir / "main-window.ico")

    vis_dir = runtime_dir / "browser" / "VisualElements"
    if vis_dir.exists():
        for name in (
            "VisualElements_150.png",
            "VisualElements_70.png",
            "PrivateBrowsing_150.png",
            "PrivateBrowsing_70.png",
        ):
            shutil.copy2(BRAND_DIR / name, vis_dir / name)

    features_dir = runtime_dir / "browser" / "features"
    if features_dir.exists():
        shutil.rmtree(features_dir, ignore_errors=True)

    for junk in (
        runtime_dir / "browser" / "confused_fox.pdf",
        runtime_dir / "browser" / "crashreporter-override.ini",
        runtime_dir / "crashreporter.ini",
        runtime_dir / "updater.ini",
    ):
        if junk.exists():
            junk.unlink()

    for manifest_xml in runtime_dir.glob("*.VisualElementsManifest.xml"):
        xml_txt = manifest_xml.read_text(encoding="utf-8", errors="ignore")
        xml_txt = re.sub(r'BackgroundColor="[^"]*"', 'BackgroundColor="#000000"', xml_txt)
        manifest_xml.write_text(xml_txt, encoding="utf-8")

    app_ini = runtime_dir / "application.ini"
    if app_ini.exists():
        ini_txt = app_ini.read_text(encoding="utf-8", errors="ignore")
        ini_txt = re.sub(r"^Vendor=.*$", "Vendor=Exotic", ini_txt, flags=re.M)
        ini_txt = re.sub(r"^Name=.*$", "Name=Exotic", ini_txt, flags=re.M)
        ini_txt = re.sub(r"^BuildID=.*$", "BuildID=20261030120000", ini_txt, flags=re.M)
        app_ini.write_text(ini_txt, encoding="utf-8")

    plat_ini = runtime_dir / "platform.ini"
    if plat_ini.exists():
        p_txt = plat_ini.read_text(encoding="utf-8", errors="ignore")
        p_txt = re.sub(r"^BuildID=.*$", "BuildID=20261030120000", p_txt, flags=re.M)
        plat_ini.write_text(p_txt, encoding="utf-8")

    print("==> Deep rebranding complete.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: rebrand_omnijar.py <path-to-gecko-runtime>", file=sys.stderr)
        sys.exit(1)
    rebrand_runtime(Path(sys.argv[1]))
