/* Per-page <title> enforcement.
   This Framer export ships a single site-level title ("GamLEARN") and resets
   document.title to it after client-side hydration and on SPA navigation.
   This script pins the correct per-page title (from the static HTML) and keeps
   it applied, including across Framer's client-side route changes. */
(function () {
  var TITLES = {
  "/": "GamLEARN | Support & Recovery From Gambling-Related Harm",
  "/about-us": "About Us | GamLEARN",
  "/affected-other-referal-form": "Affected Others Referral Form | GamLEARN",
  "/become-a-member-form": "Become a Member | GamLEARN",
  "/blog": "Blog | GamLEARN",
  "/cjs-referal-form": "Criminal Justice Referral Form | GamLEARN",
  "/complaints-policy": "Complaints Policy | GamLEARN",
  "/contact-us": "Contact Us | GamLEARN",
  "/criminal-justice-support": "Criminal Justice Support | GamLEARN",
  "/gambling-related-crime-courses": "Gambling Related Crime Courses | GamLEARN",
  "/how-you-can-help": "How You Can Help | GamLEARN",
  "/impacted-others": "Impacted Others | GamLEARN",
  "/memberships": "Memberships | GamLEARN",
  "/privacy-policy": "Privacy Policy | GamLEARN",
  "/professional-training": "Professional Training | GamLEARN",
  "/research": "Research | GamLEARN",
  "/safeguarding": "Safeguarding | GamLEARN",
  "/understanding-gambling-related-harm-and-its-links-to-crime": "Understanding Gambling-Related Harm & Its Links to Crime | GamLEARN"
  // Individual blog posts (/blog/<slug>) are intentionally absent: their titles
  // are set live from Supabase by blog-posts.js (see isPost() below).
};
  function key() {
    var p = location.pathname.replace(/\/+$/, "");
    p = p.replace(/\/index$/, "").replace(/\.html$/, "");
    return p === "" ? "/" : p;
  }
  // Individual blog posts (/blog/<slug>) are DB-driven: their title is set live
  // from Supabase by blog-posts.js, including brand-new posts that have no entry
  // here. Don't enforce a static title on those pages or we'd fight that script.
  function isPost() { return /^\/blog\/[^/]+$/.test(key()); }
  var INITIAL = document.title;
  function desired() {
    var k = key();
    return Object.prototype.hasOwnProperty.call(TITLES, k) ? TITLES[k] : INITIAL;
  }
  var want = desired();
  function enforce() {
    if (isPost()) return;            // post pages own their title (blog-posts.js)
    if (document.title !== want) document.title = want;
  }
  function onNav() { want = desired(); enforce(); }
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    if (typeof orig === "function") {
      history[m] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(onNav, 0);
        return r;
      };
    }
  });
  window.addEventListener("popstate", function () { setTimeout(onNav, 0); });
  enforce();
  try {
    new MutationObserver(enforce).observe(
      document.querySelector("title") || document.head,
      { childList: true, characterData: true, subtree: true }
    );
  } catch (e) {}
  document.addEventListener("DOMContentLoaded", enforce);
  window.addEventListener("load", enforce);
})();
