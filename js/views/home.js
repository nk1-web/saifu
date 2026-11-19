import * as store from '../store.js';
import { categoryOf } from '../store.js';
import { h, esc, refs, haptic } from '../ui.js';
import { icons, kindOf } from '../icons.js';
import { yen, yenPlain, dayKey, dayLabel, parseDay, WEEK } from '../fmt.js';
import { overview } from '../money.js';
import { openTxEditor, openAccountMenu, recordPlanned, markPlannedDone } from '../editors.js';
import { openStop, stopRemaining } from '../stop.js';

export function createHome(ctx) {
  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>saifu</h1><span class="sub" data-ref="today"></span></header>
        <button class="balance" data-ref="balance" aria-label="残高の表示を切り替え"></button>
        <div class="accounts" data-ref="accounts"></div>
        <div data-ref="due"></div>
        <button class="stop-btn" data-ref="stop">
          <span class="mark">${icons.stop}</span>
          <span><div class="t">衝動ストップ</div><div class="d" data-ref="stopD" hidden></div></span>
        </button>
        <div class="section-title">最近の記録<button class="more" data-ref="more">すべて${icons.chevronR}</button></div>
        <div class="card" data-ref="recent"></div>
      </div>
    </div>`);
  const r = refs(el);
  let stopTimer = null;

  r.balance.addEventListener('click', () => {
    haptic();
    store.update((s) => (s.settings.balanceMode = s.settings.balanceMode === 'available' ? 'current' : 'available'));
  });
  r.stop.addEventListener('click', openStop);
  r.more.addEventListener('click', () => ctx.go('history'));
  r.accounts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const a = store.get().accounts.find((x) => x.id === b.dataset.id);
    if (a) openAccountMenu(a);
  });
  r.due.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = store.get();
    const entry = overview(s).due.find((x) => x.p.id === b.dataset.id);
    if (!entry) return;
    if (b.dataset.act === 'record') recordPlanned(entry);
    else markPlannedDone(entry.p, entry.due);
  });
  r.recent.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const tx = store.get().tx.find((t) => t.id === b.dataset.id);
    if (tx) openTxEditor({ tx });
  });

  function renderStop() {
    const rem = stopRemaining();
    r.stop.classList.toggle('is-running', rem != null);
    if (rem == null) {
      r.stopD.hidden = true;
      if (stopTimer) {
        clearInterval(stopTimer);
        stopTimer = null;
      }
      return;
    }
    const a = store.get().stop.active;
    r.stopD.hidden = false;
    r.stopD.textContent = rem <= 0 ? `${yen(a.amount)} ・ 時間です` : `${yen(a.amount)} ・ 残り${Math.ceil(rem / 60000)}分`;
    if (!stopTimer) stopTimer = setInterval(renderStop, 15000);
  }

  function refresh() {
    const s = store.get();
    const o = overview(s);
    const today = dayKey();
    const d = parseDay(today);
    r.today.textContent = `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;

    const mode = s.settings.balanceMode === 'available' ? 'available' : 'current';
    const v = mode === 'available' ? o.available : o.total;
    r.balance.classList.toggle('is-negative', v < 0);
    r.balance.innerHTML = `
      <div class="label"><span>${mode === 'available' ? '使える残高' : '現在の残高'}</span><span class="mode"><i class="${mode === 'current' ? 'is-on' : ''}"></i><i class="${mode === 'available' ? 'is-on' : ''}"></i></span></div>
      <div class="big num">${v < 0 ? '-' : ''}${yenPlain(Math.abs(v))}<small>円</small></div>
      <div class="lines">
        <div><span>今後の使用予定</span><span class="num">合計 ${yen(o.upcomingTotal)}</span></div>
        <div><span>今月の貯金予定</span><span class="num">${yen(o.savingsThisMonth)}</span></div>
        ${o.savingsCumulative > 0 ? `<div><span>確保ずみの貯金</span><span class="num">${yen(o.savingsCumulative)}</span></div>` : ''}
      </div>`;

    r.accounts.innerHTML = s.accounts
      .map((a) => {
        const k = kindOf(a.kind);
        const b = o.by[a.id] || 0;
        return `<button class="acct" data-id="${esc(a.id)}" style="--c:${k.color}"><div class="name">${esc(a.name)}</div><div class="val num ${b < 0 ? 'is-neg' : ''}">${yen(b)}</div></button>`;
      })
      .join('');

    r.due.innerHTML = o.due.length
      ? `<div class="section-title">予定日</div><div class="card due-card">${o.due
          .map(
            (x) => `<div class="row is-due"><span class="dot" style="--c:${categoryOf(x.p.category).color}"></span><div class="main"><div class="title">${esc(x.p.name)}</div><div class="meta">${dayLabel(x.due)} ・ ${esc(s.accounts.find((a) => a.id === x.p.accountId)?.name || '')}</div></div><span class="amt num">${yen(x.amount)}</span><span class="btns"><button class="mini-btn is-primary" data-act="record" data-id="${esc(x.p.id)}">記録</button><button class="mini-btn" data-act="skip" data-id="${esc(x.p.id)}">なし</button></span></div>`
          )
          .join('')}</div>`
      : '';

    const recent = [...s.tx].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
    r.recent.innerHTML = recent.length
      ? recent.map((t) => txRow(t, s)).join('')
      : '<div class="empty">記録なし</div>';
    renderStop();
  }

  return { el, refresh, onShow: refresh };
}

export function txRow(t, s) {
  const c = categoryOf(t.type === 'expense' ? t.category : t.type);
  const acc = (id) => s.accounts.find((a) => a.id === id)?.name || '?';
  let title = t.shop || t.memo || c.label;
  let meta = '';
  let amt = '';
  if (t.type === 'expense') {
    meta = `${c.label} ・ ${acc(t.accountId)}${t.shop && t.memo ? ` ・ ${t.memo}` : ''}`;
    amt = `<span class="amt num">-${yenPlain(t.amount)}円</span>`;
  } else if (t.type === 'income') {
    meta = `収入 ・ ${acc(t.accountId)}`;
    amt = `<span class="amt num is-plus">+${yenPlain(t.amount)}円</span>`;
  } else {
    title = `${acc(t.accountId)} → ${acc(t.toAccountId)}`;
    meta = `移動${t.memo ? ` ・ ${t.memo}` : ''}`;
    amt = `<span class="amt num is-muted">${yenPlain(t.amount)}円</span>`;
  }
  return `<button class="row" data-id="${esc(t.id)}"><span class="dot" style="--c:${c.color}"></span><div class="main"><div class="title">${esc(title)}</div><div class="meta">${dayLabel(t.date)} ・ ${esc(meta)}</div></div>${amt}</button>`;
}
