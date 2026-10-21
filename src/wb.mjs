// World Bank open data (free, no key). Only real countries (aggregates removed).
// Offline tests: PIN_FIXTURE=<dir> reads <dir>/countries.json and <dir>/<INDICATOR>.json
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.worldbank.org/v2';
const CACHE = process.env.PIN_CACHE || '.cache';
const FIX = process.env.PIN_FIXTURE || '';

const NAME_FIX = {
  'Korea, Rep.': 'South Korea', "Korea, Dem. People's Rep.": 'North Korea', 'Egypt, Arab Rep.': 'Egypt',
  'Iran, Islamic Rep.': 'Iran', 'Venezuela, RB': 'Venezuela', 'Turkiye': 'Türkiye', 'Russian Federation': 'Russia',
  'Hong Kong SAR, China': 'Hong Kong', 'Macao SAR, China': 'Macao', 'Yemen, Rep.': 'Yemen', 'Lao PDR': 'Laos',
  'Kyrgyz Republic': 'Kyrgyzstan', 'Slovak Republic': 'Slovakia', 'Czechia': 'Czechia', 'Congo, Dem. Rep.': 'DR Congo',
  'Congo, Rep.': 'Congo', 'Gambia, The': 'Gambia', 'Bahamas, The': 'Bahamas', 'Micronesia, Fed. Sts.': 'Micronesia',
  'Syrian Arab Republic': 'Syria', 'Viet Nam': 'Vietnam', "Cote d'Ivoire": "Côte d'Ivoire", 'West Bank and Gaza': 'Palestine',
  'Brunei Darussalam': 'Brunei', 'Cabo Verde': 'Cape Verde', 'St. Lucia': 'Saint Lucia', 'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Vincent and the Grenadines': 'Saint Vincent', 'Sao Tome and Principe': 'São Tomé and Príncipe', 'Somalia, Fed. Rep.': 'Somalia',
  'Taiwan, China': 'Taiwan', 'Curacao': 'Curaçao', 'Puerto Rico (US)': 'Puerto Rico', 'United States': 'United States',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Trinidad and Tobago': 'Trinidad & Tobago',
};
export const flag = iso2 => (iso2 && /^[A-Z]{2}$/.test(iso2) ? String.fromCodePoint(...[...iso2].map(c => 0x1f1a5 + c.charCodeAt(0))) : '🏳️');

async function getJSON(url, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'planet-in-numbers/1.0' }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j) || (j[0] && j[0].message)) throw new Error('World Bank error: ' + JSON.stringify(j).slice(0, 200));
      return j;
    } catch (e) { err = e; await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  throw new Error(`No data from ${url}: ${err?.message}`);
}

function cached(key, fn) {
  if (FIX) return JSON.parse(fs.readFileSync(path.join(FIX, key + '.json'), 'utf8'));
  const f = path.join(CACHE, key + '.json');
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 6 * 3600e3) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return fn().then(v => { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)); return v; });
}

let _countries;
export async function countries() {
  if (_countries) return _countries;
  const rows = await cached('countries', async () => {
    const [, data] = await getJSON(`${API}/country?format=json&per_page=400`);
    return data.filter(c => c.region?.value && c.region.value !== 'Aggregates')
      .map(c => ({ iso3: c.id, iso2: c.iso2Code, name: NAME_FIX[c.name] || c.name, region: c.region.value.trim(), income: c.incomeLevel?.value || '' }));
  });
  _countries = new Map(rows.map(c => [c.iso3, { ...c, flag: flag(c.iso2) }]));
  return _countries;
}

// Most recent non-empty value per country (not older than maxAge years)
export async function latest(code, maxAge = 8) {
  const rows = await cached(code, async () => {
    const [, data] = await getJSON(`${API}/country/all/indicator/${code}?format=json&per_page=20000&mrnev=1`);
    return (data || []).filter(d => d.value != null).map(d => ({ iso3: d.countryiso3code, year: Number(d.date), value: d.value }));
  });
  const cs = await countries();
  const minYear = new Date().getUTCFullYear() - maxAge;
  return rows.filter(r => cs.has(r.iso3) && r.year >= minYear).map(r => ({ ...cs.get(r.iso3), value: r.value, year: r.year }));
}

// Yearly history: Map iso3 -> {year: value}
export async function history(code, from, to) {
  const rows = await cached(`${code}_${from}_${to}`, async () => {
    const [, data] = await getJSON(`${API}/country/all/indicator/${code}?format=json&per_page=20000&date=${from}:${to}`);
    return (data || []).filter(d => d.value != null).map(d => ({ iso3: d.countryiso3code, year: Number(d.date), value: d.value }));
  });
  const cs = await countries();
  const out = new Map();
  for (const r of rows) {
    if (!cs.has(r.iso3)) continue;
    if (!out.has(r.iso3)) out.set(r.iso3, {});
    out.get(r.iso3)[r.year] = r.value;
  }
  return out;
}

// Countries with at least `minPop` inhabitants (avoids microstates topping every list)
export async function bigCountries(minPop = 1e6) {
  const pop = await latest('SP.POP.TOTL', 10);
  return new Set(pop.filter(p => p.value >= minPop).map(p => p.iso3));
}
