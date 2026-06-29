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
  "/understanding-gambling-related-harm-and-its-links-to-crime": "Understanding Gambling-Related Harm & Its Links to Crime | GamLEARN",
  "/blog/bet-on-a-helping-hand-the-power-of-peer-support-for-gambling-victims": "Bet on a Helping Hand: The Power of Peer Support for Gambling Victims | GamLEARN",
  "/blog/breaking-free-from-gambling-harm-free-gambling-help-services-that-work": "Breaking Free from Gambling Harm: Free Gambling Help Services That Work | GamLEARN",
  "/blog/community-based-gambling-help-bridging-recovery-through-local-linkages": "Community-Based Gambling Help: Bridging Recovery Through Local Linkages | GamLEARN",
  "/blog/comprehensive-legal-support-for-gambling-habits-a-lifeline-for-individual-s-rights": "Comprehensive Legal Support for Gambling Habits: A Lifeline for Individuals' Rights | GamLEARN",
  "/blog/culture-and-gambling-how-cultural-norms-shape-gambling-habits": "Culture and Gambling: How Cultural Norms Shape Gambling Habits | GamLEARN",
  "/blog/facing-a-theft-case-see-how-gamlearn-makes-a-difference": "Facing a Theft Case? See How GamLEARN Makes a Difference | GamLEARN",
  "/blog/football-s-gambling-ad-surge-a-call-for-regulation": "Football's Gambling Ad Surge: A Call for Regulation | GamLEARN",
  "/blog/freeing-the-next-generation-prevention-strategies-for-teen-gambling": "Freeing the Next Generation: Prevention Strategies for Teen Gambling | GamLEARN",
  "/blog/gambling-problem-101-warning-signs-impacts-and-ways-to-recover": "Gambling Problem 101: Warning Signs, Impacts, and Ways to Recover | GamLEARN",
  "/blog/gambling-related-harm-supporting-families-and-loved-ones-in-crisis": "Gambling-Related Harm: Supporting Families and Loved Ones in Crisis | GamLEARN",
  "/blog/gamlearn-cares-addressing-youth-gambling-urgency": "GamLEARN Cares: Addressing Youth Gambling Urgency | GamLEARN",
  "/blog/healing-together-new-life-with-group-sessions-for-gambling-recovery": "Healing Together: New Life with Group Sessions for Gambling Recovery | GamLEARN",
  "/blog/how-betting-giants-exploit-vulnerable-gamblers-and-what-needs-to-change": "How Betting Giants Exploit Vulnerable Gamblers—And What Needs to Change | GamLEARN",
  "/blog/illusion-of-joy-how-gambling-impacts-individual-happiness": "Illusion of Joy: How Gambling Impacts Individual Happiness | GamLEARN",
  "/blog/paula-s-skydiving-to-support-gamlearn": "Paula's Skydiving to Support GamLEARN | GamLEARN",
  "/blog/protecting-the-children-from-gambling-harms-a-call-to-action": "Protecting The Children from Gambling Harms: A Call to Action | GamLEARN",
  "/blog/steps-on-recovery-how-to-get-help-for-gambling-problems-in-the-uk": "Steps on Recovery: How to Get Help for Gambling Problems in the UK | GamLEARN",
  "/blog/suicide-and-gambling-a-growing-mental-health-emergency": "Suicide and Gambling: A Growing Mental Health Emergency | GamLEARN",
  "/blog/the-gambling-stigma-cycle-why-it-prevents-recovery": "The Gambling-Stigma Cycle: Why It Prevents Recovery | GamLEARN",
  "/blog/the-hidden-toll-when-gambling-leads-to-crime": "The Hidden Toll: When Gambling Leads to Crime | GamLEARN",
  "/blog/the-psychology-of-gambling-why-the-brain-loves-to-bet": "The Psychology of Gambling: Why the Brain Loves to Bet | GamLEARN",
  "/blog/tom-hudd-takes-on-the-brighton-marathon-to-support-gamlearn": "Tom Hudd Takes on the Brighton Marathon to Support GamLEARN | GamLEARN",
  "/blog/what-fuels-problem-gambling-beliefs-attitudes-myths-debunked": "What Fuels Problem Gambling? Beliefs, Attitudes, & Myths Debunked | GamLEARN",
  "/blog/when-coping-goes-wrong-stress-and-gambling-in-adolescents": "When Coping Goes Wrong: Stress and Gambling in Adolescents | GamLEARN",
  "/blog/you-can-regain-control-of-your-life-7-practical-steps-in-overcoming-gambling-habits": "You Can Regain Control of Your Life: 7 Practical Steps in Overcoming Gambling Habits | GamLEARN",
  "/blog/youth-in-crisis-gambling-poverty-and-mental-health-among-young-people": "Youth in Crisis: Gambling, Poverty, and Mental Health Among Young People | GamLEARN"
};
  function key() {
    var p = location.pathname.replace(/\/+$/, "");
    p = p.replace(/\/index$/, "").replace(/\.html$/, "");
    return p === "" ? "/" : p;
  }
  var INITIAL = document.title;
  function desired() {
    var k = key();
    return Object.prototype.hasOwnProperty.call(TITLES, k) ? TITLES[k] : INITIAL;
  }
  var want = desired();
  function enforce() { if (document.title !== want) document.title = want; }
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
