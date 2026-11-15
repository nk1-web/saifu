import * as store from '../store.js';
import { CATEGORIES, categoryOf } from '../store.js';
import { h, esc, refs } from '../ui.js';
import { icons } from '../icons.js';
import { yen, yenPlain, monthKey, monthLabel, addMonths, dayLabel } from '../fmt.js';
import { monthNet } from '../money.js';
import { openTxEditor } from '../editors.js';
import { txRow } from './home.js';

export function createHistory(ctx) {
  let ym = monthKey();
  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>履歴</h1></header>
        <div class="month-nav">
          <button class="round-btn" data-ref="prev" aria-label="前の月">${icons.chevronL}</button>
          <h2 data-ref="title"></h2>
          <button class="round-btn" data-ref="next" aria-label="次の月">${icons.chevronR}</button>
        </div>
        <div class="summary">
          <div class="card box"><div class="k">支出</div><div class="v num" data-ref="exp"></div></div>
          <div class="card box"><div class="k">収入</div><div class="v num is-plus" data-ref="inc"></div></div>
        </div>
        <div class="card" style="margin-top:10px" data-ref="barsCard"><div class="bars" data-ref="bars"></div></div>
        <div data-ref="list"></div>
      </div>
    </div>`);
  const r = refs(el);
  r.prev.addEventListener('click', () => {
    ym = addMonths(ym, -1);
    refresh();
  });
  r.next.addEventListener('click', () => {
    ym = addMonths(ym, 1);
    refresh();
  });
  r.list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const tx = store.get().tx.find((t) => t.id === b.dataset.id);
    if (tx) openTxEditor({ tx });
  });

  function refresh() {
    const s = store.get();
    r.title.textContent = monthLabel(ym);
    const { income, expense } = monthNet(s, ym);
    r.exp.textContent = yen(expense);
    r.inc.textContent = yen(income);

    const byCat = {};
    s.tx.filter((t) => t.type === 'expense' && t.date?.startsWith(ym)).forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0)));
    const cats = CATEGORIES.filter((c) => byCat[c.id]).sort((a, b) => byCat[b.id] - byCat[a.id]);
    const max = Math.max(1, ...cats.map((c) => byCat[c.id]));
    r.barsCard.hidden = !cats.length;
    r.bars.innerHTML = cats
      .map((c) => `<div class="bar" style="--c:${c.color}"><span class="k">${esc(c.label)}</span><span class="track"><i style="width:${Math.round((byCat[c.id] / max) * 100)}%"></i></span><span class="v num">${yen(byCat[c.id])}</span></div>`)
      .join('');

    const list = s.tx.filter((t) => t.date?.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    if (!list.length) {
      r.list.innerHTML = '<div class="empty">この月の記録はありません</div>';
      return;
    }
    const groups = new Map();
    list.forEach((t) => {
      if (!groups.has(t.date)) groups.set(t.date, []);
      groups.get(t.date).push(t);
    });
    r.list.innerHTML = [...groups.entries()]
      .map(([day, items]) => {
        const sum = items.reduce((x, t) => x + (t.type === 'expense' ? Number(t.amount) || 0 : 0), 0);
        return `<div class="day-head"><span>${dayLabel(day)}</span><span class="num">${sum ? `支出 ${yen(sum)}` : ''}</span></div><div class="card">${items.map((t) => txRow(t, s)).join('')}</div>`;
      })
      .join('');
  }

  return {
    el,
    refresh,
    onShow() {
      ym = monthKey();
    },
  };
}
