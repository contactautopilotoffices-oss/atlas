// Tiny markdown for the assumptions files: headings, nested bullets, paragraphs, **bold**, `code`, tables.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
export function md(src) {
  const out = [], lines = src.replace(/\r/g, '').split('\n'); let stack = [], para = [], table = null;
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeLists = (to = 0) => { while (stack.length > to) { out.push('</li></ul>'); stack.pop(); } };
  const flushT = () => { if (!table) return; out.push('<table>' + table.map((r, i) => `<tr>${r.map(c => `<td>${i ? inline(c) : '<b>' + inline(c) + '</b>'}</td>`).join('')}</tr>`).join('') + '</table>'); table = null; };
  for (const raw of lines) {
    const h = raw.match(/^(#{1,6})\s+(.*)/), li = raw.match(/^(\s*)[-*]\s+(.*)/), tr = raw.match(/^\s*\|(.*)\|\s*$/);
    if (tr) { flushP(); closeLists(); if (/^[\s|:-]+$/.test(tr[1])) continue; (table = table || []).push(tr[1].split('|').map(c => c.trim())); continue; } else flushT();
    if (h) { flushP(); closeLists(); out.push(`<h3>${inline(h[2])}</h3>`); continue; }
    if (li) { flushP(); const depth = Math.floor(li[1].length / 2) + 1;
      if (depth > stack.length) { while (stack.length < depth) { out.push('<ul><li>'); stack.push(1); } }
      else { closeLists(depth); out.push('</li><li>'); }
      out.push(inline(li[2])); continue; }
    if (!raw.trim()) { flushP(); continue; }
    if (stack.length && /^\s+/.test(raw)) { out.push(' ' + inline(raw.trim())); continue; }
    closeLists(); para.push(raw.trim());
  }
  flushP(); flushT(); closeLists(); return out.join('');
}
