import * as store from '../store.js';
import { h, esc, refs, toast } from '../ui.js';
import { confirmSheet, promptSheet } from '../sheet.js';
import { icons, kindOf } from '../icons.js';
import { yen, dayKey, toNumber } from '../fmt.js';
import { balances } from '../money.js';
import { openAccountEditor } from '../editors.js';

export function createSettings(ctx) {
  const el = h(`
    <div class="view">
      <div class="scroller">
        <header class="page-head"><h1>設定</h1></header>

        <div class="section-title">手段（口座・決済）</div>
        <div class="card" data-ref="accounts"></div>
        <button class="btn" style="margin-top:10px" data-ref="addAccount">${icons.plus}手段を追加</button>

        <div class="section-title">衝動ストップ</div>
        <div class="card">
          <button class="row" data-ref="minutes"><div class="main"><div class="title">待つ時間</div><div class="meta">ボタンを押してから決めるまで</div></div><span class="amt num" data-ref="minutesV"></span></button>
          <div class="row"><div class="main"><div class="title">我慢して残したお金</div><div class="meta">「やめた」を選んだ金額の累計</div></div><span class="amt num" style="color:var(--plus)" data-ref="saved"></span></div>
        </div>
        <div class="section-title">お金を貯めたい理由</div>
        <div class="card" data-ref="reasons"></div>
        <button class="btn" style="margin-top:10px" data-ref="addReason">${icons.plus}理由を追加</button>

        <div class="section-title">バックアップ</div>
        <div class="menu">
          <button class="menu-item" data-ref="export"><span class="row-icon" style="--c:var(--k-bank)">${icons.download}</span><span><div class="t">書き出す</div><div class="d">すべてのデータをJSONファイルに保存</div></span></button>
          <button class="menu-item" data-ref="import"><span class="row-icon" style="--c:var(--k-cash)">${icons.upload}</span><span><div class="t">読み込む</div><div class="d">書き出したファイルから復元（今のデータは置き換わります）</div></span></button>
        </div>
        <p class="settings-note">データはこの端末のブラウザの中だけにあります。機種変更やアプリの削除で消えるので、ときどき書き出してiCloudなどに置いておいてください。</p>
        <input type="file" accept="application/json,.json" data-ref="file" class="offscreen" aria-hidden="true" tabindex="-1">

        <div class="section-title">その他</div>
        <div class="card">
          <button class="row" data-ref="reset"><div class="main"><div class="title" style="color:var(--danger)">すべてのデータを消す</div></div></button>
        </div>
        <p class="settings-note">saifu v1.0 ・ サーバーなし・ログインなし・無料</p>
      </div>
    </div>`);
  const r = refs(el);

  r.accounts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const a = store.get().accounts.find((x) => x.id === b.dataset.id);
    if (a) openAccountEditor({ account: a });
  });
  r.addAccount.addEventListener('click', () => openAccountEditor());
  r.minutes.addEventListener('click', async () => {
    const v = await promptSheet({ title: '待つ時間', label: '分', value: String(store.get().stop.minutes || 10), type: 'number', unit: '分' });
    if (v == null) return;
    const n = Math.max(1, Math.min(180, Math.round(toNumber(v)) || 10));
    store.update((s) => (s.stop.minutes = n));
  });
  r.addReason.addEventListener('click', async () => {
    const v = await promptSheet({ title: 'お金を貯めたい理由', placeholder: '来年の旅行のため、など' });
    if (!v?.trim()) return;
    store.update((s) => s.stop.reasons.push(v.trim()));
  });
  r.reasons.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const i = Number(b.dataset.i);
    const cur = store.get().stop.reasons[i];
    const v = await promptSheet({ title: '理由を編集', value: cur, placeholder: '空にすると削除' });
    if (v == null) return;
    store.update((s) => {
      if (v.trim()) s.stop.reasons[i] = v.trim();
      else s.stop.reasons.splice(i, 1);
    });
  });

  r.export.addEventListener('click', async () => {
    const text = store.exportJSON();
    const name = `saifu-backup-${dayKey()}.json`;
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('書き出しました');
  });
  r.import.addEventListener('click', () => r.file.click());
  r.file.addEventListener('change', async () => {
    const f = r.file.files?.[0];
    r.file.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const ok = await confirmSheet({ title: '読み込む', message: `「${f.name}」の内容で、今のデータをすべて置き換えます。`, okLabel: '置き換える', danger: true });
      if (!ok) return;
      store.importJSON(text);
      toast('読み込みました');
    } catch (e) {
      toast(e?.message || '読み込めませんでした');
    }
  });
  r.reset.addEventListener('click', async () => {
    const ok = await confirmSheet({ title: 'すべて消す', message: '手段・記録・予定・貯金の設定をすべて消します。元に戻せません。先に書き出しておくことをおすすめします。', okLabel: 'すべて消す', danger: true });
    if (!ok) return;
    store.resetAll();
    toast('消しました');
  });

  function refresh() {
    const s = store.get();
    const bal = balances(s).by;
    r.accounts.innerHTML = s.accounts.length
      ? s.accounts
          .map((a) => {
            const k = kindOf(a.kind);
            return `<button class="row" data-id="${esc(a.id)}"><span class="row-icon" style="--c:${k.color}">${k.icon}</span><div class="main"><div class="title">${esc(a.name)}</div><div class="meta">${k.label}</div></div><span class="amt num">${yen(bal[a.id] || 0)}</span>${icons.chevronR.replace('<svg', '<svg class="chev"')}</button>`;
          })
          .join('')
      : '<div class="empty">手段がありません</div>';
    r.minutesV.textContent = `${s.stop.minutes || 10}分`;
    r.saved.textContent = yen(s.stop.savedTotal || 0);
    r.reasons.innerHTML = s.stop.reasons.length
      ? s.stop.reasons.map((t, i) => `<button class="row" data-i="${i}"><div class="main"><div class="title" style="white-space:normal">${esc(t)}</div></div>${icons.pen.replace('<svg', '<svg class="chev"')}</button>`).join('')
      : '<div class="empty">衝動ストップのときに表示されます。<br>「来年の旅行のため」など、短く書いておくと効きます</div>';
  }

  return { el, refresh };
}
