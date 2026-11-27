/* =========================================================
   Data model and calculations
   Every record: { id, _c (collection), ..., updatedAt, updatedBy }
   Collections: units, tenants, payments, txns, deposits, assets,
   liabilities, vendors, bills, accounts, files, activity, settings
   ========================================================= */
(function (global) {
  'use strict';
  const U = global.U;

  const COLLECTIONS = ['units', 'tenants', 'payments', 'txns', 'deposits', 'assets', 'liabilities', 'vendors', 'bills', 'accounts', 'files', 'activity', 'legal'];

  /* Schedule E (Form 1040), Part I lines used for rental real estate */
  const SCHED_E = {
    3: 'Rents received', 5: 'Advertising', 6: 'Auto and travel', 7: 'Cleaning and maintenance', 8: 'Commissions',
    9: 'Insurance', 10: 'Legal and other professional fees', 11: 'Management fees', 12: 'Mortgage interest paid to banks',
    13: 'Other interest', 14: 'Repairs', 15: 'Supplies', 16: 'Taxes', 17: 'Utilities', 18: 'Depreciation', 19: 'Other',
    none: 'Not a rental expense (personal)', capital: 'Capital item (add as an asset, depreciate)'
  };

  const c = (id, name, group, schedE, extra) => ({ id, name, group, type: 'expense', schedE, budget: null, ...(extra || {}) });
  const ci = (id, name, schedE) => ({ id, name, group: 'Income', type: 'income', schedE, budget: null });
  const DEFAULT_CATEGORIES = [
    ci('inc-late', 'Late fees', 3), ci('inc-reimb', 'Tenant reimbursements', 3), ci('inc-county', 'County refunds & credits', 3),
    ci('inc-refund', 'Vendor refunds & credits', 3), ci('inc-interest', 'Interest income', 19), ci('inc-other', 'Other income', 3),
    c('util-elec', 'Electricity — common areas', 'Utilities', 17), c('util-elec2', 'Electricity — other meters', 'Utilities', 17),
    c('util-water', 'Water & sewer', 'Utilities', 17), c('util-waste', 'Waste management', 'Utilities', 17),
    c('util-net', 'Internet & cable', 'Utilities', 17), c('util-lines', 'Phone lines — fire panel & intercom', 'Utilities', 17),
    c('sys-elev', 'Elevator service & monitoring', 'Building systems', 7), c('sys-fire', 'Fire alarm & safety', 'Building systems', 7),
    c('sys-alarm', 'Alarm monitoring', 'Building systems', 7), c('sys-smoke', 'Smoke detectors', 'Building systems', 15),
    c('rep-plumb', 'Plumbing', 'Repairs & maintenance', 14), c('rep-ac', 'A/C', 'Repairs & maintenance', 14),
    c('rep-elec', 'Electrical', 'Repairs & maintenance', 14), c('rep-appl', 'Appliances', 'Repairs & maintenance', 14),
    c('rep-paint', 'Painting', 'Repairs & maintenance', 14), c('rep-contr', 'Handyman & outside contractors', 'Repairs & maintenance', 14),
    c('rep-roof', 'Roofing', 'Repairs & maintenance', 14), c('rep-other', 'Locks & other repairs', 'Repairs & maintenance', 14),
    c('mnt-pest', 'Pest control', 'Repairs & maintenance', 7), c('mnt-land', 'Landscaping', 'Repairs & maintenance', 7),
    c('mnt-clean', 'Cleaning & janitorial', 'Repairs & maintenance', 7),
    c('adm-acct', 'Accounting fees', 'Professional & admin', 10), c('adm-legal', 'Legal & professional fees', 'Professional & admin', 10),
    c('adm-mgmt', 'Management fees', 'Professional & admin', 11), c('adm-bank', 'Bank service charges', 'Professional & admin', 19),
    c('adm-phone', 'Cell phones', 'Professional & admin', 19), c('adm-supply', 'Office & supplies', 'Professional & admin', 15),
    c('adm-ads', 'Advertising & tenant screening', 'Professional & admin', 5), c('adm-auto', 'Auto & travel', 'Professional & admin', 6),
    c('ins-prop', 'Property insurance', 'Insurance', 9), c('ins-health', 'Health insurance', 'Insurance', 'none'),
    c('ins-life', 'Life & disability insurance', 'Insurance', 'none'),
    c('tax-re', 'Real estate taxes', 'Taxes & licenses', 16), c('tax-dor', 'Florida Dept. of Revenue', 'Taxes & licenses', 16),
    c('tax-svc', 'Property tax appeal services', 'Taxes & licenses', 10), c('tax-permit', 'Permits, licenses & business tax', 'Taxes & licenses', 16),
    c('insp-recert', '30/40-year recertification', 'Inspections', 10), c('pay-wages', 'Wages & salaries', 'Payroll', 19),
    c('int-mort', 'Mortgage interest', 'Financing', 12), c('int-other', 'Other interest', 'Financing', 13),
    c('cap-equip', 'Equipment & improvements (capital)', 'Capital', 'capital'),
    c('oth-card', 'Credit card payment (not itemized)', 'Other', 19), c('oth-other', 'Other expenses', 'Other', 19),
    c('oth-unclass', 'Unclassified', 'Other', 19)
  ];
  const TRANSFER_CATS = [
    { id: 'tr-rentdep', name: 'Rent deposited to bank' }, { id: 'tr-return', name: 'Returned / bounced check' },
    { id: 'tr-deposit', name: 'Security deposit movement' }, { id: 'tr-loan', name: 'Loan principal payment' },
    { id: 'tr-owner', name: 'Owner contribution / draw' }, { id: 'tr-move', name: 'Move between accounts' }
  ];

  const DEFAULT_SETTINGS = () => ({
    id: 'settings', _c: 'settings',
    propertyName: 'Villas Capellanias',
    legalName: 'Torres Limited',
    address: '15 Phoenetia Avenue',
    city: 'Coral Gables, FL',
    phone: '', email: '',
    yearBuilt: '', unitsLabel: '15 residential units',
    graceDays: 5,
    lateFee: 0,
    autoLockMin: 15,
    backupDays: 14,
    categories: U.clone(DEFAULT_CATEGORIES),
    entities: [
      { id: 'bldg', name: 'Villas Capellanias (Torres Limited)', short: 'TLP', building: true },
      { id: 'lcdlt', name: 'La Casa de los Trucos', short: 'LCDLT' },
      { id: 'vivian', name: 'Vivian', short: 'Vivian' },
      { id: 'jorge', name: 'Jorge', short: 'Jorge' },
      { id: 'mom', name: 'Mom', short: 'Mom' }
    ],
    methods: ['Check', 'Cashier’s check', 'Money order', 'Cash', 'ACH / bank transfer', 'Zelle', 'Debit card', 'Credit card', 'Auto-debit'],
    createdAt: Date.now()
  });

  /* ---------- in-memory data ---------- */
  const D = { settings: DEFAULT_SETTINGS() };
  COLLECTIONS.forEach((k) => { D[k] = []; });
  const byId = new Map();

  const M = {
    COLLECTIONS, SCHED_E, DEFAULT_CATEGORIES, TRANSFER_CATS, DEFAULT_SETTINGS, D, byId,

    load(records) {
      COLLECTIONS.forEach((k) => { D[k] = []; });
      byId.clear();
      let settings = null;
      for (const r of records) {
        if (r._c === 'settings') { settings = r; continue; }
        if (!D[r._c]) continue;
        D[r._c].push(r); byId.set(r.id, r);
      }
      D.settings = M.upgradeSettings(settings || DEFAULT_SETTINGS());
      M.sortAll();
    },
    upgradeSettings(s) {
      const d = DEFAULT_SETTINGS();
      for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      const have = new Set(s.categories.map((x) => x.id));
      DEFAULT_CATEGORIES.forEach((x) => { if (!have.has(x.id)) s.categories.push(U.clone(x)); });
      return s;
    },
    sortAll() {
      D.units.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
      ['payments', 'txns', 'deposits'].forEach((k) => D[k].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)));
      D.activity.sort((a, b) => b.t - a.t);
    },
    all() { return [D.settings, ...COLLECTIONS.flatMap((k) => D[k])]; },
    get: (id) => byId.get(id) || null,
    upsert(rec) {
      if (rec._c === 'settings') { D.settings = rec; return; }
      const list = D[rec._c];
      const i = list.findIndex((x) => x.id === rec.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      byId.set(rec.id, rec);
    },
    remove(id) {
      const r = byId.get(id); if (!r) return;
      const list = D[r._c]; const i = list.indexOf(r); if (i >= 0) list.splice(i, 1);
      byId.delete(id);
    },

    /* ---------- lookups ---------- */
    cat: (id) => D.settings.categories.find((x) => x.id === id) || TRANSFER_CATS.find((x) => x.id === id) || null,
    catName: (id) => (M.cat(id) || {}).name || (id ? 'Unknown category' : 'Uncategorized'),
    expenseCats: () => D.settings.categories.filter((x) => x.type === 'expense' && !x.hidden),
    incomeCats: () => D.settings.categories.filter((x) => x.type === 'income' && !x.hidden),
    groups: () => [...new Set(M.expenseCats().map((x) => x.group))],
    entity: (id) => D.settings.entities.find((x) => x.id === id) || D.settings.entities.find((x) => x.building),
    buildingEntity: () => D.settings.entities.find((x) => x.building) || D.settings.entities[0],
    isBuilding: (txn) => !txn.entity || (M.entity(txn.entity) || {}).building,
    unit: (id) => D.units.find((u) => u.id === id) || null,
    unitLabel: (id) => { const u = M.unit(id); return u ? 'Unit ' + u.number : ''; },
    vendor: (id) => D.vendors.find((v) => v.id === id) || null,
    account: (id) => D.accounts.find((a) => a.id === id) || null,
    primaryAccount: () => D.accounts.find((a) => a.primary) || D.accounts[0] || null,
    tenant: (id) => D.tenants.find((t) => t.id === id) || null,

    /* ---------- tenants & rent ---------- */
    tenantActiveIn(t, monthKey) {
      const start = monthKey + '-01', end = U.monthEnd(monthKey);
      if (t.moveIn && t.moveIn > end) return false;
      if (t.moveOut && t.moveOut < start) return false;
      return true;
    },
    tenantsOf: (unitId) => D.tenants.filter((t) => t.unitId === unitId).sort((a, b) => (b.moveIn || '0000').localeCompare(a.moveIn || '0000')),
    currentTenant(unitId, iso) {
      iso = iso || U.todayISO();
      const list = M.tenantsOf(unitId).filter((t) => (!t.moveIn || t.moveIn <= iso) && (!t.moveOut || t.moveOut >= iso));
      return list[0] || null;
    },
    upcomingTenant(unitId, iso) { iso = iso || U.todayISO(); return M.tenantsOf(unitId).find((t) => t.moveIn && t.moveIn > iso) || null; },
    tenantForMonth(unitId, monthKey) { return M.tenantsOf(unitId).find((t) => M.tenantActiveIn(t, monthKey)) || null; },
    paymentsFor: (unitId, monthKey) => D.payments.filter((p) => p.unitId === unitId && p.forMonth === monthKey),
    /** Rent status of one unit for one month. */
    /** First month that rent is tracked: the setting, or the first month with a recorded payment. */
    trackFrom() { return D.settings.rentTrackFrom || D.payments.map((p) => p.forMonth).filter(Boolean).sort()[0] || null; },
    lastRentMonth() { return D.payments.map((p) => p.forMonth).filter(Boolean).sort().pop() || null; },
    rentStatus(unit, monthKey, todayISO) {
      todayISO = todayISO || U.todayISO();
      const from = M.trackFrom();
      const t = M.tenantForMonth(unit.id, monthKey);
      const pays = M.paymentsFor(unit.id, monthKey);
      const paid = U.round2(U.sum(pays, (p) => p.amount));
      const expected = t ? (+t.rent || 0) : 0;
      const due = monthKey + '-' + String(Math.min(28, Math.max(1, +(t && t.dueDay) || 1))).padStart(2, '0');
      const lateOn = U.addDays(due, +D.settings.graceDays || 0);
      let status;
      if (!t) status = paid ? 'paid' : 'vacant';
      else if (from && monthKey < from && !paid) status = 'untracked';
      else if (t.exempt || expected === 0) status = paid ? 'paid' : 'exempt';
      else if (paid >= expected - 0.005) status = paid > expected + 0.005 ? 'over' : 'paid';
      else if (paid > 0) status = todayISO > lateOn ? 'partial-late' : 'partial';
      else if (todayISO < due) status = 'upcoming';
      else if (todayISO <= lateOn) status = 'due';
      else status = 'late';
      return { unit, tenant: t, expected, paid, balance: U.round2(Math.max(0, expected - paid)), status, due, lateOn, payments: pays };
    },
    STATUS_LABEL: { paid: 'Paid', over: 'Paid (extra)', partial: 'Partly paid', 'partial-late': 'Partly paid · late', upcoming: 'Not due yet', due: 'Due', late: 'Late', vacant: 'Vacant', exempt: 'No rent due', untracked: 'Before tracking started' },
    rentRoll(monthKey, todayISO) { return D.units.map((u) => M.rentStatus(u, monthKey, todayISO)); },
    /** Unpaid balance of a tenant across all months from move-in (or first payment) to now. */
    tenantBalance(t, todayISO) {
      todayISO = todayISO || U.todayISO();
      const nowKey = U.monthKey(todayISO);
      const firstPay = D.payments.filter((p) => p.tenantId === t.id || (p.unitId === t.unitId)).map((p) => p.forMonth).sort()[0];
      let start = t.moveIn ? U.monthKey(t.moveIn) : firstPay;
      if (!start) return 0;
      const from = M.trackFrom(); if (from && from > start) start = from;
      const unit = M.unit(t.unitId); if (!unit) return 0;
      let owed = 0;
      for (let k = start, n = 0; k <= nowKey && n < 600; k = U.addMonths(k, 1), n++) {
        if (!M.tenantActiveIn(t, k)) continue;
        const s = M.rentStatus(unit, k, todayISO);
        if (s.tenant && s.tenant.id === t.id && ['late', 'partial-late'].includes(s.status)) owed += s.balance;
      }
      return U.round2(owed);
    },

    /* ---------- deposits ---------- */
    depositsHeld(asOf) {
      asOf = asOf || U.todayISO();
      return D.deposits.filter((d) => (!d.date || d.date <= asOf) && !(d.returnedDate && d.returnedDate <= asOf))
        .reduce((t, d) => t + (+d.amount || 0), 0);
    },

    /* ---------- income & expenses (cash basis, building only unless asked) ---------- */
    periodTotals(from, to, opts = {}) {
      const inc = {}, exp = {}, others = {};
      let rent = 0;
      D.payments.forEach((p) => { if (U.inRange(p.date, from, to)) rent += +p.amount || 0; });
      D.txns.forEach((x) => {
        if (!U.inRange(x.date, from, to) || x.type === 'transfer') return;
        const amt = +x.amount || 0;
        if (x.type === 'income') { inc[x.category] = (inc[x.category] || 0) + amt; return; }
        if (!opts.allEntities && !M.isBuilding(x)) { const e = x.entity || 'bldg'; others[e] = (others[e] || 0) + amt; return; }
        exp[x.category] = (exp[x.category] || 0) + amt;
      });
      const otherIncome = U.sum(Object.values(inc));
      const totalIncome = rent + otherIncome;
      const totalExpense = U.sum(Object.values(exp));
      return { rent: U.round2(rent), inc, otherIncome: U.round2(otherIncome), totalIncome: U.round2(totalIncome), exp, totalExpense: U.round2(totalExpense), net: U.round2(totalIncome - totalExpense), others };
    },
    /** 12 monthly buckets for a year. */
    monthly(year) {
      return Array.from({ length: 12 }, (_, i) => {
        const k = `${year}-${String(i + 1).padStart(2, '0')}`;
        return { key: k, ...M.periodTotals(k + '-01', U.monthEnd(k)) };
      });
    },
    yearsWithData() {
      const ys = new Set();
      D.payments.forEach((p) => p.date && ys.add(+p.date.slice(0, 4)));
      D.txns.forEach((x) => x.date && ys.add(+x.date.slice(0, 4)));
      ys.add(new Date().getFullYear());
      return [...ys].filter((y) => y > 1990 && y < 2200).sort((a, b) => b - a);
    },
    /** The month to show first: this month if there is recent data, else the newest month with payments. */
    defaultMonth() {
      const now = U.monthKey(U.todayISO());
      const latest = D.payments.map((p) => p.forMonth).filter(Boolean).sort().pop();
      if (!latest || latest >= U.addMonths(now, -2)) return now;
      return latest;
    },
    defaultYear() { return +M.defaultMonth().slice(0, 4); },

    /* ---------- assets: straight-line depreciation ---------- */
    ASSET_TYPES: ['Building', 'Land', 'Building improvement', 'Elevator', 'Roof', 'A/C & mechanical', 'Appliance', 'Fire & safety system', 'Security & cameras', 'Furniture & fixtures', 'Vehicle', 'Equipment', 'Cash reserve', 'Investment', 'Receivable', 'Other asset'],
    DEFAULT_LIFE: { 'Building': 27.5, 'Building improvement': 27.5, 'Elevator': 27.5, 'Roof': 27.5, 'A/C & mechanical': 27.5, 'Appliance': 5, 'Fire & safety system': 15, 'Security & cameras': 5, 'Furniture & fixtures': 5, 'Vehicle': 5, 'Equipment': 7 },
    depreciable: (a) => !['Land', 'Cash reserve', 'Investment', 'Receivable', 'Other asset'].includes(a.type) && +a.life > 0 && +a.cost > 0 && a.inService,
    /** Accumulated depreciation through a date (straight line, monthly, mid-month start). */
    accumDep(a, asOf) {
      if (!M.depreciable(a)) return 0;
      const basis = Math.max(0, (+a.cost || 0) - (+a.salvage || 0));
      const months = (+a.life) * 12;
      const s = U.parseISO(a.inService), e = U.parseISO(a.disposedDate && a.disposedDate < asOf ? a.disposedDate : asOf);
      if (!s || !e || e < s) return 0;
      let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 0.5;
      m = Math.max(0, Math.min(months, m));
      return U.round2(basis * m / months);
    },
    yearDep(a, year) { return U.round2(M.accumDep(a, `${year}-12-31`) - M.accumDep(a, `${year - 1}-12-31`)); },
    assetValue(a, asOf) {
      asOf = asOf || U.todayISO();
      if (a.disposedDate && a.disposedDate <= asOf) return 0;
      if (a.acquired && a.acquired > asOf) return 0;
      if (a.marketValue && !M.depreciable(a) && !a.cost) return +a.marketValue;
      return U.round2((+a.cost || +a.marketValue || 0) - M.accumDep(a, asOf));
    },

    /* ---------- cash accounts ---------- */
    accountBalance(acc, asOf) {
      asOf = asOf || U.todayISO();
      const primary = M.primaryAccount();
      const isPrim = primary && primary.id === acc.id;
      let bal = +acc.openingBalance || 0;
      const from = acc.openingDate || '';
      const mine = (x) => (x.accountId ? x.accountId === acc.id : isPrim);
      D.payments.forEach((p) => { if (mine(p) && p.date > from && p.date <= asOf) bal += +p.amount || 0; });
      D.txns.forEach((x) => {
        if (!mine(x) || !(x.date > from && x.date <= asOf)) return;
        if (x.type === 'transfer') { if (x.category === 'tr-rentdep') return; bal += (x.direction === 'in' ? 1 : -1) * (+x.amount || 0); return; }
        bal += (x.type === 'income' ? 1 : -1) * (+x.amount || 0);
      });
      return U.round2(bal);
    },

    /* ---------- liabilities ---------- */
    LIAB_TYPES: ['Mortgage', 'Loan', 'Line of credit', 'Credit card', 'Accounts payable', 'Assessment', 'Taxes payable', 'Other liability'],
    /** Monthly payment of an amortizing loan. */
    loanPayment(L) {
      const P = +L.original || 0, n = +L.termMonths || 0, r = (+L.rate || 0) / 1200;
      if (!P || !n) return 0;
      return r ? U.round2(P * r / (1 - Math.pow(1 + r, -n))) : U.round2(P / n);
    },
    amortization(L) {
      const P = +L.original || 0, n = +L.termMonths || 0, r = (+L.rate || 0) / 1200, pay = +L.payment || M.loanPayment(L);
      const rows = []; let bal = P; let k = U.monthKey(L.firstPayment || L.start || U.todayISO());
      for (let i = 1; i <= n && bal > 0.005 && i <= 600; i++, k = U.addMonths(k, 1)) {
        const interest = U.round2(bal * r); const principal = U.round2(Math.min(bal, pay - interest));
        bal = U.round2(bal - principal);
        rows.push({ n: i, month: k, payment: U.round2(principal + interest), interest, principal, balance: bal });
      }
      return rows;
    },
    liabilityBalance(L, asOf) {
      asOf = asOf || U.todayISO();
      if (L.paidOffDate && L.paidOffDate <= asOf) return 0;
      if (L.start && L.start > asOf) return 0;
      if (L.amortize && +L.original && +L.termMonths) {
        const k = U.monthKey(asOf); const rows = M.amortization(L).filter((r) => r.month <= k);
        return rows.length ? rows[rows.length - 1].balance : +L.original;
      }
      // manual balances: latest balance update on or before the date
      const hist = (L.history || []).filter((h) => h.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
      return hist.length ? +hist[hist.length - 1].balance : (+L.balance || 0);
    },
    yearInterest(L, year) {
      if (!(L.amortize && +L.original && +L.termMonths)) return null;
      return U.round2(U.sum(M.amortization(L).filter((r) => r.month.startsWith(String(year))), (r) => r.interest));
    },

    /* ---------- balance sheet ---------- */
    balanceSheet(asOf) {
      asOf = asOf || U.todayISO();
      const cash = D.accounts.filter((a) => !a.closed).map((a) => ({ name: a.name, value: M.accountBalance(a, asOf), rec: a }));
      const fixed = D.assets.map((a) => ({ name: a.name, type: a.type, cost: +a.cost || 0, dep: M.accumDep(a, asOf), value: M.assetValue(a, asOf), rec: a })).filter((x) => x.value || x.cost);
      const loans = D.liabilities.map((L) => ({ name: L.name, type: L.type, value: M.liabilityBalance(L, asOf), rec: L })).filter((x) => x.value);
      const deposits = U.round2(M.depositsHeld(asOf));
      const totalAssets = U.round2(U.sum(cash, (x) => x.value) + U.sum(fixed, (x) => x.value));
      const totalLiab = U.round2(U.sum(loans, (x) => x.value) + deposits);
      return { asOf, cash, fixed, loans, deposits, totalAssets, totalLiab, equity: U.round2(totalAssets - totalLiab) };
    },

    /* ---------- recurring bills ---------- */
    FREQS: { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 },
    billLastPaid(b) {
      const hits = D.txns.filter((x) => x.type === 'expense' && ((b.vendorId && x.vendorId === b.vendorId) || (b.match && U.norm(x.description).includes(U.norm(b.match)))));
      return hits.map((x) => x.date).sort().pop() || null;
    },
    billNextDue(b, todayISO) {
      todayISO = todayISO || U.todayISO();
      const step = M.FREQS[b.frequency] || 1;
      const day = String(Math.min(28, Math.max(1, +b.dueDay || 1))).padStart(2, '0');
      const last = M.billLastPaid(b);
      let k = last ? U.addMonths(U.monthKey(last), step) : U.monthKey(b.startDate || todayISO);
      if (b.startDate && k < U.monthKey(b.startDate)) k = U.monthKey(b.startDate);
      const due = k + '-' + day;
      // no payment for three periods: probably stopped or paid some other way
      const stale = !!last && due < U.addDays(todayISO, -31 * step * 2);
      return { due, last, stale };
    },
    upcomingBills(days = 21, todayISO) {
      todayISO = todayISO || U.todayISO();
      const until = U.addDays(todayISO, days);
      return D.bills.filter((b) => !b.paused).map((b) => ({ bill: b, ...M.billNextDue(b, todayISO) }))
        .filter((x) => x.due <= until && !x.stale).sort((a, b) => a.due.localeCompare(b.due));
    },

    /* ---------- budget ---------- */
    budgetVsActual(year) {
      const t = M.periodTotals(`${year}-01-01`, `${year}-12-31`);
      const elapsed = (() => { const now = U.todayISO(); if (now < `${year}-01-01`) return 0; if (now > `${year}-12-31`) return 1; return (U.daysBetween(`${year}-01-01`, now) + 1) / 365; })();
      return M.expenseCats().filter((x) => x.budget || t.exp[x.id]).map((x) => ({ cat: x, budget: +x.budget || 0, actual: U.round2(t.exp[x.id] || 0), pace: U.round2((+x.budget || 0) * elapsed) }));
    },

    /* ---------- items that need a look ---------- */
    reviewQueue: () => D.txns.filter((x) => x.review),

    /* ---------- Schedule E summary ---------- */
    scheduleE(year) {
      const t = M.periodTotals(`${year}-01-01`, `${year}-12-31`);
      const lines = {};
      const add = (ln, amt) => { lines[ln] = U.round2((lines[ln] || 0) + amt); };
      add(3, t.rent);
      Object.entries(t.inc).forEach(([cid, amt]) => { const cc = M.cat(cid); if (cc && cc.schedE === 3) add(3, amt); });
      Object.entries(t.exp).forEach(([cid, amt]) => { const cc = M.cat(cid); add(cc ? cc.schedE : 19, amt); });
      const dep = U.round2(U.sum(D.assets, (a) => M.yearDep(a, year)));
      if (dep) add(18, dep);
      D.liabilities.forEach((L) => { const i = M.yearInterest(L, year); if (i && !D.txns.some((x) => x.category === 'int-mort' && x.date.startsWith(String(year)))) add(L.type === 'Mortgage' ? 12 : 13, i); });
      return lines;
    },

    /* ---------- auto-categorize a bank line ---------- */
    RULES: [
      [/\bFPL\b|FLORIDA POWER/i, 'util-elec', 'FPL'],
      [/WASTE MANAGEMENT|\bWM\b/i, 'util-waste', 'Waste Management'],
      [/WATER AND SEWER|WATER & SEWER|WASD/i, 'util-water', 'Miami-Dade Water & Sewer'],
      [/COMCAST|XFINITY/i, 'util-net', 'Comcast'],
      [/T-?MOBILE|SPRINT/i, 'adm-phone', 'T-Mobile'],
      [/\bAT&T\b|\bATT\b/i, 'util-lines', 'AT&T'],
      [/PRESTIGE ELEVATOR/i, 'sys-elev', 'Prestige Elevator'],
      [/MIAMI ELEVATOR/i, 'sys-elev', 'Miami Elevator & Consulting'],
      [/ELEVATOR (FLOOR|CERTIFICATE)|CERTIFICATE OF OPERATION/i, 'sys-elev'],
      [/FLORIDA FIRE|UNIVERSAL FIRE|FIRE ALARM/i, 'sys-fire', 'Florida Fire & Electrical Protection'],
      [/\bADT\b|EVERON/i, 'sys-alarm', 'ADT / Everon'],
      [/USABLE LIFE/i, 'ins-life', 'USAble Life'],
      [/FLORIDA BLUE/i, 'ins-health', 'Florida Blue'],
      [/COTHROM|INSURANCE AGENCY|CITIZENS PROPERTY/i, 'ins-prop', 'Cothrom Risks & Insurance'],
      [/AUDI FINANCIAL|CHEVRON|SYNCHRONY|SHELL OIL|EXXON/i, 'adm-auto'],
      [/DEPARTMENT OF REVENUE|DEPT OF REVENUE/i, 'tax-dor', 'Florida Dept. of Revenue'],
      [/PROPERTY TAX SERVICES/i, 'tax-svc', 'Florida Property Tax Services'],
      [/TAX COLLECTOR|BUSINESS TAX|VILLAGE OF|INT SERV DEP|PERMIT/i, 'tax-permit'],
      [/SERVICE CHARGE|BANK FEE|OVERDRAFT/i, 'adm-bank'],
      [/30 YEAR|40 YEAR|RECERT|VITAL INSPEC/i, 'insp-recert'],
      [/JORGE DEL AMO/i, 'rep-contr', 'Jorge del Amo'],
      [/INDUSTRIAL ELECTRICAL/i, 'rep-elec', 'Industrial Electrical Systems'],
      [/ROOFER|ROOFING/i, 'rep-roof'],
      [/LOCKSMITH/i, 'rep-other', 'Caraballo Locksmith'],
      [/PLUMBING|BACKFLOW|PLUMBER/i, 'rep-plumb'],
      [/WATER HEATER/i, 'rep-appl'],
      [/PAINT/i, 'rep-paint'],
      [/LANDSCAP|LAWN/i, 'mnt-land'],
      [/PEST|EXTERMINAT/i, 'mnt-pest'],
      [/CAMERA/i, 'cap-equip'],
      [/GUILLERMINA|PAYROLL|WAGES|SALARY/i, 'pay-wages', 'Guillermina Hernandez'],
      [/TURNER & ASSOCIATES|CPA|ACCOUNTING/i, 'adm-acct'],
      [/CARDMEMBER|AMERICAN EXPRESS|AMEX|BARCLAYS|CAPITAL ONE|DISCOVER/i, 'oth-card']
    ],
    categorize(text) {
      for (const [re, cat, vendor] of M.RULES) if (re.test(text || '')) return { category: cat, vendor: vendor || '' };
      return { category: 'oth-unclass', vendor: '' };
    }
  };
  global.M = M;
})(typeof window !== 'undefined' ? window : globalThis);
