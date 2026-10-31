# Exotic Browser for Windows 11 (x64)

Exotic is a 64-bit web browser for Windows 11 built around a clean single-sidebar interface, regular non-bold typography, and monochrome Dark (`#000000`) and Light (`#FFFFFF`) themes.

---

## Overview

- **First-Launch Animated Setup & Onboarding (`exotic://welcome`)**: Full-window animated welcome and setup screens shown automatically on the first launch of a new Exotic profile, letting you import browser data, pick Dark or Light mode for Exotic's interface (keeping external websites' original colors, images, logos, and icons untouched), choose your sidebar layout (`Expanded`, `Compact`, or `Auto-hide`), select a default search engine, and customize pinned sidebar shortcuts alongside a live interactive Exotic Browser preview.
- **Unified Left Sidebar (`#exotic-sidebar`)**: Combines navigation buttons, address bar, four customizable pinned shortcuts, vertical tabs, workspace switching (`Personal`, `Work`, `Research`), and quick access to Downloads, Bookmarks, History, and Settings.
- **Centered Floating Address Bar (`Ctrl+L` / `Ctrl+T`)**: Opens a centered search and URL bar with tab switching, internal `exotic://` pages, and local history suggestions.
- **Side-by-Side Split View (`Alt+S`)**: Displays two open tabs side-by-side in rounded content frames.
- **Compact & Auto-Hide Sidebar Modes**: Switch between the full `248px` sidebar, a `56px` compact icon rail (`Alt+V`), or full-window auto-hide mode (`Alt+B`).
- **Regular Non-Bold Font Throughout**: Uses bundled regular-weight (`400`) sans-serif typography (`exotic-sans-regular.otf`) with `font-weight: 400` and `font-synthesis: none` across all chrome and internal pages.
- **Monochrome Dark & Light Themes (`Alt+T`)**: Pure `#000000` Dark and `#FFFFFF` Light browser chrome and internal pages, strictly scoped so external websites keep their natural images, colors, shadows, and gradients untouched.
- **Exotic/5.0 & Exotic Engine Identity + Browser Detection Recognition**: Identifies natively across HTTP `User-Agent`, `Sec-CH-UA` Client Hints (`"Exotic";v="159", "Exotic Engine";v="159", "Not_A Brand";v="24"`), `Navigator` (`userAgent`, `vendor`, `product`, `appCodeName`, `appName`, `userAgentData`), and Web Workers as **`Exotic/5.0 (Windows NT 10.0; Win64; x64) ExoticEngine/159.0 Exotic/159.0`**, coupled with an isolated Chrome-compartment Browser & Engine Readout Resolver so browser detection websites (`WhatIsMyBrowser.com`, `BrowserCheak.com`, `BrowserScan.net`, `WhatsMyBrowser.org`, `MyBrowserInfo.com`, `DeviceInfo.me`, `Whoer.net`, `WhatsMyUA.info`, and generic UA/Client-Hints analyzers) display **`Exotic 159.0`** and **`Exotic Engine 159.0`** instead of `Unknown browser`.
- **Full Anti-Fingerprint Detection & 100/100 Consistency**: Combines 13 native C++ `privacy.fingerprintingProtection.overrides` targets (`CanvasRandomization`, `WebGLRandomization`, `WebGLRenderCapability`, `JSMathFdlibm`, `FontVisibilityBaseSystem`, `FontVisibilityRestrictGenerics`, `NavigatorHWConcurrencyTiered`, `ScreenAvailToResolution`, `WindowScreenXY`, `WindowInnerScreenXY`, `DeviceSensors`, `PointerEvents`, `CSSPointerCapabilities`), per-session `[native code]` `AudioBuffer` (`getChannelData` + `copyFromChannel`) randomization, deterministic `[native code]` `getImageData` 1-LSB protection, masked WebGL unmasked GPU vendor/renderer, disabled `speechSynthesis` & WebMIDI enumeration, matched `Window` + `Worker` hardware concurrency (`4`), synchronous `about:blank`/`about:srcdoc` `iframe` protection, zero-IP-leak WebRTC ICE confinement, Total Cookie Protection (`dFPI`), URL tracking-parameter stripping, Global Privacy Control (`Sec-GPC: 1`) + Do Not Track (`DNT: 1`), and pure subresource ad/analytics telemetry blocking — verified `100/100` on BrowserCheak and `0% stealth / 0% headless` on CreepJS.
- **Built-In Exotic Mods (`exotic://mods`)**: Eleven native browser modifications — including the **`Live Audio Transcriber` (`Open Source · Parakeet`)** mod for free, unlimited real-time video and live-stream transcription & captions (`parakeet.js` NVIDIA Parakeet TDT 0.6B v3 + Whisper Multilingual ONNX Runtime Web, with **`Transcribe From: Auto-Detect (Real)`** acoustic 99-language speech detection and a **`Choose a Language`** button & Language Selector Modal across 32 **`Transcribe To`** languages when toggled ON), the **`Halloween Characters` (`Halloween Special`)** draggable browser companion featuring 8 iconic characters from Halloween shows and movies (*Jack Skellington*, *Ghostface*, *Wednesday Addams*, *Michael Myers*, *Beetlejuice*, *Sam*, *Zero*, and *Count Dracula*), plus `Website light and dark mode`, `Hide Discord servers list`, `Hide cookie banners`, `Reduce page animations`, `WebRTC IP protection` (enabled by default), `Grayscale web pages`, `Square interface corners`, `Hide feed distractions`, and `Dim inactive tabs` — with third-party extensions disabled.
- **NSIS Windows 11 Installer (`scripts/installer.nsi`)**: Packaged as a standard LZMA-solid NSIS Modern UI 2 installer (`Exotic-Win11-Setup-x64.exe`) with Start Menu/Desktop shortcuts and `Uninstall.exe`.

---

## Internal Pages

| Address | Page |
| :--- | :--- |
| `exotic://newtab` | New Tab |
| `exotic://welcome` | First-Launch Setup & Onboarding |
| `exotic://settings` | Settings (Appearance, General, Exotic Mods, Search, Privacy & Security, Shortcuts, Bookmarks, History, Downloads, About Exotic) |
| `exotic://mods` | Exotic Mods |
| `exotic://bookmarks` | Bookmarks |
| `exotic://history` | History |
| `exotic://downloads` | Downloads |
| `exotic://about` | About Exotic & Advanced Preferences |
| `exotic://private` | Private Browsing Window |

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + L` / `Alt + D` | Open floating address bar |
| `Ctrl + T` | Open floating address bar for a new tab |
| `Alt + S` | Toggle side-by-side split view |
| `Alt + B` | Toggle auto-hide sidebar |
| `Alt + V` | Toggle compact sidebar |
| `Alt + G` | Quick page preview |
| `Alt + 1` / `2` / `3` | Switch workspace (`Personal` / `Work` / `Research`) |
| `Alt + M` | Open Exotic Mods |
| `Alt + ,` | Open Settings |
| `Alt + T` | Switch between Dark and Light theme |
| `Ctrl + F` | Find in page |
| `Ctrl + Shift + P` | Open new private window |

---

## Release Files (`releases/`)

| File | Description | Size | SHA-256 |
| :--- | :--- | :--- | :--- |
| `Exotic-Win11-Setup-x64.exe` | Windows 11 NSIS Offline Installer (`x64`) | `100.7 MiB` (`105,643,292` B) | `1715c4099e694107af1d79c76e6259b6a4877ab0944f62ac03b83efb16248ee7` |
| `Exotic-Win11-LauncherKit.zip` | `Exotic.exe` Win64 Launcher + Engine Bundle | `775 KiB` (`793,514` B) | `ac3246289b37842e6d64c1ad3e3ee268518cf61cc3d07ee2503547a14ac0b2d4` |
| `SHA256SUMS.txt` | SHA-256 Checksums | `188 B` | — |

### Installation on Windows 11

```powershell
# Interactive setup wizard
.\Exotic-Win11-Setup-x64.exe

# Silent installation
.\Exotic-Win11-Setup-x64.exe /S
```

---

## Project Layout

- `src/win11/` — Native Win64 C++20 `Exotic.exe` launcher (`exotic_launcher.cpp`, `exotic.rc`, `exotic.manifest`, `Makefile`).
- `engine/` — Exotic runtime configuration (`exotic.cfg`, `defaults/pref/autoconfig.js`) and UI bundle (`exotic-assets/`).
- `scripts/` — `installer.nsi`, `build_windows11.sh`, `generate_branding.py`, and `rebrand_omnijar.py`.
- `assets/` — Monochrome brand icons, NSIS bitmaps, and verified `1440×920` screenshots.
