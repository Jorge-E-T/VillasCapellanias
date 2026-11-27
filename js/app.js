/* =========================================================
   App shell: lock screen, saving, navigation, search, auto-lock
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M, Store } = global;
  const $ = U.$;

  const App = {
    password: null,          // kept in memory only while unlocked (needed for cloud key + recovery refresh)
    page: 'overview',
    params: {},
    tombstones: {},
    applying: false,
    pages: global.__pages || (global.__pages = {}), // page renderers register here
    libs: {},

    /* ---------- device-only preferences ---------- */
    pref(k, v) {
      const key = 'vc-' + k;
      if (v === undefined) { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }
      try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* private mode */ }
      return v;
    },
    who() { return App.pref('name') || 'Someone'; },

    /* ---------- lazy-load big libraries (Excel / PDF) ---------- */
    loadLib(name) {
      const src = { excel: 'lib/exceljs.min.js', zip: 'lib/jszip.min.js' }[name];
      if (App.libs[name]) return App.libs[name];
      App.libs[name] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src + '. Check your connection and reload.')); document.head.appendChild(s); });
      return App.libs[name];
    },

    /* =========================================================
       Saving
       ========================================================= */
    async save(records, opts = {}) {
      records = Array.isArray(records) ? records : [records];
      if (!records.length) return;
      const now = Date.now(); const who = App.who();
      const acts = [];
      for (const r of records) {
        const isNew = !M.get(r.id) && r._c !== 'settings';
        if (!r.id) r.id = U.uid();
        if (!r.createdAt) r.createdAt = now;
        r.updatedAt = Math.max(now, (r.updatedAt || 0) + 1);
        r.updatedBy = who;
        M.upsert(r);
        delete App.tombstones[r.id];
        if (!opts.silent && r._c !== 'activity' && r._c !== 'files') acts.push(App.activityRec(isNew ? 'add' : 'edit', r, opts.label));
      }
      const logged = opts.silent ? [] : (opts.bulkLabel && records.length > 1 ? [App.activityRec('bulk', null, `${opts.bulkLabel} (${records.length})`)] : acts);
      logged.forEach((a) => M.upsert(a));
      const all = [...records, ...logged];
      M.sortAll();
      App.saving(true);
      try {
        await Store.putMany(all);
        await Store.putVault('tombstones', App.tombstones);
      } catch (e) { console.error(e); U.toast('Could not save on this device: ' + e.message, 'err'); }
      App.saving(false);
      global.Sync && Sync.changed();
      if (!opts.noRender) App.render();
    },
    async remove(ids, label) {
      ids = (Array.isArray(ids) ? ids : [ids]).filter((id) => M.get(id));
      if (!ids.length) return;
      const copies = ids.map((id) => U.clone(M.get(id)));
      const now = Date.now();
      ids.forEach((id) => { M.remove(id); App.tombstones[id] = now; });
      const act = App.activityRec('delete', copies.length === 1 ? copies[0] : null, label || `${copies.length} records`);
      M.upsert(act);
      await Store.deleteMany(ids);
      await Store.putMany([act]);
      await Store.putVault('tombstones', App.tombstones);
      global.Sync && Sync.changed();
      App.render();
      U.toast(`Deleted ${label || (copies.length + ' records')}.`, '', { label: 'Undo', fn: () => App.save(copies.map((c) => ({ ...c })), { label: 'Restored ' + (label || 'records') }) });
    },
    activityRec(action, r, label) {
      return { id: U.uid(), _c: 'activity', t: Date.now(), who: App.who(), action, coll: r ? r._c : '', recId: r ? r.id : '', label: label || (r ? App.describe(r) : ''), updatedAt: Date.now(), createdAt: Date.now() };
    },
    describe(r) {
      switch (r._c) {
        case 'payments': return `Rent ${U.money(r.amount)} · ${M.unitLabel(r.unitId)} · ${U.monthLabel(r.forMonth || U.monthKey(r.date))}`;
        case 'txns': return `${r.type === 'income' ? 'Income' : r.type === 'transfer' ? 'Transfer' : 'Expense'} ${U.money(r.amount)} · ${r.description || M.catName(r.category)}`;
        case 'tenants': return `Tenant ${r.name} (${M.unitLabel(r.unitId)})`;
        case 'units': return `Unit ${r.number}`;
        case 'deposits': return `Security deposit ${U.money(r.amount)} · ${M.unitLabel(r.unitId)}`;
        case 'assets': return `Asset ${r.name}`;
        case 'liabilities': return `Liability ${r.name}`;
        case 'vendors': return `Vendor ${r.name}`;
        case 'bills': return `Recurring bill ${r.name}`;
        case 'accounts': return `Account ${r.name}`;
        case 'settings': return 'Settings';
        case 'legalcfg': return 'Legal details (landlord, attorney, bank)';
        case 'legal': return `Legal: ${(global.Legal && Legal.PACKETS[r.packet] ? Legal.PACKETS[r.packet].title : r.packet)} (${r.status}) · ${M.unitLabel(r.unitId)}`;
        default: return r._c;
      }
    },
    saveSettings(patch, label) { Object.assign(M.D.settings, patch); return App.save(M.D.settings, { label: label || 'Settings' }); },
    saving(on) { const el = $('#saveState'); if (!el) return; el.textContent = on ? 'Saving…' : 'Saved'; el.classList.toggle('busy', on); if (!on) { clearTimeout(App._sv); App._sv = setTimeout(() => { el.textContent = ''; }, 2200); } },

    /* safety snapshot of everything (before imports and restores) — kept encrypted on this device */
    async snapshot(reason) {
      const id = 'snap:' + Date.now();
      await Store.putVault(id, { reason, t: Date.now(), records: M.all() });
      const keys = (await Store.vaultKeys('snap:')).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 8))) await Store.putVault(k, null);
    },

    /* =========================================================
       Lock screen
       ========================================================= */
    async initLock() {
      const form = $('#lockForm'), pass = $('#lockPass'), err = $('#lockError');
      const setUp = await Store.isSetUp().catch((e) => { err.textContent = e.message; return true; });
      App.creating = !setUp;
      if (App.creating) {
        $('#lockSub').textContent = 'Create the password that will protect the building’s records on this device.';
        $('#lockConfirmWrap').classList.remove('hidden'); $('#lockHintWrap').classList.remove('hidden'); $('#pwMeter').classList.remove('hidden');
        $('#lockBtn').textContent = 'Create password'; $('#lockReset').classList.add('hidden');
        pass.setAttribute('autocomplete', 'new-password');
        $('#lockFootText').textContent = 'Use at least 10 characters. A short sentence you will remember works well. Everyone who uses the app shares this password.';
        pass.addEventListener('input', () => App.meter(pass.value));
      }
      U.$$('[data-eye]').forEach((b) => b.addEventListener('click', () => { const i = document.getElementById(b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; }));
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); err.textContent = '';
        const pw = pass.value;
        if (App.creating) {
          if (pw.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
          if (pw !== $('#lockConfirm').value) { err.textContent = 'The two passwords don’t match.'; return; }
          $('#lockBtn').disabled = true; $('#lockBtn').textContent = 'Creating…';
          await Store.setup(pw);
          await Store.setHint($('#lockHint').value.trim());
          App.password = pw;
          await App.afterUnlock(true);
          return;
        }
        $('#lockBtn').disabled = true; $('#lockBtn').textContent = 'Unlocking…';
        const ok = await Store.unlock(pw).catch((x) => { err.textContent = x.message; return false; });
        $('#lockBtn').disabled = false; $('#lockBtn').textContent = 'Unlock';
        if (!ok) {
          err.textContent = 'That password is not right.';
          const hint = await Store.getHint(); if (hint) { $('#lockHintShow').textContent = 'Hint: ' + hint; $('#lockHintShow').classList.remove('hidden'); }
          pass.select(); return;
        }
        App.password = pw;
        await App.afterUnlock(false);
      });
      $('#lockReset').addEventListener('click', () => App.forgot());
      setTimeout(() => pass.focus(), 60);
    },
    meter(pw) {
      const m = $('#pwMeter'); let s = 0;
      if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw) || / /.test(pw)) s++;
      if (pw.length < 10) s = Math.min(s, 1);
      const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
      m.dataset.s = s; m.querySelector('span').textContent = pw ? labels[s] : '';
      m.querySelector('i').style.width = (pw ? (s + 1) / 6 * 100 : 0) + '%';
    },
    async forgot() {
      const qs = await Store.getQuestions();
      const hasKey = await Store.hasRecoveryKey();
      if (!qs && !hasKey) {
        return U.alert('No way back in', 'No recovery key or security questions were set up on this device, so the encrypted records can’t be opened without the password. If cloud sync is on, you can erase this device (Settings is not reachable while locked, so clear this site’s data in the browser), set a new password, and sign in to the cloud again — but you will still need the original password to read the cloud copy.');
      }
      const body = U.h(`<div>
        <div class="seg" role="tablist">${hasKey ? '<button type="button" class="on" data-m="key">Recovery key</button>' : ''}${qs ? `<button type="button" class="${hasKey ? '' : 'on'}" data-m="q">Security questions</button>` : ''}</div>
        <div data-p="key" class="${hasKey ? '' : 'hidden'}"><label class="field"><span>Recovery key (25 letters and numbers)</span><input id="rkIn" autocomplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false"/></label></div>
        <div data-p="q" class="${hasKey ? 'hidden' : ''}"><p class="small muted">Answer any two. Capitals, spaces and punctuation don’t matter.</p>${(qs || []).map((q, i) => `<label class="field"><span>${U.esc(q)}</span><input data-ans="${i}" autocomplete="off"/></label>`).join('')}</div>
        <hr/><label class="field"><span>New password</span><input id="npw" type="password" autocomplete="new-password"/></label>
        <label class="field"><span>Type it again</span><input id="npw2" type="password" autocomplete="new-password"/></label>
        <p class="lock-error" id="fpErr"></p></div>`);
      let mode = hasKey ? 'key' : 'q';
      U.$$('[data-m]', body).forEach((b) => b.onclick = () => { mode = b.dataset.m; U.$$('[data-m]', body).forEach((x) => x.classList.toggle('on', x === b)); U.$$('[data-p]', body).forEach((p) => p.classList.toggle('hidden', p.dataset.p !== mode)); });
      await U.modal({
        title: 'Reset your password', body, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: 'Reset password', cls: 'btn-primary', value: async (b) => {
            const e = U.$('#fpErr', b); const n1 = U.$('#npw', b).value, n2 = U.$('#npw2', b).value;
            if (n1.length < 10) { e.textContent = 'The new password needs at least 10 characters.'; return undefined; }
            if (n1 !== n2) { e.textContent = 'The two new passwords don’t match.'; return undefined; }
            e.textContent = 'Checking…';
            const old = mode === 'key' ? await Store.recoverWithKey(U.$('#rkIn', b).value) : await Store.recoverWithAnswers(U.$$('[data-ans]', b).map((i) => i.value));
            if (!old) { e.textContent = mode === 'key' ? 'That recovery key is not right.' : 'At least two answers need to be right.'; return undefined; }
            await Store.unlock(old);
            await Store.changePassword(old, n1);
            App.password = n1;
            U.closeModal(true);
            await App.afterUnlock(false);
            global.Sync && Sync.passwordChanged(old, n1);
            U.toast('Password reset. Use the new password from now on, on every device.', 'ok');
            return true;
          }
        }]
      });
    },

    async afterUnlock(isNew) {
      let records = [];
      try { records = await Store.loadAll(); } catch (e) { U.alert('Could not read the records', U.esc(e.message)); return; }
      App.tombstones = (await Store.getVault('tombstones').catch(() => null)) || {};
      M.load(records);
      // prune activity older than one year
      const cut = Date.now() - 365 * 864e5; const old = M.D.activity.filter((a) => a.t < cut).map((a) => a.id);
      if (old.length) { old.forEach((id) => M.remove(id)); Store.deleteMany(old); }
      $('#lock').classList.add('hidden'); $('#app').classList.remove('hidden');
      $('#lockPass').value = ''; $('#lockConfirm').value = ''; $('#lockError').textContent = '';
      App.setUnlockMode();
      App.startIdle();
      App.applyBrand();
      if (!App.pref('name')) await App.askName();
      App.route();
      if (isNew) await App.securitySetup(true);
      global.Sync && Sync.unlocked(App.password);
      global.Legal && Legal.onUnlock();
      App.checkBanner();
    },
    async askName() {
      const v = await U.modal({
        title: 'Who is using this device?',
        body: `<p class="dialog-text">Your name is shown next to the changes you make, so everyone can see who recorded what.</p><label class="field"><span>Your name</span><input id="nmIn" autocomplete="name" placeholder="e.g. Vivian"/></label>`,
        buttons: [{ label: 'Save name', cls: 'btn-primary', value: (b) => U.$('#nmIn', b).value.trim() || 'Owner' }]
      });
      App.pref('name', v || 'Owner');
    },
    /** Recovery key + security questions, offered right after the password is created. */
    async securitySetup(first) {
      const code = (await Store.getRecoveryKey()) || Store.newRecoveryKey();
      const QS = ['What street did you grow up on?', 'What was the name of your first pet?', 'What is your mother’s maiden name?', 'In what city was your father born?', 'What was the make of your first car?', 'What was the name of your elementary school?', 'What is the middle name of your oldest child?', 'What was your childhood nickname?'];
      const prev = await Store.getQuestionAnswers();
      const sel = (i) => `<select data-q="${i}">${QS.map((q, j) => `<option${(prev ? prev.questions[i] === q : j === i * 2) ? ' selected' : ''}>${U.esc(q)}</option>`).join('')}</select>`;
      const body = U.h(`<div class="stack">
        <p class="dialog-text">${first ? 'Your password is created. ' : ''}If the password is ever forgotten, either of these lets you set a new one without losing anything.</p>
        <section class="callout"><h3>1 · Recovery key</h3><p class="small">Print it or write it down and keep it with the building’s papers. Anyone holding it can reset the password.</p>
        <div class="rk">${U.esc(code)}</div><div class="btn-row"><button type="button" class="btn btn-sm" id="rkCopy">Copy</button><button type="button" class="btn btn-sm" id="rkPrint">Print</button></div></section>
        <section class="callout"><h3>2 · Security questions</h3><p class="small">Choose answers that can’t be looked up online. Any two of three are enough.</p>
        ${[0, 1, 2].map((i) => `<div class="qa">${sel(i)}<input data-a="${i}" placeholder="Answer" autocomplete="off" value=""/></div>`).join('')}
        ${prev ? '<p class="small muted">Leave all three answers empty to keep your current questions.</p>' : ''}</section>
        <p class="lock-error" id="ssErr"></p></div>`);
      U.$('#rkCopy', body).onclick = () => { navigator.clipboard && navigator.clipboard.writeText(code); U.toast('Recovery key copied.', 'ok'); };
      U.$('#rkPrint', body).onclick = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<title>Recovery key</title><body style="font:16px system-ui;padding:40px"><h2>${U.esc(M.D.settings.propertyName)} — recovery key</h2><p>Created ${new Date().toLocaleDateString()}. Keep this somewhere safe. It resets the app password.</p><p style="font:700 26px monospace;letter-spacing:2px;border:2px solid #000;padding:16px;display:inline-block">${U.esc(code)}</p><p>Open the app → Forgot password? → Recovery key.</p></body>`); w.document.close(); w.print(); };
      const r = await U.modal({
        title: 'Set up password recovery', body, size: 'md',
        buttons: [{ label: first ? 'Skip for now' : 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: 'Save recovery options', cls: 'btn-primary', value: (b) => {
            const qs = [0, 1, 2].map((i) => U.$(`[data-q="${i}"]`, b).value);
            const as = [0, 1, 2].map((i) => U.$(`[data-a="${i}"]`, b).value);
            const err = U.$('#ssErr', b);
            if (new Set(qs).size < 3) { err.textContent = 'Pick three different questions.'; return undefined; }
            const filled = as.filter((a) => Store.normAnswer(a)).length;
            if (filled && filled < 3) { err.textContent = 'Answer all three questions (or leave all three empty).'; return undefined; }
            if (!filled && !prev) { err.textContent = 'Answer the three questions, or choose Skip.'; return undefined; }
            return { qs, as: filled ? as : null };
          }
        }]
      });
      if (!r) { if (first) U.toast('You can set up recovery later in Settings → Security.', ''); return; }
      await Store.setupRecoveryKey(App.password, code);
      if (r.as) await Store.setupQuestions(App.password, r.qs, r.as);
      U.toast('Recovery options saved.', 'ok');
    },
    setUnlockMode() {
      App.creating = false;
      ['#lockConfirmWrap', '#lockHintWrap', '#pwMeter'].forEach((s) => $(s).classList.add('hidden'));
      $('#lockReset').classList.remove('hidden');
      $('#lockBtn').disabled = false; $('#lockBtn').textContent = 'Unlock';
      $('#lockPass').setAttribute('autocomplete', 'current-password');
      $('#lockFootText').textContent = 'Your records are encrypted on this device with AES-256.';
    },
    lock() {
      App.password = null;
      App.setUnlockMode();
      Store.lock();
      global.Sync && Sync.lock();
      M.load([]);
      U.closeModal(null);
      $('#view').innerHTML = '';
      $('#app').classList.add('hidden'); $('#lock').classList.remove('hidden');
      $('#lockHintShow').classList.add('hidden');
      $('#lockSub').textContent = 'Locked. Enter your password to continue.';
      setTimeout(() => $('#lockPass').focus(), 50);
    },
    startIdle() {
      const reset = () => { App._lastAct = Date.now(); };
      reset();
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
      clearInterval(App._idle);
      App._idle = setInterval(() => {
        const min = +M.D.settings.autoLockMin || 0;
        if (Store.unlocked && min > 0 && Date.now() - App._lastAct > min * 60000) { App.lock(); U.toast('Locked after ' + min + ' minutes without activity.'); }
      }, 20000);
    },

    /* =========================================================
       Navigation & rendering
       ========================================================= */
    go(page, params) { const q = params ? '?' + new URLSearchParams(params).toString() : ''; const h = '#/' + page + q; if (location.hash === h) App.route(); else location.hash = h; },
    route() {
      const m = /^#\/([\w-]+)(?:\?(.*))?$/.exec(location.hash || '');
      App.page = m && App.pages[m[1]] ? m[1] : 'overview';
      App.params = m && m[2] ? Object.fromEntries(new URLSearchParams(m[2])) : {};
      App.render(true);
    },
    render(scrollTop) {
      if (!Store.unlocked) return;
      const view = $('#view');
      U.$$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === App.page));
      const n = M.reviewQueue().length; const b = $('#reviewBadge'); b.textContent = n; b.classList.toggle('hidden', !n);
      try { global.Legal && Legal.badges(); } catch (e) { console.warn(e); }
      const y = view.scrollTop, x = window.scrollY;
      const focusId = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : null;
      view.onclick = null; view.onkeydown = null; view.onchange = null;
      try { App.pages[App.page](view, App.params); } catch (e) { console.error(e); view.innerHTML = `<div class="empty"><h2>Something went wrong on this page</h2><p>${U.esc(e.message)}</p></div>`; }
      if (scrollTop) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); } else { window.scrollTo(0, x); view.scrollTop = y; if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'search') el.setSelectionRange(el.value.length, el.value.length); } } }
      document.body.classList.remove('nav-open');
      App.applyBrand();
    },
    applyBrand() {
      const s = M.D.settings;
      $('#brandName').textContent = s.propertyName || 'Villas Capellanias';
      $('#brandAddr').textContent = [s.address, s.city].filter(Boolean).join(', ');
      $('#whoami').textContent = 'Signed in on this device as ' + App.who();
      document.title = (s.propertyName || 'Villas Capellanias');
    },
    checkBanner() {
      const last = App.pref('lastBackup');
      const days = +M.D.settings.backupDays || 0;
      const el = $('#banner');
      const synced = global.Sync && Sync.signedIn();
      if (days && M.D.units.length && (!last || Date.now() - last > days * 864e5) && !(App.pref('snoozeBackup') > Date.now())) {
        el.innerHTML = `<span>${last ? `Your last backup file is from ${U.ago(last)}.` : 'You haven’t downloaded a backup file yet.'} ${synced ? 'Cloud sync keeps devices in step, but a file backup protects against mistakes too.' : 'Without one, a lost or reset device means lost records.'}</span><button class="btn btn-sm btn-primary" id="bnBackup" type="button">Download backup</button><button class="btn btn-sm btn-ghost" id="bnSnooze" type="button">Remind me in 3 days</button>`;
        el.classList.remove('hidden');
        $('#bnBackup').onclick = () => global.Settings.backup();
        $('#bnSnooze').onclick = () => { App.pref('snoozeBackup', Date.now() + 3 * 864e5); el.classList.add('hidden'); };
      } else el.classList.add('hidden');
    },

    /* =========================================================
       Search
       ========================================================= */
    search(q) {
      q = U.norm(q).trim(); if (q.length < 2) return [];
      const out = [];
      const add = (kind, label, sub, go) => out.push({ kind, label, sub, go });
      const pages = [['legal', 'Legal'], ['overview', 'Overview'], ['units', 'Units & tenants'], ['rent', 'Rent'], ['ledger', 'Income & expenses'], ['review', 'Needs review'], ['bills', 'Recurring bills'], ['assets', 'Assets'], ['liabilities', 'Liabilities'], ['vendors', 'Vendors'], ['reports', 'Reports'], ['settings', 'Settings'], ['help', 'Help']];
      pages.forEach(([p, l]) => { if (U.norm(l).includes(q)) add('Page', l, '', () => App.go(p)); });
      M.D.units.forEach((u) => { if (('unit ' + u.number).includes(q) || String(u.number) === q) add('Unit', 'Unit ' + u.number, (M.currentTenant(u.id) || {}).name || 'Vacant', () => App.go('units', { id: u.id })); });
      M.D.tenants.forEach((t) => { if (U.norm([t.name, t.phone, t.email, t.otherContact].join(' ')).includes(q)) add('Tenant', t.name, M.unitLabel(t.unitId) + (t.moveOut ? ' · moved out' : ''), () => App.go('units', { id: t.unitId })); });
      M.D.vendors.forEach((v) => { if (U.norm([v.name, v.phone, v.email, v.account].join(' ')).includes(q)) add('Vendor', v.name, M.catName(v.category), () => App.go('vendors', { id: v.id })); });
      M.D.assets.forEach((a) => { if (U.norm([a.name, a.type, a.serial, a.location].join(' ')).includes(q)) add('Asset', a.name, a.type, () => App.go('assets')); });
      M.D.liabilities.forEach((l) => { if (U.norm([l.name, l.lender].join(' ')).includes(q)) add('Liability', l.name, l.type, () => App.go('liabilities')); });
      M.D.txns.forEach((x) => { if (out.length < 60 && U.norm([x.description, x.notes, x.ref, String(x.amount)].join(' ')).includes(q)) add(x.type === 'income' ? 'Income' : x.type === 'transfer' ? 'Transfer' : 'Expense', x.description || M.catName(x.category), `${U.fmtDate(x.date)} · ${U.money(x.amount)}`, () => global.Forms.txn(x)); });
      M.D.payments.forEach((p) => { if (out.length < 60 && U.norm([p.checkNo, p.notes, String(p.amount)].join(' ')).includes(q) && q.length > 2) add('Rent', `${M.unitLabel(p.unitId)} · ${U.money(p.amount)}`, `${U.fmtDate(p.date)}${p.checkNo ? ' · check ' + p.checkNo : ''}`, () => global.Forms.payment(p)); });
      return out.slice(0, 40);
    },
    wireSearch() {
      const inp = $('#globalSearch'), box = $('#searchResults');
      let res = [], sel = 0;
      const draw = () => {
        if (!inp.value.trim()) { box.classList.add('hidden'); return; }
        res = App.search(inp.value); sel = 0;
        box.innerHTML = res.length ? res.map((r, i) => `<button type="button" role="option" data-i="${i}" class="${i === sel ? 'on' : ''}"><em>${U.esc(r.kind)}</em><b>${U.esc(r.label)}</b><small>${U.esc(r.sub || '')}</small></button>`).join('') : '<p class="small muted" style="padding:12px">Nothing matches. Try a unit number, a name, a vendor or an amount.</p>';
        box.classList.remove('hidden');
      };
      inp.addEventListener('input', U.debounce(draw, 120));
      inp.addEventListener('focus', draw);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % Math.max(1, res.length); U.$$('button', box).forEach((b, i) => b.classList.toggle('on', i === sel)); }
        if (e.key === 'Enter' && res[sel]) { e.preventDefault(); const r = res[sel]; inp.value = ''; box.classList.add('hidden'); inp.blur(); r.go(); }
        if (e.key === 'Escape') { inp.value = ''; box.classList.add('hidden'); inp.blur(); }
      });
      box.addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; e.preventDefault(); const r = res[+b.dataset.i]; inp.value = ''; box.classList.add('hidden'); inp.blur(); r.go(); });
      inp.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 150));
      document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !U.modalOpen() && Store.unlocked) { e.preventDefault(); inp.focus(); } });
    },

    /* =========================================================
       Start
       ========================================================= */
    async init() {
      App.wireSearch();
      $('#btnLock').onclick = () => App.lock();
      $('#btnMenu').onclick = () => document.body.classList.toggle('nav-open');
      $('#btnTheme').onclick = () => {
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', cur); try { localStorage.setItem('vc-theme', cur); } catch (_) { /* ignore */ }
      };
      $('#btnBell').onclick = (e) => { e.stopPropagation(); global.Legal && Legal.bellMenu(); };
      document.addEventListener('click', (e) => { const bm = $('#bellMenu'); if (bm && !bm.contains(e.target) && !e.target.closest('#btnBell')) bm.classList.add('hidden'); if (e.target.closest('#bellMenu a')) bm.classList.add('hidden'); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#bellMenu').classList.add('hidden'); });
      const qb = $('#btnQuick'), qm = $('#quickMenu');
      qb.onclick = (e) => { e.stopPropagation(); qm.classList.toggle('hidden'); };
      document.addEventListener('click', (e) => { if (!qm.contains(e.target)) qm.classList.add('hidden'); });
      qm.addEventListener('click', (e) => {
        const b = e.target.closest('[data-quick]'); if (!b) return; qm.classList.add('hidden');
        const F = global.Forms;
        ({ payment: () => F.payment(), batch: () => F.batch(), expense: () => F.txn({ type: 'expense' }), income: () => F.txn({ type: 'income' }), tenant: () => F.tenant(), legal: () => global.Legal.pick(), asset: () => F.asset(), liability: () => F.liability() })[b.dataset.quick]();
      });
      window.addEventListener('hashchange', () => App.route());
      document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#side') && !e.target.closest('#btnMenu')) document.body.classList.remove('nav-open'); });
      if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
      if (!global.isSecureContext || !global.crypto || !crypto.subtle) {
        $('#lockError').textContent = 'This page must be opened over https:// (or http://localhost) so the browser allows encryption.';
        $('#lockBtn').disabled = true; return;
      }
      global.Sync && Sync.init(App.syncApi());
      await App.initLock();
    },

    /* ---------- what cloud sync needs from the app ---------- */
    syncApi() {
      return {
        snapshot: () => ({ records: M.all().filter((r) => r._c !== 'activity' || r.t > Date.now() - 365 * 864e5), tombstones: { ...App.tombstones } }),
        applying: () => App.applying,
        async apply({ put = [], del = [] }) {
          App.applying = true;
          try {
            put.forEach((r) => { M.upsert(r); delete App.tombstones[r.id]; });
            del.forEach(({ id, t }) => { M.remove(id); App.tombstones[id] = Math.max(App.tombstones[id] || 0, t || Date.now()); });
            M.sortAll();
            if (put.length) await Store.putMany(put);
            if (del.length) await Store.deleteMany(del.map((d) => d.id));
            await Store.putVault('tombstones', App.tombstones);
          } finally { App.applying = false; }
          if (!U.modalOpen() || !document.activeElement || !U.$('#modal').contains(document.activeElement)) App.render();
        },
        firstConnect: (info) => U.modal({
          title: 'This device and the cloud both have records',
          body: `<p class="dialog-text">The cloud already holds <b>${info.cloud}</b> records and this device has <b>${info.local}</b>. How should they be combined?</p><ul class="small"><li><b>Use the cloud copy</b> if this device was only used for testing. A safety snapshot of this device is kept in Settings.</li><li><b>Combine both</b> to keep everything. The newest version of each record wins.</li></ul>`,
          buttons: [{ label: 'Cancel and sign out', value: null, cls: 'btn-ghost' }, { label: 'Combine both', value: 'combine', cls: 'btn' }, { label: 'Use the cloud copy', value: 'cloud', cls: 'btn-primary' }]
        }),
        snapshotBefore: (why) => App.snapshot(why),
        confirmMassDelete: (n) => U.confirm('Delete many records everywhere?', `This device is about to delete <b>${n}</b> records from the cloud and from every other device. This usually happens after restoring an old backup. Continue?`, 'Delete them everywhere', true),
        askCloudPassword: () => U.modal({
          title: 'The cloud copy uses a different password',
          body: `<p class="dialog-text">The password was probably changed on another device. Enter the <b>current</b> app password (the one the other device now uses). This device will switch to it.</p><label class="field"><span>Current app password</span><input id="cpw" type="password" autocomplete="current-password"/></label>`,
          buttons: [{ label: 'Not now', value: null, cls: 'btn-ghost' }, { label: 'Use this password', cls: 'btn-primary', value: (b) => U.$('#cpw', b).value || null }]
        }),
        async adoptPassword(newPw) {
          const ok = await Store.changePassword(App.password, newPw);
          if (ok) { App.password = newPw; U.toast('This device now uses the new password.', 'ok'); }
          return ok;
        },
        reload: async () => { M.load(await Store.loadAll()); App.render(); }
      };
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
