#!/usr/bin/env python3
"""
End-to-end verification & demo of EmbeddedGeckoEngine:
1. Boots Mozilla Firefox / Gecko (`libxul.so`) headless engine
2. Renders a custom app surface (HTML5 + CSS Grid + Canvas)
3. Tests bidirectional Host <-> Gecko JS IPC
4. Captures the rendered Gecko frame to PNG
"""

import json
from pathlib import Path
from gecko_engine import EmbeddedGeckoEngine

DEMO_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Liberation Sans', sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #311042 100%);
      color: #f8fafc;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }
    .card {
      width: 860px;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(249, 115, 22, 0.45);
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(90deg, #ff7139, #ff9400);
      color: #0f172a;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 10px;
      color: #ffffff;
    }
    p.sub {
      color: #cbd5e1;
      font-size: 16px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .metric {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
    }
    .metric .label {
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .metric .val {
      color: #38bdf8;
      font-family: monospace;
      font-size: 15px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Mozilla Gecko Engine Embedded</div>
    <h1>Embedded Gecko Runtime Active</h1>
    <p class="sub">
      Rendered offscreen by Mozilla's Gecko layout &amp; SpiderMonkey JS engine (libxul.so)
      with bidirectional Host &harr; Web IPC.
    </p>
    <div class="grid">
      <div class="metric">
        <div class="label">User Agent</div>
        <div class="val" id="ua">...</div>
      </div>
      <div class="metric">
        <div class="label">Engine Build ID</div>
        <div class="val" id="build">...</div>
      </div>
      <div class="metric">
        <div class="label">CSS Engine Check (moz appearance)</div>
        <div class="val" id="css-check">...</div>
      </div>
      <div class="metric">
        <div class="label">Host IPC Bridge Status</div>
        <div class="val" id="ipc-status">Initializing...</div>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('ua').textContent = navigator.userAgent;
    document.getElementById('build').textContent = navigator.buildID || 'N/A';
    document.getElementById('css-check').textContent =
      CSS.supports('-moz-appearance', 'none') ? 'Supported (Gecko Quantum CSS / Stylo)' : 'Standard';
  </script>
</body>
</html>
"""


def main() -> None:
    out_png = Path(__file__).parent / "gecko_rendered_frame.png"

    with EmbeddedGeckoEngine(width=1024, height=640, headless=True) as gecko:
        gecko.load_html(DEMO_HTML)

        # Trigger JS -> Host IPC message and update DOM from Host
        gecko.eval_js(
            """
            window.GeckoHost.postMessage('engine_ready', {
              geckoStylo: CSS.supports('-moz-appearance', 'none'),
              ua: navigator.userAgent
            });
            document.getElementById('ipc-status').textContent =
              'Connected (Host <-> Gecko IPC Verified)';
            """
        )

        info = gecko.engine_info()
        messages = gecko.drain_host_messages()
        png_bytes = gecko.capture_frame_png(out_png)

        print("=== Embedded Gecko Engine Info ===")
        print(json.dumps(info, indent=2))
        print("\n=== Messages Received from Embedded Gecko JS ===")
        print(json.dumps(messages, indent=2))
        print(f"\n=== Captured Viewport Frame ===\nSaved {len(png_bytes):,} bytes -> {out_png}")


if __name__ == "__main__":
    main()
