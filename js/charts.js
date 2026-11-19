// 端末内で描く小さなSVG折れ線（ライブラリなし・オフラインで動く）
// 仕様: 線2px・点は半径4pxに2pxの縁・罫線は細い実線。値ラベルは最後の点だけ、残りはタップのツールチップと表で読む

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}
function div(cls, parent, text) {
  const n = document.createElement('div');
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  parent?.append(n);
  return n;
}

// 目盛り用の短い円表記: 1.5万 / 8千 / 500
export function axisYen(v) {
  const a = Math.abs(v);
  let s;
  if (a >= 10000) s = `${+(a / 10000).toFixed(a % 10000 === 0 ? 0 : 1)}万`;
  else if (a >= 1000) s = `${+(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}千`;
  else s = String(Math.round(a));
  return v < 0 ? `-${s}` : s;
}
const yenFull = (v) => `${v < 0 ? '-' : ''}${Math.abs(Math.round(v)).toLocaleString('ja-JP')}円`;

function niceScale(min, max, count = 4) {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return { lo, hi, ticks };
}

function frame(host, { height, cats, lo, hi, ticks }) {
  host.textContent = '';
  host.classList.add('chart');
  const W = Math.max(260, Math.round(host.clientWidth || 340));
  const H = height;
  const pad = { l: 40, r: 10, t: 22, b: 26 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const band = pw / Math.max(1, cats.length);
  const y = (v) => pad.t + ph - ((v - lo) / (hi - lo)) * ph;
  const xc = (i) => pad.l + band * i + band / 2;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' }, host);
  const grid = el('g', { class: 'grid' }, svg);
  ticks.forEach((t) => {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(t) + 0.5, y2: y(t) + 0.5, class: t === 0 ? 'zero' : '' }, grid);
    const tx = el('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, grid);
    tx.textContent = axisYen(t);
  });
  // 月のラベル。狭いときは1つおき（最後の月は必ず出す）
  const every = band < 26 ? 2 : 1;
  cats.forEach((c, i) => {
    if ((cats.length - 1 - i) % every !== 0) return;
    const tx = el('text', { x: xc(i), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, svg);
    tx.textContent = c.label;
  });

  const tip = div('chart-tip', host);
  tip.hidden = true;
  return { svg, W, H, pad, pw, ph, band, y, xc, tip };
}

// ツールチップ: 値が主役、ラベルは従。系列は短い線のキーで示す
function fillTip(tip, { title, total, rows, note }) {
  tip.textContent = '';
  div('tt-title', tip, title);
  if (total != null) div('tt-total num', tip, total);
  rows.forEach((r) => {
    const row = div('tt-row', tip);
    const key = document.createElement('i');
    key.style.background = r.color;
    row.append(key);
    div('tt-v num', row, r.value);
    div('tt-k', row, r.label);
  });
  if (note) div('tt-note', tip, note);
}
function placeTip(f, i) {
  const { tip, W } = f;
  tip.hidden = false;
  // 選んだ列の横（左半分なら右側、右半分なら左側）に置き、グラフの枠からはみ出さない
  const tw = tip.offsetWidth;
  const x = f.xc(i);
  const side = f.band / 2 + 4;
  let left = x < W / 2 ? x + side : x - side - tw;
  left = Math.max(0, Math.min(W - tw, left));
  tip.style.left = `${left}px`;
  tip.style.top = `${f.pad.t - 14}px`;
}

// 列ごとにタップ・ホバー・フォーカスで反応させる共通処理
function bindColumns(f, n, onPick, onClear) {
  let current = -1;
  const pick = (i) => {
    if (i === current) return;
    current = i;
    onPick(i);
  };
  const clear = () => {
    current = -1;
    f.tip.hidden = true;
    onClear();
  };
  for (let i = 0; i < n; i++) {
    const hit = el('rect', { x: f.pad.l + f.band * i, y: f.pad.t - 8, width: f.band, height: f.ph + 8, class: 'hit', tabindex: 0 }, f.svg);
    hit.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' && current === i) return clear();
      pick(i);
    });
    hit.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && pick(i));
    hit.addEventListener('focus', () => pick(i));
    hit.addEventListener('blur', clear);
  }
  f.svg.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && clear());
}

/**
 * 折れ線（複数系列・マイナス対応）
 * cats: [{label:'11月', title:'2026年11月'}]
 * series: [{label, color, values:[], area?:bool, dot?:(i)=>color|null, faint?:bool}]
 * 値ラベルは系列が1本のときだけ、最後の点に1つ
 */
export function lineChart(host, { cats, series, height = 200, tooltip, emptyText }) {
  const vals = series.flatMap((s) => s.values);
  if (!vals.length || vals.every((v) => !v)) {
    host.textContent = '';
    host.classList.add('chart');
    div('empty', host, emptyText || 'データなし');
    return;
  }
  const { lo, hi, ticks } = niceScale(Math.min(0, ...vals), Math.max(0, ...vals));
  const f = frame(host, { height, cats, lo, hi, ticks });
  const ptsOf = (s) => s.values.map((v, i) => [f.xc(i), f.y(v)]);
  const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');

  series.forEach((s) => {
    if (!s.area) return;
    const pts = ptsOf(s);
    el('path', { d: `${pathOf(pts)}L${pts[pts.length - 1][0]},${f.y(0)}L${pts[0][0]},${f.y(0)}Z`, fill: s.color, 'fill-opacity': 0.1 }, f.svg);
  });
  series.forEach((s) => {
    const pts = ptsOf(s);
    el('path', { d: pathOf(pts), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.faint ? 0.55 : null }, f.svg);
  });
  // 点：dot 指定があれば各月に、なければ最後だけ（系列が1本のとき）
  series.forEach((s) => {
    const pts = ptsOf(s);
    if (s.dot) {
      pts.forEach((p, i) => {
        const c = s.dot(i);
        if (c) el('circle', { cx: p[0], cy: p[1], r: 4, fill: c, class: 'ring' }, f.svg);
      });
    } else if (series.length === 1 || pts.length === 1) {
      const p = pts[pts.length - 1];
      el('circle', { cx: p[0], cy: p[1], r: 4, fill: s.color, class: 'ring' }, f.svg);
    }
  });
  if (series.length === 1) {
    const s = series[0];
    const last = s.values.length - 1;
    const tx = el('text', { x: f.xc(last), y: f.y(s.values[last]) - 10, 'text-anchor': last > 0 ? 'end' : 'middle', class: 'val' }, f.svg);
    tx.textContent = axisYen(s.values[last]);
  }

  const cross = el('line', { y1: f.pad.t, y2: f.pad.t + f.ph, class: 'cross' }, f.svg);
  cross.style.display = 'none';
  const hov = series.map((s) => {
    const c = el('circle', { r: 4, fill: s.color, class: 'ring' }, f.svg);
    c.style.display = 'none';
    return c;
  });
  bindColumns(
    f,
    cats.length,
    (i) => {
      const x = f.xc(i);
      cross.setAttribute('x1', x);
      cross.setAttribute('x2', x);
      cross.style.display = '';
      series.forEach((s, k) => {
        hov[k].setAttribute('cx', x);
        hov[k].setAttribute('cy', f.y(s.values[i]));
        hov[k].style.display = '';
      });
      fillTip(f.tip, tooltip(i));
      placeTip(f, i);
    },
    () => {
      cross.style.display = 'none';
      hov.forEach((c) => (c.style.display = 'none'));
    }
  );
}

// 凡例（棒は四角、線は短い線）。テキストはインクの色、色は横の印だけ
export function legend(items, { shape = 'rect', active = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'legend';
  items.forEach((it) => {
    const b = document.createElement(it.id != null ? 'button' : 'span');
    b.className = `legend-item ${active && active !== it.id ? 'is-off' : ''} ${active === it.id ? 'is-on' : ''}`;
    if (it.id != null) {
      b.type = 'button';
      b.dataset.id = it.id;
    }
    const key = document.createElement('i');
    const sh = it.shape || shape;
    key.className = sh === 'line' ? 'is-line' : sh === 'dot' ? 'is-dot' : '';
    key.style.background = it.color;
    b.append(key, document.createTextNode(it.label));
    wrap.append(b);
  });
  return wrap;
}

export { yenFull };
