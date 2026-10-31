/* ==========================================================================
   Exotic Browser — First-Launch Animated Setup & Onboarding Screens
   Full-window interactive welcome and setup flow launched automatically on
   the first start of a new Exotic profile (or anytime via exotic://welcome).
   ========================================================================== */

(function mountExoticWelcomeModule() {
  const win = window;
  const doc = win.document;
  if (!doc || win.__exoticWelcomeReady) return;
  win.__exoticWelcomeReady = true;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ctrl = win.__exoticWindowController;
  if (!ctrl) return;

  function h(tag, attrs, ...children) {
    const el = doc.createElementNS(XHTML_NS, tag);
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
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(
        typeof c === "string" || typeof c === "number"
          ? doc.createTextNode(String(c))
          : c
      );
    }
    return el;
  }

  function svgIcon(paths, size = 16, viewBox = "0 0 16 16") {
    const s = doc.createElementNS(SVG_NS, "svg");
    s.setAttribute("width", String(size));
    s.setAttribute("height", String(size));
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("fill", "none");
    for (const p of paths) {
      const el = doc.createElementNS(SVG_NS, p.tag || "path");
      for (const [k, v] of Object.entries(p)) {
        if (k !== "tag") el.setAttribute(k, String(v));
      }
      s.appendChild(el);
    }
    return s;
  }

  function makeExoticMark(size = 22) {
    return svgIcon(
      [
        { tag: "rect", x: 1, y: 1, width: 26, height: 26, rx: 6, fill: "var(--ex-invert-bg)" },
        { tag: "rect", x: 7, y: 6.8, width: 14, height: 2.6, fill: "var(--ex-invert-fg)" },
        { tag: "rect", x: 7, y: 12.7, width: 10.5, height: 2.6, fill: "var(--ex-invert-fg)" },
        { tag: "rect", x: 18.4, y: 12.7, width: 2.6, height: 2.6, fill: "var(--ex-invert-fg)" },
        { tag: "rect", x: 7, y: 18.6, width: 14, height: 2.6, fill: "var(--ex-invert-fg)" },
        { tag: "rect", x: 7, y: 6.8, width: 2.8, height: 8.5, fill: "var(--ex-invert-fg)" },
        { tag: "rect", x: 7, y: 16.8, width: 2.8, height: 4.4, fill: "var(--ex-invert-fg)" },
      ],
      size,
      "0 0 28 28"
    );
  }

  function getBoolPref(name, fallback = false) {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setBoolPref(name, val) {
    try {
      Services.prefs.setBoolPref(name, !!val);
    } catch (_) {}
  }

  function getCharPref(name, fallback = "") {
    try {
      return Services.prefs.getCharPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setCharPref(name, val) {
    try {
      Services.prefs.setCharPref(name, String(val));
    } catch (_) {}
  }

  const STEP_META = [
    { num: 1, label: "Import" },
    { num: 2, label: "Theme" },
    { num: 3, label: "Layout" },
    { num: 4, label: "Search" },
    { num: 5, label: "Shortcuts" },
  ];

  const SEARCH_CHOICES = [
    {
      id: "DuckDuckGo",
      title: "DuckDuckGo",
      desc: "Private web search without tracking.",
      placeholder: "Search with DuckDuckGo or enter address...",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8, r: 5.4, stroke: "currentColor", "stroke-width": "1.4" },
          { d: "M6.2 7.2h3.6M6.8 9.6h2.8", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
        ]),
    },
    {
      id: "Google",
      title: "Google",
      desc: "Standard Google web search.",
      placeholder: "Search with Google or enter address...",
      icon: () =>
        svgIcon([
          { d: "M12.6 8.2H8.2v2h2.5A3.2 3.2 0 1 1 8 4.8c.8 0 1.5.3 2.1.8l1.4-1.4A5.2 5.2 0 1 0 13.1 8.2h-.5Z", fill: "currentColor" },
        ]),
    },
    {
      id: "Bing",
      title: "Bing",
      desc: "Microsoft Bing web search.",
      placeholder: "Search with Bing or enter address...",
      icon: () =>
        svgIcon([
          { d: "M5 2.8v8.6l4.8 2.1 2.4-1.4V8.8L8.1 7.3l-.6 1.8 2.4 1v1.1L7 10V3.6L5 2.8Z", fill: "currentColor" },
        ]),
    },
    {
      id: "Wikipedia (en)",
      matchPrefix: "Wikipedia",
      title: "Wikipedia",
      desc: "Search encyclopedia articles directly.",
      placeholder: "Search Wikipedia or enter address...",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8, r: 5.5, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M2.7 8h10.6M8 2.5c1.8 1.6 1.8 9.4 0 11M8 2.5c-1.8 1.6-1.8 9.4 0 11", stroke: "currentColor", "stroke-width": "1.2" },
        ]),
    },
  ];

  const SHORTCUT_ITEMS = [
    {
      id: "search",
      title: "Search",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 7, cy: 7, r: 4.3, stroke: "currentColor", "stroke-width": "1.4" },
          { d: "M10.4 10.4L13.5 13.5", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
        ]),
    },
    {
      id: "github",
      title: "GitHub",
      icon: () =>
        svgIcon([
          { d: "M5.5 4.5L2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" },
        ]),
    },
    {
      id: "youtube",
      title: "YouTube",
      icon: () =>
        svgIcon([
          { tag: "rect", x: 2, y: 3.5, width: 12, height: 9, rx: 2.2, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M6.8 6.1L10.3 8 6.8 9.9V6.1Z", fill: "currentColor" },
        ]),
    },
    {
      id: "twitch",
      title: "Twitch",
      icon: () =>
        svgIcon([
          { d: "M3.5 2.5h9.5v6.8l-2.7 2.7H7.8l-2 2v-2H3.5V2.5Z", stroke: "currentColor", "stroke-width": "1.3", "stroke-linejoin": "round" },
          { d: "M7 5.2v2.8M9.8 5.2v2.8", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" },
        ]),
    },
    {
      id: "wikipedia",
      title: "Wikipedia",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8, r: 5.5, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M2.7 8h10.6M8 2.5c1.8 1.6 1.8 9.4 0 11M8 2.5c-1.8 1.6-1.8 9.4 0 11", stroke: "currentColor", "stroke-width": "1.2" },
        ]),
    },
    {
      id: "reddit",
      title: "Reddit",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8.8, r: 4.5, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 6.4, cy: 8.3, r: 0.8, fill: "currentColor" },
          { tag: "circle", cx: 9.6, cy: 8.3, r: 0.8, fill: "currentColor" },
          { d: "M8 4.3l1.2-2 2 .5", stroke: "currentColor", "stroke-width": "1.2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        ]),
    },
    {
      id: "discord",
      title: "Discord",
      icon: () =>
        svgIcon([
          { tag: "rect", x: 2.3, y: 3.5, width: 11.4, height: 8.5, rx: 3, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 6.2, cy: 7.8, r: 0.9, fill: "currentColor" },
          { tag: "circle", cx: 9.8, cy: 7.8, r: 0.9, fill: "currentColor" },
        ]),
    },
    {
      id: "mods",
      title: "Mods",
      icon: () =>
        svgIcon([
          { d: "M3 5h10M3 11h10", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
          { tag: "circle", cx: 6, cy: 5, r: 1.6, fill: "currentColor" },
          { tag: "circle", cx: 10, cy: 11, r: 1.6, fill: "currentColor" },
        ]),
    },
  ];

  async function applyDefaultSearchEngine(choice) {
    setCharPref("exotic.welcome.searchChoice", choice.title);
    try {
      if (!Services.search) return;
      if (!Services.search.isInitialized && Services.search.init) {
        await Services.search.init();
      }
      const engines = Services.search.getVisibleEngines
        ? await Services.search.getVisibleEngines()
        : await Services.search.getEngines();
      const target = (engines || []).find((e) => {
        const n = String((e && e.name) || "").toLowerCase();
        const pref = String(choice.matchPrefix || choice.title).toLowerCase();
        return n === choice.id.toLowerCase() || n.startsWith(pref);
      });
      if (target && Services.search.setDefault) {
        await Services.search.setDefault(
          target,
          Services.search.CHANGE_REASON_USER_SEARCHBAR || 1
        );
      }
    } catch (_) {}
  }

  function triggerImportMigration() {
    try {
      const { MigrationUtils } = ChromeUtils.importESModule(
        "resource:///modules/MigrationUtils.sys.mjs"
      );
      if (MigrationUtils && MigrationUtils.showMigrationWizard) {
        MigrationUtils.showMigrationWizard(win, {});
        return true;
      }
    } catch (_) {}
    return false;
  }

  function requestDefaultBrowser() {
    try {
      const { ShellService } = ChromeUtils.importESModule(
        "resource:///modules/ShellService.sys.mjs"
      );
      if (ShellService && ShellService.setDefaultBrowser) {
        ShellService.setDefaultBrowser(false, true);
        return true;
      }
    } catch (_) {}
    return false;
  }

  let activeOverlay = null;

  function openWelcomeExperience() {
    if (activeOverlay && activeOverlay.isConnected) return;

    let step = 0; // 0 = Hero Intro, 1..5 = Interactive Setup Steps
    let transitionDir = "next";
    let importMode = "fresh";
    let selectedSearch = getCharPref("exotic.welcome.searchChoice", "DuckDuckGo");
    let defaultBrowserRequested = false;

    const parseShortcuts = () =>
      getCharPref("exotic.ui.pinnedShortcuts", "search,github,wikipedia,mods")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((id) => SHORTCUT_ITEMS.some((it) => it.id === id))
        .slice(0, 4);

    let selectedPins = parseShortcuts();
    if (selectedPins.length === 0) {
      selectedPins = ["search", "github", "wikipedia", "mods"];
    }

    const getLayoutId = () => {
      if (getBoolPref("exotic.ui.compact", false)) return "autohide";
      return getCharPref("exotic.ui.sidebarMode", "expanded") === "collapsed"
        ? "collapsed"
        : "expanded";
    };

    const setLayoutId = (id) => {
      if (id === "autohide") {
        setBoolPref("exotic.ui.compact", true);
        setCharPref("exotic.ui.sidebarMode", "expanded");
      } else if (id === "collapsed") {
        setBoolPref("exotic.ui.compact", false);
        setCharPref("exotic.ui.sidebarMode", "collapsed");
      } else {
        setBoolPref("exotic.ui.compact", false);
        setCharPref("exotic.ui.sidebarMode", "expanded");
      }
      if (ctrl.syncMods) ctrl.syncMods();
    };

    doc.documentElement.setAttribute("data-exotic-welcome", "active");

    const stepperWrap = h("div", { className: "ew-stepper" });
      const DARK_THEMES = ["monochrome-dark", "ocean", "forest", "midnight"];
      const quickThemeBtn = h(
        "button",
        {
          className: "ew-theme-quick",
          type: "button",
          onClick: () => {
            ctrl.toggleTheme();
            renderStage(false);
          },
        },
        ctrl.getThemeVariant() === "light" ? "Dark" : "Light"
      );

    const titlebar = h(
      "div",
      { className: "ew-titlebar" },
      h(
        "div",
        { className: "ew-brand-mini" },
        makeExoticMark(18),
        h("span", null, "Exotic Setup")
      ),
      stepperWrap,
      h(
        "div",
        { className: "ew-win-actions" },
        quickThemeBtn,
        h(
          "button",
          {
            className: "ew-win-btn",
            type: "button",
            title: "Minimize",
            onClick: () => win.minimize && win.minimize(),
          },
          svgIcon([{ d: "M3.5 8h9", stroke: "currentColor", "stroke-width": "1.3" }], 13)
        ),
        h(
          "button",
          {
            className: "ew-win-btn",
            type: "button",
            title: "Maximize or restore",
            onClick: () => {
              if (win.windowState === win.STATE_MAXIMIZED) win.restore();
              else if (win.maximize) win.maximize();
            },
          },
          svgIcon(
            [{ tag: "rect", x: 3.5, y: 3.5, width: 9, height: 9, rx: 1, stroke: "currentColor", "stroke-width": "1.3" }],
            13
          )
        ),
        h(
          "button",
          {
            className: "ew-win-btn",
            type: "button",
            title: "Close",
            onClick: () => win.close && win.close(),
          },
          svgIcon(
            [{ d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" }],
            13
          )
        )
      )
    );

    const bodyHost = h("div", { className: "ew-body" });

    // Persistent Right-Side Live Animated Exotic Browser Preview (smoothly morphs across steps!)
    const pvPinsBox = h("div", { className: "ew-pv-pins" });
    const pvViewport = h("div", { className: "ew-pv-viewport" });
    const pvUrlLabel = h("div", { className: "ew-pv-url" }, "exotic://welcome");
    const pvTopStatus = h("span", null, "Split view · Auto-hide · Exotic Mods");
    const pvCaption = h("div", { className: "ew-preview-caption" }, "");

    const previewWindow = h(
      "div",
      { className: "ew-preview-window", "data-layout": getLayoutId(), "data-step": "1" },
      h(
        "div",
        { className: "ew-pv-sidebar" },
        h(
          "div",
          null,
          h(
            "div",
            { className: "ew-pv-top-brand" },
            makeExoticMark(14),
            h("span", { className: "ew-pv-brand-txt" }, "Exotic")
          ),
          pvUrlLabel,
          pvPinsBox,
          h(
            "div",
            { className: "ew-pv-tabs" },
            h(
              "div",
              { className: "ew-pv-tab", "data-active": "true" },
              h("span", { className: "ew-pv-dot" }),
              h("span", { className: "ew-pv-tab-txt" }, "Welcome")
            ),
            h(
              "div",
              { className: "ew-pv-tab" },
              h("span", { className: "ew-pv-dot" }),
              h("span", { className: "ew-pv-tab-txt" }, "YouTube")
            ),
            h(
              "div",
              { className: "ew-pv-tab" },
              h("span", { className: "ew-pv-dot" }),
              h("span", { className: "ew-pv-tab-txt" }, "Twitch")
            ),
            h(
              "div",
              { className: "ew-pv-tab" },
              h("span", { className: "ew-pv-dot" }),
              h("span", { className: "ew-pv-tab-txt" }, "GitHub")
            )
          )
        ),
        h(
          "div",
          { className: "ew-pv-foot" },
          h(
            "div",
            { className: "ew-pv-utils" },
            h("div", { className: "ew-pv-util-dot" }),
            h("div", { className: "ew-pv-util-dot" }),
            h("div", { className: "ew-pv-util-dot" }),
            h("div", { className: "ew-pv-util-dot" })
          ),
          h(
            "div",
            { className: "ew-pv-ws-row" },
            h("div", { className: "ew-pv-ws-pill", "data-active": "true" }, "Personal"),
            h("div", { className: "ew-pv-ws-pill" }, "Work"),
            h("div", { className: "ew-pv-ws-pill" }, "Research")
          )
        )
      ),
      h(
        "div",
        { className: "ew-pv-main" },
        h(
          "div",
          { className: "ew-pv-topbar" },
          pvTopStatus,
          h("span", null, "Exotic 159.0")
        ),
        pvViewport
      )
    );

    const leftCol = h("div", { className: "ew-left-col" });
    const rightCol = h("div", { className: "ew-right-col" }, previewWindow, pvCaption);
    const splitStage = h("div", { className: "ew-split" }, leftCol, rightCol);

    const overlay = h(
      "div",
      { id: "exotic-welcome-overlay", "data-step": "0" },
      titlebar,
      bodyHost
    );
    activeOverlay = overlay;

    const onExternalSync = () => {
      if (activeOverlay && activeOverlay.getAttribute("data-closing") !== "true") {
        renderStage(false);
      }
    };
    ctrl.registerWindowSync(onExternalSync);
    // The hooks set lives on the process-global controller: without this, closing
    // the window mid-wizard leaves the dead window's DOM + this closure wired
    // into every syncAllWindows() pass for the rest of the session.
    win.addEventListener(
      "unload",
      () => ctrl.unregisterWindowSync(onExternalSync),
      { once: true }
    );

    function finishWelcome() {
      if (!overlay || overlay.getAttribute("data-closing") === "true") return;
      ctrl.unregisterWindowSync(onExternalSync);
      setBoolPref("exotic.welcome.seen", true);
      try {
        Services.prefs.savePrefFile(null);
      } catch (_) {}
      if (ctrl.syncMods) ctrl.syncMods();

      doc.documentElement.setAttribute("data-exotic-welcome", "closing");
      overlay.setAttribute("data-closing", "true");
      win.removeEventListener("keydown", onKeyDown, true);

      win.setTimeout(() => {
        try {
          doc.documentElement.removeAttribute("data-exotic-welcome");
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          activeOverlay = null;
          if (ctrl.syncMods) ctrl.syncMods();
        } catch (_) {}
      }, 410);
    }

    function goToStep(nextStep) {
      if (nextStep < 0) nextStep = 0;
      if (nextStep > 5) {
        finishWelcome();
        return;
      }
      transitionDir = nextStep >= step ? "next" : "prev";
      step = nextStep;
      renderStage(true);
    }

    function onKeyDown(e) {
      if (!activeOverlay || activeOverlay.getAttribute("data-closing") === "true") return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finishWelcome();
      } else if (e.key === "Enter") {
        const tag = (e.target && e.target.tagName && e.target.tagName.toLowerCase()) || "";
        if (tag !== "button") {
          e.preventDefault();
          goToStep(step + 1);
        }
      }
    }
    win.addEventListener("keydown", onKeyDown, true);

    function updateLivePreview() {
      const themeMode = ctrl.getThemeMode();
      const layoutId = getLayoutId();
      const syncWeb = getBoolPref("exotic.mods.syncWebsiteTheme", false);
      const isDarkThemeMode = ["monochrome-dark", "ocean", "forest", "midnight"].includes(themeMode);
      const webDark = syncWeb ? isDarkThemeMode : false;

      previewWindow.setAttribute("data-layout", layoutId);
      previewWindow.setAttribute("data-step", String(step));
      pvViewport.setAttribute("data-web-dark", webDark ? "true" : "false");

      const pinObjs = selectedPins
        .map((id) => SHORTCUT_ITEMS.find((it) => it.id === id))
        .filter(Boolean);
      pvPinsBox.replaceChildren(
        ...pinObjs.map((p) => h("div", { className: "ew-pv-pin-cell", title: p.title }, p.icon()))
      );

      const searchObj =
        SEARCH_CHOICES.find((c) => c.title === selectedSearch) || SEARCH_CHOICES[0];

      const captions = {
        1:
          importMode === "import"
            ? "Importing saved bookmarks, history, and passwords into Exotic."
            : "Starting with a clean Exotic profile.",
        2: `${isDarkThemeMode ? "Dark" : "Light"} interface${
          syncWeb ? " · Website light and dark mode enabled" : ""
        }`,
        3:
          layoutId === "expanded"
            ? "Expanded sidebar — tabs, shortcuts, and workspaces always visible."
            : layoutId === "collapsed"
            ? "Compact sidebar — slim icon rail for wider web pages."
            : "Auto-hide sidebar — slides open when moving the cursor to the left edge.",
        4: `Default search engine: ${searchObj.title} (Ctrl + L floating search bar)`,
        5: `${pinObjs.length} pinned shortcuts selected for your sidebar.`,
      };
      pvCaption.textContent = captions[step] || "";
      pvUrlLabel.textContent =
        step === 4 ? searchObj.title.toLowerCase() + " search" : "exotic://welcome";

      const showFloatingSearch = step === 4;
      const vpNodes = [
        h(
          "div",
          null,
          h(
            "div",
            { className: "ew-pv-web-header" },
            h(
              "span",
              { className: "ew-pv-web-pill" },
              syncWeb
                ? `Website ${webDark ? "dark" : "light"} mode`
                : "Original website colors"
            ),
            h(
              "span",
              { style: { fontSize: "10.5px", opacity: "0.65" } },
              importMode === "import" && step === 1 ? "Bookmarks synced" : "Live preview"
            )
          ),
          h(
            "div",
            { className: "ew-pv-web-cards" },
            h(
              "div",
              { className: "ew-pv-web-card" },
              h("div", { className: "ew-pv-line-w" }),
              h("div", { className: "ew-pv-line-s" })
            ),
            h(
              "div",
              { className: "ew-pv-web-card", style: { animationDelay: "120ms" } },
              h("div", { className: "ew-pv-line-w" }),
              h("div", { className: "ew-pv-line-s" })
            )
          )
        ),
        showFloatingSearch
          ? h(
              "div",
              { className: "ew-pv-floatbar" },
              h("span", null, searchObj.placeholder),
              h("span", { style: { opacity: "0.6", fontSize: "10.5px" } }, "Ctrl + L")
            )
          : null,
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10.5px",
              opacity: "0.62",
            },
          },
          h("span", null, "Exotic Browser · Windows 11"),
          h("span", null, layoutId === "autohide" ? "Left-edge hover active" : "Split view ready")
        ),
      ].filter(Boolean);
      pvViewport.replaceChildren(...vpNodes);
    }

    function buildStepContent() {
      const themeMode = ctrl.getThemeMode();
      const layoutId = getLayoutId();
      const rounded = getBoolPref("exotic.ui.roundedContent", true);
      const sharp = getBoolPref("exotic.mods.sharpGeometry", false);

      if (step === 1) {
        return h(
          "div",
          null,
          h("div", { className: "ew-kicker" }, "Step 1 of 5"),
          h("h2", { className: "ew-step-title" }, "Import your browser data"),
          h(
            "p",
            { className: "ew-step-desc" },
            "Bring bookmarks, browsing history, and saved logins from another browser, or begin with a clean profile."
          ),
          h(
            "div",
            { className: "ew-cards-stack" },
            h(
              "button",
              {
                className: "ew-card",
                type: "button",
                "data-selected": importMode === "import" ? "true" : "false",
                onClick: () => {
                  importMode = "import";
                  triggerImportMigration();
                  renderStage(false);
                },
              },
              h(
                "div",
                { className: "ew-card-main" },
                h(
                  "span",
                  { className: "ew-card-icon" },
                  svgIcon([
                    { d: "M8 2.5v7.2M5.2 6.9L8 9.8l2.8-2.9M3 12.8h10", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" },
                  ])
                ),
                h(
                  "div",
                  null,
                  h("div", { className: "ew-card-title" }, "Import from another browser"),
                  h(
                    "div",
                    { className: "ew-card-sub" },
                    "Microsoft Edge, Google Chrome, Brave, Firefox, or HTML file."
                  )
                )
              )
            ),
            h(
              "button",
              {
                className: "ew-card",
                type: "button",
                "data-selected": importMode === "fresh" ? "true" : "false",
                onClick: () => {
                  importMode = "fresh";
                  renderStage(false);
                },
              },
              h(
                "div",
                { className: "ew-card-main" },
                h(
                  "span",
                  { className: "ew-card-icon" },
                  svgIcon([
                    { tag: "rect", x: 3, y: 3, width: 10, height: 10, rx: 2, stroke: "currentColor", "stroke-width": "1.4" },
                    { d: "M8 5.5v5M5.5 8h5", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
                  ])
                ),
                h(
                  "div",
                  null,
                  h("div", { className: "ew-card-title" }, "Start with a clean profile"),
                  h(
                    "div",
                    { className: "ew-card-sub" },
                    "Set up Exotic fresh. You can import bookmarks anytime later."
                  )
                )
              )
            )
          )
        );
      }

      if (step === 2) {
        const themeTiles = [
          { id: "monochrome-dark", label: "Monochrome Dark", sub: "Black (#000000)", variant: "dark", color: "#0a0a0a", page: "#000000" },
          { id: "monochrome-light", label: "Monochrome Light", sub: "White (#FFFFFF)", variant: "light", color: "#ededed", page: "#ffffff" },
          { id: "ocean", label: "Ocean", sub: "Deep teal · dark", variant: "dark", color: "#16324f", page: "#0f4c75" },
          { id: "sunset", label: "Sunset", sub: "Warm orange · light", variant: "light", color: "#ead2ac", page: "#fdfbfb" },
          { id: "forest", label: "Forest", sub: "Rich greens · dark", variant: "dark", color: "#2d6a4f", page: "#1b4332" },
          { id: "midnight", label: "Midnight", sub: "Navy slate · dark", variant: "dark", color: "#1e293b", page: "#0f172a" },
        ];
        return h(
          "div",
          null,
          h("div", { className: "ew-kicker" }, "Step 2 of 5"),
          h("h2", { className: "ew-step-title" }, "Choose your theme"),
          h(
            "p",
            { className: "ew-step-desc" },
            "Pick your Exotic interface theme. External websites keep their original colors untouched."
          ),
          h(
            "div",
            { className: "ew-grid-3" },
            ...themeTiles.map((t) =>
              h(
                "button",
                {
                  className: "ew-theme-tile",
                  type: "button",
                  "data-selected": themeMode === t.id ? "true" : "false",
                  onClick: () => {
                    ctrl.applyTheme(t.id);
                    renderStage(false);
                  },
                },
                h(
                  "div",
                  { className: "ew-theme-swatch", style: { backgroundColor: t.color } },
                  h("div", { className: "ew-swatch-rail", style: { backgroundColor: t.variant === "dark" ? "#1c1c1c" : "#d8d8d8" } }),
                  h("div", { className: "ew-swatch-page", style: { backgroundColor: t.page } })
                ),
                h("div", { className: "ew-card-title" }, t.label),
                h("div", { className: "ew-card-sub" }, t.sub + " · " + t.variant)
              )
            )
          ),
          h(
            "div",
            { className: "ew-cards-stack" },
            h(
              "button",
              {
                className: "ew-card",
                type: "button",
                onClick: () => {
                  setBoolPref("exotic.ui.roundedContent", !rounded);
                  if (ctrl.syncMods) ctrl.syncMods();
                  renderStage(false);
                },
              },
              h(
                "div",
                null,
                h("div", { className: "ew-card-title" }, "Rounded content frame"),
                h(
                  "div",
                  { className: "ew-card-sub" },
                  "Inset web pages inside a clean rounded viewport frame."
                )
              ),
              h(
                "span",
                { className: "ew-switch", "data-on": rounded ? "true" : "false" },
                h("span", { className: "ew-switch-knob" })
              )
            ),
            h(
              "button",
              {
                className: "ew-card",
                type: "button",
                onClick: () => {
                  setBoolPref("exotic.mods.sharpGeometry", !sharp);
                  if (ctrl.syncMods) ctrl.syncMods();
                  renderStage(false);
                },
              },
              h(
                "div",
                null,
                h("div", { className: "ew-card-title" }, "Square interface corners"),
                h(
                  "div",
                  { className: "ew-card-sub" },
                  "Use sharp 0px corners across the sidebar and buttons."
                )
              ),
              h(
                "span",
                { className: "ew-switch", "data-on": sharp ? "true" : "false" },
                h("span", { className: "ew-switch-knob" })
              )
            )
          )
        );
      }

      if (step === 3) {
        const layouts = [
          {
            id: "expanded",
            title: "Expanded sidebar",
            sub: "Shows navigation, address bar, pinned shortcuts, vertical tabs, and workspaces.",
            icon: () =>
              svgIcon([
                { tag: "rect", x: 2, y: 2.5, width: 12, height: 11, rx: 2, stroke: "currentColor", "stroke-width": "1.4" },
                { d: "M6.5 2.5v11", stroke: "currentColor", "stroke-width": "1.4" },
              ]),
          },
          {
            id: "collapsed",
            title: "Compact sidebar",
            sub: "Slim icon rail that keeps tabs accessible while giving web pages more width.",
            icon: () =>
              svgIcon([
                { tag: "rect", x: 2, y: 2.5, width: 12, height: 11, rx: 2, stroke: "currentColor", "stroke-width": "1.4" },
                { d: "M4.6 2.5v11", stroke: "currentColor", "stroke-width": "1.4" },
              ]),
          },
          {
            id: "autohide",
            title: "Auto-hide sidebar",
            sub: "Full-window page view. Move your cursor to the left edge to slide the sidebar open.",
            icon: () =>
              svgIcon([
                { tag: "rect", x: 2, y: 2.5, width: 12, height: 11, rx: 2, stroke: "currentColor", "stroke-width": "1.4" },
                { d: "M6.2 8h4.2M8.6 5.8L10.8 8l-2.2 2.2", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round", "stroke-linejoin": "round" },
              ]),
          },
        ];

        return h(
          "div",
          null,
          h("div", { className: "ew-kicker" }, "Step 3 of 5"),
          h("h2", { className: "ew-step-title" }, "Choose your sidebar layout"),
          h(
            "p",
            { className: "ew-step-desc" },
            "Pick how tabs and navigation appear next to your web pages. Switch anytime with Alt + V or Alt + B."
          ),
          h(
            "div",
            { className: "ew-cards-stack" },
            ...layouts.map((ly) =>
              h(
                "button",
                {
                  className: "ew-card",
                  type: "button",
                  "data-selected": layoutId === ly.id ? "true" : "false",
                  onClick: () => {
                    setLayoutId(ly.id);
                    renderStage(false);
                  },
                },
                h(
                  "div",
                  { className: "ew-card-main" },
                  h("span", { className: "ew-card-icon" }, ly.icon()),
                  h(
                    "div",
                    null,
                    h("div", { className: "ew-card-title" }, ly.title),
                    h("div", { className: "ew-card-sub" }, ly.sub)
                  )
                )
              )
            )
          )
        );
      }

      if (step === 4) {
        return h(
          "div",
          null,
          h("div", { className: "ew-kicker" }, "Step 4 of 5"),
          h("h2", { className: "ew-step-title" }, "Choose your search engine"),
          h(
            "p",
            { className: "ew-step-desc" },
            "Select the default search engine used in the sidebar address bar and floating Ctrl + L bar."
          ),
          h(
            "div",
            { className: "ew-cards-stack" },
            ...SEARCH_CHOICES.map((ch) =>
              h(
                "button",
                {
                  className: "ew-card",
                  type: "button",
                  "data-selected": selectedSearch === ch.title ? "true" : "false",
                  onClick: () => {
                    selectedSearch = ch.title;
                    applyDefaultSearchEngine(ch);
                    renderStage(false);
                  },
                },
                h(
                  "div",
                  { className: "ew-card-main" },
                  h("span", { className: "ew-card-icon" }, ch.icon()),
                  h(
                    "div",
                    null,
                    h("div", { className: "ew-card-title" }, ch.title),
                    h("div", { className: "ew-card-sub" }, ch.desc)
                  )
                )
              )
            )
          )
        );
      }

      // Step 5 — Pinned Shortcuts & Default Browser
      return h(
        "div",
        null,
        h("div", { className: "ew-kicker" }, "Step 5 of 5"),
        h("h2", { className: "ew-step-title" }, "Choose your pinned shortcuts"),
        h(
          "p",
          { className: "ew-step-desc" },
          "Pick up to 4 quick-access shortcuts for the top of your Exotic sidebar."
        ),
        h(
          "div",
          { className: "ew-grid-4" },
          ...SHORTCUT_ITEMS.map((item) => {
            const isSel = selectedPins.includes(item.id);
            return h(
              "button",
              {
                className: "ew-pin-choice",
                type: "button",
                "data-selected": isSel ? "true" : "false",
                onClick: () => {
                  if (isSel) {
                    if (selectedPins.length > 1) {
                      selectedPins = selectedPins.filter((x) => x !== item.id);
                    }
                  } else if (selectedPins.length < 4) {
                    selectedPins = [...selectedPins, item.id];
                  } else {
                    selectedPins = [...selectedPins.slice(1), item.id];
                  }
                  setCharPref("exotic.ui.pinnedShortcuts", selectedPins.join(","));
                  if (ctrl.syncMods) ctrl.syncMods();
                  renderStage(false);
                },
              },
              item.icon(),
              h("span", null, item.title)
            );
          })
        ),
        h(
          "button",
          {
            className: "ew-card",
            type: "button",
            "data-selected": defaultBrowserRequested ? "true" : "false",
            onClick: () => {
              requestDefaultBrowser();
              defaultBrowserRequested = true;
              renderStage(false);
            },
          },
          h(
            "div",
            { className: "ew-card-main" },
            h(
              "span",
              { className: "ew-card-icon" },
              svgIcon([
                { d: "M3.5 8.3l3 3 6-6.2", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
              ])
            ),
            h(
              "div",
              null,
              h(
                "div",
                { className: "ew-card-title" },
                defaultBrowserRequested
                  ? "Default browser prompt opened"
                  : "Set Exotic as default browser"
              ),
              h(
                "div",
                { className: "ew-card-sub" },
                "Open web links from other Windows 11 apps directly in Exotic."
              )
            )
          )
        )
      );
    }

    function renderStage(animateStepChange) {
      const mode = ctrl.getThemeMode();
      const DARK_THEMES = ["monochrome-dark", "ocean", "forest", "midnight"];
      quickThemeBtn.textContent = DARK_THEMES.includes(mode) ? "Light" : "Dark";
      overlay.setAttribute("data-step", String(step));

      stepperWrap.replaceChildren(
        ...STEP_META.map((s) =>
          h(
            "button",
            {
              className: "ew-step-pill",
              type: "button",
              "data-active": step === s.num ? "true" : "false",
              "data-done": step > s.num ? "true" : "false",
              onClick: () => goToStep(s.num),
            },
            `${s.num}. ${s.label}`
          )
        )
      );

      if (step === 0) {
        bodyHost.replaceChildren(
          h(
            "div",
            { className: "ew-hero" },
            h(
              "div",
              { className: "ew-hero-emblem-stage" },
              h("div", { className: "ew-hero-ring-outer" }),
              h("div", { className: "ew-hero-ring-inner" }),
              h("div", { className: "ew-hero-logo-wrap" }, makeExoticMark(52))
            ),
            h("h1", { className: "ew-hero-title" }, "Welcome to Exotic"),
            h(
              "p",
              { className: "ew-hero-sub" },
              "Set up your theme, sidebar layout, search engine, and shortcuts before you start browsing."
            ),
            h(
              "div",
              { className: "ew-hero-cta-row" },
              h(
                "button",
                {
                  className: "ew-btn-primary",
                  type: "button",
                  onClick: () => goToStep(1),
                },
                "Get started",
                svgIcon([
                  { d: "M3.5 8h9M8.8 4.2L12.6 8l-3.8 3.8", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
                ], 14)
              ),
              h(
                "button",
                {
                  className: "ew-btn-ghost",
                  type: "button",
                  onClick: () => finishWelcome(),
                },
                "Skip setup"
              )
            )
          )
        );
        return;
      }

      if (!splitStage.parentNode) {
        bodyHost.replaceChildren(splitStage);
      }

      const paneAttrs = { className: "ew-step-pane" };
      if (animateStepChange) {
        paneAttrs["data-dir"] = transitionDir;
      }

      leftCol.replaceChildren(
        h("div", paneAttrs, buildStepContent()),
        h(
          "div",
          { className: "ew-nav-footer" },
          h(
            "div",
            { className: "ew-nav-left" },
            h(
              "button",
              {
                className: "ew-btn-secondary",
                type: "button",
                onClick: () => goToStep(step - 1),
              },
              "Back"
            ),
            h(
              "button",
              {
                className: "ew-btn-ghost",
                type: "button",
                onClick: () => finishWelcome(),
              },
              "Skip"
            )
          ),
          h(
            "button",
            {
              className: "ew-btn-primary",
              type: "button",
              onClick: () => {
                if (step >= 5) finishWelcome();
                else goToStep(step + 1);
              },
            },
            step >= 5 ? "Start browsing" : "Continue",
            svgIcon([
              { d: "M3.5 8h9M8.8 4.2L12.6 8l-3.8 3.8", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
            ], 14)
          )
        )
      );

      updateLivePreview();
    }

    renderStage(true);
    const rootMount = doc.getElementById("main-window") || doc.documentElement;
    rootMount.appendChild(overlay);
  }

  win.__exoticOpenWelcome = () => openWelcomeExperience();

  // Automatically open Animated Setup & Onboarding Screens on very first launch!
  const isPrivateWin =
    doc.documentElement.getAttribute("privatebrowsingmode") === "temporary";
  const skipEnv = Services.env.get("EXOTIC_SKIP_WELCOME") === "1";
  if (!isPrivateWin && !skipEnv && !getBoolPref("exotic.welcome.seen", false)) {
    openWelcomeExperience();
  }
})();
