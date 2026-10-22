// One voice line per carousel slide (used by the vertical video and by the carousel's own slide videos).
// Top 20 lists count DOWN (20 → 1), so the voice names the countries in the order they appear.
import { sentence } from './hooks.mjs';

const noEmoji = s => String(s || '').replace(/\p{Extended_Pictographic}|\u{FE0F}|[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
const WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export function slideVoices(item) {
  const S = item.slides || [];
  return S.map((s, i) => {
    if (i === 0) {
      if (item.series === 'versus') return `${s.a?.name} versus ${s.b?.name}. Five rounds. Who wins?`;
      if (item.series === 'week') return 'The week in numbers. Five facts from this week.';
      return `${sentence(noEmoji(item.title))} The top 20, counting down to number one.`;
    }
    if (s.type === 'list') {
      return s.rows.map(r => (r.rank === 1 ? `And number one… ${r.name}!` : `${(WORD[r.rank] || String(r.rank)).replace(/^./, c => c.toUpperCase())}: ${r.name}.`)).join(' ');
    }
    if (s.type === 'vs-metric') {
      const w = s.win === 'a' ? s.a : s.win === 'b' ? s.b : null;
      return `${s.label}: ${w ? `${w.name} wins` : 'no points here'}.`;
    }
    if (s.type === 'fact') return `${noEmoji(s.label)}: ${s.name}.`;
    if (s.type === 'vs-end') return `${noEmoji(s.verdict)}. Which one would you pick? Comment it!`;
    if (s.type === 'end') return item.series === 'week' ? 'Which one surprised you most? Comment it!' : "Comment your country, and I'll tell you its rank.";
    return '';
  });
}
