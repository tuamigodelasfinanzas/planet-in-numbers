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


// ---------- Wikipedia tables (sourced, frequently updated lists) ----------
const strip = h => String(h).replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
async function wikiTables(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`, { headers: { 'user-agent': UA['user-agent'] } });
  if (!r.ok) throw new Error(`Wikipedia ${title}: HTTP ${r.status}`);
  const html = await r.text();
  return [...html.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map(m => {
    const rows = [...m[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(tr => [...tr[1].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => ({ h: c[1] === 'h', t: strip(c[2]), raw: c[2] })));
    return { head: (rows.find(r => r.every(c => c.h)) || []).map(c => c.t.toLowerCase()), rows: rows.filter(r => r.some(c => !c.h)) };
  });
}
const num = t => { const m = String(t).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };

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

// ---------- YouTube: most viewed videos ever (Wikipedia's maintained list, views in billions) ----------
async function ytMostViewed() {
  const T = await wikiTables('List_of_most-viewed_YouTube_videos');
  const t = T.find(x => x.head.some(h => /views/.test(h)) && x.rows.length >= 20);
  if (!t) throw new Error('YouTube table not found');
  const iName = t.head.findIndex(h => /video name|name/.test(h)), iUp = t.head.findIndex(h => /uploader|artist|channel/.test(h)), iV = t.head.findIndex(h => /views/.test(h));
  const rows = [];
  for (const r of t.rows) {
    const cells = r.length === t.head.length ? r : [{ t: '' }, ...r];
    const v = num(cells[iV]?.t); const name = String(cells[iName]?.t || '').replace(/^"|"$/g, '').replace(/^\W+|\W+$/g, '');
    if (!(v > 1 && v < 60) || !name || /\d{3,}\s+\d{3,}|getinspired/i.test(name) || /^facebook$/i.test(String(cells[iUp]?.t || ''))) continue;
    const id = (cells[iName]?.raw || '').match(/youtube\.com\/watch\?v=([\w-]{11})/)?.[1];
    rows.push({ name: name.length > 34 ? name.slice(0, 33) + '…' : name, value: v * 1e9, flag: '▶️', sub: String(cells[iUp]?.t || ''), img: id ? await dataURI(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`) : null });
  }
  rows.sort((a, b) => b.value - a.value);
  return { rows: rows.slice(0, 25), date: nice(Date.now()), via: 'Wikipedia, List of most-viewed YouTube videos' };
}

// ---------- Steam: most played games right now ----------
async function steamNow() {
  const j = await getJSON('https://api.steampowered.com/ISteamChartsService/GetGamesByConcurrentPlayers/v1/');
  const ranks = j.response?.ranks || [];
  const rows = [];
  for (const r of ranks.slice(0, 25)) {
    let name = null, img = null;
    try { const d = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${r.appid}&filters=basic`); const g = d[r.appid]?.data; name = g?.type === 'game' && !/wallpaper engine|soundpad|steamvr|spacewar|banana$/i.test(g?.name || '') ? g?.name : null; img = await dataURI(g?.header_image); } catch {}
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
    const when = new Date(f.properties.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    // short, uniform labels (fit the row): 'Indonesia · Aug 14'
    const region = c?.name || (tail.length <= 18 ? tail : where.replace(/^Near /, '').slice(0, 18));
    rows.push({ name: `${region} · ${when}`, value: f.properties.mag, flag: c?.flag || '🌋', sub: where });
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

// ---------- Tallest buildings (Wikipedia: List of tallest buildings) ----------
async function buildings() {
  const T = await wikiTables('List_of_tallest_buildings');
  const t = T.find(x => x.head.some(h => /height/.test(h)) && x.head.some(h => /name|building/.test(h)) && x.rows.length >= 20);
  if (!t) throw new Error('Buildings table not found');
  const cs = await countries(), byName = new Map([...cs.values()].map(c => [c.name.toLowerCase(), c]));
  const alias = { 'united states': 'united states', 'turkey': 'türkiye', 'south korea': 'south korea', 'taiwan': 'taiwan' };
  const rows = [], seen = new Set(); let lastC = null;
  for (const r of t.rows) {
    const tx = r.map(c => c.t);
    // the height in metres is the number followed by the same height in feet (rowspans shift columns, so look for the pair)
    const k = tx.findIndex((x, n) => { const m = num(x), f = num(tx[n + 1]); return m > 200 && m < 1000 && Math.abs(f / m - 3.281) < 0.1; });
    if (k < 1) continue;
    let name = ''; for (let n = k - 1; n >= 0; n--) if (tx[n] && isNaN(num(tx[n])) ) { name = tx[n]; break; }
    name = name.replace(/\s*\(.*\)$/, '').replace(/\s*\[.*\]$/, '');
    if (!name || seen.has(name)) continue; seen.add(name);
    let c = null, city = '';
    for (let n = k + 2; n < tx.length; n++) { const hit = byName.get((alias[tx[n].toLowerCase()] || tx[n]).toLowerCase()); if (hit) { c = hit; city = tx[n + 1] && isNaN(num(tx[n + 1])) ? tx[n + 1] : (tx[n - 1] && isNaN(num(tx[n - 1])) ? tx[n - 1] : ''); break; } }
    if (!c) { c = lastC; city = city || tx.slice(k + 2).find(x => x && isNaN(num(x))) || ''; }   // country cell spanning several rows
    lastC = c;
    rows.push({ name, value: num(tx[k]), flag: c?.flag || '🏙️', sub: [city, c?.name].filter(Boolean).join(', '), iso3: c?.iso3 });
  }
  rows.sort((a, b) => b.value - a.value);
  return { rows: rows.slice(0, 25), date: nice(Date.now()), via: 'Wikipedia, List of tallest buildings' };
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
