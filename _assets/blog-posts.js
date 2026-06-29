/*
 * GAMLEARN CRM-driven blog.
 *
 * Renders the blog list (/blog) and the homepage blog section straight from the
 * CRM's Supabase `blog_posts` table, in the EXACT existing Framer card design.
 *
 * It does not invent a card design: it clones a real rendered Framer "Blog Card
 * Wrapper" and swaps in each post's image / categories / date / title / excerpt
 * / link. So the cards always match whatever the site's design currently is.
 *
 * Because these are hydrated Framer pages whose JS re-creates the section DOM
 * after load (wiping anything rendered too early), we cache the fetched posts
 * and re-paint via a MutationObserver whenever Framer regenerates the grid —
 * the same resilience pattern used by reviews.js.
 *
 * DATA / SECURITY: reads go to Supabase PostgREST with the project's publishable
 * (anon) key — public by design. Row-level security only exposes rows where
 * is_published = true. No secret keys here.
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://boelrbcmcotntfbukzfc.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_NpTvep2Jycfilu33SfHR2g_DCixDOod";
  var REST = SUPABASE_URL + "/rest/v1/blog_posts";

  // Which view are we on? Act on the blog index, the homepage, and individual
  // post pages (/blog/<slug>); inert everywhere else (loaded site-wide).
  var path = location.pathname.replace(/index\.html?$/, "").replace(/\/+$/, "") || "/";
  var IS_LIST = path === "/blog";
  var IS_HOME = path === "/";
  var postMatch = path.match(/^\/blog\/([^/?#]+)$/);
  var IS_POST = !!postMatch;
  var POST_SLUG = postMatch ? decodeURIComponent(postMatch[1]) : "";
  if (!IS_LIST && !IS_HOME && !IS_POST) return;

  var HOME_LIMIT = 6; // homepage shows the latest N, then a "View all" button
  var PAGE = 6;       // /blog shows 6 at a time, then a "Load more" button
  var _shown = PAGE;  // how many posts are currently revealed on /blog

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  // --- Data ------------------------------------------------------------------
  var _posts = null;       // cached rows
  var _loading = false;

  function fetchPosts() {
    var select = "slug,title,excerpt,image_url,image_alt,categories,published_at";
    var url = REST + "?select=" + encodeURIComponent(select) +
              "&is_published=eq.true&order=published_at.desc";
    return fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
    }).then(function (r) {
      if (!r.ok) throw new Error("blog_posts HTTP " + r.status);
      return r.json();
    });
  }

  // --- DOM helpers -----------------------------------------------------------
  function setText(el, text) {
    if (!el) return;
    // Framer text lives in the deepest element; replacing textContent keeps the
    // element's own styling (font/colour come from its class + CSS vars).
    el.textContent = text == null ? "" : String(text);
  }

  // A "card link" is an anchor pointing at a specific post (/blog/<slug>), and
  // NOT a nav/footer link.
  function isCardLink(a) {
    var h = a.getAttribute("href") || "";
    if (!/\/blog\/[^/?#]+/.test(h)) return false;
    if (a.closest('nav,[data-glearn-name="Footer"],[data-glearn-name="Footer Section"]')) return false;
    return true;
  }

  function cardSlug(a) {
    var m = (a.getAttribute("href") || "").match(/\/blog\/([^/?#]+)/);
    return m ? m[1] : "";
  }

  // Distinct post slugs referenced by card links inside `el`.
  function slugsIn(el) {
    var s = {};
    Array.prototype.forEach.call(el.querySelectorAll("a[href]"), function (a) {
      if (isCardLink(a)) s[cardSlug(a)] = 1;
    });
    return Object.keys(s);
  }

  // The repeating per-card unit = the largest ancestor of a card link whose card
  // links all still point at a single post. Class-agnostic, so it survives Framer
  // markup changes and correctly stays inside each responsive sub-grid.
  function cardUnitFor(anchor) {
    var el = anchor;
    while (el.parentElement) {
      var p = el.parentElement;
      if (p.hasAttribute && p.hasAttribute("data-gl-grid")) break;
      var slugs = slugsIn(p);
      if (slugs.length !== 1) break; // parent would swallow a sibling card
      el = p;
    }
    return el;
  }

  // Find every original (non-clone) per-card unit, grouped by their parent
  // sub-grid. Returns [{parent, units:[...]}].
  function findCardGroups() {
    var anchors = Array.prototype.slice
      .call(document.querySelectorAll("a[href]"))
      .filter(isCardLink)
      .filter(function (a) { return !a.closest("[data-gl-card]"); });
    var units = [];
    var seen = [];
    anchors.forEach(function (a) {
      var u = cardUnitFor(a);
      if (seen.indexOf(u) === -1) { seen.push(u); units.push(u); }
    });
    // group by parent
    var groups = [];
    units.forEach(function (u) {
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].parent === u.parentElement) { g = groups[i]; break; }
      if (!g) { g = { parent: u.parentElement, units: [] }; groups.push(g); }
      g.units.push(u);
    });
    return groups;
  }

  function fillCard(node, post) {
    node.setAttribute("data-gl-card", "1");
    node.style.display = "";

    // Image (every responsive variant inside the wrapper).
    Array.prototype.forEach.call(node.querySelectorAll("img"), function (img) {
      if (post.image_url) {
        img.setAttribute("src", post.image_url);
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      }
      img.setAttribute("alt", post.image_alt || post.title || "");
    });

    // Card links -> the post page. Include `node` itself: on some layouts (the
    // homepage grid) the per-card unit *is* the <a>, and querySelectorAll never
    // returns the node it's called on — so without this the card's own href keeps
    // the template's slug and every card points at the first post.
    var links = Array.prototype.slice.call(node.querySelectorAll("a[href]"));
    if (node.tagName === "A" && node.hasAttribute("href")) links.push(node);
    links.forEach(function (a) {
      var h = a.getAttribute("href") || "";
      if (/\/blog\//.test(h)) a.setAttribute("href", "/blog/" + post.slug);
    });

    // Title (Framer renders it as a heading).
    Array.prototype.forEach.call(
      node.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      function (h) { setText(h, post.title); }
    );

    // Excerpt.
    Array.prototype.forEach.call(
      node.querySelectorAll("p.glearn-styles-preset-1rhqrrz"),
      function (p) { setText(p, post.excerpt || ""); }
    );

    // Date.
    Array.prototype.forEach.call(
      node.querySelectorAll('[data-glearn-name="Date"]'),
      function (d) {
        var p = d.querySelector("p") || d;
        setText(p, fmtDate(post.published_at));
      }
    );

    // Category chips: each chip is a [data-glearn-name="Category"] holding a <p>.
    // Populate from post.categories; hide any spare chips, clone if we need more.
    var cats = Array.isArray(post.categories) ? post.categories.filter(Boolean) : [];
    Array.prototype.forEach.call(
      node.querySelectorAll('[data-glearn-name="Date & Category"],[data-glearn-name="Date &amp; Category"]'),
      function (row) { applyCategories(row, cats); }
    );
    // Some layouts group chips under a wrapper that is itself a [Category].
    if (!node.querySelector('[data-glearn-name="Date & Category"],[data-glearn-name="Date &amp; Category"]')) {
      applyCategoriesFlat(node, cats);
    }

    return node;
  }

  function chipList(scope) {
    // Leaf category chips = [data-glearn-name="Category"] that contain a <p> but
    // no nested [data-glearn-name="Category"].
    return Array.prototype.slice
      .call(scope.querySelectorAll('[data-glearn-name="Category"]'))
      .filter(function (c) {
        return c.querySelector("p") && !c.querySelector('[data-glearn-name="Category"]');
      });
  }

  function applyCategories(row, cats) { applyCategoriesFlat(row, cats); }

  function applyCategoriesFlat(scope, cats) {
    var chips = chipList(scope);
    if (!chips.length) return;
    var tmpl = chips[0];
    // Ensure we have enough chip elements.
    while (chips.length < cats.length) {
      var clone = tmpl.cloneNode(true);
      tmpl.parentNode.appendChild(clone);
      chips.push(clone);
    }
    chips.forEach(function (chip, i) {
      if (i < cats.length) {
        chip.style.display = "";
        setText(chip.querySelector("p"), cats[i]);
      } else {
        chip.style.display = "none";
      }
    });
  }

  // --- Single post (/blog/<slug>) -------------------------------------------
  // The post pages are Framer-hydrated CMS detail pages: Framer re-renders the
  // article from the *frozen* local CMS bundle after load. To make them truly
  // DB-driven we fetch the live row by slug and re-assert title / hero image /
  // body straight from Supabase, re-applying on every hydration pass (same
  // resilience pattern as the card grid and reviews.js).
  var _post;            // cached row for this slug (null = looked-up, missing)
  var _postLoading = false;

  function fetchPost(slug) {
    var select = "slug,title,excerpt,content_html,image_url,image_alt,categories,published_at";
    var url = REST + "?select=" + encodeURIComponent(select) +
              "&is_published=eq.true&slug=eq." + encodeURIComponent(slug) +
              "&limit=1";
    return fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
    }).then(function (r) {
      if (!r.ok) throw new Error("blog_posts HTTP " + r.status);
      return r.json();
    }).then(function (rows) { return (rows && rows[0]) || null; });
  }

  // The DB stores body as plain rich-text HTML (<p>/<h2>/<h3>/<ul>/<a>…) with no
  // Framer classes. Tag each element with the site's global style presets so the
  // injected article matches the original typography exactly.
  var PRESET = {
    P: "glearn-text glearn-styles-preset-1rhqrrz",
    H1: "glearn-text glearn-styles-preset-uu074d",
    H2: "glearn-text glearn-styles-preset-47g0p4",
    H3: "glearn-text glearn-styles-preset-cy3ug9",
    H4: "glearn-text glearn-styles-preset-cy3ug9",
    UL: "glearn-text",
    OL: "glearn-text",
    LI: "glearn-text",
    A: "glearn-text glearn-styles-preset-vznyu1",
  };
  function styleRichText(html) {
    var doc = document.implementation.createHTMLDocument("");
    doc.body.innerHTML = html || "";
    Object.keys(PRESET).forEach(function (tag) {
      Array.prototype.forEach.call(doc.body.getElementsByTagName(tag), function (el) {
        // Don't fight an explicit class already present on a nested preset node.
        if (!el.className) el.className = PRESET[tag];
      });
    });
    return doc.body.innerHTML;
  }

  // The article body is, by a wide margin, the largest rich-text block on the
  // page (everything else — card excerpts, footer — is tiny). Returns every
  // RichTextContainer whose text is "large", to cover all responsive variants.
  function bodyContainers() {
    var all = Array.prototype.slice.call(
      document.querySelectorAll('[data-glearn-component-type="RichTextContainer"]')
    );
    if (!all.length) return [];
    var max = 0;
    all.forEach(function (el) {
      var n = (el.textContent || "").trim().length;
      if (n > max) max = n;
    });
    if (max < 400) return []; // body not rendered yet
    return all.filter(function (el) {
      if (el.getAttribute("data-gl-post") === POST_SLUG) return true; // already ours
      return (el.textContent || "").trim().length >= Math.max(400, max * 0.5);
    });
  }

  function setMeta(selector, attr, value) {
    var el = document.head && document.head.querySelector(selector);
    if (el && value != null) el.setAttribute(attr, value);
  }

  function paintPost() {
    if (!_post) return;
    var styled = null; // lazily build once

    // Title — the page has a single <h1>; keep its element/styling, swap text.
    var h1 = document.querySelector("#main h1, h1");
    if (h1 && h1.textContent.trim() !== _post.title) {
      var span = h1.querySelector("span") || h1;
      span.textContent = _post.title;
    }

    // Hero image — every responsive <img> inside the Blog Image wrapper.
    if (_post.image_url) {
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-glearn-name="Blog Image"] img'),
        function (img) {
          if (img.getAttribute("src") !== _post.image_url) {
            img.setAttribute("src", _post.image_url);
            img.removeAttribute("srcset");
            img.removeAttribute("sizes");
          }
          img.setAttribute("alt", _post.image_alt || _post.title || "");
        }
      );
    }

    // Body — replace the dominant rich-text block(s) with the DB content.
    var bodies = bodyContainers();
    bodies.forEach(function (el) {
      if (el.getAttribute("data-gl-post") === POST_SLUG) return; // unchanged
      if (styled == null) styled = styleRichText(_post.content_html);
      el.innerHTML = styled;
      el.setAttribute("data-gl-post", POST_SLUG);
    });

    // Head metadata (title is owned here now — see page-titles.js).
    var title = _post.title + " | GamLEARN";
    if (document.title !== title) document.title = title;
    if (_post.excerpt) setMeta('meta[name="description"]', "content", _post.excerpt);
    setMeta('meta[property="og:title"]', "content", title);
    if (_post.excerpt) setMeta('meta[property="og:description"]', "content", _post.excerpt);
    if (_post.image_url) setMeta('meta[property="og:image"]', "content", _post.image_url);
  }

  function loadPost() {
    if (_postLoading || _post !== undefined) { paintPost(); return; }
    _postLoading = true;
    fetchPost(POST_SLUG)
      .then(function (row) { _post = row; })
      .catch(function (err) { console.error("[blog] post load failed:", err); _post = _post || null; })
      .then(function () { _postLoading = false; paintPost(); });
  }

  // --- Buttons ---------------------------------------------------------------
  // Match the site's buttons exactly by cloning a real Framer CTA ("Become a
  // Member" / "View The Leaflet" / a card's "Read this article") — same font,
  // padding, radius and colour. Framer's hover is JS-driven and won't survive a
  // clone, so we re-create it in CSS (a subtle darken + lift) to keep parity.
  function injectBtnStyles() {
    if (document.getElementById("gl-btn-styles")) return;
    var s = document.createElement("style");
    s.id = "gl-btn-styles";
    s.textContent =
      "[data-gl-btn]{display:flex;justify-content:center;width:100%;margin-top:40px;}" +
      "[data-gl-btn]>a{cursor:pointer;transition:filter .25s ease,transform .25s ease,box-shadow .25s ease;}" +
      "[data-gl-btn]>a:hover{filter:brightness(.92);transform:translateY(-1px);" +
        "box-shadow:0 10px 24px -12px rgba(0,0,0,.45);}" +
      "[data-gl-btn]>a:active{transform:translateY(0);filter:brightness(.88);}";
    (document.head || document.documentElement).appendChild(s);
  }

  // Find the best on-brand CTA anchor to clone. Prefer a standalone, auto-width
  // primary button; fall back to a card's button.
  function ctaReference(sampleCard) {
    var candidates = document.querySelectorAll('a[data-glearn-name="About Hero Button"]');
    var best = null;
    Array.prototype.forEach.call(candidates, function (a) {
      if (a.closest("[data-gl-btn]")) return;            // not one of ours
      var t = (a.textContent || "").trim();
      if (/become a member/i.test(t)) best = best || a;  // the canonical green pill
      else if (!best && t) best = a;
    });
    if (best) return best;
    return sampleCard ? sampleCard.querySelector("a[href]") : null;
  }

  function buildButton(sampleCard, label) {
    injectBtnStyles();
    var ref = ctaReference(sampleCard);
    var wrap = document.createElement("div");
    wrap.setAttribute("data-gl-btn", "1");

    var a;
    if (ref) {
      a = ref.cloneNode(true);
      a.removeAttribute("data-glearn-name");
      a.style.width = "auto";       // standalone, not full-bleed
      a.style.maxWidth = "100%";
      // Replace the visible label text wherever it lives.
      var labelEl = null;
      Array.prototype.forEach.call(a.querySelectorAll("p,span,div"), function (n) {
        // deepest element that directly holds non-empty text
        if (n.children.length === 0 && n.textContent && n.textContent.trim()) labelEl = n;
      });
      if (labelEl) labelEl.textContent = label;
      else a.textContent = label;
    } else {
      a = document.createElement("a");
      a.textContent = label;
      a.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;" +
        "padding:14px 32px;border-radius:100px;font-weight:600;font-size:16px;" +
        "font-family:'Urbanist',sans-serif;text-decoration:none;color:#fff;" +
        "background:var(--token-1c79ec7e-49ca-45a4-8f59-5d04cfb04595, #00664d);";
    }
    wrap.appendChild(a);
    return wrap;
  }

  function buildViewAll(sampleCard) {
    var existing = document.querySelector("[data-gl-viewall]");
    if (existing) return existing;
    var wrap = buildButton(sampleCard, "View all posts");
    wrap.setAttribute("data-gl-viewall", "1");
    var a = wrap.querySelector("a");
    a.setAttribute("href", "/blog");
    a.removeAttribute("tabindex");
    return wrap;
  }

  // --- Paint -----------------------------------------------------------------
  function paint() {
    if (!_posts) return;
    var groups = findCardGroups();
    if (!groups.length) return; // Framer hasn't rendered the grid yet

    var rows = IS_HOME ? _posts.slice(0, HOME_LIMIT) : _posts.slice(0, _shown);
    var lastGrid = null;

    groups.forEach(function (g) {
      var parent = g.parent;
      if (!parent) return;
      parent.setAttribute("data-gl-grid", "1");
      lastGrid = parent;

      var existing = parent.querySelectorAll(':scope > [data-gl-card]');
      // Already painted correctly for this sub-grid? keep originals hidden, skip.
      if (existing.length === rows.length) {
        g.units.forEach(function (u) { if (!u.hasAttribute("data-gl-card")) u.style.display = "none"; });
        return;
      }

      var template = g.units[0].cloneNode(true);
      Array.prototype.forEach.call(existing, function (c) { c.remove(); });
      g.units.forEach(function (u) { u.style.display = "none"; });

      var frag = document.createDocumentFragment();
      rows.forEach(function (post) {
        frag.appendChild(fillCard(template.cloneNode(true), post));
      });
      parent.appendChild(frag);
    });

    if (!lastGrid) return;
    var sampleCard = lastGrid.querySelector("[data-gl-card]");

    if (IS_HOME) {
      // "View all posts" -> /blog, placed once below the cards.
      var host = lastGrid.closest('[data-glearn-name="Blog Content"]') || lastGrid.parentNode || lastGrid;
      if (host && !host.querySelector("[data-gl-viewall]")) {
        host.appendChild(buildViewAll(sampleCard));
      }
    } else {
      // /blog: "Load more" reveals the next PAGE of posts and re-anchors below.
      ensureLoadMore(lastGrid, sampleCard);
    }
  }

  // Place / update the "Load more" button just after the whole grid. Reveals the
  // next PAGE of posts on click and moves itself below the new cards; removed
  // once everything is shown.
  function ensureLoadMore(subGrid, sampleCard) {
    // The real CSS grid is the sub-grid's parent (sub-grids are display:contents).
    var gridBox = (subGrid && subGrid.parentElement) || subGrid;
    if (!gridBox || !gridBox.parentElement) return;

    var done = _shown >= _posts.length;
    var btn = gridBox.parentElement.querySelector(":scope > [data-gl-loadmore]");

    if (done) { if (btn) btn.remove(); return; }

    if (!btn) {
      btn = buildButton(sampleCard, "Load more");
      btn.setAttribute("data-gl-loadmore", "1");
      var a = btn.querySelector("a,button");
      a.removeAttribute("href");      // it's an action, not a link
      a.removeAttribute("tabindex");
      a.setAttribute("role", "button");
      a.addEventListener("click", function (e) {
        e.preventDefault();
        _shown = Math.min(_posts.length, _shown + PAGE);
        paint();
      });
    }
    // Keep it immediately after the grid box.
    if (btn.previousElementSibling !== gridBox || btn.parentElement !== gridBox.parentElement) {
      gridBox.parentElement.insertBefore(btn, gridBox.nextSibling);
    }
  }

  // --- Lifecycle -------------------------------------------------------------
  function load() {
    if (_loading || _posts) { paint(); return; }
    _loading = true;
    fetchPosts()
      .then(function (rows) { _posts = Array.isArray(rows) ? rows : []; })
      .catch(function (err) { console.error("[blog] load failed:", err); _posts = _posts || []; })
      .then(function () { _loading = false; paint(); });
  }

  // Dispatch to the right renderer for the current view.
  function loadAll() { if (IS_POST) loadPost(); else load(); }
  function paintAll() { if (IS_POST) paintPost(); else paint(); }

  function start() {
    loadAll();

    // Re-assert after each Framer hydration pass that recreates the DOM.
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; paintAll(); });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    [300, 1200, 3000, 6000].forEach(function (ms) { setTimeout(paintAll, ms); });
    window.addEventListener("load", paintAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
