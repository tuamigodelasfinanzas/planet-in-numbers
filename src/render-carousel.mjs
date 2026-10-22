// Renders a carousel: item.json -> out/01.jpg … 07.jpg (1080x1350) + caption.txt
// Usage: node src/render-carousel.mjs <item.json> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { C, HANDLE, EMOJI, logoSVG } from './brand.mjs';
import { browser, pageHTML } from './assets.mjs';
import { esc } from './fmt.mjs';

const [itemFile, outDir = 'out'] = process.argv.slice(2);
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
if (item.slides.length !== 7) throw new Error(`A carousel must have exactly 7 slides (has ${item.slides.length})`);
fs.mkdirSync(outDir, { recursive: true });
const EM = `font-family:${EMOJI}`;
const emo = s => esc(s).replace(/\s+(?=\p{Extended_Pictographic})/gu, '\u00a0').replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="${EM}">$1</span>`);
const W = 1080, H = 1350, P = 80;

const frame = (inner, i) => `
  <div style="position:absolute;left:${P}px;right:${P}px;top:56px;display:flex;align-items:center;gap:14px">
    ${logoSVG(52)}<div style="font-size:28px;font-weight:700">Planet in Numbers</div>
    <div style="margin-left:auto;font-size:26px;font-weight:700;color:${C.muted}">${i + 1}/7</div></div>
  <div style="position:absolute;left:${P}px;right:${P}px;top:150px;bottom:150px;display:flex;flex-direction:column;justify-content:center">${inner}</div>
  <div style="position:absolute;left:${P}px;right:${P}px;bottom:56px;display:flex;align-items:center;justify-content:space-between;font-size:26px;color:${C.muted};font-weight:500">
    <div>${esc(HANDLE)}</div>${i < 6 ? (process.env.PIN_NOSWIPE ? '' : `<div style="color:${C.accent};font-weight:700">Swipe ➜</div>`) : `<div>${process.env.PIN_NOSWIPE ? 'Follow for more' : 'Save · Share · Follow'}</div>`}</div>
  <div style="position:absolute;left:0;bottom:0;height:8px;width:${((i + 1) / 7) * 100}%;background:${C.accent}"></div>`;

const listRow = (r) => `<div style="display:flex;align-items:center;gap:22px;height:180px;border-bottom:2px solid ${C.line}">
  <div style="width:96px;font-size:60px;font-weight:700;color:${r.rank === 1 ? C.accent : C.muted}">${r.rank}</div>
  <div style="font-size:92px;line-height:1;${EM}">${r.flag}</div>
  <div style="flex:1;min-width:0"><div style="font-size:${r.name.length > 16 ? 42 : 50}px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
    <div style="margin-top:14px;height:16px;border-radius:8px;background:${C.line}"><div style="height:100%;width:${Math.round(r.v * 100)}%;border-radius:8px;background:${r.rank === 1 ? C.accent : C.bar}"></div></div></div>
  <div style="font-size:50px;font-weight:700;color:${r.rank === 1 ? C.accent : C.text};white-space:nowrap">${esc(r.text)}</div></div>`;

const bars = (x, col) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:18px">
  <div style="height:430px;width:100%;display:flex;align-items:flex-end;justify-content:center"><div style="width:200px;height:${Math.max(4, Math.round(x.v * 100))}%;border-radius:22px 22px 6px 6px;background:${col}"></div></div>
  <div style="font-size:${x.text.length > 9 ? 54 : 66}px;font-weight:700;color:${col === C.accent ? C.accent : C.text}">${esc(x.text)}</div>
  <div style="display:flex;align-items:center;gap:12px;font-size:36px;font-weight:700"><span style="font-size:52px;${EM}">${x.flag}</span>${esc(x.name)}</div></div>`;

const R = {
  cover: (s) => `<div style="display:flex;flex-direction:column;gap:40px">
    <div style="align-self:flex-start;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:34px;font-weight:700;letter-spacing:.06em">${esc(s.kicker)}</div>
    <div style="font-size:${s.title.length > 34 ? 104 : 124}px;line-height:1.02;font-weight:700;letter-spacing:-.02em">${emo(s.title)}</div>
    <div style="font-size:40px;color:${C.muted};font-weight:500">${esc(s.sub)}</div>
    <div style="display:flex;gap:26px;font-size:150px;line-height:1;margin-top:20px;${EM}">${(s.flags || []).join('')}</div></div>`,
  list: (s) => `<div style="font-size:34px;font-weight:700;color:${C.accent};letter-spacing:.06em">${esc(s.range)}</div>
    <div style="font-size:52px;font-weight:700;line-height:1.1;margin:12px 0 26px">${esc(s.title)}</div>${s.rows.map(listRow).join('')}`,
  end: (s) => `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:44px">
    ${logoSVG(300)}<div style="font-size:84px;line-height:1.05;font-weight:700">${emo(s.title)}</div>
    <div style="font-size:42px;line-height:1.3;color:${C.muted};font-weight:500">${esc(s.sub)}</div>
    <div style="background:${C.accent};color:${C.bg};border-radius:999px;padding:20px 52px;font-size:42px;font-weight:700">Follow ${esc(HANDLE)}</div>
    <div style="font-size:26px;color:${C.muted}">${esc(s.note || '')}</div></div>`,
  'vs-cover': (s) => `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:30px">
    <div style="background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:34px;font-weight:700;letter-spacing:.06em">COUNTRY VS COUNTRY</div>
    <div style="display:flex;align-items:center;gap:40px;margin-top:30px"><div style="font-size:230px;line-height:1;${EM}">${s.a.flag}</div><div style="font-size:80px;font-weight:700;color:${C.accent}">VS</div><div style="font-size:230px;line-height:1;${EM}">${s.b.flag}</div></div>
    <div style="font-size:${(s.a.name + s.b.name).length > 22 ? 78 : 96}px;line-height:1.05;font-weight:700">${esc(s.a.name)}<br><span style="color:${C.muted};font-size:.6em">vs</span><br>${esc(s.b.name)}</div>
    <div style="font-size:40px;color:${C.muted};font-weight:500">5 numbers. One winner.${process.env.PIN_NOSWIPE ? '' : ' Swipe ➜'}</div></div>`,
  'vs-metric': (s) => `<div style="font-size:34px;font-weight:700;color:${C.accent};letter-spacing:.06em">ROUND ${s.n} OF 5</div>
    <div style="font-size:84px;font-weight:700;line-height:1.05;margin:14px 0 40px">${esc(s.label)}</div>
    <div style="display:flex;gap:40px">${bars(s.a, s.win === 'a' ? C.accent : C.bar)}${bars(s.b, s.win === 'b' ? C.accent : C.bar)}</div>
    <div style="margin-top:44px;text-align:center;font-size:40px;font-weight:700;color:${s.win ? C.accent : C.muted}">${s.win ? `Point for ${esc(s.win === 'a' ? s.a.name : s.b.name)}` : 'No points: bigger isn\'t better or worse'}</div>`,
  'vs-end': (s) => `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:40px">
    <div style="font-size:40px;font-weight:700;color:${C.accent};letter-spacing:.06em">FINAL SCORE</div>
    <div style="display:flex;align-items:center;gap:50px"><div style="display:flex;flex-direction:column;align-items:center;gap:10px"><span style="font-size:170px;line-height:1;${EM}">${s.a.flag}</span><span style="font-size:150px;font-weight:700">${s.a.score}</span></div>
      <div style="font-size:90px;font-weight:700;color:${C.muted}">–</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px"><span style="font-size:170px;line-height:1;${EM}">${s.b.flag}</span><span style="font-size:150px;font-weight:700">${s.b.score}</span></div></div>
    <div style="font-size:84px;font-weight:700;color:${C.accent}">${emo(s.verdict)}</div>
    <div style="font-size:42px;color:${C.muted};font-weight:500">Agree? Tell us in the comments 👇 and follow ${esc(HANDLE)}</div>
    <div style="font-size:26px;color:${C.muted}">${esc(s.note)}</div></div>`,
  fact: (s) => `<div style="font-size:34px;font-weight:700;color:${C.accent};letter-spacing:.06em">NUMBER ${s.n} OF THE WEEK</div>
    <div style="font-size:70px;font-weight:700;line-height:1.08;margin:16px 0 60px">${emo(s.label)}</div>
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:24px;background:${C.card};border-radius:40px;padding:60px 40px">
      <div style="font-size:220px;line-height:1;${EM}">${s.flag}</div><div style="font-size:80px;font-weight:700">${esc(s.name)}</div>
      <div style="font-size:110px;line-height:1;font-weight:700;color:${C.accent}">${esc(s.text)}</div></div>`,
};

const b = await browser();
const page = await b.newPage({ viewport: { width: W, height: H } });
for (const [i, s] of item.slides.entries()) {
  if (!R[s.type]) throw new Error('Unknown slide type ' + s.type);
  await page.setContent(pageHTML(W, H, frame(R[s.type](s), i)));
  await page.evaluate('document.fonts.ready');
  await page.screenshot({ path: path.join(outDir, String(i + 1).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 92 });
}
await b.close();
fs.writeFileSync(path.join(outDir, 'caption.txt'), item.caption.trim() + '\n');
console.log(`OK ${item.slides.length} slides in ${outDir}`);
