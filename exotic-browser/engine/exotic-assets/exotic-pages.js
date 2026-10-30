/* ==========================================================================
   Exotic Browser — Private Browsing & Connection Error Pages
   Clean, Normal Browser Copy · Non-Bold Regular Typography Throughout
   Strictly Zero Borders · Zero Outlines · Zero Gradients · Monochrome #000/#FFF
   ========================================================================== */

(function mountExoticSpecialPage() {
  if (window.__exoticSpecialMounted) return;
  window.__exoticSpecialMounted = true;

  const href = (window.location && window.location.href) || "";
  const isPrivate = href.startsWith("about:privatebrowsing");
  const isNetError = href.startsWith("about:neterror") || href.includes("aboutNetError");
  if (!isPrivate && !isNetError) return;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";

  function h(tag, attrs, ...children) {
    const el = document.createElementNS(XHTML_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "className") el.setAttribute("class", v);
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
          ? document.createTextNode(String(c))
          : c
      );
    }
    return el;
  }

  function makeLogo(size = 24) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 28 28");
    const tile = document.createElementNS(SVG_NS, "rect");
    tile.setAttribute("x", "1");
    tile.setAttribute("y", "1");
    tile.setAttribute("width", "26");
    tile.setAttribute("height", "26");
    tile.setAttribute("rx", "6");
    tile.setAttribute("fill", "var(--ep-inv-bg)");
    svg.appendChild(tile);
    for (const [x, y, w, ht] of [
      [7, 6.8, 14, 2.6],
      [7, 12.7, 10.5, 2.6],
      [18.4, 12.7, 2.6, 2.6],
      [7, 18.6, 14, 2.6],
      [7, 6.8, 2.8, 8.5],
      [7, 16.8, 2.8, 4.4],
    ]) {
      const b = document.createElementNS(SVG_NS, "rect");
      b.setAttribute("x", String(x));
      b.setAttribute("y", String(y));
      b.setAttribute("width", String(w));
      b.setAttribute("height", String(ht));
      b.setAttribute("fill", "var(--ep-inv-fg)");
      svg.appendChild(b);
    }
    return svg;
  }

  document.documentElement.setAttribute("data-exotic-page", "ready");

  let content;
  if (isPrivate) {
    document.title = "Exotic - Private Browsing";
    const inp = h("input", {
      className: "ep-input",
      type: "text",
      placeholder: "Search with DuckDuckGo or enter address",
    });
    content = h(
      "div",
      { className: "ep-shell" },
      h(
        "div",
        { className: "ep-head" },
        h("div", { className: "ep-brand" }, makeLogo(24), h("span", null, "Exotic")),
        h("span", { className: "ep-pill" }, "Private window")
      ),
      h(
        "div",
        null,
        h("h1", { className: "ep-title" }, "Private Browsing"),
        h(
          "p",
          { className: "ep-desc" },
          "Exotic does not save your browsing history, cookies, site data, or search queries from private windows. Bookmarks you save and files you download will still be kept."
        )
      ),
      h(
        "form",
        {
          className: "ep-form",
          onSubmit: (e) => {
            e.preventDefault();
            const raw = (inp.value || "").trim();
            if (!raw) return;
            const isUrl =
              /^https?:\/\//i.test(raw) ||
              (!raw.includes(" ") && /^[a-z0-9-]+(\.[a-z]{2,})+/i.test(raw));
            window.location.href = isUrl
              ? /^https?:\/\//i.test(raw)
                ? raw
                : `https://${raw}`
              : `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`;
          },
        },
        inp,
        h("button", { className: "ep-btn", type: "submit" }, "Search")
      )
    );
    window.setTimeout(() => inp.focus(), 30);
  } else {
    document.title = "Exotic - Unable to connect";
    const params = new URLSearchParams(window.location.search || "");
    const targetUrl = params.get("u") || "this address";
    content = h(
      "div",
      { className: "ep-shell" },
      h(
        "div",
        { className: "ep-head" },
        h("div", { className: "ep-brand" }, makeLogo(24), h("span", null, "Exotic"))
      ),
      h(
        "div",
        null,
        h("h1", { className: "ep-title" }, "Unable to connect"),
        h(
          "p",
          { className: "ep-desc" },
          `Exotic could not connect to ${targetUrl}. Check that the web address is spelled correctly or check your network connection.`
        )
      ),
      h(
        "div",
        { className: "ep-actions" },
        h("button", { className: "ep-btn", onClick: () => window.location.reload() }, "Try again"),
        h("button", { className: "ep-btn ep-btn-tonal", onClick: () => window.history.back() }, "Go back")
      )
    );
  }

  const root = h("div", { id: "exotic-page-root" }, content);
  (document.body || document.documentElement).appendChild(root);
})();
