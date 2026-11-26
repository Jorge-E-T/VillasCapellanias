/* =========================================================
   Workbook importer
   Reads the family's "Income & Expense Worksheet" Excel layout:
   - RENTAL BY MONTH: tenant table, security deposits, rent by month,
     monthly/operating/other expense grids, expenses per apartment
   - GENERAL LEDGER: dated credits/debits with the EXPENSES <WHO>
     allocation columns and a notes column
   Works in the browser (window.ExcelJS) and in Node (for testing).
   Nothing is saved here: the app shows a preview first.
   ========================================================= */
(function (global) {
  'use strict';

  const MONTH_RX = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  const MONTH_IDX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function cellVal(cell) {
    let v = cell && cell.value;
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && !(v instanceof Date)) {
      if (v.richText) v = v.richText.map((t) => t.text).join('');
      else if ('result' in v) v = v.result;
      else if (v.text) v = v.text;
      else if (v.hyperlink) v = v.text || v.hyperlink;
      else if (v.error) v = null;
    }
    if (typeof v === 'string') { v = v.trim(); if (v === '') return null; }
    return v === undefined ? null : v;
  }
  const isDate = (v) => v instanceof Date && !isNaN(v);
  /* ExcelJS gives dates as UTC midnight */
  const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const pad2 = (n) => String(n).padStart(2, '0');
  const num = (v) => (typeof v === 'number' ? v : (v && /^[\s$\d,.-]+$/.test(String(v)) ? parseFloat(String(v).replace(/[^0-9.-]/g, '')) : null));
  const r2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
  const phone = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (v ? String(v) : ''); };
  const unitNo = (s) => { const m = /(\d{3,4})/.exec(String(s ?? '')); return m ? m[1] : null; };
  const title = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s/(&-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Fpl|Adt|At&t|Att|Tlp|Lcdlt|Apt|Chk|Ach|Llc|Inc)\b/gi, (m) => m.toUpperCase()).replace(/\bY\b/g, 'y').replace(/\bAnd\b/g, 'and');

  function sheetGrid(ws) {
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => { const arr = []; for (let c = 1; c <= Math.max(ws.columnCount, 22); c++) arr[c] = cellVal(row.getCell(c)); rows[r] = arr; });
    return { rows, at: (r, c) => (rows[r] ? rows[r][c] : null), max: rows.length - 1 };
  }

  /** Map a row label from the expense grids to a category id. */
  function gridCategory(label, M) {
    const s = String(label || '');
    const list = [
      [/health insurance/i, 'ins-health'], [/plumb/i, 'rep-plumb'], [/elevator/i, 'sys-elev'], [/waste/i, 'util-waste'],
      [/auto/i, 'adm-auto'], [/electricity\s*-\s*other/i, 'util-elec2'], [/electric(ity)?\b/i, 'util-elec'], [/at&t.*fire|intercom/i, 'util-lines'],
      [/adt/i, 'sys-alarm'], [/universal fire|fire/i, 'sys-fire'], [/water/i, 'util-water'], [/cel+\s*phone/i, 'adm-phone'],
      [/permit/i, 'tax-permit'], [/smoke/i, 'sys-smoke'], [/bank/i, 'adm-bank'], [/accounting/i, 'adm-acct'], [/landscap/i, 'mnt-land'],
      [/wage|salar/i, 'pay-wages'], [/property tax serv/i, 'tax-svc'], [/real estate tax/i, 'tax-re'], [/^taxes|other taxes/i, 'tax-re'],
      [/insurance/i, 'ins-prop'], [/30 year|40 year/i, 'insp-recert'], [/interest/i, 'int-other'], [/pest/i, 'mnt-pest'],
      [/equipment/i, 'cap-equip'], [/paint/i, 'rep-paint'], [/a\/c/i, 'rep-ac'], [/electrical/i, 'rep-elec'], [/applian/i, 'rep-appl'],
      [/contractor/i, 'rep-contr']
    ];
    for (const [re, id] of list) if (re.test(s)) return id;
    return M.categorize(s).category;
  }

  function parse(wb, opts) {
    const { M, uid } = opts;
    const settings = opts.settings;
    const out = { year: null, units: [], tenants: [], payments: [], deposits: [], txns: [], vendors: [], accounts: [], entities: [], warnings: [], notes: [], skippedGrid: 0, stats: {} };
    const now = Date.now();
    const base = (c, extra) => ({ id: uid(), _c: c, createdAt: now, updatedAt: now, source: 'workbook', ...extra });

    const sheets = wb.worksheets.map((ws) => ({ ws, g: sheetGrid(ws) }));
    const rentSheet = sheets.find((s) => s.g.rows.some((r) => r && /^unit\s*#?$/i.test(String(r[1] || ''))));
    const ledgerSheet = sheets.find((s) => s.g.rows.some((r) => r && r.some((v) => /^credit$/i.test(String(v || ''))) && r.some((v) => /^debit$/i.test(String(v || '')))));
    if (!rentSheet && !ledgerSheet) throw new Error('This workbook does not have the expected layout: no "Unit #" tenant table and no CREDIT / DEBIT ledger were found.');

    /* ---------- year ---------- */
    const yearCount = {};
    if (rentSheet) rentSheet.g.rows.forEach((r) => r && r.forEach((v) => { if (isDate(v)) { const y = v.getUTCFullYear(); yearCount[y] = (yearCount[y] || 0) + 1; } }));
    if (ledgerSheet) ledgerSheet.g.rows.forEach((r) => { if (r && isDate(r[1])) { const y = r[1].getUTCFullYear(); yearCount[y] = (yearCount[y] || 0) + 3; } });
    out.year = +Object.entries(yearCount).sort((a, b) => b[1] - a[1])[0]?.[0] || new Date().getFullYear();

    /* ---------- units & tenants ---------- */
    const unitByNo = {};
    const tenantByUnit = {};
    if (rentSheet) {
      const g = rentSheet.g;
      const h = g.rows.findIndex((r) => r && /^unit\s*#?$/i.test(String(r[1] || '')));
      const hdr = g.rows[h];
      const col = (rx, dflt) => { const i = hdr.findIndex((v) => v && rx.test(String(v))); return i > 0 ? i : dflt; };
      const cName = col(/tenant/i, 2), cRent = col(/rent/i, 5), cDue = col(/payment date|due/i, 6), cPhone = col(/phone/i, 8), cMove = col(/move/i, 10), cSize = col(/size/i, 12);
      for (let r = h + 1; r <= g.max; r++) {
        const row = g.rows[r]; if (!row) break;
        const no = unitNo(row[1]);
        if (!no) { if (row.slice(1, 13).every((v) => v === null)) break; continue; }
        const size = String(row[cSize] || '');
        const sm = /(\d+)\s*bed[^0-9]*(\d+(?:\.\d)?)\s*bath/i.exec(size);
        const unit = base('units', { number: no, floor: +no[0], beds: sm ? +sm[1] : null, baths: sm ? +sm[2] : null, size, sqft: null, notes: '' });
        out.units.push(unit); unitByNo[no] = unit;
        let name = null; for (let c = cName; c < cRent; c++) if (row[c] && typeof row[c] === 'string') { name = row[c]; break; }
        const rent = num(row[cRent]) || 0;
        const dueDay = parseInt(String(row[cDue] || '1'), 10) || 1;
        const phones = [row[cPhone], row[cPhone + 1]].filter((v) => v !== null && v !== undefined && /\d{7,}/.test(String(v).replace(/\D/g, ''))).map(phone);
        const contact = [row[18], row[19]].filter(Boolean).join(' ');
        if (name) {
          const t = base('tenants', {
            unitId: unit.id, name: title(name), phone: phones[0] || '', phone2: phones[1] || '', email: '',
            moveIn: isDate(row[cMove]) ? iso(row[cMove]) : '', moveOut: '', rent, dueDay, exempt: rent === 0,
            otherContact: contact ? title(contact).replace(/(\d{3})-(\d{3})-(\d{4})/, '($1) $2-$3') : '',
            leaseEnd: '', notes: rent === 0 ? 'No rent recorded in the workbook.' : ''
          });
          out.tenants.push(t); tenantByUnit[no] = t;
        }
      }

      /* ---------- blocks: deposits and rent ---------- */
      const groupCols = [2, 5, 8, 11, 14];
      for (let r = 1; r <= g.max; r++) {
        const a = String(g.at(r, 1) || '');
        if (/^security deposits?/i.test(a)) {
          const labels = groupCols.map((c) => unitNo(g.at(r, c)));
          let rr = r + 1; while (rr <= r + 4 && !/deposit received/i.test(String(g.at(rr, 1) || ''))) rr++;
          if (!/deposit received/i.test(String(g.at(rr, 1) || ''))) continue;
          groupCols.forEach((c, i) => {
            const no = labels[i]; if (!no) return;
            const amt = num(g.at(rr, c + 1)); if (!amt) return;
            const d = g.at(rr, c);
            const t = tenantByUnit[no]; const u = unitByNo[no];
            if (!u) { out.warnings.push(`Security deposit for unit ${no} skipped: that unit is not in the tenant table.`); return; }
            out.deposits.push(base('deposits', { unitId: u.id, tenantId: t ? t.id : '', date: isDate(d) ? iso(d) : '', amount: r2(amt), returnedDate: '', returnedAmount: null, deductions: '', notes: isDate(d) ? '' : 'Date received not recorded in the workbook.' }));
          });
        }
        if (/^rental income/i.test(a)) {
          const labels = groupCols.map((c) => unitNo(g.at(r, c)));
          for (let rr = r + 1; rr <= Math.min(g.max, r + 16); rr++) {
            const lab = String(g.at(rr, 1) || '');
            if (/^total/i.test(lab)) break;
            const mm = MONTH_RX.exec(lab); if (!mm) continue;
            const month = MONTH_IDX[mm[1].toLowerCase()];
            const note = [g.at(rr, 18)].filter((v) => typeof v === 'string').join(' ');
            if (note) out.notes.push(`${lab.replace('.', '')} ${out.year}: ${note}`);
            groupCols.forEach((c, i) => {
              const no = labels[i]; if (!no || !unitByNo[no]) return;
              const amt = num(g.at(rr, c + 1)); if (!amt) return;
              const d = g.at(rr, c); const chk = g.at(rr, c + 2);
              const y = isDate(d) ? d.getUTCFullYear() : out.year;
              const forMonth = `${y}-${pad2(month)}`;
              const method = chk === null ? 'Check' : /cashier/i.test(String(chk)) ? 'Cashier’s check' : /cash/i.test(String(chk)) ? 'Cash' : /money/i.test(String(chk)) ? 'Money order' : /zelle/i.test(String(chk)) ? 'Zelle' : 'Check';
              out.payments.push(base('payments', {
                unitId: unitByNo[no].id, tenantId: '', date: isDate(d) ? iso(d) : `${forMonth}-01`, forMonth, amount: r2(amt), method,
                checkNo: typeof chk === 'number' ? String(chk) : (chk && !/cashier|cash|money|zelle/i.test(String(chk)) ? String(chk) : ''), notes: ''
              }));
            });
          }
        }
      }
      /* tenants who moved in after some recorded payments: those payments belong to the tenant before */
      for (const no of Object.keys(unitByNo)) {
        const u = unitByNo[no]; const t = tenantByUnit[no];
        const pays = out.payments.filter((p) => p.unitId === u.id).sort((a, b) => a.forMonth.localeCompare(b.forMonth));
        const early = t && t.moveIn ? pays.filter((p) => p.forMonth < t.moveIn.slice(0, 7)) : [];
        if (early.length) {
          const amts = {}; early.forEach((p) => { amts[p.amount] = (amts[p.amount] || 0) + 1; });
          const rent = +Object.entries(amts).sort((a, b) => b[1] - a[1])[0][0];
          const lastK = early[early.length - 1].forMonth;
          const [yy, mm] = lastK.split('-').map(Number);
          const former = base('tenants', { unitId: u.id, name: `Former tenant — unit ${no}`, phone: '', phone2: '', email: '', moveIn: '', moveOut: `${lastK}-${pad2(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`, rent, dueDay: 1, exempt: false, otherContact: '', leaseEnd: '', notes: 'Created by the import: rent was received before the current tenant moved in. Add the name if you know it.' });
          out.tenants.push(former);
          early.forEach((p) => { p.tenantId = former.id; });
          out.warnings.push(`Unit ${no}: ${early.length} payment(s) before ${t.name} moved in (${t.moveIn}) were assigned to a "Former tenant" record. Rename it if you know who it was.`);
        }
        pays.forEach((p) => { if (!p.tenantId && t) p.tenantId = t.id; const tt = out.tenants.find((x) => x.id === p.tenantId); if (tt && tt.rent && Math.abs(p.amount - tt.rent) > 0.005) p.notes = `Amount differs from the monthly rent of $${tt.rent.toLocaleString('en-US')}.`; });
      }

      /* ---------- expense grids (only used when there is no ledger sheet, to avoid counting twice) ---------- */
      const gridTxns = [];
      for (let r = 1; r <= g.max; r++) {
        const a = String(g.at(r, 1) || '');
        if (/^(monthly|operating) expenses/i.test(a) && MONTH_RX.test(String(g.at(r, 2) || ''))) {
          for (let rr = r + 1; rr <= g.max; rr++) {
            const lab = g.at(rr, 1);
            if (!lab || /^total/i.test(String(lab))) break;
            for (let m = 1; m <= 12; m++) {
              const v = num(g.at(rr, m + 1)); if (!v) continue;
              gridTxns.push({ date: `${out.year}-${pad2(m)}-01`, amount: r2(v), description: `${lab} (from the ${a.toLowerCase()} grid)`, category: gridCategory(lab, M) });
            }
          }
        }
        if (/^other expenses/i.test(a)) {
          for (let rr = r + 2; rr <= g.max; rr++) {
            const lab = g.at(rr, 1);
            if (/^total/i.test(String(lab || ''))) break;
            if (!lab) continue;
            for (const c of groupCols) {
              const v = num(g.at(rr, c + 1)); if (!v) continue;
              const d = g.at(rr, c);
              gridTxns.push({ date: isDate(d) ? iso(d) : `${out.year}-01-01`, amount: r2(v), description: [lab, g.at(rr, c + 2)].filter(Boolean).join(' — '), category: gridCategory(lab, M) });
            }
          }
        }
      }
      if (!ledgerSheet) gridTxns.forEach((x) => out.txns.push(base('txns', { type: 'expense', entity: 'bldg', vendorId: '', unitId: '', method: '', ref: '', review: false, reviewNote: '', ...x })));
      else out.skippedGrid = gridTxns.length;

      /* per-apartment expenses (allocations of ledger lines) */
      const perApt = [];
      const hp = g.rows.findIndex((row) => row && /expenses per apartment/i.test(String(row[1] || '')));
      if (hp > 0) {
        for (let rr = hp + 1; rr <= g.max; rr++) {
          const a = g.at(rr, 1);
          if (typeof a === 'string' && !unitNo(a)) { if (/^\*|explanation/i.test(a)) break; continue; }
          const no = unitNo(a); if (!no) continue;
          const amt = num(g.at(rr, 3)); if (!amt) continue;
          const d = g.at(rr, 2);
          perApt.push({ no, date: isDate(d) ? iso(d) : '', amount: r2(amt), desc: String(g.at(rr, 4) || '') });
        }
      }
      out._perApt = perApt;
    }

    /* ---------- general ledger ---------- */
    const vendorByName = {};
    const vendorFor = (name) => {
      if (!name) return '';
      const k = name.toLowerCase();
      if (!vendorByName[k]) { const v = base('vendors', { name, category: '', phone: '', email: '', account: '', notes: '' }); vendorByName[k] = v; out.vendors.push(v); }
      return vendorByName[k].id;
    };
    const entityFor = (short) => {
      const s = String(short || '').trim(); if (!s) return 'bldg';
      const e = settings.entities.find((x) => x.short.toLowerCase() === s.toLowerCase() || x.name.toLowerCase() === s.toLowerCase());
      if (e) return e.id;
      let ne = out.entities.find((x) => x.short.toLowerCase() === s.toLowerCase());
      if (!ne) { ne = { id: 'ent-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: title(s), short: s }; out.entities.push(ne); }
      return ne.id;
    };
    const accounts = {};
    const accountFor = (label) => {
      if (!label) return '';
      if (!accounts[label]) { const m = /ended?\s*(\d{4})/i.exec(label); const a = base('accounts', { name: m ? `Account ending ${m[1]}` : title(label), institution: '', last4: m ? m[1] : '', kind: 'Checking', openingBalance: null, openingDate: '', primary: false, notes: `From the ledger section “${title(label)}”.` }); accounts[label] = a; out.accounts.push(a); }
      return accounts[label].id;
    };
    const RENT_RX = /\bAPT\.?\s*\d|APARTMENT|\bCHK\s*\d|\bCK\s*\d|\bRENT\b|ADENAJ|ADEMAJ/i;

    if (ledgerSheet) {
      const g = ledgerSheet.g;
      const h = g.rows.findIndex((r) => r && r.some((v) => /^credit$/i.test(String(v || ''))) && r.some((v) => /^debit$/i.test(String(v || ''))));
      const hdr = g.rows[h];
      const cCredit = hdr.findIndex((v) => /^credit$/i.test(String(v || '')));
      const cDebit = hdr.findIndex((v) => /^debit$/i.test(String(v || '')));
      const cExpl = hdr.findIndex((v) => /explanation|description|memo/i.test(String(v || '')));
      const ents = []; hdr.forEach((v, i) => { const m = /^expenses?\s+(.+)$/i.exec(String(v || '')); if (m) ents.push({ col: i, id: entityFor(m[1]) }); });
      const cNote = (ents.length ? Math.max(...ents.map((e) => e.col)) : Math.max(cExpl, cDebit)) + 1;

      let section = '';
      let parent = null; // last debit row, for split lines that follow it
      const groups = [];  // { row data, splits: [] }
      for (let r = h + 1; r <= g.max; r++) {
        const row = g.rows[r]; if (!row) continue;
        const a = row[1];
        const credit = num(row[cCredit]), debit = num(row[cDebit]);
        const expl = row[cExpl] ? String(row[cExpl]) : '';
        const note = row[cNote] ? String(row[cNote]) : '';
        const alloc = ents.map((e) => ({ entity: e.id, amount: num(row[e.col]) })).filter((x) => x.amount);
        if (typeof a === 'string' && /^(grand\s+)?totals?\b/i.test(a)) { parent = null; continue; }
        if (typeof a === 'string' && !credit && !debit) { section = a; parent = null; continue; }
        if (!isDate(a)) {
          if (!credit && !debit && alloc.length && parent) { parent.splits.push({ expl: expl || parent.expl, alloc, note }); continue; }
          if (!credit && !debit) continue;
        }
        const date = isDate(a) ? iso(a) : (parent ? parent.date : `${out.year}-01-01`);
        const rec = { r, date, credit, debit, expl, note, alloc, section, splits: [] };
        groups.push(rec);
        if (debit) parent = rec; else parent = null;
      }

      const mk = (extra) => base('txns', { notes: '', vendorId: '', unitId: '', method: '', ref: '', review: false, reviewNote: '', entity: 'bldg', accountId: '', ...extra });
      for (const G of groups) {
        const acct = /account|acct|ended/i.test(G.section) ? accountFor(G.section) : '';
        const sectionNote = G.section && !acct ? `Ledger section: ${title(G.section)}. ` : '';
        const unsure = /\?|not sure|what is|wonder|don.?t know|imagine|check and see|why do/i;
        /* credits */
        if (G.credit) {
          if (RENT_RX.test(G.expl)) {
            out.txns.push(mk({ type: 'transfer', direction: 'in', category: /redeposit/i.test(G.expl) ? 'tr-return' : 'tr-rentdep', date: G.date, amount: r2(G.credit), description: G.expl, accountId: acct, reviewNote: 'Bank deposit of rent checks. The rent itself is recorded per unit under Rent, so this line is not counted again as income.' }));
          } else {
            const cat = /return|overpay|refund|credit/i.test(G.expl) ? 'inc-refund' : /miami dade|county/i.test(G.expl) ? 'inc-county' : 'inc-other';
            const rev = /cash deposit/i.test(G.expl);
            out.txns.push(mk({ type: 'income', category: cat, date: G.date, amount: r2(G.credit), description: G.expl, accountId: acct, review: rev || !!G.note, reviewNote: rev ? 'Cash deposit: is this rent from a tenant, or other income? If it is rent, delete this line and record it under Rent.' : G.note }));
          }
        }
        /* debits */
        if (G.debit) {
          if (G.credit && RENT_RX.test(G.expl)) {
            out.txns.push(mk({ type: 'expense', category: 'oth-unclass', date: G.date, amount: r2(G.debit), description: G.expl, accountId: acct, review: true, reviewNote: `The ledger shows a $${G.debit.toLocaleString('en-US')} debit on the same line as this rent deposit. Check the bank statement for what it was.` }));
            continue;
          }
          if (/return(ed)? deposit|returned check|nsf/i.test(G.expl)) {
            out.txns.push(mk({ type: 'transfer', direction: 'out', category: 'tr-return', date: G.date, amount: r2(G.debit), description: G.expl, accountId: acct, reviewNote: 'A tenant’s check was returned by the bank. If it was later re-deposited, the two lines cancel out.' }));
            continue;
          }
          const parts = [...G.alloc.map((x) => ({ ...x, expl: G.expl })), ...G.splits.flatMap((s) => s.alloc.map((x) => ({ ...x, expl: s.expl, note: s.note })))];
          const allocated = r2(parts.reduce((t, p) => t + p.amount, 0));
          const remainder = r2(G.debit - allocated);
          const baseReview = [G.note, sectionNote].filter(Boolean).join(' ');
          if (!parts.length) {
            const { category, vendor } = M.categorize(G.expl);
            out.txns.push(mk({ type: 'expense', category, vendorId: vendorFor(vendor), date: G.date, amount: r2(G.debit), description: G.expl, accountId: acct, review: true, reviewNote: (baseReview ? baseReview + ' ' : '') + 'Not assigned to anyone in the ledger (no amount in the EXPENSES columns). Set “Paid for” if this was not a building expense.' }));
            continue;
          }
          parts.forEach((p, i) => {
            const many = parts.length > 1;
            const rawNote = p.note || (i === 0 ? G.note : '');
            const noteIsQ = unsure.test(rawNote);
            /* a line listing several amounts in brackets, e.g. "WATER HEATER(840.08), T-MOBILE (197.32)", is split when they add up */
            const pieces = [];
            const rx = /([^,()]*?)\(\$?([\d,]+(?:\.\d+)?)\)/g; let m;
            while ((m = rx.exec(p.expl))) pieces.push({ text: m[1].replace(/^[\s.,-]+|[\s.,-]+$/g, ''), amount: r2(parseFloat(m[2].replace(/,/g, ''))) });
            const canSplit = pieces.length > 1 && Math.abs(pieces.reduce((t, x) => t + x.amount, 0) - p.amount) < 0.01;
            const prefix = (/^([^-]+?)\s+-\s+/.exec(p.expl) || [])[1] || '';
            const list = canSplit ? pieces.map((x) => ({ text: x.text, amount: x.amount })) : [{ text: '', amount: p.amount }];
            list.forEach((piece, k) => {
              const desc = canSplit ? `${prefix && !piece.text.toUpperCase().startsWith(prefix.toUpperCase()) ? prefix + ' - ' : ''}${piece.text}`.trim() : p.expl;
              let { category, vendor } = M.categorize(canSplit ? piece.text : p.expl);
              if (canSplit && category === 'oth-unclass') ({ category, vendor } = M.categorize(p.expl));
              const fromWhole = M.categorize(p.expl).vendor;
              const um = /APT\.?\s*(\d{3})/i.exec(canSplit ? piece.text : '');
              const noteTxt = [noteIsQ ? rawNote : '', sectionNote].filter(Boolean).join(' ');
              out.txns.push(mk({
                type: 'expense', category, vendorId: vendorFor(vendor || fromWhole), date: G.date, amount: r2(piece.amount), description: desc, entity: p.entity, accountId: acct,
                unitId: um && unitByNo[um[1]] ? unitByNo[um[1]].id : '',
                notes: noteIsQ ? '' : title(rawNote),
                ref: (many || canSplit) ? `Part of a $${G.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })} payment on ${G.date}` : '',
                review: !!noteTxt || unsure.test(p.expl) || category === 'oth-unclass' || category === 'oth-card',
                reviewNote: [noteTxt, unsure.test(p.expl) ? 'The description says it is not certain what this was.' : '', category === 'oth-card' ? 'Credit card payment: itemize the statement if the purchases were building expenses.' : ''].filter(Boolean).join(' ')
              }));
              void k;
            });
          });
          if (Math.abs(remainder) >= 0.01) {
            const ent = parts.length && parts.every((p) => p.entity === parts[0].entity) ? parts[0].entity : 'bldg';
            const { category, vendor } = M.categorize(G.expl);
            out.txns.push(mk({ type: 'expense', category, vendorId: vendorFor(vendor), date: G.date, amount: remainder, description: G.expl + ' (unassigned part)', entity: ent, accountId: acct, review: true, reviewNote: `The ledger shows $${G.debit.toLocaleString('en-US')} paid but only $${allocated.toLocaleString('en-US')} assigned in the EXPENSES columns. The other $${remainder.toLocaleString('en-US')} was given the same “Paid for” — it may belong to the previous year.` }));
          }
        }
      }
    }

    /* ---------- per-apartment allocations: split matching ledger lines by unit ---------- */
    const perApt = out._perApt || []; delete out._perApt;
    if (perApt.length) {
      const byDate = {}; perApt.forEach((p) => { (byDate[p.date] = byDate[p.date] || []).push(p); });
      const used = new Set();
      for (const [d, list] of Object.entries(byDate)) {
        const total = r2(list.reduce((t, p) => t + p.amount, 0));
        const cand = out.txns.filter((x) => x.type === 'expense' && !used.has(x.id) && Math.abs(x.amount - total) < 0.01 && (!d || Math.abs((Date.parse(x.date) - Date.parse(d)) / 864e5) <= 14) && (!/jda/i.test(list[0].desc) || /jorge del amo/i.test(x.description)));
        if (cand.length) {
          const x = cand[0]; used.add(x.id);
          const idx = out.txns.indexOf(x);
          const pieces = list.map((p) => ({ ...x, id: uid(), amount: p.amount, unitId: unitByNo[p.no] ? unitByNo[p.no].id : '', description: `${x.description} — unit ${p.no}${p.desc ? ': ' + p.desc.replace(/^JDA\s*-?\s*/i, '') : ''}`, ref: list.length > 1 ? `Part of a $${x.amount.toLocaleString('en-US')} payment on ${x.date}` : x.ref, review: x.review || /not sure/i.test(p.desc), reviewNote: [x.reviewNote, /not sure/i.test(p.desc) ? 'The workbook says: ' + p.desc : ''].filter(Boolean).join(' ') }));
          out.txns.splice(idx, 1, ...pieces);
          list.forEach((p) => { p.matched = true; });
        }
      }
      perApt.filter((p) => !p.matched).forEach((p) => {
        const u = unitByNo[p.no];
        const x = out.txns.find((t) => t.type === 'expense' && !used.has(t.id) && Math.abs(t.amount - p.amount) < 0.01 && (!t.unitId || (u && t.unitId === u.id)) && (!p.date || Math.abs((Date.parse(t.date) - Date.parse(p.date)) / 864e5) <= 14));
        if (x) { used.add(x.id); p.matched = true; if (u) x.unitId = u.id; if (p.desc && !/^jda$/i.test(p.desc.trim())) x.notes = [x.notes, p.desc].filter(Boolean).join(' · '); }
      });
      perApt.filter((p) => !p.matched).forEach((p) => {
        out.txns.push(base('txns', { type: 'expense', category: M.categorize(p.desc).category === 'oth-unclass' ? 'rep-contr' : M.categorize(p.desc).category, date: p.date || `${out.year}-01-01`, amount: p.amount, description: `${p.desc} — unit ${p.no}`, unitId: unitByNo[p.no] ? unitByNo[p.no].id : '', entity: 'bldg', vendorId: '', method: '', ref: '', accountId: '', review: true, reviewNote: 'From “Expenses per apartment”. No matching ledger line was found, so check it isn’t counted twice.' }));
      });
      out.stats.perAptMatched = perApt.filter((p) => p.matched).length;
      out.stats.perAptUnmatched = perApt.filter((p) => !p.matched).length;
    }

    /* tag vendors with the most common category of their lines */
    out.vendors.forEach((v) => { const cats = {}; out.txns.filter((x) => x.vendorId === v.id).forEach((x) => { cats[x.category] = (cats[x.category] || 0) + 1; }); v.category = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || ''; });
    out.txns.forEach((x) => { x.importKey = [x.date, x.type, x.amount, String(x.description).toLowerCase().slice(0, 60), x.unitId ? 'u' : ''].join('|'); });
    out.payments.forEach((p) => { const u = out.units.find((x) => x.id === p.unitId); p.importKey = [u ? u.number : '', p.forMonth, p.amount, p.date].join('|'); });
    out.stats.rent = r2(out.payments.reduce((t, p) => t + p.amount, 0));
    out.stats.expenses = r2(out.txns.filter((x) => x.type === 'expense').reduce((t, x) => t + x.amount, 0));
    out.stats.income = r2(out.txns.filter((x) => x.type === 'income').reduce((t, x) => t + x.amount, 0));
    out.stats.review = out.txns.filter((x) => x.review).length;
    return out;
  }

  global.Importer = { parse, cellVal };
  if (typeof module !== 'undefined') module.exports = global.Importer;
})(typeof window !== 'undefined' ? window : globalThis);
