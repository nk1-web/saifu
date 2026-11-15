import * as store from './store.js';
import { icons } from './icons.js';
import { createHome } from './views/home.js';
import { createHistory } from './views/history.js';
import { createPlan } from './views/plan.js';
import { createSavings } from './views/savings.js';
import { createSettings } from './views/settings.js';
import { openAddMenu, openImageImport } from './editors.js';

const TABS = [
  { id: 'home', label: 'ホーム', icon: icons.home },
  { id: 'history', label: '履歴', icon: icons.list },
  { id: 'plan', label: '予定', icon: icons.calendar },
  { id: 'savings', label: '貯金', icon: icons.piggy },
  { id: 'settings', label: '設定', icon: icons.settings },
];

const ctx = { tab: 'home', go };

const viewsEl = document.getElementById('views');
const tabbar = document.getElementById('tabbar');
const indicator = tabbar.querySelector('.tab-indicator');
const fab = document.getElementById('fab');
const imageInput = document.getElementById('image-input');

const views = {
  home: createHome(ctx),
  history: createHistory(ctx),
  plan: createPlan(ctx),
  savings: createSavings(ctx),
  settings: createSettings(ctx),
};
Object.values(views).forEach((v) => {
  v.el.hidden = true;
  viewsEl.append(v.el);
});

tabbar.insertAdjacentHTML(
  'beforeend',
  TABS.map((t) => `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${t.icon}<span>${t.label}</span></button>`).join('')
);
fab.innerHTML = icons.plus;

function moveIndicator() {
  const btn = tabbar.querySelector(`[data-tab="${ctx.tab}"]`);
  if (!btn) return;
  indicator.style.width = `${btn.offsetWidth}px`;
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function go(tab) {
  ctx.tab = tab;
  Object.entries(views).forEach(([id, v]) => (v.el.hidden = id !== tab));
  tabbar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  views[tab].onShow?.();
  views[tab].refresh();
  tabbar.classList.remove('is-compact');
  requestAnimationFrame(moveIndicator);
  history.replaceState(null, '', `#${tab}`);
}

tabbar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) go(b.dataset.tab);
});

// 右下の＋：予定タブでは予定を、それ以外では記録（画像・手入力）を追加
fab.addEventListener('click', () => {
  if (ctx.tab === 'plan') return views.plan.add();
  openAddMenu();
});

imageInput.addEventListener('change', () => {
  const f = imageInput.files?.[0];
  imageInput.value = '';
  if (f) openImageImport(f);
});

store.subscribe(() => views[ctx.tab].refresh());

// 下にスクロールしたらタブバーを小さくする
const lastY = new WeakMap();
viewsEl.addEventListener(
  'scroll',
  (e) => {
    const t = e.target;
    if (!t.classList?.contains('scroller')) return;
    const y = t.scrollTop;
    const prev = lastY.get(t) ?? y;
    if (Math.abs(y - prev) < 6) return;
    tabbar.classList.toggle('is-compact', y > prev && y > 40);
    lastY.set(t, y);
  },
  true
);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') views[ctx.tab].refresh();
});
window.addEventListener('resize', moveIndicator);
window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1);
  if (t !== ctx.tab && views[t]) go(t);
});

indicator.style.transition = 'none';
const initial = location.hash.slice(1);
go(TABS.some((t) => t.id === initial) ? initial : 'home');
requestAnimationFrame(() => requestAnimationFrame(() => (indicator.style.transition = '')));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
