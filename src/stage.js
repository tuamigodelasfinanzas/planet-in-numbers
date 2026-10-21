// Runs inside the browser page. Builds every scene once, then window.frame(t) draws time t (seconds).
(() => {
  const D = window.DATA, C = D.colors, item = D.item;
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const inout = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const stage = document.getElementById('stage');
  const EM = `font-family:${D.emoji}`;

  // Safe area for reels (Instagram covers the top ~200 px and the bottom ~380 px)
  // Instagram covers: top ~220 px (header), bottom ~420 px (caption, account), right ~140 px from y≈1000 (buttons)
  const X0 = 80, X1 = 920, Y0 = 350, Y1 = 1440;

  // persistent chrome: brand chip + progress bar
  const chrome = $(`<div style="position:absolute;left:${X0}px;top:242px;right:${1080 - X1}px;display:flex;align-items:center;gap:16px;z-index:5">
    <div style="width:64px;height:64px">${D.logo}</div>
    <div style="font-size:32px;font-weight:700;color:${C.text};letter-spacing:.01em">Planet in Numbers</div></div>`);
  const prog = $(`<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:322px;height:6px;border-radius:3px;background:${C.line};z-index:5"><div style="height:100%;width:0;border-radius:3px;background:${C.accent}"></div></div>`);
  stage.append(chrome, prog);

  // ---------- builders + per-frame drawers ----------
  function BUILD_hook(S) {
    const s = S.s;
    // background in motion from the very first frame: bars of a ranking racing in (the brand's visual language)
    const W = [0.92, 0.74, 0.83, 0.58, 0.66, 0.47, 0.39];
    const bars = W.map((w, i) => `<div class="hb" style="position:absolute;left:0;top:${i * 64}px;height:44px;width:${w * 100}%;border-radius:22px;background:${i === 0 ? C.accent : C.card};transform-origin:left center;transform:scaleX(0)"></div>`).join('');
    S.el.innerHTML = `<div class="bg" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y1 - 440}px;height:440px;opacity:.6">${bars}</div>
      <div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;display:flex;flex-direction:column;gap:40px">
      <div class="k" style="align-self:flex-start;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 34px;font-size:40px;font-weight:700;letter-spacing:.06em">${esc(s.kicker)}</div>
      <div class="t" style="font-size:${s.title.length > 42 ? 92 : 108}px;line-height:1.04;font-weight:700;color:${C.text};letter-spacing:-.02em;transform-origin:left center">${esc(s.title).replace(/\s+(?=\p{Extended_Pictographic})/gu, '\u00a0').replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="${EM};white-space:nowrap">$1</span>`)}</div>
      <div class="u" style="align-self:flex-start;font-size:44px;line-height:1.25;color:${C.text};font-weight:700;background:${C.card};border-left:8px solid ${C.accent};border-radius:12px;padding:14px 22px">${esc(s.sub).replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="${EM}">$1</span>`)}</div></div>`;
    const [k, t, u] = ['.k', '.t', '.u'].map(q => S.el.querySelector(q));
    const hb = [...S.el.querySelectorAll('.hb')];
    S.draw = () => {
      // title readable at frame 0 (cover + scrollers), with a short "punch" in
      const p = ease(seg(S.t, 0, 0.35));
      t.style.transform = `scale(${1.08 - 0.08 * p})`;
      k.style.transform = `translateX(${(1 - p) * -30}px)`;
      u.style.opacity = 1; u.style.transform = `scale(${1.06 - 0.06 * p})`; // the claim is readable from frame 0 too
      // bars keep moving the whole scene (no static frame)
      hb.forEach((b, i) => { const g = ease(seg(S.t, 0.05 + i * 0.12, 0.7 + i * 0.12)); const wob = 1 + 0.03 * Math.sin(S.t * 3 + i); b.style.transform = `scaleX(${g * wob})`; });
    };
  }

  function rowHTML(r, h, big) {
    return `<div class="row" style="position:absolute;left:0;right:0;height:${h}px;display:flex;align-items:center;gap:20px">
      <div style="width:78px;text-align:right;font-size:${big ? 46 : 42}px;font-weight:700;color:${r.rank === 1 ? C.accent : C.muted}">${r.rank}</div>
      <div style="width:76px;font-size:62px;line-height:1;${EM}">${r.flag}</div>
      <div style="flex:1;position:relative;height:${h - 22}px">
        <div class="bar" style="position:absolute;left:0;top:0;bottom:0;width:0;border-radius:16px;background:${r.rank === 1 ? C.accent : C.card}"></div>
        <div style="position:absolute;left:26px;top:0;bottom:0;display:flex;align-items:center;font-size:${r.name.length > 16 ? 34 : 40}px;font-weight:700;color:${r.rank === 1 ? C.bg : C.text};white-space:nowrap">${esc(r.name)}</div>
      </div>
      <div class="val" style="width:${D.valW || 230}px;text-align:right;font-size:42px;font-weight:700;color:${r.rank === 1 ? C.accent : C.text};white-space:nowrap">${esc(r.text)}</div></div>`;
  }

  function header(s) {
    return `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 30}px">
      <div style="font-size:${s.title.length > 28 ? 48 : 60}px;line-height:1.08;font-weight:700;color:${C.text};letter-spacing:-.01em">${esc(s.title)}</div>
      <div style="font-size:32px;color:${C.muted};margin-top:14px;font-weight:500">${esc(s.metric)}</div></div>`;
  }

  function BUILD_rank(S) {
    const s = S.s, n = s.rows.length, top = Y0 + 215, h = Math.min(100, (Y1 - top) / n);
    S.el.innerHTML = header(s) + `<div class="list" style="position:absolute;left:${X0 - 20}px;right:${1080 - X1}px;top:${top}px;height:${h * n}px"></div>`;
    const list = S.el.querySelector('.list');
    const rows = s.rows.map((r, i) => { const e = $(rowHTML(r, h)); e.style.top = `${i * h}px`; list.append(e); return { e, bar: e.querySelector('.bar'), r }; });
    // top -> bottom: rows named by the voice appear on their cue, the rest follow quickly in order
    const cues = s.cues || {}, rest = cues.rest ?? 1.2;
    let k = 0;
    const countdown = s.order === 'countdown';
    // countdown: unnamed rows enter from the bottom up first; otherwise they follow the named ones top -> bottom
    const startOf = countdown
      ? rows.map((_, i) => (cues[i] != null ? cues[i] : 0.4 + 0.35 * (rows.length - 1 - i)))
      : rows.map((_, i) => (cues[i] != null ? cues[i] : rest + 0.12 * (k++)));
    if (!Object.keys(cues).length && countdown) rows.forEach((_, i) => { startOf[i] = 0.4 + 0.6 * (rows.length - 1 - i); });
    S.draw = () => {
      rows.forEach(({ e, bar, r }, i) => {
        const t0 = startOf[i];
        const q = ease(seg(S.t, t0, t0 + 0.35));
        e.style.opacity = q; e.style.transform = `translateX(${(1 - q) * -60}px)`;
        bar.style.width = `${ease(seg(S.t, t0 + 0.05, t0 + 0.6)) * r.v * 100}%`;
        // the row being named gets a short glow
        const named = cues[i] != null && S.t >= t0 && S.t < t0 + 1.6;
        e.style.filter = named ? 'brightness(1.25)' : 'none';
        e.children[2].firstElementChild.style.boxShadow = named ? `0 0 0 3px ${C.accent}` : 'none';
      });
    };
  }

  function BUILD_winner(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px">
      <div class="b" style="background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 40px;font-size:46px;font-weight:700">#1</div>
      <div class="f" style="font-size:330px;line-height:1.05;${EM}">${s.flag}</div>
      <div class="n" style="font-size:${s.name.length > 14 ? 84 : 104}px;line-height:1.05;font-weight:700;color:${C.text}">${esc(s.name)}</div>
      <div class="v" style="font-size:120px;line-height:1;font-weight:700;color:${C.accent}">${esc(s.text)}</div>
      <div class="l" style="font-size:36px;color:${C.muted};font-weight:500">${esc(s.label)}</div></div>`;
    const parts = ['.b', '.f', '.n', '.v', '.l'].map(q => S.el.querySelector(q));
    S.draw = () => parts.forEach((e, j) => { const q = ease(seg(S.local, j * 0.07, 0.3 + j * 0.07)); e.style.opacity = q; e.style.transform = `scale(${0.85 + 0.15 * q})`; });
  }

  function BUILD_race(S) {
    const s = S.s, N = 10, top = Y0 + 200, h = (Y1 - 150 - top) / N;
    S.el.innerHTML = header(s) + `<div class="list" style="position:absolute;left:${X0 - 20}px;right:${1080 - X1}px;top:${top}px;height:${h * N}px"></div>
      <div class="yr" style="position:absolute;right:${1080 - X1}px;top:${Y1 - 140}px;font-size:140px;line-height:1;font-weight:700;color:${C.accent};opacity:.95"></div>`;
    const list = S.el.querySelector('.list'), yr = S.el.querySelector('.yr');
    const Y = s.years, fmt = D.fmtFn(s.fmt);
    const bars = s.bars.map(b => { const e = $(rowHTML({ rank: '', flag: b.flag, name: b.name, text: '' }, h)); list.append(e); return { b, e, bar: e.querySelector('.bar'), val: e.querySelector('.val'), num: e.firstElementChild }; });
    const valAt = (b, y) => b.values[y] ?? null;
    const rankAt = y => { const r = new Map(); bars.filter(x => valAt(x.b, y) != null).sort((a, c) => valAt(c.b, y) - valAt(a.b, y)).forEach((x, i) => r.set(x, i)); return r; };
    const ranks = Y.map(rankAt);
    S.draw = () => {
      const pos = clamp(seg(S.local, 0.03, 0.9)) * (Y.length - 1);
      const k = Math.min(Y.length - 2, Math.floor(pos)), f = inout(pos - k);
      const y0 = Y[k], y1 = Y[k + 1];
      yr.textContent = Math.round(y0 + (y1 - y0) * (pos - k));
      const cur = bars.map(x => { const a = valAt(x.b, y0), c = valAt(x.b, y1); return { x, v: a == null ? c : c == null ? a : a + (c - a) * (pos - k) }; });
      const max = Math.max(...cur.map(c => c.v || 0));
      for (const { x, v } of cur) {
        const r0 = ranks[k].get(x) ?? 12, r1 = ranks[k + 1].get(x) ?? 12, r = r0 + (r1 - r0) * f;
        x.e.style.top = `${r * h}px`;
        x.e.style.opacity = clamp(10.4 - r);
        x.bar.style.width = `${v ? Math.max(4, v / max * 100) : 0}%`;
        x.val.textContent = v ? fmt(v) : '';
        x.num.textContent = r < 9.6 ? Math.round(r) + 1 : '';
        const lead = Math.round(r) === 0;
        x.bar.style.background = lead ? C.accent : C.card;
        x.num.style.color = lead ? C.accent : C.muted;
        x.e.children[2].children[1].style.color = lead ? C.bg : C.text;
        x.val.style.color = lead ? C.accent : C.text;
      }
    };
  }

  function BUILD_map(S) {
    const s = S.s;
    const legend = `<div style="display:flex;align-items:center;gap:16px;font-size:30px;color:${C.muted};font-weight:500">${esc(s.legend[0])}
      <div style="flex:1;height:18px;border-radius:9px;background:linear-gradient(90deg,${D.mapLow},${D.mapMid},${C.accent})"></div>${esc(s.legend[1])}</div>`;
    const list = (title, arr, col) => `<div class="lst" style="flex:1;background:${C.card};border-radius:28px;padding:30px 30px;display:flex;flex-direction:column;gap:18px">
      <div style="font-size:30px;font-weight:700;color:${col};letter-spacing:.06em">${title}</div>
      ${arr.map(x => `<div style="display:flex;align-items:center;gap:14px"><span style="font-size:46px;${EM}">${x.flag}</span><div style="min-width:0"><div style="font-size:32px;font-weight:700;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</div><div style="font-size:30px;color:${C.muted}">${esc(x.text)}</div></div></div>`).join('')}</div>`;
    S.el.innerHTML = header({ title: s.title, metric: String(s.year) }) +
      `<div style="position:absolute;left:${X0 - 20}px;right:${1080 - X1 - 20}px;top:${Y0 + 190}px">${D.mapSVG}</div>
       <div class="lg" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 660}px">${legend}</div>
       <div class="ls" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 730}px;display:flex;gap:24px">${list('HIGHEST', s.top, C.accent)}${list('LOWEST', s.bottom, C.bar)}</div>`;
    const paths = [...S.el.querySelectorAll('path[data-t]')];
    const lg = S.el.querySelector('.lg'), ls = [...S.el.querySelectorAll('.lst')];
    S.draw = () => {
      for (const p of paths) { const t = Number(p.dataset.t); const q = ease(seg(S.local, 0.05 + (1 - t) * 0.35, 0.2 + (1 - t) * 0.35)); p.style.fill = q > 0 ? p.dataset.c : D.mapNone; p.style.opacity = 0.35 + 0.65 * q; }
      lg.style.opacity = ease(seg(S.local, 0.3, 0.45));
      ls.forEach((e, j) => { const q = ease(seg(S.local, 0.45 + j * 0.12, 0.6 + j * 0.12)); e.style.opacity = q; e.style.transform = `translateY(${(1 - q) * 40}px)`; });
    };
  }

  function BUILD_stat(S) {
    const s = S.s;
    const blk = (x, col) => `<div class="blk" style="display:flex;align-items:center;gap:30px;background:${C.card};border-radius:32px;padding:36px 40px">
      <div style="font-size:130px;line-height:1;${EM}">${x.flag}</div>
      <div style="min-width:0"><div style="font-size:44px;font-weight:700;color:${C.text}">${esc(x.name)}</div><div style="font-size:96px;line-height:1.05;font-weight:700;color:${col}">${esc(x.text)}</div></div></div>`;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;gap:34px">
      <div style="font-size:36px;color:${C.muted};font-weight:500">${esc(s.label)}</div>
      ${blk(s.a, C.accent)}<div class="vs" style="font-size:40px;font-weight:700;color:${C.muted};text-align:center">vs</div>${blk(s.b, C.bar)}
      <div class="gap" style="margin-top:20px;text-align:center"><div style="font-size:44px;color:${C.muted};font-weight:500">That's</div><div style="font-size:230px;line-height:1;font-weight:700;color:${C.accent}">${esc(s.gap)}</div></div></div>`;
    const [a, b] = S.el.querySelectorAll('.blk'), vs = S.el.querySelector('.vs'), gap = S.el.querySelector('.gap');
    S.draw = () => {
      [a, vs, b].forEach((e, j) => { const q = ease(seg(S.local, 0.03 + j * 0.15, 0.2 + j * 0.15)); e.style.opacity = q; e.style.transform = `translateY(${(1 - q) * 40}px)`; });
      const q = ease(seg(S.local, 0.55, 0.7)); gap.style.opacity = q; gap.style.transform = `scale(${0.6 + 0.4 * q})`;
    };
  }

  function BUILD_clues(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;gap:30px">
      <div style="display:flex;align-items:center;gap:24px"><div style="width:120px;height:120px;border-radius:50%;background:${C.accent};color:${C.bg};font-size:90px;font-weight:700;display:flex;align-items:center;justify-content:center">?</div>
      <div style="font-size:64px;font-weight:700;color:${C.text}">Which country<br>is this?</div></div>
      ${s.clues.map((c, i) => `<div class="cl" style="background:${C.card};border-radius:30px;padding:30px 38px;display:flex;flex-direction:column;gap:6px">
        <div style="font-size:30px;font-weight:700;color:${C.muted};letter-spacing:.06em">CLUE ${i + 1} · ${esc(c.label.toUpperCase())}</div>
        <div style="font-size:${c.text.length > 18 ? 58 : 80}px;line-height:1.05;font-weight:700;color:${i === s.clues.length - 1 ? C.accent : C.text}">${esc(c.text)}</div></div>`).join('')}</div>`;
    const cl = [...S.el.querySelectorAll('.cl')], n = cl.length;
    S.draw = () => cl.forEach((e, i) => { const a = 0.03 + i * (0.85 / n); const q = ease(seg(S.local, a, a + 0.1)); e.style.opacity = q; e.style.transform = `translateX(${(1 - q) * 80}px)`; });
  }

  function BUILD_countdown(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:70px;text-align:center">
      <div style="font-size:76px;line-height:1.1;font-weight:700;color:${C.text};white-space:nowrap">${esc(s.text).replace(/(\p{Extended_Pictographic})/gu, `<span style="${EM}">$1</span>`)}</div>
      <div style="position:relative;width:440px;height:440px"><svg width="440" height="440" viewBox="0 0 440 440" style="position:absolute;inset:0"><circle cx="220" cy="220" r="200" fill="none" stroke="${C.line}" stroke-width="22"/><circle class="arc" cx="220" cy="220" r="200" fill="none" stroke="${C.accent}" stroke-width="22" stroke-linecap="round" transform="rotate(-90 220 220)" stroke-dasharray="1257" stroke-dashoffset="0"/></svg>
      <div class="num" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:260px;font-weight:700;color:${C.text}"></div></div></div>`;
    const arc = S.el.querySelector('.arc'), num = S.el.querySelector('.num');
    S.draw = () => { const left = Math.max(0, S.dur - S.t); const n = Math.min(3, Math.ceil(left / (S.dur / 3))); num.textContent = n || 1; arc.setAttribute('stroke-dashoffset', String(1257 * clamp(S.local))); };
  }

  function BUILD_answer(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:30px;text-align:center">
      <div class="a" style="font-size:50px;font-weight:700;color:${C.accent};letter-spacing:.08em">THE ANSWER IS…</div>
      <div class="f" style="font-size:380px;line-height:1.05;${EM}">${s.flag}</div>
      <div class="n" style="font-size:${s.name.length > 14 ? 96 : 124}px;line-height:1.05;font-weight:700;color:${C.text}">${esc(s.name)}</div></div>`;
    const [a, f, n] = ['.a', '.f', '.n'].map(q => S.el.querySelector(q));
    S.draw = () => { a.style.opacity = ease(seg(S.local, 0, 0.15)); const q = ease(seg(S.local, 0.12, 0.35)); f.style.opacity = q; f.style.transform = `scale(${0.4 + 0.6 * q}) rotate(${(1 - q) * -12}deg)`; const r = ease(seg(S.local, 0.25, 0.45)); n.style.opacity = r; n.style.transform = `translateY(${(1 - r) * 40}px)`; };
  }

  function BUILD_cta(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 40}px;bottom:${1920 - Y1}px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:50px;text-align:center">
      <div class="g" style="width:330px;height:330px">${D.logoBig}</div>
      <div class="l" style="font-size:86px;line-height:1.08;font-weight:700;color:${C.text}">${esc(s.line).replace(/(YOUR|THIS)/g, `<span style="color:${C.accent}">$1</span>`).replace(/(\p{Extended_Pictographic})/gu, `<span style="${EM}">$1</span>`)}</div>
      <div class="u" style="font-size:40px;line-height:1.3;color:${C.muted};font-weight:500">${esc(s.sub)}</div>
      <div class="b" style="background:${C.accent};color:${C.bg};border-radius:999px;padding:22px 56px;font-size:44px;font-weight:700">Follow ${esc(D.handle)}</div></div>`;
    const parts = ['.g', '.l', '.u', '.b'].map(q => S.el.querySelector(q));
    S.draw = () => parts.forEach((e, j) => { const q = ease(seg(S.local, j * 0.1, 0.3 + j * 0.1)); e.style.opacity = q; e.style.transform = `translateY(${(1 - q) * 40}px)`; });
  }

  // ---------- games ----------
  const emo = (t) => esc(t).replace(/\s+(?=\p{Extended_Pictographic})/gu, ' ').replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="${EM}">$1</span>`);
  function BUILD_spin(S) {
    // hard cuts between cards (no in-between frames): wherever the viewer pauses, a full card is on screen
    const s = S.s, per = 7 / (D.fps || 30);
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px;display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center">
      <div class="stop" style="background:#E5484D;color:#fff;border-radius:999px;padding:14px 44px;font-size:52px;font-weight:700;letter-spacing:.06em">⏸ STOP NOW!</div>
      <div style="font-size:54px;font-weight:700;color:${C.muted}">${esc(s.title)}</div></div>
      <div class="card" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 230}px;bottom:${1920 - Y1}px;background:${C.card};border-radius:44px;border:6px solid ${C.accent};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:40px">
        <div class="fl" style="font-size:250px;line-height:1;${EM}"></div>
        <div class="nm" style="font-size:80px;line-height:1.05;font-weight:700;text-align:center"></div>
        <div class="st" style="width:100%;display:flex;flex-direction:column;gap:14px;margin-top:10px"></div></div>`;
    const fl = S.el.querySelector('.fl'), nm = S.el.querySelector('.nm'), st = S.el.querySelector('.st'), stop = S.el.querySelector('.stop');
    let last = -1;
    S.draw = () => {
      const i = Math.min(s.cards.length - 1, Math.floor(S.t / per + 1e-6));
      if (i !== last) {
        const c = s.cards[i]; last = i;
        fl.textContent = c.flag; nm.textContent = c.name; nm.style.fontSize = c.name.length > 16 ? '62px' : '80px';
        st.innerHTML = c.stats.map(x => `<div style="display:flex;justify-content:space-between;align-items:center;background:${C.bg};border-radius:20px;padding:18px 26px">
          <span style="font-size:36px;color:${C.muted};font-weight:500">${esc(x.label)}</span><span style="font-size:46px;font-weight:700;color:${C.accent}">${esc(x.text)}</span></div>`).join('');
      }
      stop.style.transform = `scale(${1 + 0.05 * Math.sin(S.t * 10)})`;
    };
  }

  function BUILD_hl(S) {
    const s = S.s, rv = s.revealAt || 4.5;
    const card = (x, k) => `<div class="c${k}" style="display:flex;align-items:center;gap:30px;background:${C.card};border-radius:36px;padding:30px 34px;border:6px solid transparent">
      <div style="font-size:150px;line-height:1;${EM}">${x.flag}</div>
      <div style="flex:1;min-width:0"><div style="font-size:${x.name.length > 14 ? 50 : 62}px;font-weight:700;line-height:1.05">${esc(x.name)}</div>
      <div class="v${k}" style="font-size:66px;font-weight:700;color:${C.accent};margin-top:8px">?</div></div>
      <div class="ok${k}" style="font-size:90px;opacity:0">✅</div></div>`;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;justify-content:center;gap:30px">
      <div style="display:flex;align-items:center;justify-content:space-between"><div style="background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:36px;font-weight:700;letter-spacing:.06em">ROUND ${s.n}/${s.total}</div>
        <div style="display:flex;gap:12px;align-items:center"><span style="font-size:30px;color:${C.muted};font-weight:500;margin-right:6px">keep score</span>${Array.from({ length: s.total }, (_, i) => `<div style="width:26px;height:26px;border-radius:50%;background:${i < s.n - 1 ? C.good : i === s.n - 1 ? C.accent : C.line}"></div>`).join('')}</div></div>
      <div style="font-size:76px;line-height:1.05;font-weight:700">${emo(s.q)}</div>
      ${card(s.a, 'a')}
      <div style="height:120px;display:flex;align-items:center;justify-content:center;position:relative">
        <svg width="120" height="120" viewBox="0 0 120 120" style="position:absolute"><circle cx="60" cy="60" r="52" fill="none" stroke="${C.line}" stroke-width="10"/><circle class="arc" cx="60" cy="60" r="52" fill="none" stroke="${C.accent}" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="327" stroke-dashoffset="0"/></svg>
        <div class="cd" style="position:relative;font-size:64px;font-weight:700">VS</div></div>
      ${card(s.b, 'b')}</div>`;
    const q = k => S.el.querySelector(k);
    const ca = q('.ca'), cb = q('.cb'), va = q('.va'), vb = q('.vb'), oa = q('.oka'), ob = q('.okb'), cd = q('.cd'), arc = q('.arc');
    S.draw = () => {
      const left = rv - S.t;
      if (left > 0 && left <= 2.1) { cd.textContent = Math.ceil(left / 0.7); arc.setAttribute('stroke-dashoffset', String(327 * (1 - left / 2.1))); }
      else { cd.textContent = 'VS'; arc.setAttribute('stroke-dashoffset', left > 2.1 ? '0' : '327'); }
      const on = S.t >= rv;
      va.textContent = on ? s.a.text : '?'; vb.textContent = on ? s.b.text : '?';
      const p = ease(seg(S.t, rv, rv + 0.35));
      const w = s.win === 'a' ? [ca, oa] : [cb, ob], l = s.win === 'a' ? cb : ca;
      w[0].style.borderColor = on ? C.accent : 'transparent'; w[0].style.transform = `scale(${1 + 0.04 * p})`; w[1].style.opacity = p;
      l.style.opacity = on ? 1 - 0.45 * p : 1;
      [ca, cb].forEach((c, i) => { const e = ease(seg(S.t, 0.05 + i * 0.12, 0.4 + i * 0.12)); if (!on) c.style.transform = `translateX(${(1 - e) * (i ? 120 : -120)}px)`; });
    };
  }

  function vsHead(s) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="font-size:150px;line-height:1;${EM}">${s.a.flag}</div><div style="font-size:${s.a.name.length > 12 ? 40 : 50}px;font-weight:700;text-align:center">${esc(s.a.name)}</div></div>
      <div style="font-size:70px;font-weight:700;color:${C.accent}">VS</div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="font-size:150px;line-height:1;${EM}">${s.b.flag}</div><div style="font-size:${s.b.name.length > 12 ? 40 : 50}px;font-weight:700;text-align:center">${esc(s.b.name)}</div></div></div>`;
  }
  function BUILD_cupmatch(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;justify-content:center;gap:26px">
      <div style="align-self:center;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:36px;font-weight:700;letter-spacing:.06em">🏆 ${esc(s.round)}</div>
      ${vsHead(s)}
      <div class="rows" style="display:flex;flex-direction:column;gap:16px;margin-top:10px">${s.rows.map(r => `<div class="r" style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;background:${C.card};border-radius:24px;padding:24px 26px">
        <div style="font-size:48px;font-weight:700;color:${C.text}">${esc(r.a)}</div><div style="font-size:32px;line-height:1.1;color:${C.muted};text-align:center;font-weight:500">${esc(r.label)}</div><div style="font-size:48px;font-weight:700;text-align:right">${esc(r.b)}</div></div>`).join('')}</div>
      <div class="vote" style="text-align:center;font-size:52px;font-weight:700;margin-top:10px">Vote: comment <span style="${EM}">${s.a.flag}</span> or <span style="${EM}">${s.b.flag}</span></div></div>`;
    const rs = [...S.el.querySelectorAll('.r')], vote = S.el.querySelector('.vote');
    S.draw = () => { rs.forEach((r, i) => { const p = ease(seg(S.local, 0.08 + i * 0.12, 0.25 + i * 0.12)); r.style.opacity = p; r.style.transform = `translateY(${(1 - p) * 30}px)`; }); const v = ease(seg(S.local, 0.65, 0.8)); vote.style.opacity = v; vote.style.transform = `scale(${0.9 + 0.1 * v + 0.03 * Math.sin(S.t * 6) * v})`; };
  }
  function BUILD_cupresult(S) {
    const s = S.s, tot = s.a.v + s.b.v, pa = tot ? s.a.v / tot : 0.5;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;justify-content:center;gap:34px">
      <div style="align-self:center;font-size:46px;font-weight:700;color:${C.accent};letter-spacing:.08em">LAST MATCH · RESULT</div>
      ${vsHead(s)}
      ${tot ? `<div style="height:70px;border-radius:35px;overflow:hidden;display:flex;background:${C.line}"><div class="ba" style="width:0;background:${s.winner === s.a.iso3 ? C.accent : C.bar}"></div><div class="bb" style="width:0;margin-left:auto;background:${s.winner === s.b.iso3 ? C.accent : C.bar}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:44px;font-weight:700"><span>${Math.round(pa * 100)}% · ${s.a.v}</span><span>${s.b.v} · ${Math.round((1 - pa) * 100)}%</span></div>` : ''}
      <div class="w" style="text-align:center;font-size:66px;font-weight:700">${esc((s.winner === s.a.iso3 ? s.a : s.b).name)} advances ✅</div>
      <div style="text-align:center;font-size:32px;color:${C.muted}">${s.how === 'votes' ? `${tot} votes from your comments` : 'No clear vote, so the data decided'}</div></div>`;
    const ba = S.el.querySelector('.ba'), bb = S.el.querySelector('.bb'), w = S.el.querySelector('.w');
    S.draw = () => { const p = ease(seg(S.local, 0.1, 0.5)); if (ba) { ba.style.width = `${pa * 100 * p}%`; bb.style.width = `${(1 - pa) * 100 * p}%`; } const q = ease(seg(S.local, 0.45, 0.65)); w.style.opacity = q; w.style.transform = `scale(${0.8 + 0.2 * q})`; };
  }
  function BUILD_cupchampion(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center">
      <div class="t" style="font-size:200px;line-height:1;${EM}">🏆</div><div style="font-size:48px;font-weight:700;color:${C.accent};letter-spacing:.08em">CHAMPION</div>
      <div class="f" style="font-size:280px;line-height:1;${EM}">${s.flag}</div><div style="font-size:96px;font-weight:700">${esc(s.name)}</div>
      <div style="font-size:40px;color:${C.muted}">${esc(s.title)} · decided by you</div></div>`;
    const t = S.el.querySelector('.t'), f = S.el.querySelector('.f');
    S.draw = () => { const p = ease(seg(S.local, 0.05, 0.3)); f.style.transform = `scale(${0.3 + 0.7 * p})`; f.style.opacity = p; t.style.transform = `translateY(${Math.sin(S.t * 3) * 8}px)`; };
  }

  var BUILD = { hook: BUILD_hook, rank: BUILD_rank, winner: BUILD_winner, race: BUILD_race, map: BUILD_map, stat: BUILD_stat, clues: BUILD_clues, countdown: BUILD_countdown, answer: BUILD_answer, cta: BUILD_cta, spin: BUILD_spin, hl: BUILD_hl, cupmatch: BUILD_cupmatch, cupresult: BUILD_cupresult, cupchampion: BUILD_cupchampion };

  // ---------- timeline ----------
  const scenes = item.scenes.map((s, i) => {
    const el = $(`<div class="scene" style="position:absolute;inset:0;display:none"></div>`);
    stage.append(el);
    const S = { s, el, i };
    (BUILD[s.type] || BUILD.hook)(S);
    return S;
  });

  const starts = []; let acc = 0; for (const d of D.durs) { starts.push(acc); acc += d; }
  window.frame = (t) => {
    let i = starts.findIndex((s, k) => t >= s && t < s + D.durs[k]); if (i < 0) i = scenes.length - 1;
    scenes.forEach((S, k) => {
      if (k !== i) { S.el.style.display = 'none'; return; }
      S.el.style.display = 'block';
      S.dur = D.durs[k]; S.t = t - starts[k]; S.local = clamp(S.t / S.dur);
      const fin = (k === 0 || S.s.type === 'spin') ? 1 : ease(seg(S.t, 0, 0.3)), fout = k === scenes.length - 1 ? 1 : 1 - seg(S.t, S.dur - 0.22, S.dur);
      S.el.style.opacity = Math.min(fin, fout);
      S.el.style.transform = S.s.type === 'spin' ? 'none' : `scale(${1 + 0.025 * S.local})`;
      S.draw && S.draw(S.local);
    });
    prog.firstElementChild.style.width = `${clamp(t / D.total) * 100}%`;
  };
  window.ready = true;
})();
