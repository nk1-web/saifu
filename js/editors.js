// 入力シートたち：支出・収入・移動、画像読み取り、予定支出、手段
import * as store from './store.js';
import { CATEGORIES, categoryOf } from './store.js';
import { h, esc, refs, toast, shake, haptic } from './ui.js';
import { openSheet, confirmSheet, promptSheet } from './sheet.js';
import { icons, KINDS, kindOf } from './icons.js';
import { dayKey, yen, yenPlain, toNumber, dayLabel, monthKey } from './fmt.js';
import { balances, overview } from './money.js';
import { guessCategory } from './categorize.js';
import { readImage } from './ocr.js';

const TYPE_LABEL = { expense: '支出', income: '収入', transfer: '移動' };

function chipsHTML(items, on, { wrap = false } = {}) {
  return `<div class="chips ${wrap ? 'is-wrap' : ''}">${items
    .map((it) => `<button type="button" class="chip ${it.id === on ? 'is-on' : ''}" data-id="${esc(it.id)}" style="--c:${it.color}"><i></i>${esc(it.label)}</button>`)
    .join('')}</div>`;
}
const accountItems = (s) => s.accounts.map((a) => ({ id: a.id, label: a.name, color: kindOf(a.kind).color }));

function bindChips(container, onPick) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    container.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    haptic();
    onPick(b.dataset.id);
  });
}

// ---------- 取引（支出・収入・移動） ----------

export function openTxEditor({ tx = null, preset = {}, title, rawText = '', candidates = [], onSaved } = {}) {
  const s = store.get();
  if (!s.accounts.length) return toast('先に設定で手段を追加してください');
  const d = {
    type: 'expense',
    amount: '',
    date: dayKey(),
    accountId: s.accounts[0].id,
    toAccountId: s.accounts[1]?.id || s.accounts[0].id,
    category: '',
    shop: '',
    memo: '',
    source: 'manual',
    ...(tx || {}),
    ...preset,
  };
  if (d.type === 'income') d.category = 'income';
  if (d.type === 'transfer') d.category = 'transfer';
  let catTouched = !!(tx || preset.category);
  if (d.type === 'expense' && !d.category) d.category = guessCategory(d.shop, d.memo, s.shopCategory);

  const body = h(`
    <div class="form">
      ${tx ? '' : `<div class="seg" data-ref="seg">${['expense', 'income', 'transfer'].map((t) => `<button type="button" data-type="${t}" class="${d.type === t ? 'is-on' : ''}">${TYPE_LABEL[t]}</button>`).join('')}</div>`}
      <div class="amount-input" data-ref="amountWrap"><span class="yen">¥</span><input data-ref="amount" type="text" inputmode="numeric" placeholder="0" value="${d.amount ? esc(String(d.amount)) : ''}" autocomplete="off"></div>
      ${candidates.length > 1 ? `<div class="chips" data-ref="cands">${candidates.map((c) => `<button type="button" class="chip ${c === Number(d.amount) ? 'is-on' : ''}" data-v="${c}">${yen(c)}</button>`).join('')}</div>` : ''}
      <div class="field-label" data-ref="accLabel">${d.type === 'transfer' ? '移動元' : '手段'}</div>
      <div data-ref="acc">${chipsHTML(accountItems(s), d.accountId)}</div>
      <div data-ref="toWrap" ${d.type === 'transfer' ? '' : 'hidden'}>
        <div class="field-label">移動先</div>
        <div data-ref="to">${chipsHTML(accountItems(s), d.toAccountId)}</div>
      </div>
      <div data-ref="catWrap" ${d.type === 'expense' ? '' : 'hidden'}>
        <div class="field-label">カテゴリ</div>
        <div data-ref="cat">${chipsHTML(CATEGORIES, d.category)}</div>
      </div>
      <div class="group">
        <div class="field"><label>日付</label><input data-ref="date" type="date" value="${esc(d.date)}"></div>
        <div class="field" data-ref="shopField" ${d.type === 'transfer' ? 'hidden' : ''}><label data-ref="shopLabel">${d.type === 'income' ? '内容' : '店名'}</label><input data-ref="shop" type="text" placeholder="${d.type === 'income' ? '給料など' : '店名・買ったもの'}" value="${esc(d.shop)}" autocomplete="off"></div>
        <div class="field"><label>メモ</label><input data-ref="memo" type="text" placeholder="任意" value="${esc(d.memo)}" autocomplete="off"></div>
      </div>
      ${rawText ? `<details class="raw"><summary>読み取った文字を見る</summary><pre>${esc(rawText)}</pre></details>` : ''}
      ${tx ? `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}この記録を削除</button>` : ''}
    </div>`);
  const r = refs(body);

  function setType(t) {
    d.type = t;
    r.toWrap.hidden = t !== 'transfer';
    r.catWrap.hidden = t !== 'expense';
    r.shopField.hidden = t === 'transfer';
    r.accLabel.textContent = t === 'transfer' ? '移動元' : '手段';
    r.shopLabel.textContent = t === 'income' ? '内容' : '店名';
    r.shop.placeholder = t === 'income' ? '給料など' : '店名・買ったもの';
    if (t === 'expense' && !CATEGORIES.some((c) => c.id === d.category)) {
      d.category = guessCategory(r.shop.value, r.memo.value, store.get().shopCategory);
      r.cat.innerHTML = chipsHTML(CATEGORIES, d.category);
    }
  }
  r.seg?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    r.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    setType(b.dataset.type);
  });
  r.cands?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    r.amount.value = b.dataset.v;
    r.cands.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
  });
  bindChips(r.acc, (id) => (d.accountId = id));
  bindChips(r.to, (id) => (d.toAccountId = id));
  bindChips(r.cat, (id) => {
    d.category = id;
    catTouched = true;
  });
  // 店名を打ったら、まだ手で選んでいなければカテゴリを推測し直す
  r.shop.addEventListener('input', () => {
    if (catTouched || d.type !== 'expense') return;
    const g = guessCategory(r.shop.value, r.memo.value, store.get().shopCategory);
    if (g !== d.category) {
      d.category = g;
      r.cat.innerHTML = chipsHTML(CATEGORIES, d.category);
    }
  });

  const sheet = openSheet({
    title: title || (tx ? '記録を編集' : '記録する'),
    body,
    full: true,
    confirm: {
      onConfirm() {
        const amount = Math.round(toNumber(r.amount.value));
        if (!(amount > 0)) {
          shake(r.amountWrap);
          r.amount.focus();
          return false;
        }
        if (d.type === 'transfer' && d.accountId === d.toAccountId) {
          toast('移動元と移動先が同じです');
          return false;
        }
        const payload = {
          type: d.type,
          amount,
          date: r.date.value || dayKey(),
          accountId: d.accountId,
          toAccountId: d.type === 'transfer' ? d.toAccountId : undefined,
          category: d.type === 'expense' ? d.category || 'other' : d.type,
          shop: d.type === 'transfer' ? '' : r.shop.value.trim(),
          memo: r.memo.value.trim(),
          source: d.source,
        };
        let saved;
        if (tx) {
          store.updateTx(tx.id, payload);
          saved = { ...tx, ...payload };
          toast('直しました');
        } else {
          saved = store.addTx(payload);
          toast(`${TYPE_LABEL[d.type]}を記録しました`);
        }
        haptic(12);
        onSaved?.(saved);
      },
    },
  });
  r.del?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: '削除', message: 'この記録を削除します。残高も元に戻ります。', okLabel: '削除する', danger: true }))) return;
    store.removeTx(tx.id);
    toast('削除しました');
    sheet.close();
  });
  if (!tx && !d.amount) setTimeout(() => r.amount.focus(), 400);
  return sheet;
}

// ---------- 画像から読み取る ----------

export async function openImageImport(file) {
  const body = h(`
    <div class="progress">
      <div class="ring"></div>
      <div class="t" data-ref="t">読み取りの準備中</div>
      <div class="track"><i data-ref="bar"></i></div>
    </div>`);
  const r = refs(body);
  const sheet = openSheet({ title: '画像を読み取り中', body });
  let cancelled = false;
  const origClose = sheet.close;
  sheet.close = () => {
    cancelled = true;
    origClose();
  };
  try {
    const res = await readImage(file, (p, label) => {
      r.t.textContent = label;
      r.bar.style.width = `${Math.round(p * 100)}%`;
    });
    if (cancelled) return;
    origClose();
    setTimeout(() => {
      openTxEditor({
        title: '読み取り結果を確認',
        preset: {
          type: 'expense',
          amount: res.amount || '',
          date: res.date,
          shop: res.shop,
          source: 'image',
        },
        rawText: res.text,
        candidates: res.candidates,
      });
      if (!res.amount) toast('金額を読み取れませんでした');
    }, 300);
  } catch (e) {
    console.error(e);
    origClose();
    toast(e?.message || '読み取りに失敗しました');
  }
}

// ---------- 追加メニュー ----------

export function openAddMenu() {
  const body = h(`
    <div class="menu">
      <button class="menu-item" data-act="image"><span class="row-icon" style="--c:var(--k-pay)">${icons.image}</span><span><div class="t">画像から読み取る</div></span></button>
      <button class="menu-item" data-act="expense"><span class="row-icon" style="--c:var(--ink-2)">${icons.arrowUp}</span><span><div class="t">支出を手入力</div></span></button>
      <button class="menu-item" data-act="income"><span class="row-icon" style="--c:var(--plus)">${icons.arrowDown}</span><span><div class="t">収入を記録</div></span></button>
      <button class="menu-item" data-act="transfer"><span class="row-icon" style="--c:var(--k-bank)">${icons.swap}</span><span><div class="t">チャージ・移動</div></span></button>
    </div>`);
  const sheet = openSheet({ title: '記録する', body });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    sheet.close();
    const act = b.dataset.act;
    if (act === 'image') return document.getElementById('image-input').click();
    setTimeout(() => openTxEditor({ preset: { type: act } }), 250);
  });
}

// ---------- 予定支出 ----------

export function openPlannedEditor({ item = null, onSaved } = {}) {
  const s = store.get();
  const d = {
    name: '',
    amount: '',
    accountId: s.accounts[0]?.id,
    category: 'sub',
    repeat: 'monthly',
    date: dayKey(),
    day: Number(dayKey().slice(8, 10)),
    ...(item || {}),
  };
  const body = h(`
    <div class="form">
      <div class="amount-input" data-ref="amountWrap"><span class="yen">¥</span><input data-ref="amount" type="text" inputmode="numeric" placeholder="0" value="${d.amount ? esc(String(d.amount)) : ''}" autocomplete="off"></div>
      <div class="group">
        <div class="field"><label>名前</label><input data-ref="name" type="text" placeholder="Netflix、家賃、飲み会 など" value="${esc(d.name)}" autocomplete="off"></div>
      </div>
      <div class="seg" data-ref="seg"><button type="button" data-rep="monthly" class="${d.repeat === 'monthly' ? 'is-on' : ''}">毎月</button><button type="button" data-rep="once" class="${d.repeat === 'once' ? 'is-on' : ''}">一回だけ</button></div>
      <div class="group">
        <div class="field" data-ref="dayField" ${d.repeat === 'monthly' ? '' : 'hidden'}><label>支払日</label><select data-ref="day">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${d.day === i + 1 ? 'selected' : ''}>${i === 30 ? '月末（31日）' : `毎月${i + 1}日`}</option>`).join('')}</select></div>
        <div class="field" data-ref="dateField" ${d.repeat === 'once' ? '' : 'hidden'}><label>日付</label><input data-ref="date" type="date" value="${esc(d.date || dayKey())}"></div>
      </div>
      <div class="field-label">支払う手段</div>
      <div data-ref="acc">${chipsHTML(accountItems(s), d.accountId)}</div>
      <div class="field-label">カテゴリ</div>
      <div data-ref="cat">${chipsHTML(CATEGORIES, d.category)}</div>
      ${item ? `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}この予定を削除</button>` : ''}
    </div>`);
  const r = refs(body);
  r.seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rep]');
    if (!b) return;
    r.seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    d.repeat = b.dataset.rep;
    r.dayField.hidden = d.repeat !== 'monthly';
    r.dateField.hidden = d.repeat !== 'once';
  });
  bindChips(r.acc, (id) => (d.accountId = id));
  bindChips(r.cat, (id) => (d.category = id));

  const sheet = openSheet({
    title: item ? '予定を編集' : '予定を追加',
    body,
    full: true,
    confirm: {
      onConfirm() {
        const amount = Math.round(toNumber(r.amount.value));
        if (!(amount > 0)) {
          shake(r.amountWrap);
          return false;
        }
        const name = r.name.value.trim() || categoryOf(d.category).label;
        const payload = {
          name,
          amount,
          accountId: d.accountId,
          category: d.category,
          repeat: d.repeat,
          date: r.date.value || dayKey(),
          day: Number(r.day.value) || 1,
        };
        if (item) store.updatePlanned(item.id, payload);
        else store.addPlanned(payload);
        toast(item ? '直しました' : '予定を追加しました');
        haptic(12);
        onSaved?.();
      },
    },
  });
  r.del?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: '削除', message: 'この予定を削除します。', okLabel: '削除する', danger: true }))) return;
    store.removePlanned(item.id);
    toast('削除しました');
    sheet.close();
  });
  if (!item) setTimeout(() => r.amount.focus(), 400);
}

// 予定日が来た予定を、実際の支出として記録する（確認画面つき）
export function recordPlanned(entry) {
  const { p, due, amount } = entry;
  openTxEditor({
    title: '予定を支出として記録',
    preset: { type: 'expense', amount, date: due, accountId: p.accountId, category: p.category, shop: p.name, source: 'planned' },
    onSaved() {
      markPlannedDone(p, due);
    },
  });
}
export function markPlannedDone(p, due) {
  if (p.repeat === 'monthly') {
    const ym = due.slice(0, 7);
    store.updatePlanned(p.id, { doneMonths: [...new Set([...(p.doneMonths || []), ym])] });
  } else {
    store.updatePlanned(p.id, { doneOnce: true });
  }
}

// ---------- 手段 ----------

export function openAccountEditor({ account = null, onSaved } = {}) {
  const s = store.get();
  const cur = account ? balances(s).by[account.id] || 0 : 0;
  const d = { name: '', kind: 'other', ...(account || {}) };
  const body = h(`
    <div class="form">
      <div class="group">
        <div class="field"><label>名前</label><input data-ref="name" type="text" placeholder="銀行、Suica など" value="${esc(d.name)}" autocomplete="off"></div>
        <div class="field"><label>${account ? '今の残高' : '最初の残高'}</label><input data-ref="bal" type="text" inputmode="numeric" placeholder="0" value="${account ? yenPlain(cur) : ''}"><span class="unit">円</span></div>
      </div>
      <div class="field-label">種類</div>
      <div data-ref="kind">${chipsHTML(KINDS, d.kind, { wrap: true })}</div>
      ${account ? `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}この手段を削除</button>` : ''}
    </div>`);
  const r = refs(body);
  bindChips(r.kind, (id) => (d.kind = id));
  const sheet = openSheet({
    title: account ? '手段を編集' : '手段を追加',
    body,
    confirm: {
      onConfirm() {
        const name = r.name.value.trim();
        if (!name) {
          r.name.focus();
          return false;
        }
        const bal = Math.round(toNumber(r.bal.value));
        if (account) {
          // 残高を直接なおす＝最初の残高をその差だけ動かす（履歴はそのまま）
          store.updateAccount(account.id, { name, kind: d.kind, initial: (Number(account.initial) || 0) + (bal - cur) });
        } else {
          store.addAccount({ name, kind: d.kind, initial: bal });
        }
        toast('保存しました');
        onSaved?.();
      },
    },
  });
  r.del?.addEventListener('click', async () => {
    const n = store.accountUsage(account.id);
    if (n > 0) return toast(`この手段を使った記録が${n}件あるので削除できません`);
    if (!(await confirmSheet({ title: '削除', message: `「${account.name}」を削除します。`, okLabel: '削除する', danger: true }))) return;
    store.removeAccount(account.id);
    toast('削除しました');
    sheet.close();
  });
  if (!account) setTimeout(() => r.name.focus(), 400);
}

// ホームで手段をタップしたときの小さなメニュー
export function openAccountMenu(account) {
  const s = store.get();
  const bal = balances(s).by[account.id] || 0;
  const k = kindOf(account.kind);
  const isWallet = account.kind === 'pay' || account.kind === 'ic' || account.kind === 'cash';
  const body = h(`
    <div class="menu">
      <div class="hero" style="grid-template-columns:1fr"><div><div class="k">${esc(account.name)}の残高</div><div class="v num ${bal < 0 ? 'is-neg' : ''}">${yen(bal)}</div></div></div>
      <button class="menu-item" data-act="adjust"><span class="row-icon" style="--c:${k.color}">${icons.pen}</span><span><div class="t">残高を直接なおす</div></span></button>
      <button class="menu-item" data-act="charge"><span class="row-icon" style="--c:var(--k-bank)">${icons.swap}</span><span><div class="t">${isWallet ? 'チャージ・入金' : '引き出し・移動'}</div></span></button>
      <button class="menu-item" data-act="expense"><span class="row-icon" style="--c:var(--ink-2)">${icons.arrowUp}</span><span><div class="t">この手段で支出</div></span></button>
      <button class="menu-item" data-act="income"><span class="row-icon" style="--c:var(--plus)">${icons.arrowDown}</span><span><div class="t">この手段に収入</div></span></button>
      <button class="menu-item" data-act="edit"><span class="row-icon" style="--c:var(--ink-3)">${icons.settings}</span><span><div class="t">名前・種類を編集</div></span></button>
    </div>`);
  const sheet = openSheet({ title: account.name, body });
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    sheet.close();
    await new Promise((r) => setTimeout(r, 260));
    if (act === 'adjust') {
      const v = await promptSheet({ title: '残高を直接なおす', label: '今の残高', value: bal ? yenPlain(bal) : '', placeholder: '0', type: 'text', unit: '円' });
      if (v == null) return;
      const n = Math.round(toNumber(v));
      store.updateAccount(account.id, { initial: (Number(account.initial) || 0) + (n - bal) });
      toast(`${account.name}の残高を${yen(n)}にしました`);
    } else if (act === 'charge') {
      const other = s.accounts.find((a) => a.id !== account.id && a.kind === 'bank') || s.accounts.find((a) => a.id !== account.id);
      openTxEditor({
        preset: isWallet ? { type: 'transfer', accountId: other?.id || account.id, toAccountId: account.id } : { type: 'transfer', accountId: account.id, toAccountId: other?.id || account.id },
      });
    } else if (act === 'expense' || act === 'income') {
      openTxEditor({ preset: { type: act, accountId: account.id } });
    } else if (act === 'edit') {
      openAccountEditor({ account });
    }
  });
}

export { TYPE_LABEL };
