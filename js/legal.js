/* =========================================================
   Legal: leases, move-in deposit letters, 3-day notices,
   lease extensions — deadlines, Word documents and reminders.
   Documents are filled from templates/*.docx (or your own
   uploaded versions) and downloaded as Word files.
   ========================================================= */
(function (global) {
  'use strict';
  const { U, M } = global;
  const D = M.D;
  const A = () => global.App;

  /* ---------------- the documents ---------------- */
  const DOCS = {
    lease: { title: 'Lease Agreement', file: 'lease.docx' },
    rules: { title: 'Rules and Regulations (Exhibit A)', file: 'rules-and-regulations.docx', fixed: true },
    deposit: { title: 'Security deposit letter', file: 'security-deposit-letter.docx' },
    statute: { title: 'Florida Statute §83.49', file: 'statute-83-49.docx', fixed: true },
    threeday: { title: 'Three-day notice', file: 'three-day-notice.docx' },
    extension: { title: 'Extension of Lease Agreement', file: 'lease-extension.docx' },
    renewal: { title: 'New lease cover letter', file: 'renewal-letter.docx' }
  };
  /* documents that go out together */
  const PACKETS = {
    lease: { title: 'New lease', docs: ['lease', 'rules'], verb: 'signed' },
    movein: { title: 'Security deposit letter and §83.49', docs: ['deposit', 'statute'], verb: 'sent' },
    threeday: { title: 'Three-day notice', docs: ['threeday'], verb: 'served' },
    extension: { title: 'Lease extension', docs: ['extension', 'renewal'], verb: 'signed' }
  };
  const DEFAULTS = () => ({
    landlordName: '', landlordStreet: '', landlordCity: '', landlordPhone: '', landlordFax: '',
    lessorStreet: '', lessorCity: '', signerName: '', signerTitle: 'President', paymentAddress: '',
    attorneyName: '', attorneyStreet: '', attorneyCity: '', attorneyPhone: '',
    bankName: '', bankAddress: '', bankAccount: '', bankAccountTitle: '',
    trackFrom: U.todayISO(), moveInDays: 5, extensionDays: 30, noticeAfterDays: 3, extraHolidays: ''
  });
  const S = () => {
    if (!D.settings.legal) D.settings.legal = DEFAULTS();
    const d = DEFAULTS(); for (const k of Object.keys(d)) if (D.settings.legal[k] === undefined) D.settings.legal[k] = d[k];
    return D.settings.legal;
  };

  /* ---------------- words, dates, holidays ---------------- */
  const ONES = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function words(n) {
    n = Math.floor(Math.abs(+n || 0));
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + words(n % 100) : '');
    for (const [v, name] of [[1e9, 'BILLION'], [1e6, 'MILLION'], [1e3, 'THOUSAND']]) if (n >= v) return words(Math.floor(n / v)) + ' ' + name + (n % v ? ' ' + words(n % v) : '');
    return String(n);
  }
  /** "ONE THOUSAND TWO HUNDRED FIFTY and NO/100" */
  const amountWords = (x) => { const c = Math.round((+x || 0) * 100); const cents = c % 100; return `${words(Math.floor(c / 100))} and ${cents ? String(cents).padStart(2, '0') : 'NO'}/100`; };
  const money = (x) => '$' + (+x || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const long = (iso) => { const d = U.parseISO(iso); return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
  const ord = (n) => { n = +n; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const addYears = (iso, n) => { const d = U.parseISO(iso); if (!d) return ''; const t = new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); if (t.getMonth() !== d.getMonth()) t.setDate(0); return U.toISO(t); };
  const caps = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

  /** US federal holidays + the day after Thanksgiving (observed dates), plus any added in Settings. */
  function holidays(year) {
    const out = new Set();
    const nth = (m, wd, n) => { const d = new Date(year, m, 1); while (d.getDay() !== wd) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 7 * (n - 1)); return d; };
    const last = (m, wd) => { const d = new Date(year, m + 1, 0); while (d.getDay() !== wd) d.setDate(d.getDate() - 1); return d; };
    const fixed = (m, day) => { const d = new Date(year, m, day); if (d.getDay() === 6) d.setDate(d.getDate() - 1); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d; };
    const tg = nth(10, 4, 4); const fri = new Date(tg); fri.setDate(tg.getDate() + 1);
    [fixed(0, 1), nth(0, 1, 3), nth(1, 1, 3), last(4, 1), ...(year >= 2021 ? [fixed(5, 19)] : []), fixed(6, 4), nth(8, 1, 1), nth(9, 1, 2), fixed(10, 11), tg, fri, fixed(11, 25)].forEach((d) => out.add(U.toISO(d)));
    String(S().extraHolidays || '').split(/[\s,;]+/).map(U.toISO).filter(Boolean).forEach((d) => out.add(d));
    return out;
  }
  const isHoliday = (iso) => holidays(+iso.slice(0, 4)).has(iso);
  const isBusiness = (iso) => { const d = U.parseISO(iso).getDay(); return d !== 0 && d !== 6 && !isHoliday(iso); };
  /** Last day to pay: N business days after delivery (not counting the day of delivery). */
  function noticeDeadline(deliveryISO, n = 3) { let d = deliveryISO, k = 0; while (k < n) { d = U.addDays(d, 1); if (isBusiness(d)) k++; } return d; }

  /* ---------------- tenants ---------------- */
  const legalNames = (t) => caps(t.legalNames || t.name);
  const leaseStart = (t) => t.leaseStart || t.moveIn || '';
  const unitOf = (t) => M.unit(t.unitId) || {};
  const recordsFor = (key) => D.legal.filter((r) => r.key === key);
  const doneStatuses = { lease: ['signed', 'skipped'], movein: ['sent', 'skipped'], threeday: ['served', 'skipped'], extension: ['signed', 'skipped'] };
  const isDone = (key, packet) => recordsFor(key).some((r) => doneStatuses[packet].includes(r.status));
  const latest = (key) => recordsFor(key).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;

  /* ---------------- what is due ---------------- */
  function tasks(today) {
    today = today || U.todayISO();
    const s = S(); const from = s.trackFrom || today; const out = [];
    const push = (t) => { t.state = t.due < today ? 'overdue' : t.due <= U.addDays(today, 7) ? 'due' : 'upcoming'; t.record = latest(t.key); out.push(t); };
    D.tenants.forEach((t) => {
      const u = unitOf(t); if (!u.id) return;
      const apt = u.number;
      const active = !t.moveOut || t.moveOut >= today;
      /* new lease + rules, for tenants moving in from the start date on */
      if (t.moveIn && t.moveIn >= from && !isDone('lease:' + t.id, 'lease')) push({ key: 'lease:' + t.id, packet: 'lease', tenant: t, unit: u, due: t.moveIn, title: `Lease and rules — Apt ${apt}`, sub: `${t.name} moves in ${U.fmtDate(t.moveIn)}` });
      /* deposit letter + 83.49 within N days of move-in */
      if (t.moveIn && t.moveIn >= from && !isDone('movein:' + t.id, 'movein')) push({ key: 'movein:' + t.id, packet: 'movein', tenant: t, unit: u, due: U.addDays(t.moveIn, +s.moveInDays || 5), title: `Security deposit letter and §83.49 — Apt ${apt}`, sub: `Send within ${s.moveInDays} days of move-in (${U.fmtDate(t.moveIn)}). Florida law allows at most 30 days.` });
      if (!active || t.exempt) return;
      /* yearly extension, one month before each lease anniversary */
      const start = leaseStart(t);
      if (start) {
        let ann = t.leaseEnd ? U.addDays(t.leaseEnd, 1) : addYears(start, 1);
        let guard = 0;
        while (ann && ann < from && guard++ < 80) ann = addYears(ann, 1);
        // only the latest missed anniversary matters; older ones were handled outside the app
        while (ann && U.addDays(addYears(ann, 1), -(+s.extensionDays || 30)) <= today && guard++ < 160) ann = addYears(ann, 1);
        while (ann && U.addDays(ann, -(+s.extensionDays || 30)) <= U.addDays(today, 60) && guard++ < 90) {
          const key = `extension:${t.id}:${ann}`;
          if (!isDone(key, 'extension') && !(t.moveOut && t.moveOut < ann)) push({ key, packet: 'extension', tenant: t, unit: u, due: U.addDays(ann, -(+s.extensionDays || 30)), term: { start: ann, end: U.addDays(addYears(ann, 1), -1) }, title: `Lease extension — Apt ${apt}`, sub: `New term ${U.fmtDate(ann)} to ${U.fmtDate(U.addDays(addYears(ann, 1), -1))}` });
          ann = addYears(ann, 1);
        }
      }
      /* three-day notice when rent is unpaid N days after the due date — one notice covers every unpaid month */
      const rentFrom = [U.monthKey(from), M.trackFrom()].filter(Boolean).sort().pop();
      const covered = new Set(D.legal.filter((r) => r.packet === 'threeday' && r.tenantId === t.id && ['served', 'skipped'].includes(r.status)).flatMap((r) => r.months || (r.month ? [r.month] : [])));
      const unpaid = [];
      for (let k = rentFrom, n = 0; k && k <= U.monthKey(today) && n < 60; k = U.addMonths(k, 1), n++) {
        const st = M.rentStatus(u, k, today);
        if (!st.tenant || st.tenant.id !== t.id || !st.expected || st.paid >= st.expected - 0.005) continue;
        if (today < U.addDays(st.due, +s.noticeAfterDays || 3) || st.due < from || covered.has(k)) continue;
        unpaid.push({ k, st });
      }
      if (unpaid.length) {
        const first = unpaid[0], lastM = unpaid[unpaid.length - 1];
        const owed = U.round2(U.sum(unpaid, (x) => x.st.balance));
        push({ key: `threeday:${t.id}:${first.k}`, packet: 'threeday', tenant: t, unit: u, due: U.addDays(first.st.due, +s.noticeAfterDays || 3), month: first.k, months: unpaid.map((x) => x.k), owed,
          title: `Three-day notice — Apt ${apt}`, sub: unpaid.length === 1 ? `${U.monthLabel(first.k, true)} rent: ${U.money(owed)} unpaid (due ${U.fmtDate(first.st.due)})` : `${unpaid.length} months unpaid, ${U.monthLabel(first.k)} to ${U.monthLabel(lastM.k)}: ${U.money(owed)}` });
      }
    });
    /* served notices whose deadline passed while rent is still owed */
    D.legal.filter((r) => r.packet === 'threeday' && r.status === 'served' && r.deadline && r.deadline < today && !r.followUpDone).forEach((r) => {
      const t = M.tenant(r.tenantId); const u = M.unit(r.unitId); if (!t || !u) return;
      const owed = owedFor(r, today);
      if (owed < 0.01) return;
      out.push({ key: 'evict:' + r.id, packet: 'evict', tenant: t, unit: u, due: U.addDays(r.deadline, 1), state: 'overdue', record: r, title: `Notice deadline passed — Apt ${u.number}`, sub: `The three-day notice expired ${U.fmtDate(r.deadline)} and ${U.money(owed)} is still owed. Talk to the attorney about filing for eviction.` });
    });
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }
  /** Rent still owed for the months a served notice covers. */
  function owedFor(r, today) { const u = M.unit(r.unitId); if (!u) return 0; return U.round2(U.sum(r.months || (r.month ? [r.month] : []), (k) => M.rentStatus(u, k, today).balance)); }
  const actionable = (today) => tasks(today).filter((t) => t.state !== 'upcoming');

  /* ---------------- signatures ---------------- */
  const SIG_FONTS = [['dancing-script', 'Dancing Script'], ['great-vibes', 'Great Vibes'], ['allura', 'Allura'], ['alex-brush', 'Alex Brush'], ['sacramento', 'Sacramento'], ['pinyon-script', 'Pinyon Script'], ['homemade-apple', 'Homemade Apple'], ['mrs-saint-delafield', 'Mrs Saint Delafield']];
  const SIG_ROLES = { signer: { label: 'Signs for the Lessor', where: 'Security deposit letter (By: line)', nameKey: 'signerName' }, landlord: { label: 'Landlord', where: 'New lease cover letter', nameKey: 'landlordName' }, attorney: { label: 'Attorney', where: 'Three-day notice (attorney’s line)', nameKey: 'attorneyName' } };
  const sigs = () => { const s = S(); if (!s.signatures) s.signatures = {}; return s.signatures; };
  const loadedFonts = {};
  async function loadSigFont(id) {
    if (loadedFonts[id]) return loadedFonts[id];
    const f = new FontFace('vcsig-' + id, `url(fonts/signatures/${id}.woff2)`);
    loadedFonts[id] = f.load().then((ff) => { document.fonts.add(ff); return ff; });
    return loadedFonts[id];
  }
  /** Draw a typed name in a cursive font; returns a transparent PNG data URL. */
  async function typedSignature(name, font) {
    await loadSigFont(font);
    const W = 1200, H = 320; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let size = 190; g.font = `${size}px "vcsig-${font}"`;
    while (g.measureText(name).width > W - 80 && size > 40) { size -= 6; g.font = `${size}px "vcsig-${font}"`; }
    g.fillStyle = '#1b2a4e'; g.textBaseline = 'middle'; g.fillText(name, 40, H / 2 + 10);
    return trimCanvas(c);
  }
  /** Crop a canvas to its ink, with a small margin. */
  function trimCanvas(c) {
    const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return c.toDataURL('image/png');
    const m = 12; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width - 1, x1 + m); y1 = Math.min(c.height - 1, y1 + m);
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  /** A photo or scan of a signature on white paper → ink only on a transparent background. */
  async function cleanSignaturePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read. Use a JPG or PNG.')); i.src = url; });
      const sc = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const id = g.getImageData(0, 0, c.width, c.height); const d = id.data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      const paper = sum / (d.length / 4); const cut = Math.min(200, paper - 45);
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > cut) d[i + 3] = 0; else { const k = Math.max(0, Math.min(1, (cut - l) / 60)); d[i] = 22; d[i + 1] = 32; d[i + 2] = 64; d[i + 3] = Math.round(255 * Math.max(.35, k)); } }
      g.putImageData(id, 0, 0);
      return trimCanvas(c);
    } finally { URL.revokeObjectURL(url); }
  }
  /** The signature picture for a role, or null when none is set. */
  async function signatureFor(role) {
    const sg = sigs()[role]; if (!sg || sg.mode === 'none' || !sg.mode) return null;
    if (sg.mode === 'image' && sg.image) return sg.image;
    if (sg.mode === 'typed') { const nm = sg.name || S()[SIG_ROLES[role].nameKey]; if (nm) return typedSignature(nm.replace(/,?\s*Esq\.?$/i, ''), sg.font || 'great-vibes'); }
    return null;
  }
  const dataUrlBytes = (u) => Uint8Array.from(atob(u.split(',').pop()), (ch) => ch.charCodeAt(0));
  const imgSize = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([600, 160]); i.src = u; });

  /* ---------------- filling a Word template ---------------- */
  async function templateBytes(kind) {
    const custom = D.files.find((f) => f.id === 'tpl-' + kind);
    if (custom && custom.data) { const b64 = custom.data.split(',').pop(); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
    const r = await fetch('templates/' + DOCS[kind].file, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`The template templates/${DOCS[kind].file} is missing. Upload the templates folder to GitHub.`);
    return new Uint8Array(await r.arrayBuffer());
  }
  const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  async function fill(kind, tags) {
    await A().loadLib('zip');
    const zip = await global.JSZip.loadAsync(await templateBytes(kind));
    const missing = new Set();
    /* signatures: {sig_role} is replaced by a picture, or removed when none is set */
    let docXml = await zip.file('word/document.xml').async('string');
    const sigTags = [...new Set((docXml.match(/\{sig_([a-z]+)\}/g) || []).map((m) => m.slice(5, -1)))];
    let added = 0;
    for (const role of sigTags) {
      const want = tags['sig_' + role];
      const dataUrl = want ? await signatureFor(role) : null;
      const runRx = new RegExp('<w:r\\b(?:(?!<w:r\\b).)*?\\{sig_' + role + '\\}.*?</w:r>', 's');
      if (!dataUrl) { docXml = docXml.replace(runRx, '<w:r><w:t></w:t></w:r>'); continue; }
      const [pw, ph] = await imgSize(dataUrl);
      const maxW = 2.1 * 914400, maxH = 0.62 * 914400; const k = Math.min(maxW / pw, maxH / ph); const cx = Math.round(pw * k), cy = Math.round(ph * k);
      const rid = 'rIdVcSig' + role; const media = `media/vc-signature-${role}.png`; added++;
      zip.file('word/' + media, dataUrlBytes(dataUrl));
      let rels = await zip.file('word/_rels/document.xml.rels').async('string');
      if (!rels.includes(`Id="${rid}"`)) rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${media}"/></Relationships>`);
      zip.file('word/_rels/document.xml.rels', rels);
      const nid = 9100 + added;
      const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${nid}" name="Signature ${role}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${nid}" name="signature-${role}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      docXml = docXml.replace(runRx, drawing);
    }
    if (added) {
      let ct = await zip.file('[Content_Types].xml').async('string');
      if (!/Extension="png"/i.test(ct)) ct = ct.replace('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">', '$&<Default Extension="png" ContentType="image/png"/>');
      zip.file('[Content_Types].xml', ct);
    }
    zip.file('word/document.xml', docXml);
    for (const name of Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))) {
      let xml = await zip.file(name).async('string');
      xml = xml.replace(/\{([a-z_]+)\}/g, (m, k) => {
        if (!(k in tags)) { missing.add(k); return m; }
        return xmlEsc(tags[k]).split('\n').join('</w:t><w:br/><w:t xml:space="preserve">');
      });
      xml = xml.replace(/<w:t>/g, '<w:t xml:space="preserve">');
      zip.file(name, xml);
    }
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return { blob, missing: [...missing] };
  }

  /* ---------------- the fields of each document ---------------- */
  function common(v) {
    const s = S();
    return {
      tenants_caps: caps(v.names), apt: v.apt,
      landlord_name: s.landlordName, landlord_street: s.landlordStreet, landlord_city: s.landlordCity, landlord_phone: s.landlordPhone, landlord_fax: s.landlordFax ? s.landlordFax + ' (Facsimile)' : '',
      lessor_street: s.lessorStreet, lessor_city: s.lessorCity, signer_caps: caps(s.signerName), signer_title: s.signerTitle,
      payment_address: s.paymentAddress, attorney_name: s.attorneyName, attorney_street: s.attorneyStreet, attorney_city: s.attorneyCity, attorney_phone: s.attorneyPhone,
      bank_name: s.bankName, bank_address: s.bankAddress, bank_account: s.bankAccount, bank_account_title: caps(s.bankAccountTitle)
    };
  }
  const SETTINGS_NEEDED = {
    lease: ['signerName', 'paymentAddress'], deposit: ['lessorStreet', 'lessorCity', 'signerName', 'bankName', 'bankAddress', 'bankAccount', 'bankAccountTitle'],
    threeday: ['attorneyName', 'attorneyStreet', 'attorneyCity', 'attorneyPhone', 'landlordName', 'landlordStreet', 'landlordCity', 'landlordPhone'],
    extension: ['signerName'], renewal: ['landlordName', 'landlordStreet', 'landlordCity', 'landlordPhone']
  };
  const SETTING_LABEL = { signerName: 'person who signs for the Lessor', paymentAddress: 'address where rent is paid', lessorStreet: 'Lessor street address', lessorCity: 'Lessor city/state/ZIP', bankName: 'deposit bank', bankAddress: 'bank address', bankAccount: 'deposit account number', bankAccountTitle: 'account title', attorneyName: 'attorney name', attorneyStreet: 'attorney street', attorneyCity: 'attorney city', attorneyPhone: 'attorney phone', landlordName: 'landlord name', landlordStreet: 'landlord street', landlordCity: 'landlord city', landlordPhone: 'landlord phone' };

  /** Inputs shown in the dialog for a packet, prefilled from the tenant, unit and task. */
  function inputsFor(packet, t, u, task) {
    const s = S(); const today = U.todayISO();
    const dep = U.sum(D.deposits.filter((d) => d.tenantId === t.id && !d.returnedDate), (d) => d.amount) || null;
    const base = [{ k: 'names', label: 'Tenant name(s) as they appear on the lease', value: legalNames(t), wide: true }, { k: 'apt', label: 'Apartment', value: u.number }];
    if (packet === 'lease') {
      const start = t.leaseStart || t.moveIn || today;
      const people = (+t.adults || 0) + (+t.children || 0) || null;
      return [...base,
        { k: 'signDate', label: 'Date signed', type: 'date', value: today }, { k: 'termStart', label: 'Lease begins', type: 'date', value: start }, { k: 'termEnd', label: 'Lease ends', type: 'date', value: t.leaseEnd || U.addDays(addYears(start, 1), -1) },
        { k: 'monthly', label: 'Monthly rent', type: 'money', value: t.rent }, { k: 'firstPayment', label: 'First rent payment', type: 'date', value: start }, { k: 'deposit', label: 'Security deposit', type: 'money', value: dep },
        { k: 'adults', label: 'Adults', type: 'number', value: t.adults ?? '' }, { k: 'children', label: 'Children', type: 'number', value: t.children ?? 0 }, { k: 'parking', label: 'Parking space No.', value: t.parking || '' },
        { k: 'maxPersons', label: 'Most people allowed', type: 'number', value: t.maxPersons || people || '' }, { k: 'authorized', label: 'Authorized persons', type: 'number', value: t.authorized || people || '' }];
    }
    if (packet === 'movein') return [...base, { k: 'letterDate', label: 'Letter date', type: 'date', value: today }, { k: 'deposit', label: 'Total security deposit', type: 'money', value: dep }, { k: 'depositNow', label: 'Amount deposited now (if only part was paid earlier)', type: 'money', value: dep }];
    if (packet === 'threeday') {
      const months = task && task.months ? task.months : [U.monthKey(today)];
      const k = months[0], kl = months[months.length - 1]; const st = M.rentStatus(u, k, today);
      const owed = task && task.owed ? task.owed : (st.balance || st.expected);
      const deliver = today;
      return [...base, { k: 'month', label: 'First unpaid month', type: 'month', value: k }, { k: 'dueDate', label: 'Rent was due on', type: 'date', value: st.due }, { k: 'amount', label: 'Rent owed (rent only, no late fees)', type: 'money', value: owed, note: months.length > 1 ? `Covers ${months.length} unpaid months.` : '' },
        { k: 'periodStart', label: 'Rental period from', type: 'date', value: k + '-01' }, { k: 'periodEnd', label: 'to midnight of', type: 'date', value: U.monthEnd(kl) },
        { k: 'noticeDate', label: 'Notice date', type: 'date', value: today }, { k: 'delivery', label: 'Will be delivered on', type: 'date', value: deliver }, { k: 'deadline', label: 'Pay or leave by (3 business days)', type: 'date', value: noticeDeadline(deliver, 3), note: 'Skips weekends and legal holidays. Recalculated when the delivery date changes.' }];
    }
    if (packet === 'extension') {
      const term = task && task.term ? task.term : { start: t.leaseEnd ? U.addDays(t.leaseEnd, 1) : addYears(leaseStart(t) || today, 1) }; if (!term.end) term.end = U.addDays(addYears(term.start, 1), -1);
      return [...base, { k: 'leaseDate', label: 'Date of the original lease', type: 'date', value: leaseStart(t) }, { k: 'termStart', label: 'Extension begins', type: 'date', value: term.start }, { k: 'termEnd', label: 'Extension ends', type: 'date', value: term.end },
        { k: 'monthly', label: 'Monthly rent for the new term', type: 'money', value: t.rent, note: `Current rent ${U.money(t.rent)}.` }, { k: 'firstPayment', label: 'First payment of the new term', type: 'date', value: term.start },
        { k: 'letterDate', label: 'Cover letter date', type: 'date', value: today }, { k: 'respondBy', label: 'Ask for a reply by', type: 'date', value: [U.addDays(today, 21), U.addDays(term.start, -7)].sort()[0] }, { k: 'salutation', label: 'Cover letter greeting (Dear …)', value: t.salutation || 'Tenants' }];
    }
    return base;
  }
  const DOC_SIG = { threeday: 'attorney', deposit: 'signer', renewal: 'landlord' };
  function tagsFor(kind, v) {
    const c = common(v);
    c['sig_' + (DOC_SIG[kind] || 'none')] = !!v._sign;
    switch (kind) {
      case 'lease': { const sd = U.parseISO(v.signDate) || new Date(); const fp = U.parseISO(v.firstPayment) || new Date(); return { ...c, sign_day: ord(sd.getDate()), sign_month: U.MONTHS_LONG[sd.getMonth()], sign_year: String(sd.getFullYear()), term_start: long(v.termStart), term_end: long(v.termEnd), total_words: amountWords((+v.monthly || 0) * 12), total_amount: money((+v.monthly || 0) * 12), monthly_amount: money(v.monthly), first_day: ord(fp.getDate()), first_month: U.MONTHS_LONG[fp.getMonth()], first_year: String(fp.getFullYear()), deposit_words: amountWords(v.deposit), deposit_amount: money(v.deposit), adults: String(+v.adults || 0), adults_words: words(v.adults), children: String(+v.children || 0), children_words: words(v.children), max_persons: String(+v.maxPersons || 0), max_persons_words: words(v.maxPersons), authorized: String(+v.authorized || 0), authorized_words: words(v.authorized), parking: v.parking || '________' }; }
      case 'deposit': { const part = +v.depositNow && +v.depositNow < +v.deposit - 0.005; return { ...c, letter_date: long(v.letterDate), deposit_words: amountWords(v.deposit), deposit_amount: money(v.deposit), deposit_sentence: part ? `You had already tendered part of said security deposit, only that amount had been deposited.  The remaining amount of your security deposit in the sum of ${amountWords(v.depositNow)} DOLLARS (${money(v.depositNow)}) has now been deposited by the Landlord` : 'Your security deposit has been deposited by the Landlord' }; }
      case 'threeday': { const dl = U.parseISO(v.deadline) || new Date(); const dv = U.parseISO(v.delivery) || new Date(); return { ...c, notice_date: long(v.noticeDate), due_date: long(v.dueDate), amount_words: amountWords(v.amount), amount: money(v.amount), period_start: long(v.periodStart), period_end: long(v.periodEnd), deadline_day: ord(dl.getDate()), deadline_month_year: `${U.MONTHS_LONG[dl.getMonth()]}, ${dl.getFullYear()}`, serve_month_year: `${U.MONTHS_LONG[dv.getMonth()]}, ${dv.getFullYear()}` }; }
      case 'extension': return { ...c, lease_date: long(v.leaseDate), term_start: long(v.termStart), term_end: long(v.termEnd), total_words: amountWords((+v.monthly || 0) * 12), total_amount: money((+v.monthly || 0) * 12), monthly_words: amountWords(v.monthly), monthly_amount: money(v.monthly), first_payment: long(v.firstPayment) };
      case 'renewal': return { ...c, letter_date: long(v.letterDate), respond_by: long(v.respondBy), salutation: v.salutation || 'Tenants' };
      default: return c;
    }
  }
  const fileName = (kind, v) => `Apt ${v.apt} - ${DOCS[kind].title.replace(/[§()]/g, '').replace(/\s+/g, ' ').trim()} - ${(v.names || '').split(/[ ,]/)[0].replace(/[^\w-]/g, '')} ${U.todayISO()}.docx`.replace(/\s+/g, ' ');

  /* ---------------- dialogs ---------------- */
  const METHODS = { movein: ['Hand delivered', 'Mailed', 'Certified mail', 'E-mailed'], lease: ['Signed in person', 'Mailed', 'E-mailed'], extension: ['Hand delivered', 'Mailed', 'E-mailed'], threeday: ['Individual service', 'Substitute service', 'Posted on the front door'] };

  /** Create the documents of a packet: prefilled form → Word files → record. */
  async function create(packet, tenant, task) {
    const t = tenant; const u = unitOf(t); const P = PACKETS[packet];
    const ins = inputsFor(packet, t, u, task);
    const s = S();
    const needs = [...new Set(P.docs.flatMap((k) => SETTINGS_NEEDED[k] || []))].filter((k) => !String(s[k] || '').trim());
    const prev = task && task.record && task.record.inputs ? task.record.inputs : null;
    if (prev) ins.forEach((f) => { if (prev[f.k] !== undefined) f.value = prev[f.k]; });
    const field = (f) => {
      const type = f.type === 'money' ? 'text" inputmode="decimal' : f.type || 'text';
      return `<label class="field${f.wide ? ' span2' : ''}"><span>${U.esc(f.label)}</span>${f.type === 'money' ? `<span class="money-in"><i>$</i><input name="${f.k}" data-type="money" inputmode="decimal" value="${f.value ?? ''}"/></span>` : `<input name="${f.k}" type="${type}" value="${U.esc(f.value ?? '')}"/>`}${f.note ? `<small class="muted">${U.esc(f.note)}</small>` : ''}</label>`;
    };
    const body = U.h(`<form class="form legal-form" autocomplete="off">
      <p class="dialog-text">${P.docs.map((k) => `<b>${U.esc(DOCS[k].title)}</b>`).join(' + ')} for ${U.esc(t.name)}, Apt ${U.esc(u.number)}. Check the details, then download the Word ${P.docs.length > 1 ? 'files' : 'file'}.</p>
      ${needs.length ? `<div class="callout callout-warn">Missing in Settings → Legal: ${needs.map((k) => SETTING_LABEL[k] || k).join(', ')}. Those spots will be left blank. <a href="#/settings?tab=legal">Fill them in</a>.</div>` : ''}
      <div class="row2">${ins.map(field).join('')}</div>
      ${(() => { const roles = [...new Set(P.docs.map((k) => DOC_SIG[k]).filter(Boolean))].filter((r) => (sigs()[r] || {}).mode && sigs()[r].mode !== 'none'); return roles.length ? `<label class="check"><input type="checkbox" name="sign" checked/><span>Add the saved signature (${roles.map((r) => SIG_ROLES[r].label.toLowerCase()).join(', ')})</span></label>` : (P.docs.some((k) => DOC_SIG[k]) ? '<p class="small muted">No saved signature yet: the signature line stays blank. Add one in Settings → Legal → Signatures.</p>' : ''); })()}
      ${packet === 'lease' ? '<label class="check"><input type="checkbox" name="saveTenant" checked/><span>Save the lease dates, people and parking space to the tenant’s record</span></label>' : ''}
      <p class="form-err lock-error"></p></form>`);
    if (packet === 'threeday') body.addEventListener('change', (e) => {
      if (e.target.name === 'delivery' && e.target.value) U.$('[name=deadline]', body).value = noticeDeadline(e.target.value, 3);
      if (e.target.name === 'month' && e.target.value) { const k = e.target.value; const st = M.rentStatus(u, k); U.$('[name=dueDate]', body).value = st.due; U.$('[name=amount]', body).value = st.balance || st.expected; U.$('[name=periodStart]', body).value = k + '-01'; U.$('[name=periodEnd]', body).value = U.monthEnd(k); }
    });
    if (packet === 'lease') body.addEventListener('change', (e) => { if (e.target.name === 'termStart' && e.target.value) { U.$('[name=termEnd]', body).value = U.addDays(addYears(e.target.value, 1), -1); U.$('[name=firstPayment]', body).value = e.target.value; } });
    if (packet === 'extension') body.addEventListener('change', (e) => { if (e.target.name === 'termStart' && e.target.value) { U.$('[name=termEnd]', body).value = U.addDays(addYears(e.target.value, 1), -1); U.$('[name=firstPayment]', body).value = e.target.value; } });
    const v = await U.modal({
      title: P.title + ' — Apt ' + u.number, body, size: 'lg',
      buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, {
        label: `Download Word ${P.docs.length > 1 ? 'files' : 'file'}`, cls: 'btn-primary', value: (b) => {
          const x = U.formValues(b);
          if (!x.names) return err(b, 'Enter the tenant name(s).');
          if (packet === 'threeday' && !(+x.amount > 0)) return err(b, 'Enter the rent owed.');
          if ((packet === 'lease' || packet === 'extension') && !(+x.monthly > 0)) return err(b, 'Enter the monthly rent.');
          return x;
        }
      }]
    });
    if (!v) return null;
    const saveTenant = v.saveTenant; delete v.saveTenant; const sign = !!v.sign; delete v.sign; v._sign = sign;
    const docs = packet === 'extension' && +v.monthly === +t.rent ? await pickDocs(P.docs) : P.docs;
    if (!docs) return null;
    try {
      for (const k of docs) {
        const { blob, missing } = await fill(k, tagsFor(k, v));
        U.download(blob, fileName(k, v));
        if (missing.length) console.warn('template fields with no value', k, missing);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (e) { console.error(e); U.alert('Could not create the document', U.esc(e.message)); return null; }
    const key = task ? task.key : packetKey(packet, t, v);
    const old = latest(key);
    const rec = {
      ...(old && !['skipped'].includes(old.status) ? old : { _c: 'legal', id: U.uid(), status: 'created' }),
      key, packet, kind: packet, tenantId: t.id, unitId: u.id, docs, inputs: v, createdDate: U.todayISO(),
      month: packet === 'threeday' ? v.month : (old && old.month) || '', months: packet === 'threeday' ? monthsBetween(v.periodStart, v.periodEnd) : null, amount: packet === 'threeday' ? +v.amount : null,
      deadline: packet === 'threeday' ? v.deadline : '', term: packet === 'extension' ? { start: v.termStart, end: v.termEnd, rent: +v.monthly } : null
    };
    const recs = [rec];
    if (packet === 'lease' && saveTenant) recs.push({ ...t, leaseStart: v.termStart, leaseEnd: v.termEnd, adults: +v.adults || 0, children: +v.children || 0, parking: v.parking, maxPersons: +v.maxPersons || null, authorized: +v.authorized || null, legalNames: v.names, rent: +v.monthly || t.rent });
    await A().save(recs, { label: `Created ${P.title.toLowerCase()} for Apt ${u.number}` });
    U.toast(`${docs.length > 1 ? 'Documents' : 'Document'} downloaded. Mark it ${P.verb} once it’s done.`, 'ok', { label: 'Mark ' + P.verb, fn: () => markDone(rec.id) });
    return rec;
  }
  const monthsBetween = (a, b) => { const out = []; for (let k = U.monthKey(a); k && k <= U.monthKey(b) && out.length < 60; k = U.addMonths(k, 1)) out.push(k); return out; };
  const err = (b, msg) => { U.$('.form-err', b).textContent = msg; return undefined; };
  async function pickDocs(list) {
    const r = await U.modal({ title: 'Which documents?', body: `<div class="form">${list.map((k) => `<label class="check"><input type="checkbox" data-k="${k}" checked/><span>${U.esc(DOCS[k].title)}</span></label>`).join('')}<p class="small muted">The cover letter explains a rent increase. With the same rent you may only want the extension.</p></div>`, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Continue', cls: 'btn-primary', value: (b) => U.$$('[data-k]', b).filter((c) => c.checked).map((c) => c.dataset.k) }] });
    return r && r.length ? r : null;
  }
  function packetKey(packet, t, v) {
    if (packet === 'threeday') return `threeday:${t.id}:${v.month}`;
    if (packet === 'extension') return `extension:${t.id}:${v.termStart}`;
    return `${packet}:${t.id}`;
  }

  /** Record that the documents went out (or were signed / served). */
  async function markDone(recId, taskForSkip) {
    let r = M.get(recId);
    if (!r && taskForSkip) r = { _c: 'legal', id: U.uid(), key: taskForSkip.key, packet: taskForSkip.packet, kind: taskForSkip.packet, tenantId: taskForSkip.tenant.id, unitId: taskForSkip.unit.id, month: taskForSkip.month || '', months: taskForSkip.months || null, amount: taskForSkip.owed || null, status: 'created', inputs: null };
    if (!r) return;
    const P = PACKETS[r.packet]; const t = M.tenant(r.tenantId);
    const body = U.h(`<form class="form">
      <div class="row2"><label class="field"><span>${r.packet === 'threeday' ? 'Served on' : r.packet === 'movein' ? 'Sent on' : 'Signed on'}</span><input type="date" name="date" value="${U.todayISO()}"/></label>
      <label class="field"><span>How</span><select name="method">${U.opts(METHODS[r.packet] || ['Hand delivered'], (METHODS[r.packet] || [])[0])}</select></label></div>
      ${r.packet === 'threeday' ? `<label class="field"><span>Witness / served upon</span><input name="witness" placeholder="Who was present or received it"/></label><p class="small muted" id="dlInfo"></p>` : ''}
      ${r.packet === 'extension' && r.term ? `<label class="check"><input type="checkbox" name="applyTerm" checked/><span>Update ${U.esc(t ? t.name : 'the tenant')}: lease ends ${U.fmtDate(r.term.end)}${r.term.rent && t && +r.term.rent !== +t.rent ? `, rent ${U.money(r.term.rent)} from ${U.fmtDate(r.term.start)}` : ''}</span></label>` : ''}
      <label class="field"><span>Notes</span><input name="notes" value="${U.esc(r.notes || '')}"/></label></form>`);
    const info = () => { const el = U.$('#dlInfo', body); if (el) { const d = U.$('[name=date]', body).value; el.textContent = d ? `The tenant must pay or move out by ${U.fmtDate(noticeDeadline(d, 3))} (3 business days, skipping weekends and legal holidays).` : ''; } };
    body.addEventListener('change', info);
    const v = await U.modal({ title: `Mark ${P.verb} — ${P.title}`, body, size: 'md', onOpen: info, buttons: [{ label: 'Cancel', value: null, cls: 'btn-ghost' }, { label: 'Mark ' + P.verb, cls: 'btn-primary', value: (b) => U.formValues(b) }] });
    if (!v) return;
    const rec = { ...r, status: P.verb, sentDate: v.date, method: v.method, notes: v.notes, witness: v.witness || '' };
    if (r.packet === 'threeday') rec.deadline = noticeDeadline(v.date, 3);
    const recs = [rec];
    if (r.packet === 'extension' && v.applyTerm && r.term && t) {
      const tt = { ...t, leaseEnd: r.term.end };
      if (r.term.rent && +r.term.rent !== +t.rent) { tt.rentHistory = [...(t.rentHistory || []), { from: r.term.start, rent: +r.term.rent, before: +t.rent }]; if (r.term.start <= U.todayISO()) tt.rent = +r.term.rent; else tt.pendingRent = { from: r.term.start, rent: +r.term.rent }; }
      recs.push(tt);
    }
    await A().save(recs, { label: `${P.title} marked ${P.verb} — Apt ${(M.unit(r.unitId) || {}).number}` });
    U.toast(`Marked ${P.verb}.`, 'ok');
  }
  async function skip(task) {
    const why = await U.prompt('Not needed', 'Why isn’t this needed? (kept in the history)', { okLabel: 'Mark not needed', placeholder: 'e.g. Handled before the app was used' });
    if (why === null) return;
    await A().save({ _c: 'legal', id: U.uid(), key: task.key, packet: task.packet, kind: task.packet, tenantId: task.tenant.id, unitId: task.unit.id, month: task.month || '', months: task.months || null, status: 'skipped', notes: why, createdDate: U.todayISO() }, { label: `${PACKETS[task.packet] ? PACKETS[task.packet].title : 'Legal item'} not needed — Apt ${task.unit.number}` });
  }
  async function redownload(r) {
    if (!r.inputs) return U.alert('Nothing to download', 'This entry was recorded without creating documents.');
    try { for (const k of r.docs || PACKETS[r.packet].docs) { const { blob } = await fill(k, tagsFor(k, r.inputs)); U.download(blob, fileName(k, r.inputs)); await new Promise((x) => setTimeout(x, 350)); } } catch (e) { U.alert('Could not create the document', U.esc(e.message)); }
  }

  /** Any document for a tenant, outside of a reminder. */
  async function tenantDocs(t) {
    const u = unitOf(t); const hist = D.legal.filter((r) => r.tenantId === t.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const body = U.h(`<div class="stack">
      <div class="doc-grid">${Object.entries(PACKETS).map(([k, P]) => `<button type="button" class="doc-tile" data-p="${k}"><b>${U.esc(P.title)}</b><small>${P.docs.map((d) => U.esc(DOCS[d].title)).join(' + ')}</small></button>`).join('')}</div>
      <h3 class="form-h">History</h3>
      ${hist.length ? `<table class="tbl tbl-tight"><tbody>${hist.map((r) => `<tr><td>${U.esc(PACKETS[r.packet] ? PACKETS[r.packet].title : r.packet)}${r.month ? ' · ' + U.monthLabel(r.month) : ''}${r.term ? ' · ' + U.fmtDate(r.term.start) : ''}</td><td>${statusChip(r)}</td><td class="small muted">${U.fmtDate(r.sentDate || r.createdDate)}</td><td class="num">${r.inputs ? `<button class="btn btn-sm btn-ghost" data-dl="${r.id}" type="button">Download again</button>` : ''}${['created'].includes(r.status) ? `<button class="btn btn-sm" data-done="${r.id}" type="button">Mark ${PACKETS[r.packet].verb}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No legal documents yet.</p>'}</div>`);
    body.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-p]'); if (p) { U.closeModal(null); create(p.dataset.p, t, null); }
      const d = e.target.closest('[data-dl]'); if (d) redownload(M.get(d.dataset.dl));
      const m = e.target.closest('[data-done]'); if (m) { U.closeModal(null); markDone(m.dataset.done); }
    });
    U.modal({ title: `Legal documents — ${t.name}, Apt ${u.number}`, body, size: 'lg', buttons: [{ label: 'Close', cls: 'btn-ghost', value: true }] });
  }
  function statusChip(r) {
    const map = { created: ['st-due', 'Created, not sent'], sent: ['st-paid', 'Sent'], signed: ['st-paid', 'Signed'], served: ['st-late', 'Served'], skipped: ['st-none', 'Not needed'] };
    let [cls, label] = map[r.status] || ['st-none', r.status];
    if (r.packet === 'threeday' && r.status === 'served') {
      if (owedFor(r) < 0.01) { cls = 'st-paid'; label = 'Served · paid'; } else if (r.deadline && r.deadline < U.todayISO()) { cls = 'st-late'; label = 'Deadline passed'; } else label = `Served · pay by ${U.fmtDateShort(r.deadline)}`;
    }
    return `<span class="chip ${cls}">${U.esc(label)}</span>`;
  }

  /* ---------------- the Legal page ---------------- */
  function page(view) {
    const today = U.todayISO(); const all = tasks(today);
    const act = all.filter((t) => t.state !== 'upcoming'); const soon = all.filter((t) => t.state === 'upcoming');
    const notices = D.legal.filter((r) => r.packet === 'threeday' && r.status === 'served').sort((a, b) => (b.sentDate || '').localeCompare(a.sentDate || '')).slice(0, 12);
    const card = (t) => `<article class="card ltask ls-${t.state}" data-key="${U.esc(t.key)}">
        <div class="lt-main"><span class="lt-due">${t.state === 'overdue' ? 'Overdue' : t.state === 'due' ? 'Due' : 'Coming up'}<b>${U.fmtDateShort(t.due)}</b></span>
        <div><h3>${U.esc(t.title)}</h3><p class="small muted">${U.esc(t.sub)}</p>${t.record && t.record.status === 'created' ? `<p class="small">Documents created ${U.fmtDate(t.record.createdDate)}, not yet marked ${PACKETS[t.packet].verb}.</p>` : ''}</div></div>
        <div class="lt-act">${t.packet === 'evict' ? '<button class="btn btn-sm" data-a="evictdone" type="button">Handled</button>' : `${t.record && t.record.status === 'created' ? `<button class="btn btn-sm" data-a="done" type="button">Mark ${PACKETS[t.packet].verb}</button><button class="btn btn-sm btn-ghost" data-a="create" type="button">Create again</button>` : `<button class="btn btn-sm btn-primary" data-a="create" type="button">Create ${PACKETS[t.packet].docs.length > 1 ? 'documents' : 'document'}</button><button class="btn btn-sm btn-ghost" data-a="done" type="button">Mark ${PACKETS[t.packet].verb}</button>`}<button class="btn btn-sm btn-ghost" data-a="skip" type="button">Not needed</button>`}</div></article>`;
    const rows = D.units.map((u) => {
      const t = M.currentTenant(u.id) || M.tenantsOf(u.id).find((x) => !x.moveOut); if (!t) return `<tr><td>${U.esc(u.number)}</td><td class="muted">Vacant</td><td colspan="4"></td></tr>`;
      const recs = D.legal.filter((r) => r.tenantId === t.id);
      const lastOf = (p) => recs.filter((r) => r.packet === p && r.status !== 'skipped').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      const nextExt = all.find((x) => x.packet === 'extension' && x.tenant.id === t.id);
      const ls = leaseStart(t); const le = t.leaseEnd || (ls ? U.addDays(addYears(ls, Math.max(1, Math.ceil((U.daysBetween(ls, today) + 1) / 365.25))), -1) : '');
      const mi = lastOf('movein'); const nd = recs.filter((r) => r.packet === 'threeday' && r.status === 'served').length;
      return `<tr class="clickable" data-t="${t.id}"><td>${U.esc(u.number)}</td><td>${U.esc(t.name)}</td><td>${ls ? `${U.fmtDate(ls)}<small>${t.leaseEnd ? 'Ends ' : 'Anniversary '}${U.fmtDate(le)}</small>` : '<span class="chip st-due">add lease date</span>'}</td><td>${mi ? statusChip(mi) : '<span class="muted">—</span>'}</td><td>${nextExt ? `${U.fmtDate(nextExt.due)}<small>${nextExt.state === 'overdue' ? 'overdue' : 'send by'}</small>` : t.exempt ? '<span class="muted">No rent</span>' : '<span class="muted">—</span>'}</td><td class="num">${nd || ''}</td></tr>`;
    }).join('');
    const notifOn = A().pref('notify') && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    view.innerHTML = `
      <div class="page-head"><div><h1>Legal</h1><p class="lede">Leases, move-in letters, three-day notices and yearly extensions. Each document is filled in from the tenant’s details and downloads as a Word file.</p></div>
        <div class="btn-row"><button class="btn" id="lgCal" type="button">Add reminders to my calendar</button><button class="btn" id="lgNotif" type="button">${notifOn ? 'Notifications on' : 'Turn on notifications'}</button></div></div>
      ${!S().signerName ? `<div class="callout callout-warn">Fill in the landlord, attorney and bank details once in <a href="#/settings?tab=legal">Settings → Legal</a> so the documents come out complete.</div>` : ''}
      <section><h2 class="sec-h">Needs action <span class="muted">${act.length || ''}</span></h2>
        ${act.length ? `<div class="ltasks">${act.map(card).join('')}</div>` : `<div class="card"><p class="muted">Nothing is due. Reminders appear here ${S().moveInDays} days after a move-in, ${S().noticeAfterDays} days after unpaid rent was due, and ${S().extensionDays} days before each lease anniversary.</p></div>`}</section>
      ${soon.length ? `<section><h2 class="sec-h">Coming up (next 60 days)</h2><div class="ltasks">${soon.map(card).join('')}</div></section>` : ''}
      ${notices.length ? `<section class="card"><div class="card-head"><h2>Three-day notices served</h2></div><table class="tbl tbl-tight"><thead><tr><th>Apt</th><th>Tenant</th><th>Rent for</th><th>Served</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${notices.map((r) => `<tr><td>${U.esc((M.unit(r.unitId) || {}).number || '')}</td><td>${U.esc((M.tenant(r.tenantId) || {}).name || '')}</td><td>${r.months && r.months.length > 1 ? `${U.monthLabel(r.months[0])} – ${U.monthLabel(r.months[r.months.length - 1])}` : r.month ? U.monthLabel(r.month) : ''}</td><td>${U.fmtDate(r.sentDate)}<small>${U.esc(r.method || '')}</small></td><td class="num">${U.money(r.amount)}</td><td>${statusChip(r)}</td></tr>`).join('')}</tbody></table></section>` : ''}
      <section class="card card-flush"><div class="card-head pad"><h2>By unit</h2><span class="small muted">Click a row for that tenant’s documents</span></div>
        <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Apt</th><th>Tenant</th><th>Lease</th><th>Deposit letter + §83.49</th><th>Next extension</th><th class="num">Notices</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <p class="small muted">These documents are your own forms filled in automatically. Have your attorney review them, especially the three-day notice, before relying on them. Reminders start from ${U.fmtDate(S().trackFrom)} (Settings → Legal).</p>`;
    U.$('#lgCal').onclick = () => calendar();
    U.$('#lgNotif').onclick = () => enableNotifications();
    view.onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (b) { const t = all.find((x) => x.key === b.closest('[data-key]').dataset.key); if (!t) return;
        if (b.dataset.a === 'create') create(t.packet, t.tenant, t);
        if (b.dataset.a === 'done') markDone(t.record ? t.record.id : null, t.record ? null : t);
        if (b.dataset.a === 'skip') skip(t);
        if (b.dataset.a === 'evictdone') A().save({ ...t.record, followUpDone: true }, { label: 'Eviction follow-up handled' });
        return; }
      const r = e.target.closest('[data-t]'); if (r) tenantDocs(M.tenant(r.dataset.t));
    };
  }

  /* ---------------- reminders: bell, system notifications, calendar ---------------- */
  function badges() {
    const n = actionable().length;
    const b = U.$('#legalBadge'); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
    const bell = U.$('#bellCount'); if (bell) { bell.textContent = n; bell.classList.toggle('hidden', !n); }
  }
  function bellMenu() {
    const box = U.$('#bellMenu'); const list = actionable();
    box.innerHTML = `<div class="bell-head"><b>Reminders</b><a href="#/legal">Open Legal</a></div>${list.length ? list.slice(0, 8).map((t) => `<a class="bell-item ls-${t.state}" href="#/legal"><span>${U.esc(t.title)}</span><small>${t.state === 'overdue' ? 'Overdue since' : 'Due'} ${U.fmtDateShort(t.due)}</small></a>`).join('') + (list.length > 8 ? `<p class="small muted pad">and ${list.length - 8} more</p>` : '') : '<p class="small muted pad">Nothing due right now.</p>'}`;
    box.classList.toggle('hidden');
  }
  async function enableNotifications() {
    if (typeof Notification === 'undefined') return U.alert('Not available here', 'This browser can’t show notifications. On iPhone and iPad, add the app to the Home Screen first (Safari → Share → Add to Home Screen) and open it from there. You can also use “Add reminders to my calendar”.');
    if (A().pref('notify') && Notification.permission === 'granted') { A().pref('notify', false); U.toast('Notifications turned off on this device.'); A().render(); return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') return U.alert('Notifications are blocked', 'The browser said no. Allow notifications for this site in the browser’s settings (the padlock or “i” icon next to the address), then try again.');
    A().pref('notify', true); U.toast('Notifications are on for this device.', 'ok'); A().render(); notifyNow(true);
  }
  /** Show a system notification for each item that is due, once a day per item. */
  async function notifyNow(force) {
    if (!A().pref('notify') || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = U.todayISO(); const seen = A().pref('notified') || {}; const fresh = {};
    Object.entries(seen).forEach(([k, d]) => { if (d === today) fresh[k] = d; });
    const due = actionable(today).filter((t) => force || fresh[t.key] !== today);
    if (!due.length) return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration().catch(() => null);
    const show = (title, body, tag) => reg ? reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', data: { url: './#/legal' } }) : new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
    if (due.length > 3) show(`Villas Capellanias: ${due.length} legal reminders`, due.slice(0, 4).map((t) => '• ' + t.title).join('\n'), 'vc-legal-summary');
    else due.forEach((t) => show(t.title, (t.state === 'overdue' ? 'Overdue since ' : 'Due ') + U.fmtDate(t.due), t.key));
    due.forEach((t) => { fresh[t.key] = today; });
    A().pref('notified', fresh);
  }
  /** A calendar file with every reminder (no tenant names), with alerts at 9 AM. */
  function calendar() {
    const today = U.todayISO(); const items = tasks(today);
    D.tenants.filter((t) => !t.moveOut && !t.exempt && leaseStart(t)).forEach((t) => {
      let ann = t.leaseEnd ? U.addDays(t.leaseEnd, 1) : addYears(leaseStart(t), 1); let g = 0;
      while (ann < today && g++ < 80) ann = addYears(ann, 1);
      for (let i = 0; i < 2; i++, ann = addYears(ann, 1)) { const key = `extension:${t.id}:${ann}`; if (!items.some((x) => x.key === key) && !isDone(key, 'extension')) items.push({ key, packet: 'extension', unit: unitOf(t), due: U.addDays(ann, -(+S().extensionDays || 30)), title: `Lease extension — Apt ${unitOf(t).number}` }); }
    });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const d8 = (iso) => iso.replace(/-/g, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Villas Capellanias//Legal reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Villas Capellanias — legal'];
    const fold = (s) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    items.filter((t) => t.due && t.packet !== 'evict').forEach((t) => {
      const due = t.due < today ? today : t.due;
      lines.push('BEGIN:VEVENT', `UID:${t.key.replace(/[^\w:-]/g, '')}@villas-capellanias`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(due)}`, `DTEND;VALUE=DATE:${d8(U.addDays(due, 1))}`,
        `SUMMARY:${fold('VC: ' + t.title)}`, `DESCRIPTION:${fold('Open the Villas Capellanias app → Legal to create the documents.')}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${fold(t.title)}`, 'TRIGGER:-PT15H', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${fold(t.title)}`, 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    U.download(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), `villas-capellanias-legal-reminders-${today}.ics`);
    U.alert('Calendar file downloaded', `Open the downloaded file to add ${items.length} reminders to your calendar (Outlook, Apple Calendar), or in Google Calendar use Settings → Import. Each one alerts you the day before and on the day at 9 AM, even when the app is closed. Tenant names are left out. Download it again after changes; reminders with the same name are updated rather than duplicated in most calendar apps.`);
  }

  /* ---------------- Settings → Legal ---------------- */
  function settingsTab(el) {
    const s = S();
    const f = (k, label, ph) => `<label class="field"><span>${label}</span><input name="${k}" value="${U.esc(s[k] || '')}" placeholder="${U.esc(ph || '')}"/></label>`;
    const tplRows = Object.entries(DOCS).map(([k, d]) => { const custom = D.files.find((x) => x.id === 'tpl-' + k); return `<tr><td>${U.esc(d.title)}${d.fixed ? '<small>No fields to fill</small>' : ''}</td><td>${custom ? `<span class="chip st-exempt">Your version (${U.esc(custom.name || '')})</span>` : '<span class="muted small">Standard</span>'}</td><td class="num"><button class="btn btn-sm btn-ghost" data-tdl="${k}" type="button">Download</button><button class="btn btn-sm" data-tup="${k}" type="button">Replace…</button>${custom ? `<button class="btn btn-sm btn-ghost" data-trm="${k}" type="button">Use standard</button>` : ''}</td></tr>`; }).join('');
    el.innerHTML = `<form class="form" id="legalForm" autocomplete="off">
      <section class="card"><div class="card-head"><h2>Lessor and signer</h2></div>
        <p class="small muted">Used on the lease, the extension and the security deposit letter. These details are stored encrypted and never put on GitHub.</p>
        <div class="row2">${f('signerName', 'Signs for the Lessor (name)', 'e.g. Carmen C. Torres')}${f('signerTitle', 'Title', 'President')}</div>
        <div class="row2">${f('lessorStreet', 'Lessor mailing address (deposit letter header)')}${f('lessorCity', 'City, state, ZIP')}</div>
        ${f('paymentAddress', 'Where rent is paid (lease, paragraph on rent)', 'Street, City, Florida ZIP')}</section>
      <section class="card"><div class="card-head"><h2>Landlord contact</h2></div>
        <p class="small muted">On the three-day notice (landlord signature line) and the new lease cover letter.</p>
        <div class="row3">${f('landlordName', 'Name')}${f('landlordStreet', 'Street')}${f('landlordCity', 'City, state, ZIP')}</div>
        <div class="row2">${f('landlordPhone', 'Phone')}${f('landlordFax', 'Fax (optional)')}</div></section>
      <section class="card"><div class="card-head"><h2>Attorney (three-day notice)</h2></div>
        <div class="row2">${f('attorneyName', 'Name', 'e.g. Jorge E. Torres, Esq.')}${f('attorneyPhone', 'Phone')}</div>
        <div class="row2">${f('attorneyStreet', 'Street')}${f('attorneyCity', 'City, state, ZIP')}</div></section>
      <section class="card"><div class="card-head"><h2>Security deposit account</h2></div>
        <p class="small muted">Florida §83.49 requires telling tenants where the deposit is held.</p>
        <div class="row2">${f('bankName', 'Bank')}${f('bankAddress', 'Bank address')}</div>
        <div class="row2">${f('bankAccount', 'Account number')}${f('bankAccountTitle', 'Account title', 'e.g. Torres Limited Partnership Security Deposits')}</div></section>
      <section class="card"><div class="card-head"><h2>Reminders</h2></div>
        <div class="row3"><label class="field"><span>Deposit letter + §83.49 due this many days after move-in</span><input name="moveInDays" type="number" min="1" max="30" value="${s.moveInDays}"/></label>
        <label class="field"><span>Three-day notice this many days after rent is due</span><input name="noticeAfterDays" type="number" min="1" max="20" value="${s.noticeAfterDays}"/></label>
        <label class="field"><span>Extension this many days before the anniversary</span><input name="extensionDays" type="number" min="7" max="120" value="${s.extensionDays}"/></label></div>
        <div class="row2"><label class="field"><span>Start reminders from</span><input name="trackFrom" type="date" value="${U.esc(s.trackFrom)}"/><small class="muted">Move-ins and unpaid rent before this date don’t create reminders.</small></label>
        <label class="field"><span>Extra court holidays (dates, comma separated)</span><input name="extraHolidays" value="${U.esc(s.extraHolidays || '')}" placeholder="2026-12-24, 2027-04-02"/><small class="muted">Federal holidays and the Friday after Thanksgiving are already skipped when counting the 3 business days.</small></label></div>
      </section>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Save legal settings</button></div></form>
      <section class="card" id="sigCard"><div class="card-head"><h2>Signatures</h2></div>
        <p class="small muted">Choose how each person’s signature appears on the documents they sign. Type a name and pick a handwriting style, or upload a photo of a real signature on white paper (the background is removed). Signatures are stored encrypted. Anyone who knows the app password can create documents with them. Leases and extensions are never signed automatically, because they are signed in front of witnesses.</p>
        <div class="sig-roles">${Object.entries(SIG_ROLES).map(([role, R]) => { const sg = sigs()[role] || {}; return `<div class="sig-role" data-role="${role}">
          <div class="sig-head"><b>${U.esc(R.label)}</b><small class="muted">${U.esc(R.where)}</small></div>
          <div class="seg" data-mode>${[['none', 'None'], ['typed', 'Typed'], ['image', 'Upload']].map(([m, l]) => `<button type="button" data-m="${m}" class="${(sg.mode || 'none') === m ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="sig-typed ${sg.mode === 'typed' ? '' : 'hidden'}"><label class="field"><span>Name to sign</span><input data-name value="${U.esc(sg.name || S()[R.nameKey] || '')}" placeholder="${U.esc(S()[R.nameKey] || 'Full name')}"/></label>
            <div class="sig-fonts">${SIG_FONTS.map(([id, nm]) => `<button type="button" class="sig-font${(sg.font || 'great-vibes') === id ? ' on' : ''}" data-font="${id}" title="${U.esc(nm)}" style="font-family:'vcsig-${id}'">${U.esc(sg.name || S()[R.nameKey] || 'Signature')}</button>`).join('')}</div></div>
          <div class="sig-image ${sg.mode === 'image' ? '' : 'hidden'}"><button type="button" class="btn btn-sm" data-upload>${sg.image ? 'Replace photo…' : 'Upload a photo of the signature…'}</button><span class="small muted">Sign in dark ink on plain white paper, photograph it straight on in good light.</span></div>
          <div class="sig-preview"><span class="small muted">Preview</span><div class="sig-box" data-preview></div></div></div>`; }).join('')}</div>
      </section>
      <section class="card"><div class="card-head"><h2>Document templates</h2></div>
        <p class="small muted">The standard templates are public on GitHub, so they carry no signatures and no account numbers. To print a scanned signature automatically, add it to your own copy and upload that here. The standard templates are your documents with blanks the app fills in, such as {tenants_caps}, {apt} and {amount}. To change the wording, download one, edit it in Word keeping the {…} fields, and replace it here. Your version is stored encrypted and syncs to your other devices.</p>
        <table class="tbl tbl-tight"><tbody>${tplRows}</tbody></table></section>`;
    wireSignatures(el);
    U.$('#legalForm', el).onsubmit = async (e) => { e.preventDefault(); const v = U.formValues(e.target); Object.assign(S(), v, { moveInDays: +v.moveInDays || 5, noticeAfterDays: +v.noticeAfterDays || 3, extensionDays: +v.extensionDays || 30 }); await A().saveSettings({}, 'Legal settings'); U.toast('Legal settings saved.', 'ok'); };
    el.onclick = async (e) => {
      const dl = e.target.closest('[data-tdl]'); if (dl) { const bytes = await templateBytes(dl.dataset.tdl); U.download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'template - ' + DOCS[dl.dataset.tdl].file); }
      const up = e.target.closest('[data-tup]'); if (up) {
        const file = await U.pickFile('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'); if (!file) return;
        if (!/\.docx$/i.test(file.name)) return U.alert('Word .docx only', 'Save the template as a Word Document (.docx), not .doc, and try again.');
        if (file.size > 600000) return U.alert('File too large', 'Templates must be under 600 KB so they can sync. Remove large pictures and try again.');
        const data = await U.readFile(file, 'dataURL');
        await A().save({ _c: 'files', id: 'tpl-' + up.dataset.tup, name: file.name, data, owner: 'template' }, { label: 'Template for ' + DOCS[up.dataset.tup].title });
        U.toast('Template replaced.', 'ok');
      }
      const rm = e.target.closest('[data-trm]'); if (rm) A().remove('tpl-' + rm.dataset.trm, 'custom template');
    };
  }

  function wireSignatures(el) {
    const card = U.$('#sigCard', el); if (!card) return;
    SIG_FONTS.forEach(([id]) => loadSigFont(id).catch(() => null));
    const save = U.debounce(() => A().saveSettings({}, 'Signatures'), 600);
    const preview = async (box) => {
      const role = box.dataset.role; const pv = U.$('[data-preview]', box);
      const url = await signatureFor(role).catch(() => null);
      pv.innerHTML = url ? `<img src="${url}" alt="Signature preview"/>` : '<span class="muted small">No signature: the line stays blank for signing by hand.</span>';
    };
    U.$$('.sig-role', card).forEach((box) => preview(box));
    card.addEventListener('click', async (e) => {
      const box = e.target.closest('.sig-role'); if (!box) return; const role = box.dataset.role; const sg = sigs()[role] = sigs()[role] || {};
      const m = e.target.closest('[data-m]');
      if (m) { sg.mode = m.dataset.m; U.$$('[data-m]', box).forEach((b) => b.classList.toggle('on', b === m)); U.$('.sig-typed', box).classList.toggle('hidden', sg.mode !== 'typed'); U.$('.sig-image', box).classList.toggle('hidden', sg.mode !== 'image'); if (sg.mode === 'typed' && !sg.name) sg.name = U.$('[data-name]', box).value; save(); preview(box); }
      const f = e.target.closest('[data-font]');
      if (f) { sg.font = f.dataset.font; U.$$('[data-font]', box).forEach((b) => b.classList.toggle('on', b === f)); save(); preview(box); }
      if (e.target.closest('[data-upload]')) {
        const file = await U.pickFile('image/*'); if (!file) return;
        try { sg.image = await cleanSignaturePhoto(file); sg.mode = 'image'; save(); preview(box); U.toast('Signature saved.', 'ok'); } catch (x) { U.toast(x.message, 'err'); }
      }
    });
    card.addEventListener('input', (e) => {
      const box = e.target.closest('.sig-role'); if (!box || !e.target.matches('[data-name]')) return;
      const sg = sigs()[box.dataset.role] = sigs()[box.dataset.role] || {}; sg.name = e.target.value;
      U.$$('[data-font]', box).forEach((b) => { b.textContent = e.target.value || 'Signature'; });
      save(); clearTimeout(box._t); box._t = setTimeout(() => preview(box), 300);
    });
  }

  /* ---------------- start-up ---------------- */
  function onUnlock() {
    if (!D.settings.legal) { S(); A().save(D.settings, { silent: true, noRender: true }); }
    // rent increases that start in the future take effect on their date
    const today = U.todayISO();
    const ups = D.tenants.filter((t) => t.pendingRent && t.pendingRent.from <= today).map((t) => ({ ...t, rent: t.pendingRent.rent, pendingRent: null }));
    if (ups.length) A().save(ups, { bulkLabel: 'Rent increases took effect' });
    notifyNow(false);
    clearInterval(onUnlock._t); onUnlock._t = setInterval(() => notifyNow(false), 30 * 60000);
  }

  Object.assign((global.__pages = global.__pages || {}), { legal: page });
  global.Legal = { typedSignature, signatureFor, DOCS, PACKETS, tasks, actionable, create, markDone, tenantDocs, badges, bellMenu, notifyNow, calendar, settingsTab, onUnlock, noticeDeadline, amountWords, words, holidays, fill, tagsFor, inputsFor, statusChip };
})(window);
