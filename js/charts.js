// 端末内で描く小さなSVGグラフ（ライブラリなし・オフラインで動く）
// 仕様: 棒は細め(最大24px)・データ端だけ4px丸め・積み上げの間に2pxのすき間・罫線は細い実線
//       値ラベルは最後の月だけ、残りは目盛り・タップのツールチップ・表で読む

const NS = 'http://www.w3.org/2000/svg';
const GAP = 2;

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

// 片側だけ丸めた棒（up=true なら上端、false なら下端を丸める）
function barPath(x, w, yBase, yEnd, round) {
  const up = yEnd < yBase;
  const h = Math.abs(yBase - yEnd);
  const r = round ? Math.min(4, h, w / 2) : 0;
  if (up) return `M${x},${yBase}V${yEnd + r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + r}V${yBase}Z`;
  return `M${x},${yBase}V${yEnd - r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd - r}V${yBase}Z`;
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
 * 棒グラフ（積み上げ対応・マイナス対応）
 * cats: [{label:'11月', title:'2026年11月'}]
 * series: [{id, label, color}]
 * values: values[i][s]
 * opts.colorAt(i, s) で棒ごとの色を変えられる（達成/未達など）
 * opts.marks: [{i, value, label}] 目標などを短い横線で重ねる
 */
export function columnChart(host, { cats, series, values, height = 200, colorAt, marks = [], tooltip, labelIndex = cats.length - 1, emptyText }) {
  const totals = values.map((row) => row.reduce((a, v) => a + Math.max(0, v), 0));
  const mins = values.map((row) => row.reduce((a, v) => a + Math.min(0, v), 0));
  const maxV = Math.max(0, ...totals, ...marks.map((m) => m.value));
  const minV = Math.min(0, ...mins);
  if (maxV === 0 && minV === 0) {
    host.textContent = '';
    div('empty', host, emptyText || 'まだデータがありません');
    return;
  }
  const { lo, hi, ticks } = niceScale(minV, maxV);
  const f = frame(host, { height, cats, lo, hi, ticks });
  const bw = Math.min(24, f.band * 0.56);
  const cols = [];
  const g = el('g', {}, f.svg);
  values.forEach((row, i) => {
    const cg = el('g', { class: 'col' }, g);
    cols.push(cg);
    const x = f.xc(i) - bw / 2;
    let up = 0;
    let down = 0;
    const lastUp = row.reduce((k, v, s) => (v > 0 ? s : k), -1);
    const lastDown = row.reduce((k, v, s) => (v < 0 ? s : k), -1);
    row.forEach((v, s) => {
      if (!v) return;
      const color = colorAt ? colorAt(i, s) : series[s].color;
      if (v > 0) {
        let yb = f.y(up);
        const ye = f.y(up + v);
        if (up > 0) yb -= GAP;
        up += v;
        if (yb - ye < 0.5) return;
        el('path', { d: barPath(x, bw, yb, ye, s === lastUp), fill: color }, cg);
      } else {
        let yb = f.y(down);
        const ye = f.y(down + v);
        if (down < 0) yb += GAP;
        down += v;
        if (ye - yb < 0.5) return;
        el('path', { d: barPath(x, bw, yb, ye, s === lastDown), fill: color }, cg);
      }
    });
  });
  // 目標などの横線（棒より少し広い、実線2px）
  marks.forEach((m) => {
    const yy = f.y(m.value);
    el('line', { x1: f.xc(m.i) - bw / 2 - 4, x2: f.xc(m.i) + bw / 2 + 4, y1: yy, y2: yy, class: 'target' }, g);
  });
  // 値ラベルは1か所だけ（ふつうは最後の月）
  if (labelIndex >= 0 && labelIndex < values.length) {
    const tot = totals[labelIndex] + mins[labelIndex];
    const top = totals[labelIndex] > 0 ? f.y(totals[labelIndex]) : f.y(0);
    const tx = el('text', { x: f.xc(labelIndex), y: top - 6, 'text-anchor': 'middle', class: 'val' }, f.svg);
    tx.textContent = axisYen(tot);
  }
  bindColumns(
    f,
    values.length,
    (i) => {
      cols.forEach((c, k) => c.classList.toggle('is-dim', k !== i));
      fillTip(f.tip, tooltip(i));
      placeTip(f, i);
    },
    () => cols.forEach((c) => c.classList.remove('is-dim'))
  );
}

/**
 * 折れ線（面の淡い塗りつき）。累計の推移に使う
 */
export function lineChart(host, { cats, values, color, height = 180, tooltip, emptyText }) {
  if (!values.length || values.every((v) => !v)) {
    host.textContent = '';
    div('empty', host, emptyText || 'まだデータがありません');
    return;
  }
  const { lo, hi, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const f = frame(host, { height, cats, lo, hi, ticks });
  const pts = values.map((v, i) => [f.xc(i), f.y(v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
  el('path', { d: `${line}L${pts[pts.length - 1][0]},${f.y(0)}L${pts[0][0]},${f.y(0)}Z`, fill: color, 'fill-opacity': 0.1 }, f.svg);
  el('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, f.svg);
  const cross = el('line', { y1: f.pad.t, y2: f.pad.t + f.ph, class: 'cross' }, f.svg);
  cross.style.display = 'none';
  const dot = el('circle', { r: 4, fill: color, class: 'ring' }, f.svg);
  const last = pts.length - 1;
  // 終点に点と値
  el('circle', { cx: pts[last][0], cy: pts[last][1], r: 4, fill: color, class: 'ring' }, f.svg);
  const tx = el('text', { x: pts[last][0], y: pts[last][1] - 10, 'text-anchor': pts.length > 1 ? 'end' : 'middle', class: 'val' }, f.svg);
  tx.textContent = axisYen(values[last]);
  dot.style.display = 'none';
  bindColumns(
    f,
    values.length,
    (i) => {
      cross.setAttribute('x1', pts[i][0]);
      cross.setAttribute('x2', pts[i][0]);
      cross.style.display = '';
      dot.setAttribute('cx', pts[i][0]);
      dot.setAttribute('cy', pts[i][1]);
      dot.style.display = '';
      fillTip(f.tip, tooltip(i));
      placeTip(f, i);
    },
    () => {
      cross.style.display = 'none';
      dot.style.display = 'none';
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
    key.className = shape === 'line' || it.shape === 'line' ? 'is-line' : '';
    key.style.background = it.color;
    b.append(key, document.createTextNode(it.label));
    wrap.append(b);
  });
  return wrap;
}

export { yenFull };
