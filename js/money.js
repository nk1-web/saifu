// 残高・使える残高・予定・貯金の計算。表示側はここの結果を並べるだけ。
import { dayKey, monthKey, daysInMonth, addMonths } from './fmt.js';

const pad = (n) => String(n).padStart(2, '0');

// 手段ごとの残高
export function balances(s) {
  const by = {};
  s.accounts.forEach((a) => (by[a.id] = Number(a.initial) || 0));
  for (const t of s.tx) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') by[t.accountId] = (by[t.accountId] ?? 0) - amt;
    else if (t.type === 'income') by[t.accountId] = (by[t.accountId] ?? 0) + amt;
    else if (t.type === 'transfer') {
      by[t.accountId] = (by[t.accountId] ?? 0) - amt;
      by[t.toAccountId] = (by[t.toAccountId] ?? 0) + amt;
    }
  }
  const total = s.accounts.reduce((sum, a) => sum + (by[a.id] || 0), 0);
  return { by, total };
}

// ---------- 予定支出 ----------

// 予定の「次の支払日」。済んでいれば次の月へ。
export function nextDue(p, today = dayKey()) {
  if (p.repeat === 'monthly') {
    let ym = today.slice(0, 7);
    for (let i = 0; i < 24; i++) {
      if (!(p.doneMonths || []).includes(ym)) {
        const d = Math.min(Number(p.day) || 1, daysInMonth(ym));
        return `${ym}-${pad(d)}`;
      }
      ym = addMonths(ym, 1);
    }
    return null;
  }
  return p.doneOnce ? null : p.date || today;
}

// 使用予定として残高から引く分：単発は未処理のもの全部、毎月は今月分（まだ記録していなければ）
export function upcoming(s, today = dayKey()) {
  const ym = today.slice(0, 7);
  const items = [];
  for (const p of s.planned) {
    const due = nextDue(p, today);
    if (!due) continue;
    if (p.repeat === 'monthly' && due.slice(0, 7) !== ym) continue;
    items.push({ p, due, amount: Number(p.amount) || 0 });
  }
  items.sort((a, b) => a.due.localeCompare(b.due));
  return { items, total: items.reduce((x, i) => x + i.amount, 0) };
}

// 予定日が来ている（今日以前）のに未処理のもの
export function dueNow(s, today = dayKey()) {
  return s.planned
    .map((p) => ({ p, due: nextDue(p, today), amount: Number(p.amount) || 0 }))
    .filter((x) => x.due && x.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due));
}

// ---------- 貯金 ----------

export function savingsTarget(s, ym) {
  const o = s.savings.overrides?.[ym];
  return o != null && o !== '' ? Number(o) || 0 : Number(s.savings.monthly) || 0;
}

// その月の収入−支出（移動は含まない）
export function monthNet(s, ym) {
  let income = 0;
  let expense = 0;
  for (const t of s.tx) {
    if (!t.date?.startsWith(ym)) continue;
    const a = Number(t.amount) || 0;
    if (t.type === 'income') income += a;
    else if (t.type === 'expense') expense += a;
  }
  return { income, expense, net: income - expense };
}

// 開始月から今月までの月ごとの達成状況と累計
export function savingsSummary(s, today = dayKey()) {
  const thisMonth = today.slice(0, 7);
  const start = s.savings.startMonth || thisMonth;
  const months = [];
  let ym = start <= thisMonth ? start : thisMonth;
  let cumulative = 0;
  for (let i = 0; i < 240 && ym <= thisMonth; i++) {
    const target = savingsTarget(s, ym);
    const { net, income, expense } = monthNet(s, ym);
    const manual = s.savings.manual?.[ym];
    const isCurrent = ym === thisMonth;
    const auto = net >= target && target > 0;
    const achieved = manual != null ? manual : isCurrent ? null : auto;
    const row = { ym, target, net, income, expense, achieved, manual, isCurrent };
    if (achieved === true) cumulative += target;
    months.push(row);
    ym = addMonths(ym, 1);
  }
  months.reverse();
  const current = months.find((m) => m.isCurrent) || { target: savingsTarget(s, thisMonth), net: 0 };
  return { months, cumulative, thisMonth, currentTarget: current.target, currentNet: current.net };
}

// ---------- 推移（グラフ用） ----------

// 今月を最後にした直近 n か月。記録が始まる前の月は省く（最低1か月）
export function recentMonths(s, n, today = dayKey()) {
  const thisMonth = today.slice(0, 7);
  const first = s.tx.reduce((m, t) => (t.date && t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), thisMonth);
  const out = [];
  let ym = thisMonth;
  for (let i = 0; i < n; i++) {
    out.unshift(ym);
    ym = addMonths(ym, -1);
    if (ym < first) break;
  }
  return out;
}

// 月ごと・カテゴリごとの支出 { ym: { cat: 金額 } }
export function expenseByMonth(s, months) {
  const set = new Set(months);
  const out = Object.fromEntries(months.map((m) => [m, {}]));
  for (const t of s.tx) {
    if (t.type !== 'expense' || !t.date) continue;
    const ym = t.date.slice(0, 7);
    if (!set.has(ym)) continue;
    out[ym][t.category] = (out[ym][t.category] || 0) + (Number(t.amount) || 0);
  }
  return out;
}

// ---------- ホーム用のまとめ ----------

export function overview(s, today = dayKey()) {
  const bal = balances(s);
  const up = upcoming(s, today);
  const sv = savingsSummary(s, today);
  // 今月の貯金はまだ確定していないので「予定」として引く。達成確定した月は累計として確保しておく
  const reserveThisMonth = sv.months.find((m) => m.isCurrent)?.achieved === true ? 0 : sv.currentTarget;
  const available = bal.total - up.total - reserveThisMonth - sv.cumulative;
  return {
    total: bal.total,
    by: bal.by,
    upcomingTotal: up.total,
    upcomingItems: up.items,
    savingsThisMonth: reserveThisMonth,
    savingsCumulative: sv.cumulative,
    available,
    due: dueNow(s, today),
  };
}

export { monthKey };
