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

  // Default copy (overridable per mount via data-heading / data-intro).
  var DEFAULT_HEADING = "Hear from those whose lives we’ve impacted";
  var DEFAULT_INTRO =
    "Every story shared reminds us why we do what we do. From individuals to " +
    "partners, our community’s trust and feedback drive us to keep creating change.";

  // Offline / network-failure fallback so the section always looks complete.
  // Mirrors the published reviews currently in the CRM (no dates).
  var FALLBACK_REVIEWS = [
    { reviewer_name: "Amy", rating: 5, body: "I am grateful to be given the opportunity to go on this course, because not only did I learn about gambling/gambling addiction, but also the seriousness of it – the vicious circle people can get into, the consequence on family and friends, and the risks of losing everything (including life)." },
    { reviewer_name: "Rhian", rating: 5, body: "I will take forward the learning and use it to work with strategic partners to ensure gambling is addressed more in CJS." },
    { reviewer_name: "Lorna", rating: 5, body: "The explanations of how the brain is changed to create addiction was fascinating and gives real insight into how gambling can affect anyone. The lived experience stories are impactful and to understand the impact we can have at PSR stage is invaluable." },
    { reviewer_name: "Danielle", rating: 5, body: "This was the best training I have had. The facilitators were fantastic and interactive. Their lived experience was invaluable and really made the training stand out. The videos and statistics were really interesting." },
    { reviewer_name: "NG", rating: 5, body: "The lived experience is very interesting, I think it’s important to hear from people who have experienced the issue themselves. Videos were great to watch – person touch to the topic and not just purely stats and data." },
    { reviewer_name: "Danielle", rating: 5, body: "There are limited services within our local area for gambling support and thanks to the training we have more services available that are available to help people." },
    { reviewer_name: "Marcus", rating: 5, body: "The course has everything in terms of pitching the learning. I recommend that this needs to be right in the middle of the table for involvement at all levels of our HMPPS structure.\n\nA policy change to align gambling harms with other established addictions is the next step." },
    { reviewer_name: "Molly Delahay", rating: 5, body: "I am far more aware of how to approach people who suffer with gambling addiction and know the support networks available." },
    { reviewer_name: "Sadie", rating: 5, body: "I really enjoyed having the visual of the presentation but also having the booklet with the slides in and a space to make notes. I also really enjoyed the shared lived experiences both in video format and also experiences shared from the facilitators." },
    { reviewer_name: "Sarah", rating: 5, body: "I liked that it was interactive and questions were allowed throughout. The PowerPoint was very informative and had varied context.\n\nI feel confident in my understanding but also the process as well as the guidance to better help support an individual." }
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
        "width:100%;box-sizing:border-box;}" +
      ".glr-section *,.glr-section *::before,.glr-section *::after{box-sizing:border-box;}" +

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

    // Render clamped with the button hidden; applyClamps() measures real
    // overflow after layout and only reveals "Read more" when text is actually
    // cut off — so the button never appears on a review that already fits.
    card.innerHTML =
      '<span class="glr-quote" aria-hidden="true">“</span>' +
      starsSvg(review.rating) +
      '<p class="glr-body is-clamped">' + esc(review.body) + "</p>" +
      '<button type="button" class="glr-more" style="display:none">Read more</button>' +
      '<div class="glr-author">' +
        '<span class="glr-avatar" aria-hidden="true">' + esc(initials(review.reviewer_name)) + "</span>" +
        '<span class="glr-name">' + esc(review.reviewer_name) + "</span>" +
      "</div>";

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
  function buildQuery(category, limit) {
    var select = "reviewer_name,rating,body,sort_order";
    var params = ["is_published=eq.true", "order=sort_order.asc"];
    if (category) {
      select += ",review_category_links!inner(review_categories!inner(slug))";
      params.push(
        "review_category_links.review_categories.slug=eq." + encodeURIComponent(category)
      );
    }
    if (limit) params.push("limit=" + parseInt(limit, 10));
    params.unshift("select=" + encodeURIComponent(select));
    return REST + "?" + params.join("&");
  }

  function fetchReviews(category, limit) {
    return fetch(buildQuery(category, limit), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
    }).then(function (res) {
      if (!res.ok) throw new Error("reviews HTTP " + res.status);
      return res.json();
    });
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
    var headHtml = "";
    // Only render our own heading block if the author asked for one; on the
    // homepage the existing "Voices of Support" heading already sits above us.
    if (heading || intro) {
      headHtml =
        '<div class="glr-head">' +
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
    var category = mount.getAttribute("data-category") || "";
    var limit = mount.getAttribute("data-limit") || "";
    mount.__glrLoading = true;
    fetchReviews(category, limit)
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length) {
          mount.__glrData = rows;
          mount.__glrState = "ready";
        } else if (!category) {
          mount.__glrData = FALLBACK_REVIEWS; // unfiltered: show bundled fallback
          mount.__glrState = "ready";
        } else {
          mount.__glrState = "hidden"; // category with no published reviews yet
        }
      })
      .catch(function (err) {
        console.error("[reviews] load failed:", err);
        if (!category) {
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
    var mounts = document.querySelectorAll("[data-gl-reviews]");
    Array.prototype.forEach.call(mounts, ensureMount);
  }

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
