/**
 * HeartLyft Charts v3 — Red/Noir theme
 */

const CHART_DEFAULTS = {
  responsive: true,
  animation: { duration: 700 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(8,9,26,0.97)',
      borderColor: 'rgba(229,62,62,0.3)',
      borderWidth: 1,
      titleColor: '#64748b',
      bodyColor: '#f1f5f9',
      padding: 10,
    }
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.03)' } },
    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } }
  }
};

const instances = {};

function destroyChart(id) {
  if (instances[id]) { instances[id].destroy(); delete instances[id]; }
}

function initBPMChart(canvasId, initialData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.map((_,i) => i),
      datasets: [{
        data: [...initialData],
        borderColor: '#e53e3e',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#e53e3e',
        fill: true,
        backgroundColor: (c) => {
          const g = c.chart.ctx.createLinearGradient(0, 0, 0, c.chart.height);
          g.addColorStop(0, 'rgba(229,62,62,0.18)');
          g.addColorStop(1, 'rgba(229,62,62,0.01)');
          return g;
        },
        tension: 0.35
      }]
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 40, max: 140 } } }
  });
}

function initSpO2Chart(canvasId, initialData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.map((_,i) => i),
      datasets: [{
        data: [...initialData],
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#3b82f6',
        fill: true,
        backgroundColor: (c) => {
          const g = c.chart.ctx.createLinearGradient(0, 0, 0, c.chart.height);
          g.addColorStop(0, 'rgba(59,130,246,0.18)');
          g.addColorStop(1, 'rgba(59,130,246,0.01)');
          return g;
        },
        tension: 0.35
      }]
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 88, max: 101 } } }
  });
}

function initHRDistChart(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const data = [63,61,60,62,66,70,74,79,77,75,73,72,74,77,75,73,81,84,79,75,72,69,66,64];
  const colors = data.map(v => v > 100 ? 'rgba(229,62,62,0.75)' : 'rgba(59,130,246,0.6)');
  const hoverColors = data.map(v => v > 100 ? 'rgba(229,62,62,0.95)' : 'rgba(59,130,246,0.85)');
  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length:24},(_,i)=>`${i}h`),
      datasets: [{ data, backgroundColor: colors, hoverBackgroundColor: hoverColors, borderRadius: 4, borderSkipped: false }]
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 50, max: 100 } } }
  });
}

function initRhythmChart(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Normal','Arrhythmia','SVT','VT','PVC'],
      datasets: [{
        data: [78,13,4,3,2],
        backgroundColor: ['rgba(229,62,62,0.75)','rgba(251,146,60,0.7)','rgba(59,130,246,0.7)','rgba(139,92,246,0.7)','rgba(34,197,94,0.7)'],
        borderRadius: 5, borderSkipped: false
      }]
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, max: 100 } } }
  });
}

function initConfidenceChart(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Normal Sinus','Atrial Fib','Ventricular T','PVC / PAC','Bundle Block'],
      datasets: [{
        label: 'AI Confidence',
        data: [99.8, 98.5, 97.2, 96.8, 95.4],
        borderColor: '#e53e3e',
        backgroundColor: 'rgba(229,62,62,0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#e53e3e',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 700 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(8,9,26,0.97)', borderColor: 'rgba(229,62,62,0.3)', borderWidth: 1, bodyColor: '#f1f5f9' } },
      scales: {
        r: {
          min: 90, max: 100,
          ticks: { color: '#64748b', font: { size: 9 }, backdropColor: 'transparent' },
          grid:  { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#94a3b8', font: { size: 10 } },
          angleLines: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  });
}

function pushToChart(id, value) {
  const chart = instances[id];
  if (!chart) return;
  chart.data.labels.push('');
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > 60) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}
