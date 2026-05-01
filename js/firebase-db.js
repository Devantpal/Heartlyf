/**
 * HeartLyft – Firebase Realtime Database Module v2.0
 * ────────────────────────────────────────────────────
 * Full schema mapping:
 *
 *  /users/{userId}                          → User profile
 *  /devices/{deviceId}                      → Device status, battery, WiFi
 *  /vitals/{deviceId}/latest                → Latest BPM, SpO2, ECG, rhythm
 *  /vitals/{deviceId}/history/{ts}          → Timestamped vital history
 *  /ecg_data/{deviceId}/{ts}               → Raw ADC ECG samples (0–4095)
 *  /ml_prediction/{deviceId}/latest        → Latest ML risk + confidence
 *  /ml_prediction/{deviceId}/history/{ts}  → ML prediction history
 *  /alerts/{deviceId}/{alertId}            → Alert records
 *  /gps_tracking/{deviceId}/{alertId}      → GPS coordinates captured for alerts
 *  /telegram_alerts/{deviceId}/{alertId}   → Telegram delivery queue/status
 *  /settings/{deviceId}/thresholds         → BPM/SpO2 thresholds
 *  /settings/{deviceId}/notifications      → Notification flags
 *  /logs/{deviceId}/{ts}                   → System event logs
 */

/* ═══════════════════════════════════════════════
   PATH BUILDER
═══════════════════════════════════════════════ */
const DEVICE_ID = 'esp32_001';  // Matches ESP32 firmware DEVICE_ID

const PATH = {
  // User
  user:             (uid)        => `/users/${uid}`,
  // Device
  device:           (did)        => `/devices/${did}`,
  deviceStatus:     (did)        => `/devices/${did}/status`,
  deviceLastSeen:   (did)        => `/devices/${did}/lastSeen`,
  // Vitals
  vitalsLatest:     (did)        => `/vitals/${did}/latest`,
  vitalsHistory:    (did)        => `/vitals/${did}/history`,
  vitalsRecord:     (did, ts)    => `/vitals/${did}/history/${ts}`,
  // ECG
  ecgData:          (did)        => `/ecg_data/${did}`,
  ecgSample:        (did, ts)    => `/ecg_data/${did}/${ts}`,
  // ML Prediction
  mlLatest:         (did)        => `/ml_prediction/${did}/latest`,
  mlHistory:        (did)        => `/ml_prediction/${did}/history`,
  mlRecord:         (did, ts)    => `/ml_prediction/${did}/history/${ts}`,
  // Alerts
  alerts:           (did)        => `/alerts/${did}`,
  alert:            (did, aid)   => `/alerts/${did}/${aid}`,
  gpsTracking:      (did)        => `/gps_tracking/${did}`,
  gpsRecord:        (did, aid)   => `/gps_tracking/${did}/${aid}`,
  gpsLatest:        (did)        => `/gps_tracking/${did}/latest`,
  gpsHistory:       (did)        => `/gps_tracking/${did}/history`,
  gpsHistoryRecord: (did, ts)    => `/gps_tracking/${did}/history/${ts}`,
  telegramAlerts:   (did)        => `/telegram_alerts/${did}`,
  telegramAlert:    (did, aid)   => `/telegram_alerts/${did}/${aid}`,
  // Settings
  settingsThresh:   (did)        => `/settings/${did}/thresholds`,
  settingsNotif:    (did)        => `/settings/${did}/notifications`,
  // Logs
  logs:             (did)        => `/logs/${did}`
};

/* ═══════════════════════════════════════════════
   DB MODULE
═══════════════════════════════════════════════ */
const DB = {

  /* ────────────────────────────────
     USER OPERATIONS
  ──────────────────────────────── */
  readUser:   (uid) => db.ref(PATH.user(uid)).once('value'),
  writeUser:  (uid, data) => db.ref(PATH.user(uid)).update(data),
  listenUser: (uid, cb) => {
    const ref = db.ref(PATH.user(uid));
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     DEVICE STATUS
  ──────────────────────────────── */
  readDevice:  (did = DEVICE_ID) => db.ref(PATH.device(did)).once('value'),
  listenDevice:(did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.device(did));
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     VITALS — /vitals/{did}/latest
  ──────────────────────────────── */
  readVitalsLatest: (did = DEVICE_ID) =>
    db.ref(PATH.vitalsLatest(did)).once('value'),

  listenVitalsLatest: (did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.vitalsLatest(did));
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     VITALS HISTORY — last N records
  ──────────────────────────────── */
  readVitalsHistory: (did = DEVICE_ID, limit = 60) =>
    db.ref(PATH.vitalsHistory(did)).orderByKey().limitToLast(limit).once('value'),

  listenVitalsHistory: (did = DEVICE_ID, cb, limit = 60) => {
    const ref = db.ref(PATH.vitalsHistory(did)).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, ...child.val() }));
      cb(items);
    });
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     ECG RAW SAMPLES
  ──────────────────────────────── */
  readECGLatest: (did = DEVICE_ID, limit = 200) =>
    db.ref(PATH.ecgData(did)).orderByKey().limitToLast(limit).once('value'),

  listenECG: (did = DEVICE_ID, cb, limit = 200) => {
    const ref = db.ref(PATH.ecgData(did)).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, value: child.val().value }));
      cb(items);
    });
    return () => ref.off('value');
  },

  listenECGLatestSample: (did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.ecgData(did)).orderByKey().limitToLast(1);
    ref.on('value', snap => {
      let latest = null;
      snap.forEach(child => { latest = { ts: child.key, ...child.val() }; });
      cb(latest);
    });
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     ML PREDICTION — latest + history
  ──────────────────────────────── */
  readMLLatest: (did = DEVICE_ID) =>
    db.ref(PATH.mlLatest(did)).once('value'),

  listenMLLatest: (did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.mlLatest(did));
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  listenMLHistory: (did = DEVICE_ID, cb, limit = 50) => {
    const ref = db.ref(PATH.mlHistory(did)).orderByKey().limitToLast(limit);
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ ts: child.key, ...child.val() }));
      cb(items);
    });
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     ALERTS
  ──────────────────────────────── */
  readAlerts: (did = DEVICE_ID) => db.ref(PATH.alerts(did)).once('value'),

  listenAlerts: (did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.alerts(did));
    ref.on('value', snap => {
      const items = [];
      snap.forEach(child => items.push({ id: child.key, ...child.val() }));
      // Sort newest first
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      cb(items);
    });
    return () => ref.off('value');
  },

  resolveAlert: (did = DEVICE_ID, alertId) =>
    db.ref(PATH.alert(did, alertId)).update({
      resolved: true,
      resolvedAt: Date.now()
    }),

  writeAlert: async (did = DEVICE_ID, type, severity, value, message) => {
    const recentSnap = await db.ref(PATH.alerts(did)).orderByChild('timestamp').limitToLast(12).once('value');
    let recentAlert = null;
    recentSnap.forEach(child => {
      const item = child.val() || {};
      if (item.type === type && !item.resolved && Date.now() - (item.timestamp || 0) < 60000) {
        recentAlert = { id: child.key, ...item };
      }
    });
    if (recentAlert) {
      await DB.handleAlertSideEffects(did, recentAlert.id, recentAlert);
      return recentAlert.id;
    }

    const alertId = 'alert_' + Date.now();
    const alert = {
      id: alertId,
      type, severity, value, message,
      deviceId: did,
      timestamp: Date.now(),
      resolved: false,
      notificationSent: false,
      telegramSent: false,
      telegramQueued: false,
      locationShared: false,
      deliveryStarted: true
    };
    await db.ref(PATH.alert(did, alertId)).set(alert);
    await DB.handleAlertSideEffects(did, alertId, alert);
    return alertId;
  },

  readGPSLatest: (did = DEVICE_ID, limit = 10) =>
    db.ref(PATH.gpsLatest(did)).once('value'),

  listenGPSLatest: (did = DEVICE_ID, cb) => {
    const ref = db.ref(PATH.gpsLatest(did));
    ref.on('value', snap => {
      const latest = snap.val();
      cb(latest ? [latest] : []);
    });
    return () => ref.off('value');
  },

  async writeGPSLatest(did = DEVICE_ID, gps) {
    if (!gps || !gps.latitude || !gps.longitude) return null;
    const ts = Date.now();
    const record = {
      deviceId: did,
      source: 'frontend_geolocation',
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy ?? null,
      altitude: gps.altitude ?? null,
      heading: gps.heading ?? null,
      speed: gps.speed ?? null,
      mapsUrl: `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`,
      timestamp: ts
    };
    await db.ref(PATH.gpsLatest(did)).set(record);
    await db.ref(PATH.gpsHistoryRecord(did, ts)).set(record);
    return record;
  },

  startGPSSharing(did = DEVICE_ID, intervalMs = 30000) {
    if (!navigator.geolocation) return () => {};
    let lastWrite = 0;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastWrite < intervalMs) return;
        lastWrite = now;
        DB.writeGPSLatest(did, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed
        }).catch(err => console.warn('GPS sharing failed', err));
      },
      (err) => console.warn('GPS sharing unavailable', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: intervalMs }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  },

  async captureGPSForAlert(did = DEVICE_ID, alertId, alert = {}) {
    const ts = Date.now();
    let gps = await getFrontendLocation();
    if (!gps?.latitude || !gps?.longitude) {
      const latestSnap = await db.ref(PATH.gpsLatest(did)).once('value').catch(() => null);
      const latest = latestSnap?.val();
      if (latest?.latitude && latest?.longitude) gps = latest;
    }
    const record = {
      deviceId: did,
      alertId,
      alertType: alert.type || null,
      severity: alert.severity || null,
      source: gps ? 'frontend_geolocation' : 'frontend_unavailable',
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      accuracy: gps?.accuracy ?? null,
      altitude: gps?.altitude ?? null,
      heading: gps?.heading ?? null,
      speed: gps?.speed ?? null,
      mapsUrl: gps ? `https://maps.google.com/?q=${gps.latitude},${gps.longitude}` : null,
      error: gps?.error || null,
      timestamp: ts
    };
    await db.ref(PATH.gpsRecord(did, alertId)).set(record);
    await db.ref(PATH.alert(did, alertId)).update({
      gps: record,
      locationShared: !!gps,
      locationUpdatedAt: ts
    });
    return record;
  },

  async queueTelegramAlert(did = DEVICE_ID, alertId, alert = {}, gps = null) {
    const [patientSnap, doctorSnap, notifSnap] = await Promise.all([
      db.ref('/users/user_001').once('value').catch(() => null),
      db.ref('/users/user_002').once('value').catch(() => null),
      db.ref(PATH.settingsNotif(did)).once('value').catch(() => null)
    ]);
    const patient = patientSnap?.val() || {};
    const doctor = doctorSnap?.val() || {};
    const notifications = notifSnap?.val() || {};
    if (notifications.telegram === false) return null;

    const chatIds = [
      patient.telegramChatId,
      doctor.telegramChatId,
      notifications.telegramChatId
    ].filter(Boolean).filter((id, idx, arr) => arr.indexOf(id) === idx);

    const text = buildTelegramAlertText(did, alert, gps, patient);
    const payload = {
      deviceId: did,
      alertId,
      chatIds,
      text,
      gps: gps || null,
      status: 'queued',
      queuedAt: Date.now(),
      sentAt: null,
      provider: 'telegram'
    };

    await db.ref(PATH.telegramAlert(did, alertId)).set(payload);
    await db.ref(PATH.alert(did, alertId)).update({
      notificationSent: true,
      telegramQueued: true
    });

    const sent = await sendTelegramFromFrontend(chatIds, text);
    if (sent.attempted) {
      await db.ref(PATH.telegramAlert(did, alertId)).update({
        status: sent.ok ? 'sent' : 'failed',
        sentAt: sent.ok ? Date.now() : null,
        error: sent.error || null
      });
      await db.ref(PATH.alert(did, alertId)).update({
        telegramSent: sent.ok,
        telegramError: sent.error || null
      });
    }
    return payload;
  },

  async handleAlertSideEffects(did = DEVICE_ID, alertId, alert = null) {
    if (!alertId) return;
    const snap = alert ? null : await db.ref(PATH.alert(did, alertId)).once('value');
    const data = alert || snap?.val();
    if (!data) return;
    if (data.locationShared && data.telegramQueued) return;
    if (!data.deliveryStarted) {
      await db.ref(PATH.alert(did, alertId)).update({ deliveryStarted: true });
    }

    const gps = data.locationShared && data.gps
      ? data.gps
      : await DB.captureGPSForAlert(did, alertId, data);
    if (!data.telegramQueued && !data.telegramSent) {
      await DB.queueTelegramAlert(did, alertId, data, gps);
    }
  },

  /* ────────────────────────────────
     SETTINGS
  ──────────────────────────────── */
  readSettings: (did = DEVICE_ID) =>
    db.ref(`/settings/${did}`).once('value'),

  updateThresholds: (did = DEVICE_ID, thresh) =>
    db.ref(PATH.settingsThresh(did)).update(thresh),

  updateNotifications: (did = DEVICE_ID, notif) =>
    db.ref(PATH.settingsNotif(did)).update(notif),

  listenSettings: (did = DEVICE_ID, cb) => {
    const ref = db.ref(`/settings/${did}`);
    ref.on('value', snap => cb(snap.val()));
    return () => ref.off('value');
  },

  /* ────────────────────────────────
     LOGS
  ──────────────────────────────── */
  readLogs: (did = DEVICE_ID, limit = 20) =>
    db.ref(PATH.logs(did)).orderByKey().limitToLast(limit).once('value'),

  /* ────────────────────────────────
     SIMULATOR WRITES (mirrors ESP32)
  ──────────────────────────────── */
  writeVitalsLatest: (did = DEVICE_ID, vitals) =>
    db.ref(PATH.vitalsLatest(did)).set({
      ...vitals,
      timestamp: Date.now()
    }),

  appendVitalsHistory: (did = DEVICE_ID, vitals) => {
    const ts = Date.now();
    return db.ref(PATH.vitalsRecord(did, ts)).set({
      bpm:       vitals.bpm,
      spo2:      vitals.spo2,
      ecg:       vitals.ecg,
      timestamp: ts
    });
  },

  writeECGSample: (did = DEVICE_ID, adcValue) => {
    const ts = Date.now();
    return db.ref(PATH.ecgSample(did, ts)).set({ value: adcValue });
  },

  writeMLLatest: (did = DEVICE_ID, risk, confidence, classification) =>
    db.ref(PATH.mlLatest(did)).set({
      risk, confidence, classification,
      modelVersion: 'TinyML-v2.4',
      timestamp: Date.now()
    }),

  appendMLHistory: (did = DEVICE_ID, risk, confidence) => {
    const ts = Date.now();
    return db.ref(PATH.mlRecord(did, ts)).set({ risk, confidence, timestamp: ts });
  },

  writeDeviceStatus: (did = DEVICE_ID, status) =>
    db.ref(PATH.device(did)).update({
      status,
      lastSeen: Date.now()
    }),

  /* ────────────────────────────────
     AGGREGATE STATS (Researcher)
  ──────────────────────────────── */
  async getResearchStats(did = DEVICE_ID) {
    const [vitSnap, ecgSnap, mlSnap, alertSnap] = await Promise.all([
      db.ref(PATH.vitalsHistory(did)).once('value'),
      db.ref(PATH.ecgData(did)).once('value'),
      db.ref(PATH.mlHistory(did)).once('value'),
      db.ref(PATH.alerts(did)).once('value')
    ]);

    let totalBpm = 0, bpmCount = 0, totalSpo2 = 0, avgConf = 0, confCount = 0;
    vitSnap.forEach(c => {
      const v = c.val();
      if (v.bpm  > 0) { totalBpm  += v.bpm;  bpmCount++; }
      if (v.spo2 > 0) { totalSpo2 += v.spo2; }
    });
    mlSnap.forEach(c => {
      const v = c.val();
      if (v.confidence) { avgConf += v.confidence; confCount++; }
    });

    return {
      vitalSamples:  vitSnap.numChildren(),
      ecgSamples:    ecgSnap.numChildren(),
      mlPredictions: mlSnap.numChildren(),
      alertCount:    alertSnap.numChildren(),
      avgBpm:        bpmCount  ? Math.round(totalBpm / bpmCount)          : 0,
      avgSpo2:       bpmCount  ? parseFloat((totalSpo2 / bpmCount).toFixed(1)) : 0,
      avgConfidence: confCount ? Math.round(avgConf / confCount)           : 0
    };
  },

  /* ────────────────────────────────
     HISTORY FOR CHARTS
  ──────────────────────────────── */
  async getVitalHistory(did = DEVICE_ID, limit = 60) {
    const snap = await db.ref(PATH.vitalsHistory(did)).orderByKey().limitToLast(limit).once('value');
    const bpms = [], spo2s = [];
    snap.forEach(c => {
      const v = c.val();
      if (v.bpm)  bpms.push(v.bpm);
      if (v.spo2) spo2s.push(v.spo2);
    });
    return { bpms, spo2s };
  }
};

/* ═══════════════════════════════════════════════
   GPS + TELEGRAM HELPERS
═══════════════════════════════════════════════ */
function getFrontendLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: 'Geolocation is not supported by this browser.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed
      }),
      (err) => resolve({ error: err.message || 'Location permission denied or unavailable.' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

function buildTelegramAlertText(did, alert, gps, patient = {}) {
  const lines = [
    'Heartlyf emergency alert',
    `Patient: ${patient.name || alert.patientName || 'Unknown'}`,
    `Device: ${did}`,
    `Type: ${alert.type || 'abnormality'}`,
    `Severity: ${alert.severity || 'unknown'}`,
    `Value: ${alert.value ?? '-'}`,
    `Message: ${alert.message || 'Abnormal cardiac reading detected.'}`,
    `Time: ${new Date(alert.timestamp || Date.now()).toLocaleString()}`
  ];
  if (gps?.latitude && gps?.longitude) {
    lines.push(`GPS: ${gps.latitude}, ${gps.longitude}`);
    lines.push(`Map: ${gps.mapsUrl || `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`}`);
  } else {
    lines.push(`GPS: unavailable${gps?.error ? ` (${gps.error})` : ''}`);
  }
  return lines.join('\n');
}

async function sendTelegramFromFrontend(chatIds, text) {
  const token = window.HEARTLYFT_TELEGRAM_BOT_TOKEN || localStorage.getItem('HEARTLYFT_TELEGRAM_BOT_TOKEN');
  if (!token || !chatIds.length) {
    return { attempted: false, ok: false, error: 'Telegram bot token or chat ID not configured in frontend.' };
  }
  try {
    await Promise.all(chatIds.map(chat_id =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: false })
      }).then(res => {
        if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
        return res.json();
      })
    ));
    return { attempted: true, ok: true };
  } catch (err) {
    return { attempted: true, ok: false, error: err?.message || String(err) };
  }
}

/* ═══════════════════════════════════════════════
   LISTENER MANAGER
═══════════════════════════════════════════════ */
const ListenerManager = {
  _list: [],
  add(fn)     { if (fn) this._list.push(fn); },
  removeAll() { this._list.forEach(fn => { try { fn(); } catch {} }); this._list = []; }
};

window.addEventListener('beforeunload', () => ListenerManager.removeAll());
