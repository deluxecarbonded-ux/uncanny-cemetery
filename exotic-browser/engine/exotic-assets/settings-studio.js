/* ==========================================================================
   Exotic Browser — Settings & Exotic Mods (about:preferences replacement)
   Clean, Normal Browser Settings · Non-Bold Regular Typography Throughout
   Strictly Zero Borders · Zero Outlines · Zero Gradients · Monochrome #000/#FFF
   ========================================================================== */

(function mountExoticSettings() {
  const win = window;
  const doc = win.document;
  if (!doc || doc.documentElement.getAttribute("exotic-studio-mounted") === "true") {
    return;
  }
  doc.documentElement.setAttribute("exotic-studio-mounted", "true");

  const HTML_NS = "http://www.w3.org/1999/xhtml";

  let PlacesUtils = null;
  let Downloads = null;
  try {
    PlacesUtils = ChromeUtils.importESModule(
      "resource://gre/modules/PlacesUtils.sys.mjs"
    ).PlacesUtils;
  } catch (_) {}
  try {
    Downloads = ChromeUtils.importESModule(
      "resource://gre/modules/Downloads.sys.mjs"
    ).Downloads;
  } catch (_) {}

  function getTopCtrl() {
    try {
      const topWin =
        (win.browsingContext &&
          win.browsingContext.topChromeWindow &&
          win.browsingContext.topChromeWindow.__exoticWindowController) ||
        Services.wm.getMostRecentWindow("navigator:browser")?.__exoticWindowController;
      return topWin || null;
    } catch (_) {
      return null;
    }
  }

  function syncAllWindows() {
    const c = getTopCtrl();
    // Guard *both* methods actually used: calling getThemeMode() unchecked on a
    // controller that only exposes applyTheme() would throw out of every
    // setPref*() call (syncAllWindows runs outside their try/catch).
    if (
      c &&
      typeof c.applyTheme === "function" &&
      typeof c.getThemeMode === "function"
    ) {
      c.applyTheme(c.getThemeMode());
    }
  }

  /**
   * Open a URL collected from Places (bookmarks / history).
   *
   * Those strings are untrusted (sync, import, web-provided), and this document
   * runs with the system principal, so `javascript:`, `data:`, `file:`, `jar:`
   * or any custom scheme handed straight to `window.open()` would be evaluated
   * in this privileged context (chrome XSS). Only web schemes are opened.
   */
  function openExternalUrl(rawUrl) {
    const url = String(rawUrl || "");
    if (!url) return;
    let scheme = "";
    try {
      scheme = Services.io.newURI(url).scheme;
    } catch (_) {
      console.error("[Exotic Settings] Ignoring unparsable URL:", url);
      return;
    }
    if (scheme !== "http" && scheme !== "https") {
      console.error("[Exotic Settings] Blocked non-web URL:", url);
      return;
    }
    try {
      win.open(url, "_blank");
    } catch (ex) {
      console.error("[Exotic Settings] Failed to open", url, ex);
    }
  }

  function getPrefBool(name, fallback = false) {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }
  function setPrefBool(name, val) {
    try {
      Services.prefs.setBoolPref(name, !!val);
    } catch (_) {}
    syncAllWindows();
  }
  function getPrefInt(name, fallback = 0) {
    try {
      return Services.prefs.getIntPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }
  function setPrefInt(name, val) {
    try {
      Services.prefs.setIntPref(name, Number(val));
    } catch (_) {}
    syncAllWindows();
  }
  function getPrefStr(name, fallback = "") {
    try {
      return Services.prefs.getCharPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }
  function setPrefStr(name, val) {
    try {
      Services.prefs.setStringPref(name, String(val));
    } catch (_) {}
    syncAllWindows();
  }

  function h(tag, attrs, ...children) {
    const el = doc.createElementNS(HTML_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "className") el.setAttribute("class", v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          el.setAttribute(k, String(v));
        }
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(
        typeof child === "string" || typeof child === "number"
          ? doc.createTextNode(String(child))
          : child
      );
    }
    return el;
  }

  function getTheme() {
    return getPrefStr("exotic.theme.mode", "monochrome-dark");
  }

  function getThemeVariant() {
    // Single source of truth: ask the browser controller (which reads the
    // `exotic.theme.variant` pref) so settings, the start page and the engine
    // never disagree about whether the current theme renders light or dark.
    try {
      const c = getTopCtrl();
      if (c && typeof c.getThemeVariant === "function") {
        const v = c.getThemeVariant();
        if (v === "dark" || v === "light") return v;
      }
    } catch (_) {}
    const theme = getTheme();
    const darkThemes = ["monochrome-dark", "ocean", "forest", "midnight"];
    const lightThemes = ["monochrome-light", "sunset"];
    if (darkThemes.includes(theme)) return "dark";
    if (lightThemes.includes(theme)) return "light";
    return "dark";
  }

  function applyThemeVariant(variant) {
    const c = getTopCtrl();
    if (c && typeof c.applyThemeVariant === "function") {
      c.applyThemeVariant(variant);
    } else {
      setPrefStr("exotic.theme.variant", variant);
    }
    syncDocTokens();
    renderActiveSection();
  }

  function syncDocTokens() {
    doc.documentElement.setAttribute("data-exotic-theme", getTheme());
    doc.documentElement.setAttribute("data-exotic-theme-variant", getThemeVariant());
    doc.documentElement.setAttribute(
      "data-exotic-sharp",
      getPrefBool("exotic.mods.sharpGeometry", false) ? "true" : "false"
    );
  }

  while (doc.documentElement.firstChild) {
    doc.documentElement.removeChild(doc.documentElement.firstChild);
  }

  const head = h("head", null, h("meta", { charset: "utf-8" }), h("title", null, "Exotic - Settings"));
  const styleEl = h(
    "style",
    null,
    `
    @font-face {
      font-family: "Exotic Sans";
      src: url("resource://exotic-assets/exotic-sans-regular.otf") format("opentype");
      font-weight: 100 900;
      font-style: normal;
    }

    :root,
    html[data-exotic-theme="monochrome-dark"] {
      --bg: #000000;
      --rail: #0a0a0a;
      --card: #131313;
      --card-2: #1c1c1c;
      --card-3: #272727;
      --fg: #ffffff;
      --fg-muted: #9c9c9c;
      --fg-subtle: #6b6b6b;
      --inv-bg: #ffffff;
      --inv-fg: #000000;
      --r: 12px;
      --r-sm: 8px;
      color-scheme: dark;
    }
    html[data-exotic-theme="monochrome-light"] {
      --bg: #ffffff;
      --rail: #f3f3f3;
      --card: #f0f0f0;
      --card-2: #e5e5e5;
      --card-3: #d6d6d6;
      --fg: #000000;
      --fg-muted: #545454;
      --fg-subtle: #7f7f7f;
      --inv-bg: #000000;
      --inv-fg: #ffffff;
      color-scheme: light;
    }
    html[data-exotic-theme="ocean"][data-exotic-theme-variant="dark"],
    html[data-exotic-theme="ocean"] {
      --bg: #0f4c75;
      --rail: #16324f;
      --card: #1e3a5f;
      --card-2: #2a4a7f;
      --card-3: #3a5a8f;
      --fg: #e8f1f5;
      --fg-muted: #a8c3d9;
      --fg-subtle: #6e8ea0;
      --inv-bg: #e8f1f5;
      --inv-fg: #0f4c75;
      --r: 12px;
      --r-sm: 8px;
      color-scheme: dark;
    }
    html[data-exotic-theme="ocean"][data-exotic-theme-variant="light"] {
      --bg: #e8f1f5;
      --rail: #c9e3ee;
      --card: #b8d8e6;
      --card-2: #c2dded;
      --card-3: #cfe6ef;
      --fg: #0f4c75;
      --fg-muted: #4a7a9e;
      --fg-subtle: #7a9fb3;
      --inv-bg: #0f4c75;
      --inv-fg: #e8f1f5;
      color-scheme: light;
    }
    html[data-exotic-theme="sunset"][data-exotic-theme-variant="light"],
    html[data-exotic-theme="sunset"] {
      --bg: #fdfbfb;
      --rail: #ead2ac;
      --card: #dec994;
      --card-2: #e5cb9e;
      --card-3: #ecd6ad;
      --fg: #c06c84;
      --fg-muted: #a05c6f;
      --fg-subtle: #b08e99;
      --inv-bg: #c06c84;
      --inv-fg: #fdfbfb;
      --r: 12px;
      --r-sm: 8px;
      color-scheme: light;
    }
    html[data-exotic-theme="sunset"][data-exotic-theme-variant="dark"] {
      --bg: #c06c84;
      --rail: #a64d79;
      --card: #9a3d6d;
      --card-2: #9e4370;
      --card-3: #aa507a;
      --fg: #fdfbfb;
      --fg-muted: #ead2ac;
      --fg-subtle: #c0a080;
      --inv-bg: #fdfbfb;
      --inv-fg: #c06c84;
      color-scheme: dark;
    }
    html[data-exotic-theme="forest"][data-exotic-theme-variant="dark"],
    html[data-exotic-theme="forest"] {
      --bg: #1b4332;
      --rail: #2d6a4f;
      --card: #3a845e;
      --card-2: #44bd32;
      --card-3: #4fa06c;
      --fg: #d8f3dc;
      --fg-muted: #a8d8b9;
      --fg-subtle: #7aa889;
      --inv-bg: #d8f3dc;
      --inv-fg: #1b4332;
      --r: 12px;
      --r-sm: 8px;
      color-scheme: dark;
    }
    html[data-exotic-theme="forest"][data-exotic-theme-variant="light"] {
      --bg: #d8f3dc;
      --rail: #b9e3ca;
      --card: #a9d8be;
      --card-2: #b2dcb8;
      --card-3: #bbe1c3;
      --fg: #1b4332;
      --fg-muted: #4a7a66;
      --fg-subtle: #7a9b89;
      --inv-bg: #1b4332;
      --inv-fg: #d8f3dc;
      color-scheme: light;
    }
    html[data-exotic-theme="midnight"][data-exotic-theme-variant="dark"],
    html[data-exotic-theme="midnight"] {
      --bg: #0f172a;
      --rail: #1e293b;
      --card: #334155;
      --card-2: #475569;
      --card-3: #5c6b84;
      --fg: #f8fafc;
      --fg-muted: #94a3b8;
      --fg-subtle: #64748b;
      --inv-bg: #f8fafc;
      --inv-fg: #0f172a;
      --r: 12px;
      --r-sm: 8px;
      color-scheme: dark;
    }
    html[data-exotic-theme="midnight"][data-exotic-theme-variant="light"] {
      --bg: #f8fafc;
      --rail: #e2e8f0;
      --card: #cbd5e1;
      --card-2: #d8dee6;
      --card-3: #e2e6ef;
      --fg: #0f172a;
      --fg-muted: #64748b;
      --fg-subtle: #94a3b8;
      --inv-bg: #0f172a;
      --inv-fg: #f8fafc;
      color-scheme: light;
    }

    html[data-exotic-sharp="true"] {
      --r: 0px !important;
      --r-sm: 0px !important;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: "Exotic Sans", "Segoe UI", Arial, sans-serif !important;
      font-weight: 400 !important;
      font-synthesis: none !important;
      letter-spacing: 0 !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      background-image: none !important;
    }

    html, body {
      width: 100%;
      height: 100%;
      background-color: var(--bg) !important;
      color: var(--fg) !important;
      overflow: hidden;
    }

    .es-shell {
      display: grid;
      grid-template-columns: 232px 1fr;
      width: 100vw;
      height: 100vh;
      background-color: var(--bg);
    }

    .es-rail {
      background-color: var(--rail);
      padding: 20px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
      overflow-y: auto;
    }

    .es-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 10px;
    }

    .es-brand-mark {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background-color: var(--inv-bg);
      color: var(--inv-fg);
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .es-brand-txt {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .es-brand-title {
      font-size: 13.5px;
    }

    .es-brand-sub {
      font-size: 11px;
      color: var(--fg-muted);
    }

    .es-filter {
      width: 100%;
      height: 34px;
      padding: 0 11px;
      border-radius: var(--r-sm);
      background-color: var(--card-2);
      color: var(--fg);
      font-size: 12.5px;
      margin-bottom: 8px;
    }

    .es-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .es-nav-btn {
      height: 34px;
      padding: 0 11px;
      border-radius: var(--r-sm);
      background-color: transparent;
      color: var(--fg-muted);
      font-size: 13px;
      display: flex;
      align-items: center;
      cursor: pointer;
      text-align: left;
    }

    .es-nav-btn:hover {
      background-color: var(--card-2);
      color: var(--fg);
    }

    .es-nav-btn[data-active="true"] {
      background-color: var(--inv-bg);
      color: var(--inv-fg);
    }

    .es-rail-foot {
      padding: 10px;
      border-radius: var(--r-sm);
      background-color: var(--card);
      font-size: 11.5px;
      color: var(--fg-muted);
    }

    .es-main {
      height: 100vh;
      overflow-y: auto;
      padding: 34px 48px 56px;
    }

    .es-wrap {
      max-width: 780px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .es-head {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding-bottom: 4px;
    }

    .es-h1 {
      font-size: 24px;
    }

    .es-desc {
      font-size: 13.5px;
      color: var(--fg-muted);
      line-height: 1.5;
    }

    .es-section-lbl {
      font-size: 12.5px;
      color: var(--fg-muted);
      margin-top: 6px;
    }

    .es-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .es-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .es-layout-card {
      padding: 14px;
      border-radius: var(--r);
      background-color: var(--card);
      color: var(--fg);
      display: flex;
      flex-direction: column;
      gap: 10px;
      cursor: pointer;
      text-align: left;
    }

    .es-layout-card:hover {
      background-color: var(--card-2);
    }

    .es-layout-card[data-active="true"] {
      background-color: var(--inv-bg);
      color: var(--inv-fg);
    }

    .es-wireframe {
      height: 70px;
      border-radius: var(--r-sm);
      background-color: var(--card-2);
      padding: 6px;
      display: flex;
      gap: 6px;
    }

    .es-layout-card[data-active="true"] .es-wireframe {
      background-color: var(--inv-fg);
    }

    .es-wf-rail {
      height: 100%;
      border-radius: 5px;
      background-color: var(--card-3);
    }

    .es-layout-card[data-active="true"] .es-wf-rail {
      background-color: var(--card-2);
    }

    .es-wf-island {
      flex: 1;
      height: 100%;
      border-radius: 6px;
      background-color: var(--bg);
    }

    .es-layout-title {
      font-size: 13.5px;
    }

    .es-layout-sub {
      font-size: 12px;
      opacity: 0.72;
      line-height: 1.45;
    }

    .es-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .es-row {
      padding: 15px 18px;
      border-radius: var(--r);
      background-color: var(--card);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .es-row-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .es-row-title {
      font-size: 13.5px;
    }

    .es-row-sub {
      font-size: 12.5px;
      color: var(--fg-muted);
      line-height: 1.45;
    }

    .es-switch {
      width: 42px;
      height: 24px;
      border-radius: 99px;
      background-color: var(--card-3);
      padding: 3px;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .es-switch[data-on="true"] {
      background-color: var(--inv-bg);
      justify-content: flex-end;
    }

    .es-switch-knob {
      width: 18px;
      height: 18px;
      border-radius: 99px;
      background-color: var(--fg);
    }

    .es-switch[data-on="true"] .es-switch-knob {
      background-color: var(--inv-fg);
    }

    .es-btn {
      height: 32px;
      padding: 0 14px;
      border-radius: var(--r-sm);
      background-color: var(--card-2);
      color: var(--fg);
      font-size: 12.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .es-btn:hover,
    .es-btn-inv {
      background-color: var(--inv-bg);
      color: var(--inv-fg);
    }

    .es-mod-card {
      padding: 16px 18px;
      border-radius: var(--r);
      background-color: var(--card);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
    }

    .es-mod-title {
      font-size: 14px;
    }

    .es-mod-desc {
      font-size: 12.5px;
      color: var(--fg-muted);
      line-height: 1.45;
      margin-top: 4px;
    }

    .es-mod-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 2px;
      gap: 10px;
    }

    .es-mod-card-wide {
      grid-column: 1 / -1;
    }

    .es-mod-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .es-mod-title-wrap {
      display: flex;
      align-items: center;
      gap: 9px;
      flex-wrap: wrap;
    }

    .es-special-label {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 10px;
      border-radius: 99px;
      background-color: var(--inv-bg);
      color: var(--inv-fg);
      font-size: 11px;
      letter-spacing: 0.02em;
    }

    .es-hw-body {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .es-hw-preview {
      width: 58px;
      height: 64px;
      border-radius: var(--r-sm);
      background-color: var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 160ms ease;
    }

    .es-hw-preview[data-disabled="true"] {
      opacity: 0.45;
    }

    .es-hw-active-line {
      font-size: 12px;
      color: var(--fg);
      margin-top: 6px;
    }

    .es-mod-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .es-choose-char-btn {
      height: 32px;
      padding: 0 14px;
      border-radius: var(--r-sm);
      background-color: var(--inv-bg);
      color: var(--inv-fg);
      font-size: 12.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: opacity 150ms ease, background-color 150ms ease, color 150ms ease;
    }

    .es-choose-char-btn:hover:not(:disabled) {
      opacity: 0.88;
    }

    .es-choose-char-btn:disabled,
    .es-choose-char-btn[data-disabled="true"] {
      background-color: var(--card-2);
      color: var(--fg-muted);
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .es-kbd {
      padding: 4px 10px;
      border-radius: 6px;
      background-color: var(--card-2);
      color: var(--fg);
      font-size: 12px;
    }

    .es-input {
      height: 36px;
      padding: 0 12px;
      border-radius: var(--r-sm);
      background-color: var(--card-2);
      color: var(--fg);
      font-size: 13px;
      flex: 1;
    }

    @media (max-width: 900px) {
      .es-shell {
        grid-template-columns: 168px 1fr;
      }
      .es-main {
        padding: 24px 22px 40px;
      }
      .es-grid-3,
      .es-grid-2 {
        grid-template-columns: 1fr;
      }
    }
    `
  );
  head.appendChild(styleEl);

  const SECTIONS = [
    { id: "appearance", label: "Appearance", uri: "exotic://settings" },
    { id: "general", label: "General", uri: "exotic://general" },
    { id: "mods", label: "Exotic Mods", uri: "exotic://mods" },
    { id: "search", label: "Search", uri: "exotic://search" },
    { id: "privacy", label: "Privacy & Security", uri: "exotic://privacy" },
    { id: "shortcuts", label: "Shortcuts", uri: "exotic://shortcuts" },
    { id: "bookmarks", label: "Bookmarks", uri: "exotic://bookmarks" },
    { id: "history", label: "History", uri: "exotic://history" },
    { id: "downloads", label: "Downloads", uri: "exotic://downloads" },
    { id: "flags", label: "About Exotic", uri: "exotic://about" },
  ];

  let activeSec = getPrefStr("exotic.studio.openSection", "appearance") || "appearance";
  if (activeSec === "workspace") activeSec = "general";
  if (!SECTIONS.some((s) => s.id === activeSec)) activeSec = "appearance";

  const navBox = h("nav", { className: "es-nav" });
  const mainWrap = h("div", { className: "es-wrap" });
  const filterInput = h("input", {
    className: "es-filter",
    type: "text",
    placeholder: "Search settings",
  });

  function makeSwitch(on, onToggle) {
    return h(
      "button",
      {
        className: "es-switch",
        type: "button",
        "data-on": on ? "true" : "false",
        onClick: () => onToggle(!on),
      },
      h("span", { className: "es-switch-knob" })
    );
  }

  function makeToggleRow(title, sub, prefName, fallback = false) {
    const val = getPrefBool(prefName, fallback);
    return h(
      "div",
      { className: "es-row" },
      h(
        "div",
        { className: "es-row-meta" },
        h("div", { className: "es-row-title" }, title),
        h("div", { className: "es-row-sub" }, sub)
      ),
      makeSwitch(val, (next) => {
        setPrefBool(prefName, next);
        syncDocTokens();
        renderActiveSection();
      })
    );
  }

  function renderNav() {
    const q = (filterInput.value || "").trim().toLowerCase();
    navBox.replaceChildren(
      ...SECTIONS.filter((s) => !q || s.label.toLowerCase().includes(q)).map((s) =>
        h(
          "button",
          {
            className: "es-nav-btn",
            type: "button",
            "data-active": s.id === activeSec ? "true" : "false",
            onClick: () => selectSection(s.id),
          },
          s.label
        )
      )
    );
  }

  filterInput.addEventListener("input", renderNav);

  // =========================================================================
  // SECTION RENDERERS
  // =========================================================================
  function renderAppearance() {
    const theme = getTheme();
    const sbMode = getPrefStr("exotic.ui.sidebarMode", "expanded");
    const compact = getPrefBool("exotic.ui.compact", false);
    const activeLayout = compact ? "compact" : sbMode === "collapsed" ? "collapsed" : "expanded";

    const layoutCard = (id, title, sub, railWidth, showRail, onSelect) =>
      h(
        "button",
        {
          className: "es-layout-card",
          type: "button",
          "data-active": activeLayout === id ? "true" : "false",
          onClick: () => {
            onSelect();
            syncDocTokens();
            renderActiveSection();
          },
        },
        h(
          "div",
          { className: "es-wireframe" },
          showRail && h("div", { className: "es-wf-rail", style: { width: railWidth } }),
          h("div", { className: "es-wf-island" })
        ),
        h("div", { className: "es-layout-title" }, title),
        h("div", { className: "es-layout-sub" }, sub)
      );

    const themeCard = (id, title, sub) =>
      h(
        "button",
        {
          className: "es-layout-card",
          type: "button",
          "data-active": theme === id ? "true" : "false",
          onClick: () => {
            const c = getTopCtrl();
            if (c) c.applyTheme(id);
            else setPrefStr("exotic.theme.mode", id);
            syncDocTokens();
            renderActiveSection();
          },
        },
        h("div", { className: "es-layout-title" }, title),
        h("div", { className: "es-layout-sub" }, sub)
      );

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Appearance"),
        h("p", { className: "es-desc" }, "Choose your sidebar layout, theme, and window corner style.")
      ),
      h("div", { className: "es-section-lbl" }, "Sidebar layout"),
      h(
        "div",
        { className: "es-grid-3" },
        layoutCard(
          "expanded",
          "Expanded sidebar",
          "Shows navigation, address bar, pinned shortcuts, tabs, and workspaces.",
          "28%",
          true,
          () => {
            setPrefBool("exotic.ui.compact", false);
            setPrefStr("exotic.ui.sidebarMode", "expanded");
          }
        ),
        layoutCard(
          "collapsed",
          "Compact sidebar",
          "Slim icon rail that gives web pages more horizontal space (Alt+V).",
          "12%",
          true,
          () => {
            setPrefBool("exotic.ui.compact", false);
            setPrefStr("exotic.ui.sidebarMode", "collapsed");
          }
        ),
        layoutCard(
          "compact",
          "Auto-hide sidebar",
          "Hides toolbars completely until you move the cursor to the left edge (Alt+B).",
          "0%",
          false,
          () => {
            setPrefBool("exotic.ui.compact", true);
          }
        )
      ),
      h("div", { className: "es-section-lbl" }, "Theme"),
      h(
        "div",
        { className: "es-grid-3" },
        themeCard("monochrome-dark", "Monochrome Dark", "Black (#000000) background · default"),
        themeCard("monochrome-light", "Monochrome Light", "White (#FFFFFF) background"),
        themeCard("ocean", "Ocean", "Deep teal & blue tones"),
        themeCard("sunset", "Sunset", "Warm orange & purple glow"),
        themeCard("forest", "Forest", "Rich greens & earth tones"),
        themeCard("midnight", "Midnight", "Navy blue & slate"),
      ),
      h("div", { className: "es-grid-2" },
        h(
          "button",
          {
            className: "es-layout-card",
            type: "button",
            "data-active": getThemeVariant() === "dark" ? "true" : "false",
            onClick: () => applyThemeVariant("dark"),
          },
          h("div", { className: "es-layout-title" }, "Dark variant"),
          h("div", { className: "es-layout-sub" }, "Dark style for current theme")
        ),
        h(
          "button",
          {
            className: "es-layout-card",
            type: "button",
            "data-active": getThemeVariant() === "light" ? "true" : "false",
            onClick: () => applyThemeVariant("light"),
          },
          h("div", { className: "es-layout-title" }, "Light variant"),
          h("div", { className: "es-layout-sub" }, "Light style for current theme")
        )
      ),
      h("div", { className: "es-section-lbl" }, "Interface"),
      h(
        "div",
        { className: "es-stack" },
        makeToggleRow(
          "Rounded content area",
          "Display web pages inside a subtly inset frame with rounded corners.",
          "exotic.ui.roundedContent",
          true
        ),
        makeToggleRow(
          "Square corners everywhere",
          "Use sharp 0px corners across all buttons, menus, and panels.",
          "exotic.mods.sharpGeometry",
          false
        )
      ),
    ];
  }

  function renderGeneral() {
    const curWs = getPrefStr("exotic.ui.workspace", "personal");
    const spaces = [
      { id: "personal", title: "Personal", sub: "Default workspace for everyday browsing (Alt+1)" },
      { id: "work", title: "Work", sub: "Separate tab list for projects and documentation (Alt+2)" },
      { id: "research", title: "Research", sub: "Dedicated tab list for reading and reference (Alt+3)" },
    ];

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "General"),
        h("p", { className: "es-desc" }, "Manage workspaces, startup behavior, and tab preferences.")
      ),
      h("div", { className: "es-section-lbl" }, "Active workspace"),
      h(
        "div",
        { className: "es-grid-3" },
        ...spaces.map((ws) =>
          h(
            "button",
            {
              className: "es-layout-card",
              type: "button",
              "data-active": curWs === ws.id ? "true" : "false",
              onClick: () => {
                const c = getTopCtrl();
                if (c && c.setWorkspace) c.setWorkspace(ws.id);
                else setPrefStr("exotic.ui.workspace", ws.id);
                renderActiveSection();
              },
            },
            h("div", { className: "es-layout-title" }, ws.title),
            h("div", { className: "es-layout-sub" }, ws.sub)
          )
        )
      ),
      h("div", { className: "es-section-lbl" }, "Startup and tabs"),
      h(
        "div",
        { className: "es-stack" },
        h(
          "div",
          { className: "es-row" },
          h(
            "div",
            { className: "es-row-meta" },
            h("div", { className: "es-row-title" }, "Open previous windows and tabs"),
            h("div", { className: "es-row-sub" }, "Restore your open tabs automatically when Exotic starts.")
          ),
          makeSwitch(getPrefInt("browser.startup.page", 1) === 3, (on) => {
            setPrefInt("browser.startup.page", on ? 3 : 1);
            renderActiveSection();
          })
        ),
        makeToggleRow(
          "Open new tabs next to the current tab",
          "Place newly opened tabs directly below the active tab in the sidebar.",
          "browser.tabs.insertRelatedAfterCurrent",
          true
        ),
        makeToggleRow(
          "Unload inactive tabs when memory is low",
          "Free memory automatically by suspending background tabs.",
          "browser.tabs.unloadOnLowMemory",
          true
        ),
        h(
          "div",
          { className: "es-row" },
          h(
            "div",
            { className: "es-row-meta" },
            h("div", { className: "es-row-title" }, "First-time setup guide"),
            h("div", { className: "es-row-sub" }, "Re-open Exotic's animated setup and onboarding screens.")
          ),
          h(
            "button",
            {
              className: "es-btn es-btn-inv",
              type: "button",
              onClick: () => {
                try {
                  const topWin = win.browsingContext && win.browsingContext.topChromeWindow;
                  if (topWin && typeof topWin.__exoticOpenWelcome === "function") {
                    topWin.__exoticOpenWelcome(true);
                  }
                } catch (_) {}
              },
            },
            "Open setup"
          )
        )
      ),
    ];
  }

  function getHalloweenAPI() {
    try {
      const topWin =
        (win.browsingContext && win.browsingContext.topChromeWindow) ||
        Services.wm.getMostRecentWindow("navigator:browser");
      if (topWin && topWin.__exoticHalloween) {
        return topWin.__exoticHalloween;
      }
      if (!win.__exoticHalloween) {
        Services.scriptloader.loadSubScript(
          "resource://exotic-assets/exotic-halloween.js",
          win
        );
      }
      return win.__exoticHalloween || null;
    } catch (_) {
      return null;
    }
  }

  function getTranscriberAPI() {
    try {
      const topWin =
        (win.browsingContext && win.browsingContext.topChromeWindow) ||
        Services.wm.getMostRecentWindow("navigator:browser");
      if (topWin && topWin.__exoticTranscriber) {
        return topWin.__exoticTranscriber;
      }
      if (!win.__exoticTranscriber) {
        Services.scriptloader.loadSubScript(
          "resource://exotic-assets/exotic-transcriber.js",
          win
        );
      }
      return win.__exoticTranscriber || null;
    } catch (_) {
      return null;
    }
  }

  function getOSAPI() {
    try {
      const topWin =
        (win.browsingContext && win.browsingContext.topChromeWindow) ||
        Services.wm.getMostRecentWindow("navigator:browser");
      if (topWin && topWin.__exoticOS) {
        return topWin.__exoticOS;
      }
      if (!win.__exoticOS) {
        Services.scriptloader.loadSubScript(
          "resource://exotic-assets/exotic-os.js",
          win
        );
      }
      return win.__exoticOS || null;
    } catch (_) {
      return null;
    }
  }

  function renderExoticMods() {
    const trApi = getTranscriberAPI();
    const trEnabled = getPrefBool("exotic.mods.liveTranscriber", false);
    const activeTargetLang = trApi
      ? trApi.getTargetLanguage()
      : { code: "en", name: "English", native: "English" };
    const activeEngine = trApi
      ? trApi.getActiveEngine()
      : { id: "parakeet-whisper", name: "Parakeet + Whisper Multilingual" };

    const trPreviewBox = h("div", {
      className: "es-hw-preview",
      "data-disabled": trEnabled ? "false" : "true",
    });
    if (trApi && typeof trApi.createTranscriberIconSVG === "function") {
      try {
        trPreviewBox.appendChild(trApi.createTranscriberIconSVG(doc, 40));
      } catch (_) {}
    }

    const transcriberCard = h(
      "div",
      { className: "es-mod-card es-mod-card-wide", id: "es-transcriber-mod-card" },
      h(
        "div",
        { className: "es-hw-body" },
        trPreviewBox,
        h(
          "div",
          { style: { flex: "1" } },
          h(
            "div",
            { className: "es-mod-head-row" },
            h(
              "div",
              { className: "es-mod-title-wrap" },
              h("span", { className: "es-mod-title" }, "Live Audio Transcriber"),
              h("span", { className: "es-special-label" }, "Open Source · Parakeet")
            )
          ),
          h(
            "div",
            { className: "es-mod-desc" },
            "Transcribes and live-captions videos and streams in real time using free, unlimited open-source speech recognition."
          ),
          h(
            "div",
            { className: "es-hw-active-line" },
            `Transcribe From: Auto-Detect (Real) · Transcribe To: ${activeTargetLang.name} (${activeEngine.name})`
          )
        )
      ),
      h(
        "div",
        { className: "es-mod-foot" },
        h("span", { className: "es-row-sub" }, trEnabled ? "Enabled" : "Disabled"),
        h(
          "div",
          { className: "es-mod-actions" },
          trEnabled
            ? h(
                "button",
                {
                  id: "es-choose-language-btn",
                  className: "es-choose-char-btn",
                  type: "button",
                  onClick: () => {
                    if (!getPrefBool("exotic.mods.liveTranscriber", false)) return;
                    const api = getTranscriberAPI();
                    if (api && typeof api.openModal === "function") {
                      api.openModal();
                    }
                  },
                },
                "Choose a Language"
              )
            : null,
          makeSwitch(trEnabled, (next) => {
            setPrefBool("exotic.mods.liveTranscriber", next);
            const c = getTopCtrl();
            if (c && c.syncMods) c.syncMods();
            syncDocTokens();
            renderActiveSection();
          })
        )
      )
    );

    const hwApi = getHalloweenAPI();
    const hwEnabled = getPrefBool("exotic.mods.halloweenCompanion", false);
    const activeChar = hwApi
      ? hwApi.getActiveCharacter()
      : { id: "jack-skellington", name: "Jack Skellington", source: "The Nightmare Before Christmas" };

    const hwPreviewBox = h("div", {
      className: "es-hw-preview",
      "data-disabled": hwEnabled ? "false" : "true",
    });
    if (hwApi && typeof hwApi.createCharacterSVGElement === "function") {
      try {
        hwPreviewBox.appendChild(hwApi.createCharacterSVGElement(doc, activeChar, 46));
      } catch (_) {}
    }

    const halloweenCard = h(
      "div",
      { className: "es-mod-card es-mod-card-wide", id: "es-halloween-mod-card" },
      h(
        "div",
        { className: "es-hw-body" },
        hwPreviewBox,
        h(
          "div",
          { style: { flex: "1" } },
          h(
            "div",
            { className: "es-mod-head-row" },
            h(
              "div",
              { className: "es-mod-title-wrap" },
              h("span", { className: "es-mod-title" }, "Halloween Characters"),
              h("span", { className: "es-special-label" }, "Halloween Special")
            )
          ),
          h(
            "div",
            { className: "es-mod-desc" },
            "Choose a character from Halloween shows and movies that you can freely move and drag throughout the browser."
          ),
          h(
            "div",
            { className: "es-hw-active-line" },
            `Selected character: ${activeChar.name} (${activeChar.source})`
          )
        )
      ),
      h(
        "div",
        { className: "es-mod-foot" },
        h("span", { className: "es-row-sub" }, hwEnabled ? "Enabled" : "Disabled"),
        h(
          "div",
          { className: "es-mod-actions" },
          h(
            "button",
            {
              id: "es-choose-character-btn",
              className: "es-choose-char-btn",
              type: "button",
              disabled: !hwEnabled,
              "data-disabled": hwEnabled ? "false" : "true",
              onClick: () => {
                if (!getPrefBool("exotic.mods.halloweenCompanion", false)) return;
                const api = getHalloweenAPI();
                if (api && typeof api.openModal === "function") {
                  api.openModal();
                }
              },
            },
            "Choose a Character"
          ),
          makeSwitch(hwEnabled, (next) => {
            setPrefBool("exotic.mods.halloweenCompanion", next);
            const c = getTopCtrl();
            if (c && c.syncMods) c.syncMods();
            syncDocTokens();
            renderActiveSection();
          })
        )
      )
    );

    const osApi = getOSAPI();
    const osEnabled = getPrefBool("exotic.mods.exos", false);
    const osDisk = osApi && typeof osApi.getDiskInfo === "function" ? osApi.getDiskInfo() : null;
    const fmtKiB = (b) =>
      (b || 0) < 1024 * 1024
        ? ((b || 0) / 1024).toFixed(1) + " KiB"
        : ((b || 0) / (1024 * 1024)).toFixed(1) + " MiB";

    const osPreviewBox = h("div", {
      className: "es-hw-preview",
      "data-disabled": osEnabled ? "false" : "true",
    });
    if (osApi && typeof osApi.createSealSVG === "function") {
      try {
        osPreviewBox.appendChild(osApi.createSealSVG(doc, 44));
      } catch (_) {}
    }

    const exosCard = h(
      "div",
      { className: "es-mod-card es-mod-card-wide", id: "es-exos-mod-card" },
      h(
        "div",
        { className: "es-hw-body" },
        osPreviewBox,
        h(
          "div",
          { style: { flex: "1" } },
          h(
            "div",
            { className: "es-mod-head-row" },
            h(
              "div",
              { className: "es-mod-title-wrap" },
              h("span", { className: "es-mod-title" }, "ExOS"),
              h("span", { className: "es-special-label" }, "Virtual Machine · Ryoku-style Linux")
            )
          ),
          h(
            "div",
            { className: "es-mod-desc" },
            "Boots a whole Ryoku-style desktop inside a display in the browser — launcher, draggable windows, terminal, file manager, text editor, system monitor and calculator — with every file stored on a virtual hard disk."
          ),
          h(
            "div",
            { className: "es-hw-active-line" },
            osDisk
              ? `Disk: ${osDisk.file} · ${fmtKiB(osDisk.used)} / ${fmtKiB(
                  osDisk.capacity
                )} used · ${osDisk.files} files · backend: ${osDisk.backend}`
              : `Disk: exos.vhd · ${fmtKiB(64 * 1024 * 1024)} capacity · not booted yet`
          )
        )
      ),
      h(
        "div",
        { className: "es-mod-foot" },
        h("span", { className: "es-row-sub" }, osEnabled ? "Enabled" : "Disabled"),
        h(
          "div",
          { className: "es-mod-actions" },
          h(
            "button",
            {
              id: "es-launch-exos-btn",
              className: "es-choose-char-btn",
              type: "button",
              onClick: () => {
                const api = getOSAPI();
                if (!api || typeof api.open !== "function") return;
                if (!getPrefBool("exotic.mods.exos", false)) {
                  setPrefBool("exotic.mods.exos", true);
                }
                const c = getTopCtrl();
                if (c && c.syncMods) c.syncMods();
                syncDocTokens();
                renderActiveSection();
                api.open();
              },
            },
            "Launch ExOS"
          ),
          makeSwitch(osEnabled, (next) => {
            setPrefBool("exotic.mods.exos", next);
            const c = getTopCtrl();
            if (c && c.syncMods) c.syncMods();
            syncDocTokens();
            renderActiveSection();
            if (!next) {
              const api = getOSAPI();
              if (api && typeof api.isActive === "function" && api.isActive()) api.close();
            }
          })
        )
      )
    );

    const MODS = [
      {
        pref: "exotic.mods.syncWebsiteTheme",
        title: "Website light and dark mode",
        desc: "Uses each website's own default light and dark mode when clicking the Light/Dark theme button.",
      },
      {
        pref: "exotic.mods.hideDiscordServers",
        title: "Hide Discord servers list",
        desc: "Hides and collapses the left servers sidebar on Discord so your channels list sits flush against the left edge.",
      },
      {
        pref: "exotic.mods.annoyanceZapper",
        title: "Hide cookie banners",
        desc: "Hides common cookie consent popups on websites without altering page images or layout.",
      },
      {
        pref: "exotic.mods.reducedMotion",
        title: "Reduce page animations",
        desc: "Requests reduced motion on websites while keeping all images, videos, and graphics intact.",
      },
      {
        pref: "exotic.mods.webrtcCloak",
        title: "WebRTC IP protection",
        desc: "Prevents websites from seeing local network IP addresses during WebRTC connections.",
      },
      {
        pref: "exotic.mods.monochromeWeb",
        title: "Grayscale web pages",
        desc: "Displays external websites in clean black and white when enabled.",
      },
      {
        pref: "exotic.mods.sharpGeometry",
        title: "Square interface corners",
        desc: "Uses 0px square corners across Exotic's sidebar, address bar, and content frame.",
      },
      {
        pref: "exotic.mods.distractionScrubber",
        title: "Hide feed distractions",
        desc: "Hides short-video carousels and floating support chat widgets on websites.",
      },
      {
        pref: "exotic.mods.ghostTabs",
        title: "Dim inactive tabs",
        desc: "Lowers the contrast of unselected tabs in the sidebar.",
      },
    ];

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Exotic Mods"),
        h(
          "p",
          { className: "es-desc" },
          "Built-in browser modifications that run directly in Exotic without third-party extensions."
        )
      ),
      h(
        "div",
        { className: "es-grid-2" },
        transcriberCard,
        halloweenCard,
        exosCard,
        ...MODS.map((m) => {
          const active = getPrefBool(m.pref, false);
          return h(
            "div",
            { className: "es-mod-card" },
            h(
              "div",
              null,
              h("div", { className: "es-mod-title" }, m.title),
              h("div", { className: "es-mod-desc" }, m.desc)
            ),
            h(
              "div",
              { className: "es-mod-foot" },
              h("span", { className: "es-row-sub" }, active ? "Enabled" : "Disabled"),
              makeSwitch(active, (next) => {
                setPrefBool(m.pref, next);
                const c = getTopCtrl();
                if (c && c.syncMods) c.syncMods();
                syncDocTokens();
                renderActiveSection();
              })
            )
          );
        })
      ),
    ];
  }

  function renderShortcuts() {
    const keys = [
      ["Open floating address bar", "Ctrl + L"],
      ["New tab", "Ctrl + T"],
      ["Split view", "Alt + S"],
      ["Auto-hide sidebar", "Alt + B"],
      ["Compact sidebar", "Alt + V"],
      ["Quick page preview", "Alt + G"],
      ["Switch workspace (Personal / Work / Research)", "Alt + 1 / 2 / 3"],
      ["Open Exotic Mods", "Alt + M"],
      ["Switch Dark / Light theme", "Alt + T"],
      ["Open Settings", "Alt + ,"],
      ["Find in page", "Ctrl + F"],
      ["Bookmark current page", "Ctrl + D"],
    ];

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Shortcuts"),
        h("p", { className: "es-desc" }, "Keyboard shortcuts for navigation, workspaces, and split view.")
      ),
      h(
        "div",
        { className: "es-stack" },
        ...keys.map(([label, kbd]) =>
          h(
            "div",
            { className: "es-row" },
            h("div", { className: "es-row-title" }, label),
            h("span", { className: "es-kbd" }, kbd)
          )
        )
      ),
    ];
  }

  function renderSearch() {
    let currentName = "DuckDuckGo";
    try {
      if (Services.search && Services.search.defaultEngine) {
        currentName = Services.search.defaultEngine.name;
      }
    } catch (_) {}

    const presets = ["DuckDuckGo", "Google", "Wikipedia (en)"];

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Search"),
        h("p", { className: "es-desc" }, "Choose your default search engine and address bar suggestions.")
      ),
      h("div", { className: "es-section-lbl" }, `Default search engine (${currentName})`),
      h(
        "div",
        { className: "es-grid-3" },
        ...presets.map((name) =>
          h(
            "button",
            {
              className: "es-layout-card",
              type: "button",
              "data-active": currentName.toLowerCase().includes(name.split(" ")[0].toLowerCase())
                ? "true"
                : "false",
              onClick: async () => {
                try {
                  const eng = Services.search.getEngineByName(name);
                  if (eng) await Services.search.setDefault(eng, Services.search.CHANGE_REASON_USER);
                } catch (_) {}
                renderActiveSection();
              },
            },
            h("div", { className: "es-layout-title" }, name),
            h("div", { className: "es-layout-sub" }, "Use " + name + " for searches from the address bar.")
          )
        )
      ),
      h("div", { className: "es-section-lbl" }, "Address bar suggestions"),
      h(
        "div",
        { className: "es-stack" },
        makeToggleRow(
          "Browsing history",
          "Show matching pages from your local browsing history.",
          "browser.urlbar.suggest.history",
          true
        ),
        makeToggleRow(
          "Bookmarks",
          "Show matching saved bookmarks.",
          "browser.urlbar.suggest.bookmark",
          true
        ),
        makeToggleRow(
          "Open tabs",
          "Offer to switch to tabs that are already open.",
          "browser.urlbar.suggest.openpage",
          true
        )
      ),
    ];
  }

  function renderPrivacy() {
    const clearStatus = h("span", { className: "es-row-sub" }, "");
    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Privacy & Security"),
        h(
          "p",
          { className: "es-desc" },
          "Anti-fingerprinting, zero data-point exposure, WebRTC leak prevention, and tracker blocking."
        )
      ),
      h(
        "div",
        { className: "es-stack" },
        makeToggleRow(
          "Ad, analytics & tracker blocking",
          "Block third-party ad networks, telemetry collectors, and tracking scripts while keeping CDN assets intact.",
          "exotic.shield.enabled",
          true
        ),
        makeToggleRow(
          "Anti-fingerprinting protection",
          "Randomize Canvas, WebGL, and Audio readback per session, normalize Math/Screen, and lock font enumeration.",
          "privacy.fingerprintingProtection",
          true
        ),
        makeToggleRow(
          "Mask WebGL hardware renderer",
          "Hide unmasked GPU vendor and graphics card model strings from websites.",
          "exotic.privacy.maskWebgl",
          true
        ),
        makeToggleRow(
          "WebRTC zero-IP-leak cloak",
          "Prevent WebRTC ICE candidates from exposing local LAN or public IP addresses.",
          "exotic.mods.webrtcCloak",
          true
        ),
        makeToggleRow(
          "HTTPS-First in Private Windows",
          "Automatically upgrade connections to HTTPS in Private Browsing windows.",
          "dom.security.https_first_pbm",
          true
        ),
        makeToggleRow(
          "Send Global Privacy Control & Do Not Track",
          "Transmit Sec-GPC and DNT headers instructing sites not to sell or track your data.",
          "privacy.globalprivacycontrol.enabled",
          true
        ),
        h(
          "div",
          { className: "es-row" },
          h(
            "div",
            { className: "es-row-meta" },
            h("div", { className: "es-row-title" }, "Clear browsing data"),
            h("div", { className: "es-row-sub" }, "Delete cached files, cookies, and browsing history."),
            clearStatus
          ),
          h(
            "button",
            {
              className: "es-btn es-btn-inv",
              type: "button",
              onClick: async () => {
                try {
                  Services.obs.notifyObservers(null, "browser:purge-session-history");
                  if (PlacesUtils) await PlacesUtils.history.clear();
                  clearStatus.textContent = "Browsing data cleared.";
                } catch (_) {}
              },
            },
            "Clear data"
          )
        )
      ),
    ];
  }

  function renderBookmarks() {
    const listWrap = h("div", { className: "es-stack" });
    const titleIn = h("input", { className: "es-input", placeholder: "Name" });
    const urlIn = h("input", { className: "es-input", placeholder: "https://example.com" });

    async function loadBookmarks() {
      listWrap.replaceChildren(h("div", { className: "es-row-sub" }, "Loading..."));
      if (!PlacesUtils) return;
      const items = [];
      try {
        await PlacesUtils.bookmarks.fetch({ parentGuid: PlacesUtils.bookmarks.unfiledGuid }, (bm) => {
          if (bm && bm.url) items.push(bm);
        });
        await PlacesUtils.bookmarks.fetch({ parentGuid: PlacesUtils.bookmarks.toolbarGuid }, (bm) => {
          if (bm && bm.url) items.push(bm);
        });
      } catch (_) {}

      if (items.length === 0) {
        listWrap.replaceChildren(
          h("div", { className: "es-row" }, h("div", { className: "es-row-sub" }, "No bookmarks saved yet."))
        );
        return;
      }

      listWrap.replaceChildren(
        ...items.map((bm) =>
          h(
            "div",
            { className: "es-row" },
            h(
              "div",
              { className: "es-row-meta" },
              h("div", { className: "es-row-title" }, bm.title || String(bm.url)),
              h("div", { className: "es-row-sub" }, String(bm.url))
            ),
            h(
              "div",
              { style: { display: "flex", gap: "6px" } },
              h(
                "button",
                {
                  className: "es-btn es-btn-inv",
                  type: "button",
                  onClick: () => openExternalUrl(bm.url),
                },
                "Open"
              ),
              h(
                "button",
                {
                  className: "es-btn",
                  type: "button",
                  onClick: async () => {
                    try {
                      await PlacesUtils.bookmarks.remove(bm.guid);
                    } catch (_) {}
                    loadBookmarks();
                  },
                },
                "Remove"
              )
            )
          )
        )
      );
    }

    loadBookmarks();

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Bookmarks"),
        h("p", { className: "es-desc" }, "View and manage your saved web pages.")
      ),
      h(
        "div",
        { className: "es-row", style: { gap: "8px" } },
        titleIn,
        urlIn,
        h(
          "button",
          {
            className: "es-btn es-btn-inv",
            type: "button",
            onClick: async () => {
              const rawU = (urlIn.value || "").trim();
              if (!rawU || !PlacesUtils) return;
              const finalU = /^https?:\/\//i.test(rawU) ? rawU : `https://${rawU}`;
              try {
                await PlacesUtils.bookmarks.insert({
                  parentGuid: PlacesUtils.bookmarks.unfiledGuid,
                  title: (titleIn.value || "").trim() || finalU,
                  url: finalU,
                });
                titleIn.value = "";
                urlIn.value = "";
                loadBookmarks();
              } catch (_) {}
            },
          },
          "Add"
        )
      ),
      listWrap,
    ];
  }

  function renderHistory() {
    const listWrap = h("div", { className: "es-stack" });

    function loadHistory() {
      const rows = [];
      try {
        if (PlacesUtils) {
          const q = PlacesUtils.history.getNewQuery();
          const o = PlacesUtils.history.getNewQueryOptions();
          o.maxResults = 30;
          o.sortingMode = o.SORT_BY_DATE_DESCENDING;
          const res = PlacesUtils.history.executeQuery(q, o);
          res.root.containerOpen = true;
          for (let i = 0; i < res.root.childCount; i++) {
            const n = res.root.getChild(i);
            if (n && n.uri && !n.uri.startsWith("about:")) {
              rows.push({ title: n.title || n.uri, uri: n.uri });
            }
          }
          res.root.containerOpen = false;
        }
      } catch (_) {}

      if (rows.length === 0) {
        listWrap.replaceChildren(
          h("div", { className: "es-row" }, h("div", { className: "es-row-sub" }, "No browsing history."))
        );
        return;
      }

      listWrap.replaceChildren(
        ...rows.map((r) =>
          h(
            "div",
            { className: "es-row" },
            h(
              "div",
              { className: "es-row-meta" },
              h("div", { className: "es-row-title" }, r.title),
              h("div", { className: "es-row-sub" }, r.uri)
            ),
            h(
              "button",
              {
                className: "es-btn",
                type: "button",
                onClick: () => openExternalUrl(r.uri),
              },
              "Open"
            )
          )
        )
      );
    }

    loadHistory();

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "History"),
        h("p", { className: "es-desc" }, "Pages you have visited recently.")
      ),
      h(
        "div",
        { className: "es-row" },
        h("div", { className: "es-row-title" }, "Clear browsing history"),
        h(
          "button",
          {
            className: "es-btn es-btn-inv",
            type: "button",
            onClick: async () => {
              try {
                if (PlacesUtils) await PlacesUtils.history.clear();
              } catch (_) {}
              loadHistory();
            },
          },
          "Clear history"
        )
      ),
      listWrap,
    ];
  }

  function renderDownloads() {
    const listWrap = h("div", { className: "es-stack" });
    (async () => {
      try {
        if (!Downloads) return;
        const list = await Downloads.getList(Downloads.ALL);
        const all = await list.getAll();
        if (!all || all.length === 0) {
          listWrap.replaceChildren(
            h("div", { className: "es-row" }, h("div", { className: "es-row-sub" }, "No recent downloads."))
          );
          return;
        }
        listWrap.replaceChildren(
          ...all.map((d) =>
            h(
              "div",
              { className: "es-row" },
              h(
                "div",
                { className: "es-row-meta" },
                h("div", { className: "es-row-title" }, (d.target && d.target.path) || "File"),
                h("div", { className: "es-row-sub" }, (d.source && d.source.url) || "")
              ),
              h("span", { className: "es-kbd" }, d.succeeded ? "Completed" : "In progress")
            )
          )
        );
      } catch (_) {}
    })();

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "Downloads"),
        h("p", { className: "es-desc" }, "Manage downloaded files and save locations.")
      ),
      makeToggleRow(
        "Save files to default Downloads folder automatically",
        "Turn off to choose a folder each time you download a file.",
        "browser.download.useDownloadDir",
        true
      ),
      listWrap,
    ];
  }

  function renderAboutAndFlags() {
    const flagQuery = h("input", {
      className: "es-input",
      placeholder: "Filter preferences (for example: exotic.)",
      value: "exotic.",
    });
    const flagRows = h("div", { className: "es-stack" });

    function loadFlags() {
      const prefix = (flagQuery.value || "").trim();
      let names = [];
      try {
        names = Services.prefs.getChildList(prefix || "exotic.").slice(0, 35);
      } catch (_) {}
      flagRows.replaceChildren(
        ...names.map((n) => {
          const t = Services.prefs.getPrefType(n);
          let valStr = "";
          if (t === Services.prefs.PREF_BOOL) valStr = String(getPrefBool(n));
          else if (t === Services.prefs.PREF_INT) valStr = String(getPrefInt(n));
          else valStr = getPrefStr(n);

          return h(
            "div",
            { className: "es-row" },
            h(
              "div",
              { className: "es-row-meta" },
              h("div", { className: "es-row-title" }, n),
              h("div", { className: "es-row-sub" }, valStr)
            ),
            t === Services.prefs.PREF_BOOL &&
              makeSwitch(getPrefBool(n), (next) => {
                setPrefBool(n, next);
                syncDocTokens();
                loadFlags();
              })
          );
        })
      );
    }

    flagQuery.addEventListener("input", loadFlags);
    loadFlags();

    return [
      h(
        "div",
        { className: "es-head" },
        h("h1", { className: "es-h1" }, "About Exotic"),
        h(
          "p",
          { className: "es-desc" },
          `Exotic Browser 159.0 (64-bit) · ${String(win.navigator.userAgent || "").replace(/Firefox\//gi, "Exotic/")}`
        )
      ),
      h("div", { className: "es-section-lbl" }, "Advanced preferences"),
      h("div", { className: "es-row" }, flagQuery),
      flagRows,
    ];
  }

  function renderActiveSection() {
    const meta = SECTIONS.find((s) => s.id === activeSec) || SECTIONS[0];
    doc.title = `Exotic - ${meta.label}`;
    win.__exoticVirtualURI = meta.uri;

    let nodes = [];
    if (activeSec === "appearance") nodes = renderAppearance();
    else if (activeSec === "general") nodes = renderGeneral();
    else if (activeSec === "mods") nodes = renderExoticMods();
    else if (activeSec === "shortcuts") nodes = renderShortcuts();
    else if (activeSec === "search") nodes = renderSearch();
    else if (activeSec === "privacy") nodes = renderPrivacy();
    else if (activeSec === "bookmarks") nodes = renderBookmarks();
    else if (activeSec === "history") nodes = renderHistory();
    else if (activeSec === "downloads") nodes = renderDownloads();
    else nodes = renderAboutAndFlags();

    mainWrap.replaceChildren(...nodes);
    renderNav();
  }

  function selectSection(id) {
    if (id === "workspace") id = "general";
    if (!SECTIONS.some((s) => s.id === id)) return;
    activeSec = id;
    setPrefStr("exotic.studio.openSection", id);
    renderActiveSection();
  }

  win.__exoticSelectSection = selectSection;

  const prefObserver = {
    observe(_subject, _topic, data) {
      if (data === "exotic.mods.halloweenX" || data === "exotic.mods.halloweenY") {
        return;
      }
      syncDocTokens();
      renderActiveSection();
    },
  };
  try {
    Services.prefs.addObserver("exotic.", prefObserver);
    win.addEventListener(
      "unload",
      () => {
        try {
          Services.prefs.removeObserver("exotic.", prefObserver);
        } catch (_) {}
      },
      { once: true }
    );
  } catch (_) {}

  const body = h(
    "body",
    null,
    h(
      "div",
      { id: "exotic-settings-root", className: "es-shell" },
      h(
        "aside",
        { className: "es-rail" },
        h(
          "div",
          null,
          h(
            "div",
            { className: "es-brand" },
            h("span", { className: "es-brand-mark" }, "E"),
            h(
              "div",
              { className: "es-brand-txt" },
              h("span", { className: "es-brand-title" }, "Exotic"),
              h("span", { className: "es-brand-sub" }, "Settings")
            )
          ),
          filterInput,
          navBox
        ),
        h("div", { className: "es-rail-foot" }, "Exotic Browser 159.0")
      ),
      h("main", { className: "es-main" }, mainWrap)
    )
  );

  doc.documentElement.appendChild(head);
  doc.documentElement.appendChild(body);
  syncDocTokens();
  renderActiveSection();
})();
