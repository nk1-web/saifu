import * as store from '../store.js';
import { categoryOf } from '../store.js';
import { h, esc, refs } from '../ui.js';
import { yen, dayKey, dayLabel, daysUntil } from '../fmt.js';
import { upcoming, nextDue } from '../money.js';
import { openPlannedEditor, recordPlanned, markPlannedDone } from '../editors.js';

export function createPlan(ctx) {
  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>予定</h1><span class="sub">これから使うお金</span></header>
        <div class="hero">
          <div><div class="k">今後の使用予定</div><div class="v num" data-ref="total"></div></div>
          <div><div class="k">毎月の予定の合計</div><div class="v num" data-ref="monthly"></div></div>
        </div>
        <div class="section-title">予定の一覧</div>
        <div class="card" data-ref="list"></div>
        <div data-ref="doneWrap"></div>
        <p class="settings-note">予定日が来るとホームに出ます。「記録」で実際の支出として残高から引き、「なし」はその回だけ飛ばします。</p>
      </div>
    </div>`);
  const r = refs(el);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = store.get();
    const p = s.planned.find((x) => x.id === b.dataset.id);
    if (!p) return;
    const act = b.dataset.act;
    if (act === 'edit') openPlannedEditor({ item: p });
    else if (act === 'record') recordPlanned({ p, due: nextDue(p), amount: Number(p.amount) || 0 });
    else if (act === 'skip') markPlannedDone(p, nextDue(p));
    else if (act === 'revive') store.updatePlanned(p.id, { doneOnce: false });
    else if (act === 'remove') store.removePlanned(p.id);
  });

  function refresh() {
    const s = store.get();
    const today = dayKey();
    const up = upcoming(s, today);
    r.total.textContent = yen(up.total);
    r.monthly.textContent = yen(s.planned.filter((p) => p.repeat === 'monthly').reduce((x, p) => x + (Number(p.amount) || 0), 0));

    const active = s.planned
      .map((p) => ({ p, due: nextDue(p, today) }))
      .filter((x) => x.due)
      .sort((a, b) => a.due.localeCompare(b.due));
    r.list.innerHTML = active.length
      ? active
          .map(({ p, due }) => {
            const c = categoryOf(p.category);
            const acc = s.accounts.find((a) => a.id === p.accountId)?.name || '';
            const isDue = due <= today;
            const n = daysUntil(due);
            const when = isDue ? (n === 0 ? '今日' : `${-n}日すぎています`) : n === 1 ? '明日' : `${dayLabel(due)}`;
            return `<div class="row ${isDue ? 'is-due' : ''}"><span class="dot" style="--c:${c.color}"></span><button class="main" data-act="edit" data-id="${esc(p.id)}" style="text-align:left"><div class="title">${esc(p.name)}${p.repeat === 'monthly' ? `<span class="badge">毎月${p.day}日</span>` : ''}${isDue ? '<span class="badge is-due">予定日</span>' : ''}</div><div class="meta">${when} ・ ${esc(acc)} ・ ${c.label}</div></button><span class="amt num">${yen(p.amount)}</span>${
              isDue ? `<span class="btns"><button class="mini-btn is-primary" data-act="record" data-id="${esc(p.id)}">記録</button><button class="mini-btn" data-act="skip" data-id="${esc(p.id)}">なし</button></span>` : ''
            }</div>`;
          })
          .join('')
      : '<div class="empty">予定はまだありません。<br>右下の＋でサブスクや予定している出費を追加できます</div>';

    const done = s.planned.filter((p) => p.repeat === 'once' && p.doneOnce);
    r.doneWrap.innerHTML = done.length
      ? `<div class="section-title">済んだ予定</div><div class="card">${done
          .map((p) => `<div class="row"><span class="dot" style="--c:var(--ink-3)"></span><div class="main"><div class="title" style="color:var(--ink-3)">${esc(p.name)}</div><div class="meta">${dayLabel(p.date)}</div></div><span class="amt num is-muted">${yen(p.amount)}</span><span class="btns"><button class="mini-btn" data-act="revive" data-id="${esc(p.id)}">戻す</button><button class="mini-btn" data-act="remove" data-id="${esc(p.id)}">消す</button></span></div>`)
          .join('')}</div>`
      : '';
  }

  return { el, refresh, add: () => openPlannedEditor() };
}
