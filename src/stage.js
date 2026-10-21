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
  const X0 = 80, X1 = 1000, Y0 = 250, Y1 = 1520;

  // persistent chrome: brand chip + progress bar
  const chrome = $(`<div style="position:absolute;left:${X0}px;top:150px;right:80px;display:flex;align-items:center;gap:16px;z-index:5">
    <div style="width:64px;height:64px">${D.logo}</div>
    <div style="font-size:32px;font-weight:700;color:${C.text};letter-spacing:.01em">Planet in Numbers</div></div>`);
  const prog = $(`<div style="position:absolute;left:${X0}px;right:80px;top:232px;height:6px;border-radius:3px;background:${C.line};z-index:5"><div style="height:100%;width:0;border-radius:3px;background:${C.accent}"></div></div>`);
  stage.append(chrome, prog);

  // ---------- builders + per-frame drawers ----------
  function BUILD_hook(S) {
    const s = S.s;
    S.el.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 120}px;display:flex;flex-direction:column;gap:44px">
      <div class="k" style="align-self:flex-start;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 34px;font-size:40px;font-weight:700;letter-spacing:.06em">${esc(s.kicker)}</div>
      <div class="t" style="font-size:${s.title.length > 42 ? 96 : 112}px;line-height:1.04;font-weight:700;color:${C.text};letter-spacing:-.02em">${esc(s.title).replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="${EM}">$1</span>`)}</div>
      <div class="u" style="font-size:44px;line-height:1.3;color:${C.muted};font-weight:500">${esc(s.sub)}</div></div>
      <div class="g" style="position:absolute;left:560px;top:1080px;width:620px;height:620px;opacity:.16">${D.logoBig}</div>`;
    const [k, t, u] = ['.k', '.t', '.u'].map(q => S.el.querySelector(q)), g = S.el.querySelector('.g');
    S.draw = p => {
      [k, t, u].forEach((e, j) => { const q = j < 2 ? 1 : ease(seg(S.local, 0.1, 0.4)); e.style.opacity = q; e.style.transform = `translateY(${(1 - q) * 50}px)`; });
      g.style.transform = `rotate(${S.local * 6}deg) scale(${1 + p * 0.05})`;
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
    return `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 50}px">
      <div style="font-size:60px;line-height:1.08;font-weight:700;color:${C.text};letter-spacing:-.01em">${esc(s.title)}</div>
      <div style="font-size:32px;color:${C.muted};margin-top:14px;font-weight:500">${esc(s.metric)}</div></div>`;
  }

  function BUILD_rank(S) {
    const s = S.s, n = s.rows.length, top = Y0 + 300, h = Math.min(104, (Y1 - top) / n);
    S.el.innerHTML = header(s) + `<div class="list" style="position:absolute;left:${X0 - 20}px;right:${1080 - X1}px;top:${top}px;height:${h * n}px"></div>`;
    const list = S.el.querySelector('.list');
    const rows = s.rows.map((r, i) => { const e = $(rowHTML(r, h)); e.style.top = `${i * h}px`; list.append(e); return { e, bar: e.querySelector('.bar'), r }; });
    S.draw = () => {
      // countdown: #10 appears first, #1 last
      rows.forEach(({ e, bar, r }, i) => {
        const order = n - 1 - i, a = 0.04 + order * (0.8 / n);
        const q = ease(seg(S.local, a, a + 0.12));
        e.style.opacity = q; e.style.transform = `translateX(${(1 - q) * -60}px)`;
        bar.style.width = `${ease(seg(S.local, a + 0.02, a + 0.2)) * r.v * 100}%`;
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
    const s = S.s, N = 10, top = Y0 + 300, h = (Y1 - 180 - top) / N;
    S.el.innerHTML = header(s) + `<div class="list" style="position:absolute;left:${X0 - 20}px;right:${1080 - X1}px;top:${top}px;height:${h * N}px"></div>
      <div class="yr" style="position:absolute;right:${1080 - X1}px;top:${Y1 - 170}px;font-size:170px;line-height:1;font-weight:700;color:${C.accent};opacity:.95"></div>`;
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
      `<div style="position:absolute;left:30px;right:30px;top:${Y0 + 260}px">${D.mapSVG}</div>
       <div class="lg" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 820}px">${legend}</div>
       <div class="ls" style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 900}px;display:flex;gap:24px">${list('HIGHEST', s.top, C.accent)}${list('LOWEST', s.bottom, C.bar)}</div>`;
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

  var BUILD = { hook: BUILD_hook, rank: BUILD_rank, winner: BUILD_winner, race: BUILD_race, map: BUILD_map, stat: BUILD_stat, clues: BUILD_clues, countdown: BUILD_countdown, answer: BUILD_answer, cta: BUILD_cta };

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
      const fin = k === 0 ? 1 : ease(seg(S.t, 0, 0.3)), fout = k === scenes.length - 1 ? 1 : 1 - seg(S.t, S.dur - 0.22, S.dur);
      S.el.style.opacity = Math.min(fin, fout);
      S.el.style.transform = `scale(${1 + 0.025 * S.local})`;
      S.draw && S.draw(S.local);
    });
    prog.firstElementChild.style.width = `${clamp(t / D.total) * 100}%`;
  };
  window.ready = true;
})();
