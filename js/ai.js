/**
 * HeartLyf AI Engine
 * Real Claude API integration for cardiac analysis
 */

class HeartLyfAI {
  constructor() {
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model  = 'claude-sonnet-4-20250514';
    this.history = [];
  }

  /**
   * Analyse ECG vitals and return streaming medical analysis
   * @param {object} vitals - { bpm, spo2, hrv, ecgEvents, patientAge }
   * @param {HTMLElement} outputEl - element to stream text into
   * @param {function} onDone - callback with final { rhythm, risk, recommendation }
   */
  async analyseVitals(vitals, outputEl, onDone) {
    const { bpm = 72, spo2 = 98, hrv = 42, ecgEvents = [], patientAge = 45 } = vitals;

    const prompt = `You are HeartLyf's embedded AI cardiac analysis engine. 
Analyse the following real-time ECG vitals and provide a concise medical assessment.

CURRENT VITALS:
- Heart Rate: ${bpm} BPM
- SpO2: ${spo2}%
- HRV (RMSSD): ${hrv} ms
- Recent ECG Events: ${ecgEvents.length > 0 ? ecgEvents.join(', ') : 'None detected'}
- Patient Age: ${patientAge} years

Provide your analysis in this exact JSON format only (no markdown, no extra text):
{
  "rhythm": "Normal Sinus Rhythm | Sinus Tachycardia | Sinus Bradycardia | Atrial Fibrillation | Premature Ventricular Contraction | Other",
  "risk": "Low | Moderate | High | Critical",
  "confidence": 95,
  "summary": "One sentence clinical summary",
  "findings": ["Finding 1", "Finding 2"],
  "recommendation": "Clinical recommendation"
}`;

    if (outputEl) outputEl.innerHTML = '<span class="ai-cursor"></span>';

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';

      // Parse JSON response
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Invalid AI response format');

      const result = JSON.parse(match[0]);

      // Animate the output
      if (outputEl) {
        await this._typeText(outputEl, result.summary);
      }

      if (onDone) onDone(result);
      return result;

    } catch (err) {
      console.error('HeartLyf AI error:', err);

      // Fallback local analysis
      const result = this._localAnalysis(vitals);
      if (outputEl) {
        await this._typeText(outputEl, result.summary);
      }
      if (onDone) onDone(result);
      return result;
    }
  }

  /**
   * Chat with HeartLyf AI about cardiac data
   */
  async chat(userMessage, contextVitals, outputEl) {
    this.history.push({ role: 'user', content: userMessage });

    const systemPrompt = `You are HeartLyf AI, an intelligent cardiac monitoring assistant.
Current patient vitals: HR ${contextVitals?.bpm || 72}BPM, SpO2 ${contextVitals?.spo2 || 98}%, HRV ${contextVitals?.hrv || 42}ms.
Provide helpful, medically accurate, concise responses. Always remind that you are a monitoring assistant and not a replacement for professional medical care.`;

    if (outputEl) outputEl.innerHTML = '<span class="ai-cursor"></span>';

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 600,
          system: systemPrompt,
          messages: this.history
        })
      });

      const data = await response.json();
      const reply = data.content?.map(b => b.text || '').join('') || 'Unable to process request.';

      this.history.push({ role: 'assistant', content: reply });

      if (outputEl) await this._typeText(outputEl, reply);
      return reply;

    } catch (err) {
      const reply = 'AI analysis temporarily unavailable. Please check your connection.';
      if (outputEl) outputEl.textContent = reply;
      return reply;
    }
  }

  /** Local fallback analysis when API unavailable */
  _localAnalysis({ bpm = 72, spo2 = 98, hrv = 42 }) {
    let rhythm = 'Normal Sinus Rhythm';
    let risk = 'Low';
    let summary = 'Cardiac vitals within normal physiological range.';
    const findings = [];

    if (bpm > 100) {
      rhythm = 'Sinus Tachycardia';
      risk = bpm > 130 ? 'High' : 'Moderate';
      findings.push(`Elevated heart rate at ${bpm} BPM`);
      summary = `Sinus tachycardia detected at ${bpm} BPM.`;
    } else if (bpm < 50) {
      rhythm = 'Sinus Bradycardia';
      risk = 'Moderate';
      findings.push(`Low heart rate at ${bpm} BPM`);
      summary = `Sinus bradycardia detected at ${bpm} BPM.`;
    } else {
      findings.push(`Normal sinus rate at ${bpm} BPM`);
    }

    if (spo2 < 94) {
      risk = 'High';
      findings.push(`Hypoxemia: SpO2 ${spo2}% — below 94% threshold`);
    } else {
      findings.push(`Adequate oxygenation: SpO2 ${spo2}%`);
    }

    if (hrv < 20) findings.push('Reduced HRV may indicate autonomic stress');
    else findings.push(`HRV ${hrv}ms within acceptable range`);

    return {
      rhythm,
      risk,
      confidence: 87,
      summary,
      findings,
      recommendation: risk === 'Low'
        ? 'Continue regular monitoring. No immediate action required.'
        : 'Notify attending physician. Increase monitoring frequency.'
    };
  }

  /** Typewriter animation */
  async _typeText(el, text, speed = 22) {
    el.innerHTML = '';
    const span = document.createElement('span');
    el.appendChild(span);
    const cursor = document.createElement('span');
    cursor.className = 'ai-cursor';
    el.appendChild(cursor);

    for (let i = 0; i < text.length; i++) {
      span.textContent += text[i];
      await new Promise(r => setTimeout(r, speed));
    }
    cursor.remove();
  }
}

/* Risk color helper */
function riskColor(risk) {
  const map = { Low: '#00D1B2', Moderate: '#ffa500', High: '#FF4D4D', Critical: '#FF4D4D' };
  return map[risk] || '#64748b';
}

/* Badge HTML for risk */
function riskBadge(risk) {
  const cls = { Low: 'badge-normal', Moderate: 'badge-warn', High: 'badge-crit', Critical: 'badge-crit' };
  return `<span class="badge ${cls[risk] || 'badge-blue'}">${risk || 'Unknown'}</span>`;
}

// Singleton
const AI = new HeartLyfAI();
