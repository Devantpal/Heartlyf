/**
 * HeartLyft – ESP32 Device Simulator
 * ────────────────────────────────────
 * Simulates the physical ESP32+AD8232 device writing live sensor
 * data to the EXACT Firebase schema:
 *
 *  /spo2_data/{timestamp}     → { bpm, spo2 }
 *  /ecg_data/{timestamp}      → { value }        (raw 12-bit ADC, 0–4095)
 *  /ml_prediction/{timestamp} → { confidence, risk }
 *  /alerts/{alertId}          → { type, severity, value, timestamp }
 */

class ESP32Simulator {
  constructor() {
    this._interval  = null;
    this._ecgInterval = null;
    this._t         = 0;
    this._running   = false;
    this._tachCount = 0;
    this._bpmHistory = [];
  }

  /* ── Start simulation ── */
  start() {
    if (this._running) return;
    this._running = true;

    // Write vitals every 2 seconds (matches real ESP32 interval)
    this._interval = setInterval(() => this._tickVitals(), 2000);

    // Write raw ECG samples every 250ms (4Hz for demo; real = 250Hz)
    this._ecgInterval = setInterval(() => this._tickECG(), 250);

    console.log('📡 ESP32 Simulator started → writing to Firebase');
  }

  /* ── Stop simulation ── */
  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._interval);
    clearInterval(this._ecgInterval);
    this._interval    = null;
    this._ecgInterval = null;
    console.log('📡 ESP32 Simulator stopped');
  }

  /* ── Vitals tick: BPM, SpO2, ML prediction, alerts ── */
  async _tickVitals() {
    this._t += 0.15;

    // Realistic BPM: sinusoidal drift + noise
    let bpm = Math.round(72 + Math.sin(this._t * 0.4) * 10 + Math.sin(this._t * 1.1) * 4 + (Math.random() - 0.5) * 5);
    // 6% chance of tachycardia spike
    if (Math.random() < 0.06) bpm = Math.round(105 + Math.random() * 25);
    bpm = Math.max(48, Math.min(165, bpm));

    const spo2 = parseFloat((98 + Math.sin(this._t * 0.25) * 0.9 + (Math.random() - 0.5) * 0.6).toFixed(1));

    // ML Prediction
    const risk       = bpm > 100 ? 'high' : bpm > 90 ? 'moderate' : 'low';
    const confidence = Math.round(82 + Math.random() * 16);

    // Write to Firebase /spo2_data
    await DB.writeVital(bpm, Math.max(92, Math.min(100, spo2)));
    // Write ML prediction
    await DB.writePrediction(confidence, risk);

    this._bpmHistory.push(bpm);

    // Alert logic
    if (bpm > 100) {
      this._tachCount++;
      if (this._tachCount === 1 || this._tachCount % 6 === 0) {
        await DB.writeAlert('tachycardia', 'high', bpm);
      }
    } else {
      this._tachCount = 0;
    }

    if (spo2 < 94) {
      await DB.writeAlert('low_spo2', 'high', spo2);
    }
  }

  /* ── ECG tick: raw 12-bit ADC value (0–4095) ── */
  _tickECG() {
    // Simulate realistic AD8232 output using Gaussian PQRST model
    const period  = 1.0; // seconds (normalised)
    const phase   = (this._t % period) / period;
    const gauss   = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2);

    let ecgNorm  = 0;
    ecgNorm += 0.15  * gauss(phase, 0.10, 0.022);  // P wave
    ecgNorm -= 0.14  * gauss(phase, 0.172, 0.008); // Q dip
    ecgNorm += 1.00  * gauss(phase, 0.200, 0.011); // R peak
    ecgNorm -= 0.20  * gauss(phase, 0.226, 0.009); // S dip
    ecgNorm += 0.26  * gauss(phase, 0.370, 0.052); // T wave
    ecgNorm += (Math.random() - 0.5) * 0.03;        // noise

    // Scale to 12-bit ADC range (centered around 2048)
    const adcValue = Math.round(2048 + ecgNorm * 600);
    const clamped  = Math.max(0, Math.min(4095, adcValue));

    DB.writeEcgSample(clamped);
    this._t += 0.016; // small phase advance each ECG tick
  }

  getCurrentBPM() {
    return this._bpmHistory.length ? this._bpmHistory[this._bpmHistory.length - 1] : 72;
  }
}

// ── Singleton ──
let _simulator = null;

function startSimulator() {
  if (_simulator) _simulator.stop();
  _simulator = new ESP32Simulator();
  _simulator.start();
  return _simulator;
}

function stopSimulator() {
  if (_simulator) { _simulator.stop(); _simulator = null; }
}

window.addEventListener('beforeunload', stopSimulator);
