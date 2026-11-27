/* =========================================================
   Cloud sync through your own Firebase project
   - Firestore collection "records": one document per record,
     encrypted with the app password BEFORE upload (AES-256-GCM).
     Firebase only ever stores { u: time, d: deleted?, k: key id, iv, ct }.
   - "meta/crypto" holds the salt and a check value (no secrets).
   - Newest edit wins per record; deletions travel as small markers.
   - Sign-in: Firebase e-mail/password accounts that you create;
     only e-mails listed in the Firestore rules can read or write.
   ========================================================= */
(function (global) {
  'use strict';
  const LIB = ['lib/firebase/firebase-app-compat.js', 'lib/firebase/firebase-auth-compat.js', 'lib/firebase/firebase-firestore-compat.js'];
  const MAX_DOC = 900000;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const configured = (c) => !!(c && c.apiKey && c.projectId && c.appId && !/PASTE_/.test(JSON.stringify(c)));
  const KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  let cfgNote = '';
  /** Read firebase-config.js as text, so any pasted format works: the app's own,
      Firebase's snippet with import lines and "const firebaseConfig", quoted or unquoted keys. */
  async function readConfigFile() {
    try {
      const r = await fetch('firebase-config.js', { cache: 'no-store' });
      if (!r.ok) { cfgNote = `firebase-config.js could not be loaded (error ${r.status}). Check it is uploaded next to index.html.`; return null; }
      const txt = await r.text(); const out = {};
      KEYS.forEach((k) => { const m = new RegExp(`["']?${k}["']?\\s*:\\s*["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]`).exec(txt); if (m) out[k] = m[1].trim(); });
      const missing = ['apiKey', 'projectId', 'appId'].filter((k) => !out[k] || /PASTE_/.test(out[k]));
      if (missing.length) { cfgNote = `firebase-config.js was found, but these values are missing or still say PASTE_: ${missing.join(', ')}.`; return null; }
      if (!out.authDomain) out.authDomain = out.projectId + '.firebaseapp.com';
      return out;
    } catch (e) { cfgNote = 'firebase-config.js could not be read: ' + e.message; return null; }
  }

  let api = null, cfg = null, cfgOk = false, loadErr = null, inited = false;
  let fb = null, auth = null, db = null;
  let user = null, unlockedPw = null, password = null;
  let key = null, keyId = null, keyProblem = null, askingKey = false;
  let running = false, unsubs = [], mirror = {}, meta = {}, readyRecords = false, readyMeta = false;
  let offline = !navigator.onLine, pending = 0, lastErr = null, lastSync = null, timer = null, busy = false, again = false, oversizeWarned = false;
  const decCache = new Map();

  function friendly(e) {
    const code = String((e && e.code) || ''); const msg = String((e && e.message) || e);
    if (/permission-denied|insufficient permissions/i.test(code + msg)) return 'This cloud account is not allowed. Check the list of e-mails in the Firestore rules.';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/i.test(code)) return 'Wrong cloud e-mail or password.';
    if (/too-many-requests/i.test(code)) return 'Too many tries. Wait a few minutes or reset the cloud password.';
    if (/operation-not-allowed/i.test(code)) return 'E-mail/password sign-in is not turned on in Firebase (Authentication → Sign-in method).';
    if (/network-request-failed|unavailable/i.test(code)) return 'No connection to the cloud. Your changes are kept here and sync when you are back online.';
    if (/unauthorized-domain|referer|api-key/i.test(code + msg)) return 'Firebase refused this website. Add it under Authentication → Settings → Authorized domains.';
    if (/resource-exhausted|quota/i.test(code + msg)) return 'The free daily cloud limit was reached. Work continues here and syncs again tomorrow.';
    if (/failed-precondition/i.test(code)) return 'The Firestore database has not been created yet (Firebase → Firestore Database → Create database).';
    return msg.replace(/^Firebase:\s*/, '');
  }
  const linkKey = () => `vc-cloud:${(cfg && cfg.projectId) || 'x'}:${(user && user.email) || 'x'}`;
  const linked = () => { try { return JSON.parse(localStorage.getItem(linkKey()) || '{}') || {}; } catch (_) { return {}; } };
  const setLinked = (o) => { try { localStorage.setItem(linkKey(), JSON.stringify(o)); } catch (_) { /* ignore */ } };
  function hash(s) { s = String(s || ''); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });

  /* ---------------- status pill & settings card ---------------- */
  function status() {
    if (!cfgOk) return { kind: 'off', text: 'Cloud sync not set up', hidden: true };
    if (loadErr) return { kind: 'err', text: 'Cloud unavailable' };
    if (!user) return { kind: 'off', text: 'Cloud: not signed in' };
    if (!unlockedPw) return { kind: 'off', text: 'Locked' };
    if (keyProblem || lastErr) return { kind: 'err', text: 'Cloud sync problem' };
    if (offline) return { kind: 'warn', text: 'Offline · saved here' };
    if (!running || !readyRecords || !readyMeta) return { kind: 'busy', text: 'Connecting…' };
    if (pending || busy || timer) return { kind: 'busy', text: 'Syncing…' };
    return { kind: 'ok', text: 'Synced' };
  }
  function render() {
    const st = status();
    const pill = document.getElementById('syncState');
    if (pill) { pill.classList.toggle('hidden', !!st.hidden); pill.className = 'sync-pill cs-' + st.kind + (st.hidden ? ' hidden' : ''); pill.textContent = st.text; pill.title = 'Cloud sync — click for details'; }
    const el = document.getElementById('cloudCard'); if (!el) return;
    if (el.querySelector('input:focus')) { const s = document.getElementById('csStatus'); if (s) s.textContent = st.text; return; }
    if (!cfgOk) { el.innerHTML = `<div class="callout"><b>Not set up yet.</b> ${esc(cfgNote || 'The file firebase-config.js still has the PASTE_ placeholders.')} See the setup guide, Part 5.2. After fixing it on GitHub, wait a minute and reload this page.</div>`; return; }
    if (loadErr) { el.innerHTML = `<div class="callout callout-bad"><b>Cloud unavailable.</b> ${esc(loadErr)} The app keeps working on this device.</div>`; return; }
    if (!user) {
      el.innerHTML = `<div class="form cs-form"><p class="small">Sign in with the cloud e-mail and password created for you in Firebase (this is not your Gmail password). Each device signs in once and stays signed in.</p>
        <div class="row2"><label class="field"><span>Cloud e-mail</span><input id="csEmail" type="email" autocomplete="username" inputmode="email"/></label><label class="field"><span>Cloud password</span><input id="csPass" type="password" autocomplete="current-password"/></label></div>
        <p class="lock-error" id="csErr"></p><div class="btn-row"><button class="btn btn-primary" id="csIn" type="button">Sign in to cloud</button><button class="linklike small" id="csForgot" type="button">Forgot the cloud password?</button></div></div>`;
      return;
    }
    el.innerHTML = `<div class="cs-box"><p>Signed in as <b>${esc(user.email)}</b> · project <code>${esc(cfg.projectId)}</code></p>
      <p class="small"><span class="dot cs-${st.kind}"></span> <span id="csStatus">${esc(st.text)}</span>${lastSync ? ` <span class="muted">· last synced ${esc(lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</span>` : ''} · ${Object.keys(mirror).length} records in the cloud</p>
      <p class="lock-error">${esc(keyProblem || lastErr || '')}</p>
      <div class="btn-row"><button class="btn" id="csNow" type="button">Sync now</button><button class="btn btn-ghost" id="csOut" type="button">Sign out of cloud on this device</button></div></div>`;
  }
  function wire() {
    document.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.id === 'syncState') { global.App && App.go('settings', { tab: 'cloud' }); if (lastErr || keyProblem) Sync.now(); }
      if (t.id === 'csIn') {
        const email = document.getElementById('csEmail').value.trim(), pw = document.getElementById('csPass').value, er = document.getElementById('csErr');
        if (!email || !pw) { er.textContent = 'Enter the cloud e-mail and password.'; return; }
        t.disabled = true; t.textContent = 'Signing in…'; er.textContent = '';
        try { await auth.signInWithEmailAndPassword(email, pw); document.activeElement && document.activeElement.blur(); render(); }
        catch (x) { er.textContent = friendly(x); t.disabled = false; t.textContent = 'Sign in to cloud'; }
      }
      if (t.id === 'csForgot') {
        const email = (document.getElementById('csEmail').value || '').trim(), er = document.getElementById('csErr');
        if (!email) { er.textContent = 'Type your cloud e-mail first.'; return; }
        try { await auth.sendPasswordResetEmail(email); global.U && U.toast('If that e-mail has a cloud account, a reset link is on its way.', 'ok'); } catch (x) { er.textContent = friendly(x); }
      }
      if (t.id === 'csNow') Sync.now();
      if (t.id === 'csOut') { if (global.U && !(await U.confirm('Sign out of cloud', 'Stop syncing this device? Its records stay here and in the cloud. You can sign in again any time.', 'Sign out'))) return; await Sync.signOut(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'csPass' || e.target.id === 'csEmail')) document.getElementById('csIn')?.click(); });
  }

  /* ---------------- connect ---------------- */
  function start() {
    if (!cfgOk || !db || !user || !unlockedPw || running) { render(); return; }
    running = true; password = unlockedPw; mirror = {}; meta = {}; readyRecords = readyMeta = false; lastErr = null; decCache.clear();
    unsubs.push(db.collection('records').onSnapshot({ includeMetadataChanges: true }, (snap) => {
      snap.docChanges().forEach((c) => { if (c.type === 'removed') delete mirror[c.doc.id]; else mirror[c.doc.id] = c.doc.data(); });
      if (!snap.metadata.fromCache) { readyRecords = true; offline = false; }
      if (snap.docChanges().length || !key) schedule(200); else render();
    }, (err) => { lastErr = friendly(err); console.error('cloud listen', err); render(); }));
    unsubs.push(db.collection('meta').onSnapshot({ includeMetadataChanges: true }, (snap) => {
      snap.docChanges().forEach((c) => { if (c.type === 'removed') delete meta[c.doc.id]; else meta[c.doc.id] = c.doc.data(); });
      if (!snap.metadata.fromCache) readyMeta = true;
      if (key && meta.crypto && meta.crypto.k !== keyId) { key = null; keyId = null; }
      schedule(200);
    }, (err) => { lastErr = friendly(err); console.error('cloud meta', err); render(); }));
    render();
  }
  function stop() {
    unsubs.forEach((u) => { try { u(); } catch (_) { /* ignore */ } }); unsubs = [];
    running = false; mirror = {}; meta = {}; readyRecords = readyMeta = false; key = null; keyId = null; password = null; keyProblem = null;
    clearTimeout(timer); timer = null; decCache.clear(); render();
  }
  function schedule(ms) { if (!running) return; clearTimeout(timer); timer = setTimeout(() => { timer = null; reconcile(); }, ms); render(); }

  /* ---------------- encryption key ---------------- */
  async function ensureKey() {
    if (key) return true;
    const c = meta.crypto;
    if (!c) {
      const k = await Store.deriveSyncKey(password, null);
      const check = await Store.encryptWithKey(k.key, { ok: 'villas-capellanias' });
      key = k.key; keyId = hash(k.salt).slice(-8);
      const data = { v: 1, salt: k.salt, it: k.iterations, k: keyId, check, u: Date.now() };
      meta.crypto = data;
      await db.collection('meta').doc('crypto').set(data);
      return true;
    }
    try { const k = await Store.deriveSyncKey(password, c.salt); await Store.decryptWithKey(k.key, c.check); key = k.key; keyId = c.k; keyProblem = null; return true; } catch (_) { /* different password */ }
    if (askingKey) return false;
    askingKey = true;
    keyProblem = 'The cloud copy is locked with a different app password. Click “Sync now” to enter it.';
    render();
    try {
      for (let tries = 0; tries < 3; tries++) {
        const pw = await api.askCloudPassword(); if (!pw) return false;
        try {
          const k = await Store.deriveSyncKey(pw, c.salt); await Store.decryptWithKey(k.key, c.check);
          if (!(await api.adoptPassword(pw))) return false;
          password = pw; unlockedPw = pw; key = k.key; keyId = c.k; keyProblem = null; decCache.clear();
          return true;
        } catch (_) { global.U && U.toast('That password does not open the cloud copy.', 'err'); }
      }
      return false;
    } finally { askingKey = false; render(); }
  }
  async function encDoc(rec, u) { const e = await Store.encryptWithKey(key, rec); return { u, d: false, k: keyId, iv: e.iv, ct: e.ct }; }
  async function dec(id, C) { const hit = decCache.get(id); if (hit && hit.ct === C.ct) return hit.v; const v = await Store.decryptWithKey(key, C); decCache.set(id, { ct: C.ct, v }); return v; }
  async function commit(ops) {
    if (!ops.length) return;
    ops.forEach((o) => { mirror[o.id] = o.data; });
    pending++; render();
    try {
      for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach((o) => b.set(db.collection('records').doc(o.id), o.data)); await b.commit(); }
      lastSync = new Date(); lastErr = null;
    } catch (e) { lastErr = friendly(e); console.error('cloud write', e); }
    finally { pending--; render(); }
  }

  /* ---------------- reconcile this device ↔ cloud ---------------- */
  async function reconcile() {
    if (!running || !readyRecords || !readyMeta) return;
    if (busy) { again = true; return; }
    busy = true; render();
    try {
      if (!(await ensureKey())) return;
      const L = linked();
      /* another device erased the cloud: clear this device too (once) */
      if (meta.reset && (L.resetAt || 0) < meta.reset.u) {
        if (L.on) { await api.snapshotBefore('Before clearing: the cloud copy was erased on another device'); const snap0 = api.snapshot(); await api.apply({ del: snap0.records.filter((r) => r._c !== 'settings').map((r) => ({ id: r.id, t: meta.reset.u })) }); }
        L.resetAt = meta.reset.u; setLinked(L);
      }
      const snap = api.snapshot();
      const local = new Map(snap.records.map((r) => [r.id, r]));
      const tomb = snap.tombstones || {};
      let mode = 'normal';
      if (!L.on) {
        const lc = snap.records.filter((r) => r.updatedAt && !['settings', 'activity', 'legalcfg'].includes(r._c)).length;
        const cc = Object.values(mirror).filter((d) => !d.d).length;
        if (lc && cc) {
          const r = await api.firstConnect({ local: lc, cloud: cc });
          if (!r) { await Sync.signOut(); return; }
          mode = r; if (mode === 'cloud') await api.snapshotBefore('Before replacing this device’s records with the cloud copy');
        } else if (cc) mode = 'cloud';
      }
      const put = [], del = [], ops = []; const upDeletes = [];
      const ids = new Set([...local.keys(), ...Object.keys(tomb), ...Object.keys(mirror)]);
      for (const id of ids) {
        const R = local.get(id), C = mirror[id];
        if (C && C.k && C.k !== keyId && !C.d) continue; // being re-locked by another device right now
        let lt = R ? (R.updatedAt || 1) : (tomb[id] || 0);
        const ct = C ? (C.u || 0) : 0;
        if (mode === 'cloud' && C) lt = 0;
        if (ct > lt) {
          if (C.d) { if (R) del.push({ id, t: ct }); continue; }
          try { const rec = await dec(id, C); rec.updatedAt = ct; put.push(rec); } catch (_) { if (R) ops.push({ id, data: await encDoc(R, lt) }); }
        } else if (lt > ct) {
          if (R) {
            const data = await encDoc(R, lt);
            if (JSON.stringify(data).length > MAX_DOC) { if (!oversizeWarned) { oversizeWarned = true; global.U && U.toast('A receipt picture is too large to sync; it stays on this device.', 'err'); } continue; }
            ops.push({ id, data });
          } else if (C && !C.d) { ops.push({ id, data: { u: lt, d: true, k: keyId } }); upDeletes.push(id); }
        }
      }
      /* safety: one device deleting many records everywhere (usually after restoring an old backup) */
      const live = Object.values(mirror).filter((d) => !d.d).length;
      if (upDeletes.length >= 5 && upDeletes.length > live * 0.2) {
        if (!(await api.confirmMassDelete(upDeletes.length))) {
          const gone = new Set(upDeletes);
          for (let i = ops.length - 1; i >= 0; i--) if (gone.has(ops[i].id)) ops.splice(i, 1);
          for (const id of gone) { try { const rec = await dec(id, mirror[id]); rec.updatedAt = mirror[id].u; put.push(rec); } catch (_) { /* skip */ } }
        }
      }
      if (put.length || del.length) await api.apply({ put, del });
      L.on = true; setLinked(L);
      if (ops.length) await commit(ops); else lastSync = lastSync || new Date();
    } catch (e) { console.error('cloud sync', e); lastErr = friendly(e); }
    finally { busy = false; render(); if (again) { again = false; schedule(300); } }
  }

  /* ---------------- public ---------------- */
  const Sync = {
    async init(a) {
      api = a; if (inited) return; inited = true; wire();
      window.addEventListener('online', () => { offline = false; render(); if (running) schedule(500); });
      window.addEventListener('offline', () => { offline = true; render(); });
      cfg = global.FIREBASE_CONFIG || null; cfgOk = configured(cfg);
      if (!cfgOk) { const fromFile = await readConfigFile(); if (fromFile) { cfg = fromFile; cfgOk = true; } }
      if (!cfgOk) { render(); return; }
      try {
        if (!global.firebase) for (const src of LIB) await loadScript(src);
        fb = global.firebase; if (!fb.apps.length) fb.initializeApp(cfg);
        auth = fb.auth(); db = fb.firestore();
      } catch (e) { loadErr = friendly(e); render(); return; }
      auth.onAuthStateChanged((u) => {
        const was = user && user.email; user = u ? { email: String(u.email || '').toLowerCase() } : null;
        if (!user) { stop(); return; }
        if (was && was !== user.email) stop();
        start();
      });
      render();
    },
    render,
    unlocked(pw) { unlockedPw = pw; start(); },
    lock() { unlockedPw = null; stop(); },
    changed() { if (running && !api.applying()) schedule(1200); },
    now() { lastErr = null; if (keyProblem) { keyProblem = null; key = null; } if (running) schedule(0); else start(); render(); },
    signedIn: () => !!user,
    async signOut() { try { if (auth) await auth.signOut(); } catch (_) { /* ignore */ } user = null; stop(); },
    /** After a password change on this device: re-lock the whole cloud copy with the new password. */
    async passwordChanged(oldPw, newPw) {
      unlockedPw = newPw;
      if (!running || !readyRecords) { password = newPw; key = null; return; }
      while (busy) await new Promise((r) => setTimeout(r, 120));
      if (!key) { password = oldPw; await ensureKey(); }
      if (key) await reconcile();
      password = newPw;
      const k = await Store.deriveSyncKey(newPw, null);
      const check = await Store.encryptWithKey(k.key, { ok: 'villas-capellanias' });
      key = k.key; keyId = hash(k.salt).slice(-8); decCache.clear();
      const snap = api.snapshot(); const ops = [];
      for (const r of snap.records) ops.push({ id: r.id, data: await encDoc(r, r.updatedAt || 1) });
      const have = new Set(snap.records.map((r) => r.id));
      for (const [id, C] of Object.entries(mirror)) if (!have.has(id) && C) ops.push({ id, data: { u: Math.max(C.u || 0, (snap.tombstones || {})[id] || 0), d: true, k: keyId } });
      await commit(ops);
      const data = { v: 1, salt: k.salt, it: k.iterations, k: keyId, check, u: Date.now() };
      meta.crypto = data;
      await db.collection('meta').doc('crypto').set(data);
    },
    /** Erase the cloud copy and tell every other device to clear itself. */
    async eraseCloud() {
      if (!running || !readyRecords) throw new Error('Not connected to the cloud. Sign in and wait for “Synced” first.');
      const ids = Object.keys(mirror);
      for (let i = 0; i < ids.length; i += 400) { const b = db.batch(); ids.slice(i, i + 400).forEach((id) => b.delete(db.collection('records').doc(id))); await b.commit(); }
      await db.collection('meta').doc('crypto').delete();
      await db.collection('meta').doc('reset').set({ u: Date.now() });
      try { localStorage.removeItem(linkKey()); } catch (_) { /* ignore */ }
    }
  };
  global.Sync = Sync;
})(window);
