// Synthetic test data (offline). NOT real numbers: only to test the layouts.
// Usage: node tools/make-fixture.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'fixture';
fs.mkdirSync(dir, { recursive: true });
const geo = JSON.parse(fs.readFileSync(new URL('../assets/geo/countries.geo.json', import.meta.url)));
const ISO2 = { USA: 'US', CAN: 'CA', MEX: 'MX', BRA: 'BR', ARG: 'AR', CHL: 'CL', COL: 'CO', PER: 'PE', CUB: 'CU', GBR: 'GB', IRL: 'IE', FRA: 'FR', DEU: 'DE', ESP: 'ES', PRT: 'PT', ITA: 'IT', NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', SWE: 'SE', NOR: 'NO', FIN: 'FI', DNK: 'DK', POL: 'PL', UKR: 'UA', GRC: 'GR', TUR: 'TR', RUS: 'RU', EGY: 'EG', MAR: 'MA', NGA: 'NG', KEN: 'KE', ETH: 'ET', ZAF: 'ZA', GHA: 'GH', SAU: 'SA', ARE: 'AE', ISR: 'IL', IRN: 'IR', IND: 'IN', PAK: 'PK', BGD: 'BD', CHN: 'CN', JPN: 'JP', KOR: 'KR', IDN: 'ID', PHL: 'PH', VNM: 'VN', THA: 'TH', MYS: 'MY', AUS: 'AU', NZL: 'NZ', HUN: 'HU', CZE: 'CZ', ROU: 'RO', ISL: 'IS', QAT: 'QA', DZA: 'DZ', LUX: 'LU', SGP: 'SG' };
const REG = ['Europe & Central Asia', 'East Asia & Pacific', 'Latin America & Caribbean', 'Sub-Saharan Africa', 'Middle East, North Africa, Afghanistan & Pakistan', 'North America', 'South Asia'];
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const cs = geo.features.filter(f => /^[A-Z]{3}$/.test(f.id)).map((f, i) => ({ iso3: f.id, iso2: ISO2[f.id] || '', name: f.properties.name, region: REG[i % REG.length], income: '' }));
for (const s of ['LUX', 'SGP']) if (!cs.some(c => c.iso3 === s)) cs.push({ iso3: s, iso2: ISO2[s], name: s === 'LUX' ? 'Luxembourg' : 'Singapore', region: 'Europe & Central Asia', income: '' });
fs.writeFileSync(path.join(dir, 'countries.json'), JSON.stringify(cs));

const topics = JSON.parse(fs.readFileSync(new URL('../content/topics.json', import.meta.url)));
const cat = JSON.parse(fs.readFileSync(new URL('../content/catalog.json', import.meta.url)));
const codes = new Set([...topics.map(t => t.code), ...cat.versusMetrics.map(m => m.code), ...cat.quizClues.map(m => m.code), 'SP.POP.TOTL', 'PA.NUS.PPPC.RF']);
const scale = { 'SP.POP.TOTL': [1e5, 1.4e9], 'NY.GDP.MKTP.CD': [1e9, 2.8e13], 'NY.GDP.PCAP.CD': [250, 120000], 'NY.GDP.PCAP.PP.CD': [800, 140000], 'SP.DYN.LE00.IN': [52, 85], 'SP.DYN.TFRT.IN': [0.8, 6.5], 'PA.NUS.PPPC.RF': [0.22, 1.4], 'EN.POP.DNST': [2, 8000], 'IT.CEL.SETS.P2': [30, 190], 'SH.XPD.CHEX.PC.CD': [20, 12000], 'SP.DYN.IMRT.IN': [1.5, 70], 'VC.IHR.PSRC.P5': [0.2, 40] };
for (const code of codes) {
  const [lo, hi] = scale[code] || [0.5, 99];
  const v = c => lo + (hi - lo) * Math.pow(rnd(), code === 'SP.POP.TOTL' ? 3 : 1.4);
  const rows = cs.map(c => ({ iso3: c.iso3, year: 2023, value: Number(v(c).toFixed(2)) }));
  fs.writeFileSync(path.join(dir, code + '.json'), JSON.stringify(rows));
  const t = topics.find(t => t.code === code && t.race);
  if (t) {
    const to = new Date().getUTCFullYear() - 1, h = [];
    for (const r of rows) { let x = r.value * (0.15 + rnd() * 0.5); for (let y = t.race; y <= to; y++) { x *= 1 + (rnd() - 0.35) * 0.12; h.push({ iso3: r.iso3, year: y, value: Number(x.toFixed(2)) }); } }
    fs.writeFileSync(path.join(dir, `${code}_${t.race}_${to}.json`), JSON.stringify(h));
  }
}
console.log('fixture ready in', dir, cs.length, 'countries');
