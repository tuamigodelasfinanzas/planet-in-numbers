// Facebook page + YouTube channel comments, with the same shape for both platforms:
//   posts()            → [{ id, caption }]                 (latest posts, caption first line = our item key)
//   comments(post)     → [{ id, text, username, timestamp, answered }]
//   reply(commentId, text)
// Facebook: page token derived from the Meta token (needs pages_show_list, pages_read_engagement, pages_manage_engagement).
// YouTube: calls go through the Make webhook (Make holds the YouTube sign-in), status "yt_api".
const FB_PAGE = process.env.FB_PAGE || '1408475052349182';
const G = 'https://graph.facebook.com/v21.0';

export async function facebook(metaToken) {
  const token = String(metaToken || '').replace(/[\s"']/g, '');
  if (!token.startsWith('EAA')) return { error: 'no Facebook token' };
  const get = async (p, q = {}, tk) => { const r = await fetch(`${G}/${p}?${new URLSearchParams({ ...q, access_token: tk })}`); const j = await r.json().catch(() => ({})); if (j.error) throw new Error(j.error.message); return j; };
  let pt;
  try { pt = (await get(FB_PAGE, { fields: 'access_token' }, token)).access_token; } catch (e) { return { error: e.message.slice(0, 160) }; }
  if (!pt) return { error: 'the token has no access to the page (pages_read_engagement / pages_manage_engagement)' };
  return {
    name: 'facebook',
    async posts() {
      const reels = (await get(`${FB_PAGE}/video_reels`, { fields: 'id,description,created_time', limit: 15 }, pt).catch(() => ({}))).data || [];
      const feed = (await get(`${FB_PAGE}/posts`, { fields: 'id,message,created_time', limit: 10 }, pt).catch(() => ({}))).data || [];
      return [...reels.map(r => ({ id: r.id, caption: r.description, at: r.created_time })), ...feed.map(p => ({ id: p.id, caption: p.message, at: p.created_time }))];
    },
    async comments(id, all = false) {
      const out = [];
      let url = `${G}/${id}/comments?${new URLSearchParams({ fields: 'id,message,from{id,name},created_time,comments.limit(25){from{id}}', filter: 'toplevel', limit: all ? 100 : 50, access_token: pt })}`;
      for (let n = 0; url && n < (all ? 30 : 1); n++) {
        const j = await (await fetch(url)).json(); if (j.error) throw new Error(j.error.message);
        for (const c of j.data || []) out.push({ id: c.id, text: c.message, username: c.from?.name || '', user: c.from?.id || c.from?.name || c.id, own: c.from?.id === FB_PAGE, timestamp: c.created_time, answered: (c.comments?.data || []).some(r => r.from?.id === FB_PAGE) });
        url = all ? j.paging?.next : null;
      }
      return out;
    },
    async reply(id, text) {
      const r = await fetch(`${G}/${id}/comments`, { method: 'POST', body: new URLSearchParams({ message: text, access_token: pt }) });
      const j = await r.json().catch(() => ({})); if (j.error) throw new Error(j.error.message); return j.id;
    },
  };
}

export async function youtube(hookUrl) {
  if (!hookUrl) return { error: 'no Make webhook' };
  const api = async (method, url, query = {}, body) => {
    const r = await fetch(hookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'yt_api', method, url, query: new URLSearchParams(query).toString(), body_json: body ? JSON.stringify(body) : '' }) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { throw new Error(`Make answered: ${t.slice(0, 120)}`); }
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error)); return j;
  };
  let channel;
  try { channel = (await api('GET', '/v3/channels', { part: 'id', mine: 'true' })).items?.[0]?.id; } catch (e) { return { error: e.message.slice(0, 160) }; }
  if (!channel) return { error: 'YouTube channel not found' };
  let threads = null;
  const loadThreads = async () => {
    if (threads) return threads;
    threads = (await api('GET', '/v3/commentThreads', { part: 'snippet,replies', allThreadsRelatedToChannelId: channel, maxResults: '100', order: 'time', textFormat: 'plainText' })).items || [];
    return threads;
  };
  return {
    name: 'youtube',
    async posts() {
      const ids = [...new Set((await loadThreads()).map(t => t.snippet.videoId).filter(Boolean))];
      if (!ids.length) return [];
      const v = (await api('GET', '/v3/videos', { part: 'snippet', id: ids.slice(0, 50).join(',') })).items || [];
      return v.map(x => ({ id: x.id, caption: x.snippet.description, title: x.snippet.title, at: x.snippet.publishedAt }));
    },
    async comments(videoId) {
      return (await loadThreads()).filter(t => t.snippet.videoId === videoId).map(t => {
        const s = t.snippet.topLevelComment.snippet;
        return { id: t.id, text: s.textOriginal || s.textDisplay, username: String(s.authorDisplayName || '').replace(/^@/, ''), user: s.authorChannelId?.value || s.authorDisplayName, own: s.authorChannelId?.value === channel, timestamp: s.publishedAt, answered: (t.replies?.comments || []).some(r => r.snippet.authorChannelId?.value === channel) };
      });
    },
    async reply(id, text) { return (await api('POST', '/v3/comments', { part: 'snippet' }, { snippet: { parentId: id, textOriginal: text } })).id; },
  };
}

// first line of a caption/description, to match a post with our item.json
export const key = s => String(s || '').split('\n')[0].replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
