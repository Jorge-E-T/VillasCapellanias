/* =========================================================
   Villas Capellanias — utilities
   Formatting, dates, DOM helpers, toasts and dialogs.
   ========================================================= */
(function (global) {
  'use strict';

  const U = {};
  const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const intFmt = new Intl.NumberFormat('en-US');
  const z = (n) => (Math.abs(+n) < 0.005 ? 0 : +n);

  U.money = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : moneyFmt.format(z(n));
  U.moneyZ = (n) => moneyFmt.format(z(n || 0));
  U.money0 = (n) => money0Fmt.format(z(n || 0));
  /** Compact money for chart axes: $12k, $1.2M */
  U.moneyK = (n) => {
    const a = Math.abs(n || 0), s = n < 0 ? '−' : '';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
    return s + '$' + Math.round(a);
  };
  U.int = (n) => (n === null || n === undefined || isNaN(n)) ? '' : intFmt.format(Math.round(n));
  U.pct = (n, d = 0) => (n === null || n === undefined || !isFinite(n)) ? '—' : (n * 100).toFixed(d) + '%';
  U.round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
  U.num = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const neg = /^\s*\(.*\)\s*$/.test(String(v));
    const s = String(v).replace(/[^0-9.\-]/g, '');
    if (s === '' || s === '-' || s === '.') return null;
    const n = parseFloat(s);
    return isFinite(n) ? (neg ? -Math.abs(n) : n) : null;
  };
  U.sum = (arr, f) => arr.reduce((t, x) => t + (+(f ? f(x) : x) || 0), 0);

  /* ---- dates: stored as YYYY-MM-DD strings in local time ---- */
  U.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.todayISO = () => U.toISO(new Date());
  U.toISO = (d) => {
    if (!d) return '';
    if (typeof d === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(d.trim());
      if (us) { const y = +us[3] < 100 ? 2000 + +us[3] : +us[3]; return `${y}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`; }
      const p = new Date(d); if (isNaN(p)) return ''; d = p;
    }
    if (typeof d === 'number') d = new Date(d);
    if (!(d instanceof Date) || isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  U.parseISO = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  U.fmtDate = (s) => { const d = U.parseISO(s); return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''; };
  U.fmtDateShort = (s) => { const d = U.parseISO(s); return d ? d.toLocaleDateString('en-US', d.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
  U.monthKey = (s) => (s || '').slice(0, 7);
  U.monthLabel = (key, long) => { const [y, m] = key.split('-').map(Number); return (long ? U.MONTHS_LONG : U.MONTHS)[m - 1] + ' ' + y; };
  U.addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  U.monthEnd = (key) => { const [y, m] = key.split('-').map(Number); return U.toISO(new Date(y, m, 0)); };
  U.addDays = (iso, n) => { const d = U.parseISO(iso); d.setDate(d.getDate() + n); return U.toISO(d); };
  U.daysBetween = (a, b) => { const da = U.parseISO(a), db = U.parseISO(b); return da && db ? Math.round((db - da) / 864e5) : null; };
  U.inRange = (iso, from, to) => !!iso && (!from || iso >= from) && (!to || iso <= to);
  U.ago = (t) => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /* ---- text ---- */
  U.phone = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    return String(v ?? '').trim();
  };
  U.titleCase = (s) => String(s || '').toLowerCase().replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Fpl|Adt|At&t|Tlp|Lcdlt|Apt|Chk|Ach|Usa|Ii|Iii)\b/gi, (m) => m.toUpperCase());
  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => (global.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  U.clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.stamp = () => { const d = new Date(); return U.toISO(d) + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };
  U.norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

  /* ---- DOM ---- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  U.readFile = (file, as = 'text') => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    if (as === 'dataURL') r.readAsDataURL(file); else if (as === 'buffer') r.readAsArrayBuffer(file); else r.readAsText(file);
  });
  U.pickFile = (accept, capture) => new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
    if (capture) inp.setAttribute('capture', capture);
    inp.onchange = () => { resolve(inp.files[0] || null); inp.remove(); };
    document.body.appendChild(inp); inp.click();
  });
  /** Shrink an image file to a JPEG data URL that fits comfortably in one cloud document. */
  U.processImage = async (file, max = 1400, quality = 0.78) => {
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|heic|avif)$/i.test(file.name || '')) throw new Error('That file is not a picture.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This browser cannot read that picture format.')); i.src = url; });
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', quality);
    } finally { URL.revokeObjectURL(url); }
  };

  /* ---- toasts ---- */
  U.toast = (msg, kind = '', action) => {
    const box = U.$('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.setAttribute('role', 'status');
    el.innerHTML = `<span>${U.esc(msg)}</span>`;
    if (action && action.label) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.onclick = () => { action.fn(); el.remove(); }; el.appendChild(b);
    }
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), (action && action.ms) || (action ? 7000 : 3800));
    setTimeout(() => el.remove(), ((action && action.ms) || (action ? 7000 : 3800)) + 400);
  };

  /* ---- modal dialogs ---- */
  let modalResolve = null, lastFocus = null;
  U.modal = ({ title, body, buttons = [], onOpen, size }) => new Promise((resolve) => {
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(null); }
    const m = U.$('#modal');
    lastFocus = document.activeElement;
    U.$('#modalTitle').textContent = title;
    const oldBody = U.$('#modalBody'); const bodyEl = oldBody.cloneNode(false); oldBody.replaceWith(bodyEl);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const foot = U.$('#modalFoot'); foot.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.textContent = b.label;
      if (b.left) el.style.marginRight = 'auto';
      el.onclick = async () => {
        if (b.validate) { const ok = await b.validate(bodyEl); if (!ok) return; }
        const val = b.value !== undefined ? (typeof b.value === 'function' ? await b.value(bodyEl) : b.value) : true;
        if (val === undefined) return; // value() can return undefined to keep the dialog open
        close(val);
      };
      foot.appendChild(el);
    });
    foot.classList.toggle('hidden', !buttons.length);
    const box = U.$('.modal', m);
    box.className = 'modal' + (size ? ' modal-' + size : '');
    m.classList.remove('hidden');
    modalResolve = resolve;
    setTimeout(() => { const first = U.$('input:not([type=hidden]):not([readonly]), select, textarea', bodyEl); if (!m.contains(document.activeElement) || document.activeElement === m) (first || foot.lastElementChild || U.$('#modalClose'))?.focus(); }, 40);
    if (onOpen) onOpen(bodyEl);
  });
  function close(val) {
    U.$('#modal').classList.add('hidden');
    const r = modalResolve; modalResolve = null;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (_) { /* gone */ }
    if (r) r(val);
  }
  U.closeModal = close;
  U.modalOpen = () => !!modalResolve;
  document.addEventListener('DOMContentLoaded', () => {
    U.$('#modalClose').onclick = () => close(null);
    U.$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') close(null); });
    document.addEventListener('keydown', (e) => {
      const open = !U.$('#modal').classList.contains('hidden');
      if (!open) return;
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file' && e.target.type !== 'checkbox') {
        const primary = U.$('#modalFoot .btn-primary, #modalFoot .btn-danger');
        if (primary) { e.preventDefault(); primary.click(); }
      }
    });
  });
  U.confirm = (title, message, okLabel = 'Confirm', danger = false) => U.modal({
    title, body: `<p class="dialog-text">${message}</p>`,
    buttons: [{ label: 'Cancel', value: false, cls: 'btn-ghost' }, { label: okLabel, value: true, cls: danger ? 'btn-danger' : 'btn-primary' }]
  }).then((v) => v === true);
  U.alert = (title, message) => U.modal({ title, body: `<p class="dialog-text">${message}</p>`, buttons: [{ label: 'OK', value: true, cls: 'btn-primary' }] });
  U.prompt = (title, label, { type = 'text', value = '', placeholder = '', okLabel = 'OK', note = '' } = {}) => U.modal({
    title,
    body: `<label class="field"><span>${U.esc(label)}</span><input id="promptIn" type="${type}" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" autocomplete="off"/></label>${note ? `<p class="small muted">${note}</p>` : ''}`,
    buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: okLabel, cls: 'btn-primary', value: (b) => U.$('#promptIn', b).value }]
  });

  /* ---- forms: read and write named fields ---- */
  U.formValues = (root) => {
    const out = {};
    U.$$('[name]', root).forEach((el) => {
      const n = el.name;
      if (el.type === 'checkbox') out[n] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[n] = el.value; }
      else if (el.dataset.type === 'money' || el.type === 'number') out[n] = el.value === '' ? null : U.num(el.value);
      else out[n] = el.value.trim();
    });
    return out;
  };
  U.opts = (list, sel, blank) => (blank !== undefined ? `<option value="">${U.esc(blank)}</option>` : '') +
    list.map((o) => { const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o; return `<option value="${U.esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${U.esc(l)}</option>`; }).join('');

  global.U = U;
})(window);
