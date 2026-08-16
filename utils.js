export const uid = (prefix='id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

export function todayISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
}

export function addDaysISO(days) {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

export function formatDate(value, options={}) {
  if (!value) return 'No due date';
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', ...options }).format(d);
}

export function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(d);
}

export function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export function parseTags(value='') {
  return [...new Set(value.split(',').map(v => v.trim().replace(/^#/, '')).filter(Boolean))].slice(0,12);
}

export function tagsText(tags=[]) { return tags.map(t => `#${t}`).join(' '); }

export function priorityRank(p) { return ({high:3, medium:2, low:1}[p] ?? 0); }

export function safeText(value='') { return String(value).trim(); }

export function formatBytes(bytes=0) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes/1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb/1024).toFixed(1)} MB`;
}

export function formatDuration(seconds=0) {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, Math.round(seconds));
  const min = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2,'0');
  return `${min}:${sec}`;
}

export function debounce(fn, delay=220) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

export function isToday(date) { return Boolean(date) && date === todayISO(); }
export function isUpcoming(date) { return Boolean(date) && date > todayISO(); }
