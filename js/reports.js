/* =========================================================
   Reports: on screen, printable (Save as PDF) and Excel
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M } = global;
  const D = M.D;
  const A = () => global.App;

  const REPORTS = [
    ['pl', 'Income statement'], ['bs', 'Balance sheet'], ['roll', 'Rent roll'], ['grid', 'Rent by month'], ['units', 'By unit'],
    ['others', 'Paid for others'], ['sche', 'Schedule E summary'], ['budget', 'Budget vs actual'], ['deposits', 'Security deposits']
  ];
  const n = (v) => (Math.abs(v || 0) < 0.005 ? '—' : U.money(v));
  const neg = (v) => (Math.abs(v || 0) < 0.005 ? '—' : `(${U.money(Math.abs(v))})`);

  /* ---------------- income statement, monthly columns ---------------- */
  function pl(year) {
    const months = M.monthly(year); const tot = M.periodTotals(`${year}-01-01`, `${year}-12-31`);
    const incCats = Object.keys(tot.inc); const expCats = Object.keys(tot.exp);
    const groups = {}; expCats.forEach((c) => { const g = (M.cat(c) || {}).group || 'Other'; (groups[g] = groups[g] || []).push(c); });
    const gOrder = [...new Set([...M.groups(), ...Object.keys(groups)])].filter((g) => groups[g]);
    const cells = (f) => months.map((m) => `<td class="num">${n(f(m))}</td>`).join('');
    let h = `<table class="tbl rpt rpt-wide"><thead><tr><th>${year}</th>${U.MONTHS.map((m) => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>`;
    h += `<tr class="sec"><th colspan="14">Income</th></tr><tr><td>Rent</td>${cells((m) => m.rent)}<td class="num"><b>${n(tot.rent)}</b></td></tr>`;
    incCats.forEach((c) => { h += `<tr><td>${U.esc(M.catName(c))}</td>${cells((m) => m.inc[c])}<td class="num">${n(tot.inc[c])}</td></tr>`; });
    h += `<tr class="sub"><th>Total income</th>${cells((m) => m.totalIncome)}<td class="num"><b>${n(tot.totalIncome)}</b></td></tr>`;
    h += `<tr class="sec"><th colspan="14">Building expenses</th></tr>`;
    gOrder.forEach((g) => {
      h += `<tr class="grp"><td colspan="14">${U.esc(g)}</td></tr>`;
      groups[g].sort((a, b) => (tot.exp[b] || 0) - (tot.exp[a] || 0)).forEach((c) => { h += `<tr><td class="ind">${U.esc(M.catName(c))}</td>${cells((m) => m.exp[c])}<td class="num">${n(tot.exp[c])}</td></tr>`; });
    });
    h += `<tr class="sub"><th>Total expenses</th>${cells((m) => m.totalExpense)}<td class="num"><b>${n(tot.totalExpense)}</b></td></tr>`;
    h += `<tr class="grand"><th>Net operating income</th>${months.map((m) => `<td class="num">${m.net < 0 ? neg(m.net) : n(m.net)}</td>`).join('')}<td class="num"><b>${tot.net < 0 ? neg(tot.net) : n(tot.net)}</b></td></tr></tbody></table>`;
    const others = U.sum(Object.values(tot.others));
    const note = `<p class="small muted">Cash basis: rent and expenses count in the month they were received or paid. ${others ? `${U.money(others)} paid from the building account for others is left out (see Paid for others).` : ''} Transfers (rent deposits, returned checks, loan principal) are not income or expenses.</p>`;
    return { title: `Income statement ${year}`, html: h + note, landscape: true };
  }

  /* ---------------- balance sheet ---------------- */
  function bs(asOf) {
    const b = M.balanceSheet(asOf);
    let h = `<table class="tbl rpt"><tbody><tr class="sec"><th colspan="2">Assets</th></tr><tr class="grp"><td colspan="2">Cash &amp; bank accounts</td></tr>`;
    h += b.cash.map((c) => `<tr><td class="ind">${U.esc(c.name)}</td><td class="num">${U.money(c.value)}</td></tr>`).join('') || '<tr><td class="ind muted">No accounts recorded</td><td class="num">—</td></tr>';
    h += `<tr class="grp"><td colspan="2">Property &amp; equipment (cost less depreciation)</td></tr>`;
    h += b.fixed.map((f) => `<tr><td class="ind">${U.esc(f.name)}<small>${f.dep ? `Cost ${U.money0(f.cost)} − depreciation ${U.money0(f.dep)}` : U.esc(f.type)}</small></td><td class="num">${U.money(f.value)}</td></tr>`).join('') || '<tr><td class="ind muted">No assets with a value recorded</td><td class="num">—</td></tr>';
    h += `<tr class="sub"><th>Total assets</th><td class="num"><b>${U.money(b.totalAssets)}</b></td></tr>`;
    h += `<tr class="sec"><th colspan="2">Liabilities</th></tr>`;
    h += b.loans.map((l) => `<tr><td class="ind">${U.esc(l.name)}<small>${U.esc(l.type)}</small></td><td class="num">${U.money(l.value)}</td></tr>`).join('');
    h += `<tr><td class="ind">Tenant security deposits held</td><td class="num">${U.money(b.deposits)}</td></tr>`;
    h += `<tr class="sub"><th>Total liabilities</th><td class="num"><b>${U.money(b.totalLiab)}</b></td></tr>`;
    h += `<tr class="grand"><th>Owners’ equity (assets − liabilities)</th><td class="num"><b>${b.equity < 0 ? neg(b.equity) : U.money(b.equity)}</b></td></tr></tbody></table>`;
    h += `<p class="small muted">Book values, not market values. Assets with no cost entered count as $0.</p>`;
    return { title: `Balance sheet as of ${U.fmtDate(b.asOf)}`, html: h };
  }

  /* ---------------- rent roll ---------------- */
  function roll(month) {
    const r = M.rentRoll(month);
    let h = `<table class="tbl rpt"><thead><tr><th>Unit</th><th>Tenant</th><th>Size</th><th>Moved in</th><th>Lease ends</th><th class="num">Deposit</th><th class="num">Rent</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>`;
    r.forEach((s) => { const dep = s.tenant ? U.sum(D.deposits.filter((d) => d.tenantId === s.tenant.id && !d.returnedDate), (d) => d.amount) : 0; h += `<tr><td>${U.esc(s.unit.number)}</td><td>${U.esc(s.tenant ? s.tenant.name : 'Vacant')}</td><td>${U.esc(s.unit.size || '')}</td><td>${s.tenant && s.tenant.moveIn ? U.fmtDate(s.tenant.moveIn) : ''}</td><td>${s.tenant && s.tenant.leaseEnd ? U.fmtDate(s.tenant.leaseEnd) : ''}</td><td class="num">${n(dep)}</td><td class="num">${n(s.expected)}</td><td class="num">${n(s.paid)}</td><td class="num">${n(s.balance)}</td><td>${U.esc(M.STATUS_LABEL[s.status])}</td></tr>`; });
    h += `</tbody><tfoot><tr><th colspan="5">Totals · ${r.filter((s) => s.tenant).length} of ${r.length} occupied</th><th class="num">${U.money(U.sum(r, (s) => s.tenant ? U.sum(D.deposits.filter((d) => d.tenantId === s.tenant.id && !d.returnedDate), (d) => d.amount) : 0))}</th><th class="num">${U.money(U.sum(r, (s) => s.expected))}</th><th class="num">${U.money(U.sum(r, (s) => s.paid))}</th><th class="num">${U.money(U.sum(r, (s) => s.balance))}</th><th></th></tr></tfoot></table>`;
    return { title: `Rent roll · ${U.monthLabel(month, true)}`, html: h, landscape: true };
  }

  /* ---------------- rent grid ---------------- */
  function grid(year) {
    const ms = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    let h = `<table class="tbl rpt rpt-wide"><thead><tr><th>Unit</th>${U.MONTHS.map((m) => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>`;
    const col = ms.map(() => 0);
    D.units.forEach((u) => { const v = ms.map((k) => U.sum(M.paymentsFor(u.id, k), (p) => p.amount)); v.forEach((x, i) => { col[i] += x; }); h += `<tr><td>${U.esc(u.number)}</td>${v.map((x) => `<td class="num">${x ? U.money0(x) : '—'}</td>`).join('')}<td class="num"><b>${U.money0(U.sum(v))}</b></td></tr>`; });
    h += `</tbody><tfoot><tr><th>Total</th>${col.map((x) => `<th class="num">${U.money0(x)}</th>`).join('')}<th class="num">${U.money0(U.sum(col))}</th></tr></tfoot></table>`;
    return { title: `Rent received by month · ${year}`, html: h, landscape: true };
  }

  /* ---------------- by unit ---------------- */
  function units(year) {
    const ys = String(year);
    let h = `<table class="tbl rpt"><thead><tr><th>Unit</th><th>Tenant</th><th class="num">Rent received</th><th class="num">Unit expenses</th><th class="num">Net</th></tr></thead><tbody>`;
    let tr = 0, te = 0;
    D.units.forEach((u) => { const r = U.sum(D.payments.filter((p) => p.unitId === u.id && (p.date || '').startsWith(ys)), (p) => p.amount); const e = U.sum(D.txns.filter((x) => x.unitId === u.id && x.type === 'expense' && x.date.startsWith(ys)), (x) => x.amount); tr += r; te += e; h += `<tr><td>${U.esc(u.number)}</td><td>${U.esc((M.currentTenant(u.id) || {}).name || '')}</td><td class="num">${n(r)}</td><td class="num">${n(e)}</td><td class="num">${n(r - e)}</td></tr>`; });
    const shared = U.sum(D.txns.filter((x) => !x.unitId && x.type === 'expense' && M.isBuilding(x) && x.date.startsWith(ys)), (x) => x.amount);
    h += `</tbody><tfoot><tr><th colspan="2">Units</th><th class="num">${U.money(tr)}</th><th class="num">${U.money(te)}</th><th class="num">${U.money(tr - te)}</th></tr><tr><th colspan="3">Whole-building expenses (not tied to a unit)</th><th class="num">${U.money(shared)}</th><th class="num"></th></tr></tfoot></table>`;
    return { title: `Income and expenses by unit · ${year}`, html: h + '<p class="small muted">Only expenses tagged with a unit are counted per unit.</p>' };
  }

  /* ---------------- paid for others ---------------- */
  function others(year) {
    const ys = String(year);
    const xs = D.txns.filter((x) => x.type === 'expense' && !M.isBuilding(x) && x.date.startsWith(ys));
    const by = {}; xs.forEach((x) => { (by[x.entity] = by[x.entity] || []).push(x); });
    let h = '';
    Object.entries(by).sort((a, b) => U.sum(b[1], (x) => x.amount) - U.sum(a[1], (x) => x.amount)).forEach(([e, list]) => {
      h += `<h3 class="rpt-h">${U.esc((M.entity(e) || {}).name || e)} · ${U.money(U.sum(list, (x) => x.amount))}</h3><table class="tbl rpt"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr></thead><tbody>${list.sort((a, b) => a.date.localeCompare(b.date)).map((x) => `<tr><td>${U.fmtDate(x.date)}</td><td>${U.esc(U.titleCase(x.description))}</td><td>${U.esc(M.catName(x.category))}</td><td class="num">${U.money(x.amount)}</td></tr>`).join('')}</tbody></table>`;
    });
    return { title: `Paid from the building account for others · ${year}`, html: (h || '<p class="muted">Nothing was paid for others this year.</p>') + `<p class="small muted">Total ${U.money(U.sum(xs, (x) => x.amount))}. These are left out of the building’s income statement. Your accountant may treat them as owner draws or amounts owed back to the building.</p>` };
  }

  /* ---------------- Schedule E ---------------- */
  function sche(year) {
    const L = M.scheduleE(year);
    const lines = [3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const totalExp = U.sum(lines.filter((l) => l >= 5), (l) => L[l] || 0);
    let h = `<table class="tbl rpt"><thead><tr><th>Line</th><th>Schedule E, Part I</th><th class="num">Amount</th></tr></thead><tbody>`;
    lines.forEach((l) => { h += `<tr><td>${l}</td><td>${U.esc(M.SCHED_E[l])}</td><td class="num">${n(L[l])}</td></tr>`; });
    h += `<tr class="sub"><td>20</td><th>Total expenses</th><td class="num"><b>${U.money(totalExp)}</b></td></tr><tr class="grand"><td>21</td><th>Income or (loss)</th><td class="num"><b>${(L[3] || 0) - totalExp < 0 ? neg((L[3] || 0) - totalExp) : U.money((L[3] || 0) - totalExp)}</b></td></tr></tbody></table>`;
    const excl = [L.none ? `${U.money(L.none)} of personal items (e.g. health insurance) is left out.` : '', L.capital ? `${U.money(L.capital)} was recorded as capital items: add them as assets so they are depreciated instead.` : ''].filter(Boolean).join(' ');
    h += `<p class="small muted">A summary to hand to your accountant, not a tax return. It uses the Schedule E line set in Settings → Categories for each category. ${excl} Depreciation comes from the Assets page. If the building is owned by a partnership (for example Torres Limited), the return is usually Form 8825 instead, which has similar lines.</p>`;
    return { title: `Schedule E summary · ${year}`, html: h };
  }

  /* ---------------- budget ---------------- */
  function budget(year) {
    const rows = M.budgetVsActual(year);
    let h = `<table class="tbl rpt"><thead><tr><th>Category</th><th class="num">Budget</th><th class="num">On pace for today</th><th class="num">Actual</th><th class="num">Left</th></tr></thead><tbody>`;
    rows.forEach((r) => { const over = r.budget && r.actual > r.budget; h += `<tr><td>${U.esc(r.cat.name)}<small>${U.esc(r.cat.group)}</small></td><td class="num"><input class="bud-in" data-cat="${r.cat.id}" value="${r.budget || ''}" inputmode="decimal" aria-label="Budget for ${U.esc(r.cat.name)}"/></td><td class="num">${n(r.pace)}</td><td class="num${over ? ' c-late' : ''}">${n(r.actual)}</td><td class="num">${r.budget ? (r.budget - r.actual < 0 ? neg(r.budget - r.actual) : U.money(r.budget - r.actual)) : '—'}</td></tr>`; });
    h += `</tbody><tfoot><tr><th>Total</th><th class="num">${U.money(U.sum(rows, (r) => r.budget))}</th><th class="num">${U.money(U.sum(rows, (r) => r.pace))}</th><th class="num">${U.money(U.sum(rows, (r) => r.actual))}</th><th></th></tr></tfoot></table>`;
    return { title: `Budget vs actual · ${year}`, html: h + '<p class="small muted">Type a yearly budget next to a category; it saves as you leave the box. Categories without a budget or spending are hidden. Add more budgets in Settings → Categories.</p>' };
  }

  /* ---------------- deposits ---------------- */
  function deposits() {
    let h = `<table class="tbl rpt"><thead><tr><th>Unit</th><th>Tenant</th><th>Received</th><th class="num">Amount</th><th>Returned</th><th class="num">Returned amount</th><th>Notes</th></tr></thead><tbody>`;
    [...D.deposits].sort((a, b) => String((M.unit(a.unitId) || {}).number).localeCompare(String((M.unit(b.unitId) || {}).number))).forEach((d) => { h += `<tr><td>${U.esc((M.unit(d.unitId) || {}).number || '')}</td><td>${U.esc((M.tenant(d.tenantId) || {}).name || '')}</td><td>${U.fmtDate(d.date) || '—'}</td><td class="num">${U.money(d.amount)}</td><td>${U.fmtDate(d.returnedDate) || 'Held'}</td><td class="num">${n(d.returnedAmount)}</td><td>${U.esc(d.notes || '')}</td></tr>`; });
    h += `</tbody><tfoot><tr><th colspan="3">Held today</th><th class="num">${U.money(M.depositsHeld())}</th><th colspan="3"></th></tr></tfoot></table>`;
    return { title: 'Security deposit register', html: h };
  }

  /* ---------------- page ---------------- */
  const RS = { r: 'pl', y: null, m: null, asOf: null };
  function page(view, p) {
    RS.r = p.r || RS.r; RS.y = +(p.y || RS.y || M.defaultYear()); RS.m = RS.m || M.defaultMonth(); RS.asOf = RS.asOf || U.todayISO();
    const rep = build();
    const ctl = ['bs'].includes(RS.r) ? `<label class="inline">As of <input type="date" id="rAsOf" value="${RS.asOf}"/></label>` : RS.r === 'roll' ? `<label class="inline">Month <input type="month" id="rMonth" value="${RS.m}"/></label>` : RS.r === 'deposits' ? '' : global.Pages.yearSel(RS.y, 'rYear');
    view.innerHTML = `
      <div class="page-head"><div><h1>Reports</h1><p class="lede">Print any report or save it as a PDF, or download everything as one Excel workbook for your accountant.</p></div>
        <div class="btn-row"><button class="btn" id="rXlsx" type="button">Download Excel workbook</button><button class="btn btn-primary" id="rPrint" type="button">Print or save as PDF</button></div></div>
      <div class="rtabs" role="tablist">${REPORTS.map(([k, l]) => `<button type="button" role="tab" class="${RS.r === k ? 'on' : ''}" data-r="${k}">${l}</button>`).join('')}</div>
      <section class="card report"><div class="card-head"><h2>${U.esc(rep.title)}</h2>${ctl}</div><div class="rpt-body">${rep.html}</div></section>`;
    view.onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) A().go('reports', { r: b.dataset.r, y: RS.y }); };
    const ys = U.$('#rYear'); if (ys) ys.onchange = (e) => A().go('reports', { r: RS.r, y: e.target.value });
    const ao = U.$('#rAsOf'); if (ao) ao.onchange = (e) => { RS.asOf = e.target.value || U.todayISO(); A().render(); };
    const rm = U.$('#rMonth'); if (rm) rm.onchange = (e) => { RS.m = e.target.value || M.defaultMonth(); A().render(); };
    U.$('#rPrint').onclick = () => print(build());
    U.$('#rXlsx').onclick = () => excel(RS.y);
    view.onchange = (e) => {
      const i = e.target.closest('.bud-in'); if (!i) return;
      const c = D.settings.categories.find((x) => x.id === i.dataset.cat); if (!c) return;
      c.budget = U.num(i.value); A().saveSettings({}, 'Budget for ' + c.name);
    };
  }
  function build() {
    switch (RS.r) {
      case 'bs': return bs(RS.asOf); case 'roll': return roll(RS.m); case 'grid': return grid(RS.y); case 'units': return units(RS.y);
      case 'others': return others(RS.y); case 'sche': return sche(RS.y); case 'budget': return budget(RS.y); case 'deposits': return deposits();
      default: return pl(RS.y);
    }
  }

  /* ---------------- printing (the browser's Save as PDF) ---------------- */
  function print(rep) {
    const s = D.settings;
    let box = U.$('#printArea'); if (!box) { box = document.createElement('div'); box.id = 'printArea'; document.body.appendChild(box); }
    box.innerHTML = `<header class="letterhead"><img src="icons/vc-mark.png" alt="" onerror="this.remove()"/><div><b>${U.esc(s.propertyName)}</b><span>${U.esc([s.legalName, s.address, s.city].filter(Boolean).join(' · '))}</span></div><div class="lh-r"><b>${U.esc(rep.title)}</b><span>Prepared ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} by ${U.esc(A().who())}</span></div></header>${rep.html.replace(/<input class="bud-in"[^>]*value="([^"]*)"[^>]*\/>/g, (m, v) => (v ? U.money(+v) : '—'))}`;
    document.body.classList.toggle('print-landscape', !!rep.landscape);
    setTimeout(() => { window.print(); }, 120);
  }

  /* ---------------- Excel workbook ---------------- */
  async function excel(year) {
    U.toast('Building the Excel workbook…');
    await A().loadLib('excel');
    const ExcelJS = global.ExcelJS; const s = D.settings;
    const wb = new ExcelJS.Workbook(); wb.creator = A().who(); wb.created = new Date();
    const GREEN = 'FF1F3B33', SAND = 'FFF1EEE6', LINE = 'FFD8D3C6';
    const money = '$#,##0.00;[Red]($#,##0.00);"—"';
    let logo = null;
    try { const r = await fetch('vc.png'); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); let str = ''; for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); logo = wb.addImage({ base64: btoa(str), extension: 'png' }); } } catch (_) { /* no logo */ }
    const sheet = (name, title, cols) => {
      const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: cols.length > 8 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      ws.columns = cols.map((c) => ({ width: c.w || 14 }));
      ws.getRow(1).height = 30;
      ws.getCell('A1').value = s.propertyName; ws.getCell('A1').font = { name: 'Georgia', size: 16, bold: true, color: { argb: GREEN } };
      ws.getCell('A2').value = `${title} · ${[s.address, s.city].filter(Boolean).join(', ')}`; ws.getCell('A2').font = { size: 10, color: { argb: 'FF5B6660' } };
      if (logo !== null) ws.addImage(logo, { tl: { col: Math.max(1, cols.length - 1.2), row: 0 }, ext: { width: 56, height: 56 } });
      const hr = ws.getRow(4); cols.forEach((c, i) => { const cell = hr.getCell(i + 1); cell.value = c.h; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }; cell.alignment = { horizontal: c.num ? 'right' : 'left', vertical: 'middle' }; });
      hr.height = 20;
      cols.forEach((c, i) => { if (c.num) ws.getColumn(i + 1).numFmt = money; if (c.date) ws.getColumn(i + 1).numFmt = 'mmm d, yyyy'; });
      return ws;
    };
    const dt = (iso) => { const d = U.parseISO(iso); return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null; };
    const totalRow = (ws, label, colsWithSum, firstRow, lastRow, ncols) => {
      const r = ws.addRow([]); r.getCell(1).value = label; r.font = { bold: true };
      colsWithSum.forEach((ci) => { const L = ws.getColumn(ci).letter; r.getCell(ci).value = { formula: `SUM(${L}${firstRow}:${L}${lastRow})` }; });
      for (let i = 1; i <= ncols; i++) { r.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAND } }; r.getCell(i).border = { top: { style: 'thin', color: { argb: GREEN } } }; }
      return r;
    };

    /* Income statement */
    {
      const months = M.monthly(year); const tot = M.periodTotals(`${year}-01-01`, `${year}-12-31`);
      const ws = sheet('Income statement', `Income statement ${year} (cash basis, building only)`, [{ h: 'Category', w: 38 }, ...U.MONTHS.map((m) => ({ h: m, num: true, w: 13.5 })), { h: 'Total', num: true, w: 15 }]);
      const sec = (t) => { const r = ws.addRow([t]); r.font = { bold: true, color: { argb: GREEN } }; };
      const line = (label, f, ind) => { const r = ws.addRow([(ind ? '   ' : '') + label, ...months.map(f)]); r.getCell(14).value = { formula: `SUM(B${r.number}:M${r.number})` }; return r.number; };
      sec('Income');
      const i0 = ws.rowCount + 1; line('Rent', (m) => m.rent || null); Object.keys(tot.inc).forEach((c) => line(M.catName(c), (m) => m.inc[c] || null)); const i1 = ws.rowCount;
      const ti = totalRow(ws, 'Total income', [...Array(13)].map((_, k) => k + 2), i0, i1, 14).number;
      sec('Building expenses');
      const e0 = ws.rowCount + 1;
      const byG = {}; Object.keys(tot.exp).forEach((c) => { const g = (M.cat(c) || {}).group || 'Other'; (byG[g] = byG[g] || []).push(c); });
      Object.entries(byG).forEach(([g, cs]) => { const r = ws.addRow([g]); r.font = { italic: true, color: { argb: 'FF5B6660' } }; cs.forEach((c) => line(M.catName(c), (m) => m.exp[c] || null, true)); });
      const e1 = ws.rowCount;
      const te = totalRow(ws, 'Total expenses', [...Array(13)].map((_, k) => k + 2), e0, e1, 14).number;
      const nr = ws.addRow(['Net operating income']); nr.font = { bold: true, size: 12 };
      for (let c = 2; c <= 14; c++) { const L = ws.getColumn(c).letter; nr.getCell(c).value = { formula: `${L}${ti}-${L}${te}` }; nr.getCell(c).border = { top: { style: 'double', color: { argb: GREEN } } }; }
    }
    /* Rent by month */
    {
      const ms = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
      const ws = sheet('Rent by month', `Rent received by month ${year}`, [{ h: 'Unit', w: 8 }, { h: 'Tenant', w: 30 }, { h: 'Rent', num: true }, ...U.MONTHS.map((m) => ({ h: m, num: true, w: 11 })), { h: 'Total', num: true }]);
      const f = ws.rowCount + 1;
      D.units.forEach((u) => { const t = M.currentTenant(u.id) || M.tenantForMonth(u.id, ms[11]); const r = ws.addRow([u.number, t ? t.name : 'Vacant', t ? +t.rent : null, ...ms.map((k) => U.sum(M.paymentsFor(u.id, k), (p) => p.amount) || null)]); r.getCell(16).value = { formula: `SUM(D${r.number}:O${r.number})` }; });
      totalRow(ws, 'Total', [...Array(13)].map((_, k) => k + 4).concat([3]), f, ws.rowCount, 16);
    }
    /* Rent payments */
    {
      const ws = sheet('Rent payments', `Rent payments received in ${year}`, [{ h: 'Date', date: true, w: 13 }, { h: 'Unit', w: 8 }, { h: 'Tenant', w: 30 }, { h: 'For month', w: 12 }, { h: 'Method', w: 16 }, { h: 'Check / ref', w: 14 }, { h: 'Amount', num: true }, { h: 'Notes', w: 40 }]);
      const f = ws.rowCount + 1;
      D.payments.filter((p) => (p.date || '').startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date)).forEach((p) => ws.addRow([dt(p.date), (M.unit(p.unitId) || {}).number, (M.tenant(p.tenantId) || {}).name || '', p.forMonth ? U.monthLabel(p.forMonth) : '', p.method, p.checkNo, +p.amount, p.notes]));
      totalRow(ws, 'Total', [7], f, ws.rowCount, 8);
    }
    /* Ledger */
    {
      const ws = sheet('Income & expenses', `All entries ${year}`, [{ h: 'Date', date: true, w: 13 }, { h: 'Type', w: 10 }, { h: 'Description', w: 52 }, { h: 'Vendor', w: 26 }, { h: 'Category', w: 30 }, { h: 'Group', w: 20 }, { h: 'Paid for', w: 12 }, { h: 'Unit', w: 7 }, { h: 'Amount', num: true }, { h: 'Reference', w: 24 }, { h: 'Notes', w: 30 }, { h: 'Needs review', w: 40 }]);
      const f = ws.rowCount + 1;
      D.txns.filter((x) => x.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date)).forEach((x) => { const r = ws.addRow([dt(x.date), x.type, x.description, (M.vendor(x.vendorId) || {}).name || '', M.catName(x.category), (M.cat(x.category) || {}).group || '', (M.entity(x.entity) || {}).short || '', (M.unit(x.unitId) || {}).number || '', (x.type === 'expense' || x.direction === 'out' ? -1 : 1) * x.amount, x.ref, x.notes, x.review ? x.reviewNote || 'yes' : '']); if (!M.isBuilding(x)) r.font = { color: { argb: 'FF8A6D3B' } }; });
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: ws.rowCount, column: 12 } };
      void f;
    }
    /* Paid for others */
    {
      const ws = sheet('Paid for others', `Paid from the building account for others ${year}`, [{ h: 'Paid for', w: 30 }, { h: 'Date', date: true, w: 13 }, { h: 'Description', w: 52 }, { h: 'Category', w: 30 }, { h: 'Amount', num: true }]);
      const f = ws.rowCount + 1;
      D.txns.filter((x) => x.type === 'expense' && !M.isBuilding(x) && x.date.startsWith(String(year))).sort((a, b) => (a.entity || '').localeCompare(b.entity || '') || a.date.localeCompare(b.date)).forEach((x) => ws.addRow([(M.entity(x.entity) || {}).name, dt(x.date), x.description, M.catName(x.category), +x.amount]));
      totalRow(ws, 'Total', [5], f, ws.rowCount, 5);
    }
    /* Balance sheet */
    {
      const b = M.balanceSheet(year < new Date().getFullYear() ? `${year}-12-31` : U.todayISO());
      const ws = sheet('Balance sheet', `Balance sheet as of ${U.fmtDate(b.asOf)}`, [{ h: 'Item', w: 46 }, { h: 'Type', w: 22 }, { h: 'Amount', num: true, w: 16 }]);
      ws.addRow(['Assets']).font = { bold: true, color: { argb: GREEN } };
      const a0 = ws.rowCount + 1; b.cash.forEach((c) => ws.addRow(['   ' + c.name, 'Cash', c.value])); b.fixed.forEach((f) => ws.addRow(['   ' + f.name, f.type, f.value])); const a1 = ws.rowCount;
      const ta = totalRow(ws, 'Total assets', [3], a0, Math.max(a0, a1), 3).number;
      ws.addRow(['Liabilities']).font = { bold: true, color: { argb: GREEN } };
      const l0 = ws.rowCount + 1; b.loans.forEach((l) => ws.addRow(['   ' + l.name, l.type, l.value])); ws.addRow(['   Tenant security deposits held', 'Deposits', b.deposits]); const l1 = ws.rowCount;
      const tl = totalRow(ws, 'Total liabilities', [3], l0, l1, 3).number;
      const er = ws.addRow(['Owners’ equity', '', { formula: `C${ta}-C${tl}` }]); er.font = { bold: true, size: 12 };
    }
    /* Schedule E */
    {
      const L = M.scheduleE(year);
      const ws = sheet('Schedule E', `Schedule E summary ${year} (for your accountant)`, [{ h: 'Line', w: 7 }, { h: 'Description', w: 40 }, { h: 'Amount', num: true, w: 16 }]);
      const r3 = ws.addRow([3, M.SCHED_E[3], L[3] || 0]).number;
      const f = ws.rowCount + 1; [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].forEach((l) => ws.addRow([l, M.SCHED_E[l], L[l] || null]));
      const t = totalRow(ws, '20 · Total expenses', [3], f, ws.rowCount, 3).number;
      const r = ws.addRow([21, 'Income or (loss)', { formula: `C${r3}-C${t}` }]); r.font = { bold: true };
    }
    /* Tenants & deposits */
    {
      const ws = sheet('Tenants', 'Tenants and security deposits', [{ h: 'Unit', w: 8 }, { h: 'Tenant', w: 34 }, { h: 'Phone', w: 16 }, { h: 'Other contact', w: 30 }, { h: 'Moved in', date: true, w: 13 }, { h: 'Moved out', date: true, w: 13 }, { h: 'Rent', num: true }, { h: 'Due day', w: 9 }, { h: 'Deposit held', num: true }]);
      const f = ws.rowCount + 1;
      [...D.tenants].sort((a, b) => String((M.unit(a.unitId) || {}).number).localeCompare(String((M.unit(b.unitId) || {}).number))).forEach((t) => ws.addRow([(M.unit(t.unitId) || {}).number, t.name, t.phone, t.otherContact, dt(t.moveIn), dt(t.moveOut), +t.rent || 0, t.dueDay, U.sum(D.deposits.filter((d) => d.tenantId === t.id && !d.returnedDate), (d) => d.amount) || null]));
      totalRow(ws, 'Total', [7, 9], f, ws.rowCount, 9);
    }
    /* Assets, liabilities, vendors */
    {
      const ws = sheet('Assets', 'Assets and depreciation (straight-line estimates)', [{ h: 'Asset', w: 36 }, { h: 'Type', w: 20 }, { h: 'In service', date: true, w: 13 }, { h: 'Cost', num: true }, { h: 'Life (yrs)', w: 10 }, { h: `Depreciation ${year}`, num: true, w: 18 }, { h: 'Accumulated', num: true, w: 16 }, { h: 'Book value', num: true, w: 16 }]);
      const f = ws.rowCount + 1;
      D.assets.forEach((a) => ws.addRow([a.name, a.type, dt(a.inService), +a.cost || null, +a.life || null, M.yearDep(a, year) || null, M.accumDep(a, U.todayISO()) || null, M.assetValue(a)]));
      totalRow(ws, 'Total', [4, 6, 7, 8], f, ws.rowCount, 8);
      const wl = sheet('Liabilities', 'Loans and other liabilities', [{ h: 'Liability', w: 34 }, { h: 'Type', w: 18 }, { h: 'Lender', w: 26 }, { h: 'Rate %', w: 9 }, { h: 'Monthly payment', num: true, w: 16 }, { h: `Interest ${year}`, num: true, w: 16 }, { h: 'Balance today', num: true, w: 16 }]);
      const g = wl.rowCount + 1;
      D.liabilities.forEach((L) => wl.addRow([L.name, L.type, L.lender, +L.rate || null, L.amortize ? (L.payment || M.loanPayment(L)) : null, M.yearInterest(L, year), M.liabilityBalance(L)]));
      wl.addRow(['Tenant security deposits held', 'Deposits', '', null, null, null, M.depositsHeld()]);
      totalRow(wl, 'Total', [7], g, wl.rowCount, 7);
      const wv = sheet('Vendors', `Vendors and ${year} totals`, [{ h: 'Vendor', w: 34 }, { h: 'Category', w: 30 }, { h: 'Phone', w: 16 }, { h: 'Email', w: 28 }, { h: 'Account', w: 18 }, { h: 'W-9', w: 6 }, { h: `Paid ${year}`, num: true, w: 16 }]);
      const h = wv.rowCount + 1;
      D.vendors.map((v) => ({ v, t: U.sum(D.txns.filter((x) => x.vendorId === v.id && x.type === 'expense' && x.date.startsWith(String(year))), (x) => x.amount) })).sort((a, b) => b.t - a.t).forEach(({ v, t }) => wv.addRow([v.name, M.catName(v.category), v.phone, v.email, v.account, v.w9 ? 'Yes' : '', t || null]));
      totalRow(wv, 'Total', [7], h, wv.rowCount, 7);
    }
    const buf = await wb.xlsx.writeBuffer();
    U.download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${U.norm(s.propertyName).replace(/[^a-z0-9]+/g, '-')}-${year}-reports.xlsx`);
    U.toast('Excel workbook downloaded.', 'ok');
  }

  Object.assign((global.__pages = global.__pages || {}), { reports: page });
  global.Reports = { pl, bs, roll, grid, units, others, sche, budget, deposits, print, excel };
})(window);
