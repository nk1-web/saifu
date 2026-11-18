import * as store from '../store.js';
import { h, esc, refs, toast, haptic } from '../ui.js';
import { promptSheet } from '../sheet.js';
import { yen, yenPlain, toNumber, monthLabel, monthKey, monthShort } from '../fmt.js';
import { savingsSummary } from '../money.js';
import { columnChart, lineChart, legend } from '../charts.js';

const STATUS = {
  ok: { color: 'var(--good)', label: '達成' },
  ng: { color: 'var(--critical)', label: '未達' },
  now: { color: 'var(--ink-3)', label: '今月（途中）' },
};
const statusOf = (m) => (m.achieved === true ? 'ok' : m.achieved === false ? 'ng' : 'now');

function renderCharts(r, sv) {
  // 古い順に並べ直し、多すぎるときは直近12か月だけ
  const months = [...sv.months].reverse().slice(-12);
  const all = [...sv.months].reverse();
  let cum = 0;
  const cumByYm = {};
  all.forEach((m) => {
    if (m.achieved === true) cum += m.target;
    cumByYm[m.ym] = cum;
  });
  const cats = months.map((m) => ({ label: monthShort(m.ym), title: `${monthLabel(m.ym)}${m.isCurrent ? '（今月）' : ''}` }));

  lineChart(r.cumChart, {
    cats,
    values: months.map((m) => cumByYm[m.ym]),
    color: 'var(--ink)',
    height: 170,
    emptyText: 'まだ達成した月がありません。達成すると、ここに累計が伸びていきます',
    tooltip: (i) => {
      const m = months[i];
      const st = STATUS[statusOf(m)];
      return {
        title: cats[i].title,
        total: yen(cumByYm[m.ym]),
        rows: [{ color: st.color, value: m.achieved === true ? `+${yen(m.target)}` : yen(0), label: `この月 ${st.label}` }],
      };
    },
  });

  columnChart(r.netChart, {
    cats,
    series: [{ id: 'net', label: '残り', color: 'var(--ink-3)' }],
    values: months.map((m) => [m.net]),
    colorAt: (i) => STATUS[statusOf(months[i])].color,
    marks: months.map((m, i) => ({ i, value: m.target })),
    height: 200,
    emptyText: '収入や支出を記録すると、月ごとの残りが出ます',
    tooltip: (i) => {
      const m = months[i];
      const st = STATUS[statusOf(m)];
      const diff = m.net - m.target;
      return {
        title: cats[i].title,
        total: yen(m.net, { sign: true }),
        rows: [
          { color: 'var(--ink)', value: yen(m.target), label: '目標' },
          { color: 'var(--c-income)', value: yen(m.income), label: '収入' },
          { color: 'var(--ink-2)', value: yen(m.expense), label: '支出' },
        ],
        note: `${st.label}${m.isCurrent ? '' : ''} ・ 目標まで ${diff >= 0 ? `${yen(diff)} 余裕` : `${yen(-diff)} 足りない`}`,
      };
    },
  });
  r.netLegend.replaceChildren(
    legend([
      { label: '達成', color: STATUS.ok.color },
      { label: '未達', color: STATUS.ng.color },
      { label: '今月（途中）', color: STATUS.now.color },
      { label: '目標', color: 'var(--ink)', shape: 'line' },
    ])
  );
}

export function createSavings(ctx) {
  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>貯金</h1><span class="sub">使わないお金</span></header>
        <div class="hero">
          <div><div class="k">今月の貯金予定</div><div class="v num" data-ref="cur"></div></div>
          <div><div class="k">これまでの貯金累計</div><div class="v num" data-ref="cum"></div></div>
        </div>
        <div class="section-title">設定</div>
        <div class="card">
          <button class="row" data-ref="monthly"><div class="main"><div class="title">毎月の貯金額</div><div class="meta">基本はこの金額。月ごとに変えられます</div></div><span class="amt num" data-ref="monthlyV"></span></button>
          <div class="row"><div class="main"><div class="title">数え始める月</div><div class="meta">この月から達成を見ます</div></div><input data-ref="start" type="month" style="border:0;background:none;font-weight:800;font-size:15px;text-align:right;outline:0"></div>
        </div>
        <div class="section-title">推移</div>
        <div class="card chart-card">
          <div class="chart-head"><span class="t">貯金の累計</span><span class="d">達成した月の分を足したもの</span></div>
          <div data-ref="cumChart"></div>
        </div>
        <div class="card chart-card">
          <div class="chart-head"><span class="t">毎月の残りと目標</span><span class="d">残り = 収入 − 支出</span></div>
          <div data-ref="netChart"></div>
          <div data-ref="netLegend"></div>
        </div>
        <div class="section-title">月ごとの達成</div>
        <div class="card" data-ref="months"></div>
        <p class="settings-note">達成の判定は「その月の収入 − 支出 ≧ 貯金額」。右の印をタップすると、手で達成・未達に直せます。金額をタップすると、その月だけ別の額にできます（ボーナス月など）。達成した月の貯金は「確保ずみ」として使える残高から外します。</p>
      </div>
    </div>`);
  const r = refs(el);

  r.monthly.addEventListener('click', async () => {
    const s = store.get();
    const v = await promptSheet({ title: '毎月の貯金額', label: '金額', value: s.savings.monthly ? yenPlain(s.savings.monthly) : '', placeholder: '20000', type: 'text', unit: '円' });
    if (v == null) return;
    store.update((st) => (st.savings.monthly = Math.max(0, Math.round(toNumber(v)))));
    toast('毎月の貯金額を変えました');
  });
  r.start.addEventListener('change', () => {
    if (!/^\d{4}-\d{2}$/.test(r.start.value)) return;
    store.update((st) => (st.savings.startMonth = r.start.value));
  });
  r.months.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const ym = b.dataset.ym;
    const s = store.get();
    if (b.dataset.act === 'override') {
      const cur = s.savings.overrides?.[ym];
      const v = await promptSheet({ title: `${monthLabel(ym)}の貯金額`, label: 'この月だけ', value: cur != null ? yenPlain(cur) : '', placeholder: `空にすると毎月の額（${yenPlain(s.savings.monthly)}）`, type: 'text', unit: '円' });
      if (v == null) return;
      store.update((st) => {
        if (!st.savings.overrides) st.savings.overrides = {};
        if (String(v).trim() === '') delete st.savings.overrides[ym];
        else st.savings.overrides[ym] = Math.max(0, Math.round(toNumber(v)));
      });
    } else if (b.dataset.act === 'toggle') {
      haptic();
      // 自動 → 達成 → 未達 → 自動
      store.update((st) => {
        if (!st.savings.manual) st.savings.manual = {};
        const m = st.savings.manual[ym];
        if (m == null) st.savings.manual[ym] = true;
        else if (m === true) st.savings.manual[ym] = false;
        else delete st.savings.manual[ym];
      });
    }
  });

  function refresh() {
    const s = store.get();
    const sv = savingsSummary(s);
    r.cur.textContent = yen(sv.currentTarget);
    r.cum.textContent = yen(sv.cumulative);
    r.monthlyV.textContent = yen(s.savings.monthly || 0);
    r.start.value = s.savings.startMonth || monthKey();
    renderCharts(r, sv);
    r.months.innerHTML = sv.months
      .map((m) => {
        const cls = m.achieved === true ? 'is-ok' : m.achieved === false ? 'is-ng' : m.isCurrent ? 'is-now' : '';
        const label = m.achieved === true ? '達成' : m.achieved === false ? '未達' : m.isCurrent ? '今月' : '－';
        const override = s.savings.overrides?.[m.ym] != null;
        return `<div class="row"><div class="main"><div class="title">${monthLabel(m.ym)}${m.manual != null ? '<span class="badge">手動</span>' : ''}</div><div class="meta num is-wrap">残り ${yen(m.net, { sign: true })}（収入 ${yen(m.income)} ／ 支出 ${yen(m.expense)}）</div></div><button class="amt num" data-act="override" data-ym="${m.ym}" style="color:${override ? 'var(--accent)' : 'inherit'}">${yen(m.target)}</button><button class="status ${cls}" data-act="toggle" data-ym="${m.ym}">${label}</button></div>`;
      })
      .join('');
  }

  let rw = 0;
  window.addEventListener('resize', () => {
    if (el.hidden || Math.abs(window.innerWidth - rw) < 2) return;
    rw = window.innerWidth;
    refresh();
  });

  return { el, refresh };
}
