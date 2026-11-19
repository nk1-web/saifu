// 衝動ストップ：使う前にいったん止まる。金額→使った後の残高→タイマー→理由→決める。
import * as store from './store.js';
import { h, esc, refs, toast, shake, haptic } from './ui.js';
import { openSheet, promptSheet } from './sheet.js';
import { icons } from './icons.js';
import { yen, toNumber, dayKey } from './fmt.js';
import { overview } from './money.js';
import { openTxEditor } from './editors.js';

const PRESETS = [5, 10, 15, 30];

export function stopRemaining(s = store.get()) {
  const a = s.stop.active;
  if (!a) return null;
  const end = a.startAt + a.minutes * 60000;
  return Math.max(0, end - Date.now());
}
const mmss = (ms) => {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export function openStop() {
  const s = store.get();
  const active = s.stop.active;
  let minutes = active?.minutes || Number(s.stop.minutes) || 10;
  let timer = null;

  const body = h(`
    <div class="form">
      <div class="amount-input" data-ref="amountWrap"><span class="yen">¥</span><input data-ref="amount" type="text" inputmode="numeric" placeholder="0" value="${active ? esc(String(active.amount)) : ''}" autocomplete="off" ${active ? 'readonly' : ''}></div>
      <div class="preview" data-ref="preview"></div>
      <div class="timer">
        <div class="clock num" data-ref="clock">${mmss(minutes * 60000)}</div>
        <div class="state" data-ref="state" hidden></div>
        <div class="ring-track"><i data-ref="bar" style="width:0"></i></div>
      </div>
      <div class="chips" data-ref="mins">${[...new Set([...PRESETS, Number(s.stop.minutes) || 10])]
        .sort((a, b) => a - b)
        .map((m) => `<button type="button" class="chip ${m === minutes ? 'is-on' : ''}" data-m="${m}">${m}分</button>`)
        .join('')}</div>
      <button type="button" class="btn is-accent" data-ref="start">${icons.timer}タイマーをはじめる</button>
      <button type="button" class="btn is-plain" data-ref="cancel" hidden>タイマーをやめる</button>
      <div class="btn-row" data-ref="decide" hidden>
        <button type="button" class="btn is-primary" data-ref="kept">やめた</button>
        <button type="button" class="btn" data-ref="spend">やっぱり使う</button>
      </div>
      <div class="field-label">貯めたい理由</div>
      <div class="reasons" data-ref="reasons"></div>
      <button type="button" class="btn" data-ref="addReason">${icons.plus}理由を追加</button>
      <div class="saved-total">残せたお金<b class="num" data-ref="saved">${yen(s.stop.savedTotal || 0)}</b></div>
    </div>`);
  const r = refs(body);

  function renderReasons() {
    const list = store.get().stop.reasons || [];
    r.reasons.innerHTML = list.length
      ? list.map((t) => `<div class="reason">${esc(t)}</div>`).join('')
      : '<div class="empty">理由なし</div>';
  }
  function renderPreview() {
    const o = overview(store.get());
    const amt = Math.round(toNumber(r.amount.value));
    const cur = o.total - amt;
    const av = o.available - amt;
    r.preview.innerHTML = `
      <div><span>使った後の残高</span><b class="num ${cur < 0 ? 'is-neg' : ''}">${yen(cur)}</b></div>
      <div><span>使った後の使える残高</span><b class="num ${av < 0 ? 'is-neg' : ''}">${yen(av)}</b></div>`;
  }
  function setMode(mode) {
    const running = mode === 'running';
    const done = mode === 'done';
    r.start.hidden = running || done;
    r.mins.hidden = running || done;
    r.cancel.hidden = !running;
    r.decide.hidden = !done;
    r.amount.readOnly = running || done;
    r.state.hidden = !done;
    r.state.textContent = '時間です';
  }
  function tick() {
    const rem = stopRemaining();
    if (rem == null) return;
    const a = store.get().stop.active;
    r.clock.textContent = mmss(rem);
    r.bar.style.width = `${Math.round((1 - rem / (a.minutes * 60000)) * 100)}%`;
    if (rem <= 0) {
      clearInterval(timer);
      timer = null;
      setMode('done');
      haptic(60);
    }
  }
  function startTimer() {
    setMode('running');
    tick();
    timer = setInterval(tick, 500);
  }

  renderReasons();
  renderPreview();
  r.amount.addEventListener('input', renderPreview);
  r.mins.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    minutes = Number(b.dataset.m);
    r.mins.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    r.clock.textContent = mmss(minutes * 60000);
  });
  r.start.addEventListener('click', () => {
    const amount = Math.round(toNumber(r.amount.value));
    if (!(amount > 0)) {
      shake(r.amountWrap);
      r.amount.focus();
      return;
    }
    store.update((st) => (st.stop.active = { amount, minutes, startAt: Date.now() }));
    haptic(12);
    startTimer();
  });
  r.cancel.addEventListener('click', () => {
    clearInterval(timer);
    timer = null;
    store.update((st) => (st.stop.active = null));
    r.bar.style.width = '0';
    r.clock.textContent = mmss(minutes * 60000);
    setMode('idle');
  });
  r.kept.addEventListener('click', () => {
    const a = store.get().stop.active;
    const amount = a?.amount || Math.round(toNumber(r.amount.value));
    store.update((st) => {
      st.stop.savedTotal = (Number(st.stop.savedTotal) || 0) + amount;
      st.stop.log.push({ date: dayKey(), amount, decision: 'kept', at: Date.now() });
      st.stop.active = null;
    });
    haptic(30);
    toast(`${yen(amount)}を使わずにすみました`);
    sheet.close();
  });
  r.spend.addEventListener('click', () => {
    const a = store.get().stop.active;
    const amount = a?.amount || Math.round(toNumber(r.amount.value));
    store.update((st) => {
      st.stop.log.push({ date: dayKey(), amount, decision: 'spent', at: Date.now() });
      st.stop.active = null;
    });
    sheet.close();
    setTimeout(() => openTxEditor({ preset: { type: 'expense', amount, source: 'stop' } }), 260);
  });
  r.addReason.addEventListener('click', async () => {
    const v = await promptSheet({ title: 'お金を貯めたい理由', placeholder: '来年の旅行のため、など' });
    if (!v?.trim()) return;
    store.update((st) => st.stop.reasons.push(v.trim()));
    renderReasons();
  });

  const sheet = openSheet({
    title: '衝動ストップ',
    body,
    full: true,
    onClose() {
      clearInterval(timer);
    },
  });
  if (active) startTimer();
  else setTimeout(() => r.amount.focus(), 400);
}
