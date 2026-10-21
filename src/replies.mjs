// Builds the reply to a comment, using the data of the post it was written on.
// Pure functions (no network) so they can be tested: detectCountries(), replyFor().

const ALIASES = {
  usa: 'USA', 'u.s.': 'USA', 'u.s.a': 'USA', 'united states': 'USA', murica: 'USA', 'estados unidos': 'USA', eeuu: 'USA',
  uk: 'GBR', 'u.k.': 'GBR', britain: 'GBR', 'great britain': 'GBR', england: 'GBR', scotland: 'GBR', wales: 'GBR', 'united kingdom': 'GBR', 'reino unido': 'GBR', inglaterra: 'GBR',
  holland: 'NLD', netherlands: 'NLD', nederland: 'NLD', 'países bajos': 'NLD', 'paises bajos': 'NLD', holanda: 'NLD',
  'czech republic': 'CZE', czechia: 'CZE', 'south korea': 'KOR', korea: 'KOR', 'north korea': 'PRK', russia: 'RUS', rusia: 'RUS',
  turkey: 'TUR', turkiye: 'TUR', türkiye: 'TUR', turquía: 'TUR', 'ivory coast': 'CIV', "cote d'ivoire": 'CIV', 'dr congo': 'COD', drc: 'COD',
  uae: 'ARE', emirates: 'ARE', dubai: 'ARE', 'saudi arabia': 'SAU', saudi: 'SAU', vietnam: 'VNM', 'viet nam': 'VNM', iran: 'IRN', syria: 'SYR', laos: 'LAO',
  españa: 'ESP', espana: 'ESP', spain: 'ESP', méxico: 'MEX', mexico: 'MEX', brasil: 'BRA', brazil: 'BRA', deutschland: 'DEU', germany: 'DEU', alemania: 'DEU',
  italia: 'ITA', italy: 'ITA', francia: 'FRA', france: 'FRA', polska: 'POL', poland: 'POL', japón: 'JPN', japon: 'JPN', japan: 'JPN', china: 'CHN', india: 'IND',
  perú: 'PER', peru: 'PER', colombia: 'COL', chile: 'CHL', argentina: 'ARG', venezuela: 'VEN', ecuador: 'ECU', bolivia: 'BOL', uruguay: 'URY', paraguay: 'PRY',
  'costa rica': 'CRI', panamá: 'PAN', panama: 'PAN', cuba: 'CUB', 'república dominicana': 'DOM', 'dominican republic': 'DOM', 'puerto rico': 'PRI', guatemala: 'GTM', honduras: 'HND',
  'el salvador': 'SLV', nicaragua: 'NIC', portugal: 'PRT', suiza: 'CHE', switzerland: 'CHE', suecia: 'SWE', sweden: 'SWE', noruega: 'NOR', norway: 'NOR', dinamarca: 'DNK', denmark: 'DNK',
  finlandia: 'FIN', finland: 'FIN', irlanda: 'IRL', ireland: 'IRL', grecia: 'GRC', greece: 'GRC', ucrania: 'UKR', ukraine: 'UKR', egipto: 'EGY', egypt: 'EGY', marruecos: 'MAR', morocco: 'MAR',
  nigeria: 'NGA', kenya: 'KEN', ghana: 'GHA', 'south africa': 'ZAF', sudáfrica: 'ZAF', australia: 'AUS', 'new zealand': 'NZL', canada: 'CAN', canadá: 'CAN', pakistan: 'PAK', bangladesh: 'BGD',
  indonesia: 'IDN', philippines: 'PHL', filipinas: 'PHL', thailand: 'THA', tailandia: 'THA', malaysia: 'MYS', singapore: 'SGP', singapur: 'SGP', israel: 'ISR', austria: 'AUT', belgium: 'BEL', bélgica: 'BEL',
  hungary: 'HUN', hungría: 'HUN', romania: 'ROU', rumanía: 'ROU', bulgaria: 'BGR', croatia: 'HRV', croacia: 'HRV', serbia: 'SRB', albania: 'ALB', georgia: 'GEO', armenia: 'ARM', kazakhstan: 'KAZ',
  latvia: 'LVA', estonia: 'EST', lithuania: 'LTU', slovakia: 'SVK', slovenia: 'SVN', iceland: 'ISL', luxembourg: 'LUX', qatar: 'QAT', kuwait: 'KWT', algeria: 'DZA', argelia: 'DZA', tunisia: 'TUN',
  ethiopia: 'ETH', nepal: 'NPL', 'sri lanka': 'LKA', mongolia: 'MNG', 'hong kong': 'HKG', taiwan: 'TWN',
};
// people say "I'm Spanish", "as a Mexican…"
const DEMONYMS = {
  american: 'USA', british: 'GBR', english: 'GBR', scottish: 'GBR', spanish: 'ESP', español: 'ESP', española: 'ESP', mexican: 'MEX', mexicano: 'MEX', mexicana: 'MEX',
  brazilian: 'BRA', brasileiro: 'BRA', german: 'DEU', french: 'FRA', italian: 'ITA', italiano: 'ITA', dutch: 'NLD', polish: 'POL', swedish: 'SWE', norwegian: 'NOR', danish: 'DNK',
  finnish: 'FIN', irish: 'IRL', portuguese: 'PRT', greek: 'GRC', turkish: 'TUR', russian: 'RUS', ukrainian: 'UKR', argentinian: 'ARG', argentine: 'ARG', argentino: 'ARG', argentina: 'ARG',
  colombian: 'COL', colombiano: 'COL', colombiana: 'COL', chilean: 'CHL', chileno: 'CHL', chilena: 'CHL', peruvian: 'PER', peruano: 'PER', peruana: 'PER', venezolano: 'VEN', venezolana: 'VEN',
  filipino: 'PHL', indonesian: 'IDN', nigerian: 'NGA', egyptian: 'EGY', moroccan: 'MAR', pakistani: 'PAK', kenyan: 'KEN', indian: 'IND', chinese: 'CHN', japanese: 'JPN', korean: 'KOR',
  canadian: 'CAN', australian: 'AUS', swiss: 'CHE', austrian: 'AUT', belgian: 'BEL', czech: 'CZE', hungarian: 'HUN', romanian: 'ROU', vietnamese: 'VNM', thai: 'THA', israeli: 'ISR',
  cubano: 'CUB', cubana: 'CUB', ecuatoriano: 'ECU', ecuatoriana: 'ECU', uruguayo: 'URY', uruguaya: 'URY', dominicano: 'DOM', dominicana: 'DOM', boricua: 'PRI', guatemalteco: 'GTM',
};
const norm = s => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s'.]/gu, ' ').replace(/\s+/g, ' ').trim();

// Countries mentioned in a comment, in order of appearance (flags, names, aliases, demonyms)
export function detectCountries(text, countries) {
  const found = [];
  const add = (iso, at) => { if (iso && countries.has(iso) && !found.some(f => f.iso === iso)) found.push({ iso, at }); };
  // flag emojis
  const re = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/gu; let m;
  while ((m = re.exec(text))) {
    const iso2 = String.fromCharCode(m[1].codePointAt(0) - 0x1f1a5, m[2].codePointAt(0) - 0x1f1a5);
    for (const c of countries.values()) if (c.iso2 === iso2) add(c.iso3, m.index);
  }
  const t = ' ' + norm(text) + ' ';
  const names = new Map(Object.entries(ALIASES));
  for (const c of countries.values()) names.set(c.name.toLowerCase(), c.iso3);
  for (const [k, iso] of Object.entries(DEMONYMS)) names.set(k, iso);
  for (const [name, iso] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    const i = t.indexOf(' ' + name + ' ');
    if (i >= 0) add(iso, i);
  }
  return found.sort((a, b) => a.at - b.at).map(f => f.iso);
}

const SPANISH = /\b(que|mi|país|pais|españa|donde|dónde|por|para|los|las|está|esta|muy|también|tambien|nosotros|jaja|vamos)\b|[ñáéíóú¿¡]/i;
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (arr, seed) => arr[hash(seed) % arr.length];
const sourceOf = item => (item?.caption?.match(/Source: ([^\n]+?)(\. Countries|\.$|\n|$)/) || [])[1] || '';
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// reply text, or null when it's better not to answer (spam, links, own comments, nothing to add)
export function replyFor({ text, username, id }, item, countries) {
  if (!text || /https?:\/\/|www\.|follow me|check my|dm me|promo/i.test(text)) return null;
  const es = SPANISH.test(text);
  const u = '@' + username;
  const isos = detectCountries(text, countries);
  const C = iso => { const c = countries.get(iso); return `${c.flag} ${c.name}`; };

  // quiz: is the guess right?
  if (item?.series === 'guess') {
    const ans = item.episode;
    if (!isos.length) return null;
    if (isos.includes(ans)) return pick(es
      ? [`🎯 ¡Correcto, ${u}! Es ${C(ans)}. ¡Se te da genial!`, `${u} ¡Bingo! 🙌 ${C(ans)} era la respuesta.`, `¡Acertaste, ${u}! 🔥 Era ${C(ans)}.`]
      : [`🎯 Correct, ${u}! It's ${C(ans)}. You're good at this!`, `${u} Nailed it! 🙌 ${C(ans)} was the answer.`, `Spot on, ${u}! 🔥 It's ${C(ans)}.`, `${u} You got it! ✅ ${C(ans)}. Ready for the next one?`], id);
    return pick(es
      ? [`¡Casi, ${u}! 👀 Era ${C(ans)}. ¡El próximo quiz es tuyo!`, `Buen intento, ${u} 😄 La respuesta era ${C(ans)}.`]
      : [`So close, ${u}! 👀 It was ${C(ans)}. Next quiz is yours!`, `Good guess, ${u} 😄 The answer was ${C(ans)}.`, `Not this time, ${u}! It was ${C(ans)} 🌍`], id);
  }

  // 🎰 Stop the video: they say where they landed → give that card's stats
  if (item?.series === 'stop') {
    const card = isos.map(i => (item.cards || []).find(c => c[0] === i)).find(Boolean);
    if (card) return pick(es
      ? [`${u} ¡Te tocó ${C(card[0])}! 📊 ${card[1]}. ¿Te quedas o vuelves a intentarlo? 🎰`, `${u} ${C(card[0])} 👀 ${card[1]}. ¡Nada mal!`]
      : [`${u} You landed on ${C(card[0])}! 📊 ${card[1]}. Staying or trying again? 🎰`, `${u} ${C(card[0])} 👀 ${card[1]}. Not bad at all!`, `${u} ${C(card[0])} it is! ${card[1]} 🌍`], id);
    if (isos.length) return pick(es ? [`${u} ¡Ese no estaba en las cartas! 😅 Vuelve a probar 🎰`] : [`${u} That one wasn't in the deck this time 😅 Try again! 🎰`], id);
  }

  // ⬆️⬇️ Higher or Lower: they post a score "4/6"
  if (item?.series === 'hl') {
    const m = text.match(/\b([0-6])\s*(?:\/|of|de|out of)\s*6\b/i);
    if (m) {
      const n = Number(m[1]);
      if (n === 6) return pick(es ? [`${u} ¡6/6! 🏆 Perfecto. Eres un genio de los datos.`, `🔥 ${u} ¡Pleno! 6 de 6.`] : [`${u} 6/6! 🏆 Perfect score. Data genius.`, `🔥 ${u} A perfect 6/6! Respect.`], id);
      if (n >= 4) return pick(es ? [`${u} ¡${n}/6! 👏 Muy bien. ¿A por el 6 la próxima?`] : [`${u} ${n}/6! 👏 Great score. Going for 6 next time?`, `${u} Solid ${n}/6 💪`], id);
      return pick(es ? [`${u} ${n}/6 😅 ¡Estaban difíciles! La próxima ronda es tuya.`] : [`${u} ${n}/6 😅 Those were tricky! Next round is yours.`, `${u} ${n}/6, the data is sneaky 😄 Try the next one!`], id);
    }
  }

  // 🏆 World Cup: acknowledge the vote
  if (item?.series === 'cup' && item.cupMatch) {
    const v = isos.find(i => item.cupMatch.includes(i));
    if (v) return pick(es ? [`${u} ¡Voto para ${C(v)} registrado! 🗳️ Resultado en el próximo vídeo.`] : [`${u} Vote for ${C(v)} counted! 🗳️ Results in the next video.`, `${u} ${C(v)} gets your vote 🗳️ Stay tuned!`], id);
  }

  // rankings: tell them where their country stands
  if (item?.rank && isos.length) {
    const iso = isos[0], row = item.rank.find(r => r[0] === iso), total = item.rank.length;
    if (!row) return pick(es
      ? [`${u} No hay datos recientes de ${C(iso)} para este ranking 🙈`, `${u} ${C(iso)} no aparece por falta de datos recientes, ¡perdón! 🙈`]
      : [`${u} There's no recent data for ${C(iso)} on this one 🙈`, `${u} ${C(iso)} isn't in the data for this ranking, sorry! 🙈`], id);
    const [, r, val] = row;
    if (r <= 3) return pick(es
      ? [`${u} ¡${C(iso)} está en el podio! 🥇 Puesto ${r} con ${val}.`, `🔥 ${u} ${C(iso)} es ${r}º de ${total} (${val}). ¡Top 3!`]
      : [`${u} ${C(iso)} is on the podium! 🏆 ${ord(r)} with ${val}.`, `🔥 ${u} ${C(iso)} ranks ${ord(r)} of ${total} (${val}). Top 3!`], id);
    if (r <= 10) return pick(es
      ? [`${u} ${C(iso)} está en el top 10: puesto ${r} con ${val} 👏`, `👀 ${u} ${C(iso)} es ${r}º de ${total} (${val}).`]
      : [`${u} ${C(iso)} made the top 10: ${ord(r)} with ${val} 👏`, `👀 ${u} ${C(iso)} is ${ord(r)} out of ${total} (${val}).`], id);
    return pick(es
      ? [`${u} ${C(iso)} es ${r}º de ${total} en este ranking, con ${val} 📊`, `${u} ${C(iso)} queda en el puesto ${r} de ${total} (${val}). ¿Te lo esperabas? 👀`]
      : [`${u} ${C(iso)} ranks ${ord(r)} out of ${total} here, with ${val} 📊`, `${u} ${C(iso)} comes ${ord(r)} of ${total} (${val}). Did you expect that? 👀`, `${u} Not in the top 10 this time: ${C(iso)} is ${ord(r)} of ${total} (${val}) 📊`], id);
  }

  // doubts about the data → give the source
  if (/\b(wrong|fake|source|false|lie|lies|incorrect|mentira|falso|fuente|incorrecto)\b/i.test(text) && sourceOf(item)) return pick(es
    ? [`${u} ¡Gracias por el comentario! Fuente: ${sourceOf(item)}. Si tienes datos más recientes, cuéntanos 🙏`]
    : [`${u} Thanks for checking! Source: ${sourceOf(item)}. If you have newer data, let us know 🙏`, `${u} Fair question! The data comes from ${sourceOf(item)} 📊`], id);

  // short positive comments
  if (text.trim().length <= 40 && /(wow|cool|nice|great|love|amazing|interesting|insane|crazy|wild|incre[ií]ble|genial|brutal|❤|🔥|😮|🤯|👏|😍)/i.test(text)) return pick(es
    ? [`¡Gracias, ${u}! 🙌`, `${u} ¡Qué bien que te guste! 🌍`, `🔥 ¡Gracias, ${u}! Mañana, otro ranking.`]
    : [`Thanks, ${u}! 🙌`, `${u} Glad you liked it! 🌍`, `🔥 Thanks ${u}! New ranking tomorrow.`, `${u} 🙌 More coming soon!`], id);
  return null;
}
