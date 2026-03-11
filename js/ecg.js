/**
 * HeartLyf ECG Engine v2 — Sharp PQRST waveform
 */
class ECGEngine {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.bpm        = options.bpm        || 72;
    this.color      = options.color      || '#00D1B2';
    this.glowColor  = options.glowColor  || 'rgba(0,209,178,0.5)';
    this.gridColor  = options.gridColor  || 'rgba(46,108,246,0.07)';
    this.lineWidth  = options.lineWidth  || 2;
    this.noiseLevel = options.noiseLevel || 0.006;
    this.amplitude  = options.amplitude  || 0.82;
    this.speed      = options.speed      || 2;
    this.showGrid   = options.showGrid   !== false;
    this.glowing    = options.glowing    !== false;
    this.time       = 0;
    this.rafId      = null;
    this.buffer     = [];
    this.timestamps = [];
    this.paused     = false;
    this.hoverX     = -1;
    this.tooltip    = options.tooltipId ? document.getElementById(options.tooltipId) : null;
    this._resize();
    this._bindEvents();
    this.start();
  }
  _gauss(x, mu, sigma) { return Math.exp(-0.5 * ((x - mu) / sigma) ** 2); }
  _ecgSample(t) {
    const period = 60 / this.bpm;
    const phase  = (t % period) / period;
    let v = 0;
    // P wave
    v += 0.15 * this._gauss(phase, 0.100, 0.022);
    // PR depression
    v -= 0.008 * this._gauss(phase, 0.155, 0.016);
    // Q dip
    v -= 0.14 * this._gauss(phase, 0.172, 0.008);
    // R peak — tall and sharp
    v += 1.00 * this._gauss(phase, 0.200, 0.011);
    // S dip
    v -= 0.20 * this._gauss(phase, 0.226, 0.009);
    // ST segment
    v += 0.018 * this._gauss(phase, 0.275, 0.028);
    // T wave
    v += 0.26 * this._gauss(phase, 0.370, 0.052);
    // U wave
    v += 0.03 * this._gauss(phase, 0.480, 0.018);
    // Baseline wander
    v += 0.012 * Math.sin(2 * Math.PI * t * 0.15);
    // Minimal noise for clean sharp look
    v += (Math.random() - 0.5) * this.noiseLevel;
    return v * this.amplitude;
  }
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = this.canvas.parentElement ? this.canvas.parentElement.clientWidth - 40 : 600;
    const h   = parseInt(this.canvas.getAttribute('height')) || 120;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this.W = w; this.H = h;
    this.mid    = h * 0.52;
    this.yScale = h * 0.36;
    const needed = Math.ceil(w) + 2;
    while (this.buffer.length < needed) {
      this.buffer.push(this._ecgSample(this.time));
      this.timestamps.push(this.time);
      this.time += 0.004;
    }
    while (this.buffer.length > needed) { this.buffer.shift(); this.timestamps.shift(); }
  }
  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      if (this.tooltip) this._showTooltip(e);
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverX = -1;
      if (this.tooltip) this.tooltip.style.display = 'none';
    });
  }
  _showTooltip(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const idx  = Math.min(Math.floor((x / this.W) * this.buffer.length), this.buffer.length - 1);
    const val  = this.buffer[idx];
    const mv   = (val / this.amplitude).toFixed(3);
    const sec  = this.timestamps[idx]?.toFixed(2) || '0.00';
    this.tooltip.style.display = 'block';
    this.tooltip.style.left    = Math.min(x + 14, rect.width - 130) + 'px';
    this.tooltip.style.top     = (e.clientY - rect.top - 52) + 'px';
    this.tooltip.innerHTML     = `<div class="tt-time">t = ${sec} s</div><div class="tt-val">${val>0?'+':''}${mv} mV</div>`;
  }
  _drawGrid() {
    const ctx = this.ctx;
    // Major squares (200ms × 0.5mV)
    const major = 40;
    ctx.strokeStyle = 'rgba(46,108,246,0.1)';
    ctx.lineWidth   = 0.7;
    for (let x = 0; x <= this.W; x += major) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke(); }
    for (let y = 0; y <= this.H; y += major) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.W,y); ctx.stroke(); }
    // Minor squares (40ms × 0.1mV)
    ctx.strokeStyle = 'rgba(46,108,246,0.045)';
    ctx.lineWidth   = 0.4;
    const minor = 8;
    for (let x = 0; x <= this.W; x += minor) { if (x % major) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke(); } }
    for (let y = 0; y <= this.H; y += minor) { if (y % major) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.W,y); ctx.stroke(); } }
  }
  _drawWaveform() {
    const ctx = this.ctx;
    const buf = this.buffer;
    const n   = buf.length;
    if (n < 2) return;

    // Glow underlay — wide soft pass
    if (this.glowing) {
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = this.glowColor;
      ctx.strokeStyle = this.glowColor;
      ctx.lineWidth   = this.lineWidth * 3;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * this.W;
        const y = this.mid - buf[i] * this.yScale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Sharp crisp main line — NO tension, pure linear segments for ECG sharpness
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = this.lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    // Use sharp path — no curve smoothing
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * this.W;
      const y = this.mid - buf[i] * this.yScale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  _drawHoverLine() {
    if (this.hoverX < 0) return;
    const ctx = this.ctx;
    const x   = this.hoverX;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,209,178,0.55)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    ctx.restore();
    const idx = Math.min(Math.floor((x / this.W) * this.buffer.length), this.buffer.length - 1);
    const y   = this.mid - this.buffer[idx] * this.yScale;
    ctx.save();
    ctx.fillStyle   = this.color;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = this.color;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  _frame() {
    if (this.paused) return;
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (this.showGrid) this._drawGrid();
    this._drawWaveform();
    this._drawHoverLine();
    // Advance
    this.buffer.push(this._ecgSample(this.time));
    this.timestamps.push(this.time);
    this.time += 0.004;
    const max = Math.ceil(this.W) + 2;
    while (this.buffer.length > max) { this.buffer.shift(); this.timestamps.shift(); }
    this.rafId = requestAnimationFrame(() => this._frame());
  }
  start()   { if (this.rafId) cancelAnimationFrame(this.rafId); this.paused = false; this._frame(); }
  pause()   { this.paused = true; }
  resume()  { this.paused = false; this._frame(); }
  setBPM(b) { this.bpm = Math.max(30, Math.min(200, b)); }
  destroy() { if (this.rafId) cancelAnimationFrame(this.rafId); }
  getLiveBPM() { return Math.round(this.bpm + (Math.random() - 0.5) * 2); }
}
function createECG(id, opts) { return new ECGEngine(id, opts); }
