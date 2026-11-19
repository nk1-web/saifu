import * as store from '../store.js';
import { CATEGORIES } from '../store.js';
import { h, esc, refs, haptic } from '../ui.js';
import { icons } from '../icons.js';
import { yen, monthKey, monthLabel, monthShort, addMonths, dayLabel } from '../fmt.js';
import { monthNet, recentMonths, expenseByMonth } from '../money.js';
import { openTxEditor } from '../editors.js';
import { lineChart, legend } from '../charts.js';
import { txRow } from './home.js';

const PERIODS = [6, 12];

export function createHistory(ctx) {
  let ym = monthKey();
  let mode = 'list'; // list | trend
  let period = 6;
  let split = 'total'; // total | category
  let focus = null; // 選んだジャンルだけを表示

  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>履歴</h1></header>
        <div class="seg" data-ref="modeSeg" style="margin-bottom:14px">
          <button type="button" data-mode="list" class="is-on">明細</button>
          <button type="button" data-mode="trend">推移</button>
        </div>

        <section data-ref="listPane">
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
        </section>

        <section data-ref="trendPane" hidden>
          <div class="filters">
            <div class="seg is-short" data-ref="periodSeg">${PERIODS.map((p) => `<button type="button" data-p="${p}" class="${p === period ? 'is-on' : ''}">${p}か月</button>`).join('')}</div>
            <div class="seg" data-ref="splitSeg">
              <button type="button" data-split="total" class="is-on">合計</button>
              <button type="button" data-split="category">ジャンル別</button>
            </div>
          </div>
          <div class="stat-row">
            <div class="card stat"><div class="k">今月の支出</div><div class="v num" data-ref="statNow"></div><div class="delta num" data-ref="statDelta"></div></div>
            <div class="card stat"><div class="k">月平均</div><div class="v num" data-ref="statAvg"></div></div>
          </div>
          <div class="card chart-card">
            <div class="chart-head"><span class="t" data-ref="chartTitle">支出の推移</span></div>
            <div data-ref="chart"></div>
            <div data-ref="legend"></div>
          </div>
          <div class="section-title" data-ref="tableTitle">内訳</div>
          <div class="card" data-ref="table"></div>
        </section>
      </div>
    </div>`);
  const r = refs(el);

  const setSeg = (seg, attr, val) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset[attr] === String(val)));

  r.modeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    setSeg(r.modeSeg, 'mode', mode);
    haptic();
    refresh();
  });
  r.periodSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    period = Number(b.dataset.p);
    setSeg(r.periodSeg, 'p', period);
    refresh();
  });
  r.splitSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-split]');
    if (!b) return;
    split = b.dataset.split;
    if (split === 'total') focus = null;
    setSeg(r.splitSeg, 'split', split);
    refresh();
  });
  // 凡例や表のジャンルを押すと、そのジャンルだけを表示（もう一度押すと全部に戻る）
  const toggleFocus = (id) => {
    focus = focus === id ? null : id;
    if (split !== 'category') {
      split = 'category';
      setSeg(r.splitSeg, 'split', split);
    }
    haptic();
    refresh();
  };
  r.legend.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) toggleFocus(b.dataset.id);
  });
  r.table.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b) toggleFocus(b.dataset.cat);
  });

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

  function renderList() {
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
      r.list.innerHTML = '<div class="empty">記録なし</div>';
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

  function renderTrend() {
    const s = store.get();
    const months = recentMonths(s, period);
    const data = expenseByMonth(s, months);
    const totalOf = (m) => Object.values(data[m]).reduce((a, v) => a + v, 0);
    const totals = months.map(totalOf);
    const thisMonth = months[months.length - 1];
    const now = totals[totals.length - 1];

    // 数字のまとめ
    r.statNow.textContent = yen(now);
    const prevYm = addMonths(thisMonth, -1);
    const prevTotal = months.includes(prevYm) ? totals[months.indexOf(prevYm)] : null;
    r.statDelta.textContent = prevTotal == null ? '' : `先月 ${yen(prevTotal)}`;
    const past = totals.slice(0, -1);
    const avg = past.length ? past.reduce((a, v) => a + v, 0) / past.length : now;
    r.statAvg.textContent = yen(avg);

    const cats = months.map((m) => ({ label: monthShort(m), title: `${monthLabel(m)}${m === thisMonth ? '（今月）' : ''}` }));
    const visible = focus ? CATEGORIES.filter((c) => c.id === focus) : CATEGORIES;

    if (split === 'total') {
      r.chartTitle.textContent = '支出の合計';
      lineChart(r.chart, {
        cats,
        series: [{ label: '支出', color: 'var(--ink)', values: totals, area: true }],
        height: 200,
        emptyText: '支出なし',
        tooltip: (i) => {
          const m = months[i];
          const rows = CATEGORIES.filter((c) => data[m][c.id]).sort((a, b) => data[m][b.id] - data[m][a.id]).slice(0, 4).map((c) => ({ color: c.color, value: yen(data[m][c.id]), label: c.label }));
          return { title: cats[i].title, total: yen(totals[i]), rows };
        },
      });
      r.legend.textContent = '';
    } else {
      const focused = visible[0];
      r.chartTitle.textContent = focus ? focused.label : 'ジャンル別';
      lineChart(r.chart, {
        cats,
        series: visible.map((c) => ({ label: c.label, color: c.color, values: months.map((m) => data[m][c.id] || 0), area: !!focus })),
        height: 200,
        emptyText: '支出なし',
        tooltip: (i) => {
          const m = months[i];
          const sum = visible.reduce((a, c) => a + (data[m][c.id] || 0), 0);
          if (focus) return { title: cats[i].title, total: yen(sum), rows: [] };
          const rows = visible.filter((c) => data[m][c.id]).sort((a, b) => data[m][b.id] - data[m][a.id]).map((c) => ({ color: c.color, value: yen(data[m][c.id]), label: c.label }));
          return { title: cats[i].title, total: yen(sum), rows };
        },
      });
      r.legend.replaceChildren(legend(CATEGORIES, { shape: 'line', active: focus }));
    }

    // 表：期間のジャンル別合計（グラフと同じ数字を、タップなしでも読めるように）
    const sums = Object.fromEntries(CATEGORIES.map((c) => [c.id, months.reduce((a, m) => a + (data[m][c.id] || 0), 0)]));
    const all = Object.values(sums).reduce((a, v) => a + v, 0);
    const rows = CATEGORIES.filter((c) => sums[c.id] > 0).sort((a, b) => sums[b.id] - sums[a.id]);
    r.table.innerHTML = rows.length
      ? rows
          .map(
            (c) =>
              `<button class="row ${focus === c.id ? 'is-on' : ''}" data-cat="${c.id}"><span class="dot" style="--c:${c.color}"></span><div class="main"><div class="title">${esc(c.label)}</div></div><span class="amt num">${yen(sums[c.id])}</span><span class="share num">${Math.round((sums[c.id] / all) * 100)}%</span></button>`
          )
          .join('') +
        `<div class="row"><div class="main"><div class="title">合計</div></div><span class="amt num">${yen(all)}</span><span class="share"></span></div>`
      : '<div class="empty">支出なし</div>';
  }

  function refresh() {
    r.listPane.hidden = mode !== 'list';
    r.trendPane.hidden = mode !== 'trend';
    if (mode === 'list') renderList();
    else renderTrend();
  }

  let rw = 0;
  window.addEventListener('resize', () => {
    if (el.hidden || mode !== 'trend' || Math.abs(window.innerWidth - rw) < 2) return;
    rw = window.innerWidth;
    renderTrend();
  });

  return {
    el,
    refresh,
    onShow() {
      ym = monthKey();
    },
  };
}
