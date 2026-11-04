(() => {
  "use strict";

  const STORE_W = "etoc-width";
  const STORE_COLLAPSED = "etoc-collapsed";
  const MIN_W = 180;
  const MAX_W = 600;
  const root = document.documentElement;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  let panel = null;
  let reopenBtn = null;
  let links = [];
  let lastSignature = "";

  // ---------- パネル生成 ----------
  function createPanel() {
    panel = document.createElement("aside");
    panel.className = "etoc-panel";
    panel.innerHTML = `
      <div class="etoc-resizer" title="ドラッグで幅を変更"></div>
      <div class="etoc-header">
        <span class="etoc-title">目次</span>
        <button class="etoc-btn etoc-top" title="ページ先頭へ">↑</button>
        <button class="etoc-btn etoc-close" title="閉じる">✕</button>
      </div>
      <nav class="etoc-body"></nav>`;
    document.body.appendChild(panel);

    reopenBtn = document.createElement("button");
    reopenBtn.className = "etoc-reopen";
    reopenBtn.textContent = "☰ 目次";
    reopenBtn.title = "目次を開く";
    document.body.appendChild(reopenBtn);

    panel.querySelector(".etoc-close").addEventListener("click", () => setCollapsed(true));
    reopenBtn.addEventListener("click", () => setCollapsed(false));
    panel.querySelector(".etoc-top").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    setupResizer(panel.querySelector(".etoc-resizer"));

    const w = parseInt(store.get(STORE_W), 10);
    if (w >= MIN_W && w <= MAX_W) root.style.setProperty("--etoc-w", w + "px");
    setCollapsed(store.get(STORE_COLLAPSED) === "1");
  }

  function setCollapsed(v) {
    root.classList.toggle("etoc-collapsed", v);
    store.set(STORE_COLLAPSED, v ? "1" : "0");
  }

  function setupResizer(handle) {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      panel.classList.add("etoc-resizing");
      const onMove = (ev) => {
        const w = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - ev.clientX));
        root.style.setProperty("--etoc-w", w + "px");
      };
      const onUp = () => {
        panel.classList.remove("etoc-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const w = parseInt(getComputedStyle(root).getPropertyValue("--etoc-w"), 10);
        if (w) store.set(STORE_W, String(w));
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // ---------- 目次の中身を同期 ----------
  function targetOf(a) {
    const href = a.getAttribute("href") || "";
    if (!href.startsWith("#")) return null;
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep raw */ }
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function sync() {
    const src = document.querySelector(".toc .toc__list, .toc__list");
    if (!src || !src.querySelector("a")) {
      // 目次のないページ：何もしない（既存のパネルは隠す）
      root.classList.remove("etoc-on");
      if (panel) panel.style.display = "none";
      if (reopenBtn) reopenBtn.style.display = "none";
      lastSignature = "";
      return;
    }

    const signature = src.innerHTML;
    if (signature === lastSignature && panel) return;
    lastSignature = signature;

    if (!panel) createPanel();
    panel.style.display = "";
    reopenBtn.style.display = "";
    root.classList.add("etoc-on");

    const body = panel.querySelector(".etoc-body");
    body.innerHTML = "";
    body.appendChild(src.cloneNode(true));

    links = [...body.querySelectorAll("a")].map((a) => ({ a, target: targetOf(a) }))
      .filter((l) => l.target);

    links.forEach(({ a, target }) => {
      a.title = a.textContent.trim();
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - headerOffset();
        window.scrollTo({ top: y, behavior: "smooth" });
        history.replaceState(null, "", a.getAttribute("href"));
      });
    });

    updateActive();
  }

  // ---------- 現在位置のハイライト ----------
  function headerOffset() {
    const fh = document.querySelector(".floating-header");
    let h = 0;
    if (fh) {
      const r = fh.getBoundingClientRect();
      if (r.bottom > 0 && getComputedStyle(fh).display !== "none") h = r.bottom;
    }
    return h + 12;
  }

  let ticking = false;
  function updateActive() {
    ticking = false;
    if (!links.length) return;
    const line = headerOffset() + 8;
    let current = null;
    for (const l of links) {
      if (l.target.getBoundingClientRect().top <= line) current = l;
      else break;
    }
    // ページ末尾に到達したら最後の見出しをアクティブに
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      current = links[links.length - 1];
    }
    links.forEach((l) => l.a.classList.toggle("etoc-active", l === current));

    if (current) {
      const body = panel.querySelector(".etoc-body");
      const ar = current.a.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      if (ar.top < br.top || ar.bottom > br.bottom) {
        body.scrollTop += ar.top - br.top - br.height / 2 + ar.height / 2;
      }
    }
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateActive);
    }
  }

  // ---------- 起動 ----------
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  let syncTimer = null;
  new MutationObserver(() => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 200);
  }).observe(document.body, { childList: true, subtree: true });

  sync();
})();
