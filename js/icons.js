// 線の太さと角の丸みをそろえた手描きアイコン。絵文字は使わない。
const svg = (d, w = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  home: svg('<path d="M4.25 10.75L12 4.5l7.75 6.25V18.5a1.75 1.75 0 0 1-1.75 1.75H6a1.75 1.75 0 0 1-1.75-1.75z"/><path d="M9.75 20.25v-5.5h4.5v5.5"/>'),
  list: svg('<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><circle cx="4.75" cy="6.5" r="0.9" fill="currentColor"/><circle cx="4.75" cy="12" r="0.9" fill="currentColor"/><circle cx="4.75" cy="17.5" r="0.9" fill="currentColor"/>'),
  calendar: svg('<rect x="3.75" y="5" width="16.5" height="15.25" rx="3.75"/><path d="M3.75 9.9h16.5M8.25 3v3.6M15.75 3v3.6"/>'),
  piggy: svg('<path d="M5.5 11.25c0-3.2 2.9-5.5 6.5-5.5 3.8 0 6.75 2.4 6.75 5.6 0 1.4-.5 2.6-1.4 3.6l.4 2.55h-2.4l-.5-1.3a9 9 0 0 1-2.85.45c-.95 0-1.9-.15-2.75-.45l-.55 1.3H6.3l.45-2.6A4.9 4.9 0 0 1 5.5 11.25z"/><path d="M3.25 11.5c0 1 .6 1.8 1.6 2.1M10 5.9V3.75h3.8"/><circle cx="15.3" cy="10.6" r="0.75" fill="currentColor"/>'),
  settings: svg('<path d="M4.5 7.5h8.75M17.75 7.5h1.75M4.5 16.5h1.75M10.75 16.5h8.75"/><circle cx="15.5" cy="7.5" r="2.15"/><circle cx="8.5" cy="16.5" r="2.15"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2),
  close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2),
  check: svg('<path d="M5.5 12.5l4.25 4.25L18.5 7.75"/>', 2.1),
  chevronL: svg('<path d="M14.75 5.5L8.25 12l6.5 6.5"/>', 2),
  chevronR: svg('<path d="M9.25 5.5l6.5 6.5-6.5 6.5"/>', 2),
  trash: svg('<path d="M4.75 7h14.5M9.75 7V4.75h4.5V7M6.75 7l.85 11.25a1.75 1.75 0 0 0 1.75 1.5h5.3a1.75 1.75 0 0 0 1.75-1.5L17.25 7"/>'),
  pen: svg('<path d="M14.75 5.25l4 4L9 19H5v-4z"/><path d="M12.75 7.25l4 4"/>'),
  camera: svg('<path d="M4.75 8.5A1.75 1.75 0 0 1 6.5 6.75h2l1.25-2h4.5l1.25 2h2a1.75 1.75 0 0 1 1.75 1.75v8.75a1.75 1.75 0 0 1-1.75 1.75H6.5a1.75 1.75 0 0 1-1.75-1.75z"/><circle cx="12" cy="12.75" r="3.1"/>'),
  image: svg('<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4.5 16.5l4.4-4.4a1.25 1.25 0 0 1 1.75 0L15 16.5M13.5 14.5l1.6-1.6a1.25 1.25 0 0 1 1.75 0L19.5 15.5"/><circle cx="15.75" cy="9.25" r="1.25"/>'),
  minus: svg('<path d="M5 12h14"/>', 2),
  arrowDown: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 2),
  arrowUp: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 2),
  swap: svg('<path d="M7 7.5h11l-3-3M17 16.5H6l3 3"/>', 2),
  wallet: svg('<rect x="3.75" y="6.5" width="16.5" height="12.5" rx="3"/><path d="M6.75 6.5V5.75A1.75 1.75 0 0 1 8.5 4h8a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M15.5 12.75h4.75v3.5H15.5a1.75 1.75 0 0 1 0-3.5z"/>'),
  bank: svg('<path d="M4 9.5L12 5l8 4.5H4z"/><path d="M5.5 9.5v7M10 9.5v7M14 9.5v7M18.5 9.5v7M4 19h16"/>'),
  cash: svg('<rect x="3.5" y="6.75" width="17" height="10.5" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6.75 10v4M17.25 10v4"/>'),
  phone: svg('<rect x="7" y="3.75" width="10" height="16.5" rx="2.5"/><path d="M10.75 17.25h2.5"/>'),
  card: svg('<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10h17M7 14.5h3.5"/>'),
  ic: svg('<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M7 10.5h3M7 13.5h5"/><circle cx="16.25" cy="12" r="1.75"/>'),
  other: svg('<circle cx="12" cy="12" r="8.25"/><path d="M12 8v4.5l3 1.75"/>'),
  stop: svg('<path d="M9 3.75h6l4.25 4.25v6L15 18.25H9L4.75 14v-6z"/><path d="M12 8v4.5"/><circle cx="12" cy="15.25" r="0.9" fill="currentColor"/>'),
  timer: svg('<circle cx="12" cy="13" r="7.25"/><path d="M12 9.5V13l2.5 1.5M9.75 3.75h4.5M12 3.75v2"/>'),
  repeat: svg('<path d="M17 3.75l3 3-3 3"/><path d="M4 11.25v-1.5a3 3 0 0 1 3-3h13M7 20.25l-3-3 3-3"/><path d="M20 12.75v1.5a3 3 0 0 1-3 3H4"/>'),
  download: svg('<path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5"/><path d="M4.75 16.5v1.25a1.75 1.75 0 0 0 1.75 1.75h11a1.75 1.75 0 0 0 1.75-1.75V16.5"/>'),
  upload: svg('<path d="M12 14.5v-10M7.5 8.5L12 4l4.5 4.5"/><path d="M4.75 16.5v1.25a1.75 1.75 0 0 0 1.75 1.75h11a1.75 1.75 0 0 0 1.75-1.75V16.5"/>'),
  heart: svg('<path d="M12 19.25S4.5 14.6 4.5 9.35A3.85 3.85 0 0 1 12 7.6a3.85 3.85 0 0 1 7.5 1.75c0 5.25-7.5 9.9-7.5 9.9z"/>'),
  info: svg('<circle cx="12" cy="12" r="8.25"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.9" fill="currentColor"/>'),
  shield: svg('<path d="M12 3.75l7 2.75v5.25c0 4.1-2.9 7.3-7 8.5-4.1-1.2-7-4.4-7-8.5V6.5z"/><path d="M9 12l2 2 4-4.25"/>'),
};

// 手段の種類ごとのアイコンと色
export const KINDS = [
  { id: 'bank', label: '銀行', icon: icons.bank, color: 'var(--k-bank)' },
  { id: 'cash', label: '現金', icon: icons.cash, color: 'var(--k-cash)' },
  { id: 'pay', label: '決済アプリ', icon: icons.phone, color: 'var(--k-pay)' },
  { id: 'ic', label: '交通系IC', icon: icons.ic, color: 'var(--k-ic)' },
  { id: 'card', label: 'カード・その他', icon: icons.card, color: 'var(--k-card)' },
];
export const kindOf = (id) => KINDS.find((k) => k.id === id) || { id, label: 'その他', icon: icons.other, color: 'var(--k-other)' };
