/* =========================================================
   Pages: recurring bills, assets, liabilities, vendors
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M } = global;
  const D = M.D;
  const A = () => global.App;
  const F = () => global.Forms;
  const P = () => global.Pages;

  /* Form 1099-NEC / MISC reporting threshold by payment year */
  const threshold1099 = (y) => (y <= 2025 ? 600 : 2000);

  /* =========================================================
     RECURRING BILLS
     ========================================================= */
  function bills(view) {
    const today = U.todayISO();
    const rows = D.bills.map((b) => ({ b, ...M.billNextDue(b) })).sort((a, b) => (a.b.paused - b.b.paused) || a.due.localeCompare(b.due));
    const monthly = U.sum(D.bills.filter((b) => !b.paused), (b) => (+b.amount || 0) / (M.FREQS[b.frequency] || 1));
    view.innerHTML = `
      <div class="page-head"><div><h1>Recurring bills</h1><p class="lede">${D.bills.length ? `${D.bills.length} bills · about ${U.money0(monthly)} a month · ${U.money0(monthly * 12)} a year` : 'Keep track of the bills that come every month or quarter.'}</p></div>
        <div class="btn-row"><button class="btn" id="bFind" type="button">Find them in the ledger</button><button class="btn btn-primary" id="bAdd" type="button">Add bill</button></div></div>
      ${rows.length ? `<div class="card card-flush"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Bill</th><th>Vendor</th><th>How often</th><th>Last paid</th><th>Next due</th><th class="num">Usual amount</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.b.paused ? 'muted' : ''}"><td><button class="linklike" data-edit="${r.b.id}" type="button">${U.esc(r.b.name)}</button>${r.b.autopay ? ' <span class="chip st-exempt">auto-debit</span>' : ''}</td><td>${U.esc((M.vendor(r.b.vendorId) || {}).name || '')}</td><td>${U.esc({ monthly: 'Monthly', bimonthly: 'Every 2 months', quarterly: 'Quarterly', semiannual: 'Twice a year', annual: 'Yearly' }[r.b.frequency] || '')}</td><td>${r.last ? U.fmtDate(r.last) : '<span class="muted">—</span>'}</td><td>${r.b.paused ? 'Paused' : r.stale ? `<span class="muted">No payment since ${U.fmtDate(r.last)}</span>` : `<span class="${r.due < today ? 'c-late' : ''}">${U.fmtDate(r.due)}</span>`}</td><td class="num">${U.money(r.b.amount)}</td><td class="num"><button class="btn btn-sm" data-pay="${r.b.id}" type="button">Record payment</button></td></tr>`).join('')}
      </tbody></table></div></div>
      <p class="small muted">“Last paid” is the newest expense from that vendor. A bill shows as due one period after it was last paid.</p>` : P().empty('No recurring bills yet', 'Add them by hand, or let the app look through the ledger for vendors paid most months.', '')}`;
    U.$('#bAdd').onclick = () => F().bill();
    U.$('#bFind').onclick = () => findRecurring();
    view.onclick = (e) => { const ed = e.target.closest('[data-edit]'); if (ed) F().bill(M.get(ed.dataset.edit)); const p = e.target.closest('[data-pay]'); if (p) F().payBill(M.get(p.dataset.pay)); };
  }
  /** Vendors paid in 3+ different months look like recurring bills. */
  function detectRecurring() {
    const out = [];
    D.vendors.forEach((v) => {
      if (D.bills.some((b) => b.vendorId === v.id)) return;
      const xs = D.txns.filter((x) => x.type === 'expense' && x.vendorId === v.id);
      const months = new Set(xs.map((x) => U.monthKey(x.date)));
      if (months.size < 3) return;
      const amts = xs.map((x) => x.amount).sort((a, b) => a - b); const med = amts[Math.floor(amts.length / 2)];
      const days = xs.map((x) => +x.date.slice(8)).sort((a, b) => a - b); const day = days[Math.floor(days.length / 2)];
      const ent = xs[xs.length - 1].entity || 'bldg';
      out.push({ _c: 'bills', id: U.uid(), name: v.name, vendorId: v.id, amount: med, frequency: 'monthly', dueDay: Math.min(28, day), category: v.category || xs[0].category, entity: ent, autopay: xs.some((x) => /debit|ach/i.test(x.description)), notes: `Found from ${xs.length} payments in ${months.size} months.` });
    });
    return out;
  }
  async function findRecurring() {
    const found = detectRecurring();
    if (!found.length) return U.alert('Nothing new found', 'No other vendor was paid in three or more different months.');
    const body = U.h(`<div><p class="dialog-text">These vendors were paid in at least three different months. Tick the ones to keep as recurring bills (you can edit them afterwards).</p><ul class="checklist">${found.map((b, i) => `<li><label class="check"><input type="checkbox" data-i="${i}" ${M.isBuilding(b) ? 'checked' : ''}/><span><b>${U.esc(b.name)}</b> · about ${U.money(b.amount)} around the ${P().ordinal(b.dueDay)}${M.isBuilding(b) ? '' : ` · <em>paid for ${U.esc(M.entity(b.entity).short)}</em>`}</span></label></li>`).join('')}</ul></div>`);
    const r = await U.modal({ title: 'Recurring bills found', body, size: 'md', buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Add selected', cls: 'btn-primary', value: (b) => U.$$('[data-i]', b).filter((c) => c.checked).map((c) => found[+c.dataset.i]) }] });
    if (r && r.length) { await A().save(r, { bulkLabel: 'Added recurring bills' }); U.toast(`Added ${r.length} recurring bills.`, 'ok'); }
  }

  /* =========================================================
     ASSETS
     ========================================================= */
  function assets(view) {
    const y = new Date().getFullYear();
    const bs = M.balanceSheet();
    const fixed = D.assets.filter((a) => !['Cash reserve', 'Investment', 'Receivable', 'Other asset'].includes(a.type));
    const other = D.assets.filter((a) => ['Cash reserve', 'Investment', 'Receivable', 'Other asset'].includes(a.type));
    const missing = D.assets.filter((a) => !+a.cost && !+a.marketValue);
    const cashTotal = U.sum(bs.cash, (c) => c.value);
    const row = (a) => `<tr class="clickable" data-asset="${a.id}"><td><b>${U.esc(a.name)}</b><small>${U.esc([a.type, a.location, a.serial].filter(Boolean).join(' · '))}</small></td><td>${a.inService ? U.fmtDate(a.inService) : '—'}</td><td class="num">${+a.cost ? U.money0(a.cost) : '<span class="chip st-due">needs cost</span>'}</td><td class="num">${M.depreciable(a) ? U.money0(M.accumDep(a, U.todayISO())) : '—'}</td><td class="num">${M.depreciable(a) ? U.money0(M.yearDep(a, y)) : '—'}</td><td class="num"><b>${U.money0(M.assetValue(a))}</b></td></tr>`;
    view.innerHTML = `
      <div class="page-head"><div><h1>Assets</h1><p class="lede">What the building owns: ${U.money0(bs.totalAssets)} in total today.</p></div>
        <div class="btn-row"><button class="btn" id="aAcc" type="button">Add bank account</button><button class="btn btn-primary" id="aAdd" type="button">Add asset</button></div></div>
      ${missing.length ? `<div class="callout callout-warn">${missing.length} asset${missing.length > 1 ? 's have' : ' has'} no cost yet, so ${missing.length > 1 ? 'they count' : 'it counts'} as $0. Your closing statement, county records or accountant will have the figures.</div>` : ''}
      <section class="card"><div class="card-head"><h2>Cash &amp; bank accounts</h2><b>${U.money(cashTotal)}</b></div>
        ${D.accounts.length ? `<table class="tbl tbl-tight"><thead><tr><th>Account</th><th>Starting balance</th><th class="num">Balance today</th></tr></thead><tbody>${D.accounts.map((a) => `<tr class="clickable${a.closed ? ' muted' : ''}" data-acc="${a.id}"><td><b>${U.esc(a.name)}</b>${a.primary ? ' <span class="chip st-paid">main</span>' : ''}<small>${U.esc([a.kind, a.institution, a.last4 ? '…' + a.last4 : ''].filter(Boolean).join(' · '))}</small></td><td>${a.openingBalance !== null && a.openingBalance !== undefined ? `${U.money(a.openingBalance)} on ${U.fmtDate(a.openingDate) || '—'}` : '<span class="chip st-due">enter from a bank statement</span>'}</td><td class="num"><b>${U.money(M.accountBalance(a))}</b></td></tr>`).join('')}</tbody></table>
        <p class="small muted">Balance = starting balance + rent and income − expenses recorded for the account after the starting date. Compare it with the bank each month.</p>` : '<p class="muted">Add the building’s bank accounts to include cash on the balance sheet.</p>'}</section>
      <section class="card"><div class="card-head"><h2>Property &amp; equipment</h2><b>${U.money(U.sum(fixed, (a) => M.assetValue(a)))}</b></div>
        ${fixed.length ? `<div class="tbl-scroll"><table class="tbl tbl-tight"><thead><tr><th>Asset</th><th>In service</th><th class="num">Cost</th><th class="num">Depreciated so far</th><th class="num">${y} depreciation</th><th class="num">Book value</th></tr></thead><tbody>${fixed.map(row).join('')}</tbody></table></div>` : '<p class="muted">Add the building, land, elevator, roof, A/C systems and appliances.</p>'}
        <p class="small muted">Straight-line estimates for planning. Land is never depreciated. Your accountant’s depreciation schedule is the official one.</p></section>
      ${other.length ? `<section class="card"><div class="card-head"><h2>Other assets</h2></div><table class="tbl tbl-tight"><tbody>${other.map(row).join('')}</tbody></table></section>` : ''}`;
    U.$('#aAdd').onclick = () => F().asset();
    U.$('#aAcc').onclick = () => F().account();
    view.onclick = (e) => { const r = e.target.closest('[data-asset]'); if (r) F().asset(M.get(r.dataset.asset)); const c = e.target.closest('[data-acc]'); if (c) F().account(M.get(c.dataset.acc)); };
  }

  /* =========================================================
     LIABILITIES
     ========================================================= */
  function liabilities(view) {
    const y = new Date().getFullYear();
    const held = D.deposits.filter((d) => !d.returnedDate);
    const loans = D.liabilities;
    const totalLoans = U.sum(loans, (L) => M.liabilityBalance(L));
    const depTotal = M.depositsHeld();
    view.innerHTML = `
      <div class="page-head"><div><h1>Liabilities</h1><p class="lede">What the building owes: ${U.money0(totalLoans + depTotal)} in total today.</p></div>
        <div class="btn-row"><button class="btn" id="lDep" type="button">Add security deposit</button><button class="btn btn-primary" id="lAdd" type="button">Add loan or other debt</button></div></div>
      <section class="card"><div class="card-head"><h2>Loans, mortgages &amp; other debts</h2><b>${U.money(totalLoans)}</b></div>
        ${loans.length ? `<table class="tbl tbl-tight"><thead><tr><th>Liability</th><th>Rate</th><th class="num">Monthly payment</th><th class="num">Interest ${y}</th><th class="num">Balance today</th><th></th></tr></thead><tbody>${loans.map((L) => `<tr class="clickable" data-liab="${L.id}"><td><b>${U.esc(L.name)}</b><small>${U.esc([L.type, L.lender, L.account ? '…' + L.account : ''].filter(Boolean).join(' · '))}</small></td><td>${L.rate ? (+L.rate).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%' : '—'}</td><td class="num">${L.amortize ? U.money(L.payment || M.loanPayment(L)) : '—'}</td><td class="num">${M.yearInterest(L, y) !== null ? U.money(M.yearInterest(L, y)) : '—'}</td><td class="num"><b>${U.money(M.liabilityBalance(L))}</b></td><td class="num">${L.amortize ? `<button class="btn btn-sm btn-ghost" data-sched="${L.id}" type="button">Schedule</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No mortgage or loans recorded. If the building has one, add it so the balance sheet and Schedule E interest are right.</p>'}</section>
      <section class="card"><div class="card-head"><h2>Security deposits held</h2><b>${U.money(depTotal)}</b></div>
        <p class="small muted">Tenants’ deposits belong to the tenants until they move out, so they count as money owed.</p>
        ${held.length ? `<table class="tbl tbl-tight"><thead><tr><th>Unit</th><th>Tenant</th><th>Received</th><th class="num">Amount</th></tr></thead><tbody>${held.sort((a, b) => String((M.unit(a.unitId) || {}).number).localeCompare(String((M.unit(b.unitId) || {}).number))).map((d) => `<tr class="clickable" data-dep="${d.id}"><td>${U.esc((M.unit(d.unitId) || {}).number || '')}</td><td>${U.esc((M.tenant(d.tenantId) || {}).name || '')}</td><td>${d.date ? U.fmtDate(d.date) : '<span class="muted">not recorded</span>'}</td><td class="num">${U.money(d.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No deposits on file.</p>'}
        ${D.deposits.some((d) => d.returnedDate) ? `<details><summary class="small">Returned deposits</summary><table class="tbl tbl-tight">${D.deposits.filter((d) => d.returnedDate).map((d) => `<tr class="clickable" data-dep="${d.id}"><td>${U.esc((M.unit(d.unitId) || {}).number || '')}</td><td>${U.esc((M.tenant(d.tenantId) || {}).name || '')}</td><td>Returned ${U.fmtDate(d.returnedDate)}</td><td class="num">${U.money(d.returnedAmount)} of ${U.money(d.amount)}</td></tr>`).join('')}</table></details>` : ''}</section>`;
    U.$('#lAdd').onclick = () => F().liability();
    U.$('#lDep').onclick = () => F().deposit();
    view.onclick = (e) => {
      const s = e.target.closest('[data-sched]'); if (s) { e.stopPropagation(); schedule(M.get(s.dataset.sched)); return; }
      const r = e.target.closest('[data-liab]'); if (r) F().liability(M.get(r.dataset.liab));
      const d = e.target.closest('[data-dep]'); if (d) F().deposit(M.get(d.dataset.dep));
    };
  }
  function schedule(L) {
    const rows = M.amortization(L); const nowK = U.monthKey(U.todayISO());
    U.modal({ title: 'Payment schedule · ' + L.name, size: 'lg', body: `<p class="small muted">${rows.length} payments of ${U.money(L.payment || M.loanPayment(L))}. Total interest over the loan: ${U.money(U.sum(rows, (r) => r.interest))}.</p><div class="tbl-scroll tbl-tall"><table class="tbl tbl-tight"><thead><tr><th>#</th><th>Month</th><th class="num">Payment</th><th class="num">Interest</th><th class="num">Principal</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.month === nowK ? 'now' : ''}"><td>${r.n}</td><td>${U.monthLabel(r.month)}</td><td class="num">${U.money(r.payment)}</td><td class="num">${U.money(r.interest)}</td><td class="num">${U.money(r.principal)}</td><td class="num">${U.money(r.balance)}</td></tr>`).join('')}</tbody></table></div>`, buttons: [{ label: 'Close', cls: 'btn-primary', value: true }] });
  }

  /* =========================================================
     VENDORS
     ========================================================= */
  const VF = { q: '', y: null };
  function vendors(view, p) {
    VF.y = +(p.y || VF.y || M.defaultYear());
    const ys = String(VF.y); const th = threshold1099(VF.y);
    const stats = D.vendors.map((v) => { const xs = D.txns.filter((x) => x.vendorId === v.id && x.type === 'expense'); const yr = xs.filter((x) => x.date.startsWith(ys)); return { v, n: xs.length, year: U.sum(yr, (x) => x.amount), last: xs.map((x) => x.date).sort().pop() }; })
      .filter((s) => !VF.q || U.norm([s.v.name, s.v.contact, s.v.phone, s.v.email, M.catName(s.v.category)].join(' ')).includes(U.norm(VF.q)))
      .sort((a, b) => b.year - a.year || a.v.name.localeCompare(b.v.name));
    view.innerHTML = `
      <div class="page-head"><div><h1>Vendors</h1><p class="lede">The companies and people the building pays.</p></div>
        <div class="btn-row">${P().yearSel(VF.y, 'vY')}<input type="search" id="vQ" placeholder="Find a vendor" value="${U.esc(VF.q)}"/><button class="btn btn-primary" id="vAdd" type="button">Add vendor</button></div></div>
      <div class="card card-flush"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Vendor</th><th>Category</th><th>Contact</th><th>Last paid</th><th class="num">Paid in ${VF.y}</th><th>Paperwork</th></tr></thead><tbody>
      ${stats.map((s) => { const needs1099 = s.year >= th && !/^(fpl|comcast|at&t|t-mobile|florida blue|usable life|waste management|miami-dade|florida dept|adt)/i.test(s.v.name); return `<tr class="clickable" data-v="${s.v.id}"><td><b>${U.esc(s.v.name)}</b>${s.v.account ? `<small>Account ${U.esc(s.v.account)}</small>` : ''}</td><td>${U.esc(M.catName(s.v.category))}</td><td>${U.esc([s.v.contact, s.v.phone].filter(Boolean).join(' · '))}${s.v.email ? `<small>${U.esc(s.v.email)}</small>` : ''}</td><td>${s.last ? U.fmtDate(s.last) : '—'}</td><td class="num">${U.money(s.year)}</td><td>${needs1099 ? (s.v.w9 ? '<span class="chip st-paid">W-9 on file</span>' : `<span class="chip st-due" title="Payments to an unincorporated contractor of ${U.money0(th)} or more in a year may need a Form 1099-NEC">1099? ask for W-9</span>`) : ''}${s.v.coiExpires && s.v.coiExpires < U.todayISO() ? ' <span class="chip st-late">insurance expired</span>' : ''}</td></tr>`; }).join('') || `<tr><td colspan="6">${P().empty('No vendors', 'Vendors are added as you record expenses, or add one now.')}</td></tr>`}
      </tbody></table></div></div>
      <p class="small muted">1099 hint: for payments made in ${VF.y}, the Form 1099-NEC threshold is ${U.money0(th)} per contractor${VF.y >= 2027 ? ' (adjusted for inflation from 2027; check the current figure)' : ''}. Utilities, insurers and corporations usually don’t get one. Your accountant decides.</p>`;
    U.$('#vAdd').onclick = () => F().vendor();
    U.$('#vY').onchange = (e) => A().go('vendors', { y: e.target.value });
    U.$('#vQ').oninput = U.debounce((e) => { VF.q = e.target.value; A().render(); }, 250);
    view.onclick = (e) => { const r = e.target.closest('[data-v]'); if (r) vendorDetail(M.get(r.dataset.v)); };
    if (p.id && M.get(p.id)) setTimeout(() => vendorDetail(M.get(p.id)), 50);
  }
  async function vendorDetail(v) {
    const xs = D.txns.filter((x) => x.vendorId === v.id).sort((a, b) => b.date.localeCompare(a.date));
    const r = await U.modal({
      title: v.name, size: 'lg',
      body: `<dl class="facts facts-2"><div><dt>Phone</dt><dd>${v.phone ? `<a href="tel:${U.esc(v.phone.replace(/\D/g, ''))}">${U.esc(v.phone)}</a>` : '—'}</dd></div><div><dt>Email</dt><dd>${v.email ? `<a href="mailto:${U.esc(v.email)}">${U.esc(v.email)}</a>` : '—'}</dd></div><div><dt>Account</dt><dd>${U.esc(v.account || '—')}</dd></div><div><dt>Total paid (all years)</dt><dd>${U.money(U.sum(xs, (x) => x.amount))}</dd></div></dl>
        ${v.notes ? `<p class="small">${U.esc(v.notes)}</p>` : ''}
        <div class="tbl-scroll tbl-tall"><table class="tbl tbl-tight"><thead><tr><th>Date</th><th>Description</th><th>Paid for</th><th class="num">Amount</th></tr></thead><tbody>${xs.map((x) => `<tr class="clickable" data-x="${x.id}"><td>${U.fmtDate(x.date)}</td><td>${U.esc(U.titleCase(x.description))}</td><td>${U.esc((M.entity(x.entity) || {}).short || '')}</td><td class="num">${U.money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No payments yet.</td></tr>'}</tbody></table></div>`,
      onOpen: (b) => b.addEventListener('click', (e) => { const t = e.target.closest('[data-x]'); if (t) U.closeModal('x:' + t.dataset.x); }),
      buttons: [{ label: 'Edit vendor', cls: 'btn', value: 'edit' }, { label: 'Add expense', cls: 'btn-primary', value: 'exp' }]
    });
    if (r === 'edit') F().vendor(v);
    if (r === 'exp') F().txn({ type: 'expense', vendorId: v.id, category: v.category });
    if (r && r.startsWith && r.startsWith('x:')) F().txn(M.get(r.slice(2)));
  }

  Object.assign((global.__pages = global.__pages || {}), { bills, assets, liabilities, vendors });
  global.Books = { detectRecurring, threshold1099 };
})(window);
