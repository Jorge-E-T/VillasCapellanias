/* =========================================================
   Encrypted storage (IndexedDB)
   - Password → PBKDF2-SHA256 (310,000 rounds) → AES-256-GCM key.
   - Every record is encrypted on its own before it is written.
     Nothing readable is stored on the device: no tenants, no amounts.
   - The key exists only in memory while the app is unlocked.
   - Forgot-password: a printed recovery key, or any 2 of 3 security
     answers, each unlock an encrypted copy of the password.
   ========================================================= */
(function (global) {
  'use strict';

  const DB_NAME = 'villas-capellanias';
  const DB_VERSION = 1;
  const ITERATIONS = 310000;
  const VERIFIER = 'villas-capellanias:ok';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let db = null;
  let key = null;

  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });     // auth + recovery (no data)
        if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'id' }); // every record, encrypted
        if (!d.objectStoreNames.contains('vault')) d.createObjectStore('vault', { keyPath: 'k' });   // encrypted device data
      };
      req.onsuccess = () => { db = req.result; db.onversionchange = () => { db.close(); db = null; }; resolve(db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('The app is open in another tab. Close the other tabs and try again.'));
    });
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txDone = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Save was cancelled by the browser')); });
  async function get(store, k) { const d = await openDB(); return reqP(d.transaction(store).objectStore(store).get(k)); }
  async function getAll(store) { const d = await openDB(); return reqP(d.transaction(store).objectStore(store).getAll()); }
  async function putRaw(store, val) { const d = await openDB(); const t = d.transaction(store, 'readwrite'); t.objectStore(store).put(val); await txDone(t); }
  async function delRaw(store, k) { const d = await openDB(); const t = d.transaction(store, 'readwrite'); t.objectStore(store).delete(k); await txDone(t); }

  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function deriveKey(password, salt, iterations = ITERATIONS) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptWith(k, obj) { const iv = rand(12); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj))); return { iv, ct }; }
  async function decryptWith(k, rec) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, k, rec.ct); return JSON.parse(dec.decode(pt)); }
  function requireKey() { if (!key) throw new Error('Locked'); return key; }

  const KEEP_ON_RESTORE = ['recoveryKey', 'questionAnswers'];

  const Store = {
    get unlocked() { return !!key; },
    ITERATIONS,
    async isSetUp() { return !!(await get('meta', 'auth')); },

    async setup(password) {
      const salt = rand(16);
      key = await deriveKey(password, salt);
      const verifier = await encryptWith(key, VERIFIER);
      await putRaw('meta', { k: 'auth', salt, iterations: ITERATIONS, verifier, created: Date.now() });
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) { /* optional */ }
    },
    async unlock(password) {
      const auth = await get('meta', 'auth');
      if (!auth) throw new Error('Not set up');
      const k = await deriveKey(password, auth.salt, auth.iterations);
      try { if ((await decryptWith(k, auth.verifier)) !== VERIFIER) return false; } catch (_) { return false; }
      key = k;
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) { /* optional */ }
      return true;
    },
    async verify(password) {
      const auth = await get('meta', 'auth'); if (!auth) return false;
      try { const k = await deriveKey(password, auth.salt, auth.iterations); return (await decryptWith(k, auth.verifier)) === VERIFIER; } catch (_) { return false; }
    },
    lock() { key = null; },

    /* ---------- records ---------- */
    async loadAll() {
      const k = requireKey();
      const rows = await getAll('records');
      const out = [];
      for (const r of rows) { try { out.push(await decryptWith(k, r)); } catch (e) { console.warn('unreadable record', r.id); } }
      return out;
    },
    async putMany(records) {
      const k = requireKey();
      const encd = [];
      for (const rec of records) encd.push({ id: rec.id, ...(await encryptWith(k, rec)) });
      const d = await openDB(); const t = d.transaction('records', 'readwrite'); const os = t.objectStore('records');
      encd.forEach((e) => os.put(e));
      await txDone(t);
    },
    async deleteMany(ids) {
      if (!ids.length) return;
      const d = await openDB(); const t = d.transaction('records', 'readwrite');
      ids.forEach((id) => t.objectStore('records').delete(id));
      await txDone(t);
    },

    /* ---------- encrypted device values (tombstones, snapshots, activity) ---------- */
    async getVault(k) { const kk = requireKey(); const r = await get('vault', k); return r ? decryptWith(kk, r) : null; },
    async putVault(k, value) {
      const kk = requireKey();
      if (value === null || value === undefined) return delRaw('vault', k);
      await putRaw('vault', { k, ...(await encryptWith(kk, value)) });
    },
    async vaultKeys(prefix) { const d = await openDB(); const keys = await reqP(d.transaction('vault').objectStore('vault').getAllKeys()); return keys.filter((k) => String(k).startsWith(prefix)); },

    /** Replace every record (restore). Recovery data is never dropped. */
    async replaceAll(records) {
      const k = requireKey();
      const encd = [];
      for (const r of records) encd.push({ id: r.id, ...(await encryptWith(k, r)) });
      const d = await openDB(); const t = d.transaction('records', 'readwrite');
      t.objectStore('records').clear();
      encd.forEach((e) => t.objectStore('records').put(e));
      await txDone(t);
    },

    async changePassword(oldPass, newPass) {
      const auth = await get('meta', 'auth');
      const oldKey = await deriveKey(oldPass, auth.salt, auth.iterations);
      try { await decryptWith(oldKey, auth.verifier); } catch (_) { return false; }
      key = oldKey;
      const records = await Store.loadAll();
      const vault = [];
      for (const r of await getAll('vault')) { try { vault.push({ k: r.k, v: await decryptWith(oldKey, r) }); } catch (_) { /* skip */ } }
      const salt = rand(16);
      const newKey = await deriveKey(newPass, salt);
      const verifier = await encryptWith(newKey, VERIFIER);
      const encR = [], encV = [];
      for (const r of records) encR.push({ id: r.id, ...(await encryptWith(newKey, r)) });
      for (const v of vault) encV.push({ k: v.k, ...(await encryptWith(newKey, v.v)) });
      const d = await openDB();
      const t = d.transaction(['meta', 'records', 'vault'], 'readwrite');
      t.objectStore('meta').put({ k: 'auth', salt, iterations: ITERATIONS, verifier, created: auth.created, changed: Date.now() });
      t.objectStore('records').clear(); t.objectStore('vault').clear();
      encR.forEach((e) => t.objectStore('records').put(e));
      encV.forEach((e) => t.objectStore('vault').put(e));
      await txDone(t);
      key = newKey;
      await Store.refreshRecovery(newPass);
      return true;
    },

    /* ---------- recovery key (printable) ---------- */
    newRecoveryKey() {
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = rand(25); let out = '';
      for (let i = 0; i < 25; i++) { out += A[b[i] % 32]; if (i % 5 === 4 && i < 24) out += '-'; }
      return out;
    },
    normCode: (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    async setupRecoveryKey(password, code) {
      requireKey();
      code = code || Store.newRecoveryKey();
      const salt = rand(16);
      const k = await deriveKey(Store.normCode(code), salt);
      await putRaw('meta', { k: 'recovery', salt, iterations: ITERATIONS, escrow: await encryptWith(k, password), created: Date.now() });
      await Store.putVault('recoveryKey', code);
      return code;
    },
    async hasRecoveryKey() { return !!(await get('meta', 'recovery')); },
    async getRecoveryKey() { return Store.getVault('recoveryKey'); },
    async recoverWithKey(code) {
      const rec = await get('meta', 'recovery'); if (!rec) return null;
      try { const k = await deriveKey(Store.normCode(code), rec.salt, rec.iterations); return await decryptWith(k, rec.escrow); } catch (_) { return null; }
    },

    /* ---------- security questions: any 2 of 3 ---------- */
    normAnswer: (a) => String(a || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(),
    async setupQuestions(password, questions, answers, alreadyNormalized) {
      requireKey();
      const ans = answers.map((a) => (alreadyNormalized ? a : Store.normAnswer(a)));
      const salt = rand(16); const escrows = [];
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
        const k = await deriveKey(ans[i] + '\u0001' + ans[j], salt);
        escrows.push({ i, j, ...(await encryptWith(k, password)) });
      }
      await putRaw('meta', { k: 'questions', questions, salt, iterations: ITERATIONS, escrows, created: Date.now() });
      await Store.putVault('questionAnswers', { questions, answers: ans });
    },
    async getQuestions() { const r = await get('meta', 'questions'); return r ? r.questions : null; },
    async getQuestionAnswers() { return Store.getVault('questionAnswers'); },
    async recoverWithAnswers(answers) {
      const rec = await get('meta', 'questions'); if (!rec) return null;
      const ans = answers.map(Store.normAnswer);
      for (const e of rec.escrows) {
        if (!ans[e.i] || !ans[e.j]) continue;
        try { const k = await deriveKey(ans[e.i] + '\u0001' + ans[e.j], rec.salt, rec.iterations); return await decryptWith(k, { iv: e.iv, ct: e.ct }); } catch (_) { /* next pair */ }
      }
      return null;
    },
    async refreshRecovery(password) {
      const code = await Store.getRecoveryKey().catch(() => null); if (code) await Store.setupRecoveryKey(password, code);
      const qa = await Store.getQuestionAnswers().catch(() => null); if (qa) await Store.setupQuestions(password, qa.questions, qa.answers, true);
    },
    async setHint(hint) { if (hint) await putRaw('meta', { k: 'hint', text: String(hint).slice(0, 120) }); else await delRaw('meta', 'hint'); },
    async getHint() { const r = await get('meta', 'hint'); return r ? r.text : ''; },

    async wipe() {
      key = null; if (db) { db.close(); db = null; }
      await new Promise((res, rej) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res(); });
    },

    /* ---------- cloud encryption helpers (separate salt, same password) ---------- */
    async deriveSyncKey(password, saltB64) { const salt = saltB64 ? unb64(saltB64) : rand(16); return { key: await deriveKey(password, salt), salt: b64(salt), iterations: ITERATIONS }; },
    async encryptWithKey(k, obj) { const { iv, ct } = await encryptWith(k, obj); return { iv: b64(iv), ct: b64(ct) }; },
    async decryptWithKey(k, rec) { return decryptWith(k, { iv: unb64(rec.iv), ct: unb64(rec.ct) }); },

    /* ---------- portable backup files ---------- */
    async encryptBackup(obj, password) {
      const salt = rand(16); const k = await deriveKey(password, salt);
      const { iv, ct } = await encryptWith(k, obj);
      return { format: 'villas-capellanias-backup', version: 1, encrypted: true, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(ct) };
    },
    async decryptBackup(file, password) { const k = await deriveKey(password, unb64(file.salt), file.iterations || ITERATIONS); return decryptWith(k, { iv: unb64(file.iv), ct: unb64(file.data) }); },
    KEEP_ON_RESTORE
  };
  global.Store = Store;
})(window);
