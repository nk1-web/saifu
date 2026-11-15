import { h, esc } from './ui.js';
import { icons } from './icons.js';

// iOS 26 風のシート。左に閉じる、右に確定の丸いガラスボタン。
export function openSheet({ title = '', body, full = false, confirm, onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const wrap = h(`
    <div class="sheet-wrap">
      <div class="sheet-backdrop"></div>
      <section class="sheet ${full ? 'is-full' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-grab"><span></span></div>
        <header class="sheet-head">
          <button class="round-btn glass" data-act="close" aria-label="閉じる">${icons.close}</button>
          <h2>${esc(title)}</h2>
          ${
            confirm
              ? `<button class="round-btn glass is-primary" data-act="confirm" aria-label="${esc(confirm.label || '保存')}">${icons.check}</button>`
              : '<span></span>'
          }
        </header>
        <div class="sheet-body"></div>
      </section>
    </div>`);
  const sheet = wrap.querySelector('.sheet');
  wrap.querySelector('.sheet-body').append(body);
  root.append(wrap);
  document.body.classList.add('has-sheet');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    wrap.classList.remove('is-open');
    sheet.style.transform = '';
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('has-sheet');
    }, 380);
    onClose?.();
  }

  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelector('[data-act="close"]').addEventListener('click', close);
  wrap.querySelector('[data-act="confirm"]')?.addEventListener('click', () => {
    if (confirm.onConfirm() !== false) close();
  });

  // つまみ部分を下に引くと閉じる
  let startY = null;
  let dy = 0;
  const grab = wrap.querySelector('.sheet-grab');
  const head = wrap.querySelector('.sheet-head');
  [grab, head].forEach((el) => {
    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.target.closest('button')) return;
        startY = e.touches[0].clientY;
        sheet.style.transition = 'none';
      },
      { passive: true }
    );
  });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd);
  function onMove(e) {
    if (startY == null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }
  function onEnd() {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    if (dy > 110) close();
    else sheet.style.transform = '';
    dy = 0;
  }

  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('is-open')));
  return {
    close,
    sheet,
    setConfirmEnabled(on) {
      const b = wrap.querySelector('[data-act="confirm"]');
      if (b) b.disabled = !on;
    },
  };
}

export function confirmSheet({ title, message, okLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const body = h(`
      <div class="confirm">
        <p>${esc(message)}</p>
        <button class="btn ${danger ? 'is-danger' : 'is-primary'}" data-act="ok">${esc(okLabel)}</button>
        <button class="btn is-plain" data-act="cancel">キャンセル</button>
      </div>`);
    const s = openSheet({ title, body, onClose: () => resolve(result) });
    body.querySelector('[data-act="ok"]').addEventListener('click', () => {
      result = true;
      s.close();
    });
    body.querySelector('[data-act="cancel"]').addEventListener('click', s.close);
  });
}

// 1つの値を入力するだけの小さなシート
export function promptSheet({ title, label = '', value = '', placeholder = '', type = 'text', unit = '' }) {
  return new Promise((resolve) => {
    let result = null;
    const body = h(`
      <div class="form">
        <div class="group">
          <div class="field">
            ${label ? `<label>${esc(label)}</label>` : ''}
            <input data-ref="v" type="${type}" ${type === 'number' ? 'inputmode="numeric"' : ''} value="${esc(value)}" placeholder="${esc(placeholder)}">
            ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
          </div>
        </div>
      </div>`);
    const input = body.querySelector('input');
    const s = openSheet({
      title,
      body,
      confirm: {
        onConfirm() {
          result = input.value;
        },
      },
      onClose: () => resolve(result),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        result = input.value;
        s.close();
      }
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 350);
  });
}
