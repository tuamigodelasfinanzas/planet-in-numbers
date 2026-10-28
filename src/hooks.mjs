// Script helpers: everyday comparisons and hooks with tension, built only from the real numbers.
// Every line here must be TRUE for the data it gets (no invented "most people get this wrong").

const PEOPLE_SHARE = new Set(['internet', 'internet-low', 'urban', 'rural', 'old', 'young', 'electricity-low', 'obesity', 'obesity-low', 'smoking', 'women-work', 'trust', 'trust-low']);
const PER_DAY_USD = new Set(['gdp-pc', 'gdp-pc-low', 'gdp-ppp', 'rich-1900']);
const FOOD = new Set(['meat', 'fish', 'fruit', 'vegetables', 'eggs']);
const n0 = v => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
const n1 = v => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v);

function money(perDay) {
  if (perDay < 1) return { say: `${Math.round(perDay * 100)} cents a day`, show: `$${perDay.toFixed(2)} a day` };
  if (perDay < 10) return { say: `${n1(perDay)} dollars a day`, show: `$${n1(perDay)} a day` };
  return { say: `${n0(perDay)} dollars a day`, show: `$${n0(perDay)} a day` };
}

// "234 dollars a year" → "64 cents a day"; "136 kg a year" → "2.6 kilos a week" …  null when nothing natural fits
export function everyday(topic, v) {
  const id = topic.id, fmt = topic.fmt;
  if (PER_DAY_USD.has(id)) return money(v / 365);
  if (FOOD.has(id) && fmt === 'kg') { const w = v / 52; return w >= 1 ? { say: `${n1(w)} kilos a week`, show: `${n1(w)} kg a week` } : { say: `${n0(w * 1000)} grams a week`, show: `${n0(w * 1000)} g a week` }; }
  if (fmt === 'lbeer') { const c = v / 0.33 / 52; return { say: `${c < 1 ? 'less than one can' : `${n1(c)} cans`} of beer a week`, show: `${n1(c)} 🍺 a week` }; }
  if (fmt === 'hours') { const w = v / 48; return { say: `about ${n0(w)} hours a week`, show: `~${n0(w)} h a week` }; }
  if (PEOPLE_SHARE.has(id) && fmt === 'pct') {
    const k = Math.round(v / 10);
    if (k >= 1 && k <= 9) return { say: `${k} in 10 people`, show: `${k} in 10 people` };
    if (v < 10) return { say: `fewer than 1 in 10 people`, show: `<1 in 10 people` };
    return { say: `almost everyone`, show: `almost everyone` };
  }
  if (fmt === 'per100' && v >= 100) return { say: `${n1(v / 100)} phones per person`, show: `${n1(v / 100)} 📱 per person` };
  return null;
}

// ratio between two values, as words ("39 times more" / "half")
// scores and indexes can't be multiplied ("6 times happier" is not what a 0-10 score means)
export const NO_RATIO = new Set(['score10', 'score100', 'dec3', 'cm', 'years', 'temp', 'mag', 'pctchg', 'meters']);
export function gapWords(hi, lo, fmt) {
  if (!(hi > 0) || !(lo > 0) || NO_RATIO.has(fmt)) return null;
  const r = hi / lo;
  if (r >= 1.95) return { n: Math.round(r), say: `${Math.round(r)} times`, show: `${Math.round(r)}×` };
  return null;
}

const strip = s => String(s).replace(/[^\p{L}\p{N}\s',.?!-]/gu, '').replace(/\s+/g, ' ').trim();
export const sentence = s => strip(s).replace(/([^.?!])$/, '$1.');

// Top 10 hook: the title + one hard claim about number one
export function top10Claim(t, a, tenth) {
  const e = everyday(t, a.value);
  if (e) return { say: `Number one: ${t.dir === 'asc' ? 'just ' : ''}${e.say}.`, show: `#1 → ${e.show} 😳` };
  const g = t.dir === 'asc' ? gapWords(tenth.value, a.value, t.fmt) : gapWords(a.value, tenth.value, t.fmt);
  if (g) return { say: `Number one is ${g.say} ${t.dir === 'asc' ? 'lower' : 'higher'} than number ten.`, show: `#1 is ${g.show} #10 😳` };
  return { say: 'Guess number one before I say it.', show: 'Guess #1 before the end 👇' };
}
