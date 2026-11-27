/* =========================================================
   Settings, data (import / backup / restore), security,
   cloud sync, activity history and the Help page
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M, Store } = global;
  const D = M.D;
  const A = () => global.App;

  const TABS = [['property', 'Property'], ['categories', 'Categories & budgets'], ['entities', 'Paid for'], ['data', 'Import & backups'], ['legal', 'Legal'], ['security', 'Password & security'], ['cloud', 'Cloud sync'], ['activity', 'History']];

  function page(view, p) {
    const tab = p.tab || 'property';
    view.innerHTML = `<div class="page-head"><div><h1>Settings</h1></div></div>
      <div class="rtabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="setBody"></div>`;
    view.onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) A().go('settings', { tab: b.dataset.tab }); };
    const body = U.$('#setBody');
    ({ property, categories, entities, data, security, cloud, activity, legal: (b) => global.Legal.settingsTab(b) })[tab](body);
  }

  /* ---------------- property ---------------- */
  function property(el) {
    const s = D.settings;
    el.innerHTML = `<section class="card"><form class="form" id="propForm" autocomplete="off">
      <div class="row2"><label class="field"><span>Building name</span><input name="propertyName" value="${U.esc(s.propertyName)}"/></label><label class="field"><span>Owner (legal name)</span><input name="legalName" value="${U.esc(s.legalName)}"/></label></div>
      <div class="row2"><label class="field"><span>Street address</span><input name="address" value="${U.esc(s.address)}"/></label><label class="field"><span>City, state, ZIP</span><input name="city" value="${U.esc(s.city)}"/></label></div>
      <div class="row3"><label class="field"><span>Phone</span><input name="phone" value="${U.esc(s.phone)}"/></label><label class="field"><span>Email</span><input name="email" value="${U.esc(s.email)}"/></label><label class="field"><span>Year built</span><input name="yearBuilt" value="${U.esc(s.yearBuilt)}"/></label></div>
      <h3 class="form-h">Rent</h3>
      <div class="row3"><label class="field"><span>Grace days before rent is late</span><input name="graceDays" type="number" min="0" max="27" value="${U.esc(s.graceDays)}"/></label><label class="field"><span>Late fee (for your reference)</span><input name="lateFee" type="number" min="0" value="${U.esc(s.lateFee)}"/></label><label class="field"><span>Track rent starting</span><input name="rentTrackFrom" type="month" value="${U.esc(s.rentTrackFrom || '')}"/></label></div>
      <p class="small muted">Months before “Track rent starting” never count as late or owed. Left empty, tracking starts with the first payment recorded (${M.trackFrom() ? U.monthLabel(M.trackFrom(), true) : 'none yet'}). Rent is recorded through ${M.lastRentMonth() ? U.monthLabel(M.lastRentMonth(), true) : '—'}.</p>
      <h3 class="form-h">Safety</h3>
      <div class="row3"><label class="field"><span>Lock after this many idle minutes (0 = never)</span><input name="autoLockMin" type="number" min="0" max="240" value="${U.esc(s.autoLockMin)}"/></label><label class="field"><span>Remind me to download a backup every … days (0 = never)</span><input name="backupDays" type="number" min="0" max="365" value="${U.esc(s.backupDays)}"/></label><span></span></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Save</button></div></form></section>
      <section class="card"><div class="card-head"><h2>This device</h2></div>
      <div class="row2"><label class="field"><span>Your name (shown next to your changes)</span><input id="devName" value="${U.esc(A().who())}"/></label><label class="field"><span>Appearance</span><select id="devTheme">${U.opts([{ value: 'auto', label: 'Follow the device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], localStorage.getItem('vc-theme') || 'auto')}</select></label></div>
      <p class="small muted">The logo comes from the file <code>vc.png</code> in the app’s folder on GitHub. Replace that file to change it.</p></section>`;
    U.$('#propForm', el).onsubmit = async (e) => { e.preventDefault(); const v = U.formValues(e.target); await A().saveSettings(v, 'Property settings'); U.toast('Saved.', 'ok'); };
    U.$('#devName', el).onchange = (e) => { A().pref('name', e.target.value.trim() || 'Owner'); A().applyBrand(); U.toast('Name saved on this device.', 'ok'); };
    U.$('#devTheme', el).onchange = (e) => { const t = e.target.value; try { localStorage.setItem('vc-theme', t); } catch (_) { /* ignore */ } const d = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'); };
  }

  /* ---------------- categories ---------------- */
  function categories(el) {
    const cats = D.settings.categories;
    const lines = Object.entries(M.SCHED_E).map(([k, v]) => ({ value: k, label: (isNaN(k) ? '' : 'Line ' + k + ' · ') + v }));
    const used = {}; D.txns.forEach((x) => { used[x.category] = (used[x.category] || 0) + 1; });
    const row = (c) => `<tr data-id="${c.id}" class="${c.hidden ? 'muted' : ''}"><td><input data-f="name" value="${U.esc(c.name)}" aria-label="Name"/></td><td>${c.type === 'income' ? 'Income' : `<input data-f="group" value="${U.esc(c.group)}" list="grpList" aria-label="Group"/>`}</td><td><select data-f="schedE" aria-label="Schedule E line">${U.opts(lines, String(c.schedE))}</select></td><td>${c.type === 'expense' ? `<span class="money-in"><i>$</i><input data-f="budget" inputmode="decimal" value="${c.budget || ''}" aria-label="Yearly budget"/></span>` : ''}</td><td class="num small">${used[c.id] || ''}</td><td><label class="check"><input type="checkbox" data-f="hidden" ${c.hidden ? 'checked' : ''}/><span>Hide</span></label></td></tr>`;
    el.innerHTML = `<section class="card"><div class="card-head"><h2>Categories</h2><button class="btn btn-sm" id="catAdd" type="button">Add category</button></div>
      <p class="small muted">Rename, regroup or hide categories, set the Schedule E line each one goes to, and give expense categories a yearly budget. Changes save as you leave a box.</p>
      <datalist id="grpList">${M.groups().map((g) => `<option value="${U.esc(g)}">`).join('')}</datalist>
      <div class="tbl-scroll"><table class="tbl tbl-form cats"><thead><tr><th>Name</th><th>Group</th><th>Schedule E</th><th>Budget / year</th><th class="num">Used</th><th></th></tr></thead>
      <tbody>${cats.filter((c) => c.type === 'expense').map(row).join('')}<tr class="sec"><th colspan="6">Other income</th></tr>${cats.filter((c) => c.type === 'income').map(row).join('')}</tbody></table></div></section>`;
    el.onchange = (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const c = cats.find((x) => x.id === tr.dataset.id); const f = e.target.dataset.f;
      c[f] = f === 'hidden' ? e.target.checked : f === 'budget' ? U.num(e.target.value) : f === 'schedE' ? (isNaN(e.target.value) ? e.target.value : +e.target.value) : e.target.value.trim() || c[f];
      A().saveSettings({}, 'Category ' + c.name);
    };
    U.$('#catAdd', el).onclick = async () => {
      const r = await U.modal({ title: 'Add category', body: `<div class="form"><div class="seg" id="ct"><button type="button" class="on" data-t="expense">Expense</button><button type="button" data-t="income">Income</button></div><label class="field"><span>Name</span><input id="cn"/></label><label class="field"><span>Group</span><input id="cg" list="grpList2" value="Other"/><datalist id="grpList2">${M.groups().map((g) => `<option value="${U.esc(g)}">`).join('')}</datalist></label><label class="field"><span>Schedule E line</span><select id="cs">${U.opts(lines, '19')}</select></label></div>`,
        onOpen: (b) => { U.$('#ct', b).onclick = (e) => { const t = e.target.closest('[data-t]'); if (!t) return; U.$$('#ct button', b).forEach((x) => x.classList.toggle('on', x === t)); }; },
        buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Add', cls: 'btn-primary', value: (b) => { const name = U.$('#cn', b).value.trim(); if (!name) return undefined; const type = U.$('#ct .on', b).dataset.t; return { id: 'c-' + U.uid().slice(0, 8), name, type, group: type === 'income' ? 'Income' : U.$('#cg', b).value.trim() || 'Other', schedE: isNaN(U.$('#cs', b).value) ? U.$('#cs', b).value : +U.$('#cs', b).value, budget: null }; } }] });
      if (r) { cats.push(r); await A().saveSettings({}, 'Added category ' + r.name); }
    };
  }

  /* ---------------- entities ("paid for") ---------------- */
  function entities(el) {
    const ents = D.settings.entities;
    const tot = {}; D.txns.forEach((x) => { if (x.type === 'expense') tot[x.entity || 'bldg'] = (tot[x.entity || 'bldg'] || 0) + x.amount; });
    el.innerHTML = `<section class="card"><div class="card-head"><h2>Who an expense was paid for</h2><button class="btn btn-sm" id="entAdd" type="button">Add</button></div>
      <p class="small muted">The workbook’s ledger splits each payment between EXPENSES TLP, LCDLT, VIVIAN, JORGE and MOM. Only the building’s own share counts in its income statement; the rest is listed under Reports → Paid for others.</p>
      <table class="tbl tbl-form"><thead><tr><th>Name</th><th>Short name</th><th>The building itself</th><th class="num">All-time expenses</th></tr></thead><tbody>
      ${ents.map((e) => `<tr data-id="${e.id}"><td><input data-f="name" value="${U.esc(e.name)}"/></td><td><input data-f="short" value="${U.esc(e.short)}" maxlength="12"/></td><td>${e.building ? '<span class="chip st-paid">Yes</span>' : ''}</td><td class="num">${U.money(tot[e.id] || 0)}</td></tr>`).join('')}</tbody></table></section>`;
    el.onchange = (e) => { const tr = e.target.closest('tr[data-id]'); if (!tr) return; const en = ents.find((x) => x.id === tr.dataset.id); en[e.target.dataset.f] = e.target.value.trim() || en[e.target.dataset.f]; A().saveSettings({}, 'Paid-for list'); };
    U.$('#entAdd', el).onclick = async () => { const n = await U.prompt('Add a person or business', 'Name', { okLabel: 'Add' }); if (n && n.trim()) { ents.push({ id: 'ent-' + U.uid().slice(0, 8), name: n.trim(), short: n.trim().split(/\s+/)[0].slice(0, 12) }); A().saveSettings({}, 'Added ' + n.trim()); } };
  }

  /* ---------------- import & backups ---------------- */
  async function data(el) {
    const last = A().pref('lastBackup');
    const snaps = (await Store.vaultKeys('snap:')).sort().reverse();
    el.innerHTML = `<section class="card"><div class="card-head"><h2>Import the Excel workbook</h2></div>
        <p>Reads the “Income &amp; Expense Worksheet” layout: the tenant table, security deposits, rent by month, expenses per apartment and the General Ledger with its EXPENSES columns. You see a full preview first. Importing the same workbook again only adds what’s new.</p>
        <div class="btn-row"><button class="btn btn-primary" id="dImp" type="button">Choose workbook…</button></div></section>
      <section class="card"><div class="card-head"><h2>Backup files</h2><span class="small muted">${last ? 'Last downloaded ' + U.ago(last) : 'Never downloaded on this device'}</span></div>
        <p>A backup file holds every record. Keep a recent one somewhere safe (a USB stick, or a private cloud folder). Never put backups in the GitHub repository.</p>
        <div class="btn-row"><button class="btn btn-primary" id="dBack" type="button">Download backup</button><button class="btn" id="dRest" type="button">Restore from a backup…</button><button class="btn btn-ghost" id="dXl" type="button">Download Excel reports</button></div></section>
      <section class="card"><div class="card-head"><h2>Safety snapshots</h2></div>
        <p class="small muted">Taken automatically before every import or restore, kept encrypted on this device (last 8).</p>
        ${snaps.length ? `<ul class="list">${snaps.map((k) => `<li><span>${new Date(+k.slice(5)).toLocaleString()}</span><button class="btn btn-sm" data-snap="${k}" type="button">Restore</button></li>`).join('')}</ul>` : '<p class="muted">None yet.</p>'}</section>
      <section class="card danger-zone"><div class="card-head"><h2>Erase everything</h2></div>
        <p>Deletes all records and the password from this device${global.Sync && Sync.signedIn() ? ', and optionally from the cloud' : ''}. Download a backup first.</p>
        <button class="btn btn-danger" id="dErase" type="button">Erase all data…</button></section>`;
    U.$('#dImp', el).onclick = () => importWorkbook();
    U.$('#dBack', el).onclick = () => backup();
    U.$('#dRest', el).onclick = () => restore();
    U.$('#dXl', el).onclick = () => global.Reports.excel(M.defaultYear());
    U.$('#dErase', el).onclick = () => erase();
    el.onclick = async (e) => {
      const b = e.target.closest('[data-snap]'); if (!b) return;
      const snap = await Store.getVault(b.dataset.snap); if (!snap) return;
      if (!(await U.confirm('Restore snapshot', `Replace everything with the snapshot from ${new Date(snap.t).toLocaleString()} (${U.esc(snap.reason || '')})?`, 'Restore snapshot', true))) return;
      await replaceAll(snap.records, 'Restored a safety snapshot');
      A().ovMonth = null;
    };
  }

  async function importWorkbook() {
    const file = await U.pickFile('.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); if (!file) return;
    U.toast('Reading ' + file.name + '…');
    let out;
    try {
      await A().loadLib('excel');
      const wb = new global.ExcelJS.Workbook(); await wb.xlsx.load(await U.readFile(file, 'buffer'));
      out = global.Importer.parse(wb, { M, uid: U.uid, settings: D.settings });
    } catch (e) { console.error(e); return U.alert('Could not read the workbook', U.esc(e.message)); }
    const has = D.units.length > 0;
    const plan = mergePlan(out);
    const body = U.h(`<div class="stack">
      <p class="dialog-text">Found in <b>${U.esc(file.name)}</b> (year ${out.year}):</p>
      <div class="import-grid">
        <div><b>${out.units.length}</b><span>units</span></div><div><b>${out.tenants.length}</b><span>tenants</span></div><div><b>${out.deposits.length}</b><span>deposits · ${U.money0(U.sum(out.deposits, (d) => d.amount))}</span></div>
        <div><b>${out.payments.length}</b><span>rent payments · ${U.money0(out.stats.rent)}</span></div><div><b>${out.txns.filter((x) => x.type === 'expense').length}</b><span>expenses · ${U.money0(out.stats.expenses)}</span></div><div><b>${out.txns.filter((x) => x.type !== 'expense').length}</b><span>income &amp; transfers</span></div>
      </div>
      <p class="small">${out.stats.review} entries will be flagged <b>Needs review</b> because the workbook has a question or note on them.${out.stats.perAptMatched ? ` ${out.stats.perAptMatched} “expenses per apartment” lines were matched to ledger payments and tagged with their units.` : ''}${out.skippedGrid ? ` The monthly expense grids (${out.skippedGrid} amounts) were skipped because the ledger already has them.` : ''}</p>
      ${has ? `<div class="callout"><b>You already have records.</b> ${plan.newCount} of the imported records are new; ${plan.dupCount} are already here and will be skipped. Units are matched by number and tenants by name.</div>` : ''}
      ${out.warnings.length || out.notes.length ? `<details open><summary class="small">Notes from the import</summary><ul class="small">${[...out.warnings, ...out.notes.map((n) => 'Note in the workbook — ' + n)].map((w) => `<li>${U.esc(w)}</li>`).join('')}</ul></details>` : ''}
      ${!D.accounts.length ? '<label class="check"><input type="checkbox" id="imAcc" checked/><span>Create an “Operating account” for the bank account (enter its starting balance later on the Assets page)</span></label>' : ''}
      ${!D.assets.length ? '<label class="check"><input type="checkbox" id="imAss" checked/><span>Add the building and land as assets (enter their cost later)</span></label>' : ''}
      ${!D.bills.length ? '<label class="check"><input type="checkbox" id="imBills" checked/><span>Set up recurring bills from vendors paid most months</span></label>' : ''}
    </div>`);
    const go = await U.modal({ title: 'Import preview', body, size: 'lg', buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: has ? `Import ${plan.newCount} new records` : 'Import everything', cls: 'btn-primary', value: (b) => ({ acc: U.$('#imAcc', b)?.checked, ass: U.$('#imAss', b)?.checked, bills: U.$('#imBills', b)?.checked }) }] });
    if (!go) return;
    await A().snapshot('Before importing ' + file.name);
    const recs = plan.records;
    if (out.entities.length) out.entities.forEach((e) => { if (!D.settings.entities.some((x) => x.id === e.id)) D.settings.entities.push(e); });
    if (go.acc) recs.push({ _c: 'accounts', id: U.uid(), name: 'Operating account', kind: 'Checking', institution: '', last4: '', openingBalance: null, openingDate: '', primary: true, notes: 'Created by the import. Enter the balance from a bank statement and its date.' });
    if (go.ass) {
      recs.push({ _c: 'assets', id: U.uid(), name: `Building — ${D.settings.address || 'Villas Capellanias'}`, type: 'Building', cost: null, acquired: '', inService: '', life: 27.5, location: '', notes: 'Enter the purchase price allocated to the building (not the land), or the cost basis from your accountant’s depreciation schedule.' });
      recs.push({ _c: 'assets', id: U.uid(), name: 'Land', type: 'Land', cost: null, acquired: '', inService: '', life: null, notes: 'Land is not depreciated.' });
    }
    await A().save(recs, { bulkLabel: 'Imported ' + file.name, noRender: true });
    if (out.entities.length) await A().saveSettings({}, 'Paid-for list');
 if (go.bills) { const bills = global.Books.detectRecurring().filter((b) => M.isBuilding(b)); if (bills.length) await A().save(bills, { bulkLabel: 'Recurring bills from the import', noRender: true }); }
    A().ovMonth = null; A().rentYear = null;
    A().render();
    U.toast(`Imported ${recs.length} records from ${file.name}.`, 'ok');
    A().go('overview');
  }
  /** Map imported records onto what already exists, so a second import only adds what is new. */
  function mergePlan(out) {
    const map = {}; const records = []; let dup = 0;
    const keep = (r) => { records.push(r); };
    out.units.forEach((u) => { const ex = D.units.find((x) => String(x.number) === String(u.number)); if (ex) { map[u.id] = ex.id; dup++; } else keep(u); });
    const uid = (id) => map[id] || id;
    out.tenants.forEach((t) => { t.unitId = uid(t.unitId); const ex = D.tenants.find((x) => x.unitId === t.unitId && U.norm(x.name) === U.norm(t.name)); if (ex) { map[t.id] = ex.id; dup++; } else keep(t); });
    out.vendors.forEach((v) => { const ex = D.vendors.find((x) => U.norm(x.name) === U.norm(v.name)); if (ex) { map[v.id] = ex.id; dup++; } else keep(v); });
    out.accounts.forEach((a) => { const ex = D.accounts.find((x) => U.norm(x.name) === U.norm(a.name)); if (ex) { map[a.id] = ex.id; dup++; } else keep(a); });
    out.deposits.forEach((d) => { d.unitId = uid(d.unitId); d.tenantId = uid(d.tenantId); if (D.deposits.some((x) => x.unitId === d.unitId && +x.amount === +d.amount && (x.date || '') === (d.date || ''))) dup++; else keep(d); });
    const payKeys = new Set(D.payments.map((p) => p.importKey || [(M.unit(p.unitId) || {}).number, p.forMonth, p.amount, p.date].join('|')));
    out.payments.forEach((p) => { p.unitId = uid(p.unitId); p.tenantId = uid(p.tenantId); if (payKeys.has(p.importKey)) dup++; else keep(p); });
    const txKeys = new Set(D.txns.map((x) => x.importKey).filter(Boolean));
    out.txns.forEach((x) => { x.unitId = x.unitId ? uid(x.unitId) : ''; x.vendorId = x.vendorId ? uid(x.vendorId) : ''; x.accountId = x.accountId ? uid(x.accountId) : ''; if (txKeys.has(x.importKey)) dup++; else keep(x); });
    return { records, newCount: records.length, dupCount: dup };
  }

  async function backup() {
    const r = await U.modal({ title: 'Download a backup', body: `<div class="form"><label class="check"><input type="checkbox" id="bkEnc" checked/><span>Lock the file with the app password (recommended)</span></label><p class="small muted">A locked file can only be restored with the password that was in use when it was made. An unlocked file can be read by anyone who gets it: tenant names, phone numbers and amounts.</p></div>`, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Download', cls: 'btn-primary', value: (b) => ({ enc: U.$('#bkEnc', b).checked }) }] });
    if (!r) return;
    const payload = { format: 'villas-capellanias-backup', version: 1, exported: new Date().toISOString(), by: A().who(), property: D.settings.propertyName, records: M.all() };
    const file = r.enc ? await Store.encryptBackup(payload, A().password) : payload;
    U.download(new Blob([JSON.stringify(file)], { type: 'application/json' }), `villas-capellanias-backup-${U.stamp()}${r.enc ? '' : '-UNLOCKED'}.json`);
    A().pref('lastBackup', Date.now()); A().checkBanner();
    U.toast('Backup downloaded. Keep it somewhere safe, not in the GitHub repository.', 'ok');
  }

  async function restore() {
    const file = await U.pickFile('.json,application/json'); if (!file) return;
    let obj;
    try { obj = JSON.parse(await U.readFile(file)); } catch (_) { return U.alert('Not a backup file', 'That file could not be read as a backup.'); }
    if (obj.encrypted) {
      let pw = A().password; let dec = null;
      try { dec = await Store.decryptBackup(obj, pw); } catch (_) { dec = null; }
      while (!dec) {
        pw = await U.prompt('This backup is locked', 'Password that was in use when the backup was made', { type: 'password', okLabel: 'Unlock backup' });
        if (pw === null) return;
        try { dec = await Store.decryptBackup(obj, pw); } catch (_) { U.toast('That password does not open this backup.', 'err'); }
      }
      obj = dec;
    }
    if (obj.format !== 'villas-capellanias-backup' || !Array.isArray(obj.records)) return U.alert('Not a backup file', 'This file was not made by this app.');
    const counts = {}; obj.records.forEach((r) => { counts[r._c] = (counts[r._c] || 0) + 1; });
    const mode = await U.modal({ title: 'Restore backup', size: 'md',
      body: `<p class="dialog-text">Backup from <b>${U.esc(new Date(obj.exported).toLocaleString())}</b>${obj.by ? ' by ' + U.esc(obj.by) : ''}: ${counts.units || 0} units, ${counts.tenants || 0} tenants, ${counts.payments || 0} rent payments, ${counts.txns || 0} income &amp; expense entries.</p><ul class="small"><li><b>Combine</b> keeps everything here and adds or updates from the backup (the newer version of each record wins).</li><li><b>Replace</b> makes this device exactly like the backup. A safety snapshot is taken first.${global.Sync && Sync.signedIn() ? ' With cloud sync on, the other devices will follow.' : ''}</li></ul>`,
      buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Combine', value: 'merge', cls: 'btn' }, { label: 'Replace everything', value: 'replace', cls: 'btn-danger' }] });
    if (!mode) return;
    if (mode === 'replace') return replaceAll(obj.records, 'Restored backup ' + file.name);
    await A().snapshot('Before combining backup ' + file.name);
    const newer = obj.records.filter((r) => { const cur = r._c === 'settings' ? D.settings : M.get(r.id); return !cur || (r.updatedAt || 0) > (cur.updatedAt || 0); });
    newer.forEach((r) => { if (r._c === 'settings') M.upgradeSettings(r); });
    await A().save(newer, { bulkLabel: 'Combined backup ' + file.name, silent: false });
    U.toast(`Added or updated ${newer.length} records.`, 'ok');
  }
  async function replaceAll(records, label) {
    await A().snapshot('Before: ' + label);
    const now = Date.now();
    const incoming = new Set(records.map((r) => r.id));
    M.all().forEach((r) => { if (r._c !== 'settings' && !incoming.has(r.id)) A().tombstones[r.id] = now; });
    // restored records become the newest version everywhere
    const recs = records.map((r) => ({ ...r, updatedAt: now }));
    await Store.replaceAll(recs);
    M.load(recs);
    await Store.putVault('tombstones', A().tombstones);
    await A().save(A().activityRec('import', null, label), { silent: true });
    global.Sync && Sync.changed();
    A().render();
    U.toast(label + '.', 'ok');
  }

  async function erase() {
    const signed = global.Sync && Sync.signedIn();
    const r = await U.modal({ title: 'Erase all data', body: `<div class="form"><p class="dialog-text">This deletes every record and the password from this device. It cannot be undone.</p>${signed ? '<label class="check"><input type="checkbox" id="erCloud"/><span>Also erase the cloud copy (every other device will be cleared too)</span></label>' : ''}<label class="field"><span>Type ERASE to confirm</span><input id="erIn" autocomplete="off"/></label></div>`, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Erase', cls: 'btn-danger', value: (b) => (U.$('#erIn', b).value.trim().toUpperCase() === 'ERASE' ? { cloud: U.$('#erCloud', b)?.checked } : undefined) }] });
    if (!r) return;
    if (r.cloud) { try { await Sync.eraseCloud(); } catch (e) { return U.alert('Cloud not erased', U.esc(e.message)); } }
    if (global.Sync) await Sync.signOut();
    await Store.wipe();
    ['lastBackup', 'snoozeBackup'].forEach((k) => A().pref(k, null));
    location.hash = ''; location.reload();
  }

  /* ---------------- security ---------------- */
  async function security(el) {
    const qs = await Store.getQuestions(); const hasKey = await Store.hasRecoveryKey(); const hint = await Store.getHint();
    el.innerHTML = `<section class="card"><div class="card-head"><h2>Change the app password</h2></div>
        <form class="form" id="pwForm" autocomplete="off"><div class="row3"><label class="field"><span>Current password</span><input type="password" name="old" autocomplete="current-password"/></label><label class="field"><span>New password (10+ characters)</span><input type="password" name="n1" autocomplete="new-password"/></label><label class="field"><span>Type the new one again</span><input type="password" name="n2" autocomplete="new-password"/></label></div>
        <p class="lock-error" id="pwErr"></p><div class="btn-row"><button class="btn btn-primary" type="submit">Change password</button></div>
        <p class="small muted">Every record on this device is re-encrypted with the new password.${global.Sync && Sync.signedIn() ? ' The cloud copy is re-locked too; your other devices will ask once for the new password.' : ' Each device has its own copy: change it on every device you use, or turn on cloud sync.'}</p></form></section>
      <section class="card"><div class="card-head"><h2>If the password is forgotten</h2></div>
        <ul class="list"><li><span>Recovery key</span><b>${hasKey ? 'Set up' : 'Not set up'}</b></li><li><span>Security questions</span><b>${qs ? 'Set up' : 'Not set up'}</b></li><li><span>Password hint</span><b>${hint ? U.esc(hint) : 'None'}</b></li></ul>
        <div class="btn-row"><button class="btn" id="secSetup" type="button">${hasKey || qs ? 'Review or change recovery options' : 'Set up recovery'}</button><button class="btn btn-ghost" id="secHint" type="button">Change hint</button></div>
        <p class="small muted">Recovery works only on devices where it was set up. With cloud sync, set it up on each device.</p></section>
      <section class="card"><div class="card-head"><h2>How your records are protected</h2></div>
        <ul class="small"><li>The password is turned into an AES-256 key (PBKDF2-SHA256, ${Store.ITERATIONS.toLocaleString()} rounds). The key lives only in memory while the app is open.</li><li>Every record is encrypted before it is saved on this device. With cloud sync, Firebase receives only the encrypted copy.</li><li>The GitHub repository holds only the program. No records ever go there.</li><li>The app locks itself after ${D.settings.autoLockMin || 'no'} idle minutes, and the padlock button locks it right away.</li></ul></section>`;
    U.$('#pwForm', el).onsubmit = async (e) => {
      e.preventDefault(); const v = U.formValues(e.target); const er = U.$('#pwErr', el);
      if (v.n1.length < 10) { er.textContent = 'The new password needs at least 10 characters.'; return; }
      if (v.n1 !== v.n2) { er.textContent = 'The two new passwords don’t match.'; return; }
      er.textContent = 'Re-encrypting…';
      const ok = await Store.changePassword(v.old, v.n1);
      if (!ok) { er.textContent = 'The current password is not right.'; return; }
      const old = A().password; A().password = v.n1; er.textContent = '';
      e.target.reset();
      global.Sync && Sync.passwordChanged(old, v.n1);
      U.toast('Password changed.', 'ok');
    };
    U.$('#secSetup', el).onclick = async () => { await A().securitySetup(false); A().render(); };
    U.$('#secHint', el).onclick = async () => { const h = await U.prompt('Password hint', 'Hint shown after a wrong password (leave empty for none)', { value: hint }); if (h !== null) { await Store.setHint(h.trim()); A().render(); } };
  }

  /* ---------------- cloud ---------------- */
  function cloud(el) {
    el.innerHTML = `<section class="card"><div class="card-head"><h2>Cloud sync</h2></div>
      <p>Keeps every phone and computer in step within seconds, through your own free Firebase project. Each person signs in once per device with the cloud e-mail and password created for them in Firebase. Records are encrypted with the app password before they leave the device.</p>
      <div id="cloudCard"></div></section>`;
    global.Sync && Sync.render();
  }

  /* ---------------- activity ---------------- */
  function activity(el) {
    const people = [...new Set(D.activity.map((a) => a.who))];
    const sel = A().actWho || '';
    const list = D.activity.filter((a) => !sel || a.who === sel).slice(0, 400);
    el.innerHTML = `<section class="card"><div class="card-head"><h2>History</h2><select id="actWho"><option value="">Everyone</option>${people.map((p) => `<option${p === sel ? ' selected' : ''}>${U.esc(p)}</option>`).join('')}</select></div>
      <p class="small muted">Every change, with who made it. Kept for one year${global.Sync && Sync.signedIn() ? ' and shared between devices' : ''}.</p>
      ${list.length ? `<table class="tbl tbl-tight"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${list.map((a) => `<tr><td class="nowrap">${new Date(a.t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td>${U.esc(a.who)}</td><td>${{ add: 'Added', edit: 'Changed', delete: 'Deleted', bulk: '', import: '' }[a.action] || ''} ${U.esc(a.label)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No changes yet.</p>'}</section>`;
    U.$('#actWho', el).onchange = (e) => { A().actWho = e.target.value; A().render(); };
  }

  /* ---------------- help ---------------- */
  function help(view) {
    const s = (t, b) => `<section class="card help"><h2>${t}</h2>${b}</section>`;
    view.innerHTML = `<div class="page-head"><div><h1>Help</h1><p class="lede">How the app is organized, and the jobs you’ll do most.</p></div></div>
      <div class="help-grid">
      ${s('Every month', `<ol><li><b>Record rent</b> as checks arrive: the <b>Add</b> button → Rent payment, or click a window on the Overview, or a cell in Rent. For a bank deposit with several checks, use <b>Bank deposit</b>: one line per check.</li><li><b>Record expenses</b> from the bank statement: Add → Expense. Choose the category, and set <b>Paid for</b> when the building account paid someone else’s bill.</li><li>Open <b>Needs review</b> and settle anything flagged.</li><li>On <b>Recurring bills</b>, check nothing is overdue.</li><li>Download a <b>backup</b> (Settings → Import &amp; backups).</li></ol>`)}
      ${s('Legal documents and reminders', `<ul><li><b>Legal</b> lists what is due: the <b>lease and rules</b> for a new tenant, the <b>security deposit letter and §83.49</b> within ${(global.Legal ? Legal.cfg() : {}).moveInDays || 5} days of move-in, a <b>three-day notice</b> when rent is unpaid ${(global.Legal ? Legal.cfg() : {}).noticeAfterDays || 3} days after it was due, and an <b>extension of lease</b> ${(global.Legal ? Legal.cfg() : {}).extensionDays || 30} days before each lease anniversary.</li><li><b>Create documents</b> fills in your Word forms from the tenant’s record; check the details, download, print. Then click <b>Mark sent / served / signed</b> so the reminder clears. Marking an extension signed updates the lease end date and the new rent.</li><li>The three-day count never includes the day the notice is posted: it starts the next business day and skips weekends and legal holidays. Enter the real posting date; the app shows the count day by day. If you serve it later than planned, marking it served warns you and downloads a corrected notice. One notice covers every unpaid month. Only rent goes in it, not late fees.</li><li><b>Add → Legal document</b> (or <b>Create a document</b> on the Legal page): choose the tenant and the document, check the details, download the Word file. If a reminder was waiting for that document, it is linked automatically and checked off once you mark it sent, served or signed.</li><li>Reminders appear under the bell at the top. <b>Turn on notifications</b> shows them as phone or computer alerts while the app is open, and <b>Add reminders to my calendar</b> puts them in your calendar so they alert you even when the app is closed.</li><li>Fill in the landlord, attorney and bank details once in Settings → Legal.</li><li><b>Signatures</b> (Settings → Legal): type a name in a handwriting style or upload a photo of a real signature. It is added to the three-day notice (attorney), the security deposit letter (Lessor) and the cover letter (landlord). Leases and extensions are signed by hand in front of witnesses.</li></ul>`)}
      ${s('Rent status colors', '<ul><li><b>Green</b> paid in full · <b>amber</b> partly paid · <b>sand</b> not due yet, or due within the grace days · <b>bougainvillea</b> late · <b>grey</b> vacant · <b>blue-grey</b> no rent due (for example the on-site manager).</li><li>Rent counts toward the month it is <i>for</i> on the rent grid, and toward the month it was <i>received</i> in the income statement.</li></ul>')}
      ${s('Assets, liabilities and equity', '<ul><li><b>Assets</b>: bank accounts (starting balance plus everything recorded since), the building, land and equipment at cost less depreciation.</li><li><b>Liabilities</b>: mortgages and loans, and every tenant’s security deposit (it is the tenant’s money).</li><li><b>Equity</b> is what is left: assets minus liabilities. See Reports → Balance sheet.</li></ul>')}
      ${s('Paid for: building vs others', '<p>The old ledger split payments between TLP, LCDLT, Vivian, Jorge and Mom. The app keeps that: each expense has a <b>Paid for</b>. Only the building’s share is in the income statement and Schedule E; the rest is in Reports → Paid for others, so your accountant can treat it as owner draws or money owed back.</p>')}
      ${s('Transfers', '<p>Some bank lines are not income or expenses: the bank deposit of rent checks (the rent is already recorded per unit), a returned check and its re-deposit, loan principal, owner contributions. Record them as <b>Transfers</b> so the list still matches the bank statement without counting anything twice.</p>')}
      ${s('Taxes', `<ul><li>Reports → <b>Schedule E summary</b> groups the year by the lines of the IRS rental form. Each category’s line is set in Settings → Categories.</li><li>If the building is owned through a partnership, your accountant files Form 8825 instead; the figures are the same.</li><li>Vendors shows who may need a Form 1099-NEC (contractors paid $2,000 or more in 2026; $600 through 2025).</li><li>These are summaries for your accountant, not tax advice.</li></ul>`)}
      ${s('Several people, several devices', '<ul><li>Everyone uses the same <b>app password</b>. Each device also asks for the person’s name so the History shows who did what.</li><li>Turn on <b>Cloud sync</b> (Settings) so all devices share the records. Each person gets their own cloud sign-in from Firebase.</li><li>Install it like an app: on iPhone, Safari → Share → Add to Home Screen; on Android or a computer, Chrome → Install app.</li></ul>')}
      ${s('Keyboard', '<ul><li><kbd>/</kbd> search everything · <kbd>Esc</kbd> close a window · <kbd>Enter</kbd> save a form</li><li>On the rent grid, Tab moves between months and Enter opens one.</li></ul>')}
      ${s('If something goes wrong', '<ul><li>Undo appears right after you delete something.</li><li>Settings → Import &amp; backups → Safety snapshots has a copy from before every import or restore.</li><li>Forgot the password? Use “Forgot password?” on the lock screen with the recovery key or two security answers.</li><li>After updating the app files on GitHub, press Ctrl+Shift+R (⌘+Shift+R on a Mac) once if the page looks out of date.</li></ul>')}
      </div>`;
  }

  Object.assign((global.__pages = global.__pages || {}), { settings: page, help });
  global.Settings = { importWorkbook, backup, restore, replaceAll, mergePlan };
})(window);
