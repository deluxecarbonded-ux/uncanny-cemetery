/* ==========================================================================
   Exotic Browser — ExOS ("Exotic OS")
   A Ryoku-Linux-style desktop OS that boots inside a display in the browser:
   UEFI firmware log -> kernel splash -> windowed desktop with a top bar,
   app launcher, draggable/resizable windows, terminal, file manager, text
   editor, system monitor, system hub and calculator.

   Everything lives on a virtual hard disk (exos.vhd) persisted in the Exotic
   profile directory, with a prefs fallback. Registered as an Exotic Mod:
   `exotic.mods.exos` (see exotic://mods).
   ========================================================================== */

(function initExoticOS() {
  const win = window;
  const doc = win.document;
  if (!doc) return;
  if (win.__exoticOS) return;

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const OS_NAME = "ExOS";
  const OS_VERSION = "1.0";
  const OS_CODENAME = "Kintsugi";
  const KERNEL = "6.12.9-exos";
  function getSessionUser() {
    try {
      if (typeof Services !== "undefined" && Services && Services.env) {
        const u = Services.env.get("USER") || Services.env.get("USERNAME") || Services.env.get("LOGNAME");
        if (u) return String(u);
      }
    } catch (_) {}
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.userAgent) {
        return "user";
      }
    } catch (_) {}
    return "exo";
  }
  const USER = getSessionUser();
  const HOME = "/home/" + USER;
  function getSessionId() {
    try {
      if (typeof Services !== "undefined" && Services && Services.prefs) {
        let sid = null;
        try { sid = Services.prefs.getCharPref("exotic.exos.sessionId"); } catch (_) {}
        if (!sid) {
          try { sid = Services.prefs.getStringPref("exotic.exos.sessionId"); } catch (_) {}
        }
        if (sid && String(sid).length) return String(sid);
        sid = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        try { Services.prefs.setStringPref("exotic.exos.sessionId", sid); } catch (_) {}
        try { Services.prefs.setCharPref("exotic.exos.sessionId", sid); } catch (_) {}
        return sid;
      }
    } catch (_) {}
    try {
      if (typeof localStorage !== "undefined") {
        let sid = localStorage.getItem("exos.sessionId");
        if (!sid) {
          sid = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
          localStorage.setItem("exos.sessionId", sid);
        }
        return sid;
      }
    } catch (_) {}
    return "default";
  }
  const SESSION_ID = getSessionId();
  const DISK_NAME = "exos-" + SESSION_ID + ".vhd";
  const DISK_CAPACITY = 100 * 1024 * 1024 * 1024;

  const PREF_ENABLED = "exotic.mods.exos";
  const PREF_HOSTNAME = "exotic.exos.hostname";
  const PREF_WALL = "exotic.exos.wallpaper";
  const PREF_ACCENT = "exotic.exos.accent";
  const PREF_SCHEME = "exotic.exos.scheme";
  const PREF_WIDGET = "exotic.exos.widget";
  const PREF_IMAGE = "exotic.exos.vhd";
  const PREF_BACKEND = "exotic.exos.vhdBackend";
  const PREF_BOOTS = "exotic.exos.boots";

  // ---------------------------------------------------------------------------
  // Pref helpers (safe in both chrome windows and plain-page previews)
  // ---------------------------------------------------------------------------
  function hasServices() {
    return typeof Services !== "undefined" && !!Services && !!Services.prefs;
  }

  function getBool(name, def) {
    if (!hasServices()) {
      const raw = win.localStorage ? win.localStorage.getItem("exos.pref." + name) : null;
      return raw === null || raw === undefined ? !!def : raw === "1";
    }
    try {
      return Services.prefs.getBoolPref(name, !!def);
    } catch (_) {
      return !!def;
    }
  }

  function setBool(name, val) {
    if (!hasServices()) {
      if (win.localStorage) win.localStorage.setItem("exos.pref." + name, val ? "1" : "0");
      return;
    }
    try {
      Services.prefs.setBoolPref(name, !!val);
    } catch (_) {}
  }

  function getStr(name, def) {
    if (!hasServices()) {
      const raw = win.localStorage ? win.localStorage.getItem("exos.pref." + name) : null;
      return raw === null || raw === undefined ? def : raw;
    }
    try {
      const v = Services.prefs.getCharPref(name);
      return v === null || v === undefined ? def : v;
    } catch (_) {
      try {
        const v = Services.prefs.getStringPref(name);
        return v === null || v === undefined ? def : v;
      } catch (_) {
        return def;
      }
    }
  }

  function setStr(name, val) {
    if (!hasServices()) {
      if (win.localStorage) win.localStorage.setItem("exos.pref." + name, String(val));
      return;
    }
    try {
      Services.prefs.setStringPref(name, String(val));
    } catch (_) {
      try {
        Services.prefs.setCharPref(name, String(val));
      } catch (_) {}
    }
  }

  function getInt(name, def) {
    if (!hasServices()) {
      const raw = win.localStorage ? win.localStorage.getItem("exos.pref." + name) : null;
      const n = raw === null || raw === undefined ? NaN : parseInt(raw, 10);
      return isNaN(n) ? def : n;
    }
    try {
      return Services.prefs.getIntPref(name);
    } catch (_) {
      return def;
    }
  }

  function setInt(name, val) {
    if (!hasServices()) {
      if (win.localStorage) win.localStorage.setItem("exos.pref." + name, String(val));
      return;
    }
    try {
      Services.prefs.setIntPref(name, Number(val) | 0);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------
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

  function s(tag, attrs, ...children) {
    const el = doc.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith("on") && typeof v === "function") {
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

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function byteLen(str) {
    const v = String(str === null || str === undefined ? "" : str);
    let bytes = 0;
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      if (c < 0x80) bytes += 1;
      else if (c < 0x800) bytes += 2;
      else if (c >= 0xd800 && c <= 0xdbff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    }
    return bytes;
  }

  function fmtBytes(n) {
    const b = Number(n) || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KiB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MiB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GiB";
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function stampOf(ts) {
    const d = new Date(ts || Date.now());
    return (
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate()) +
      " " +
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes())
    );
  }

  // ---------------------------------------------------------------------------
  // Virtual hard disk backends: exos.vhd in the profile dir (preferred),
  // a string pref fallback, localStorage in plain-page previews.
  // ---------------------------------------------------------------------------
  function vhdFile() {
    if (!hasServices() || typeof Cc === "undefined" || typeof Ci === "undefined") return null;
    try {
      const f = Services.dirsvc.get("ProfD", Ci.nsIFile);
      f.append(DISK_NAME);
      return f;
    } catch (_) {
      return null;
    }
  }

  function readVhdFile() {
    const f = vhdFile();
    if (!f || !f.exists()) return null;
    // The image is written as UTF-8 (see writeVhdFile), so it must be read back
    // as UTF-8. Decoding byte-by-byte (nsIScriptableInputStream maps every byte
    // to one JS char, i.e. Latin-1) turned each non-ASCII character into
    // mojibake, and each following save re-encoded that mojibake as UTF-8 —
    // corrupting content and inflating the image on every boot.
    try {
      if (typeof IOUtils !== "undefined" && typeof IOUtils.readSync === "function") {
        return new TextDecoder("utf-8").decode(IOUtils.readSync(f.path));
      }
    } catch (_) {}
    try {
      const fis = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(
        Ci.nsIFileInputStream
      );
      fis.init(f, -1, -1, 0);
      const sis = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(
        Ci.nsIScriptableInputStream
      );
      sis.init(fis);
      let raw = "";
      let avail = 0;
      while ((avail = sis.available()) > 0) {
        raw += sis.read(avail);
      }
      sis.close();
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
      return new TextDecoder("utf-8").decode(bytes);
    } catch (_) {
      return null;
    }
  }

  function writeVhdFile(data) {
    const f = vhdFile();
    if (!f) return false;
    try {
      const fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(
        Ci.nsIFileOutputStream
      );
      fos.init(f, 0x02 | 0x08 | 0x20, 0o600, 0); // write + create + truncate
      const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(
        Ci.nsIConverterOutputStream
      );
      cos.init(fos, "UTF-8", 0, 0);
      cos.writeString(data);
      cos.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  function readImage() {
    if (hasServices()) {
      const fromFile = readVhdFile();
      if (fromFile) return fromFile;
      return getStr(PREF_IMAGE, "");
    }
    return win.localStorage ? win.localStorage.getItem(PREF_IMAGE) || "" : "";
  }

  function writeImage(data) {
    if (!hasServices()) {
      try {
        if (win.localStorage) win.localStorage.setItem(PREF_IMAGE, data);
        setStr(PREF_BACKEND, "localStorage");
        return true;
      } catch (_) {
        return false;
      }
    }
    if (writeVhdFile(data)) {
      setStr(PREF_BACKEND, "file");
      // Drop the pref copy once the real disk file is authoritative.
      try {
        Services.prefs.clearUserPref(PREF_IMAGE);
      } catch (_) {}
      return true;
    }
    setStr(PREF_BACKEND, "pref");
    setStr(PREF_IMAGE, data);
    return false;
  }

  // ---------------------------------------------------------------------------
  // Filesystem primitives
  // ---------------------------------------------------------------------------
  const INODE_BYTES = 4096;

  function mkDir(children) {
    return { t: "d", c: children || {}, m: Date.now() };
  }

  function mkFile(content) {
    return { t: "f", d: content || "", m: Date.now() };
  }

  function segments(absPath) {
    if (!absPath || absPath === "/") return [];
    return absPath.replace(/^\/+/, "").split("/");
  }

  function normalizePath(input, cwd) {
    let p = String(input === null || input === undefined ? "" : input).trim();
    if (!p) p = cwd || "/";
    if (p === "~") p = HOME;
    else if (p.startsWith("~/")) p = HOME + p.slice(1);
    const parts = (p.startsWith("/") ? p : (cwd || "/") + "/" + p).split("/");
    const out = [];
    for (const seg of parts) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        out.pop();
        continue;
      }
      out.push(seg);
    }
    return "/" + out.join("/");
  }

  function parentPathOf(absPath) {
    const segs = segments(absPath);
    segs.pop();
    return "/" + segs.join("/");
  }

  function nameOf(absPath) {
    const segs = segments(absPath);
    return segs.length ? segs[segs.length - 1] : "/";
  }

  function getNode(absPath) {
    let node = disk.root;
    for (const seg of segments(absPath)) {
      if (!node || node.t !== "d" || !node.c[seg]) return null;
      node = node.c[seg];
    }
    return node || null;
  }

  function nodeBytes(node) {
    if (!node) return 0;
    if (node.t === "f") return INODE_BYTES + byteLen(node.d);
    let total = INODE_BYTES;
    for (const key of Object.keys(node.c)) total += nodeBytes(node.c[key]);
    return total;
  }

  function diskUsage() {
    let used = INODE_BYTES;
    let files = 0;
    let dirs = 0;
    const walk = (node) => {
      for (const key of Object.keys(node.c)) {
        const child = node.c[key];
        if (child.t === "f") {
          files++;
          used += INODE_BYTES + byteLen(child.d);
        } else {
          dirs++;
          used += INODE_BYTES;
          walk(child);
        }
      }
    };
    walk(disk.root);
    return {
      used: used,
      capacity: disk.capacity || DISK_CAPACITY,
      free: Math.max(0, (disk.capacity || DISK_CAPACITY) - used),
      files: files,
      dirs: dirs,
    };
  }

  function listDir(absPath) {
    const node = getNode(absPath);
    if (!node) return { ok: false, err: "No such directory: " + absPath };
    if (node.t !== "d") return { ok: false, err: "Not a directory: " + absPath };
    const entries = Object.keys(node.c)
      .sort((a, b) => {
        const ka = node.c[a].t === "d" ? 0 : 1;
        const kb = node.c[b].t === "d" ? 0 : 1;
        if (ka !== kb) return ka - kb;
        return a.localeCompare(b);
      })
      .map((name) => ({ name: name, node: node.c[name] }));
    return { ok: true, entries: entries };
  }

  function mkdir(absPath, parents) {
    const existing = getNode(absPath);
    if (existing) return { ok: false, err: "File exists: " + absPath };
    const parentAbs = parentPathOf(absPath);
    const parentNode = getNode(parentAbs);
    if (!parentNode) {
      if (!parents) return { ok: false, err: "No such file or directory: " + parentAbs };
      const made = mkdir(parentAbs, true);
      if (!made.ok) return made;
    } else if (parentNode.t !== "d") {
      return { ok: false, err: "Not a directory: " + parentAbs };
    }
    const parent = getNode(parentAbs);
    if (!parent) return { ok: false, err: "No such file or directory: " + parentAbs };
    const usage = diskUsage();
    if (usage.used + INODE_BYTES > usage.capacity) {
      return { ok: false, err: "No space left on device (/dev/vda1)" };
    }
    parent.c[nameOf(absPath)] = mkDir();
    parent.m = Date.now();
    touchDirty();
    return { ok: true };
  }

  function writeFile(absPath, content) {
    const parentNode = getNode(parentPathOf(absPath));
    if (!parentNode || parentNode.t !== "d") {
      return { ok: false, err: "No such file or directory: " + parentPathOf(absPath) };
    }
    const existing = getNode(absPath);
    if (existing && existing.t === "d") return { ok: false, err: "Is a directory: " + absPath };
    const usage = diskUsage();
    const before = existing ? INODE_BYTES + byteLen(existing.d) : 0;
    const after = INODE_BYTES + byteLen(content);
    if (usage.used - before + after > usage.capacity) {
      return { ok: false, err: "No space left on device (/dev/vda1)" };
    }
    parentNode.c[nameOf(absPath)] = mkFile(content);
    parentNode.m = Date.now();
    touchDirty();
    return { ok: true };
  }

  function readFile(absPath) {
    const node = getNode(absPath);
    if (!node) return { ok: false, err: "No such file or directory: " + absPath };
    if (node.t === "d") return { ok: false, err: "Is a directory: " + absPath };
    return { ok: true, data: node.d };
  }

  function removeNode(absPath, recursive) {
    if (absPath === "/") return { ok: false, err: "Refusing to remove /" };
    const parentNode = getNode(parentPathOf(absPath));
    const name = nameOf(absPath);
    if (!parentNode || parentNode.t !== "d" || !parentNode.c[name]) {
      return { ok: false, err: "No such file or directory: " + absPath };
    }
    const node = parentNode.c[name];
    if (node.t === "d" && !recursive && Object.keys(node.c).length) {
      return { ok: false, err: "Directory not empty: " + absPath + " (use -r)" };
    }
    delete parentNode.c[name];
    parentNode.m = Date.now();
    touchDirty();
    return { ok: true };
  }

  function moveNode(srcAbs, dstAbs) {
    const srcParent = getNode(parentPathOf(srcAbs));
    const srcName = nameOf(srcAbs);
    if (!srcParent || !srcParent.c[srcName]) {
      return { ok: false, err: "No such file or directory: " + srcAbs };
    }
    let target = dstAbs;
    const dstNode = getNode(dstAbs);
    if (dstNode && dstNode.t === "d") target = (dstAbs === "/" ? "" : dstAbs) + "/" + srcName;
    const dstParent = getNode(parentPathOf(target));
    if (!dstParent || dstParent.t !== "d") {
      return { ok: false, err: "No such file or directory: " + parentPathOf(target) };
    }
    if (getNode(target)) return { ok: false, err: "Destination exists: " + target };
    // Never attach a directory inside its own subtree: `mv /home/exo
    // /home/exo/Documents` would build a cyclic node graph, after which
    // diskUsage()/serialize() recurse forever and every subsequent save throws
    // "Converting circular structure to JSON" (the disk stops persisting).
    if (target === srcAbs || target.startsWith(srcAbs + "/")) {
      return { ok: false, err: "Cannot move a directory into itself: " + srcAbs };
    }
    dstParent.c[nameOf(target)] = srcParent.c[srcName];
    delete srcParent.c[srcName];
    dstParent.m = Date.now();
    srcParent.m = Date.now();
    touchDirty();
    return { ok: true, path: target };
  }

  function copyNode(srcAbs, dstAbs) {
    const src = getNode(srcAbs);
    if (!src) return { ok: false, err: "No such file or directory: " + srcAbs };
    if (src.t === "d") return { ok: false, err: "Omitting directory: " + srcAbs };
    let target = dstAbs;
    const dstNode = getNode(dstAbs);
    if (dstNode && dstNode.t === "d") target = (dstAbs === "/" ? "" : dstAbs) + "/" + nameOf(srcAbs);
    return writeFile(target, src.d);
  }

  // ---------------------------------------------------------------------------
  // Image serialisation
  // ---------------------------------------------------------------------------
  let saveTimer = null;
  let disk = null;

  function serialize() {
    return JSON.stringify({
      magic: "EXOS-VHD",
      format: 1,
      label: "EXOS",
      created: disk.created,
      capacity: disk.capacity,
      root: disk.root,
    });
  }

  function deserialize(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.magic === "EXOS-VHD" && obj.root && obj.root.t === "d") {
        return {
          created: obj.created || Date.now(),
          capacity: obj.capacity || DISK_CAPACITY,
          root: obj.root,
        };
      }
    } catch (_) {}
    return null;
  }

  function persistNow() {
    if (saveTimer) {
      win.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!disk) return false;
    writeImage(serialize());
    return true;
  }

  function touchDirty() {
    if (saveTimer) win.clearTimeout(saveTimer);
    saveTimer = win.setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, 350);
  }

  // ---------------------------------------------------------------------------
  // Default disk image
  // ---------------------------------------------------------------------------
  function buildDefaultImage() {
    const now = Date.now();
    const d = (children) => ({ t: "d", c: children || {}, m: now });
    const f = (text) => ({ t: "f", d: text, m: now });

    const root = d({
      bin: d({}),
      boot: d({
        "vmlinuz-exos": f("(binary) ExOS kernel " + KERNEL + " x86_64\n"),
        "initramfs-exos": f("(binary) early userspace image\n"),
        "ExOS.splash": f("EXOS-SPLASH\n"),
      }),
      etc: d({
        hostname: f("exos\n"),
        motd: f(
          "  ______________________________________________________________\n" +
            " |  Welcome to ExOS " +
            OS_VERSION +
            " (" +
            OS_CODENAME +
            ") — a Ryoku-style desktop  |\n" +
            " |  living inside Exotic Browser. Type `help` for the shell,     |\n" +
            " |  `neofetch` for the system readout, `df -h` for the disk.    |\n" +
            " |______________________________________________________________|\n"
        ),
        "os-release": f(
          'NAME="ExOS"\n' +
            'PRETTY_NAME="ExOS ' +
            OS_VERSION +
            ' (' +
            OS_CODENAME +
            ')"\n' +
            "ID=exos\n" +
            "ID_LIKE=ryoku arch\n" +
            'VERSION_ID="' +
            OS_VERSION +
            '"\n' +
            'VARIANT="Virtual Hard Disk"\n' +
            "HOME_URL=\"exotic://os\"\n"
        ),
        fstab: f("/dev/vda1  /      ext4  defaults  0 1\n/dev/vda2  /home  ext4  defaults  0 2\n"),
        shell: f("/bin/exsh\n"),
        "exos-release": f("ExOS build 20261030.1 · kernel " + KERNEL + "\n"),
      }),
      home: d({
        [USER]: d({
          ".profile": f('export SHELL=/bin/exsh\nexport EDITOR=nano\nexport PS1="\\u@\\h:\\w$ "\n'),
          "README.txt": f(
            "ExOS " +
              OS_VERSION +
              " (" +
              OS_CODENAME +
              ")\n" +
              "=========================\n\n" +
              "This machine is a virtual desktop running inside Exotic Browser as an\n" +
              "Exotic Mod. Its whole world is the virtual hard disk you are looking at:\n\n" +
              "  " +
              DISK_NAME +
              " — " +
              fmtBytes(DISK_CAPACITY) +
              " image, mounted read-write at /\n\n" +
              "Try:\n" +
              "  neofetch        system readout\n" +
              "  ls -l           long listing\n" +
              "  nano README.txt edit this file (Text Editor)\n" +
              "  df -h           disk usage\n" +
              "  app monitor     system monitor\n" +
              "  format --yes    wipe the disk and start clean\n"
          ),
          Documents: d({
            "field-notes.txt": f(
              "Ryoku field notes\n" +
                "-----------------\n" +
                "· bar on top, launcher over it, widgets painted on the wallpaper\n" +
                "· accent is always the vermillion sun (#e2342a)\n" +
                "· kintsugi gold (#d9a441) for highlights\n" +
                "· warm bone type on pure black\n"
            ),
            "todo.md": f(
              "# todo\n\n- [x] boot ExOS inside the browser\n- [x] mount virtual hard disk\n" +
                "- [ ] write something in the editor\n- [ ] fill the disk (see: df -h)\n"
            ),
          }),
          Downloads: d({}),
          ".bashrc": f("alias ll='ls -l'\nalias ..='cd ..'\n"),
          ".local": d({
            share: d({
              applications: d({
                "gnome-software.desktop": f("[Desktop Entry]\nType=Application\nName=GNOME Software\nExec=gnome-software\nIcon=software\nCategories=Application;\n"),
                "discord-canary.desktop": f("[Desktop Entry]\nType=Application\nName=Discord Canary\nExec=discord-canary\nIcon=discord\nCategories=Application;\n"),
              }),
            }),
          }),
        }),
      }),
      mnt: d({}),
      proc: d({ "cpuinfo": f("model name: Exotic Virtual CPU (simulated)\n") }),
      tmp: d({}),
      usr: d({
        bin: d({}),
        share: d({ "exos-banner.txt": f(OS_NAME + " " + OS_VERSION + " (" + OS_CODENAME + ")\n") }),
      }),
      var: d({
        log: d({
          syslog: f(
            "[0.000000] ExOS kernel " + KERNEL + " booting\n" +
              "[0.041203] vda: ExOS Virtual Hard Disk attached\n" +
              "[0.118744] ext4 mounted at / (rw,relatime)\n" +
              "[0.402119] exosd: display server ready\n" +
              "[0.655010] reached target graphical.target\n"
          ),
        }),
      }),
    });

    return { created: now, capacity: DISK_CAPACITY, root: root };
  }

  function loadDisk() {
    const parsed = deserialize(readImage());
    disk = parsed || buildDefaultImage();
    if (!parsed) persistNow();
  }

  function formatDisk() {
    disk = buildDefaultImage();
    disk.created = Date.now();
    persistNow();
  }

  loadDisk();

  // ---------------------------------------------------------------------------
  // Shell settings
  // ---------------------------------------------------------------------------
  function hostname() {
    return getStr(PREF_HOSTNAME, "exos") || "exos";
  }

  function scheme() {
    const explicit = getStr(PREF_SCHEME, "auto");
    if (explicit === "dark" || explicit === "bone" || explicit === "rice" || explicit === "material") return explicit;
    if (hasServices()) {
      try {
        return Services.prefs.getCharPref("exotic.theme.mode") === "light" ? "bone" : "dark";
      } catch (_) {}
    }
    return "dark";
  }

  function accent() {
    const a = getStr(PREF_ACCENT, "vermillion");
    if (a === "gold") return "#d9a441";
    if (a === "bone") return "#f4efe6";
    return "#e2342a";
  }

  function wallpaper() {
    const w = getStr(PREF_WALL, "seal");
    return ["seal", "grid", "horizon", "void"].indexOf(w) >= 0 ? w : "seal";
  }

  function bootCount() {
    return getInt(PREF_BOOTS, 0);
  }

  // ---------------------------------------------------------------------------
  // Icons & marks
  // ---------------------------------------------------------------------------
  function sealSVG(size) {
    const px = size || 64;
    return s(
      "svg",
      {
        width: px,
        height: px,
        viewBox: "0 0 64 64",
        fill: "none",
        "aria-hidden": "true",
      },
      s("circle", { cx: 32, cy: 32, r: 29, stroke: "var(--eos-accent)", "stroke-width": 2 }),
      s("circle", {
        cx: 32,
        cy: 32,
        r: 23.5,
        stroke: "var(--eos-accent)",
        "stroke-width": 0.8,
        "stroke-opacity": 0.55,
      }),
      s(
        "text",
        {
          x: 32,
          y: 43,
          "text-anchor": "middle",
          "font-size": 30,
          "font-family": "'Yu Mincho','Noto Serif JP',serif",
          fill: "var(--eos-accent)",
        },
        "力"
      ),
      s("path", {
        d: "M32 3.5 A28.5 28.5 0 0 1 60.5 32",
        stroke: "var(--eos-gold)",
        "stroke-width": 2,
        "stroke-linecap": "round",
        fill: "none",
      })
    );
  }

  const ICON_PATHS = {
    terminal: [
      { d: "M4 5.5 9 10.5 4 15.5", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" },
      { d: "M10.5 15.5h5.5", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" },
    ],
    files: [
      { d: "M2.5 6.2a1.6 1.6 0 0 1 1.6-1.6h3.1l1.6 1.9h6.7a1.6 1.6 0 0 1 1.6 1.6v6.1a1.6 1.6 0 0 1-1.6 1.6H4.1a1.6 1.6 0 0 1-1.6-1.6Z", stroke: "currentColor", "stroke-width": 1.4, fill: "none", "stroke-linejoin": "round" },
    ],
    editor: [
      { d: "M4 3.6h7.2L15 7.4V16H4Z", stroke: "currentColor", "stroke-width": 1.4, fill: "none", "stroke-linejoin": "round" },
      { d: "M6.6 9.4h5.4M6.6 12.2h5.4", stroke: "currentColor", "stroke-width": 1.3, "stroke-linecap": "round" },
    ],
    monitor: [
      { d: "M3 16h13", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round" },
      { d: "M5.4 12.6 8.2 8.6l2.6 2.6 3.4-5", stroke: "currentColor", "stroke-width": 1.4, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" },
    ],
    hub: [
      { d: "M4 6h11M4 13h11", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round" },
      { tag: "circle", cx: 7.5, cy: 6, r: 2, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
      { tag: "circle", cx: 12, cy: 13, r: 2, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
    ],
    calc: [
      { tag: "rect", x: 4, y: 3, width: 11, height: 14, rx: 1.6, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
      { d: "M6.6 6.4h5.8M6.6 9.6h5.8M6.6 12.8h5.8", stroke: "currentColor", "stroke-width": 1.3, "stroke-linecap": "round" },
    ],
    about: [
      { tag: "circle", cx: 9.5, cy: 9.5, r: 6.6, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
      { d: "M9.5 8.4v4.4", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" },
      { tag: "circle", cx: 9.5, cy: 6.4, r: 0.95, fill: "currentColor" },
    ],
    software: [
      { tag: "circle", cx: 9.5, cy: 9.5, r: 6.6, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
      { d: "M6 9.5h7M9.5 12.5v-6", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round" },
      { d: "M12.5 9.5h-6", stroke: "currentColor", "stroke-width": 1.2, "stroke-linecap": "round" },
    ],
    kvm: [
      { tag: "rect", x: 3, y: 3, width: 13, height: 13, rx: 1.4, stroke: "currentColor", "stroke-width": 1.4, fill: "none" },
      { d: "M6 7.5h7M6 10.5h7M6 12.5h7", stroke: "currentColor", "stroke-width": 1.2, "stroke-linecap": "round" },
      { tag: "circle", cx: 9.5, cy: 9.5, r: 0.9, fill: "currentColor" },
    ],
    discord: [
      { d: "M6.5 4.5C5 5.5 4 7.5 4 10.5c0 3 1.5 5 3.5 5 .8 0 1.5-.3 2-.8l.5-.7.5.7c.5.5 1.2.8 2 .8 2 0 3.5-2 3.5-5 0-3-1-5-2.5-6", stroke: "currentColor", "stroke-width": 1.4, fill: "none", "stroke-linejoin": "round" },
      { tag: "circle", cx: 8, cy: 10, r: 1, fill: "currentColor" },
      { tag: "circle", cx: 12, cy: 10, r: 1, fill: "currentColor" },
    ],
  };

  function iconSVG(name, size) {
    const px = size || 18;
    const paths = ICON_PATHS[name] || ICON_PATHS.about;
    return s(
      "svg",
      { width: px, height: px, viewBox: "0 0 19 19", fill: "none", "aria-hidden": "true" },
      paths.map((p) => {
        const tag = p.tag || "path";
        const attrs = Object.assign({}, p);
        delete attrs.tag;
        return s(tag, attrs);
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Stylesheet (injected so the display stays self-contained)
  // ---------------------------------------------------------------------------
  const CSS_TEXT = `
  @font-face {
    font-family: "Exotic Sans";
    src: url("resource://exotic-assets/exotic-sans-regular.otf") format("opentype");
    font-weight: 100 900;
    font-style: normal;
  }

  #exotic-os {
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    z-index: 20000;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: "Exotic Sans", "Segoe UI", system-ui, sans-serif;
    color: var(--eos-fg);
    background-color: var(--eos-bg);
    color-scheme: dark;
    user-select: none;
    cursor: default;
  }
  #exotic-os,
  #exotic-os * { box-sizing: border-box; }
  #exotic-os * {
    font-weight: 400 !important;
    font-synthesis: none !important;
    letter-spacing: 0 !important;
    box-shadow: none;
  }

  #exotic-os[data-scheme="dark"] {
    --eos-bg: #050505;
    --eos-panel: #0d0d0d;
    --eos-panel-2: #141414;
    --eos-line: #232323;
    --eos-fg: #f1ebe1;
    --eos-muted: #8e877d;
    --eos-dim: #5d574f;
    --eos-gold: #d9a441;
    --eos-inv-bg: #f1ebe1;
    --eos-inv-fg: #0a0a0a;
    color-scheme: dark;
  }
  #exotic-os[data-scheme="bone"] {
    --eos-bg: #ece6db;
    --eos-panel: #f4efe6;
    --eos-panel-2: #e2dbcd;
    --eos-line: #cfc6b6;
    --eos-fg: #17150f;
    --eos-muted: #5d574f;
    --eos-dim: #8a8277;
    --eos-gold: #9a6f1c;
    --eos-inv-bg: #17150f;
    --eos-inv-fg: #f4efe6;
    color-scheme: light;
  }
  /* Rice — warm off-white "rice paper" palette (Material-adjacent surfaces) */
  #exotic-os[data-scheme="rice"] {
    --eos-bg: #fdf8f0;
    --eos-panel: #fbf3e6;
    --eos-panel-2: #f3e8d6;
    --eos-line: #e2d2b8;
    --eos-fg: #2a2419;
    --eos-muted: #6b6052;
    --eos-dim: #9a8c78;
    --eos-gold: #b8862a;
    --eos-inv-bg: #2a2419;
    --eos-inv-fg: #fdf8f0;
    color-scheme: light;
  }
  /* Material — layered grey surfaces with subtle depth (Material You) */
  #exotic-os[data-scheme="material"] {
    --eos-bg: #1c1b1f;
    --eos-panel: #26252a;
    --eos-panel-2: #312f36;
    --eos-line: #413e48;
    --eos-fg: #e6e1e5;
    --eos-muted: #9a93a0;
    --eos-dim: #6e6a76;
    --eos-gold: #e6b44a;
    --eos-inv-bg: #e6e1e5;
    --eos-inv-fg: #1c1b1f;
    color-scheme: dark;
  }
  #exotic-os { --eos-accent: #e2342a; }

  /* ---------- boot ---------- */
  #exotic-os .eos-bios,
  #exotic-os .eos-splash {
    position: absolute;
    inset: 0;
    background-color: #000000;
    color: #e8e2d7;
    display: none;
  }
  #exotic-os[data-stage="bios"] .eos-bios { display: block; }
  #exotic-os[data-stage="splash"] .eos-splash { display: flex; }
  #exotic-os .eos-bios {
    padding: 26px 30px;
    font-family: "Cascadia Mono", "Consolas", "DejaVu Sans Mono", monospace;
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow: hidden;
  }
  #exotic-os .eos-log-ok { color: #7fc98a; }
  #exotic-os .eos-log-hi { color: #e2342a; }
  #exotic-os .eos-bios-hint {
    position: absolute;
    right: 26px;
    bottom: 20px;
    color: #6a655d;
    font-size: 11.5px;
  }
  #exotic-os .eos-splash {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  #exotic-os .eos-splash-seal { animation: eos-spin-in 620ms ease-out both; }
  #exotic-os .eos-splash-name {
    font-size: 44px;
    color: #f1ebe1;
  }
  #exotic-os .eos-splash-sub {
    font-size: 12.5px;
    color: #8e877d;
    font-family: "Cascadia Mono", "Consolas", monospace;
  }
  #exotic-os .eos-splash-track {
    width: 240px;
    height: 3px;
    background-color: #1d1d1d;
    overflow: hidden;
  }
  #exotic-os .eos-splash-fill {
    width: 0%;
    height: 100%;
    background-color: #e2342a;
    transition: width 160ms linear;
  }
  @keyframes eos-spin-in {
    from { transform: rotate(-40deg) scale(0.7); opacity: 0; }
    to { transform: rotate(0deg) scale(1); opacity: 1; }
  }

  /* ---------- stage ---------- */
  #exotic-os .eos-stage {
    position: absolute;
    inset: 0;
    display: none;
    overflow: hidden;
  }
  #exotic-os[data-stage="desktop"] .eos-stage { display: block; }

  #exotic-os .eos-wall {
    position: absolute;
    inset: 0;
    background-color: #050505;
    background-repeat: no-repeat;
    background-position: center;
  }
  #exotic-os[data-scheme="bone"] .eos-wall { background-color: #ece6db; }
  #exotic-os[data-scheme="rice"] .eos-wall { background-color: #fdf8f0; }
  #exotic-os[data-scheme="material"] .eos-wall { background-color: #1c1b1f; }
  #exotic-os[data-scheme="rice"] .eos-wall[data-wall="grid"] {
    background-image:
      repeating-linear-gradient(0deg, rgba(42,36,25,0.06) 0px, rgba(42,36,25,0.06) 1px, transparent 1px, transparent 44px),
      repeating-linear-gradient(90deg, rgba(42,36,25,0.06) 0px, rgba(42,36,25,0.06) 1px, transparent 1px, transparent 44px);
  }
  #exotic-os[data-scheme="material"] .eos-wall[data-wall="grid"] {
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 44px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 44px);
  }
  #exotic-os .eos-wall[data-wall="seal"] {
    background-image:
      radial-gradient(circle at 78% 84%, rgba(226, 52, 42, 0.2) 0%, rgba(226, 52, 42, 0) 46%),
      radial-gradient(circle at 20% 12%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 55%);
  }
  #exotic-os .eos-wall[data-wall="grid"] {
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 44px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 44px);
  }
  #exotic-os[data-scheme="bone"] .eos-wall[data-wall="grid"] {
    background-image:
      repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 44px),
      repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 44px);
  }
  #exotic-os .eos-wall[data-wall="horizon"] {
    background-image:
      linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 48%),
      linear-gradient(0deg, rgba(226,52,42,0.14) 0%, rgba(226,52,42,0) 28%);
  }
  #exotic-os .eos-wall-mark {
    position: absolute;
    right: 6vw;
    bottom: 5vh;
    font-size: 30vh;
    line-height: 1;
    font-family: "Yu Mincho", "Noto Serif JP", serif;
    color: var(--eos-accent);
    opacity: 0.09;
    pointer-events: none;
  }

  /* ---------- top bar ---------- */
  #exotic-os .eos-bar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    background-color: rgba(5, 5, 5, 0.94);
    border-bottom: 1px solid var(--eos-line);
    z-index: 40;
  }
  #exotic-os[data-scheme="bone"] .eos-bar { background-color: rgba(244, 239, 230, 0.95); }
  #exotic-os .eos-brand {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 26px;
    padding: 0 11px;
    border: none;
    border-radius: 99px;
    background-color: var(--eos-panel-2);
    color: var(--eos-fg);
    font-size: 12.5px;
    cursor: pointer;
  }
  #exotic-os .eos-brand:hover { background-color: var(--eos-accent); color: #ffffff; }
  #exotic-os .eos-brand-seal {
    font-family: "Yu Mincho", "Noto Serif JP", serif;
    font-size: 13px;
    color: var(--eos-accent);
  }
  #exotic-os .eos-brand:hover .eos-brand-seal { color: #ffffff; }
  #exotic-os .eos-bar-sep { width: 1px; height: 18px; background-color: var(--eos-line); flex-shrink: 0; }
  #exotic-os .eos-tasks { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
  #exotic-os .eos-task {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    max-width: 190px;
    padding: 0 10px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    color: var(--eos-muted);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #exotic-os .eos-task:hover { background-color: var(--eos-panel-2); color: var(--eos-fg); }
  #exotic-os .eos-task[data-active="true"] {
    background-color: var(--eos-panel-2);
    color: var(--eos-fg);
    box-shadow: inset 0 -2px 0 var(--eos-accent) !important;
  }
  #exotic-os .eos-task[data-min="true"] { opacity: 0.55; }
  #exotic-os .eos-bar-title {
    flex: 1;
    text-align: center;
    font-size: 12px;
    color: var(--eos-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  #exotic-os .eos-bar-right { display: flex; align-items: center; gap: 6px; }
  #exotic-os .eos-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 24px;
    padding: 0 10px;
    border: none;
    border-radius: 99px;
    background-color: var(--eos-panel-2);
    color: var(--eos-muted);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    cursor: default;
  }
  #exotic-os .eos-pill.eos-click { cursor: pointer; }
  #exotic-os .eos-pill.eos-click:hover { color: var(--eos-fg); background-color: var(--eos-line); }
  #exotic-os .eos-disk-mini {
    width: 46px;
    height: 4px;
    background-color: var(--eos-line);
    overflow: hidden;
    border-radius: 2px;
  }
  #exotic-os .eos-disk-mini > i {
    display: block;
    height: 100%;
    background-color: var(--eos-accent);
  }
  #exotic-os .eos-power-menu {
    position: absolute;
    right: 8px;
    top: 42px;
    width: 214px;
    background-color: var(--eos-panel);
    border: 1px solid var(--eos-line);
    border-radius: 10px;
    padding: 6px;
    display: none;
    z-index: 60;
  }
  #exotic-os .eos-power-menu[data-open="true"] { display: block; }
  #exotic-os .eos-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    color: var(--eos-fg);
    font-size: 12.5px;
    cursor: pointer;
    text-align: left;
  }
  #exotic-os .eos-menu-item:hover { background-color: var(--eos-panel-2); }
  #exotic-os .eos-menu-item[data-danger]:hover { background-color: var(--eos-accent); color: #ffffff; }
  #exotic-os .eos-menu-hint { color: var(--eos-dim); font-size: 11px; }

  /* ---------- desktop widget ---------- */
  #exotic-os .eos-widget {
    position: absolute;
    left: 44px;
    top: 76px;
    z-index: 5;
    pointer-events: none;
    color: var(--eos-fg);
  }
  #exotic-os .eos-widget[hidden] { display: none; }
  #exotic-os .eos-w-time {
    font-size: 74px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--eos-fg);
  }
  #exotic-os .eos-w-date { font-size: 15px; color: var(--eos-muted); margin-top: 8px; }
  #exotic-os .eos-w-meta {
    margin-top: 22px;
    font-size: 12px;
    color: var(--eos-dim);
    font-family: "Cascadia Mono", "Consolas", monospace;
    line-height: 1.7;
  }
  #exotic-os .eos-w-meta b { color: var(--eos-accent); font-weight: 400; }
  #exotic-os .eos-w-track {
    margin-top: 12px;
    width: 190px;
    height: 3px;
    background-color: var(--eos-line);
    overflow: hidden;
  }
  #exotic-os .eos-w-track > i { display: block; height: 100%; background-color: var(--eos-accent); }

  /* ---------- launcher ---------- */
  #exotic-os .eos-launcher {
    position: absolute;
    left: 10px;
    top: 44px;
    width: 340px;
    background-color: var(--eos-panel);
    border: 1px solid var(--eos-line);
    border-radius: 14px;
    padding: 12px;
    z-index: 70;
    display: none;
  }
  #exotic-os .eos-launcher[data-open="true"] { display: block; }
  #exotic-os .eos-search {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--eos-line);
    border-radius: 8px;
    background-color: var(--eos-panel-2);
    color: var(--eos-fg);
    font-size: 13px;
    margin-bottom: 10px;
  }
  #exotic-os .eos-search::placeholder { color: var(--eos-dim); }
  #exotic-os .eos-apps { display: flex; flex-direction: column; gap: 2px; max-height: 46vh; overflow-y: auto; }
  #exotic-os .eos-app {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 9px 10px;
    border: none;
    border-radius: 8px;
    background-color: transparent;
    color: var(--eos-fg);
    cursor: pointer;
    text-align: left;
  }
  #exotic-os .eos-app:hover,
  #exotic-os .eos-app[data-sel="true"] { background-color: var(--eos-panel-2); }
  #exotic-os .eos-app-ico {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--eos-line);
    border-radius: 8px;
    color: var(--eos-accent);
    flex-shrink: 0;
  }
  #exotic-os .eos-app-txt { min-width: 0; }
  #exotic-os .eos-app-name { font-size: 13px; color: var(--eos-fg); }
  #exotic-os .eos-app-desc {
    font-size: 11.5px;
    color: var(--eos-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #exotic-os .eos-launcher-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--eos-line);
    font-size: 11.5px;
    color: var(--eos-dim);
  }

/* ---------- desktop icons ---------- */
  #exotic-os .eos-desktop-icons {
    position: absolute;
    left: 16px;
    top: 52px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    pointer-events: auto;
  }
  #exotic-os .eos-desktop-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 72px;
    padding: 8px 4px;
    border: none;
    border-radius: 8px;
    background-color: transparent;
    color: var(--eos-fg);
    cursor: pointer;
    text-align: center;
  }
  #exotic-os .eos-desktop-icon:hover { background-color: rgba(255, 255, 255, 0.08); }
  #exotic-os[data-scheme="bone"] .eos-desktop-icon:hover { background-color: rgba(0, 0, 0, 0.06); }
  #exotic-os[data-scheme="rice"] .eos-desktop-icon:hover { background-color: rgba(42, 36, 25, 0.08); }
  #exotic-os[data-scheme="material"] .eos-desktop-icon:hover { background-color: rgba(255, 255, 255, 0.10); }
  #exotic-os .eos-desktop-icon .eos-dicon-img {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background-color: var(--eos-panel-2);
    color: var(--eos-accent);
  }
  #exotic-os .eos-desktop-icon .eos-dicon-label {
    font-size: 11px;
    color: var(--eos-fg);
    word-break: break-word;
    line-height: 1.2;
    max-width: 68px;
  }

  /* ---------- windows ---------- */
  #exotic-os .eos-wins {
    position: absolute;
    left: 0;
    right: 0;
    top: 36px;
    bottom: 0;
    overflow: hidden;
    z-index: 20;
  }
  #exotic-os .eos-win {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 300px;
    min-height: 180px;
    background-color: var(--eos-panel);
    border: 1px solid var(--eos-line);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
  }
  #exotic-os .eos-win[data-active="false"] { box-shadow: 0 10px 26px rgba(0, 0, 0, 0.3); }
  #exotic-os .eos-win[data-active="false"] .eos-win-bar { opacity: 0.72; }
  #exotic-os .eos-win[data-min="true"] { display: none; }
  #exotic-os .eos-win-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 6px 0 10px;
    background-color: var(--eos-panel-2);
    border-bottom: 1px solid var(--eos-line);
    cursor: move;
    flex-shrink: 0;
  }
  #exotic-os .eos-win-ico { color: var(--eos-accent); display: flex; }
  #exotic-os .eos-win-title {
    flex: 1;
    font-size: 12.5px;
    color: var(--eos-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #exotic-os .eos-win-ctl { display: flex; gap: 2px; }
  #exotic-os .eos-win-btn {
    width: 26px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    color: var(--eos-muted);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #exotic-os .eos-win-btn:hover { background-color: var(--eos-line); color: var(--eos-fg); }
  #exotic-os .eos-win-btn.eos-close:hover { background-color: var(--eos-accent); color: #ffffff; }
  #exotic-os .eos-win-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background-color: var(--eos-panel);
    position: relative;
  }
  #exotic-os .eos-win-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    z-index: 5;
    background-image: linear-gradient(135deg, transparent 0 55%, var(--eos-line) 55% 62%, transparent 62% 72%, var(--eos-line) 72% 79%, transparent 79%);
  }

  /* ---------- shared app chrome ---------- */
  #exotic-os .eos-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 8px;
    border-bottom: 1px solid var(--eos-line);
    background-color: var(--eos-panel-2);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  #exotic-os .eos-btn {
    height: 27px;
    padding: 0 11px;
    border: 1px solid var(--eos-line);
    border-radius: 6px;
    background-color: var(--eos-panel);
    color: var(--eos-fg);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
  }
  #exotic-os .eos-btn:hover:not(:disabled) { background-color: var(--eos-line); }
  #exotic-os .eos-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  #exotic-os .eos-btn-primary { background-color: var(--eos-inv-bg); color: var(--eos-inv-fg); border-color: var(--eos-inv-bg); }
  #exotic-os .eos-btn-primary:hover:not(:disabled) { opacity: 0.88; background-color: var(--eos-inv-bg); }
  #exotic-os .eos-btn-danger { background-color: var(--eos-accent); border-color: var(--eos-accent); color: #ffffff; }
  #exotic-os .eos-btn-ghost { border-color: transparent; background-color: transparent; color: var(--eos-muted); }
  #exotic-os .eos-btn-ghost:hover:not(:disabled) { color: var(--eos-fg); background-color: var(--eos-panel-2); }
  #exotic-os .eos-input {
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--eos-line);
    border-radius: 6px;
    background-color: var(--eos-panel-2);
    color: var(--eos-fg);
    font-size: 13px;
  }
  #exotic-os .eos-path {
    font-size: 12px;
    color: var(--eos-muted);
    font-family: "Cascadia Mono", "Consolas", monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #exotic-os .eos-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 10px;
    border-top: 1px solid var(--eos-line);
    background-color: var(--eos-panel-2);
    font-size: 11.5px;
    color: var(--eos-dim);
    flex-shrink: 0;
  }
  #exotic-os .eos-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--eos-dim);
    font-size: 13px;
  }

  /* ---------- terminal ---------- */
  #exotic-os .eos-term {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #070707;
    color: #e9e3d8;
    font-family: "Cascadia Mono", "Consolas", "DejaVu Sans Mono", monospace;
    font-size: 12.5px;
    line-height: 1.55;
  }
  #exotic-os .eos-term-out {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    cursor: text;
  }
  #exotic-os .eos-err { color: #ff7b6b; }
  #exotic-os .eos-dimtext { color: #7e786f; }
  #exotic-os .eos-acc { color: var(--eos-accent); }
  #exotic-os .eos-goldtext { color: #d9a441; }
  #exotic-os .eos-oktext { color: #7fc98a; }
  #exotic-os .eos-prompt-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 12px;
    border-top: 1px solid #161616;
  }
  #exotic-os .eos-prompt-txt { color: #7fc98a; white-space: nowrap; }
  #exotic-os .eos-prompt-txt .eos-at { color: #e2342a; }
  #exotic-os .eos-term-in {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f1ebe1;
    font-family: inherit;
    font-size: inherit;
    caret-color: #e2342a;
  }

  /* ---------- files ---------- */
  #exotic-os .eos-files { display: flex; flex-direction: column; height: 100%; }
  #exotic-os .eos-fs-list { flex: 1; overflow-y: auto; padding: 6px; }
  #exotic-os .eos-fs-row {
    display: grid;
    grid-template-columns: 1fr 92px 132px;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    color: var(--eos-fg);
    font-size: 12.5px;
    cursor: pointer;
    text-align: left;
  }
  #exotic-os .eos-fs-row:hover { background-color: var(--eos-panel-2); }
  #exotic-os .eos-fs-row[data-sel="true"] { background-color: var(--eos-line); }
  #exotic-os .eos-fs-name { display: flex; align-items: center; gap: 9px; min-width: 0; }
  #exotic-os .eos-fs-name span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #exotic-os .eos-fs-ico { color: var(--eos-accent); display: flex; flex-shrink: 0; }
  #exotic-os .eos-fs-ico.file { color: var(--eos-dim); }
  #exotic-os .eos-fs-meta { color: var(--eos-dim); font-size: 11.5px; text-align: right; }
  #exotic-os .eos-fs-head {
    display: grid;
    grid-template-columns: 1fr 92px 132px;
    gap: 10px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--eos-line);
    color: var(--eos-dim);
    font-size: 11px;
    text-transform: uppercase;
  }

  /* ---------- editor ---------- */
  #exotic-os .eos-ed { display: flex; flex-direction: column; height: 100%; }
  #exotic-os .eos-ed-area {
    flex: 1;
    width: 100%;
    resize: none;
    border: none;
    outline: none;
    padding: 12px 14px;
    background-color: var(--eos-panel);
    color: var(--eos-fg);
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: 12.5px;
    line-height: 1.6;
    user-select: text;
  }

  /* ---------- monitor / hub / about ---------- */
  #exotic-os .eos-scroll { height: 100%; overflow-y: auto; padding: 14px; }
  #exotic-os .eos-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 10px; }
  #exotic-os .eos-card {
    background-color: var(--eos-panel-2);
    border: 1px solid var(--eos-line);
    border-radius: 10px;
    padding: 12px 13px;
  }
  #exotic-os .eos-card-t { font-size: 11.5px; color: var(--eos-dim); text-transform: uppercase; }
  #exotic-os .eos-card-v { font-size: 21px; color: var(--eos-fg); margin-top: 6px; font-variant-numeric: tabular-nums; }
  #exotic-os .eos-card-s { font-size: 11.5px; color: var(--eos-muted); margin-top: 4px; }
  #exotic-os .eos-track {
    height: 6px;
    background-color: var(--eos-line);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 10px;
  }
  #exotic-os .eos-track > i { display: block; height: 100%; background-color: var(--eos-accent); }
  #exotic-os .eos-track.gold > i { background-color: var(--eos-gold); }
  #exotic-os .eos-sec { margin-top: 18px; }
  #exotic-os .eos-sec-h {
    font-size: 12px;
    color: var(--eos-accent);
    text-transform: uppercase;
    margin-bottom: 9px;
  }
  #exotic-os .eos-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background-color: var(--eos-panel-2);
    border: 1px solid var(--eos-line);
    border-radius: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  #exotic-os .eos-row-l { min-width: 0; }
  #exotic-os .eos-row-t { font-size: 13px; color: var(--eos-fg); }
  #exotic-os .eos-row-s { font-size: 11.5px; color: var(--eos-dim); margin-top: 3px; }
  #exotic-os .eos-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  #exotic-os .eos-chip {
    height: 26px;
    padding: 0 11px;
    border: 1px solid var(--eos-line);
    border-radius: 99px;
    background-color: transparent;
    color: var(--eos-muted);
    font-size: 11.5px;
    cursor: pointer;
  }
  #exotic-os .eos-chip:hover { color: var(--eos-fg); }
  #exotic-os .eos-chip[data-on="true"] {
    background-color: var(--eos-accent);
    border-color: var(--eos-accent);
    color: #ffffff;
  }
  #exotic-os .eos-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  #exotic-os .eos-table th {
    text-align: left;
    color: var(--eos-dim);
    font-size: 11px;
    text-transform: uppercase;
    padding: 6px 8px;
    border-bottom: 1px solid var(--eos-line);
    font-weight: 400;
  }
  #exotic-os .eos-table td {
    padding: 7px 8px;
    border-bottom: 1px solid var(--eos-line);
    color: var(--eos-fg);
  }
  #exotic-os .eos-table td.dim { color: var(--eos-dim); }
  #exotic-os .eos-kv { display: grid; grid-template-columns: 152px 1fr; gap: 6px 14px; font-size: 12.5px; }
  #exotic-os .eos-kv dt { color: var(--eos-dim); }
  #exotic-os .eos-kv dd { margin: 0; color: var(--eos-fg); word-break: break-word; }

  /* ---------- calculator ---------- */
  #exotic-os .eos-calc { display: flex; flex-direction: column; height: 100%; padding: 12px; gap: 10px; }
  #exotic-os .eos-calc-disp {
    background-color: #070707;
    color: #f1ebe1;
    border: 1px solid var(--eos-line);
    border-radius: 8px;
    padding: 12px 14px;
    text-align: right;
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: 28px;
    min-height: 62px;
    word-break: break-all;
    user-select: text;
  }
  #exotic-os .eos-calc-disp small { display: block; font-size: 12px; color: #7e786f; min-height: 16px; }
  #exotic-os .eos-calc-grid { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
  #exotic-os .eos-calc-grid button {
    border: 1px solid var(--eos-line);
    border-radius: 8px;
    background-color: var(--eos-panel-2);
    color: var(--eos-fg);
    font-size: 15px;
    cursor: pointer;
  }
  #exotic-os .eos-calc-grid button:hover { background-color: var(--eos-line); }
  #exotic-os .eos-calc-grid button.op { color: var(--eos-accent); }
  #exotic-os .eos-calc-grid button.eq { background-color: var(--eos-accent); border-color: var(--eos-accent); color: #ffffff; }

  /* ---------- modal ---------- */
  #exotic-os .eos-modal {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.55);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 90;
  }
  #exotic-os .eos-modal[data-open="true"] { display: flex; }
  #exotic-os .eos-modal-card {
    width: min(400px, calc(100vw - 60px));
    background-color: var(--eos-panel);
    border: 1px solid var(--eos-line);
    border-radius: 12px;
    padding: 18px;
  }
  #exotic-os .eos-modal-t { font-size: 15px; color: var(--eos-fg); }
  #exotic-os .eos-modal-d { font-size: 12.5px; color: var(--eos-muted); margin-top: 7px; line-height: 1.5; }
  #exotic-os .eos-modal-f { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  #exotic-os .eos-modal .eos-input { width: 100%; margin-top: 12px; }

  /* ---------- Material & Rice visual overrides ----------
     Keep Ryoku's layout, icons, seal, wallpaper, top bar, terminal and
     file manager intact — only the surface language changes: larger radii,
     layered elevation shadows, subtle backdrop blur on the bar and a
     press-ripple on every button. */
  #exotic-os[data-scheme="material"] .eos-bar {
    background-color: rgba(38, 37, 42, 0.72);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
  }
  #exotic-os[data-scheme="material"] .eos-launcher,
  #exotic-os[data-scheme="material"] .eos-win,
  #exotic-os[data-scheme="material"] .eos-power-menu,
  #exotic-os[data-scheme="material"] .eos-modal-card,
  #exotic-os[data-scheme="material"] .eos-card,
  #exotic-os[data-scheme="material"] .eos-row {
    border-radius: 18px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.30);
  }
  #exotic-os[data-scheme="material"] .eos-win[data-active="false"] {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.22);
  }
  #exotic-os[data-scheme="material"] .eos-btn,
  #exotic-os[data-scheme="material"] .eos-task,
  #exotic-os[data-scheme="material"] .eos-app,
  #exotic-os[data-scheme="material"] .eos-fs-row,
  #exotic-os[data-scheme="material"] .eos-menu-item,
  #exotic-os[data-scheme="material"] .eos-calc-grid button,
  #exotic-os[data-scheme="material"] .eos-search,
  #exotic-os[data-scheme="material"] .eos-input,
  #exotic-os[data-scheme="material"] .eos-chip {
    border-radius: 14px;
  }
  #exotic-os[data-scheme="material"] .eos-btn-primary {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(226, 52, 42, 0.35);
  }
  #exotic-os[data-scheme="material"] .eos-btn:active:not(:disabled),
  #exotic-os[data-scheme="material"] .eos-task:active,
  #exotic-os[data-scheme="material"] .eos-app:active,
  #exotic-os[data-scheme="material"] .eos-chip:active {
    transform: scale(0.97);
    transition: transform 70ms ease;
  }

  /* Rice — same Material surface language on warm rice-paper tones */
  #exotic-os[data-scheme="rice"] .eos-bar {
    background-color: rgba(253, 248, 240, 0.78);
    backdrop-filter: blur(14px) saturate(130%);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
  }
  #exotic-os[data-scheme="rice"] .eos-launcher,
  #exotic-os[data-scheme="rice"] .eos-win,
  #exotic-os[data-scheme="rice"] .eos-power-menu,
  #exotic-os[data-scheme="rice"] .eos-modal-card,
  #exotic-os[data-scheme="rice"] .eos-card,
  #exotic-os[data-scheme="rice"] .eos-row {
    border-radius: 18px;
    box-shadow: 0 1px 2px rgba(42, 36, 25, 0.10), 0 6px 18px rgba(42, 36, 25, 0.14);
  }
  #exotic-os[data-scheme="rice"] .eos-btn,
  #exotic-os[data-scheme="rice"] .eos-task,
  #exotic-os[data-scheme="rice"] .eos-app,
  #exotic-os[data-scheme="rice"] .eos-fs-row,
  #exotic-os[data-scheme="rice"] .eos-menu-item,
  #exotic-os[data-scheme="rice"] .eos-calc-grid button,
  #exotic-os[data-scheme="rice"] .eos-search,
  #exotic-os[data-scheme="rice"] .eos-input,
  #exotic-os[data-scheme="rice"] .eos-chip {
    border-radius: 14px;
  }
  #exotic-os[data-scheme="rice"] .eos-btn-primary {
    box-shadow: 0 1px 2px rgba(42, 36, 25, 0.18), 0 4px 10px rgba(226, 52, 42, 0.28);
  }
  #exotic-os[data-scheme="rice"] .eos-btn:active:not(:disabled),
  #exotic-os[data-scheme="rice"] .eos-task:active,
  #exotic-os[data-scheme="rice"] .eos-app:active,
  #exotic-os[data-scheme="rice"] .eos-chip:active {
    transform: scale(0.97);
    transition: transform 70ms ease;
  }

  /* ---------- halt ---------- */
  #exotic-os .eos-halt {
    position: absolute;
    inset: 0;
    background-color: #000000;
    color: #8e877d;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    z-index: 95;
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: 13px;
    text-align: center;
  }
  #exotic-os .eos-halt[data-open="true"] { display: flex; }
  #exotic-os .eos-halt b { color: #f1ebe1; font-weight: 400; font-size: 17px; }
  #exotic-os ::-webkit-scrollbar { width: 10px; height: 10px; }
  #exotic-os ::-webkit-scrollbar-thumb { background-color: var(--eos-line); border-radius: 6px; }
  #exotic-os ::-webkit-scrollbar-track { background-color: transparent; }
  `;

  function injectStyle() {
    if (doc.getElementById("exotic-os-style")) return;
    (doc.head || doc.documentElement).appendChild(
      h("style", { id: "exotic-os-style" }, CSS_TEXT)
    );
  }
  // ---------------------------------------------------------------------------
  // Runtime state
  // ---------------------------------------------------------------------------
  let displayEl = null;
  let biosEl = null;
  let splashFill = null;
  let splashSub = null;
  let stageEl = null;
  let desktopIconsEl = null;
  let tasksEl = null;
  let barTitleEl = null;
  let clockEl = null;
  let diskTxtEl = null;
  let diskFillEl = null;
  let powerMenuEl = null;
  let launcherEl = null;
  let searchEl = null;
  let appsListEl = null;
  let widgetEl = null;
  let widgetTimeEl = null;
  let widgetDateEl = null;
  let widgetMetaEl = null;
  let widgetFillEl = null;
  let modalEl = null;
  let haltEl = null;

  const openWindows = new Map();
  const liveTimers = new Set();
  let zCounter = 100;
  let pidCounter = 100;
  let focusedPid = null;
  let bootEpoch = Date.now();
  let clockTimer = null;
  let stage = "idle";
  let powerOpen = false;
  let launcherOpen = false;

  function later(fn, ms) {
    const id = win.setTimeout(() => {
      liveTimers.delete(id);
      fn();
    }, ms);
    liveTimers.add(id);
    return id;
  }

  function clearTimers() {
    for (const id of liveTimers) win.clearTimeout(id);
    liveTimers.clear();
  }

  function uptimeString() {
    const secs = Math.max(0, Math.floor((Date.now() - bootEpoch) / 1000));
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return hrs + "h " + (mins % 60) + "m";
    if (mins > 0) return mins + "m " + (secs % 60) + "s";
    return secs + "s";
  }

  function memSnapshot() {
    const total = 2048;
    const used = 512 + openWindows.size * 96 + (stage === "desktop" ? 64 : 0);
    return { total: total, used: Math.min(total, used) };
  }

  // ---------------------------------------------------------------------------
  // In-OS dialogs
  // ---------------------------------------------------------------------------
  function closeModalDialog() {
    if (modalEl) modalEl.setAttribute("data-open", "false");
  }

  function openModalDialog(opts) {
    if (!modalEl) return;
    clearEl(modalEl);
    const card = h("div", { className: "eos-modal-card", role: "dialog", "aria-modal": "true" },
      h("div", { className: "eos-modal-t" }, opts.title || "ExOS"),
      opts.desc ? h("div", { className: "eos-modal-d" }, opts.desc) : null
    );
    let input = null;
    if (opts.input !== undefined && opts.input !== null) {
      input = h("input", {
        className: "eos-input",
        type: "text",
        spellcheck: "false",
        value: opts.input,
      });
      card.appendChild(input);
    }
    const cancelBtn = h("button", { className: "eos-btn", type: "button" }, opts.cancelLabel || "Cancel");
    const okBtn = h(
      "button",
      {
        className: "eos-btn " + (opts.danger ? "eos-btn-danger" : "eos-btn-primary"),
        type: "button",
      },
      opts.okLabel || "OK"
    );
    const finish = (ok) => {
      closeModalDialog();
      const value = input ? input.value : undefined;
      if (ok && opts.onOk) opts.onOk(value);
      if (!ok && opts.onCancel) opts.onCancel();
    };
    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
    if (input) {
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      });
    }
    card.appendChild(h("div", { className: "eos-modal-f" }, cancelBtn, okBtn));
    modalEl.appendChild(card);
    modalEl.setAttribute("data-open", "true");
    if (input) {
      later(() => {
        try {
          input.focus();
          input.select();
        } catch (_) {}
      }, 20);
    } else {
      later(() => {
        try {
          okBtn.focus();
        } catch (_) {}
      }, 20);
    }
  }

  // ---------------------------------------------------------------------------
  // Window manager
  // ---------------------------------------------------------------------------
  function layerRect() {
    const w = winsLayer ? winsLayer.clientWidth : 0;
    const hh = winsLayer ? winsLayer.clientHeight : 0;
    return { w: w || 1180, h: hh || 680 };
  }

  function renderTasks() {
    if (!tasksEl) return;
    clearEl(tasksEl);
    for (const rec of openWindows.values()) {
      tasksEl.appendChild(
        h(
          "button",
          {
            className: "eos-task",
            type: "button",
            "data-active": rec.pid === focusedPid && !rec.minimized ? "true" : "false",
            "data-min": rec.minimized ? "true" : "false",
            title: rec.title,
            onClick: () => {
              if (rec.minimized) {
                restoreWindow(rec);
                focusWindow(rec);
              } else if (rec.pid === focusedPid) {
                minimizeWindow(rec);
              } else {
                focusWindow(rec);
              }
            },
          },
          iconSVG(rec.icon, 13),
          h("span", null, rec.title)
        )
      );
    }
    if (barTitleEl) {
      const focused = openWindows.get(focusedPid);
      barTitleEl.textContent = focused
        ? focused.title + " — " + OS_NAME + " " + OS_VERSION
        : OS_NAME + " " + OS_VERSION + " (" + OS_CODENAME + ")";
    }
  }

  function focusWindow(rec) {
    if (!rec || rec.closed) return;
    focusedPid = rec.pid;
    zCounter += 1;
    rec.el.style.zIndex = String(zCounter);
    for (const other of openWindows.values()) {
      other.el.setAttribute("data-active", other === rec ? "true" : "false");
    }
    renderTasks();
  }

  function minimizeWindow(rec) {
    rec.minimized = true;
    rec.el.setAttribute("data-min", "true");
    if (focusedPid === rec.pid) focusedPid = null;
    renderTasks();
  }

  function restoreWindow(rec) {
    rec.minimized = false;
    rec.el.setAttribute("data-min", "false");
  }

  function toggleMaximize(rec) {
    const rect = layerRect();
    if (rec.maximized) {
      rec.maximized = false;
      rec.el.style.left = rec.restore.x + "px";
      rec.el.style.top = rec.restore.y + "px";
      rec.el.style.width = rec.restore.w + "px";
      rec.el.style.height = rec.restore.h + "px";
    } else {
      rec.restore = {
        x: rec.el.offsetLeft,
        y: rec.el.offsetTop,
        w: rec.el.offsetWidth,
        h: rec.el.offsetHeight,
      };
      rec.maximized = true;
      rec.el.style.left = "0px";
      rec.el.style.top = "0px";
      rec.el.style.width = rect.w + "px";
      rec.el.style.height = rect.h + "px";
    }
  }

  function closeWindow(rec) {
    if (!rec || rec.closed) return;
    rec.closed = true;
    try {
      if (typeof rec.onClose === "function") rec.onClose();
    } catch (_) {}
    if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
    openWindows.delete(rec.pid);
    if (focusedPid === rec.pid) {
      const remaining = Array.from(openWindows.values()).filter((w) => !w.minimized);
      focusedPid = remaining.length ? remaining[remaining.length - 1].pid : null;
      if (focusedPid) focusWindow(openWindows.get(focusedPid));
    }
    renderTasks();
    renderBarDisk();
  }

  function closeAllWindows() {
    for (const rec of Array.from(openWindows.values())) closeWindow(rec);
  }

  function createWindow(opts) {
    const rect = layerRect();
    const pid = ++pidCounter;
    const w = Math.min(opts.width || 660, Math.max(320, rect.w - 24));
    const hh = Math.min(opts.height || 430, Math.max(200, rect.h - 24));
    const step = openWindows.size;
    const x = Math.min(Math.max(10, 30 + step * 30), Math.max(10, rect.w - w - 14));
    const y = Math.min(Math.max(10, 18 + step * 26), Math.max(10, rect.h - hh - 14));

    const body = h("div", { className: "eos-win-body" });
    const titleEl = h("div", { className: "eos-win-title" }, opts.title || "Window");
    const el = h(
      "div",
      {
        className: "eos-win",
        "data-active": "false",
        "data-min": "false",
      },
      h(
        "div",
        { className: "eos-win-bar" },
        h("span", { className: "eos-win-ico" }, iconSVG(opts.icon || "about", 15)),
        titleEl,
        h(
          "div",
          { className: "eos-win-ctl" },
          h(
            "button",
            { className: "eos-win-btn", type: "button", title: "Minimize", onClick: () => minimizeWindow(rec) },
            "−"
          ),
          h(
            "button",
            { className: "eos-win-btn", type: "button", title: "Maximize", onClick: () => toggleMaximize(rec) },
            "▢"
          ),
          h(
            "button",
            { className: "eos-win-btn eos-close", type: "button", title: "Close", onClick: () => closeWindow(rec) },
            "×"
          )
        )
      ),
      body,
      h("div", { className: "eos-win-resize" })
    );
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = hh + "px";

    const rec = {
      pid: pid,
      id: opts.id,
      icon: opts.icon || "about",
      title: opts.title || "Window",
      el: el,
      body: body,
      minimized: false,
      maximized: false,
      closed: false,
      restore: { x: x, y: y, w: w, h: hh },
      onClose: opts.onClose,
      setTitle: (next) => {
        rec.title = next;
        titleEl.textContent = next;
        renderTasks();
      },
      close: () => closeWindow(rec),
      focus: () => focusWindow(rec),
    };

    el.addEventListener("pointerdown", () => focusWindow(rec), true);

    // Drag by title bar
    const bar = el.firstChild;
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest(".eos-win-ctl")) return;
      if (rec.maximized) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = el.offsetLeft;
      const origY = el.offsetTop;
      const limits = layerRect();
      const move = (ev) => {
        const nx = origX + (ev.clientX - startX);
        const ny = origY + (ev.clientY - startY);
        el.style.left = Math.min(Math.max(-el.offsetWidth + 90, nx), limits.w - 60) + "px";
        el.style.top = Math.min(Math.max(0, ny), limits.h - 34) + "px";
      };
      const up = () => {
        win.removeEventListener("pointermove", move, true);
        win.removeEventListener("pointerup", up, true);
      };
      win.addEventListener("pointermove", move, true);
      win.addEventListener("pointerup", up, true);
    });

    // Resize by corner
    const grip = el.lastChild;
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origW = el.offsetWidth;
      const origH = el.offsetHeight;
      const limits = layerRect();
      const move = (ev) => {
        const nw = Math.min(Math.max(300, origW + (ev.clientX - startX)), limits.w - el.offsetLeft);
        const nh = Math.min(Math.max(180, origH + (ev.clientY - startY)), limits.h - el.offsetTop);
        el.style.width = nw + "px";
        el.style.height = nh + "px";
      };
      const up = () => {
        win.removeEventListener("pointermove", move, true);
        win.removeEventListener("pointerup", up, true);
      };
      win.addEventListener("pointermove", move, true);
      win.addEventListener("pointerup", up, true);
    });

    if (typeof opts.build === "function") {
      try {
        opts.build(body, rec);
      } catch (err) {
        body.appendChild(h("div", { className: "eos-empty" }, "App failed to start: " + err.message));
      }
    }

    winsLayer.appendChild(el);
    openWindows.set(pid, rec);
    focusWindow(rec);
    renderBarDisk();
    return rec;
  }

  // ---------------------------------------------------------------------------
  // Bar / launcher / widget refresh
  // ---------------------------------------------------------------------------
  function renderBarDisk() {
    const u = diskUsage();
    const pct = Math.min(100, Math.round((u.used / u.capacity) * 100));
    if (diskTxtEl) diskTxtEl.textContent = fmtBytes(u.used) + " / " + fmtBytes(u.capacity);
    if (diskFillEl) diskFillEl.style.width = pct + "%";
    if (widgetFillEl) widgetFillEl.style.width = pct + "%";
    if (widgetMetaEl) {
      widgetMetaEl.innerHTML = "";
      widgetMetaEl.appendChild(
        h("div", null, h("b", null, hostname()), " · up " + uptimeString() + " · kernel " + KERNEL)
      );
      widgetMetaEl.appendChild(
        h("div", null, "vda " + fmtBytes(u.used) + " / " + fmtBytes(u.capacity) + "  (" + pct + "%)")
      );
      widgetMetaEl.appendChild(h("div", null, u.files + " files · " + u.dirs + " dirs · " + DISK_NAME));
    }
  }

  function tickClock() {
    if (!displayEl) return;
    const now = new Date();
    if (clockEl) clockEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    if (widgetTimeEl) widgetTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    if (widgetDateEl) {
      widgetDateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    renderBarDisk();
  }

  function setLauncher(open) {
    launcherOpen = !!open;
    if (launcherEl) launcherEl.setAttribute("data-open", launcherOpen ? "true" : "false");
    if (launcherOpen && searchEl) {
      renderAppsList("");
      later(() => {
        try {
          searchEl.value = "";
          searchEl.focus();
        } catch (_) {}
      }, 20);
    }
  }

  function setPowerMenu(open) {
    powerOpen = !!open;
    if (powerMenuEl) powerMenuEl.setAttribute("data-open", powerOpen ? "true" : "false");
  }

function renderDesktopIcons() {
    if (!desktopIconsEl) return;
    clearEl(desktopIconsEl);
    const appsDir = HOME + "/.local/share/applications";
    const dir = getNode(appsDir);
    if (!dir || dir.t !== "d") return;
    for (const name of Object.keys(dir.c).sort()) {
      const node = dir.c[name];
      if (node.t !== "f" || !name.endsWith(".desktop")) continue;
      const content = node.d || "";
      const nameMatch = content.match(/^Name=(.+)$/m);
      const execMatch = content.match(/^Exec=(.+)$/m);
      const iconMatch = content.match(/^Icon=(.+)$/m);
      const appName = (nameMatch && nameMatch[1].trim()) || name.replace(/\.desktop$/, "");
      const exec = (execMatch && execMatch[1].trim()) || appName;
      const iconName = (iconMatch && iconMatch[1].trim()) || "about";
      const icon = h("span", { className: "eos-dicon-img" }, iconSVG(iconName, 22));
      const label = h("span", { className: "eos-dicon-label" }, appName);
      const btn = h("button", { className: "eos-desktop-icon", type: "button" }, icon, label);
      btn.addEventListener("dblclick", () => {
        // Launch the app
        const lower = exec.toLowerCase();
        if (lower === "gnome-software") {
          openApp("terminal");
        } else if (lower === "discord-canary") {
          createWindow({
            id: "discord-canary",
            icon: "discord",
            title: "Discord Canary",
            width: 900,
            height: 600,
            build: (body, rec) => {
              const iframe = document.createElement("iframe");
              iframe.src = "https://discord.com/app";
              iframe.style.width = "100%";
              iframe.style.height = "100%";
              iframe.style.border = "none";
              body.appendChild(iframe);
            },
          });
        } else {
          openModalDialog({ title: appName, desc: "Launching " + appName + " (" + exec + ")", okLabel: "Launch" });
        }
      });
      desktopIconsEl.appendChild(btn);
    }
  }

  function applyVisualPrefs() {
    if (!displayEl) return;
    displayEl.setAttribute("data-scheme", scheme());
    displayEl.style.setProperty("--eos-accent", accent());
    if (stageEl) {
      const wall = stageEl.querySelector(".eos-wall");
      if (wall) wall.setAttribute("data-wall", wallpaper());
      const mark = stageEl.querySelector(".eos-wall-mark");
      if (mark) mark.textContent = wallpaper() === "void" ? "" : "力";
    }
    if (widgetEl) {
      if (getBool(PREF_WIDGET, true)) widgetEl.removeAttribute("hidden");
      else widgetEl.setAttribute("hidden", "true");
    }
    renderDesktopIcons();
  }

  // ---------------------------------------------------------------------------
  // Boot, shutdown, restart
  // ---------------------------------------------------------------------------
  const BIOS_LINES = [
    { t: "ExOS Firmware (UEFI) v1.0 — Exotic Virtual Platform", c: "eos-log-hi" },
    { t: "CPU: Exotic Virtual CPU · 4 threads · 2048 MiB RAM" },
    { t: "Scanning for bootable volumes ..." },
    { t: "  vda  " + DISK_NAME + "  " + fmtBytes(DISK_CAPACITY) + "  ext4  [attached]", c: "eos-log-ok" },
    { t: "Booting from /dev/vda1 ..." },
    { t: "" },
    { t: "kernel: ExOS " + KERNEL + " (x86_64) #1 SMP PREEMPT" },
    { t: "kernel: command line: root=/dev/vda1 rw quiet splash=exos" },
    { t: "kernel: ext4 mounted at / (rw,relatime)" },
    { t: "exosd: virtual hard disk mapped to " + DISK_NAME },
    { t: "exosd: display server started (wayland-ready)", c: "eos-log-ok" },
    { t: "exosd: window manager exwm online" },
    { t: "systemd: reached target graphical.target", c: "eos-log-ok" },
    { t: "login: auto-login as " + USER, c: "eos-log-hi" },
  ];

  let bootSkip = false;

  function enterDesktop() {
    stage = "desktop";
    if (!displayEl) return;
    displayEl.setAttribute("data-stage", "desktop");
    applyVisualPrefs();
    tickClock();
    renderTasks();
    if (!clockTimer) {
      clockTimer = win.setInterval(() => {
        if (!displayEl) return;
        tickClock();
        if (stage !== "desktop") return;
        // keep monitor windows fresh while they are open
        for (const rec of openWindows.values()) {
          if (rec.id === "monitor" && typeof rec.refresh === "function") rec.refresh();
        }
      }, 1000);
    }
  }

  function runSplash() {
    stage = "splash";
    displayEl.setAttribute("data-stage", "splash");
    let pct = 0;
    const step = () => {
      if (bootSkip) return;
      pct = Math.min(100, pct + 18 + Math.random() * 16);
      if (splashFill) splashFill.style.width = pct.toFixed(0) + "%";
      if (splashSub) {
        splashSub.textContent =
          pct < 45
            ? "mounting /dev/vda1"
            : pct < 80
            ? "starting exosd"
            : "starting " + USER + "@" + hostname();
      }
      if (pct >= 100) {
        later(() => {
          if (!bootSkip) enterDesktop();
        }, 260);
      } else {
        later(step, 130);
      }
    };
    step();
  }

  function runBoot() {
    if (!displayEl) return;
    clearTimers();
    bootSkip = false;
    bootEpoch = Date.now();
    setInt(PREF_BOOTS, bootCount() + 1);
    stage = "bios";
    displayEl.setAttribute("data-stage", "bios");
    const log = biosEl.querySelector(".eos-bios-log");
    clearEl(log);
    if (splashFill) splashFill.style.width = "0%";
    let i = 0;
    const step = () => {
      if (bootSkip) return;
      if (i >= BIOS_LINES.length) {
        runSplash();
        return;
      }
      const line = BIOS_LINES[i++];
      log.appendChild(h("div", { className: line.c || undefined }, line.t));
      later(step, 46 + Math.random() * 64);
    };
    later(step, 90);
  }

  function skipBoot() {
    if (stage === "desktop" || !displayEl) return;
    bootSkip = true;
    clearTimers();
    enterDesktop();
  }

  function persistAndNote() {
    persistNow();
  }

  function shutdown() {
    setPowerMenu(false);
    persistAndNote();
    closeAllWindows();
    stage = "halt";
    haltEl.setAttribute("data-open", "true");
    later(() => closeDisplay(), 1600);
  }

  function restart() {
    setPowerMenu(false);
    persistAndNote();
    closeAllWindows();
    stage = "halt";
    haltEl.setAttribute("data-open", "true");
    later(() => {
      haltEl.setAttribute("data-open", "false");
      runBoot();
    }, 750);
  }

  // ---------------------------------------------------------------------------
  // Display construction
  // ---------------------------------------------------------------------------
  function buildDisplay() {
    injectStyle();

    const biosLog = h("div", { className: "eos-bios-log" });
    biosEl = h(
      "div",
      { className: "eos-bios" },
      biosLog,
      h("div", { className: "eos-bios-hint" }, "Press any key to skip")
    );

    splashFill = h("div", { className: "eos-splash-fill" });
    splashSub = h("div", { className: "eos-splash-sub" }, "kernel " + KERNEL);
    const splash = h(
      "div",
      { className: "eos-splash" },
      h("div", { className: "eos-splash-seal" }, sealSVG(132)),
      h("div", { className: "eos-splash-name" }, OS_NAME),
      splashSub,
      h("div", { className: "eos-splash-track" }, splashFill)
    );

    // Desktop widget (painted on the wallpaper, Ryoku-style)
    widgetTimeEl = h("div", { className: "eos-w-time" }, "00:00");
    widgetDateEl = h("div", { className: "eos-w-date" }, "");
    widgetMetaEl = h("div", { className: "eos-w-meta" });
    widgetFillEl = h("i", null);
    widgetEl = h(
      "div",
      { className: "eos-widget" },
      widgetTimeEl,
      widgetDateEl,
      widgetMetaEl,
      h("div", { className: "eos-w-track" }, widgetFillEl)
    );

    tasksEl = h("div", { className: "eos-tasks" });
    barTitleEl = h("div", { className: "eos-bar-title" }, OS_NAME);
    diskTxtEl = h("span", null, "0 B");
    diskFillEl = h("i", null);
    clockEl = h("span", null, "--:--");

    const brandBtn = h(
      "button",
      { className: "eos-brand", type: "button", title: "Launcher (Ctrl+Space)" },
      h("span", { className: "eos-brand-seal" }, "力"),
      h("span", null, OS_NAME)
    );
    brandBtn.addEventListener("click", () => setLauncher(!launcherOpen));

    const powerBtn = h(
      "button",
      { className: "eos-pill eos-click", type: "button", title: "Power" },
      "Power"
    );
    powerBtn.addEventListener("click", () => setPowerMenu(!powerOpen));

    powerMenuEl = h(
      "div",
      { className: "eos-power-menu", "data-open": "false" },
      h(
        "button",
        { className: "eos-menu-item", type: "button", onClick: () => restart() },
        h("span", null, "Restart ExOS"), h("span", { className: "eos-menu-hint" }, "reboot")
      ),
      h(
        "button",
        {
          className: "eos-menu-item",
          type: "button",
          "data-danger": "true",
          onClick: () => shutdown(),
        },
        h("span", null, "Shut Down"), h("span", { className: "eos-menu-hint" }, "exit to Exotic")
      )
    );

    const barEl = h(
      "div",
      { className: "eos-bar" },
      brandBtn,
      h("div", { className: "eos-bar-sep" }),
      tasksEl,
      barTitleEl,
      h(
        "div",
        { className: "eos-bar-right" },
        h(
          "div",
          { className: "eos-pill", title: "Virtual hard disk — " + DISK_NAME },
          h("span", null, "VHD"),
          h("span", { className: "eos-disk-mini" }, diskFillEl),
          diskTxtEl
        ),
        h("div", { className: "eos-pill", title: "Clock" }, clockEl),
        powerBtn
      ),
      powerMenuEl
    );

    searchEl = h("input", {
      className: "eos-search",
      type: "text",
      spellcheck: "false",
      autocomplete: "off",
      placeholder: "Search apps …",
    });
    appsListEl = h("div", { className: "eos-apps" });
    launcherEl = h(
      "div",
      { className: "eos-launcher", "data-open": "false" },
      searchEl,
      appsListEl,
      h(
        "div",
        { className: "eos-launcher-foot" },
        h("span", null, OS_NAME + " " + OS_VERSION + " (" + OS_CODENAME + ")"),
        h("span", null, DISK_NAME + " · " + fmtBytes(DISK_CAPACITY))
      )
    );

    winsLayer = h("div", { className: "eos-wins" });
    desktopIconsEl = h("div", { className: "eos-desktop-icons" });
    modalEl = h("div", { className: "eos-modal", "data-open": "false" });
    haltEl = h(
      "div",
      { className: "eos-halt", "data-open": "false" },
      h("b", null, "System halted"),
      h("div", null, "The virtual hard disk was flushed to " + DISK_NAME + "."),
      h("div", null, "Returning to Exotic Browser …")
    );

    stageEl = h(
      "div",
      { className: "eos-stage" },
      h(
        "div",
        { className: "eos-wall", "data-wall": wallpaper() },
        h("div", { className: "eos-wall-mark" }, "力")
      ),
widgetEl,
       desktopIconsEl,
       winsLayer,
      barEl,
      launcherEl,
      modalEl,
      haltEl
    );

    displayEl = h(
      "div",
      {
        id: "exotic-os",
        "data-stage": "bios",
        "data-scheme": scheme(),
        tabindex: "-1",
      },
      biosEl,
      splash,
      stageEl
    );
    displayEl.style.setProperty("--eos-accent", accent());

    displayEl.addEventListener("click", (e) => {
      if (stage === "bios" || stage === "splash") {
        skipBoot();
        return;
      }
      // Click empty desktop closes transient surfaces
      if (launcherOpen && !(e.target.closest && e.target.closest(".eos-launcher")) &&
          !(e.target.closest && e.target.closest(".eos-brand"))) {
        setLauncher(false);
      }
      if (powerOpen && !(e.target.closest && e.target.closest(".eos-power-menu")) &&
          !(e.target.closest && e.target.closest(".eos-pill"))) {
        setPowerMenu(false);
      }
    });

    displayEl.addEventListener("keydown", (e) => {
      if (stage === "bios" || stage === "splash") {
        skipBoot();
        return;
      }
      const k = (e.key || "").toLowerCase();
      if (e.key === "Escape") {
        if (modalEl.getAttribute("data-open") === "true") {
          closeModalDialog();
          return;
        }
        if (launcherOpen) {
          setLauncher(false);
          return;
        }
        if (powerOpen) {
          setPowerMenu(false);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === "Space" || k === " ")) {
        e.preventDefault();
        e.stopPropagation();
        setLauncher(!launcherOpen);
      }
    }, true);

    searchEl.addEventListener("input", () => renderAppsList(searchEl.value));
    searchEl.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const first = appsListEl.querySelector(".eos-app");
        if (first) first.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setLauncher(false);
      }
    });

    doc.documentElement.appendChild(displayEl);
    try {
      displayEl.focus();
    } catch (_) {}
  }

  function openDisplay() {
    if (!displayEl) buildDisplay();
    else doc.documentElement.appendChild(displayEl);
    setBool(PREF_ENABLED, true);
    if (!displayEl.isConnected) doc.documentElement.appendChild(displayEl);
    runBoot();
  }

  function closeDisplay() {
    if (!displayEl) return;
    clearTimers();
    if (clockTimer) {
      win.clearInterval(clockTimer);
      clockTimer = null;
    }
    closeAllWindows();
    persistNow();
    if (displayEl.parentNode) displayEl.parentNode.removeChild(displayEl);
    displayEl = null;
    biosEl = null;
    splashFill = null;
    splashSub = null;
    stageEl = null;
    winsLayer = null;
    tasksEl = null;
    barTitleEl = null;
    clockEl = null;
    diskTxtEl = null;
    diskFillEl = null;
    powerMenuEl = null;
    launcherEl = null;
    searchEl = null;
    appsListEl = null;
    widgetEl = null;
    widgetTimeEl = null;
    widgetDateEl = null;
    widgetMetaEl = null;
    widgetFillEl = null;
    modalEl = null;
    haltEl = null;
    focusedPid = null;
    launcherOpen = false;
    powerOpen = false;
    stage = "idle";
    clockTimer = null;
  }

  // ---------------------------------------------------------------------------
  // exsh — the ExOS shell
  // ---------------------------------------------------------------------------
  const FORTUNES = [
    "A disk without backups is a disk already half-lost.",
    "The window manager is patient. The user is not.",
    "Everything is a file, including the virtual hard disk you are reading this from.",
    "Rice is a lifestyle, not a configuration.",
    "With power (力) comes a very long boot log.",
    "rm -rf is not a personality.",
    "Read the man page. It was written by someone who suffered for you.",
  ];

  function shellPrompt(cwd) {
    let shown = cwd;
    if (cwd === HOME) shown = "~";
    else if (cwd.startsWith(HOME + "/")) shown = "~" + cwd.slice(HOME.length);
    return USER + "@" + hostname() + ":" + shown + "$";
  }

  function modeOf(node) {
    if (node.t === "d") return "drwxr-xr-x";
    return "-rw-r--r--";
  }

  function buildTerminal(body, rec) {
    const out = h("div", { className: "eos-term-out" });
    const promptSpan = h("span", { className: "eos-prompt-txt" });
    const input = h("input", {
      className: "eos-term-in",
      type: "text",
      spellcheck: "false",
      autocomplete: "off",
      autocapitalize: "off",
    });
    body.appendChild(
      h("div", { className: "eos-term" }, out, h("div", { className: "eos-prompt-row" }, promptSpan, input))
    );

    const st = { cwd: HOME, history: [], hi: -1 };
    let capture = null;

    function print(text, cls) {
      const line = String(text === undefined || text === null ? "" : text);
      if (capture) {
        capture.push(line);
        return;
      }
      const div = h("div", { className: cls || undefined });
      div.textContent = line;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    function refreshPrompt() {
      clearEl(promptSpan);
      const p = shellPrompt(st.cwd);
      const at = p.indexOf("@");
      const colon = p.indexOf(":", at);
      promptSpan.appendChild(doc.createTextNode(p.slice(0, at + 1)));
      promptSpan.appendChild(h("span", { className: "eos-at" }, p.slice(at + 1, colon + 1)));
      promptSpan.appendChild(doc.createTextNode(p.slice(colon + 1)));
      rec.setTitle("Terminal — " + p);
    }

    const ctx = {
      print: print,
      clear: () => clearEl(out),
      get cwd() {
        return st.cwd;
      },
      setCwd: (p) => {
        st.cwd = p;
        refreshPrompt();
      },
      history: st.history,
      rec: rec,
      startCapture: () => {
        capture = [];
      },
      endCapture: () => {
        const res = capture || [];
        capture = null;
        return res;
      },
    };

    const SHELL = {
      help: {
        d: "list every command",
        u: "help [command]",
        f: (c, a) => {
          const names = Object.keys(SHELL).sort();
          if (a[0]) {
            const cmd = SHELL[a[0]];
            if (!cmd) return c.print("help: no such command: " + a[0], "eos-err");
            c.print(a[0] + " — " + cmd.d, "eos-acc");
            c.print("usage: " + cmd.u);
            return;
          }
          c.print("ExOS shell (exsh) — " + names.length + " commands\n", "eos-acc");
          const width = Math.max.apply(null, names.map((n) => n.length));
          for (const n of names) c.print("  " + n.padEnd(width + 2) + SHELL[n].d);
          c.print("\nman <cmd> · open <path> · app <name> · format --yes");
        },
      },
      clear: { d: "clear the screen", u: "clear", f: (c) => c.clear() },
      cls: { d: "alias of clear", u: "cls", f: (c) => c.clear() },
      echo: { d: "print text (supports > and >>)", u: "echo [text] [> file]", f: (c, a) => c.print(a.join(" ")) },
      pwd: { d: "print working directory", u: "pwd", f: (c) => c.print(c.cwd) },
      cd: {
        d: "change directory",
        u: "cd [dir]",
        f: (c, a) => {
          const target = normalizePath(a[0] || HOME, c.cwd);
          const node = getNode(target);
          if (!node) return c.print("cd: no such file or directory: " + target, "eos-err");
          if (node.t !== "d") return c.print("cd: not a directory: " + target, "eos-err");
          c.setCwd(target);
        },
      },
      ls: {
        d: "list directory contents",
        u: "ls [-l] [path]",
        f: (c, a) => {
          const long = a.some((x) => x === "-l" || x === "-la" || x === "-al");
          const target = normalizePath(a.filter((x) => !x.startsWith("-"))[0] || c.cwd, c.cwd);
          const res = listDir(target);
          if (!res.ok) return c.print("ls: " + res.err, "eos-err");
          if (!res.entries.length) return;
          if (!long) {
            c.print(res.entries.map((e) => (e.node.t === "d" ? e.name + "/" : e.name)).join("    "), "eos-acc");
            return;
          }
          c.print("total " + res.entries.length);
          for (const e of res.entries) {
            const size = fmtBytes(nodeBytes(e.node)).padStart(9);
            c.print(
              modeOf(e.node) + "  exo exo " + size + "  " + stampOf(e.node.m) + "  " +
                (e.node.t === "d" ? e.name + "/" : e.name)
            );
          }
        },
      },
      tree: {
        d: "print directory tree",
        u: "tree [path]",
        f: (c, a) => {
          const target = normalizePath(a[0] || c.cwd, c.cwd);
          const root = getNode(target);
          if (!root) return c.print("tree: no such directory: " + target, "eos-err");
          c.print(target, "eos-acc");
          const walk = (node, prefix, depth) => {
            if (depth > 6) return;
            const keys = Object.keys(node.c).sort();
            keys.forEach((k, i) => {
              const last = i === keys.length - 1;
              const child = node.c[k];
              c.print(prefix + (last ? "└── " : "├── ") + (child.t === "d" ? k + "/" : k));
              if (child.t === "d") walk(child, prefix + (last ? "    " : "│   "), depth + 1);
            });
          };
          if (root.t === "d") walk(root, "", 0);
        },
      },
      cat: {
        d: "print a file",
        u: "cat <file>...",
        f: (c, a) => {
          if (!a.length) return c.print("cat: missing operand", "eos-err");
          for (const arg of a) {
            const p = normalizePath(arg, c.cwd);
            const res = readFile(p);
            if (!res.ok) c.print("cat: " + res.err, "eos-err");
            else c.print(res.data.replace(/\n$/, ""));
          }
        },
      },
      head: {
        d: "first 10 lines of a file",
        u: "head <file>",
        f: (c, a) => {
          if (!a[0]) return c.print("head: missing operand", "eos-err");
          const res = readFile(normalizePath(a[0], c.cwd));
          if (!res.ok) return c.print("head: " + res.err, "eos-err");
          c.print(res.data.split("\n").slice(0, 10).join("\n"));
        },
      },
      wc: {
        d: "count lines, words, bytes",
        u: "wc <file>",
        f: (c, a) => {
          if (!a[0]) return c.print("wc: missing operand", "eos-err");
          const res = readFile(normalizePath(a[0], c.cwd));
          if (!res.ok) return c.print("wc: " + res.err, "eos-err");
          const lines = res.data ? res.data.split("\n").length - (res.data.endsWith("\n") ? 1 : 0) : 0;
          const words = res.data.trim() ? res.data.trim().split(/\s+/).length : 0;
          c.print(String(lines).padStart(6) + String(words).padStart(6) + String(byteLen(res.data)).padStart(7) + "  " + a[0]);
        },
      },
      grep: {
        d: "print matching lines",
        u: "grep <pattern> <file>",
        f: (c, a) => {
          if (a.length < 2) return c.print("usage: grep <pattern> <file>", "eos-err");
          const res = readFile(normalizePath(a[1], c.cwd));
          if (!res.ok) return c.print("grep: " + res.err, "eos-err");
          const needle = a[0].toLowerCase();
          const hits = res.data.split("\n").map((l, i) => [l, i + 1]).filter(([l]) => l.toLowerCase().includes(needle));
          if (!hits.length) return;
          for (const [l, n] of hits) c.print(String(n).padStart(4) + "  " + l);
        },
      },
      touch: {
        d: "create an empty file",
        u: "touch <file>...",
        f: (c, a) => {
          if (!a.length) return c.print("touch: missing operand", "eos-err");
          for (const arg of a) {
            const p = normalizePath(arg, c.cwd);
            if (getNode(p)) continue;
            const res = writeFile(p, "");
            if (!res.ok) c.print("touch: " + res.err, "eos-err");
          }
          refreshAll();
        },
      },
      mkdir: {
        d: "create directories",
        u: "mkdir [-p] <dir>...",
        f: (c, a) => {
          const parents = a.includes("-p");
          const targets = a.filter((x) => !x.startsWith("-"));
          if (!targets.length) return c.print("mkdir: missing operand", "eos-err");
          for (const arg of targets) {
            const res = mkdir(normalizePath(arg, c.cwd), parents);
            if (!res.ok) c.print("mkdir: " + res.err, "eos-err");
          }
          refreshAll();
        },
      },
      rmdir: {
        d: "remove empty directories",
        u: "rmdir <dir>...",
        f: (c, a) => {
          for (const arg of a) {
            const res = removeNode(normalizePath(arg, c.cwd), false);
            if (!res.ok) c.print("rmdir: " + res.err, "eos-err");
          }
          refreshAll();
        },
      },
      rm: {
        d: "remove files or directories",
        u: "rm [-r] <path>...",
        f: (c, a) => {
          const recursive = a.some((x) => x === "-r" || x === "-rf" || x === "-fr");
          const targets = a.filter((x) => !x.startsWith("-"));
          if (!targets.length) return c.print("rm: missing operand", "eos-err");
          for (const arg of targets) {
            const res = removeNode(normalizePath(arg, c.cwd), recursive);
            if (!res.ok) c.print("rm: " + res.err, "eos-err");
          }
          refreshAll();
        },
      },
      mv: {
        d: "move or rename",
        u: "mv <src> <dst>",
        f: (c, a) => {
          if (a.length < 2) return c.print("usage: mv <src> <dst>", "eos-err");
          const res = moveNode(normalizePath(a[0], c.cwd), normalizePath(a[1], c.cwd));
          if (!res.ok) c.print("mv: " + res.err, "eos-err");
          refreshAll();
        },
      },
      cp: {
        d: "copy a file",
        u: "cp <src> <dst>",
        f: (c, a) => {
          if (a.length < 2) return c.print("usage: cp <src> <dst>", "eos-err");
          const res = copyNode(normalizePath(a[0], c.cwd), normalizePath(a[1], c.cwd));
          if (!res.ok) c.print("cp: " + res.err, "eos-err");
          refreshAll();
        },
      },
      stat: {
        d: "show file metadata",
        u: "stat <path>",
        f: (c, a) => {
          if (!a[0]) return c.print("stat: missing operand", "eos-err");
          const p = normalizePath(a[0], c.cwd);
          const node = getNode(p);
          if (!node) return c.print("stat: cannot stat '" + p + "': No such file", "eos-err");
          c.print("  File: " + p);
          c.print("  Size: " + nodeBytes(node) + "\tBlocks: " + Math.ceil(nodeBytes(node) / 512));
          c.print("  Type: " + (node.t === "d" ? "directory" : "regular file") + "   Mode: " + modeOf(node));
          c.print("Modify: " + stampOf(node.m));
        },
      },
      df: {
        d: "disk free space",
        u: "df [-h]",
        f: (c) => {
          const u = diskUsage();
          const pct = Math.round((u.used / u.capacity) * 100);
          c.print("Filesystem".padEnd(16) + "Size".padStart(9) + "Used".padStart(9) + "Avail".padStart(8) + "Use%".padStart(5) + " Mounted on");
          c.print(
            "/dev/vda1".padEnd(16) +
              fmtBytes(u.capacity).padStart(9) +
              fmtBytes(u.used).padStart(9) +
              fmtBytes(u.free).padStart(8) +
              String(pct).padStart(4) +
              "% /"
          );
        },
      },
      du: {
        d: "disk usage of a path",
        u: "du [path]",
        f: (c, a) => {
          const p = normalizePath(a[0] || c.cwd, c.cwd);
          const node = getNode(p);
          if (!node) return c.print("du: no such path: " + p, "eos-err");
          c.print(fmtBytes(nodeBytes(node)) + "\t" + p);
        },
      },
      free: {
        d: "memory totals",
        u: "free [-h]",
        f: (c) => {
          const m = memSnapshot();
          c.print("               total        used        free");
          c.print("Mem:        " + fmtBytes(m.total * 1024 * 1024).padStart(9) + fmtBytes(m.used * 1024 * 1024).padStart(12) + fmtBytes((m.total - m.used) * 1024 * 1024).padStart(12));
          c.print("Swap:       " + fmtBytes(0).padStart(9) + fmtBytes(0).padStart(12) + fmtBytes(0).padStart(12));
        },
      },
      uname: {
        d: "system information",
        u: "uname [-a]",
        f: (c, a) => {
          if (a.includes("-a")) {
            c.print("ExOS " + hostname() + " " + KERNEL + " #1 SMP PREEMPT x86_64 ExOS/ExOS");
          } else c.print("ExOS");
        },
      },
      dpkg: {
        d: "install/remove .deb packages (ExOS package manager)",
        u: "dpkg -i <file.deb> | dpkg -r <name> | dpkg -l",
        f: (c, a) => {
          const flag = a[0];
          if (flag === "-i" || flag === "--install") {
            const p = normalizePath(a[1], c.cwd);
            const node = getNode(p);
            if (!node || node.t === "d") return c.print("dpkg: cannot access '" + p + "': No such file", "eos-err");
            if (!/\.deb$/i.test(p)) return c.print("dpkg: " + p + ": not a debian package", "eos-err");
            const name = p.split("/").pop().replace(/\.deb$/i, "").replace(/_[^_]+_[^_]+$/, "");
            c.print("Selecting previously unselected package " + name + ".", "eos-dimtext");
            c.print("Preparing to unpack " + p + " ...", "eos-dimtext");
            c.print("Unpacking " + name + " ...", "eos-dimtext");
            c.print("Setting up " + name + " ...", "eos-dimtext");
            // Register as an installed app in ~/.local/share/applications
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); d = getNode(appsDir); }
              const displayName = name === "gnome-software" ? "GNOME Software" : name === "discord-canary" ? "Discord Canary" : name;
              const icon = name === "gnome-software" ? "software" : name === "discord-canary" ? "discord" : "applications-system";
              const desktop = "[Desktop Entry]\nType=Application\nName=" + displayName + "\nExec=" + name + "\nIcon=" + icon + "\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + name + ".desktop", desktop);
            } catch (_) {}
            c.print("Successfully installed " + name, "eos-oktext");
            refreshAll();
            return;
          }
          if (flag === "-r" || flag === "--remove") {
            const name = a[1];
            if (!name) return c.print("usage: dpkg -r <package>", "eos-err");
            c.print("Removing " + name + " ...", "eos-dimtext");
            c.print("Successfully removed " + name, "eos-oktext");
            refreshAll();
            return;
          }
          if (flag === "-l" || flag === "--list") {
            c.print("Desired=Unknown/Install/Remove/Purge/Hold");
            c.print("  Status=Not/Inst/Conf-files/Unpacked/Failed-cfg/Half-inst");
            c.print("  Err?=(none)/Reinst-required (Status,Err: uppercase=bad)");
            c.print("||/ Name            Version        Architecture Description");
            c.print("+++-==============-==============-============-============");
            c.print("ii  exos-base      1.0            amd64        ExOS base system");
            return;
          }
          c.print("dpkg: unknown option '" + (flag || "") + "'", "eos-err");
          c.print("usage: " + this.u);
        },
      },
      rpm: {
        d: "install/remove .rpm packages (ExOS package manager)",
        u: "rpm -i <file.rpm> | rpm -e <name> | rpm -qa",
        f: (c, a) => {
          const flag = a[0];
          if (flag === "-i" || flag === "--install") {
            const p = normalizePath(a[1], c.cwd);
            const node = getNode(p);
            if (!node || node.t === "d") return c.print("rpm: cannot access '" + p + "': No such file", "eos-err");
            if (!/\.rpm$/i.test(p)) return c.print("rpm: " + p + ": not an rpm package", "eos-err");
            const name = p.split("/").pop().replace(/\.rpm$/i, "").replace(/-[0-9].*$/, "");
            c.print("Preparing...                          ################################# [100%]", "eos-dimtext");
            c.print("Updating / installing...", "eos-dimtext");
            c.print("  1:" + name.padEnd(30) + "################################# [100%]", "eos-dimtext");
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); d = getNode(appsDir); }
              const displayName = name === "gnome-software" ? "GNOME Software" : name === "discord-canary" ? "Discord Canary" : name;
              const icon = name === "gnome-software" ? "software" : name === "discord-canary" ? "discord" : "applications-system";
              const desktop = "[Desktop Entry]\nType=Application\nName=" + displayName + "\nExec=" + name + "\nIcon=" + icon + "\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + name + ".desktop", desktop);
            } catch (_) {}
            c.print("Successfully installed " + name, "eos-oktext");
            refreshAll();
            return;
          }
          if (flag === "-e" || flag === "--erase") {
            const name = a[1];
            if (!name) return c.print("usage: rpm -e <package>", "eos-err");
            c.print("Erasing " + name + " ...", "eos-dimtext");
            c.print("Successfully removed " + name, "eos-oktext");
            refreshAll();
            return;
          }
          if (flag === "-qa" || flag === "--query-all") {
            c.print("exos-base-1.0-1.x86_64");
            return;
          }
          c.print("rpm: unknown option '" + (flag || "") + "'", "eos-err");
          c.print("usage: " + this.u);
        },
      },
      apt: {
        d: "APT package manager (ExOS)",
        u: "apt install <pkg> | apt remove <pkg> | apt update",
        f: (c, a) => {
          const sub = (a[0] || "").toLowerCase();
          if (sub === "update") {
            c.print("Hit:1 http://archive.exos.local exos InRelease", "eos-dimtext");
            c.print("Reading package lists... Done", "eos-dimtext");
            c.print("All packages are up to date.", "eos-oktext");
            return;
          }
          if (sub === "install") {
            const pkg = a[1];
            if (!pkg) return c.print("usage: apt install <package>", "eos-err");
            c.print("Reading package lists... Done", "eos-dimtext");
            c.print("Building dependency tree... Done", "eos-dimtext");
            c.print("The following NEW packages will be installed:", "eos-dimtext");
            c.print("  " + pkg, "eos-acc");
            c.print("0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.", "eos-dimtext");
            c.print("Setting up " + pkg + " ...", "eos-dimtext");
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); d = getNode(appsDir); }
              const desktop = "[Desktop Entry]\nType=Application\nName=" + pkg + "\nExec=" + pkg + "\nIcon=applications-system\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + pkg + ".desktop", desktop);
            } catch (_) {}
            c.print("Successfully installed " + pkg, "eos-oktext");
            refreshAll();
            return;
          }
          if (sub === "remove") {
            const pkg = a[1];
            if (!pkg) return c.print("usage: apt remove <package>", "eos-err");
            c.print("Removing " + pkg + " ...", "eos-dimtext");
            c.print("Successfully removed " + pkg, "eos-oktext");
            refreshAll();
            return;
          }
          c.print("apt: unknown subcommand '" + sub + "'", "eos-err");
          c.print("usage: " + this.u);
        },
      },
      pacman: {
        d: "Pacman package manager (ExOS/Arch)",
        u: "pacman -S <pkg> | pacman -R <pkg> | pacman -Syu",
        f: (c, a) => {
          const flag = a[0];
          if (flag === "-Syu" || flag === "-Sy") {
            c.print(":: Synchronizing package databases...", "eos-dimtext");
            c.print(" exos is up to date", "eos-dimtext");
            c.print(":: Starting full system upgrade...", "eos-dimtext");
            c.print(" there is nothing to do", "eos-oktext");
            return;
          }
          if (flag === "-S") {
            const pkg = a[1];
            if (!pkg) return c.print("usage: pacman -S <package>", "eos-err");
            c.print("resolving dependencies...", "eos-dimtext");
            c.print("looking for conflicting packages...", "eos-dimtext");
            c.print("Packages (" + pkg + ") will be installed.", "eos-dimtext");
            c.print("(1/1) installing " + pkg + "                 [######################] 100%", "eos-dimtext");
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); d = getNode(appsDir); }
              const desktop = "[Desktop Entry]\nType=Application\nName=" + pkg + "\nExec=" + pkg + "\nIcon=applications-system\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + pkg + ".desktop", desktop);
            } catch (_) {}
            c.print("Successfully installed " + pkg, "eos-oktext");
            refreshAll();
            return;
          }
          if (flag === "-R") {
            const pkg = a[1];
            if (!pkg) return c.print("usage: pacman -R <package>", "eos-err");
            c.print("checking dependencies...", "eos-dimtext");
            c.print("removing " + pkg + " ...", "eos-dimtext");
            c.print("Successfully removed " + pkg, "eos-oktext");
            refreshAll();
            return;
          }
          c.print("pacman: unknown option '" + (flag || "") + "'", "eos-err");
          c.print("usage: " + this.u);
        },
      },
      flatpak: {
        d: "Flatpak app manager (ExOS)",
        u: "flatpak install <app> | flatpak run <app> | flatpak list",
        f: (c, a) => {
          const sub = (a[0] || "").toLowerCase();
          if (sub === "install") {
            const app = a[1];
            if (!app) return c.print("usage: flatpak install <app>", "eos-err");
            c.print("Installing " + app + " from flathub...", "eos-dimtext");
            c.print(" " + app + " installed.", "eos-oktext");
try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); d = getNode(appsDir); }
              const displayName = pkg === "gnome-software" ? "GNOME Software" : pkg === "discord-canary" ? "Discord Canary" : pkg;
              const icon = pkg === "gnome-software" ? "software" : pkg === "discord-canary" ? "discord" : "applications-system";
              const desktop = "[Desktop Entry]\nType=Application\nName=" + displayName + "\nExec=" + pkg + "\nIcon=" + icon + "\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + pkg + ".desktop", desktop);
            } catch (_) {}
            refreshAll();
            return;
          }
          if (sub === "run") {
            const app = a[1];
            if (!app) return c.print("usage: flatpak run <app>", "eos-err");
            c.print("Launching " + app + " ...", "eos-oktext");
            openApp("editor", { path: null });
            return;
          }
          if (sub === "list") {
            c.print("Name\t\tApplication ID\t\tVersion\tBranch");
            c.print("ExOS Base\torg.exos.Base\t\t1.0\tstable");
            return;
          }
          c.print("flatpak: unknown subcommand '" + sub + "'", "eos-err");
          c.print("usage: " + this.u);
        },
      },
      wget: {
        d: "download a file from a URL",
        u: "wget <url> [-O file]",
        f: (c, a) => {
          const url = a[0];
          if (!url) return c.print("usage: wget <url>", "eos-err");
          const outIdx = a.indexOf("-O");
          const outName = outIdx >= 0 && a[outIdx + 1] ? a[outIdx + 1] : url.split("/").pop() || "download";
          const target = normalizePath(outName, c.cwd);
          c.print("Resolving " + url + " ...", "eos-dimtext");
          c.print("Saving to: " + target, "eos-dimtext");
          c.print("100% [============================>] 0 --.-K/s  in 0s", "eos-dimtext");
          try {
            writeFileNode(target, "# Downloaded from " + url + "\n# (ExOS simulated download)\n");
          } catch (_) {}
          c.print("Downloaded " + target, "eos-oktext");
          refreshAll();
        },
      },
      curl: {
        d: "transfer data from/to a URL",
        u: "curl [-o file] <url>",
        f: (c, a) => {
          let url = a[a.length - 1];
          const oIdx = a.indexOf("-o");
          const outName = oIdx >= 0 && a[oIdx + 1] ? a[oIdx + 1] : null;
          c.print("  % Total    % Received % Xferd  Average Speed   Time", "eos-dimtext");
          c.print("100     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0", "eos-dimtext");
          if (outName) {
            const target = normalizePath(outName, c.cwd);
            try { writeFileNode(target, "# Downloaded from " + url + "\n"); } catch (_) {}
            c.print("Saved to " + target, "eos-oktext");
            refreshAll();
          } else {
            c.print("<html>...</html>");
          }
        },
      },
      hostname: {
        d: "show or set the hostname",
        u: "hostname [name]",
        f: (c, a) => {
          if (a[0]) {
            const name = a[0].replace(/[^a-z0-9-]/gi, "").slice(0, 32);
            if (!name) return c.print("hostname: invalid name", "eos-err");
            setStr(PREF_HOSTNAME, name);
            refreshPrompt();
            renderBarDisk();
            return;
          }
          c.print(hostname());
        },
      },
      uptime: { d: "how long ExOS has run", u: "uptime", f: (c) => c.print(" " + new Date().toLocaleTimeString() + "  up " + uptimeString() + ",  1 user,  load average: 0." + (10 + openWindows.size * 7) + ", 0." + (5 + openWindows.size * 3) + ", 0.02") },
      date: { d: "current date and time", u: "date", f: (c) => c.print(new Date().toString()) },
      whoami: { d: "current user", u: "whoami", f: (c) => c.print(USER) },
      id: { d: "user identity", u: "id", f: (c) => c.print("uid=1000(" + USER + ") gid=1000(" + USER + ") groups=1000(" + USER + "),27(sudo),44(video)") },
      ps: {
        d: "list processes",
        u: "ps",
        f: (c) => {
          c.print("  PID  CMD                STATE");
          c.print("    1  systemd             sleeping", "eos-dimtext");
          c.print("    7  exosd               sleeping", "eos-dimtext");
          for (const w of openWindows.values()) {
            c.print(
              String(w.pid).padStart(5) + "  " +
                (w.id === "terminal" ? "exsh" : w.id).padEnd(18) + "  " +
                (w.minimized ? "stopped" : w.pid === focusedPid ? "running" : "sleeping"),
              w.pid === focusedPid ? "eos-acc" : undefined
            );
          }
        },
      },
      kill: {
        d: "stop a process",
        u: "kill <pid>",
        f: (c, a) => {
          const pid = parseInt(a[0], 10);
          if (isNaN(pid)) return c.print("usage: kill <pid>", "eos-err");
          const target = openWindows.get(pid);
          if (!target) return c.print("kill: (" + pid + ") - No such process", "eos-err");
          target.close();
          c.print("killed pid " + pid, "eos-oktext");
        },
      },
      history: {
        d: "command history",
        u: "history",
        f: (c) => c.history.forEach((line, i) => c.print(String(i + 1).padStart(4) + "  " + line)),
      },
      neofetch: {
        d: "system readout",
        u: "neofetch",
        f: (c) => {
          const u = diskUsage();
          const m = memSnapshot();
          const logo = [
            "    ███████╗",
            "    ██╔════╝",
            "    █████╗",
            "    ██╔══╝",
            "    ███████╗",
            "    ╚══════╝",
          ];
          const info = [
            USER + "@" + hostname(),
            "-------------------------",
            "OS: ExOS " + OS_VERSION + " (" + OS_CODENAME + ") x86_64",
            "Host: Exotic Browser · Exotic Engine 159.0",
            "Kernel: " + KERNEL,
            "Uptime: " + uptimeString(),
            "Shell: exsh 1.0",
            "WM: exwm (wayland-ready)",
            "Terminal: exterm",
            "CPU: Exotic Virtual CPU (4)",
            "Memory: " + fmtBytes(m.used * 1024 * 1024) + " / " + fmtBytes(m.total * 1024 * 1024),
            "Disk: " + fmtBytes(u.used) + " / " + fmtBytes(u.capacity) + " (vda1)",
            "Root: " + DISK_NAME,
          ];
          for (let i = 0; i < Math.max(logo.length, info.length); i++) {
            c.print((logo[i] || "      ").padEnd(24) + (info[i] || ""));
          }
        },
      },
      motd: { d: "message of the day", u: "motd", f: (c) => { const r = readFile("/etc/motd"); c.print(r.ok ? r.data.replace(/\n$/, "") : "motd: unavailable", r.ok ? "eos-goldtext" : "eos-err"); } },
      open: {
        d: "open a path in Files/Editor",
        u: "open <path>",
        f: (c, a) => {
          if (!a[0]) return c.print("usage: open <path>", "eos-err");
          const p = normalizePath(a[0], c.cwd);
          const node = getNode(p);
          if (!node) return c.print("open: no such file or directory: " + p, "eos-err");
          openApp(node.t === "d" ? "files" : "editor", { path: p });
        },
      },
      app: {
        d: "launch an application",
        u: "app <name>",
        f: (c, a) => {
          const alias = { settings: "hub", sysinfo: "monitor", system: "monitor", calc: "calc", about: "about", terminal: "terminal", files: "files", editor: "editor" };
          const id = alias[(a[0] || "").toLowerCase()] || (a[0] || "").toLowerCase();
          if (!APPS.some((x) => x.id === id)) {
            return c.print("app: unknown app '" + (a[0] || "") + "' — try: " + APPS.map((x) => x.id).join(", "), "eos-err");
          }
          openApp(id);
        },
      },
      theme: {
        d: "set the ExOS colour scheme",
        u: "theme [auto|dark|bone|rice|material]",
        f: (c, a) => {
          const v = (a[0] || "").toLowerCase();
          if (!["auto", "dark", "bone", "rice", "material", "light"].includes(v)) {
            c.print("scheme: " + getStr(PREF_SCHEME, "auto") + "  (auto, dark, bone, rice, material)");
            return;
          }
          setStr(PREF_SCHEME, v === "light" ? "bone" : v);
          applyVisualPrefs();
          c.print("scheme set to " + v, "eos-oktext");
        },
      },
      wallpaper: {
        d: "set the desktop wallpaper",
        u: "wallpaper [seal|grid|horizon|void]",
        f: (c, a) => {
          const v = (a[0] || "").toLowerCase();
          if (!["seal", "grid", "horizon", "void"].includes(v)) {
            c.print("wallpaper: " + wallpaper() + "  (seal, grid, horizon, void)");
            return;
          }
          setStr(PREF_WALL, v);
          applyVisualPrefs();
          c.print("wallpaper set to " + v, "eos-oktext");
        },
      },
      fortune: { d: "a random thought", u: "fortune", f: (c) => c.print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], "eos-goldtext") },
      sudo: { d: "run as root", u: "sudo <cmd>", f: (c) => c.print(USER + " is not in the sudoers file. This incident will be reported.", "eos-err") },
      man: {
        d: "manual page",
        u: "man <command>",
        f: (c, a) => {
          const cmd = SHELL[a[0] || ""];
          if (!cmd) return c.print("No manual entry for " + (a[0] || ""), "eos-err");
          c.print("NAME", "eos-acc");
          c.print("       " + a[0] + " — " + cmd.d);
          c.print("SYNOPSIS", "eos-acc");
          c.print("       " + cmd.u);
        },
      },
      format: {
        d: "wipe the virtual hard disk",
        u: "format [--yes]",
        f: (c, a) => {
          if (!a.includes("--yes")) {
            c.print("format: this erases every file on " + DISK_NAME + ".", "eos-err");
            c.print("Run `format --yes` to confirm.", "eos-dimtext");
            return;
          }
          formatDisk();
          refreshAll();
          c.print("Formatted " + DISK_NAME + " — " + fmtBytes(DISK_CAPACITY) + " of clean space.", "eos-oktext");
        },
      },
      reboot: { d: "restart ExOS", u: "reboot", f: () => restart() },
      shutdown: { d: "halt and exit to Exotic", u: "shutdown", f: () => shutdown() },
      exit: { d: "close this terminal", u: "exit", f: (c) => c.rec.close() },
    };

    function tokenize(line) {
      const outTokens = [];
      let cur = "";
      let quote = null;
      let touched = false;
      for (const ch of line) {
        if (quote) {
          if (ch === quote) quote = null;
          else cur += ch;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          touched = true;
          continue;
        }
        if (ch === " " || ch === "\t") {
          if (cur || touched) outTokens.push(cur);
          cur = "";
          touched = false;
          continue;
        }
        cur += ch;
      }
      if (cur || touched) outTokens.push(cur);
      return outTokens;
    }

    function completePath(prefix) {
      const slash = prefix.lastIndexOf("/");
      const dirPart = slash >= 0 ? prefix.slice(0, slash + 1) : "";
      const namePart = slash >= 0 ? prefix.slice(slash + 1) : prefix;
      const dirAbs = normalizePath(dirPart || ".", st.cwd);
      const res = listDir(dirAbs);
      if (!res.ok) return null;
      const matches = res.entries.filter((e) => e.name.startsWith(namePart)).map((e) => e.name);
      if (matches.length !== 1) return null;
      // normalizePath() never keeps a trailing separator, so the lookup needs an
      // explicit "/" — without it every completion outside "/" resolved
      // "/home/exoDocuments" → null → `null.t` threw and Tab never completed.
      const completedAbs = normalizePath(dirAbs + "/" + matches[0], st.cwd);
      const node = getNode(completedAbs);
      const done = dirPart + matches[0] + (node && node.t === "d" ? "/" : "");
      return done;
    }

    function exec(rawLine) {
      const line = String(rawLine || "").replace(/\s+$/, "");
      if (!line.trim()) return;
      if (line.trim() === "clear" || line.trim() === "cls") {
        clearEl(out);
        return;
      }
      st.history.push(line);
      st.hi = st.history.length;
      const echo = h(
        "div",
        null,
        h("span", { className: "eos-oktext" }, shellPrompt(st.cwd) + " "),
        doc.createTextNode(line)
      );
      out.appendChild(echo);

      let tokens = tokenize(line);
      let redirect = null;
      const gt = tokens.indexOf(">");
      const gt2 = tokens.indexOf(">>");
      const at = gt >= 0 ? gt : gt2;
      if (at >= 0) {
        redirect = { append: gt2 >= 0 && gt < 0, target: tokens[at + 1] };
        tokens = tokens.slice(0, at);
      }
      const name = (tokens[0] || "").toLowerCase();
      const args = tokens.slice(1);
      const cmd = SHELL[name];
      if (!name) return;
      if (!cmd) {
        print("exsh: command not found: " + name, "eos-err");
        print("type `help` for the command list", "eos-dimtext");
        return;
      }
      if (redirect) {
        if (!redirect.target) {
          print("exsh: parse error near `>'", "eos-err");
          return;
        }
        capture = [];
        try {
          cmd.f(ctx, args);
        } catch (err) {
          capture.push(name + ": " + err.message);
        }
        const lines = capture;
        capture = null;
        const target = normalizePath(redirect.target, st.cwd);
        const existing = redirect.append && getNode(target) && getNode(target).t === "f" ? getNode(target).d : "";
        const res = writeFile(target, existing + lines.join("\n") + "\n");
        if (!res.ok) print("exsh: " + res.err, "eos-err");
        refreshAll();
        return;
      }
      try {
        cmd.f(ctx, args);
      } catch (err) {
        print(name + ": " + (err && err.message ? err.message : String(err)), "eos-err");
      }
      out.scrollTop = out.scrollHeight;
      refreshPrompt();
    }

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const value = input.value;
        input.value = "";
        exec(value);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!st.history.length) return;
        st.hi = Math.max(0, st.hi - 1);
        input.value = st.history[st.hi] || "";
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        st.hi = Math.min(st.history.length, st.hi + 1);
        input.value = st.history[st.hi] || "";
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const parts = input.value.split(" ");
        const last = parts[parts.length - 1] || "";
        let done = null;
        if (parts.length === 1) {
          const hit = Object.keys(SHELL).filter((n) => n.startsWith(last));
          if (hit.length === 1) done = hit[0] + " ";
        } else {
          done = completePath(last);
        }
        if (done) parts[parts.length - 1] = done;
        if (done) input.value = parts.join(" ");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        const echoLine = h("div", null, h("span", { className: "eos-oktext" }, shellPrompt(st.cwd) + " "), doc.createTextNode(input.value + "^C"));
        out.appendChild(echoLine);
        input.value = "";
        st.hi = st.history.length;
        out.scrollTop = out.scrollHeight;
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        clearEl(out);
      }
    });

    out.addEventListener("click", () => {
      try {
        input.focus();
      } catch (_) {}
    });

    print("ExOS " + OS_VERSION + " (" + OS_CODENAME + ") · exsh · " + DISK_NAME, "eos-acc");
    print("Type `help` for commands, `neofetch` for the system readout.", "eos-dimtext");
    refreshPrompt();
    later(() => {
      try {
        input.focus();
      } catch (_) {}
    }, 40);
  }

  // ---------------------------------------------------------------------------
  // Shared refresh
  // ---------------------------------------------------------------------------
  function displayPath(p) {
    if (p === HOME) return "~";
    if (p.startsWith(HOME + "/")) return "~" + p.slice(HOME.length);
    return p;
  }

  function refreshAll() {
    renderBarDisk();
    renderDesktopIcons();
    for (const w of openWindows.values()) {
      if (typeof w.refresh === "function") {
        try {
          w.refresh();
        } catch (_) {}
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------
  function buildFiles(body, rec, opts) {
    let cur = normalizePath((opts && opts.path) || HOME, "/");
    const startNode = getNode(cur);
    if (!startNode || startNode.t !== "d") cur = HOME;
    let sel = null;

    const root = h("div", { className: "eos-files" });
    const pathEl = h("div", { className: "eos-path" });
    const list = h("div", { className: "eos-fs-list" });
    const status = h("div", { className: "eos-status" });

    const mkBtn = (label, title, fn, cls) =>
      h("button", { className: "eos-btn " + (cls || ""), type: "button", title: title, onClick: fn }, label);

    const upBtn = mkBtn("Up", "Parent directory", () => {
      if (cur !== "/") {
        cur = parentPathOf(cur);
        sel = null;
        render();
      }
    }, "eos-btn-ghost");
    const homeBtn = mkBtn("Home", HOME, () => {
      cur = HOME;
      sel = null;
      render();
    }, "eos-btn-ghost");
    const newDirBtn = mkBtn("New folder", "Create a directory here", () =>
      openModalDialog({
        title: "New folder",
        desc: "Create a directory in " + displayPath(cur),
        input: "",
        okLabel: "Create",
        onOk: (value) => {
          const name = String(value || "").trim();
          if (!name) return;
          const res = mkdir(normalizePath(name, cur), false);
          render(res.ok ? null : res.err);
        },
      })
    );
    const newFileBtn = mkBtn("New file", "Create an empty file", () =>
      openModalDialog({
        title: "New file",
        desc: "Create a file in " + displayPath(cur),
        input: "untitled.txt",
        okLabel: "Create",
        onOk: (value) => {
          const name = String(value || "").trim();
          if (!name) return;
          const p = normalizePath(name, cur);
          if (getNode(p)) return render(p + " already exists");
          const res = writeFile(p, "");
          render(res.ok ? null : res.err);
          if (res.ok) {
            sel = nameOf(p);
            render();
          }
        },
      })
    );
    const renameBtn = mkBtn("Rename", "Rename the selected entry", () => {
      if (!sel) return;
      openModalDialog({
        title: "Rename",
        desc: displayPath(cur) + "/" + sel,
        input: sel,
        okLabel: "Rename",
        onOk: (value) => {
          const name = String(value || "").trim();
          if (!name || name === sel) return;
          const res = moveNode(normalizePath(sel, cur), normalizePath(name, cur));
          sel = res.ok ? nameOf(res.path) : sel;
          render(res.ok ? null : res.err);
        },
      });
    });
    const delBtn = mkBtn("Delete", "Delete the selected entry", () => {
      if (!sel) return;
      openModalDialog({
        title: "Delete " + sel + "?",
        desc: "This removes it from " + DISK_NAME + " permanently.",
        okLabel: "Delete",
        danger: true,
        onOk: () => {
          const res = removeNode(normalizePath(sel, cur), true);
          sel = null;
          render(res.ok ? null : res.err);
        },
      });
    }, "eos-btn-ghost");

    const toolbar = h(
      "div",
      { className: "eos-toolbar" },
      upBtn,
      homeBtn,
      h("div", { className: "eos-bar-sep" }),
      newDirBtn,
      newFileBtn,
      renameBtn,
      delBtn,
      h("div", { style: { flex: "1" } }),
      pathEl
    );
    root.appendChild(toolbar);
    root.appendChild(
      h(
        "div",
        { className: "eos-fs-head" },
        h("div", null, "Name"),
        h("div", { style: { textAlign: "right" } }, "Size"),
        h("div", { style: { textAlign: "right" } }, "Modified")
      )
    );
    root.appendChild(list);
    root.appendChild(status);
    body.appendChild(root);

    function openEntry(node, name) {
      const target = normalizePath(name, cur);
      const lower = String(name || "").toLowerCase();
      if (node.t === "d") {
        cur = target;
        sel = null;
        render();
        return;
      }
      // Linux package / app launchers
      if (lower.endsWith(".desktop")) {
        try {
          const content = readFileNode(target) || "";
          const execMatch = content.match(/^Exec=(.+)$/m);
          const nameMatch = content.match(/^Name=(.+)$/m);
          const appName = (nameMatch && nameMatch[1].trim()) || name.replace(/\.desktop$/i, "");
          const exec = execMatch ? execMatch[1].trim() : appName;

          // Launch known apps as real windows
          if (exec === "gnome-software" || appName.toLowerCase().includes("gnome software")) {
            openApp("terminal", { path: null });
            // Show package manager in terminal
            const win = Array.from(openWindows.values()).filter(w => w.id === "terminal").pop();
            if (win && win.body) {
              // Just open terminal, user can run apt
            }
            return;
          }
          if (exec === "discord-canary" || appName.toLowerCase().includes("discord")) {
            // Open Discord Canary as a web view window
            createWindow({
              id: "discord-canary",
              icon: "discord",
              title: "Discord Canary",
              width: 900,
              height: 600,
              build: (body, rec) => {
                const iframe = document.createElement("iframe");
                iframe.src = "https://discord.com/app";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = "none";
                body.appendChild(iframe);
              },
            });
            return;
          }

          openModalDialog({
            title: appName,
            desc: "Launching " + appName + " (" + exec + ")",
            okLabel: "Launch",
            onOk: () => {},
          });
        } catch (_) {
          openApp("editor", { path: target });
        }
        return;
      }
      if (lower.endsWith(".deb")) {
        openModalDialog({
          title: "Install " + name + "?",
          desc: "This will install the Debian package into ExOS using dpkg.",
          okLabel: "Install",
          onOk: () => {
            // Simulate dpkg -i
            const pkgName = name.replace(/\.deb$/i, "").replace(/_[^_]+_[^_]+$/, "");
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); }
              const desktop = "[Desktop Entry]\nType=Application\nName=" + pkgName + "\nExec=" + pkgName + "\nIcon=applications-system\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + pkgName + ".desktop", desktop);
            } catch (_) {}
            refreshAll();
          },
        });
        return;
      }
      if (lower.endsWith(".rpm")) {
        openModalDialog({
          title: "Install " + name + "?",
          desc: "This will install the RPM package into ExOS using rpm.",
          okLabel: "Install",
          onOk: () => {
            const pkgName = name.replace(/\.rpm$/i, "").replace(/-[0-9].*$/, "");
            try {
              const appsDir = HOME + "/.local/share/applications";
              let d = getNode(appsDir);
              if (!d) { mkdirNode(appsDir, true); }
              const desktop = "[Desktop Entry]\nType=Application\nName=" + pkgName + "\nExec=" + pkgName + "\nIcon=applications-system\nCategories=Application;\n";
              writeFileNode(appsDir + "/" + pkgName + ".desktop", desktop);
            } catch (_) {}
            refreshAll();
          },
        });
        return;
      }
      if (lower.endsWith(".appimage")) {
        openModalDialog({
          title: "Run " + name + "?",
          desc: "AppImage — will be mounted and launched.",
          okLabel: "Run",
          onOk: () => { refreshAll(); },
        });
        return;
      }
      openApp("editor", { path: target });
    }

    function render(note) {
      pathEl.textContent = displayPath(cur);
      rec.setTitle("Files — " + displayPath(cur));
      renameBtn.disabled = !sel;
      delBtn.disabled = !sel;
      upBtn.disabled = cur === "/";
      clearEl(list);
      const res = listDir(cur);
      if (!res.ok) {
        list.appendChild(h("div", { className: "eos-empty" }, res.err));
        status.textContent = res.err;
        return;
      }
      if (!res.entries.length) {
        list.appendChild(h("div", { className: "eos-empty" }, "This directory is empty"));
      }
      for (const entry of res.entries) {
const isDir = entry.node.t === "d";
      const lower = entry.name.toLowerCase();
      let iconName = "editor";
      if (isDir) iconName = "files";
      else if (lower.endsWith(".desktop")) iconName = "about";
      else if (lower.endsWith(".deb") || lower.endsWith(".rpm") || lower.endsWith(".appimage")) iconName = "mods";
      else if (lower.endsWith(".sh")) iconName = "terminal";
      else if (lower.endsWith(".txt") || lower.endsWith(".md")) iconName = "editor";
      const row = h(
        "button",
        { className: "eos-fs-row", type: "button", "data-sel": sel === entry.name ? "true" : "false" },
        h(
          "div",
          { className: "eos-fs-name" },
          h("span", { className: "eos-fs-ico" + (isDir ? "" : " file") }, iconSVG(iconName, 14)),
          h("span", null, entry.name + (isDir ? "/" : ""))
        ),
          h("div", { className: "eos-fs-meta" }, isDir ? Object.keys(entry.node.c).length + " items" : fmtBytes(byteLen(entry.node.d))),
          h("div", { className: "eos-fs-meta" }, stampOf(entry.node.m))
        );
        row.addEventListener("click", () => {
          sel = entry.name;
          render();
        });
        row.addEventListener("dblclick", () => openEntry(entry.node, entry.name));
        list.appendChild(row);
      }
      const u = diskUsage();
      const pct = Math.round((u.used / u.capacity) * 100);
      status.textContent =
        note ||
        res.entries.length +
          " entries  ·  vda " +
          fmtBytes(u.used) +
          " / " +
          fmtBytes(u.capacity) +
          " (" +
          pct +
          "%)";
    }

    rec.openPath = (p) => {
      const target = normalizePath(p, "/");
      const node = getNode(target);
      if (!node) return;
      if (node.t === "d") {
        cur = target;
        sel = null;
        render();
      }
    };
    rec.refresh = () => render();
    render();
  }

  // ---------------------------------------------------------------------------
  // Text Editor
  // ---------------------------------------------------------------------------
  function buildEditor(body, rec, opts) {
    let path = opts && opts.path ? normalizePath(opts.path, "/") : null;
    let dirty = false;

    const ta = h("textarea", { className: "eos-ed-area", spellcheck: "false", wrap: "off" });
    const pathEl = h("div", { className: "eos-path" });
    const stateEl = h("div", null, "Saved");
    const toolbar = h("div", { className: "eos-toolbar" });
    const status = h("div", { className: "eos-status" }, pathEl, stateEl);
    const root = h("div", { className: "eos-ed" }, toolbar, ta, status);

    const saveBtn = h("button", { className: "eos-btn eos-btn-primary", type: "button" }, "Save");
    const saveAsBtn = h("button", { className: "eos-btn", type: "button" }, "Save as");
    const newBtn = h("button", { className: "eos-btn eos-btn-ghost", type: "button" }, "New");
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(saveAsBtn);
    toolbar.appendChild(newBtn);
    toolbar.appendChild(h("div", { style: { flex: "1" } }));
    toolbar.appendChild(h("span", { className: "eos-path" }, "exterm · nano"));
    body.appendChild(root);

    function updateMeta() {
      const name = path ? displayPath(path) : "untitled";
      pathEl.textContent = name;
      stateEl.textContent = dirty ? "● unsaved changes" : path ? "saved" : "never saved";
      rec.setTitle((dirty ? "● " : "") + name + " — Editor");
    }

    function load(p) {
      if (!p) {
        path = null;
        ta.value = "";
        dirty = false;
        updateMeta();
        return;
      }
      const res = readFile(p);
      if (!res.ok) {
        path = p;
        ta.value = "";
        dirty = true;
        updateMeta();
        pathEl.textContent = res.err;
        return;
      }
      path = p;
      ta.value = res.data;
      dirty = false;
      updateMeta();
      ta.focus();
    }

    function doSave(forcePath) {
      const target = forcePath || path;
      if (!target) {
        openModalDialog({
          title: "Save as",
          desc: "Path on the virtual hard disk",
          input: HOME + "/untitled.txt",
          okLabel: "Save",
          onOk: (value) => {
            const p = normalizePath(String(value || "").trim(), HOME);
            if (!p || p === "/") return;
            doSave(p);
          },
        });
        return;
      }
      const res = writeFile(target, ta.value);
      if (!res.ok) {
        openModalDialog({ title: "Could not save", desc: res.err, okLabel: "OK", cancelLabel: "Close" });
        return;
      }
      path = target;
      dirty = false;
      updateMeta();
      refreshAll();
    }

    saveBtn.addEventListener("click", () => doSave());
    saveAsBtn.addEventListener("click", () => doSave(null));
    newBtn.addEventListener("click", () => {
      if (dirty && ta.value.trim()) {
        openModalDialog({
          title: "Discard changes?",
          desc: "The current buffer has unsaved changes.",
          okLabel: "Discard",
          danger: true,
          onOk: () => load(null),
        });
      } else load(null);
    });
    ta.addEventListener("input", () => {
      if (!dirty) {
        dirty = true;
        updateMeta();
      }
    });
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        doSave();
      }
    });

    rec.openPath = (p) => load(normalizePath(p, "/"));
    load(path);
  }

  // ---------------------------------------------------------------------------
  // System Monitor
  // ---------------------------------------------------------------------------
  function buildMonitor(body, rec) {
    const scroll = h("div", { className: "eos-scroll" });
    body.appendChild(scroll);

    function card(title, value, sub, pct, gold) {
      const bar = h("i");
      if (pct !== null && pct !== undefined) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
      return h(
        "div",
        { className: "eos-card" },
        h("div", { className: "eos-card-t" }, title),
        h("div", { className: "eos-card-v" }, value),
        sub ? h("div", { className: "eos-card-s" }, sub) : null,
        pct !== null && pct !== undefined
          ? h("div", { className: "eos-track" + (gold ? " gold" : "") }, bar)
          : null
      );
    }

    function render() {
      clearEl(scroll);
      const u = diskUsage();
      const m = memSnapshot();
      const diskPct = Math.round((u.used / u.capacity) * 100);
      const memPct = Math.round((m.used / m.total) * 100);

      scroll.appendChild(
        h(
          "div",
          { className: "eos-cards" },
          card("Uptime", uptimeString(), "since boot", null),
          card("Memory", fmtBytes(m.used * 1024 * 1024), "of " + fmtBytes(m.total * 1024 * 1024), memPct),
          card("Virtual disk", fmtBytes(u.used), fmtBytes(u.free) + " free", diskPct),
          card("Windows", String(openWindows.size), "load 0." + (10 + openWindows.size * 7), null, true)
        )
      );

      scroll.appendChild(h("div", { className: "eos-sec" }, h("div", { className: "eos-sec-h" }, "Processes")));
      const table = h("table", { className: "eos-table" });
      table.appendChild(
        h("thead", null, h("tr", null, h("th", null, "PID"), h("th", null, "Command"), h("th", null, "State"), h("th", null, "Memory")))
      );
      const tbody = h("tbody", null,
        h("tr", null, h("td", null, "1"), h("td", null, "systemd"), h("td", { className: "dim" }, "sleeping"), h("td", { className: "dim" }, "12 MiB")),
        h("tr", null, h("td", null, "7"), h("td", null, "exosd"), h("td", { className: "dim" }, "sleeping"), h("td", { className: "dim" }, "86 MiB")),
        h("tr", null, h("td", null, "9"), h("td", null, "exosd-session"), h("td", { className: "dim" }, "sleeping"), h("td", { className: "dim" }, "44 MiB"))
      );
      for (const w of openWindows.values()) {
        tbody.appendChild(
          h(
            "tr",
            null,
            h("td", null, String(w.pid)),
            h("td", null, w.id === "terminal" ? "exsh" : w.id),
            h("td", { className: "dim" }, w.minimized ? "stopped" : w.pid === focusedPid ? "running" : "sleeping"),
            h("td", { className: "dim" }, (48 + w.title.length) + " MiB")
          )
        );
      }
      table.appendChild(tbody);
      scroll.appendChild(table);

      scroll.appendChild(h("div", { className: "eos-sec" }, h("div", { className: "eos-sec-h" }, "Storage")));
      const rows = [
        ["Image", DISK_NAME + " (vda1)"],
        ["Capacity", fmtBytes(u.capacity)],
        ["Used", fmtBytes(u.used) + " (" + diskPct + "%)"],
        ["Free", fmtBytes(u.free)],
        ["Contents", u.files + " files · " + u.dirs + " directories"],
        ["Backend", getStr(PREF_BACKEND, hasServices() ? "file" : "localStorage")],
        ["Mounts", "/ (rw, relatime), /home (rw)"]
      ];
      const kv = h("dl", { className: "eos-kv" });
      for (const [k, v] of rows) {
        kv.appendChild(h("dt", null, k));
        kv.appendChild(h("dd", null, v));
      }
      scroll.appendChild(kv);
    }

    rec.refresh = render;
    rec.onClose = () => {
      rec.refresh = null;
    };
    render();
  }

  // ---------------------------------------------------------------------------
  // System Hub (ExOS settings)
  // ---------------------------------------------------------------------------
  function buildHub(body, rec) {
    const scroll = h("div", { className: "eos-scroll" });
    body.appendChild(scroll);

    function chipRow(title, hint, options, current, onPick) {
      const chips = h(
        "div",
        { className: "eos-chips" },
        options.map((opt) =>
          h(
            "button",
            {
              className: "eos-chip",
              type: "button",
              "data-on": opt.value === current ? "true" : "false",
              onClick: () => onPick(opt.value),
            },
            opt.label
          )
        )
      );
      return h(
        "div",
        { className: "eos-row" },
        h("div", { className: "eos-row-l" }, h("div", { className: "eos-row-t" }, title), h("div", { className: "eos-row-s" }, hint)),
        chips
      );
    }

    function render() {
      clearEl(scroll);

      scroll.appendChild(h("div", { className: "eos-sec-h" }, "Identity"));
      const hostInput = h("input", { className: "eos-input", type: "text", value: hostname(), spellcheck: "false" });
      const applyBtn = h("button", { className: "eos-btn eos-btn-primary", type: "button" }, "Apply");
      const applyHost = () => {
        const name = String(hostInput.value || "").replace(/[^a-z0-9-]/gi, "").slice(0, 32);
        if (!name) {
          hostInput.value = hostname();
          return;
        }
        setStr(PREF_HOSTNAME, name);
        hostInput.value = name;
        renderBarDisk();
        for (const w of openWindows.values()) {
          if (w.id === "terminal" && typeof w.refresh === "function") w.refresh();
        }
      };
      applyBtn.addEventListener("click", applyHost);
      hostInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") applyHost();
      });
      scroll.appendChild(
        h(
          "div",
          { className: "eos-row" },
          h("div", { className: "eos-row-l" }, h("div", { className: "eos-row-t" }, "Hostname"), h("div", { className: "eos-row-s" }, "Shown in prompts, neofetch and the desktop widget")),
          h("div", { style: { display: "flex", gap: "8px" } }, hostInput, applyBtn)
        )
      );

      scroll.appendChild(h("div", { className: "eos-sec" }, h("div", { className: "eos-sec-h" }, "Appearance")));
      scroll.appendChild(
        chipRow(
          "Wallpaper",
          "Painted behind every window",
          [
            { value: "seal", label: "Seal" },
            { value: "grid", label: "Grid" },
            { value: "horizon", label: "Horizon" },
            { value: "void", label: "Void" },
          ],
          wallpaper(),
          (v) => {
            setStr(PREF_WALL, v);
            applyVisualPrefs();
            render();
          }
        )
      );
      scroll.appendChild(
        chipRow(
          "Accent",
          "Vermillion sun, kintsugi gold, or plain bone",
          [
            { value: "vermillion", label: "Vermillion" },
            { value: "gold", label: "Gold" },
            { value: "bone", label: "Bone" },
          ],
          getStr(PREF_ACCENT, "vermillion"),
          (v) => {
            setStr(PREF_ACCENT, v);
            applyVisualPrefs();
            render();
          }
        )
      );
      scroll.appendChild(
        chipRow(
          "Scheme",
          "Dark = warm bone on black · Rice = Material-You rice paper · Material = layered grey",
          [
            { value: "auto", label: "Follow Exotic" },
            { value: "dark", label: "Dark" },
            { value: "bone", label: "Bone" },
            { value: "rice", label: "Rice" },
            { value: "material", label: "Material" },
          ],
          getStr(PREF_SCHEME, "auto"),
          (v) => {
            setStr(PREF_SCHEME, v);
            applyVisualPrefs();
            render();
          }
        )
      );
      scroll.appendChild(
        chipRow(
          "Desktop widget",
          "Clock, date and disk meter on the wallpaper",
          [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ],
          getBool(PREF_WIDGET, true) ? "on" : "off",
          (v) => {
            setBool(PREF_WIDGET, v === "on");
            applyVisualPrefs();
            render();
          }
        )
      );

      scroll.appendChild(h("div", { className: "eos-sec" }, h("div", { className: "eos-sec-h" }, "Virtual hard disk")));
      const u = diskUsage();
      const kv = h("dl", { className: "eos-kv" });
      const rows = [
        ["Image file", DISK_NAME],
        ["Capacity", fmtBytes(u.capacity)],
        ["Used", fmtBytes(u.used) + " (" + Math.round((u.used / u.capacity) * 100) + "%)"],
        ["Free", fmtBytes(u.free)],
        ["Contents", u.files + " files · " + u.dirs + " directories"],
        ["Backend", getStr(PREF_BACKEND, hasServices() ? "file" : "localStorage")],
        ["Mounts", "/ → /dev/vda1 (rw, relatime)"],
      ];
      for (const [k, v] of rows) {
        kv.appendChild(h("dt", null, k));
        kv.appendChild(h("dd", null, v));
      }
      scroll.appendChild(kv);

      const formatBtn = h("button", { className: "eos-btn eos-btn-danger", type: "button" }, "Format disk");
      formatBtn.addEventListener("click", () =>
        openModalDialog({
          title: "Format " + DISK_NAME + "?",
          desc:
            "Every file on the " +
            fmtBytes(u.capacity) +
            " virtual hard disk will be erased and the factory ExOS image restored. This cannot be undone.",
          okLabel: "Format",
          danger: true,
          onOk: () => {
            formatDisk();
            refreshAll();
            render();
          },
        })
      );
      scroll.appendChild(h("div", { className: "eos-row" }, h("div", { className: "eos-row-l" }, h("div", { className: "eos-row-t" }, "Format"), h("div", { className: "eos-row-s" }, "Restore the factory image and reclaim all space")), formatBtn));

      scroll.appendChild(h("div", { className: "eos-sec" }, h("div", { className: "eos-sec-h" }, "About this machine")));
      const aboutKv = h("dl", { className: "eos-kv" });
      for (const [k, v] of [
        ["System", OS_NAME + " " + OS_VERSION + " (" + OS_CODENAME + ")"],
        ["Kernel", KERNEL],
        ["Host", "Exotic Browser · Exotic Engine 159.0"],
        ["Mod", "Exotic Mods → ExOS (" + PREF_ENABLED + ")"],
        ["Boots", String(bootCount())],
      ]) {
        aboutKv.appendChild(h("dt", null, k));
        aboutKv.appendChild(h("dd", null, v));
      }
      scroll.appendChild(aboutKv);
    }

    rec.refresh = render;
    rec.onClose = () => {
      rec.refresh = null;
    };
    render();
  }

  // ---------------------------------------------------------------------------
  // Calculator
  // ---------------------------------------------------------------------------
  function buildCalc(body, rec) {
    let cur = "0";
    let acc = null;
    let op = null;
    let fresh = true;

    const big = h("div", null, "0");
    const small = h("small", null, "");
    const disp = h("div", { className: "eos-calc-disp" }, small, big);
    const grid = h("div", { className: "eos-calc-grid" });
    body.appendChild(h("div", { className: "eos-calc" }, disp, grid));

    const apply = (a, b, o) => {
      const x = parseFloat(a);
      const y = parseFloat(b);
      let r = 0;
      if (o === "+") r = x + y;
      else if (o === "-") r = x - y;
      else if (o === "×") r = x * y;
      else if (o === "÷") r = y === 0 ? NaN : x / y;
      if (isNaN(r)) return "Error";
      if (!isFinite(r)) return "Overflow";
      return String(Math.round(r * 1e10) / 1e10);
    };

    function press(key) {
      if (/^[0-9]$/.test(key)) {
        if (fresh || cur === "0" || cur === "Error" || cur === "Overflow") {
          cur = key;
          fresh = false;
        } else if (cur.replace(/[-.]/g, "").length < 14) {
          cur += key;
        }
      } else if (key === ".") {
        if (fresh) {
          cur = "0.";
          fresh = false;
        } else if (!cur.includes(".")) cur += ".";
      } else if (["+", "-", "×", "÷"].includes(key)) {
        if (acc !== null && op && !fresh) {
          cur = apply(acc, cur, op);
        }
        acc = cur;
        op = key;
        fresh = true;
        small.textContent = acc + " " + op;
      } else if (key === "=") {
        if (acc !== null && op) {
          const expr = acc + " " + op + " " + cur;
          cur = apply(acc, cur, op);
          small.textContent = expr + " =";
          acc = null;
          op = null;
          fresh = true;
        }
      } else if (key === "C") {
        cur = "0";
        acc = null;
        op = null;
        fresh = true;
        small.textContent = "";
      } else if (key === "±") {
        if (cur !== "0") cur = cur.startsWith("-") ? cur.slice(1) : "-" + cur;
      } else if (key === "%") {
        cur = String(parseFloat(cur) / 100);
      } else if (key === "⌫") {
        if (!fresh) {
          cur = cur.length > 1 ? cur.slice(0, -1) : "0";
          if (cur === "-") cur = "0";
        }
      }
      big.textContent = cur;
      if (fresh && ["+", "-", "×", "÷"].includes(key)) big.textContent = cur;
    }

    const layout = [
      ["C", "op"], ["±", "op"], ["%", "op"], ["÷", "op"],
      ["7", ""], ["8", ""], ["9", ""], ["×", "op"],
      ["4", ""], ["5", ""], ["6", ""], ["-", "op"],
      ["1", ""], ["2", ""], ["3", ""], ["+", "op"],
      ["0", ""], [".", ""], ["⌫", ""], ["=", "eq"],
    ];
    for (const [key, cls] of layout) {
      const btn = h(
        "button",
        { type: "button", className: cls ? cls : undefined, title: key },
        key
      );
      btn.addEventListener("click", () => press(key));
      grid.appendChild(btn);
    }

    disp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      const k = e.key;
      if (/^[0-9]$/.test(k)) press(k);
      else if (k === "." || k === ",") press(".");
      else if (["+", "-", "*", "/"].includes(k)) press(k === "*" ? "×" : k === "/" ? "÷" : k);
      else if (k === "Enter" || k === "=") press("=");
      else if (k === "Backspace") press("⌫");
      else if (k === "Escape" || k.toLowerCase() === "c") press("C");
      else if (k === "%") press("%");
      else return;
      e.preventDefault();
    });
    disp.setAttribute("tabindex", "-1");
    rec.onClose = () => {};
    later(() => {
      try {
        disp.focus();
      } catch (_) {}
    }, 40);
  }

  // ---------------------------------------------------------------------------
  // About ExOS
  // ---------------------------------------------------------------------------
  function buildAbout(body) {
    const scroll = h("div", { className: "eos-scroll" });
    const seal = sealSVG(78);
    scroll.appendChild(
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" } },
        seal,
        h(
          "div",
          null,
          h("div", { style: { fontSize: "24px" } }, OS_NAME + " " + OS_VERSION),
          h("div", { style: { fontSize: "13px", color: "var(--eos-muted)", marginTop: "4px" } },
            OS_CODENAME + " — a Ryoku-style desktop for Exotic Browser")
        )
      )
    );

    const u = diskUsage();
    const kv = h("dl", { className: "eos-kv" });
    for (const [k, v] of [
      ["System", OS_NAME + " " + OS_VERSION + " (" + OS_CODENAME + ")"],
      ["Kernel", KERNEL + " #1 SMP PREEMPT x86_64"],
      ["User", USER + "@" + hostname()],
      ["Uptime", uptimeString()],
      ["Virtual disk", DISK_NAME + " — " + fmtBytes(u.used) + " / " + fmtBytes(u.capacity)],
      ["Files", u.files + " files · " + u.dirs + " directories"],
      ["Storage backend", getStr(PREF_BACKEND, hasServices() ? "file" : "localStorage")],
      ["Host browser", "Exotic 159.0 · Exotic Engine 159.0"],
      ["Integration", "Exotic Mods → ExOS (exotic://mods)"],
      ["License", "GPL-3.0 · bundled as an Exotic Mod"],
    ]) {
      kv.appendChild(h("dt", null, k));
      kv.appendChild(h("dd", null, v));
    }
    scroll.appendChild(kv);
    scroll.appendChild(
      h(
        "div",
        { style: { marginTop: "18px", fontSize: "12px", color: "var(--eos-dim)", lineHeight: "1.6" } },
        "Everything you create here lives on the virtual hard disk image. Close ExOS with " +
          "Power → Shut Down and the disk is flushed before the display returns to Exotic."
      )
    );
    body.appendChild(scroll);
  }

  // ---------------------------------------------------------------------------
  // App registry
  // ---------------------------------------------------------------------------
  function buildKvmManager(body, rec) {
    const scroll = h("div", { className: "eos-scroll" });
    body.appendChild(scroll);

    scroll.appendChild(h("div", { className: "eos-sec-h" }, "Virtual Machine Manager"));
    scroll.appendChild(h("div", { className: "eos-row-s", style: { marginBottom: "10px" } }, "KVM/QEMU virtualization (simulated within ExOS sandbox)"));

    const vms = [
      { id: "vm1", name: "exos-dev", os: "ExOS 1.0", cpu: 2, mem: "2 GiB", disk: "20 GiB", status: "running" },
      { id: "vm2", name: "exos-test", os: "ExOS 1.0", cpu: 1, mem: "1 GiB", disk: "10 GiB", status: "stopped" },
      { id: "vm3", name: "exos-build", os: "ExOS 1.0", cpu: 4, mem: "4 GiB", disk: "40 GiB", status: "stopped" },
    ];

    const list = h("div", { className: "eos-scroll" });
    scroll.appendChild(list);

    function renderList() {
      clearEl(list);
      for (const vm of vms) {
        const row = h("div", { className: "eos-row", style: { padding: "8px 0", borderBottom: "1px solid var(--eos-line)" } });
        const info = h("div", { className: "eos-row-l" });
        info.appendChild(h("div", { className: "eos-row-t" }, vm.name));
        info.appendChild(h("div", { className: "eos-row-s" }, vm.os + "  \u2022  " + vm.cpu + " vCPU  \u2022  " + vm.mem + "  \u2022  " + vm.disk));
        info.appendChild(h("div", { className: vm.status === "running" ? "eos-oktext" : "eos-dimtext", style: { marginTop: "4px", fontSize: "11px" } }, "Status: " + vm.status));
        const actions = h("div", { style: { display: "flex", gap: "6px" } });
        const startBtn = h("button", { className: "eos-btn", type: "button", disabled: vm.status === "running" }, "Start");
        const stopBtn = h("button", { className: "eos-btn", type: "button", disabled: vm.status !== "running" }, "Stop");
        const delBtn = h("button", { className: "eos-btn eos-btn-danger", type: "button" }, "Delete");
        startBtn.addEventListener("click", () => { vm.status = "running"; renderList(); });
        stopBtn.addEventListener("click", () => { vm.status = "stopped"; renderList(); });
        delBtn.addEventListener("click", () => { const i = vms.indexOf(vm); if (i >= 0) { vms.splice(i, 1); } renderList(); });
        actions.appendChild(startBtn);
        actions.appendChild(stopBtn);
        actions.appendChild(delBtn);
        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
      }
      const addBtn = h("button", { className: "eos-btn eos-btn-primary", type: "button" }, "+ New VM");
      addBtn.addEventListener("click", () => {
        const name = prompt("VM name:");
        if (name) {
          vms.push({ id: "vm" + (vms.length + 1), name: name, os: "ExOS 1.0", cpu: 2, mem: "2 GiB", disk: "20 GiB", status: "stopped" });
          renderList();
        }
      });
      list.appendChild(h("div", { className: "eos-row", style: { marginTop: "10px" } }, addBtn));
    }

    renderList();
    rec.refresh = renderList;
  }

  const APPS = [
    { id: "terminal", name: "Terminal", desc: "exsh — the ExOS shell", icon: "terminal", width: 720, height: 460, singleton: false, build: buildTerminal },
    { id: "files", name: "Files", desc: "Browse the virtual hard disk", icon: "files", width: 720, height: 460, build: buildFiles },
    { id: "editor", name: "Text Editor", desc: "Edit files on the disk", icon: "editor", width: 700, height: 470, build: buildEditor },
    { id: "monitor", name: "System Monitor", desc: "CPU, memory, disk and processes", icon: "monitor", width: 660, height: 470, build: buildMonitor },
    { id: "hub", name: "System Hub", desc: "Hostname, appearance and storage", icon: "hub", width: 660, height: 470, build: buildHub },
    { id: "calc", name: "Calculator", desc: "Four functions, keyboard ready", icon: "calc", width: 320, height: 450, singleton: false, build: buildCalc },
    { id: "kvm", name: "Virtual Machine Manager", desc: "KVM/QEMU virtual machines", icon: "kvm", width: 820, height: 560, build: buildKvmManager },
  ];

  function renderAppsList(query) {
    if (!appsListEl) return;
    clearEl(appsListEl);
    const q = String(query || "").trim().toLowerCase();
    const matches = APPS.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    );
    if (!matches.length) {
      appsListEl.appendChild(h("div", { className: "eos-empty", style: { height: "64px" } }, "No matching apps"));
      return;
    }
    matches.forEach((a, i) => {
      const btn = h(
        "button",
        { className: "eos-app", type: "button", "data-sel": i === 0 ? "true" : "false" },
        h("span", { className: "eos-app-ico" }, iconSVG(a.icon, 17)),
        h("div", { className: "eos-app-txt" }, h("div", { className: "eos-app-name" }, a.name), h("div", { className: "eos-app-desc" }, a.desc))
      );
      btn.addEventListener("click", () => openApp(a.id));
      appsListEl.appendChild(btn);
    });
  }

  function openApp(id, opts) {
    const app = APPS.filter((a) => a.id === id)[0];
    if (!app) return null;
    if (launcherOpen) setLauncher(false);
    if (powerOpen) setPowerMenu(false);
    if (app.singleton !== false) {
      const existing = Array.from(openWindows.values()).filter((w) => w.id === id)[0];
      if (existing) {
        restoreWindow(existing);
        focusWindow(existing);
        if (opts && opts.path && typeof existing.openPath === "function") existing.openPath(opts.path);
        return existing;
      }
    }
    return createWindow({
      id: app.id,
      icon: app.icon,
      title: app.name,
      width: app.width,
      height: app.height,
      build: (body, rec) => app.build(body, rec, opts),
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const api = {
    name: OS_NAME,
    version: OS_VERSION,
    codename: OS_CODENAME,
    kernel: KERNEL,
    enabledPref: PREF_ENABLED,
    diskName: DISK_NAME,
    capacity: DISK_CAPACITY,
    open: openDisplay,
    close: closeDisplay,
    toggle: () => {
      if (displayEl) closeDisplay();
      else openDisplay();
    },
    isActive: () => !!displayEl,
    isDesktop: () => stage === "desktop",
    openApp: (id, opts) => {
      if (!displayEl) openDisplay();
      if (stage !== "desktop") skipBoot();
      later(() => openApp(id, opts), 30);
    },
    getApps: () => APPS.map((a) => ({ id: a.id, name: a.name, desc: a.desc })),
    getDiskInfo: () => {
      const u = diskUsage();
      return {
        file: DISK_NAME,
        capacity: u.capacity,
        used: u.used,
        free: u.free,
        files: u.files,
        dirs: u.dirs,
        backend: getStr(PREF_BACKEND, hasServices() ? "file" : "localStorage"),
        hostname: hostname(),
        boots: bootCount(),
        uptime: uptimeString(),
      };
    },
    formatDisk: () => {
      formatDisk();
      refreshAll();
      return api.getDiskInfo();
    },
    flush: () => persistNow(),
    createSealSVG: (targetDoc, size) => sealSVG(size),
    createAppIconSVG: (targetDoc, iconId, size) => iconSVG(iconId, size),
    getUptimeString: uptimeString,
    getHostname: hostname,
  };

  win.__exoticOS = api;

  // Disabling the Exotic Mod closes the display.
  let prefObserver = null;
  try {
    prefObserver = {
      observe(_subject, topic, data) {
        if (topic !== "nsPref:changed") return;
        if (data === PREF_ENABLED && !getBool(PREF_ENABLED, false)) closeDisplay();
      },
    };
    Services.prefs.addObserver(PREF_ENABLED, prefObserver);
  } catch (_) {}

  win.addEventListener(
    "unload",
    () => {
      clearTimers();
      if (clockTimer) {
        win.clearInterval(clockTimer);
        clockTimer = null;
      }
      try {
        if (prefObserver) Services.prefs.removeObserver(PREF_ENABLED, prefObserver);
      } catch (_) {}
    },
    { once: true }
  );
})();
