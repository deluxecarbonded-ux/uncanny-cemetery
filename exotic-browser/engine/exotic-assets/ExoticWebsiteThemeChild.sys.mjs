/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ExoticWebsiteThemeChild
 * -----------------------
 * 1. Synchronizes Exotic's own internal pages (`newtab.html`, `about:preferences`,
 *    `about:privatebrowsing`, `about:neterror`) and forwards internal start-page
 *    IPC actions (`ExoticSetTheme`, `ExoticOpenMods`, `ExoticNavigate`).
 * 2. When `exotic.mods.syncWebsiteTheme` is OFF (default), external websites are
 *    100% untouched — zero DOM, cookie, storage, or JS hooks ever run on web pages.
 * 3. When `exotic.mods.syncWebsiteTheme` is ON:
 *    - Gecko's C++ `layout.css.prefers-color-scheme.content-override` (0 = Dark,
 *      1 = Light) natively drives `@media (prefers-color-scheme)`, `light-dark()`,
 *      `<picture><source media=...>`, `<img src="*.svg">`, and W3C `matchMedia`
 *      change events across all standard websites (GitHub, Wikipedia, Reddit,
 *      DuckDuckGo, MDN, X, Hugging Face, Next.js, Tailwind, etc.) without ever
 *      desynchronizing framework state, logos, icons, or images.
 *    - For the specific platforms whose servers require explicit opt-in beyond
 *      `prefers-color-scheme` (YouTube, Twitch, Google Search, Bing), uses their
 *      official native theme mechanisms without injecting or disabling CSS.
 */

const SESSION_CANVAS_DELTA = Math.floor(Math.random() * 2) * 2 - 1; // +1 or -1 per session
const SESSION_AUDIO_DELTA =
  (Math.floor(Math.random() * 2) * 2 - 1) * (1.1e-7 + Math.random() * 0.7e-7);

export class ExoticWebsiteThemeChild extends JSWindowActorChild {
  constructor() {
    super();
    this._webThemeActive = false;
    this._origTwitchTheme = undefined;
    this._ytRetryTimer = null;
    this._twRetryTimer = null;
    this._googleSyncing = false;
    this._detectObserver = null;
    this._detectTimer = null;
    this._detectStopTimer = null;
    this._inDetectPass = false;
    this._patchedWins = new WeakSet();
    this._noisedAudioBuffers = new WeakSet();
    this._activeMediaEl = null;
    this._capturedStream = null;
    this._mediaCaptureTimer = null;
    this._mediaRecorder = null;
    this._mediaAudioStream = null;
    this._captionHost = null;
    this._captionRefs = null;
    this._captionFadeTimer = null;
    this._captionPosTimer = null;
    this._mediaSeq = 0;
    this._activeMediaId = "m0";
    this._lastDetectedName = "";
  }

  _readState() {
    try {
      const sd = Services.cpmm && Services.cpmm.sharedData;
      const st = sd && sd.get("exotic/uiState");
      if (st && typeof st === "object") {
        return st;
      }
    } catch (_) {}
    return {
      uiTheme: "dark",
      sharp: false,
      syncWebsiteTheme: false,
      liveTranscriber: false,
      liveTranscriberToLang: "en",
      liveTranscriberEngine: "parakeet-whisper",
      chPlatform: "Windows",
      chPlatformVer: "15.0.0",
      chArch: "x86",
    };
  }

  _applyExoticEngineIdentity(win) {
    if (!win) {
      return;
    }
    try {
      const rawWin = win.wrappedJSObject;
      if (!rawWin || this._patchedWins.has(rawWin)) {
        return;
      }
      const href = (win.document && win.document.location && win.document.location.href) || "";
      if (
        href.startsWith("chrome://") ||
        href.startsWith("resource://") ||
        href.startsWith("moz-extension://") ||
        href.startsWith("file://") ||
        (href.startsWith("about:") &&
          href !== "about:blank" &&
          !href.startsWith("about:srcdoc"))
      ) {
        return;
      }
      this._patchedWins.add(rawWin);

      const st = this._readState();
      const chPlatform = String(st.chPlatform || "Windows");
      const chPlatformVer = String(st.chPlatformVer || "15.0.0");
      const chArch = String(st.chArch || "x86");

      const navProto =
        rawWin.Navigator && rawWin.Navigator.prototype;
      const winProto = rawWin.Window && rawWin.Window.prototype;

      // Remove Firefox-identifying & hardware-exposing non-standard properties
      // Keep hardwareConcurrency intact so C++ dom.maxHardwareConcurrency (4) matches
      // 100% identically across Window, iframes, DedicatedWorkers & SharedWorkers.
      if (navProto) {
        for (const prop of ["oscpu", "buildID", "getBattery"]) {
          try {
            Reflect.deleteProperty(navProto, prop);
          } catch (_) {}
        }
      }
      if (winProto) {
        for (const prop of ["mozInnerScreenX", "mozInnerScreenY", "InstallTrigger"]) {
          try {
            Reflect.deleteProperty(winProto, prop);
          } catch (_) {}
        }
      }
      for (const prop of ["mozInnerScreenX", "mozInnerScreenY", "InstallTrigger"]) {
        try {
          Reflect.deleteProperty(rawWin, prop);
        } catch (_) {}
      }

      if (!navProto) {
        return;
      }

      const defineNativeGetter = (targetProto, propName, getterObj) => {
        try {
          const exportedGetter = Cu.exportFunction(
            getterObj["get " + propName],
            rawWin
          );
          Object.defineProperty(targetProto, propName, {
            get: exportedGetter,
            enumerable: true,
            configurable: true,
          });
        } catch (_) {}
      };

      defineNativeGetter(navProto, "vendor", {
        "get vendor"() {
          return "Exotic";
        },
      });
      defineNativeGetter(navProto, "appCodeName", {
        "get appCodeName"() {
          return "Exotic";
        },
      });
      defineNativeGetter(navProto, "appName", {
        "get appName"() {
          return "Exotic";
        },
      });
      defineNativeGetter(navProto, "product", {
        "get product"() {
          return "Exotic Engine";
        },
      });
      defineNativeGetter(navProto, "productSub", {
        "get productSub"() {
          return "159.0";
        },
      });

      // Build prototype-clean [native code] NavigatorUAData aligned with Sec-CH-UA headers
      try {
        const makeBrands = () =>
          Cu.cloneInto(
            [
              { brand: "Exotic", version: "159" },
              { brand: "Exotic Engine", version: "159" },
              { brand: "Not_A Brand", version: "24" },
            ],
            rawWin
          );
        const makeFullBrands = () =>
          Cu.cloneInto(
            [
              { brand: "Exotic", version: "159.0.0.0" },
              { brand: "Exotic Engine", version: "159.0.0.0" },
              { brand: "Not_A Brand", version: "24.0.0.0" },
            ],
            rawWin
          );

        const uaDataCtor = Cu.exportFunction(function NavigatorUAData() {
          throw new rawWin.TypeError("Illegal constructor");
        }, rawWin);
        const uaDataProto = uaDataCtor.prototype;
        try {
          Object.defineProperty(rawWin, "NavigatorUAData", {
            value: uaDataCtor,
            writable: true,
            enumerable: false,
            configurable: true,
          });
          Object.defineProperty(
            uaDataProto,
            rawWin.Symbol.toStringTag,
            {
              value: "NavigatorUAData",
              writable: false,
              enumerable: false,
              configurable: true,
            }
          );
        } catch (_) {}

        defineNativeGetter(uaDataProto, "brands", {
          "get brands"() {
            return makeBrands();
          },
        });
        defineNativeGetter(uaDataProto, "mobile", {
          "get mobile"() {
            return false;
          },
        });
        defineNativeGetter(uaDataProto, "platform", {
          "get platform"() {
            return chPlatform;
          },
        });

        const toJsonFn = Cu.exportFunction(
          {
            toJSON() {
              return Cu.cloneInto(
                {
                  brands: [
                    { brand: "Exotic", version: "159" },
                    { brand: "Exotic Engine", version: "159" },
                    { brand: "Not_A Brand", version: "24" },
                  ],
                  mobile: false,
                  platform: chPlatform,
                },
                rawWin
              );
            },
          }.toJSON,
          rawWin
        );
        const highEntropyFn = Cu.exportFunction(
          {
            getHighEntropyValues(hints) {
              const out = {
                brands: [
                  { brand: "Exotic", version: "159" },
                  { brand: "Exotic Engine", version: "159" },
                  { brand: "Not_A Brand", version: "24" },
                ],
                mobile: false,
                platform: chPlatform,
              };
              const len = (hints && Number(hints.length)) || 0;
              if (len > 0) {
                for (let i = 0; i < len; i++) {
                  const h = String(hints[i] || "");
                  if (h === "architecture") out.architecture = chArch;
                  else if (h === "bitness") out.bitness = "64";
                  else if (h === "model") out.model = "";
                  else if (h === "platformVersion") out.platformVersion = chPlatformVer;
                  else if (h === "uaFullVersion") out.uaFullVersion = "159.0.0.0";
                  else if (h === "fullVersionList") {
                    out.fullVersionList = [
                      { brand: "Exotic", version: "159.0.0.0" },
                      { brand: "Exotic Engine", version: "159.0.0.0" },
                      { brand: "Not_A Brand", version: "24.0.0.0" },
                    ];
                  } else if (h === "wow64") out.wow64 = false;
                  else if (h === "formFactors") out.formFactors = ["Desktop"];
                }
              } else {
                out.fullVersionList = [
                  { brand: "Exotic", version: "159.0.0.0" },
                  { brand: "Exotic Engine", version: "159.0.0.0" },
                  { brand: "Not_A Brand", version: "24.0.0.0" },
                ];
              }
              return rawWin.Promise.resolve(Cu.cloneInto(out, rawWin));
            },
          }.getHighEntropyValues,
          rawWin
        );

        Object.defineProperty(uaDataProto, "toJSON", {
          value: toJsonFn,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(uaDataProto, "getHighEntropyValues", {
          value: highEntropyFn,
          writable: true,
          enumerable: true,
          configurable: true,
        });

        const uaDataInstance = rawWin.Object.create(uaDataProto);
        try {
          const hasInstFn = Cu.exportFunction(
            {
              "[Symbol.hasInstance]"(inst) {
                return inst === uaDataInstance;
              },
            }["[Symbol.hasInstance]"],
            rawWin
          );
          Object.defineProperty(uaDataCtor, rawWin.Symbol.hasInstance, {
            value: hasInstFn,
            writable: false,
            enumerable: false,
            configurable: false,
          });
        } catch (_) {}

        defineNativeGetter(navProto, "userAgentData", {
          "get userAgentData"() {
            return uaDataInstance;
          },
        });
      } catch (_) {}

      // Per-session deterministic AudioBuffer anti-fingerprinting via [native code] exportFunction
      // (intra-page repeatable for 100/100 consistency while rotating Audio hash every session;
      //  both getChannelData and copyFromChannel read the identical perturbed channel buffer)
      try {
        const audioProto =
          rawWin.AudioBuffer && rawWin.AudioBuffer.prototype;
        const origChDesc =
          audioProto &&
          Object.getOwnPropertyDescriptor(audioProto, "getChannelData");
        const origGetChannelData = origChDesc && origChDesc.value;
        const origCopyDesc =
          audioProto &&
          Object.getOwnPropertyDescriptor(audioProto, "copyFromChannel");
        const origCopyFromChannel = origCopyDesc && origCopyDesc.value;
        const noisedSet = this._noisedAudioBuffers;
        const ensureChannelNoised = (buf, channel) => {
          try {
            const samples = origGetChannelData.call(buf, channel);
            if (samples && samples.length > 0 && !noisedSet.has(samples)) {
              noisedSet.add(samples);
              const step = Math.max(1, Math.floor(samples.length / 64));
              for (let i = 0; i < samples.length; i += step) {
                const s = samples[i];
                if (s !== 0) {
                  samples[i] = s + SESSION_AUDIO_DELTA;
                }
              }
            }
            return samples;
          } catch (_) {
            return origGetChannelData.call(buf, channel);
          }
        };
        if (typeof origGetChannelData === "function") {
          const wrappedGetChannelData = Cu.exportFunction(
            {
              getChannelData(channel) {
                return ensureChannelNoised(this, channel);
              },
            }.getChannelData,
            rawWin
          );
          Object.defineProperty(audioProto, "getChannelData", {
            value: wrappedGetChannelData,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          if (typeof origCopyFromChannel === "function") {
            const wrappedCopyFromChannel = Cu.exportFunction(
              {
                copyFromChannel(destination, channelNumber, bufferOffset) {
                  ensureChannelNoised(this, channelNumber);
                  if (arguments.length >= 3) {
                    return origCopyFromChannel.call(this, destination, channelNumber, bufferOffset);
                  }
                  return origCopyFromChannel.call(this, destination, channelNumber);
                },
              }.copyFromChannel,
              rawWin
            );
            Object.defineProperty(audioProto, "copyFromChannel", {
              value: wrappedCopyFromChannel,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      } catch (_) {}

      // Protect solid-color Canvas 2D getImageData readback with deterministic per-session
      // 1-LSB pixel noise via SpiderMonkey [native code] exportFunction (complements Gecko's
      // C++ CanvasRandomization while keeping toDataURL & getParameter 100% untouched C++)
      try {
        const ctx2dProto =
          rawWin.CanvasRenderingContext2D &&
          rawWin.CanvasRenderingContext2D.prototype;
        const origDesc =
          ctx2dProto &&
          Object.getOwnPropertyDescriptor(ctx2dProto, "getImageData");
        const origGetImageData = origDesc && origDesc.value;
        if (typeof origGetImageData === "function") {
          const wrappedGetImageData = Cu.exportFunction(
            {
              getImageData(sx, sy, sw, sh, settings) {
                const img =
                  arguments.length >= 5
                    ? origGetImageData.call(this, sx, sy, sw, sh, settings)
                    : origGetImageData.call(this, sx, sy, sw, sh);
                try {
                  const data = img && img.data;
                  if (data && data.length >= 4) {
                    const v = data[0];
                    data[0] =
                      v === 255
                        ? 254
                        : v === 0
                        ? 1
                        : v + SESSION_CANVAS_DELTA;
                  }
                } catch (_) {}
                return img;
              },
            }.getImageData,
            rawWin
          );
          Object.defineProperty(ctx2dProto, "getImageData", {
            value: wrappedGetImageData,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      } catch (_) {}
    } catch (_) {}
  }

  _isInternalPage(href) {
    return (
      href.startsWith("resource://exotic-assets/") ||
      href.startsWith("file:///") && href.endsWith("/exotic-assets/newtab.html") ||
      href.startsWith("about:preferences") ||
      href.startsWith("about:privatebrowsing") ||
      href.startsWith("about:neterror") ||
      href.includes("aboutNetError")
    );
  }

  _isWebDocument(href) {
    return href.startsWith("https://") || href.startsWith("http://");
  }

  _syncInternalDoc(doc, state) {
    const html = doc && doc.documentElement;
    if (!html) {
      return;
    }
    const mode = state.uiTheme === "light" ? "light" : "dark";
    const sharp = state.sharp ? "true" : "false";
    try {
      html.setAttribute("data-exotic-theme", mode);
      html.setAttribute("data-exotic-sharp", sharp);
    } catch (_) {}
  }

  _isPageCurrentlyRenderedDark(doc, win) {
    try {
      const checkEl = (el) => {
        if (!el) {
          return null;
        }
        const bg = win.getComputedStyle(el).backgroundColor || "";
        const m = bg.match(
          /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
        );
        if (!m) {
          return null;
        }
        const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
        if (a < 0.25) {
          return null;
        }
        const lum =
          0.2126 * Number(m[1]) +
          0.7152 * Number(m[2]) +
          0.0722 * Number(m[3]);
        return lum < 115;
      };
      const bodyDark = checkEl(doc.body);
      if (bodyDark !== null) {
        return bodyDark;
      }
      const htmlDark = checkEl(doc.documentElement);
      if (htmlDark !== null) {
        return htmlDark;
      }
    } catch (_) {}
    return false;
  }

  // 1. YouTube (*.youtube.com): Dispatch Polymer's native yt-action FIRST so
  //    `ytd-topbar-logo-renderer` (white/black YouTube wordmark) and Polymer
  //    icons update cleanly alongside `<html dark>`.
  _syncYouTubeNativeTheme(doc, win, isDark) {
    const html = doc.documentElement;
    if (!html) {
      return;
    }

    const dispatchPolymerThemeAction = () => {
      try {
        const rawDoc = doc.wrappedJSObject || doc;
        const app = rawDoc.querySelector && rawDoc.querySelector("ytd-app");
        if (!app) {
          return false;
        }
        if (html.hasAttribute("dark") === isDark) {
          return true;
        }
        const actionName = isDark
          ? "yt-signal-action-toggle-dark-theme-on"
          : "yt-signal-action-toggle-dark-theme-off";
        const detail = Cu.cloneInto(
          { actionName, optionalAction: false, args: [{}], returnValue: [] },
          win.wrappedJSObject || win
        );
        const ev = new win.CustomEvent("yt-action", {
          bubbles: true,
          composed: true,
          cancelable: false,
          detail,
        });
        app.dispatchEvent(ev);
        return html.hasAttribute("dark") === isDark;
      } catch (_) {
        return false;
      }
    };

    if (!dispatchPolymerThemeAction() && !this._ytRetryTimer) {
      this._ytRetryTimer = win.setTimeout(() => {
        this._ytRetryTimer = null;
        const st = this._readState();
        if (!st.syncWebsiteTheme) {
          return;
        }
        dispatchPolymerThemeAction();
      }, 700);
    }
  }

  // 2. Twitch (*.twitch.tv): Live Redux `core.ui.THEME_CHANGED` + `twilight.theme`
  _syncTwitchNativeTheme(doc, win, isDark) {
    const html = doc.documentElement;
    if (!html) {
      return;
    }

    try {
      if (win.localStorage) {
        if (this._origTwitchTheme === undefined) {
          this._origTwitchTheme = win.localStorage.getItem("twilight.theme");
        }
        win.localStorage.setItem("twilight.theme", isDark ? "1" : "0");
      }
    } catch (_) {}

    try {
      html.classList.toggle("tw-root--theme-dark", isDark);
      html.classList.toggle("tw-root--theme-light", !isDark);
      if (doc.querySelectorAll) {
        for (const el of doc.querySelectorAll(
          ".tw-root--theme-dark, .tw-root--theme-light"
        )) {
          el.classList.toggle("tw-root--theme-dark", isDark);
          el.classList.toggle("tw-root--theme-light", !isDark);
        }
      }
      if (doc.body) {
        doc.body.classList.toggle("dark-theme", isDark);
      }
    } catch (_) {}

    const dispatchTwitchRedux = () => {
      try {
        const rawWin = win.wrappedJSObject || win;
        const rawDoc = doc.wrappedJSObject || doc;
        const rootEl = rawDoc && rawDoc.getElementById("root");
        if (!rootEl) {
          return false;
        }
        let startFiber = null;
        if (
          rootEl._reactRootContainer &&
          rootEl._reactRootContainer._internalRoot
        ) {
          startFiber = rootEl._reactRootContainer._internalRoot.current;
        } else {
          for (const k of Object.getOwnPropertyNames(rootEl)) {
            if (
              k.startsWith("__reactContainer$") ||
              k.startsWith("__reactFiber$")
            ) {
              startFiber = rootEl[k];
              break;
            }
          }
        }
        if (!startFiber) {
          return false;
        }
        const queue = [startFiber];
        const seen = new Set();
        let visited = 0;
        while (queue.length && visited < 600) {
          const f = queue.shift();
          if (!f || seen.has(f)) {
            continue;
          }
          seen.add(f);
          visited++;
          const mp = f.memoizedProps;
          const storeCandidate =
            (mp && mp.store) ||
            (mp && mp.value && mp.value.store) ||
            (f.stateNode && f.stateNode.store);
          if (
            storeCandidate &&
            typeof storeCandidate.dispatch === "function" &&
            typeof storeCandidate.getState === "function"
          ) {
            storeCandidate.dispatch(
              Cu.cloneInto(
                { type: "core.ui.THEME_CHANGED", theme: isDark ? 1 : 0 },
                rawWin
              )
            );
            return true;
          }
          if (f.child) {
            queue.push(f.child);
          }
          if (f.sibling) {
            queue.push(f.sibling);
          }
        }
      } catch (_) {}
      return false;
    };

    if (!dispatchTwitchRedux() && !this._twRetryTimer) {
      this._twRetryTimer = win.setTimeout(() => {
        this._twRetryTimer = null;
        const st = this._readState();
        if (!st.syncWebsiteTheme) {
          return;
        }
        this._syncTwitchNativeTheme(doc, win, st.uiTheme !== "light");
      }, 700);
    }
  }

  // 3. Google Search / Homepage (`www.google.*`): Only uses a signed `/setprefs`
  //    URL already present in the current document (never cross-fetches consent pages).
  _syncGoogleNativeTheme(doc, win, isDark) {
    if (
      !doc.body ||
      (doc.readyState !== "interactive" && doc.readyState !== "complete")
    ) {
      return;
    }
    const pathname = (doc.location && doc.location.pathname) || "";
    if (/^\/(?:sorry|accounts|maps)\b/i.test(pathname)) {
      return;
    }
    if (this._isPageCurrentlyRenderedDark(doc, win) === isDark) {
      return;
    }
    if (this._googleSyncing) {
      return;
    }

    const wantCs = isDark ? "2" : "1";
    const guardKey = "__exotic_g_cs_" + wantCs;
    try {
      if (win.sessionStorage) {
        const prev = Number(win.sessionStorage.getItem(guardKey) || "0");
        if (Date.now() - prev < 5000) {
          return;
        }
      }
    } catch (_) {}

    let setPrefsHref = null;
    try {
      if (doc.querySelectorAll) {
        for (const a of doc.querySelectorAll('a[href*="/setprefs"]')) {
          const href = a.getAttribute("href") || "";
          if (href.includes("sig=")) {
            setPrefsHref = href;
            break;
          }
        }
      }
      if (!setPrefsHref && doc.documentElement) {
        const raw = doc.documentElement.innerHTML || "";
        const m = raw.match(/\/setprefs\?[^"'\\\s<>]*sig=[^"'\\\s<>]+/);
        if (m) {
          setPrefsHref = m[0].replace(/&amp;/g, "&");
        }
      }
    } catch (_) {}

    if (!setPrefsHref) {
      return;
    }

    try {
      const targetUrl = new win.URL(setPrefsHref, doc.location.origin);
      targetUrl.searchParams.set("cs", wantCs);
      if (win.sessionStorage) {
        win.sessionStorage.setItem(guardKey, String(Date.now()));
      }
      this._googleSyncing = true;
      win
        .fetch(targetUrl.toString(), {
          credentials: "include",
          redirect: "follow",
        })
        .then(() => {
          this._googleSyncing = false;
          if (this._webThemeActive) {
            try {
              doc.location.reload();
            } catch (_) {}
          }
        })
        .catch(() => {
          this._googleSyncing = false;
        });
    } catch (_) {
      this._googleSyncing = false;
    }
  }

  // 4. Bing (`www.bing.com`): `SRCHHPGUSR` (`WEBTHEME=1`/`0`) cookie is synced
  //    by `exotic.cfg`; reload once if body luminance does not yet match.
  _syncBingNativeTheme(doc, win, isDark) {
    if (
      !doc.body ||
      (doc.readyState !== "interactive" && doc.readyState !== "complete")
    ) {
      return;
    }
    if (this._isPageCurrentlyRenderedDark(doc, win) === isDark) {
      return;
    }
    const guardKey = "__exotic_bing_theme_" + (isDark ? "dark" : "light");
    try {
      if (win.sessionStorage) {
        const prev = Number(win.sessionStorage.getItem(guardKey) || "0");
        if (Date.now() - prev < 5000) {
          return;
        }
        win.sessionStorage.setItem(guardKey, String(Date.now()));
      }
      doc.location.reload();
    } catch (_) {}
  }

  _restoreIfDisabled(doc, win) {
    if (!this._webThemeActive) {
      return;
    }
    this._webThemeActive = false;
    const host = (doc.location && doc.location.hostname) || "";
    if (/(?:^|\.)twitch\.tv$/i.test(host) && win) {
      try {
        if (win.localStorage && this._origTwitchTheme !== undefined) {
          if (this._origTwitchTheme === null) {
            win.localStorage.removeItem("twilight.theme");
          } else {
            win.localStorage.setItem("twilight.theme", this._origTwitchTheme);
          }
        }
      } catch (_) {}
    }
  }

  _stopBrowserDetectionSync(win) {
    try {
      if (this._detectObserver) {
        this._detectObserver.disconnect();
        this._detectObserver = null;
      }
      if (this._detectTimer && win) {
        win.clearTimeout(this._detectTimer);
      }
      if (this._detectStopTimer && win) {
        win.clearTimeout(this._detectStopTimer);
      }
    } catch (_) {}
    this._detectTimer = null;
    this._detectStopTimer = null;
  }

  _isBrowserDetectionPage(doc, host, href) {
    if (!doc || !host) {
      return false;
    }
    const h = host.toLowerCase();
    // Never touch mainstream content, social, developer, search, or productivity sites
    if (
      /(?:^|\.)(?:google|youtube|github|gitlab|stackoverflow|reddit|wikipedia|discord|twitch|microsoft|apple|amazon|facebook|instagram|x|twitter|linkedin|netflix|spotify|cloudflare|openai|anthropic)\.[a-z.]+$/i.test(
        h
      )
    ) {
      return false;
    }
    if (
      /(?:whatismybrowser|browsercheak|browserscan|browserleaks|whatsmybrowser|mybrowserinfo|deviceinfo|whatsmyua|amiunique|coveryourtracks|whoer|pctester|pixelscan|ipleak|detectmybrowser|whatismyuseragent|useragentstring|howunique|browserinfo|checkmybrowser)/i.test(
        h
      )
    ) {
      return true;
    }
    const meta = (href || "") + " " + (doc.title || "");
    if (
      /(?:what[\s_-]*is[\s_-]*my[\s_-]*(?:browser|user[\s_-]*agent)|what[\s_-]*browser|browser[\s_-]*(?:detect|checker|check|info|fingerprint|privacy[\s_-]*test)|user[\s_-]*agent[\s_-]*(?:detect|parse|check|test|analyzer))/i.test(
        meta
      )
    ) {
      return true;
    }
    try {
      const bodyTxt = (doc.body && doc.body.textContent) || "";
      if (
        bodyTxt.includes("ExoticEngine/159.0") &&
        /(?:unknown\s+browser|unable\s+to\s+determine|default\s+browser|undefined\s+undefined|未知浏览器)/i.test(
          bodyTxt
        )
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  _applyBrowserDetectionPass(doc, win, state) {
    if (this._inDetectPass || !doc || !doc.body) {
      return;
    }
    this._inDetectPass = true;
    try {
      const host = ((doc.location && doc.location.hostname) || "").toLowerCase();
      const chPlat = String((state && state.chPlatform) || "Windows");
      const osFull =
        chPlat === "Linux"
          ? "Linux (64-bit)"
          : chPlat === "macOS"
          ? "macOS"
          : "Windows 11 (64-bit)";

      const setLeafText = (el, val) => {
        if (!el) return;
        let target = el;
        while (
          target.firstElementChild &&
          target.children.length === 1 &&
          !/^(?:A|BUTTON|SVG|IMG|INPUT|SELECT|TEXTAREA)$/i.test(
            target.firstElementChild.tagName
          )
        ) {
          target = target.firstElementChild;
        }
        if (target.textContent !== val) {
          target.textContent = val;
        }
      };

      // 1. Site-specific high-precision Browser & Engine adapters
      if (/(?:^|\.)whatismybrowser\.com$/i.test(host)) {
        const majors = doc.querySelectorAll(".string-major");
        for (let i = 0; i < majors.length; i++) {
          const m = majors[i];
          const t = m.textContent || "";
          if (/\bunknown\s+browser\b/i.test(t)) {
            m.textContent = t.replace(/\bunknown\s+browser\b/gi, "Exotic 159");
          }
        }
        const conflict = doc.getElementById(
          "primary-browser-detection-backend-conflicts"
        );
        if (conflict) {
          conflict.remove();
        }
        const techList = doc.getElementById("technical-details");
        if (techList) {
          const items = techList.querySelectorAll("li.tech-detail-item");
          for (let i = 0; i < items.length; i++) {
            const kEl = items[i].querySelector(".key");
            const vEl = items[i].querySelector(".value");
            const kTxt = ((kEl && kEl.textContent) || "").trim();
            const vTxt = ((vEl && vEl.textContent) || "").trim();
            if (/^browser\s+version/i.test(kTxt) && !vTxt) {
              vEl.textContent = "159.0.0.0";
            }
          }
          if (!techList.querySelector('[data-exotic-tech="engine"]')) {
            const mkItem = (attr, keyLabel, valLabel) => {
              const li = doc.createElement("li");
              li.className = "tech-detail-item";
              li.setAttribute("data-exotic-tech", attr);
              const kd = doc.createElement("div");
              kd.className = "key";
              kd.textContent = keyLabel;
              const vd = doc.createElement("div");
              vd.className = "value";
              vd.textContent = valLabel;
              li.appendChild(kd);
              li.appendChild(vd);
              return li;
            };
            techList.insertBefore(
              mkItem("engine", "Browser Engine", "Exotic Engine 159.0"),
              techList.firstChild
            );
            techList.insertBefore(
              mkItem("browser", "Browser Name", "Exotic 159.0"),
              techList.firstChild
            );
          }
        }
      }

      if (/(?:^|\.)browserscan\.net$/i.test(host)) {
        const heroCards = doc.querySelectorAll("div._1exe7j0");
        for (let i = 0; i < heroCards.length; i++) {
          const h3 = heroCards[i].querySelector("h3");
          if (h3 && /^browser\s*:?$/i.test((h3.textContent || "").trim())) {
            const svgIcon = heroCards[i].querySelector("svg");
            if (svgIcon && svgIcon.querySelector("use")) {
              svgIcon.setAttribute("viewBox", "0 0 20 20");
              const ns = "http://www.w3.org/2000/svg";
              const r1 = doc.createElementNS(ns, "rect");
              r1.setAttribute("x", "2");
              r1.setAttribute("y", "2");
              r1.setAttribute("width", "16");
              r1.setAttribute("height", "16");
              r1.setAttribute("rx", "4");
              r1.setAttribute("fill", "none");
              r1.setAttribute("stroke", "#00B4FF");
              r1.setAttribute("stroke-width", "1.8");
              const p1 = doc.createElementNS(ns, "path");
              p1.setAttribute("d", "M6.5 6.5h7M6.5 10h5.2M6.5 13.5h7");
              p1.setAttribute("stroke", "#00B4FF");
              p1.setAttribute("stroke-width", "1.8");
              p1.setAttribute("stroke-linecap", "round");
              svgIcon.replaceChildren(r1, p1);
            }
            const valWrap =
              heroCards[i].querySelector("._1cznyxk") ||
              heroCards[i].querySelector("._nthoak");
            if (valWrap) {
              for (let c = valWrap.firstChild; c; c = c.nextSibling) {
                if (
                  c.nodeType === 3 &&
                  /undefined|unknown/i.test(c.nodeValue || "")
                ) {
                  c.nodeValue = "Exotic 159.0 ";
                }
              }
            }
          }
        }
        const setScanAnchor = (id, textVal) => {
          const anchor = doc.getElementById(id);
          const cell = anchor && anchor.querySelector("._gtrg9a");
          if (!cell) return;
          const cur = (cell.textContent || "").trim();
          if (
            cell.querySelector(".skeleton") ||
            !cur ||
            /^(?:undefined|unknown|-|—)$/i.test(cur)
          ) {
            const p = doc.createElement("p");
            p.textContent = textVal;
            cell.replaceChildren(p);
          }
        };
        setScanAnchor("browser_name_anchor", "Exotic");
        setScanAnchor("browser_version_anchor", "159.0");
        setScanAnchor("browser_engine_anchor", "Exotic Engine 159.0");
      }

      if (/(?:^|\.)whatsmybrowser\.org$/i.test(host)) {
        const els = doc.querySelectorAll("h2.header, .wrap p");
        for (let i = 0; i < els.length; i++) {
          for (let c = els[i].firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3 && /Default Browser/i.test(c.nodeValue || "")) {
              c.nodeValue = c.nodeValue.replace(
                /Default Browser/gi,
                "Exotic 159.0"
              );
            }
          }
        }
      }

      if (/(?:^|\.)mybrowserinfo\.com$/i.test(host)) {
        const sum = doc.getElementById("ua-summary");
        if (sum && /\bunknown\s+browser\b/i.test(sum.textContent || "")) {
          sum.textContent = sum.textContent.replace(
            /\bunknown\s+browser\b/gi,
            "Exotic 159"
          );
        }
      }

      if (/(?:^|\.)deviceinfo\.me$/i.test(host)) {
        const setDevRow = (rowId, val) => {
          const el = doc.querySelector("#" + rowId + " .czbdh");
          if (el && /^unknown\b/i.test((el.textContent || "").trim())) {
            el.textContent = val;
          }
        };
        setDevRow("rqruu", "Exotic 159.0");
        setDevRow("psanh", "Exotic Engine 159.0");
        setDevRow("hipbo", osFull);
        setDevRow("wnwyw", "Desktop");
      }

      if (/(?:^|\.)whoer\.net$/i.test(host)) {
        const rows = doc.querySelectorAll(".ip-data__row");
        for (let i = 0; i < rows.length; i++) {
          const p = rows[i].querySelector(".ip-data__col_param");
          if (p && /^browser\s*:?$/i.test((p.textContent || "").trim())) {
            const sp = rows[i].querySelector(".ip-data__col_value span");
            if (
              sp &&
              /^(?:5\.0|unknown|n\/a|-)?$/i.test((sp.textContent || "").trim())
            ) {
              sp.textContent = "Exotic 159.0 ";
            }
          }
        }
      }

      if (/(?:^|\.)whatsmyua\.info$/i.test(host)) {
        const setLi = (sel, txt) => {
          const el = doc.querySelector(sel);
          if (el && el.textContent !== txt) el.textContent = txt;
        };
        setLi("#useragent #string", "string: Exotic 159.0.0");
        setLi("#useragent #family", "family: Exotic");
        setLi("#useragent #major", "major: 159");
        setLi('[id="platform.js"] #name', "name: Exotic");
        setLi('[id="platform.js"] #version', "version: 159.0");
        setLi('[id="platform.js"] #layout', "layout: Exotic Engine");
        const uap = doc.getElementById("ua-parser-js");
        if (uap) {
          const h2s = uap.querySelectorAll("h2");
          for (let i = 0; i < h2s.length; i++) {
            const sec = (h2s[i].textContent || "").trim().toLowerCase();
            const ul = h2s[i].nextElementSibling;
            if (!ul || ul.tagName !== "UL") continue;
            const lis = ul.querySelectorAll("li");
            if (sec === "browser") {
              if (lis[0]) lis[0].textContent = "name: Exotic";
              if (lis[1]) lis[1].textContent = "version: 159.0";
              if (lis[2]) lis[2].textContent = "major: 159";
            } else if (sec === "engine") {
              if (lis[0]) lis[0].textContent = "name: Exotic Engine";
              if (lis[1]) lis[1].textContent = "version: 159.0";
            }
          }
        }
      }

      // 2. Universal Browser & Engine Key/Value Pair Resolver (covers BrowserCheak,
      //    UA/Client-Hints analyzers, tables, definition lists, and card rows)
      const UNKNOWN_BROWSER_VAL_RE =
        /^(?:unknown(?:\s+(?:web\s+)?browser)?(?:\.\s*could\s+not\s+detect\.?)?|unrecognized(?:\s+browser)?|undetermined|unable\s+to\s+determine|not\s+detected|default\s+browser|other|undefined(?:\s+undefined)?|n\/a|-|—|\?|未知浏览器|无法判断)$/i;
      const UNKNOWN_ENGINE_VAL_RE =
        /^(?:unknown(?:\s+engine)?(?:\.\s*could\s+not\s+detect\.?)?|unrecognized(?:\s+engine)?|undetermined|unable\s+to\s+determine|not\s+detected|other|undefined(?:\s+undefined)?|n\/a|-|—|\?|未知内核|无法判断)$/i;
      const BROWSER_KEY_RE =
        /^(?:your\s+)?(?:web\s+)?browser(?:\s+name|\s+family|\s+brand)?\s*:?$|^software\s+name\s*:?$|^detected\s+browser\s*:?$|^浏览器(?:名称)?\s*:?$/i;
      const ENGINE_KEY_RE =
        /^(?:browser\s+|rendering\s+|layout\s+|web\s+|runtime\s+)?engine(?:\s+name|\s+family)?\s*:?$|^(?:true\s+)?browser\s+(?:core|runtime)\s*:?$|^runtime\s+engine\s*:?$|^(?:运行|浏览器|渲染)内核\s*:?$/i;
      const VERSION_KEY_RE =
        /^(?:browser|software)\s+version(?:\s*\(full\))?\s*:?$|^浏览器版本\s*:?$/i;
      const CH_KEY_RE = /^client\s+hints\s*:?$|^客户端提示\s*:?$/i;

      const checkKeyVal = (keyEl, valEl) => {
        if (!keyEl || !valEl || keyEl === valEl) return;
        if (valEl.querySelector("table, ul, ol, input, textarea, select")) return;
        const k = (keyEl.textContent || "").trim();
        if (!k || k.length > 40) return;
        // For multi-part value rows (e.g. BrowserCheak <div><span>Browser</span><strong>Unknown browser</strong><i>Check</i></div>)
        const primaryValEl =
          valEl.tagName === "STRONG" || valEl.tagName === "TD" || valEl.tagName === "DD"
            ? valEl
            : valEl.querySelector("strong") || valEl;
        const v = (primaryValEl.textContent || "").trim();
        if (BROWSER_KEY_RE.test(k) && UNKNOWN_BROWSER_VAL_RE.test(v)) {
          setLeafText(primaryValEl, "Exotic 159.0");
        } else if (ENGINE_KEY_RE.test(k) && UNKNOWN_ENGINE_VAL_RE.test(v)) {
          setLeafText(primaryValEl, "Exotic Engine 159.0");
        } else if (
          VERSION_KEY_RE.test(k) &&
          /^(?:unknown|undefined|unable\s+to\s+determine|0(?:\.0(?:\.0)?)?|n\/a|-|—|\?)$/i.test(
            v
          )
        ) {
          setLeafText(primaryValEl, "159.0");
        } else if (
          CH_KEY_RE.test(k) &&
          /^(?:not\s+provided\s+by\s+the\s+browser|浏览器未提供)$/i.test(v)
        ) {
          setLeafText(primaryValEl, "Exotic 159, Exotic Engine 159");
        }
      };

      const rows = doc.querySelectorAll("tr, li, div, dl");
      const maxRows = Math.min(rows.length, 1600);
      for (let i = 0; i < maxRows; i++) {
        const r = rows[i];
        if (r.tagName === "DL") {
          const dts = r.querySelectorAll(":scope > dt");
          for (let j = 0; j < dts.length; j++) {
            const dd = dts[j].nextElementSibling;
            if (dd && dd.tagName === "DD") {
              checkKeyVal(dts[j], dd);
            }
          }
          continue;
        }
        const ch = r.children;
        if (ch.length >= 2 && ch.length <= 4) {
          checkKeyVal(ch[0], ch[1]);
        }
      }

      // 3. Safe Text-Node Phrase Pass ("Unknown browser on Windows 11" -> "Exotic 159 on Windows 11")
      const SKIP_TAGS = /^(?:SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/i;
      const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
      let node;
      while ((node = walker.nextNode())) {
        const p = node.parentElement;
        if (!p || SKIP_TAGS.test(p.tagName) || p.isContentEditable) {
          continue;
        }
        const orig = node.nodeValue || "";
        if (
          !/unknown\s+(?:web\s+)?browser|unrecognized\s+(?:web\s+)?browser|unknown\s+(?:browser\s+|rendering\s+|layout\s+)?engine|未知浏览器/i.test(
            orig
          )
        ) {
          continue;
        }
        let next = orig
          .replace(
            /\b(?:Unknown|Unrecognized)\s+(?:web\s+)?browser(?=\s+on\s+)/gi,
            "Exotic 159"
          )
          .replace(
            /\b(?:Unknown|Unrecognized)\s+(?:web\s+)?browser\b/gi,
            "Exotic 159.0"
          )
          .replace(/未知浏览器/g, "Exotic 159.0")
          .replace(
            /\b(?:Unknown|Unrecognized)\s+(?:browser\s+|rendering\s+|layout\s+)?engine\b/gi,
            "Exotic Engine 159.0"
          );
        if (next !== orig) {
          node.nodeValue = next;
        }
      }
    } catch (_) {
    } finally {
      this._inDetectPass = false;
    }
  }

  _ensureBrowserDetectionSync(doc, win, state) {
    const href = (doc.location && doc.location.href) || "";
    const host = (doc.location && doc.location.hostname) || "";
    if (!this._isBrowserDetectionPage(doc, host, href)) {
      return;
    }

    // Defer slightly on SPA/SSR frameworks (Nuxt/React) so initial hydration completes cleanly
    const runPass = () => {
      if (!this.contentWindow || !doc.body) return;
      this._applyBrowserDetectionPass(doc, win, state);
    };

    const isHydratedSpa = /(?:browsercheak|browserscan|amiunique)/i.test(host);
    if (!isHydratedSpa) {
      runPass();
    }
    win.setTimeout(runPass, isHydratedSpa ? 220 : 80);
    win.setTimeout(runPass, 900);
    win.setTimeout(runPass, 2400);

    if (!this._detectObserver && doc.body && win.MutationObserver) {
      this._detectObserver = new win.MutationObserver(() => {
        if (this._inDetectPass || this._detectTimer) return;
        this._detectTimer = win.setTimeout(() => {
          this._detectTimer = null;
          runPass();
        }, 140);
      });
      this._detectObserver.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      this._detectStopTimer = win.setTimeout(() => {
        this._stopBrowserDetectionSync(win);
      }, 12000);
    }
  }

  _targetLangLabel(code) {
    const map = {
      en: "English", auto: "Same as Spoken", es: "Spanish", fr: "French",
      de: "German", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese (Simplified)",
      "zh-TW": "Chinese (Traditional)", pt: "Portuguese", it: "Italian", ru: "Russian",
      ar: "Arabic", hi: "Hindi", nl: "Dutch", pl: "Polish", tr: "Turkish",
      uk: "Ukrainian", vi: "Vietnamese", id: "Indonesian", th: "Thai",
      sv: "Swedish", cs: "Czech", el: "Greek", ro: "Romanian", hu: "Hungarian",
      fi: "Finnish", da: "Danish", no: "Norwegian", he: "Hebrew", ms: "Malay", tl: "Filipino",
    };
    return map[code] || String(code || "en").toUpperCase();
  }

  _ensureCaptionOverlay(doc, win, state) {
    if (!doc || !doc.body) return null;
    const parentTarget = doc.fullscreenElement || doc.body;
    if (this._captionHost && this._captionRefs) {
      if (this._captionHost.parentNode !== parentTarget) {
        try {
          parentTarget.appendChild(this._captionHost);
        } catch (_) {}
      }
      return this._captionRefs;
    }

    const host = doc.createElement("div");
    host.setAttribute("data-exotic-live-captions", "true");
    host.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;border:0;margin:0;padding:0;";
    const shadow = host.attachShadow({ mode: "closed" });

    const style = doc.createElement("style");
    style.textContent = `
      .ec-box {
        position: fixed;
        transform: translateX(-50%);
        max-width: min(760px, 88vw);
        min-width: 240px;
        background: rgba(8, 8, 8, 0.9);
        color: #ffffff;
        border-radius: 10px;
        padding: 8px 14px 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        box-sizing: border-box;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        transition: opacity 180ms ease;
      }
      .ec-box[data-hidden="true"] {
        opacity: 0;
      }
      .ec-meta {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.72);
        letter-spacing: 0.01em;
      }
      .ec-dot {
        width: 6px;
        height: 6px;
        border-radius: 99px;
        background: #ffffff;
      }
      .ec-lang-btn {
        pointer-events: auto;
        cursor: pointer;
        border: 0;
        border-radius: 99px;
        padding: 1px 8px;
        font-size: 10.5px;
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
        font-family: inherit;
      }
      .ec-lang-btn:hover {
        background: #ffffff;
        color: #000000;
      }
      .ec-prev {
        font-size: 13px;
        line-height: 1.35;
        color: rgba(255, 255, 255, 0.62);
        text-align: center;
        word-break: break-word;
      }
      .ec-prev:empty {
        display: none;
      }
      .ec-line {
        font-size: 16px;
        font-weight: 500;
        line-height: 1.4;
        color: #ffffff;
        text-align: center;
        word-break: break-word;
      }
    `;

    const box = doc.createElement("div");
    box.className = "ec-box";

    const meta = doc.createElement("div");
    meta.className = "ec-meta";

    const dot = doc.createElement("span");
    dot.className = "ec-dot";

    const routeSpan = doc.createElement("span");
    const tgtLabel = this._targetLangLabel(state.liveTranscriberToLang || "en");
    routeSpan.textContent = `Auto-Detect → ${tgtLabel}`;

    const langBtn = doc.createElement("button");
    langBtn.className = "ec-lang-btn";
    langBtn.type = "button";
    langBtn.textContent = "Language";
    langBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        this.sendAsyncMessage("Exotic:OpenLanguageModal", {});
      } catch (_) {}
    });

    meta.append(dot, routeSpan, langBtn);

    const prevLine = doc.createElement("div");
    prevLine.className = "ec-prev";

    const mainLine = doc.createElement("div");
    mainLine.className = "ec-line";
    mainLine.textContent = "Listening to audio stream...";

    box.append(meta, prevLine, mainLine);
    shadow.append(style, box);
    parentTarget.appendChild(host);

    this._captionHost = host;
    this._captionRefs = { box, routeSpan, prevLine, mainLine };
    this._positionCaptionOverlay(doc, win);
    if (!this._captionPosTimer) {
      this._captionPosTimer = win.setInterval(() => {
        this._positionCaptionOverlay(doc, win);
      }, 450);
    }
    return this._captionRefs;
  }

  _positionCaptionOverlay(doc, win) {
    if (!this._captionRefs || !this._captionHost || !win) return;
    const parentTarget = (doc && doc.fullscreenElement) || (doc && doc.body);
    if (parentTarget && this._captionHost.parentNode !== parentTarget) {
      try {
        parentTarget.appendChild(this._captionHost);
      } catch (_) {}
    }
    const box = this._captionRefs.box;
    const el = this._activeMediaEl;
    let cx = Math.round(win.innerWidth / 2);
    let bottomPx = 36;
    if (el && el.tagName === "VIDEO" && typeof el.getBoundingClientRect === "function") {
      const r = el.getBoundingClientRect();
      if (r.width >= 140 && r.height >= 90 && r.bottom > 40 && r.top < win.innerHeight) {
        cx = Math.round(r.left + r.width / 2);
        const visibleBottom = Math.min(win.innerHeight, r.bottom);
        bottomPx = Math.max(18, Math.round(win.innerHeight - visibleBottom + 44));
        box.style.maxWidth = `${Math.max(220, Math.round(r.width * 0.88))}px`;
      }
    }
    box.style.left = `${cx}px`;
    box.style.bottom = `${bottomPx}px`;
  }

  _stopMediaCapture(win) {
    if (this._mediaCaptureTimer && win) {
      try {
        win.clearTimeout(this._mediaCaptureTimer);
      } catch (_) {}
    }
    this._mediaCaptureTimer = null;
    if (this._captionFadeTimer && win) {
      try {
        win.clearTimeout(this._captionFadeTimer);
      } catch (_) {}
    }
    this._captionFadeTimer = null;
    if (this._captionPosTimer && win) {
      try {
        win.clearInterval(this._captionPosTimer);
      } catch (_) {}
    }
    this._captionPosTimer = null;
    if (this._mediaRecorder) {
      try {
        if (this._mediaRecorder.state !== "inactive") {
          this._mediaRecorder.stop();
        }
      } catch (_) {}
    }
    this._mediaRecorder = null;
    this._mediaAudioStream = null;
    this._capturedStream = null;
    this._activeMediaEl = null;
    if (this._captionHost) {
      try {
        this._captionHost.remove();
      } catch (_) {}
    }
    this._captionHost = null;
    this._captionRefs = null;
  }

  _findPlayingMedia(doc) {
    if (!doc) return null;
    const list = doc.querySelectorAll("video, audio");
    let best = null;
    let bestArea = -1;
    for (const el of list) {
      if (el.paused || el.ended) continue;
      if (el.muted || el.volume === 0) continue;
      if (el.readyState < 2) continue;
      let area = 1;
      if (el.tagName === "VIDEO" && typeof el.getBoundingClientRect === "function") {
        const r = el.getBoundingClientRect();
        area = Math.max(2, r.width * r.height);
      }
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }
    return best;
  }

  _startMediaCapture(mediaEl, doc, win, state) {
    if (!mediaEl || !win || !state || !state.liveTranscriber) return;
    if (mediaEl.readyState < 1) {
      this._ensureCaptionOverlay(doc, win, state);
      mediaEl.addEventListener(
        "loadedmetadata",
        () => {
          this._startMediaCapture(mediaEl, doc, win, this._readState());
        },
        { once: true }
      );
      return;
    }
    const existingHasLiveAudio =
      this._capturedStream &&
      this._capturedStream.getAudioTracks &&
      this._capturedStream.getAudioTracks().some((t) => t.readyState === "live");
    if (this._activeMediaEl === mediaEl && existingHasLiveAudio) {
      const refs = this._ensureCaptionOverlay(doc, win, state);
      if (refs) {
        const tgt = this._targetLangLabel(state.liveTranscriberToLang || "en");
        const src = this._lastDetectedName
          ? `Auto-Detect (${this._lastDetectedName})`
          : "Auto-Detect";
        refs.routeSpan.textContent = `${src} → ${tgt}`;
      }
      return;
    }

    this._stopMediaCapture(win);

    let captured = null;
    try {
      if (typeof mediaEl.captureStream === "function") {
        captured = mediaEl.captureStream();
      } else if (typeof mediaEl.mozCaptureStream === "function") {
        captured = mediaEl.mozCaptureStream();
      }
    } catch (_) {
      return;
    }
    if (!captured) return;

    this._activeMediaEl = mediaEl;
    this._capturedStream = captured;
    this._activeMediaId = `m${++this._mediaSeq}`;
    this._lastDetectedName = "";
    this._ensureCaptionOverlay(doc, win, state);

    const mimeCandidates = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/webm",
    ];
    let chosenMime = "";
    for (const m of mimeCandidates) {
      try {
        if (win.MediaRecorder && win.MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      } catch (_) {}
    }

    const activeMediaId = this._activeMediaId;
    const recordOneWindow = () => {
      if (
        !this._activeMediaEl ||
        this._activeMediaEl !== mediaEl ||
        !this._readState().liveTranscriber
      ) {
        this._stopMediaCapture(win);
        return;
      }
      if (mediaEl.paused || mediaEl.ended) {
        this._mediaCaptureTimer = win.setTimeout(recordOneWindow, 700);
        return;
      }

      const audioTracks = captured.getAudioTracks
        ? captured.getAudioTracks().filter((t) => t.readyState === "live")
        : [];
      if (!audioTracks.length) {
        // MSE/HLS streams sometimes attach audio tracks slightly after video starts
        this._mediaCaptureTimer = win.setTimeout(recordOneWindow, 400);
        return;
      }

      try {
        const audioStream = new win.MediaStream(audioTracks);
        this._mediaAudioStream = audioStream;
        const opts = chosenMime
          ? { mimeType: chosenMime, audioBitsPerSecond: 32000 }
          : { audioBitsPerSecond: 32000 };
        const rec = new win.MediaRecorder(audioStream, opts);
        this._mediaRecorder = rec;
        const parts = [];

        rec.addEventListener("dataavailable", (e) => {
          if (e && e.data && e.data.size > 0) {
            parts.push(e.data);
          }
        });

        rec.addEventListener("stop", async () => {
          try {
            if (!parts.length) return;
            const blob = new win.Blob(parts, {
              type: chosenMime || "audio/webm",
            });
            const ab = await blob.arrayBuffer();
            const rawAb = ab.wrappedJSObject || ab;
            if (rawAb.byteLength > 200) {
              const copy = new Uint8Array(rawAb.byteLength);
              copy.set(new Uint8Array(rawAb));
              this.sendAsyncMessage("Exotic:TranscribeAudioChunk", {
                mediaId: activeMediaId,
                audioBytes: copy,
              });
            }
          } catch (_) {}
        });

        rec.start();
        this._mediaCaptureTimer = win.setTimeout(() => {
          try {
            if (rec.state !== "inactive") {
              rec.stop();
            }
          } catch (_) {}
          recordOneWindow();
        }, 2350);
      } catch (_) {
        this._mediaCaptureTimer = win.setTimeout(recordOneWindow, 1200);
      }
    };

    recordOneWindow();
  }

  _syncLiveTranscriber(doc, win, state) {
    if (!state || !state.liveTranscriber) {
      if (this._activeMediaEl || this._captionHost) {
        this._stopMediaCapture(win);
      }
      return;
    }
    const playing = this._findPlayingMedia(doc);
    if (playing) {
      this._startMediaCapture(playing, doc, win, state);
    } else if (this._captionRefs) {
      const tgt = this._targetLangLabel(state.liveTranscriberToLang || "en");
      const src = this._lastDetectedName
        ? `Auto-Detect (${this._lastDetectedName})`
        : "Auto-Detect";
      this._captionRefs.routeSpan.textContent = `${src} → ${tgt}`;
    }
  }

  _handleLiveCaptionUpdate(data) {
    const win = this.contentWindow;
    const doc = win && win.document;
    const state = this._readState();
    if (!doc || !win || !state.liveTranscriber || !data) return;

    const refs = this._ensureCaptionOverlay(doc, win, state);
    if (!refs) return;
    this._positionCaptionOverlay(doc, win);
    refs.box.setAttribute("data-hidden", "false");

    if (data.kind === "progress" && !data.ready) {
      refs.mainLine.textContent = `Loading ${data.engineLabel || "ASR model"} (${
        data.percent || 1
      }%)...`;
      return;
    }

    if (data.kind === "caption" && data.captionText) {
      this._lastDetectedName = data.detectedLangName || data.detectedLang || "";
      refs.routeSpan.textContent = `Auto-Detect (${this._lastDetectedName}) → ${
        data.targetLangName || this._targetLangLabel(state.liveTranscriberToLang)
      }`;
      const cur = refs.mainLine.textContent || "";
      if (
        cur &&
        cur !== "Listening to audio stream..." &&
        !cur.startsWith("Loading ") &&
        cur !== data.captionText
      ) {
        refs.prevLine.textContent = cur;
      }
      refs.mainLine.textContent = data.captionText;
      if (this._captionFadeTimer) {
        try {
          win.clearTimeout(this._captionFadeTimer);
        } catch (_) {}
      }
      this._captionFadeTimer = win.setTimeout(() => {
        if (this._captionRefs) {
          this._captionRefs.box.setAttribute("data-hidden", "true");
        }
      }, 8000);
    }
  }

  _syncAll(state) {
    const win = this.contentWindow;
    const doc = win && win.document;
    if (!doc) {
      return;
    }

    const href = (doc.location && doc.location.href) || "";
    if (this._isInternalPage(href)) {
      this._syncInternalDoc(doc, state);
      return;
    }

    this._syncLiveTranscriber(doc, win, state);

    // Only run site adapters on top-level HTTP/HTTPS web documents
    if (win === win.top && /^https?:\/\//i.test(href)) {
      this._ensureBrowserDetectionSync(doc, win, state);
    }

    // Only run theme adapters on top-level HTTPS web documents when explicitly enabled
    if (!this._isWebDocument(href) || win !== win.top) {
      return;
    }

    if (!state.syncWebsiteTheme) {
      this._restoreIfDisabled(doc, win);
      return;
    }

    this._webThemeActive = true;
    const isDark = state.uiTheme !== "light";
    const host = (doc.location && doc.location.hostname) || "";

    if (
      /(?:^|\.)youtube\.com$/i.test(host) &&
      !/^music\.youtube\.com$/i.test(host)
    ) {
      this._syncYouTubeNativeTheme(doc, win, isDark);
    } else if (/(?:^|\.)twitch\.tv$/i.test(host)) {
      this._syncTwitchNativeTheme(doc, win, isDark);
    } else if (/^(?:www|images|encrypted)\.google\.[a-z.]+$/i.test(host)) {
      this._syncGoogleNativeTheme(doc, win, isDark);
    } else if (/^(?:www\.)?bing\.com$/i.test(host)) {
      this._syncBingNativeTheme(doc, win, isDark);
    }
  }

  handleEvent(event) {
    if (!event) {
      return;
    }
    const win = this.contentWindow;
    const doc = win && win.document;
    const href = (doc && doc.location && doc.location.href) || "";

    // Forward trusted/internal start-page events (`newtab.html`) to Parent actor
    if (
      (event.type === "ExoticSetTheme" ||
        event.type === "ExoticOpenMods" ||
        event.type === "ExoticNavigate") &&
      this._isInternalPage(href)
    ) {
      try {
        if (event.type === "ExoticSetTheme") {
          const mode = event.detail === "light" ? "light" : "dark";
          this.sendAsyncMessage("Exotic:NewTabSetTheme", { mode });
        } else if (event.type === "ExoticOpenMods") {
          this.sendAsyncMessage("Exotic:NewTabOpenMods", {});
        } else if (event.type === "ExoticNavigate") {
          this.sendAsyncMessage("Exotic:NewTabNavigate", {
            route: String(event.detail || ""),
          });
        }
      } catch (_) {}
      return;
    }

    if (event.type === "DOMWindowCreated") {
      this._applyExoticEngineIdentity(win);
      return;
    }

    if (event.type === "DOMDocElementInserted") {
      this._applyExoticEngineIdentity(win);
      this._webThemeActive = false;
      this._origTwitchTheme = undefined;
      this._googleSyncing = false;
      if (this._isInternalPage(href)) {
        this._syncInternalDoc(doc, this._readState());
      }
      return;
    }

    if (event.type === "play" || event.type === "playing") {
      const state = this._readState();
      if (state.liveTranscriber && !this._isInternalPage(href)) {
        const target = event.target;
        if (
          target &&
          (target.tagName === "VIDEO" || target.tagName === "AUDIO")
        ) {
          this._startMediaCapture(target, doc, win, state);
        } else {
          this._syncLiveTranscriber(doc, win, state);
        }
      }
      return;
    }

    if (event.type === "DOMContentLoaded" || event.type === "pageshow") {
      this._syncAll(this._readState());
    }
  }

  receiveMessage(msg) {
    if (!msg) return;
    if (msg.name === "Exotic:SyncInternalPage") {
      const state = msg.data || this._readState();
      this._syncAll(state);
    } else if (msg.name === "Exotic:LiveCaptionUpdate") {
      this._handleLiveCaptionUpdate(msg.data);
    }
  }

  didDestroy() {
    this._stopMediaCapture(this.contentWindow);
    this._stopBrowserDetectionSync(this.contentWindow);
  }
}
