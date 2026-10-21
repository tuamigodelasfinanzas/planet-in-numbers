// Builds the content of one post (reel or carousel) with real World Bank data.
// Usage: node src/build.mjs <series> <out item.json> [state used.json] [episode id]
import fs from 'node:fs';
import { latest, countries, bigCountries, latestOf, historyOf } from './wb.mjs';
import { show, speak, pickNext } from './fmt.mjs';
import { HANDLE } from './brand.mjs';

const T_WB = JSON.parse(fs.readFileSync(new URL('../content/topics.json', import.meta.url)));
const T_OWID = JSON.parse(fs.readFileSync(new URL('../content/topics-owid.json', import.meta.url)));
// mix both sources (curious topics first): owid, owid, wb, owid, owid, wb…
const TOPICS = [];
for (let i = 0, j = 0; i < T_OWID.length || j < T_WB.length;) {
  if (i < T_OWID.length) TOPICS.push(T_OWID[i++]);
  if (i < T_OWID.length) TOPICS.push(T_OWID[i++]);
  if (j < T_WB.length) TOPICS.push(T_WB[j++]);
}
const CAT = JSON.parse(fs.readFileSync(new URL('../content/catalog.json', import.meta.url)));
const [series, outFile = 'item.json', stateFile = '', forced = ''] = process.argv.slice(2);
const state = (() => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } })();
const usedOf = s => state[s] || [];
const recentTopics = (state._topics || []).filter(t => Date.now() - Date.parse(t.at) < 7 * 864e5).map(t => t.id);

const TAGS = '#worldrankings #countries #geography #dataviz #theplanetinnumbers';
const SRCNAME = t => (t && t.src === 'owid' ? `Our World in Data${t.via ? ` (${t.via})` : ''}` : 'World Bank open data');
const SRC = (y, t) => `📊 Source: ${SRCNAME(t)}, latest available (${t && t.yearLabel ? YL(t, y) : y}).${t && t.minPop === 0 ? '' : ' Countries with 1M+ people.'}`;
const YL = (t, y) => (t.yearLabel ? t.yearLabel.replace('{y}', y) : String(y));
// the whole ranking, kept with the post so comment replies can tell anyone where their country stands
const fullRank = (rows, fmt) => rows.slice(0, 220).map((r, i) => [r.iso3, i + 1, show(r.value, fmt)]);
const ordinal = n => ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);

function pickTopic(filter) {
  if (forced) return TOPICS.find(t => t.id === forced) || (() => { throw new Error('Unknown topic ' + forced); })();
  const cands = TOPICS.filter(filter);
  const fresh = cands.filter(t => !recentTopics.includes(t.id));
  return pickNext(fresh.length ? fresh : cands, usedOf(series));
}

async function ranking(topic, n) {
  const big = topic.minPop === 0 ? null : await bigCountries(1e6);
  let rows = (await latestOf(topic)).filter(r => !big || big.has(r.iso3));
  if (rows.length < n + 5) throw new Error(`Not enough data for ${topic.id} (${rows.length})`);
  rows.sort((a, b) => (topic.dir === 'asc' ? a.value - b.value : b.value - a.value));
  const top = rows.slice(0, n);
  const year = Math.max(...top.map(r => r.year));
  return { rows, top, year };
}
const barScale = (top, dir) => {
  const vals = top.map(r => r.value), max = Math.max(...vals), min = Math.min(...vals);
  // for "lowest first" lists the best (smallest) gets the longest bar
  return v => (dir === 'asc' ? Math.max(0.18, (max - v) / (max - min || 1) * 0.82 + 0.18) : Math.max(0.12, v / (max || 1)));
};
const rowOut = (r, i, fmt, sc) => ({ rank: i + 1, name: r.name, flag: r.flag, iso3: r.iso3, value: r.value, text: show(r.value, fmt), v: sc(r.value) });

const cta = (line = 'Where does YOUR country rank?') => ({ type: 'cta', line, sub: `Follow ${HANDLE} for a new ranking every day`, say: `${line.replace('YOUR', 'your')} Tell me in the comments, and follow for more.` });

const builders = {
  // 🎬 Top 10 ranking (countdown)
  async top10() {
    const t = pickTopic(x => !x.raceOnly);
    const { rows: all, top, year } = await ranking(t, 10);
    const sc = barScale(top, t.dir);
    const rows = top.map((r, i) => rowOut(r, i, t.fmt, sc));
    const [a, b, c] = rows;
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'upbeat', title: t.title, rank: fullRank(all, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'TOP 10 · ' + year, title: t.hook, sub: 'Is your country on this list? 👀', say: `${t.hook.replace(/[^\p{L}\p{N}\s',.?!-]/gu, '').trim().replace(/([^.?!])$/, '$1.')} Stay until number one.` },
        { type: 'rank', title: t.title, metric: `${t.metric} · ${YL(t, year)}`, rows, min: 9, order: 'countdown', parts: [
          { say: `Number three: ${c.name}.`, row: 2 },
          { say: `Number two: ${b.name}.`, row: 1 },
          { say: `And number one is… ${a.name}, with ${speak(a.value, t.fmt)}!`, row: 0 },
        ] },
        cta(),
      ],
      caption: `${t.hook}\n\n🥇 ${a.flag} ${a.name}: ${a.text}\n🥈 ${b.flag} ${b.name}: ${b.text}\n🥉 ${c.flag} ${c.name}: ${c.text}\n\nWhere does your country rank? Tell us in the comments 👇\n\n${SRC(year, t)}\n\n${TAGS}`,
    };
  },

  // 🖼️ Full Top 20 (carousel, 7 slides)
  async top20() {
    const t = pickTopic(x => !x.raceOnly);
    const { rows: all, top, year } = await ranking(t, 20);
    const sc = barScale(top, t.dir);
    const rows = top.map((r, i) => rowOut(r, i, t.fmt, sc));
    const slides = [{ type: 'cover', kicker: 'FULL RANKING · TOP 20', title: t.title, sub: `${t.metric} · ${YL(t, year)}`, flags: rows.slice(0, 3).map(r => r.flag) }];
    for (let i = 0; i < 5; i++) slides.push({ type: 'list', title: t.title, range: `#${i * 4 + 1}–${i * 4 + 4}`, rows: rows.slice(i * 4, i * 4 + 4) });
    slides.push({ type: 'end', title: 'Is your country on the list?', sub: 'Save this post and share it with someone who should see it', note: SRC(year, t).replace('📊 ', '') });
    return {
      kind: 'carousel', series, episode: t.id, topic: t.id, title: t.title, slides, rank: fullRank(all, t.fmt), metricName: t.say,
      caption: `${t.title}: the full Top 20 🌍\n\n🥇 ${rows[0].flag} ${rows[0].name}: ${rows[0].text}\n\nSwipe to see all 20 ➡️ Is your country on the list?\n\n💾 Save it for later.\n\n${SRC(year, t)}\n\n${TAGS}`,
    };
  },

  // 🎬 How far $100 goes (price level ratio PPP / market)
  async dollar100() {
    const ep = forced ? CAT.dollarRegions.find(r => r.id === forced) : pickNext(CAT.dollarRegions, usedOf(series));
    const big = await bigCountries(1e6);
    let rows = (await latest('PA.NUS.PPPC.RF')).filter(r => big.has(r.iso3) && r.value > 0);
    if (ep.region) rows = rows.filter(r => r.region.startsWith(ep.region));
    rows = rows.map(r => ({ ...r, value: 100 / r.value }));
    rows.sort((a, b) => (ep.dir === 'asc' ? a.value - b.value : b.value - a.value));
    const top = rows.slice(0, 10), year = Math.max(...top.map(r => r.year));
    const max = Math.max(...top.map(r => r.value));
    const out = top.map((r, i) => ({ rank: i + 1, name: r.name, flag: r.flag, iso3: r.iso3, value: r.value, text: '$' + Math.round(r.value), v: Math.max(0.12, r.value / max) }));
    const [a, b] = out;
    return {
      kind: 'reel', series, episode: ep.id, music: 'upbeat', title: ep.title,
      scenes: [
        { type: 'hook', kicker: '$100 = ?', title: `${ep.title} 💵`, sub: 'Number one will surprise you 👀', say: `${ep.title}. Here is what one hundred dollars is really worth.` },
        { type: 'rank', title: ep.title, metric: `Value of $100 in local prices · ${year}`, rows: out, min: 9, order: 'countdown', parts: [
          { say: `Number three: ${out[2].name}.`, row: 2 },
          { say: `Number two: ${b.name}, where it feels like ${Math.round(b.value)}.`, row: 1 },
          { say: `And number one is… ${a.name}: there, one hundred dollars feels like ${Math.round(a.value)}!`, row: 0 },
        ] },
        cta('Where would YOU take your $100?'),
      ],
      caption: `${ep.title} 💵\n\nWith local prices, $100 feels like:\n🥇 ${a.flag} ${a.name}: ${a.text}\n🥈 ${b.flag} ${b.name}: ${b.text}\n\n(Based on the World Bank price level ratio: PPP conversion factor vs. market exchange rate.)\n\nWhere would you spend your $100? 👇\n\n${SRC(year)}\n\n#travel #money #costofliving #worldrankings #theplanetinnumbers`,
      rank: fullRank(rows, 'usd').map(r => [r[0], r[1], '$' + Math.round(rows[r[1] - 1].value)]), metricName: 'what $100 feels like',
    };
  },

  // 🎬 Then vs Now (bar chart race)
  async race() {
    const t = pickTopic(x => x.race);
    const to = new Date().getUTCFullYear() - 1;
    const h = await historyOf(t, t.race, to);
    const big = t.minPop === 0 ? null : await bigCountries(1e6);
    const cs = await countries();
    const years = [];
    for (let y = t.race; y <= to; y++) if ([...h.values()].filter(v => v[y] != null).length > 25) years.push(y);
    if (years.length < 8) throw new Error('Not enough history for ' + t.id);
    const y0 = years[0], y1 = years.at(-1);
    // fill gaps (carry the last known value) and keep countries that reach the top 10 at some point
    const series_ = new Map();
    for (const [iso, vals] of h) {
      if (big && !big.has(iso)) continue;
      let last = null; const v = {};
      for (const y of years) { if (vals[y] != null) last = vals[y]; if (last != null) v[y] = last; }
      series_.set(iso, v);
    }
    const inTop = new Set();
    for (const y of years) [...series_].filter(([, v]) => v[y] != null).sort((a, b) => b[1][y] - a[1][y]).slice(0, 10).forEach(([iso]) => inTop.add(iso));
    const bars = [...inTop].map(iso => ({ iso3: iso, name: cs.get(iso).name, flag: cs.get(iso).flag, values: series_.get(iso) }));
    const first = [...bars].sort((a, b) => (b.values[y0] ?? -1) - (a.values[y0] ?? -1))[0];
    const last = [...bars].sort((a, b) => (b.values[y1] ?? -1) - (a.values[y1] ?? -1))[0];
    const same = first.iso3 === last.iso3;
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'epic', title: `${t.title}: ${y0} vs ${y1}`,
      scenes: [
        { type: 'hook', kicker: `${y0} → ${y1}`, title: t.raceOnly ? t.hook : `${t.title}: then vs now`, sub: 'Watch who takes the lead 🏁', say: `${t.title}, from ${y0} to today. Watch how the world changed.` },
        { type: 'race', title: t.title, metric: t.metric, fmt: t.fmt, years, bars, min: Math.min(24, Math.max(16, years.length * 0.2)), say: `In ${y0}, number one was ${first.name}. ${same ? `Decades later, ${last.name} is still on top.` : `But everything changed. By ${y1}, ${last.name} took the lead.`}` },
        cta('Did YOUR country go up or down?'),
      ],
      caption: `${t.title}: ${y0} vs ${y1} 📈\n\n🕰️ ${y0}: ${first.flag} ${first.name} was number one.\n🏁 ${y1}: ${last.flag} ${last.name} ${same ? 'is still on top' : 'leads the ranking'}.\n\nDid your country go up or down? 👇\n\n📊 Source: World Bank open data, ${y0}–${y1}.\n\n${TAGS}`,
    };
  },

  // 🎬 Money Map (world map)
  async map() {
    const t = pickTopic(x => x.map && x.dir === 'desc');
    const big = await bigCountries(1e6);
    const rows = (await latestOf(t)).filter(r => big.has(r.iso3));
    rows.sort((a, b) => b.value - a.value);
    const year = Math.max(...rows.map(r => r.year));
    // color by rank (quantiles), so outliers don't wash out the map
    const values = {}; rows.forEach((r, i) => { values[r.iso3] = 1 - i / (rows.length - 1); });
    const pick = r => ({ flag: r.flag, name: r.name, text: show(r.value, t.fmt) });
    const top = rows.slice(0, 3).map(pick), bottom = rows.slice(-3).reverse().map(pick);
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'calm', title: `World map: ${t.title.toLowerCase()}`, rank: fullRank(rows, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'WORLD MAP · ' + year, title: `${t.hook.replace(/\s*\p{Extended_Pictographic}.*$/u, '')} 🗺️`, sub: 'Find your country 👀', say: `This is the world, colored by ${t.say}.` },
        { type: 'map', title: t.metric, year, values, legend: [show(rows.at(-1).value, t.fmt), show(rows[0].value, t.fmt)], top, bottom, min: 12, say: `The highest is ${rows[0].name}, with ${speak(rows[0].value, t.fmt)}. The lowest is ${rows.at(-1).name}, with ${speak(rows.at(-1).value, t.fmt)}. Look how different the world is.` },
        cta('Find YOUR country on the map 👀'),
      ],
      caption: `The world by ${t.say} 🗺️\n\n⬆️ Highest: ${top.map(x => `${x.flag} ${x.name} (${x.text})`).join(', ')}\n⬇️ Lowest: ${bottom.map(x => `${x.flag} ${x.name} (${x.text})`).join(', ')}\n\nCan you find your country? 👇\n\n${SRC(year, t)}\n\n#maps #worldmap #geography #dataviz #theplanetinnumbers`,
    };
  },

  // 🎬 Shocking stat (gap between extremes)
  async stat() {
    const t = pickTopic(x => !x.raceOnly && !x.id.endsWith('-low') && x.dir === 'desc');
    const { rows, year } = await ranking(t, 10);
    const hi = rows[0], lo = rows.at(-1);
    const ratio = hi.value / lo.value;
    const gap = ratio >= 2 ? `${Math.round(ratio)}×` : show(hi.value - lo.value, t.fmt);
    const gapSay = ratio >= 2 ? `${Math.round(ratio)} times more` : `${speak(hi.value - lo.value, t.fmt)} more`;
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'tense', title: `The ${t.say} gap`, rank: fullRank(rows, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'ONE NUMBER', title: `The world's biggest gap in ${t.say} 🤯`, sub: 'Wait for the final number', say: `This number shows how unequal the world really is.` },
        { type: 'stat', a: { flag: hi.flag, name: hi.name, text: show(hi.value, t.fmt) }, b: { flag: lo.flag, name: lo.name, text: show(lo.value, t.fmt) }, label: `${t.metric} · ${year}`, gap, min: 8, say: `In ${hi.name}, ${t.say} is ${speak(hi.value, t.fmt)}. In ${lo.name}, it's just ${speak(lo.value, t.fmt)}. That's ${gapSay}.` },
        cta('Did you expect THIS gap?'),
      ],
      caption: `The biggest gap in ${t.say} on Earth 🤯\n\n${hi.flag} ${hi.name}: ${show(hi.value, t.fmt)}\n${lo.flag} ${lo.name}: ${show(lo.value, t.fmt)}\n\nThat's ${gap === `${Math.round(ratio)}×` ? `${Math.round(ratio)} times more` : `${gap} more`}. Did you expect it? 👇\n\n${SRC(year, t)}\n\n${TAGS}`,
    };
  },

  // 🎬 Guess the country (quiz)
  async guess() {
    const used = usedOf(series);
    const cs = await countries();
    const iso = forced || pickNext(CAT.quiz.map(id => ({ id })), used).id;
    const c = cs.get(iso);
    const clues = [];
    for (const k of CAT.quizClues) {
      const rows = (await latest(k.code)).filter(r => r.iso3 === iso);
      if (rows[0]) clues.push({ label: k.label, text: show(rows[0].value, k.fmt), say: `${k.label}: ${speak(rows[0].value, k.fmt)}.` });
      if (clues.length === 3) break;
    }
    const region = c.region.replace(/,.*$/, '').replace(' & ', ' and ');
    clues.push({ label: 'Region', text: c.region.replace(/,.*$/, ''), say: `And it's in ${region}.` });
    return {
      kind: 'reel', series, episode: iso, music: 'quiz', title: 'Guess the country',
      scenes: [
        { type: 'hook', kicker: 'QUIZ', title: 'Guess the country 🌍❓', sub: '4 clues. Guess before the answer 👇', say: 'Can you guess this country with just four clues?' },
        { type: 'clues', clues, min: 10, say: clues.map(x => x.say).join(' ') },
        { type: 'countdown', text: 'Comment your guess 👇', min: 4, say: 'Write your answer in the comments. Three, two, one.' },
        { type: 'answer', flag: c.flag, name: c.name, min: 3, say: `It's ${c.name}! Did you get it right?` },
        { ...cta('Follow for a new quiz every week'), say: 'Follow for more quizzes.' },
      ],
      caption: `Guess the country 🌍❓\n\n${clues.map((x, i) => `${i + 1}️⃣ ${x.label}: ${x.text}`).join('\n')}\n\nComment your guess BEFORE the answer 👇 (no cheating!)\n\n📊 Source: World Bank open data.\n\n#quiz #geography #guessthecountry #trivia #theplanetinnumbers`,
    };
  },

  // 🖼️ Country vs country (carousel, 7 slides)
  async versus() {
    const used = usedOf(series);
    const pair = forced ? forced.split('-') : pickNext(CAT.versus.map(p => ({ id: p.join('-'), p })), used).p;
    const cs = await countries();
    const [A, B] = pair.map(i => cs.get(i));
    const metrics = [];
    let sa = 0, sb = 0, year = 0;
    for (const m of CAT.versusMetrics) {
      const rows = await latest(m.code);
      const a = rows.find(r => r.iso3 === A.iso3), b = rows.find(r => r.iso3 === B.iso3);
      if (!a || !b) continue;
      year = Math.max(year, a.year, b.year);
      const max = Math.max(a.value, b.value);
      let win = null;
      if (m.better) win = (m.better === 'high' ? a.value > b.value : a.value < b.value) ? 'a' : 'b';
      if (win === 'a') sa++; if (win === 'b') sb++;
      metrics.push({ label: m.label, a: { text: show(a.value, m.fmt), v: a.value / max }, b: { text: show(b.value, m.fmt), v: b.value / max }, win });
    }
    if (metrics.length < 5) throw new Error('Not enough data for ' + pair.join('-'));
    const winner = sa === sb ? null : (sa > sb ? A : B);
    const slides = [{ type: 'vs-cover', a: { flag: A.flag, name: A.name }, b: { flag: B.flag, name: B.name } }];
    metrics.slice(0, 5).forEach((m, i) => slides.push({ type: 'vs-metric', n: i + 1, a: { flag: A.flag, name: A.name, ...m.a }, b: { flag: B.flag, name: B.name, ...m.b }, label: m.label, win: m.win }));
    slides.push({ type: 'vs-end', a: { flag: A.flag, name: A.name, score: sa }, b: { flag: B.flag, name: B.name, score: sb }, verdict: winner ? `${winner.flag} ${winner.name} wins` : 'It\'s a tie!', note: `Population is not scored. Source: World Bank open data (latest available, ${year}).` });
    return {
      kind: 'carousel', series, episode: pair.join('-'), title: `${A.name} vs ${B.name}`, slides,
      caption: `${A.flag} ${A.name} vs ${B.name} ${B.flag}: who wins in numbers? 🥊\n\n${metrics.map(m => `• ${m.label}: ${m.a.text} vs ${m.b.text}`).join('\n')}\n\nSwipe to see the verdict ➡️ Which country would you pick? 👇\n\n📊 Source: World Bank open data (latest available, ${year}).\n\n#versus #countries #worldrankings #dataviz #theplanetinnumbers`,
    };
  },

  // 🖼️ The week in numbers (carousel, 7 slides) — uses this week's posts
  async week() {
    const log = (state._log || []).filter(x => Date.now() - Date.parse(x.at) < 7 * 864e5 && x.fact).slice(-5);
    const facts = [...log.map(x => x.fact)];
    // fill with fresh #1 facts if the week had fewer than 5 posts
    for (const t of TOPICS) {
      if (facts.length >= 5) break;
      if (facts.some(f => f.topic === t.id)) continue;
      try { const { top, year } = await ranking(t, 10); facts.push({ topic: t.id, flag: top[0].flag, name: top[0].name, text: show(top[0].value, t.fmt), label: t.title, year }); } catch {}
    }
    const today = new Date();
    const slides = [{ type: 'cover', kicker: 'WEEKLY RECAP', title: 'The week in numbers', sub: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), flags: facts.slice(0, 3).map(f => f.flag) }];
    facts.slice(0, 5).forEach((f, i) => slides.push({ type: 'fact', n: i + 1, ...f }));
    slides.push({ type: 'end', title: 'Which number surprised you most?', sub: 'Tell us in the comments and follow for daily rankings', note: 'Source: World Bank open data (latest available).' });
    return {
      kind: 'carousel', series, episode: today.toISOString().slice(0, 10), title: 'The week in numbers', slides,
      caption: `The week in numbers 🌍\n\n${facts.slice(0, 5).map(f => `${f.flag} ${f.label}: ${f.name} (${f.text})`).join('\n')}\n\nWhich one surprised you most? 👇\n\n📊 Source: World Bank open data.\n\n${TAGS}`,
    };
  },
};

if (!builders[series]) { console.error('Unknown series: ' + series + '. Options: ' + Object.keys(builders).join(', ')); process.exit(2); }
const item = await builders[series]();
item.id = `${series}-${item.episode}`.replace(/[^a-zA-Z0-9-]/g, '-');
// one-line fact for the weekly recap
if (item.kind === 'reel') {
  const w = item.scenes.find(s => s.type === 'winner') || item.scenes.find(s => s.type === 'rank')?.rows?.[0];
  if (w) item.fact = { topic: item.topic, flag: w.flag, name: w.name, text: w.text, label: item.title };
}
fs.writeFileSync(outFile, JSON.stringify(item, null, 1));
console.log(`OK ${item.kind} ${item.id}: ${item.title}`);
