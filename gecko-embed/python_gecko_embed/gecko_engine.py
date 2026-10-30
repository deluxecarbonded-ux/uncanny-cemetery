"""
Zero-dependency Python host SDK for embedding Mozilla's Gecko Engine
(Firefox / libxul.so) via Geckodriver W3C WebDriver IPC.

Uses only the Python standard library so it persists cleanly in the workspace
without virtual environments.
"""

from __future__ import annotations

import base64
import json
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class EmbeddedGeckoEngine:
    """
    Embeds an isolated, chromeless Mozilla Gecko rendering engine instance
    inside a host Python / desktop / server application.
    """

    def __init__(
        self,
        width: int = 1280,
        height: int = 800,
        headless: bool = True,
        firefox_binary: str = "/usr/local/bin/firefox",
        geckodriver_binary: str = "/usr/local/bin/geckodriver",
        extra_prefs: Optional[dict[str, Any]] = None,
    ) -> None:
        self.width = width
        self.height = height
        self.headless = headless
        self.firefox_binary = firefox_binary
        self.geckodriver_binary = geckodriver_binary
        self.extra_prefs = extra_prefs or {}

        self._port: Optional[int] = None
        self._driver_proc: Optional[subprocess.Popen] = None
        self._session_id: Optional[str] = None
        self._profile_dir: Optional[tempfile.TemporaryDirectory] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(self) -> "EmbeddedGeckoEngine":
        if self._session_id is not None:
            return self

        self._port = _find_free_port()
        self._profile_dir = tempfile.TemporaryDirectory(prefix="gecko-embed-")

        self._driver_proc = subprocess.Popen(
            [
                self.geckodriver_binary,
                "--host",
                "127.0.0.1",
                "--port",
                str(self._port),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )

        # Wait until geckodriver HTTP IPC is ready
        deadline = time.monotonic() + 10.0
        while time.monotonic() < deadline:
            try:
                status = self._request("GET", "/status")
                if status.get("value", {}).get("ready"):
                    break
            except Exception:
                time.sleep(0.1)
        else:
            self.stop()
            raise RuntimeError("Timed out waiting for geckodriver IPC server.")

        args = [
            f"--width={self.width}",
            f"--height={self.height}",
            "-profile",
            self._profile_dir.name,
        ]
        if self.headless:
            args.insert(0, "-headless")

        prefs: dict[str, Any] = {
            "datareporting.healthreport.uploadEnabled": False,
            "toolkit.telemetry.enabled": False,
            "browser.shell.checkDefaultBrowser": False,
            "browser.tabs.warnOnClose": False,
            "toolkit.legacyUserProfileCustomizations.stylesheets": True,
        }
        prefs.update(self.extra_prefs)

        capabilities = {
            "capabilities": {
                "alwaysMatch": {
                    "browserName": "firefox",
                    "acceptInsecureCerts": True,
                    "moz:firefoxOptions": {
                        "binary": self.firefox_binary,
                        "args": args,
                        "prefs": prefs,
                    },
                }
            }
        }

        resp = self._request("POST", "/session", capabilities)
        self._session_id = resp["value"]["sessionId"]
        self.resize(self.width, self.height)
        self._inject_host_bridge()
        return self

    def stop(self) -> None:
        if self._session_id and self._port:
            try:
                self._request("DELETE", f"/session/{self._session_id}")
            except Exception:
                pass
            self._session_id = None

        if self._driver_proc:
            self._driver_proc.terminate()
            try:
                self._driver_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._driver_proc.kill()
            self._driver_proc = None

        if self._profile_dir:
            self._profile_dir.cleanup()
            self._profile_dir = None

    def __enter__(self) -> "EmbeddedGeckoEngine":
        return self.start()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()

    # ------------------------------------------------------------------
    # Navigation, Rendering & Host <-> JS Bridge
    # ------------------------------------------------------------------
    def navigate(self, url: str) -> None:
        self._ensure_session()
        self._request("POST", f"/session/{self._session_id}/url", {"url": url})
        self._inject_host_bridge()

    def load_html(self, html: str) -> None:
        encoded = urllib.parse.quote(html)
        self.navigate(f"data:text/html;charset=utf-8,{encoded}")

    def resize(self, width: int, height: int) -> None:
        self._ensure_session()
        self.width = width
        self.height = height
        self._request(
            "POST",
            f"/session/{self._session_id}/window/rect",
            {"width": width, "height": height},
        )

    def eval_js(self, script: str, *args: Any) -> Any:
        """
        Execute JavaScript inside Gecko's SpiderMonkey context.
        If `script` does not contain `return`, wraps expressions automatically
        when called via `eval_expr`. Use explicit `return ...;` here.
        """
        self._ensure_session()
        resp = self._request(
            "POST",
            f"/session/{self._session_id}/execute/sync",
            {"script": script, "args": list(args)},
        )
        return resp["value"]

    def _inject_host_bridge(self) -> None:
        """Install `window.GeckoHost` message queue for JS -> Host IPC."""
        self.eval_js(
            """
            if (!window.__geckoHostQueue) {
              window.__geckoHostQueue = [];
              window.GeckoHost = {
                postMessage(type, payload) {
                  window.__geckoHostQueue.push({
                    type: String(type),
                    payload: payload ?? null,
                    timestamp: Date.now()
                  });
                }
              };
            }
            """
        )

    def drain_host_messages(self) -> list[dict[str, Any]]:
        """Read and clear messages sent from web content via `window.GeckoHost.postMessage`."""
        return self.eval_js(
            """
            const q = window.__geckoHostQueue || [];
            window.__geckoHostQueue = [];
            return q;
            """
        )

    def capture_frame_png(self, output_path: Optional[str | Path] = None) -> bytes:
        """Capture the rendered Gecko viewport frame as PNG bytes."""
        self._ensure_session()
        resp = self._request("GET", f"/session/{self._session_id}/screenshot")
        png_bytes = base64.b64decode(resp["value"])
        if output_path is not None:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(png_bytes)
        return png_bytes

    def print_to_pdf(self, output_path: Optional[str | Path] = None) -> bytes:
        """Render the current Gecko document to vector PDF bytes."""
        self._ensure_session()
        resp = self._request("POST", f"/session/{self._session_id}/print", {})
        pdf_bytes = base64.b64decode(resp["value"])
        if output_path is not None:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(pdf_bytes)
        return pdf_bytes

    def engine_info(self) -> dict[str, Any]:
        """Inspect live Gecko engine metadata from inside the runtime."""
        return self.eval_js(
            """
            return {
              userAgent: navigator.userAgent,
              buildID: navigator.buildID || null,
              oscpu: navigator.oscpu || null,
              isGecko: typeof InstallTrigger !== 'undefined' || navigator.userAgent.includes('Gecko/'),
              viewport: { width: window.innerWidth, height: window.innerHeight },
              webglRenderer: (() => {
                try {
                  const c = document.createElement('canvas');
                  const gl = c.getContext('webgl');
                  return gl ? gl.getParameter(gl.VERSION) : 'unavailable';
                } catch (e) {
                  return String(e);
                }
              })()
            };
            """
        )

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------
    def _ensure_session(self) -> None:
        if not self._session_id or not self._port:
            raise RuntimeError("EmbeddedGeckoEngine is not started. Call .start() first.")

    def _request(
        self, method: str, path: str, payload: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        url = f"http://127.0.0.1:{self._port}{path}"
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Gecko IPC error ({e.code}) on {path}: {err_body}") from e
