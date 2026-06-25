import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ORIGIN = 'https://gamlearn.org.uk';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Full page list from sitemap.xml
const PATHS = [
  '/', '/about-us', '/how-you-can-help', '/contact-us', '/blog', '/404',
  '/criminal-justice-support', '/impacted-others', '/cjs-referal-form',
  '/affected-other-referal-form', '/become-a-member-form', '/professional-training',
  '/research', '/memberships', '/gambling-related-crime-courses',
  '/understanding-gambling-related-harm-and-its-links-to-crime', '/privacy-policy',
  '/complaints-policy', '/safeguarding',
  '/blog/paula-s-skydiving-to-support-gamlearn',
  '/blog/culture-and-gambling-how-cultural-norms-shape-gambling-habits',
  '/blog/freeing-the-next-generation-prevention-strategies-for-teen-gambling',
  '/blog/when-coping-goes-wrong-stress-and-gambling-in-adolescents',
  '/blog/youth-in-crisis-gambling-poverty-and-mental-health-among-young-people',
  '/blog/the-psychology-of-gambling-why-the-brain-loves-to-bet',
  '/blog/illusion-of-joy-how-gambling-impacts-individual-happiness',
  '/blog/suicide-and-gambling-a-growing-mental-health-emergency',
  '/blog/the-gambling-stigma-cycle-why-it-prevents-recovery',
  '/blog/what-fuels-problem-gambling-beliefs-attitudes-myths-debunked',
  '/blog/comprehensive-legal-support-for-gambling-habits-a-lifeline-for-individual-s-rights',
  '/blog/steps-on-recovery-how-to-get-help-for-gambling-problems-in-the-uk',
  '/blog/healing-together-new-life-with-group-sessions-for-gambling-recovery',
  '/blog/gambling-problem-101-warning-signs-impacts-and-ways-to-recover',
  '/blog/you-can-regain-control-of-your-life-7-practical-steps-in-overcoming-gambling-habits',
  '/blog/bet-on-a-helping-hand-the-power-of-peer-support-for-gambling-victims',
  '/blog/breaking-free-from-gambling-harm-free-gambling-help-services-that-work',
  '/blog/gambling-related-harm-supporting-families-and-loved-ones-in-crisis',
  '/blog/how-betting-giants-exploit-vulnerable-gamblers-and-what-needs-to-change',
  '/blog/the-hidden-toll-when-gambling-leads-to-crime',
  '/blog/community-based-gambling-help-bridging-recovery-through-local-linkages',
  '/blog/tom-hudd-takes-on-the-brighton-marathon-to-support-gamlearn',
  '/blog/facing-a-theft-case-see-how-gamlearn-makes-a-difference',
  '/blog/football-s-gambling-ad-surge-a-call-for-regulation',
  '/blog/gamlearn-cares-addressing-youth-gambling-urgency',
  '/blog/protecting-the-children-from-gambling-harms-a-call-to-action',
];

function pathToFile(p) {
  if (p === '/') return 'raw/index.html';
  return `raw${p}/index.html`;
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const text = await res.text();
      // /404 returns status 404 but a valid HTML body we want to keep
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      if (text.length < 1000) throw new Error(`Body too small (${text.length})`);
      return text;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

let done = 0;
for (const p of PATHS) {
  const file = pathToFile(p);
  if (existsSync(file)) { done++; continue; }
  await mkdir(file.substring(0, file.lastIndexOf('/')), { recursive: true });
  const html = await fetchWithRetry(ORIGIN + p);
  await writeFile(file, html);
  done++;
  console.log(`[${done}/${PATHS.length}] ${p} -> ${file} (${html.length} bytes)`);
}
console.log('All pages fetched.');
await writeFile('scripts/paths.json', JSON.stringify(PATHS, null, 2));
