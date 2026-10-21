// Weekly results report (in Spanish, for the owner): image + text to Telegram.
// Usage: IG_TOKEN=… IG_USER=… SITE=<gh-pages folder> [DRY=true] node tools/report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { browser, pageHTML } from '../src/assets.mjs';
import { C, logoSVG } from '../src/brand.mjs';
import { esc } from '../src/fmt.mjs';

const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER, DRY = process.env.DRY === 'true';
if (!token || !user) { console.log('::error::Missing IG_ACCESS_TOKEN / IG_USER_ID'); process.exit(1); }
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const SITE = process.env.SITE || 'site';
const call = async (p, params = {}) => {
  const r = await fetch(`${API}/${p}?${new URLSearchParams({ ...params, access_token: token })}`);
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`); return j;
};
const NAMES = { top10: 'Top 10', dollar100: '$100 por el mundo', race: 'Antes vs ahora', map: 'Mapa del mundo', stat: 'La gran brecha', guess: 'Adivina el país', top20: 'Top 20 (carrusel)', versus: 'País vs país (carrusel)', week: 'Semana en números (carrusel)' };

// which series each post belongs to (by the first line of its caption)
const key = s => String(s || '').split('\n')[0].replace(/\s+/g, ' ').trim().toLowerCase();
const items = new Map();
const mdir = path.join(SITE, 'media');
if (fs.existsSync(mdir)) for (const d of fs.readdirSync(mdir)) { try { const it = JSON.parse(fs.readFileSync(path.join(mdir, d, 'item.json'), 'utf8')); items.set(key(it.caption), it); } catch {} }

const now = Date.now(), WEEK = 7 * 864e5;
const account = await call(user, { fields: 'username,followers_count,media_count' });
const media = (await call(`${user}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink', limit: 40 })).data || [];
const week = media.filter(m => now - Date.parse(m.timestamp) < WEEK);
let insightsOk = true, insightsErr = '';
for (const m of week) {
  m.ins = {};
  try {
    const metrics = m.media_product_type === 'REELS' ? 'reach,views,saved,shares,total_interactions' : 'reach,views,saved,shares,total_interactions';
    const d = (await call(`${m.id}/insights`, { metric: metrics })).data || [];
    for (const x of d) m.ins[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? 0;
  } catch (e) { insightsOk = false; insightsErr = e.message; }
  const it = items.get(key(m.caption));
  m.series = it?.series || (m.media_product_type === 'REELS' ? 'top10' : 'top20');
  m.title = it?.title || key(m.caption).slice(0, 60);
}

// followers: compare with last week's number (kept in the site branch)
const fFile = path.join(SITE, 'state', 'followers.json');
let hist = []; try { hist = JSON.parse(fs.readFileSync(fFile, 'utf8')); } catch {}
const prev = hist.filter(h => now - Date.parse(h.at) >= 6 * 864e5).at(-1);
const growth = prev ? account.followers_count - prev.n : null;
hist.push({ at: new Date().toISOString(), n: account.followers_count }); hist = hist.slice(-60);
if (!DRY) { fs.mkdirSync(path.dirname(fFile), { recursive: true }); fs.writeFileSync(fFile, JSON.stringify(hist)); }

// per series: averages and the two signals that push reach the most (shares and saves per 1,000 reached)
const by = new Map();
for (const m of week) { if (!by.has(m.series)) by.set(m.series, []); by.get(m.series).push(m); }
const avg = (a, f) => (a.length ? a.reduce((s, x) => s + (f(x) || 0), 0) / a.length : 0);
const rows = [...by].map(([s, a]) => {
  const reach = avg(a, m => m.ins.reach), views = avg(a, m => m.ins.views);
  const per1k = f => { const r = a.reduce((s, m) => s + (m.ins.reach || 0), 0); return r ? a.reduce((s, m) => s + (f(m) || 0), 0) / r * 1000 : 0; };
  return { s, n: a.length, reach, views, likes: avg(a, m => m.like_count), comments: avg(a, m => m.comments_count), shares1k: per1k(m => m.ins.shares), saves1k: per1k(m => m.ins.saved) };
}).sort((a, b) => (insightsOk ? (b.shares1k + b.saves1k) - (a.shares1k + a.saves1k) : (b.likes + b.comments * 3) - (a.likes + a.comments * 3)));
const best = [...week].sort((a, b) => (insightsOk ? (b.ins.views || b.ins.reach || 0) - (a.ins.views || a.ins.reach || 0) : (b.like_count || 0) - (a.like_count || 0)))[0];
const total = f => week.reduce((s, m) => s + (f(m) || 0), 0);
const nf = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);

// recommendation (only with enough posts, so one lucky video doesn't decide the calendar)
let rec = 'Aún hay pocas publicaciones para sacar conclusiones: mantén el calendario otra semana.';
if (rows.length >= 3 && week.length >= 8) {
  const top = rows[0], low = rows.at(-1);
  rec = insightsOk
    ? `Lo que más se comparte y se guarda: «${NAMES[top.s] || top.s}» (${nf(top.shares1k)} compartidos y ${nf(top.saves1k)} guardados por cada 1.000 personas). Lo más flojo: «${NAMES[low.s] || low.s}». Si se repite la próxima semana, cambiaría un hueco de «${NAMES[low.s] || low.s}» por «${NAMES[top.s] || top.s}».`
    : `Lo que mejor funciona por me gusta y comentarios: «${NAMES[top.s] || top.s}». Lo más flojo: «${NAMES[low.s] || low.s}».`;
}

// image
const card = (k, v, sub = '') => `<div style="flex:1;background:${C.card};border-radius:22px;padding:22px 24px"><div style="font-size:22px;color:${C.muted};font-weight:700">${k}</div><div style="font-size:52px;font-weight:700;margin-top:4px">${v}</div><div style="font-size:20px;color:${C.muted}">${sub}</div></div>`;
const head = insightsOk ? ['Serie', 'Posts', 'Alcance', 'Vistas', 'Compart./1k', 'Guard./1k'] : ['Serie', 'Posts', 'Me gusta', 'Coment.'];
const line = r => (insightsOk ? [NAMES[r.s] || r.s, r.n, nf(r.reach), nf(r.views), nf(r.shares1k), nf(r.saves1k)] : [NAMES[r.s] || r.s, r.n, nf(r.likes), nf(r.comments)]);
const table = `<table style="width:100%;border-collapse:collapse;font-size:24px">
  <tr>${head.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};color:${C.muted};font-weight:700;padding:10px 8px;border-bottom:2px solid ${C.line}">${h}</th>`).join('')}</tr>
  ${rows.map((r, j) => `<tr>${line(r).map((v, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:12px 8px;border-bottom:1px solid ${C.line};font-weight:${i ? 500 : 700};color:${j === 0 && i === 0 ? C.accent : C.text}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
const body = `<div style="position:absolute;inset:0;padding:60px 56px;display:flex;flex-direction:column;gap:26px">
  <div style="display:flex;align-items:center;gap:18px">${logoSVG(76)}<div><div style="font-size:42px;font-weight:700">Informe semanal</div>
    <div style="font-size:24px;color:${C.muted}">@${esc(account.username)} · últimos 7 días</div></div></div>
  <div style="display:flex;gap:16px">${card('Seguidores', nf(account.followers_count), growth == null ? 'primera semana' : (growth >= 0 ? '+' : '') + nf(growth) + ' esta semana')}
    ${card('Publicaciones', week.length, 'reels y carruseles')}${insightsOk ? card('Vistas', nf(total(m => m.ins.views)), 'total de la semana') : card('Me gusta', nf(total(m => m.like_count)), 'total de la semana')}</div>
  <div style="background:${C.card};border-radius:22px;padding:18px 22px">${table}</div>
  ${best ? `<div style="background:${C.card};border-radius:22px;padding:20px 24px;border-left:8px solid ${C.accent}"><div style="font-size:22px;color:${C.muted};font-weight:700">MEJOR PUBLICACIÓN</div>
    <div style="font-size:30px;font-weight:700;margin-top:6px">${esc(best.title)}</div><div style="font-size:22px;color:${C.muted}">${insightsOk ? nf(best.ins.views || 0) + ' vistas · ' + nf(best.ins.shares || 0) + ' compartidos · ' + nf(best.ins.saved || 0) + ' guardados' : nf(best.like_count || 0) + ' me gusta · ' + nf(best.comments_count || 0) + ' comentarios'}</div></div>` : ''}
  <div style="font-size:26px;line-height:1.35">${esc(rec)}</div>
  ${insightsOk ? '' : `<div style="font-size:20px;color:${C.muted}">Faltan estadísticas de alcance (permiso instagram_manage_insights del token).</div>`}</div>`;
const b = await browser(); const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await pg.setContent(pageHTML(1080, 1350, body)); await pg.evaluate('document.fonts.ready');
await pg.screenshot({ path: 'report.png' }); await b.close();

const text = `📊 Planet in Numbers · informe semanal\n\nSeguidores: ${nf(account.followers_count)}${growth == null ? '' : ` (${growth >= 0 ? '+' : ''}${nf(growth)})`}\nPublicaciones: ${week.length}\n${best ? `Mejor: ${best.title}\n${best.permalink}\n` : ''}\n${rec}${insightsOk ? '' : `\n\n⚠️ Sin estadísticas de alcance: ${insightsErr.slice(0, 120)}`}`;
console.log(text);
const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
if (TG && CHAT) {
  const f = new FormData(); f.append('chat_id', CHAT); f.append('caption', text.slice(0, 1000)); f.append('photo', new Blob([fs.readFileSync('report.png')]), 'informe.png');
  const r = await (await fetch(`https://api.telegram.org/bot${TG}/sendPhoto`, { method: 'POST', body: f })).json();
  console.log(r.ok ? '::notice::Report sent to Telegram' : `::warning::Telegram: ${r.description}`);
}
console.log(`::notice::insights ${insightsOk ? 'OK' : 'missing: ' + insightsErr.slice(0, 100)}; posts this week ${week.length}`);
