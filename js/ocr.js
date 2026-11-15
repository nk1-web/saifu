// レシートや決済アプリのスクショから、金額・日付・店名を読み取る。
// OCRは Tesseract.js（端末内で動く、無料、鍵いらず）。本体と日本語データは初回だけCDNから落ちてくる。
import { dayKey } from './fmt.js';

const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading = null;

export function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => {
        loading = null;
        reject(new Error('OCRの部品を読み込めませんでした。通信を確認してください'));
      };
      document.head.append(s);
    });
  }
  return loading;
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// 大きすぎる画像は縮め、白黒にしてコントラストを上げる。黒背景のスクショは反転する。
export async function fileToCanvas(file, max = 1800) {
  const img = await loadImage(file);
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const scale = Math.min(1, max / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const mean = sum / (d.length / 4);
  const invert = mean < 110;
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (invert) g = 255 - g;
    g = (g - 128) * 1.3 + 128;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i] = d[i + 1] = d[i + 2] = g;
    d[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

const STATUS = {
  'loading tesseract core': '部品を準備中',
  'initializing tesseract': '準備中',
  'loading language traineddata': '日本語データを取得中',
  'initializing api': '準備中',
  'recognizing text': '文字を読み取り中',
};

export async function recognize(canvas, onProgress) {
  const T = await loadTesseract();
  const worker = await T.createWorker('jpn+eng', 1, {
    logger: (m) => {
      const label = STATUS[m.status] || '処理中';
      onProgress?.(m.status === 'recognizing text' ? m.progress : 0, label);
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

// ---------- 文字の解釈 ----------

const normalize = (s) =>
  s
    .normalize('NFKC')
    .replace(/[|｜]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

const STRONG = /(合計|合 計|お支払|支払|お買上|お買い上げ|ご利用金額|利用金額|決済金額|決済額|お会計)/;
const WEAK = /(金額|total|請求|計)/i;
const EXCL = /(小計|お預|預り|お釣|おつり|釣銭|ポイント|残高|割引|値引|還元|付与|獲得|入金|チャージ|内消費税|内税|消費税|税率|対象)/;
const NOT_SHOP =
  /(領収|レシート|receipt|ありがとう|またの|ご来店|支払|決済|取引|履歴|残高|ポイント|合計|小計|tel|電話|〒|no\.|番号|登録|店番|レジ|担当|責任者|税|paypay|ペイペイ|楽天ペイ|d払い|au pay|メルペイ|利用|日時|日付|time|date|完了|明細|詳細|送金|受け取|金額|クレジット|visa|master|jcb|カード|現金|お釣|お預|¥|円)/i;

function parseAmountToken(tok) {
  // "1,234" "1.234"(OCRがカンマを点に誤読) "1234"
  let t = tok.replace(/[^\d,.]/g, '');
  if (/^\d{1,3}([,.]\d{3})+$/.test(t)) t = t.replace(/[,.]/g, '');
  else if (/^\d+$/.test(t)) {
    /* そのまま */
  } else return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 1 || v > 5000000) return null;
  return v;
}

function amountCandidates(lines) {
  const out = [];
  lines.forEach((line, idx) => {
    const strong = STRONG.test(line);
    const weak = WEAK.test(line);
    const excluded = EXCL.test(line) && !strong;
    if (excluded) return;
    const push = (tok, bonus) => {
      const v = parseAmountToken(tok);
      if (v == null) return;
      let score = bonus + (strong ? 3 : weak ? 1.5 : 0);
      out.push({ value: v, score, idx, line });
    };
    // ¥1,234 / \1,234 / -¥1,234
    for (const m of line.matchAll(/[¥\\]\s*-?\s*(\d[\d,.]*)/g)) push(m[1], 1.5);
    // 1,234円 / 1234円
    for (const m of line.matchAll(/(\d[\d,.]*)\s*円/g)) push(m[1], 1.5);
    // 1,234（カンマ区切りだけ）
    for (const m of line.matchAll(/(?<![\d,.¥\\])(\d{1,3}(?:[,.]\d{3})+)(?![\d,.]|\s*円)/g)) push(m[1], 0.8);
    // キーワード行の末尾の数字
    if (strong || weak) {
      const m = line.match(/(\d[\d,.]*)\s*$/);
      if (m) push(m[1], 0.3);
    }
  });
  return out;
}

function pickAmount(cands) {
  if (!cands.length) return { amount: 0, candidates: [] };
  const best = [...cands].sort((a, b) => b.score - a.score || b.value - a.value)[0];
  const distinct = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score || b.value - a.value)) {
    if (!distinct.includes(c.value)) distinct.push(c.value);
    if (distinct.length >= 4) break;
  }
  return { amount: best.value, candidates: distinct };
}

function pickDate(text, today) {
  const t = text;
  const valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
  const pad = (n) => String(n).padStart(2, '0');
  let m;
  if ((m = t.match(/(20\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  if ((m = t.match(/(?<!\d)(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?!\d)/))) {
    const [y, mo, d] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])];
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  if ((m = t.match(/令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
    const [y, mo, d] = [2018 + Number(m[1]), Number(m[2]), Number(m[3])];
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const thisYear = Number(today.slice(0, 4));
  if ((m = t.match(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*日/)) || (m = t.match(/(?<![\d\/])(\d{1,2})\/(\d{1,2})(?![\d\/])\s*(?:\(|（|\d{1,2}:\d{2})/))) {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    if (valid(thisYear, mo, d)) {
      let key = `${thisYear}-${pad(mo)}-${pad(d)}`;
      if (key > today) key = `${thisYear - 1}-${pad(mo)}-${pad(d)}`;
      return key;
    }
  }
  return today;
}

function pickShop(lines) {
  for (const raw of lines.slice(0, 12)) {
    const line = raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    if (line.length < 2 || line.length > 30) continue;
    if (NOT_SHOP.test(line)) continue;
    const digits = (line.match(/\d/g) || []).length;
    if (digits / line.length > 0.35) continue;
    if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]{2,}/u.test(line)) continue;
    return line;
  }
  return '';
}

export function parseReceipt(text, today = dayKey()) {
  const lines = text
    .split(/\r?\n/)
    .map(normalize)
    .filter((l) => l.length > 0);
  const { amount, candidates } = pickAmount(amountCandidates(lines));
  return {
    amount,
    candidates,
    date: pickDate(lines.join('\n'), today),
    shop: pickShop(lines),
    text: lines.join('\n'),
  };
}

export async function readImage(file, onProgress) {
  onProgress?.(0, '画像を整えています');
  const canvas = await fileToCanvas(file);
  const text = await recognize(canvas, onProgress);
  return parseReceipt(text);
}
