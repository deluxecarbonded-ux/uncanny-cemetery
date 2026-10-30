/* ==========================================================================
   Exotic Browser — Unified Sidebar, Split View & Floating Address Bar
   - Left Sidebar (Navigation, Address Bar, Pinned Shortcuts, Vertical Tabs,
     Workspaces & Quick Utilities)
   - Rounded Content Frame + Minimal Window Bar
   - Centered Floating Address Bar (Ctrl+L / Ctrl+T)
   - Side-by-Side Split View (Alt+S), Auto-Hide Sidebar (Alt+B), Preview (Alt+G)
   Non-Bold Regular Typography · Zero Borders · Zero Outlines · Zero Gradients
   ========================================================================== */

(function mountExoticShell() {
  const win = window;
  const doc = win.document;
  if (!doc || doc.documentElement.getAttribute("exotic-shell-mounted") === "true") {
    return;
  }
  doc.documentElement.setAttribute("exotic-shell-mounted", "true");
  doc.documentElement.setAttribute("titlemodifier", "Exotic");
  doc.documentElement.setAttribute("titlemenuseparator", " - ");

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ctrl = win.__exoticWindowController;
  if (!ctrl) return;

  let PlacesUtils = null;
  try {
    PlacesUtils = ChromeUtils.importESModule(
      "resource://gre/modules/PlacesUtils.sys.mjs"
    ).PlacesUtils;
  } catch (_) {}

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

  function svgIcon(paths, size = 15, viewBox = "0 0 16 16") {
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

  function makeExoticEmblem(size = 18) {
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

  const sanitizeTitle = (str) =>
    (str || "")
      .replace(/Mozilla\s+Firefox/gi, "Exotic")
      .replace(/Firefox/gi, "Exotic")
      .replace(/Mozilla/gi, "Exotic");

  const scrubWindowTitle = () => {
    if (doc.title && /Mozilla|Firefox/i.test(doc.title)) {
      doc.title = sanitizeTitle(doc.title);
    }
  };
  scrubWindowTitle();
  const titleNode = doc.querySelector("title");
  if (titleNode && win.MutationObserver) {
    new win.MutationObserver(scrubWindowTitle).observe(titleNode, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  const ctxMenu = doc.getElementById("contentAreaContextMenu");
  if (ctxMenu) {
    ctxMenu.addEventListener("popupshowing", () => {
      for (const id of [
        "context-pocket",
        "context-sendpagetodevice",
        "context-sep-sendpagetodevice",
        "context-sendlinktodevice",
        "context-sep-sendlinktodevice",
        "context-take-screenshot",
        "context-inspect-a11y",
        "context-ask-chat",
      ]) {
        const item = doc.getElementById(id);
        if (item) item.hidden = true;
      }
      for (const node of ctxMenu.querySelectorAll("menuitem, menu")) {
        const lbl = node.getAttribute("label") || "";
        if (/Firefox|Mozilla|Pocket/i.test(lbl)) {
          node.setAttribute("label", sanitizeTitle(lbl));
        }
      }
    });
  }

  // =========================================================================
  // WORKSPACES, PINNED SHORTCUTS, SPLIT VIEW & ROUTING
  // =========================================================================
  const WORKSPACES = [
    { id: "personal", name: "Personal" },
    { id: "work", name: "Work" },
    { id: "research", name: "Research" },
  ];

  const PINNED_CATALOG = {
    search: {
      id: "search",
      title: "Search",
      url: "https://duckduckgo.com/",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 7, cy: 7, r: 4.3, stroke: "currentColor", "stroke-width": "1.4" },
          { d: "M10.4 10.4L13.5 13.5", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
        ]),
    },
    github: {
      id: "github",
      title: "GitHub",
      url: "https://github.com/",
      icon: () =>
        svgIcon([
          { d: "M5.5 4.5L2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" },
        ]),
    },
    youtube: {
      id: "youtube",
      title: "YouTube",
      url: "https://www.youtube.com/",
      icon: () =>
        svgIcon([
          { tag: "rect", x: 2, y: 3.5, width: 12, height: 9, rx: 2.2, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M6.8 6.1L10.3 8 6.8 9.9V6.1Z", fill: "currentColor" },
        ]),
    },
    twitch: {
      id: "twitch",
      title: "Twitch",
      url: "https://www.twitch.tv/",
      icon: () =>
        svgIcon([
          { d: "M3.5 2.5h9.5v6.8l-2.7 2.7H7.8l-2 2v-2H3.5V2.5Z", stroke: "currentColor", "stroke-width": "1.3", "stroke-linejoin": "round" },
          { d: "M7 5.2v2.8M9.8 5.2v2.8", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" },
        ]),
    },
    wikipedia: {
      id: "wikipedia",
      title: "Wikipedia",
      url: "https://www.wikipedia.org/",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8, r: 5.5, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M2.7 8h10.6M8 2.5c1.8 1.6 1.8 9.4 0 11M8 2.5c-1.8 1.6-1.8 9.4 0 11", stroke: "currentColor", "stroke-width": "1.2" },
        ]),
    },
    reddit: {
      id: "reddit",
      title: "Reddit",
      url: "https://www.reddit.com/",
      icon: () =>
        svgIcon([
          { tag: "circle", cx: 8, cy: 8.8, r: 4.5, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 6.4, cy: 8.3, r: 0.8, fill: "currentColor" },
          { tag: "circle", cx: 9.6, cy: 8.3, r: 0.8, fill: "currentColor" },
          { d: "M8 4.3l1.2-2 2 .5", stroke: "currentColor", "stroke-width": "1.2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        ]),
    },
    discord: {
      id: "discord",
      title: "Discord",
      url: "https://discord.com/app",
      icon: () =>
        svgIcon([
          { tag: "rect", x: 2.3, y: 3.5, width: 11.4, height: 8.5, rx: 3, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 6.2, cy: 7.8, r: 0.9, fill: "currentColor" },
          { tag: "circle", cx: 9.8, cy: 7.8, r: 0.9, fill: "currentColor" },
        ]),
    },
    mods: {
      id: "mods",
      title: "Mods",
      route: "mods",
      icon: () =>
        svgIcon([
          { d: "M3 5h10M3 11h10", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
          { tag: "circle", cx: 6, cy: 5, r: 1.6, fill: "currentColor" },
          { tag: "circle", cx: 10, cy: 11, r: 1.6, fill: "currentColor" },
        ]),
    },
  };

  function getActivePinnedShortcuts() {
    let raw = "search,github,wikipedia,mods";
    try {
      raw = Services.prefs.getCharPref(
        "exotic.ui.pinnedShortcuts",
        "search,github,wikipedia,mods"
      );
    } catch (_) {}
    const ids = String(raw)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((id) => PINNED_CATALOG[id]);
    const list = ids.slice(0, 4).map((id) => PINNED_CATALOG[id]);
    if (list.length > 0) return list;
    return [
      PINNED_CATALOG.search,
      PINNED_CATALOG.github,
      PINNED_CATALOG.wikipedia,
      PINNED_CATALOG.mods,
    ];
  }

  let activeWorkspaceId = "personal";
  try {
    const savedWs = Services.prefs.getCharPref("exotic.ui.workspace", "personal");
    if (WORKSPACES.some((w) => w.id === savedWs)) activeWorkspaceId = savedWs;
  } catch (_) {}
  const lastTabByWorkspace = new Map();
  let splitViewActive = false;

  const EXOTIC_ROUTES = {
    "exotic://newtab": () => ctrl.openStartTab(),
    "exotic://start": () => ctrl.openStartTab(),
    "exotic://welcome": () =>
      typeof win.__exoticOpenWelcome === "function" && win.__exoticOpenWelcome(true),
    "exotic://settings": () => openSettingsSection("appearance"),
    "exotic://general": () => openSettingsSection("general"),
    "exotic://mods": () => openSettingsSection("mods"),
    "exotic://os": () => launchExOS(),
    "exotic://exos": () => launchExOS(),
    "exotic://shortcuts": () => openSettingsSection("shortcuts"),
    "exotic://search": () => openSettingsSection("search"),
    "exotic://privacy": () => openSettingsSection("privacy"),
    "exotic://bookmarks": () => openSettingsSection("bookmarks"),
    "exotic://history": () => openSettingsSection("history"),
    "exotic://downloads": () => openSettingsSection("downloads"),
    "exotic://about": () => openSettingsSection("flags"),
    "exotic://flags": () => openSettingsSection("flags"),
    "exotic://private": () =>
      win.OpenBrowserWindow && win.OpenBrowserWindow({ private: true }),
  };

  function getTabWorkspace(tab) {
    if (!tab) return "personal";
    if (!tab.__exoticWorkspace) {
      tab.__exoticWorkspace = activeWorkspaceId || "personal";
    }
    return tab.__exoticWorkspace;
  }

  function getWorkspaceTabs(wsId) {
    if (!win.gBrowser || !win.gBrowser.tabs) return [];
    return Array.from(win.gBrowser.tabs).filter(
      (t) => t.__exoticPinned || getTabWorkspace(t) === wsId
    );
  }

  function switchWorkspace(wsId) {
    if (!WORKSPACES.some((w) => w.id === wsId)) return;
    if (win.gBrowser && win.gBrowser.selectedTab) {
      lastTabByWorkspace.set(activeWorkspaceId, win.gBrowser.selectedTab);
    }
    activeWorkspaceId = wsId;
    ctrl.setWorkspace(wsId);

    const wsTabs = getWorkspaceTabs(wsId);
    if (wsTabs.length === 0) {
      ctrl.openStartTab();
      if (win.gBrowser && win.gBrowser.selectedTab) {
        win.gBrowser.selectedTab.__exoticWorkspace = wsId;
      }
    } else {
      const remembered = lastTabByWorkspace.get(wsId);
      if (remembered && wsTabs.includes(remembered)) {
        win.gBrowser.selectedTab = remembered;
      } else if (!wsTabs.includes(win.gBrowser.selectedTab)) {
        win.gBrowser.selectedTab = wsTabs[0];
      }
    }
    syncShellState();
  }

  function isSplitActive() {
    return !!(win.gBrowser && win.gBrowser.activeSplitView);
  }

  function toggleSplitView() {
    if (!win.gBrowser) return;
    try {
      if (win.gBrowser.activeSplitView) {
        win.gBrowser.activeSplitView.unsplitTabs("exotic_split");
        splitViewActive = false;
        syncShellState();
        return;
      }
      const wsTabs = getWorkspaceTabs(activeWorkspaceId);
      let partner = wsTabs.find((t) => t !== win.gBrowser.selectedTab);
      if (!partner) {
        const cur = win.gBrowser.selectedTab;
        ctrl.openStartTab();
        partner = win.gBrowser.selectedTab;
        partner.__exoticWorkspace = activeWorkspaceId;
        win.gBrowser.selectedTab = cur;
      }
      if (partner && typeof win.gBrowser.addTabSplitView === "function") {
        win.gBrowser.addTabSplitView([win.gBrowser.selectedTab, partner]);
        splitViewActive = true;
      }
    } catch (_) {}
    syncShellState();
  }

  function applySplitViewDOM() {
    splitViewActive = isSplitActive();
    doc.documentElement.setAttribute("exotic-split", splitViewActive ? "true" : "false");
  }

  function openSettingsSection(sectionId) {
    try {
      Services.prefs.setStringPref("exotic.studio.openSection", sectionId || "appearance");
      if (win.gBrowser && win.gBrowser.tabs) {
        for (const t of win.gBrowser.tabs) {
          const spec =
            t.linkedBrowser &&
            t.linkedBrowser.currentURI &&
            t.linkedBrowser.currentURI.spec;
          if (spec && spec.startsWith("about:preferences")) {
            t.__exoticWorkspace = activeWorkspaceId;
            win.gBrowser.selectedTab = t;
            const cw = t.linkedBrowser.contentWindow;
            if (cw && typeof cw.__exoticSelectSection === "function") {
              cw.__exoticSelectSection(sectionId || "appearance");
            }
            syncShellState();
            return;
          }
        }
      }
      const newTab = win.gBrowser.addTab("about:preferences", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      newTab.__exoticWorkspace = activeWorkspaceId;
      win.gBrowser.selectedTab = newTab;
    } catch (_) {}
  }

  function navigateCurrentOrOpen(rawInput, inNewTab = false) {
    const raw = (rawInput || "").trim();
    if (!raw) return;
    const lower = raw.toLowerCase();

    if (EXOTIC_ROUTES[lower]) {
      EXOTIC_ROUTES[lower]();
      return;
    }
    if (lower.startsWith("exotic://")) {
      const sub = lower.replace("exotic://", "").split("/")[0];
      if (EXOTIC_ROUTES[`exotic://${sub}`]) {
        EXOTIC_ROUTES[`exotic://${sub}`]();
        return;
      }
      openSettingsSection("appearance");
      return;
    }
    if (lower === "about:config") return openSettingsSection("flags");
    if (lower === "about:addons" || lower === "about:plugins") return openSettingsSection("mods");
    if (lower.startsWith("about:preferences")) return openSettingsSection("appearance");

    const isUrl =
      /^(https?:\/\/|file:\/\/|data:)/i.test(raw) ||
      (!raw.includes(" ") && /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(raw));

    let target = raw;
    if (isUrl && !/^(https?:\/\/|file:\/\/|data:)/i.test(raw)) {
      target = `https://${raw}`;
    } else if (!isUrl) {
      let engineUrl = "https://duckduckgo.com/?q=";
      try {
        if (Services.search && Services.search.defaultEngine) {
          const sub = Services.search.defaultEngine.getSubmission(raw);
          if (sub && sub.uri) target = sub.uri.spec;
          else target = engineUrl + encodeURIComponent(raw);
        } else {
          target = engineUrl + encodeURIComponent(raw);
        }
      } catch (_) {
        target = engineUrl + encodeURIComponent(raw);
      }
    }

    try {
      const sysPrin = Services.scriptSecurityManager.getSystemPrincipal();
      if (inNewTab) {
        const nt = win.gBrowser.addTab(target, { triggeringPrincipal: sysPrin });
        nt.__exoticWorkspace = activeWorkspaceId;
        win.gBrowser.selectedTab = nt;
      } else if (typeof win.gBrowser.selectedBrowser.fixupAndLoadURIString === "function") {
        win.gBrowser.selectedBrowser.fixupAndLoadURIString(target, {
          triggeringPrincipal: sysPrin,
        });
      } else {
        win.gBrowser.selectedBrowser.loadURI(Services.io.newURI(target), {
          triggeringPrincipal: sysPrin,
        });
      }
    } catch (_) {}
  }

  function getUrlMetaForBrowser(browser) {
    if (!browser || !browser.currentURI) {
      return { full: "", shortLabel: "Search or enter address", secure: false, isStart: true };
    }
    const spec = browser.currentURI.spec || "";
    if (
      spec.includes("exotic-assets/newtab.html") ||
      spec === "about:newtab" ||
      spec === "about:home" ||
      spec === "about:blank"
    ) {
      return {
        full: "",
        shortLabel: "exotic://newtab",
        secure: false,
        isStart: true,
      };
    }
    if (spec.startsWith("about:privatebrowsing")) {
      return { full: "exotic://private", shortLabel: "exotic://private", secure: true, isStart: false };
    }
    if (spec.startsWith("about:preferences")) {
      const cw = browser.contentWindow;
      const vUri = (cw && cw.__exoticVirtualURI) || "exotic://settings";
      return { full: vUri, shortLabel: vUri, secure: true, isStart: false };
    }
    if (spec.startsWith("https://") || spec.startsWith("http://")) {
      let host = spec;
      try {
        host = browser.currentURI.asciiHost.replace(/^www\./, "") || spec;
      } catch (_) {}
      return {
        full: spec,
        shortLabel: host,
        secure: spec.startsWith("https://"),
        isStart: false,
      };
    }
    return {
      full: spec.replace(/^about:/, "exotic://"),
      shortLabel: spec.replace(/^about:/, "exotic://"),
      secure: false,
      isStart: false,
    };
  }

  function getCleanTabTitle(tab) {
    const b = tab && tab.linkedBrowser;
    const spec = (b && b.currentURI && b.currentURI.spec) || "";
    if (spec.includes("exotic-assets/newtab.html") || spec === "about:newtab" || spec === "about:home") {
      return "New Tab";
    }
    if (spec.startsWith("about:privatebrowsing")) {
      return "Private Browsing";
    }
    if (spec.startsWith("about:preferences")) {
      const cw = b && b.contentWindow;
      if (cw && cw.document && cw.document.title) {
        return sanitizeTitle(cw.document.title).replace(/^Exotic\s*[-—]\s*/i, "");
      }
      return "Settings";
    }
    const raw = tab.getAttribute("label") || (b && b.contentTitle) || "New Tab";
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
      return raw;
    }
    return sanitizeTitle(raw);
  }

  const faviconPolarityCache = new Map();

  function classifyFaviconPolarity(img, src) {
    if (faviconPolarityCache.has(src)) {
      return faviconPolarityCache.get(src);
    }
    try {
      const c = doc.createElementNS(XHTML_NS, "canvas");
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext("2d");
      if (!ctx) return "color";
      ctx.clearRect(0, 0, 16, 16);
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      let transparentCount = 0;
      let visibleCount = 0;
      let minLum = 255;
      let maxLum = 0;
      let maxChroma = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 32) {
          transparentCount++;
          continue;
        }
        if (a < 96) continue;
        visibleCount++;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (chroma > maxChroma) maxChroma = chroma;
      }
      let polarity = "color";
      // Only adapt monochrome icons with transparent backgrounds (never solid tiles or colorful icons)
      if (transparentCount >= 24 && visibleCount >= 6 && maxChroma <= 42) {
        if (maxLum <= 68) {
          polarity = "dark";
        } else if (minLum >= 188) {
          polarity = "light";
        }
      }
      if (faviconPolarityCache.size > 256) {
        faviconPolarityCache.clear();
      }
      faviconPolarityCache.set(src, polarity);
      return polarity;
    } catch (_) {
      return "color";
    }
  }

  function makeDefaultTabSvg() {
    return svgIcon(
      [
        { tag: "rect", x: 2.5, y: 3, width: 11, height: 10, rx: 2.2, stroke: "currentColor", "stroke-width": "1.3" },
        { d: "M2.5 6h11", stroke: "currentColor", "stroke-width": "1.2" },
      ],
      14
    );
  }

  function makeTabIcon(tab) {
    const b = tab && tab.linkedBrowser;
    const spec = (b && b.currentURI && b.currentURI.spec) || "";
    if (spec.startsWith("about:preferences")) {
      return svgIcon(
        [
          { tag: "circle", cx: 8, cy: 8, r: 2.2, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 8, cy: 8, r: 5.5, stroke: "currentColor", "stroke-width": "1.2", "stroke-dasharray": "2.2 1.8" },
        ],
        14
      );
    }
    if (spec.startsWith("about:privatebrowsing")) {
      return svgIcon(
        [
          { d: "M2.5 8c1.4-2.8 3.5-4 5.5-4s4.1 1.2 5.5 4c-1.4 2.8-3.5 4-5.5 4S3.9 10.8 2.5 8Z", stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 8, cy: 8, r: 1.6, fill: "currentColor" },
        ],
        14
      );
    }
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
      const fav = tab && tab.getAttribute("image");
      if (fav && !fav.startsWith("chrome://")) {
        const img = doc.createElementNS(XHTML_NS, "img");
        img.setAttribute("class", "ex-tab-favicon");
        img.setAttribute("src", fav);
        img.setAttribute("width", "14");
        img.setAttribute("height", "14");
        img.setAttribute("alt", "");
        if (faviconPolarityCache.has(fav)) {
          img.setAttribute("data-mono-polarity", faviconPolarityCache.get(fav));
        } else {
          img.addEventListener(
            "load",
            () => {
              img.setAttribute(
                "data-mono-polarity",
                classifyFaviconPolarity(img, fav)
              );
            },
            { once: true }
          );
        }
        img.addEventListener(
          "error",
          () => {
            const parent = img.parentNode;
            if (parent) {
              parent.replaceChildren(makeDefaultTabSvg());
            }
          },
          { once: true }
        );
        return img;
      }
    }
    return makeDefaultTabSvg();
  }

  win.__exoticOpenSettingsSection = (sec) => openSettingsSection(sec);
  win.__exoticNavigateRoute = (route) => navigateCurrentOrOpen(String(route || ""));

  win.addEventListener(
    "ExoticSetTheme",
    (e) => {
      if (e && (e.detail === "light" || e.detail === "dark")) ctrl.applyTheme(e.detail);
    },
    true,
    true
  );
  win.addEventListener("ExoticOpenMods", () => openSettingsSection("mods"), true, true);
  win.addEventListener(
    "ExoticNavigate",
    (e) => {
      if (e && e.detail) navigateCurrentOrOpen(String(e.detail));
    },
    true,
    true
  );

  // =========================================================================
  // 1. UNIFIED LEFT SIDEBAR (#exotic-sidebar)
  // =========================================================================
  const backBtn = h(
    "button",
    {
      className: "ex-icon-btn",
      title: "Back (Alt+Left)",
      onClick: () => win.gBrowser && win.gBrowser.canGoBack && win.gBrowser.goBack(),
    },
    svgIcon([
      { d: "M10 3.5L5.5 8 10 12.5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
    ])
  );

  const fwdBtn = h(
    "button",
    {
      className: "ex-icon-btn",
      title: "Forward (Alt+Right)",
      onClick: () => win.gBrowser && win.gBrowser.canGoForward && win.gBrowser.goForward(),
    },
    svgIcon([
      { d: "M6 3.5L10.5 8 6 12.5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
    ])
  );

  let isTabBusy = false;
  const reloadIconWrap = h("span", { style: { display: "inline-flex" } });
  const reloadBtn = h(
    "button",
    {
      className: "ex-icon-btn",
      title: "Reload (Ctrl+R)",
      onClick: () => {
        if (!win.gBrowser) return;
        if (isTabBusy) win.gBrowser.stop();
        else win.gBrowser.reload();
      },
    },
    reloadIconWrap
  );

  const railCollapseBtn = h(
    "button",
    {
      className: "ex-icon-btn",
      title: "Toggle compact sidebar (Alt+V)",
      onClick: () => ctrl.toggleSidebarMode(),
    },
    svgIcon([
      { tag: "rect", x: 2, y: 2.5, width: 12, height: 11, rx: 2.2, stroke: "currentColor", "stroke-width": "1.4" },
      { d: "M6.2 2.5v11", stroke: "currentColor", "stroke-width": "1.4" },
    ])
  );

  const sidebarMenuBtn = h(
    "button",
    {
      className: "ex-icon-btn",
      title: "Menu",
      onClick: (e) => {
        e.stopPropagation();
        togglePopover("menu", sidebarMenuBtn);
      },
    },
    svgIcon([
      { d: "M3 4.5h10M3 8h10M3 11.5h10", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
    ])
  );

  const sidebarTopHeader = h(
    "div",
    { className: "ex-sidebar-header" },
    h(
      "button",
      {
        className: "ex-brand-btn",
        title: "About Exotic",
        onClick: () => openSettingsSection("flags"),
      },
      makeExoticEmblem(18),
      h("span", { className: "ex-brand-word" }, "Exotic")
    ),
    h("div", { className: "ex-nav-cluster" }, backBtn, fwdBtn, reloadBtn, railCollapseBtn, sidebarMenuBtn)
  );

  // Sidebar Address Bar
  const sidebarUrlIcon = h(
    "button",
    {
      className: "ex-url-icon",
      title: "Site information and tracking protection",
      onClick: (e) => {
        e.stopPropagation();
        togglePopover("shield", sidebarUrlPill);
      },
    },
    svgIcon(
      [
        { tag: "circle", cx: 7, cy: 7, r: 4.2, stroke: "currentColor", "stroke-width": "1.3" },
        { d: "M10.2 10.2L13.2 13.2", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" },
      ],
      13
    )
  );
  const sidebarUrlText = h("span", { className: "ex-url-host" }, "exotic://newtab");
  let currentBookmarkedGuid = null;
  const sidebarStarBtn = h(
    "button",
    {
      className: "ex-url-star",
      title: "Bookmark this page (Ctrl+D)",
      onClick: async (e) => {
        e.stopPropagation();
        await toggleBookmarkCurrentPage();
      },
    },
    "☆"
  );

  const sidebarUrlPill = h(
    "div",
    {
      id: "exotic-url-pill",
      className: "ex-url-pill",
      title: "Search or enter address (Ctrl+L)",
      onClick: () => openFloatingBar(false),
    },
    sidebarUrlIcon,
    sidebarUrlText,
    sidebarStarBtn
  );

  // 4-Column Pinned Shortcuts Grid
  const pinsGrid = h("div", { className: "ex-pins-grid" });
  let lastPinnedKey = "";

  function renderPinnedShortcuts() {
    const items = getActivePinnedShortcuts();
    const key = items.map((i) => i.id).join(",");
    if (key === lastPinnedKey && pinsGrid.childNodes.length > 0) return;
    lastPinnedKey = key;
    pinsGrid.replaceChildren(
      ...items.map((item) =>
        h(
          "button",
          {
            className: "ex-pin-tile",
            title: item.title,
            onClick: () => {
              if (item.route) openSettingsSection(item.route);
              else navigateCurrentOrOpen(item.url, false);
            },
          },
          item.icon(),
          h("span", { className: "ex-pin-lbl" }, item.title)
        )
      )
    );
  }
  renderPinnedShortcuts();

  // Workspace Header + Pinned Tabs + Vertical Tabs + "+ New tab"
  const pinnedTabsBox = h("div", { className: "ex-pinned-list" });
  const wsTitleSpan = h("span", { className: "ex-ws-label-txt" }, "Personal");
  const splitQuickBtn = h(
    "button",
    {
      className: "ex-ws-split-btn",
      title: "Split view (Alt+S)",
      onClick: () => toggleSplitView(),
    },
    "Split view"
  );

  const workspaceDividerRow = h(
    "div",
    { className: "ex-ws-divider" },
    wsTitleSpan,
    splitQuickBtn
  );

  const openTabsList = h("div", { className: "ex-tabs-list" });

  const newTabRow = h(
    "button",
    {
      className: "ex-newtab-row",
      title: "New tab (Ctrl+T)",
      onClick: () => openFloatingBar(true),
    },
    h("span", { className: "ex-newtab-plus" }, "+"),
    h("span", { className: "ex-newtab-txt" }, "New tab")
  );

  const tabsScrollArea = h(
    "div",
    { className: "ex-tabs-scroll" },
    pinnedTabsBox,
    workspaceDividerRow,
    openTabsList,
    newTabRow
  );

  // Bottom Utility Buttons (Downloads / Bookmarks / History / Appearance) above Workspace Switcher (Personal / Work / Research)
  const footerUtilsBar = h(
    "div",
    { className: "ex-footer-utils" },
    h(
      "button",
      {
        className: "ex-util-btn",
        title: "Downloads (Ctrl+J)",
        onClick: () => openSettingsSection("downloads"),
      },
      svgIcon(
        [
          { d: "M8 3v7M5.2 7.5L8 10.3l2.8-2.8M3.5 12.8h9", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" },
        ],
        14
      )
    ),
    h(
      "button",
      {
        className: "ex-util-btn",
        title: "Bookmarks (Ctrl+B)",
        onClick: () => openSettingsSection("bookmarks"),
      },
      svgIcon(
        [
          { d: "M4.5 2.8h7a1 1 0 0 1 1 1v9.4L8 10.6l-4.5 2.6V3.8a1 1 0 0 1 1-1Z", stroke: "currentColor", "stroke-width": "1.3", "stroke-linejoin": "round" },
        ],
        14
      )
    ),
    h(
      "button",
      {
        className: "ex-util-btn",
        title: "History (Ctrl+H)",
        onClick: () => openSettingsSection("history"),
      },
      svgIcon(
        [
          { tag: "circle", cx: 8, cy: 8, r: 5.3, stroke: "currentColor", "stroke-width": "1.3" },
          { d: "M8 5.2V8l2 1.4", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" },
        ],
        14
      )
    ),
    h(
      "button",
      {
        className: "ex-util-btn",
        title: "Appearance (Alt+,)",
        onClick: () => openSettingsSection("appearance"),
      },
      svgIcon(
        [
          { tag: "circle", cx: 8, cy: 8, r: 2.1, stroke: "currentColor", "stroke-width": "1.3" },
          { tag: "circle", cx: 8, cy: 8, r: 5.3, stroke: "currentColor", "stroke-width": "1.2", "stroke-dasharray": "2.2 1.8" },
        ],
        14
      )
    )
  );

  const wsSwitcherBox = h("div", { className: "ex-ws-switcher" });
  const sidebarBottomBar = h(
    "div",
    { className: "ex-sidebar-footer" },
    footerUtilsBar,
    wsSwitcherBox
  );

  const exoticSidebar = h(
    "aside",
    { id: "exotic-sidebar", className: "ex-sidebar" },
    h("div", { className: "ex-sidebar-top" }, sidebarTopHeader, sidebarUrlPill, pinsGrid),
    tabsScrollArea,
    sidebarBottomBar
  );

  const compactHoverEdge = h("div", {
    id: "exotic-hover-edge",
    className: "ex-hover-edge",
    onMouseEnter: () => doc.documentElement.setAttribute("exotic-compact-peek", "true"),
  });
  exoticSidebar.addEventListener("mouseleave", () => {
    doc.documentElement.setAttribute("exotic-compact-peek", "false");
  });

  // =========================================================================
  // 2. TOP WINDOW BAR (#exotic-topbar)
  // =========================================================================
  const topSplitBtn = h(
    "button",
    {
      className: "ex-top-btn",
      title: "Toggle split view (Alt+S)",
      onClick: () => toggleSplitView(),
    },
    "Split view"
  );

  const topCompactBtn = h(
    "button",
    {
      className: "ex-top-btn",
      title: "Auto-hide sidebar (Alt+B)",
      onClick: () => ctrl.toggleCompactMode(),
    },
    "Auto-hide"
  );

  const topModsBtn = h(
    "button",
    {
      className: "ex-top-btn",
      title: "Exotic Mods (Alt+M)",
      onClick: () => openSettingsSection("mods"),
    },
    "Exotic Mods"
  );

  function launchExOS() {
    try {
      if (win.__exoticOS && typeof win.__exoticOS.open === "function") {
        win.__exoticOS.open();
        return;
      }
    } catch (osErr) {
      console.error("[Exotic ExOS Launch Error]", osErr);
    }
    openSettingsSection("mods");
  }

  const topOSBtn = h(
    "button",
    {
      className: "ex-top-btn",
      title: "Boot ExOS — the virtual desktop inside this browser",
      onClick: () => launchExOS(),
    },
    "ExOS"
  );
  topOSBtn.style.display = "none";

  const topCenterCrumb = h(
    "button",
    {
      className: "ex-center-crumb",
      title: "Open address bar (Ctrl+L)",
      onClick: () => openFloatingBar(false),
    },
    "exotic://newtab"
  );

  const topThemeBtn = h(
    "button",
    {
      className: "ex-top-btn",
      title: "Switch between Dark and Light theme (Alt+T)",
      onClick: () => ctrl.toggleTheme(),
    },
    "Dark"
  );

  const winCaptionBox = h(
    "div",
    { className: "ex-win-controls" },
    h(
      "button",
      { className: "ex-win-btn", title: "Minimize", onClick: () => win.minimize() },
      svgIcon([{ d: "M3.5 8h9", stroke: "currentColor", "stroke-width": "1.3" }], 12)
    ),
    h(
      "button",
      {
        className: "ex-win-btn",
        title: "Maximize",
        onClick: () => {
          if (win.windowState === win.STATE_MAXIMIZED) win.restore();
          else win.maximize();
        },
      },
      svgIcon(
        [{ tag: "rect", x: 3.4, y: 3.4, width: 9.2, height: 9.2, rx: 1.5, stroke: "currentColor", "stroke-width": "1.3" }],
        12
      )
    ),
    h(
      "button",
      { className: "ex-win-btn ex-win-close", title: "Close", onClick: () => win.close() },
      svgIcon(
        [{ d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" }],
        12
      )
    )
  );

  const exoticTopBar = h(
    "div",
    {
      id: "exotic-topbar",
      className: "ex-topbar",
      onDblClick: (e) => {
        if (e.target === exoticTopBar) {
          if (win.windowState === win.STATE_MAXIMIZED) win.restore();
          else win.maximize();
        }
      },
    },
    h("div", { className: "ex-topbar-left" }, topSplitBtn, topCompactBtn, topModsBtn, topOSBtn),
    topCenterCrumb,
    h("div", { className: "ex-topbar-right" }, topThemeBtn, winCaptionBox)
  );

  const browserBox = doc.getElementById("browser");
  const tabBox = doc.getElementById("tabbrowser-tabbox");
  if (browserBox && tabBox) {
    browserBox.insertBefore(compactHoverEdge, tabBox);
    browserBox.insertBefore(exoticSidebar, tabBox);
    tabBox.insertBefore(exoticTopBar, tabBox.firstChild);
  }

  // =========================================================================
  // 3. CENTERED FLOATING ADDRESS BAR (#exotic-address-overlay)
  // =========================================================================
  let floatOpenInNewTab = false;
  let floatItems = [];
  let floatIdx = 0;

  const floatInput = h("input", {
    id: "exotic-float-input",
    className: "ex-float-input",
    type: "text",
    spellcheck: "false",
    autocomplete: "off",
    placeholder: "Search or enter web address",
  });
  const floatList = h("div", { className: "ex-float-list" });

  const floatOverlay = h(
    "div",
    {
      id: "exotic-address-overlay",
      className: "ex-modal-backdrop",
      onClick: (e) => {
        if (e.target === floatOverlay) closeFloatingBar();
      },
    },
    h(
      "div",
      { className: "ex-float-card" },
      h(
        "div",
        { className: "ex-float-head" },
        h(
          "span",
          { className: "ex-float-search-ico" },
          svgIcon(
            [
              { tag: "circle", cx: 7, cy: 7, r: 4.5, stroke: "currentColor", "stroke-width": "1.4" },
              { d: "M10.5 10.5L13.6 13.6", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" },
            ],
            15
          )
        ),
        floatInput
      ),
      floatList
    )
  );
  doc.documentElement.appendChild(floatOverlay);

  function getDefaultSearchName() {
    try {
      if (Services.search && Services.search.defaultEngine) {
        return Services.search.defaultEngine.name;
      }
    } catch (_) {}
    return "DuckDuckGo";
  }

  async function refreshFloatingSuggestions(rawQuery) {
    const q = (rawQuery || "").trim();
    const ql = q.toLowerCase();
    const out = [];

    if (q) {
      const looksLikeUrl =
        /^(https?:\/\/|exotic:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(q) && !q.includes(" ");
      out.push({
        title: q,
        hint: looksLikeUrl ? "Open address" : `Search with ${getDefaultSearchName()}`,
        run: () => navigateCurrentOrOpen(q, floatOpenInNewTab),
      });
    }

    const quickItems = [
      { title: "New Tab", hint: "exotic://newtab", run: () => ctrl.openStartTab() },
      { title: "Settings", hint: "exotic://settings", run: () => openSettingsSection("appearance") },
      { title: "Exotic Mods", hint: "exotic://mods", run: () => openSettingsSection("mods") },
      { title: "Bookmarks", hint: "exotic://bookmarks", run: () => openSettingsSection("bookmarks") },
      { title: "History", hint: "exotic://history", run: () => openSettingsSection("history") },
      { title: "Downloads", hint: "exotic://downloads", run: () => openSettingsSection("downloads") },
      { title: "Toggle split view", hint: "Alt+S", run: () => toggleSplitView() },
      { title: "Toggle auto-hide sidebar", hint: "Alt+B", run: () => ctrl.toggleCompactMode() },
      {
        title:
          ctrl.getThemeMode() === "monochrome-light" || ctrl.getThemeMode() === "sunset"
            ? "Switch to Dark theme"
            : "Switch to Light theme",
        hint: "Alt+T",
        run: () => ctrl.toggleTheme(),
      },
    ];

    if (win.gBrowser && win.gBrowser.tabs) {
      for (const t of win.gBrowser.tabs) {
        const ttl = getCleanTabTitle(t);
        const u = getUrlMetaForBrowser(t.linkedBrowser).shortLabel;
        if (!ql || ttl.toLowerCase().includes(ql) || u.toLowerCase().includes(ql)) {
          out.push({
            title: ttl,
            hint: `Switch to tab · ${u}`,
            run: () => {
              const tws = getTabWorkspace(t);
              if (tws !== activeWorkspaceId && !t.__exoticPinned) {
                switchWorkspace(tws);
              }
              win.gBrowser.selectedTab = t;
            },
          });
        }
      }
    }

    for (const act of quickItems) {
      if (!ql || act.title.toLowerCase().includes(ql) || act.hint.toLowerCase().includes(ql)) {
        out.push(act);
      }
    }

    if (ql && PlacesUtils && Services.prefs.getBoolPref("browser.urlbar.suggest.history", true)) {
      try {
        const hq = PlacesUtils.history.getNewQuery();
        hq.searchTerms = q;
        const ho = PlacesUtils.history.getNewQueryOptions();
        ho.maxResults = 4;
        ho.sortingMode = ho.SORT_BY_VISITCOUNT_DESCENDING;
        const res = PlacesUtils.history.executeQuery(hq, ho);
        res.root.containerOpen = true;
        for (let i = 0; i < res.root.childCount; i++) {
          const n = res.root.getChild(i);
          if (n && n.uri && !n.uri.startsWith("about:")) {
            out.push({
              title: n.title || n.uri,
              hint: n.uri,
              run: () => navigateCurrentOrOpen(n.uri, floatOpenInNewTab),
            });
          }
        }
        res.root.containerOpen = false;
      } catch (_) {}
    }

    floatItems = out.slice(0, 8);
    if (floatIdx >= floatItems.length) floatIdx = 0;
    renderFloatingList();
  }

  function renderFloatingList() {
    floatList.replaceChildren(
      ...floatItems.map((it, i) =>
        h(
          "div",
          {
            className: "ex-float-row",
            "data-active": i === floatIdx ? "true" : "false",
            onMouseEnter: () => {
              floatIdx = i;
              renderFloatingList();
            },
            onMouseDown: (e) => {
              e.preventDefault();
              closeFloatingBar();
              it.run();
            },
          },
          h("span", { className: "ex-float-row-title" }, it.title),
          h("span", { className: "ex-float-row-hint" }, it.hint)
        )
      )
    );
  }

  function openFloatingBar(forNewTab = false) {
    closePopovers();
    floatOpenInNewTab = !!forNewTab;
    floatInput.placeholder = forNewTab
      ? "Search or enter address for new tab"
      : "Search or enter web address";
    const meta = win.gBrowser ? getUrlMetaForBrowser(win.gBrowser.selectedBrowser) : { full: "" };
    floatInput.value = forNewTab ? "" : meta.full || "";
    floatIdx = 0;
    floatOverlay.setAttribute("data-open", "true");
    refreshFloatingSuggestions(floatInput.value);
    win.setTimeout(() => {
      floatInput.focus();
      floatInput.select();
    }, 15);
  }

  function closeFloatingBar() {
    floatOverlay.setAttribute("data-open", "false");
  }

  floatInput.addEventListener("input", () => {
    floatIdx = 0;
    refreshFloatingSuggestions(floatInput.value);
  });
  floatInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeFloatingBar();
    } else if (e.key === "ArrowDown" && floatItems.length > 0) {
      e.preventDefault();
      floatIdx = (floatIdx + 1) % floatItems.length;
      renderFloatingList();
    } else if (e.key === "ArrowUp" && floatItems.length > 0) {
      e.preventDefault();
      floatIdx = (floatIdx - 1 + floatItems.length) % floatItems.length;
      renderFloatingList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = floatItems[floatIdx];
      const raw = floatInput.value.trim();
      closeFloatingBar();
      if (chosen && (floatIdx > 0 || !raw)) chosen.run();
      else if (raw) navigateCurrentOrOpen(raw, floatOpenInNewTab || e.altKey);
      else if (floatOpenInNewTab) ctrl.openStartTab();
    }
  });

  // =========================================================================
  // 4. QUICK PREVIEW OVERLAY (#exotic-preview-overlay, Alt+G)
  // =========================================================================
  const previewTitle = h("span", { className: "ex-preview-title" }, "Preview");
  const previewHost = h("div", { className: "ex-preview-body" });
  let previewTargetUrl = "";

  const previewOverlay = h(
    "div",
    {
      id: "exotic-preview-overlay",
      className: "ex-modal-backdrop",
      onClick: (e) => {
        if (e.target === previewOverlay) closePreviewModal();
      },
    },
    h(
      "div",
      { className: "ex-preview-card" },
      h(
        "div",
        { className: "ex-preview-head" },
        previewTitle,
        h(
          "div",
          { style: { display: "flex", gap: "6px" } },
          h(
            "button",
            {
              className: "ex-mini-btn ex-mini-invert",
              onClick: () => {
                const u = previewTargetUrl;
                closePreviewModal();
                if (u) navigateCurrentOrOpen(u, true);
              },
            },
            "Open in tab"
          ),
          h("button", { className: "ex-mini-btn", onClick: () => closePreviewModal() }, "Close")
        )
      ),
      previewHost
    )
  );
  doc.documentElement.appendChild(previewOverlay);

  function openPreviewModal(urlOverride) {
    closePopovers();
    const b = win.gBrowser && win.gBrowser.selectedBrowser;
    const spec = urlOverride || (b && b.currentURI && b.currentURI.spec) || "https://duckduckgo.com/";
    previewTargetUrl = spec;
    previewTitle.textContent = getUrlMetaForBrowser(b).shortLabel || spec;

    previewOverlay.setAttribute("data-open", "true");
    const vbox = doc.createXULElement("vbox");
    vbox.setAttribute("flex", "1");
    vbox.style.width = "100%";
    vbox.style.height = "100%";
    const gb = doc.createXULElement("browser");
    gb.setAttribute("type", "content");
    gb.setAttribute("remote", "true");
    gb.setAttribute("maychangeremoteness", "true");
    gb.setAttribute("flex", "1");
    gb.style.width = "100%";
    gb.style.height = "100%";
    vbox.appendChild(gb);
    previewHost.replaceChildren(vbox);
    win.setTimeout(() => {
      try {
        gb.loadURI(Services.io.newURI(spec), {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
      } catch (_) {}
    }, 25);
  }

  function closePreviewModal() {
    previewOverlay.setAttribute("data-open", "false");
    previewHost.replaceChildren();
  }

  // =========================================================================
  // 5. POPOVERS (MENU & SITE PRIVACY) + FIND BAR (Ctrl+F)
  // =========================================================================
  const popLayer = h("div", {
    id: "exotic-popover",
    className: "ex-floating-popover",
  });
  doc.documentElement.appendChild(popLayer);
  let activePopKind = null;

  function closePopovers() {
    activePopKind = null;
    popLayer.setAttribute("data-open", "false");
  }

  function togglePopover(kind, anchorEl) {
    if (activePopKind === kind) {
      closePopovers();
      return;
    }
    activePopKind = kind;
    renderPopover(anchorEl);
  }

  function renderPopover(anchorEl) {
    if (!activePopKind) {
      popLayer.setAttribute("data-open", "false");
      return;
    }
    const r = (anchorEl || sidebarMenuBtn).getBoundingClientRect();
    popLayer.style.top = `${Math.max(8, Math.round(r.bottom + 6))}px`;
    popLayer.style.left = `${Math.min(win.innerWidth - 280, Math.max(8, Math.round(r.left)))}px`;
    popLayer.style.width = "264px";
    popLayer.setAttribute("data-open", "true");

    if (activePopKind === "shield") {
      const b = win.gBrowser && win.gBrowser.selectedBrowser;
      const meta = getUrlMetaForBrowser(b);
      const shieldOn = ctrl.getShieldEnabled();
      popLayer.replaceChildren(
        h(
          "div",
          { className: "ex-pop-header" },
          h("div", { className: "ex-pop-title" }, meta.shortLabel),
          h("div", { className: "ex-pop-sub" }, meta.secure ? "Secure connection" : "Local or standard page")
        ),
        h(
          "button",
          {
            className: "ex-pop-item",
            "data-invert": shieldOn ? "true" : "false",
            onClick: () => {
              ctrl.setShieldEnabled(!shieldOn);
              renderPopover(anchorEl);
            },
          },
          h("span", null, shieldOn ? "Tracking protection: On" : "Tracking protection: Off"),
          h("span", { className: "ex-pop-kbd" }, `${ctrl.getBlockedCount()} blocked`)
        ),
        h(
          "button",
          {
            className: "ex-pop-item",
            onClick: () => {
              closePopovers();
              openSettingsSection("privacy");
            },
          },
          h("span", null, "Privacy settings")
        )
      );
      return;
    }

    const curZoom = Math.round(((win.ZoomManager && win.ZoomManager.zoom) || 1) * 100);
    const mode = ctrl.getThemeMode();
    const item = (lbl, kbd, fn) =>
      h(
        "button",
        {
          className: "ex-pop-item",
          onClick: () => {
            closePopovers();
            fn();
          },
        },
        h("span", null, lbl),
        kbd && h("span", { className: "ex-pop-kbd" }, kbd)
      );

    popLayer.replaceChildren(
      h(
        "div",
        { className: "ex-pop-header" },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h("span", { style: { fontSize: "12.5px" } }, "Zoom"),
          h(
            "div",
            { style: { display: "flex", gap: "4px" } },
            h(
              "button",
              {
                className: "ex-mini-btn",
                onClick: () => {
                  if (win.FullZoom) win.FullZoom.reduce();
                  renderPopover(anchorEl);
                },
              },
              "−"
            ),
            h(
              "button",
              {
                className: "ex-mini-btn",
                onClick: () => {
                  if (win.FullZoom) win.FullZoom.reset();
                  renderPopover(anchorEl);
                },
              },
              `${curZoom}%`
            ),
            h(
              "button",
              {
                className: "ex-mini-btn",
                onClick: () => {
                  if (win.FullZoom) win.FullZoom.enlarge();
                  renderPopover(anchorEl);
                },
              },
              "+"
            )
          )
        )
      ),
      item("New tab", "Ctrl+T", () => openFloatingBar(true)),
      item("New private window", "Ctrl+Shift+P", () => win.OpenBrowserWindow && win.OpenBrowserWindow({ private: true })),
      item("Split view", "Alt+S", () => toggleSplitView()),
      item("Auto-hide sidebar", "Alt+B", () => ctrl.toggleCompactMode()),
      item("Bookmarks", "Ctrl+B", () => openSettingsSection("bookmarks")),
      item("History", "Ctrl+H", () => openSettingsSection("history")),
      item("Downloads", "Ctrl+J", () => openSettingsSection("downloads")),
      item("Exotic Mods", "Alt+M", () => openSettingsSection("mods")),
      item(
        mode === "monochrome-light" || mode === "sunset" ? "Dark theme" : "Light theme",
        "Alt+T",
        () => ctrl.toggleTheme()
      ),
      item("Find in page", "Ctrl+F", () => openFindPod()),
      item("Settings", "Alt+,", () => openSettingsSection("appearance")),
      item("Exit", "Ctrl+Q", () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit))
    );
  }

  doc.addEventListener("mousedown", (e) => {
    if (
      activePopKind &&
      !popLayer.contains(e.target) &&
      !sidebarMenuBtn.contains(e.target) &&
      !sidebarUrlIcon.contains(e.target)
    ) {
      closePopovers();
    }
  });

  const findInput = h("input", {
    className: "ex-find-input",
    type: "text",
    placeholder: "Find in page",
  });
  const findPod = h(
    "div",
    { id: "exotic-find", className: "ex-find-pod" },
    findInput,
    h("button", { className: "ex-mini-btn", onClick: () => runFind(true) }, "↑"),
    h("button", { className: "ex-mini-btn", onClick: () => runFind(false) }, "↓"),
    h("button", { className: "ex-mini-btn", onClick: () => closeFindPod() }, "×")
  );
  doc.documentElement.appendChild(findPod);

  function runFind(backwards = false, initial = false) {
    const q = findInput.value || "";
    if (!q || !win.gBrowser || !win.gBrowser.selectedBrowser) return;
    try {
      const finder = win.gBrowser.selectedBrowser.finder;
      if (initial) finder.fastFind(q, false, false);
      else finder.findAgain(q, false, backwards, false);
    } catch (_) {}
  }
  function openFindPod() {
    findPod.setAttribute("data-open", "true");
    win.setTimeout(() => {
      findInput.focus();
      findInput.select();
    }, 15);
  }
  function closeFindPod() {
    findPod.setAttribute("data-open", "false");
    try {
      win.gBrowser.selectedBrowser.finder.removeSelection();
    } catch (_) {}
  }
  findInput.addEventListener("input", () => runFind(false, true));
  findInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFindPod();
    else if (e.key === "Enter") runFind(e.shiftKey, false);
  });

  // =========================================================================
  // 6. BOOKMARK STAR & SIDEBAR SYNCHRONIZATION
  // =========================================================================
  async function syncBookmarkStar() {
    currentBookmarkedGuid = null;
    if (!PlacesUtils || !win.gBrowser || !win.gBrowser.selectedBrowser) {
      sidebarStarBtn.textContent = "☆";
      return;
    }
    const spec =
      (win.gBrowser.selectedBrowser.currentURI && win.gBrowser.selectedBrowser.currentURI.spec) || "";
    if (!spec.startsWith("http")) {
      sidebarStarBtn.style.display = "none";
      return;
    }
    sidebarStarBtn.style.display = "inline-flex";
    try {
      const bm = await PlacesUtils.bookmarks.fetch({ url: spec });
      if (bm && bm.guid) {
        currentBookmarkedGuid = bm.guid;
        sidebarStarBtn.textContent = "★";
      } else {
        sidebarStarBtn.textContent = "☆";
      }
    } catch (_) {
      sidebarStarBtn.textContent = "☆";
    }
  }

  async function toggleBookmarkCurrentPage() {
    if (!PlacesUtils || !win.gBrowser || !win.gBrowser.selectedBrowser) return;
    const b = win.gBrowser.selectedBrowser;
    const spec = (b.currentURI && b.currentURI.spec) || "";
    if (!spec.startsWith("http")) {
      openSettingsSection("bookmarks");
      return;
    }
    try {
      if (currentBookmarkedGuid) {
        await PlacesUtils.bookmarks.remove(currentBookmarkedGuid);
        currentBookmarkedGuid = null;
      } else {
        const res = await PlacesUtils.bookmarks.insert({
          parentGuid: PlacesUtils.bookmarks.unfiledGuid,
          title: b.contentTitle || spec,
          url: spec,
        });
        currentBookmarkedGuid = res && res.guid;
      }
    } catch (_) {}
    await syncBookmarkStar();
  }

  function renderSidebarTabs() {
    if (!win.gBrowser || !win.gBrowser.tabs) return;
    const allTabs = Array.from(win.gBrowser.tabs);
    for (const t of allTabs) getTabWorkspace(t);

    const pinned = allTabs.filter((t) => !!t.__exoticPinned);
    const wsOpen = allTabs.filter(
      (t) => !t.__exoticPinned && getTabWorkspace(t) === activeWorkspaceId
    );

    const curWs = WORKSPACES.find((w) => w.id === activeWorkspaceId) || WORKSPACES[0];
    wsTitleSpan.textContent = curWs.name;
    splitQuickBtn.setAttribute("data-active", splitViewActive ? "true" : "false");

    const buildTabRow = (tab, isPinned) => {
      const inSplit =
        win.gBrowser &&
        win.gBrowser.activeSplitView &&
        Array.isArray(win.gBrowser.activeSplitView.tabs) &&
        win.gBrowser.activeSplitView.tabs.includes(tab);
      const selected = tab === win.gBrowser.selectedTab || !!inSplit;
      const label = getCleanTabTitle(tab);

      return h(
        "div",
        {
          className: "ex-tab-row",
          "data-selected": selected ? "true" : "false",
          title: label,
          onMouseDown: (e) => {
            if (e.button === 0) {
              if (e.altKey) {
                const spec =
                  tab.linkedBrowser && tab.linkedBrowser.currentURI
                    ? tab.linkedBrowser.currentURI.spec
                    : "";
                if (spec) openPreviewModal(spec);
                return;
              }
              win.gBrowser.selectedTab = tab;
            } else if (e.button === 1 && allTabs.length > 1) {
              e.preventDefault();
              win.gBrowser.removeTab(tab);
            }
          },
        },
        h("span", { className: "ex-tab-ico" }, makeTabIcon(tab)),
        h("span", { className: "ex-tab-title" }, label),
        h(
          "div",
          { className: "ex-tab-actions" },
          h(
            "button",
            {
              className: "ex-tab-act",
              title: isPinned ? "Unpin tab" : "Pin tab",
              onMouseDown: (e) => e.stopPropagation(),
              onClick: (e) => {
                e.stopPropagation();
                tab.__exoticPinned = !tab.__exoticPinned;
                renderSidebarTabs();
              },
            },
            isPinned ? "•" : "◦"
          ),
          allTabs.length > 1 &&
            h(
              "button",
              {
                className: "ex-tab-act",
                title: "Close tab (Ctrl+W)",
                onMouseDown: (e) => e.stopPropagation(),
                onClick: (e) => {
                  e.stopPropagation();
                  win.gBrowser.removeTab(tab);
                },
              },
              "×"
            )
        )
      );
    };

    pinnedTabsBox.replaceChildren(...pinned.map((t) => buildTabRow(t, true)));
    openTabsList.replaceChildren(...wsOpen.map((t) => buildTabRow(t, false)));

    wsSwitcherBox.replaceChildren(
      ...WORKSPACES.map((ws) =>
        h(
          "button",
          {
            className: "ex-ws-pill",
            "data-active": ws.id === activeWorkspaceId ? "true" : "false",
            title: `${ws.name} workspace`,
            onClick: () => switchWorkspace(ws.id),
          },
          ws.name
        )
      )
    );
  }

  function syncActiveNavigationUI() {
    if (!win.gBrowser || !win.gBrowser.selectedBrowser) return;
    const meta = getUrlMetaForBrowser(win.gBrowser.selectedBrowser);
    sidebarUrlText.textContent = meta.shortLabel;
    topCenterCrumb.textContent = meta.shortLabel;

    sidebarUrlIcon.replaceChildren(
      meta.secure
        ? svgIcon(
            [
              { tag: "rect", x: 3.5, y: 7, width: 9, height: 6.5, rx: 1.5, stroke: "currentColor", "stroke-width": "1.3" },
              { d: "M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7", stroke: "currentColor", "stroke-width": "1.3" },
            ],
            13
          )
        : svgIcon(
            [
              { tag: "circle", cx: 7, cy: 7, r: 4.2, stroke: "currentColor", "stroke-width": "1.3" },
              { d: "M10.2 10.2L13.2 13.2", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" },
            ],
            13
          )
    );

    backBtn.setAttribute("data-disabled", win.gBrowser.canGoBack ? "false" : "true");
    fwdBtn.setAttribute("data-disabled", win.gBrowser.canGoForward ? "false" : "true");

    isTabBusy = win.gBrowser.selectedTab && win.gBrowser.selectedTab.hasAttribute("busy");
    reloadIconWrap.replaceChildren(
      isTabBusy
        ? svgIcon([
            { d: "M4.5 4.5l7 7M11.5 4.5l-7 7", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" },
          ])
        : svgIcon([
            { d: "M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 2.8v2.7H9.8", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" },
          ])
    );

    applySplitViewDOM();
    syncBookmarkStar();
  }

  function syncShellState() {
    const mode = ctrl.getThemeMode();
    const variant = ctrl.getThemeVariant ? ctrl.getThemeVariant() : "dark";
    let sidebarMode = "expanded";
    let compact = false;
    let rounded = true;
    let sharp = false;
    let ghostTabs = false;
    try {
      sidebarMode = Services.prefs.getCharPref("exotic.ui.sidebarMode", "expanded");
      compact = Services.prefs.getBoolPref("exotic.ui.compact", false);
      rounded = Services.prefs.getBoolPref("exotic.ui.roundedContent", true);
      sharp = Services.prefs.getBoolPref("exotic.mods.sharpGeometry", false);
      ghostTabs = Services.prefs.getBoolPref("exotic.mods.ghostTabs", false);
      const savedWs = Services.prefs.getCharPref("exotic.ui.workspace", activeWorkspaceId);
      if (WORKSPACES.some((w) => w.id === savedWs)) activeWorkspaceId = savedWs;
    } catch (_) {}

    doc.documentElement.setAttribute("exotic-theme", mode);
    doc.documentElement.setAttribute("exotic-theme-variant", variant);
    doc.documentElement.setAttribute("exotic-sidebar-mode", sidebarMode);
    doc.documentElement.setAttribute("exotic-compact", compact ? "true" : "false");
    doc.documentElement.setAttribute("exotic-rounded", rounded && !sharp ? "true" : "false");
    doc.documentElement.setAttribute("exotic-sharp", sharp ? "true" : "false");
    doc.documentElement.setAttribute("exotic-ghost-tabs", ghostTabs ? "true" : "false");

    topThemeBtn.textContent = variant === "light" ? "Dark" : "Light";
    topSplitBtn.setAttribute("data-active", splitViewActive ? "true" : "false");
    topCompactBtn.setAttribute("data-active", compact ? "true" : "false");

    let exosEnabled = false;
    try {
      exosEnabled = Services.prefs.getBoolPref("exotic.mods.exos", false);
    } catch (_) {}
    topOSBtn.style.display = exosEnabled ? "" : "none";

    renderPinnedShortcuts();
    renderSidebarTabs();
    syncActiveNavigationUI();
  }

  if (win.gBrowser && win.gBrowser.tabContainer) {
    const tc = win.gBrowser.tabContainer;
    tc.addEventListener("TabOpen", (e) => {
      if (e && e.target && !e.target.__exoticWorkspace) {
        e.target.__exoticWorkspace = activeWorkspaceId;
      }
      renderSidebarTabs();
      syncActiveNavigationUI();
    });
    for (const ev of ["TabClose", "TabSelect", "TabAttrModified", "TabMove"]) {
      tc.addEventListener(ev, () => {
        renderSidebarTabs();
        syncActiveNavigationUI();
      });
    }

    const progressListener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
      onLocationChange() {
        renderSidebarTabs();
        syncActiveNavigationUI();
      },
      onStateChange() {
        renderSidebarTabs();
        syncActiveNavigationUI();
      },
      onSecurityChange() {
        syncActiveNavigationUI();
      },
    };
    try {
      win.gBrowser.addProgressListener(progressListener);
    } catch (_) {}
  }    win.addEventListener(
      "keydown",
      (e) => {
        if (win.__exoticOS && typeof win.__exoticOS.isActive === "function" && win.__exoticOS.isActive()) {
          return;
        }
        const k = (e.key || "").toLowerCase();
      const accel = e.ctrlKey || e.metaKey;

      if ((accel && k === "l" && !e.shiftKey) || (e.altKey && k === "d") || e.key === "F6") {
        e.preventDefault();
        e.stopPropagation();
        openFloatingBar(false);
      } else if (accel && !e.shiftKey && k === "t") {
        e.preventDefault();
        e.stopPropagation();
        openFloatingBar(true);
      } else if (accel && e.shiftKey && k === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (floatOverlay.getAttribute("data-open") === "true") closeFloatingBar();
        else openFloatingBar(false);
      } else if (accel && !e.shiftKey && k === "f") {
        e.preventDefault();
        e.stopPropagation();
        openFindPod();
      } else if (accel && k === "h") {
        e.preventDefault();
        e.stopPropagation();
        openSettingsSection("history");
      } else if (accel && (k === "j" || (e.shiftKey && k === "y"))) {
        e.preventDefault();
        e.stopPropagation();
        openSettingsSection("downloads");
      } else if (accel && ((e.shiftKey && k === "o") || (!e.shiftKey && k === "b"))) {
        e.preventDefault();
        e.stopPropagation();
        openSettingsSection("bookmarks");
      } else if (accel && !e.shiftKey && k === "d") {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmarkCurrentPage();
      } else if (accel && e.shiftKey && k === "a") {
        e.preventDefault();
        e.stopPropagation();
        openSettingsSection("mods");
      } else if ((e.altKey && !accel && k === "b") || (accel && e.altKey && k === "c")) {
        e.preventDefault();
        e.stopPropagation();
        ctrl.toggleCompactMode();
      } else if (e.altKey && !accel && k === "v") {
        e.preventDefault();
        ctrl.toggleSidebarMode();
      } else if (e.altKey && !accel && k === "s") {
        e.preventDefault();
        toggleSplitView();
      } else if (e.altKey && !accel && k === "g") {
        e.preventDefault();
        if (previewOverlay.getAttribute("data-open") === "true") closePreviewModal();
        else openPreviewModal();
      } else if (e.altKey && !accel && e.key === "1") {
        e.preventDefault();
        switchWorkspace("personal");
      } else if (e.altKey && !accel && e.key === "2") {
        e.preventDefault();
        switchWorkspace("work");
      } else if (e.altKey && !accel && e.key === "3") {
        e.preventDefault();
        switchWorkspace("research");
      } else if (e.altKey && !accel && e.key === ",") {
        e.preventDefault();
        openSettingsSection("appearance");
      } else if (e.altKey && !accel && k === "m") {
        e.preventDefault();
        openSettingsSection("mods");
      } else if (e.altKey && !accel && k === "t") {
        e.preventDefault();
        ctrl.toggleTheme();
      } else if (e.key === "Escape") {
        if (previewOverlay.getAttribute("data-open") === "true") {
          e.preventDefault();
          closePreviewModal();
        }
      }
    },
    true
  );

  ctrl.registerWindowSync(syncShellState);
  win.addEventListener("resize", applySplitViewDOM);
  win.addEventListener("unload", () => ctrl.unregisterWindowSync(syncShellState), {
    once: true,
  });

  syncShellState();
})();
