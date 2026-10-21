// Number formatting for screens and for the voice-over
const nf = (d) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

export function big(v) {
  const a = Math.abs(v);
  if (a >= 1e12) return { n: v / 1e12, s: 'T', w: 'trillion' };
  if (a >= 1e9) return { n: v / 1e9, s: 'B', w: 'billion' };
  if (a >= 1e6) return { n: v / 1e6, s: 'M', w: 'million' };
  if (a >= 1e3) return { n: v / 1e3, s: 'K', w: 'thousand' };
  return { n: v, s: '', w: '' };
}
const dBig = n => (n >= 100 ? 0 : 1);

// Text shown on screen
export function show(v, fmt) {
  switch (fmt) {
    case 'usd': return '$' + nf(v < 100 ? 1 : 0).format(v);
    case 'usd_big': { const b = big(v); return '$' + nf(dBig(b.n)).format(b.n) + b.s; }
    case 'num_big': { const b = big(v); return b.s ? nf(dBig(b.n)).format(b.n) + b.s : nf(0).format(v); }
    case 'pct': return nf(v < 10 ? 1 : 0).format(v) + '%';
    case 'years': return nf(1).format(v) + ' yrs';
    case 'dec1': return nf(1).format(v);
    case 'per100': return nf(0).format(v);
    case 'density': return nf(0).format(v) + '/km²';
    case 'litres': return nf(1).format(v) + ' L';
    case 'lbeer': return nf(0).format(Math.round(v)) + ' L';
    case 'lspirit': return nf(1).format(v) + ' L';
    case 'kg': return nf(0).format(v) + ' kg';
    case 'cm': return nf(1).format(v) + ' cm';
    case 'kcal': return nf(0).format(v) + ' kcal';
    case 'hours': return nf(0).format(v) + ' h';
    case 'score10': return nf(2).format(v) + '/10';
    case 'score100': return nf(0).format(v) + '/100';
    case 'dec3': return nf(3).format(v);
    case 'tonnes': { const b = big(v); return (b.s ? nf(dBig(b.n)).format(b.n) + b.s : nf(0).format(v)) + ' t'; }
    case 'tco2': return nf(1).format(v) + ' t';
    case 'kwh': return nf(0).format(v) + ' kWh';
    case 'mm': return nf(0).format(v) + ' mm';
    case 'usd_day': return '$' + nf(v < 10 ? 2 : 1).format(v) + '/day';
    case 'per100k': return nf(1).format(v);
    default: return nf(1).format(v);
  }
}

// Text spoken by the voice-over (no symbols)
export function speak(v, fmt) {
  switch (fmt) {
    case 'usd': return `${nf(0).format(Math.round(v / (v >= 10000 ? 100 : 1)) * (v >= 10000 ? 100 : 1))} dollars`;
    case 'usd_big': { const b = big(v); return `${nf(1).format(b.n)} ${b.w} dollars`; }
    case 'num_big': { const b = big(v); return b.w ? `${nf(1).format(b.n)} ${b.w}` : nf(0).format(v); }
    case 'pct': return `${nf(v < 10 ? 1 : 0).format(v)} percent`;
    case 'years': return `${nf(0).format(Math.round(v))} years`;
    case 'dec1': return nf(1).format(v);
    case 'per100': return `${nf(0).format(v)} per hundred people`;
    case 'density': return `${nf(0).format(v)} people per square kilometer`;
    case 'litres': return `${nf(1).format(v)} liters of pure alcohol per person`;
    case 'lbeer': return `about ${nf(0).format(Math.round(v))} liters of beer per adult`;
    case 'lspirit': return `about ${nf(1).format(v)} liters of spirits per adult`;
    case 'kg': return `${nf(0).format(v)} kilos per person a year`;
    case 'cm': return `${nf(1).format(v)} centimeters`;
    case 'kcal': return `${nf(0).format(v)} calories a day`;
    case 'hours': return `${nf(0).format(v)} hours a year`;
    case 'score10': return `${nf(1).format(v)} out of ten`;
    case 'score100': return `${nf(0).format(v)} out of a hundred`;
    case 'dec3': return nf(3).format(v);
    case 'tonnes': { const b = big(v); return `${b.w ? nf(1).format(b.n) + ' ' + b.w : nf(0).format(v)} tonnes`; }
    case 'tco2': return `${nf(1).format(v)} tonnes of CO2 per person`;
    case 'kwh': return `${nf(0).format(v)} kilowatt hours per person`;
    case 'mm': return `${nf(0).format(v)} millimeters of rain a year`;
    case 'usd_day': return `${nf(v < 10 ? 2 : 0).format(v)} dollars a day`;
    case 'per100k': return `${nf(1).format(v)} per hundred thousand people`;
    default: return nf(1).format(v);
  }
}

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Deterministic pick: first catalog entry not used recently
export function pickNext(list, usedIds = [], keyOf = x => x.id) {
  const recent = new Set(usedIds.slice(-Math.max(1, Math.floor(list.length * 0.75))));
  return list.find(x => !recent.has(keyOf(x))) || list[0];
}
