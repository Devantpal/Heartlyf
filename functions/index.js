const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

const db = admin.database();
const ALERT_COOLDOWN_MS = 60 * 1000;

exports.createAlertOnAbnormalVitals = functions.database
  .ref('/vitals/{deviceId}/latest')
  .onWrite(async (change, context) => {
    if (!change.after.exists()) return null;

    const deviceId = context.params.deviceId;
    const vitals = change.after.val() || {};
    const settingsSnap = await db.ref(`/settings/${deviceId}/thresholds`).once('value');
    const thresholds = settingsSnap.val() || {};

    const bpmHigh = Number(thresholds.bpmHigh || 100);
    const bpmLow = Number(thresholds.bpmLow || 50);
    const spo2Low = Number(thresholds.spo2Low || 94);
    const checks = [
      {
        type: 'tachycardia',
        severity: 'high',
        active: Number(vitals.bpm) > bpmHigh,
        value: vitals.bpm,
        message: `High heart rate detected from database write - BPM: ${vitals.bpm}`
      },
      {
        type: 'bradycardia',
        severity: 'medium',
        active: Number(vitals.bpm) > 0 && Number(vitals.bpm) < bpmLow,
        value: vitals.bpm,
        message: `Low heart rate detected from database write - BPM: ${vitals.bpm}`
      },
      {
        type: 'low_spo2',
        severity: 'high',
        active: Number(vitals.spo2) > 0 && Number(vitals.spo2) < spo2Low,
        value: vitals.spo2,
        message: `Low SpO2 detected from database write - SpO2: ${vitals.spo2}%`
      }
    ];

    for (const check of checks) {
      if (check.active) await createDatabaseAlert(deviceId, check);
    }
    return null;
  });

exports.createAlertOnHighMlRisk = functions.database
  .ref('/ml_prediction/{deviceId}/latest')
  .onWrite(async (change, context) => {
    if (!change.after.exists()) return null;
    const deviceId = context.params.deviceId;
    const ml = change.after.val() || {};
    if (String(ml.risk || '').toLowerCase() !== 'high') return null;

    await createDatabaseAlert(deviceId, {
      type: 'ml_high_risk',
      severity: 'high',
      value: ml.confidence || 0,
      message: `High ML cardiac risk detected from database write - confidence: ${ml.confidence || 0}%`
    });
    return null;
  });

exports.sendTelegramOnAlert = functions.database
  .ref('/alerts/{deviceId}/{alertId}')
  .onCreate(async (snapshot, context) => {
    const deviceId = context.params.deviceId;
    const alertId = context.params.alertId;
    await enrichAndSendTelegram(deviceId, alertId, snapshot.val() || {});
    return null;
  });

async function createDatabaseAlert(deviceId, check) {
  const recentSnap = await db.ref(`/alerts/${deviceId}`).orderByChild('timestamp').limitToLast(12).once('value');
  let duplicate = null;
  recentSnap.forEach((child) => {
    const alert = child.val() || {};
    if (alert.type === check.type && !alert.resolved && Date.now() - Number(alert.timestamp || 0) < ALERT_COOLDOWN_MS) {
      duplicate = { id: child.key, ...alert };
    }
  });
  if (duplicate) return duplicate.id;

  const alertId = `alert_${Date.now()}`;
  const gps = await getLatestGPS(deviceId);
  const alert = {
    id: alertId,
    deviceId,
    type: check.type,
    severity: check.severity,
    value: check.value ?? null,
    message: check.message,
    timestamp: Date.now(),
    resolved: false,
    notificationSent: false,
    telegramSent: false,
    telegramQueued: false,
    locationShared: !!gps,
    gps: gps || null,
    source: 'firebase_database_trigger'
  };

  await db.ref(`/alerts/${deviceId}/${alertId}`).set(alert);
  await db.ref(`/logs/${deviceId}/${Date.now()}`).set({
    event: 'database_alert_created',
    alertId,
    type: check.type,
    value: check.value ?? null,
    timestamp: Date.now()
  });
  return alertId;
}

async function enrichAndSendTelegram(deviceId, alertId, alert) {
  if (alert.telegramSent) return;

  const gps = alert.gps || await getLatestGPS(deviceId);
  const [patientSnap, doctorSnap, notificationSnap] = await Promise.all([
    db.ref('/users/user_001').once('value').catch(() => null),
    db.ref('/users/user_002').once('value').catch(() => null),
    db.ref(`/settings/${deviceId}/notifications`).once('value').catch(() => null)
  ]);
  const patient = patientSnap?.val() || {};
  const doctor = doctorSnap?.val() || {};
  const notifications = notificationSnap?.val() || {};
  if (notifications.telegram === false) return;

  const chatIds = [
    patient.telegramChatId,
    doctor.telegramChatId,
    notifications.telegramChatId
  ].filter(Boolean).filter((id, idx, arr) => arr.indexOf(id) === idx);

  const text = buildTelegramAlertText(deviceId, alert, gps, patient);
  const queuePayload = {
    deviceId,
    alertId,
    chatIds,
    text,
    gps: gps || null,
    provider: 'telegram',
    status: 'queued',
    queuedAt: Date.now(),
    sentAt: null
  };
  await db.ref(`/telegram_alerts/${deviceId}/${alertId}`).set(queuePayload);
  await db.ref(`/alerts/${deviceId}/${alertId}`).update({
    notificationSent: true,
    telegramQueued: true,
    locationShared: !!gps,
    gps: gps || null
  });

  const token = getTelegramToken();
  if (!token || !chatIds.length) {
    await db.ref(`/telegram_alerts/${deviceId}/${alertId}`).update({
      status: 'needs_config',
      error: 'Telegram bot token or chat ID is missing.'
    });
    return;
  }

  try {
    await Promise.all(chatIds.map((chatId) => sendTelegramMessage(token, chatId, text)));
    await db.ref(`/telegram_alerts/${deviceId}/${alertId}`).update({
      status: 'sent',
      sentAt: Date.now(),
      error: null
    });
    await db.ref(`/alerts/${deviceId}/${alertId}`).update({
      telegramSent: true,
      telegramError: null
    });
  } catch (err) {
    await db.ref(`/telegram_alerts/${deviceId}/${alertId}`).update({
      status: 'failed',
      error: err.message || String(err)
    });
    await db.ref(`/alerts/${deviceId}/${alertId}`).update({
      telegramSent: false,
      telegramError: err.message || String(err)
    });
  }
}

async function getLatestGPS(deviceId) {
  const latestSnap = await db.ref(`/gps_tracking/${deviceId}/latest`).once('value').catch(() => null);
  const latest = latestSnap?.val();
  if (latest?.latitude && latest?.longitude) return latest;

  const historySnap = await db.ref(`/gps_tracking/${deviceId}/history`).orderByChild('timestamp').limitToLast(1).once('value').catch(() => null);
  let gps = null;
  historySnap?.forEach((child) => { gps = child.val(); });
  return gps?.latitude && gps?.longitude ? gps : null;
}

function buildTelegramAlertText(deviceId, alert, gps, patient) {
  const lines = [
    'Heartlyf emergency alert',
    `Patient: ${patient.name || alert.patientName || 'Unknown'}`,
    `Device: ${deviceId}`,
    `Type: ${alert.type || 'abnormality'}`,
    `Severity: ${alert.severity || 'unknown'}`,
    `Value: ${alert.value ?? '-'}`,
    `Message: ${alert.message || 'Abnormal cardiac reading detected.'}`,
    `Time: ${new Date(alert.timestamp || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
  ];
  if (gps?.latitude && gps?.longitude) {
    lines.push(`GPS: ${gps.latitude}, ${gps.longitude}`);
    lines.push(`Map: ${gps.mapsUrl || `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`}`);
  } else {
    lines.push('GPS: unavailable');
  }
  return lines.join('\n');
}

function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || functions.config()?.telegram?.token || '';
}

async function sendTelegramMessage(token, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram HTTP ${response.status}: ${body}`);
  }
}
