// Builds the content of one post (reel or carousel) with real World Bank data.
// Usage: node src/build.mjs <series> <out item.json> [state used.json] [episode id]
import fs from 'node:fs';
import { latest, countries, bigCountries, latestOf, historyOf } from './wb.mjs';
import { show, speak, pickNext } from './fmt.mjs';
import { HANDLE } from './brand.mjs';
import { everyday, gapWords, sentence, top10Claim, NO_RATIO } from './hooks.mjs';

const T_WB = JSON.parse(fs.readFileSync(new URL('../content/topics.json', import.meta.url)));
const T_OWID = JSON.parse(fs.readFileSync(new URL('../content/topics-owid.json', import.meta.url)));
// mix both sources (curious topics first): owid, owid, wb, owid, owid, wb…
const TOPICS = [];
for (let i = 0, j = 0; i < T_OWID.length || j < T_WB.length;) {
  if (i < T_OWID.length) TOPICS.push(T_OWID[i++]);
  if (i < T_OWID.length) TOPICS.push(T_OWID[i++]);
  if (j < T_WB.length) TOPICS.push(T_WB[j++]);
}

const G = JSON.parse(fs.readFileSync(new URL('../content/games.json', import.meta.url)));
const hashStr = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function shuffle(arr, seed) {
  const a = [...arr]; let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// one statistic as Map(iso3 -> value) + label + format (game stat or any topic id)
async function statMap(id) {
  const g = G.stats[id];
  if (g && g.code) {
    const rows = fresh((await latest(g.code)).filter(r => r.value > 0), {});
    return { label: g.label, fmt: g.fmt, map: new Map(rows.map(r => [r.iso3, g.invert100 ? 100 / r.value : r.value])) };
  }
  const t = TOPICS.find(x => x.id === id) || (() => { throw new Error('Unknown stat ' + id); })();
  const rows = fresh(await latestOf(t), t);
  return { label: g?.label || t.metric, fmt: g?.fmt || t.fmt, map: new Map(rows.map(r => [r.iso3, r.value])) };
}
function finishCup(cup, th, scenes, m) {
  const mt = scenes.find(s => s.type === 'cupmatch');
  return {
    kind: 'reel', series: 'cup', episode: `${cup.theme}-${cup.round}-${cup.i}`.replace(/\s/g, ''), music: 'epic',
    title: m ? `${th.title}: ${mt.a.name} vs ${mt.b.name}` : `${th.title}: the champion`,
    cupState: cup, cupMatch: m ? [m.a, m.b] : null, scenes,
    caption: m
      ? `🏆 ${th.title} · ${cup.round}\n\n${mt.a.flag} ${mt.a.name} vs ${mt.b.name} ${mt.b.flag}\n\n${th.question}\nVote in the comments with the flag 👇 (one vote per person)\n\nResults in the next video. Follow so you don't miss it!\n\n📊 Data: World Bank & Our World in Data, latest available.\n\n#worldcupofcountries #countries #vote #geography #theplanetinnumbers`
      : `🏆 ${th.title}: we have a champion!\n\nYou voted, the world decided. What should the next tournament be? 👇\n\n#worldcupofcountries #countries #theplanetinnumbers`,
  };
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

// only compare countries measured in (about) the same years: within `window` years of the newest data
function fresh(rows, topic) {
  if (topic.yearLabel || !rows.length) return rows;
  const maxY = Math.max(...rows.map(r => r.year));
  return rows.filter(r => r.year >= maxY - (topic.window ?? 3));
}

async function ranking(topic, n) {
  const big = topic.minPop === 0 ? null : await bigCountries(1e6);
  let rows = (await latestOf(topic)).filter(r => !big || big.has(r.iso3));
  rows = fresh(rows, topic);
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

const RANK_SAY = "Comment your country, and I'll tell you its rank.";
const cta = (line = 'Where does YOUR country rank?', say = RANK_SAY, sub = "Comment your country 👇 I'll reply with its rank") => ({ type: 'cta', line, sub, say });

const builders = {
  // 🎬 Top 10 ranking (countdown)
  async top10() {
    const t = pickTopic(x => !x.raceOnly);
    const { rows: all, top, year } = await ranking(t, 10);
    const sc = barScale(top, t.dir);
    const rows = top.map((r, i) => rowOut(r, i, t.fmt, sc));
    const [a, b, c] = rows;
    const claim = top10Claim(t, a, rows[9]), e1 = everyday(t, a.value);
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'upbeat', title: t.title, rank: fullRank(all, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'TOP 10 · ' + year, title: t.hook, sub: claim.show, say: `${sentence(t.hook)} ${claim.say}`, tight: true },
        { type: 'rank', title: t.title, metric: `${t.metric} · ${YL(t, year)}`, rows, min: 9, order: 'countdown', parts: [
          { say: 'Top three. Comment your guess for number one!' },
          { say: `Number three: ${c.name}.`, row: 2 },
          { say: `Number two: ${b.name}.`, row: 1 },
          { say: `And number one is… ${a.name}, with ${speak(a.value, t.fmt)}${e1 ? `${t.fmt === 'usd' ? ' a year' : ''}. That's ${e1.say}` : ''}!`, row: 0 },
        ] },
        cta(),
      ],
      caption: `${t.hook}\n\n🥇 ??? → watch until the end 👀\n🥈 ${b.flag} ${b.name}: ${b.text}\n🥉 ${c.flag} ${c.name}: ${c.text}\n\nGuess number one in the comments 👇 Comment your country and we'll tell you its rank.\n\n${SRC(year, t)}\n\n${TAGS}`,
    };
  },

  // 🖼️ Full Top 20 (carousel, 7 slides)
  async top20() {
    const t = pickTopic(x => !x.raceOnly);
    const { rows: all, top, year } = await ranking(t, 20);
    const sc = barScale(top, t.dir);
    const rows = top.map((r, i) => rowOut(r, i, t.fmt, sc));
    // countdown: #20 first, #1 on the last list slide (the cover doesn't spoil the podium)
    const slides = [{ type: 'cover', kicker: 'TOP 20 · COUNTDOWN', title: t.title, sub: `${t.metric} · ${YL(t, year)}`, flags: ['❓', '❓', '❓'] }];
    for (let i = 4; i >= 0; i--) slides.push({ type: 'list', title: t.title, range: `#${i * 4 + 4} → #${i * 4 + 1}`, rows: rows.slice(i * 4, i * 4 + 4).reverse() });
    slides.push({ type: 'end', title: 'Is your country on the list?', sub: 'Save this post and share it with someone who should see it', note: SRC(year, t).replace('📊 ', '') });
    return {
      kind: 'carousel', series, episode: t.id, topic: t.id, title: t.title, slides, rank: fullRank(all, t.fmt), metricName: t.say,
      caption: `${t.title}: the full Top 20 🌍\n\nCounting down from 20 to number one. Swipe to the end ➡️ Is your country on the list? Comment it and we'll tell you its rank 👇\n\n💾 Save it for later.\n\n${SRC(year, t)}\n\n${TAGS}`,
    };
  },

  // 🎬 How far $100 goes (price level ratio PPP / market)
  async dollar100() {
    const ep = forced ? CAT.dollarRegions.find(r => r.id === forced) : pickNext(CAT.dollarRegions, usedOf(series));
    const big = await bigCountries(1e6);
    let rows = fresh((await latest('PA.NUS.PPPC.RF')).filter(r => big.has(r.iso3) && r.value > 0), {});
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
        { type: 'hook', kicker: '$100 = ?', title: `${ep.title} 💵`, sub: `Somewhere, $100 feels like $${Math.round(a.value)} 😳`, say: `${ep.dir === 'asc' ? `In one of these countries, one hundred dollars feels like just ${Math.round(a.value)}.` : `In one of these countries, one hundred dollars feels like ${Math.round(a.value)}.`} Guess where.`, tight: true },
        { type: 'rank', title: ep.title, metric: `Value of $100 in local prices · ${year}`, rows: out, min: 9, order: 'countdown', parts: [
          { say: 'Top three. Comment where you think it is!' },
          { say: `Number three: ${out[2].name}.`, row: 2 },
          { say: `Number two: ${b.name}, where it feels like ${Math.round(b.value)}.`, row: 1 },
          { say: `And number one is… ${a.name}: there, one hundred dollars feels like ${Math.round(a.value)}!`, row: 0 },
        ] },
        cta('Where would YOU take your $100?', "Where would you take your hundred dollars? Comment your country, and I'll tell you what it's worth there.", 'Comment your country 👇 I\'ll reply with its value'),
      ],
      caption: `${ep.title} 💵\n\nWith local prices, $100 feels like:\n🥇 ??? → ${a.text} (watch until the end 👀)\n🥈 ${b.flag} ${b.name}: ${b.text}\n\n(Based on the World Bank price level ratio: PPP conversion factor vs. market exchange rate.)\n\nWhere would you spend your $100? 👇\n\n${SRC(year)}\n\n#travel #money #costofliving #worldrankings #theplanetinnumbers`,
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
    const rankNow = [...bars].filter(b => b.values[y1] != null).sort((a, b) => b.values[y1] - a.values[y1]).findIndex(b => b.iso3 === first.iso3) + 1;
    const raceHook = same ? `${first.name} has been number one since ${y0}. Can anyone catch it?`
      : rankNow === 0 || rankNow > 10 ? `In ${y0}, ${first.name} was number one. Today it's not even in the top ten.`
      : `In ${y0}, ${first.name} was number one. Watch who takes its place.`;
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'epic', title: `${t.title}: ${y0} vs ${y1}`,
      scenes: [
        { type: 'hook', kicker: `${y0} → ${y1}`, title: t.raceOnly ? t.hook : `${t.title}: then vs now`, sub: 'Watch who takes the lead 🏁', say: raceHook, tight: true },
        { type: 'race', title: t.title, metric: t.metric, fmt: t.fmt, years, bars, min: Math.min(21, Math.max(16, years.length * 0.17)), say: `In ${y0}, number one was ${first.name}. ${same ? `Decades later, ${last.name} is still on top.` : `But everything changed. By ${y1}, ${last.name} took the lead.`}` },
        cta('Did YOUR country go up or down?', 'Did your country go up, or down? Comment it!', 'Comment your country 👇'),
      ],
      caption: `${t.title}: ${y0} vs ${y1} 📈\n\n🕰️ ${y0}: ${first.flag} ${first.name} was number one.\n🏁 ${y1}: ${last.flag} ${last.name} ${same ? 'is still on top' : 'leads the ranking'}.\n\nDid your country go up or down? 👇\n\n📊 Source: World Bank open data, ${y0}–${y1}.\n\n${TAGS}`,
    };
  },

  // 🎬 Money Map (world map)
  async map() {
    const t = pickTopic(x => x.map && x.dir === 'desc');
    const big = await bigCountries(1e6);
    const rows = fresh((await latestOf(t)).filter(r => big.has(r.iso3)), t);
    rows.sort((a, b) => b.value - a.value);
    const year = Math.max(...rows.map(r => r.year));
    // color by rank (quantiles), so outliers don't wash out the map
    const values = {}; rows.forEach((r, i) => { values[r.iso3] = 1 - i / (rows.length - 1); });
    const pick = r => ({ flag: r.flag, name: r.name, text: show(r.value, t.fmt) });
    const top = rows.slice(0, 3).map(pick), bottom = rows.slice(-3).reverse().map(pick);
    const mapGap = gapWords(rows[0].value, rows.at(-1).value, t.fmt), mapEH = everyday(t, rows[0].value), mapEL = everyday(t, rows.at(-1).value);
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'calm', title: `World map: ${t.title.toLowerCase()}`, rank: fullRank(rows, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'WORLD MAP · ' + year, title: `${t.hook.replace(/\s*\p{Extended_Pictographic}.*$/u, '')} 🗺️`, sub: mapEH && mapEL ? `${mapEH.show} vs ${mapEL.show} 😳` : mapGap ? `One country: ${mapGap.show} another 😳` : 'Find your country 👀', say: mapEH && mapEL ? `${t.say[0].toUpperCase() + t.say.slice(1)}: ${mapEH.say} in one country, ${mapEL.say} in another. Find yours.` : mapGap ? `One country has ${mapGap.say} more ${t.say} than another. Find yours.` : `${sentence(t.hook)} Find your country.`, tight: true },
        { type: 'map', title: t.metric, year, values, legend: [show(rows.at(-1).value, t.fmt), show(rows[0].value, t.fmt)], top, bottom, min: 12, say: `The highest is ${rows[0].name}, with ${speak(rows[0].value, t.fmt)}. The lowest is ${rows.at(-1).name}, with ${speak(rows.at(-1).value, t.fmt)}. Pause, and find your country.` },
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
    const ratio = NO_RATIO.has(t.fmt) ? 1 : hi.value / lo.value;
    const gap = ratio >= 2 ? `${Math.round(ratio)}×` : show(hi.value - lo.value, t.fmt);
    const eHi = everyday(t, hi.value), eLo = everyday(t, lo.value);
    const gapSay = ratio >= 2 ? `${Math.round(ratio)} times more` : `${speak(hi.value - lo.value, t.fmt)} more`;
    return {
      kind: 'reel', series, episode: t.id, topic: t.id, music: 'tense', title: `The ${t.say} gap`, rank: fullRank(rows, t.fmt), metricName: t.say,
      scenes: [
        { type: 'hook', kicker: 'ONE NUMBER', title: ratio >= 2 ? `${Math.round(ratio)}× more ${t.say}. Same planet. 🤯` : `The world's biggest gap in ${t.say} 🤯`, sub: 'Guess the two countries 👇', say: ratio >= 2 ? `${Math.round(ratio)} times more ${t.say}. Same planet.` : `The biggest gap in ${t.say} on Earth. Guess the two countries.`, tight: true },
        { type: 'stat', a: { flag: hi.flag, name: hi.name, text: show(hi.value, t.fmt) }, b: { flag: lo.flag, name: lo.name, text: show(lo.value, t.fmt) }, label: `${t.metric} · ${year}`, gap, min: 8, say: `In ${hi.name}, ${t.say} is ${speak(hi.value, t.fmt)}${eHi ? `, that's ${eHi.say}` : ''}. In ${lo.name}, it's just ${speak(lo.value, t.fmt)}${eLo ? `, ${eLo.say}` : ''}. That's ${gapSay}.` },
        cta('Where is YOUR country?', RANK_SAY),
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
    clues.reverse(); // hardest first: the easy clue (population) comes last, so people stay until the end
    const region = c.region.replace(/,.*$/, '').replace(' & ', ' and ');
    clues.push({ label: 'Region', text: c.region.replace(/,.*$/, ''), say: `And it's in ${region}.` });
    return {
      kind: 'reel', series, episode: iso, music: 'quiz', title: 'Guess the country',
      scenes: [
        { type: 'hook', kicker: 'QUIZ', title: 'Guess the country 🌍❓', sub: 'Each clue is easier. How many do you need? 👇', say: 'Four clues, each one easier. How many do you need?', tight: true },
        { type: 'clues', clues, min: 10, say: clues.map(x => x.say).join(' ') },
        { type: 'countdown', text: 'Comment your guess 👇', min: 4, say: 'Write your answer in the comments. Three, two, one.' },
        { type: 'answer', flag: c.flag, name: c.name, min: 3, say: `It's ${c.name}! Did you get it right?` },
        cta('How many clues did YOU need?', 'How many clues did you need? Comment it!', 'Comment 1, 2, 3 or 4 👇'),
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

  // 🎰 Stop the video: cards flash by; wherever you pause is "your" country (real stats on every card)
  async stop() {
    const th = forced ? G.stop.find(x => x.id === forced) : pickNext(G.stop, usedOf(series));
    const stats = [];
    for (const id of th.stats) stats.push({ id, ...(await statMap(id)) });
    const cs = await countries(), big = await bigCountries(3e6);
    let pool = [...big].filter(iso => cs.get(iso)?.flag && !cs.get(iso).flag.startsWith('🏳') && stats.every(st => st.map.has(iso)));
    // a fair mix: shuffle with a daily seed, 44 cards (~10 s), never two neighbours from the same region
    const seed = hashStr(th.id + new Date().toISOString().slice(0, 10));
    pool = shuffle(pool, seed).slice(0, 44);
    const cards = pool.map(iso => ({ iso3: iso, flag: cs.get(iso).flag, name: cs.get(iso).name, stats: stats.map(st => ({ label: st.label, text: show(st.map.get(iso), st.fmt) })) }));
    return {
      kind: 'reel', series, episode: th.id, music: 'quiz', title: th.title, cards: cards.map(c => [c.iso3, c.stats.map(x => x.text).join(' · ')]),
      scenes: [
        { type: 'hook', kicker: 'STOP THE VIDEO', title: th.hook, sub: 'Pause anytime. No cheating 👀', say: th.say, min: 2.2, tight: true },
        { type: 'spin', title: th.title, cards, min: 10.3 },
        { ...cta(th.cta.replace(' 👇', '') + ' Comment YOUR country'), line: th.cta.replace(' 👇', ''), sub: 'Comment the country you landed on 👇', say: 'Where did you land? Comment it, and try again!' },
      ],
      caption: `${th.hook}\n\nPause the video and that's your country 🛑\n${stats.map(st => `• ${st.label}`).join('\n')} — real data on every card.\n\nComment where you landed 👇 (and how many tries it took 😅)\n\n📊 Data: World Bank & Our World in Data, latest available.\n\n#stopthevideo #geography #countries #game #theplanetinnumbers`,
    };
  },

  // ⬆️⬇️ Higher or Lower: 5 rounds, each harder than the last
  async hl() {
    const cs = await countries();
    const known = CAT.quiz.filter(i => cs.has(i));
    const seed = hashStr('hl' + new Date().toISOString().slice(0, 10) + (forced || ''));
    const qs = shuffle(G.hl, seed);
    const bands = [[1.6, 3], [1.3, 1.8], [1.18, 1.4], [1.08, 1.22], [1.03, 1.12]];
    const rounds = [], usedC = new Set();
    let qi = 0;
    for (const [i, [lo, hi]] of bands.entries()) {
      let found = null;
      for (let tries = 0; tries < qs.length && !found; tries++, qi++) {
        const q = qs[qi % qs.length]; if (rounds.some(r => r.stat === q.stat)) continue;
        const st = await statMap(q.stat);
        const cands = shuffle(known.filter(iso => st.map.has(iso) && !usedC.has(iso)), seed + i * 97 + tries);
        outer: for (const a of cands) for (const b of cands) {
          if (a === b) continue;
          const va = st.map.get(a), vb = st.map.get(b), r = Math.max(va, vb) / Math.min(va, vb);
          if (r >= lo && r <= hi) { found = { q, st, a, b, va, vb }; break outer; }
        }
      }
      if (!found) continue;
      const { q, st, a, b, va, vb } = found;
      usedC.add(a); usedC.add(b);
      const low = q.stat === 'corruption' ? false : false;   // "less corrupt" = higher score: same rule
      const win = va > vb ? 'a' : 'b';
      const C2 = iso => ({ flag: cs.get(iso).flag, name: cs.get(iso).name });
      rounds.push({ stat: q.stat, n: rounds.length + 1, q: q.q, a: { ...C2(a), text: show(va, st.fmt) }, b: { ...C2(b), text: show(vb, st.fmt) }, win,
        parts: [{ say: `${rounds.length === 0 ? 'Round one. ' : ''}${q.say}?` }, { say: (() => {
          const [w, wv, l, lv] = win === 'a' ? [a, va, b, vb] : [b, vb, a, va], r = wv / lv;
          // winner with its unit, loser just the number ("Norway: 40 years, against 21")
          const num = v => { const w = speak(v, st.fmt).replace(/^about /, '').split(' '); return /^(thousand|million|billion|trillion)$/.test(w[1]) ? w.slice(0, 2).join(' ') : w[0]; };
          return `${r < 1.12 ? 'So close! ' : r >= 1.6 ? 'Easy one. ' : ''}${cs.get(w).name}: ${speak(wv, st.fmt)}, against ${num(lv)}.`;
        })(), reveal: true }] });
      void low;
    }
    if (rounds.length < 5) throw new Error('Not enough Higher or Lower rounds');
    const N = rounds.length;
    return {
      kind: 'reel', series, episode: new Date().toISOString().slice(0, 10), music: 'quiz', title: 'Higher or Lower: countries', rounds: rounds.map(r => ({ q: r.q, a: r.a.name, b: r.b.name, win: r.win })),
      scenes: [
        { type: 'hook', kicker: `HIGHER OR LOWER · ${N} ROUNDS`, title: 'Higher or lower? Country edition ⬆️⬇️', sub: `Keep score. Comment your result /${N}`, say: `${N} rounds. Each one harder. Keep score!`, min: 2.2, tight: true },
        ...rounds.map(r => ({ type: 'hl', ...r, total: N })),
        { ...cta(`What was YOUR score?`), sub: `Comment your result out of ${N} 👇`, say: `What was your score out of ${N}? Comment it!` },
      ],
      caption: `Higher or lower? Country edition ⬆️⬇️\n\n${N} rounds, each one harder. How many did you get right?\n\nComment your score /${N} 👇\n\n📊 Data: World Bank & Our World in Data, latest available.\n\n#higherorlower #quiz #geography #countries #theplanetinnumbers`,
    };
  },

  // 🏆 World Cup of countries: one match per video, the audience votes in the comments (not in the calendar yet)
  // Flow per video: 1) close the previous match (votes counted by tools/cup-votes.mjs → state.cupVotes;
  // tie or no votes → the data decides)  2) show its result  3) next match, or the champion.
  async cup() {
    const cs = await countries();
    let cup = state.cup && !state.cup.done ? structuredClone(state.cup) : null;
    if (!cup) {
      const th0 = forced ? G.cup.find(x => x.id === forced) : pickNext(G.cup, usedOf(series));
      const c = th0.countries;
      cup = { theme: th0.id, round: 'QUARTER-FINAL', matches: [[c[0], c[7]], [c[3], c[4]], [c[1], c[6]], [c[2], c[5]]].map(([x, y]) => ({ a: x, b: y })), i: 0, pending: null, history: [] };
    }
    const th = G.cup.find(x => x.id === cup.theme);
    const stats = []; for (const id of th.stats) stats.push({ id, ...(await statMap(id)) });
    const C2 = iso => ({ iso3: iso, flag: cs.get(iso).flag, name: cs.get(iso).name });
    const scenes = [];

    // 1-2) close the pending match and show its result
    if (cup.pending != null) {
      const m = cup.matches[cup.pending];
      const v = state.cupVotes || {}, va = v[m.a] || 0, vb = v[m.b] || 0;
      let w = va === vb ? null : (va > vb ? m.a : m.b), how = 'votes';
      if (!w) {
        const sc = iso => stats.reduce((t, st) => t + (st.map.get(iso) || 0) / (Math.max(st.map.get(m.a) || 0, st.map.get(m.b) || 0) || 1), 0);
        w = sc(m.a) >= sc(m.b) ? m.a : m.b; how = 'data';
      }
      Object.assign(m, { winner: w, votes: [va, vb], how, round: cup.round });
      cup.pending = null;
      const tot = va + vb, pct = tot ? Math.round((w === m.a ? va : vb) / tot * 100) : null;
      scenes.push({ type: 'cupresult', round: cup.round, a: { ...C2(m.a), v: va }, b: { ...C2(m.b), v: vb }, winner: w, how, pct, min: 4.5,
        say: `Last match. ${cs.get(w).name} wins${how === 'votes' ? `, with ${pct} percent of your votes` : '. No clear vote, so the data decided'}!` });
    }
    // 3) next round when this one is complete
    if (cup.i >= cup.matches.length && cup.matches.every(m => m.winner)) {
      cup.history.push(...cup.matches);
      const ws = cup.matches.map(m => m.winner);
      if (ws.length === 1) {
        cup.done = true;
        const champ = C2(ws[0]);
        scenes.push({ type: 'cupchampion', title: th.title, ...champ, min: 5, say: `And the champion is… ${champ.name}! You decided.` });
        scenes.unshift({ type: 'hook', kicker: `🏆 ${th.title.toUpperCase()}`, title: 'And the champion is…', sub: 'You voted. The world decided.', say: `${th.title}. The final result is in!`, min: 3 });
        scenes.push({ ...cta('Which tournament next?'), sub: 'Tell us in the comments 👇', say: 'What should the next tournament be? Tell us in the comments!' });
        return finishCup(cup, th, scenes, null);
      }
      cup.round = ws.length === 4 ? 'SEMI-FINAL' : 'FINAL';
      cup.matches = []; for (let k = 0; k < ws.length; k += 2) cup.matches.push({ a: ws[k], b: ws[k + 1] });
      cup.i = 0;
    }
    const m = cup.matches[cup.i];
    const rows = stats.map(st => { const va = st.map.get(m.a), vb = st.map.get(m.b); return { label: st.label, a: va == null ? '–' : show(va, st.fmt), b: vb == null ? '–' : show(vb, st.fmt) }; });
    const rn = cup.round === 'FINAL' ? 'The final' : cup.round === 'SEMI-FINAL' ? 'Semi final' : 'Quarter final';
    scenes.unshift({ type: 'hook', kicker: `🏆 ${th.title.toUpperCase()}`, title: `${C2(m.a).name} vs ${C2(m.b).name}`, sub: `${cup.round}${cup.matches.length > 1 ? ` · MATCH ${cup.i + 1}/${cup.matches.length}` : ''} · YOU decide`, say: `${th.title}. ${rn}: ${cs.get(m.a).name} versus ${cs.get(m.b).name}. You decide!`, min: 3.6 });
    scenes.push({ type: 'cupmatch', round: cup.round, question: th.question, a: C2(m.a), b: C2(m.b), rows, min: 8, say: `${th.question} Vote in the comments with the flag.` });
    scenes.push({ ...cta('Vote in the comments!'), sub: `${C2(m.a).flag} or ${C2(m.b).flag}? Results in the next video`, say: 'Results in the next video. Follow so you don\'t miss it!' });
    cup.pending = cup.i;
    cup.i++;
    return finishCup(cup, th, scenes, m);
  },
};

if (!builders[series]) { console.error('Unknown series: ' + series + '. Options: ' + Object.keys(builders).join(', ')); process.exit(2); }
let item;
try { item = await builders[series](); }
catch (e) { console.log(`::error::Build ${series} failed: ${String(e.stack || e).split('\n').slice(0, 3).join(' | ')}`); process.exit(1); }
item.id = `${series}-${item.episode}`.replace(/[^a-zA-Z0-9-]/g, '-');
// one-line fact for the weekly recap
if (item.kind === 'reel') {
  const w = item.scenes.find(s => s.type === 'winner') || item.scenes.find(s => s.type === 'rank')?.rows?.[0];
  if (w) item.fact = { topic: item.topic, flag: w.flag, name: w.name, text: w.text, label: item.title };
}
fs.writeFileSync(outFile, JSON.stringify(item, null, 1));
console.log(`OK ${item.kind} ${item.id}: ${item.title}`);
