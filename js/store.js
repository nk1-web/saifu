// データは端末内（localStorage）だけに置く。サーバーもログインもなし。
import { monthKey } from './fmt.js';

const KEY = 'saifu.v1';
const listeners = new Set();

export const CATEGORIES = [
  { id: 'food', label: '食費', color: 'var(--c-food)' },
  { id: 'eat', label: '外食', color: 'var(--c-eat)' },
  { id: 'daily', label: '日用品', color: 'var(--c-daily)' },
  { id: 'move', label: '交通', color: 'var(--c-move)' },
  { id: 'fun', label: '娯楽', color: 'var(--c-fun)' },
  { id: 'sub', label: 'サブスク', color: 'var(--c-sub)' },
  { id: 'other', label: 'その他', color: 'var(--c-other)' },
];
export const INCOME_CATEGORY = { id: 'income', label: '収入', color: 'var(--c-income)' };
export const TRANSFER_CATEGORY = { id: 'transfer', label: '移動', color: 'var(--c-transfer)' };
export const categoryOf = (id) =>
  id === 'income' ? INCOME_CATEGORY : id === 'transfer' ? TRANSFER_CATEGORY : CATEGORIES.find((c) => c.id === id) || CATEGORIES[6];

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

function defaults() {
  return {
    version: 1,
    accounts: [
      { id: 'bank', name: '銀行', kind: 'bank', initial: 0 },
      { id: 'cash', name: '現金', kind: 'cash', initial: 0 },
      { id: 'paypay', name: 'PayPay', kind: 'pay', initial: 0 },
      { id: 'pasmo', name: 'PASMO', kind: 'ic', initial: 0 },
    ],
    // {id, type:'expense'|'income'|'transfer', amount, date, accountId, toAccountId, category, shop, memo, source, createdAt}
    tx: [],
    // {id, name, amount, accountId, category, repeat:'once'|'monthly', date, day, doneOnce, doneMonths:[]}
    planned: [],
    savings: { monthly: 0, overrides: {}, startMonth: monthKey(), manual: {} },
    stop: { minutes: 10, reasons: [], savedTotal: 0, log: [], active: null },
    shopCategory: {},
    settings: { balanceMode: 'current' },
  };
}

function migrate(raw) {
  const d = defaults();
  const s = { ...d, ...raw };
  s.savings = { ...d.savings, ...(raw.savings || {}) };
  s.stop = { ...d.stop, ...(raw.stop || {}) };
  s.settings = { ...d.settings, ...(raw.settings || {}) };
  s.accounts = Array.isArray(raw.accounts) ? raw.accounts : d.accounts;
  s.tx = Array.isArray(raw.tx) ? raw.tx : [];
  s.planned = Array.isArray(raw.planned) ? raw.planned : [];
  s.shopCategory = raw.shopCategory && typeof raw.shopCategory === 'object' ? raw.shopCategory : {};
  return s;
}

let state;
try {
  const raw = localStorage.getItem(KEY);
  state = raw ? migrate(JSON.parse(raw)) : defaults();
} catch {
  state = defaults();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export const get = () => state;

export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- 取引 ----------

export function addTx(tx) {
  const t = { id: uid(), createdAt: Date.now(), source: 'manual', memo: '', shop: '', ...tx };
  update((s) => {
    s.tx.push(t);
    learnShop(s, t);
  });
  return t;
}
export function updateTx(id, patch) {
  update((s) => {
    const t = s.tx.find((x) => x.id === id);
    if (t) {
      Object.assign(t, patch);
      learnShop(s, t);
    }
  });
}
export function removeTx(id) {
  update((s) => (s.tx = s.tx.filter((x) => x.id !== id)));
}
// 店名とカテゴリの対応を覚える。次に同じ店を読み取ったとき自動で入る
function learnShop(s, t) {
  if (t.type !== 'expense' || !t.shop || !t.category) return;
  s.shopCategory[normShop(t.shop)] = t.category;
}
export const normShop = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[ー－-]/g, '')
    .slice(0, 24);

// ---------- 手段 ----------

export function addAccount(a) {
  const acc = { id: uid(), name: '', kind: 'other', initial: 0, ...a };
  update((s) => s.accounts.push(acc));
  return acc;
}
export function updateAccount(id, patch) {
  update((s) => Object.assign(s.accounts.find((a) => a.id === id) || {}, patch));
}
export function removeAccount(id) {
  update((s) => (s.accounts = s.accounts.filter((a) => a.id !== id)));
}
export function accountUsage(id) {
  const s = state;
  return s.tx.filter((t) => t.accountId === id || t.toAccountId === id).length + s.planned.filter((p) => p.accountId === id).length;
}

// ---------- 予定支出 ----------

export function addPlanned(p) {
  const item = { id: uid(), name: '', amount: 0, accountId: state.accounts[0]?.id, category: 'other', repeat: 'once', date: '', day: 1, doneOnce: false, doneMonths: [], ...p };
  update((s) => s.planned.push(item));
  return item;
}
export function updatePlanned(id, patch) {
  update((s) => Object.assign(s.planned.find((p) => p.id === id) || {}, patch));
}
export function removePlanned(id) {
  update((s) => (s.planned = s.planned.filter((p) => p.id !== id)));
}

// ---------- バックアップ ----------

export function exportJSON() {
  return JSON.stringify({ app: 'saifu', exportedAt: new Date().toISOString(), data: state }, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  const raw = parsed?.app === 'saifu' && parsed.data ? parsed.data : parsed;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.accounts)) throw new Error('saifu のバックアップではありません');
  state = migrate(raw);
  save();
  listeners.forEach((l) => l(state));
}
export function resetAll() {
  state = defaults();
  save();
  listeners.forEach((l) => l(state));
}
