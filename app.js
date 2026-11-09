'use strict';
/* Journal de gym – logique partagée (connexion GitHub, données, calculs).
   Les données de chaque personne vivent dans SON dépôt privé GitHub
   (<son-compte>/journal-gym, fichier entrainements.json). Le jeton reste dans le navigateur. */
const JG = (() => {
  const API = 'https://api.github.com';
  const FILE = 'entrainements.json';
  const K = { token: 'jg_token', repo: 'jg_repo', login: 'jg_login', cache: 'jg_cache', dirty: 'jg_dirty' };

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
  };

  let data = { version: 1, unit: 'lb', unitAt: 0, workouts: [] };
  let status = { state: 'idle', msg: '' };
  const listeners = [];
  let busy = false, again = false, seq = 0, timer = null;

  // ---------- utilitaires ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const toDate = iso => { const p = String(iso).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
  const fmtDate = (iso, long) => toDate(iso).toLocaleDateString('fr-CA', long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : NaN; };
  const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString('fr-CA');
  const key = name => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function enc(str) {
    const b = new TextEncoder().encode(str); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function dec(b64) {
    const s = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0)));
  }

  // ---------- état ----------
  const connected = () => !!(ls.get(K.token) && ls.get(K.repo));
  const login = () => ls.get(K.login) || '';
  const repo = () => ls.get(K.repo) || '';
  const unit = () => data.unit || 'lb';
  function emit() { listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  function setStatus(state, msg) { status = { state, msg: msg || '' }; emit(); }
  function cache() { ls.set(K.cache, JSON.stringify(data)); }
  function loadCache() {
    try { const c = JSON.parse(ls.get(K.cache) || 'null'); if (c && Array.isArray(c.workouts)) data = c; } catch (e) { /* cache illisible */ }
  }

  // ---------- GitHub ----------
  function gh(path, opts) {
    opts = opts || {};
    const headers = { 'Authorization': 'Bearer ' + ls.get(K.token), 'Accept': opts.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', body: opts.body, headers, cache: 'no-store' });
  }

  async function connect(tokenStr, repoStr) {
    tokenStr = String(tokenStr || '').trim();
    if (!tokenStr) throw new Error('Colle ton jeton GitHub.');
    ls.set(K.token, tokenStr);
    try {
      const u = await gh('/user');
      if (u.status === 401) throw new Error('Jeton invalide ou expiré.');
      if (!u.ok) throw new Error('GitHub a répondu ' + u.status + '.');
      const user = await u.json();
      let r = String(repoStr || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      if (!r) r = user.login + '/journal-gym';
      else if (r.indexOf('/') < 0) r = user.login + '/' + r;
      const rr = await gh('/repos/' + r);
      if (rr.status === 404 || rr.status === 403) throw new Error('Dépôt « ' + r + ' » introuvable avec ce jeton. Vérifie que le dépôt existe et que le jeton y donne accès.');
      if (!rr.ok) throw new Error('GitHub a répondu ' + rr.status + '.');
      ls.set(K.login, user.login); ls.set(K.repo, r);
      ls.del(K.cache); ls.del(K.dirty);
      data = { version: 1, unit: 'lb', unitAt: 0, workouts: [] };
      await sync();
      return user.login;
    } catch (e) {
      if (!ls.get(K.repo)) ls.del(K.token);
      throw e;
    }
  }

  function disconnect() {
    [K.token, K.repo, K.login, K.cache, K.dirty].forEach(ls.del);
    data = { version: 1, unit: 'lb', unitAt: 0, workouts: [] };
    setStatus('idle');
  }

  async function fetchRemote() {
    const path = '/repos/' + repo() + '/contents/' + FILE;
    const r = await gh(path);
    if (r.status === 404) return { data: null, sha: null };
    if (r.status === 401) throw new Error('Jeton invalide ou expiré – reconnecte-toi.');
    if (!r.ok) throw new Error('Lecture impossible (GitHub ' + r.status + ').');
    const j = await r.json();
    let text;
    if (j.content) text = dec(j.content);
    else { const raw = await gh(path, { accept: 'application/vnd.github.raw+json' }); text = await raw.text(); }
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('Le fichier ' + FILE + ' du dépôt est illisible.'); }
    if (!parsed || !Array.isArray(parsed.workouts)) parsed = { workouts: [] };
    return { data: parsed, sha: j.sha };
  }

  function merge(a, b) {
    const m = new Map();
    for (const w of (b.workouts || []).concat(a.workouts || [])) {
      if (!w || !w.id) continue;
      const o = m.get(w.id);
      if (!o || (w.updatedAt || 0) > (o.updatedAt || 0)) m.set(w.id, w);
    }
    const newer = (a.unitAt || 0) >= (b.unitAt || 0) ? a : b;
    return { version: 1, unit: newer.unit || 'lb', unitAt: newer.unitAt || 0, workouts: Array.from(m.values()) };
  }

  async function sync() {
    if (!connected()) return;
    if (busy) { again = true; return; }
    busy = true;
    setStatus(ls.get(K.dirty) === '1' ? 'saving' : 'loading');
    try {
      for (let i = 0; i < 4; i++) {
        const rem = await fetchRemote();
        if (rem.data) data = merge(data, rem.data);
        cache();
        if (ls.get(K.dirty) !== '1') break;
        const mySeq = seq;
        const body = { message: 'Journal de gym – mise à jour', content: enc(JSON.stringify(data, null, 1)) };
        if (rem.sha) body.sha = rem.sha;
        const r = await gh('/repos/' + repo() + '/contents/' + FILE, { method: 'PUT', body: JSON.stringify(body) });
        if (r.ok) { if (mySeq === seq) ls.del(K.dirty); break; }
        if (r.status === 403 || r.status === 404) throw new Error('Écriture refusée : le jeton doit avoir la permission « Contents : Read and write » sur le dépôt.');
        if (r.status !== 409 && r.status !== 422) throw new Error('Enregistrement impossible (GitHub ' + r.status + ').');
        if (i === 3) throw new Error('Enregistrement impossible (conflit répété). Réessaie.');
      }
      setStatus('ok');
    } catch (e) {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || e instanceof TypeError;
      setStatus(offline ? 'offline' : 'error', offline ? '' : e.message);
    } finally {
      busy = false;
      if (again) { again = false; sync(); }
    }
  }

  function changed() {
    seq++; ls.set(K.dirty, '1'); cache(); emit();
    clearTimeout(timer); timer = setTimeout(sync, 700);
  }

  // ---------- données ----------
  function workouts() {
    return data.workouts.filter(w => !w.deleted)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  }
  function getWorkout(id) { return data.workouts.find(w => w.id === id && !w.deleted) || null; }
  function saveWorkout(w) {
    const now = Date.now();
    const rec = { id: w.id || uid(), date: w.date, name: w.name, note: w.note || '', exercises: w.exercises, createdAt: w.createdAt || now, updatedAt: now };
    const i = data.workouts.findIndex(x => x.id === rec.id);
    if (i >= 0) data.workouts[i] = rec; else data.workouts.push(rec);
    changed(); return rec;
  }
  function deleteWorkout(id) {
    const i = data.workouts.findIndex(x => x.id === id);
    if (i >= 0) { data.workouts[i] = { id, deleted: true, updatedAt: Date.now() }; changed(); }
  }
  function setUnit(u) { data.unit = u === 'kg' ? 'kg' : 'lb'; data.unitAt = Date.now(); changed(); }

  // ---------- calculs ----------
  const e1rm = (w, r) => (w > 0 && r > 0) ? (r === 1 ? w : w * (1 + r / 30)) : 0;   // formule d'Epley

  function setsSummary(sets, u) {
    const groups = [];
    for (const s of sets) {
      const g = groups[groups.length - 1];
      if (g && g.reps === s.reps && g.weight === s.weight) g.n++; else groups.push({ n: 1, reps: s.reps, weight: s.weight });
    }
    return groups.map(g => g.n + '×' + g.reps + (g.weight > 0 ? ' @ ' + fmtNum(g.weight) + (u ? ' ' + u : '') : '')).join(' · ');
  }
  const workoutVolume = w => w.exercises.reduce((t, ex) => t + ex.sets.reduce((a, s) => a + s.reps * s.weight, 0), 0);

  /* Historique par exercice : Map clé -> { name, sessions:[{date, workoutId, sets, maxW, maxWReps, maxReps, e1rm, volume}] } (dates croissantes) */
  function history(excludeId) {
    const m = new Map();
    const ws = workouts().filter(w => w.id !== excludeId).reverse();
    for (const w of ws) {
      for (const ex of w.exercises) {
        if (ex.type && ex.type !== 'ex') continue;
        const k = key(ex.name); if (!k || !ex.sets.length) continue;
        if (!m.has(k)) m.set(k, { name: ex.name.trim(), sessions: [] });
        const h = m.get(k);
        let s = h.sessions[h.sessions.length - 1];
        if (!s || s.workoutId !== w.id) { s = { date: w.date, workoutId: w.id, sets: [], maxW: 0, maxWReps: 0, maxReps: 0, e1rm: 0, volume: 0 }; h.sessions.push(s); }
        for (const st of ex.sets) {
          s.sets.push(st);
          if (st.weight > s.maxW || (st.weight === s.maxW && st.reps > s.maxWReps)) { s.maxW = st.weight; s.maxWReps = st.reps; }
          if (st.reps > s.maxReps) s.maxReps = st.reps;
          s.e1rm = Math.max(s.e1rm, e1rm(st.weight, st.reps));
          s.volume += st.reps * st.weight;
        }
      }
    }
    return m;
  }

  function records() {
    const out = [];
    history().forEach((h, k) => {
      const r = { key: k, name: h.name, count: h.sessions.length, last: h.sessions[h.sessions.length - 1].date,
        maxW: 0, maxWReps: 0, maxWDate: '', e1rm: 0, e1rmDate: '', volume: 0, volumeDate: '', maxReps: 0, maxRepsDate: '' };
      for (const s of h.sessions) {
        if (s.maxW > r.maxW || (s.maxW === r.maxW && s.maxWReps > r.maxWReps)) { r.maxW = s.maxW; r.maxWReps = s.maxWReps; r.maxWDate = s.date; }
        if (s.e1rm > r.e1rm) { r.e1rm = s.e1rm; r.e1rmDate = s.date; }
        if (s.volume > r.volume) { r.volume = s.volume; r.volumeDate = s.date; }
        if (s.maxReps > r.maxReps) { r.maxReps = s.maxReps; r.maxRepsDate = s.date; }
      }
      out.push(r);
    });
    return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  }

  function toCSV() {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['date', 'entrainement', 'exercice', 'set', 'reps', 'poids', 'unite', 'note'].join(',')];
    workouts().slice().reverse().forEach(w => w.exercises.forEach(ex => ex.sets.forEach((s, i) =>
      rows.push([w.date, q(w.name), q(ex.name), i + 1, s.reps, s.weight, unit(), q(w.note || '')].join(',')))));
    return rows.join('\r\n');
  }

  function init() {
    loadCache();
    if (connected()) sync();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', sync);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && connected()) sync(); });
    }
  }

  return { init, connect, disconnect, connected, login, repo, sync, onChange: f => listeners.push(f), status: () => status,
    workouts, getWorkout, saveWorkout, deleteWorkout, unit, setUnit,
    history, records, e1rm, setsSummary, workoutVolume, toCSV,
    esc, uid, today, toDate, fmtDate, fmtNum, num, key, _merge: merge };
})();
if (typeof module !== 'undefined') module.exports = JG;
