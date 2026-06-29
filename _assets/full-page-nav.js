/* Force full-page navigation for internal links.
   This Framer export ships a client-side (SPA) router whose in-app navigation
   reads per-page CMS data files (_assets/fu/cms/…). Those files are no longer
   part of the deploy — the blog is now Supabase-driven (see blog-posts.js) and
   the CMS bundle was dropped. With that data gone, Framer's SPA navigation
   aborts ("Made UI non-interactive due to an error"): e.g. clicking the header
   logo back to the homepage left the previous page on screen until a manual
   refresh, and every blog card resolved to the first CMS item.

   A normal full page load always renders correctly (static HTML + the
   /blog/<slug> rewrite + blog-posts.js), so we intercept internal link clicks
   and navigate the browser directly, bypassing the broken SPA router. The
   listener runs in the capture phase so it beats Framer's own click handler. */
(function () {
  "use strict";

  document.addEventListener(
    "click",
    function (e) {
      // Honour new-tab / modified clicks and anything already handled.
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if (a.target && a.target !== "_self") return; // _blank etc.
      if (a.hasAttribute("download")) return;

      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return; // in-page anchor

      var url;
      try {
        url = new URL(a.href, location.href);
      } catch (_) {
        return;
      }
      if (url.origin !== location.origin) return; // external link
      // Same page (including pure hash scrolls): let the default behaviour run.
      if (url.pathname === location.pathname && url.search === location.search) return;

      // Internal page navigation -> do it as a full load, beating Framer's
      // delegated SPA click handler.
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign(url.href);
    },
    true // capture
  );
})();
