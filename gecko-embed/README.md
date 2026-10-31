# Firefox & Mozilla Gecko Engine — Workspace Embedding Kit

Mozilla Firefox (**159.0**), the core **Gecko rendering engine** (`libxul.so`), **Geckodriver** (`v0.37.1`), and **SpiderMonkey C++ SDK** (`mozjs-128`) are installed and verified in this workspace.

---

## Installed Components & Paths

| Component | Version | Installed Path | Purpose |
|---|---|---|---|
| **Mozilla Firefox / Gecko Runtime** | `159.0` | `/opt/firefox/firefox` (`/usr/local/bin/firefox`) | Full Gecko HTML/CSS (Stylo) + WebRender + SpiderMonkey runtime |
| **Gecko Core Shared Library** | `159.0` | `/opt/firefox/libxul.so` | Underlying Gecko layout, DOM, networking & rendering engine |
| **Mozilla Geckodriver** | `v0.37.1` | `/usr/local/bin/geckodriver` | W3C WebDriver & BiDi IPC bridge for host applications |
| **SpiderMonkey C++ SDK** | `128.14.0` (`mozjs-128`) | `/usr/include/x86_64-linux-gnu/mozjs-128` (`-lmozjs-128`) | Native C/C++ in-process embedding of Gecko's JS/Wasm engine |
| **Xvfb Offscreen Display** | `21.1.16` | `/usr/bin/xvfb-run` | Virtual X11 framebuffer for custom window/GUI embedding |

> **Workspace Persistence Tip:** System packages outside `/home/user` live in the active sandbox session. If the cloud container ever restarts from snapshot in a future session, run `./install-gecko.sh` to restore all system libraries and binaries in ~20 seconds.

---

## Three Ways to Embed Gecko in Your App

Because Mozilla retired the legacy desktop C++ `XULRunner` (`libxul`) embedding API, modern applications embed Gecko using one of three supported architectures — all included in `/home/user/gecko-embed`:

### 1. Desktop / Server App Embedding (`python_gecko_embed/`)
Embeds an isolated, chromeless Gecko `159.0` engine instance inside a host application over local W3C IPC (`gecko_engine.py`, zero external pip dependencies):
- Render custom HTML5 / Quantum CSS (`Stylo`) / Canvas UIs
- Execute JS in Gecko and receive events back in Python via `window.GeckoHost.postMessage(type, payload)`
- Capture rendered viewport frames (`PNG`) or vector `PDF` buffers for compositing into custom UI toolkits

```bash
cd /home/user/gecko-embed/python_gecko_embed
python3 demo_embed.py
```

### 2. Native C++ In-Process JS/Wasm Embedding (`cpp_spidermonkey/`)
Directly links Mozilla's **SpiderMonkey (`libmozjs-128`)** engine into a C++20 binary (`embed_gecko_js.cpp`), exposing native C++ host functions (`hostNotify`) to JavaScript and evaluating JS in-process:

```bash
cd /home/user/gecko-embed/cpp_spidermonkey
make run
```

### 3. Android Native App Embedding (`android_geckoview/`)
Mozilla's official mobile embedding library (`org.mozilla.geckoview:geckoview:159.0.20261022150525` from `https://maven.mozilla.org/maven2/`), wrapping `libxul.so` inside an Android `GeckoView` + `GeckoSession`. See:
- `android_geckoview/build.gradle.kts`
- `android_geckoview/GeckoEmbedActivity.kt`
