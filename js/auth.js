/**
 * HeartLyf Auth v2 — stores user info for dashboard display
 */

const DEMO_USERS = {
  patient:    { name: 'Riya Sharma',    email: 'riya.sharma@gmail.com',    initials: 'RS', id: 'PAT-4821' },
  doctor:     { name: 'Dr. Aditya Rao', email: 'aditya.rao@gniot.ac.in',  initials: 'AR', id: 'DOC-0192', specialty: 'Cardiologist', license: 'MCI-2019-4521', hospital: 'GNIOT Medical Centre' },
  family:     { name: 'Priya Sharma',   email: 'priya.sharma@gmail.com',   initials: 'PS', relation: 'Sister', patient: 'Riya Sharma' },
  researcher: { name: 'Gajendra Kumar', email: 'gkumar@gniot.ac.in',       initials: 'GK', institution: 'GNIOT', department: 'CSE - IoT', publications: 3 }
};

function switchTab(tab) {
  const lt = document.getElementById('tab-login');
  const st = document.getElementById('tab-signup');
  const lf = document.getElementById('login-fields');
  const sf = document.getElementById('signup-fields');
  if (!lt) return;
  if (tab === 'login') {
    lt.classList.add('active'); st.classList.remove('active');
    lf.style.display = 'block'; sf.style.display = 'none';
  } else {
    st.classList.add('active'); lt.classList.remove('active');
    lf.style.display = 'none'; sf.style.display = 'block';
  }
}

function loginRoute(e) {
  const btn = e.currentTarget;
  const roleEl = document.getElementById('role-select');
  const role = roleEl ? roleEl.value : 'patient';
  const nameEl = document.getElementById('login-email');

  // Detect if they typed a custom name
  let userInfo = { ...DEMO_USERS[role] };

  // Store in sessionStorage
  sessionStorage.setItem('hl_user', JSON.stringify({ role, ...userInfo }));

  btn.innerHTML = '<span class="spin-icon">⟳</span> Signing in…';
  btn.disabled = true;

  const routes = {
    patient:    'patient-dashboard.html',
    doctor:     'doctor-dashboard.html',
    family:     'family-dashboard.html',
    researcher: 'researcher-dashboard.html'
  };

  setTimeout(() => { window.location.href = routes[role] || 'patient-dashboard.html'; }, 700);
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('hl_user')) || DEMO_USERS.patient; }
  catch { return DEMO_USERS.patient; }
}

function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

document.addEventListener('DOMContentLoaded', () => { switchTab('login'); });
