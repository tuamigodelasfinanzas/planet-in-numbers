// Channel intro: builds every scene once, then window.frame(t) draws time t.
(() => {
  const D = window.DATA, C = D.colors, EM = `font-family:${D.emoji}`;
  const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const stage = document.getElementById('stage');
  const X0 = 80, X1 = 920, Y0 = 330, Y1 = 1440;   // inside Instagram/TikTok visible area

  // permanent background: world map (real data colors) + slow drift + glow
  const bg = $(`<div style="position:absolute;inset:0">
    <div class="map" style="position:absolute;left:-260px;top:520px;width:1600px;opacity:.22">${D.map}</div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 620px 700px at 50% 48%, rgba(10,22,40,.15) 0%, ${C.bg} 100%)"></div>
    <div class="flash" style="position:absolute;inset:0;background:${C.accent};opacity:0;mix-blend-mode:screen"></div></div>`);
  stage.append(bg);
  const map = bg.querySelector('.map'), flash = bg.querySelector('.flash');

  const S = D.scenes, starts = []; let acc = 0; for (const s of S) { starts.push(acc); acc += s.dur; }
  const els = S.map(s => { const e = $(`<div style="position:absolute;inset:0;display:none"></div>`); stage.append(e); return e; });

  // ---- scene builders ----
  const B = {
    shout(e, s) { // giant name, word by word (slams synced with the shouted words)
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
        <div class="g" style="width:340px;height:340px;margin-bottom:30px">${D.logo}</div>
        ${s.words.map((w, i) => `<div class="w" style="font-size:${i === 1 ? 150 : 190}px;line-height:.95;font-weight:700;letter-spacing:-.03em;color:${i === 1 ? C.accent : C.text};text-shadow:0 12px 40px rgba(0,0,0,.5)">${esc(w.text)}</div>`).join('')}</div>`;
      const ws = [...e.querySelectorAll('.w')], g = e.querySelector('.g');
      return (t) => {
        const q = back(seg(t, 0, 0.5)); g.style.transform = `scale(${q}) rotate(${(1 - ease(seg(t, 0, 0.8))) * -90}deg)`; g.style.opacity = clamp(q);
        ws.forEach((w, i) => { const a = s.words[i].at; const p = back(seg(t, a, a + 0.28)); w.style.opacity = clamp(seg(t, a, a + 0.08)); w.style.transform = `scale(${2.2 - 1.2 * p})`; });
      };
    },
    line(e, s) { // a big statement with a highlighted word
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;justify-content:center;gap:34px">
        <div class="k" style="align-self:flex-start;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:38px;font-weight:700;letter-spacing:.08em">${esc(s.kicker)}</div>
        <div class="t" style="font-size:118px;line-height:1.02;font-weight:700;letter-spacing:-.02em">${s.html}</div></div>`;
      const k = e.querySelector('.k'), tt = e.querySelector('.t');
      return t => { k.style.transform = `translateX(${(1 - ease(seg(t, 0, 0.3))) * -200}px)`; const p = ease(seg(t, 0.05, 0.45)); tt.style.opacity = p; tt.style.transform = `translateY(${(1 - p) * 80}px)`; };
    },
    ranking(e, s) { // a ranking racing in, bars growing
      const h = 104;
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px">
        <div class="k" style="display:inline-block;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:38px;font-weight:700;letter-spacing:.08em">${esc(s.kicker)}</div>
        <div style="font-size:84px;line-height:1.05;font-weight:700;margin:26px 0 40px">${esc(s.title)}</div>
        ${s.rows.map((r, i) => `<div class="r" style="display:flex;align-items:center;gap:18px;height:${h}px">
          <div style="width:60px;font-size:46px;font-weight:700;color:${i === 0 ? C.accent : C.muted}">${i + 1}</div>
          <div style="font-size:66px;line-height:1;${EM}">${r.flag}</div>
          <div style="flex:1;position:relative;height:78px"><div class="b" style="position:absolute;inset:0;width:0;border-radius:18px;background:${i === 0 ? C.accent : C.card}"></div>
            <div style="position:absolute;left:24px;top:0;bottom:0;display:flex;align-items:center;font-size:42px;font-weight:700;color:${i === 0 ? C.bg : C.text};white-space:nowrap">${esc(r.name)}</div></div>
          <div style="width:220px;text-align:right;font-size:44px;font-weight:700;color:${i === 0 ? C.accent : C.text}">${esc(r.text)}</div></div>`).join('')}</div>`;
      const rs = [...e.querySelectorAll('.r')], bs = [...e.querySelectorAll('.b')], n = rs.length;
      return t => rs.forEach((r, i) => { const a = 0.15 + (n - 1 - i) * 0.22; const q = ease(seg(t, a, a + 0.3)); r.style.opacity = q; r.style.transform = `translateX(${(1 - q) * -120}px)`; bs[i].style.width = `${ease(seg(t, a + 0.05, a + 0.6)) * s.rows[i].v * 100}%`; });
    },
    map(e, s) { // the map comes to the front and lights up country by country
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0 + 10}px">
        <div style="display:inline-block;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:38px;font-weight:700;letter-spacing:.08em">${esc(s.kicker)}</div>
        <div style="font-size:84px;line-height:1.05;font-weight:700;margin-top:26px">${esc(s.title)}</div></div>
        <div class="m" style="position:absolute;left:${X0 - 30}px;right:${1080 - X1 - 30}px;top:${Y0 + 330}px">${D.mapLit}</div>`;
      const ps = [...e.querySelectorAll('path[data-t]')];
      return t => ps.forEach(p => { const d = Number(p.dataset.d); const q = ease(seg(t, 0.1 + d * 1.4, 0.3 + d * 1.4)); p.style.fill = q > 0.02 ? p.dataset.c : '#1A3150'; });
    },
    quiz(e, s) {
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;text-align:center">
        <div style="background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:38px;font-weight:700;letter-spacing:.08em">${esc(s.kicker)}</div>
        <div class="q" style="width:360px;height:360px;border-radius:50%;background:${C.card};border:10px solid ${C.accent};display:flex;align-items:center;justify-content:center;font-size:250px;font-weight:700;color:${C.accent}">?</div>
        <div class="f" style="display:flex;gap:34px;font-size:130px;line-height:1;${EM}">${s.flags.map(f => `<span>${f}</span>`).join('')}</div>
        <div style="font-size:84px;line-height:1.05;font-weight:700">${esc(s.title)}</div></div>`;
      const q = e.querySelector('.q'), fs = [...e.querySelectorAll('.f span')];
      return t => { q.style.transform = `scale(${back(seg(t, 0, 0.4))}) rotate(${Math.sin(t * 6) * 6}deg)`; fs.forEach((f, i) => { const p = back(seg(t, 0.25 + i * 0.18, 0.55 + i * 0.18)); f.style.display = 'inline-block'; f.style.transform = `scale(${p})`; f.style.opacity = clamp(p); }); };
    },
    versus(e, s) {
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
        <div style="background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 32px;font-size:38px;font-weight:700;letter-spacing:.08em">${esc(s.kicker)}</div>
        <div style="display:flex;align-items:center;gap:40px"><div class="a" style="font-size:240px;line-height:1;${EM}">${s.a}</div>
          <div class="v" style="font-size:120px;font-weight:700;color:${C.accent}">VS</div><div class="b" style="font-size:240px;line-height:1;${EM}">${s.b}</div></div>
        <div style="font-size:84px;line-height:1.05;font-weight:700">${esc(s.title)}</div></div>`;
      const a = e.querySelector('.a'), b = e.querySelector('.b'), v = e.querySelector('.v');
      return t => { const p = ease(seg(t, 0, 0.35)); a.style.transform = `translateX(${(1 - p) * -500}px)`; b.style.transform = `translateX(${(1 - p) * 500}px)`; v.style.transform = `scale(${back(seg(t, 0.3, 0.6))})`; };
    },
    outro(e, s) {
      e.innerHTML = `<div style="position:absolute;left:${X0}px;right:${1080 - X1}px;top:${Y0}px;bottom:${1920 - Y1}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
        <div class="g" style="width:380px;height:380px">${D.logo}</div>
        <div class="n" style="font-size:100px;line-height:1;font-weight:700;letter-spacing:-.02em;white-space:nowrap">Planet <span style="color:${C.accent}">in</span> Numbers</div>
        <div class="u" style="font-size:52px;font-weight:500;color:${C.bar}">The world, ranked in numbers</div>
        <div class="f" style="background:${C.accent};color:${C.bg};border-radius:999px;padding:22px 52px;font-size:48px;font-weight:700;white-space:nowrap">Follow ${esc(D.handle)}</div></div>`;
      const g = e.querySelector('.g'), n = e.querySelector('.n'), u = e.querySelector('.u'), f = e.querySelector('.f');
      return t => { g.style.transform = `scale(${back(seg(t, 0, 0.45))})`; [n, u].forEach((x, i) => { const p = ease(seg(t, 0.2 + i * 0.15, 0.6 + i * 0.15)); x.style.opacity = p; x.style.transform = `translateY(${(1 - p) * 40}px)`; }); const pf = back(seg(t, 0.6, 1)); f.style.transform = `scale(${pf * (1 + 0.04 * Math.sin(t * 7))})`; f.style.opacity = clamp(pf); };
    },
  };
  const draws = S.map((s, i) => B[s.type](els[i], s));

  window.frame = t => {
    let i = starts.findIndex((st, k) => t >= st && t < st + S[k].dur); if (i < 0) i = S.length - 1;
    els.forEach((e, k) => { e.style.display = k === i ? 'block' : 'none'; });
    const lt = t - starts[i], d = S[i].dur;
    // punchy cut: each scene enters with a short zoom, the last one stays
    const z = 1 + 0.08 * (1 - ease(seg(lt, 0, 0.35))) + 0.02 * (lt / d);
    els[i].style.transform = `scale(${z})`;
    els[i].style.opacity = i === S.length - 1 ? 1 : Math.min(1, 1 - seg(lt, d - 0.12, d));
    draws[i](lt);
    // flash on every cut and on each shouted word
    const hits = [...starts.slice(1), ...(S[0].words || []).map(w => w.at)];
    flash.style.opacity = Math.max(0, ...hits.map(h => (t >= h && t < h + 0.18 ? 0.35 * (1 - (t - h) / 0.18) : 0)));
    map.style.transform = `translate(${-t * 6}px, ${Math.sin(t / 3) * 10}px) scale(${1.05 + t * 0.004})`;
  };
  window.ready = true;
})();
