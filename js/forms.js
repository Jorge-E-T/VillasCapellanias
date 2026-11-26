/* =========================================================
   Forms: add and edit dialogs for every kind of record
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M } = global;
  const D = M.D;
  const App = () => global.App;

  const fld = (label, input, cls = '') => `<label class="field ${cls}"><span>${label}</span>${input}</label>`;
  const inp = (name, val, attrs = '') => `<input name="${name}" value="${U.esc(val ?? '')}" ${attrs}/>`;
  const money = (name, val, attrs = '') => `<span class="money-in"><i>$</i><input name="${name}" data-type="money" inputmode="decimal" value="${val === null || val === undefined || val === '' ? '' : U.esc(String(val))}" ${attrs}/></span>`;
  const date = (name, val, attrs = '') => `<input type="date" name="${name}" value="${U.esc(val || '')}" ${attrs}/>`;
  const area = (name, val, rows = 2) => `<textarea name="${name}" rows="${rows}">${U.esc(val || '')}</textarea>`;
  const sel = (name, opts, val, blank) => `<select name="${name}">${U.opts(opts, val, blank)}</select>`;
  const chk = (name, on, label) => `<label class="check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}/><span>${label}</span></label>`;
  const unitOpts = () => D.units.map((u) => ({ value: u.id, label: 'Unit ' + u.number + ((M.currentTenant(u.id) || {}).name ? ' — ' + M.currentTenant(u.id).name : '') }));
  const monthOpts = (center) => { const out = []; for (let i = -14; i <= 3; i++) { const k = U.addMonths(center, i); out.push({ value: k, label: U.monthLabel(k, true) }); } return out; };
  const err = (b, msg) => { const e = U.$('.form-err', b); if (e) e.textContent = msg; return undefined; };
  const delBtn = (rec, label, extra) => rec && M.get(rec.id) ? [{ label: 'Delete', cls: 'btn-ghost btn-danger-text', left: true, value: async () => { if (extra && !(await extra())) return undefined; if (await U.confirm('Delete?', `Delete ${U.esc(label)}? You can undo right after.`, 'Delete', true)) { App().remove(rec.id, label); return 'deleted'; } return undefined; } }] : [];

  const F = {
    /* ---------------- rent payment ---------------- */
    async payment(p, defaults = {}) {
      const isNew = !p;
      p = p ? { ...p } : { _c: 'payments', date: U.todayISO(), forMonth: U.monthKey(U.todayISO()), method: 'Check', amount: null, ...defaults };
      if (isNew && p.unitId && p.amount === null) { const st = M.rentStatus(M.unit(p.unitId), p.forMonth); p.amount = st.balance || st.expected || null; }
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Unit', sel('unitId', unitOpts(), p.unitId, 'Choose a unit…'))}${fld('Rent for', sel('forMonth', monthOpts(p.forMonth || U.monthKey(U.todayISO())), p.forMonth))}</div>
        <p class="small muted" id="payInfo"></p>
        <div class="row3">${fld('Amount received', money('amount', p.amount))}${fld('Date received', date('date', p.date))}${fld('Paid by', sel('method', D.settings.methods, p.method))}</div>
        <div class="row2">${fld('Check / reference number', inp('checkNo', p.checkNo, 'inputmode="numeric"'))}${fld('Deposited to', sel('accountId', D.accounts.map((a) => ({ value: a.id, label: a.name })), p.accountId, D.accounts.length ? 'Main account' : 'No accounts yet'))}</div>
        ${fld('Notes', area('notes', p.notes))}
        <p class="form-err lock-error"></p></form>`);
      const info = () => {
        const v = U.formValues(body); const u = M.unit(v.unitId);
        if (!u) { U.$('#payInfo', body).textContent = ''; return; }
        const st = M.rentStatus(u, v.forMonth);
        U.$('#payInfo', body).innerHTML = st.tenant ? `${U.esc(st.tenant.name)} · rent ${U.money(st.expected)} · due ${U.fmtDateShort(st.due)} · already recorded for this month: <b>${U.money(st.paid - (isNew ? 0 : (M.get(p.id) || {}).amount || 0))}</b>` : 'No tenant on file for this month.';
      };
      body.addEventListener('change', (e) => { info(); if (isNew && (e.target.name === 'unitId' || e.target.name === 'forMonth')) { const v = U.formValues(body); const u = M.unit(v.unitId); if (u) { const st = M.rentStatus(u, v.forMonth); U.$('[name=amount]', body).value = st.balance || st.expected || ''; } } });
      const r = await U.modal({
        title: isNew ? 'Record rent payment' : 'Edit rent payment', body, size: 'md', onOpen: info,
        buttons: [...delBtn(p, 'this rent payment'), { label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: isNew ? 'Record payment' : 'Save changes', cls: 'btn-primary', value: (b) => {
            const v = U.formValues(b);
            if (!v.unitId) return err(b, 'Choose the unit.');
            if (!v.amount || v.amount <= 0) return err(b, 'Enter the amount received.');
            if (!v.date) return err(b, 'Enter the date it was received.');
            const t = M.tenantForMonth(v.unitId, v.forMonth);
            return { ...p, ...v, tenantId: (t && t.id) || p.tenantId || '' };
          }
        }]
      });
      if (r && r !== 'deleted') { await App().save(r); U.toast(isNew ? `Recorded ${U.money(r.amount)} from ${M.unitLabel(r.unitId)}.` : 'Payment updated.', 'ok'); }
      return r;
    },

    /* ---------------- bank deposit with several checks ---------------- */
    async batch(month) {
      month = month || U.monthKey(U.todayISO());
      const row = (s) => `<tr><td><select data-k="unitId">${U.opts(unitOpts(), s.unitId, 'Unit…')}</select></td><td>${money('', s.amount, 'data-k="amount"')}</td><td><input data-k="checkNo" inputmode="numeric" value="${U.esc(s.checkNo || '')}"/></td><td><button type="button" class="btn-icon" data-rm aria-label="Remove row"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></td></tr>`;
      const body = U.h(`<form class="form" autocomplete="off">
        <p class="dialog-text">One bank deposit often holds several tenants’ checks. Each line becomes that unit’s rent payment.</p>
        <div class="row3">${fld('Deposit date', date('date', U.todayISO()))}${fld('Rent for', sel('forMonth', monthOpts(month), month))}${fld('Paid by', sel('method', D.settings.methods, 'Check'))}</div>
        <div class="btn-row"><button type="button" class="btn btn-sm" id="bFill">Add every unit not yet paid</button><button type="button" class="btn btn-sm btn-ghost" id="bAdd">Add a line</button></div>
        <table class="tbl tbl-form"><thead><tr><th>Unit</th><th>Amount</th><th>Check no.</th><th></th></tr></thead><tbody id="bRows">${row({})}</tbody><tfoot><tr><th>Total</th><th id="bTot" class="num">$0.00</th><th colspan="2"></th></tr></tfoot></table>
        ${chk('ledgerLine', true, 'Also add the bank deposit to Income &amp; expenses, for matching the bank statement (not counted twice)')}
        <p class="form-err lock-error"></p></form>`);
      const tb = U.$('#bRows', body);
      const total = () => { U.$('#bTot', body).textContent = U.money(U.sum(U.$$('[data-k=amount]', tb), (i) => U.num(i.value) || 0)); };
      const fillRent = (tr) => { const u = M.unit(U.$('[data-k=unitId]', tr).value); const a = U.$('[data-k=amount]', tr); if (u && !a.value) { const st = M.rentStatus(u, U.$('[name=forMonth]', body).value); a.value = st.balance || st.expected || ''; } total(); };
      body.addEventListener('change', (e) => { if (e.target.dataset.k === 'unitId') fillRent(e.target.closest('tr')); total(); });
      body.addEventListener('input', total);
      body.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); total(); } });
      U.$('#bAdd', body).onclick = () => { tb.insertAdjacentHTML('beforeend', row({})); };
      U.$('#bFill', body).onclick = () => {
        const k = U.$('[name=forMonth]', body).value;
        const have = new Set(U.$$('[data-k=unitId]', tb).map((s) => s.value).filter(Boolean));
        U.$$('tr', tb).forEach((tr) => { if (!U.$('[data-k=unitId]', tr).value) tr.remove(); });
        M.rentRoll(k).filter((s) => s.balance > 0 && !have.has(s.unit.id)).forEach((s) => tb.insertAdjacentHTML('beforeend', row({ unitId: s.unit.id, amount: s.balance })));
        total();
      };
      const r = await U.modal({
        title: 'Record a bank deposit', body, size: 'lg',
        buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: 'Record payments', cls: 'btn-primary', value: (b) => {
            const v = U.formValues(b);
            const lines = U.$$('tr', tb).map((tr) => ({ unitId: U.$('[data-k=unitId]', tr).value, amount: U.num(U.$('[data-k=amount]', tr).value), checkNo: U.$('[data-k=checkNo]', tr).value.trim() })).filter((l) => l.unitId || l.amount);
            if (!lines.length) return err(b, 'Add at least one line.');
            if (lines.some((l) => !l.unitId || !l.amount)) return err(b, 'Every line needs a unit and an amount.');
            return { v, lines };
          }
        }]
      });
      if (!r) return;
      const recs = r.lines.map((l) => { const t = M.tenantForMonth(l.unitId, r.v.forMonth); return { _c: 'payments', id: U.uid(), date: r.v.date, forMonth: r.v.forMonth, method: r.v.method, amount: l.amount, checkNo: l.checkNo, unitId: l.unitId, tenantId: t ? t.id : '', notes: '' }; });
      if (r.v.ledgerLine) {
        const desc = 'Rent deposit: ' + r.lines.map((l) => `${M.unitLabel(l.unitId).replace('Unit ', 'Apt ')}${l.checkNo ? ' (chk ' + l.checkNo + ')' : ''}`).join(', ');
        recs.push({ _c: 'txns', id: U.uid(), type: 'transfer', direction: 'in', category: 'tr-rentdep', date: r.v.date, amount: U.round2(U.sum(r.lines, (l) => l.amount)), description: desc, entity: 'bldg', notes: '', review: false });
      }
      await App().save(recs, { bulkLabel: 'Bank deposit ' + U.money(U.sum(r.lines, (l) => l.amount)) });
      U.toast(`Recorded ${r.lines.length} rent payment${r.lines.length > 1 ? 's' : ''}.`, 'ok');
    },

    /* ---------------- income / expense / transfer ---------------- */
    async txn(x) {
      const isNew = !x || !x.id || !M.get(x.id);
      x = { _c: 'txns', type: 'expense', date: U.todayISO(), amount: null, entity: 'bldg', category: '', review: false, ...(x || {}) };
      const vendorName = (M.vendor(x.vendorId) || {}).name || '';
      const catsFor = (type) => type === 'income' ? M.incomeCats().map((c) => ({ value: c.id, label: c.name })) : type === 'transfer' ? M.TRANSFER_CATS.map((c) => ({ value: c.id, label: c.name })) : null;
      const expOpts = () => M.groups().map((g) => `<optgroup label="${U.esc(g)}">${M.expenseCats().filter((c) => c.group === g).map((c) => `<option value="${c.id}"${c.id === x.category ? ' selected' : ''}>${U.esc(c.name)}</option>`).join('')}</optgroup>`).join('');
      const catSelect = (type) => type === 'expense' ? `<select name="category"><option value="">Choose…</option>${expOpts()}</select>` : sel('category', catsFor(type), x.category, 'Choose…');
      const file = x.fileId ? M.get(x.fileId) : null;
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="seg" id="tType">${['expense', 'income', 'transfer'].map((t) => `<button type="button" data-t="${t}" class="${x.type === t ? 'on' : ''}">${{ expense: 'Expense', income: 'Other income', transfer: 'Transfer' }[t]}</button>`).join('')}</div>
        <p class="small muted" id="tHelp"></p>
        <div class="row3">${fld('Date', date('date', x.date))}${fld('Amount', money('amount', x.amount))}<span id="catWrap">${fld('Category', catSelect(x.type))}</span></div>
        ${fld('Description', inp('description', x.description, 'placeholder="What was it for?"'))}
        <div class="row2 only-exp">${fld('Vendor / payee', `<input name="vendorName" list="vendorList" value="${U.esc(vendorName)}" placeholder="Type a name or pick one"/><datalist id="vendorList">${D.vendors.map((v) => `<option value="${U.esc(v.name)}">`).join('')}</datalist>`)}${fld('Paid for', sel('entity', D.settings.entities.map((e) => ({ value: e.id, label: e.name + (e.building ? '' : ' — not a building expense') })), x.entity))}</div>
        <div class="row3">${fld('Unit (optional)', sel('unitId', unitOpts(), x.unitId, 'Whole building'))}${fld('Account', sel('accountId', D.accounts.map((a) => ({ value: a.id, label: a.name })), x.accountId, 'Main account'))}${fld('Paid with', sel('method', D.settings.methods, x.method, '—'))}</div>
        <div class="row2 only-tr hidden">${fld('Direction', sel('direction', [{ value: 'in', label: 'Money in' }, { value: 'out', label: 'Money out' }], x.direction || 'in'))}</div>
        <div class="row2">${fld('Check / invoice / reference', inp('ref', x.ref))}${fld('Notes', inp('notes', x.notes))}</div>
        <div class="receipt" id="rcpt">${file ? `<img src="${file.data}" alt="Receipt"/><button type="button" class="btn btn-sm btn-ghost" id="rcRm">Remove receipt</button>` : ''}<button type="button" class="btn btn-sm" id="rcAdd">${file ? 'Replace receipt' : 'Attach receipt photo'}</button></div>
        <div class="callout callout-warn">${chk('review', x.review, 'Needs review — something here isn’t certain')}${fld('What needs checking', inp('reviewNote', x.reviewNote, 'placeholder="e.g. Which apartment was this for?"'))}</div>
        <p class="form-err lock-error"></p></form>`);
      let type = x.type; let newFile = undefined;
      const sync = () => {
        U.$$('#tType button', body).forEach((b) => b.classList.toggle('on', b.dataset.t === type));
        U.$$('.only-exp', body).forEach((e) => e.classList.toggle('hidden', type !== 'expense'));
        U.$$('.only-tr', body).forEach((e) => e.classList.toggle('hidden', type !== 'transfer'));
        U.$('#tHelp', body).textContent = { expense: 'Money the building paid out. Set “Paid for” when the building account paid someone else’s bill.', income: 'Money received other than rent (rent goes under Rent).', transfer: 'Money that moved but isn’t income or an expense: rent deposits already recorded under Rent, returned checks, loan principal, owner contributions.' }[type];
      };
      U.$('#tType', body).addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; U.$('#catWrap', body).innerHTML = fld('Category', catSelect(type)); sync(); });
      body.addEventListener('change', (e) => {
        if (e.target.name === 'vendorName') { const v = D.vendors.find((vv) => vv.name.toLowerCase() === e.target.value.trim().toLowerCase()); const c = U.$('[name=category]', body); if (v && v.category && !c.value) c.value = v.category; }
        if (e.target.name === 'description' && type === 'expense') { const c = U.$('[name=category]', body); if (!c.value) { const g = M.categorize(e.target.value); if (g.category !== 'oth-unclass') c.value = g.category; } }
      });
      body.addEventListener('click', async (e) => {
        if (e.target.id === 'rcAdd') {
          const f = await U.pickFile('image/*', null); if (!f) return;
          try { const data = await U.processImage(f, 1400, 0.72); newFile = data; U.$('#rcpt', body).innerHTML = `<img src="${data}" alt="Receipt"/><span class="small muted">Will be saved with this entry.</span>`; } catch (x2) { U.toast(x2.message, 'err'); }
        }
        if (e.target.id === 'rcRm') { newFile = null; U.$('#rcpt', body).innerHTML = '<span class="small muted">Receipt will be removed.</span>'; }
      });
      sync();
      const label = { expense: 'expense', income: 'income', transfer: 'transfer' };
      const r = await U.modal({
        title: isNew ? 'Add ' + label[x.type] : 'Edit ' + label[x.type], body, size: 'lg',
        buttons: [...delBtn(x, 'this entry'), { label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: isNew ? 'Add entry' : 'Save changes', cls: 'btn-primary', value: (b) => {
            const v = U.formValues(b);
            if (!v.date) return err(b, 'Enter the date.');
            if (!v.amount || v.amount <= 0) return err(b, 'Enter an amount greater than zero.');
            if (!v.category) return err(b, 'Choose a category.');
            return v;
          }
        }]
      });
      if (!r || r === 'deleted') return r;
      const recs = [];
      const rec = { ...x, ...r, type };
      if (type !== 'expense') { rec.vendorId = rec.vendorId || ''; rec.entity = 'bldg'; }
      if (type === 'expense') {
        const vn = (r.vendorName || '').trim();
        if (vn) {
          let v = D.vendors.find((vv) => vv.name.toLowerCase() === vn.toLowerCase());
          if (!v) { v = { _c: 'vendors', id: U.uid(), name: vn, category: rec.category, phone: '', email: '', account: '', notes: '' }; recs.push(v); }
          rec.vendorId = v.id;
        } else rec.vendorId = '';
      }
      delete rec.vendorName;
      if (!rec.review) rec.reviewNote = rec.reviewNote || '';
      if (newFile) { const fr = { _c: 'files', id: rec.fileId && M.get(rec.fileId) ? rec.fileId : U.uid(), data: newFile, name: 'receipt.jpg', owner: rec.id || '' }; rec.fileId = fr.id; recs.push(fr); }
      if (newFile === null && rec.fileId) { const old = rec.fileId; rec.fileId = ''; setTimeout(() => App().remove(old, 'receipt'), 10); }
      if (!rec.id) rec.id = U.uid();
      recs.forEach((q) => { if (q._c === 'files') q.owner = rec.id; });
      recs.push(rec);
      await App().save(recs, { label: App().describe(rec) });
      U.toast(isNew ? 'Entry added.' : 'Entry updated.', 'ok');
      return rec;
    },

    /* ---------------- tenant ---------------- */
    async tenant(t, defaults = {}) {
      const isNew = !t;
      t = t ? { ...t } : { _c: 'tenants', rent: null, dueDay: 1, moveIn: U.todayISO(), ...defaults };
      if (isNew && t.unitId && t.rent === null) { const prev = M.tenantsOf(t.unitId)[0]; if (prev) t.rent = prev.rent; }
      const dep = !isNew ? D.deposits.find((d) => d.tenantId === t.id) : null;
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Name(s) on the lease', inp('name', t.name, 'placeholder="e.g. Oscar Gonzalez and Damaris Rosales"'))}${fld('Unit', sel('unitId', unitOpts(), t.unitId, 'Choose…'))}</div>
        <div class="row3">${fld('Phone', inp('phone', t.phone, 'inputmode="tel"'))}${fld('Second phone', inp('phone2', t.phone2, 'inputmode="tel"'))}${fld('Email', inp('email', t.email, 'type="email"'))}</div>
        ${fld('Emergency or other contact', inp('otherContact', t.otherContact, 'placeholder="Name and phone"'))}
        <div class="row3">${fld('Monthly rent', money('rent', t.rent))}${fld('Rent due on day', inp('dueDay', t.dueDay, 'type="number" min="1" max="28"'))}${fld('Lease ends', date('leaseEnd', t.leaseEnd))}</div>
        <div class="row3">${fld('Moved in', date('moveIn', t.moveIn))}${fld('Moved out', date('moveOut', t.moveOut))}<div class="field">${chk('exempt', t.exempt, 'No rent is due (e.g. on-site manager)')}</div></div>
        ${isNew ? `<div class="row2">${fld('Security deposit received', money('depAmount', null))}${fld('Deposit date', date('depDate', t.moveIn))}</div>` : dep ? `<p class="small muted">Security deposit on file: ${U.money(dep.amount)}${dep.date ? ' received ' + U.fmtDate(dep.date) : ''}. Edit it from the unit page.</p>` : ''}
        ${fld('Notes', area('notes', t.notes))}
        <p class="form-err lock-error"></p></form>`);
      const r = await U.modal({
        title: isNew ? 'Add tenant' : 'Edit tenant', body, size: 'lg',
        buttons: [...delBtn(t, 'tenant ' + (t.name || ''), async () => { const n = D.payments.filter((p) => p.tenantId === t.id).length; return !n || U.confirm('This tenant has payments', `${n} rent payments are linked to this tenant. They stay with the unit. To keep the history, set a move-out date instead. Delete anyway?`, 'Delete anyway', true); }), { label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: isNew ? 'Add tenant' : 'Save changes', cls: 'btn-primary', value: (b) => {
            const v = U.formValues(b);
            if (!v.name) return err(b, 'Enter the tenant’s name.');
            if (!v.unitId) return err(b, 'Choose the unit.');
            if (v.moveOut && v.moveIn && v.moveOut < v.moveIn) return err(b, 'The move-out date is before the move-in date.');
            v.dueDay = Math.min(28, Math.max(1, +v.dueDay || 1));
            v.phone = U.phone(v.phone); v.phone2 = U.phone(v.phone2);
            return v;
          }
        }]
      });
      if (!r || r === 'deleted') return;
      const { depAmount, depDate, ...rest } = r;
      const rec = { ...t, ...rest, id: t.id || U.uid() };
      const recs = [rec];
      if (isNew && depAmount) recs.push({ _c: 'deposits', id: U.uid(), unitId: rec.unitId, tenantId: rec.id, date: depDate || rec.moveIn, amount: depAmount, returnedDate: '', returnedAmount: null, deductions: '', notes: '' });
      if (isNew) {
        const prev = M.tenantsOf(rec.unitId).find((x) => x.id !== rec.id && !x.moveOut && (!x.moveIn || !rec.moveIn || x.moveIn < rec.moveIn));
        if (prev && rec.moveIn && await U.confirm('Move the previous tenant out?', `${U.esc(prev.name)} is still listed in ${M.unitLabel(rec.unitId)}. Set their move-out date to the day before ${U.fmtDate(rec.moveIn)}?`, 'Set move-out date')) recs.push({ ...prev, moveOut: U.addDays(rec.moveIn, -1) });
      }
      await App().save(recs, { label: (isNew ? 'Added tenant ' : 'Updated tenant ') + rec.name });
      U.toast(isNew ? `${rec.name} added to ${M.unitLabel(rec.unitId)}.` : 'Tenant updated.', 'ok');
    },

    /* ---------------- unit ---------------- */
    async unit(u) {
      const isNew = !u;
      u = u ? { ...u } : { _c: 'units', number: '', beds: 2, baths: 1 };
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row3">${fld('Unit number', inp('number', u.number, 'inputmode="numeric"'))}${fld('Floor', inp('floor', u.floor ?? (u.number ? String(u.number)[0] : ''), 'type="number"'))}${fld('Square feet', inp('sqft', u.sqft, 'type="number"'))}</div>
        <div class="row3">${fld('Bedrooms', inp('beds', u.beds, 'type="number" min="0"'))}${fld('Bathrooms', inp('baths', u.baths, 'type="number" min="0" step="0.5"'))}${fld('Parking / storage', inp('parking', u.parking))}</div>
        ${fld('Appliances & features', inp('features', u.features, 'placeholder="e.g. Washer (2023), A/C replaced 2021"'))}
        ${fld('Notes', area('notes', u.notes))}
        <p class="form-err lock-error"></p></form>`);
      const r = await U.modal({
        title: isNew ? 'Add unit' : 'Edit unit ' + u.number, body, size: 'md',
        buttons: [...delBtn(u, 'unit ' + u.number, async () => !D.tenants.some((t) => t.unitId === u.id) || (U.alert('Unit has tenants', 'Delete or move its tenants first.'), false)), { label: 'Cancel', value: null, cls: 'btn-ghost' }, {
          label: isNew ? 'Add unit' : 'Save changes', cls: 'btn-primary', value: (b) => {
            const v = U.formValues(b);
            if (!v.number) return err(b, 'Enter the unit number.');
            if (D.units.some((x) => String(x.number) === String(v.number) && x.id !== u.id)) return err(b, 'There is already a unit with that number.');
            v.size = `${v.beds || 0} bed, ${v.baths || 0} bath`;
            return v;
          }
        }]
      });
      if (r && r !== 'deleted') await App().save({ ...u, ...r });
    },

    /* ---------------- security deposit ---------------- */
    async deposit(d, defaults = {}) {
      const isNew = !d;
      d = d ? { ...d } : { _c: 'deposits', date: U.todayISO(), amount: null, ...defaults };
      const tenants = D.tenants.map((t) => ({ value: t.id, label: `${t.name} (${M.unitLabel(t.unitId)})` }));
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Unit', sel('unitId', unitOpts(), d.unitId, 'Choose…'))}${fld('Tenant', sel('tenantId', tenants, d.tenantId, '—'))}</div>
        <div class="row2">${fld('Amount held', money('amount', d.amount))}${fld('Received on', date('date', d.date))}</div>
        <h3 class="form-h">When the tenant moves out</h3>
        <div class="row3">${fld('Returned on', date('returnedDate', d.returnedDate))}${fld('Amount returned', money('returnedAmount', d.returnedAmount))}${fld('Kept for damages / rent', `<span class="readonly" id="kept"></span>`)}</div>
        ${fld('Deductions explained', area('deductions', d.deductions))}
        ${fld('Notes (bank, account where it is held…)', inp('notes', d.notes))}
        <p class="small muted">Florida law has rules and deadlines for holding and returning security deposits. Check them with your attorney when a tenant moves out.</p>
        <p class="form-err lock-error"></p></form>`);
      const kept = () => { const v = U.formValues(body); U.$('#kept', body).textContent = v.returnedDate ? U.money(Math.max(0, (v.amount || 0) - (v.returnedAmount || 0))) : '—'; };
      body.addEventListener('input', kept);
      const r = await U.modal({
        title: isNew ? 'Add security deposit' : 'Security deposit', body, size: 'md', onOpen: kept,
        buttons: [...delBtn(d, 'this deposit'), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Save', cls: 'btn-primary', value: (b) => { const v = U.formValues(b); if (!v.unitId) return err(b, 'Choose the unit.'); if (!v.amount) return err(b, 'Enter the amount.'); return v; } }]
      });
      if (r && r !== 'deleted') await App().save({ ...d, ...r });
    },

    /* ---------------- asset ---------------- */
    async asset(a) {
      const isNew = !a;
      a = a ? { ...a } : { _c: 'assets', type: 'Appliance', acquired: U.todayISO(), inService: U.todayISO(), cost: null, life: M.DEFAULT_LIFE.Appliance };
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Name', inp('name', a.name, 'placeholder="e.g. Elevator modernization"'))}${fld('Type', sel('type', M.ASSET_TYPES, a.type))}</div>
        <div class="row3">${fld('Cost / purchase price', money('cost', a.cost))}${fld('Bought on', date('acquired', a.acquired))}${fld('Placed in service', date('inService', a.inService))}</div>
        <div class="row3 dep-only">${fld('Useful life (years)', inp('life', a.life, 'type="number" step="0.5" min="0"'))}${fld('Salvage value', money('salvage', a.salvage))}${fld('Current market value (optional)', money('marketValue', a.marketValue))}</div>
        <div class="row3">${fld('Location / unit', inp('location', a.location))}${fld('Serial or model', inp('serial', a.serial))}${fld('Warranty until', date('warranty', a.warranty))}</div>
        <div class="row2">${fld('Vendor', inp('vendorName', (M.vendor(a.vendorId) || {}).name || a.vendorName, 'list="vendorList2"'))}${fld('Sold / disposed on', date('disposedDate', a.disposedDate))}</div>
        <datalist id="vendorList2">${D.vendors.map((v) => `<option value="${U.esc(v.name)}">`).join('')}</datalist>
        ${fld('Notes', area('notes', a.notes))}
        <p class="small muted" id="depInfo"></p>
        <p class="form-err lock-error"></p></form>`);
      const info = () => {
        const v = { ...a, ...U.formValues(body) };
        const el = U.$('#depInfo', body);
        if (!M.depreciable(v)) { el.textContent = ['Land', 'Cash reserve', 'Investment', 'Receivable', 'Other asset'].includes(v.type) ? 'Not depreciated. It counts at its cost (or market value) on the balance sheet.' : 'Enter cost, service date and useful life to see depreciation.'; return; }
        const y = new Date().getFullYear();
        el.textContent = `Straight-line depreciation: about ${U.money((v.cost - (v.salvage || 0)) / v.life)} a year · ${y}: ${U.money(M.yearDep(v, y))} · book value today ${U.money(M.assetValue(v))}. Residential rental buildings and improvements are usually 27.5 years; confirm with your accountant.`;
      };
      body.addEventListener('input', info);
      body.addEventListener('change', (e) => { if (e.target.name === 'type' && M.DEFAULT_LIFE[e.target.value]) U.$('[name=life]', body).value = M.DEFAULT_LIFE[e.target.value]; info(); });
      const r = await U.modal({
        title: isNew ? 'Add asset' : 'Edit asset', body, size: 'lg', onOpen: info,
        buttons: [...delBtn(a, 'asset ' + (a.name || '')), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: isNew ? 'Add asset' : 'Save changes', cls: 'btn-primary', value: (b) => { const v = U.formValues(b); if (!v.name) return err(b, 'Give the asset a name.'); return v; } }]
      });
      if (!r || r === 'deleted') return;
      const recs = []; const rec = { ...a, ...r };
      if (r.vendorName) { let v = D.vendors.find((x) => x.name.toLowerCase() === r.vendorName.toLowerCase()); if (!v) { v = { _c: 'vendors', id: U.uid(), name: r.vendorName, category: '', phone: '', email: '', account: '', notes: '' }; recs.push(v); } rec.vendorId = v.id; }
      delete rec.vendorName; recs.push(rec);
      await App().save(recs, { label: (isNew ? 'Added asset ' : 'Updated asset ') + rec.name });
    },

    /* ---------------- liability ---------------- */
    async liability(L) {
      const isNew = !L;
      L = L ? { ...L } : { _c: 'liabilities', type: 'Mortgage', start: U.todayISO(), amortize: true, history: [] };
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Name', inp('name', L.name, 'placeholder="e.g. First mortgage"'))}${fld('Type', sel('type', M.LIAB_TYPES, L.type))}</div>
        <div class="row2">${fld('Lender / owed to', inp('lender', L.lender))}${fld('Account number (last 4)', inp('account', L.account))}</div>
        <div class="field">${chk('amortize', L.amortize, 'Fixed-rate loan with equal monthly payments (the app works out the balance)')}</div>
        <div class="row3 am">${fld('Original amount', money('original', L.original))}${fld('Interest rate % (yearly)', inp('rate', L.rate, 'type="number" step="0.001"'))}${fld('Term (months)', inp('termMonths', L.termMonths, 'type="number"'))}</div>
        <div class="row3 am">${fld('Loan date', date('start', L.start))}${fld('First payment', date('firstPayment', L.firstPayment))}${fld('Monthly payment', money('payment', L.payment, 'placeholder="worked out for you"'))}</div>
        <div class="row2 man">${fld('Current balance', money('balance', L.balance))}${fld('As of', date('balanceDate', L.balanceDate || U.todayISO()))}</div>
        <div class="row2">${fld('Payment due on day', inp('dueDay', L.dueDay, 'type="number" min="1" max="28"'))}${fld('Paid off on', date('paidOffDate', L.paidOffDate))}</div>
        ${fld('Notes (escrow, collateral, prepayment terms…)', area('notes', L.notes))}
        <p class="small muted" id="lInfo"></p>
        <p class="form-err lock-error"></p></form>`);
      const info = () => {
        const v = { ...L, ...U.formValues(body) };
        U.$$('.am', body).forEach((e) => e.classList.toggle('hidden', !v.amortize));
        U.$$('.man', body).forEach((e) => e.classList.toggle('hidden', !!v.amortize));
        U.$('#lInfo', body).textContent = v.amortize && v.original && v.termMonths ? `Monthly principal and interest: ${U.money(v.payment || M.loanPayment(v))} · balance today: ${U.money(M.liabilityBalance(v))} · interest this year: ${U.money(M.yearInterest(v, new Date().getFullYear()))}` : '';
      };
      body.addEventListener('input', info); body.addEventListener('change', info);
      const r = await U.modal({
        title: isNew ? 'Add liability' : 'Edit liability', body, size: 'lg', onOpen: info,
        buttons: [...delBtn(L, 'liability ' + (L.name || '')), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: isNew ? 'Add liability' : 'Save changes', cls: 'btn-primary', value: (b) => { const v = U.formValues(b); if (!v.name) return err(b, 'Give it a name.'); if (v.amortize && (!v.original || !v.termMonths)) return err(b, 'Enter the original amount and term, or untick the fixed-rate option and enter the balance.'); return v; } }]
      });
      if (!r || r === 'deleted') return;
      const rec = { ...L, ...r };
      if (!rec.amortize && rec.balance !== null && rec.balance !== undefined) {
        rec.history = (rec.history || []).filter((h) => h.date !== rec.balanceDate);
        rec.history.push({ date: rec.balanceDate || U.todayISO(), balance: rec.balance });
      }
      await App().save(rec, { label: (isNew ? 'Added liability ' : 'Updated liability ') + rec.name });
    },

    /* ---------------- vendor ---------------- */
    async vendor(v) {
      const isNew = !v;
      v = v ? { ...v } : { _c: 'vendors' };
      const catOpts = M.expenseCats().map((c) => ({ value: c.id, label: c.group + ' · ' + c.name }));
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Name', inp('name', v.name))}${fld('Usual category', sel('category', catOpts, v.category, '—'))}</div>
        <div class="row3">${fld('Contact person', inp('contact', v.contact))}${fld('Phone', inp('phone', v.phone, 'inputmode="tel"'))}${fld('Email', inp('email', v.email, 'type="email"'))}</div>
        <div class="row3">${fld('Our account number', inp('account', v.account))}${fld('Website', inp('website', v.website))}${fld('License / insurance until', date('coiExpires', v.coiExpires))}</div>
        <div class="field">${chk('w9', v.w9, 'W-9 on file (needed for 1099s)')}</div>
        ${fld('Notes', area('notes', v.notes))}
        <p class="form-err lock-error"></p></form>`);
      const r = await U.modal({
        title: isNew ? 'Add vendor' : 'Edit vendor', body, size: 'lg',
        buttons: [...delBtn(v, 'vendor ' + (v.name || '')), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: isNew ? 'Add vendor' : 'Save changes', cls: 'btn-primary', value: (b) => { const x = U.formValues(b); if (!x.name) return err(b, 'Enter a name.'); x.phone = U.phone(x.phone); return x; } }]
      });
      if (r && r !== 'deleted') await App().save({ ...v, ...r });
    },

    /* ---------------- recurring bill ---------------- */
    async bill(b) {
      const isNew = !b;
      b = b ? { ...b } : { _c: 'bills', frequency: 'monthly', dueDay: 1, entity: 'bldg' };
      const catOpts = M.expenseCats().map((c) => ({ value: c.id, label: c.group + ' · ' + c.name }));
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Bill', inp('name', b.name, 'placeholder="e.g. FPL common areas"'))}${fld('Vendor', sel('vendorId', D.vendors.map((v) => ({ value: v.id, label: v.name })), b.vendorId, '—'))}</div>
        <div class="row3">${fld('Usual amount', money('amount', b.amount))}${fld('How often', sel('frequency', [{ value: 'monthly', label: 'Monthly' }, { value: 'bimonthly', label: 'Every 2 months' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'semiannual', label: 'Twice a year' }, { value: 'annual', label: 'Yearly' }], b.frequency))}${fld('Due on day', inp('dueDay', b.dueDay, 'type="number" min="1" max="28"'))}</div>
        <div class="row3">${fld('Category', sel('category', catOpts, b.category, '—'))}${fld('Paid for', sel('entity', D.settings.entities.map((e) => ({ value: e.id, label: e.name })), b.entity))}${fld('Starts', date('startDate', b.startDate))}</div>
        ${fld('Match bank lines containing (optional)', inp('match', b.match, 'placeholder="e.g. 09195-27440"'))}
        <div class="field">${chk('autopay', b.autopay, 'Paid automatically (auto-debit)')}${chk('paused', b.paused, 'Paused')}</div>
        ${fld('Notes', inp('notes', b.notes))}
        <p class="form-err lock-error"></p></form>`);
      const r = await U.modal({
        title: isNew ? 'Add recurring bill' : 'Edit recurring bill', body, size: 'lg',
        buttons: [...delBtn(b, 'bill ' + (b.name || '')), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Save', cls: 'btn-primary', value: (x) => { const v = U.formValues(x); if (!v.name) return err(x, 'Name the bill.'); return v; } }]
      });
      if (r && r !== 'deleted') await App().save({ ...b, ...r });
    },
    /** Record a payment of a recurring bill as an expense. */
    payBill(b) {
      return F.txn({ type: 'expense', date: U.todayISO(), amount: b.amount, category: b.category, vendorId: b.vendorId, entity: b.entity || 'bldg', description: b.name, method: b.autopay ? 'Auto-debit' : '' });
    },

    /* ---------------- bank account ---------------- */
    async account(a) {
      const isNew = !a;
      a = a ? { ...a } : { _c: 'accounts', kind: 'Checking', openingDate: U.todayISO(), primary: !D.accounts.length };
      const body = U.h(`<form class="form" autocomplete="off">
        <div class="row2">${fld('Name', inp('name', a.name, 'placeholder="e.g. Operating account"'))}${fld('Type', sel('kind', ['Checking', 'Savings', 'Reserve', 'Security deposit escrow', 'Money market', 'Petty cash'], a.kind))}</div>
        <div class="row2">${fld('Bank', inp('institution', a.institution))}${fld('Last 4 digits', inp('last4', a.last4, 'maxlength="4" inputmode="numeric"'))}</div>
        <div class="row2">${fld('Starting balance', money('openingBalance', a.openingBalance))}${fld('On (from the bank statement)', date('openingDate', a.openingDate))}</div>
        <p class="small muted">The app adds every payment and entry for this account after the starting date to work out the balance. Use the closing balance of a bank statement.</p>
        <div class="field">${chk('primary', a.primary, 'Main account (used when an entry has no account chosen)')}${chk('closed', a.closed, 'Closed')}</div>
        ${fld('Notes', inp('notes', a.notes))}
        <p class="form-err lock-error"></p></form>`);
      const r = await U.modal({
        title: isNew ? 'Add bank account' : 'Edit bank account', body, size: 'md',
        buttons: [...delBtn(a, 'account ' + (a.name || '')), { label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Save', cls: 'btn-primary', value: (x) => { const v = U.formValues(x); if (!v.name) return err(x, 'Name the account.'); return v; } }]
      });
      if (!r || r === 'deleted') return;
      const recs = [{ ...a, ...r }];
      if (r.primary) D.accounts.filter((x) => x.id !== a.id && x.primary).forEach((x) => recs.push({ ...x, primary: false }));
      await App().save(recs, { label: 'Account ' + r.name });
    }
  };
  global.Forms = F;
})(window);
