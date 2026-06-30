/*
 * GAMLEARN custom PDF viewer.
 *
 * Replaces the old Common Ninja "PDF Flipbook" embeds with a bespoke, on-brand,
 * fully self-hosted viewer built on Mozilla's PDF.js. No third-party widget, no
 * subscription, no external network calls — the PDFs live in /pdfs and PDF.js
 * lives in /_assets/pdfjs.
 *
 * HOW IT WORKS
 * ------------
 * The Framer pages still render the Common Ninja mount element:
 *
 *     <div class="commonninja_component pid-XXXXXXXX-...."></div>
 *
 * The commoninja.com <script> that used to populate it has been stripped from
 * the Framer bundles, so the div is now an inert placeholder. This file finds
 * each placeholder, reads its pid- class, maps it to a local PDF (see PDFS) and
 * renders our own paged viewer in its place.
 *
 * Like reviews.js, it is loaded site-wide, is inert on pages with no mount, and
 * re-asserts itself after Framer hydration via a MutationObserver, so it keeps
 * working even when Framer re-paints the page.
 *
 * ADDING / CHANGING A PDF
 * -----------------------
 * Drop the file in /pdfs and add (or edit) its pid entry in the PDFS map below.
 * The pid is the suffix on the mount's "pid-..." class.
 */
(function () {
  "use strict";

  // --- Config ----------------------------------------------------------------
  var PDFJS_LIB = "/_assets/pdfjs/pdf.min.js";
  var PDFJS_WORKER = "/_assets/pdfjs/pdf.worker.min.js";
  var PDF_BASE = "/pdfs/";

  // Brand tokens (same Framer design tokens reviews.js / webhooks.js use, with
  // hard fallbacks). Green = primary, Purple = accent.
  var BRAND_GREEN =
    "var(--token-1c79ec7e-49ca-45a4-8f59-5d04cfb04595, #00664d)";
  var BRAND_PURPLE =
    "var(--token-78d77a8e-a6d1-46a2-b298-d1a12220fc6e, #4b0082)";

  // pid (the suffix on the mount's "pid-..." class) -> local PDF + accessible
  // title. These are the four flipbooks that were hosted on Common Ninja.
  var PDFS = {
    "78bd9cc5-74cf-445e-87a4-648c9dbe64d1": {
      file: "we-are-the-evidence-too.pdf",
      title: "#We Are the Evidence Too",
    },
    "1d4eeb53-a0fe-4fc0-ae0f-e6db6d17a168": {
      file: "support-services-available-to-you.pdf",
      title: "Support services available to you",
    },
    "81286b01-86e6-49d4-b815-f2f58a03fb88": {
      file: "committed-a-crime-to-fund-gambling.pdf",
      title: "Have you, or someone you know, committed a crime to fund gambling?",
    },
    "d76d00ab-8a79-4e90-a035-e6309890e6a7": {
      file: "understanding-gambling-related-harm-impact-report.pdf",
      title:
        "Understanding Gambling Related Harm and its Links to Crime — Impact and Outcomes Report",
    },
  };

  var ZOOM_STEP = 0.25;
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 3;

  // --- Helpers ---------------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Pull the pid out of a "commonninja_component pid-XXXX" class string.
  function pidOf(el) {
    var m = /\bpid-([0-9a-f-]{8,})\b/i.exec(el.className || "");
    return m ? m[1] : null;
  }

  function icon(paths, opts) {
    opts = opts || {};
    return (
      '<svg viewBox="0 0 24 24" fill="' + (opts.fill || "none") + '" ' +
      'stroke="' + (opts.stroke || "currentColor") + '" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      "</svg>"
    );
  }

  // --- Styles (injected once) ------------------------------------------------
  function injectStyles() {
    if (document.getElementById("glpdf-styles")) return;
    var css =
      ".glpdf{--glpdf-green:" + BRAND_GREEN + ";--glpdf-purple:" + BRAND_PURPLE + ";" +
        "--glpdf-ink:#0c0c0c;--glpdf-muted:#5a5a5a;--glpdf-line:rgba(12,12,12,.1);" +
        "--glpdf-bg:#f3f4f6;" +
        "font-family:\"Urbanist\",\"Urbanist Placeholder\",sans-serif;" +
        // Size to the viewport, not to the (unpredictable) Framer overlay box it
        // lives in. height:auto = toolbar + bounded stage, so the toolbar is
        // always on screen and the page never blows past the viewport.
        "display:flex;flex-direction:column;width:100%;height:auto;" +
        "max-width:min(94vw,980px);max-height:90vh;margin:0 auto;box-sizing:border-box;" +
        "border:1px solid var(--glpdf-line);border-radius:16px;overflow:hidden;" +
        "background:#fff;box-shadow:0 1px 2px rgba(12,12,12,.04),0 18px 40px -30px rgba(12,12,12,.3);}" +
      ".glpdf *,.glpdf *::before,.glpdf *::after{box-sizing:border-box;}" +
      ".glpdf:fullscreen{border-radius:0;max-width:none;max-height:none;width:100%;height:100%;margin:0;}" +
      ".glpdf:fullscreen .glpdf-stage{height:auto;flex:1 1 auto;}" +

      /* Toolbar */
      ".glpdf-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;" +
        "padding:10px 14px;background:#fff;border-bottom:1px solid var(--glpdf-line);}" +
      ".glpdf-grp{display:flex;align-items:center;gap:6px;}" +
      ".glpdf-spacer{flex:1 1 auto;}" +
      ".glpdf-btn{flex:0 0 auto;width:38px;height:38px;border-radius:10px;border:1px solid var(--glpdf-line);" +
        "background:#fff;color:var(--glpdf-ink);display:inline-flex;align-items:center;justify-content:center;" +
        "cursor:pointer;transition:background .2s,color .2s,border-color .2s,transform .12s;padding:0;}" +
      ".glpdf-btn svg{width:19px;height:19px;}" +
      ".glpdf-btn:hover{background:var(--glpdf-green);border-color:var(--glpdf-green);color:#fff;}" +
      ".glpdf-btn:active{transform:scale(.94);}" +
      ".glpdf-btn:disabled{opacity:.35;cursor:default;}" +
      ".glpdf-btn:disabled:hover{background:#fff;color:var(--glpdf-ink);border-color:var(--glpdf-line);}" +
      ".glpdf-btn.is-cta{background:var(--glpdf-purple);border-color:var(--glpdf-purple);color:#fff;}" +
      ".glpdf-btn.is-cta:hover{filter:brightness(1.08);}" +
      ".glpdf-page{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;" +
        "color:var(--glpdf-ink);white-space:nowrap;user-select:none;}" +
      ".glpdf-page input{width:46px;text-align:center;font:inherit;font-weight:600;padding:7px 4px;" +
        "border:1px solid var(--glpdf-line);border-radius:8px;color:var(--glpdf-ink);background:#fff;" +
        "-moz-appearance:textfield;}" +
      ".glpdf-page input::-webkit-outer-spin-button,.glpdf-page input::-webkit-inner-spin-button{" +
        "-webkit-appearance:none;margin:0;}" +
      ".glpdf-page .glpdf-of{color:var(--glpdf-muted);font-weight:500;}" +
      ".glpdf-zoom{min-width:50px;text-align:center;font-size:13px;font-weight:600;color:var(--glpdf-muted);" +
        "user-select:none;}" +

      /* Stage (scrollable page area) */
      ".glpdf-stage{height:min(74vh,720px);position:relative;overflow:auto;background:var(--glpdf-bg);" +
        "display:flex;justify-content:center;align-items:flex-start;padding:22px;" +
        "-webkit-overflow-scrolling:touch;}" +
      ".glpdf-canvas-wrap{position:relative;margin:auto;box-shadow:0 6px 24px -8px rgba(12,12,12,.45);" +
        "background:#fff;line-height:0;border-radius:2px;}" +
      ".glpdf-canvas-wrap canvas{display:block;max-width:100%;height:auto;border-radius:2px;}" +

      /* Loading + error states */
      ".glpdf-msg{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;" +
        "align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--glpdf-muted);" +
        "font-size:15px;}" +
      ".glpdf-spin{width:38px;height:38px;border-radius:50%;border:3px solid rgba(12,12,12,.12);" +
        "border-top-color:var(--glpdf-green);animation:glpdf-spin 0.8s linear infinite;}" +
      "@keyframes glpdf-spin{to{transform:rotate(360deg);}}" +
      ".glpdf-msg a{color:var(--glpdf-purple);font-weight:600;}" +

      /* Toolbar labels hide on narrow screens to keep one row */
      ".glpdf-btn-label{display:none;}" +
      "@media (max-width:640px){.glpdf-bar{gap:6px;padding:8px 10px;}" +
        ".glpdf-btn{width:36px;height:36px;}.glpdf-zoom{display:none;}}" +

      "@media (prefers-reduced-motion:reduce){.glpdf-spin{animation-duration:0s;}" +
        ".glpdf-btn{transition:none;}}";

    var style = document.createElement("style");
    style.id = "glpdf-styles";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // --- PDF.js loader (once, on demand) ---------------------------------------
  var pdfjsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return Promise.resolve(window.pdfjsLib);
    }
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = PDFJS_LIB;
      s.async = true;
      s.onload = function () {
        if (!window.pdfjsLib) {
          reject(new Error("pdfjsLib not available after load"));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      s.onerror = function () {
        reject(new Error("failed to load " + PDFJS_LIB));
      };
      (document.head || document.documentElement).appendChild(s);
    });
    return pdfjsPromise;
  }

  // --- Viewer ----------------------------------------------------------------
  function buildViewer(mount, meta) {
    var url = PDF_BASE + meta.file;

    var root = document.createElement("div");
    root.className = "glpdf";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", meta.title || "PDF document");

    var prevP =
      '<path d="M15 6l-6 6 6 6"/>';
    var nextP =
      '<path d="M9 6l6 6-6 6"/>';
    var zoomOutP =
      '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6"/>';
    var zoomInP =
      '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>';
    var downloadP =
      '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>';
    var fsP =
      '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>' +
      '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';

    root.innerHTML =
      '<div class="glpdf-bar">' +
        '<div class="glpdf-grp">' +
          '<button type="button" class="glpdf-btn" data-act="prev" aria-label="Previous page">' + icon(prevP) + "</button>" +
          '<span class="glpdf-page">' +
            '<input type="text" inputmode="numeric" value="1" aria-label="Page number" data-act="pageinput">' +
            '<span class="glpdf-of">/&nbsp;<span data-act="count">–</span></span>' +
          "</span>" +
          '<button type="button" class="glpdf-btn" data-act="next" aria-label="Next page">' + icon(nextP) + "</button>" +
        "</div>" +
        '<div class="glpdf-spacer"></div>' +
        '<div class="glpdf-grp">' +
          '<button type="button" class="glpdf-btn" data-act="zoomout" aria-label="Zoom out">' + icon(zoomOutP) + "</button>" +
          '<span class="glpdf-zoom" data-act="zoomlabel">100%</span>' +
          '<button type="button" class="glpdf-btn" data-act="zoomin" aria-label="Zoom in">' + icon(zoomInP) + "</button>" +
        "</div>" +
        '<div class="glpdf-grp">' +
          '<a class="glpdf-btn is-cta" data-act="download" href="' + esc(url) + '" download ' +
            'aria-label="Download PDF">' + icon(downloadP) + "</a>" +
          '<button type="button" class="glpdf-btn" data-act="fullscreen" aria-label="Toggle fullscreen">' + icon(fsP) + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="glpdf-stage" data-act="stage" tabindex="0">' +
        '<div class="glpdf-msg" data-act="msg"><span class="glpdf-spin"></span><span>Loading document…</span></div>' +
      "</div>";

    // Replace the inert Common Ninja placeholder's contents with our viewer, and
    // drop the commonninja_component class so any late-loading SDK ignores it.
    mount.classList.remove("commonninja_component");
    mount.style.display = "flex";
    mount.style.alignItems = "center";
    mount.style.justifyContent = "center";
    mount.style.width = "100%";
    mount.style.height = "100%";
    mount.style.minHeight = "0";
    mount.innerHTML = "";
    mount.appendChild(root);

    wireViewer(root, url, meta);
  }

  function wireViewer(root, url, meta) {
    var stage = root.querySelector('[data-act="stage"]');
    var msg = root.querySelector('[data-act="msg"]');
    var prevBtn = root.querySelector('[data-act="prev"]');
    var nextBtn = root.querySelector('[data-act="next"]');
    var pageInput = root.querySelector('[data-act="pageinput"]');
    var countEl = root.querySelector('[data-act="count"]');
    var zoomInBtn = root.querySelector('[data-act="zoomin"]');
    var zoomOutBtn = root.querySelector('[data-act="zoomout"]');
    var zoomLabel = root.querySelector('[data-act="zoomlabel"]');
    var fsBtn = root.querySelector('[data-act="fullscreen"]');

    var pdf = null;
    var pageCount = 0;
    var current = 1;
    var zoom = 1; // 1 = fit-to-width
    var renderTask = null;
    var canvasWrap = null;
    var renderToken = 0;

    function showMsg(html) {
      msg.innerHTML = html;
      msg.style.display = "flex";
    }
    function hideMsg() {
      msg.style.display = "none";
    }

    function updateControls() {
      prevBtn.disabled = current <= 1;
      nextBtn.disabled = current >= pageCount;
      pageInput.value = String(current);
      countEl.textContent = String(pageCount);
      zoomLabel.textContent = Math.round(zoom * 100) + "%";
      zoomOutBtn.disabled = zoom <= ZOOM_MIN + 0.001;
      zoomInBtn.disabled = zoom >= ZOOM_MAX - 0.001;
    }

    // Render the current page, fitting page width to the stage (× zoom).
    function renderPage() {
      if (!pdf) return;
      var token = ++renderToken;
      if (renderTask) {
        try { renderTask.cancel(); } catch (e) {}
        renderTask = null;
      }
      pdf.getPage(current).then(function (page) {
        if (token !== renderToken) return; // superseded
        var unscaled = page.getViewport({ scale: 1 });
        // Fit the WHOLE page inside the stage (both axes) at zoom 1, so the page
        // is fully visible and never overflows the viewer; zoom scales up from there.
        var availW = Math.max(80, stage.clientWidth - 44); // minus stage padding
        var availH = Math.max(80, stage.clientHeight - 44);
        var fit = Math.min(availW / unscaled.width, availH / unscaled.height);
        var scale = fit * zoom;
        var dpr = window.devicePixelRatio || 1;
        var viewport = page.getViewport({ scale: scale });

        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        var wrap = document.createElement("div");
        wrap.className = "glpdf-canvas-wrap";
        wrap.appendChild(canvas);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        });
        renderTask.promise.then(
          function () {
            if (token !== renderToken) return;
            renderTask = null;
            if (canvasWrap && canvasWrap.parentNode) {
              canvasWrap.parentNode.removeChild(canvasWrap);
            }
            canvasWrap = wrap;
            stage.appendChild(wrap);
            hideMsg();
            updateControls();
          },
          function (err) {
            if (err && err.name === "RenderingCancelledException") return;
            console.error("[pdf-viewer] render failed:", err);
          }
        );
      }).catch(function (err) {
        console.error("[pdf-viewer] getPage failed:", err);
      });
    }

    function goTo(n) {
      n = Math.max(1, Math.min(pageCount, n | 0));
      if (n === current && canvasWrap) return;
      current = n;
      updateControls();
      renderPage();
      // Reset scroll to the top of the new page.
      stage.scrollTop = 0;
    }

    function setZoom(z) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      updateControls();
      renderPage();
    }

    // Events
    prevBtn.addEventListener("click", function () { goTo(current - 1); });
    nextBtn.addEventListener("click", function () { goTo(current + 1); });
    zoomInBtn.addEventListener("click", function () { setZoom(zoom + ZOOM_STEP); });
    zoomOutBtn.addEventListener("click", function () { setZoom(zoom - ZOOM_STEP); });

    pageInput.addEventListener("change", function () {
      var v = parseInt(pageInput.value, 10);
      if (isNaN(v)) { pageInput.value = String(current); return; }
      goTo(v);
    });
    pageInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); pageInput.blur(); }
    });

    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goTo(current + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goTo(current - 1); }
    });

    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement === root) {
        if (document.exitFullscreen) document.exitFullscreen();
      } else if (root.requestFullscreen) {
        root.requestFullscreen().catch(function () {});
      }
    });
    document.addEventListener("fullscreenchange", function () {
      // Re-fit when entering/leaving fullscreen (stage width changes).
      if (pdf) renderPage();
    });

    // Re-fit to width on resize (debounced) — only when at fit-width zoom or
    // always, to keep the page crisp.
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (pdf) renderPage(); }, 180);
    });

    // Load the document.
    loadPdfJs()
      .then(function (lib) {
        return lib.getDocument({ url: url }).promise;
      })
      .then(function (doc) {
        pdf = doc;
        pageCount = doc.numPages;
        current = 1;
        updateControls();
        renderPage();
      })
      .catch(function (err) {
        console.error("[pdf-viewer] failed to open " + url, err);
        showMsg(
          "<span>Sorry, this document couldn’t be loaded.</span>" +
          '<a href="' + esc(url) + '" target="_blank" rel="noopener">Open the PDF directly</a>'
        );
      });
  }

  // --- Mount lifecycle -------------------------------------------------------
  // Find every Common Ninja placeholder we recognise and take it over once.
  function processMounts() {
    var mounts = document.querySelectorAll('[class*="pid-"]');
    Array.prototype.forEach.call(mounts, function (mount) {
      if (mount.getAttribute("data-glpdf") === "done") return;
      var pid = pidOf(mount);
      if (!pid) return;
      var meta = PDFS[pid];
      if (!meta) return; // a pid- element we don't manage
      mount.setAttribute("data-glpdf", "done");
      buildViewer(mount, meta);
    });
  }

  function start() {
    injectStyles();
    processMounts();

    // Re-assert after Framer hydration (which can recreate the placeholder).
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        processMounts();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Belt-and-braces in case the observer misses an early hydration swap.
    [300, 1200, 3000].forEach(function (ms) {
      setTimeout(processMounts, ms);
    });
    window.addEventListener("load", processMounts);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
