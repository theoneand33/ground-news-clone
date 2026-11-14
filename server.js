// Zero-dependency news aggregator: pulls each outlet's headlines from Google News RSS,
// clusters them into stories, and reports how left/center/right outlets cover each one.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = require('./sources.json'); // domain -> "L" | "C" | "R" (editorial approximations)
const PORT = process.env.PORT || 3000;
const TTL = 15 * 60 * 1000;
const PER_SOURCE = 40;
const SIMILARITY = 0.4;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] !== '#' ? ENT[e.toLowerCase()] ?? m
      : String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)));

const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '').trim();

// shortcut: regex RSS parsing, fine for Google News' uniform feed; use a real XML parser if feeds vary.
function parseFeed(xml, domain) {
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map((item) => {
    const source = tag(item, 'source') || domain;
    let title = tag(item, 'title');
    if (title.endsWith(' - ' + source)) title = title.slice(0, -source.length - 3);
    return { title, link: tag(item, 'link'), source, bias: SOURCES[domain], time: Date.parse(tag(item, 'pubDate')) || 0 };
  }).filter((a) => a.title && /^https:\/\//.test(a.link));
}

const STOP = new Set(('the and for but with from that this than then into over after amid about says say said new how why what who ' +
  'will can not you your his her their its has have had was were are been more out off just now here these those could would ' +
  'should may might being our they them she him via per get gets got one two news live update updates watch video opinion').split(' '));
const tokens = (t) => new Set(t.toLowerCase().replace(/['’]s\b/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/s$/, '') : w)));

// Greedy clustering on IDF-weighted cosine similarity of headline words against each cluster's first headline.
function cluster(articles) {
  const df = new Map();
  for (const a of articles) {
    a.tok = tokens(a.title);
    for (const w of a.tok) df.set(w, (df.get(w) || 0) + 1);
  }
  const w2 = (w) => Math.log(1 + articles.length / df.get(w)) ** 2;
  for (const a of articles) a.norm = Math.sqrt([...a.tok].reduce((s, w) => s + w2(w), 0));

  const clusters = [];
  for (const a of articles) {
    let best = null, bestSim = SIMILARITY;
    if (a.tok.size >= 3) for (const c of clusters) {
      let dot = 0, shared = 0;
      for (const w of a.tok) if (c.seed.tok.has(w)) { dot += w2(w); shared++; }
      const sim = shared >= 3 ? dot / (a.norm * c.seed.norm) : 0;
      if (sim > bestSim) { best = c; bestSim = sim; }
    }
    if (best) best.articles.push(a);
    else clusters.push({ seed: a, articles: [a] });
  }

  return clusters.map(({ articles }) => {
    const seen = new Set(); // one article per outlet
    const list = articles.filter((a) => !seen.has(a.source) && seen.add(a.source))
      .map(({ title, link, source, bias, time }) => ({ title, link, source, bias, time }));
    const counts = { L: 0, C: 0, R: 0 };
    for (const a of list) counts[a.bias]++;
    return { title: list[0].title, time: Math.max(...list.map((a) => a.time)), counts, articles: list };
  });
}

async function fetchSource(domain) {
  const url = `https://news.google.com/rss/search?q=site:${domain}+when:1d&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), domain).sort((a, b) => b.time - a.time).slice(0, PER_SOURCE);
}

let cache = { updated: 0, sources: 0, stories: [] };
let refreshing = null;

async function refresh() {
  const queue = Object.keys(SOURCES), articles = [];
  let live = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    for (let d; (d = queue.pop());) {
      try {
        const items = await fetchSource(d);
        if (items.length) live++;
        articles.push(...items);
      } catch (e) { console.error(`feed failed: ${d}: ${e.message}`); }
    }
  }));
  if (!articles.length) return; // keep the old cache rather than serve nothing
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const stories = cluster(articles.filter((a) => a.time > cutoff).sort((a, b) => b.time - a.time))
    .filter((s) => s.articles.length >= 2)
    .sort((a, b) => b.articles.length - a.articles.length || b.time - a.time)
    .slice(0, 150);
  cache = { updated: Date.now(), sources: live, stories };
  console.log(`refreshed: ${articles.length} articles, ${live} sources, ${stories.length} stories`);
}

function getCache() {
  if (Date.now() - cache.updated > TTL && !refreshing) {
    refreshing = refresh().catch((e) => console.error(e)).finally(() => { refreshing = null; });
  }
  return cache.updated ? cache : refreshing.then(() => cache); // serve stale while refreshing
}

if (require.main === module) {
  http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/api/stories') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' });
      res.end(JSON.stringify(await getCache()));
    } else if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    } else {
      res.writeHead(404).end('Not found');
    }
  }).listen(PORT, () => console.log(`listening on :${PORT}`));
  getCache();
}

module.exports = { parseFeed, cluster, decode };
