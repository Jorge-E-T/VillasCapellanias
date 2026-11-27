/* =========================================================
   Pages: overview, units & tenants, rent, income & expenses, review
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M, Charts } = global;
  const D = M.D;
  const App = global.App || null;
  const A = () => global.App;
  const F = () => global.Forms;

  const ST_CLASS = { paid: 'paid', over: 'paid', partial: 'partial', 'partial-late': 'late', upcoming: 'due', due: 'due', late: 'late', vacant: 'vacant', exempt: 'exempt', untracked: 'none' };
  const chip = (st) => `<span class="chip st-${ST_CLASS[st]}">${U.esc(M.STATUS_LABEL[st] || st)}</span>`;
  const monthNav = (key, id = 'mNav') => `<div class="mnav" id="${id}"><button type="button" class="btn-icon" data-step="-1" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><b>${U.monthLabel(key, true)}</b><button type="button" class="btn-icon" data-step="1" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
  const yearSel = (y, id = 'ySel') => `<select id="${id}" class="year-sel" aria-label="Year">${M.yearsWithData().map((x) => `<option${x === +y ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
  const empty = (title, text, btn) => `<div class="empty"><h2>${title}</h2><p>${text}</p>${btn || ''}</div>`;
  const shortName = (n) => { const s = String(n || '').split(/\s+(?:and|y|&)\s+|\//i)[0].trim().split(/\s+/); return s.length > 1 ? s[0] + ' ' + s[s.length - 1][0] + '.' : s[0] || ''; };

  /* =========================================================
     The building facade: one arched window per unit
     ========================================================= */
  function facade(roll) {
    const floors = {}; roll.forEach((s) => { const f = +s.unit.floor || +String(s.unit.number)[0] || 1; (floors[f] = floors[f] || []).push(s); });
    const levels = Object.keys(floors).map(Number).sort((a, b) => b - a);
    const perRow = Math.max(3, ...levels.map((l) => floors[l].length));
    const W = 120 * perRow + 80, winW = 60, winH = 88, rowH = 148;
    const eave = 168;                         // where the main hipped roof meets the walls
    const bodyL = 34, bodyR = W - 34, mid = W / 2;
    const towerW = 128, tL = mid - towerW / 2, tR = mid + towerW / 2;
    const groundY = eave + 26 + rowH * levels.length;   // top of the ground-floor arcade
    const H = groundY + 150;
    const roofPath = (x0, x1, yE, rise, over) => `M${x0 - over} ${yE} L${x0 + rise * 1.4} ${yE - rise} L${x1 - rise * 1.4} ${yE - rise} L${x1 + over} ${yE} Z`;
    let clipN = 0; const uid = Math.random().toString(36).slice(2, 7);
    /* tile lines, clipped to the roof shape they sit on */
    const roof = (d, x0, x1, y, h) => { const id = `fcr${uid}${clipN++}`; let t = ''; for (let x = x0 - h; x < x1 + h; x += 11) t += `<path d="M${x} ${y} l${h * 0.35} ${-h}" class="fc-tileline"/>`; return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" class="fc-roof"/><g clip-path="url(#${id})">${t}</g>`; };
    let s = `<svg viewBox="0 0 ${W} ${H}" class="facade" role="img" aria-label="Rent status by unit, drawn as the front of Villas Capellanias">`;
    /* main hipped roof */
    s += `${roof(roofPath(bodyL, bodyR, eave, 46, 22), bodyL - 22, bodyR + 22, eave, 48)}<path d="M${bodyL - 22} ${eave}H${bodyR + 22}" class="fc-eave"/>`;
    /* walls */
    s += `<rect x="${bodyL}" y="${eave}" width="${bodyR - bodyL}" height="${H - eave - 2}" class="fc-wall"/>`;
    /* bell tower: shaft runs the full height, belfry rises above the roof */
    const bTop = 30, bBot = eave - 46 - 4;
    s += `<rect x="${tL}" y="${bTop + 22}" width="${towerW}" height="${H - bTop - 24}" class="fc-tower"/>`;
    s += `${roof(roofPath(tL, tR, bTop + 24, 22, 16), tL - 16, tR + 16, bTop + 24, 24)}<path d="M${tL - 16} ${bTop + 24}H${tR + 16}" class="fc-eave"/>`;
    const bw = 22, bg = (towerW - 3 * bw) / 4;
    for (let i = 0; i < 3; i++) { const x = tL + bg + i * (bw + bg); s += `<path d="M${x} ${bBot - 8}V${bTop + 48 + bw / 2}a${bw / 2} ${bw / 2} 0 0 1 ${bw} 0V${bBot - 8}Z" class="fc-belfry"/>`; }
    s += `<path d="M${tL - 6} ${bBot}H${tR + 6}" class="fc-band"/><path d="M${tL - 6} ${eave + 6}H${tR + 6}" class="fc-band"/>`;
    /* unit windows, floor by floor */
    levels.forEach((lv, li) => {
      const y0 = eave + 30 + li * rowH; const list = floors[lv]; const gap = (bodyR - bodyL - list.length * winW) / (list.length + 1);
      s += `<text x="${bodyL + 10}" y="${y0 + winH / 2 + 4}" class="fc-floor">${lv}</text>`;
      if (li) s += `<path d="M${bodyL} ${y0 - 18}H${bodyR}" class="fc-course"/>`;
      list.forEach((st, i) => {
        const x = bodyL + gap * (i + 1) + winW * i; const cls = ST_CLASS[st.status] || 'due';
        const tip = `Unit ${st.unit.number} · ${st.tenant ? st.tenant.name : 'Vacant'} · ${M.STATUS_LABEL[st.status]}${st.expected ? ` · ${U.money(st.paid)} of ${U.money(st.expected)}` : ''}`;
        s += `<g class="fc-unit" tabindex="0" role="link" data-unit="${st.unit.id}" aria-label="${U.esc(tip)}"><title>${U.esc(tip)}</title>`;
        s += `<path d="M${x - 5} ${y0 + winH} V${y0 + winW / 2} a${winW / 2 + 5} ${winW / 2 + 5} 0 0 1 ${winW + 10} 0 V${y0 + winH} Z" class="fc-surround"/>`;
        s += `<path d="M${x} ${y0 + winH} V${y0 + winW / 2} a${winW / 2} ${winW / 2} 0 0 1 ${winW} 0 V${y0 + winH} Z" class="fc-win fw-${cls}"/>`;
        if (cls === 'partial') { const frac = Math.max(0.08, Math.min(0.92, st.paid / (st.expected || 1))); const hh = (winH - winW / 2) * frac; s += `<rect x="${x}" y="${y0 + winH - hh}" width="${winW}" height="${hh}" class="fw-fill"/>`; }
        s += `<path d="M${x + winW / 2} ${y0 + 4}V${y0 + winH}M${x} ${y0 + winW / 2 + 6}H${x + winW}" class="fc-mullion"/>`;
        s += `<rect x="${x - 8}" y="${y0 + winH}" width="${winW + 16}" height="6" rx="1.5" class="fc-sill"/>`;
        s += `<text x="${x + winW / 2}" y="${y0 + winH + 25}" class="fc-no">${U.esc(st.unit.number)}</text>`;
        s += `<text x="${x + winW / 2}" y="${y0 + winH + 40}" class="fc-name">${U.esc(st.tenant ? shortName(st.tenant.name) : 'Vacant')}</text></g>`;
      });
    });
    /* tile roof band over the ground-floor arcade */
    s += roof(`M${bodyL - 18} ${groundY + 14} L${bodyL} ${groundY - 6} H${bodyR} L${bodyR + 18} ${groundY + 14} Z`, bodyL - 18, bodyR + 18, groundY + 14, 22);
    /* ground floor: arcade with the entrance under the tower */
    /* ground floor: an arcade on each side, the entrance under the tower */
    const gy = groundY + 30, side = Math.max(2, Math.ceil(perRow / 2));
    [[bodyL, tL], [tR, bodyR]].forEach(([a, b]) => { const aw = (b - a) / side; for (let i = 0; i < side; i++) { const cx = a + aw * (i + 0.5), w = aw * 0.64; s += `<path d="M${cx - w / 2} ${H - 2} V${gy + w / 2 + 10} a${w / 2} ${w / 2} 0 0 1 ${w} 0 V${H - 2}" class="fc-arch"/>`; } });
    const dw = 56; s += `<path d="M${mid - dw / 2 - 8} ${H - 2} V${gy + dw / 2 - 8} a${dw / 2 + 8} ${dw / 2 + 8} 0 0 1 ${dw + 16} 0 V${H - 2}" class="fc-surround"/><path d="M${mid - dw / 2} ${H - 2} V${gy + dw / 2} a${dw / 2} ${dw / 2} 0 0 1 ${dw} 0 V${H - 2}" class="fc-door"/>`;
    s += `<line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" class="fc-ground"/>`;
    return s + '</svg>';
  }

  /* =========================================================
     OVERVIEW
     ========================================================= */
  function overview(view, p) {
    if (D.units.length) A().ovMonth = p.m || A().ovMonth || M.defaultMonth();
    const key = A().ovMonth || M.defaultMonth();
    const year = +key.slice(0, 4);
    if (!D.units.length) {
      view.innerHTML = `<div class="page-head"><h1>Welcome to ${U.esc(D.settings.propertyName)}</h1></div>
      <div class="welcome card"><div><h2>Start with your records</h2><p>Bring in the units, tenants, deposits, rent and the general ledger from your Excel workbook in one step. You will see a preview before anything is saved.</p>
      <div class="btn-row"><button class="btn btn-primary" id="wImport" type="button">Import the Excel workbook</button><button class="btn" id="wRestore" type="button">Restore a backup file</button><button class="btn btn-ghost" id="wManual" type="button">Add units by hand</button></div>
      <p class="small muted">Using several devices? Set up cloud sync on the first one, then just sign in on the others (Settings → Cloud sync).</p></div>${facade(Array.from({ length: 15 }, (_, i) => ({ unit: { id: '', number: String(200 + Math.floor(i / 5) * 100 + (i % 5) + 1), floor: 2 + Math.floor(i / 5) }, status: 'vacant', tenant: null, expected: 0, paid: 0 })))}</div>`;
      U.$('#wImport').onclick = () => global.Settings.importWorkbook();
      U.$('#wRestore').onclick = () => global.Settings.restore();
      U.$('#wManual').onclick = () => F().unit();
      return;
    }
    const roll = M.rentRoll(key);
    const due = roll.filter((s) => s.expected > 0);
    const expected = U.sum(due, (s) => s.expected), collected = U.sum(roll, (s) => s.paid);
    const counts = {}; roll.forEach((s) => { const c = ST_CLASS[s.status]; counts[c] = (counts[c] || 0) + 1; });
    const occupied = roll.filter((s) => s.tenant).length;
    const lateList = roll.filter((s) => ['late', 'partial-late'].includes(s.status));
    const ytdTo = key < U.monthKey(U.todayISO()) ? U.monthEnd(key) : U.todayISO();
    const ytd = M.periodTotals(`${year}-01-01`, `${year}-12-31` < ytdTo ? `${year}-12-31` : ytdTo);
    const months = M.monthly(year);
    const bs = M.balanceSheet();
    const groups = {}; Object.entries(ytd.exp).forEach(([cid, amt]) => { const g = (M.cat(cid) || {}).group || 'Other'; groups[g] = (groups[g] || 0) + amt; });
    const gItems = Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    const review = M.reviewQueue();
    const bills = M.upcomingBills(21);
    const othersTotal = U.sum(Object.values(ytd.others));

    view.innerHTML = `
      <div class="page-head"><div><h1>${U.esc(D.settings.propertyName)}</h1><p class="lede">${U.esc([D.settings.address, D.settings.city].filter(Boolean).join(', '))} · ${D.units.length} units</p></div>${monthNav(key)}</div>
      ${(() => { const lr = M.lastRentMonth(); const now = U.monthKey(U.todayISO()); return lr && lr < U.addMonths(now, -2) ? `<div class="callout callout-warn">Rent payments are recorded through <b>${U.monthLabel(lr, true)}</b>, so later months show as late. Record the payments since then, or set where tracking starts in <a href="#/settings">Settings → Property</a>.</div>` : ''; })()}
      <section class="card hero">
        <div class="hero-art">${facade(roll)}
          <ul class="key">${[['paid', 'Paid'], ['partial', 'Partly paid'], ['due', 'Not yet due / due'], ['late', 'Late'], ['vacant', 'Vacant'], ['exempt', 'No rent due'], ['none', 'Before tracking']].filter(([c]) => counts[c]).map(([c, l]) => `<li><i class="sw fw-${c}"></i>${l} <b>${counts[c]}</b></li>`).join('')}</ul></div>
        <div class="hero-side">
          <h2>Rent for ${U.MONTHS_LONG[+key.slice(5) - 1]}</h2>
          <p class="big-figure">${U.money0(collected)}<small> of ${U.money0(expected)}</small></p>
          <div class="bar"><i style="width:${expected ? Math.min(100, collected / expected * 100) : 0}%"></i></div>
          <dl class="facts">
            <div><dt>Still to collect</dt><dd>${U.money(Math.max(0, expected - collected))}</dd></div>
            <div><dt>Occupied</dt><dd>${occupied} of ${D.units.length} units</dd></div>
            <div><dt>Late</dt><dd>${lateList.length ? lateList.map((s) => `<a href="#/units?id=${s.unit.id}">${s.unit.number}</a>`).join(', ') : 'None'}</dd></div>
          </dl>
          <div class="btn-row"><button class="btn btn-primary" id="ovPay" type="button">Record rent</button><button class="btn" id="ovBatch" type="button">Bank deposit</button><a class="btn btn-ghost" href="#/rent?y=${year}">Rent grid</a></div>
        </div>
      </section>

      <section class="kpis">
        <div class="kpi"><span>Income ${year}${ytdTo < `${year}-12-31` ? ' to date' : ''}</span><b class="c-inc">${U.money0(ytd.totalIncome)}</b>${Charts.spark(months.map((m) => m.totalIncome), { color: '--inc' })}<small>Rent ${U.money0(ytd.rent)} · other ${U.money0(ytd.otherIncome)}</small></div>
        <div class="kpi"><span>Building expenses</span><b class="c-exp">${U.money0(ytd.totalExpense)}</b>${Charts.spark(months.map((m) => m.totalExpense), { color: '--exp' })}<small>${othersTotal ? `Plus ${U.money0(othersTotal)} paid for others` : 'Nothing paid for others'}</small></div>
        <div class="kpi"><span>Net operating income</span><b class="${ytd.net < 0 ? 'c-neg' : ''}">${U.money0(ytd.net)}</b><small>Margin ${ytd.totalIncome ? U.pct(ytd.net / ytd.totalIncome) : '—'}</small></div>
        <div class="kpi"><span>Equity (assets − liabilities)</span><b>${U.money0(bs.equity)}</b><small>${U.money0(bs.totalAssets)} − ${U.money0(bs.totalLiab)}</small></div>
      </section>

      <section class="grid2">
        <div class="card"><div class="card-head"><h2>Income and expenses by month</h2>${yearSel(year, 'ovYear')}</div>
          ${months.every((m) => !m.totalIncome && !m.totalExpense) ? `<p class="muted chart-empty">Nothing recorded for ${year} yet.</p>` : Charts.monthBars(U.MONTHS, [{ name: 'Income', color: '--inc', values: months.map((m) => m.totalIncome) }, { name: 'Expenses', color: '--exp', values: months.map((m) => m.totalExpense) }], { net: months.map((m) => m.net) })}
          <ul class="key key-inline"><li><i class="sw" style="background:var(--inc)"></i>Income</li><li><i class="sw" style="background:var(--exp)"></i>Building expenses</li><li><i class="sw sw-line"></i>Net</li></ul></div>
        <div class="card"><div class="card-head"><h2>Where the money went</h2><a href="#/reports?r=pl&y=${year}" class="small">Full statement</a></div>
          ${gItems.length ? Charts.donut(gItems.slice(0, 8), { center: U.moneyK(ytd.totalExpense), sub: 'expenses ' + year }) : '<p class="muted">No expenses recorded for this year yet.</p>'}</div>
      </section>

      <section class="grid3">
        <div class="card"><div class="card-head"><h2>Needs review</h2><a href="#/review" class="small">${review.length ? 'See all ' + review.length : ''}</a></div>
          ${review.length ? `<ul class="list">${review.slice(0, 5).map((x) => `<li><button type="button" class="linkrow" data-txn="${x.id}"><span><b>${U.esc(U.titleCase(x.description).slice(0, 48))}</b><small>${U.esc(x.reviewNote || 'Flagged for review').slice(0, 90)}</small></span><em>${U.money(x.amount)}</em></button></li>`).join('')}</ul>` : '<p class="muted">Nothing is waiting for a decision.</p>'}</div>
        <div class="card"><div class="card-head"><h2>Bills due soon</h2><a href="#/bills" class="small">All bills</a></div>
          ${bills.length ? `<ul class="list">${bills.slice(0, 6).map((b) => `<li><button type="button" class="linkrow" data-bill="${b.bill.id}"><span><b>${U.esc(b.bill.name)}</b><small>${b.due < U.todayISO() ? '<span class="c-late">Was due</span> ' : 'Due '}${U.fmtDateShort(b.due)}${b.bill.autopay ? ' · auto-debit' : ''}</small></span><em>${U.money(b.bill.amount)}</em></button></li>`).join('')}</ul>` : `<p class="muted">${D.bills.length ? 'Nothing due in the next three weeks.' : 'Add recurring bills (FPL, Waste Management, elevator monitoring…) to see what’s coming up.'}</p>`}</div>
        <div class="card"><div class="card-head"><h2>Recent changes</h2><a href="#/settings?tab=activity" class="small">History</a></div>
          ${D.activity.length ? `<ul class="list act">${D.activity.slice(0, 6).map((a) => `<li><span><b>${U.esc(a.who)}</b> ${{ add: 'added', edit: 'changed', delete: 'deleted', bulk: 'recorded', import: 'imported' }[a.action] || a.action} ${U.esc(a.label)}</span><small>${U.ago(a.t)}</small></li>`).join('')}</ul>` : '<p class="muted">Changes will be listed here with who made them.</p>'}</div>
      </section>`;

    U.$('#mNav').onclick = (e) => { const b = e.target.closest('[data-step]'); if (b) { A().ovMonth = U.addMonths(key, +b.dataset.step); A().render(); } };
    U.$('#ovYear').onchange = (e) => { A().ovMonth = e.target.value + key.slice(4); A().render(); };
    U.$('#ovPay').onclick = () => F().payment(null, { forMonth: key });
    U.$('#ovBatch').onclick = () => F().batch(key);
    wireFacade(view);
    view.onclick = (e) => {
      const t = e.target.closest('[data-txn]'); if (t) F().txn(M.get(t.dataset.txn));
      const b = e.target.closest('[data-bill]'); if (b) F().payBill(M.get(b.dataset.bill));
    };
  }
  function wireFacade(root) {
    U.$$('.fc-unit', root).forEach((g) => {
      if (!g.dataset.unit) return;
      const go = () => A().go('units', { id: g.dataset.unit });
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  /* =========================================================
     UNITS & TENANTS
     ========================================================= */
  function units(view, p) {
    if (p.id && M.unit(p.id)) return unitDetail(view, M.unit(p.id), p);
    const key = M.defaultMonth();
    const roll = M.rentRoll(key);
    const floors = {}; roll.forEach((s) => { const f = s.unit.floor || String(s.unit.number)[0]; (floors[f] = floors[f] || []).push(s); });
    const totalRent = U.sum(roll.filter((s) => s.tenant && !s.tenant.exempt), (s) => +s.tenant.rent || 0);
    const leasesSoon = D.tenants.filter((t) => !t.moveOut && t.leaseEnd && t.leaseEnd >= U.todayISO() && t.leaseEnd <= U.addDays(U.todayISO(), 75));
    view.innerHTML = `
      <div class="page-head"><div><h1>Units &amp; tenants</h1><p class="lede">Status for ${U.monthLabel(key, true)} · ${roll.filter((s) => s.tenant).length} of ${D.units.length} occupied · scheduled rent ${U.money0(totalRent)} a month · deposits held ${U.money0(M.depositsHeld())}</p></div>
      <div class="btn-row"><button class="btn" id="uAddUnit" type="button">Add unit</button><button class="btn btn-primary" id="uAddTen" type="button">Add tenant</button></div></div>
      ${leasesSoon.length ? `<div class="callout callout-warn">Leases ending in the next 75 days: ${leasesSoon.map((t) => `<a href="#/units?id=${t.unitId}">${M.unitLabel(t.unitId)} (${U.esc(t.name)}, ${U.fmtDate(t.leaseEnd)})</a>`).join(' · ')}</div>` : ''}
      ${D.units.length ? Object.keys(floors).sort((a, b) => b - a).map((f) => `<h2 class="floor-h">Floor ${U.esc(f)}</h2><div class="unit-grid">${floors[f].map((s) => {
        const t = s.tenant; const bal = t ? M.tenantBalance(t) : 0;
        const dep = t ? U.sum(D.deposits.filter((d) => d.tenantId === t.id && !d.returnedDate), (d) => d.amount) : 0;
        return `<a class="unit-card uc-${ST_CLASS[s.status]}" href="#/units?id=${s.unit.id}">
          <div class="uc-top"><b class="uc-no">${U.esc(s.unit.number)}</b>${chip(s.status)}</div>
          <p class="uc-name">${t ? U.esc(t.name) : '<span class="muted">Vacant</span>'}</p>
          <dl><div><dt>Rent</dt><dd>${t ? (t.exempt ? 'None' : U.money0(t.rent)) : '—'}</dd></div><div><dt>Due</dt><dd>${t && !t.exempt ? ordinal(t.dueDay) : '—'}</dd></div><div><dt>Deposit</dt><dd>${dep ? U.money0(dep) : '—'}</dd></div></dl>
          <p class="uc-foot">${U.esc(s.unit.size || '')}${t && t.moveIn ? ' · since ' + new Date(U.parseISO(t.moveIn)).getFullYear() : ''}${bal ? ` · <span class="c-late">owes ${U.money0(bal)}</span>` : ''}</p></a>`;
      }).join('')}</div>`).join('') : empty('No units yet', 'Import your workbook from Settings, or add the units one by one.', '<button class="btn btn-primary" id="uImp" type="button">Import the Excel workbook</button>')}`;
    U.$('#uAddUnit').onclick = () => F().unit();
    U.$('#uAddTen').onclick = () => F().tenant();
    const imp = U.$('#uImp'); if (imp) imp.onclick = () => global.Settings.importWorkbook();
  }
  const ordinal = (n) => { n = +n || 1; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  function unitDetail(view, u, p) {
    const year = +(p.y || M.defaultYear());
    const t = M.currentTenant(u.id) || M.tenantsOf(u.id).find((x) => !x.moveOut) || null;
    const upcoming = M.upcomingTenant(u.id);
    const past = M.tenantsOf(u.id).filter((x) => x !== t);
    const deps = D.deposits.filter((d) => d.unitId === u.id);
    const pays = D.payments.filter((x) => x.unitId === u.id);
    const exps = D.txns.filter((x) => x.unitId === u.id && x.type === 'expense');
    const strip = Array.from({ length: 12 }, (_, i) => { const k = `${year}-${String(i + 1).padStart(2, '0')}`; return M.rentStatus(u, k); });
    const bal = t ? M.tenantBalance(t) : 0;
    const idx = D.units.indexOf(u); const prev = D.units[idx - 1], next = D.units[idx + 1];
    view.innerHTML = `
      <div class="page-head"><div><a href="#/units" class="back">All units</a><h1>Unit ${U.esc(u.number)}</h1><p class="lede">${U.esc([u.size, u.sqft ? u.sqft + ' sq ft' : '', u.features].filter(Boolean).join(' · '))}</p></div>
        <div class="btn-row">${prev ? `<a class="btn btn-ghost btn-sm" href="#/units?id=${prev.id}">‹ ${U.esc(prev.number)}</a>` : ''}${next ? `<a class="btn btn-ghost btn-sm" href="#/units?id=${next.id}">${U.esc(next.number)} ›</a>` : ''}<button class="btn" id="udEdit" type="button">Edit unit</button><button class="btn btn-primary" id="udPay" type="button">Record rent</button></div></div>
      <section class="grid2 grid-wide-left">
        <div class="card">
          <div class="card-head"><h2>${t ? 'Current tenant' : 'Vacant'}</h2>${t ? '<button class="btn btn-sm" id="udEditT" type="button">Edit tenant</button>' : '<button class="btn btn-sm btn-primary" id="udNewT" type="button">Add tenant</button>'}</div>
          ${t ? `<p class="tenant-name">${U.esc(t.name)}</p>
          <dl class="facts facts-2">
            <div><dt>Phone</dt><dd>${t.phone ? `<a href="tel:${U.esc(t.phone.replace(/\D/g, ''))}">${U.esc(t.phone)}</a>` : '—'}${t.phone2 ? ` · <a href="tel:${U.esc(t.phone2.replace(/\D/g, ''))}">${U.esc(t.phone2)}</a>` : ''}</dd></div>
            <div><dt>Email</dt><dd>${t.email ? `<a href="mailto:${U.esc(t.email)}">${U.esc(t.email)}</a>` : '—'}</dd></div>
            <div><dt>Other contact</dt><dd>${U.esc(t.otherContact || '—')}</dd></div>
            <div><dt>Rent</dt><dd>${t.exempt ? 'No rent due' : U.money(t.rent) + ', due the ' + ordinal(t.dueDay)}</dd></div>
            <div><dt>Moved in</dt><dd>${t.moveIn ? U.fmtDate(t.moveIn) : 'Not recorded'}</dd></div>
            <div><dt>Lease ends</dt><dd>${t.leaseEnd ? U.fmtDate(t.leaseEnd) : 'Month to month / not recorded'}</dd></div>
            <div><dt>Owes</dt><dd class="${bal ? 'c-late' : ''}">${bal ? U.money(bal) : 'Nothing past due'}</dd></div>
          </dl>${t.notes ? `<p class="small">${U.esc(t.notes)}</p>` : ''}
          <div class="btn-row"><button class="btn btn-sm" id="udLegal" type="button">Legal documents</button><button class="btn btn-sm btn-ghost" id="udMoveOut" type="button">Move out…</button></div>
          ${(() => { const open = global.Legal ? Legal.tasks().filter((x) => x.tenant.id === t.id && x.state !== 'upcoming') : []; return open.length ? `<div class="callout callout-warn small">${open.map((x) => `${U.esc(x.title.split(' — ')[0])}: ${x.state === 'overdue' ? 'overdue since' : 'due'} ${U.fmtDate(x.due)}`).join('<br>')} · <a href="#/legal">Legal</a></div>` : ''; })()}` : `<p class="muted">No one is living here${upcoming ? `. ${U.esc(upcoming.name)} moves in ${U.fmtDate(upcoming.moveIn)}.` : '.'}</p>`}
        </div>
        <div class="card">
          <div class="card-head"><h2>Security deposit</h2><button class="btn btn-sm" id="udDep" type="button">Add deposit</button></div>
          ${deps.length ? `<ul class="list">${deps.map((d) => `<li><button type="button" class="linkrow" data-dep="${d.id}"><span><b>${U.money(d.amount)}</b><small>${d.date ? 'Received ' + U.fmtDate(d.date) : 'Date not recorded'}${d.tenantId && M.tenant(d.tenantId) ? ' · ' + U.esc(M.tenant(d.tenantId).name) : ''}</small></span><em>${d.returnedDate ? 'Returned ' + U.fmtDateShort(d.returnedDate) : 'Held'}</em></button></li>`).join('')}</ul>` : '<p class="muted">No deposit on file.</p>'}
          ${u.notes ? `<h3 class="form-h">Unit notes</h3><p class="small">${U.esc(u.notes)}</p>` : ''}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Rent in ${year}</h2>${yearSel(year, 'udYear')}</div>
        <div class="strip">${strip.map((s, i) => `<button type="button" class="strip-cell st-${ST_CLASS[s.status]}" data-m="${year}-${String(i + 1).padStart(2, '0')}" title="${U.esc(M.STATUS_LABEL[s.status])}"><span>${U.MONTHS[i]}</span><b>${s.paid ? U.money0(s.paid) : s.expected ? '—' : ''}</b></button>`).join('')}</div>
        <p class="small muted">Collected in ${year}: <b>${U.money(U.sum(pays.filter((x) => x.forMonth && x.forMonth.startsWith(String(year))), (x) => x.amount))}</b> · click a month to record or edit a payment.</p>
      </section>
      <section class="grid2">
        <div class="card"><div class="card-head"><h2>Payments</h2><span class="small muted">${pays.length}</span></div>
          ${pays.length ? `<table class="tbl tbl-tight"><thead><tr><th>Received</th><th>For</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${pays.slice(0, 40).map((x) => `<tr data-pay="${x.id}" class="clickable"><td>${U.fmtDate(x.date)}</td><td>${x.forMonth ? U.monthLabel(x.forMonth) : ''}</td><td>${U.esc(x.method || '')}${x.checkNo ? ' ' + U.esc(x.checkNo) : ''}</td><td class="num">${U.money(x.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No payments recorded.</p>'}</div>
        <div class="card"><div class="card-head"><h2>Repairs &amp; expenses for this unit</h2><button class="btn btn-sm" id="udExp" type="button">Add expense</button></div>
          ${exps.length ? `<table class="tbl tbl-tight"><thead><tr><th>Date</th><th>What</th><th class="num">Amount</th></tr></thead><tbody>${exps.map((x) => `<tr data-txn="${x.id}" class="clickable"><td>${U.fmtDate(x.date)}</td><td>${U.esc(U.titleCase(x.description))}</td><td class="num">${U.money(x.amount)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="2">Total</th><th class="num">${U.money(U.sum(exps, (x) => x.amount))}</th></tr></tfoot></table>` : '<p class="muted">Tag an expense with this unit to see it here.</p>'}</div>
      </section>
      ${past.length ? `<section class="card"><div class="card-head"><h2>Other tenants</h2></div><table class="tbl tbl-tight"><thead><tr><th>Name</th><th>Moved in</th><th>Moved out</th><th class="num">Rent</th></tr></thead><tbody>${past.map((x) => `<tr data-ten="${x.id}" class="clickable"><td>${U.esc(x.name)}</td><td>${U.fmtDate(x.moveIn) || '—'}</td><td>${U.fmtDate(x.moveOut) || (x.moveIn > U.todayISO() ? 'Upcoming' : '—')}</td><td class="num">${U.money(x.rent)}</td></tr>`).join('')}</tbody></table></section>` : ''}`;

    U.$('#udEdit').onclick = () => F().unit(u);
    U.$('#udPay').onclick = () => F().payment(null, { unitId: u.id });
    U.$('#udDep').onclick = () => F().deposit(null, { unitId: u.id, tenantId: t ? t.id : '' });
    U.$('#udExp').onclick = () => F().txn({ type: 'expense', unitId: u.id });
    U.$('#udYear').onchange = (e) => A().go('units', { id: u.id, y: e.target.value });
    if (t) {
      U.$('#udEditT').onclick = () => F().tenant(t);
      U.$('#udLegal').onclick = () => global.Legal.tenantDocs(t);
      U.$('#udMoveOut').onclick = async () => {
        const d = await U.prompt('Move out ' + t.name, 'Move-out date', { type: 'date', value: U.todayISO(), okLabel: 'Set move-out date', note: 'Their history stays with the unit. Afterwards, record the security deposit refund from the deposit card.' });
        if (d) await A().save({ ...t, moveOut: d }, { label: `${t.name} moved out of unit ${u.number}` });
      };
    } else U.$('#udNewT').onclick = () => F().tenant(null, { unitId: u.id });
    view.querySelector('.strip').onclick = (e) => {
      const c = e.target.closest('[data-m]'); if (!c) return;
      const list = M.paymentsFor(u.id, c.dataset.m);
      if (list.length === 1) F().payment(list[0]); else F().payment(null, { unitId: u.id, forMonth: c.dataset.m });
    };
    view.onclick = (e) => {
      const r = e.target.closest('[data-pay]'); if (r) F().payment(M.get(r.dataset.pay));
      const x = e.target.closest('[data-txn]'); if (x) F().txn(M.get(x.dataset.txn));
      const d = e.target.closest('[data-dep]'); if (d) F().deposit(M.get(d.dataset.dep));
      const tn = e.target.closest('[data-ten]'); if (tn) F().tenant(M.get(tn.dataset.ten));
    };
  }

  /* =========================================================
     RENT: units × months grid, like the workbook
     ========================================================= */
  function rent(view, p) {
    const year = +(p.y || A().rentYear || M.defaultYear()); A().rentYear = year;
    const mode = p.v || 'grid';
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const nowK = U.monthKey(U.todayISO());
    const grid = D.units.map((u) => ({ u, cells: months.map((k) => M.rentStatus(u, k)) }));
    const colPaid = months.map((k, i) => U.sum(grid, (r) => r.cells[i].paid));
    const colExp = months.map((k, i) => U.sum(grid, (r) => r.cells[i].expected));
    const totPaid = U.sum(colPaid), totExp = U.sum(colExp.filter((_, i) => months[i] <= nowK));
    const yearPays = D.payments.filter((x) => (x.forMonth || '').startsWith(String(year)));
    view.innerHTML = `
      <div class="page-head"><div><h1>Rent</h1><p class="lede">${year}: collected ${U.money0(totPaid)}${totExp ? ` of ${U.money0(totExp)} due so far (${U.pct(totPaid / totExp)})` : ''}</p></div>
        <div class="btn-row">${yearSel(year, 'rYear')}<div class="seg"><button type="button" data-v="grid" class="${mode === 'grid' ? 'on' : ''}">Grid</button><button type="button" data-v="list" class="${mode === 'list' ? 'on' : ''}">List</button></div><button class="btn" id="rBatch" type="button">Bank deposit</button><button class="btn btn-primary" id="rPay" type="button">Record rent</button></div></div>
      ${mode === 'grid' ? `<div class="card card-flush"><div class="tbl-scroll"><table class="tbl rent-grid"><thead><tr><th class="sticky">Unit</th>${months.map((k, i) => `<th class="num${k === nowK ? ' now' : ''}">${U.MONTHS[i]}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
        ${grid.map((r) => `<tr><th class="sticky"><a href="#/units?id=${r.u.id}">${U.esc(r.u.number)}</a><small>${U.esc(shortName((M.currentTenant(r.u.id) || M.tenantForMonth(r.u.id, months[11]) || {}).name || ''))}</small></th>${r.cells.map((s, i) => `<td class="rc st-${ST_CLASS[s.status]}${months[i] === nowK ? ' now' : ''}" data-u="${r.u.id}" data-m="${months[i]}" tabindex="0" title="${U.esc((s.tenant ? s.tenant.name + ' · ' : '') + M.STATUS_LABEL[s.status] + (s.expected ? ` · ${U.money(s.paid)} of ${U.money(s.expected)}` : ''))}">${s.paid ? U.money0(s.paid) : s.status === 'exempt' ? '<small>none</small>' : s.status === 'vacant' ? '<small>vacant</small>' : ''}</td>`).join('')}<td class="num"><b>${U.money0(U.sum(r.cells, (c) => c.paid))}</b></td></tr>`).join('')}
        </tbody><tfoot><tr><th class="sticky">Collected</th>${colPaid.map((v) => `<td class="num">${U.money0(v)}</td>`).join('')}<td class="num"><b>${U.money0(totPaid)}</b></td></tr><tr class="muted"><th class="sticky">Scheduled</th>${colExp.map((v) => `<td class="num">${U.money0(v)}</td>`).join('')}<td class="num">${U.money0(U.sum(colExp))}</td></tr></tfoot></table></div></div>
        <ul class="key key-inline"><li><i class="sw fw-paid"></i>Paid</li><li><i class="sw fw-partial"></i>Partly paid</li><li><i class="sw fw-due"></i>Not due yet / due</li><li><i class="sw fw-late"></i>Late (after ${D.settings.graceDays} grace days)</li><li><i class="sw fw-vacant"></i>Vacant</li></ul>`
      : `<div class="card card-flush"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Received</th><th>Unit</th><th>Tenant</th><th>For</th><th>Method</th><th>Check</th><th class="num">Amount</th></tr></thead><tbody>${yearPays.map((x) => `<tr class="clickable" data-pay="${x.id}"><td>${U.fmtDate(x.date)}</td><td>${U.esc((M.unit(x.unitId) || {}).number || '')}</td><td>${U.esc((M.tenant(x.tenantId) || {}).name || '')}</td><td>${x.forMonth ? U.monthLabel(x.forMonth) : ''}</td><td>${U.esc(x.method || '')}</td><td>${U.esc(x.checkNo || '')}</td><td class="num">${U.money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No payments for this year.</td></tr>'}</tbody><tfoot><tr><th colspan="6">Total</th><th class="num">${U.money(U.sum(yearPays, (x) => x.amount))}</th></tr></tfoot></table></div></div>`}`;
    U.$('#rYear').onchange = (e) => { A().rentYear = +e.target.value; A().go('rent', { y: e.target.value, v: mode }); };
    U.$$('.seg [data-v]', view).forEach((b) => b.onclick = () => A().go('rent', { y: year, v: b.dataset.v }));
    U.$('#rPay').onclick = () => F().payment();
    U.$('#rBatch').onclick = () => F().batch();
    const open = (td) => { const list = M.paymentsFor(td.dataset.u, td.dataset.m); if (list.length === 1) F().payment(list[0]); else if (list.length > 1) pickPayment(list, td.dataset.u, td.dataset.m); else F().payment(null, { unitId: td.dataset.u, forMonth: td.dataset.m }); };
    view.onclick = (e) => { const td = e.target.closest('td.rc'); if (td) open(td); const r = e.target.closest('[data-pay]'); if (r) F().payment(M.get(r.dataset.pay)); };
    view.onkeydown = (e) => { const td = e.target.closest('td.rc'); if (td && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(td); } };
  }
  async function pickPayment(list, unitId, k) {
    const r = await U.modal({ title: `${M.unitLabel(unitId)} · ${U.monthLabel(k, true)}`, body: `<ul class="list">${list.map((x) => `<li><button class="linkrow" type="button" data-id="${x.id}"><span><b>${U.money(x.amount)}</b><small>${U.fmtDate(x.date)} · ${U.esc(x.method || '')} ${U.esc(x.checkNo || '')}</small></span><em>Edit</em></button></li>`).join('')}</ul>`, buttons: [{ label: 'Add another payment', cls: 'btn-primary', value: 'new' }], onOpen: (b) => b.addEventListener('click', (e) => { const x = e.target.closest('[data-id]'); if (x) { U.closeModal(x.dataset.id); } }) });
    if (r === 'new') F().payment(null, { unitId, forMonth: k }); else if (r && M.get(r)) F().payment(M.get(r));
  }

  /* =========================================================
     INCOME & EXPENSES (the ledger)
     ========================================================= */
  const LF = { y: null, type: 'all', cat: '', ent: '', unit: '', q: '', review: false, sort: 'date', dir: -1, sel: new Set() };
  function ledger(view, p) {
    if (p.y) LF.y = +p.y; if (p.cat !== undefined) LF.cat = p.cat; if (p.type) LF.type = p.type; if (p.ent !== undefined) LF.ent = p.ent;
    LF.y = LF.y || M.defaultYear();
    const ys = String(LF.y);
    let rows = D.txns.filter((x) => (LF.y === 'all' || (x.date || '').startsWith(ys)));
    if (LF.type !== 'all') rows = rows.filter((x) => x.type === LF.type);
    if (LF.cat) rows = rows.filter((x) => x.category === LF.cat || (LF.cat.startsWith('g:') && (M.cat(x.category) || {}).group === LF.cat.slice(2)));
    if (LF.ent === 'others') rows = rows.filter((x) => !M.isBuilding(x)); else if (LF.ent) rows = rows.filter((x) => (x.entity || 'bldg') === LF.ent);
    if (LF.unit) rows = rows.filter((x) => x.unitId === LF.unit);
    if (LF.review) rows = rows.filter((x) => x.review);
    if (LF.q) { const q = U.norm(LF.q); rows = rows.filter((x) => U.norm([x.description, x.notes, x.ref, (M.vendor(x.vendorId) || {}).name, M.catName(x.category), String(x.amount)].join(' ')).includes(q)); }
    const key = { date: (x) => x.date, amount: (x) => +x.amount * (x.type === 'expense' ? -1 : 1), cat: (x) => M.catName(x.category), desc: (x) => x.description || '', ent: (x) => (M.entity(x.entity) || {}).short || '' }[LF.sort];
    rows.sort((a, b) => { const va = key(a), vb = key(b); return (va < vb ? -1 : va > vb ? 1 : 0) * LF.dir || (b.createdAt || 0) - (a.createdAt || 0); });
    const inc = U.sum(rows.filter((x) => x.type === 'income'), (x) => x.amount);
    const expB = U.sum(rows.filter((x) => x.type === 'expense' && M.isBuilding(x)), (x) => x.amount);
    const expO = U.sum(rows.filter((x) => x.type === 'expense' && !M.isBuilding(x)), (x) => x.amount);
    LF.sel = new Set([...LF.sel].filter((id) => rows.some((r) => r.id === id)));
    const th = (k, label, cls = '') => `<th class="${cls} sortable${LF.sort === k ? ' sorted' : ''}" data-sort="${k}">${label}${LF.sort === k ? (LF.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
    const catOptions = `<option value="">All categories</option>${M.groups().map((g) => `<option value="g:${U.esc(g)}"${LF.cat === 'g:' + g ? ' selected' : ''}>${U.esc(g)} (all)</option>${M.expenseCats().filter((c) => c.group === g).map((c) => `<option value="${c.id}"${LF.cat === c.id ? ' selected' : ''}>&nbsp;&nbsp;${U.esc(c.name)}</option>`).join('')}`).join('')}<optgroup label="Income">${M.incomeCats().map((c) => `<option value="${c.id}"${LF.cat === c.id ? ' selected' : ''}>${U.esc(c.name)}</option>`).join('')}</optgroup><optgroup label="Transfers">${M.TRANSFER_CATS.map((c) => `<option value="${c.id}"${LF.cat === c.id ? ' selected' : ''}>${U.esc(c.name)}</option>`).join('')}</optgroup>`;
    view.innerHTML = `
      <div class="page-head"><div><h1>Income &amp; expenses</h1><p class="lede">Everything except rent, which lives under Rent. Rent deposits appear here as transfers so the list matches the bank statement.</p></div>
        <div class="btn-row"><button class="btn" id="lInc" type="button">Add income</button><button class="btn btn-primary" id="lExp" type="button">Add expense</button></div></div>
      <div class="filters card">
        <select id="fY" aria-label="Year"><option value="all"${LF.y === 'all' ? ' selected' : ''}>All years</option>${M.yearsWithData().map((y) => `<option${+LF.y === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
        <div class="seg" id="fT">${[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income'], ['transfer', 'Transfers']].map(([v, l]) => `<button type="button" data-t="${v}" class="${LF.type === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <select id="fC" aria-label="Category">${catOptions}</select>
        <select id="fE" aria-label="Paid for"><option value="">Anyone</option><option value="others"${LF.ent === 'others' ? ' selected' : ''}>Not the building</option>${D.settings.entities.map((e) => `<option value="${e.id}"${LF.ent === e.id ? ' selected' : ''}>${U.esc(e.short)}</option>`).join('')}</select>
        <select id="fU" aria-label="Unit"><option value="">Any unit</option>${D.units.map((u) => `<option value="${u.id}"${LF.unit === u.id ? ' selected' : ''}>Unit ${U.esc(u.number)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="fR" ${LF.review ? 'checked' : ''}/><span>Needs review</span></label>
        <input type="search" id="fQ" placeholder="Search descriptions, vendors, amounts" value="${U.esc(LF.q)}"/>
      </div>
      <div class="totals"><span>${rows.length} entries</span><span>Income <b class="c-inc">${U.money(inc)}</b></span><span>Building expenses <b class="c-exp">${U.money(expB)}</b></span>${expO ? `<span>Paid for others <b>${U.money(expO)}</b></span>` : ''}<button type="button" class="btn btn-sm btn-ghost" id="lCsv">Download CSV</button></div>
      <div class="bulk ${LF.sel.size ? '' : 'hidden'}" id="bulk"><b>${LF.sel.size} selected</b><button class="btn btn-sm" data-bulk="cat" type="button">Set category</button><button class="btn btn-sm" data-bulk="ent" type="button">Set “paid for”</button><button class="btn btn-sm" data-bulk="ok" type="button">Mark reviewed</button><button class="btn btn-sm btn-danger-text" data-bulk="del" type="button">Delete</button><button class="btn btn-sm btn-ghost" data-bulk="none" type="button">Clear</button></div>
      <div class="card card-flush"><div class="tbl-scroll tbl-tall"><table class="tbl ledger"><thead><tr><th class="cb"><input type="checkbox" id="selAll" aria-label="Select all"/></th>${th('date', 'Date')}${th('desc', 'Description')}${th('cat', 'Category')}${th('ent', 'Paid for')}<th>Unit</th>${th('amount', 'Amount', 'num')}</tr></thead>
      <tbody>${rows.slice(0, 1500).map((x) => {
        const v = M.vendor(x.vendorId); const e = M.entity(x.entity); const sign = x.type === 'expense' ? '−' : x.type === 'income' ? '+' : x.direction === 'out' ? '−' : '+';
        return `<tr data-id="${x.id}" class="clickable t-${x.type}${!M.isBuilding(x) ? ' other' : ''}"><td class="cb"><input type="checkbox" data-cb="${x.id}" ${LF.sel.has(x.id) ? 'checked' : ''} aria-label="Select"/></td><td class="nowrap">${U.fmtDate(x.date)}</td>
          <td><span class="desc">${x.review ? '<i class="flag" title="Needs review"></i>' : ''}${x.fileId ? '<i class="clip" title="Receipt attached"></i>' : ''}${U.esc(U.titleCase(x.description || ''))}</span>${v || x.ref || x.notes ? `<small>${U.esc([v && v.name, x.ref, x.notes].filter(Boolean).join(' · '))}</small>` : ''}</td>
          <td><span class="cat">${U.esc(M.catName(x.category))}</span></td><td>${x.type === 'expense' ? `<span class="ent${e && e.building ? '' : ' ent-o'}">${U.esc(e ? e.short : '')}</span>` : ''}</td><td>${x.unitId ? U.esc((M.unit(x.unitId) || {}).number || '') : ''}</td>
          <td class="num amt">${sign}${U.money(x.amount)}</td></tr>`;
      }).join('') || `<tr><td colspan="7">${empty('Nothing here', 'No entries match these filters.')}</td></tr>`}</tbody></table></div></div>
      ${rows.length > 1500 ? '<p class="small muted">Showing the first 1,500. Narrow the filters to see the rest.</p>' : ''}`;
    const rer = () => A().render();
    U.$('#fY').onchange = (e) => { LF.y = e.target.value === 'all' ? 'all' : +e.target.value; rer(); };
    U.$('#fT').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { LF.type = b.dataset.t; rer(); } };
    U.$('#fC').onchange = (e) => { LF.cat = e.target.value; rer(); };
    U.$('#fE').onchange = (e) => { LF.ent = e.target.value; rer(); };
    U.$('#fU').onchange = (e) => { LF.unit = e.target.value; rer(); };
    U.$('#fR').onchange = (e) => { LF.review = e.target.checked; rer(); };
    U.$('#fQ').oninput = U.debounce((e) => { LF.q = e.target.value; rer(); }, 250);
    U.$('#lExp').onclick = () => F().txn({ type: 'expense' });
    U.$('#lInc').onclick = () => F().txn({ type: 'income' });
    U.$('#lCsv').onclick = () => csv(rows);
    U.$('#selAll').onchange = (e) => { rows.forEach((r) => e.target.checked ? LF.sel.add(r.id) : LF.sel.delete(r.id)); rer(); };
    view.querySelector('thead').onclick = (e) => { const t = e.target.closest('[data-sort]'); if (!t) return; if (LF.sort === t.dataset.sort) LF.dir *= -1; else { LF.sort = t.dataset.sort; LF.dir = t.dataset.sort === 'date' ? -1 : 1; } rer(); };
    view.querySelector('tbody').onclick = (e) => {
      const cb = e.target.closest('[data-cb]'); if (cb) { cb.checked ? LF.sel.add(cb.dataset.cb) : LF.sel.delete(cb.dataset.cb); const b = U.$('#bulk'); b.classList.toggle('hidden', !LF.sel.size); U.$('b', b).textContent = LF.sel.size + ' selected'; return; }
      if (e.target.closest('.cb')) return;
      const tr = e.target.closest('tr[data-id]'); if (tr) F().txn(M.get(tr.dataset.id));
    };
    U.$('#bulk').onclick = (e) => { const b = e.target.closest('[data-bulk]'); if (b) bulk(b.dataset.bulk); };
  }
  async function bulk(what) {
    const recs = [...LF.sel].map((id) => M.get(id)).filter(Boolean);
    if (what === 'none') { LF.sel.clear(); return A().render(); }
    if (what === 'del') { if (await U.confirm('Delete entries', `Delete ${recs.length} entries? You can undo right after.`, 'Delete', true)) { LF.sel.clear(); A().remove(recs.map((r) => r.id), recs.length + ' entries'); } return; }
    if (what === 'ok') { LF.sel.clear(); return A().save(recs.map((r) => ({ ...r, review: false })), { bulkLabel: 'Marked reviewed' }); }
    if (what === 'cat') {
      const v = await U.modal({ title: 'Set category', body: `<label class="field"><span>Category for ${recs.length} entries</span><select id="bc">${M.groups().map((g) => `<optgroup label="${U.esc(g)}">${M.expenseCats().filter((c) => c.group === g).map((c) => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</optgroup>`).join('')}<optgroup label="Income">${M.incomeCats().map((c) => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</optgroup></select></label>`, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Apply', cls: 'btn-primary', value: (b) => U.$('#bc', b).value }] });
      if (v) { const ty = M.cat(v).type; LF.sel.clear(); A().save(recs.map((r) => ({ ...r, category: v, type: ty })), { bulkLabel: 'Changed category to ' + M.catName(v) }); }
    }
    if (what === 'ent') {
      const v = await U.modal({ title: 'Set “paid for”', body: `<label class="field"><span>Who these ${recs.length} expenses were for</span><select id="be">${D.settings.entities.map((e) => `<option value="${e.id}">${U.esc(e.name)}</option>`).join('')}</select></label>`, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Apply', cls: 'btn-primary', value: (b) => U.$('#be', b).value }] });
      if (v) { LF.sel.clear(); A().save(recs.map((r) => ({ ...r, entity: v })), { bulkLabel: 'Set paid for ' + M.entity(v).short }); }
    }
  }
  function csv(rows) {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Date', 'Type', 'Description', 'Vendor', 'Category', 'Group', 'Paid for', 'Unit', 'Reference', 'Notes', 'Needs review', 'Review note', 'Amount'].map(q).join(',')];
    rows.forEach((x) => lines.push([x.date, x.type, x.description, (M.vendor(x.vendorId) || {}).name, M.catName(x.category), (M.cat(x.category) || {}).group, (M.entity(x.entity) || {}).name, (M.unit(x.unitId) || {}).number, x.ref, x.notes, x.review ? 'yes' : '', x.reviewNote, (x.type === 'expense' || x.direction === 'out' ? -1 : 1) * x.amount].map(q).join(',')));
    U.download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), `ledger-${U.stamp()}.csv`);
  }

  /* =========================================================
     NEEDS REVIEW
     ========================================================= */
  function review(view) {
    const list = M.reviewQueue().sort((a, b) => b.amount - a.amount);
    const total = U.sum(list, (x) => x.amount);
    view.innerHTML = `
      <div class="page-head"><div><h1>Needs review</h1><p class="lede">${list.length ? `${list.length} entries totaling ${U.money0(total)} have a question attached. Settle each one, then mark it reviewed.` : 'Nothing is waiting.'}</p></div></div>
      ${list.length ? `<div class="review-list">${list.map((x) => {
        const e = M.entity(x.entity);
        return `<article class="card review" data-id="${x.id}">
          <div class="rv-main"><p class="rv-amt">${U.money(x.amount)}</p><div><h3>${U.esc(U.titleCase(x.description))}</h3><p class="small muted">${U.fmtDate(x.date)} · ${U.esc(M.catName(x.category))}${x.type === 'expense' ? ' · paid for ' + U.esc(e ? e.short : '') : ''}${x.ref ? ' · ' + U.esc(x.ref) : ''}</p>
          <p class="rv-q">${U.esc(x.reviewNote || 'Flagged for review.')}</p></div></div>
          <div class="rv-act">${x.type === 'expense' ? `<select data-ent aria-label="Paid for">${D.settings.entities.map((en) => `<option value="${en.id}"${(x.entity || 'bldg') === en.id ? ' selected' : ''}>${U.esc(en.short)}</option>`).join('')}</select>
            <select data-cat aria-label="Category">${M.groups().map((g) => `<optgroup label="${U.esc(g)}">${M.expenseCats().filter((c) => c.group === g).map((c) => `<option value="${c.id}"${c.id === x.category ? ' selected' : ''}>${U.esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select>` : ''}
            <button class="btn btn-sm" data-open type="button">Open</button><button class="btn btn-sm btn-primary" data-ok type="button">Mark reviewed</button></div></article>`;
      }).join('')}</div>` : empty('All clear', 'When you flag an entry “needs review”, or an import finds something uncertain, it shows up here.')}`;
    view.onclick = async (e) => {
      const card = e.target.closest('[data-id]'); if (!card) return; const x = M.get(card.dataset.id); if (!x) return;
      if (e.target.closest('[data-open]')) F().txn(x);
      if (e.target.closest('[data-ok]')) { const ent = U.$('[data-ent]', card), cat = U.$('[data-cat]', card); await A().save({ ...x, review: false, entity: ent ? ent.value : x.entity, category: cat ? cat.value : x.category }, { label: 'Reviewed: ' + x.description }); U.toast('Marked reviewed.', 'ok'); }
    };
  }

  Object.assign((global.__pages = global.__pages || {}), { overview, units, rent, ledger, review });
  global.Pages = { facade, chip, ST_CLASS, yearSel, empty, shortName, wireFacade, ordinal };
  void App;
})(window);
