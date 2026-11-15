import * as store from '../store.js';
import { h, esc, refs, toast, haptic } from '../ui.js';
import { promptSheet } from '../sheet.js';
import { yen, yenPlain, toNumber, monthLabel, monthKey } from '../fmt.js';
import { savingsSummary } from '../money.js';

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
    r.months.innerHTML = sv.months
      .map((m) => {
        const cls = m.achieved === true ? 'is-ok' : m.achieved === false ? 'is-ng' : m.isCurrent ? 'is-now' : '';
        const label = m.achieved === true ? '達成' : m.achieved === false ? '未達' : m.isCurrent ? '今月' : '－';
        const override = s.savings.overrides?.[m.ym] != null;
        return `<div class="row"><div class="main"><div class="title">${monthLabel(m.ym)}${m.manual != null ? '<span class="badge">手動</span>' : ''}</div><div class="meta num is-wrap">残り ${yen(m.net, { sign: true })}（収入 ${yen(m.income)} ／ 支出 ${yen(m.expense)}）</div></div><button class="amt num" data-act="override" data-ym="${m.ym}" style="color:${override ? 'var(--accent)' : 'inherit'}">${yen(m.target)}</button><button class="status ${cls}" data-act="toggle" data-ym="${m.ym}">${label}</button></div>`;
      })
      .join('');
  }

  return { el, refresh };
}
