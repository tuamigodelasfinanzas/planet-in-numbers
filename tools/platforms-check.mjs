// Diagnostic (prints no secrets): what the Meta token can do on the Facebook page.
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), PAGE = process.env.FB_PAGE || '1408475052349182';
const out = [];
const j = async u => { try { const r = await fetch(u); return await r.json(); } catch (e) { return { error: { message: e.message } }; } };
out.push('token type: ' + (token.startsWith('IG') ? 'Instagram Login (IG…)' : token.startsWith('EAA') ? 'Facebook Login (EAA…)' : token ? 'other' : 'MISSING'));
if (token.startsWith('EAA')) {
  const G = 'https://graph.facebook.com/v21.0';
  const p = await j(`${G}/me/permissions?access_token=${token}`);
  out.push('permissions: ' + (p.data ? p.data.filter(x => x.status === 'granted').map(x => x.permission).join(', ') : JSON.stringify(p.error?.message)));
  const pg = await j(`${G}/${PAGE}?fields=name,access_token&access_token=${token}`);
  out.push('page: ' + (pg.name || '-') + ' · page token: ' + (pg.access_token ? 'YES' : 'NO ' + (pg.error?.message || '')));
  if (pg.access_token) {
    const v = await j(`${G}/${PAGE}/video_reels?fields=id,description&limit=3&access_token=${pg.access_token}`);
    out.push('reels read: ' + (v.data ? v.data.length + ' ok' : v.error?.message));
    const id = v.data?.[0]?.id;
    if (id) { const c = await j(`${G}/${id}/comments?fields=id,from,message&limit=5&access_token=${pg.access_token}`); out.push('comments read: ' + (c.data ? c.data.length + ' ok' : c.error?.message)); }
    const d = await j(`${G}/debug_token?input_token=${pg.access_token}&access_token=${pg.access_token}`);
    out.push('page token expires: ' + (d.data ? (d.data.expires_at ? new Date(d.data.expires_at * 1000).toISOString() : 'never') : d.error?.message));
  }
}
console.log(out.join('\n'));
