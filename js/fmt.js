// 日付と金額の表示まわり

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}
export function monthShort(ym) {
  const [, m] = ym.split('-').map(Number);
  return `${m}月`;
}
export const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export function dayLabel(key, { withYear = false } = {}) {
  const d = parseDay(key);
  const today = dayKey();
  if (key === today) return '今日';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y)) return '昨日';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (key === dayKey(t)) return '明日';
  const base = `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年${base}` : base;
}
export function daysUntil(key) {
  const a = parseDay(dayKey());
  const b = parseDay(key);
  return Math.round((b - a) / 86400000);
}

export function yen(n, { sign = false } = {}) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toLocaleString('ja-JP');
  if (sign && v > 0) return `+${s}円`;
  if (v < 0) return `-${s}円`;
  return `${s}円`;
}
export function yenPlain(n) {
  return Math.round(Number(n) || 0).toLocaleString('ja-JP');
}

// 全角数字・カンマなどを含む文字列を数値に
export function toNumber(s) {
  if (typeof s === 'number') return s;
  const t = String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^\d.-]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
