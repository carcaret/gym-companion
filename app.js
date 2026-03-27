/* =========================================
   Gym Companion — Main Application
   ========================================= */

(() => {
  'use strict';

  // ── Constants ──
  const SALT = 'GYMPRO_SALT_2024';
  const DAY_MAP = { 1: 'LUNES', 3: 'MIERCOLES', 5: 'VIERNES' };
  const DAY_LABELS = { LUNES: 'Lunes', MIERCOLES: 'Miércoles', VIERNES: 'Viernes' };
  const DAY_ICONS = { LUNES: '🔵', MIERCOLES: '🟢', VIERNES: '🟡' };
  const SESSION_KEY = 'gym_companion_session';
  const GITHUB_KEY = 'gym_companion_github';
  const DB_LOCAL_KEY = 'gym_companion_db';
  const PAT_KEY = 'gym_companion_pat_enc';

  let DB = null;
  let githubSha = null;
  let currentChart = null;
  let currentWeightChart = null;
  let saveTimeout = null;
  let currentPassword = '';

  // ── Utility ──
  async function sha256(str) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { }
    }
    return fallbackSha256(str);
  }

  function fallbackSha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); };
    var mathPow = Math.pow, maxWord = mathPow(2, 32), lengthProperty = 'length', i, j, result = '';
    var words = [], asciiBitLength = ascii[lengthProperty] * 8;
    var hash = fallbackSha256.h = fallbackSha256.h || [], k = fallbackSha256.k = fallbackSha256.k || [];
    var primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function xorEncrypt(text, key) {
    return Array.from(text).map((c, i) => (c.charCodeAt(0) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0')).join('');
  }

  function xorDecrypt(hex, key) {
    const bytes = hex.match(/.{2}/g) || [];
    return bytes.map((b, i) => String.fromCharCode(parseInt(b, 16) ^ key.charCodeAt(i % key.length))).join('');
  }

  function toast(msg, duration = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.hidden = true, duration);
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getTodayDayType() {
    const dow = new Date().getDay();
    return DAY_MAP[dow] || null;
  }

  // ── Modal ──
  function showModal(title, bodyHtml, actions) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const actionsEl = document.getElementById('modal-actions');
    actionsEl.innerHTML = '';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = a.className || 'btn-secondary btn-sm';
      btn.textContent = a.label;
      btn.onclick = () => { a.action(); hideModal(); };
      actionsEl.appendChild(btn);
    });
    overlay.hidden = false;
    overlay.onclick = e => { if (e.target === overlay) hideModal(); };
  }

  function hideModal() {
    document.getElementById('modal-overlay').hidden = true;
  }

  // ── GitHub API ──
  function getGithubConfig() {
    try { return JSON.parse(localStorage.getItem(GITHUB_KEY)); } catch { return null; }
  }

  function getDecryptedPat() {
    const enc = localStorage.getItem(PAT_KEY);
    if (!enc || !currentPassword) return null;
    try { return xorDecrypt(enc, currentPassword); } catch { return null; }
  }

  async function loadDBFromGitHub(patOverride) {
    const cfg = getGithubConfig();
    const pat = patOverride || getDecryptedPat();
    if (!cfg || !pat) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`, {
        headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      githubSha = data.sha;
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { return null; }
  }

  async function saveDBToGitHub() {
    const cfg = getGithubConfig();
    const pat = getDecryptedPat();
    if (!cfg || !pat || !DB) return false;
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(DB, null, 2))));
      const body = {
        message: `Gym Companion update ${todayStr()}`,
        content,
        branch: cfg.branch
      };
      if (githubSha) body.sha = githubSha;
      const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { console.error('GitHub save failed', res.status); return false; }
      const data = await res.json();
      githubSha = data.content.sha;
      return true;
    } catch (e) { console.error('GitHub save error', e); return false; }
  }

  function saveDBLocal() {
    if (DB) {
      try {
        localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(DB));
      } catch (e) { }
    }
  }

  async function persistDB() {
    saveDBLocal();
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const ok = await saveDBToGitHub();
      if (ok) toast('💾 Guardado');
      else if (getGithubConfig()) toast('⚠️ Guardado local (sin GitHub)');
    }, 1200);
  }

  async function loadDB() {
    let data = await loadDBFromGitHub();
    if (!data) {
      const local = localStorage.getItem(DB_LOCAL_KEY);
      if (local) data = JSON.parse(local);
    }
    return data;
  }

  // ── Auth ──
  async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;

    currentPassword = pass;

    // Try loading DB first
    let data = await loadDB();

    // If no DB from GitHub, check if we have embedded fallback
    if (!data) {
      // Use inline default DB
      data = await getDefaultDB();
    }

    if (!data) {
      errEl.textContent = 'No se pudo cargar la base de datos';
      errEl.hidden = false;
      return;
    }

    DB = data;
    const hash = await sha256(SALT + pass);

    if (DB.auth.username.toLowerCase() !== user.toLowerCase() || DB.auth.passwordHash !== hash) {
      errEl.hidden = false;
      errEl.textContent = 'Usuario o contraseña incorrectos';
      currentPassword = '';
      return;
    }

    // Save session
    const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, hash }));
    } catch (e) { }
    saveDBLocal();

    showApp();
  }

  async function tryAutoLogin() {
    const session = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } })();
    if (!session) return false;

    // We need the password to decrypt PAT, but we can still load local DB
    const local = localStorage.getItem(DB_LOCAL_KEY);
    if (local) {
      DB = JSON.parse(local);
      if (DB.auth && DB.auth.username === session.user && DB.auth.passwordHash === session.hash) {
        showApp();
        return true;
      }
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    currentPassword = '';
    DB = null;
    document.getElementById('app-shell').hidden = true;
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-form').reset();
  }

  function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-shell').hidden = false;
    renderHoy();
  }

  // ── Workout Card In-Place Update ──
  function buildSeriesRowsHtml(logIdx, log) {
    let html = '';
    for (let s = 0; s < log.series; s++) {
      const val = log.reps.actual[s];
      html += `<div class="series-row">
        <span class="series-label">S${s + 1}</span>
        <button class="btn-icon" onclick="GymCompanion.adjustRep(${logIdx},${s},-1)">−</button>
        <input id="w-rep-${logIdx}-${s}" class="series-input" type="number" inputmode="numeric" value="${val !== null ? val : ''}" placeholder="${log.reps.expected}" onchange="GymCompanion.setRep(${logIdx},${s},this.value)">
        <button class="btn-icon" onclick="GymCompanion.adjustRep(${logIdx},${s},1)">+</button>
      </div>`;
    }
    return html;
  }

  function updateWorkoutCardInPlace(logIdx, entry) {
    const log = entry.logs[logIdx];
    const name = getExerciseName(log.exercise_id);

    const currentVol = computeVolume(log);
    const currentE1RM = computeE1RM(log);
    const prevEntries = DB.history.filter(h => h.date !== entry.date);
    let prevMaxVol = 0, prevMaxE1RM = 0;
    prevEntries.forEach(e => {
      e.logs.filter(l => l.exercise_id === log.exercise_id).forEach(l => {
        prevMaxVol = Math.max(prevMaxVol, computeVolume(l));
        prevMaxE1RM = Math.max(prevMaxE1RM, computeE1RM(l));
      });
    });
    const isVolRecord = currentVol > 0 && currentVol > prevMaxVol && log.reps.actual.some(r => r !== null);
    const isE1RMRecord = currentE1RM > 0 && currentE1RM > prevMaxE1RM && log.reps.actual.some(r => r !== null);

    const title = document.getElementById(`w-title-${logIdx}`);
    if (title) title.innerHTML = `${name}${isVolRecord ? ' <span class="record-badge">🏆 Volumen</span>' : ''}${isE1RMRecord ? ' <span class="record-badge">🏆 e1RM</span>' : ''}`;

    const subtitle = document.getElementById(`w-subtitle-${logIdx}`);
    if (subtitle) subtitle.textContent = `${log.series}×${log.reps.expected} · ${log.weight > 0 ? log.weight + ' kg' : 'Sin peso'}`;

    const weightInput = document.getElementById(`w-weight-${logIdx}`);
    if (weightInput) weightInput.value = log.weight;

    const seriesInput = document.getElementById(`w-series-${logIdx}`);
    if (seriesInput) seriesInput.value = log.series;

    const repsInput = document.getElementById(`w-reps-${logIdx}`);
    if (repsInput) repsInput.value = log.reps.expected;

    const seriesRows = document.getElementById(`w-seriesrows-${logIdx}`);
    if (seriesRows) seriesRows.innerHTML = buildSeriesRowsHtml(logIdx, log);

    const hasRecord = entry.logs.some((l) => {
      const vol = computeVolume(l);
      const e1rm = computeE1RM(l);
      const prev = DB.history.filter(h => h.date !== entry.date);
      let pVol = 0, pE1rm = 0;
      prev.forEach(e => e.logs.filter(x => x.exercise_id === l.exercise_id).forEach(x => {
        pVol = Math.max(pVol, computeVolume(x));
        pE1rm = Math.max(pE1rm, computeE1RM(x));
      }));
      return (vol > 0 && vol > pVol && l.reps.actual.some(r => r !== null)) ||
             (e1rm > 0 && e1rm > pE1rm && l.reps.actual.some(r => r !== null));
    });
    document.getElementById('hoy-badge').hidden = !hasRecord;
  }

  // ── Data Helpers ──
  function getLastValuesForExercise(exerciseId, dayType) {
    const entries = DB.history.filter(h => h.type === dayType);
    for (let i = entries.length - 1; i >= 0; i--) {
      const log = entries[i].logs.find(l => l.exercise_id === exerciseId);
      if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight, repsActual: log.reps.actual || [] };
    }
    return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
  }

  function getTodayEntry() {
    const today = todayStr();
    return DB.history.find(h => h.date === today);
  }

  function computeAvgReps(log) {
    const actual = log.reps.actual && log.reps.actual.length > 0 ? log.reps.actual : null;
    if (actual) return actual.reduce((a, b) => a + b, 0) / actual.length;
    return log.reps.expected;
  }

  function computeVolume(log) {
    const avg = computeAvgReps(log);
    if (log.weight > 0) return log.weight * log.series * avg;
    return log.series * avg;
  }

  function computeE1RM(log) {
    if (log.weight <= 0) return 0;
    const avg = computeAvgReps(log);
    return log.weight * (1 + avg / 30);
  }

  function getHistoricalRecords(exerciseId) {
    let maxVolume = 0, maxE1RM = 0;
    for (const entry of DB.history) {
      for (const log of entry.logs) {
        if (log.exercise_id === exerciseId) {
          maxVolume = Math.max(maxVolume, computeVolume(log));
          maxE1RM = Math.max(maxE1RM, computeE1RM(log));
        }
      }
    }
    return { maxVolume, maxE1RM };
  }

  function getExerciseName(id) {
    return DB.exercises[id] ? DB.exercises[id].name : id;
  }

  // ── View: Hoy ──
  function renderHoy() {
    const content = document.getElementById('hoy-content');
    const title = document.getElementById('hoy-title');
    const badge = document.getElementById('hoy-badge');
    badge.hidden = true;

    const todayEntry = getTodayEntry();
    const dayType = getTodayDayType();

    // If there's an active (uncompleted) workout today
    if (todayEntry && !todayEntry.completed) {
      title.textContent = `Entreno ${DAY_LABELS[todayEntry.type]}`;
      renderActiveWorkout(content, todayEntry);
      return;
    }

    // If today's workout is completed
    if (todayEntry && todayEntry.completed) {
      title.textContent = `${DAY_LABELS[todayEntry.type]} ✓`;
      renderCompletedToday(content, todayEntry);
      return;
    }

    // If today is a training day
    if (dayType && DB.routines[dayType]) {
      title.textContent = `Rutina de ${DAY_LABELS[dayType]}`;
      renderRoutinePreview(content, dayType, true);
      return;
    }

    // NOT a training day — show day selector
    title.textContent = 'Hoy';
    renderDaySelector(content);
  }

  function renderDaySelector(container) {
    let html = '<div class="day-selector"><p class="day-selector-title">Selecciona una rutina para entrenar</p>';
    for (const type of ['LUNES', 'MIERCOLES', 'VIERNES']) {
      const exercises = (DB.routines[type] || []).map(id => getExerciseName(id));
      const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
      html += `<button class="day-btn" data-day="${type}">
      <span class="day-icon">${DAY_ICONS[type]}</span>
      <span class="day-info">
        <span class="day-name">${DAY_LABELS[type]}</span>
        <span class="day-exercises">${exercises.length} ejercicios · ${preview}</span>
      </span>
    </button>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.day-btn').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.day;
        document.getElementById('hoy-title').textContent = `Rutina de ${DAY_LABELS[type]}`;
        renderRoutinePreview(container, type, true);
      };
    });
  }

  function renderRoutinePreview(container, dayType, showStartBtn) {
    const exerciseIds = DB.routines[dayType] || [];
    let html = '';

    exerciseIds.forEach(id => {
      const last = getLastValuesForExercise(id, dayType);
      const name = getExerciseName(id);
      html += `<div class="card">
      <div class="exercise-row">
        <div class="exercise-name">${name}</div>
        <div class="exercise-meta">
          <span class="meta-pill">📊 <strong>${last.series}</strong> series</span>
          <span class="meta-pill">🔄 <strong>${last.repsExpected}</strong> reps</span>
          ${last.weight > 0 ? `<span class="meta-pill">🏋️ <strong>${last.weight}</strong> kg</span>` : ''}
        </div>
      </div>
    </div>`;
    });

    if (showStartBtn) {
      html += `<div class="workout-actions">
      <button class="btn-primary" id="start-workout-btn">🚀 Iniciar entreno</button>
    </div>`;
      html += `<div class="routine-actions">
      <button class="btn-secondary btn-sm" id="add-exercise-btn">+ Añadir ejercicio</button>
      <button class="btn-secondary btn-sm" id="back-to-selector-btn">← Cambiar día</button>
    </div>`;
    }

    container.innerHTML = html;

    const startBtn = document.getElementById('start-workout-btn');
    if (startBtn) {
      startBtn.onclick = () => startWorkout(dayType);
    }

    const addBtn = document.getElementById('add-exercise-btn');
    if (addBtn) {
      addBtn.onclick = () => showAddExerciseModal(dayType);
    }

    const backBtn = document.getElementById('back-to-selector-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        document.getElementById('hoy-title').textContent = 'Hoy';
        renderDaySelector(container);
      };
    }
  }

  async function startWorkout(dayType) {
    const exerciseIds = DB.routines[dayType] || [];
    const logs = exerciseIds.map(id => {
      const last = getLastValuesForExercise(id, dayType);
      const actual = new Array(last.series).fill(null);
      return {
        exercise_id: id,
        name: getExerciseName(id),
        series: last.series,
        reps: { expected: last.repsExpected, actual },
        weight: last.weight
      };
    });

    const entry = {
      date: todayStr(),
      type: dayType,
      completed: false,
      logs
    };

    // Remove existing today entry if any
    DB.history = DB.history.filter(h => h.date !== todayStr());
    DB.history.push(entry);
    await persistDB();
    renderHoy();
    toast('💪 ¡Entreno iniciado!');
  }

  function renderActiveWorkout(container, entry) {
    let html = `<div class="workout-status">
    <span class="pulse-dot"></span>
    <span>Entreno en curso — ${DAY_LABELS[entry.type]}</span>
  </div>`;

    let hasRecord = false;

    entry.logs.forEach((log, logIdx) => {
      const name = getExerciseName(log.exercise_id);

      // Check for records
      const hist = getHistoricalRecords(log.exercise_id);
      // Exclude current entry from historical comparison
      const currentVol = computeVolume(log);
      const currentE1RM = computeE1RM(log);
      // Compare with previous historical max (excluding today)
      const prevEntries = DB.history.filter(h => h.date !== entry.date);
      let prevMaxVol = 0, prevMaxE1RM = 0;
      prevEntries.forEach(e => {
        e.logs.filter(l => l.exercise_id === log.exercise_id).forEach(l => {
          prevMaxVol = Math.max(prevMaxVol, computeVolume(l));
          prevMaxE1RM = Math.max(prevMaxE1RM, computeE1RM(l));
        });
      });

      const isVolRecord = currentVol > 0 && currentVol > prevMaxVol && log.reps.actual.some(r => r !== null);
      const isE1RMRecord = currentE1RM > 0 && currentE1RM > prevMaxE1RM && log.reps.actual.some(r => r !== null);
      if (isVolRecord || isE1RMRecord) hasRecord = true;

      html += `<div class="card" id="exercise-card-${logIdx}">
      <div class="card-header" data-idx="${logIdx}">
        <div>
          <div class="card-title" id="w-title-${logIdx}">
            ${name}
            ${isVolRecord ? '<span class="record-badge">🏆 Volumen</span>' : ''}
            ${isE1RMRecord ? '<span class="record-badge">🏆 e1RM</span>' : ''}
          </div>
          <div class="card-subtitle" id="w-subtitle-${logIdx}">${log.series}×${log.reps.expected} · ${log.weight > 0 ? log.weight + ' kg' : 'Sin peso'}</div>
        </div>
        <span class="card-chevron" id="chevron-${logIdx}">▼</span>
      </div>
      <div class="card-body" id="body-${logIdx}">`;

      // Weight & series/reps params
      html += `<div class="param-row">
      <label>Peso (kg)</label>
      <div class="flex-center gap-sm">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'weight',-2.5)">−</button>
        <input id="w-weight-${logIdx}" class="param-input" type="number" inputmode="decimal" step="0.5" value="${log.weight}" onchange="GymCompanion.setParam(${logIdx},'weight',this.value)">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'weight',2.5)">+</button>
      </div>
    </div>
    <div class="param-row">
      <label>Series</label>
      <div class="flex-center gap-sm">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'series',-1)">−</button>
        <input id="w-series-${logIdx}" class="param-input" type="number" inputmode="numeric" value="${log.series}" onchange="GymCompanion.setParam(${logIdx},'series',this.value)">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'series',1)">+</button>
      </div>
    </div>
    <div class="param-row">
      <label>Reps obj.</label>
      <div class="flex-center gap-sm">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'repsExpected',-1)">−</button>
        <input id="w-reps-${logIdx}" class="param-input" type="number" inputmode="numeric" value="${log.reps.expected}" onchange="GymCompanion.setParam(${logIdx},'repsExpected',this.value)">
        <button class="btn-icon" onclick="GymCompanion.adjustParam(${logIdx},'repsExpected',1)">+</button>
      </div>
    </div>`;

      // Per-series rep inputs
      html += `<div class="mt-sm"><p class="text-xs text-muted mb-sm" style="margin-top:8px;">Reps realizadas por serie:</p><div id="w-seriesrows-${logIdx}">`;
      for (let s = 0; s < log.series; s++) {
        const val = log.reps.actual[s];
        html += `<div class="series-row">
        <span class="series-label">S${s + 1}</span>
        <button class="btn-icon" onclick="GymCompanion.adjustRep(${logIdx},${s},-1)">−</button>
        <input id="w-rep-${logIdx}-${s}" class="series-input" type="number" inputmode="numeric" value="${val !== null ? val : ''}" placeholder="${log.reps.expected}" onchange="GymCompanion.setRep(${logIdx},${s},this.value)">
        <button class="btn-icon" onclick="GymCompanion.adjustRep(${logIdx},${s},1)">+</button>
      </div>`;
      }
      html += '</div></div>';

      // Remove from routine
      html += `<div class="routine-actions">
      <button class="btn-sm btn-danger" onclick="GymCompanion.removeExerciseFromRoutine('${entry.type}','${log.exercise_id}',${logIdx})">Quitar de rutina</button>
    </div>`;

      html += '</div></div>';
    });

    document.getElementById('hoy-badge').hidden = !hasRecord;

    html += `<div class="workout-actions">
    <button class="btn-secondary" id="add-exercise-mid-btn">+ Ejercicio</button>
    <button class="btn-primary" id="finish-workout-btn">✅ Finalizar entreno</button>
  </div>`;

    const openIndices = new Set();
    container.querySelectorAll('.card-body.open').forEach(body => {
      openIndices.add(body.id.replace('body-', ''));
    });

    container.innerHTML = html;

    // Expand/collapse handlers
    container.querySelectorAll('.card-header').forEach(header => {
      header.onclick = () => {
        const idx = header.dataset.idx;
        const body = document.getElementById(`body-${idx}`);
        const chevron = document.getElementById(`chevron-${idx}`);
        body.classList.toggle('open');
        chevron.classList.toggle('open');
      };
    });

    openIndices.forEach(idx => {
      const body = document.getElementById(`body-${idx}`);
      const chevron = document.getElementById(`chevron-${idx}`);
      if (body) body.classList.add('open');
      if (chevron) chevron.classList.add('open');
    });

    document.getElementById('finish-workout-btn').onclick = () => finishWorkout();
    const addMidBtn = document.getElementById('add-exercise-mid-btn');
    if (addMidBtn) addMidBtn.onclick = () => showAddExerciseModal(entry.type);
  }

  async function finishWorkout() {
    const entry = getTodayEntry();
    if (!entry) return;
    // Fill null reps with expected
    entry.logs.forEach(log => {
      log.reps.actual = log.reps.actual.map((v, i) => v !== null ? v : log.reps.expected);
    });
    entry.completed = true;
    await persistDB();
    renderHoy();
    toast('🎉 ¡Entreno completado!');
  }

  function renderCompletedToday(container, entry) {
    let html = `<div class="workout-status" style="background:rgba(0,184,148,0.1);border-color:rgba(0,184,148,0.3);">
    <span style="color:var(--green);font-size:18px;">✓</span>
    <span>Entreno completado</span>
  </div>`;

    entry.logs.forEach(log => {
      const name = getExerciseName(log.exercise_id);
      const reps = log.reps.actual.length > 0 ? log.reps.actual.join(', ') : `${log.reps.expected}×${log.series}`;
      html += `<div class="card">
      <div class="exercise-row">
        <div class="exercise-name">${name}</div>
        <div class="exercise-meta">
          <span class="meta-pill">📊 <strong>${log.series}</strong></span>
          <span class="meta-pill">🔄 <strong>${reps}</strong></span>
          ${log.weight > 0 ? `<span class="meta-pill">🏋️ <strong>${log.weight}</strong> kg</span>` : ''}
        </div>
      </div>
    </div>`;
    });

    container.innerHTML = html;
  }

  // ── Exercise Management ──
  function showAddExerciseModal(dayType) {
    const currentIds = DB.routines[dayType] || [];
    const allExercises = Object.values(DB.exercises).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const available = allExercises.filter(e => !currentIds.includes(e.id));

    let bodyHtml = `<input type="text" class="exercise-search" id="exercise-search-input" placeholder="Buscar ejercicio...">
    <div class="exercise-list" id="exercise-modal-list">`;
    available.forEach(e => {
      bodyHtml += `<div class="exercise-list-item" data-id="${e.id}"><span>${e.name}</span><span class="add-icon">+</span></div>`;
    });
    bodyHtml += '</div>';
    bodyHtml += `<div class="mt-md"><button class="btn-secondary btn-sm" id="create-exercise-btn">Crear nuevo ejercicio</button></div>`;

    showModal(`Añadir a ${DAY_LABELS[dayType]}`, bodyHtml, [
      { label: 'Cerrar', className: 'btn-secondary btn-sm', action: () => { } }
    ]);

    // Search filter
    setTimeout(() => {
      const searchInput = document.getElementById('exercise-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.oninput = () => {
          const q = searchInput.value.toLowerCase();
          document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        };
      }

      document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
        el.onclick = async () => {
          const id = el.dataset.id;
          if (!DB.routines[dayType]) DB.routines[dayType] = [];
          DB.routines[dayType].push(id);

          // If workout is in progress, add to today's entry too
          const todayEntry = getTodayEntry();
          if (todayEntry && !todayEntry.completed && todayEntry.type === dayType) {
            const last = getLastValuesForExercise(id, dayType);
            todayEntry.logs.push({
              exercise_id: id,
              name: getExerciseName(id),
              series: last.series,
              reps: { expected: last.repsExpected, actual: new Array(last.series).fill(null) },
              weight: last.weight
            });
          }

          await persistDB();
          hideModal();
          renderHoy();
          toast(`✅ ${getExerciseName(id)} añadido`);
        };
      });

      const createBtn = document.getElementById('create-exercise-btn');
      if (createBtn) {
        createBtn.onclick = () => {
          hideModal();
          showCreateExerciseModal(dayType);
        };
      }
    }, 50);
  }

  function showCreateExerciseModal(dayType) {
    const bodyHtml = `<div class="input-group">
    <label for="new-exercise-name">Nombre del ejercicio</label>
    <input type="text" id="new-exercise-name" placeholder="Ej: Press Arnold">
  </div>`;

    showModal('Crear nuevo ejercicio', bodyHtml, [
      { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => { } },
      {
        label: 'Crear y añadir', className: 'btn-primary btn-sm', action: async () => {
          const name = document.getElementById('new-exercise-name').value.trim();
          if (!name) return;
          const id = name.toLowerCase().replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/[úù]/g, 'u').replace(/ñ/g, 'n').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          if (DB.exercises[id]) { toast('⚠️ Ya existe ese ejercicio'); return; }
          DB.exercises[id] = { id, name };
          if (!DB.routines[dayType]) DB.routines[dayType] = [];
          DB.routines[dayType].push(id);
          await persistDB();
          renderHoy();
          toast(`✅ ${name} creado y añadido`);
        }
      }
    ]);

    setTimeout(() => {
      const input = document.getElementById('new-exercise-name');
      if (input) input.focus();
    }, 100);
  }

  // ── Param adjustments (exposed globally) ──
  window.GymCompanion = {
    adjustParam: async (logIdx, param, delta) => {
      const entry = getTodayEntry();
      if (!entry) return;
      const log = entry.logs[logIdx];
      if (param === 'weight') {
        log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
      } else if (param === 'series') {
        const newSeries = Math.max(1, log.series + delta);
        if (newSeries > log.series) {
          log.reps.actual.push(null);
        } else if (newSeries < log.series) {
          log.reps.actual.pop();
        }
        log.series = newSeries;
      } else if (param === 'repsExpected') {
        log.reps.expected = Math.max(1, log.reps.expected + delta);
      }
      await persistDB();
      updateWorkoutCardInPlace(logIdx, entry);
    },

    setParam: async (logIdx, param, value) => {
      const entry = getTodayEntry();
      if (!entry) return;
      const log = entry.logs[logIdx];
      const num = parseFloat(value) || 0;
      if (param === 'weight') log.weight = Math.max(0, num);
      else if (param === 'series') {
        const newSeries = Math.max(1, Math.round(num));
        while (log.reps.actual.length < newSeries) log.reps.actual.push(null);
        while (log.reps.actual.length > newSeries) log.reps.actual.pop();
        log.series = newSeries;
      }
      else if (param === 'repsExpected') log.reps.expected = Math.max(1, Math.round(num));
      await persistDB();
      updateWorkoutCardInPlace(logIdx, entry);
    },

    adjustRep: async (logIdx, seriesIdx, delta) => {
      const entry = getTodayEntry();
      if (!entry) return;
      const log = entry.logs[logIdx];
      const current = log.reps.actual[seriesIdx] !== null ? log.reps.actual[seriesIdx] : log.reps.expected;
      log.reps.actual[seriesIdx] = Math.max(0, current + delta);
      await persistDB();
      const input = document.getElementById(`w-rep-${logIdx}-${seriesIdx}`);
      if (input) input.value = log.reps.actual[seriesIdx];
      updateWorkoutCardInPlace(logIdx, entry);
    },

    setRep: async (logIdx, seriesIdx, value) => {
      const entry = getTodayEntry();
      if (!entry) return;
      const log = entry.logs[logIdx];
      const num = parseInt(value);
      log.reps.actual[seriesIdx] = isNaN(num) ? null : Math.max(0, num);
      await persistDB();
      updateWorkoutCardInPlace(logIdx, entry);
    },

    deleteHistoryEntry: (date, event) => {
      event.stopPropagation();
      const entry = DB.history.find(h => h.date === date);
      if (!entry) return;
      showModal(
        '¿Borrar entreno?',
        `<p class="text-sm">Se eliminará el entreno del <strong>${formatDate(date)}</strong>. Esta acción no se puede deshacer.</p>`,
        [
          { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
          {
            label: 'Borrar', className: 'btn-danger btn-sm', action: async () => {
              DB.history = DB.history.filter(h => h.date !== date);
              await persistDB();
              renderHistorial();
              toast('Entreno eliminado');
            }
          }
        ]
      );
    },

    adjustHistoryParam: async (date, logIdx, param, delta) => {
      const entry = DB.history.find(h => h.date === date);
      if (!entry) return;
      const log = entry.logs[logIdx];
      if (param === 'weight') {
        log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
      } else if (param === 'series') {
        const newSeries = Math.max(1, log.series + delta);
        while (log.reps.actual.length < newSeries) log.reps.actual.push(null);
        while (log.reps.actual.length > newSeries) log.reps.actual.pop();
        log.series = newSeries;
      } else if (param === 'repsExpected') {
        log.reps.expected = Math.max(1, log.reps.expected + delta);
      }
      await persistDB();
      renderHistorialDetail(date);
    },

    setHistoryParam: async (date, logIdx, param, value) => {
      const entry = DB.history.find(h => h.date === date);
      if (!entry) return;
      const log = entry.logs[logIdx];
      const num = parseFloat(value) || 0;
      if (param === 'weight') log.weight = Math.max(0, num);
      else if (param === 'series') {
        const newSeries = Math.max(1, Math.round(num));
        while (log.reps.actual.length < newSeries) log.reps.actual.push(null);
        while (log.reps.actual.length > newSeries) log.reps.actual.pop();
        log.series = newSeries;
      } else if (param === 'repsExpected') log.reps.expected = Math.max(1, Math.round(num));
      await persistDB();
      renderHistorialDetail(date);
    },

    adjustHistoryRep: async (date, logIdx, seriesIdx, delta) => {
      const entry = DB.history.find(h => h.date === date);
      if (!entry) return;
      const log = entry.logs[logIdx];
      const current = log.reps.actual[seriesIdx] !== null ? log.reps.actual[seriesIdx] : log.reps.expected;
      log.reps.actual[seriesIdx] = Math.max(0, current + delta);
      await persistDB();
      renderHistorialDetail(date);
    },

    setHistoryRep: async (date, logIdx, seriesIdx, value) => {
      const entry = DB.history.find(h => h.date === date);
      if (!entry) return;
      const log = entry.logs[logIdx];
      const num = parseInt(value);
      log.reps.actual[seriesIdx] = isNaN(num) ? null : Math.max(0, num);
      await persistDB();
    },

    removeExerciseFromRoutine: (dayType, exerciseId, logIdx) => {
      showModal('¿Quitar ejercicio?', `<p class="text-sm">Se eliminará <strong>${getExerciseName(exerciseId)}</strong> de la rutina de ${DAY_LABELS[dayType]}. Los registros históricos se conservarán.</p>`, [
        { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => { } },
        {
          label: 'Quitar', className: 'btn-danger btn-sm', action: async () => {
            DB.routines[dayType] = DB.routines[dayType].filter(id => id !== exerciseId);
            const entry = getTodayEntry();
            if (entry && !entry.completed) {
              entry.logs = entry.logs.filter(l => l.exercise_id !== exerciseId);
            }
            await persistDB();
            renderHoy();
            toast(`Ejercicio eliminado de ${DAY_LABELS[dayType]}`);
          }
        }
      ]);
    }
  };

  // ── View: Historial ──
  let historialFilter = 'TODOS';
  let editingHistorialExercise = null; // { date, logIdx } or null

  function renderHistorial() {
    const content = document.getElementById('historial-content');
    const filters = document.getElementById('historial-filters');
    const header = document.querySelector('#view-historial .view-header h2');
    if (filters) filters.style.display = '';
    if (header) header.textContent = 'Historial';

    editingHistorialExercise = null;

    const entries = [...DB.history].sort((a, b) => b.date.localeCompare(a.date));
    const filtered = historialFilter === 'TODOS' ? entries : entries.filter(e => e.type === historialFilter);

    if (filtered.length === 0) {
      content.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No hay sesiones registradas</p></div>';
      return;
    }

    let html = '<div class="historial-list">';
    filtered.forEach(entry => {
      const completed = entry.completed !== false;
      const exercises = entry.logs.map(l => getExerciseName(l.exercise_id));
      const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
      html += `<div class="historial-entry-btn" data-date="${entry.date}">
      <span class="day-icon">${DAY_ICONS[entry.type] || '📋'}</span>
      <span class="day-info">
        <span class="day-name">${DAY_LABELS[entry.type] || entry.type} ${completed ? '✅' : '⏸️'}</span>
        <span class="day-exercises">${formatDate(entry.date)} · ${entry.logs.length} ejercicios</span>
        <span class="day-exercises">${preview}</span>
      </span>
      <button class="btn-icon historial-delete-btn" style="font-size:14px;" data-date="${entry.date}">🗑️</button>
    </div>`;
    });
    html += '</div>';

    content.innerHTML = html;

    content.querySelectorAll('.historial-entry-btn').forEach(btn => {
      btn.onclick = (e) => {
        if (e.target.closest('.historial-delete-btn')) return;
        renderHistorialDetail(btn.dataset.date);
      };
    });

    content.querySelectorAll('.historial-delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        GymCompanion.deleteHistoryEntry(btn.dataset.date, e);
      };
    });
  }

  function renderHistorialDetail(date) {
    const entry = DB.history.find(h => h.date === date);
    if (!entry) return;

    const content = document.getElementById('historial-content');
    const filters = document.getElementById('historial-filters');
    const header = document.querySelector('#view-historial .view-header h2');
    if (filters) filters.style.display = 'none';
    if (header) header.textContent = `${DAY_LABELS[entry.type] || entry.type} — ${formatDate(date)}`;

    let html = '';

    entry.logs.forEach((log, logIdx) => {
      const name = getExerciseName(log.exercise_id);
      const isEditing = editingHistorialExercise && editingHistorialExercise.date === date && editingHistorialExercise.logIdx === logIdx;

      if (isEditing) {
        html += `<div class="card historial-detail-card editing">
        <div class="exercise-row" style="flex-direction:column;align-items:stretch;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="exercise-name">${name}</div>
            <button class="btn-icon historial-edit-btn" data-logidx="${logIdx}">✅</button>
          </div>
          <div class="param-row">
            <label>Peso (kg)</label>
            <div class="flex-center gap-sm">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'weight',-2.5)">−</button>
              <input class="param-input" type="number" inputmode="decimal" step="0.5" value="${log.weight}" onchange="GymCompanion.setHistoryParam('${date}',${logIdx},'weight',this.value)">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'weight',2.5)">+</button>
            </div>
          </div>
          <div class="param-row">
            <label>Series</label>
            <div class="flex-center gap-sm">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'series',-1)">−</button>
              <input class="param-input" type="number" inputmode="numeric" value="${log.series}" onchange="GymCompanion.setHistoryParam('${date}',${logIdx},'series',this.value)">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'series',1)">+</button>
            </div>
          </div>
          <div class="param-row">
            <label>Reps obj.</label>
            <div class="flex-center gap-sm">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'repsExpected',-1)">−</button>
              <input class="param-input" type="number" inputmode="numeric" value="${log.reps.expected}" onchange="GymCompanion.setHistoryParam('${date}',${logIdx},'repsExpected',this.value)">
              <button class="btn-icon" onclick="GymCompanion.adjustHistoryParam('${date}',${logIdx},'repsExpected',1)">+</button>
            </div>
          </div>
          <div class="mt-sm"><p class="text-xs text-muted mb-sm">Reps por serie:</p>`;
        for (let s = 0; s < log.series; s++) {
          const val = log.reps.actual[s];
          html += `<div class="series-row">
            <span class="series-label">S${s + 1}</span>
            <button class="btn-icon" onclick="GymCompanion.adjustHistoryRep('${date}',${logIdx},${s},-1)">−</button>
            <input class="series-input" type="number" inputmode="numeric" value="${val !== null ? val : ''}" placeholder="${log.reps.expected}" onchange="GymCompanion.setHistoryRep('${date}',${logIdx},${s},this.value)">
            <button class="btn-icon" onclick="GymCompanion.adjustHistoryRep('${date}',${logIdx},${s},1)">+</button>
          </div>`;
        }
        html += `</div></div></div>`;
      } else {
        const reps = log.reps.actual && log.reps.actual.length > 0 && log.reps.actual.some(r => r !== null)
          ? log.reps.actual.map(r => r !== null ? r : '-').join(', ')
          : `${log.reps.expected} × ${log.series}`;
        html += `<div class="card historial-detail-card">
        <div class="exercise-row">
          <div class="exercise-name">${name}</div>
          <div class="exercise-meta">
            <span class="meta-pill">📊 <strong>${log.series}</strong>s</span>
            <span class="meta-pill">🔄 <strong>${reps}</strong></span>
            ${log.weight > 0 ? `<span class="meta-pill">🏋️ <strong>${log.weight}</strong> kg</span>` : ''}
          </div>
          <button class="btn-icon historial-edit-btn" data-logidx="${logIdx}">✏️</button>
        </div>
      </div>`;
      }
    });

    html += `<div class="routine-actions">
      <button class="btn-secondary btn-sm" id="historial-back-btn">← Volver al historial</button>
    </div>`;

    content.innerHTML = html;

    document.getElementById('historial-back-btn').onclick = () => renderHistorial();

    content.querySelectorAll('.historial-edit-btn').forEach(btn => {
      btn.onclick = () => {
        const logIdx = parseInt(btn.dataset.logidx);
        if (editingHistorialExercise && editingHistorialExercise.date === date && editingHistorialExercise.logIdx === logIdx) {
          editingHistorialExercise = null;
        } else {
          editingHistorialExercise = { date, logIdx };
        }
        renderHistorialDetail(date);
      };
    });
  }

  // ── View: Gráficas ──
  function initCharts() {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    document.getElementById('chart-from').value = threeMonthsAgo.toISOString().split('T')[0];
    document.getElementById('chart-to').value = todayStr();
    updateChartExercises();
  }

  function updateChartExercises() {
    const from = document.getElementById('chart-from').value;
    const to = document.getElementById('chart-to').value;
    const entries = DB.history.filter(h => h.date >= from && h.date <= to);
    const exerciseSet = new Set();

    entries.forEach(e => e.logs.forEach(l => exerciseSet.add(l.exercise_id)));

    const select = document.getElementById('chart-exercise-select');
    const currentVal = select.value;
    const exerciseIds = [...exerciseSet].sort((a, b) => getExerciseName(a).localeCompare(getExerciseName(b), 'es'));

    let html = '<option value="">-- Selecciona un ejercicio --</option>';
    html += exerciseIds.map(id => `<option value="${id}">${getExerciseName(id)}</option>`).join('');
    select.innerHTML = html;

    if (currentVal && exerciseIds.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  function renderChart() {
    const from = document.getElementById('chart-from').value;
    const to = document.getElementById('chart-to').value;
    const chartType = document.querySelector('.toggle-btn.active')?.dataset.chart || 'line';
    const selectedExercise = document.getElementById('chart-exercise-select').value;
    const selectedExercises = selectedExercise ? [selectedExercise] : [];

    if (selectedExercises.length === 0) {
      if (currentChart) { currentChart.destroy(); currentChart = null; }
      if (currentWeightChart) { currentWeightChart.destroy(); currentWeightChart = null; }
      return;
    }

    const entries = DB.history.filter(h => h.date >= from && h.date <= to).sort((a, b) => a.date.localeCompare(b.date));

    const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#00b894', '#a29bfe', '#74b9ff', '#fd79a8'];
    const datasets = [];
    const weightDatasets = [];

    selectedExercises.forEach((exerciseId, idx) => {
      const color = colors[idx % colors.length];
      const volData = [];
      const e1rmData = [];
      const weightData = [];

      entries.forEach(entry => {
        const log = entry.logs.find(l => l.exercise_id === exerciseId);
        if (log) {
          const vol = computeVolume(log);
          const e1rm = computeE1RM(log);
          volData.push({ x: entry.date, y: Math.round(vol * 10) / 10 });
          if (e1rm > 0) e1rmData.push({ x: entry.date, y: Math.round(e1rm * 10) / 10 });
          if (log.weight > 0) weightData.push({ x: entry.date, y: log.weight });
        }
      });

      const name = getExerciseName(exerciseId);

      datasets.push({
        label: `${name} — Volumen`,
        data: volData,
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.3,
        fill: chartType === 'line',
        yAxisID: 'y',
        type: chartType
      });

      if (e1rmData.length > 0) {
        datasets.push({
          label: `${name} — e1RM`,
          data: e1rmData,
          borderColor: color,
          backgroundColor: color + '88',
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
          yAxisID: 'y1',
          type: 'line'
        });
      }

      if (weightData.length > 0) {
        weightDatasets.push({
          label: `${name} — Peso`,
          data: weightData,
          borderColor: color,
          backgroundColor: color + '33',
          tension: 0.3,
          fill: chartType === 'line',
          yAxisID: 'y',
          type: chartType
        });
      }
    });

    if (currentChart) currentChart.destroy();
    if (currentWeightChart) currentWeightChart.destroy();

    const ctx = document.getElementById('chart-canvas').getContext('2d');
    const ctxWeight = document.getElementById('chart-canvas-weight').getContext('2d');

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, labels: { color: '#edf0f7', font: { size: 11, family: 'Inter' }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: '#161626',
          titleColor: '#edf0f7',
          bodyColor: '#edf0f7',
          borderColor: 'rgba(108,92,231,0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10
        }
      }
    };

    currentChart = new Chart(ctx, {
      type: chartType,
      data: { datasets },
      options: {
        ...commonOptions,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'week', tooltipFormat: 'dd MMM yyyy' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#888', font: { size: 10 } }
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Volumen', color: '#888', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#888', font: { size: 10 } }
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'e1RM (kg)', color: '#888', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            ticks: { color: '#888', font: { size: 10 } }
          }
        }
      }
    });

    currentWeightChart = new Chart(ctxWeight, {
      type: chartType,
      data: { datasets: weightDatasets },
      options: {
        ...commonOptions,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'week', tooltipFormat: 'dd MMM yyyy' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#888', font: { size: 10 } }
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Peso (kg)', color: '#888', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#888', font: { size: 10 } }
          }
        }
      }
    });
  }

  // ── View: Ajustes ──
  function initSettings() {
    const cfg = getGithubConfig();
    if (cfg) {
      document.getElementById('set-repo').value = cfg.repo || '';
      document.getElementById('set-branch').value = cfg.branch || 'main';
      document.getElementById('set-path').value = cfg.path || 'db.json';
    }

    // Restore PAT to field if we can decrypt it
    const pat = getDecryptedPat();
    if (pat) document.getElementById('set-pat').value = pat;

    // Show password confirmation field if session was restored without password
    document.getElementById('confirm-pass-group').hidden = !!currentPassword;
    if (!currentPassword) document.getElementById('set-confirm-pass').value = '';
  }

  function setupSettings() {
    async function confirmPasswordIfNeeded() {
      if (currentPassword) return true;
      const confirmPass = document.getElementById('set-confirm-pass').value;
      if (!confirmPass) { toast('⚠️ Introduce tu contraseña para cifrar el PAT'); return false; }
      const hash = await sha256(SALT + confirmPass);
      if (hash !== DB.auth.passwordHash) { toast('❌ Contraseña incorrecta'); return false; }
      currentPassword = confirmPass;
      document.getElementById('confirm-pass-group').hidden = true;
      return true;
    }

    document.getElementById('save-github-btn').onclick = async () => {
      const repo = document.getElementById('set-repo').value.trim();
      const branch = document.getElementById('set-branch').value.trim() || 'main';
      const pat = document.getElementById('set-pat').value.trim();
      const path = document.getElementById('set-path').value.trim() || 'db.json';

      if (!repo || !pat) { toast('⚠️ Repo y PAT requeridos'); return; }
      if (!await confirmPasswordIfNeeded()) return;

      localStorage.setItem(GITHUB_KEY, JSON.stringify({ repo, branch, path }));
      localStorage.setItem(PAT_KEY, xorEncrypt(pat, currentPassword));
      toast('✅ Configuración guardada — sincronizando...');
      persistDB();
    };

    document.getElementById('test-github-btn').onclick = async () => {
      const statusEl = document.getElementById('github-status');
      statusEl.hidden = false;
      statusEl.textContent = 'Probando conexión...';
      statusEl.className = 'status-msg';

      if (!await confirmPasswordIfNeeded()) {
        statusEl.textContent = '⚠️ Introduce tu contraseña primero';
        statusEl.classList.add('error');
        return;
      }

      const patInput = document.getElementById('set-pat').value.trim();
      const ok = await loadDBFromGitHub(patInput || undefined);
      if (ok) {
        statusEl.textContent = '✅ Conexión exitosa. DB cargada.';
        statusEl.classList.add('success');
        DB = ok;
        saveDBLocal();
      } else {
        statusEl.textContent = '❌ No se pudo conectar. Verifica repo, PAT y rama.';
        statusEl.classList.add('error');
      }
    };

    document.getElementById('change-pass-btn').onclick = async () => {
      const oldPass = document.getElementById('set-old-pass').value;
      const newPass = document.getElementById('set-new-pass').value;
      const statusEl = document.getElementById('pass-status');
      statusEl.hidden = false;

      const oldHash = await sha256(SALT + oldPass);
      if (oldHash !== DB.auth.passwordHash) {
        statusEl.textContent = '❌ Contraseña actual incorrecta';
        statusEl.className = 'status-msg error';
        return;
      }

      const newHash = await sha256(SALT + newPass);
      DB.auth.passwordHash = newHash;
      currentPassword = newPass;

      // Re-encrypt PAT with new password
      const pat = document.getElementById('set-pat').value.trim();
      if (pat) localStorage.setItem(PAT_KEY, xorEncrypt(pat, currentPassword));

      // Update session
      const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user: DB.auth.username, hash: newHash }));

      await persistDB();
      statusEl.textContent = '✅ Contraseña cambiada correctamente';
      statusEl.className = 'status-msg success';
      document.getElementById('set-old-pass').value = '';
      document.getElementById('set-new-pass').value = '';
    };

    document.getElementById('export-btn').onclick = () => {
      const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym_companion_backup_${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('📦 JSON exportado');
    };

    document.getElementById('import-file').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.exercises || !data.history || !data.auth) {
          toast('⚠️ Formato de JSON inválido');
          return;
        }
        DB = data;
        githubSha = null;
        await persistDB();
        toast('✅ JSON importado correctamente');
        renderHoy();
      } catch {
        toast('❌ Error al importar');
      }
    };

    document.getElementById('logout-btn').onclick = logout;
  }

  // ── Navigation ──
  function setupTabs() {
    document.querySelectorAll('#tab-bar .tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('#tab-bar .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');

        if (view === 'hoy') renderHoy();
        else if (view === 'historial') renderHistorial();
        else if (view === 'graficas') { initCharts(); }
        else if (view === 'ajustes') initSettings();
      };
    });
  }

  function setupFilters() {
    document.querySelectorAll('#historial-filters .filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#historial-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        historialFilter = btn.dataset.filter;
        renderHistorial();
      };
    });

    // Chart controls
    document.getElementById('chart-from')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
    document.getElementById('chart-to')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
    document.getElementById('chart-exercise-select')?.addEventListener('change', renderChart);

    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderChart();
      };
    });
  }

  // ── Default DB (fetch local file) ──
  async function getDefaultDB() {
    if (typeof defaultDBData !== 'undefined') {
      return defaultDBData;
    }
    try {
      const res = await fetch('./db.json');
      if (res.ok) return await res.json();
    } catch { }
    return null;
  }

  // ── Init ──
  async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    // Setup event listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    setupTabs();
    setupFilters();
    setupSettings();

    // Try auto-login
    const autoLogged = await tryAutoLogin();
    if (!autoLogged) {
      document.getElementById('login-screen').classList.add('active');
    }
  }

  init();

})();
