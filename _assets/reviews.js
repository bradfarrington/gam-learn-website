/*
 * GAMLEARN custom reviews section.
 *
 * Replaces the old GoHighLevel "lc_reviews_widget" iframe with a bespoke,
 * on-brand carousel that pulls live, published reviews straight from the CRM's
 * Supabase database (gam-learn-crm) and never shows review dates.
 *
 * HOW TO USE ON A PAGE
 * --------------------
 * Drop a single mount element wherever the section should appear:
 *
 *     <div data-gl-reviews></div>                      (all published reviews)
 *     <div data-gl-reviews data-category="research"></div>   (one category)
 *
 *   - data-category : optional. The SLUG of a row in review_categories. When
 *                     set, only reviews linked to that category are shown.
 *   - data-heading  : optional. Override the section heading.
 *   - data-intro    : optional. Override the sub-heading paragraph.
 *   - data-limit    : optional. Max number of reviews to request.
 *
 * This file is loaded site-wide (alongside webhooks.js) and is inert on pages
 * that have no mount element, so adding the section anywhere is just the div.
 *
 * DATA / SECURITY
 * ---------------
 * Reads go directly to Supabase PostgREST with the project's *publishable*
 * (anon) key. That key is designed to be public; row-level security on the
 * database only ever exposes reviews where is_published = true, so nothing
 * unpublished can leak. No secret keys live in this file.
 */
(function () {
  "use strict";

  // --- Config ----------------------------------------------------------------
  var SUPABASE_URL = "https://boelrbcmcotntfbukzfc.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_NpTvep2Jycfilu33SfHR2g_DCixDOod";
  var REST = SUPABASE_URL + "/rest/v1/reviews";

  // Brand tokens (Framer design tokens, with hard fallbacks for the iframe-less
  // contexts). Green = primary, Purple = accent — same tokens the rest of the
  // site / webhooks.js use.
  var BRAND_GREEN =
    "var(--token-1c79ec7e-49ca-45a4-8f59-5d04cfb04595, #00664d)";
  var BRAND_PURPLE =
    "var(--token-78d77a8e-a6d1-46a2-b298-d1a12220fc6e, #4b0082)";

  // The little "pill" badge that sits above the heading (icon + label),
  // mirroring the homepage "Voices of Support" section. The diamond icon and
  // its light-green circle reuse the same asset / brand colour as the homepage.
  var PILL_ICON = "/_assets/fu/images/q14stl_PF2dbStqm5QKC5yGdJiRGRr68.png";
  var PILL_ICON_BG =
    "var(--token-786948c5-9c7f-4fde-87b4-2cb93647bf2f, rgb(201, 242, 227))";
  var DEFAULT_PILL = "Voices of Support";

  // Default copy (overridable per mount via data-heading / data-intro).
  var DEFAULT_HEADING = "Hear from those whose lives we’ve impacted";
  var DEFAULT_INTRO =
    "Every story shared reminds us why we do what we do. From individuals to " +
    "partners, our community’s trust and feedback drive us to keep creating change.";

  // Offline / network-failure fallback so the homepage section always looks
  // complete. These mirror a cross-section of the live lived-experience reviews
  // (Criminal Justice Support / Impacted Others) — no star ratings, since the
  // quotes were supplied without them. Only used if the database is unreachable.
  var FALLBACK_REVIEWS = [
    { reviewer_name: "Christine", rating: null, body: "GamLEARN saved my life." },
    { reviewer_name: "Anonymous", rating: null, body: "No longer feel terrified and hopeless. Realise I’m not alone. Surrounded by people who get it and don’t judge. It’s made me able to carry on. Literally a life saver." },
    { reviewer_name: "Jen", rating: null, body: "Throughout my recovery GamLEARN has provided guidance and support enabling me to put one foot in front of the other and achieve what at the beginning I believed to be unimaginable. When your world fall apart you think there is no hope and no future but here, I am still standing… stronger, clearer and most importantly bet free. I feel more able to cope with the next steps with the support of friends I’ve met through the group, and I am no longer alone." },
    { reviewer_name: "Anonymous", rating: null, body: "A huge difference. I don’t know if I could have navigated my situation without the support I received. The support, especially the calls were my lifeline." },
    { reviewer_name: "Leanne", rating: null, body: "GamLEARN have been my strength throughout my recovery! They were there for me without judgement when I hit my rock bottom!" },
    { reviewer_name: "Anonymous", rating: null, body: "The biggest thing is not feeling alone. Just to know you’re not alone and have the chance to communicate with others in the same situation And Tracy has always been able to fully understand all of the emotions I have felt as she has lived experience of addiction and gambling related crime." }
  ];

  // --- Helpers ---------------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // A real, displayable name? "Anonymous" (any case) and blanks count as no name,
  // so those cards render the quote with no avatar / name line.
  function hasName(name) {
    var n = String(name == null ? "" : name).trim();
    return !!n && n.toLowerCase() !== "anonymous";
  }

  // Only show stars when an actual 1–5 rating was supplied. Many newer reviews
  // (CJS / Impacted Others / Research) have no rating — those show no stars.
  function validRating(rating) {
    return typeof rating === "number" && rating >= 1;
  }

  function starsSvg(rating) {
    var n = Math.max(0, Math.min(5, Math.round(rating || 5)));
    var star =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.06 1.1-6.47-4.7-4.58 6.5-.95z"/>' +
      "</svg>";
    var html = "";
    for (var i = 0; i < 5; i++) {
      html += '<span class="glr-star' + (i < n ? " is-on" : "") + '">' + star + "</span>";
    }
    return (
      '<div class="glr-stars" role="img" aria-label="' +
      n +
      ' out of 5 stars">' +
      html +
      "</div>"
    );
  }

  // --- Styles (injected once) ------------------------------------------------
  function injectStyles() {
    if (document.getElementById("glr-styles")) return;
    var css =
      ".glr-section{--glr-green:" + BRAND_GREEN + ";--glr-purple:" + BRAND_PURPLE + ";" +
        "--glr-ink:#0c0c0c;--glr-muted:#5a5a5a;--glr-card:#fff;--glr-line:rgba(12,12,12,.08);" +
        // Match the rest of the site: Urbanist is the site's typeface.
        "font-family:\"Urbanist\",\"Urbanist Placeholder\",sans-serif;" +
        "width:100%;box-sizing:border-box;}" +
      ".glr-section *,.glr-section *::before,.glr-section *::after{box-sizing:border-box;}" +

      /* Injected page section (sub-pages): provides the padding/width that the
         homepage gets from its surrounding Framer layout. Background is left
         transparent so every reviews section sits on the same page background
         as the homepage one. */
      ".glr-page-section{width:100%;box-sizing:border-box;padding:96px 20px;background:transparent;}" +
      ".glr-page-section .glr-section{max-width:1200px;margin:0 auto;}" +

      /* Section head: pill badge + heading + intro, mirroring the homepage
         "Voices of Support" block. Heading/intro match the site's section-title
         styling (Urbanist 42/700, body 18/400). */
      ".glr-head{text-align:center;max-width:760px;margin:0 auto 44px;}" +
      ".glr-pill{display:inline-flex;align-items:center;gap:10px;margin:0 0 22px;" +
        "padding:6px 18px 6px 6px;border-radius:100px;background:#fff;" +
        "border:1px solid var(--glr-line);box-shadow:0 1px 2px rgba(12,12,12,.05);}" +
      ".glr-pill-ic{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:inline-flex;" +
        "align-items:center;justify-content:center;background:" + PILL_ICON_BG + ";}" +
      ".glr-pill-ic img{width:19px;height:19px;display:block;object-fit:contain;}" +
      ".glr-pill-tx{font-weight:600;font-size:15px;color:var(--glr-ink);letter-spacing:.1px;}" +
      ".glr-heading{margin:0 0 16px;font-weight:700;line-height:1.2;color:var(--glr-ink);" +
        "letter-spacing:-.03em;font-size:clamp(28px,3.6vw,42px);}" +
      ".glr-intro{margin:0 auto;color:var(--glr-muted);font-weight:400;font-size:18px;line-height:1.7;}" +

      /* Track */
      ".glr-viewport{position:relative;}" +
      ".glr-track{display:flex;gap:24px;overflow-x:auto;scroll-snap-type:x mandatory;" +
        "scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:8px 4px 28px;" +
        "scrollbar-width:none;}" +
      ".glr-track::-webkit-scrollbar{display:none;}" +
      ".glr-slide{scroll-snap-align:start;flex:0 0 calc((100% - 48px)/3);min-width:0;}" +
      "@media (max-width:1100px){.glr-slide{flex-basis:calc((100% - 24px)/2);}}" +
      "@media (max-width:680px){.glr-track{gap:16px;}.glr-slide{flex-basis:100%;}}" +

      /* Card */
      ".glr-card{position:relative;height:100%;background:var(--glr-card);border:1px solid var(--glr-line);" +
        "border-radius:22px;padding:28px 28px 24px;display:flex;flex-direction:column;gap:18px;" +
        "box-shadow:0 1px 2px rgba(12,12,12,.04),0 18px 40px -28px rgba(12,12,12,.28);" +
        "transition:transform .35s ease,box-shadow .35s ease,border-color .35s ease;overflow:hidden;}" +
      ".glr-card::before{content:'';position:absolute;left:0;top:0;height:4px;width:100%;" +
        "background:linear-gradient(90deg,var(--glr-green),var(--glr-purple));opacity:.9;}" +
      ".glr-card:hover{transform:translateY(-4px);border-color:rgba(12,12,12,.14);" +
        "box-shadow:0 1px 2px rgba(12,12,12,.05),0 26px 50px -28px rgba(75,0,130,.4);}" +
      ".glr-quote{position:absolute;top:14px;right:22px;font-family:Georgia,'Times New Roman',serif;" +
        "font-size:96px;line-height:1;color:var(--glr-purple);opacity:.08;pointer-events:none;" +
        "user-select:none;}" +

      /* Stars */
      ".glr-stars{display:inline-flex;gap:3px;position:relative;}" +
      ".glr-star{width:19px;height:19px;display:inline-flex;}" +
      ".glr-star svg{width:100%;height:100%;fill:#e2e4e9;}" +
      ".glr-star.is-on svg{fill:#ffb400;}" +

      /* Body */
      ".glr-body{position:relative;color:var(--glr-ink);font-size:16px;line-height:1.62;" +
        "margin:0;flex:1 1 auto;white-space:pre-line;}" +
      ".glr-body.is-clamped{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;" +
        "overflow:hidden;}" +
      ".glr-more{align-self:flex-start;background:none;border:0;padding:0;margin:-6px 0 0;cursor:pointer;" +
        "color:var(--glr-purple);font-weight:600;font-size:14.5px;font-family:inherit;}" +
      ".glr-more:hover{text-decoration:underline;}" +

      /* Author */
      ".glr-author{display:flex;align-items:center;gap:13px;margin-top:auto;padding-top:4px;}" +
      ".glr-avatar{flex:0 0 auto;width:46px;height:46px;border-radius:50%;display:flex;" +
        "align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;" +
        "letter-spacing:.3px;background:linear-gradient(135deg,var(--glr-green),var(--glr-purple));}" +
      ".glr-name{font-weight:600;font-size:16px;color:var(--glr-ink);line-height:1.2;}" +

      /* Controls */
      ".glr-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:8px;}" +
      ".glr-arrow{flex:0 0 auto;width:48px;height:48px;border-radius:50%;border:1.5px solid var(--glr-line);" +
        "background:#fff;color:var(--glr-ink);display:inline-flex;align-items:center;justify-content:center;" +
        "cursor:pointer;transition:background .25s,color .25s,border-color .25s,transform .15s,opacity .25s;}" +
      ".glr-arrow svg{width:20px;height:20px;}" +
      ".glr-arrow:hover{background:var(--glr-purple);border-color:var(--glr-purple);color:#fff;}" +
      ".glr-arrow:active{transform:scale(.94);}" +
      ".glr-arrow:disabled{opacity:.35;cursor:default;}" +
      ".glr-arrow:disabled:hover{background:#fff;color:var(--glr-ink);border-color:var(--glr-line);}" +
      ".glr-dots{display:flex;align-items:center;gap:9px;}" +
      ".glr-dot{width:9px;height:9px;border-radius:50%;border:0;padding:0;cursor:pointer;background:#d3d6dd;" +
        "transition:width .3s,background .3s;}" +
      ".glr-dot.is-active{width:26px;border-radius:6px;background:var(--glr-green);}" +

      /* States */
      ".glr-loading{display:flex;gap:24px;}" +
      ".glr-skel{flex:1 1 0;height:240px;border-radius:22px;border:1px solid var(--glr-line);" +
        "background:linear-gradient(100deg,#f3f4f6 30%,#e9ebef 50%,#f3f4f6 70%);" +
        "background-size:200% 100%;animation:glr-shimmer 1.3s linear infinite;}" +
      "@media (max-width:1100px){.glr-skel:nth-child(3){display:none;}}" +
      "@media (max-width:680px){.glr-skel:nth-child(2){display:none;}}" +
      "@keyframes glr-shimmer{to{background-position:-200% 0;}}" +

      "@media (prefers-reduced-motion:reduce){.glr-track{scroll-behavior:auto;}" +
        ".glr-card{transition:none;}.glr-skel{animation:none;}}";

    var style = document.createElement("style");
    style.id = "glr-styles";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // --- Card rendering --------------------------------------------------------
  function buildCard(review) {
    var slide = document.createElement("article");
    slide.className = "glr-slide";

    var card = document.createElement("div");
    card.className = "glr-card";

    // Stars only when a rating exists; author block only when there's a real
    // name (anonymous quotes show neither).
    var starsHtml = validRating(review.rating) ? starsSvg(review.rating) : "";
    var authorHtml = hasName(review.reviewer_name)
      ? '<div class="glr-author">' +
          '<span class="glr-avatar" aria-hidden="true">' + esc(initials(review.reviewer_name)) + "</span>" +
          '<span class="glr-name">' + esc(review.reviewer_name) + "</span>" +
        "</div>"
      : "";

    // Render clamped with the button hidden; applyClamps() measures real
    // overflow after layout and only reveals "Read more" when text is actually
    // cut off — so the button never appears on a review that already fits.
    card.innerHTML =
      '<span class="glr-quote" aria-hidden="true">“</span>' +
      starsHtml +
      '<p class="glr-body is-clamped">' + esc(review.body) + "</p>" +
      '<button type="button" class="glr-more" style="display:none">Read more</button>' +
      authorHtml;

    // The "Read more" toggle is handled by a single delegated listener (see
    // installReadMore) so it keeps working even after Framer hydration re-paints
    // the cards and replaces the original button elements.

    slide.appendChild(card);
    return slide;
  }

  // Decide per card whether the body is actually clipped by the line-clamp.
  // Show "Read more" only when there is genuinely hidden text; otherwise unclamp
  // and hide the button. Re-run after layout changes (render, resize, fonts).
  function applyClamps() {
    var cards = document.querySelectorAll(".glr-card");
    Array.prototype.forEach.call(cards, function (card) {
      var body = card.querySelector(".glr-body");
      var btn = card.querySelector(".glr-more");
      if (!body || !btn) return;
      if (body.getAttribute("data-expanded") === "1") return; // user opened it
      body.classList.add("is-clamped");
      var overflowing = body.scrollHeight - body.clientHeight > 4;
      if (overflowing) {
        btn.style.display = "";
        btn.textContent = "Read more";
      } else {
        btn.style.display = "none";
        body.classList.remove("is-clamped"); // nothing hidden — show in full
      }
    });
  }

  // One document-level handler for every "Read more" button, now and in future
  // re-renders. Idempotent.
  function installReadMore() {
    if (window.__glrReadMore) return;
    window.__glrReadMore = true;
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".glr-more");
      if (!btn) return;
      var card = btn.closest(".glr-card");
      var body = card && card.querySelector(".glr-body");
      if (!body) return;
      e.preventDefault();
      var clamped = body.classList.toggle("is-clamped");
      btn.textContent = clamped ? "Read more" : "Show less";
      body.setAttribute("data-expanded", clamped ? "0" : "1");
    });
  }

  // --- Carousel --------------------------------------------------------------
  function buildCarousel(mount, reviews) {
    var viewport = document.createElement("div");
    viewport.className = "glr-viewport";

    var track = document.createElement("div");
    track.className = "glr-track";
    track.setAttribute("tabindex", "0");
    track.setAttribute("role", "group");
    track.setAttribute("aria-roledescription", "carousel");
    track.setAttribute("aria-label", "Reviews");

    reviews.forEach(function (r) {
      track.appendChild(buildCard(r));
    });
    viewport.appendChild(track);

    var controls = document.createElement("div");
    controls.className = "glr-controls";
    var prev = arrowBtn("Previous reviews", "left");
    var dots = document.createElement("div");
    dots.className = "glr-dots";
    var next = arrowBtn("Next reviews", "right");
    controls.appendChild(prev);
    controls.appendChild(dots);
    controls.appendChild(next);

    mount.appendChild(viewport);
    mount.appendChild(controls);

    wireCarousel({ track: track, prev: prev, next: next, dots: dots, count: reviews.length });
  }

  function arrowBtn(label, dir) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "glr-arrow";
    b.setAttribute("aria-label", label);
    var d =
      dir === "left"
        ? "M15 5l-7 7 7 7"
        : "M9 5l7 7-7 7";
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
    return b;
  }

  function wireCarousel(ui) {
    var track = ui.track;

    function perView() {
      var first = track.querySelector(".glr-slide");
      if (!first) return 1;
      var slideW = first.getBoundingClientRect().width + 24; // + gap
      return Math.max(1, Math.round(track.clientWidth / slideW));
    }
    // Reachable scroll positions, one per "page", each clamped so the final
    // page lands flush with the end of the track (no unreachable extra page).
    function targets() {
      var slides = track.querySelectorAll(".glr-slide");
      if (!slides.length) return [0];
      var per = perView();
      var base = slides[0].offsetLeft;
      var maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      var list = [];
      for (var i = 0; i < slides.length; i += per) {
        var t = Math.min(slides[i].offsetLeft - base, maxScroll);
        if (!list.length || t - list[list.length - 1] > 2) list.push(t);
      }
      if (maxScroll - list[list.length - 1] > 2) list.push(maxScroll);
      return list;
    }
    function currentPage() {
      var list = targets();
      var sl = track.scrollLeft, best = 0, bestD = Infinity;
      for (var i = 0; i < list.length; i++) {
        var d = Math.abs(list[i] - sl);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    // Dots
    function renderDots() {
      var list = targets();
      var pages = list.length;
      ui.dots.innerHTML = "";
      ui.dots.style.display = pages <= 1 ? "none" : "flex";
      for (var i = 0; i < pages; i++) {
        (function (i) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "glr-dot";
          dot.setAttribute("aria-label", "Go to slide group " + (i + 1));
          dot.addEventListener("click", function () {
            stopAuto();
            track.scrollTo({ left: targets()[i] || 0, behavior: "smooth" });
          });
          ui.dots.appendChild(dot);
        })(i);
      }
      syncState();
    }

    function syncState() {
      var page = currentPage();
      var pages = targets().length;
      var dotEls = ui.dots.children;
      for (var i = 0; i < dotEls.length; i++) {
        dotEls[i].classList.toggle("is-active", i === page);
      }
      ui.prev.disabled = page <= 0;
      ui.next.disabled = page >= pages - 1;
    }

    function go(delta) {
      stopAuto();
      var list = targets();
      var idx = Math.max(0, Math.min(list.length - 1, currentPage() + delta));
      track.scrollTo({ left: list[idx], behavior: "smooth" });
    }

    ui.prev.addEventListener("click", function () { go(-1); });
    ui.next.addEventListener("click", function () { go(1); });

    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });

    var raf;
    track.addEventListener("scroll", function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncState);
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { renderDots(); applyClamps(); }, 150);
    });

    // --- Autoplay (gentle, accessibility-aware) ------------------------------
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var timer = null;
    function tick() {
      var list = targets();
      var page = currentPage();
      var nextLeft = page >= list.length - 1 ? 0 : list[page + 1];
      track.scrollTo({ left: nextLeft, behavior: "smooth" });
    }
    function startAuto() {
      if (reduce || timer || ui.count <= perView()) return;
      timer = setInterval(tick, 5500);
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    // pause on interaction; resume when idle/visible
    ["mouseenter", "focusin", "touchstart", "pointerdown"].forEach(function (ev) {
      track.parentNode.parentNode.addEventListener(ev, stopAuto, { passive: true });
    });
    track.parentNode.parentNode.addEventListener("mouseleave", startAuto);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopAuto(); else startAuto();
    });

    renderDots();
    // Start once laid out.
    setTimeout(startAuto, 1200);
  }

  // --- Data ------------------------------------------------------------------
  // Fetch published reviews for one or more category slugs. Ordered by
  // sort_order DESC, then review_date DESC (nulls last) — the stable ordering
  // contract agreed with the CRM. Dates are used only for ordering, never shown.
  function buildQuery(categories, limit) {
    var select = "id,reviewer_name,rating,body,review_date,sort_order";
    var params = [
      "is_published=eq.true",
      "order=sort_order.desc,review_date.desc.nullslast",
    ];
    if (categories && categories.length) {
      select += ",review_category_links!inner(review_categories!inner(slug))";
      // Filter by category SLUG (the stable contract). One or many via in.(...).
      params.push(
        "review_category_links.review_categories.slug=in.(" +
          categories.map(encodeURIComponent).join(",") +
          ")"
      );
    }
    if (limit) params.push("limit=" + parseInt(limit, 10));
    params.unshift("select=" + encodeURIComponent(select));
    return REST + "?" + params.join("&");
  }

  // Reusable helper: published reviews for a category slug (or array of slugs).
  // Exposed on window for ad-hoc use; the carousel mounts use it internally.
  function getReviewsBySlug(slug, limit) {
    var categories = Array.isArray(slug) ? slug : slug ? [slug] : [];
    return fetch(buildQuery(categories, limit), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
    })
      .then(function (res) {
        if (!res.ok) throw new Error("reviews HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) return rows;
        // A review linked to several of the requested categories comes back once
        // per link — de-duplicate by id, preserving order.
        var seen = {};
        return rows.filter(function (r) {
          if (r && r.id != null) {
            if (seen[r.id]) return false;
            seen[r.id] = 1;
          }
          return true;
        });
      });
  }

  // --- Per-page wiring -------------------------------------------------------
  // Each public page shows its own reviews, filtered by category slug. Rather
  // than editing every (Framer-exported) HTML body, we wire pages here by path:
  //
  //   create:true  -> this page has no mount in its HTML, so inject one just
  //                   above the footer, with a heading/intro.
  //   (no create)  -> the page already has a <div data-gl-reviews> mount (the
  //                   homepage), we just supply its categories here.
  //   fallback:true-> if the DB is unreachable, show bundled FALLBACK_REVIEWS
  //                   instead of hiding (homepage only).
  var PATH_CONFIG = {
    // Homepage: the existing "Hear from those whose lives we've impacted"
    // section becomes a lived-experience showcase — everything EXCEPT training.
    "/": {
      categories: ["cjs", "impacted-others", "research-leaf"],
      fallback: true,
    },
    "/professional-training": {
      categories: ["professional-training"],
      create: true,
      heading: "What training participants say",
      intro:
        "Feedback from the professionals who have completed our gambling-related harm training.",
    },
    "/criminal-justice-support": {
      categories: ["cjs"],
      create: true,
      heading: "Voices from our criminal justice support",
      intro:
        "From the people we have stood beside throughout the criminal justice process.",
    },
    "/impacted-others": {
      categories: ["impacted-others"],
      create: true,
      heading: "From the families and friends we support",
      intro: "Words from affected others who found support through GamLEARN.",
    },
    "/research": {
      categories: ["research-leaf"],
      create: true,
      heading: "What our research community says",
      intro:
        "Reflections from those involved in our research and LEAF programmes.",
    },
  };

  // Normalise the current path to match PATH_CONFIG keys: lowercase, drop any
  // ".html" and trailing slash (the live site uses clean URLs).
  function currentPath() {
    var p = (location.pathname || "/").toLowerCase().replace(/\.html$/, "");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    p = p.replace(/\/index$/, ""); // /index -> homepage
    return p || "/";
  }

  function pageConfig() {
    return PATH_CONFIG[currentPath()] || null;
  }

  // Resolve the categories + fallback behaviour for a given mount: an explicit
  // data-category attribute always wins; otherwise fall back to the page config.
  function mountConfig(mount) {
    var attr = mount.getAttribute("data-category");
    if (attr) {
      return {
        categories: attr.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        fallback: false,
      };
    }
    var cfg = pageConfig();
    if (cfg) return { categories: cfg.categories || [], fallback: !!cfg.fallback };
    return { categories: [], fallback: true }; // truly unfiltered mount
  }

  // Cache fetched rows per category-key at module scope, so an injected mount
  // that Framer hydration removes and we re-create doesn't refetch every time.
  var DATA_CACHE = {};
  function cacheKey(categories) {
    return categories && categories.length ? categories.slice().sort().join(",") : "*";
  }

  // On pages configured with create:true, inject a single mount above the footer
  // if one isn't already present. Idempotent and safe to call repeatedly (the
  // observer re-runs it if hydration removes our node).
  function ensurePageMount() {
    var cfg = pageConfig();
    if (!cfg || !cfg.create) return;
    if (document.querySelector("[data-gl-reviews]")) return;

    var mount = document.createElement("div");
    mount.setAttribute("data-gl-reviews", "");
    mount.setAttribute("data-category", (cfg.categories || []).join(","));
    if (cfg.heading) mount.setAttribute("data-heading", cfg.heading);
    if (cfg.intro) mount.setAttribute("data-intro", cfg.intro);

    var section = document.createElement("section");
    section.className = "glr-page-section";
    section.setAttribute("data-glr-injected", "1");
    section.appendChild(mount);

    // Sit the section above the "CTA Section" banner (the green
    // "Together, We Can Make a Difference" block) where present, else above
    // the footer.
    var anchor =
      document.querySelector('[data-glearn-name="CTA Section"]') ||
      document.querySelector('[data-glearn-name="Footer Section"]') ||
      document.querySelector("footer");
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(section, anchor);
    } else {
      (document.querySelector("[data-glearn-root]") || document.body).appendChild(section);
    }
  }

  // --- Mount lifecycle -------------------------------------------------------
  function renderInto(mount, reviews) {
    var stage = mount.querySelector(".glr-stage");
    stage.innerHTML = "";
    buildCarousel(stage, reviews);
    applyClamps();
    // Re-measure once web fonts settle (line counts can change).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applyClamps);
    }
    setTimeout(applyClamps, 400);
  }

  function scaffold(mount) {
    mount.classList.add("glr-section");
    var heading = mount.getAttribute("data-heading");
    var intro = mount.getAttribute("data-intro");
    var pill = mount.getAttribute("data-pill") || DEFAULT_PILL;
    var headHtml = "";
    // Only render our own heading block if the author asked for one; on the
    // homepage the existing "Voices of Support" heading already sits above us.
    // When we do render it, it mirrors the homepage structure exactly:
    // pill badge → heading → intro.
    if (heading || intro) {
      headHtml =
        '<div class="glr-head">' +
        '<span class="glr-pill">' +
          '<span class="glr-pill-ic"><img src="' + PILL_ICON + '" alt="" aria-hidden="true" loading="lazy"></span>' +
          '<span class="glr-pill-tx">' + esc(pill) + "</span>" +
        "</span>" +
        (heading ? '<h2 class="glr-heading">' + esc(heading) + "</h2>" : "") +
        (intro ? '<p class="glr-intro">' + esc(intro) + "</p>" : "") +
        "</div>";
    }
    mount.innerHTML =
      headHtml +
      '<div class="glr-stage">' +
        '<div class="glr-loading" aria-hidden="true">' +
          '<div class="glr-skel"></div><div class="glr-skel"></div><div class="glr-skel"></div>' +
        "</div>" +
      "</div>";
  }

  // This is a hydrated Framer page: its JavaScript re-creates the section's DOM
  // after load, which wipes anything we rendered too early. So we (a) cache the
  // fetched reviews on the mount and (b) re-paint whenever the mount turns up
  // empty again — driven by a MutationObserver — without re-fetching.
  // States stored on the element: __glrData (array), __glrState
  // ("ready" | "hidden"), __glrLoading (bool).

  function loadMount(mount) {
    var conf = mountConfig(mount);
    var limit = mount.getAttribute("data-limit") || "";
    var key = cacheKey(conf.categories);

    // Reuse cached rows if a previous mount for the same categories already
    // fetched them (e.g. an injected mount re-created after a hydration wipe).
    if (DATA_CACHE[key]) {
      mount.__glrData = DATA_CACHE[key];
      mount.__glrState = "ready";
      mount.__glrLoading = false;
      ensureMount(mount);
      return;
    }

    mount.__glrLoading = true;
    getReviewsBySlug(conf.categories, limit)
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length) {
          DATA_CACHE[key] = rows;
          mount.__glrData = rows;
          mount.__glrState = "ready";
        } else if (conf.fallback) {
          mount.__glrData = FALLBACK_REVIEWS; // homepage: show bundled fallback
          mount.__glrState = "ready";
        } else {
          mount.__glrState = "hidden"; // category with no published reviews yet
        }
      })
      .catch(function (err) {
        console.error("[reviews] load failed:", err);
        if (conf.fallback) {
          mount.__glrData = FALLBACK_REVIEWS;
          mount.__glrState = "ready";
        } else {
          mount.__glrState = "hidden";
        }
      })
      .then(function () {
        mount.__glrLoading = false;
        ensureMount(mount);
      });
  }

  // Make sure a mount currently shows its content; re-render from cache if a
  // hydration pass has emptied it. Safe to call repeatedly.
  function ensureMount(mount) {
    if (!document.contains(mount)) return;

    if (mount.__glrState === "hidden") {
      mount.style.display = "none";
      return;
    }
    // Already painted with real cards and not wiped — nothing to do.
    if (mount.querySelector(".glr-card")) return;

    if (mount.__glrState === "ready" && mount.__glrData) {
      scaffold(mount);
      renderInto(mount, mount.__glrData);
      return;
    }
    // Not loaded yet.
    if (!mount.__glrLoading) {
      scaffold(mount);
      loadMount(mount);
    } else if (!mount.querySelector(".glr-stage")) {
      scaffold(mount); // show skeleton while the in-flight fetch resolves
    }
  }

  function processMounts() {
    ensurePageMount(); // inject the mount on create:true pages if missing
    var mounts = document.querySelectorAll("[data-gl-reviews]");
    Array.prototype.forEach.call(mounts, ensureMount);
  }

  // Expose the reusable fetch helper for any ad-hoc use elsewhere on the site.
  window.glReviews = window.glReviews || { getReviewsBySlug: getReviewsBySlug };

  function start() {
    injectStyles();
    installReadMore();
    processMounts();

    // Re-assert after Framer hydration (which can recreate/empty the mount).
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

    // Belt-and-braces: a few timed re-checks in case the observer misses an
    // early hydration swap, then we rely on the observer.
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
