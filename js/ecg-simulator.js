/**
 * HeartLyft – ESP32 Web Simulator v2.0
 * ─────────────────────────────────────
 * Mirrors the exact ESP32 firmware behaviour in the browser.
 * Writes to the same Firebase paths the ESP32 uses:
 *
 *   /vitals/{deviceId}/latest           → { bpm, spo2, ecg, rhythm, timestamp }
 *   /vitals/{deviceId}/history/{ts}     → { bpm, spo2, ecg, timestamp }
 *   /ecg_data/{deviceId}/{ts}           → { value: 0–4095 }
 *   /ml_prediction/{deviceId}/latest    → { risk, confidence, classification, timestamp }
 *   /ml_prediction/{deviceId}/history/{ts}
 *   /alerts/{deviceId}/{alertId}        → { type, severity, value, message, timestamp }
 *   /devices/{deviceId}                 → { status, lastSeen, battery, wifiRSSI }
 */

const SIM_DEVICE_ID = 'esp32_001';

class ESP32Simulator {
  constructor(deviceId = SIM_DEVICE_ID) {
    this.deviceId      = deviceId;
    this._vitalsTimer  = null;
    this._ecgTimer     = null;
    this._heartbeat    = null;
    this._t            = 0;
    this._phase        = 0;
    this._running      = false;
    this._alertCooldown = {};
    this._alertCounter  = 0;
    this._bpmHistory    = [];
    this._battery       = 82;
  }

  /* ── Start (called on patient login) ── */
  async start() {
    if (this._running) return;
    this._running = true;

    // Mark device online
    await DB.writeDeviceStatus(this.deviceId, 'online');

    // Write initial settings if missing
    await this._seedSettings();

    // Vitals every 2 s (matches ESP32 VITALS_INTERVAL)
    this._vitalsTimer = setInterval(() => this._tickVitals(), 2000);

    // ECG samples every 10 ms (matches ESP32 ECG_INTERVAL → 100 Hz upload)
    this._ecgTimer = setInterval(() => this._tickECG(), 10);

    // Device heartbeat every 30 s
    this._heartbeat = setInterval(() => this._sendHeartbeat(), 30000);

    console.log(`📡 [Simulator] ESP32 "${this.deviceId}" online → writing to Firebase`);
  }

  /* ── Stop (called on signout / page close) ── */
  async stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._vitalsTimer);
    clearInterval(this._ecgTimer);
    clearInterval(this._heartbeat);
    this._vitalsTimer = this._ecgTimer = this._heartbeat = null;
    await DB.writeDeviceStatus(this.deviceId, 'offline');
    console.log(`📡 [Simulator] ESP32 "${this.deviceId}" offline`);
  }

  /* ── Vitals tick: BPM + SpO2 + ML prediction + alerts ── */
  async _tickVitals() {
    this._t += 0.12;

    // ── Generate realistic BPM ──
    let bpm = Math.round(
      72
      + Math.sin(this._t * 0.4) * 10
      + Math.sin(this._t * 1.1) * 4
      + (Math.random() - 0.5) * 5
    );
    // 6 % chance of tachycardia episode
    if (Math.random() < 0.06) bpm = Math.round(104 + Math.random() * 26);
    bpm = Math.max(45, Math.min(165, bpm));

    // ── SpO2 ──
    const spo2Raw = 98 + Math.sin(this._t * 0.25) * 0.9 + (Math.random() - 0.5) * 0.6;
    const spo2    = parseFloat(Math.max(90, Math.min(100, spo2Raw)).toFixed(1));

    // ── ECG (latest single sample for vitals record) ──
    const ecgVal  = this._calcECGSample();

    // ── HRV (simple approximation) ──
    const hrv = Math.round(38 + Math.sin(this._t * 0.7) * 8 + (Math.random() - 0.5) * 4);

    // ── Rhythm ──
    const rhythm = bpm > 150 ? 'V-Tachycardia'
                 : bpm > 100 ? 'Tachycardia'
                 : bpm < 50  ? 'Bradycardia'
                 : 'Normal Sinus Rhythm';

    // ── ML prediction ──
    let risk = 'low', confidence = 85;
    if (bpm > 120 || spo2 < 90)      { risk = 'high';     confidence = Math.round(88 + Math.random() * 10); }
    else if (bpm > 100 || bpm < 50)  { risk = 'moderate'; confidence = Math.round(76 + Math.random() * 10); }
    else                             { risk = 'low';      confidence = Math.round(82 + Math.random() * 14); }

    // ── Write to Firebase (mirrors ESP32 firmware) ──
    await DB.writeVitalsLatest(this.deviceId, { bpm, spo2, ecg: ecgVal, hrv, rhythm });
    await DB.appendVitalsHistory(this.deviceId, { bpm, spo2, ecg: ecgVal });
    await DB.writeMLLatest(this.deviceId, risk, confidence, rhythm);
    await DB.appendMLHistory(this.deviceId, risk, confidence);

    // ── Battery drain simulation ──
    if (this._bpmHistory.length % 60 === 0 && this._battery > 5) this._battery--;

    this._bpmHistory.push(bpm);

    // ── Alert checks (mirrors ESP32 checkAlerts()) ──
    this._checkAlerts(bpm, spo2);
  }

  /* ── ECG tick: raw AD8232 ADC sample (0–4095, 12-bit) ── */
  _tickECG() {
    const adcValue = this._calcECGSample();
    DB.writeECGSample(this.deviceId, adcValue);
    this._phase += 0.016;
  }

  /* ── PQRST waveform → ADC value (0–4095) ── */
  _calcECGSample() {
    const p   = this._phase % 1.0;
    const G   = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2);
    let ecgN  = 0;
    ecgN += 0.15  * G(p, 0.10,  0.022);   // P wave
    ecgN -= 0.14  * G(p, 0.172, 0.008);   // Q dip
    ecgN += 1.00  * G(p, 0.200, 0.011);   // R peak (sharp)
    ecgN -= 0.20  * G(p, 0.226, 0.009);   // S dip
    ecgN += 0.26  * G(p, 0.370, 0.052);   // T wave
    ecgN += 0.03  * G(p, 0.480, 0.018);   // U wave
    ecgN += 0.012 * Math.sin(2 * Math.PI * this._t * 0.15); // baseline wander
    ecgN += (Math.random() - 0.5) * 0.018; // sensor noise
    const adc = Math.round(2048 + ecgN * 580);
    return Math.max(0, Math.min(4095, adc));
  }

  /* ── Alert logic (mirrors ESP32 checkAlerts()) ── */
  _checkAlerts(bpm, spo2) {
    const now = Date.now();
    const COOLDOWN = 60000; // 60 s

    // Tachycardia
    if (bpm > 100) {
      const last = this._alertCooldown['tachycardia'] || 0;
      if (now - last > COOLDOWN) {
        this._alertCooldown['tachycardia'] = now;
        DB.writeAlert(
          this.deviceId,
          'tachycardia', 'high', bpm,
          `High heart rate detected — BPM: ${bpm}`
        );
      }
    }
    // Bradycardia
    if (bpm > 0 && bpm < 50) {
      const last = this._alertCooldown['bradycardia'] || 0;
      if (now - last > COOLDOWN) {
        this._alertCooldown['bradycardia'] = now;
        DB.writeAlert(
          this.deviceId,
          'bradycardia', 'medium', bpm,
          `Low heart rate detected — BPM: ${bpm}`
        );
      }
    }
    // Low SpO2
    if (spo2 > 0 && spo2 < 94) {
      const last = this._alertCooldown['low_spo2'] || 0;
      if (now - last > COOLDOWN) {
        this._alertCooldown['low_spo2'] = now;
        DB.writeAlert(
          this.deviceId,
          'low_spo2', 'high', spo2,
          `Low SpO2 detected — SpO2: ${spo2}%`
        );
      }
    }
  }

  /* ── Device heartbeat ── */
  async _sendHeartbeat() {
    await db.ref(`/devices/${this.deviceId}`).update({
      status:    'online',
      lastSeen:  Date.now(),
      battery:   this._battery,
      wifiRSSI:  Math.round(-55 + (Math.random() - 0.5) * 20),
      freeHeap:  Math.round(200000 + Math.random() * 50000),
      firmware:  'v1.0',
      uptime:    Math.round(this._bpmHistory.length * 2)
    });
  }

  /* ── Seed default settings if not exist ── */
  async _seedSettings() {
    const snap = await db.ref(`/settings/${this.deviceId}`).once('value');
    if (snap.exists()) return;
    await db.ref(`/settings/${this.deviceId}`).set({
      thresholds: {
        bpmHigh: 100,
        bpmLow:  50,
        spo2Low: 94,
        hrvLow:  20
      },
      notifications: {
        telegram: true,
        telegramChatId: '1594669605',
        sms:      false,
        gps:      true,
        emailAlert: true
      },
      sampling: {
        vitalsIntervalMs: 2000,
        ecgIntervalMs:    10,
        uploadIntervalMs: 2000
      }
    });
  }

  getCurrentBPM() {
    return this._bpmHistory.length
      ? this._bpmHistory[this._bpmHistory.length - 1]
      : 72;
  }
}

/* ── Singleton ── */
let _simulator = null;

function startSimulator(deviceId = SIM_DEVICE_ID) {
  if (_simulator) _simulator.stop();
  _simulator = new ESP32Simulator(deviceId);
  _simulator.start();
  return _simulator;
}

function stopSimulator() {
  if (_simulator) { _simulator.stop(); _simulator = null; }
}

window.addEventListener('beforeunload', stopSimulator);
