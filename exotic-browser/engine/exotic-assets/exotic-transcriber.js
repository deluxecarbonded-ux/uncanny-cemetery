/* ==========================================================================
   Exotic Browser — Live Audio Transcriber & Language Selector Modal
   Free, Unlimited Open-Source Video & Stream Live Captions (Parakeet + Whisper)
   Transcribe From: Auto-Detect (Real Acoustic Detection) -> Transcribe To: Any
   ========================================================================== */

(function initExoticTranscriber() {
  const win = window;
  const doc = win.document;
  if (!doc) return;

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PREF_ENABLED = "exotic.mods.liveTranscriber";
  const PREF_TO_LANG = "exotic.mods.liveTranscriberToLang";
  const PREF_ENGINE = "exotic.mods.liveTranscriberEngine";

  const TARGET_LANGUAGES = [
    { code: "en", name: "English", native: "English" },
    { code: "auto", name: "Same as Spoken", native: "Original Language" },
    { code: "es", name: "Spanish", native: "Español" },
    { code: "fr", name: "French", native: "Français" },
    { code: "de", name: "German", native: "Deutsch" },
    { code: "ja", name: "Japanese", native: "日本語" },
    { code: "ko", name: "Korean", native: "한국어" },
    { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
    { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文" },
    { code: "pt", name: "Portuguese", native: "Português" },
    { code: "it", name: "Italian", native: "Italiano" },
    { code: "ru", name: "Russian", native: "Русский" },
    { code: "ar", name: "Arabic", native: "العربية" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "nl", name: "Dutch", native: "Nederlands" },
    { code: "pl", name: "Polish", native: "Polski" },
    { code: "tr", name: "Turkish", native: "Türkçe" },
    { code: "uk", name: "Ukrainian", native: "Українська" },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
    { code: "th", name: "Thai", native: "ไทย" },
    { code: "sv", name: "Swedish", native: "Svenska" },
    { code: "cs", name: "Czech", native: "Čeština" },
    { code: "el", name: "Greek", native: "Ελληνικά" },
    { code: "ro", name: "Romanian", native: "Română" },
    { code: "hu", name: "Hungarian", native: "Magyar" },
    { code: "fi", name: "Finnish", native: "Suomi" },
    { code: "da", name: "Danish", native: "Dansk" },
    { code: "no", name: "Norwegian", native: "Norsk" },
    { code: "he", name: "Hebrew", native: "עברית" },
    { code: "ms", name: "Malay", native: "Bahasa Melayu" },
    { code: "tl", name: "Filipino", native: "Tagalog" },
  ];

  const ISO_LANGUAGE_NAMES = {
    en: "English", es: "Spanish", fr: "French", de: "German", ja: "Japanese",
    ko: "Korean", zh: "Chinese", "zh-cn": "Chinese (Simplified)", "zh-tw": "Chinese (Traditional)",
    pt: "Portuguese", it: "Italian", ru: "Russian", ar: "Arabic", hi: "Hindi",
    nl: "Dutch", pl: "Polish", tr: "Turkish", uk: "Ukrainian", vi: "Vietnamese",
    id: "Indonesian", th: "Thai", sv: "Swedish", cs: "Czech", el: "Greek",
    ro: "Romanian", hu: "Hungarian", fi: "Finnish", da: "Danish", no: "Norwegian",
    nn: "Norwegian", he: "Hebrew", ms: "Malay", tl: "Filipino", bg: "Bulgarian",
    hr: "Croatian", sk: "Slovak", sl: "Slovenian", et: "Estonian", lv: "Latvian",
    lt: "Lithuanian", sr: "Serbian", ca: "Catalan", eu: "Basque", gl: "Galician",
    fa: "Persian", ur: "Urdu", bn: "Bengali", ta: "Tamil", te: "Telugu",
    ml: "Malayalam", mr: "Marathi", gu: "Gujarati", pa: "Punjabi", kn: "Kannada",
    af: "Afrikaans", sw: "Swahili", cy: "Welsh", is: "Icelandic", ka: "Georgian",
    hy: "Armenian", az: "Azerbaijani", kk: "Kazakh", uz: "Uzbek", mn: "Mongolian",
  };

  const ENGINES = [
    {
      id: "parakeet-whisper",
      name: "Parakeet + Whisper Multilingual",
      badge: "Fast · 99 Languages",
      desc: "Instant real acoustic Auto-Detect & live captioning across 99 spoken languages.",
    },
    {
      id: "parakeet-tdt-v3",
      name: "NVIDIA Parakeet TDT 0.6B v3",
      badge: "High Precision · ONNX",
      desc: "Full 0.6B Conformer-TDT ONNX encoder + decoder via parakeet.js (cached locally).",
    },
  ];

  function getBoolPref(name, fallback = false) {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setBoolPref(name, val) {
    try {
      Services.prefs.setBoolPref(name, Boolean(val));
    } catch (_) {}
  }

  function getStrPref(name, fallback = "") {
    try {
      return Services.prefs.getCharPref(name, fallback) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setStrPref(name, val) {
    try {
      Services.prefs.setCharPref(name, String(val));
    } catch (_) {}
  }

  function getTargetLanguage() {
    const code = getStrPref(PREF_TO_LANG, "en");
    return TARGET_LANGUAGES.find((l) => l.code === code) || TARGET_LANGUAGES[0];
  }

  function getActiveEngine() {
    const id = getStrPref(PREF_ENGINE, "parakeet-whisper");
    return ENGINES.find((e) => e.id === id) || ENGINES[0];
  }

  function getLanguageDisplayName(code) {
    if (!code || code === "auto") return "Same as Spoken";
    const exact = TARGET_LANGUAGES.find((l) => l.code.toLowerCase() === String(code).toLowerCase());
    if (exact) return exact.name;
    const low = String(code).toLowerCase();
    return ISO_LANGUAGE_NAMES[low] || ISO_LANGUAGE_NAMES[low.split("-")[0]] || code.toUpperCase();
  }

  function createTranscriberIconSVG(targetDoc, size = 38) {
    const svg = targetDoc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    const mk = (tag, attrs) => {
      const el = targetDoc.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
      }
      return el;
    };
    svg.appendChild(
      mk("rect", {
        x: "5",
        y: "8",
        width: "38",
        height: "32",
        rx: "8",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2.2",
      })
    );
    // Live acoustic waveform bars
    const bars = [
      ["13", "18", "13", "24"],
      ["18", "14", "18", "28"],
      ["24", "12", "24", "30"],
      ["30", "15", "30", "27"],
      ["35", "18", "35", "24"],
    ];
    for (const [x1, y1, x2, y2] of bars) {
      svg.appendChild(
        mk("line", {
          x1,
          y1,
          x2,
          y2,
          stroke: "currentColor",
          "stroke-width": "2.4",
          "stroke-linecap": "round",
        })
      );
    }
    // Caption line indicator
    svg.appendChild(
      mk("line", {
        x1: "13",
        y1: "34",
        x2: "27",
        y2: "34",
        stroke: "currentColor",
        "stroke-width": "2.2",
        "stroke-linecap": "round",
      })
    );
    svg.appendChild(
      mk("line", {
        x1: "31",
        y1: "34",
        x2: "35",
        y2: "34",
        stroke: "currentColor",
        "stroke-width": "2.2",
        "stroke-linecap": "round",
      })
    );
    return svg;
  }

  function h(tag, attrs = {}, ...children) {
    const el = doc.createElementNS(HTML_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined) continue;
      if (k === "className") {
        el.setAttribute("class", v);
      } else if (k === "style" && typeof v === "object") {
        Object.assign(el.style, v);
      } else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        el.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      if (typeof c === "string" || typeof c === "number") {
        el.appendChild(doc.createTextNode(String(c)));
      } else {
        el.appendChild(c);
      }
    }
    return el;
  }

  // Expose helper API even when imported into settings-studio.js
  const api = {
    TARGET_LANGUAGES,
    ENGINES,
    getTargetLanguage,
    getActiveEngine,
    getLanguageDisplayName,
    createTranscriberIconSVG,
    openModal: () => {
      const topWin = Services.wm.getMostRecentWindow("navigator:browser");
      if (topWin && topWin !== win && topWin.__exoticTranscriber) {
        topWin.__exoticTranscriber.openModal();
      }
    },
    closeModal: () => {},
    enqueueAudioChunk: () => {},
  };

  const isBrowserChrome =
    win.location && win.location.href === "chrome://browser/content/browser.xhtml";
  if (!isBrowserChrome || doc.getElementById("exotic-transcriber-modal")) {
    if (!win.__exoticTranscriber) {
      win.__exoticTranscriber = api;
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // Persistent Profile Disk Cache + Background ASR Worker Runtime
  // ---------------------------------------------------------------------------
  let worker = null;
  let jobCounter = 0;
  let busyProcessing = false;
  let engineStatusText = "Ready · Local ONNX";
  const pendingJobs = new Map();
  const streamQueues = new Map(); // latest audio job per active video/stream
  const activeActors = new Set();

  async function sha256Hex(input) {
    const data = new TextEncoder().encode(String(input));
    const digest = await win.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function getCacheDir() {
    const dir = PathUtils.join(PathUtils.profileDir, "asr-models");
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    return dir;
  }

  async function handleWorkerCacheGet(reqId, key) {
    if (!worker) return;
    try {
      const dir = await getCacheDir();
      const hash = await sha256Hex(key);
      const path = PathUtils.join(dir, hash + ".bin");
      if (await IOUtils.exists(path)) {
        const u8 = await IOUtils.read(path);
        const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        worker.postMessage({ type: "cache-reply", reqId, hit: true, bytes: ab }, [ab]);
        return;
      }
    } catch (_) {}
    worker.postMessage({ type: "cache-reply", reqId, hit: false });
  }

  async function handleWorkerCachePut(reqId, key, ab) {
    if (!worker) return;
    try {
      if (ab && ab.byteLength > 0) {
        const dir = await getCacheDir();
        const hash = await sha256Hex(key);
        const path = PathUtils.join(dir, hash + ".bin");
        await IOUtils.write(path, new Uint8Array(ab), {
          tmpPath: path + ".tmp",
        });
      }
    } catch (_) {}
    worker.postMessage({ type: "cache-reply", reqId, ok: true });
  }

  function broadcastProgressToStreams(engineLabel, percent, ready) {
    engineStatusText = ready
      ? `${engineLabel} · Ready`
      : `Loading ${engineLabel} (${percent}%)...`;
    if (modalStatusSub) {
      modalStatusSub.textContent = engineStatusText;
    }
    for (const actor of Array.from(activeActors)) {
      try {
        actor.sendAsyncMessage("Exotic:LiveCaptionUpdate", {
          kind: "progress",
          engineLabel,
          percent,
          ready: Boolean(ready),
        });
      } catch (_) {
        activeActors.delete(actor);
      }
    }
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new win.Worker(
      "resource://exotic-assets/asr/transcriber-worker.mjs",
      { type: "module" }
    );
    const localModelEnv = Services.env.get("EXOTIC_ASR_LOCAL_MODEL_URL");
    if (localModelEnv) {
      worker.postMessage({ type: "set-local-model-base", url: localModelEnv });
    }
    worker.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === "cache-get") {
        handleWorkerCacheGet(msg.reqId, msg.key);
        return;
      }
      if (msg.type === "cache-put") {
        handleWorkerCachePut(msg.reqId, msg.key, msg.bytes);
        return;
      }
      if (msg.type === "model-progress") {
        broadcastProgressToStreams(msg.engineLabel, msg.percent, msg.ready);
        return;
      }
      if (msg.type === "transcribe-result") {
        const resolver = pendingJobs.get(msg.jobId);
        if (resolver) {
          pendingJobs.delete(msg.jobId);
          resolver(msg);
        }
      }
    };
    worker.onerror = (err) => {
      console.error("[Exotic Transcriber Worker Error]", err && err.message);
    };
    return worker;
  }

  let sharedDecodeCtx = null;
  async function decodeOpusChunkToPcm16k(u8Bytes) {
    const ab = u8Bytes.buffer.slice(
      u8Bytes.byteOffset,
      u8Bytes.byteOffset + u8Bytes.byteLength
    );
    if (!sharedDecodeCtx) {
      sharedDecodeCtx = new win.OfflineAudioContext(1, 1, 16000);
    }
    const decoded = await sharedDecodeCtx.decodeAudioData(ab);
    const ch = decoded.getChannelData(0);
    const maxLen = Math.min(ch.length, 16000 * 5);
    const pcm = new Float32Array(maxLen);
    pcm.set(ch.subarray(0, maxLen));
    return pcm;
  }

  function computeRmsEnergy(pcm) {
    if (!pcm || !pcm.length) return 0;
    let sumSq = 0;
    for (let i = 0; i < pcm.length; i++) {
      const s = pcm[i];
      sumSq += s * s;
    }
    return Math.sqrt(sumSq / pcm.length);
  }

  async function pumpStreamQueue() {
    if (busyProcessing || !getBoolPref(PREF_ENABLED, false)) {
      return;
    }
    const firstEntry = streamQueues.entries().next();
    if (firstEntry.done) return;
    const [streamKey, item] = firstEntry.value;
    streamQueues.delete(streamKey);

    busyProcessing = true;
    try {
      const { actorParent, audioBytes, mediaId } = item;
      activeActors.add(actorParent);
      const pcm = await decodeOpusChunkToPcm16k(audioBytes);
      const rms = computeRmsEnergy(pcm);
      // Skip pure silence so neural ASR never hallucinates on silent frames
      if (rms < 0.0022 || pcm.length < 2400) {
        busyProcessing = false;
        if (streamQueues.size > 0) pumpStreamQueue();
        return;
      }

      const target = getTargetLanguage();
      const eng = getActiveEngine();
      const wk = ensureWorker();
      const jobId = ++jobCounter;

      const res = await new Promise((resolve) => {
        pendingJobs.set(jobId, resolve);
        wk.postMessage(
          {
            type: "transcribe",
            jobId,
            pcm,
            targetLang: target.code,
            engine: eng.id,
            streamKey,
          },
          [pcm.buffer]
        );
      });

      if (res && res.ok && !res.empty && res.captionText) {
        const detectedName = getLanguageDisplayName(res.detectedLang);
        const targetName =
          target.code === "auto" ? detectedName : target.name;
        try {
          actorParent.sendAsyncMessage("Exotic:LiveCaptionUpdate", {
            kind: "caption",
            mediaId,
            captionText: res.captionText,
            sourceText: res.sourceText || "",
            detectedLang: res.detectedLang,
            detectedLangName: detectedName,
            targetLang: target.code,
            targetLangName: targetName,
            engineLabel: res.engineLabel || eng.name,
            ms: res.ms || 0,
          });
        } catch (_) {
          activeActors.delete(actorParent);
        }
      }
    } catch (err) {
      // Ignore transient short/corrupt WebM tail chunks when user scrubs/seeks video
    } finally {
      busyProcessing = false;
      if (streamQueues.size > 0) {
        win.setTimeout(pumpStreamQueue, 10);
      }
    }
  }

  function enqueueAudioChunk(actorParent, data) {
    if (!getBoolPref(PREF_ENABLED, false) || !actorParent || !data || !data.audioBytes) {
      return;
    }
    const bcId =
      (actorParent.browsingContext && actorParent.browsingContext.id) || 0;
    const streamKey = `${bcId}:${data.mediaId || "m0"}`;
    // Keep only the freshest chunk per stream so live streams stay real-time with zero lag
    streamQueues.set(streamKey, {
      actorParent,
      mediaId: data.mediaId || "m0",
      audioBytes: data.audioBytes,
    });
    pumpStreamQueue();
  }

  // ---------------------------------------------------------------------------
  // Language Selector Modal (#exotic-transcriber-modal)
  // ---------------------------------------------------------------------------
  let filterQuery = "";
  const modalStatusSub = h("span", { className: "et-modal-status" }, engineStatusText);
  const toValueSummary = h("div", { className: "et-route-val" }, "");
  const engineRowWrap = h("div", { className: "et-engine-grid" });
  const langGrid = h("div", { className: "et-lang-grid" });

  const searchInput = h("input", {
    className: "et-lang-search",
    type: "text",
    placeholder: "Search Transcribe To language (e.g. English, Spanish, French, Japanese)...",
    onInput: (e) => {
      filterQuery = String((e.target && e.target.value) || "").trim().toLowerCase();
      renderModalContent();
    },
  });

  const modalBackdrop = h(
    "div",
    {
      id: "exotic-transcriber-modal",
      "data-open": "false",
      onClick: (e) => {
        if (e.target === modalBackdrop) closeModal();
      },
    },
    h(
      "div",
      {
        className: "et-modal-card",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Choose Transcribe To Language",
      },
      h(
        "div",
        { className: "et-modal-head" },
        h(
          "div",
          { className: "et-modal-title-group" },
          h(
            "div",
            { className: "et-modal-badge-row" },
            h("span", { className: "et-pill" }, "Open Source · Free & Unlimited"),
            modalStatusSub
          ),
          h("h2", { className: "et-modal-title" }, "Choose a Language"),
          h(
            "p",
            { className: "et-modal-desc" },
            "Select the target language for live video and stream captions. Source speech is detected acoustically in real time."
          )
        ),
        h(
          "button",
          {
            className: "et-modal-close",
            type: "button",
            title: "Close (Esc)",
            onClick: () => closeModal(),
          },
          "✕"
        )
      ),
      // Transcribe From (Locked Auto-Detect) -> Transcribe To Summary Bar
      h(
        "div",
        { className: "et-route-bar" },
        h(
          "div",
          { className: "et-route-box", "data-locked": "true" },
          h("div", { className: "et-route-lbl" }, "Transcribe From"),
          h(
            "div",
            { className: "et-route-val-row" },
            h("span", { className: "et-live-dot" }),
            h("span", { className: "et-route-val" }, "Auto-Detect (Real)"),
            h("span", { className: "et-lock-tag" }, "Acoustic")
          )
        ),
        h("div", { className: "et-route-arrow" }, "→"),
        h(
          "div",
          { className: "et-route-box" },
          h("div", { className: "et-route-lbl" }, "Transcribe To"),
          toValueSummary
        )
      ),
      // Open-Source Speech Recognition Engine Switcher
      h(
        "div",
        { className: "et-engine-sec" },
        h("div", { className: "et-sec-lbl" }, "Open-Source Transcriber Model"),
        engineRowWrap
      ),
      // Search + Language Selector Grid
      h(
        "div",
        { className: "et-lang-sec" },
        h("div", { className: "et-sec-lbl" }, "Select Transcribe To Language"),
        searchInput,
        langGrid
      ),
      h(
        "div",
        { className: "et-modal-foot" },
        h(
          "span",
          { className: "et-foot-note" },
          "100% Free & Unlimited · Runs locally via ONNX Runtime Web (Parakeet.js + Whisper)"
        ),
        h(
          "button",
          {
            className: "et-btn-done",
            type: "button",
            onClick: () => closeModal(),
          },
          "Done"
        )
      )
    )
  );

  doc.documentElement.appendChild(modalBackdrop);

  function renderModalContent() {
    const activeTarget = getTargetLanguage();
    const activeEng = getActiveEngine();
    toValueSummary.textContent = `${activeTarget.name} (${activeTarget.native})`;

    engineRowWrap.replaceChildren(
      ...ENGINES.map((eng) => {
        const selected = eng.id === activeEng.id;
        return h(
          "button",
          {
            className: "et-engine-card",
            type: "button",
            "data-selected": selected ? "true" : "false",
            onClick: () => {
              setStrPref(PREF_ENGINE, eng.id);
              renderModalContent();
              if (win.__exoticWindowController && win.__exoticWindowController.syncMods) {
                win.__exoticWindowController.syncMods();
              }
            },
          },
          h(
            "div",
            { className: "et-engine-top" },
            h("span", { className: "et-engine-name" }, eng.name),
            h("span", { className: "et-engine-badge" }, eng.badge)
          ),
          h("div", { className: "et-engine-desc" }, eng.desc)
        );
      })
    );

    const filtered = TARGET_LANGUAGES.filter((l) => {
      if (!filterQuery) return true;
      return (
        l.name.toLowerCase().includes(filterQuery) ||
        l.native.toLowerCase().includes(filterQuery) ||
        l.code.toLowerCase().includes(filterQuery)
      );
    });

    langGrid.replaceChildren(
      ...filtered.map((lang) => {
        const isSelected = lang.code === activeTarget.code;
        return h(
          "button",
          {
            className: "et-lang-card",
            type: "button",
            "data-code": lang.code,
            "data-selected": isSelected ? "true" : "false",
            onClick: () => {
              setStrPref(PREF_TO_LANG, lang.code);
              renderModalContent();
              if (win.__exoticWindowController && win.__exoticWindowController.syncMods) {
                win.__exoticWindowController.syncMods();
              }
            },
          },
          h(
            "div",
            { className: "et-lang-main" },
            h("span", { className: "et-lang-name" }, lang.name),
            h("span", { className: "et-lang-native" }, lang.native)
          ),
          h(
            "span",
            { className: "et-lang-state" },
            isSelected ? "Selected" : lang.code === "auto" ? "Auto" : lang.code.toUpperCase()
          )
        );
      })
    );
  }

  function openModal() {
    filterQuery = "";
    searchInput.value = "";
    renderModalContent();
    modalBackdrop.setAttribute("data-open", "true");
    win.setTimeout(() => {
      try {
        searchInput.focus();
      } catch (_) {}
    }, 40);
  }

  function closeModal() {
    modalBackdrop.setAttribute("data-open", "false");
  }

  win.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalBackdrop.getAttribute("data-open") === "true") {
      e.stopPropagation();
      closeModal();
    }
  });

  const prefObserver = {
    observe(_subject, _topic, data) {
      if (data === PREF_ENABLED) {
        const on = getBoolPref(PREF_ENABLED, false);
        if (!on) {
          streamQueues.clear();
          closeModal();
        } else {
          // Warm up the selected open-source ONNX model proactively when enabled
          try {
            const wk = ensureWorker();
            wk.postMessage({ type: "warmup", engine: getActiveEngine().id });
          } catch (_) {}
        }
      }
      if (modalBackdrop.getAttribute("data-open") === "true") {
        renderModalContent();
      }
    },
  };

  try {
    Services.prefs.addObserver("exotic.mods.liveTranscriber", prefObserver);
  } catch (_) {}

  win.addEventListener(
    "unload",
    () => {
      try {
        Services.prefs.removeObserver("exotic.mods.liveTranscriber", prefObserver);
      } catch (_) {}
      try {
        if (worker) {
          worker.terminate();
          worker = null;
        }
      } catch (_) {}
    },
    { once: true }
  );

  if (getBoolPref(PREF_ENABLED, false)) {
    try {
      const wk = ensureWorker();
      wk.postMessage({ type: "warmup", engine: getActiveEngine().id });
    } catch (_) {}
  }

  api.openModal = openModal;
  api.closeModal = closeModal;
  api.enqueueAudioChunk = enqueueAudioChunk;
  win.__exoticTranscriber = api;
})();
