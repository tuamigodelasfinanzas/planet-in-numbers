// "World" rankings beyond countries: trends, games, crypto, earthquakes, weather, buildings, prices.
// Every fetcher returns real, live data: { rows: [{ name, value, flag, img?, sub? }] (sorted), date, via }
// Images are embedded as data URIs so the renderer never waits for the network.
import { countries } from './wb.mjs';

const UA = { 'user-agent': 'PlanetInNumbers/1.0 (https://github.com/tuamigodelasfinanzas/planet-in-numbers)', accept: 'application/json' };
const getJSON = async (url, opts = {}) => {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: UA, ...opts }); if (r.ok) return await r.json(); if (r.status === 404) throw new Error('404 ' + url); }
    catch (e) { if (i === 2) throw e; }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('No data from ' + url);
};
export async function dataURI(url, max = 120000) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA['user-agent'] } }); if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer()); if (b.length > max) return null;
    return `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${b.toString('base64')}`;
  } catch { return null; }
}
const today = () => new Date().toISOString().slice(0, 10);
const nice = d => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ---------- Wikipedia: most read articles of the last 7 days ----------
const WIKI_SKIP = /^(Main_Page|Special:|Wikipedia:|File:|Portal:|Help:|Template:|Category:|Talk:|User:|Draft:|List_of|Lists_of|Deaths_in|Index_of|\d{4}_in_)|xxx|porn|sex|nude|onlyfans|murder|killing|shooting|suicide|massacre|terror|rape|stabbing|assassination|bomb|death_of|_attack|election|referendum|_war|invasion|conflict|genocide/i;
async function wikiWeek() {
  const sum = new Map();
  for (let d = 1; d <= 7; d++) {
    const t = new Date(Date.now() - d * 864e5), [y, m, dd] = t.toISOString().slice(0, 10).split('-');
    try {
      const j = await getJSON(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${dd}`);
      for (const a of j.items?.[0]?.articles || []) if (!WIKI_SKIP.test(a.article)) sum.set(a.article, (sum.get(a.article) || 0) + a.views);
    } catch {}
  }
  const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 40);
  const rows = [];
  for (const [art, views] of top) {
    if (rows.length >= 25) break;
    let s = {};
    try { s = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(art)}`); } catch {}
    if (s.type === 'disambiguation') continue;
    const desc = String(s.description || '');
    if (/pornograph|adult film|murder|serial killer|terror|mass shooting|politician|election|war /i.test(desc)) continue;   // keep it brand-safe
    rows.push({ name: String(s.title || art.replace(/_/g, ' ')).replace(/\s*\(.*\)$/, ''), value: views, flag: '📰', img: await dataURI(s.thumbnail?.source), sub: desc });
  }
  return { rows, date: nice(Date.now() - 864e5), via: 'Wikimedia pageviews (English Wikipedia, last 7 days)' };
}

// ---------- YouTube: most viewed videos of all time (through the Make bridge) ----------
async function ytMostViewed() {
  const hook = process.env.MAKE_HOOK; if (!hook) throw new Error('No Make webhook for YouTube');
  const api = async (url, query) => {
    const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'yt_api', method: 'GET', url, query: new URLSearchParams(query).toString(), body_json: '' }) });
    const j = JSON.parse(await r.text()); if (j.error) throw new Error(j.error.message || 'YouTube error'); return j;
  };
  const s = await api('/v3/search', { part: 'id', type: 'video', order: 'viewCount', maxResults: '25', safeSearch: 'strict' });
  const ids = (s.items || []).map(x => x.id.videoId).filter(Boolean);
  const v = await api('/v3/videos', { part: 'snippet,statistics', id: ids.join(',') });
  const rows = [];
  for (const x of (v.items || []).sort((a, b) => b.statistics.viewCount - a.statistics.viewCount)) {
    const title = x.snippet.title.replace(/\s*[\(\[].*?(official|video|mv|audio|lyrics).*?[\)\]]/gi, '').replace(/\s*\|.*$/, '').trim();
    rows.push({ name: title.length > 38 ? title.slice(0, 36) + '…' : title, value: Number(x.statistics.viewCount), flag: '▶️', img: await dataURI(x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url), sub: x.snippet.channelTitle });
  }
  return { rows, date: nice(Date.now()), via: 'YouTube Data API (live view counts)' };
}

// ---------- Steam: most played games right now ----------
async function steamNow() {
  const j = await getJSON('https://api.steampowered.com/ISteamChartsService/GetGamesByConcurrentPlayers/v1/');
  const ranks = j.response?.ranks || [];
  const rows = [];
  for (const r of ranks.slice(0, 25)) {
    let name = null, img = null;
    try { const d = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${r.appid}&filters=basic`); const g = d[r.appid]?.data; name = g?.type === 'game' ? g?.name : null; img = await dataURI(g?.header_image); } catch {}
    if (!name) continue;
    rows.push({ name, value: r.concurrent_in_game, flag: '🎮', img });
  }
  return { rows, date: nice(Date.now()), via: 'Steam (players online right now)' };
}

// ---------- CoinGecko: biggest movers of the week among the top 100 coins ----------
async function crypto(dir) {
  const j = await getJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=7d');
  const stable = /usd|tether|dai|euro|wrapped|staked|bridged/i;
  let rows = j.filter(c => c.price_change_percentage_7d_in_currency != null && !stable.test(c.id) && !stable.test(c.name))
    .map(c => ({ name: c.name, value: c.price_change_percentage_7d_in_currency, flag: '🪙', imgUrl: c.image }));
  rows.sort((a, b) => (dir === 'asc' ? a.value - b.value : b.value - a.value));
  rows = rows.slice(0, 20);
  for (const r of rows) { r.img = await dataURI(r.imgUrl); delete r.imgUrl; }
  return { rows, date: nice(Date.now()), via: 'CoinGecko (price change, last 7 days)' };
}

// ---------- USGS: strongest earthquakes this year ----------
async function quakes() {
  const y = new Date().getUTCFullYear();
  const j = await getJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${y}-01-01&minmagnitude=6&orderby=magnitude&limit=60`);
  const cs = await countries(); const byName = new Map([...cs.values()].map(c => [c.name.toLowerCase(), c]));
  const alias = { 'russia': 'Russia', 'japan': 'Japan', 'indonesia': 'Indonesia', 'philippines': 'Philippines', 'chile': 'Chile', 'peru': 'Peru', 'mexico': 'Mexico', 'china': 'China', 'turkey': 'Türkiye', 'iran': 'Iran', 'papua new guinea': 'Papua New Guinea', 'vanuatu': 'Vanuatu', 'tonga': 'Tonga', 'fiji': 'Fiji', 'new zealand': 'New Zealand', 'alaska': 'United States', 'california': 'United States', 'hawaii': 'United States' };
  const rows = [];
  for (const f of j.features || []) {
    const place = String(f.properties.place || ''); const tail = place.split(',').pop().trim();
    const cname = alias[tail.toLowerCase()] || tail;
    const c = byName.get(cname.toLowerCase());
    const where = place.replace(/^\d+\s*km\s+[NSEW]{0,3}\s+of\s+/i, 'Near ');
    rows.push({ name: where.length > 34 ? (c ? `Off ${c.name}` : where.slice(0, 33) + '…') : where, value: f.properties.mag, flag: c?.flag || '🌋', sub: new Date(f.properties.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
  }
  return { rows, date: String(y), via: 'USGS earthquake catalog' };
}

// ---------- Open-Meteo: hottest / coldest capital right now ----------
async function capitals() {
  const q = `SELECT ?cityLabel ?iso ?lat ?lon WHERE { ?country wdt:P31 wd:Q3624078; wdt:P36 ?city; wdt:P298 ?iso. ?city p:P625/psv:P625 [ wikibase:geoLatitude ?lat; wikibase:geoLongitude ?lon ]. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, accept: 'application/sparql-results+json' } });
  const seen = new Set(), out = [];
  for (const b of j.results.bindings) { const k = b.iso.value; if (seen.has(k)) continue; seen.add(k); out.push({ city: b.cityLabel.value, iso3: k, lat: +b.lat.value, lon: +b.lon.value }); }
  return out;
}
async function weather(dir) {
  const caps = await capitals(), cs = await countries();
  const rows = [];
  for (let i = 0; i < caps.length; i += 50) {
    const part = caps.slice(i, i + 50);
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${part.map(c => c.lat.toFixed(3)).join(',')}&longitude=${part.map(c => c.lon.toFixed(3)).join(',')}&current=temperature_2m`);
    (Array.isArray(j) ? j : [j]).forEach((w, k) => { const c = part[k], t = w.current?.temperature_2m; if (t != null && cs.has(c.iso3)) rows.push({ name: c.city, value: t, flag: cs.get(c.iso3).flag, sub: cs.get(c.iso3).name, iso3: c.iso3 }); });
  }
  rows.sort((a, b) => (dir === 'asc' ? a.value - b.value : b.value - a.value));
  const now = new Date();
  return { rows: rows.slice(0, 25), date: `${nice(now)}, ${now.toISOString().slice(11, 16)} UTC`, via: 'Open-Meteo (temperature right now in every capital city)' };
}

// ---------- Wikidata: tallest buildings ----------
async function buildings() {
  const q = `SELECT ?b ?bLabel ?h ?iso WHERE { ?b wdt:P31 wd:Q11303; wdt:P2048 ?h; wdt:P17 ?c. ?c wdt:P298 ?iso. FILTER(?h > 330) MINUS { ?b wdt:P5817 wd:Q12377751 } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?h) LIMIT 80`;
  const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, accept: 'application/sparql-results+json' } });
  const cs = await countries(), seen = new Set(), rows = [];
  for (const b of j.results.bindings) {
    const name = b.bLabel.value; if (seen.has(b.b.value) || /^Q\d+$/.test(name)) continue;
    seen.add(b.b.value);
    const c = cs.get(b.iso.value);
    rows.push({ name, value: Number(b.h.value), flag: c?.flag || '🏙️', sub: c?.name || '', iso3: b.iso.value });
  }
  return { rows: rows.slice(0, 25), date: nice(Date.now()), via: 'Wikidata (completed buildings, architectural height)' };
}

// ---------- The Economist: Big Mac price in every country ----------
async function bigMac(dir) {
  const r = await fetch('https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv');
  const lines = (await r.text()).trim().split('\n'), head = lines[0].split(',');
  const I = k => head.indexOf(k);
  const recs = lines.slice(1).map(l => l.split(','));
  const last = recs.map(x => x[I('date')]).sort().at(-1);
  const cs = await countries();
  let rows = recs.filter(x => x[I('date')] === last && cs.has(x[I('iso_a3')])).map(x => ({ iso3: x[I('iso_a3')], name: cs.get(x[I('iso_a3')]).name, flag: cs.get(x[I('iso_a3')]).flag, value: Number(x[I('dollar_price')]) })).filter(x => x.value > 0);
  rows.sort((a, b) => (dir === 'asc' ? a.value - b.value : b.value - a.value));
  return { rows: rows.slice(0, 25), date: nice(last), via: 'The Economist Big Mac index' };
}

const SOURCES = {
  'wiki-week': () => wikiWeek(),
  'yt-views': () => ytMostViewed(),
  'steam-now': () => steamNow(),
  'crypto-up': () => crypto('desc'), 'crypto-down': () => crypto('asc'),
  'quakes': () => quakes(),
  'hot-now': () => weather('desc'), 'cold-now': () => weather('asc'),
  'buildings': () => buildings(),
  'bigmac-high': () => bigMac('desc'), 'bigmac-low': () => bigMac('asc'),
};
export const isWorld = t => !!(t && SOURCES[t.src]);
export async function worldRows(t) {
  const out = await SOURCES[t.src]();
  if (!out.rows || out.rows.length < 10) throw new Error(`Not enough data for ${t.id} (${out.rows?.length || 0})`);
  return out;
}
