const SVG_PATHS = {
  check:     `<polyline points="20 6 9 17 4 12"/>`,
  cross:     `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  clock:     `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  dash:      `<line x1="5" y1="12" x2="19" y2="12"/>`,
  warn:      `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  save:      `<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>`,
  trophy:    `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  clipboard: `<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>`,
  cloud:     `<path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>`,
  'cloud-off': `<path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/><line x1="3" y1="3" x2="21" y2="21"/>`,
  pause:     `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`,
  trash:     `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
  pencil:    `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  grip:      `<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>`,
  chevron:   `<polyline points="6 9 12 15 18 9"/>`,
};

export const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function safeSetLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota/privacy — best effort */ }
}

export function icon(name, size = 16, extraClass = '') {
  const sw = (name === 'check' || name === 'cross') ? '2.5' : '2';
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS[name]}</svg>`;
}

export function chevronIcon(id, isOpen = false) {
  const cls = `card-chevron${isOpen ? ' open' : ''}`;
  return `<svg class="${cls}" id="${id}" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS.chevron}</svg>`;
}

const STATUS_ICONS = { ok: 'check', error: 'cross', warn: 'warn', save: 'save' };

function buildStatusHtml(msg, type) {
  const iconName = STATUS_ICONS[type];
  return iconName
    ? `<span class="toast-icon toast-${type}">${icon(iconName, 14)}</span>${escHtml(msg)}`
    : escHtml(msg);
}

export function toast(msg, type = null, duration = 2500) {
  const t = document.getElementById('toast');
  t.innerHTML = buildStatusHtml(msg, type);
  clearTimeout(t._timer);
  t.classList.add('visible');
  t._timer = setTimeout(() => t.classList.remove('visible'), duration);
}

export function showModal(title, bodyHtml, actions) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const actionsEl = document.getElementById('modal-actions');
  actionsEl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.className || 'btn-secondary btn-sm';
    btn.textContent = a.label;
    btn.onclick = async () => { const result = await a.action(); if (result !== false) hideModal(); };
    actionsEl.appendChild(btn);
  });
  overlay.hidden = false;
  overlay.onclick = e => { if (e.target === overlay) hideModal(); };
}

export function hideModal() {
  document.getElementById('modal-overlay').hidden = true;
}

export function setupBarTooltips() {
  document.addEventListener('click', (e) => {
    const wrap = e.target.closest('.bar-wrap[data-tooltip]');
    document.querySelectorAll('.bar-wrap.tooltip-active').forEach(el => {
      if (el !== wrap) el.classList.remove('tooltip-active');
    });
    if (wrap) wrap.classList.toggle('tooltip-active');
  });
}

const SYNC_SVGS = {
  ok:       () => icon('cloud', 16),
  pending:  () => icon('clock', 16, 'sync-spin'),
  disabled: () => icon('cloud-off', 16),
};

export function updateSyncIndicatorDOM(state) {
  const svg = (SYNC_SVGS[state] || SYNC_SVGS.ok)();
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.dataset.state = state; });
  document.querySelectorAll('.sync-status-icon').forEach(el => { el.innerHTML = svg; });
}
