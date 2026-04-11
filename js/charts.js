/**
 * HeartLyf Charts
 * Shared Chart.js helpers and live chart updaters
 */

const CHART_DEFAULTS = {
  responsive: true,
  animation: { duration: 0 },
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: 'rgba(13,24,41,0.95)',
    borderColor: 'rgba(46,108,246,0.3)',
    borderWidth: 1,
    titleColor: '#94a3b8',
    bodyColor: '#e2e8f0',
    padding: 10,
    callbacks: {}
  }},
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false } },
    y: { ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false } }
  }
};

const instances = {};

function destroyChart(id) {
  if (instances[id]) { instances[id].destroy(); delete instances[id]; }
}

/* ── BPM Trend (real-time rolling) ── */
function initBPMChart(canvasId, initialData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const labels = initialData.map((_, i) => i);
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: [...initialData],
        borderColor: '#ef4444',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0, 'rgba(239,68,68,0.18)');
          g.addColorStop(1, 'rgba(239,68,68,0.01)');
          return g;
        },
        tension: 0.42
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { display: false },
        y: { ...CHART_DEFAULTS.scales.y, min: 40, max: 140 }
      }
    }
  });
  return instances[canvasId];
}

/* ── SpO2 Trend ── */
function initSpO2Chart(canvasId, initialData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.map((_, i) => i),
      datasets: [{
        data: [...initialData],
        borderColor: '#2E6CF6',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0, 'rgba(46,108,246,0.18)');
          g.addColorStop(1, 'rgba(46,108,246,0.01)');
          return g;
        },
        tension: 0.42
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { display: false },
        y: { ...CHART_DEFAULTS.scales.y, min: 88, max: 101 }
      }
    }
  });
  return instances[canvasId];
}

/* ── 24H BPM Distribution ── */
function initHRDistChart(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const hours = Array.from({ length: 24 }, (_, i) => i + 'h');
  const vals  = [63,61,60,62,66,70,74,79,77,75,73,72,74,77,75,73,81,84,79,75,72,69,66,64];

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        data: vals,
        backgroundColor: vals.map(v => v > 100 ? 'rgba(255,77,77,0.7)' : 'rgba(46,108,246,0.65)'),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: 12 } },
        y: { ...CHART_DEFAULTS.scales.y, min: 50, max: 100 }
      }
    }
  });
  return instances[canvasId];
}

/* ── Rhythm Classification Bar Chart ── */
function initRhythmChart(canvasId, data) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const d = data || { labels: ['Normal','Arrhythmia','SVT','VT','PVC'], values: [78,13,4,3,2] };

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{
        data: d.values,
        backgroundColor: ['rgba(46,108,246,0.75)','rgba(255,77,77,0.7)','rgba(255,165,0,0.7)','rgba(139,92,246,0.7)','rgba(0,209,178,0.7)'],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x },
        y: { ...CHART_DEFAULTS.scales.y, max: 100 }
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.raw}%` }
        }
      }
    }
  });
  return instances[canvasId];
}

/* ── AI Model Performance Radar ── */
function initConfidenceChart(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Normal Sinus','Atrial Fib','VT','PVC','Bundle Block'],
      datasets: [{
        data: [99.8, 98.5, 97.2, 96.8, 95.4],
        borderColor: '#00D1B2',
        backgroundColor: 'rgba(0,209,178,0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#00D1B2',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800 },
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 90, max: 100,
          ticks: { color: '#64748b', font: { size: 9 }, stepSize: 2 },
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#94a3b8', font: { size: 11, family: 'Poppins' } }
        }
      }
    }
  });
  return instances[canvasId];
}

/* ── Live chart update helper ── */
function pushToChart(id, value) {
  const ch = instances[id];
  if (!ch) return;
  ch.data.datasets[0].data.push(value);
  ch.data.labels.push('');
  if (ch.data.datasets[0].data.length > 60) {
    ch.data.datasets[0].data.shift();
    ch.data.labels.shift();
  }
  ch.update('none');
}
