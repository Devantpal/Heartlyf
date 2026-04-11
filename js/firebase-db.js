/**
 * HeartLyft – Firebase Realtime Database Module
 * ─────────────────────────────────────────────
 * Mapped exactly to the live database schema:
 *
 * /patient          → { age, deviceId, id, name }
 * /user             → { name, role, telegramChatId }
 * /spo2_data        → { [timestamp]: { bpm, spo2 } }
 * /ecg_data         → { [timestamp]: { value } }
 * /ml_prediction    → { [timestamp]: { confidence, risk } }
 * /alerts           → { [alertId]: { severity, timestamp, type, value } }
 */

/* ═══════════════════════════════════════════════
   DB PATH CONSTANTS  (edit here if schema changes)
═══════════════════════════════════════════════ */
const PATHS = {
  patient:       '/patient',
  user:          '/user',
  spo2Data:      '/spo2_data',
  ecgData:       '/ecg_data',
  mlPrediction:  '/ml_prediction',
  alerts:        '/alerts'
};

/* ═══════════════════════════════════════════════
   READ HELPERS
═══════════════════════════════════════════════ */
const DB = {

  /* ── Patient info (single patient record) ── */
  readPatient:   ()   => db.ref(PATHS.patient).once('value'),
  listenPatient: (cb) => {
    const ref = db.ref(PATHS.patient);
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ── User info ── */
  readUser:   ()   => db.ref(PATHS.user).once('value'),
  listenUser: (cb) => {
    const ref = db.ref(PATHS.user);
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ── SpO2 + BPM: latest N records ── */
  readLatestSpo2: (limit = 1) =>
    db.ref(PATHS.spo2Data).orderByKey().limitToLast(limit).once('value'),
  listenSpo2: (cb, limit = 60) => {
    const ref = db.ref(PATHS.spo2Data).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, ...child.val() }));
      cb(items);
    });
    return () => ref.off('value');
  },
  listenLatestSpo2: (cb) => {
    const ref = db.ref(PATHS.spo2Data).orderByKey().limitToLast(1);
    ref.on('value', snap => {
      let latest = null;
      snap.forEach(child => { latest = { ts: child.key, ...child.val() }; });
      cb(latest);
    });
    return () => ref.off('value');
  },

  /* ── ECG raw samples ── */
  readLatestEcg: (limit = 1) =>
    db.ref(PATHS.ecgData).orderByKey().limitToLast(limit).once('value'),
  listenEcg: (cb, limit = 200) => {
    const ref = db.ref(PATHS.ecgData).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, value: child.val().value }));
      cb(items);
    });
    return () => ref.off('value');
  },

  /* ── ML Prediction: latest ── */
  readLatestPrediction: (limit = 1) =>
    db.ref(PATHS.mlPrediction).orderByKey().limitToLast(limit).once('value'),
  listenPrediction: (cb) => {
    const ref = db.ref(PATHS.mlPrediction).orderByKey().limitToLast(1);
    ref.on('value', snap => {
      let latest = null;
      snap.forEach(child => { latest = { ts: child.key, ...child.val() }; });
      cb(latest);
    });
    return () => ref.off('value');
  },
  listenAllPredictions: (cb, limit = 50) => {
    const ref = db.ref(PATHS.mlPrediction).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, ...child.val() }));
      cb(items);
    });
    return () => ref.off('value');
  },

  /* ── Alerts ── */
  readAlerts: () => db.ref(PATHS.alerts).once('value'),
  listenAlerts: (cb) => {
    const ref = db.ref(PATHS.alerts);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ id: child.key, ...child.val() }));
      // Sort newest first by timestamp
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      cb(items);
    });
    return () => ref.off('value');
  },

  /* ── WRITE: append new SpO2 reading ── */
  writeVital: (bpm, spo2) => {
    const ts = Date.now();
    return db.ref(`${PATHS.spo2Data}/${ts}`).set({ bpm, spo2 });
  },

  /* ── WRITE: append new ECG sample ── */
  writeEcgSample: (value) => {
    const ts = Date.now();
    return db.ref(`${PATHS.ecgData}/${ts}`).set({ value });
  },

  /* ── WRITE: append ML prediction ── */
  writePrediction: (confidence, risk) => {
    const ts = Date.now();
    return db.ref(`${PATHS.mlPrediction}/${ts}`).set({ confidence, risk });
  },

  /* ── WRITE: push a new alert ── */
  writeAlert: (type, severity, value) => {
    const alertId = 'alert_' + String(Date.now()).slice(-6);
    return db.ref(`${PATHS.alerts}/${alertId}`).set({
      type, severity, value,
      timestamp: Math.floor(Date.now() / 1000)
    });
  },

  /* ── WRITE: update patient info ── */
  updatePatient: (data) => db.ref(PATHS.patient).update(data),

  /* ── WRITE: update user info ── */
  updateUser: (data) => db.ref(PATHS.user).update(data),

  /* ── UTILITY: get last N spo2 readings as arrays ── */
  async getVitalHistory(limit = 60) {
    const snap = await db.ref(PATHS.spo2Data).orderByKey().limitToLast(limit).once('value');
    const bpms = [], spo2s = [];
    snap.forEach(child => {
      const v = child.val();
      if (v.bpm)  bpms.push(v.bpm);
      if (v.spo2) spo2s.push(v.spo2);
    });
    return { bpms, spo2s };
  },

  /* ── UTILITY: aggregate stats for researcher ── */
  async getResearchStats() {
    const [spo2Snap, ecgSnap, predSnap, alertSnap] = await Promise.all([
      db.ref(PATHS.spo2Data).once('value'),
      db.ref(PATHS.ecgData).once('value'),
      db.ref(PATHS.mlPrediction).once('value'),
      db.ref(PATHS.alerts).once('value')
    ]);
    let totalBpm = 0, bpmCount = 0, totalSpo2 = 0, avgConf = 0, confCount = 0;
    spo2Snap.forEach(c => {
      const v = c.val();
      if (v.bpm)  { totalBpm += v.bpm;  bpmCount++; }
      if (v.spo2) { totalSpo2 += v.spo2; }
    });
    predSnap.forEach(c => {
      const v = c.val();
      if (v.confidence) { avgConf += v.confidence; confCount++; }
    });
    return {
      spo2Samples:  spo2Snap.numChildren(),
      ecgSamples:   ecgSnap.numChildren(),
      predSamples:  predSnap.numChildren(),
      alertCount:   alertSnap.numChildren(),
      avgBpm:       bpmCount   ? Math.round(totalBpm  / bpmCount)   : 0,
      avgSpo2:      bpmCount   ? (totalSpo2 / bpmCount).toFixed(1)  : 0,
      avgConfidence:confCount   ? Math.round(avgConf / confCount)    : 0
    };
  }
};

/* ═══════════════════════════════════════════════
   LISTENER MANAGER – cleans up on page unload
═══════════════════════════════════════════════ */
const ListenerManager = {
  _list: [],
  add(fn)     { if (fn) this._list.push(fn); },
  removeAll() { this._list.forEach(fn => { try { fn(); } catch {} }); this._list = []; }
};
window.addEventListener('beforeunload', () => ListenerManager.removeAll());
